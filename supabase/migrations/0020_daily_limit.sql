-- A daily counter, next to the hourly one in 0001. Used to cap how many visit summaries one
-- caregiver can have read by the outside reader (OpenAI) in a day, so the service cannot be run up.
-- Same table as the hourly counter: one row per hashed key, bucket and day. The hourly function's
-- cleanup removes a day's row once that day is over.
-- Only the server can run it. Safe to re-run.

create or replace function public.check_daily_limit(p_ip_hash text, p_bucket text, p_limit int)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count int;
begin
  insert into public.rate_limits as r (ip_hash, bucket, window_start, count)
  values (p_ip_hash, p_bucket, date_trunc('day', now()), 1)
  on conflict (ip_hash, bucket, window_start)
  do update set count = r.count + 1
  returning r.count into v_count;

  delete from public.rate_limits where window_start < now() - interval '2 days';

  return v_count <= p_limit;
end;
$$;

revoke all on function public.check_daily_limit(text, text, int) from public, anon, authenticated;
grant execute on function public.check_daily_limit(text, text, int) to service_role;
