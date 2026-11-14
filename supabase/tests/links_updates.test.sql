-- One link per person with limits, and the record of what the caregiver changed (migration 0019).
-- Fixtures are fictional. The transaction rolls back.

begin;

select plan(16);

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

select pg_temp.seed_user('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd01', 'links.a@example.com', 'Links A', 'links-a');
select pg_temp.seed_user('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd02', 'links.b@example.com', 'Links B', 'links-b');
insert into public.circles (id, owner_id, content) values
  ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10', 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd01', '{"person_name":"Person A"}'::jsonb),
  ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd20', 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd02', '{"person_name":"Person B"}'::jsonb);
insert into public.circle_caregivers (circle_id, user_id, role) values
  ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10', 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd01', 'owner'),
  ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd20', 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd02', 'owner');
insert into public.members (id, circle_id, name, role, token_hash, expires_at) values
  ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd11', 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10', 'Aide A', 'home_aide', 'links-hash-aaaaaaaaaaaaaaaaaaaaaaaaaaaa', now() + interval '30 days');

-- Limits on a link.
select is((select link_version from public.members where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd11'), 1, 'a new link is number 1');
select ok((select link_issued_at > now() - interval '1 minute' from public.members where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd11'), 'and records when it was made');
select throws_ok(
  $$update public.members set expires_at = link_issued_at + interval '91 days' where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd11'$$,
  '23514', null, 'a link cannot work longer than 90 days after it was made'
);
select lives_ok(
  $$update public.members set expires_at = link_issued_at + interval '90 days' where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd11'$$,
  'up to 90 days is allowed'
);
select throws_ok(
  $$update public.members set link_version = 0 where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd11'$$,
  '23514', null, 'the link number starts at 1'
);

-- Changes the caregiver makes are recorded, by area.
select pg_temp.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd01');
set local role authenticated;
insert into public.medications (circle_id, name) values ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10', 'Metformin');
insert into public.events (circle_id, title, event_date) values ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10', 'Follow-up visit', '2026-12-01');
insert into public.todos (circle_id, title) values ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10', 'Call the clinic');
update public.circles set content = '{"person_name":"Person A","allergies":["Penicillin"]}'::jsonb where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10';
select is(
  (select string_agg(area, ',' order by area) from public.circle_updates where circle_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10'),
  'calendar,medications,summary,tasks',
  'medicines, the calendar, reminders and the care summary are each recorded'
);
select throws_ok(
  $$insert into public.circle_updates (circle_id, area) values ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10', 'medications')$$,
  '42501', null, 'nobody writes the record directly'
);
select throws_ok(
  $$update public.circle_updates set changed_at = now() - interval '1 year'$$,
  '42501', null, 'nor changes it'
);
reset role;

-- Another caregiver sees none of it, and their own changes land on their own circle only.
select pg_temp.act_as('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd02');
set local role authenticated;
select is((select count(*)::int from public.circle_updates where circle_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10'), 0, 'another caregiver cannot read a circle''s changes');
insert into public.medications (circle_id, name) values ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd20', 'Lisinopril');
select is((select count(*)::int from public.circle_updates where circle_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd20'), 1, 'their own change is recorded on their own circle');
reset role;

-- Signed out.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select count(*) from public.circle_updates$$, '42501', null, 'a signed-out visitor cannot read changes');
reset role;

-- A change made from a person's link (the server, with no signed-in caregiver) is not the caregiver's change.
delete from public.circle_updates where circle_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10' and area = 'tasks';
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);
set local role service_role;
update public.todos set status = 'done', done_at = now() where circle_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10';
reset role;
select is(
  (select count(*)::int from public.circle_updates where circle_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10' and area = 'tasks'),
  0,
  'a change made from a person''s link is not recorded'
);

-- Erasing a circle takes its record with it and records nothing on the way.
select lives_ok($$delete from public.circles where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10'$$, 'a circle with recorded changes can be erased');
select is((select count(*)::int from public.circle_updates where circle_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10'), 0, 'and its record goes with it');

select ok(
  not has_function_privilege('authenticated', 'public.circle_updates_touch()', 'execute')
  and not has_function_privilege('anon', 'public.circle_updates_touch()', 'execute'),
  'nobody can call the recording function directly'
);
select ok(not has_table_privilege('authenticated', 'public.circle_updates', 'insert'), 'signed-in users cannot add to the record');

select * from finish();
rollback;
