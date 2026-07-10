import type { AppState, CoachClose, CoachKind, CoachMemo, CoachMemory, CoachProfile, CoachReply, Entry, Settings } from './types'
import { anonKey, supabase } from './supabase'
import { curate } from './coachMemory'
import type { NudgeDraft } from './guidance'
import type { WeeklyAnswers, Woop } from './weekly'

const COACH_URL = import.meta.env.VITE_COACH_URL as string | undefined

/** A real Coach endpoint is configured. Without it, direct feedback is skipped entirely. */
export const aiEnabled = (): boolean => Boolean(COACH_URL)

const KINDS: CoachKind[] = [
  'rumination', 'distancing', 'pattern', 'fear_setting',
  'agency', 'celebration', 'accountability', 'followup',
]
const asKind = (k: unknown): CoachKind => (KINDS.includes(k as CoachKind) ? (k as CoachKind) : 'followup')

/**
 * Prefer the signed-in user's token; fall back to the anon key so the
 * function is callable even before the anonymous session resolves.
 */
async function authHeaders(): Promise<Record<string, string>> {
  let token = anonKey
  if (supabase) {
    const { data } = await supabase.auth.getSession()
    token = data.session?.access_token ?? anonKey
  }
  if (!token) return {}
  return { Authorization: `Bearer ${token}`, apikey: anonKey ?? token }
}

/** Tonight's reply plus what Coach learned, to fold into local memory. */
export interface DailyResult {
  reply: CoachReply
  memo: CoachMemo | null
}

/** Coach's final line after the user's one optional answer. */
export interface AnswerResult {
  close: CoachClose
  memo: CoachMemo | null
}

/**
 * Direct feedback is an ONLINE-ONLY event. The server triages tonight's entry,
 * routes it to the right model (Haiku / Sonnet 5 / Opus 4.8), loads the matching
 * expert, and replies in the user's voice using the memory we send. Returns null
 * on any failure — the caller then simply skips (the reflection is already saved).
 *
 * `history` is the prior nights (newest-first, excluding tonight); `coach` is the
 * local memory. Both are curated here into a compact, bounded payload.
 */
export async function fetchCoachReply(
  entry: Entry,
  history: Entry[],
  settings: Settings,
  coach: CoachMemory,
  monthTheme?: string,
): Promise<DailyResult | null> {
  if (!COACH_URL) return null
  const curated = curate(history, coach)
  try {
    const res = await fetch(COACH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({
        mode: 'daily',
        name: settings.name,
        tone: settings.tone,
        entry: { event: entry.event, emotions: entry.emotions, well: entry.well, next: entry.next },
        morning: entry.morning ?? null,
        history: curated.history,
        recall: curated.recall,
        memory: { ...curated.memory, monthTheme },
      }),
    })
    if (!res.ok) throw new Error(`coach ${res.status}`)
    const data = (await res.json()) as { text?: string; lesson?: string; kind?: string; memo?: CoachMemo; meta?: CoachReply['meta'] }
    if (!data.text) throw new Error('empty reply')
    return {
      reply: { text: data.text, lesson: data.lesson, kind: asKind(data.kind), source: 'ai', meta: data.meta },
      memo: data.memo ?? null,
    }
  } catch (err) {
    console.warn('[facet] Coach unavailable, will read this on reconnect:', err)
    return null
  }
}

/**
 * The optional answer turn is deliberately bounded: the answer is already
 * persisted by the caller before this request starts, and a failure simply
 * leaves the entry with no close. Closes are never queued for catch-up.
 */
export async function fetchCoachClose(
  entry: Entry,
  history: Entry[],
  settings: Settings,
  coach: CoachMemory,
): Promise<AnswerResult | null> {
  if (!COACH_URL || !entry.coach || !entry.coachAnswer) return null
  const { memory } = curate(history, coach)
  try {
    const res = await fetch(COACH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({
        mode: 'answer',
        name: settings.name,
        entry: { event: entry.event, emotions: entry.emotions, well: entry.well, next: entry.next },
        reply: { text: entry.coach.text, kind: entry.coach.kind },
        answer: entry.coachAnswer,
        memory,
      }),
    })
    if (!res.ok) throw new Error(`coach ${res.status}`)
    const data = (await res.json()) as { close?: string; memo?: CoachMemo; meta?: CoachClose['meta'] }
    if (!data.close) throw new Error('empty close')
    return {
      close: { text: data.close, source: 'ai', meta: data.meta },
      memo: data.memo ?? null,
    }
  } catch (err) {
    console.warn('[facet] Coach could not close this answer:', err)
    return null
  }
}

/** The onboarding First Read plus the profile Opus extracts from intake. */
export interface FirstReadResult {
  reply: CoachReply
  profileDelta: Partial<CoachProfile> | null
}

/**
 * The First Read — one Opus 4.8 call at the very start, the strongest first
 * impression. Returns null offline/unconfigured; the caller then shows a
 * deterministic read stitched from the intake, so the moment still lands.
 */
