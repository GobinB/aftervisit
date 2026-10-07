-- AfterVisit P1: personal invitations, task status, activity log, demo feedback.
-- Additive only: existing handoffs keep working as shared-link handoffs (access_mode = 'link').

alter table public.handoffs
  add column if not exists access_mode text not null default 'link' check (access_mode in ('link', 'invite'));

-- One row per person a handoff is shared with. The invitation token is stored only as a hash.
create table if not exists public.handoff_recipients (
  id              uuid primary key default gen_random_uuid(),
  handoff_token   text not null references public.handoffs(token) on delete cascade,
  name            text not null,
  role            text not null,
  invite_hash     text not null unique,
  sections        jsonb not null default '[]',   -- which parts of the handoff this person can see
  tasks_scope     text not null default 'all' check (tasks_scope in ('all', 'mine')),
  created_at      timestamptz not null default now(),
  revoked_at      timestamptz,
  first_opened_at timestamptz,
  last_opened_at  timestamptz,
  acked_at        timestamptz
);
create index if not exists handoff_recipients_token_idx on public.handoff_recipients (handoff_token);
alter table public.handoff_recipients enable row level security;

-- Current status of each next step. Who reported it is always recorded.
create table if not exists public.handoff_task_status (
  handoff_token     text not null references public.handoffs(token) on delete cascade,
  task_id           text not null,
  assignee_id       uuid references public.handoff_recipients(id) on delete set null,
  status            text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  note              text,
  updated_at        timestamptz,
  updated_by_id     uuid references public.handoff_recipients(id) on delete set null,
  updated_by_name   text,          -- recipient name, or 'creator'
  updated_via       text check (updated_via in ('personal_link', 'creator')),
  completed_at      timestamptz,
  primary key (handoff_token, task_id)
);
alter table public.handoff_task_status enable row level security;

-- Append-only activity: opened, acknowledged, task updates, invitations, revocations.
create table if not exists public.handoff_events (
  id             bigint generated always as identity primary key,
  handoff_token  text not null references public.handoffs(token) on delete cascade,
  recipient_id   uuid references public.handoff_recipients(id) on delete set null,
  actor          text not null,      -- recipient name, 'creator', or 'shared link'
  via            text not null check (via in ('personal_link', 'creator', 'shared_link')),
  kind           text not null check (kind in ('invited', 'opened', 'acknowledged', 'task_status', 'revoked')),
  detail         jsonb not null default '{}',
  at             timestamptz not null default now()
);
create index if not exists handoff_events_token_idx on public.handoff_events (handoff_token, at desc);
alter table public.handoff_events enable row level security;

-- Anonymous product feedback from the demo and the manage page. No patient identifiers, no IP.
create table if not exists public.feedback (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  context     text not null check (context in ('demo', 'manage')),
  easier      text check (easier in ('yes', 'somewhat', 'no')),
  still_need  text,
  who_else    text
);
alter table public.feedback enable row level security;

-- Acknowledge through a personal link exactly once per recipient; returns true if newly acknowledged.
create or replace function public.ack_recipient(p_recipient uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_token text;
  v_name text;
begin
  update public.handoff_recipients
     set acked_at = now()
   where id = p_recipient and acked_at is null and revoked_at is null
  returning handoff_token, name into v_token, v_name;
  if v_token is null then
    return false;
  end if;
  insert into public.handoff_events (handoff_token, recipient_id, actor, via, kind)
  values (v_token, p_recipient, v_name, 'personal_link', 'acknowledged');
  return true;
end;
$$;

revoke all on function public.ack_recipient(uuid) from public, anon, authenticated;
grant execute on function public.ack_recipient(uuid) to service_role;
