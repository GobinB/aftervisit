-- To-dos: one circle never reads or changes another's to-dos, a to-do stays in its circle,
-- and its person must be on that circle. Fixtures are fictional. Rolls back.

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

select pg_temp.seed_user('ffffffff-ffff-4fff-8fff-fffffffffff1', 'todos.a@example.com', 'Todos A', 'todos-a');
select pg_temp.seed_user('ffffffff-ffff-4fff-8fff-fffffffffff2', 'todos.b@example.com', 'Todos B', 'todos-b');

insert into public.circles (id, owner_id, content) values
  ('ffffffff-ffff-4fff-8fff-ffffffffff10', 'ffffffff-ffff-4fff-8fff-fffffffffff1', '{"person_name":"Person A"}'::jsonb),
  ('ffffffff-ffff-4fff-8fff-ffffffffff20', 'ffffffff-ffff-4fff-8fff-fffffffffff2', '{"person_name":"Person B"}'::jsonb);
insert into public.circle_caregivers (circle_id, user_id, role) values
  ('ffffffff-ffff-4fff-8fff-ffffffffff10', 'ffffffff-ffff-4fff-8fff-fffffffffff1', 'owner'),
  ('ffffffff-ffff-4fff-8fff-ffffffffff20', 'ffffffff-ffff-4fff-8fff-fffffffffff2', 'owner');
insert into public.members (id, circle_id, name, role, token_hash, expires_at) values
  ('ffffffff-ffff-4fff-8fff-ffffffffff11', 'ffffffff-ffff-4fff-8fff-ffffffffff10', 'Aide A', 'home_aide', 'todos-hash-a', now() + interval '90 days'),
  ('ffffffff-ffff-4fff-8fff-ffffffffff21', 'ffffffff-ffff-4fff-8fff-ffffffffff20', 'Aide B', 'home_aide', 'todos-hash-b', now() + interval '90 days');
insert into public.todos (id, circle_id, title, assignee_member_id) values
  ('ffffffff-ffff-4fff-8fff-ffffffffff22', 'ffffffff-ffff-4fff-8fff-ffffffffff20', 'Call the pharmacy', 'ffffffff-ffff-4fff-8fff-ffffffffff21');

select set_config('request.jwt.claim.sub', 'ffffffff-ffff-4fff-8fff-fffffffffff1', true);
select set_config('request.jwt.claims', '{"sub":"ffffffff-ffff-4fff-8fff-fffffffffff1","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$insert into public.todos (id, circle_id, title, assignee_member_id, due_date)
    values ('ffffffff-ffff-4fff-8fff-ffffffffff12', 'ffffffff-ffff-4fff-8fff-ffffffffff10', 'Book the eye exam', 'ffffffff-ffff-4fff-8fff-ffffffffff11', current_date + 7)$$,
  'the caregiver adds a to-do for someone on their circle'
);
select is((select count(*) from public.todos where circle_id = 'ffffffff-ffff-4fff-8fff-ffffffffff20')::int, 0, 'A cannot read B to-dos');
select throws_ok(
  $$insert into public.todos (circle_id, title) values ('ffffffff-ffff-4fff-8fff-ffffffffff20', 'Planted')$$,
  '42501',
  'new row violates row-level security policy for table "todos"',
  'A cannot add to B'
);
select throws_ok(
  $$insert into public.todos (circle_id, title, assignee_member_id) values ('ffffffff-ffff-4fff-8fff-ffffffffff10', 'Borrowed helper', 'ffffffff-ffff-4fff-8fff-ffffffffff21')$$,
  'P0001',
  'that person is not on this circle',
  'a to-do cannot go to a person on another circle'
);
select throws_ok(
  $$update public.todos set circle_id = 'ffffffff-ffff-4fff-8fff-ffffffffff20' where id = 'ffffffff-ffff-4fff-8fff-ffffffffff12'$$,
  'P0001',
  'a to-do cannot move to another circle',
  'a to-do cannot move to another circle'
);
select throws_ok(
  $$insert into public.todos (circle_id, title, assignee_member_id, assigned_to_caregiver) values ('ffffffff-ffff-4fff-8fff-ffffffffff10', 'Two owners', 'ffffffff-ffff-4fff-8fff-ffffffffff11', true)$$,
  '23514',
  'new row for relation "todos" violates check constraint "todos_one_assignee"',
  'a to-do has one owner at most'
);
select throws_ok(
  $$update public.todos set status = 'done' where id = 'ffffffff-ffff-4fff-8fff-ffffffffff12'$$,
  '23514',
  'new row for relation "todos" violates check constraint "todos_done_fields"',
  'a done to-do records when'
);
update public.todos set title = 'Changed by A' where id = 'ffffffff-ffff-4fff-8fff-ffffffffff22';
delete from public.todos where id = 'ffffffff-ffff-4fff-8fff-ffffffffff22';
update public.todos set status = 'done', done_at = now(), done_by = 'caregiver:ffffffff-ffff-4fff-8fff-fffffffffff1' where id = 'ffffffff-ffff-4fff-8fff-ffffffffff12';
reset role;

select is((select title from public.todos where id = 'ffffffff-ffff-4fff-8fff-ffffffffff22'), 'Call the pharmacy', 'A cannot change B to-dos');
select is((select count(*) from public.todos where id = 'ffffffff-ffff-4fff-8fff-ffffffffff22')::int, 1, 'A cannot delete B to-dos');
select is((select status from public.todos where id = 'ffffffff-ffff-4fff-8fff-ffffffffff12'), 'done', 'the caregiver marks a to-do done');

delete from public.members where id = 'ffffffff-ffff-4fff-8fff-ffffffffff11';
select is((select assignee_member_id from public.todos where id = 'ffffffff-ffff-4fff-8fff-ffffffffff12'), null::uuid, 'removing a person leaves their to-dos unassigned');

select * from finish();
rollback;
