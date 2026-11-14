-- Saved after-visit summaries: only the circle's caregiver can see, add or delete them; another
-- caregiver, a signed-out visitor and anyone with a link cannot. A saved summary stays in its circle,
-- and goes when its circle is erased. Fictional. Rolls back.

begin;

select plan(12);

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

select pg_temp.seed_user('efefefef-efef-4fef-8fef-efefefefef01', 'docs.a@example.com', 'Docs A', 'docs-a');
select pg_temp.seed_user('efefefef-efef-4fef-8fef-efefefefef02', 'docs.b@example.com', 'Docs B', 'docs-b');

insert into public.circles (id, owner_id, content) values
  ('efefefef-efef-4fef-8fef-efefefefef10', 'efefefef-efef-4fef-8fef-efefefefef01', '{"person_name":"Person A"}'::jsonb),
  ('efefefef-efef-4fef-8fef-efefefefef20', 'efefefef-efef-4fef-8fef-efefefefef02', '{"person_name":"Person B"}'::jsonb);
insert into public.circle_caregivers (circle_id, user_id, role) values
  ('efefefef-efef-4fef-8fef-efefefefef10', 'efefefef-efef-4fef-8fef-efefefefef01', 'owner'),
  ('efefefef-efef-4fef-8fef-efefefefef20', 'efefefef-efef-4fef-8fef-efefefefef02', 'owner');
insert into public.visit_documents (id, circle_id, visit_date, clinic, kind, page_count, created_by) values
  ('efefefef-efef-4fef-8fef-efefefefef22', 'efefefef-efef-4fef-8fef-efefefefef20', '2026-11-04', 'Maplewood Family Clinic', 'photos', 3, 'efefefef-efef-4fef-8fef-efefefefef02');

select set_config('request.jwt.claim.sub', 'efefefef-efef-4fef-8fef-efefefefef01', true);
select set_config('request.jwt.claims', '{"sub":"efefefef-efef-4fef-8fef-efefefefef01","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$insert into public.visit_documents (id, circle_id, visit_date, clinic, kind, page_count)
    values ('efefefef-efef-4fef-8fef-efefefefef12', 'efefefef-efef-4fef-8fef-efefefefef10', '2026-11-05', 'Riverbend Clinic', 'photos', 2)$$,
  'the caregiver saves a visit summary in their circle'
);
select is((select count(*)::int from public.visit_documents where circle_id = 'efefefef-efef-4fef-8fef-efefefefef10'), 1, 'and can see it');
select is((select count(*)::int from public.visit_documents where circle_id = 'efefefef-efef-4fef-8fef-efefefefef20'), 0, 'another circle''s summaries stay hidden');
select throws_ok(
  $$insert into public.visit_documents (circle_id, kind) values ('efefefef-efef-4fef-8fef-efefefefef20', 'photos')$$,
  '42501', null, 'cannot save into another circle'
);
select throws_ok(
  $$update public.visit_documents set circle_id = 'efefefef-efef-4fef-8fef-efefefefef20' where id = 'efefefef-efef-4fef-8fef-efefefefef12'$$,
  null, null, 'a saved summary cannot move to another circle'
);
with gone as (delete from public.visit_documents where id = 'efefefef-efef-4fef-8fef-efefefefef22' returning id)
select is((select count(*)::int from gone), 0, 'cannot delete another circle''s summary');

-- Encrypted summaries: the row holds the wrapped file key, at the circle's key version.
select lives_ok(
  $$insert into public.visit_documents (id, circle_id, kind, page_count, key_version, file_key_wrapped, file_key_iv)
    values ('efefefef-efef-4fef-8fef-efefefefef13', 'efefefef-efef-4fef-8fef-efefefefef10', 'photos', 1, 1, 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'CCCCCCCCCCCCCCCC')$$,
  'the caregiver saves an encrypted summary with its wrapped file key'
);
select throws_ok(
  $$insert into public.visit_documents (circle_id, kind, page_count, key_version, file_key_wrapped, file_key_iv)
    values ('efefefef-efef-4fef-8fef-efefefefef10', 'photos', 1, 1, 'short', 'CCCCCCCCCCCCCCCC')$$,
  '23514', null, 'a wrapped file key must have the right shape'
);
select throws_ok(
  $$insert into public.visit_documents (circle_id, kind, page_count, key_version)
    values ('efefefef-efef-4fef-8fef-efefefefef10', 'photos', 1, 1)$$,
  '23514', null, 'the key columns come together or not at all'
);
select throws_ok(
  $$insert into public.visit_documents (circle_id, kind, page_count, key_version, file_key_wrapped, file_key_iv)
    values ('efefefef-efef-4fef-8fef-efefefefef10', 'photos', 1, 2, 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'CCCCCCCCCCCCCCCC')$$,
  null, 'the file key version must match the circle', 'a file key cannot name a circle key that does not exist'
);
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$select count(*) from public.visit_documents$$, '42501', null, 'a signed-out visitor cannot read saved summaries');

reset role;
delete from public.circles where id = 'efefefef-efef-4fef-8fef-efefefefef20';
select is((select count(*)::int from public.visit_documents where id = 'efefefef-efef-4fef-8fef-efefefefef22'), 0, 'erasing a circle erases its saved summaries');

select * from finish();
rollback;
