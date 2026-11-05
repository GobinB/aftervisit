-- Deleted circles are erased after 30 days, with everything that belongs to them.
-- Recently deleted and active circles stay. Only the service role may run it. Rolls back.

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

select pg_temp.seed_user('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd01', 'purge.owner@example.com', 'Purge Owner', 'purge-owner');

insert into public.circles (id, owner_id, content, deleted_at) values
  ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10', 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd01', '{"person_name":"Deleted long ago"}'::jsonb, now() - interval '31 days'),
  ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd20', 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd01', '{"person_name":"Deleted this week"}'::jsonb, now() - interval '5 days'),
  ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd30', 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd01', '{"person_name":"Still in use"}'::jsonb, null);
insert into public.circle_caregivers (circle_id, user_id, role) values
  ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10', 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd01', 'owner'), ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd20', 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd01', 'owner'), ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd30', 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd01', 'owner');
insert into public.members (id, circle_id, name, role, token_hash, expires_at) values
  ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd11', 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10', 'Helper', 'family', 'purge-hash-old', now() + interval '90 days');
insert into public.medications (id, circle_id, name) values ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd12', 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10', 'Lisinopril');
insert into public.todos (circle_id, title, assignee_member_id) values ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10', 'Call the pharmacy', 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd11');
insert into public.events (circle_id, title, event_date) values ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10', 'Cardiology', '2026-11-20');
insert into public.activity (circle_id, actor, action) values ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10', 'caregiver:x', 'circle_deleted');

select set_config('request.jwt.claim.sub', 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd01', true);
select set_config('request.jwt.claims', '{"sub":"cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd01","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.purge_deleted_circles(30)$$,
  '42501',
  'permission denied for function purge_deleted_circles',
  'a signed-in caregiver cannot run the purge'
);
reset role;

set local role service_role;
select is(public.purge_deleted_circles(30), 1, 'one circle is old enough to erase');
select throws_ok($$select public.purge_deleted_circles(0)$$, 'P0001', 'keep deleted circles for at least one day', 'the purge refuses a zero-day window');
reset role;

select is((select count(*) from public.circles where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10')::int, 0, 'the old deleted circle is erased');
select is((select count(*) from public.circle_caregivers where circle_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10')::int, 0, 'its caregiver row is erased');
select is((select count(*) from public.members where circle_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10')::int, 0, 'its people are erased');
select is((select count(*) from public.medications where circle_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10')::int + (select count(*) from public.medication_changes where circle_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10')::int, 0, 'its medications and their history are erased');
select is((select count(*) from public.todos where circle_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10')::int + (select count(*) from public.events where circle_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10')::int, 0, 'its to-dos and events are erased');
select is((select count(*) from public.activity where circle_id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10')::int, 0, 'its activity is erased');
select is((select count(*) from public.circles where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd20')::int, 1, 'a circle deleted this week is kept');
select is((select count(*) from public.circles where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd30')::int, 1, 'an active circle is kept');

select * from finish();
rollback;
