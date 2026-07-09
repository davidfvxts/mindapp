import type { Entry, GameState } from './types'

export const todayStr = (d = new Date()): string => {
  const tz = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - tz).toISOString().slice(0, 10)
}

export const daysBetween = (a: string, b: string): number =>
  Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)

/** XP needed to clear the current level. */
export const xpForLevel = (level: number): number => level * 100

export interface StreakResult {
  game: GameState
  freezeUsed: boolean
  leveledUp: boolean
  gained: number
}

/**
 * The habit engine.
 *
 * "Never miss twice": if you miss exactly one day and have a freeze
 * available, the streak survives. Miss two days and it resets. This
 * encodes the only streak rule the research supports.
 */
export function applyEntry(game: GameState, entry: Entry, entryCount: number): StreakResult {
  const g: GameState = { ...game }
  const today = entry.date
  let freezeUsed = false

  if (g.lastDay !== today) {
    const gap = g.lastDay ? daysBetween(g.lastDay, today) : 1
    if (g.lastDay === null || gap === 1) {
      g.streak += 1
    } else if (gap === 2 && g.freezes > 0) {
      g.freezes -= 1
      g.streak += 1
      freezeUsed = true
    } else {
      g.streak = 1
    }
    g.lastDay = today
    if (g.streak > g.best) g.best = g.streak
  }

  // XP rewards depth of the loop, not raw volume.
  let gained = 20
  if (entry.well.trim()) gained += 5
  if (entry.next.trim()) gained += 5
  if (entry.emotions.length) gained += 5

  g.xp += gained
  let leveledUp = false
  while (g.xp >= xpForLevel(g.level)) {
    g.xp -= xpForLevel(g.level)
    g.level += 1
    leveledUp = true
  }

  // Refill one freeze every 7 entries, capped at 1.
  if (entryCount > 0 && entryCount % 7 === 0 && g.freezes < 1) g.freezes = 1

  return { game: g, freezeUsed, leveledUp, gained }
}

/** Entries in the trailing 7 days — gates the weekly review. */
export const weekCount = (entries: Entry[]): number => {
  const cutoff = Date.now() - 6 * 86400000
  return entries.filter((e) => e.ts >= cutoff).length
}

export const WEEKLY_UNLOCK = 5
export const MONTHLY_UNLOCK = 4
