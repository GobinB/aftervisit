-- Care summary: added after the circle starts (allergies, doctors, who to call). The owner can
-- change their own circle's summary; another caregiver and a signed-out visitor cannot. Fictional. Rolls back.

begin;

select plan(5);

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

select pg_temp.seed_user('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd01', 'summary.a@example.com', 'Summary A', 'summary-a');
select pg_temp.seed_user('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd02', 'summary.b@example.com', 'Summary B', 'summary-b');

insert into public.circles (id, owner_id, content) values
  ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10', 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd01', '{"person_name":"Person A"}'::jsonb),
  ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd20', 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd02', '{"person_name":"Person B"}'::jsonb);
insert into public.circle_caregivers (circle_id, user_id, role) values
  ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10', 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd01', 'owner'),
  ('cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd20', 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd02', 'owner');

select set_config('request.jwt.claim.sub', 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd01', true);
select set_config('request.jwt.claims', '{"sub":"cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd01","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$update public.circles
    set content = '{"person_name":"Person A","allergies":["Penicillin"],"doctors":[{"name":"Dr. Patel"}],"emergency_contacts":[]}'::jsonb
    where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10'$$,
  'the owner adds allergies and a doctor after the circle started'
);
select is(
  (select content -> 'allergies' ->> 0 from public.circles where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10'),
  'Penicillin',
  'the new allergy is saved'
);
update public.circles set content = '{"person_name":"Changed"}'::jsonb where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd20';

reset role;
select is(
  (select content ->> 'person_name' from public.circles where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd20'),
  'Person B',
  'another caregiver cannot change a circle that is not theirs'
);

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
with changed as (
  update public.circles set content = '{"person_name":"Anon"}'::jsonb where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10' returning id
)
select is((select count(*)::int from changed), 0, 'a signed-out visitor changes no summary');
reset role;
select is(
  (select content ->> 'person_name' from public.circles where id = 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcd10'),
  'Person A',
  'the owner''s circle keeps its name'
);

select * from finish();
rollback;
