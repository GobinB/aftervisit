-- AfterVisit initial schema.
-- All access goes through Next.js route handlers using the service-role key.
-- RLS is enabled with no policies, so anon/authenticated roles can read nothing.

create table if not exists public.handoffs (
  token           text primary key,                 -- nanoid(21), the share link
  manage_key_hash text not null,                    -- sha256(salt + manageKey)
  pin_hash        text,                             -- null when no PIN
  pin_failures    int  not null default 0,
  locked_until    timestamptz,
  payload         jsonb not null,                   -- HandoffDraft minus sourceText (zod-validated)
  source_text     text,                             -- scrubbed extracted text
  original_path   text,                             -- storage object path, null unless attached
  created_by      text,                             -- caregiver first name
  recipients      jsonb not null default '[]',
  acks            jsonb not null default '[]',
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null
);

create index if not exists handoffs_expires_at_idx on public.handoffs (expires_at);
alter table public.handoffs enable row level security;  -- no policies: anon and authenticated get nothing

create table if not exists public.rate_limits (
  ip_hash      text,
  bucket       text,
  window_start timestamptz,
  count        int not null default 0,
  primary key (ip_hash, bucket, window_start)
);
alter table public.rate_limits enable row level security;

-- Tombstones let a recipient see "deleted" or "expired" instead of "not found".
-- Only a hash of the share token is kept; no health information. Purged after 30 days.
create table if not exists public.handoff_tombstones (
  token_hash text primary key,
  reason     text not null check (reason in ('deleted', 'expired')),
  created_at timestamptz not null default now()
);
alter table public.handoff_tombstones enable row level security;

-- Increments the counter for the current hour and reports whether the caller is still under the limit.
create or replace function public.check_rate_limit(p_ip_hash text, p_bucket text, p_limit int)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.rate_limits as r (ip_hash, bucket, window_start, count)
  values (p_ip_hash, p_bucket, date_trunc('hour', now()), 1)
  on conflict (ip_hash, bucket, window_start)
  do update set count = r.count + 1
  returning r.count into v_count;

  -- Opportunistic cleanup of old windows.
  delete from public.rate_limits where window_start < now() - interval '1 day';

  return v_count <= p_limit;
end;
$$;

-- Appends an acknowledgment atomically. Returns the new ack count, or null if the handoff is missing/expired.
create or replace function public.add_ack(p_token text, p_name text)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count int;
begin
  update public.handoffs
     set acks = acks || jsonb_build_array(jsonb_build_object('name', p_name, 'at', now()))
   where token = p_token
     and expires_at > now()
     and jsonb_array_length(acks) < 200
  returning jsonb_array_length(acks) into v_count;
  return v_count;
end;
$$;

revoke all on function public.check_rate_limit(text, text, int) from public, anon, authenticated;
revoke all on function public.add_ack(text, text) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, text, int) to service_role;
grant execute on function public.add_ack(text, text) to service_role;

-- storage: private bucket "originals"; objects stored as {token}/{filename}
-- all access via route handlers with the service role; no listing endpoint
insert into storage.buckets (id, name, public, file_size_limit)
values ('originals', 'originals', false, 10485760)
on conflict (id) do nothing;
