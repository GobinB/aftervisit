-- Who may write a circle key. Columns already exist (0004): circles.key_version,
-- circle_caregivers.circle_key_wrapped, circle_caregivers.key_version.
-- A caregiver may change only their own wrapped key, and that version must match the
-- circle. circles.key_version moves only inside rotate_own_circle_key, and only the
-- owner may call it. The raw key and the recovery phrase are never stored.
-- Safe to re-run.

create or replace function public.circle_caregivers_own_key()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin') then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if new.circle_key_wrapped is not null
     and (
       char_length(new.circle_key_wrapped) > 200
       or new.circle_key_wrapped !~ '^av1\.600000\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{64}$'
     ) then
    raise exception 'wrapped key is not valid';
  end if;

  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() and new.role is distinct from 'co_caregiver' then
      raise exception 'a new caregiver is a co-caregiver';
    end if;
    if new.circle_key_wrapped is not null and new.user_id is distinct from auth.uid() then
      raise exception 'a wrapped circle key can only be stored by that caregiver';
    end if;
    if new.circle_key_wrapped is not null
       and new.key_version is distinct from (select c.key_version from public.circles c where c.id = new.circle_id) then
      raise exception 'the wrapped key version must match the circle';
    end if;
    return new;
  end if;

  if new.user_id is distinct from old.user_id or new.circle_id is distinct from old.circle_id then
    raise exception 'a caregiver row cannot be reassigned';
  end if;

  if new.circle_key_wrapped is distinct from old.circle_key_wrapped
     or new.key_version is distinct from old.key_version then
    if auth.uid() is distinct from old.user_id then
      raise exception 'a wrapped circle key can only be changed by that caregiver';
    end if;
    if new.key_version is distinct from (select c.key_version from public.circles c where c.id = new.circle_id) then
      raise exception 'the wrapped key version must match the circle';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists circle_caregivers_own_key on public.circle_caregivers;
create trigger circle_caregivers_own_key
  before insert or update on public.circle_caregivers
  for each row execute function public.circle_caregivers_own_key();

create or replace function public.circles_protect_owner_and_key()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin') then
    return new;
  end if;
  if new.owner_id is distinct from old.owner_id and auth.uid() is distinct from old.owner_id then
    raise exception 'only the owner can change circle ownership';
  end if;
  if new.key_version is distinct from old.key_version then
    -- Set only by rotate_own_circle_key, for this transaction.
    if coalesce(current_setting('aftervisit.rotate_circle_key', true), '') is distinct from 'on' then
      raise exception 'key version changes only when the circle key is rotated';
    end if;
    if new.key_version is distinct from old.key_version + 1 then
      raise exception 'key version moves forward one step';
    end if;
    if not exists (
      select 1
      from public.circle_caregivers
      where circle_id = old.id
        and user_id = auth.uid()
        and role = 'owner'
    ) then
      raise exception 'only the owner can change the circle key';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists circles_protect_owner_and_key on public.circles;
create trigger circles_protect_owner_and_key
  before update on public.circles
  for each row execute function public.circles_protect_owner_and_key();

-- One transaction: the new circle version, the owner's wrapped key, and every active helper token.
-- p_member_tokens is [{"id": uuid, "token_hash": text}, ...] for each member with revoked_at null.
-- 90 days matches MEMBER_TTL_DAYS in lib/schema/circles.ts.
drop function if exists public.rotate_own_circle_key(uuid, text, int);
drop function if exists public.rotate_own_circle_key(uuid, text, int, jsonb);

create or replace function public.rotate_own_circle_key(
  p_circle uuid,
  p_wrapped text,
  p_version int,
  p_member_tokens jsonb
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

  insert into public.activity (circle_id, actor, action, subject_type, subject_id)
  values (p_circle, 'caregiver:' || auth.uid()::text, 'circle_key_rotated', 'circle', p_circle);

  insert into public.activity (circle_id, actor, action, subject_type, subject_id)
  select p_circle, 'caregiver:' || auth.uid()::text, 'member_link', 'member', t.id
  from jsonb_to_recordset(coalesce(p_member_tokens, '[]'::jsonb)) as t(id uuid, token_hash text);

  return p_version;
end;
$$;

-- 0004 lets only the owner update caregiver rows. A caregiver still has to store their own
-- wrapped key. This policy is that extra path. Any other column still raises.
create or replace function public.circle_caregivers_protect_owner()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_circle uuid;
  v_owner uuid;
begin
  if current_user in ('postgres', 'supabase_admin', 'supabase_auth_admin') then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  v_circle := case when tg_op = 'DELETE' then old.circle_id else new.circle_id end;
  select owner_id into v_owner from public.circles where id = v_circle;
  if auth.uid() is distinct from v_owner then
    if tg_op = 'UPDATE'
       and old.user_id = auth.uid()
       and new.user_id = auth.uid()
       and new.role is not distinct from old.role
       and new.circle_id is not distinct from old.circle_id
       and new.created_at is not distinct from old.created_at then
      return new;
    end if;
    raise exception 'only the owner can change caregivers';
  end if;
  if tg_op <> 'DELETE' and new.role = 'owner' and new.user_id is distinct from v_owner then
    raise exception 'the owner role cannot be granted this way';
  end if;
  if tg_op = 'UPDATE' and old.user_id = v_owner and (new.role is distinct from 'owner' or new.user_id is distinct from old.user_id) then
    raise exception 'the owner cannot be removed';
  end if;
  if tg_op = 'DELETE' and old.user_id = v_owner then
    raise exception 'the owner cannot be removed';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop policy if exists circle_caregivers_update_own_key on public.circle_caregivers;
create policy circle_caregivers_update_own_key
  on public.circle_caregivers
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on function public.circle_caregivers_own_key() from public, anon, authenticated, service_role;
revoke all on function public.circles_protect_owner_and_key() from public, anon, authenticated, service_role;
revoke all on function public.rotate_own_circle_key(uuid, text, int, jsonb) from public, anon, service_role;
grant execute on function public.rotate_own_circle_key(uuid, text, int, jsonb) to authenticated;
