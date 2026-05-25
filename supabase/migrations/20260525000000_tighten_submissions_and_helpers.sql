-- Tighten submissions RLS to admin-only and allow admin DELETE.
-- Replaces the previous "any workspace member can read" policy which
-- leaked client PII to non-admin team members.

drop policy if exists "submissions member select" on public.submissions;
drop policy if exists "submissions admin select" on public.submissions;
drop policy if exists "submissions admin delete" on public.submissions;

create policy "submissions admin select"
  on public.submissions for select
  using (
    workspace_id in (
      select workspace_id from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "submissions admin delete"
  on public.submissions for delete
  using (
    workspace_id in (
      select workspace_id from public.users
      where id = auth.uid() and role = 'admin'
    )
  );
