// Facet — Coach edge function (Deno / Supabase Edge Functions).
//
// Stateless and expert-driven. Holds ANTHROPIC_API_KEY server-side so it never
// reaches the browser. All memory is local-first in the client; this function
// just triages, routes to the right model, loads the right expert, and replies.
//
// Deploy:  supabase functions deploy coach
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import {
  buildDailyUser,
  buildGuidanceUser,
  buildOnboardingUser,
  buildWeeklyUser,
  extractJson,
  routeModel,
  triage,
  type EntryIn,
  type MemoryIn,
  type Model,
  type MorningIn,
  type OnboardingIn,
} from './logic.ts'
import { dailySystem, guidanceSystem, onboardingSystem, weeklySystem } from './prompts.ts'

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const API = 'https://api.anthropic.com/v1/messages'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } })

interface DailyBody {
  mode: 'daily'
  name: string
  tone?: string
  entry: EntryIn
  morning?: MorningIn | null
  history?: { date: string; event: string; emotions: string[]; well: string; next: string; rating?: 0 | 1; kind?: string }[]
  recall?: { date: string; event: string }[]
  memory?: MemoryIn
}
interface WeeklyBody {
  mode: 'weekly'
  name: string
  entries: { date: string; event: string; emotions: string[]; well: string; next: string }[]
  memory?: MemoryIn
}
interface OnboardingBody {
  mode: 'onboarding'
  name: string
  answers?: OnboardingIn
  entry: EntryIn
}
interface GuidanceBody {
  mode: 'guidance'
  name: string
  nights?: number
  entries?: { date: string; event: string; emotions: string[]; well: string; next: string; kind?: string }[]
  memory?: MemoryIn
  avoid?: string[]
}

/**
 * Build the request body per model. Sonnet 5 / Opus 4.8 take adaptive thinking
 * only when we want depth (the weekly synthesis); the nightly reply runs
 * thinking-off so it lands fast. Haiku 4.5 takes neither thinking nor effort
 * (both error on it) — it only ever handles the lightest nights.
 */
function requestBody(model: Model, system: string, user: string, maxTokens: number, deep: boolean) {
  const base = {
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  }
  if (model === 'claude-haiku-4-5') return base
  return {
    ...base,
    thinking: deep ? { type: 'adaptive' } : { type: 'disabled' },
    ...(deep ? { output_config: { effort: 'high' } } : {}),
  }
}

async function callClaude(model: Model, system: string, user: string, maxTokens: number, deep: boolean) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(requestBody(model, system, user, maxTokens, deep)),
  })
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`)
  const data = await res.json()
  // Skip any thinking blocks; take the first text block.
  const text: string =
    (data?.content ?? []).filter((b: { type: string }) => b.type === 'text')[0]?.text ?? ''
  return text
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (!ANTHROPIC_KEY) return json({ error: 'ANTHROPIC_API_KEY not set' }, 500)

  try {
    const body = (await req.json()) as DailyBody | WeeklyBody | OnboardingBody | GuidanceBody

    if (body.mode === 'guidance') {
      // The occasional nudge — Opus scouts for one useful thing, or holds back.
      const memory = body.memory ?? {}
      const user = buildGuidanceUser(body.name, body.nights ?? 0, body.entries ?? [], memory, body.avoid ?? [])
      const raw = await callClaude('claude-opus-4-8', guidanceSystem(), user, 700, true)
      const parsed = extractJson<{ skip?: boolean; kind?: string; title?: string; body?: string; value?: string; source?: unknown }>(raw)
      if (!parsed || parsed.skip || !parsed.title || !parsed.body || !parsed.value || !parsed.kind) {
        return json({ skip: true, meta: { model: 'claude-opus-4-8', route: 'guidance→opus' } })
      }
      return json({
        kind: parsed.kind, title: parsed.title, body: parsed.body, value: parsed.value,
        source: parsed.source ?? undefined,
        meta: { model: 'claude-opus-4-8', route: 'guidance→opus' },
      })
    }

    if (body.mode === 'onboarding') {
      // The First Read — the best model, once, for the strongest first impression.
      const user = buildOnboardingUser(body.name, body.answers ?? {}, body.entry)
      const raw = await callClaude('claude-opus-4-8', onboardingSystem(), user, 900, false)
      const parsed = extractJson<{ text?: string; profileDelta?: unknown }>(raw) ?? { text: raw.trim() }
      return json({
        text: parsed.text ?? raw.trim(),
        profileDelta: parsed.profileDelta ?? null,
        meta: { model: 'claude-opus-4-8', route: 'onboarding→opus' },
      })
    }

    if (body.mode === 'weekly') {
      const memory = body.memory ?? {}
      const user = buildWeeklyUser(body.name, body.entries ?? [], memory)
      const raw = await callClaude('claude-opus-4-8', weeklySystem(), user, 2000, true)
      const parsed = extractJson<{ text?: string; profileDelta?: unknown }>(raw) ?? { text: raw.trim() }
      return json({
        text: parsed.text ?? raw.trim(),
        profileDelta: parsed.profileDelta ?? null,
        meta: { model: 'claude-opus-4-8', route: 'weekly→opus' },
      })
    }

    // daily
    const memory = body.memory ?? {}
    const t = triage(body.entry, memory)
    const { model, route } = routeModel(t)

    let system = dailySystem(memory, t)
    if (body.tone === 'gentler') system += '\n\nKeep it especially gentle tonight; ease the pressure.'

    const user = buildDailyUser(body.name, body.entry, body.history ?? [], body.recall ?? [], memory, body.morning)
    const raw = await callClaude(model, system, user, 600, false)
    const parsed =
      extractJson<{ text?: string; lesson?: string; kind?: string; memo?: unknown }>(raw) ?? { text: raw.trim() }

    return json({
      text: parsed.text ?? raw.trim(),
      lesson: parsed.lesson,
      kind: parsed.kind ?? t.primary,
      memo: parsed.memo ?? null,
      meta: { model, route },
    })
  } catch (err) {
    console.error('[coach]', err)
    return json({ error: String(err) }, 500)
  }
})
