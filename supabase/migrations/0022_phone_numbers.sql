-- Phone numbers: an optional number on each person with a link (members.phone) and on the
-- caregiver (circle_caregivers.phone), so the Emergency page and the People page can offer
-- tap to call. Plain columns, like members.email: a number is not medical text.
--
-- - Never required. Empty means no number.
-- - Only digits, spaces, + ( ) . and -, 7 to 15 digits in all. lib/phone.ts checks the same
--   before saving, so a person sees a plain message instead of this check.
-- - Who can change them is unchanged: the caregiver changes any row here (the existing policies on
--   members and circle_caregivers), and a person with a link changes only their own number,
--   through the server after a permission check (lib/permissions.ts, "phone:edit:own").
-- - Who sees them is decided on the server: a person's number reaches whoever can see the
--   People list, the caregiver's number whoever can see the caregiver on it.
--
-- Runs after 0021. 0001-0021 are not modified. Only adds columns. Safe to re-run.

alter table public.members
  add column if not exists phone text
  constraint members_phone_check check (
    phone is null
    or (
      phone ~ '^\+?[0-9 ().-]{6,29}$'
      and pg_catalog.length(pg_catalog.regexp_replace(phone, '[^0-9]', '', 'g')) between 7 and 15
    )
  );

alter table public.circle_caregivers
  add column if not exists phone text
  constraint circle_caregivers_phone_check check (
    phone is null
    or (
      phone ~ '^\+?[0-9 ().-]{6,29}$'
      and pg_catalog.length(pg_catalog.regexp_replace(phone, '[^0-9]', '', 'g')) between 7 and 15
    )
  );

comment on column public.members.phone is 'Optional phone number, for tap to call. Set by the caregiver, or by the person from their own link.';
comment on column public.circle_caregivers.phone is 'Optional phone number of the caregiver, for tap to call.';
