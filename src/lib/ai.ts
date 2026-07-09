import type { CoachReply, Entry, Settings } from './types'
import { anonKey, supabase } from './supabase'

const COACH_URL = import.meta.env.VITE_COACH_URL as string | undefined

/** A real Coach endpoint is configured. Without it, direct feedback is skipped entirely. */
export const aiEnabled = (): boolean => Boolean(COACH_URL)

/**
 * Prefer the signed-in user's token; fall back to the anon key so the
 * function is callable even before the anonymous session resolves. Both are
 * valid JWTs to the Functions gateway.
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

/**
 * Direct feedback is an ONLINE-ONLY event. Ask Coach (the Edge Function that
 * holds the Anthropic key server-side) for a read. Returns null on any failure
 * — offline, missing key, network blip — and the caller simply skips the reply
 * rather than showing a degraded stand-in. The reflection itself is already
 * saved locally; nothing here can cost the user their words or their Night.
 */
export async function fetchCoachReply(
  entry: Entry,
  history: Entry[],
  settings: Settings,
): Promise<CoachReply | null> {
  if (!COACH_URL) return null
  try {
    const res = await fetch(COACH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({
        mode: 'daily',
        name: settings.name,
        tone: settings.tone,
        entry: {
          event: entry.event,
          emotions: entry.emotions,
          well: entry.well,
          next: entry.next,
        },
        history: history.slice(0, 10).map((h) => ({
          date: h.date,
          event: h.event,
          emotions: h.emotions,
        })),
      }),
    })
    if (!res.ok) throw new Error(`coach ${res.status}`)
    const data = (await res.json()) as Partial<CoachReply>
    if (!data.text) throw new Error('empty reply')
    return { text: data.text, lesson: data.lesson, kind: data.kind ?? 'followup', source: 'ai' }
  } catch (err) {
    console.warn('[facet] Coach unavailable, will read this on reconnect:', err)
    return null
  }
}

/**
 * Weekly synthesis — also online-only. Returns null when offline or unconfigured
 * so the Reviews screen can skip minting rather than fabricate a read.
 */
export async function getWeeklyInsight(
  entries: Entry[],
  settings: Settings,
): Promise<string | null> {
  if (!COACH_URL) return null
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
      }),
    })
    if (!res.ok) throw new Error(`coach ${res.status}`)
    const data = (await res.json()) as { text?: string }
    return data.text ?? null
  } catch (err) {
    console.warn('[facet] weekly read unavailable:', err)
    return null
  }
}
