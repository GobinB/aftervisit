-- Creating a circle is one transaction.
-- A signed-in caregiver's insert ... returning is checked by circles_select, which
-- only allows caregivers. The owner is not a caregiver yet, so the insert fails.
-- The owner row on circle_caregivers has the same ordering problem.
-- This function writes the circle (owner_id = auth.uid()), the owner row, the
-- consent rows, and the activity row together. It does not take owner_id or role.
-- Existing policies and triggers stay as they are.
-- Safe to re-run. 0004 is not modified.

create or replace function public.create_circle(p_content jsonb, p_consents jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid := pg_catalog.gen_random_uuid();
  v_key int := 1;
  v_agreed timestamptz := pg_catalog.now();
  v_elem jsonb;
  v_type text;
  v_version text;
  v_hash text;
  v_seen text[] := array[]::text[];
begin
  if v_uid is null then
    raise exception 'sign in to create a circle';
  end if;

  if p_content is null
     or pg_catalog.jsonb_typeof(p_content) is distinct from 'object'
     or pg_catalog.octet_length(p_content::text) > 262144
     or pg_catalog.jsonb_typeof(p_content -> 'person_name') is distinct from 'string'
     or pg_catalog.char_length(pg_catalog.btrim(p_content ->> 'person_name')) < 1
     or pg_catalog.char_length(p_content ->> 'person_name') > 120 then
    raise exception 'circle content is not valid';
  end if;

  if p_consents is null
     or pg_catalog.jsonb_typeof(p_consents) is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_consents) is distinct from 3 then
    raise exception 'circle consents are not valid';
  end if;

  insert into public.circles (id, owner_id, key_version, content)
  values (v_id, v_uid, v_key, p_content)
  returning key_version into v_key;

  -- Same key_version as the circle. circle_key_wrapped stays null.
  -- user_id is auth.uid() and role is owner. The caller cannot choose either.
  -- A before-insert trigger may compare key_version to the circle only when a
  -- wrapped key is present, and may reject a non-co-caregiver row that is not
  -- auth.uid(). This row passes those checks. The function is security definer,
  -- so that trigger can read the new circle. Row security would hide it until
  -- this caregiver row exists. Keep the two key versions equal.
  insert into public.circle_caregivers (circle_id, user_id, role, key_version)
  values (v_id, v_uid, 'owner', v_key);

  for v_elem in
    select e.elem from pg_catalog.jsonb_array_elements(p_consents) as e(elem)
  loop
    if pg_catalog.jsonb_typeof(v_elem) is distinct from 'object' then
      raise exception 'circle consents are not valid';
    end if;
    v_type := v_elem ->> 'type';
    v_version := v_elem ->> 'version';
    v_hash := v_elem ->> 'text_hash';
    if v_type is null
       or v_type not in ('authorized_to_share', 'terms', 'privacy')
       or v_type = any (v_seen)
       or v_version is null
       or v_version !~ '^[0-9A-Za-z][0-9A-Za-z._-]{0,39}$'
       or v_hash is null
       or v_hash !~ '^[0-9a-f]{64}$' then
      raise exception 'circle consents are not valid';
    end if;
    v_seen := v_seen || v_type;
    -- user_id is the signed-in caregiver. A user_id in the payload is ignored.
    insert into public.consents (circle_id, user_id, type, version, text_hash, agreed_at)
    values (v_id, v_uid, v_type, v_version, v_hash, v_agreed);
  end loop;

  if pg_catalog.array_length(v_seen, 1) is distinct from 3 then
    raise exception 'circle consents are not valid';
  end if;

  insert into public.activity (circle_id, actor, action, subject_type, subject_id)
  values (v_id, 'caregiver:' || v_uid::text, 'circle_created', 'circle', v_id);

  return v_id;
end;
$$;

revoke all on function public.create_circle(jsonb, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.create_circle(jsonb, jsonb) to authenticated;
