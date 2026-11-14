-- The circle key All Hands Care keeps (migration 0017). The stored key sits on the caregiver's own
-- row: another caregiver and a signed-out visitor can neither read nor write it, and people with a
-- link have no database identity at all. "Start fresh" (reset_own_circle_key) is the owner's alone,
-- removes only the encrypted summaries, and is refused for a circle whose key is held.
-- Fixtures are fictional. The transaction rolls back.

begin;

select plan(27);

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

-- Caregiver A owns circle 10, caregiver B owns circle 20.
select pg_temp.seed_user('abababab-abab-4bab-8bab-ababababab01', 'held.a@example.com', 'Held A', 'held-a');
select pg_temp.seed_user('abababab-abab-4bab-8bab-ababababab02', 'held.b@example.com', 'Held B', 'held-b');

insert into public.circles (id, owner_id, content) values
  ('abababab-abab-4bab-8bab-ababababab10', 'abababab-abab-4bab-8bab-ababababab01', '{"person_name":"Person A"}'::jsonb),
  ('abababab-abab-4bab-8bab-ababababab20', 'abababab-abab-4bab-8bab-ababababab02', '{"person_name":"Person B"}'::jsonb);
insert into public.circle_caregivers (circle_id, user_id, role) values
  ('abababab-abab-4bab-8bab-ababababab10', 'abababab-abab-4bab-8bab-ababababab01', 'owner'),
  ('abababab-abab-4bab-8bab-ababababab20', 'abababab-abab-4bab-8bab-ababababab02', 'owner');
insert into public.members (id, circle_id, name, role, token_hash, expires_at) values
  ('abababab-abab-4bab-8bab-ababababab11', 'abababab-abab-4bab-8bab-ababababab10', 'Aide A', 'home_aide', 'held-hash-aaaaaaaaaaaaaaaaaaaaaaaaaaaa', now() + interval '90 days');

-- Circle 10 as it was before 0017: a key wrapped by recovery words (av1), one encrypted summary,
-- one plain summary from before files were encrypted, and the rest of the circle's content.
update public.circle_caregivers
   set circle_key_wrapped = 'av1.600000.' || repeat('a', 22) || '.' || repeat('b', 16) || '.' || repeat('c', 64)
 where circle_id = 'abababab-abab-4bab-8bab-ababababab10';
insert into public.visit_documents (id, circle_id, kind, page_count, paths, created_by, key_version, file_key_wrapped, file_key_iv) values
  ('abababab-abab-4bab-8bab-ababababab12', 'abababab-abab-4bab-8bab-ababababab10', 'photos', 2,
   array['abababab-abab-4bab-8bab-ababababab10/abababab-abab-4bab-8bab-ababababab12/1.enc', 'abababab-abab-4bab-8bab-ababababab10/abababab-abab-4bab-8bab-ababababab12/2.enc'],
   'abababab-abab-4bab-8bab-ababababab01', 1, repeat('A', 64), repeat('C', 16));
insert into public.visit_documents (id, circle_id, kind, page_count, paths, created_by) values
  ('abababab-abab-4bab-8bab-ababababab13', 'abababab-abab-4bab-8bab-ababababab10', 'photos', 1,
   array['abababab-abab-4bab-8bab-ababababab10/abababab-abab-4bab-8bab-ababababab13/1.jpg'], 'abababab-abab-4bab-8bab-ababababab01');
insert into public.medications (circle_id, name) values ('abababab-abab-4bab-8bab-ababababab10', 'Metformin');
insert into public.todos (circle_id, title) values ('abababab-abab-4bab-8bab-ababababab10', 'Call the clinic');
insert into public.events (circle_id, title, event_date) values ('abababab-abab-4bab-8bab-ababababab10', 'Follow-up visit', '2026-12-01');

-- Caregiver B: a stranger to circle 10.
select pg_temp.act_as('abababab-abab-4bab-8bab-ababababab02');
set local role authenticated;

