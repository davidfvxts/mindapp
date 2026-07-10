import { daysBetween, MONTHLY_UNLOCK } from './game'
import type { CoachMemory } from './types'

/*
 * The monthly arc — pure pacing + the "live decision" signal. The arc is the
 * deepest layer of the research (Reflection-System-2026.md Part 4): trajectory,
 * an identity/Integrity check (Clear), fear-setting on an avoided decision
 * (Ferriss), and one theme for the month ahead. Gated on weekly reads gathered
 * (MONTHLY_UNLOCK) and spaced so it can't run twice in a month.
 */

export const ARC_GAP = 21 // nights between monthly arcs

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

export function monthlyReady(cardCount: number, lastArc: string | null, today: string): boolean {
  return cardCount >= MONTHLY_UNLOCK && (!lastArc || daysBetween(lastArc, today) >= ARC_GAP)
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
