-- To-dos: who is doing what for the person, and by when.
-- The caregiver adds them. A to-do belongs to the caregiver, to one person with a link,
-- or to nobody yet ("needs a volunteer"). Helpers claim and finish theirs through the
-- server after a permission check (lib/permissions.ts); the database also checks that
-- a to-do's person belongs to the same circle.
-- Runs after 0009. Safe to re-run.

create table if not exists public.todos (
  id                     uuid primary key default gen_random_uuid(),
  circle_id              uuid not null references public.circles (id) on delete cascade,
  title                  text not null check (char_length(title) between 1 and 200),
  note                   text check (char_length(note) <= 1000),
  due_date               date,
  assignee_member_id     uuid references public.members (id) on delete set null,
  assigned_to_caregiver  boolean not null default false,
  status                 text not null default 'open' check (status in ('open', 'done')),
  done_at                timestamptz,
  done_by                text check (char_length(done_by) <= 80),
  source                 text not null default 'caregiver' check (source in ('caregiver', 'handoff')),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint todos_one_assignee check (not (assigned_to_caregiver and assignee_member_id is not null)),
  constraint todos_done_fields check ((status = 'done') = (done_at is not null))
);

create index if not exists todos_circle_idx on public.todos (circle_id, status, due_date);
create index if not exists todos_assignee_idx on public.todos (assignee_member_id) where assignee_member_id is not null;

alter table public.todos enable row level security;

drop policy if exists todos_select on public.todos;
drop policy if exists todos_insert on public.todos;
drop policy if exists todos_update on public.todos;
drop policy if exists todos_delete on public.todos;
create policy todos_select on public.todos
  for select to authenticated using (public.is_circle_caregiver(circle_id));
create policy todos_insert on public.todos
  for insert to authenticated with check (public.is_circle_caregiver(circle_id));
create policy todos_update on public.todos
  for update to authenticated
  using (public.is_circle_caregiver(circle_id))
  with check (public.is_circle_caregiver(circle_id));
create policy todos_delete on public.todos
  for delete to authenticated using (public.is_circle_caregiver(circle_id));

revoke all on public.todos from anon;
grant select, insert, update, delete on public.todos to authenticated, service_role;

-- A to-do stays in its circle, and its person must be on that circle.
create or replace function public.todos_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.circle_id is distinct from old.circle_id then
      raise exception 'a to-do cannot move to another circle';
    end if;
    new.updated_at := now();
  end if;
  if new.assignee_member_id is not null and not exists (
    select 1 from public.members m where m.id = new.assignee_member_id and m.circle_id = new.circle_id
  ) then
    raise exception 'that person is not on this circle';
  end if;
  return new;
end;
$$;

revoke all on function public.todos_guard() from public, anon, authenticated;

drop trigger if exists todos_guard on public.todos;
create trigger todos_guard
  before insert or update on public.todos
  for each row execute function public.todos_guard();
