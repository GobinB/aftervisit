-- Saved after-visit summaries: the photos (or PDF) of a visit, kept when the caregiver chooses to.
-- Only the circle's caregiver can see, add or delete them; people with a link cannot.
-- The files live in the private storage bucket "visit-documents" at {circle_id}/{document_id}/...
-- and are only ever served by the app's server after it checks this table as the caregiver.
-- A row goes when its circle is erased (0012); the daily cleanup removes the files first.
-- Runs after 0012. Safe to re-run.

create table if not exists public.visit_documents (
  id          uuid primary key default gen_random_uuid(),
  circle_id   uuid not null references public.circles (id) on delete cascade,
  visit_date  date,
  clinic      text check (char_length(clinic) <= 300),
  kind        text not null check (kind in ('photos', 'pdf')),
  page_count  int not null default 0 check (page_count between 0 and 30),
  paths       text[] not null default '{}' check (cardinality(paths) <= 30),
  created_by  uuid not null default auth.uid(),
  created_at  timestamptz not null default now()
);

create index if not exists visit_documents_circle_idx on public.visit_documents (circle_id, created_at desc);

alter table public.visit_documents enable row level security;

drop policy if exists visit_documents_select on public.visit_documents;
drop policy if exists visit_documents_insert on public.visit_documents;
drop policy if exists visit_documents_update on public.visit_documents;
drop policy if exists visit_documents_delete on public.visit_documents;

create policy visit_documents_select on public.visit_documents
  for select to authenticated
  using (public.is_circle_caregiver(circle_id));
create policy visit_documents_insert on public.visit_documents
  for insert to authenticated
  with check (public.is_circle_caregiver(circle_id) and created_by = auth.uid());
create policy visit_documents_update on public.visit_documents
  for update to authenticated
  using (public.is_circle_caregiver(circle_id))
  with check (public.is_circle_caregiver(circle_id));
create policy visit_documents_delete on public.visit_documents
  for delete to authenticated
  using (public.is_circle_caregiver(circle_id));

-- A saved summary never moves to another circle.
create or replace function public.visit_documents_keep_circle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.circle_id is distinct from old.circle_id then
    raise exception 'a saved summary stays in its circle';
  end if;
  return new;
end;
$$;

drop trigger if exists visit_documents_keep_circle on public.visit_documents;
create trigger visit_documents_keep_circle
  before update on public.visit_documents
  for each row execute function public.visit_documents_keep_circle();

revoke all on public.visit_documents from anon;
grant select, insert, update, delete on public.visit_documents to authenticated, service_role;

-- Private bucket: no public URL, no storage policies, so only the server's service role reaches it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('visit-documents', 'visit-documents', false, 10485760, array['image/jpeg', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
