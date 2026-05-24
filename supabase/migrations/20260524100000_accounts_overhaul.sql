-- Users & accounts overhaul:
--   1. Rename the non-admin role from 'receptionist' to 'member' (consistent
--      with how the UI has always referred to it).
--   2. Make handle_new_auth_user honour the practice_name passed by the
--      signup form and drop the hardcoded "'s Practice" suffix.
--   3. Add invitations.auth_user_id so stub cleanup is deterministic
--      (instead of scanning auth.users by email).
--   4. Expose a SECURITY DEFINER public.accept_invitation(invitation_id)
--      function so an already-existing user (who can't go through the auth
--      trigger again) can consume a pending invitation cleanly.
--   5. Tighten the existing RLS helper grants to authenticated-only.

-- =========================================================================
-- 1. role: 'receptionist' -> 'member'
-- =========================================================================
update public.users        set role = 'member' where role = 'receptionist';
update public.invitations  set role = 'member' where role = 'receptionist';

alter table public.users
  drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check
  check (role in ('admin', 'member'));
alter table public.users
  alter column role set default 'member';

alter table public.invitations
  drop constraint if exists invitations_role_check;
alter table public.invitations
  add constraint invitations_role_check
  check (role in ('admin', 'member'));

-- =========================================================================
-- 2. invitations.auth_user_id
-- =========================================================================
alter table public.invitations
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create index if not exists invitations_auth_user_idx
  on public.invitations(auth_user_id);

-- =========================================================================
-- 3. handle_new_auth_user: honour practice_name; no "'s Practice" suffix
-- =========================================================================
create or replace function public.handle_new_auth_user() returns trigger as $$
declare
  new_ws_id      uuid;
  display_name   text;
  practice_name  text;
  workspace_name text;
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
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    split_part(new.email, '@', 1)
  );
  practice_name := nullif(new.raw_user_meta_data->>'practice_name', '');

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
      invited_ws_id := null;
      invited_role  := null;
    end if;
  end if;

  -- Also catch invitations created without the metadata (e.g. invitee signs
  -- up through Google OAuth at the same email after an admin invited them).
  if invited_ws_id is null then
    select * into invitation_row
      from public.invitations
     where accepted_at is null
       and expires_at > now()
       and lower(email) = lower(new.email)
     order by created_at desc
     limit 1;
    if found then
      invitation_id := invitation_row.id;
      invited_ws_id := invitation_row.workspace_id;
      invited_role  := invitation_row.role;
    end if;
  end if;

  if invited_ws_id is not null and invited_role in ('admin','member') then
    insert into public.users (id, workspace_id, role, full_name)
    values (new.id, invited_ws_id, invited_role, display_name)
    on conflict (id) do update set workspace_id = excluded.workspace_id,
                                   role         = excluded.role,
                                   full_name    = coalesce(excluded.full_name, public.users.full_name);

    if invitation_id is not null then
      update public.invitations
         set accepted_at = now(),
             auth_user_id = new.id
       where id = invitation_id and accepted_at is null;
    end if;

    return new;
  end if;

  -- Fresh-signup path: prefer the business name the user typed; otherwise
  -- fall back to "<their name>'s workspace" (no more dental-only suffix).
  workspace_name := coalesce(
    practice_name,
    nullif(display_name, '') || '''s workspace',
    'My workspace'
  );

  insert into public.workspaces (name, owner_id)
  values (workspace_name, new.id)
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

-- =========================================================================
-- 4. accept_invitation(uuid): consume a pending invite as an already-signed-in
--    user. Used by /dashboard/accept-invite when the visitor existed in
--    auth.users before the invite was sent (the trigger only runs on INSERT).
-- =========================================================================
create or replace function public.accept_invitation(p_invitation_id uuid)
returns table (workspace_id uuid, role text)
language plpgsql security definer set search_path = public as $$
declare
  caller_id    uuid := auth.uid();
  caller_email text;
  inv          public.invitations%rowtype;
begin
  if caller_id is null then
    raise exception 'Not authenticated';
  end if;

  select email into caller_email from auth.users where id = caller_id;
  if caller_email is null then
    raise exception 'No email on caller';
  end if;

  select * into inv
    from public.invitations
   where id = p_invitation_id
     and accepted_at is null
     and expires_at > now()
     and lower(email) = lower(caller_email);
  if not found then
    raise exception 'Invitation not found or expired';
  end if;

  insert into public.users (id, workspace_id, role, full_name)
  values (
    caller_id,
    inv.workspace_id,
    inv.role,
    coalesce(
      (select full_name from public.users where id = caller_id),
      (select raw_user_meta_data->>'full_name' from auth.users where id = caller_id),
      split_part(caller_email, '@', 1)
    )
  )
  on conflict (id) do update set workspace_id = excluded.workspace_id,
                                 role         = excluded.role;

  update public.invitations
     set accepted_at = now(),
         auth_user_id = caller_id
   where id = inv.id;

  return query select inv.workspace_id, inv.role;
end;
$$;

revoke all on function public.accept_invitation(uuid) from public;
grant execute on function public.accept_invitation(uuid) to authenticated;

-- =========================================================================
-- decline_invitation(uuid): the invitee says "no thanks". Deletes the
-- invitation row so the slot is freed. Caller must be signed in with the
-- same email the invite was addressed to.
-- =========================================================================
create or replace function public.decline_invitation(p_invitation_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  caller_email text;
  inv          public.invitations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select email into caller_email from auth.users where id = auth.uid();
  if caller_email is null then
    raise exception 'No email on caller';
  end if;

  select * into inv
    from public.invitations
   where id = p_invitation_id
     and accepted_at is null
     and lower(email) = lower(caller_email);
  if not found then
    raise exception 'Invitation not found';
  end if;

  delete from public.invitations where id = inv.id;
end;
$$;

revoke all on function public.decline_invitation(uuid) from public;
grant execute on function public.decline_invitation(uuid) to authenticated;

-- =========================================================================
-- 5. Tighten helper grants — anon never benefits from auth.uid()-based
--    helpers, and shrinking the grant surface is cheap defence-in-depth.
-- =========================================================================
revoke execute on function public.current_workspace_id() from anon;
revoke execute on function public.current_is_admin()     from anon;
