-- The daily counter that caps how many summaries one caregiver can have read by the outside reader.

begin;

select plan(4);

select ok(public.check_daily_limit('test-key', 'openai_reads', 2), 'the first read of the day is allowed');
select ok(public.check_daily_limit('test-key', 'openai_reads', 2), 'the second is allowed');
select ok(not public.check_daily_limit('test-key', 'openai_reads', 2), 'the third is over the limit');
select ok(public.check_daily_limit('other-key', 'openai_reads', 2), 'another caregiver has their own count');

select * from finish();
rollback;
