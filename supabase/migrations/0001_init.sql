-- Mira — initial schema
-- Run in Supabase: SQL Editor > paste > Run.  (or `supabase db push`)
--
-- Privacy model: every row is owned by auth.uid() and Row-Level Security
-- makes it impossible for one user to read another's reflections.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------
-- entries: the daily reflections
-- ---------------------------------------------------------------
create table if not exists public.entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null,
  event       text not null,
  emotions    text[] not null default '{}',
  well        text not null default '',
  next_step   text not null default '',
  coach       jsonb,
  rating      smallint check (rating in (0, 1)),
  created_at  timestamptz not null default now()
);

create index if not exists entries_user_date_idx on public.entries (user_id, date desc);

-- ---------------------------------------------------------------
-- insight_cards: weekly AI-generated patterns
-- ---------------------------------------------------------------
create table if not exists public.insight_cards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  text        text not null,
  date        date not null default current_date,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- profiles: settings + game state
-- ---------------------------------------------------------------
create table if not exists public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  name           text not null default '',
  cue            text not null default '',
  reminder_time  time not null default '21:30',
  tone           text not null default 'default',
  xp             int  not null default 0,
  level          int  not null default 1,
  streak         int  not null default 0,
  best_streak    int  not null default 0,
  freezes        int  not null default 1,
  last_day       date,
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------
alter table public.entries       enable row level security;
alter table public.insight_cards enable row level security;
alter table public.profiles      enable row level security;

drop policy if exists "own entries" on public.entries;
create policy "own entries" on public.entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own cards" on public.insight_cards;
create policy "own cards" on public.insight_cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- ---------------------------------------------------------------
-- Auto-create a profile row on signup
-- ---------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
