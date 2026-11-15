-- Phone numbers (migration 0022): optional, on each person and on the caregiver; only numbers can be
-- stored; the caregiver changes their own and their circle's people's, and nobody else's; a signed-out
-- visitor reads none. People with a link change only their own, through the server. Fictional. Rolls back.

begin;

select plan(19);

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

select pg_temp.seed_user('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcda1', 'phones.a@example.com', 'Phones A', 'phones-a');
select pg_temp.seed_user('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcda2', 'phones.b@example.com', 'Phones B', 'phones-b');

insert into public.circles (id, owner_id, content) values
  ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10', 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcda1', '{"person_name":"Person A"}'::jsonb),
  ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd20', 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcda2', '{"person_name":"Person B"}'::jsonb);
insert into public.circle_caregivers (circle_id, user_id, role) values
  ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10', 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcda1', 'owner'),
  ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd20', 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcda2', 'owner');
insert into public.members (id, circle_id, name, role, token_hash, expires_at) values
  ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd11', 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10', 'Ana', 'family', 'phones-hash-11', now() + interval '30 days'),
  ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd21', 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd20', 'Joy', 'home_aide', 'phones-hash-21', now() + interval '30 days');
update public.members set phone = '555-010-0121' where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd21';

select has_column('public', 'members', 'phone', 'people have a phone number column');
select has_column('public', 'circle_caregivers', 'phone', 'the caregiver has a phone number column');
select col_is_null('public', 'members', 'phone', 'a person''s number is never required');
select col_is_null('public', 'circle_caregivers', 'phone', 'the caregiver''s number is never required');
select is((select phone from public.members where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd11'), null, 'a person starts with no number');

-- Only phone numbers.
select lives_ok(
  $$update public.members set phone = '(555) 010-0142' where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd11'$$,
  'a number as people write it is kept'
);
select lives_ok(
  $$update public.members set phone = '+1 555 010 0142' where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd11'$$,
  'a number with a country code is kept'
);
select throws_ok(
  $$update public.members set phone = 'call me' where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd11'$$,
  '23514', null, 'words are not a number'
);
select throws_ok(
  $$update public.members set phone = '12' where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd11'$$,
  '23514', null, 'too short to be a number'
);
select throws_ok(
  $$update public.circle_caregivers set phone = repeat('5', 40) where circle_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10'$$,
  '23514', null, 'too long to be a number'
);

-- The caregiver, signed in.
select pg_temp.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcda1');
set local role authenticated;

with changed as (
  update public.circle_caregivers set phone = '555-010-0100'
  where circle_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10' and user_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcda1'
  returning phone
)
select is((select phone from changed), '555-010-0100', 'the caregiver sets their own number');
with changed as (
  update public.members set phone = '555-010-0111' where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd11' returning phone
)
select is((select phone from changed), '555-010-0111', 'the caregiver sets a number for a person in their circle');
with changed as (
  update public.members set phone = null where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd11' returning id
)
select is((select count(*)::int from changed), 1, 'and can remove it');
with changed as (
  update public.members set phone = '555-010-0999' where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd21' returning id
)
select is((select count(*)::int from changed), 0, 'cannot change a number in another circle');
with changed as (
  update public.circle_caregivers set phone = '555-010-0999' where circle_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd20' returning circle_id
)
select is((select count(*)::int from changed), 0, 'cannot change another caregiver''s number');
select is(
  (select count(*)::int from public.members where phone is not null),
  0,
  'cannot read the numbers of another circle''s people'
);
select is(
  (select count(*)::int from public.circle_caregivers where phone is not null),
  1,
  'reads only their own circle''s caregiver number'
);
reset role;

-- Signed out: nothing.
set local role anon;
select throws_ok($$select phone from public.members$$, '42501', null, 'a signed-out visitor cannot read people''s numbers');
select throws_ok($$select phone from public.circle_caregivers$$, '42501', null, 'a signed-out visitor cannot read the caregiver''s number');
reset role;

select * from finish();
rollback;
