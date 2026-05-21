-- Fix infinite recursion in users RLS policies.
--
-- The previous "admin select/update members" policies queried public.users
-- to determine whether the caller was an admin, which re-triggered the same
-- policy. We move that logic into SECURITY DEFINER helper functions that
-- bypass RLS for the lookup, and rewrite every policy that referenced
-- public.users from within its own predicate.

-- ---------- helper functions ----------------------------------------------
create or replace function public.current_workspace_id() returns uuid as $$
  select workspace_id from public.users where id = auth.uid();
$$ language sql stable security definer set search_path = public;

create or replace function public.current_is_admin() returns boolean as $$
  select coalesce(
    (select role = 'admin' from public.users where id = auth.uid()),
    false
  );
$$ language sql stable security definer set search_path = public;

grant execute on function public.current_workspace_id() to authenticated, anon;
grant execute on function public.current_is_admin()     to authenticated, anon;

-- ---------- users -----------------------------------------------------------
drop policy if exists "users admin select members" on public.users;
drop policy if exists "users admin update members" on public.users;

create policy "users admin select members"
  on public.users for select
  using (workspace_id = public.current_workspace_id() and public.current_is_admin());

create policy "users admin update members"
  on public.users for update
  using (workspace_id = public.current_workspace_id() and public.current_is_admin())
  with check (true);

-- ---------- workspaces ------------------------------------------------------
drop policy if exists "workspace member select" on public.workspaces;
drop policy if exists "workspace admin update" on public.workspaces;

create policy "workspace member select"
  on public.workspaces for select
  using (id = public.current_workspace_id());

create policy "workspace admin update"
  on public.workspaces for update
  using (id = public.current_workspace_id() and public.current_is_admin());

-- ---------- form_configs ----------------------------------------------------
drop policy if exists "form_configs member select" on public.form_configs;
drop policy if exists "form_configs admin write"  on public.form_configs;

create policy "form_configs member select"
  on public.form_configs for select
  using (workspace_id = public.current_workspace_id());

create policy "form_configs admin write"
  on public.form_configs for all
  using (workspace_id = public.current_workspace_id() and public.current_is_admin())
  with check (workspace_id = public.current_workspace_id() and public.current_is_admin());
