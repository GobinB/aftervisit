-- Calendar links: only the circle's caregiver can make, read, replace or turn off the circle's
-- private calendar link. Another caregiver and a signed-out visitor cannot. One link per circle,
-- and it goes when the circle is erased. Fictional. Rolls back.

begin;

select plan(8);

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

select pg_temp.seed_user('fafafafa-fafa-4afa-8afa-fafafafafa01', 'feed.a@example.com', 'Feed A', 'feed-a');
select pg_temp.seed_user('fafafafa-fafa-4afa-8afa-fafafafafa02', 'feed.b@example.com', 'Feed B', 'feed-b');

insert into public.circles (id, owner_id, content) values
  ('fafafafa-fafa-4afa-8afa-fafafafafa10', 'fafafafa-fafa-4afa-8afa-fafafafafa01', '{"person_name":"Person A"}'::jsonb),
  ('fafafafa-fafa-4afa-8afa-fafafafafa20', 'fafafafa-fafa-4afa-8afa-fafafafafa02', '{"person_name":"Person B"}'::jsonb);
insert into public.circle_caregivers (circle_id, user_id, role) values
  ('fafafafa-fafa-4afa-8afa-fafafafafa10', 'fafafafa-fafa-4afa-8afa-fafafafafa01', 'owner'),
  ('fafafafa-fafa-4afa-8afa-fafafafafa20', 'fafafafa-fafa-4afa-8afa-fafafafafa02', 'owner');
insert into public.calendar_feeds (circle_id, token, created_by) values
  ('fafafafa-fafa-4afa-8afa-fafafafafa20', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'fafafafa-fafa-4afa-8afa-fafafafafa02');

select set_config('request.jwt.claim.sub', 'fafafafa-fafa-4afa-8afa-fafafafafa01', true);
select set_config('request.jwt.claims', '{"sub":"fafafafa-fafa-4afa-8afa-fafafafafa01","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$insert into public.calendar_feeds (circle_id, token) values ('fafafafa-fafa-4afa-8afa-fafafafafa10', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')$$,
  'the caregiver turns on the calendar link'
);
select throws_ok(
  $$insert into public.calendar_feeds (circle_id, token) values ('fafafafa-fafa-4afa-8afa-fafafafafa10', 'cccccccccccccccccccccccccccccccccccccccccccc')$$,
  '23505', null, 'one link per circle'
);
select throws_ok(
  $$insert into public.calendar_feeds (circle_id, token) values ('fafafafa-fafa-4afa-8afa-fafafafafa10', 'short')$$,
  null, null, 'a token must be long and plain'
);
select is((select count(*)::int from public.calendar_feeds), 1, 'another circle''s link stays hidden');
select throws_ok(
  $$insert into public.calendar_feeds (circle_id, token) values ('fafafafa-fafa-4afa-8afa-fafafafafa20', 'dddddddddddddddddddddddddddddddddddddddddddd')$$,
  '42501', null, 'cannot make a link for another circle'
);
with gone as (delete from public.calendar_feeds where circle_id = 'fafafafa-fafa-4afa-8afa-fafafafafa20' returning circle_id)
select is((select count(*)::int from gone), 0, 'cannot turn off another circle''s link');

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select token from public.calendar_feeds$$, '42501', null, 'a signed-out visitor cannot read any link');

reset role;
delete from public.circles where id = 'fafafafa-fafa-4afa-8afa-fafafafafa20';
select is((select count(*)::int from public.calendar_feeds where circle_id = 'fafafafa-fafa-4afa-8afa-fafafafafa20'), 0, 'erasing a circle erases its link');

select * from finish();
rollback;
