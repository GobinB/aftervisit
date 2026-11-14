-- Nothing in the public schema may be run without signing in.
-- Postgres lets every role run a new function unless that is taken away, and 0015 added the
-- five-argument rotate_own_circle_key without doing so. The hosted project also carries a
-- platform helper, rls_auto_enable(), that was left open the same way.
-- This takes "run" away from the signed-out role (anon) and from the catch-all PUBLIC for every
-- function here. Roles that could run a function before keep it through a grant of their own, so
-- signed-in caregivers and the server see no change.
-- Runs after 0015. Safe to re-run.

do $$
declare
  f regprocedure;
  keep_signed_in boolean;
  keep_server boolean;
begin
  for f in
    select p.oid::regprocedure
      from pg_catalog.pg_proc p
      join pg_catalog.pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and not exists (
         select 1 from pg_catalog.pg_depend d where d.objid = p.oid and d.deptype = 'e'
       )
  loop
    keep_signed_in := pg_catalog.has_function_privilege('authenticated', f, 'execute');
    keep_server := pg_catalog.has_function_privilege('service_role', f, 'execute');
    execute pg_catalog.format('revoke all on function %s from public, anon', f);
    if keep_signed_in then
      execute pg_catalog.format('grant execute on function %s to authenticated', f);
    end if;
    if keep_server then
      execute pg_catalog.format('grant execute on function %s to service_role', f);
    end if;
  end loop;
end $$;

-- Changing the key for files is the signed-in caregiver's own act, in both forms.
revoke all on function public.rotate_own_circle_key(uuid, text, int, jsonb, jsonb) from public, anon, service_role;
grant execute on function public.rotate_own_circle_key(uuid, text, int, jsonb, jsonb) to authenticated;

-- The platform's helper runs only as an event trigger. Nobody calls it. It is absent locally.
do $$
begin
  if pg_catalog.to_regprocedure('public.rls_auto_enable()') is not null then
    revoke all on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
