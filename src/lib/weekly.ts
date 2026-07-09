import { daysBetween, WEEKLY_UNLOCK } from './game'

/*
 * The weekly review — pure pacing logic. The review is the USER's work
 * (AAR: the participant does the review; Coach only structures it), so two
 * clocks run here:
 *
 * - `weeklyReady`: a week is gathered (≥ WEEKLY_UNLOCK nights in the trailing
 *   seven) and the last guided review is far enough back. Drives the quiet
 *   tab marker and opens the flow.
 * - `quietSynthesisDue`: the week has been ready for a while and untouched —
 *   Coach reads it in the background for MEMORY ONLY (profileDelta folds in;
 *   no card, nothing shown), so a user who ignores the Reviews tab still has
 *   a Coach that keeps learning. A quiet pass never blocks or replaces the
 *   guided review — the ready marker stays on.
 */

export const REVIEW_GAP = 5 // nights between guided reviews
export const QUIET_AFTER = 8 // ready-but-untouched this long → memory-only pass

/** The user's own answers to the three review prompts. */
export interface WeeklyAnswers {
  wins: string
  friction: string
  avoided: string
}

/** Next week's intention, in WOOP form (Oettingen). */
export interface Woop {
  wish: string
  outcome: string
  /** Must be the INTERNAL obstacle — avoidance, perfectionism, distraction. */
  obstacle: string
  /** The if-then plan (Gollwitzer). */
  plan: string
}

export function weeklyReady(weekEntries: number, lastReview: string | null, today: string): boolean {
  return weekEntries >= WEEKLY_UNLOCK && (!lastReview || daysBetween(lastReview, today) >= REVIEW_GAP)
}

export function quietSynthesisDue(
  weekEntries: number,
  lastReview: string | null,
  lastSynthesis: string | null,
  today: string,
): boolean {
  if (weekEntries < WEEKLY_UNLOCK) return false
  if (lastReview && daysBetween(lastReview, today) < QUIET_AFTER) return false
  if (lastSynthesis && daysBetween(lastSynthesis, today) < QUIET_AFTER) return false
  return true
}
