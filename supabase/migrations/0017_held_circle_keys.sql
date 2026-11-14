-- All Hands Care now keeps each circle's key for files, so a caregiver is handed it after signing
-- in and never needs recovery words (docs/decisions/0015-file-encryption.md).
--
-- The key is stored where it always was, circle_caregivers.circle_key_wrapped, in a new form:
--   av2.<iv>.<wrapped key>
-- It is wrapped on the app's server with a key derived from a secret that is not in this database,
-- so a copy of the database alone opens nothing. Row security is unchanged: only the circle's own
-- caregiver can read or write that row, and people with a link have no access to it at all.
--
-- The earlier form (av1, wrapped in the browser by 12 recovery words) is still accepted, so a
-- circle that has one keeps it until a device or the words hand the key over.
--
-- reset_own_circle_key is "Start fresh": for a circle whose key was made with words that are lost.
-- It removes the saved summaries nobody can open, moves the key version forward and stores a new
-- key, in one transaction. Summaries saved before files were encrypted are plain and are kept.
-- Medications, reminders and the calendar are not touched.
-- Runs after 0016. 0001-0016 are not modified. Safe to re-run.

-- Same guard as 0008, with the new form allowed.
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
       or (
         new.circle_key_wrapped !~ '^av2\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{64}$'
         and new.circle_key_wrapped !~ '^av1\.600000\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{64}$'
       )
     ) then
    raise exception 'wrapped key is not valid';
  end if;

  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() then
      raise exception 'a caregiver can only add themselves';
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

revoke all on function public.circle_caregivers_own_key() from public, anon, authenticated, service_role;

-- The table that holds stored keys is for signed-in caregivers only. Row security already showed a
-- signed-out request no rows; this takes away its permission to ask at all.
revoke all on public.circle_caregivers from anon;

-- Returns the storage paths of the summaries it removed, so the app can check none is left behind.
create or replace function public.reset_own_circle_key(p_circle uuid, p_wrapped text, p_version int)
returns text[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role text;
  v_stored text;
  v_stored_version int;
  v_current int;
  v_removed int;
  v_paths text[];
begin
  if p_wrapped is null or p_wrapped !~ '^av2\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{64}$' then
    raise exception 'stored key is not valid';
  end if;

  select cc.role, cc.circle_key_wrapped, cc.key_version
    into v_role, v_stored, v_stored_version
    from public.circle_caregivers cc
   where cc.circle_id = p_circle and cc.user_id = auth.uid();
  if v_role is distinct from 'owner' then
    raise exception 'only the owner can change the circle key';
  end if;

  select c.key_version into v_current
    from public.circles c
   where c.id = p_circle and c.deleted_at is null
     for update;
  if v_current is null then
    raise exception 'that circle was not found';
  end if;
  if p_version is distinct from v_current + 1 then
    raise exception 'key version moves forward one step';
  end if;

  -- A key that is held opens every saved summary. Nothing is removed for a circle that has one.
  if v_stored is not null and v_stored ~ '^av2\.' and v_stored_version is not distinct from v_current then
    raise exception 'the key for this circle is held';
  end if;

  with gone as (
    delete from public.visit_documents d
     where d.circle_id = p_circle
       and d.file_key_wrapped is not null
    returning d.id, d.paths
  )
  select count(distinct g.id)::int,
         coalesce(array_agg(u.path) filter (where u.path is not null), '{}'::text[])
    into v_removed, v_paths
    from gone g
    left join lateral unnest(g.paths) as u(path) on true;

  -- The flag lets this transaction move circles.key_version (0006). A plain update cannot.
  perform set_config('aftervisit.rotate_circle_key', 'on', true);
  update public.circles
     set key_version = p_version
   where id = p_circle;
  perform set_config('aftervisit.rotate_circle_key', 'off', true);

  update public.circle_caregivers
     set circle_key_wrapped = p_wrapped,
         key_version = p_version
   where circle_id = p_circle
     and user_id = auth.uid();

  if v_removed > 0 then
    insert into public.activity (circle_id, actor, action, subject_type, subject_id)
    values (p_circle, 'caregiver:' || auth.uid()::text, 'circle_key_reset', 'circle', p_circle);
  end if;

  return v_paths;
end;
$$;

-- Starting fresh is the signed-in caregiver's own act. The server role and signed-out requests cannot run it.
revoke all on function public.reset_own_circle_key(uuid, text, int) from public, anon, service_role;
grant execute on function public.reset_own_circle_key(uuid, text, int) to authenticated;
