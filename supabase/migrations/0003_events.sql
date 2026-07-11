-- Facet — privacy-safe pilot analytics.
--
-- One table that counts THAT things happened, never WHAT was written:
-- a closed set of event names plus a random device id (a locally stored
-- coin flip, tied to no account, no auth, no content). Clients may only
-- INSERT; nothing is readable from the client side — reads happen in the
-- dashboard / service role only.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  device text not null check (char_length(device) <= 64),
  name text not null check (char_length(name) <= 40),
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

-- Write-only from clients: anonymous and authenticated may log an event.
create policy "clients may log events"
  on public.events for insert
  to anon, authenticated
  with check (true);

-- Deliberately NO select/update/delete policies: the table is a one-way
-- counter from the client's point of view.

create index if not exists events_name_created_idx on public.events (name, created_at);
