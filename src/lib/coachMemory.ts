import { daysBetween } from './game'
import { CHARGED } from './types'
import type {
  CoachMemory,
  CoachMemo,
  CoachProfile,
  Commitment,
  Entry,
  ThemeLedgerEntry,
} from './types'

/*
 * Local-first coach memory. All pure, all bounded — this is what lets Coach
 * know who the user is (profile), what keeps coming up (theme ledger, with
 * recency AND longevity), and what they said they'd do (commitments), without
 * any server state. Unit-tested in scripts/test-coach.ts.
 */

const RECENT = 8 // verbatim recent entries sent to Coach
const OLDER_RECALL = 3 // older entries surfaced because a live theme echoes them
const MAX_THEMES = 24
const MAX_COMMITMENTS = 12
const MAX_LIST = 8 // per profile array
const VOICE_CAP = 280
const COMMITMENT_TTL_DAYS = 3 // an unmet intention ages out rather than nagging forever

const clean = (s: string): string => s.replace(/\s+/g, ' ').trim()
const uniq = (xs: string[]): string[] => Array.from(new Set(xs))
const cap = (xs: string[], n = MAX_LIST): string[] => xs.slice(0, n)

/** The compact memory Coach receives with a daily reflection. */
export interface CuratedMemory {
  voice?: string
  values?: string[]
  goals?: string[]
  obstacles?: string[]
  relationships?: string[]
  projects?: string[]
  landed?: string[]
  avoided?: string[]
  /** Recurring topics, most-recent first — the recency + longevity signal. */
  themes: ThemeLedgerEntry[]
  /** The intention still owed from a previous night, if any. */
  openCommitment: { text: string; date: string } | null
}

export interface HistoryLite {
  date: string
  event: string
  emotions: string[]
  well: string
  next: string
  rating?: 0 | 1
  kind?: string
  /** The optional answer and close are part of the night's actual coaching record. */
  answer?: string
  close?: string
}

export interface Curated {
  history: HistoryLite[]
  /** Older entries whose words echo a live theme — Coach's long-memory callback. */
  recall: { date: string; event: string }[]
  memory: CuratedMemory
}

const liteOf = (e: Entry): HistoryLite => ({
  date: e.date,
  event: e.event,
  emotions: e.emotions,
  well: e.well,
  next: e.next,
  rating: e.rating,
  kind: e.coach?.kind,
  answer: e.coachAnswer,
  close: e.coachClose?.text,
})

const openCommitment = (m: CoachMemory): Commitment | null =>
  m.commitments.find((c) => c.status === 'open') ?? null

/**
 * Build everything Coach needs about the past: recent nights verbatim (recency),
 * older nights that echo a live theme (long-ago recall), and the memory profile.
 * `entries` are newest-first.
 */
export function curate(entries: Entry[], m: CoachMemory): Curated {
  const history = entries.slice(0, RECENT).map(liteOf)

  const topKeys = [...m.themes]
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)
    .map((t) => t.key)
  const recall = entries
    .slice(RECENT)
    .filter((e) => topKeys.some((k) => e.event.toLowerCase().includes(k)))
    .slice(0, OLDER_RECALL)
    .map((e) => ({ date: e.date, event: e.event }))

  const p = m.profile
  const open = openCommitment(m)
  return {
    history,
    recall,
    memory: {
      voice: p.voice,
      values: p.values,
      goals: p.goals,
      obstacles: p.obstacles,
      relationships: p.relationships,
      projects: p.projects,
      landed: p.landed,
      avoided: p.avoided,
      themes: [...m.themes].sort((a, b) => (a.last < b.last ? 1 : -1)).slice(0, 12),
      openCommitment: open ? { text: open.text, date: open.date } : null,
    },
  }
}

