-- Visit notes: what an after-visit summary says that is not a medicine, a reminder or an
-- appointment. The short summary, what to watch for, good to know, and questions for the next
-- visit are kept with the visit when the caregiver confirms it, so they can be shown on Today.
--
-- visits:
-- - One row per confirmed visit. The medical text lives in `content` (decision 0007); the plain
--   columns are only what the server needs to find and order it.
-- - Only the circle's caregiver can read or write it here. People with a link read through the
--   server after a permission check (lib/permissions.ts), as with medications.
-- - A row goes when its circle is erased.
--
-- visit_documents.visit_id: the kept photos (or PDF) of that visit, when the caregiver kept them.
-- Deleting the notes leaves the photos; the photos are deleted on their own page.
--
-- circle_updates takes a new area, 'visits', so the caregiver is asked to tell people about new
-- visit notes the same way as a change to medicines.
--
-- members.visibility: visit notes are a new thing a person with a link can see. Anyone the caregiver
-- already hid medicines or the care summary from has visit notes hidden too, so nobody sees more
-- than before without the caregiver choosing it.
-- Runs after 0020. 0001-0020 are not modified. Safe to re-run.

create table if not exists public.visits (
  id          uuid primary key default gen_random_uuid(),
  circle_id   uuid not null references public.circles (id) on delete cascade,
  visit_date  date,
  content     jsonb not null default '{}'::jsonb
              check (jsonb_typeof(content) = 'object' and octet_length(content::text) <= 60000),
  created_by  uuid not null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists visits_circle_idx on public.visits (circle_id, created_at desc);

alter table public.visits enable row level security;

drop policy if exists visits_select on public.visits;
drop policy if exists visits_insert on public.visits;
drop policy if exists visits_update on public.visits;
drop policy if exists visits_delete on public.visits;

create policy visits_select on public.visits
  for select to authenticated
  using (public.is_circle_caregiver(circle_id));
create policy visits_insert on public.visits
  for insert to authenticated
  with check (public.is_circle_caregiver(circle_id) and created_by = auth.uid());
create policy visits_update on public.visits
  for update to authenticated
  using (public.is_circle_caregiver(circle_id))
  with check (public.is_circle_caregiver(circle_id));
create policy visits_delete on public.visits
  for delete to authenticated
  using (public.is_circle_caregiver(circle_id));

revoke all on public.visits from anon;
grant select, insert, update, delete on public.visits to authenticated, service_role;

-- A visit stays in its circle and keeps who saved it.
create or replace function public.visits_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.circle_id is distinct from old.circle_id then
    raise exception 'a visit stays in its circle';
  end if;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.visits_guard() from public, anon, authenticated;

drop trigger if exists visits_guard on public.visits;
create trigger visits_guard
  before update on public.visits
  for each row execute function public.visits_guard();

-- The kept photos of a visit point at its notes. The visit must be in the same circle.
alter table public.visit_documents
  add column if not exists visit_id uuid references public.visits (id) on delete set null;

create index if not exists visit_documents_visit_idx on public.visit_documents (visit_id) where visit_id is not null;

create or replace function public.visit_documents_visit_in_circle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.visit_id is not null and not exists (
    select 1 from public.visits v where v.id = new.visit_id and v.circle_id = new.circle_id
  ) then
    raise exception 'that visit is not in this circle';
  end if;
  return new;
end;
$$;

revoke all on function public.visit_documents_visit_in_circle() from public, anon, authenticated;

drop trigger if exists visit_documents_visit_in_circle on public.visit_documents;
create trigger visit_documents_visit_in_circle
  before insert or update of visit_id, circle_id on public.visit_documents
  for each row execute function public.visit_documents_visit_in_circle();

-- New visit notes count as a change the people who help may want to hear about.
alter table public.circle_updates drop constraint if exists circle_updates_area_check;
alter table public.circle_updates add constraint circle_updates_area_check
  check (area in ('medications', 'calendar', 'tasks', 'summary', 'visits'));

drop trigger if exists circle_updates_visits on public.visits;
create trigger circle_updates_visits
  after insert or update or delete on public.visits
  for each row execute function public.circle_updates_touch('visits');

-- Nobody who was kept from medicines or the care summary starts seeing visit notes by default.
update public.members
   set visibility = jsonb_set(visibility, '{hidden}', (visibility -> 'hidden') || '["handoff"]'::jsonb)
 where jsonb_typeof(visibility -> 'hidden') = 'array'
   and (visibility -> 'hidden') ?| array['medications', 'summary']
   and not (visibility -> 'hidden') ? 'handoff';
