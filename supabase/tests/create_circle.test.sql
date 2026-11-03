-- create_circle runs as a signed-in caregiver, not as postgres.
-- Fixtures are fictional. The transaction rolls back.

begin;

select plan(25);

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

create function pg_temp.as_user(p_id uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_id::text, 'role', 'authenticated')::text,
    true
  );
end $$;

select pg_temp.seed_user('a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1', 'helen.owner@example.com', 'Helen Owner', 'create-circle-a');
select pg_temp.seed_user('b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2', 'sam.other@example.com', 'Sam Other', 'create-circle-b');

select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_circle'),
  true,
  'create_circle is security definer'
);
select is(
  (select p.proconfig[1] from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_circle'),
  'search_path=""',
  'create_circle sets an empty search_path'
);
select is(
  pg_get_function_identity_arguments('public.create_circle(jsonb,jsonb)'::regprocedure),
  'p_content jsonb, p_consents jsonb',
  'create_circle does not take owner_id or role'
);
select ok(
  not has_function_privilege('anon', 'public.create_circle(jsonb, jsonb)', 'execute'),
  'anon is not granted execute'
);
select ok(
  not has_function_privilege('public', 'public.create_circle(jsonb, jsonb)', 'execute'),
  'public is not granted execute'
);
select ok(
  has_function_privilege('authenticated', 'public.create_circle(jsonb, jsonb)', 'execute'),
  'authenticated is granted execute'
);
select ok(
  not has_function_privilege('service_role', 'public.create_circle(jsonb, jsonb)', 'execute'),
  'service_role is not granted execute'
);

create temp table created_circle (id uuid);
grant all on created_circle to public;

create function pg_temp.make_circle()
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
begin
  v_id := public.create_circle(
    jsonb_build_object(
      'person_name', 'Helen Ward',
      'owner_id', 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2'
    ),
    jsonb_build_array(
      jsonb_build_object(
        'type', 'authorized_to_share',
        'version', '2026-11-02',
        'text_hash', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        'user_id', 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2'
      ),
      jsonb_build_object(
        'type', 'terms',
        'version', '2026-11-02',
        'text_hash', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
      ),
      jsonb_build_object(
        'type', 'privacy',
        'version', '2026-11-02',
        'text_hash', 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
      )
    )
  );
  insert into created_circle (id) values (v_id);
  return v_id;
end $$;

select pg_temp.as_user('a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1');
set local role authenticated;

select lives_ok(
  'select pg_temp.make_circle()',
  'a signed-in caregiver creates a circle'
);

select is(
  (select count(*) from public.circles where id = (select id from created_circle))::int,
  1,
  'the creator can read the new circle'
);
select is(
  (select owner_id from public.circles where id = (select id from created_circle)),
  'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1'::uuid,
  'the circle is owned by the signed-in caregiver, not a payload owner_id'
);
select is(
  (select content->>'person_name' from public.circles where id = (select id from created_circle)),
  'Helen Ward',
  'the circle keeps the person name'
);
select is(
  (select count(*) from public.circle_caregivers where circle_id = (select id from created_circle))::int,
  1,
  'the creator can read their caregiver row'
);
select is(
  (select role from public.circle_caregivers where circle_id = (select id from created_circle)),
  'owner',
  'the caregiver row is the owner role'
);
select is(
  (select user_id from public.circle_caregivers where circle_id = (select id from created_circle)),
  'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1'::uuid,
  'the owner row is the signed-in caregiver'
);
select is(
  (select c.key_version = g.key_version and c.key_version = 1
     from public.circles c
     join public.circle_caregivers g on g.circle_id = c.id
    where c.id = (select id from created_circle)),
  true,
  'the owner row key version matches the circle'
);
select ok(
  (select circle_key_wrapped is null from public.circle_caregivers where circle_id = (select id from created_circle)),
  'creating a circle does not store a wrapped key'
);
select is(
  (select count(*) from public.consents
    where circle_id = (select id from created_circle)
      and user_id = 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1')::int,
  3,
  'consent rows belong to the signed-in caregiver'
);
select is(
  (select actor || ' ' || action from public.activity
    where circle_id = (select id from created_circle)
      and subject_id = (select id from created_circle)),
  'caregiver:a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1 circle_created',
  'activity records the creator'
);

select throws_ok(
  $$select public.create_circle('{"person_name":" "}', '[]'::jsonb)$$,
  'P0001',
  'circle content is not valid',
  'a blank name is rejected'
);
select is(
  (select count(*) from public.circles)::int,
  1,
  'a rejected create writes nothing'
);

select throws_ok(
  $$insert into public.circles (owner_id, content)
    values ('b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2', '{"person_name":"Someone Else"}'::jsonb)$$,
  '42501',
  'new row violates row-level security policy for table "circles"',
  'a caregiver cannot insert a circle owned by someone else'
);

reset role;
select pg_temp.as_user('b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2');
set local role authenticated;

select is(
  (select count(*) from public.circles where id = (select id from created_circle))::int,
  0,
  'a second caregiver cannot read the circle'
);
select is(
  (select count(*) from public.circle_caregivers where circle_id = (select id from created_circle))::int,
  0,
  'a second caregiver cannot read the owner row'
);

reset role;
set local role anon;

select throws_ok(
  $$select public.create_circle('{"person_name":"Helen Ward"}'::jsonb, '[]'::jsonb)$$,
  '42501',
  'permission denied for function create_circle',
  'anon cannot call create_circle'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);
set local role authenticated;

select throws_ok(
  $$select public.create_circle('{"person_name":"Helen Ward"}'::jsonb, '[]'::jsonb)$$,
  'P0001',
  'sign in to create a circle',
  'create_circle rejects a session with no user'
);

select * from finish();
rollback;
