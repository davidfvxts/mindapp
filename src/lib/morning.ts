import { daysBetween } from './game'
import type { Commitment, MorningNote } from './types'

/*
 * The loop beyond 11pm — pure helpers for what greets the user during the day.
 *
 * Morning surface (Gollwitzer): the intention written at night is worth most
 * at the moment of execution — the next day. `intentionForToday` returns the
 * open intention when it was written one or two nights ago (two covers a
 * bridged night); anything older belongs to a lapse, and the comeback moment
 * owns that instead.
 *
 * The Today bookend (~2 minutes): ONE specific win for the day (Locke &
 * Latham: specific, challenging daily goals; the evening AAR then debriefs
 * against a declared objective) plus Coach's ONE adaptive morning question.
 * The question is written the night before by the evening reply
 * (memo.morningQuestion — zero morning latency, works offline); when no
 * question arrived, `offlineMorningQuestion` draws from a deterministic
 * library keyed on real signals — and most clean days the right answer is
 * NO question. Questions belong to the morning (the night closes loops).
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

// ---------- the Today bookend ----------

const MAX_MORNINGS = 14

/** The ISO date after `date`. Noon-anchored to dodge DST edges. */
export const nextDay = (date: string): string => {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** The bookend belongs to daylight; at night the ritual owns the screen. */
export const isMorningWindow = (hour: number): boolean => hour >= 4 && hour < 18

/** Add or replace the day's note, newest first, bounded. */
export function upsertMorning(mornings: MorningNote[], note: MorningNote): MorningNote[] {
  return [note, ...mornings.filter((m) => m.date !== note.date)].slice(0, MAX_MORNINGS)
}

/** The live signals the offline question library keys on. */
export interface MorningCtx {
  /** Yesterday's entry carried charged emotions. */
  chargedYesterday: boolean
  /** The open intention and how many days it's been open. */
  owed: { text: string; age: number } | null
  /** A theme that keeps recurring (count ≥ 3), if any. */
  theme: string | null
}

/**
 * The deterministic fallback for Coach's morning question — used when last
 * night was offline (or keyless) so no question was written. One question,
 * keyed on a real signal; a clean day gets NONE. Never a "why" question.
 */
export function offlineMorningQuestion(c: MorningCtx): string | null {
  if (c.chargedYesterday) return 'Yesterday ran hot. What keeps today steady?'
  if (c.owed && c.owed.age >= 2) return `“${c.owed.text}” is still open. What makes it inevitable today?`
  if (c.theme) return `“${c.theme}” keeps coming up. What’s actually blocking it?`
  return null
}
