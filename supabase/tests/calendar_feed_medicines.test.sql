-- Medicines in the calendar link (0023): each link carries medicines unless its caregiver turns
-- them off. Only the circle's caregiver can change the setting. Fictional. Rolls back.

begin;

select plan(9);

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

select pg_temp.seed_user('fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfbfb01', 'meds.a@example.com', 'Meds A', 'meds-a');
select pg_temp.seed_user('fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfbfb02', 'meds.b@example.com', 'Meds B', 'meds-b');

insert into public.circles (id, owner_id, content) values
  ('fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfbfb10', 'fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfbfb01', '{"person_name":"Person A"}'::jsonb),
  ('fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfbfb20', 'fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfbfb02', '{"person_name":"Person B"}'::jsonb);
insert into public.circle_caregivers (circle_id, user_id, role) values
  ('fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfbfb10', 'fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfbfb01', 'owner'),
  ('fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfbfb20', 'fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfbfb02', 'owner');
-- Made the way links were made before 0023: no setting given.
insert into public.calendar_feeds (circle_id, token, created_by) values
  ('fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfbfb20', 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', 'fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfbfb02');

select has_column('public', 'calendar_feeds', 'include_medicines', 'calendar links have a medicines setting');
select col_type_is('public', 'calendar_feeds', 'include_medicines', 'boolean', 'the setting is yes or no');
select col_not_null('public', 'calendar_feeds', 'include_medicines', 'the setting is never empty');
select col_default_is('public', 'calendar_feeds', 'include_medicines', 'true', 'medicines are on by default');
select is(
  (select include_medicines from public.calendar_feeds where circle_id = 'fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfbfb20'),
  true, 'a link made without the setting carries medicines'
);

select set_config('request.jwt.claim.sub', 'fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfbfb01', true);
select set_config('request.jwt.claims', '{"sub":"fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfbfb01","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$insert into public.calendar_feeds (circle_id, token, include_medicines) values ('fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfbfb10', 'ffffffffffffffffffffffffffffffffffffffffffff', false)$$,
  'the caregiver can turn on a link with medicines left out'
);
with changed as (
  update public.calendar_feeds set include_medicines = true where circle_id = 'fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfbfb10' returning include_medicines
)
select is((select include_medicines from changed), true, 'the caregiver can put medicines back in');
with changed as (
  update public.calendar_feeds set include_medicines = false where circle_id = 'fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfbfb20' returning circle_id
)
select is((select count(*)::int from changed), 0, 'another caregiver cannot change the setting');

reset role;
select is(
  (select include_medicines from public.calendar_feeds where circle_id = 'fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfbfb20'),
  true, 'the other circle''s setting is unchanged'
);

select * from finish();
rollback;
