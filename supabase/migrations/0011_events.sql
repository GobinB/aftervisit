-- Calendar: appointments and other dates for the person, in the circle's own wall-clock time.
-- An event is on a date, all day or from a start time; it can repeat until a date.
-- Someone can be going (the caregiver or one person with a link), or it can ask for a volunteer.
-- The caregiver and family edit through the server after a permission check (lib/permissions.ts);
-- the database also keeps an event in its circle and its person on that circle.
-- Runs after 0010. Safe to re-run.

create table if not exists public.events (
  id               uuid primary key default gen_random_uuid(),
  circle_id        uuid not null references public.circles (id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 200),
  event_date       date not null,
  start_time       text check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time         text check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  location         text check (char_length(location) <= 300),
  notes            text check (char_length(notes) <= 1000),
  repeat           text not null default 'none'
                   check (repeat in ('none', 'daily', 'weekly', 'every_2_weeks', 'monthly', 'yearly')),
  repeat_until     date,
  going_member_id  uuid references public.members (id) on delete set null,
  going_caregiver  boolean not null default false,
  needs_volunteer  boolean not null default false,
  created_by       text check (char_length(created_by) <= 80),
  updated_by       text check (char_length(updated_by) <= 80),
  source           text not null default 'caregiver' check (source in ('caregiver', 'handoff')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint events_one_going check (not (going_caregiver and going_member_id is not null)),
  constraint events_end_after_start check (end_time is null or (start_time is not null and end_time > start_time)),
  constraint events_repeat_until check (repeat_until is null or (repeat <> 'none' and repeat_until >= event_date))
);

create index if not exists events_circle_date_idx on public.events (circle_id, event_date);

alter table public.events enable row level security;

drop policy if exists events_select on public.events;
drop policy if exists events_insert on public.events;
drop policy if exists events_update on public.events;
drop policy if exists events_delete on public.events;
create policy events_select on public.events
  for select to authenticated using (public.is_circle_caregiver(circle_id));
create policy events_insert on public.events
  for insert to authenticated with check (public.is_circle_caregiver(circle_id));
create policy events_update on public.events
  for update to authenticated
  using (public.is_circle_caregiver(circle_id))
  with check (public.is_circle_caregiver(circle_id));
create policy events_delete on public.events
  for delete to authenticated using (public.is_circle_caregiver(circle_id));

revoke all on public.events from anon;
grant select, insert, update, delete on public.events to authenticated, service_role;

create or replace function public.events_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.circle_id is distinct from old.circle_id then
      raise exception 'an event cannot move to another circle';
    end if;
    new.updated_at := now();
  end if;
  if new.going_member_id is not null and not exists (
    select 1 from public.members m where m.id = new.going_member_id and m.circle_id = new.circle_id
  ) then
    raise exception 'that person is not on this circle';
  end if;
  return new;
end;
$$;

revoke all on function public.events_guard() from public, anon, authenticated;

drop trigger if exists events_guard on public.events;
create trigger events_guard
  before insert or update on public.events
  for each row execute function public.events_guard();
