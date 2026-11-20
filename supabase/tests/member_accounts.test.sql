-- Optional sign-in for people (migration 0025): a person's link is tied to an account only by the
-- server; the caregiver can clear the tie but never set it; one account per person and one person
-- per account in each circle; never the circle's own caregiver; a tie never moves straight to
-- another account; a signed-in person still cannot read members directly. Fictional. Rolls back.

begin;

select plan(20);

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

-- Two caregivers, and Ivy, a care manager who helps in both circles.
select pg_temp.seed_user('acacacac-acac-4cac-8cac-acacacacaca1', 'accounts.a@example.com', 'Accounts A', 'accounts-a');
select pg_temp.seed_user('acacacac-acac-4cac-8cac-acacacacaca2', 'accounts.b@example.com', 'Accounts B', 'accounts-b');
select pg_temp.seed_user('acacacac-acac-4cac-8cac-acacacacaca3', 'ivy.helper@example.com', 'Ivy Helper', 'accounts-ivy');
select pg_temp.seed_user('acacacac-acac-4cac-8cac-acacacacaca4', 'other.helper@example.com', 'Other Helper', 'accounts-other');

insert into public.circles (id, owner_id, content) values
  ('acacacac-acac-4cac-8cac-acacacacac10', 'acacacac-acac-4cac-8cac-acacacacaca1', '{"person_name":"Person A"}'::jsonb),
  ('acacacac-acac-4cac-8cac-acacacacac20', 'acacacac-acac-4cac-8cac-acacacacaca2', '{"person_name":"Person B"}'::jsonb);
insert into public.circle_caregivers (circle_id, user_id, role) values
  ('acacacac-acac-4cac-8cac-acacacacac10', 'acacacac-acac-4cac-8cac-acacacacaca1', 'owner'),
  ('acacacac-acac-4cac-8cac-acacacacac20', 'acacacac-acac-4cac-8cac-acacacacaca2', 'owner');
insert into public.members (id, circle_id, name, role, token_hash, expires_at) values
  ('acacacac-acac-4cac-8cac-acacacacac11', 'acacacac-acac-4cac-8cac-acacacacac10', 'Ivy', 'care_manager', 'accounts-hash-11', now() + interval '30 days'),
  ('acacacac-acac-4cac-8cac-acacacacac12', 'acacacac-acac-4cac-8cac-acacacacac10', 'Sam', 'family', 'accounts-hash-12', now() + interval '30 days'),
  ('acacacac-acac-4cac-8cac-acacacacac21', 'acacacac-acac-4cac-8cac-acacacacac20', 'Ivy', 'care_manager', 'accounts-hash-21', now() + interval '30 days');

select has_index('public', 'members', 'members_one_per_account', 'one person per account in each circle');
select has_trigger('public', 'members', 'members_account_guard', 'the account guard is on members');
select col_is_null('public', 'members', 'user_id', 'nobody has to sign in');

-- The caregiver, signed in: can clear a tie, never set one.
select pg_temp.act_as('acacacac-acac-4cac-8cac-acacacacaca1');
set local role authenticated;
select throws_ok(
  $$update public.members set user_id = 'acacacac-acac-4cac-8cac-acacacacaca3' where id = 'acacacac-acac-4cac-8cac-acacacacac11'$$,
  'P0001', 'only the person can save their own link to their account', 'the caregiver cannot tie a person''s link to an account'
);
select throws_ok(
  $$update public.members set user_id = 'acacacac-acac-4cac-8cac-acacacacaca1' where id = 'acacacac-acac-4cac-8cac-acacacacac11'$$,
  'P0001', null, 'nor to their own account'
);
select throws_ok(
  $$insert into public.members (circle_id, name, role, token_hash, expires_at, user_id)
    values ('acacacac-acac-4cac-8cac-acacacacac10', 'New', 'family', 'accounts-hash-new', now() + interval '30 days', 'acacacac-acac-4cac-8cac-acacacacaca3')$$,
  'P0001', null, 'nor add a person already tied to an account'
);
reset role;

