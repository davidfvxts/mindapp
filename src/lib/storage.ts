import { initialState, type AppState, type Entry } from './types'
import { supabase } from './supabase'

const KEY = 'facet.state.v1'
const LEGACY_KEY = 'mira.state.v1'

/** Local-first: the device is always the source of truth for writes. */
export function loadState(): AppState {
  try {
    // Read Facet state; fall back to any pre-rebrand state so a tester's
    // nights aren't orphaned by the rename.
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY)
    if (!raw) return initialState()
    const parsed = JSON.parse(raw) as AppState
    // Deep-merge settings so states persisted before a new setting existed
    // pick up its default instead of dropping the field.
    const init = initialState()
    return { ...init, ...parsed, settings: { ...init.settings, ...parsed.settings } }
  } catch {
    return initialState()
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (err) {
    console.warn('[facet] could not persist state:', err)
  }
}

export function resetState(): void {
  localStorage.removeItem(KEY)
  localStorage.removeItem(LEGACY_KEY)
}

/** Push any unsynced entries to Supabase. No-op when signed out. */
export async function syncEntries(entries: Entry[]): Promise<Entry[]> {
  if (!supabase) return entries
  const { data: sess } = await supabase.auth.getSession()
  const userId = sess.session?.user.id
  if (!userId) return entries

  const pending = entries.filter((e) => !e.synced)
  if (!pending.length) return entries

  const { error } = await supabase.from('entries').upsert(
    pending.map((e) => ({
      id: e.id,
      user_id: userId,
      date: e.date,
      event: e.event,
      emotions: e.emotions,
      well: e.well,
      next_step: e.next,
      coach: e.coach ?? null,
      rating: e.rating ?? null,
      created_at: new Date(e.ts).toISOString(),
    })),
    { onConflict: 'id' },
  )

  if (error) {
    console.warn('[facet] sync failed, will retry later:', error.message)
    return entries
  }
  const ids = new Set(pending.map((p) => p.id))
  return entries.map((e) => (ids.has(e.id) ? { ...e, synced: true } : e))
}
