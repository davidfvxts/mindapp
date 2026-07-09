import type { AppState, CoachKind, CoachMemo, CoachMemory, CoachProfile, CoachReply, Entry, Settings } from './types'
import { anonKey, supabase } from './supabase'
import { curate } from './coachMemory'
import type { NudgeDraft } from './guidance'

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
        memory: curated.memory,
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

/** The weekly read plus the identity revision Opus proposes. */
export interface WeeklyResult {
  text: string
  profileDelta: Partial<CoachProfile> | null
}

/**
 * Weekly synthesis — online-only, always Opus 4.8 with thinking. Returns null
 * when offline/unconfigured so Reviews can skip minting rather than fabricate.
 */
export async function getWeeklyInsight(
  entries: Entry[],
  settings: Settings,
  coach: CoachMemory,
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
      }),
    })
    if (!res.ok) throw new Error(`coach ${res.status}`)
    const data = (await res.json()) as { text?: string; profileDelta?: Partial<CoachProfile> }
    if (!data.text) throw new Error('empty weekly read')
    return { text: data.text, profileDelta: data.profileDelta ?? null }
  } catch (err) {
    console.warn('[facet] weekly read unavailable:', err)
    return null
  }
}
