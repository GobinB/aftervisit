-- Optional sign-in for people in a circle. A person can save their own link to their Google
-- account (members.user_id, which has been in the table since 0004). After that the link opens
-- only for that account, and every circle they are in is listed in one place.
--
-- - One account per person, and one person per account in each circle: a partial unique index.
-- - Tying a row to an account happens only through the server, after it has checked the person's
--   link (and PIN, if any) and their Google sign-in. A signed-in caregiver can clear the tie
--   (the "Undo" on the People page) but cannot set it, so nobody can tie someone else's link to an
--   account. A tied row cannot move to another account without being cleared first.
-- - A circle's own caregiver cannot also hold a person's row in that circle, so the one-caregiver
--   rule (0008) stays as it is.
-- - Deleting a Google account from sign-in clears the tie instead of being refused.
-- - Row security on members is unchanged: only the caregiver reads or changes rows directly.
--   People keep reading through the server after a permission check (lib/permissions.ts).
--
-- Runs after 0024. 0001-0024 are not modified. Only adds rules. Safe to re-run.

create unique index if not exists members_one_per_account
  on public.members (circle_id, user_id)
  where user_id is not null;

create index if not exists members_user_id_idx
  on public.members (user_id)
  where user_id is not null;

alter table public.members drop constraint if exists members_user_id_fkey;
alter table public.members
  add constraint members_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null;

-- Invoker, not definer: current_user must stay the caller, as in the other guards.
create or replace function public.members_account_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.user_id is not distinct from old.user_id
     and new.circle_id is not distinct from old.circle_id then
    return new;
  end if;
  -- Clearing the tie is always allowed here; row security decides who may update the row.
  if new.user_id is null then
    return new;
  end if;
  if current_user in ('authenticated', 'anon') then
    raise exception 'only the person can save their own link to their account';
  end if;
  if tg_op = 'UPDATE' and old.user_id is not null and new.user_id is distinct from old.user_id then
    raise exception 'this link is already saved to another account';
  end if;
  if exists (select 1 from public.circles c where c.id = new.circle_id and c.owner_id = new.user_id)
     or exists (select 1 from public.circle_caregivers cc where cc.circle_id = new.circle_id and cc.user_id = new.user_id) then
    raise exception 'the caregiver who runs a circle cannot also be a person in it';
  end if;
  return new;
end;
$$;

revoke all on function public.members_account_guard() from public, anon, authenticated;

drop trigger if exists members_account_guard on public.members;
create trigger members_account_guard
  before insert or update on public.members
  for each row execute function public.members_account_guard();

comment on function public.members_account_guard() is
  'A person''s link is tied to an account only by the server, never moves straight to another account, and never to the circle''s caregiver.';
