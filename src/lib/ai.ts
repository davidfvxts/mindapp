import { localCoach } from './coach'
import type { CoachReply, Entry, Settings } from './types'
import { supabase } from './supabase'

const COACH_URL = import.meta.env.VITE_COACH_URL as string | undefined

export const aiEnabled = (): boolean => Boolean(COACH_URL)

async function authHeader(): Promise<Record<string, string>> {
  if (!supabase) return {}
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * Ask Mira for feedback. Calls the Edge Function (which holds the Anthropic
 * key server-side). Falls back to the offline coach on any failure, so the
 * app is never blocked by the network or a missing key.
 */
export async function getCoachReply(
  entry: Entry,
  history: Entry[],
  settings: Settings,
): Promise<CoachReply> {
  if (!COACH_URL) return localCoach(entry, history, settings.name)

  try {
    const res = await fetch(COACH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
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
    return {
      text: data.text,
      lesson: data.lesson,
      kind: data.kind ?? 'followup',
      source: 'ai',
    }
  } catch (err) {
    console.warn('[mira] AI coach unavailable, using local coach:', err)
    return localCoach(entry, history, settings.name)
  }
}

/** Weekly synthesis -> an Insight Card. Uses the stronger model server-side. */
export async function getWeeklyInsight(
  entries: Entry[],
  settings: Settings,
): Promise<string> {
  const fallback = [
    'Your best entries this week were the most specific ones. Keep naming the moment.',
    'Energy dipped on the days you skipped the reflection. The habit is the lever.',
    'You shipped when you shrank the task. "Smallest version" is working for you.',
  ]
  if (!COACH_URL) return fallback[entries.length % fallback.length]

  try {
    const res = await fetch(COACH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
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
    return data.text ?? fallback[0]
  } catch (err) {
    console.warn('[mira] weekly insight unavailable:', err)
    return fallback[entries.length % fallback.length]
  }
}