export async function fetchFirstRead(
  answers: { name: string; goals: string[]; world: string; obstacle: string; cue: string },
  entry: Entry,
  settings: Settings,
): Promise<FirstReadResult | null> {
  if (!COACH_URL) return null
  try {
    const res = await fetch(COACH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({
        mode: 'onboarding',
        name: settings.name,
        answers: { goals: answers.goals, world: answers.world, obstacle: answers.obstacle, cue: answers.cue },
        entry: { event: entry.event, emotions: entry.emotions, well: entry.well, next: entry.next },
      }),
    })
    if (!res.ok) throw new Error(`coach ${res.status}`)
    const data = (await res.json()) as { text?: string; profileDelta?: Partial<CoachProfile>; meta?: CoachReply['meta'] }
    if (!data.text) throw new Error('empty first read')
    return {
      reply: { text: data.text, kind: 'celebration', source: 'ai', meta: data.meta },
      profileDelta: data.profileDelta ?? null,
    }
  } catch (err) {
    console.warn('[facet] first read unavailable, using local:', err)
    return null
  }
}

/**
 * The occasional nudge — Opus 4.8 reviews the recent nights + memory and decides
 * whether there's ONE genuinely useful thing to offer right now. Online-only,
 * with thinking (it's a judgement call, and rare enough that cost is a non-issue).
 * Returns a draft, `'skip'` when Coach judges nothing meaningful to say, or null
 * on any failure — the caller then falls back to the local library.
 */
export async function fetchNudge(state: AppState): Promise<NudgeDraft | 'skip' | null> {
  if (!COACH_URL) return null
  const { memory } = curate(state.entries, state.coach)
  const avoid = state.nudges.map((n) => n.title)
  try {
    const res = await fetch(COACH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({
        mode: 'guidance',
        name: state.settings.name,
        nights: Math.max(state.game.best, state.game.streak),
        entries: state.entries.slice(0, 10).map((e) => ({
          date: e.date, event: e.event, emotions: e.emotions, well: e.well, next: e.next, kind: e.coach?.kind,
        })),
        memory,
        avoid,
      }),
    })
    if (!res.ok) throw new Error(`coach ${res.status}`)
    const data = (await res.json()) as {
      skip?: boolean; kind?: NudgeDraft['kind']; title?: string; body?: string; value?: string; source?: NudgeDraft['source']
    }
    if (data.skip || !data.title || !data.body || !data.value || !data.kind) return 'skip'
    return { kind: data.kind, title: data.title, body: data.body, value: data.value, source: data.source }
  } catch (err) {
    console.warn('[facet] nudge unavailable, using local library:', err)
    return null
  }
}

/** The weekly read plus the COMPLETE revised profile Opus returns. */
export interface WeeklyResult {
  text: string
  profile: Partial<CoachProfile> | null
}

/**
 * Weekly synthesis — online-only, always Opus 4.8 with thinking. Returns null
 * when offline/unconfigured so Reviews can skip minting rather than fabricate.
 * With `extras` (the guided review), Coach builds on the USER's own answers
 * and pressure-tests their WOOP; without (the quiet memory pass), as before.
 */
export async function getWeeklyInsight(
  entries: Entry[],
  settings: Settings,
  coach: CoachMemory,
  extras?: { review: WeeklyAnswers; woop: Woop },
): Promise<WeeklyResult | null> {
  if (!COACH_URL) return null
  const { memory } = curate(entries, coach)
  try {
    const res = await fetch(COACH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({
        mode: 'weekly',
        name: settings.name,
        entries: entries.slice(0, 7).map((e) => ({
          date: e.date, event: e.event, emotions: e.emotions, well: e.well, next: e.next,
        })),
        memory,
        review: extras?.review ?? null,
        woop: extras?.woop ?? null,
      }),
    })
    if (!res.ok) throw new Error(`coach ${res.status}`)
    const data = (await res.json()) as { text?: string; profile?: Partial<CoachProfile>; profileDelta?: Partial<CoachProfile> }
    if (!data.text) throw new Error('empty weekly read')
    return { text: data.text, profile: data.profile ?? data.profileDelta ?? null }
  } catch (err) {
    console.warn('[facet] weekly read unavailable:', err)
    return null
  }
}

/** The monthly arc's drafted trajectory + a suggested theme + the full revision. */
export interface MonthlyResult {
  text: string
  theme: string | null
  profile: Partial<CoachProfile> | null
}

/**
 * The monthly arc — online-only, Opus 4.8 with thinking. Coach drafts the
 * month's trajectory + a theme suggestion + a full profile revision from the
 * month's nights, the weekly reads, and (when re-sent) the user's own work.
 * Returns null offline/unconfigured so the flow can hold.
 */
export async function getMonthlyArc(
  entries: Entry[],
  cards: string[],
  settings: Settings,
  coach: CoachMemory,
  answers?: { trajectory: string; gap: string; fear: string; theme: string },
): Promise<MonthlyResult | null> {
  if (!COACH_URL) return null
  const { memory } = curate(entries, coach)
  try {
    const res = await fetch(COACH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({
        mode: 'monthly',
        name: settings.name,
        entries: entries.slice(0, 30).map((e) => ({
          date: e.date, event: e.event, emotions: e.emotions, well: e.well, next: e.next,
        })),
        cards: cards.slice(0, 6),
        memory,
        answers: answers ?? null,
      }),
    })
    if (!res.ok) throw new Error(`coach ${res.status}`)
    const data = (await res.json()) as { text?: string; theme?: string; profile?: Partial<CoachProfile> }
    if (!data.text) throw new Error('empty monthly read')
    return { text: data.text, theme: data.theme ?? null, profile: data.profile ?? null }
  } catch (err) {
    console.warn('[facet] monthly arc unavailable:', err)
    return null
  }
}
