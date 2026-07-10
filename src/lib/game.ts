import type { Entry, GameState } from './types'

export const todayStr = (d = new Date()): string => {
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 10)
}

export const daysBetween = (a: string, b: string): number =>
  Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)

export interface NightResult {
  game: GameState
  addedNight: boolean
}

/**
 * The Night clock. A Night is a completed first reflection of a day. Gaps are
 * honest pauses: they never remove what the user has already made.
 */
export function applyEntry(game: GameState, entry: Entry): NightResult {
  const g: GameState = { ...game }
  const addedNight = g.lastDay !== entry.date
  if (addedNight) {
    g.nights += 1
    g.lastDay = entry.date
  }
  return { game: g, addedNight }
}

/** Legacy game fields are read once during state loading, then discarded. */
export function migrateGame(raw: unknown, entryCount: number): GameState {
  const legacy = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const count = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0

  const nights = count(legacy.nights)
  const best = count(legacy.best)
  const streak = count(legacy.streak)
  const hasModernNight = typeof legacy.nights === 'number'
  // Extra same-day notes count as entries but never as Nights. Entries can only
  // help recover an old state that did not yet have a `nights` field.
  const cappedEntries = hasModernNight ? 0 : Math.min(Math.max(0, entryCount), best)

  return {
    nights: Math.max(nights, best, streak, cappedEntries),
    lastDay: typeof legacy.lastDay === 'string' ? legacy.lastDay : null,
  }
}

/** Entries in the trailing 7 days — gates the weekly review. */
export const weekCount = (entries: Entry[]): number => {
  const cutoff = Date.now() - 6 * 86400000
  return entries.filter((e) => e.ts >= cutoff).length
}

export const WEEKLY_UNLOCK = 5
