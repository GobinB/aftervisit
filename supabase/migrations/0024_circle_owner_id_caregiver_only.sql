-- circle_owner_id answers only the circle's own caregiver.
-- Before, any signed-in user could pass any circle id and get back that circle's owner user id
-- (Supabase's Security Advisor flags it). Its one use is the circles_update policy's with check,
-- which already requires is_circle_caregiver(id), so the policy works the same. Everyone else
-- gets null. Same name, arguments, security definer, search_path and grants as in 0004.
-- Runs after 0023. Safe to re-run.

create or replace function public.circle_owner_id(p_circle uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.owner_id
    from public.circles c
   where c.id = p_circle
     and public.is_circle_caregiver(p_circle);
$$;
revoke all on function public.circle_owner_id(uuid) from public, anon;
grant execute on function public.circle_owner_id(uuid) to authenticated, service_role;

comment on function public.circle_owner_id(uuid) is
  'The stored owner of a circle, for the circles_update policy. Null unless the caller is that circle''s caregiver.';
