-- Erase circles 30 days after they were deleted. Runs after 0011. Safe to re-run.
-- Deleting a circle (0007) closes it at once: nobody can open it and every link stops working.
-- This function, called by the daily cleanup, then removes it for good. Every table that
-- belongs to a circle (caregivers, people, consents, activity, medications and their history,
-- to-dos, events) is deleted with it through its foreign key.
-- Only the server's service role can call it.

create or replace function public.purge_deleted_circles(p_days int default 30)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if p_days is null or p_days < 1 then
    raise exception 'keep deleted circles for at least one day';
  end if;

  delete from public.circles
   where deleted_at is not null
     and deleted_at < pg_catalog.now() - pg_catalog.make_interval(days => p_days);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.purge_deleted_circles(int) from public, anon, authenticated;
grant execute on function public.purge_deleted_circles(int) to service_role;
