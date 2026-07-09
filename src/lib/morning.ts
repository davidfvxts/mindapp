import { daysBetween } from './game'
import type { Commitment } from './types'

/*
 * The loop beyond 11pm — pure helpers for what greets the user when they
 * open the app during the day.
 *
 * Morning surface (Gollwitzer): the intention written at night is worth most
 * at the moment of execution — the next day. `intentionForToday` returns the
 * open intention when it was written one or two nights ago (two covers a
 * bridged night); anything older belongs to a lapse, and the comeback moment
 * owns that instead.
 *
 * Comeback (never punish): after two or more missed nights the streak has
 * reset, and the user should meet a designed, guilt-free re-entry — once per
 * lapse, tracked by acknowledging the `lastDay` the lapse happened after.
 */

/** Last night's "one thing I'll do differently", if it's due today. */
export function intentionForToday(commitments: Commitment[], today: string): string | null {
  const open = commitments.find((c) => c.status === 'open')
  if (!open) return null
  const age = daysBetween(open.date, today)
  return age >= 1 && age <= 2 ? open.text : null
}

/** Whole nights missed between the last reflection and today. */
export const missedNights = (lastDay: string | null, today: string): number =>
  lastDay ? Math.max(0, daysBetween(lastDay, today) - 1) : 0

/**
 * True when the user returns from a real lapse (≥2 missed nights — one miss
 * is bridged by never-miss-twice) and hasn't been welcomed back for it yet.
 */
export function needsComeback(lastDay: string | null, today: string, ack: string | null): boolean {
  return !!lastDay && missedNights(lastDay, today) >= 2 && ack !== lastDay
}
