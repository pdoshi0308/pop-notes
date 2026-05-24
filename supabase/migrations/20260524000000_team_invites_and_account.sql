-- Team invites + account/billing surfacing.
--
-- 1. invitations table: workspace admins create rows here; the
--    handle_new_auth_user trigger consumes them when an invitee finishes
--    signing up so they join the right workspace + role (instead of getting
--    their own brand-new workspace as today).
-- 2. Trigger extended to honour invited_to_workspace / invitation_id metadata.
-- 3. workspaces: cancel_at_period_end + current_period_end so the dashboard
--    can show "Cancels on DD MMM" without re-querying Stripe on every render.

-- =========================================================================
-- invitations
-- =========================================================================
create table if not exists public.invitations (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  email         text not null,
  role          text not null check (role in ('admin','receptionist')),
  invited_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '7 days'),
  accepted_at   timestamptz,
  unique (workspace_id, email)
);

create index if not exists invitations_email_pending_idx
  on public.invitations(email)
  where accepted_at is null;

alter table public.invitations enable row level security;

-- Only admins of the workspace can see/manage its invitations from the client.
-- (API routes use the service-role key and bypass RLS — they also enforce role.)
drop policy if exists "invitations admin select" on public.invitations;
create policy "invitations admin select"
  on public.invitations for select
  using (workspace_id = public.current_workspace_id() and public.current_is_admin());

drop policy if exists "invitations admin write" on public.invitations;
create policy "invitations admin write"
  on public.invitations for all
  using (workspace_id = public.current_workspace_id() and public.current_is_admin())
  with check (workspace_id = public.current_workspace_id() and public.current_is_admin());

-- =========================================================================
-- workspaces: surface subscription state without hitting Stripe each render
-- =========================================================================
alter table public.workspaces
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists current_period_end   timestamptz;

-- =========================================================================
-- handle_new_auth_user: honour an invitation if metadata carries one
-- =========================================================================
create or replace function public.handle_new_auth_user() returns trigger as $$
declare
  new_ws_id      uuid;
  display_name   text;
  invited_ws_id  uuid;
  invited_role   text;
  invitation_id  uuid;
  invitation_row public.invitations%rowtype;
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

  -- Did an admin invite this email?
  invitation_id := nullif(new.raw_user_meta_data->>'invitation_id', '')::uuid;
  invited_ws_id := nullif(new.raw_user_meta_data->>'invited_to_workspace', '')::uuid;
  invited_role  := nullif(new.raw_user_meta_data->>'invited_role', '');

  if invitation_id is not null then
    select * into invitation_row
      from public.invitations
     where id = invitation_id
       and accepted_at is null
       and expires_at > now()
       and lower(email) = lower(new.email);

    if found then
      invited_ws_id := invitation_row.workspace_id;
      invited_role  := invitation_row.role;
    else
      -- Invitation invalid/expired — fall through to fresh-workspace path.
      invited_ws_id := null;
      invited_role  := null;
    end if;
  end if;

  if invited_ws_id is not null and invited_role in ('admin','receptionist') then
    insert into public.users (id, workspace_id, role, full_name)
    values (new.id, invited_ws_id, invited_role, display_name)
    on conflict (id) do update set workspace_id = excluded.workspace_id,
                                   role         = excluded.role,
                                   full_name    = coalesce(excluded.full_name, public.users.full_name);

    if invitation_id is not null then
      update public.invitations
         set accepted_at = now()
       where id = invitation_id and accepted_at is null;
    end if;

    return new;
  end if;

  -- Fresh signup path (unchanged from previous migration).
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
