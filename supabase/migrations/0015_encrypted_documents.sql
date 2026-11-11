-- Saved visit summaries are encrypted in the caregiver's browser before they are uploaded
-- (docs/decisions/0015-file-encryption.md). Each summary has its own file key. The row keeps only
-- that key wrapped by the circle key, the wrap's IV, and the circle key version it was wrapped
-- under. The server never has the circle key, so it cannot open the file key or the pages.
-- Rows saved before this migration have no key columns: their files are plain and stay readable.
-- Changing the circle key now carries every file key along, rewrapped, in the same transaction.
-- Runs after 0014. Safe to re-run.

alter table public.visit_documents
  add column if not exists key_version int,
  add column if not exists file_key_wrapped text,
  add column if not exists file_key_iv text;

-- A wrapped file key is 32 key bytes plus a 16-byte tag (64 base64url characters); the IV is 12 bytes (16).
alter table public.visit_documents drop constraint if exists visit_documents_file_key_check;
alter table public.visit_documents add constraint visit_documents_file_key_check check (
  (key_version is null and file_key_wrapped is null and file_key_iv is null)
  or (
    key_version is not null and key_version >= 1
    and file_key_wrapped is not null and file_key_wrapped ~ '^[A-Za-z0-9_-]{64}$'
    and file_key_iv is not null and file_key_iv ~ '^[A-Za-z0-9_-]{16}$'
  )
);

-- A file key is always wrapped under the circle's current key, so no file is tied to a key that is gone.
create or replace function public.visit_documents_key_matches_circle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.key_version is not null
     and new.key_version is distinct from (select c.key_version from public.circles c where c.id = new.circle_id) then
    raise exception 'the file key version must match the circle';
  end if;
  return new;
end;
$$;

drop trigger if exists visit_documents_key_matches_circle on public.visit_documents;
create trigger visit_documents_key_matches_circle
  before insert or update on public.visit_documents
  for each row execute function public.visit_documents_key_matches_circle();

-- Encrypted pages are opaque bytes, so the bucket also takes application/octet-stream.
update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'application/pdf', 'application/octet-stream'],
       file_size_limit = 10485760,
       public = false
 where id = 'visit-documents';

-- p_file_keys is [{"id": uuid, "wrapped": text, "iv": text}, ...]: one entry for every encrypted
-- summary in the circle. The rest is unchanged from 0006.
create or replace function public.rotate_own_circle_key(
  p_circle uuid,
  p_wrapped text,
  p_version int,
  p_member_tokens jsonb,
  p_file_keys jsonb
)
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_role text;
  v_current int;
  v_expected int;
  v_updated int;
  v_files int;
begin
  if p_wrapped is null
     or char_length(p_wrapped) > 200
     or p_wrapped !~ '^av1\.600000\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{64}$' then
    raise exception 'wrapped key is not valid';
  end if;

  select role into v_role
  from public.circle_caregivers
  where circle_id = p_circle and user_id = auth.uid();
  if v_role is distinct from 'owner' then
    raise exception 'only the owner can change the circle key';
  end if;

  select key_version into v_current
  from public.circles
  where id = p_circle and deleted_at is null
  for update;
  if v_current is null then
    raise exception 'that circle was not found';
  end if;
  if p_version is distinct from v_current + 1 then
    raise exception 'key version moves forward one step';
  end if;

  v_expected := coalesce(jsonb_array_length(p_member_tokens), 0);
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_member_tokens, '[]'::jsonb)) as t(id uuid, token_hash text)
    where t.id is null or t.token_hash is null or char_length(t.token_hash) < 32
  ) or v_expected is distinct from (
    select count(*)::int from public.members where circle_id = p_circle and revoked_at is null
  ) then
    raise exception 'helper links could not be replaced';
  end if;

  -- Every saved summary's file key must come along, rewrapped by the new circle key in the browser.
  -- If one is missing, nothing changes: a file must never be left behind under a key that is gone.
  v_files := coalesce(jsonb_array_length(p_file_keys), 0);
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_file_keys, '[]'::jsonb)) as f(id uuid, wrapped text, iv text)
    where f.id is null
       or f.wrapped is null or f.wrapped !~ '^[A-Za-z0-9_-]{64}$'
       or f.iv is null or f.iv !~ '^[A-Za-z0-9_-]{16}$'
  ) or v_files is distinct from (
    select count(*)::int from public.visit_documents where circle_id = p_circle and file_key_wrapped is not null
  ) then
    raise exception 'file keys could not be rewrapped';
  end if;

  -- The flag lets this transaction move circles.key_version. A plain update cannot.
  perform set_config('aftervisit.rotate_circle_key', 'on', true);

  update public.circles
     set key_version = p_version
   where id = p_circle;

  update public.circle_caregivers
     set circle_key_wrapped = p_wrapped,
         key_version = p_version
   where circle_id = p_circle
     and user_id = auth.uid();

  update public.members m
     set token_hash = t.token_hash,
         pin_failures = 0,
         locked_until = null,
         lock_count = 0,
         expires_at = now() + interval '90 days'
    from jsonb_to_recordset(coalesce(p_member_tokens, '[]'::jsonb)) as t(id uuid, token_hash text)
   where m.id = t.id
     and m.circle_id = p_circle
     and m.revoked_at is null;
  get diagnostics v_updated = row_count;
  if v_updated is distinct from v_expected then
    raise exception 'helper links could not be replaced';
  end if;

  update public.visit_documents d
     set file_key_wrapped = f.wrapped,
         file_key_iv = f.iv,
         key_version = p_version
    from jsonb_to_recordset(coalesce(p_file_keys, '[]'::jsonb)) as f(id uuid, wrapped text, iv text)
   where d.id = f.id
     and d.circle_id = p_circle
     and d.file_key_wrapped is not null;
  get diagnostics v_updated = row_count;
  if v_updated is distinct from v_files then
    raise exception 'file keys could not be rewrapped';
  end if;

  insert into public.activity (circle_id, actor, action, subject_type, subject_id)
  values (p_circle, 'caregiver:' || auth.uid()::text, 'circle_key_rotated', 'circle', p_circle);

  insert into public.activity (circle_id, actor, action, subject_type, subject_id)
  select p_circle, 'caregiver:' || auth.uid()::text, 'member_link', 'member', t.id
  from jsonb_to_recordset(coalesce(p_member_tokens, '[]'::jsonb)) as t(id uuid, token_hash text);

  return p_version;
end;
$$;

-- The four-argument form stays for a circle with no encrypted summaries. With any, it raises.
create or replace function public.rotate_own_circle_key(
  p_circle uuid,
  p_wrapped text,
  p_version int,
  p_member_tokens jsonb
)
returns int
language sql
security invoker
set search_path = public
as $$
  select public.rotate_own_circle_key(p_circle, p_wrapped, p_version, p_member_tokens, '[]'::jsonb);
$$;
