-- A caregiver may write only their own wrapped circle key. Each circle has one caregiver;
-- user 02 is a signed-in stranger who is not in the circle.
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

select pg_temp.seed_user('dddddddd-dddd-4ddd-8ddd-dddddddddd01', 'owner.d@example.com', 'Owner D', 'key-d');
select pg_temp.seed_user('dddddddd-dddd-4ddd-8ddd-dddddddddd02', 'stranger.d@example.com', 'Stranger D', 'key-stranger');
select pg_temp.seed_user('dddddddd-dddd-4ddd-8ddd-dddddddddd03', 'next.d@example.com', 'Next D', 'key-next');

insert into public.circles (id, owner_id, content) values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddd10', 'dddddddd-dddd-4ddd-8ddd-dddddddddd01', '{"person_name":"Person D"}'::jsonb);

insert into public.circle_caregivers (circle_id, user_id, role) values
  ('dddddddd-dddd-4ddd-8ddd-dddddddddd10', 'dddddddd-dddd-4ddd-8ddd-dddddddddd01', 'owner');

-- 22 / 16 / 64, the av1 shape. Not a real key.
-- owner wrap, stranger attempt, rotated wrap
-- av1.600000.aaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbb.cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc

select set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd01', true);
select set_config('request.jwt.claims', '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddd01","role":"authenticated"}', true);
set local role authenticated;
update public.circle_caregivers
   set circle_key_wrapped = 'av1.600000.aaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbb.cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
 where circle_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd10'
   and user_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd01';
reset role;
select is(
  (select circle_key_wrapped from public.circle_caregivers where user_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd01'),
  'av1.600000.aaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbb.cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  'owner can store their own wrapped key'
);

select set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd02', true);
select set_config('request.jwt.claims', '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddd02","role":"authenticated"}', true);
set local role authenticated;
update public.circle_caregivers
   set circle_key_wrapped = 'av1.600000.aaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbb.dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
 where user_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd01';
update public.circle_caregivers set role = 'co_caregiver' where user_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd01';
update public.circles set owner_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd02' where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd10';
select throws_ok(
  $$insert into public.circle_caregivers (circle_id, user_id, role)
    values ('dddddddd-dddd-4ddd-8ddd-dddddddddd10', 'dddddddd-dddd-4ddd-8ddd-dddddddddd03', 'owner')$$,
  'P0001',
  'a caregiver can only add themselves',
  'a stranger cannot add a caregiver'
);
select throws_ok(
  $$insert into public.circle_caregivers (circle_id, user_id, role)
    values ('dddddddd-dddd-4ddd-8ddd-dddddddddd10', 'dddddddd-dddd-4ddd-8ddd-dddddddddd02', 'owner')$$,
  '42501',
  'new row violates row-level security policy for table "circle_caregivers"',
  'a stranger cannot add themselves'
);
select throws_ok(
  $$select public.rotate_own_circle_key(
    'dddddddd-dddd-4ddd-8ddd-dddddddddd10',
    'av1.600000.aaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbb.ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    2,
    '[{"id":"dddddddd-dddd-4ddd-8ddd-dddddddddd11","token_hash":"abababababababababababababababababababababababababababababababab"}]'::jsonb
  )$$,
  'P0001',
  'only the owner can change the circle key',
  'a stranger cannot rotate the circle key'
);
reset role;
select is(
  (select circle_key_wrapped from public.circle_caregivers where user_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd01'),
  'av1.600000.aaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbb.cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  'a stranger cannot write the owner key'
);
select is(
  (select role from public.circle_caregivers where user_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd01'),
  'owner',
  'a stranger cannot change the owner role'
);
select is(
  (select owner_id from public.circles where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd10'),
  'dddddddd-dddd-4ddd-8ddd-dddddddddd01'::uuid,
  'a stranger cannot take ownership'
);

insert into public.members (id, circle_id, name, role, token_hash, expires_at) values (
  'dddddddd-dddd-4ddd-8ddd-dddddddddd11',
  'dddddddd-dddd-4ddd-8ddd-dddddddddd10',
  'Aide D',
  'home_aide',
  'old-hash-dddddddddddddddddddddddddddd',
  now() + interval '90 days'
);

select set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd01', true);
select set_config('request.jwt.claims', '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddd01","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$insert into public.circle_caregivers (circle_id, user_id, role)
    values ('dddddddd-dddd-4ddd-8ddd-dddddddddd10', 'dddddddd-dddd-4ddd-8ddd-dddddddddd03', 'co_caregiver')$$,
  'P0001',
  'a caregiver can only add themselves',
  'the owner cannot add a second caregiver'
);
select throws_ok(
  $$update public.circle_caregivers
       set circle_key_wrapped = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'
     where user_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd01'$$,
  'P0001',
  'wrapped key is not valid',
  'a recovery phrase cannot be stored'
);
select throws_ok(
  $$update public.circles set key_version = key_version + 1 where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd10'$$,
  'P0001',
  'key version changes only when the circle key is rotated',
  'owner cannot bump the circle key version directly'
);
select throws_ok(
  $$update public.circle_caregivers set key_version = 7 where user_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd01'$$,
  'P0001',
  'the wrapped key version must match the circle',
  'owner cannot set their wrapped key version freely'
);
reset role;

select set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-dddddddddd01', true);
select set_config('request.jwt.claims', '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddd01","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.rotate_own_circle_key(
    'dddddddd-dddd-4ddd-8ddd-dddddddddd10',
    'av1.600000.aaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbb.ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    2,
    '[]'::jsonb
  )$$,
  'P0001',
  'helper links could not be replaced',
  'rotate does not keep a key change when a helper token is missing'
);
select is(
  (select key_version from public.circles where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd10'),
  1,
  'a failed rotate leaves the circle key version'
);
select is(
  public.rotate_own_circle_key(
    'dddddddd-dddd-4ddd-8ddd-dddddddddd10',
    'av1.600000.aaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbb.ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    2,
    '[{"id":"dddddddd-dddd-4ddd-8ddd-dddddddddd11","token_hash":"abababababababababababababababababababababababababababababababab"}]'::jsonb
  ),
  2,
  'rotate moves the circle key version forward by one'
);
reset role;
select is(
  (select token_hash from public.members where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd11'),
  'abababababababababababababababababababababababababababababababab',
  'rotate replaces helper token hashes in the same step'
);

select is((select key_version from public.circles where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd10'), 2, 'circle key_version is 2');
select is(
  (select circle_key_wrapped from public.circle_caregivers where user_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddd01'),
  'av1.600000.aaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbb.ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  'rotate rewraps the caregiver who changed the key'
);

select * from finish();
rollback;
