-- The Today bookend: each night's entry may carry the morning it was weighed
-- against (win + Coach's question + answer). Nullable jsonb; local-first, the
-- device remains the source of truth.
alter table public.entries
  add column if not exists morning jsonb;
