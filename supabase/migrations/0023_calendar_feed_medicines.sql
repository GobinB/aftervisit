-- Medicines in the calendar link. The circle's private calendar link now carries medicine times
-- as repeating entries, and the caregiver can leave them out. On by default: a link made before
-- this migration, or a new one, carries medicines until the caregiver turns them off.
-- Only adds a column; the policies from 0014 already let only the caregiver change it.
-- Runs after 0022. Safe to re-run.

alter table public.calendar_feeds
  add column if not exists include_medicines boolean not null default true;

comment on column public.calendar_feeds.include_medicines is
  'When false, the calendar file leaves medicine times out. Set by the circle''s caregiver on the subscribe page.';
