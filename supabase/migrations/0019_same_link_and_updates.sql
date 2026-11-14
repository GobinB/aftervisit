-- One link per person that keeps working, with limits, and a record of what changed so the
-- caregiver is asked to tell the people who help (docs/decisions/0003-helper-links.md).
--
-- members:
-- - link_version: the link is worked out on the server from the person's id and this number, so
--   the caregiver can share the same link again from any device. "New link" moves it up by one.
-- - link_issued_at: when the current link was made. A link always ends 90 days after that.
-- - last_told_at: when the caregiver last sent this person their link about a change.
-- - expires_at keeps its meaning (the link stops working then). The app sets it to 30 days after
--   the link was last opened, and never later than 90 days after it was made; the database
--   refuses anything later.
--
-- circle_updates: for each circle and area (medications, calendar, reminders, care summary), when
-- the caregiver last changed something there. A trigger on each table writes it, so every way of
-- changing things counts, including a visit summary. Changes made from a person's link do not.
-- Only the circle's caregiver can read it; nobody writes it directly.
-- Runs after 0018. 0001-0018 are not modified. Safe to re-run.

alter table public.members
  add column if not exists link_version int not null default 1,
  add column if not exists link_issued_at timestamptz not null default now(),
  add column if not exists last_told_at timestamptz;

alter table public.members drop constraint if exists members_link_version_check;
alter table public.members add constraint members_link_version_check check (link_version between 1 and 100000);

update public.members set expires_at = link_issued_at + interval '90 days' where expires_at > link_issued_at + interval '90 days';
alter table public.members drop constraint if exists members_link_max_age;
alter table public.members add constraint members_link_max_age check (expires_at <= link_issued_at + interval '90 days');

create table if not exists public.circle_updates (
  circle_id  uuid not null references public.circles (id) on delete cascade,
  area       text not null check (area in ('medications', 'calendar', 'tasks', 'summary')),
  changed_at timestamptz not null default now(),
  primary key (circle_id, area)
);

alter table public.circle_updates enable row level security;
drop policy if exists circle_updates_select on public.circle_updates;
create policy circle_updates_select on public.circle_updates
  for select to authenticated using (public.is_circle_caregiver(circle_id));
revoke all on public.circle_updates from anon, authenticated;
grant select on public.circle_updates to authenticated, service_role;

-- tg_argv[0] is the area. Counts only a change made in the caregiver's own session, on a circle
-- that still exists (a circle being erased takes its rows with it and records nothing).
create or replace function public.circle_updates_touch()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_circle uuid;
begin
  if tg_table_name = 'circles' then
    v_circle := new.id;
  elsif tg_op = 'DELETE' then
    v_circle := old.circle_id;
  else
    v_circle := new.circle_id;
  end if;

  if auth.uid() is null
     or not exists (select 1 from public.circles c where c.id = v_circle and c.deleted_at is null)
     or not exists (select 1 from public.circle_caregivers g where g.circle_id = v_circle and g.user_id = auth.uid()) then
    return null;
  end if;

  insert into public.circle_updates (circle_id, area, changed_at)
  values (v_circle, tg_argv[0], pg_catalog.now())
  on conflict (circle_id, area) do update set changed_at = excluded.changed_at;
  return null;
end;
$$;

revoke all on function public.circle_updates_touch() from public, anon, authenticated, service_role;

drop trigger if exists circle_updates_medications on public.medications;
create trigger circle_updates_medications
  after insert or update or delete on public.medications
  for each row execute function public.circle_updates_touch('medications');

drop trigger if exists circle_updates_events on public.events;
create trigger circle_updates_events
  after insert or update or delete on public.events
  for each row execute function public.circle_updates_touch('calendar');

drop trigger if exists circle_updates_todos on public.todos;
create trigger circle_updates_todos
  after insert or update or delete on public.todos
  for each row execute function public.circle_updates_touch('tasks');

drop trigger if exists circle_updates_summary on public.circles;
create trigger circle_updates_summary
  after update of content on public.circles
  for each row when (old.content is distinct from new.content)
  execute function public.circle_updates_touch('summary');
