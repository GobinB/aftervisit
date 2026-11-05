-- Medications: the circle's list of what the person takes, as the caregiver keeps it.
-- A record, not a dosing tool: no doses are checked off and no reminders are sent.
-- Every add, edit, stop and restart is written to medication_changes by a trigger,
-- with who did it and when, so the history cannot be skipped or edited.
-- Helpers read through the server after a permission check (lib/permissions.ts).
-- Runs after 0008. Safe to re-run.

create table if not exists public.medications (
  id            uuid primary key default gen_random_uuid(),
  circle_id     uuid not null references public.circles (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 120),
  dose          text check (char_length(dose) <= 80),
  amount        text check (char_length(amount) <= 80),
  form          text check (form in ('tablet', 'capsule', 'liquid', 'injection', 'inhaler', 'patch', 'cream', 'drops', 'other')),
  schedule      text not null default 'daily'
                check (schedule in ('as_needed', 'daily', 'every_x_days', 'weekdays', 'every_x_weeks', 'every_x_months')),
  every         int check (every between 1 and 365),
  weekdays      smallint[] check (weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  times         text[] not null default '{}'
                check (coalesce(array_length(times, 1), 0) <= 8 and array_to_string(times, ',') ~ '^([0-2][0-9]:[0-5][0-9](,|$))*$'),
  start_date    date,
  stop_date     date,
  status        text not null default 'active' check (status in ('active', 'stopped')),
  reason        text check (char_length(reason) <= 200),
  instructions  text check (char_length(instructions) <= 500),
  prescriber    text check (char_length(prescriber) <= 120),
  refills_left  int check (refills_left between 0 and 99),
  last_refill   date,
  source        text not null default 'caregiver' check (source in ('caregiver', 'handoff')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists medications_circle_id_idx on public.medications (circle_id, status);

create table if not exists public.medication_changes (
  id             uuid primary key default gen_random_uuid(),
  circle_id      uuid not null references public.circles (id) on delete cascade,
  medication_id  uuid not null references public.medications (id) on delete cascade,
  at             timestamptz not null default now(),
  actor          text not null,
  change         text not null check (change in ('added', 'edited', 'stopped', 'restarted')),
  summary        text not null check (char_length(summary) <= 600),
  source         text not null default 'caregiver' check (source in ('caregiver', 'handoff'))
);

create index if not exists medication_changes_circle_idx on public.medication_changes (circle_id, at desc);

alter table public.medications enable row level security;
alter table public.medication_changes enable row level security;

drop policy if exists medications_select on public.medications;
drop policy if exists medications_insert on public.medications;
drop policy if exists medications_update on public.medications;
drop policy if exists medications_delete on public.medications;
create policy medications_select on public.medications
  for select to authenticated using (public.is_circle_caregiver(circle_id));
create policy medications_insert on public.medications
  for insert to authenticated with check (public.is_circle_caregiver(circle_id));
create policy medications_update on public.medications
  for update to authenticated
  using (public.is_circle_caregiver(circle_id))
  with check (public.is_circle_caregiver(circle_id));
create policy medications_delete on public.medications
  for delete to authenticated using (public.is_circle_caregiver(circle_id));

drop policy if exists medication_changes_select on public.medication_changes;
create policy medication_changes_select on public.medication_changes
  for select to authenticated using (public.is_circle_caregiver(circle_id));
-- No insert, update or delete policy: only the trigger below writes history.

-- Supabase grants new tables to anon and authenticated by default. Take back what is not needed.
revoke all on public.medications, public.medication_changes from anon;
revoke insert, update, delete, truncate on public.medication_changes from authenticated;
grant select, insert, update, delete on public.medications to authenticated, service_role;
grant select on public.medication_changes to authenticated;
grant select, insert, update, delete on public.medication_changes to service_role;

-- A medication never moves to another circle.
create or replace function public.medications_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.circle_id is distinct from old.circle_id then
      raise exception 'a medication cannot move to another circle';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists medications_guard on public.medications;
create trigger medications_guard
  before insert or update on public.medications
  for each row execute function public.medications_guard();

create or replace function public.medications_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text := case when auth.uid() is null then 'system' else 'caregiver:' || auth.uid()::text end;
  v_change text;
  v_parts text[] := '{}';
begin
  if tg_op = 'INSERT' then
    v_change := 'added';
    v_parts := array[concat_ws(' ', new.name, new.dose)];
  elsif new.status is distinct from old.status then
    v_change := case when new.status = 'stopped' then 'stopped' else 'restarted' end;
    v_parts := array[concat_ws(' ', new.name, new.dose)];
  else
    v_change := 'edited';
    if new.name is distinct from old.name then
      v_parts := v_parts || ('Name: ' || coalesce(old.name, '') || ' → ' || coalesce(new.name, ''));
    end if;
    if new.dose is distinct from old.dose then
      v_parts := v_parts || ('Dose: ' || coalesce(old.dose, 'none') || ' → ' || coalesce(new.dose, 'none'));
    end if;
    if new.amount is distinct from old.amount then
      v_parts := v_parts || ('How much: ' || coalesce(old.amount, 'none') || ' → ' || coalesce(new.amount, 'none'));
    end if;
    if new.schedule is distinct from old.schedule or new.every is distinct from old.every
       or new.weekdays is distinct from old.weekdays or new.times is distinct from old.times then
      v_parts := v_parts || 'Schedule changed'::text;
    end if;
    if array_length(v_parts, 1) is null then
      v_parts := array['Details updated'];
    end if;
    v_parts := (concat_ws(' ', new.name, new.dose)) || v_parts;
  end if;

  insert into public.medication_changes (circle_id, medication_id, actor, change, summary, source)
  values (new.circle_id, new.id, v_actor, v_change, left(array_to_string(v_parts, '. '), 600), new.source);
  return new;
end;
$$;

revoke all on function public.medications_history() from public, anon, authenticated;

drop trigger if exists medications_history on public.medications;
create trigger medications_history
  after insert or update on public.medications
  for each row execute function public.medications_history();
