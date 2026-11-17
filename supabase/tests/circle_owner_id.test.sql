-- circle_owner_id tells a caregiver the owner of their own circle and nobody else's.
-- Updating your own circle still passes the circles_update policy, and owner_id still cannot move.
-- Fixtures are fictional. The transaction rolls back.

begin;

select plan(10);

-- Same column split as supabase/seed.sql: GoTrue renames confirmed_at.
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

create function pg_temp.sign_in(p_id uuid)
returns void language sql as $$
  select set_config('request.jwt.claim.sub', p_id::text, true);
  select set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

select pg_temp.seed_user('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'owner.a@example.com', 'Caregiver A', 'own-a');
select pg_temp.seed_user('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'owner.b@example.com', 'Caregiver B', 'own-b');
select pg_temp.seed_user('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 'stranger.c@example.com', 'Stranger C', 'own-c');

insert into public.circles (id, owner_id, content) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '{"person_name":"Person A"}'::jsonb),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '{"person_name":"Person B"}'::jsonb);

insert into public.circle_caregivers (circle_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'owner'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'owner');

-- Caregiver A.
select pg_temp.sign_in('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');
set local role authenticated;

select is(
  public.circle_owner_id('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10'),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid,
  'a caregiver gets the owner of their own circle'
);
select is(
  public.circle_owner_id('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20'),
  null::uuid,
  'a caregiver gets nothing for another circle'
);
select is(
  public.circle_owner_id('dddddddd-dddd-4ddd-8ddd-dddddddddd40'),
  null::uuid,
  'a circle that does not exist gives nothing'
);

update public.circles
   set content = '{"person_name":"Person A, edited"}'::jsonb
 where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10';
select is(
  (select content->>'person_name' from public.circles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10'),
  'Person A, edited',
  'a caregiver can still update their own circle'
);

select throws_ok(
  $$update public.circles set owner_id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10'$$,
  'P0001',
  'only the owner can change circle ownership',
  'a caregiver still cannot hand the circle to someone else'
);

update public.circles
   set content = '{"person_name":"Changed by A"}'::jsonb
 where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20';
reset role;

select is(
  (select content->>'person_name' from public.circles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20'),
  'Person B',
  'a caregiver still cannot update another circle'
);

-- A signed-in stranger with no circle.
select pg_temp.sign_in('cccccccc-cccc-4ccc-8ccc-ccccccccccc3');
set local role authenticated;
select is(
  public.circle_owner_id('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10'),
  null::uuid,
  'a signed-in stranger gets nothing'
);
reset role;

-- Signed out.
set local role anon;
select throws_ok(
  $$select public.circle_owner_id('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10')$$,
  '42501',
  null,
  'the signed-out role cannot run it'
);
reset role;

select ok(
  (select prosecdef from pg_proc where oid = 'public.circle_owner_id(uuid)'::regprocedure),
  'it still runs as security definer'
);
select ok(
  (select proconfig @> array['search_path=public'] from pg_proc where oid = 'public.circle_owner_id(uuid)'::regprocedure),
  'it still pins search_path'
);

select * from finish();
rollback;