-- The server (service role), after checking the link and the sign-in.
set local role service_role;
select lives_ok(
  $$update public.members set user_id = 'acacacac-acac-4cac-8cac-acacacacaca3' where id = 'acacacac-acac-4cac-8cac-acacacacac11'$$,
  'the server ties Ivy''s link in circle A to her account'
);
select lives_ok(
  $$update public.members set user_id = 'acacacac-acac-4cac-8cac-acacacacaca3' where id = 'acacacac-acac-4cac-8cac-acacacacac21'$$,
  'and her link in circle B: one account, two circles'
);
select throws_ok(
  $$update public.members set user_id = 'acacacac-acac-4cac-8cac-acacacacaca3' where id = 'acacacac-acac-4cac-8cac-acacacacac12'$$,
  '23505', null, 'one account cannot hold two people in the same circle'
);
select throws_ok(
  $$update public.members set user_id = 'acacacac-acac-4cac-8cac-acacacacaca4' where id = 'acacacac-acac-4cac-8cac-acacacacac11'$$,
  'P0001', 'this link is already saved to another account', 'a tied link never moves straight to another account'
);
select throws_ok(
  $$update public.members set user_id = 'acacacac-acac-4cac-8cac-acacacacaca1' where id = 'acacacac-acac-4cac-8cac-acacacacac12'$$,
  'P0001', 'the caregiver who runs a circle cannot also be a person in it', 'the circle''s caregiver cannot hold a person''s link in it'
);
select lives_ok(
  $$update public.members set name = 'Ivy R.' where id = 'acacacac-acac-4cac-8cac-acacacacac11'$$,
  'other changes to a tied row still work'
);
reset role;

-- Ivy, signed in, is not a caregiver: row security still shows her nothing directly.
select pg_temp.act_as('acacacac-acac-4cac-8cac-acacacacaca3');
set local role authenticated;
select is((select count(*)::int from public.members), 0, 'a signed-in person reads no member rows directly, not even their own');
select is((select count(*)::int from public.circles), 0, 'nor any circle');
with changed as (
  update public.members set user_id = null where id = 'acacacac-acac-4cac-8cac-acacacacac11' returning id
)
select is((select count(*)::int from changed), 0, 'nor clear her own tie directly');
reset role;

-- The other caregiver cannot clear a tie in a circle that is not theirs.
select pg_temp.act_as('acacacac-acac-4cac-8cac-acacacacaca2');
set local role authenticated;
with changed as (
  update public.members set user_id = null where id = 'acacacac-acac-4cac-8cac-acacacacac11' returning id
)
select is((select count(*)::int from changed), 0, 'a caregiver cannot undo a tie in another circle');
reset role;

-- Circle A's caregiver undoes Ivy's tie: the link works on its own again.
select pg_temp.act_as('acacacac-acac-4cac-8cac-acacacacaca1');
set local role authenticated;
with changed as (
  update public.members set user_id = null where id = 'acacacac-acac-4cac-8cac-acacacacac11' returning id
)
select is((select count(*)::int from changed), 1, 'the caregiver undoes the tie');
reset role;
select is(
  (select user_id from public.members where id = 'acacacac-acac-4cac-8cac-acacacacac21'),
  'acacacac-acac-4cac-8cac-acacacacaca3'::uuid,
  'her tie in the other circle stays'
);

set local role service_role;
select lives_ok(
  $$update public.members set user_id = 'acacacac-acac-4cac-8cac-acacacacaca4' where id = 'acacacac-acac-4cac-8cac-acacacacac11'$$,
  'after an undo the link can be saved again'
);
reset role;

-- Deleting a Google account clears its ties instead of being refused.
delete from auth.users where id = 'acacacac-acac-4cac-8cac-acacacacaca4';
select is(
  (select user_id from public.members where id = 'acacacac-acac-4cac-8cac-acacacacac11'),
  null,
  'a deleted account leaves the link working on its own'
);

select * from finish();
rollback;
