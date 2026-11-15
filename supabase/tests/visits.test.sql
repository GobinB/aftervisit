-- Visit notes (migration 0021): only the circle's caregiver can read, add, change or delete them;
-- another caregiver and a signed-out visitor cannot. A visit stays in its circle, goes when its
-- circle is erased, and deleting it leaves the kept photos. Fictional. Rolls back.

begin;

select plan(21);

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

select pg_temp.seed_user('abababab-abab-4bab-8bab-abababababa1', 'visits.a@example.com', 'Visits A', 'visits-a');
select pg_temp.seed_user('abababab-abab-4bab-8bab-abababababa2', 'visits.b@example.com', 'Visits B', 'visits-b');

insert into public.circles (id, owner_id, content) values
  ('abababab-abab-4bab-8bab-ababababab10', 'abababab-abab-4bab-8bab-abababababa1', '{"person_name":"Person A"}'::jsonb),
  ('abababab-abab-4bab-8bab-ababababab20', 'abababab-abab-4bab-8bab-abababababa2', '{"person_name":"Person B"}'::jsonb);
insert into public.circle_caregivers (circle_id, user_id, role) values
  ('abababab-abab-4bab-8bab-ababababab10', 'abababab-abab-4bab-8bab-abababababa1', 'owner'),
  ('abababab-abab-4bab-8bab-ababababab20', 'abababab-abab-4bab-8bab-abababababa2', 'owner');
insert into public.visits (id, circle_id, visit_date, content, created_by) values
  ('abababab-abab-4bab-8bab-ababababab22', 'abababab-abab-4bab-8bab-ababababab20', '2026-11-04',
   '{"summary":"Seen for dizziness.","watchFor":["Fainting"],"goodToKnow":[],"questions":[]}'::jsonb,
   'abababab-abab-4bab-8bab-abababababa2');

select pg_temp.act_as('abababab-abab-4bab-8bab-abababababa1');
set local role authenticated;

select lives_ok(
  $$insert into public.visits (id, circle_id, visit_date, content)
    values ('abababab-abab-4bab-8bab-ababababab12', 'abababab-abab-4bab-8bab-ababababab10', '2026-11-05',
            '{"summary":"Blood pressure check.","watchFor":["Swelling in the ankles"],"goodToKnow":["Avoid caffeine"],"questions":["Is the new dose working?"]}'::jsonb)$$,
  'the caregiver saves visit notes in their circle'
);
select is((select count(*)::int from public.visits where circle_id = 'abababab-abab-4bab-8bab-ababababab10'), 1, 'and can read them');
select is(
  (select created_by from public.visits where id = 'abababab-abab-4bab-8bab-ababababab12'),
  'abababab-abab-4bab-8bab-abababababa1'::uuid,
  'the notes record who saved them'
);
select is((select count(*)::int from public.visits where circle_id = 'abababab-abab-4bab-8bab-ababababab20'), 0, 'another circle''s visit notes stay hidden');
select throws_ok(
  $$insert into public.visits (circle_id, content) values ('abababab-abab-4bab-8bab-ababababab20', '{}'::jsonb)$$,
  '42501', null, 'cannot save visit notes into another circle'
);
select throws_ok(
  $$insert into public.visits (circle_id, content, created_by)
    values ('abababab-abab-4bab-8bab-ababababab10', '{}'::jsonb, 'abababab-abab-4bab-8bab-abababababa2')$$,
  '42501', null, 'cannot save visit notes in someone else''s name'
);
select throws_ok(
  $$insert into public.visits (circle_id, content) values ('abababab-abab-4bab-8bab-ababababab10', '["a list"]'::jsonb)$$,
  '23514', null, 'the notes must be an object'
);
select throws_ok(
  $$insert into public.visits (circle_id, content)
    values ('abababab-abab-4bab-8bab-ababababab10', jsonb_build_object('summary', repeat('x', 61000)))$$,
  '23514', null, 'the notes have a size limit'
);
select lives_ok(
  $$update public.visits set content = content || '{"goodToKnow":["Avoid caffeine","Low-salt diet"]}'::jsonb
    where id = 'abababab-abab-4bab-8bab-ababababab12'$$,
  'the caregiver can fix the notes'
);
select is(
  (select jsonb_array_length(content -> 'goodToKnow') from public.visits where id = 'abababab-abab-4bab-8bab-ababababab12'),
  2,
  'and the fix is kept'
);
select throws_ok(
  $$update public.visits set circle_id = 'abababab-abab-4bab-8bab-ababababab20' where id = 'abababab-abab-4bab-8bab-ababababab12'$$,
  null, null, 'a visit cannot move to another circle'
);
with changed as (
  update public.visits set content = '{}'::jsonb where id = 'abababab-abab-4bab-8bab-ababababab22' returning id
)
select is((select count(*)::int from changed), 0, 'cannot change another circle''s visit notes');
with gone as (delete from public.visits where id = 'abababab-abab-4bab-8bab-ababababab22' returning id)
select is((select count(*)::int from gone), 0, 'cannot delete another circle''s visit notes');

-- New visit notes are recorded as a change, so the caregiver is asked to tell people.
select is(
  (select count(*)::int from public.circle_updates where circle_id = 'abababab-abab-4bab-8bab-ababababab10' and area = 'visits'),
  1,
  'saving visit notes is recorded as a change to tell people about'
);

-- The kept photos point at the visit; they stay when the notes are deleted.
select lives_ok(
  $$insert into public.visit_documents (id, circle_id, kind, page_count, visit_id)
    values ('abababab-abab-4bab-8bab-ababababab13', 'abababab-abab-4bab-8bab-ababababab10', 'photos', 2, 'abababab-abab-4bab-8bab-ababababab12')$$,
  'kept photos can point at their visit'
);
select throws_ok(
  $$insert into public.visit_documents (circle_id, kind, page_count, visit_id)
    values ('abababab-abab-4bab-8bab-ababababab10', 'photos', 1, 'abababab-abab-4bab-8bab-ababababab22')$$,
  null, 'that visit is not in this circle', 'kept photos cannot point at another circle''s visit'
);
select lives_ok(
  $$delete from public.visits where id = 'abababab-abab-4bab-8bab-ababababab12'$$,
  'the caregiver can delete the notes'
);
select is(
  (select visit_id from public.visit_documents where id = 'abababab-abab-4bab-8bab-ababababab13'),
  null::uuid,
  'and the kept photos stay, no longer pointing at them'
);
reset role;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select count(*) from public.visits$$, '42501', null, 'a signed-out visitor cannot read visit notes');
reset role;

delete from public.circles where id = 'abababab-abab-4bab-8bab-ababababab20';
select is((select count(*)::int from public.visits where id = 'abababab-abab-4bab-8bab-ababababab22'), 0, 'erasing a circle erases its visit notes');

select ok(
  not has_function_privilege('authenticated', 'public.visits_guard()', 'execute')
  and not has_function_privilege('authenticated', 'public.visit_documents_visit_in_circle()', 'execute'),
  'nobody can call the guard functions directly'
);

select * from finish();
rollback;
