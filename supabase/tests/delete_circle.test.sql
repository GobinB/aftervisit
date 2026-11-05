-- Only the owner deletes a circle, and deleting it turns off every helper link.
-- Fixtures are fictional. The transaction rolls back.

begin;

select plan(14);

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

select pg_temp.seed_user('d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1', 'owner.delete@example.com', 'Owner Delete', 'delete-circle-a');
select pg_temp.seed_user('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2', 'stranger.delete@example.com', 'Stranger Delete', 'delete-circle-b');
select pg_temp.seed_user('d3d3d3d3-d3d3-43d3-83d3-d3d3d3d3d3d3', 'other.delete@example.com', 'Other Delete', 'delete-circle-c');

insert into public.circles (id, owner_id, content)
values ('d0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0', 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1', '{"person_name":"Fictional Delete"}');
insert into public.circle_caregivers (circle_id, user_id, role) values
  ('d0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0', 'd1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1', 'owner');
insert into public.members (id, circle_id, name, role, token_hash, expires_at, revoked_at) values
  ('d4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d4d1', 'd0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0', 'Fiction Family', 'family', 'delete-test-hash-family-0000000000000', now() + interval '90 days', null),
  ('d4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d4d2', 'd0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0', 'Fiction Aide', 'home_aide', 'delete-test-hash-aide-00000000000000', now() + interval '90 days', null),
  ('d4d4d4d4-d4d4-44d4-84d4-d4d4d4d4d4d3', 'd0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0', 'Fiction Earlier', 'day_program', 'delete-test-hash-earlier-000000000000', now() + interval '90 days', '2026-01-01');

select is(
  (select prosecdef from pg_proc where oid = 'public.delete_circle(uuid)'::regprocedure),
  true,
  'delete_circle is security definer'
);
select is(
  (select proconfig[1] from pg_proc where oid = 'public.delete_circle(uuid)'::regprocedure),
  'search_path=""',
  'delete_circle sets an empty search_path'
);
select ok(not has_function_privilege('anon', 'public.delete_circle(uuid)', 'execute'), 'anon is not granted execute');
select ok(not has_function_privilege('public', 'public.delete_circle(uuid)', 'execute'), 'public is not granted execute');
select ok(has_function_privilege('authenticated', 'public.delete_circle(uuid)', 'execute'), 'authenticated is granted execute');

select pg_temp.as_user('d2d2d2d2-d2d2-42d2-82d2-d2d2d2d2d2d2');
set local role authenticated;
select throws_ok(
  $$select public.delete_circle('d0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0')$$,
  'P0001',
  'only the owner can delete a circle',
  'a signed-in stranger cannot delete the circle'
);
reset role;

select pg_temp.as_user('d3d3d3d3-d3d3-43d3-83d3-d3d3d3d3d3d3');
set local role authenticated;
select throws_ok(
  $$select public.delete_circle('d0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0')$$,
  'P0001',
  'only the owner can delete a circle',
  'another caregiver cannot delete the circle'
);
reset role;

-- The plain update the app used before this function. It must still fail.
select pg_temp.as_user('d1d1d1d1-d1d1-41d1-81d1-d1d1d1d1d1d1');
set local role authenticated;
select throws_ok(
  $$update public.circles set deleted_at = now() where id = 'd0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0' and deleted_at is null$$,
  '42501',
  null,
  'a plain update cannot mark the circle deleted'
);
select lives_ok(
  $$select public.delete_circle('d0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0')$$,
  'the owner deletes the circle'
);
select is((select count(*) from public.circles where id = 'd0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0')::int, 0, 'the owner no longer sees the circle');
select throws_ok(
  $$select public.delete_circle('d0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0')$$,
  'P0001',
  'that circle was not found',
  'a deleted circle cannot be deleted again'
);
reset role;

select ok(
  (select deleted_at is not null from public.circles where id = 'd0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0'),
  'the circle is marked deleted'
);
select is(
  (select count(*) from public.members where circle_id = 'd0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0' and revoked_at is null)::int,
  0,
  'every helper link is turned off'
);
select is(
  (select count(*) from public.activity where circle_id = 'd0d0d0d0-d0d0-40d0-80d0-d0d0d0d0d0d0' and action = 'circle_deleted')::int,
  1,
  'one circle_deleted activity row'
);

select * from finish();
rollback;
