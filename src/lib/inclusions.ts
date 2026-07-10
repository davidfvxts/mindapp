import { CHARGED, type Entry, type ThemeLedgerEntry } from './types'
import { themeMatches } from './coachMemory'
import type { Stone } from './milestones'

/*
 * Inclusions — the marked points inside a banked stone. Tapping one surfaces
 * the user's own words from a night within that stone's span, so the Vault is
 * a container of reflections, not a badge (CLAUDE.md §5). Pure and
 * deterministic: the same stone always yields the same points, and every point
 * is a real night the user actually wrote — nothing invented.
 *
 * A stone earned at Night N covers the nights since the previous milestone.
 * We map the i-th oldest reflection to Night i (a light approximation that
 * ignores exact freeze accounting — good enough to surface a true past night,
 * never off by more than the freezes used).
 */

const POSITIVE = ['Proud', 'Energized', 'Excited', 'Grateful']
const isCharged = (e: Entry): boolean => e.emotions.some((x) => (CHARGED as string[]).includes(x))
const isWin = (e: Entry): boolean => !isCharged(e) && e.emotions.some((x) => POSITIVE.includes(x))

export interface Inclusion {
  label: string
  date: string
  event: string
}

/**
 * 1–4 marked points for a stone, chosen deterministically from the nights in
 * its span: the night it formed, the hardest and the clearest nights, and where
 * a recurring theme first surfaced. Presented oldest → newest.
 */
export function inclusionsForStone(
  entries: Entry[],
  stone: Stone,
  prevNight: number,
  themes: ThemeLedgerEntry[],
): Inclusion[] {
  // Oldest-first, so index i ≈ Night i+1.
  const chrono = [...entries].sort((a, b) => a.ts - b.ts)
  const span = chrono.slice(prevNight, stone.night) // nights (prevNight, stone.night]
  if (!span.length) return []

  const picks: Inclusion[] = []
  const seen = new Set<string>()
  const add = (e: Entry | undefined, label: string) => {
    if (!e || seen.has(e.date)) return
    seen.add(e.date)
    picks.push({ label, date: e.date, event: e.event })
  }

  // The night it took shape — the last reflection in the span.
  add(span[span.length - 1], 'The night it took shape')
  // The hardest night, and the clearest one.
  add(span.find(isCharged), 'A hard one')
  add(span.find(isWin), 'A clear one')
  // Where the span's most-established theme first surfaced.
  const topTheme = [...themes].sort((a, b) => b.count - a.count)[0]
  if (topTheme) add(span.find((e) => themeMatches(topTheme.key, e.event)), `Where “${topTheme.key}” began`)

  return picks
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 4)
}

/** The Night the previous stone was earned (0 before the first). */
export const prevMilestoneNight = (stones: readonly Stone[], stone: Stone): number => {
  const earlier = stones.filter((s) => s.night < stone.night)
  return earlier.length ? earlier[earlier.length - 1].night : 0
}