function foldThemes(themes: ThemeLedgerEntry[], tags: string[], today: string): ThemeLedgerEntry[] {
  const next = themes.map((t) => ({ ...t }))
  for (const raw of tags) {
    const key = clean(raw).toLowerCase().slice(0, 40)
    if (!key) continue
    const hit = next.find((t) => t.key === key)
    if (hit) {
      hit.count += 1
      hit.last = today
    } else {
      next.push({ key, count: 1, first: today, last: today })
    }
  }
  // Keep the freshest, then the most-established; drop the stale tail.
  return next
    .sort((a, b) => (a.last === b.last ? b.count - a.count : a.last < b.last ? 1 : -1))
    .slice(0, MAX_THEMES)
}

/**
 * Record tonight's "one thing I'll do differently" as the newly-owed intention,
 * and age out anything left open too long. Runs on EVERY completed reflection —
 * online or offline — so accountability survives with no network. Call this
 * AFTER applyMemo, so the previously-owed intention is resolved first.
 */
export function recordCommitment(m: CoachMemory, entry: Entry, today: string): CoachMemory {
  const commitments = m.commitments.map((c) => ({ ...c }))
  for (const c of commitments) {
    if (c.status === 'open' && daysBetween(c.date, today) > COMMITMENT_TTL_DAYS) c.status = 'dropped'
  }
  const text = clean(entry.next)
  const hasSame = commitments.some((c) => c.status === 'open' && c.text === text)
  if (text && !hasSame) commitments.unshift({ date: today, text, status: 'open' })
  return { ...m, commitments: commitments.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, MAX_COMMITMENTS) }
}

/**
 * Fold a reply's memo into memory: recurring themes, the running voice read, and
 * — when `resolveCommitment` — the outcome of the previously-owed intention.
 * Deferred (catch-up) replies pass `resolveCommitment: false` so a late reply
 * can't resolve the wrong (newer) intention.
 */
export function applyMemo(
  m: CoachMemory,
  memo: CoachMemo | null | undefined,
  today: string,
  resolveCommitment: boolean,
): CoachMemory {
  const memoSafe = memo ?? {}
  const commitments = m.commitments.map((c) => ({ ...c }))
  if (resolveCommitment) {
    const owed = commitments.find((c) => c.status === 'open')
    if (owed && memoSafe.commitment === 'kept') owed.status = 'kept'
    else if (owed && memoSafe.commitment === 'dropped') owed.status = 'dropped'
  }
  const profile: CoachProfile = { ...m.profile }
  const hint = memoSafe.voiceHint ? clean(memoSafe.voiceHint).slice(0, VOICE_CAP) : ''
  if (hint) {
    profile.voice = hint
    profile.updatedAt = today
  }
  return { profile, themes: foldThemes(m.themes, memoSafe.themes ?? [], today), commitments }
}

const mergeList = (prev: string[] | undefined, add: string[] | undefined): string[] | undefined => {
  if (!add?.length) return prev
  return cap(uniq([...add.map(clean).filter(Boolean), ...(prev ?? [])]))
}

/** Fold the weekly Opus pass's identity revision into memory. */
export function mergeWeeklyDelta(
  m: CoachMemory,
  delta: Partial<CoachProfile> | undefined,
  today: string,
): CoachMemory {
  if (!delta) return m
  const p = m.profile
  return {
    ...m,
    profile: {
      voice: delta.voice ? clean(delta.voice).slice(0, VOICE_CAP) : p.voice,
      values: mergeList(p.values, delta.values),
      goals: mergeList(p.goals, delta.goals),
      obstacles: mergeList(p.obstacles, delta.obstacles),
      relationships: mergeList(p.relationships, delta.relationships),
      projects: mergeList(p.projects, delta.projects),
      landed: mergeList(p.landed, delta.landed),
      avoided: mergeList(p.avoided, delta.avoided),
      updatedAt: today,
    },
  }
}

/** Convenience: are any emotions charged? (mirrors the server triage). */
export const isCharged = (emotions: string[]): boolean =>
  emotions.some((e) => (CHARGED as string[]).includes(e))
