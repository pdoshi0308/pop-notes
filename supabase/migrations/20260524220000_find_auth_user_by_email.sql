-- /api/team/invite used to scan up to 50,000 auth users via listUsers
-- pagination to find one row by email. That's O(N) on auth.users count and
-- ~3 seconds at 30 users in our test. This function does the lookup in O(1)
-- by querying auth.users directly through a SECURITY DEFINER hop.

create or replace function public.find_auth_user_id_by_email(p_email text)
returns uuid
language sql security definer set search_path = public, auth as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

revoke all on function public.find_auth_user_id_by_email(text) from public;
grant execute on function public.find_auth_user_id_by_email(text) to service_role;
