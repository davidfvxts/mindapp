import { CHARGED, type Entry, type ThemeLedgerEntry } from './types'
import { themeMatches } from './coachMemory'
import { STONES, stoneForNight, type Stone } from './milestones'

/*
 * Inclusions — the marked points inside a banked stone. Tapping one surfaces
 * the user's own words from a night within that stone's span, so the Vault is
 * a container of reflections, not a badge (CLAUDE.md §5). Pure and
 * deterministic: the same stone always yields the same points, and every point
 * is a real night the user actually wrote — nothing invented.
 *
 * A stone earned at Night N covers the nights since the previous milestone.
 * We map the i-th oldest reflection to Night i, which is an exact history now
 * that a completed first reflection always adds one Night.
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

/**
 * The milestone ceremony's callback: the user's own words from the FIRST
 * night of the span the stone just closed — quoted exactly, never invented
 * (CLAUDE.md, the callback rule). Null off milestones or when the night's
 * words are missing.
 */
export function milestoneEcho(entries: Entry[], night: number): { night: number; words: string } | null {
  const stone = stoneForNight(night)
  if (!stone) return null
  const firstNight = prevMilestoneNight(STONES, stone) + 1
  const chrono = [...entries].sort((a, b) => a.ts - b.ts)
  // The i-th-oldest ↔ Night i mapping only holds when the history is whole —
  // never risk quoting the wrong night as if it were the first.
  if (chrono.length < stone.night) return null
  const e = chrono[firstNight - 1]
  const words = e?.event?.trim()
  if (!words) return null
  return {
    night: firstNight,
    words: words.length > 72 ? words.slice(0, 71).trimEnd() + '…' : words,
  }
}
