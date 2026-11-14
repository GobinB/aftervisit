-- The key for files is now only ever held by All Hands Care (0017, docs/decisions/0015-file-encryption.md).
-- This removes what was kept for the earlier way, where the browser wrapped the key with 12 recovery words:
-- - a stored key must be the held form (av2). Any key left in the old form is cleared, so the circle is
--   given a new key the next time it is needed;
-- - rotate_own_circle_key (both forms), reset_own_circle_key and create_circle(jsonb, jsonb, text), which
--   the app no longer calls. create_circle(jsonb, jsonb) stays.
-- Runs after 0017. 0001-0017 are not modified. Safe to re-run.

update public.circle_caregivers
   set circle_key_wrapped = null
 where circle_key_wrapped is not null
   and circle_key_wrapped !~ '^av2\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{64}$';

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
     and new.circle_key_wrapped !~ '^av2\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{64}$' then
    raise exception 'wrapped key is not valid';
  end if;

  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid() then
      raise exception 'a caregiver can only add themselves';
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

drop function if exists public.reset_own_circle_key(uuid, text, int);
drop function if exists public.rotate_own_circle_key(uuid, text, int, jsonb, jsonb);
drop function if exists public.rotate_own_circle_key(uuid, text, int, jsonb);
drop function if exists public.create_circle(jsonb, jsonb, text);
