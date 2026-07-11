-- Facet — conversations with Coach, findable again on any device.
-- Run in Supabase: SQL Editor > paste > Run.  (or `supabase db push`)
--
-- One row per conversation. Night-anchored conversations reuse the entry's
-- own uuid as their id (one conversation per night, deterministic across
-- devices); free conversations carry their own. The turns live as a jsonb
-- array of {role, text, ts} — same shape the client stores locally.
-- Same privacy model as entries: owner-only via Row-Level Security.

create table if not exists public.conversations (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text,
  entry_id    uuid,
  turns       jsonb not null default '[]',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc);

alter table public.conversations enable row level security;

drop policy if exists "own conversations" on public.conversations;
create policy "own conversations" on public.conversations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
