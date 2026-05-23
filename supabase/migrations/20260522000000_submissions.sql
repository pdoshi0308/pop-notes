-- Submission history.
-- Persists completed registration forms so paid workspaces can review past
-- submissions — and so nothing is lost if no one is watching the side panel.

create table if not exists public.submissions (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  phone         text,
  fields        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists submissions_workspace_idx
  on public.submissions(workspace_id, created_at desc);

alter table public.submissions enable row level security;

-- Members can read their own workspace's submissions.
-- (The /api/submit route writes via the service-role key and bypasses RLS.)
drop policy if exists "submissions member select" on public.submissions;
create policy "submissions member select"
  on public.submissions for select
  using (
    workspace_id in (select workspace_id from public.users where id = auth.uid())
  );