select is(
  (select count(*)::int from public.circle_caregivers where circle_id = 'abababab-abab-4bab-8bab-ababababab10'),
  0,
  'another caregiver cannot read a circle''s stored key'
);
update public.circle_caregivers
   set circle_key_wrapped = 'av2.' || repeat('x', 16) || '.' || repeat('y', 64)
 where circle_id = 'abababab-abab-4bab-8bab-ababababab10';
select throws_ok(
  $$select public.reset_own_circle_key('abababab-abab-4bab-8bab-ababababab10', 'av2.' || repeat('x', 16) || '.' || repeat('y', 64), 2)$$,
  'P0001', 'only the owner can change the circle key',
  'another caregiver cannot start a circle fresh'
);
select lives_ok(
  $$update public.circle_caregivers
       set circle_key_wrapped = 'av2.' || repeat('d', 16) || '.' || repeat('e', 64)
     where circle_id = 'abababab-abab-4bab-8bab-ababababab20'$$,
  'a caregiver stores the new form of key on their own row'
);

reset role;
select is(
  (select circle_key_wrapped from public.circle_caregivers where circle_id = 'abababab-abab-4bab-8bab-ababababab10'),
  'av1.600000.' || repeat('a', 22) || '.' || repeat('b', 16) || '.' || repeat('c', 64),
  'another caregiver cannot write a circle''s stored key'
);
select is((select count(*)::int from public.visit_documents where circle_id = 'abababab-abab-4bab-8bab-ababababab10'), 2, 'and removed none of its summaries');

-- Signed out.
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select circle_key_wrapped from public.circle_caregivers$$, '42501', null, 'a signed-out visitor cannot read stored keys');
select throws_ok(
  $$select public.reset_own_circle_key('abababab-abab-4bab-8bab-ababababab10', 'av2.' || repeat('x', 16) || '.' || repeat('y', 64), 2)$$,
  '42501', null, 'a signed-out visitor cannot start a circle fresh'
);
reset role;

-- People with a link reach the database only through the app's server role, which cannot run it either.
set local role service_role;
select throws_ok(
  $$select public.reset_own_circle_key('abababab-abab-4bab-8bab-ababababab10', 'av2.' || repeat('x', 16) || '.' || repeat('y', 64), 2)$$,
  '42501', null, 'the server role cannot start a circle fresh'
);
reset role;

-- Caregiver A, the owner of circle 10.
select pg_temp.act_as('abababab-abab-4bab-8bab-ababababab01');
set local role authenticated;

select throws_ok(
  $$update public.circle_caregivers set circle_key_wrapped = 'av2.short.short' where circle_id = 'abababab-abab-4bab-8bab-ababababab10'$$,
  'P0001', 'wrapped key is not valid', 'a stored key must have the right shape'
);
select throws_ok(
  $$update public.circle_caregivers set circle_key_wrapped = repeat('k', 43) where circle_id = 'abababab-abab-4bab-8bab-ababababab10'$$,
  'P0001', 'wrapped key is not valid', 'a raw key cannot be stored'
);
select throws_ok(
  $$select public.reset_own_circle_key('abababab-abab-4bab-8bab-ababababab10', 'av1.600000.' || repeat('a', 22) || '.' || repeat('b', 16) || '.' || repeat('c', 64), 2)$$,
  'P0001', 'stored key is not valid', 'starting fresh never stores a key wrapped by words'
);
select throws_ok(
  $$select public.reset_own_circle_key('abababab-abab-4bab-8bab-ababababab10', 'av2.' || repeat('x', 16) || '.' || repeat('y', 64), 3)$$,
  'P0001', 'key version moves forward one step', 'starting fresh moves the key version one step'
);
select throws_ok(
  $$select public.reset_own_circle_key('abababab-abab-4bab-8bab-ababababab20', 'av2.' || repeat('x', 16) || '.' || repeat('y', 64), 2)$$,
  'P0001', 'only the owner can change the circle key', 'the owner of one circle cannot start another fresh'
);
select is((select count(*)::int from public.visit_documents where circle_id = 'abababab-abab-4bab-8bab-ababababab10'), 2, 'a refused start leaves every summary');

