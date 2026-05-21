-- Billing columns + self-serve signup trigger.

-- ---------- workspaces ----------------------------------------------------
alter table public.workspaces
  add column if not exists plan                  text not null default 'free'
    check (plan in ('free','starter','pro','practice')),
  add column if not exists sms_used_this_period  integer not null default 0,
  add column if not exists period_start          timestamptz not null default date_trunc('month', now()),
  add column if not exists stripe_customer_id    text,
  add column if not exists stripe_subscription_id text,
  add column if not exists owner_id              uuid references auth.users(id) on delete set null;

create index if not exists workspaces_stripe_customer_idx
  on public.workspaces(stripe_customer_id);

-- ---------- Self-serve signup ---------------------------------------------
-- When a new auth user appears (email/password sign-up or Google OAuth):
--   1. Create a workspace named after them.
--   2. Insert a public.users row linking them as the admin of that workspace.
--   3. Seed a default form_config.
--
-- We use SECURITY DEFINER so the trigger can write across tables regardless
-- of who called it. The function is idempotent — re-running is safe.

create or replace function public.handle_new_auth_user() returns trigger as $$
declare
  new_ws_id uuid;
  display_name text;
begin
  -- Skip if this user already has a workspace (rerun safety).
  if exists (select 1 from public.users where id = new.id and workspace_id is not null) then
    return new;
  end if;

  display_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );

  insert into public.workspaces (name, owner_id)
  values (coalesce(display_name, 'My practice') || '''s Practice', new.id)
  returning id into new_ws_id;

  insert into public.users (id, workspace_id, role, full_name)
  values (new.id, new_ws_id, 'admin', display_name)
  on conflict (id) do update set workspace_id = excluded.workspace_id,
                                 role        = excluded.role,
                                 full_name   = coalesce(excluded.full_name, public.users.full_name);

  insert into public.form_configs (workspace_id, fields)
  values (
    new_ws_id,
    '[
       {"id":"full_name","required":true},
       {"id":"mobile_number","required":true},
       {"id":"date_of_birth","required":true},
       {"id":"email","required":true},
       {"id":"postcode","required":false},
       {"id":"address_line_1","required":false}
     ]'::jsonb
  )
  on conflict (workspace_id) do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
