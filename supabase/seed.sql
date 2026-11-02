-- Fictional family only. Safe to load on an empty database (local, CI, or a
-- Supabase preview branch built from migrations). No real people. The caregiver
-- row cannot sign in: email sign-in is disabled and there is no Google identity.
-- Re-running is a no-op when these ids already exist.

-- auth.users column names differ before and after GoTrue's own migrations.
-- Branching and `supabase start` run those migrations first. A bare Postgres
-- image still has the earlier column names. Insert only the shape that exists.
do $$
begin
  if exists (select 1 from auth.users where id = '11111111-1111-4111-8111-111111111111') then
    return;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'email_confirmed_at'
  ) then
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000',
      '11111111-1111-4111-8111-111111111111',
      'authenticated',
      'authenticated',
      'lisa.ward@example.com',
      '',
      now(),
      '{"provider":"google","providers":["google"]}'::jsonb,
      '{"name":"Lisa Ward"}'::jsonb,
      now(),
      now(),
      'seed-lisa-ward',
      'seed-lisa-ward-recovery',
      '',
      'seed-lisa-ward-email'
    );
  else
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      '11111111-1111-4111-8111-111111111111',
      'authenticated',
      'authenticated',
      'lisa.ward@example.com',
      '',
      now(),
      '{"provider":"google","providers":["google"]}'::jsonb,
      '{"name":"Lisa Ward"}'::jsonb,
      now(),
      now(),
      'seed-lisa-ward',
      'seed-lisa-ward-recovery',
      '',
      'seed-lisa-ward-email'
    );
  end if;
end $$;

insert into public.circles (id, owner_id, key_version, content)
values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  1,
  '{
    "person_name": "Margaret Ward",
    "allergies": ["Penicillin"],
    "doctors": [{"name": "Anita Patel, MD", "specialty": "Internal medicine", "phone": "555-0100"}],
    "pharmacy": {"name": "Riverbend Pharmacy", "phone": "555-0199", "address": "10 Example Street"},
    "emergency_contacts": [{"name": "Lisa Ward", "relationship": "Daughter", "phone": "555-0142"}],
    "poa_location": "Folder in the kitchen drawer, labeled POA"
  }'::jsonb
)
on conflict (id) do nothing;

insert into public.circle_caregivers (circle_id, user_id, role, key_version)
values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'owner',
  1
)
on conflict (circle_id, user_id) do nothing;

insert into public.members (
  id, circle_id, name, role, email, token_hash, visibility, expires_at
)
values
  (
    '33333333-3333-4333-8333-333333333301',
    '22222222-2222-4222-8222-222222222222',
    'Rosa Alvarez',
    'home_aide',
    'rosa.alvarez@example.com',
    'seed-hash-rosa-not-a-link',
    '{"handoffSections":["medications","summary"]}'::jsonb,
    now() + interval '90 days'
  ),
  (
    '33333333-3333-4333-8333-333333333302',
    '22222222-2222-4222-8222-222222222222',
    'Dana Okonkwo',
    'care_manager',
    'dana.okonkwo@example.com',
    'seed-hash-dana-not-a-link',
    '{}'::jsonb,
    now() + interval '90 days'
  ),
  (
    '33333333-3333-4333-8333-333333333303',
    '22222222-2222-4222-8222-222222222222',
    'Sunrise Adult Day Health',
    'day_program',
    'sunrise.day@example.com',
    'seed-hash-sunrise-not-a-link',
    '{"handoffSections":["medications","summary"]}'::jsonb,
    now() + interval '90 days'
  )
on conflict (id) do nothing;

insert into public.consents (id, circle_id, user_id, type, version, text_hash)
values
  (
    '44444444-4444-4444-8444-444444444401',
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'authorized_to_share',
    '2026-11-02',
    'seed-text-hash-authorized'
  ),
  (
    '44444444-4444-4444-8444-444444444402',
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'terms',
    '2026-11-02',
    'seed-text-hash-terms'
  ),
  (
    '44444444-4444-4444-8444-444444444403',
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'privacy',
    '2026-11-02',
    'seed-text-hash-privacy'
  )
on conflict (id) do nothing;

insert into public.activity (id, circle_id, actor, action, subject_type, subject_id)
values (
  '55555555-5555-4555-8555-555555555501',
  '22222222-2222-4222-8222-222222222222',
  'caregiver:11111111-1111-4111-8111-111111111111',
  'circle_created',
  'circle',
  '22222222-2222-4222-8222-222222222222'
)
on conflict (id) do nothing;
