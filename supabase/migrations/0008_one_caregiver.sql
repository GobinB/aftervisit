-- One sign-in per circle (decided November 3, 2026). The owner is the only caregiver
-- who signs in; everyone else, family included, opens their own personal link.
-- Runs after 0007. 0004-0007 are not modified. Safe to re-run.
--
-- The app never offered a way to add a co-caregiver, so no such rows are expected.
-- Any that exist are removed, so the new rules below can hold.

delete from public.circle_caregivers where role <> 'owner';

alter table public.circle_caregivers drop constraint if exists circle_caregivers_role_check;
alter table public.circle_caregivers add constraint circle_caregivers_role_check check (role = 'owner');

-- At most one caregiver row per circle.
create unique index if not exists circle_caregivers_one_per_circle on public.circle_caregivers (circle_id);

-- The only row anyone can add is their own owner row, for a circle they own.
drop policy if exists circle_caregivers_insert on public.circle_caregivers;
create policy circle_caregivers_insert on public.circle_caregivers
  for insert to authenticated
  with check (
    public.is_circle_owner(circle_id)
    and role = 'owner'
    and user_id = auth.uid()
  );

-- Same guard as 0006, except a signed-in caregiver can no longer add anyone else.
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
