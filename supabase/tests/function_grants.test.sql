-- Nothing in the public schema can be run without signing in, and the grants the app relies on stay.

begin;

select plan(9);

select is(
  (select coalesce(string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text), '')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and has_function_privilege('anon', p.oid, 'execute')),
  '',
  'no function can be run by the signed-out role'
);
select is(
  (select coalesce(string_agg(p.oid::regprocedure::text, ', ' order by p.oid::regprocedure::text), '')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and has_function_privilege('public', p.oid, 'execute')),
  '',
  'no function is open to every role'
);

select ok(
  has_function_privilege('authenticated', 'public.rotate_own_circle_key(uuid, text, int, jsonb, jsonb)', 'execute'),
  'a signed-in caregiver can change the key and carry file keys along'
);
select ok(
  not has_function_privilege('service_role', 'public.rotate_own_circle_key(uuid, text, int, jsonb, jsonb)', 'execute'),
  'the server cannot change a key with file keys'
);
select ok(
  not has_function_privilege('service_role', 'public.rotate_own_circle_key(uuid, text, int, jsonb)', 'execute'),
  'the server cannot change a key'
);

select ok(
  has_function_privilege('authenticated', 'public.is_circle_caregiver(uuid)', 'execute'),
  'row security can still ask whether the caregiver is in the circle'
);
select ok(
  has_function_privilege('authenticated', 'public.create_circle(jsonb, jsonb, text)', 'execute'),
  'a signed-in caregiver can still start a circle'
);
select ok(
  has_function_privilege('service_role', 'public.try_pin(text, uuid, text, int, int, int)', 'execute'),
  'the server can still check a PIN'
);
select ok(
  not has_function_privilege('authenticated', 'public.try_pin(text, uuid, text, int, int, int)', 'execute'),
  'a signed-in caregiver cannot check a PIN directly'
);

select * from finish();
rollback;
