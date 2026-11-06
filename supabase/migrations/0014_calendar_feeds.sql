-- A private calendar link for each circle, so its appointments and due reminders show up in
-- Google Calendar, Apple Calendar or Outlook. One link per circle, made, replaced or turned off by
-- the circle's caregiver. The calendar app fetches /api/calendar/{token}.ics; the server looks the
-- token up with the service role, so nobody else ever reads this table.
-- The token is kept as it is (not hashed) so the caregiver can copy the link again later; it opens
-- only the calendar, and a new link or Turn off ends it at once.
-- Runs after 0013. Safe to re-run.

create table if not exists public.calendar_feeds (
  circle_id   uuid primary key references public.circles (id) on delete cascade,
  token       text not null unique check (token ~ '^[A-Za-z0-9_-]{32,64}$'),
  created_by  uuid not null default auth.uid(),
  created_at  timestamptz not null default now()
);

alter table public.calendar_feeds enable row level security;

drop policy if exists calendar_feeds_select on public.calendar_feeds;
drop policy if exists calendar_feeds_insert on public.calendar_feeds;
drop policy if exists calendar_feeds_update on public.calendar_feeds;
drop policy if exists calendar_feeds_delete on public.calendar_feeds;

create policy calendar_feeds_select on public.calendar_feeds
  for select to authenticated
  using (public.is_circle_caregiver(circle_id));
create policy calendar_feeds_insert on public.calendar_feeds
  for insert to authenticated
  with check (public.is_circle_caregiver(circle_id) and created_by = auth.uid());
create policy calendar_feeds_update on public.calendar_feeds
  for update to authenticated
  using (public.is_circle_caregiver(circle_id))
  with check (public.is_circle_caregiver(circle_id) and created_by = auth.uid());
create policy calendar_feeds_delete on public.calendar_feeds
  for delete to authenticated
  using (public.is_circle_caregiver(circle_id));

revoke all on public.calendar_feeds from anon;
grant select, insert, update, delete on public.calendar_feeds to authenticated, service_role;