-- A device that still had the key handed it over: the row now holds the new form at the same version.
select lives_ok(
  $$update public.circle_caregivers
       set circle_key_wrapped = 'av2.' || repeat('f', 16) || '.' || repeat('g', 64)
     where circle_id = 'abababab-abab-4bab-8bab-ababababab10'$$,
  'the owner replaces a key wrapped by words with a held key'
);
select throws_ok(
  $$select public.reset_own_circle_key('abababab-abab-4bab-8bab-ababababab10', 'av2.' || repeat('x', 16) || '.' || repeat('y', 64), 2)$$,
  'P0001', 'the key for this circle is held', 'a circle whose key is held cannot be started fresh'
);
select is((select count(*)::int from public.visit_documents where circle_id = 'abababab-abab-4bab-8bab-ababababab10'), 2, 'so its summaries stay');

-- Back to a key wrapped by words nobody has, and start fresh.
update public.circle_caregivers
   set circle_key_wrapped = 'av1.600000.' || repeat('a', 22) || '.' || repeat('b', 16) || '.' || repeat('c', 64)
 where circle_id = 'abababab-abab-4bab-8bab-ababababab10';
select set_eq(
  $$select unnest(public.reset_own_circle_key('abababab-abab-4bab-8bab-ababababab10', 'av2.' || repeat('x', 16) || '.' || repeat('y', 64), 2))$$,
  $$values ('abababab-abab-4bab-8bab-ababababab10/abababab-abab-4bab-8bab-ababababab12/1.enc'), ('abababab-abab-4bab-8bab-ababababab10/abababab-abab-4bab-8bab-ababababab12/2.enc')$$,
  'starting fresh returns the files of the summaries it removed'
);
select is(
  (select string_agg(id::text, ',') from public.visit_documents where circle_id = 'abababab-abab-4bab-8bab-ababababab10'),
  'abababab-abab-4bab-8bab-ababababab13',
  'the encrypted summary is gone and the plain one from before is kept'
);
select is((select key_version from public.circles where id = 'abababab-abab-4bab-8bab-ababababab10'), 2, 'the circle key version moved forward');
select is(
  (select key_version::text || ' ' || circle_key_wrapped from public.circle_caregivers where circle_id = 'abababab-abab-4bab-8bab-ababababab10'),
  '2 av2.' || repeat('x', 16) || '.' || repeat('y', 64),
  'and the new key is stored at that version'
);
select is(
  (select (select count(*) from public.medications where circle_id = 'abababab-abab-4bab-8bab-ababababab10')::text
       || ' ' || (select count(*) from public.todos where circle_id = 'abababab-abab-4bab-8bab-ababababab10')::text
       || ' ' || (select count(*) from public.events where circle_id = 'abababab-abab-4bab-8bab-ababababab10')::text),
  '1 1 1',
  'medications, reminders and the calendar are untouched'
);
select lives_ok(
  $$insert into public.visit_documents (circle_id, kind, page_count, key_version, file_key_wrapped, file_key_iv)
    values ('abababab-abab-4bab-8bab-ababababab10', 'photos', 1, 2, repeat('B', 64), repeat('D', 16))$$,
  'a new summary is kept under the new key'
);
select throws_ok(
  $$update public.circles set key_version = key_version + 1 where id = 'abababab-abab-4bab-8bab-ababababab10'$$,
  'P0001', 'key version changes only when the circle key is rotated',
  'the key version still cannot be moved by hand afterwards'
);
reset role;

select is(
  (select token_hash from public.members where id = 'abababab-abab-4bab-8bab-ababababab11'),
  'held-hash-aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  'starting fresh leaves every person''s link as it was'
);
select is(
  (select count(*)::int from public.activity where circle_id = 'abababab-abab-4bab-8bab-ababababab10' and action = 'circle_key_reset'),
  1,
  'and is written to the circle''s activity'
);
select is(
  (select circle_key_wrapped from public.circle_caregivers where circle_id = 'abababab-abab-4bab-8bab-ababababab20'),
  'av2.' || repeat('d', 16) || '.' || repeat('e', 64),
  'another circle''s key is untouched throughout'
);

select * from finish();
rollback;
