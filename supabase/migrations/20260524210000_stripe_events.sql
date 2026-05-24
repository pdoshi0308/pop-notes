-- Stripe webhook idempotency.
--   Stripe retries event delivery on transient failures, and events can
--   arrive out of order (e.g. a delayed subscription.updated after a fresh
--   subscription.deleted). Without dedupe, we'd downgrade a workspace to
--   'free' and then immediately re-upgrade it on the delayed retry.
--
-- The webhook handler inserts the event id with on conflict do nothing
-- BEFORE touching workspaces; if the insert returns no row, the event is
-- already processed and we short-circuit.

create table if not exists public.stripe_events (
  id           text primary key,                              -- the Stripe event id
  type         text not null,
  processed_at timestamptz not null default now()
);

-- The webhook uses the service-role key (bypasses RLS), but we still want a
-- locked-down default in case anyone tries to read this from the client.
alter table public.stripe_events enable row level security;
-- No policies = no client/anon access by default.
