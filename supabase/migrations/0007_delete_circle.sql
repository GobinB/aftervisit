-- Deleting a circle is one transaction. Runs after 0006. 0004-0006 are not modified.
-- A caregiver's plain update of circles.deleted_at fails: the update needs read
-- access, so circles_select (deleted_at is null) is also checked on the new row,
-- and a deleted row never passes it.
-- This function checks that auth.uid() owns the circle, marks it deleted, turns off
-- every helper link that is still on, and writes the activity row, all together.
-- It runs as its owner, so the circle triggers skip their checks. The owner check is here.
-- Safe to re-run.

create or replace function public.delete_circle(p_circle uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null then
    raise exception 'sign in to delete a circle';
  end if;

  select owner_id into v_owner
  from public.circles
  where id = p_circle and deleted_at is null
  for update;
  if v_owner is null then
    raise exception 'that circle was not found';
  end if;
  if v_owner is distinct from v_uid then
    raise exception 'only the owner can delete a circle';
  end if;

  update public.circles
     set deleted_at = pg_catalog.now()
   where id = p_circle;

  update public.members
     set revoked_at = pg_catalog.now()
   where circle_id = p_circle
     and revoked_at is null;

  insert into public.activity (circle_id, actor, action, subject_type, subject_id)
  values (p_circle, 'caregiver:' || v_uid::text, 'circle_deleted', 'circle', p_circle);
end;
$$;

revoke all on function public.delete_circle(uuid) from public, anon, authenticated, service_role;
grant execute on function public.delete_circle(uuid) to authenticated;
