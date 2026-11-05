-- Medications: one circle never reads or changes another's list, and every change
-- lands in medication_changes through the trigger only. Fixtures are fictional. Rolls back.

begin;

select plan(14);

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

select pg_temp.seed_user('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'meds.a@example.com', 'Meds A', 'meds-a');
select pg_temp.seed_user('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', 'meds.b@example.com', 'Meds B', 'meds-b');

insert into public.circles (id, owner_id, content) values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee10', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', '{"person_name":"Person A"}'::jsonb),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee20', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', '{"person_name":"Person B"}'::jsonb);
insert into public.circle_caregivers (circle_id, user_id, role) values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee10', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', 'owner'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee20', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2', 'owner');
insert into public.medications (id, circle_id, name, dose) values
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee21', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee20', 'Metformin', '500 mg');

select set_config('request.jwt.claim.sub', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1', true);
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$insert into public.medications (id, circle_id, name, dose, schedule, times)
    values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee11', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee10', 'Lisinopril', '10 mg', 'daily', array['08:00'])$$,
  'the caregiver adds a medication to their circle'
);
select is((select count(*) from public.medications where circle_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee20')::int, 0, 'A cannot read B medications');
select is((select count(*) from public.medication_changes where circle_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee20')::int, 0, 'A cannot read B medication history');
select throws_ok(
  $$insert into public.medications (circle_id, name) values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee20', 'Planted')$$,
  '42501',
  'new row violates row-level security policy for table "medications"',
  'A cannot add to B list'
);
update public.medications set dose = '1000 mg' where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee21';
delete from public.medications where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee21';
update public.medications set dose = '20 mg' where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee11';
update public.medications set status = 'stopped' where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee11';
select throws_ok(
  $$update public.medications set circle_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee20' where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee11'$$,
  'P0001',
  'a medication cannot move to another circle',
  'a medication cannot move to another circle'
);
select throws_ok(
  $$insert into public.medication_changes (circle_id, medication_id, actor, change, summary)
    values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee10', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee11', 'caregiver:fake', 'added', 'forged')$$,
  '42501',
  'permission denied for table medication_changes',
  'nobody writes history directly'
);
select throws_ok(
  $$update public.medication_changes set summary = 'rewritten' where circle_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee10'$$,
  '42501',
  'permission denied for table medication_changes',
  'history cannot be rewritten'
);
select throws_ok(
  $$insert into public.medications (circle_id, name, times) values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee10', 'Bad time', array['noon'])$$,
  '23514',
  'new row for relation "medications" violates check constraint "medications_times_check"',
  'times are stored as HH:MM'
);
reset role;

select is((select dose from public.medications where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee21'), '500 mg', 'A cannot change B medications');
select is((select count(*) from public.medications where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee21')::int, 1, 'A cannot delete B medications');
select is(
  (select array_agg(change order by at, change) from public.medication_changes where medication_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee11'),
  array['added', 'edited', 'stopped'],
  'each add, edit and stop is recorded'
);
select is(
  (select summary from public.medication_changes where medication_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee11' and change = 'edited'),
  'Lisinopril 20 mg. Dose: 10 mg → 20 mg',
  'an edit records what changed'
);
select is(
  (select distinct actor from public.medication_changes where medication_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee11'),
  'caregiver:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
  'history names the caregiver who made the change'
);
select is((select status from public.medications where id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee11'), 'stopped', 'a stopped medication stays on the record');

select * from finish();
rollback;
