-- Caregiver A cannot read, change, or delete caregiver B's circle.
-- Fixtures are fictional. The transaction rolls back.

begin;

select plan(20);

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

select pg_temp.seed_user('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'caregiver.a@example.com', 'Caregiver A', 'rls-a');
select pg_temp.seed_user('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'caregiver.b@example.com', 'Caregiver B', 'rls-b');
select pg_temp.seed_user('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 'caregiver.co@example.com', 'Co Caregiver', 'rls-co');

insert into public.circles (id, owner_id, content) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '{"person_name":"Person A"}'::jsonb),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', '{"person_name":"Person B"}'::jsonb);

insert into public.circle_caregivers (circle_id, user_id, role) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'owner'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 'co_caregiver'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'owner');

insert into public.members (id, circle_id, name, role, token_hash, expires_at) values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10',
    'Aide A', 'home_aide', 'rls-hash-a', now() + interval '90 days'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb21',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20',
    'Aide B', 'home_aide', 'rls-hash-b', now() + interval '90 days'
  );

insert into public.consents (id, circle_id, user_id, type, version, text_hash) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa12', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'terms', '2026-11-02', 'hash-a'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb22', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'terms', '2026-11-02', 'hash-b');

insert into public.activity (id, circle_id, actor, action, subject_type, subject_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa13', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10', 'caregiver:a', 'circle_created', 'circle', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb23', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20', 'caregiver:b', 'circle_created', 'circle', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20');

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","role":"authenticated"}',
  true
);
set local role authenticated;

select is((select count(*) from public.circles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20')::int, 0, 'A cannot select B circle');
select is((select count(*) from public.circle_caregivers where circle_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20')::int, 0, 'A cannot select B caregivers');
select is((select count(*) from public.members where circle_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20')::int, 0, 'A cannot select B members');
select is((select count(*) from public.consents where circle_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20')::int, 0, 'A cannot select B consents');
select is((select count(*) from public.activity where circle_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20')::int, 0, 'A cannot select B activity');

update public.circles set key_version = 99 where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20';
update public.circle_caregivers set key_version = 99 where circle_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20';
update public.members set name = 'changed' where circle_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20';
update public.consents set version = 'changed' where circle_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20';
update public.activity set action = 'changed' where circle_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20';
delete from public.activity where circle_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20';
delete from public.consents where circle_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20';
delete from public.members where circle_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20';
delete from public.circle_caregivers where circle_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20';
delete from public.circles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20';

reset role;

select is((select key_version from public.circles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20'), 1, 'A cannot update B circle');
select is((select key_version from public.circle_caregivers where circle_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20'), 1, 'A cannot update B caregivers');
select is((select name from public.members where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb21'), 'Aide B', 'A cannot update B members');
select is((select version from public.consents where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb22'), '2026-11-02', 'A cannot update B consents');
select is((select action from public.activity where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb23'), 'circle_created', 'A cannot update B activity');
select is((select count(*) from public.activity where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb23')::int, 1, 'A cannot delete B activity');
select is((select count(*) from public.consents where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb22')::int, 1, 'A cannot delete B consents');
select is((select count(*) from public.members where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb21')::int, 1, 'A cannot delete B members');
select is((select count(*) from public.circle_caregivers where circle_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20')::int, 1, 'A cannot delete B caregivers');
select is((select count(*) from public.circles where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb20')::int, 1, 'A cannot delete B circle');

select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","role":"authenticated"}',
  true
);
set local role authenticated;
select is((select count(*) from public.circles where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10')::int, 1, 'A can select A circle');
reset role;

select set_config('request.jwt.claim.sub', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"cccccccc-cccc-4ccc-8ccc-ccccccccccc3","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$update public.circles set deleted_at = now() where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa10'$$,
  'P0001',
  'only the owner can delete a circle',
  'co-caregiver cannot delete the circle'
);
reset role;

update public.members set pin_hash = 'member-pin-hash' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb21';
set local role service_role;
select is(
  (select result from public.try_pin('not-a-handoff', null, null, 3, 10, 3)),
  'not_found',
  'try_pin still reports a missing handoff'
);
select is(
  (select result from public.try_pin('not-a-handoff', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb21', 'wrong', 3, 10, 3)),
  'wrong_pin',
  'try_pin counts a wrong PIN on a member link'
);
reset role;
select is(
  (select pin_failures from public.members where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb21'),
  1,
  'member PIN failure is stored on that member'
);

select * from finish();
rollback;
