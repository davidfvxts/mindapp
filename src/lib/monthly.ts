import { daysBetween } from './game'
import type { CoachMemory, Entry } from './types'

/*
 * The monthly arc — pure pacing + the "live decision" signal. The arc is the
 * deepest layer of the research (Reflection-System-2026.md Part 4): trajectory,
 * an identity/Integrity check (Clear), fear-setting on an avoided decision
 * (Ferriss), and one theme for the month ahead. It opens on material rather
 * than perfect review completion, then stays spaced so it cannot run twice in
 * a month.
 */

export const ARC_GAP = 21 // nights between monthly arcs
export const MONTHLY_NIGHT = 30
export const MONTHLY_WEEKLY_READS = 2
export const MONTHLY_TRAILING_NIGHTS = 20
export const MONTHLY_WINDOW_DAYS = 35

/** The user's own work in the arc — layered on Coach's drafted trajectory. */
export interface MonthlyAnswers {
  /** Coach's trajectory read, confirmed or edited by the user. */
  trajectory: string
  /** Clear's Integrity Report: the one specific values-vs-lived gap. */
  gap: string
  /** Ferriss fear-setting on the avoided decision — blank if none is live. */
  fear: string
  /** The one theme for the month ahead. */
  theme: string
}

/** Distinct nights with entries in the trailing window; extra notes never inflate material. */
export function trailingEntryNights(entries: Pick<Entry, 'date'>[], today: string): number {
  const dates = new Set(
    entries
      .filter((entry) => {
        const age = daysBetween(entry.date, today)
        return age >= 0 && age < MONTHLY_WINDOW_DAYS
      })
      .map((entry) => entry.date),
  )
  return dates.size
}

export function monthlyReady(
  nights: number,
  weeklyReads: number,
  trailingNights: number,
  lastArc: string | null,
  today: string,
): boolean {
  const hasMaterial = weeklyReads >= MONTHLY_WEEKLY_READS || trailingNights >= MONTHLY_TRAILING_NIGHTS
  return nights >= MONTHLY_NIGHT && hasMaterial && (!lastArc || daysBetween(lastArc, today) >= ARC_GAP)
}

/**
 * The decision the user keeps circling, if one is live in memory — an open or
 * stale intention, or a recent fear-setting that never resolved. Drives whether
 * the arc shows its fear-setting step at all.
 */
export function liveDecision(coach: CoachMemory): string | null {
  const owed = coach.commitments.find((c) => c.status === 'open' || c.status === 'stale')
  return owed?.text ?? null
}
