-- AfterVisit: PIN lockout per personal link, decided in one locked step.
-- Before: one counter per handoff (one person's wrong guesses locked everyone out), read and
-- written in two steps (parallel guesses got past the limit), reset after every 10-minute lock.
-- Now: each personal link has its own counter; each attempt holds a row lock, so parallel
-- guesses are counted one at a time; locks double (10, 20 minutes ...); the third lock on a
-- personal link lasts until the creator unlocks it. Shared-link handoffs double up to 24 hours.

alter table public.handoffs
  add column if not exists pin_lock_count int not null default 0;

alter table public.handoff_recipients
  add column if not exists pin_failures   int not null default 0,
  add column if not exists locked_until   timestamptz,           -- 'infinity' until the creator unlocks it
  add column if not exists pin_lock_count int not null default 0;

alter table public.handoff_events drop constraint if exists handoff_events_kind_check;
alter table public.handoff_events add constraint handoff_events_kind_check
  check (kind in ('invited', 'opened', 'acknowledged', 'task_status', 'revoked', 'pin_locked', 'pin_unlocked'));

-- Checks one PIN attempt against the handoff's PIN. p_recipient: the personal link, or null for a
-- shared-link handoff. p_candidate: hash of the entered PIN, or null when it was malformed.
-- result: 'ok' | 'wrong_pin' | 'locked' | 'not_found'.
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
begin
  select h.pin_hash into v_pin_hash from public.handoffs h where h.token = p_token;
  if not found then
    return query select 'not_found'::text, null::timestamptz, null::int;
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

  -- A correct PIN clears the count and any expired lock. The lock count stays, so repeated
  -- lockouts keep doubling until the creator unlocks the link.
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
