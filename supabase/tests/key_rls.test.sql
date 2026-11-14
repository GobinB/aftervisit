-- The circle key All Hands Care keeps (migrations 0017 and 0018). It sits, wrapped, on the
-- caregiver's own row. Another caregiver and a signed-out visitor can neither read nor write it,
-- and people with a link have no database identity at all. Only the held form can be stored, the
-- version always matches the circle, and nothing can move the version or replace another's key.
-- Fixtures are fictional. The transaction rolls back.

begin;

select plan(17);

create function pg_temp.seed_user(p_id uuid, p_email text, p_name text, p_token text)
returns void language plpgsql as $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'email_confirmed_at'
  ) then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email, '', now(),
      '{"provider":"google","providers":["google"]}'::jsonb, jsonb_build_object('name', p_name),
      now(), now(), p_token, p_token || '-recovery', '', p_token || '-email'
    );
  else
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token
    ) values (
      '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email, '', now(),
      '{"provider":"google","providers":["google"]}'::jsonb, jsonb_build_object('name', p_name),
      now(), now(), p_token, p_token || '-recovery', '', p_token || '-email'
    );
  end if;
end $$;

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end $$;

select pg_temp.seed_user('dddddddd-dddd-4ddd-8ddd-dddddddddd01', 'owner.d@example.com', 'Owner D', 'key-d');
select pg_temp.seed_user('dddddddd-dddd-4ddd-8ddd-dddddddddd02', 'stranger.d@example.com', 'Stranger D', 'key-stranger');
select pg_temp.seed_user('dddddddd-dddd-4ddd-8ddd-dddddddddd03', 'next.d@example.com', 'Next D', 'key-next');

insert into public.circles (id, owner_id, content) values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddd10', 'dddddddd-dddd-4ddd-8ddd-dddddddddd01', '{"person_name":"Person D"}'::jsonb),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddd20', 'dddddddd-dddd-4ddd-8ddd-dddddddddd02', '{"person_name":"Person S"}'::jsonb);
insert into public.circle_caregivers (circle_id, user_id, role) values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddd10', 'dddddddd-dddd-4ddd-8ddd-dddddddddd01', 'owner'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddd20', 'dddddddd-dddd-4ddd-8ddd-dddddddddd02', 'owner');

-- The owner, as the app does it: the first key fills an empty place.
select pg_temp.act_as('dddddddd-dddd-4ddd-8ddd-dddddddddd01');
set local role authenticated;
select lives_ok(
  $$update public.circle_caregivers
       set circle_key_wrapped = 'av2.' || repeat('a', 16) || '.' || repeat('b', 64)
     where circle_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd10' and circle_key_wrapped is null$$,
  'the owner stores the circle''s held key on their own row'
);
select throws_ok(
  $$update public.circle_caregivers
       set circle_key_wrapped = 'av1.600000.' || repeat('a', 22) || '.' || repeat('b', 16) || '.' || repeat('c', 64)
     where circle_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd10'$$,
  'P0001', 'wrapped key is not valid', 'a key wrapped by recovery words can no longer be stored'
);
select throws_ok(
  $$update public.circle_caregivers set circle_key_wrapped = repeat('k', 43) where circle_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd10'$$,
  'P0001', 'wrapped key is not valid', 'a raw key cannot be stored'
);
select throws_ok(
  $$update public.circle_caregivers
       set circle_key_wrapped = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
     where circle_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd10'$$,
  'P0001', 'wrapped key is not valid', 'recovery words cannot be stored'
);
select throws_ok(
  $$update public.circle_caregivers set key_version = 7 where circle_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd10'$$,
  'P0001', 'the wrapped key version must match the circle', 'the owner cannot set the key version freely'
);
select throws_ok(
  $$update public.circles set key_version = key_version + 1 where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd10'$$,
  'P0001', 'key version changes only when the circle key is rotated', 'the circle key version cannot be moved'
);
select throws_ok(
  $$insert into public.circle_caregivers (circle_id, user_id, role)
    values ('dddddddd-dddd-4ddd-8ddd-dddddddddd10', 'dddddddd-dddd-4ddd-8ddd-dddddddddd03', 'owner')$$,
  'P0001', 'a caregiver can only add themselves', 'the owner cannot add a second caregiver'
);
reset role;

-- A signed-in stranger with a circle of their own.
select pg_temp.act_as('dddddddd-dddd-4ddd-8ddd-dddddddddd02');
set local role authenticated;
select is(
  (select count(*)::int from public.circle_caregivers where circle_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd10'),
  0,
  'another caregiver cannot read a circle''s stored key'
);
update public.circle_caregivers
   set circle_key_wrapped = 'av2.' || repeat('x', 16) || '.' || repeat('y', 64)
 where circle_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd10';
select throws_ok(
  $$insert into public.circle_caregivers (circle_id, user_id, role)
    values ('dddddddd-dddd-4ddd-8ddd-dddddddddd10', 'dddddddd-dddd-4ddd-8ddd-dddddddddd02', 'owner')$$,
  '42501', 'new row violates row-level security policy for table "circle_caregivers"',
  'another caregiver cannot add themselves to the circle'
);
update public.circles set owner_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd02' where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd10';
-- Copying a stored key onto their own row is allowed by the database; it opens nothing,
-- because each key is wrapped for its own circle (lib/key-custody.ts, tests/unit/key-custody.test.ts).
select lives_ok(
  $$update public.circle_caregivers
       set circle_key_wrapped = 'av2.' || repeat('a', 16) || '.' || repeat('b', 64)
     where circle_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd20'$$,
  'a caregiver can write only their own row'
);
reset role;

select is(
  (select circle_key_wrapped from public.circle_caregivers where circle_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd10'),
  'av2.' || repeat('a', 16) || '.' || repeat('b', 64),
  'another caregiver cannot change a circle''s stored key'
);
select is(
  (select owner_id from public.circles where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd10'),
  'dddddddd-dddd-4ddd-8ddd-dddddddddd01'::uuid,
  'another caregiver cannot take the circle'
);

-- Signed out.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select circle_key_wrapped from public.circle_caregivers$$, '42501', null, 'a signed-out visitor cannot read stored keys');
reset role;

-- People with a link reach the database only through the app's server, which checks can() first.
-- The table stays closed to every role but the caregiver's own session and the server.
select ok(not has_table_privilege('anon', 'public.circle_caregivers', 'select'), 'the signed-out role has no access to stored keys');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('rotate_own_circle_key', 'reset_own_circle_key')),
  0,
  'no function can replace a circle key'
);
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_circle'
      and pg_get_function_identity_arguments(p.oid) like '%p_wrapped%'),
  0,
  'a circle cannot be created with a key handed in by the browser'
);
select is(
  (select key_version from public.circles where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd10'),
  1,
  'the circle key version never moved'
);

select * from finish();
rollback;
