-- Circles, caregivers, members, consents, and activity.
-- Apply once, in order, after 0001-0003. Statements are safe to re-run so a fresh
-- database (local, CI, or a Supabase preview branch) can rebuild from this file.
-- Medical details live only in circles.content. 0001-0003 are not modified.
-- try_pin still serves handoff_recipients. A token that is not a handoff falls through to members.

create table if not exists public.circles (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  key_version  int not null default 1,
  content      jsonb not null,
  constraint circles_content_person_name check (
    jsonb_typeof(content -> 'person_name') = 'string'
    and length(content ->> 'person_name') between 1 and 120
  )
);

create table if not exists public.circle_caregivers (
  circle_id          uuid not null references public.circles (id) on delete cascade,
  user_id            uuid not null references auth.users (id),
  role               text not null check (role in ('owner', 'co_caregiver')),
  circle_key_wrapped text,
  key_version        int not null default 1,
  created_at         timestamptz not null default now(),
  primary key (circle_id, user_id)
);

create table if not exists public.members (
  id            uuid primary key default gen_random_uuid(),
  circle_id     uuid not null references public.circles (id) on delete cascade,
  user_id       uuid references auth.users (id),
  name          text not null,
  role          text not null check (role in ('family', 'care_manager', 'home_aide', 'day_program')),
  email         text,
  token_hash    text not null unique,
  pin_hash      text,
  pin_failures  int not null default 0,
  locked_until  timestamptz,
  lock_count    int not null default 0,
  visibility    jsonb not null default '{}',
  expires_at    timestamptz not null,
  revoked_at    timestamptz,
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists public.consents (
  id         uuid primary key default gen_random_uuid(),
  circle_id  uuid not null references public.circles (id) on delete cascade,
  user_id    uuid not null references auth.users (id),
  type       text not null check (type in ('authorized_to_share', 'terms', 'privacy')),
  version    text not null,
  text_hash  text not null,
  agreed_at  timestamptz not null default now()
);

create table if not exists public.activity (
  id           uuid primary key default gen_random_uuid(),
  circle_id    uuid not null references public.circles (id) on delete cascade,
  actor        text not null,
  action       text not null,
  subject_type text,
  subject_id   uuid,
  at           timestamptz not null default now()
);

create index if not exists circle_caregivers_circle_id_idx on public.circle_caregivers (circle_id);
create index if not exists members_circle_id_idx on public.members (circle_id);
create index if not exists consents_circle_id_idx on public.consents (circle_id);
create index if not exists activity_circle_id_idx on public.activity (circle_id, at desc);

alter table public.circles enable row level security;
alter table public.circle_caregivers enable row level security;
alter table public.members enable row level security;
alter table public.consents enable row level security;
alter table public.activity enable row level security;

-- Membership, not owner_id alone. security definer so the policy can read the
-- caregiver table without recursing through its own row security.
create or replace function public.is_circle_caregiver(p_circle uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.circle_caregivers
    where circle_id = p_circle
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_circle_owner(p_circle uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.circles
    where id = p_circle
      and owner_id = auth.uid()
      and deleted_at is null
  );
$$;

revoke all on function public.is_circle_caregiver(uuid) from public, anon;
revoke all on function public.is_circle_owner(uuid) from public, anon;
grant execute on function public.is_circle_caregiver(uuid) to authenticated, service_role;
grant execute on function public.is_circle_owner(uuid) to authenticated, service_role;

-- Invoker, not definer: current_user must stay the caller. A security definer
-- function would see current_user as the owner and skip this check.
create or replace function public.circles_owner_only_delete()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin') then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op = 'DELETE'
     or (tg_op = 'UPDATE' and new.deleted_at is distinct from old.deleted_at and new.deleted_at is not null) then
    if auth.uid() is distinct from old.owner_id then
      raise exception 'only the owner can delete a circle';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists circles_owner_only_delete on public.circles;
create trigger circles_owner_only_delete
  before update or delete on public.circles
  for each row execute function public.circles_owner_only_delete();

create or replace function public.circle_caregivers_protect_owner()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin') then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  select owner_id into v_owner from public.circles where id = old.circle_id;
  if old.user_id = v_owner and auth.uid() is distinct from v_owner then
    raise exception 'the owner cannot be removed';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists circle_caregivers_protect_owner on public.circle_caregivers;
create trigger circle_caregivers_protect_owner
  before update or delete on public.circle_caregivers
  for each row execute function public.circle_caregivers_protect_owner();

drop policy if exists circles_select on public.circles;
drop policy if exists circles_insert on public.circles;
drop policy if exists circles_update on public.circles;
drop policy if exists circles_delete on public.circles;
create policy circles_select on public.circles
  for select to authenticated
  using (deleted_at is null and public.is_circle_caregiver(id));
create policy circles_insert on public.circles
  for insert to authenticated
  with check (owner_id = auth.uid());
create policy circles_update on public.circles
  for update to authenticated
  using (public.is_circle_caregiver(id))
  with check (public.is_circle_caregiver(id));
create policy circles_delete on public.circles
  for delete to authenticated
  using (public.is_circle_caregiver(id));

drop policy if exists circle_caregivers_select on public.circle_caregivers;
drop policy if exists circle_caregivers_insert on public.circle_caregivers;
drop policy if exists circle_caregivers_update on public.circle_caregivers;
drop policy if exists circle_caregivers_delete on public.circle_caregivers;
create policy circle_caregivers_select on public.circle_caregivers
  for select to authenticated
  using (public.is_circle_caregiver(circle_id));
create policy circle_caregivers_insert on public.circle_caregivers
  for insert to authenticated
  with check (
    public.is_circle_caregiver(circle_id)
    or (user_id = auth.uid() and public.is_circle_owner(circle_id))
  );
create policy circle_caregivers_update on public.circle_caregivers
  for update to authenticated
  using (public.is_circle_caregiver(circle_id))
  with check (public.is_circle_caregiver(circle_id));
create policy circle_caregivers_delete on public.circle_caregivers
  for delete to authenticated
  using (public.is_circle_caregiver(circle_id));

drop policy if exists members_select on public.members;
drop policy if exists members_insert on public.members;
drop policy if exists members_update on public.members;
drop policy if exists members_delete on public.members;
create policy members_select on public.members
  for select to authenticated using (public.is_circle_caregiver(circle_id));
create policy members_insert on public.members
  for insert to authenticated with check (public.is_circle_caregiver(circle_id));
create policy members_update on public.members
  for update to authenticated
  using (public.is_circle_caregiver(circle_id))
  with check (public.is_circle_caregiver(circle_id));
create policy members_delete on public.members
  for delete to authenticated using (public.is_circle_caregiver(circle_id));

drop policy if exists consents_select on public.consents;
drop policy if exists consents_insert on public.consents;
drop policy if exists consents_update on public.consents;
drop policy if exists consents_delete on public.consents;
create policy consents_select on public.consents
  for select to authenticated using (public.is_circle_caregiver(circle_id));
create policy consents_insert on public.consents
  for insert to authenticated
  with check (public.is_circle_caregiver(circle_id) and user_id = auth.uid());
create policy consents_update on public.consents
  for update to authenticated
  using (public.is_circle_caregiver(circle_id))
  with check (public.is_circle_caregiver(circle_id));
create policy consents_delete on public.consents
  for delete to authenticated using (public.is_circle_caregiver(circle_id));

drop policy if exists activity_select on public.activity;
drop policy if exists activity_insert on public.activity;
drop policy if exists activity_update on public.activity;
drop policy if exists activity_delete on public.activity;
create policy activity_select on public.activity
  for select to authenticated using (public.is_circle_caregiver(circle_id));
create policy activity_insert on public.activity
  for insert to authenticated with check (public.is_circle_caregiver(circle_id));
create policy activity_update on public.activity
  for update to authenticated
  using (public.is_circle_caregiver(circle_id))
  with check (public.is_circle_caregiver(circle_id));
create policy activity_delete on public.activity
  for delete to authenticated using (public.is_circle_caregiver(circle_id));

grant select, insert, update, delete on public.circles to authenticated, service_role;
grant select, insert, update, delete on public.circle_caregivers to authenticated, service_role;
grant select, insert, update, delete on public.members to authenticated, service_role;
grant select, insert, update, delete on public.consents to authenticated, service_role;
grant select, insert, update, delete on public.activity to authenticated, service_role;

-- Same signature as 0003. Handoff tokens keep the existing path. Any other token
-- with a member id checks public.members (its own pin_failures, locked_until, lock_count).
create or replace function public.try_pin(
  p_token text,
  p_recipient uuid,
  p_candidate text,
  p_max int,
  p_lock_minutes int,
  p_hard_after int
)
returns table (result text, locked_until timestamptz, attempts_left int)
language plpgsql
security invoker
set search_path = public
as $$
#variable_conflict use_column
declare
  v_pin_hash text;
  v_failures int;
  v_locks    int;
  v_until    timestamptz;
  v_name     text;
  v_circle   uuid;
begin
  select h.pin_hash into v_pin_hash from public.handoffs h where h.token = p_token;
  if not found then
    if p_recipient is null then
      return query select 'not_found'::text, null::timestamptz, null::int;
      return;
    end if;

    select m.pin_hash, m.pin_failures, m.lock_count, m.locked_until, m.name, m.circle_id
      into v_pin_hash, v_failures, v_locks, v_until, v_name, v_circle
      from public.members m
     where m.id = p_recipient
       for update;
    if not found then
      return query select 'not_found'::text, null::timestamptz, null::int;
      return;
    end if;
    if v_pin_hash is null then
      return query select 'ok'::text, null::timestamptz, null::int;
      return;
    end if;
    if v_until is not null and v_until > now() then
      return query select 'locked'::text, v_until, 0;
      return;
    end if;
    if p_candidate is not null and p_candidate = v_pin_hash then
      if v_failures > 0 or v_until is not null then
        update public.members set pin_failures = 0, locked_until = null where id = p_recipient;
      end if;
      return query select 'ok'::text, null::timestamptz, null::int;
      return;
    end if;
    v_failures := v_failures + 1;
    if v_failures < p_max then
      update public.members set pin_failures = v_failures where id = p_recipient;
      return query select 'wrong_pin'::text, null::timestamptz, p_max - v_failures;
      return;
    end if;
    v_locks := v_locks + 1;
    if v_locks >= p_hard_after then
      v_until := 'infinity';
      insert into public.activity (circle_id, actor, action, subject_type, subject_id)
      values (v_circle, 'member', 'pin_locked', 'member', p_recipient);
    else
      v_until := now() + least(p_lock_minutes * power(2, v_locks - 1), 1440) * interval '1 minute';
    end if;
    update public.members
       set pin_failures = 0, lock_count = v_locks, locked_until = v_until
     where id = p_recipient;
    return query select 'locked'::text, v_until, 0;
    return;
  end if;

  if v_pin_hash is null then
    return query select 'ok'::text, null::timestamptz, null::int;
    return;
  end if;

  -- Concurrent attempts on the same link wait here and run one at a time.
  if p_recipient is not null then
    select r.pin_failures, r.pin_lock_count, r.locked_until, r.name
      into v_failures, v_locks, v_until, v_name
      from public.handoff_recipients r
     where r.id = p_recipient and r.handoff_token = p_token
       for update;
  else
    select h.pin_failures, h.pin_lock_count, h.locked_until
      into v_failures, v_locks, v_until
      from public.handoffs h
     where h.token = p_token
       for update;
  end if;
  if not found then
    return query select 'not_found'::text, null::timestamptz, null::int;
    return;
  end if;

  if v_until is not null and v_until > now() then
    return query select 'locked'::text, v_until, 0;
    return;
  end if;

  if p_candidate is not null and p_candidate = v_pin_hash then
    if v_failures > 0 or v_until is not null then
      if p_recipient is not null then
        update public.handoff_recipients set pin_failures = 0, locked_until = null where id = p_recipient;
      else
        update public.handoffs set pin_failures = 0, locked_until = null where token = p_token;
      end if;
    end if;
    return query select 'ok'::text, null::timestamptz, null::int;
    return;
  end if;

  v_failures := v_failures + 1;
  if v_failures < p_max then
    if p_recipient is not null then
      update public.handoff_recipients set pin_failures = v_failures where id = p_recipient;
    else
      update public.handoffs set pin_failures = v_failures where token = p_token;
    end if;
    return query select 'wrong_pin'::text, null::timestamptz, p_max - v_failures;
    return;
  end if;

  v_locks := v_locks + 1;
  if p_recipient is not null and v_locks >= p_hard_after then
    v_until := 'infinity';
    insert into public.handoff_events (handoff_token, recipient_id, actor, via, kind, detail)
    values (p_token, p_recipient, v_name, 'personal_link', 'pin_locked', jsonb_build_object('name', v_name));
  else
    v_until := now() + least(p_lock_minutes * power(2, v_locks - 1), 1440) * interval '1 minute';
  end if;

  if p_recipient is not null then
    update public.handoff_recipients
       set pin_failures = 0, pin_lock_count = v_locks, locked_until = v_until
     where id = p_recipient;
  else
    update public.handoffs
       set pin_failures = 0, pin_lock_count = v_locks, locked_until = v_until
     where token = p_token;
  end if;
  return query select 'locked'::text, v_until, 0;
end;
$$;

revoke all on function public.try_pin(text, uuid, text, int, int, int) from public, anon, authenticated;
grant execute on function public.try_pin(text, uuid, text, int, int, int) to service_role;
