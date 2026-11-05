-- Calendar: one circle never reads or changes another's events, an event stays in its circle,
-- its person is on that circle, and times and repeats make sense. Fixtures are fictional. Rolls back.

begin;

select plan(11);

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

select pg_temp.seed_user('abababab-abab-4bab-8bab-ababababab01', 'events.a@example.com', 'Events A', 'events-a');
select pg_temp.seed_user('abababab-abab-4bab-8bab-ababababab02', 'events.b@example.com', 'Events B', 'events-b');

insert into public.circles (id, owner_id, content) values
  ('abababab-abab-4bab-8bab-ababababab10', 'abababab-abab-4bab-8bab-ababababab01', '{"person_name":"Person A"}'::jsonb),
  ('abababab-abab-4bab-8bab-ababababab20', 'abababab-abab-4bab-8bab-ababababab02', '{"person_name":"Person B"}'::jsonb);
insert into public.circle_caregivers (circle_id, user_id, role) values
  ('abababab-abab-4bab-8bab-ababababab10', 'abababab-abab-4bab-8bab-ababababab01', 'owner'),
  ('abababab-abab-4bab-8bab-ababababab20', 'abababab-abab-4bab-8bab-ababababab02', 'owner');
insert into public.members (id, circle_id, name, role, token_hash, expires_at) values
  ('abababab-abab-4bab-8bab-ababababab11', 'abababab-abab-4bab-8bab-ababababab10', 'Family A', 'family', 'events-hash-a', now() + interval '90 days'),
  ('abababab-abab-4bab-8bab-ababababab21', 'abababab-abab-4bab-8bab-ababababab20', 'Family B', 'family', 'events-hash-b', now() + interval '90 days');
insert into public.events (id, circle_id, title, event_date, start_time) values
  ('abababab-abab-4bab-8bab-ababababab22', 'abababab-abab-4bab-8bab-ababababab20', 'Cardiology', '2026-11-20', '10:30');

select set_config('request.jwt.claim.sub', 'abababab-abab-4bab-8bab-ababababab01', true);
select set_config('request.jwt.claims', '{"sub":"abababab-abab-4bab-8bab-ababababab01","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$insert into public.events (id, circle_id, title, event_date, start_time, end_time, going_member_id, repeat, repeat_until)
    values ('abababab-abab-4bab-8bab-ababababab12', 'abababab-abab-4bab-8bab-ababababab10', 'Physical therapy', '2026-11-10', '09:00', '10:00', 'abababab-abab-4bab-8bab-ababababab11', 'weekly', '2026-12-31')$$,
  'the caregiver adds a repeating event with someone going'
);
select is((select count(*) from public.events where circle_id = 'abababab-abab-4bab-8bab-ababababab20')::int, 0, 'A cannot read B events');
select throws_ok(
  $$insert into public.events (circle_id, title, event_date) values ('abababab-abab-4bab-8bab-ababababab20', 'Planted', '2026-11-11')$$,
  '42501',
  'new row violates row-level security policy for table "events"',
  'A cannot add to B'
);
select throws_ok(
  $$insert into public.events (circle_id, title, event_date, going_member_id) values ('abababab-abab-4bab-8bab-ababababab10', 'Borrowed', '2026-11-11', 'abababab-abab-4bab-8bab-ababababab21')$$,
  'P0001',
  'that person is not on this circle',
  'an event cannot go to a person on another circle'
);
select throws_ok(
  $$update public.events set circle_id = 'abababab-abab-4bab-8bab-ababababab20' where id = 'abababab-abab-4bab-8bab-ababababab12'$$,
  'P0001',
  'an event cannot move to another circle',
  'an event cannot move to another circle'
);
select throws_ok(
  $$insert into public.events (circle_id, title, event_date, start_time, end_time) values ('abababab-abab-4bab-8bab-ababababab10', 'Backwards', '2026-11-11', '10:00', '09:00')$$,
  '23514',
  'new row for relation "events" violates check constraint "events_end_after_start"',
  'an event ends after it starts'
);
select throws_ok(
  $$insert into public.events (circle_id, title, event_date, repeat_until) values ('abababab-abab-4bab-8bab-ababababab10', 'Once', '2026-11-11', '2026-12-01')$$,
  '23514',
  'new row for relation "events" violates check constraint "events_repeat_until"',
  'only a repeating event has an end date for repeats'
);
update public.events set title = 'Changed by A' where id = 'abababab-abab-4bab-8bab-ababababab22';
delete from public.events where id = 'abababab-abab-4bab-8bab-ababababab22';
reset role;

select is((select title from public.events where id = 'abababab-abab-4bab-8bab-ababababab22'), 'Cardiology', 'A cannot change B events');
select is((select count(*) from public.events where id = 'abababab-abab-4bab-8bab-ababababab22')::int, 1, 'A cannot delete B events');
select throws_ok(
  $$insert into public.events (circle_id, title, event_date, start_time) values ('abababab-abab-4bab-8bab-ababababab10', 'Bad time', '2026-11-11', '9am')$$,
  '23514',
  'new row for relation "events" violates check constraint "events_start_time_check"',
  'times are stored as HH:MM'
);
delete from public.members where id = 'abababab-abab-4bab-8bab-ababababab11';
select is((select going_member_id from public.events where id = 'abababab-abab-4bab-8bab-ababababab12'), null::uuid, 'removing a person leaves their events with nobody going');

select * from finish();
rollback;
