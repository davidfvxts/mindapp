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
const NARRATIVE_CAP = 900 // ~130 words: the running note stays a note
const COMMITMENT_TTL_DAYS = 3 // an unmet intention ages out rather than nagging forever

const clean = (s: string): string => s.replace(/\s+/g, ' ').trim()
const uniq = (xs: string[]): string[] => Array.from(new Set(xs))
const cap = (xs: string[], n = MAX_LIST): string[] => xs.slice(0, n)

/** The compact memory Coach receives with a daily reflection. */
export interface CuratedMemory {
  /** Coach's running note on who they are — prepended to every call. */
  narrative?: string
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

/** The intention that aged out unresolved and awaits the user's call. */
export const staleCommitment = (m: CoachMemory): Commitment | null =>
  m.commitments.find((c) => c.status === 'stale') ?? null

// ---- recall matching: stem-lite, dependency-free ----
// A theme should recall "the investors ghosted us" from the key "investor".
// Tokens match when equal, or when both run ≥5 chars and share their first
// five — a crude stem that survives plurals, inflections, and compounds in
// English and German alike. Multi-word themes need half their real words hit.
// Mirrored in supabase/functions/coach/logic.ts for the server-side pattern echo.
const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'my', 'our', 'der', 'die', 'das', 'und', 'mit', 'ein', 'eine'])
const tokens = (s: string): string[] =>
  s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 3 && !STOP.has(t))
const tokenMatch = (a: string, b: string): boolean =>
  a === b || (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5))

/** True when the text plausibly echoes the theme, rephrasings included. */
export function themeMatches(themeKey: string, text: string): boolean {
  const keyToks = tokens(themeKey)
  if (!keyToks.length) return false
  const textToks = tokens(text)
  const hits = keyToks.filter((k) => textToks.some((t) => tokenMatch(k, t))).length
  return hits >= Math.ceil(keyToks.length / 2)
}

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
    .filter((e) => topKeys.some((k) => themeMatches(k, e.event)))
    .slice(0, OLDER_RECALL)
    .map((e) => ({ date: e.date, event: e.event }))

  const p = m.profile
  const open = openCommitment(m)
  return {
    history,
    recall,
    memory: {
      narrative: p.narrative,
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
  // An intention past its TTL doesn't die silently — the newest one goes
  // STALE and waits for the user's call in Guidance (still on / let go);
  // anything older than that quietly retires. One renegotiation at a time.
  let staled = commitments.some((c) => c.status === 'stale')
  for (const c of commitments) {
    if (c.status === 'open' && daysBetween(c.date, today) > COMMITMENT_TTL_DAYS) {
      c.status = staled ? 'dropped' : 'stale'
      staled = true
    }
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

/**
 * The user's call on a stale intention: still on (re-armed as tonight's owed
 * intention, dated today) or let go (retired, no guilt, no trace of blame).
 */
export function renegotiateCommitment(m: CoachMemory, keep: boolean, today: string): CoachMemory {
  const commitments = m.commitments.map((c) =>
    c.status === 'stale' ? { ...c, status: keep ? ('open' as const) : ('dropped' as const), date: keep ? today : c.date } : c,
  )
  return { ...m, commitments }
}

/** What each intervention feels like from the user's side — the vocabulary of
 *  landed/avoided, so ratings teach Coach which MOVES work on this person. */
const KIND_MOVE: Record<string, string> = {
  rumination: 'the "what, not why" rewrite',
  distancing: 'the second-person reframe',
  pattern: 'naming a recurring pattern',
  fear_setting: 'the fear-setting push',
  agency: 'pointing at their own hand in it',
  celebration: 'marking the win',
  accountability: 'holding them to an intention',
  followup: 'sharpening tomorrow\u2019s move',
}

/**
 * Fold a reply rating into what Coach knows lands. Deliberate and rare, so one
 * signal is enough: "That's right" files the move under landed (and clears it
 * from avoided); "Not quite" the reverse. Latest verdict wins. This is how
 * Coach gets measurably better per week of use — without waiting for the
 * weekly pass.
 */
export function foldRating(m: CoachMemory, kind: string | undefined, rating: 0 | 1): CoachMemory {
  const move = kind ? KIND_MOVE[kind] : undefined
  if (!move) return m
  const p = m.profile
  const landed = (p.landed ?? []).filter((x) => x !== move)
  const avoided = (p.avoided ?? []).filter((x) => x !== move)
  if (rating === 1) landed.unshift(move)
  else avoided.unshift(move)
  return { ...m, profile: { ...p, landed: cap(landed), avoided: cap(avoided) } }
}

/**
 * The weekly pass owns the profile: it receives the CURRENT profile and returns
 * the COMPLETE revised one — keeping what holds, revising what shifted, and
 * REMOVING what no longer fits (an omitted field is a removal). Deliberate
 * forgetting, instead of stale goals surviving by accident. A degenerate reply
 * (nothing recognisable in it) leaves memory untouched.
 */
export function applyWeeklyRevision(
  m: CoachMemory,
  revision: Partial<CoachProfile> | null | undefined,
  today: string,
): CoachMemory {
  if (!revision) return m
  const any =
    !!revision.narrative?.trim() || !!revision.voice?.trim() ||
    !!revision.values?.length || !!revision.goals?.length || !!revision.obstacles?.length ||
    !!revision.projects?.length || !!revision.relationships?.length
  if (!any) return m
  const list = (xs?: string[]): string[] | undefined =>
    xs?.length ? cap(uniq(xs.map(clean).filter(Boolean))) : undefined
  return {
    ...m,
    profile: {
      narrative: revision.narrative ? clean(revision.narrative).slice(0, NARRATIVE_CAP) : undefined,
      voice: revision.voice ? clean(revision.voice).slice(0, VOICE_CAP) : m.profile.voice,
      values: list(revision.values),
      goals: list(revision.goals),
      obstacles: list(revision.obstacles),
      relationships: list(revision.relationships),
      projects: list(revision.projects),
      landed: list(revision.landed) ?? m.profile.landed,
      avoided: list(revision.avoided) ?? m.profile.avoided,
      updatedAt: today,
    },
  }
}

/** Convenience: are any emotions charged? (mirrors the server triage). */
export const isCharged = (emotions: string[]): boolean =>
  emotions.some((e) => (CHARGED as string[]).includes(e))
