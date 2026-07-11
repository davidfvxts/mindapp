import { initialState, type AppState, type ChatTurn, type CoachClose, type CoachReply, type Conversation, type Entry } from './types'
import { supabase } from './supabase'
import { migrateGame } from './game'
import { liftNightConversations } from './conversations'

const KEY = 'facet.state.v1'
const LEGACY_KEY = 'mira.state.v1'

/** Local-first: the device is always the source of truth for writes. */
export function loadState(): AppState {
  try {
    // Read Facet state; fall back to any pre-rebrand state so a tester's
    // nights aren't orphaned by the rename.
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY)
    if (!raw) return initialState()
    const parsed = JSON.parse(raw) as Partial<AppState>
    // Deep-merge settings so states persisted before a new setting existed
    // pick up its default instead of dropping the field.
    const init = initialState()
    const entries = Array.isArray(parsed.entries) ? parsed.entries : []
    return {
      ...init,
      ...parsed,
      settings: { ...init.settings, ...parsed.settings },
      // Legacy xp/level/streak/best/freeze fields are folded into one
      // monotonic Night count and never written back out.
      game: migrateGame(parsed.game, entries.length),
      // Exchanges that predate conversations lift into them, once, here.
      conversations: liftNightConversations(entries, parsed.conversations ?? []),
    }
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
      // Keep the full bounded exchange in the existing JSONB column. This avoids
      // a schema change while keeping the answer and close available to sync.
      coach: e.coach
        ? { ...e.coach, answer: e.coachAnswer, close: e.coachClose ?? undefined, thread: e.thread ?? undefined }
        : null,
      morning: e.morning ?? null,
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

/** The shape a row comes back as from `entries` — the reverse of the upsert in `syncEntries`. */
export interface EntryRow {
  id: string
  date: string
  event: string
  emotions: string[]
  well: string
  next_step: string
  coach: (CoachReply & { answer?: string; close?: CoachClose; thread?: Entry['thread'] }) | null
  morning: Entry['morning'] | null
  rating: 0 | 1 | null
  created_at: string
}

/** Pure: a synced row back into the app's Entry shape. */
export function rowToEntry(row: EntryRow): Entry {
  const { answer, close, thread, ...coach } = row.coach ?? {}
  return {
    id: row.id,
    date: row.date,
    event: row.event,
    emotions: row.emotions as Entry['emotions'],
    well: row.well,
    next: row.next_step,
    ts: new Date(row.created_at).getTime(),
    coach: row.coach ? (coach as CoachReply) : undefined,
    coachAnswer: answer,
    coachClose: close,
    thread,
    rating: row.rating ?? undefined,
    morning: row.morning ?? undefined,
    synced: true,
  }
}

/**
 * Every entry a signed-in account has ever backed up — the recovery path for
 * "log in and your nights are here again." Null on any failure (offline,
 * signed out, request error); the caller then keeps the device's own history
 * rather than silently emptying it.
 */
export async function downloadEntries(userId: string): Promise<Entry[] | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('entries')
      .select('id, date, event, emotions, well, next_step, coach, morning, rating, created_at')
      .eq('user_id', userId)
    if (error || !data) return null
    return (data as EntryRow[]).map(rowToEntry)
  } catch {
    return null
  }
}

/** Push any unsynced conversations. No-op when signed out or table missing. */
export async function syncConversations(conversations: Conversation[]): Promise<Conversation[]> {
  if (!supabase) return conversations
  const { data: sess } = await supabase.auth.getSession()
  const userId = sess.session?.user.id
  if (!userId) return conversations

  const pending = conversations.filter((c) => !c.synced && c.turns.length > 0)
  if (!pending.length) return conversations

  const { error } = await supabase.from('conversations').upsert(
    pending.map((c) => ({
      id: c.id,
      user_id: userId,
      title: c.title,
      entry_id: c.entryId ?? null,
      turns: c.turns,
      created_at: new Date(c.createdAt).toISOString(),
      updated_at: new Date(c.updatedAt).toISOString(),
    })),
    { onConflict: 'id' },
  )

  if (error) {
    // Also lands here until migration 0004 is applied — quiet, retried later.
    console.warn('[facet] conversation sync failed, will retry later:', error.message)
    return conversations
  }
  const ids = new Set(pending.map((p) => p.id))
  return conversations.map((c) => (ids.has(c.id) ? { ...c, synced: true } : c))
}

interface ConversationRow {
  id: string
  title: string | null
  entry_id: string | null
  turns: ChatTurn[]
  created_at: string
  updated_at: string
}

/** Every conversation the account has backed up — recovered next to the nights. */
export async function downloadConversations(userId: string): Promise<Conversation[] | null> {
  if (!supabase) return null
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('id, title, entry_id, turns, created_at, updated_at')
      .eq('user_id', userId)
    if (error || !data) return null
    return (data as ConversationRow[]).map((r) => ({
      id: r.id,
      title: r.title,
      entryId: r.entry_id ?? undefined,
      turns: Array.isArray(r.turns) ? r.turns : [],
      createdAt: new Date(r.created_at).getTime(),
      updatedAt: new Date(r.updated_at).getTime(),
      synced: true,
    }))
  } catch {
    return null
  }
}
