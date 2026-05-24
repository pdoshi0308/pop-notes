-- Pingform database schema
-- Run this in the Supabase SQL editor of a fresh project.

-- =========================================================================
-- Extensions
-- =========================================================================
create extension if not exists "pgcrypto";

-- =========================================================================
-- workspaces
-- One row per practice. Holds practice-level config + BYO Twilio/Pusher creds.
-- =========================================================================
create table if not exists public.workspaces (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  twilio_account_sid   text,
  twilio_auth_token    text,
  twilio_from_number   text,
  pusher_app_id        text,
  pusher_key           text,
  pusher_secret        text,
  pusher_cluster       text,
  sms_template         text default 'Hi! {practice_name} has asked you to complete a quick registration form. It only takes 1 minute 👉 {link}',
  created_at           timestamptz not null default now()
);

-- =========================================================================
-- users
-- Application-level profile. PK matches auth.users.id 1:1.
-- =========================================================================
create table if not exists public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  workspace_id  uuid references public.workspaces(id) on delete set null,
  role          text not null default 'member' check (role in ('admin', 'member')),
  full_name     text,
  created_at    timestamptz not null default now()
);

create index if not exists users_workspace_idx on public.users(workspace_id);

-- =========================================================================
-- form_configs
-- Stores the field list / order / required-ness for a workspace's patient
-- registration form. `fields` is an ordered jsonb array of:
--   { "id": "full_name", "required": true, "label": "Custom label?" }
-- =========================================================================
create table if not exists public.form_configs (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  fields        jsonb not null default '[]'::jsonb,
  updated_at    timestamptz not null default now(),
  unique (workspace_id)
);

-- =========================================================================
-- Row-level security
-- The serverless API routes use the SERVICE_ROLE key and bypass RLS.
-- We still enable RLS so direct client access is restricted.
-- =========================================================================
alter table public.workspaces  enable row level security;
alter table public.users       enable row level security;
alter table public.form_configs enable row level security;

-- Users can read their own profile row.
drop policy if exists "users self select" on public.users;
create policy "users self select"
  on public.users for select
  using (auth.uid() = id);

-- Users can update their own non-privileged columns.
drop policy if exists "users self update" on public.users;
create policy "users self update"
  on public.users for update
  using (auth.uid() = id);

-- Admins can manage (read + update) any user in their workspace.
-- Used by the Team page to remove a member by clearing their workspace_id.
drop policy if exists "users admin select members" on public.users;
create policy "users admin select members"
  on public.users for select
  using (
    workspace_id in (
      select workspace_id from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

drop policy if exists "users admin update members" on public.users;
create policy "users admin update members"
  on public.users for update
  using (
    workspace_id in (
      select workspace_id from public.users
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (true);

-- Members can read their own workspace row.
drop policy if exists "workspace member select" on public.workspaces;
create policy "workspace member select"
  on public.workspaces for select
  using (
    id in (select workspace_id from public.users where id = auth.uid())
  );

-- Admins can update their own workspace.
drop policy if exists "workspace admin update" on public.workspaces;
create policy "workspace admin update"
  on public.workspaces for update
  using (
    id in (
      select workspace_id from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- Members can read their workspace's form config.
drop policy if exists "form_configs member select" on public.form_configs;
create policy "form_configs member select"
  on public.form_configs for select
  using (
    workspace_id in (select workspace_id from public.users where id = auth.uid())
  );

-- Admins can upsert their workspace's form config.
drop policy if exists "form_configs admin write" on public.form_configs;
create policy "form_configs admin write"
  on public.form_configs for all
  using (
    workspace_id in (
      select workspace_id from public.users
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    workspace_id in (
      select workspace_id from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- =========================================================================
-- Helper: bootstrap the first practice + admin user.
-- Run this AFTER you have created the auth user via the Supabase dashboard
-- (Authentication > Users > Add User).
-- Replace the placeholders before running.
-- =========================================================================
-- insert into public.workspaces (id, name)
-- values (gen_random_uuid(), 'My Practice')
-- returning id;
--
-- insert into public.users (id, workspace_id, role, full_name)
-- values (
--   '<paste auth user id>',
--   '<paste workspace id from above>',
--   'admin',
--   'Owner Name'
-- );
--
-- insert into public.form_configs (workspace_id, fields)
-- values (
--   '<paste workspace id>',
--   '[
--      {"id":"full_name","required":true},
--      {"id":"mobile_number","required":true},
--      {"id":"date_of_birth","required":true},
--      {"id":"email","required":true},
--      {"id":"postcode","required":false},
--      {"id":"address_line_1","required":false}
--    ]'::jsonb
-- );
