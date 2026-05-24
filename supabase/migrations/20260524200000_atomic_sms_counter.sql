-- Atomic SMS counter:
--   /api/send was read-modify-write on workspaces.sms_used_this_period.
--   Two concurrent sends at limit-1 both passed the check and both incremented,
--   leaking 1 free credit and undercounting usage. Move the whole check + roll
--   + increment into the database where row-level locks make it atomic.
--
-- Returns the post-increment usage so the caller can include it in the
-- response, plus an `allowed` flag that's false when the limit is already
-- reached. The caller is expected to bail out without calling Twilio when
-- allowed=false (i.e. without spending money on the SMS gateway).

create or replace function public.increment_sms_usage(
  p_workspace_id uuid,
  p_limit         int
)
returns table (allowed boolean, used int)
language plpgsql security definer set search_path = public as $$
declare
  v_ws workspaces%rowtype;
  v_now timestamptz := now();
  v_period_start timestamptz;
  v_same_month boolean;
  v_new_used int;
begin
  -- Row-level lock for the duration of this transaction so concurrent
  -- sends serialise on this workspace's row.
  select * into v_ws from workspaces where id = p_workspace_id for update;
  if not found then
    raise exception 'workspace not found' using errcode = 'P0002';
  end if;

  v_period_start := coalesce(v_ws.period_start, to_timestamp(0));
  v_same_month :=
    extract(year from v_now) = extract(year from v_period_start) and
    extract(month from v_now) = extract(month from v_period_start);

  if not v_same_month then
    -- New month: roll the counter and reset period_start to the 1st (UTC).
    v_new_used := 0;
    update workspaces
       set sms_used_this_period = 0,
           period_start         = date_trunc('month', v_now at time zone 'UTC')
     where id = p_workspace_id;
    v_ws.sms_used_this_period := 0;
  else
    v_new_used := coalesce(v_ws.sms_used_this_period, 0);
  end if;

  if v_new_used >= p_limit then
    return query select false, v_new_used;
    return;
  end if;

  v_new_used := v_new_used + 1;
  update workspaces
     set sms_used_this_period = v_new_used
   where id = p_workspace_id;

  return query select true, v_new_used;
end;
$$;

-- API routes use the service-role key; lock the function down so direct
-- client/anon calls can't tamper with billing usage.
revoke all on function public.increment_sms_usage(uuid, int) from public;
grant execute on function public.increment_sms_usage(uuid, int) to service_role;
