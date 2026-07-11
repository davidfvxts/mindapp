// Facet — Coach edge function (Deno / Supabase Edge Functions).
//
// Stateless and expert-driven. Holds the Claude API key server-side so it never
// reaches the browser. All memory is local-first in the client; this function
// just triages, routes to the right model, loads the right expert, and replies.
//
// Deploy:  supabase functions deploy coach
// Secret:  supabase secrets set claude_secret_api_key=sk-ant-...

import {
  boundedClose,
  buildAnswerUser,
  buildChatUser,
  buildDailyUser,
  buildGuidanceUser,
  buildMonthlyUser,
  buildOnboardingUser,
  buildWeeklyUser,
  extractJson,
  routeModel,
  routeModelForKind,
  triage,
  type CoachKind,
  type ChatTurnIn,
  type EntryIn,
  type MemoryIn,
  type Model,
  type MonthlyIn,
  type MorningIn,
  type OnboardingIn,
  type WeeklyReviewIn,
  type WoopIn,
} from './logic.ts'
import { answerSystem, chatSystem, dailySystem, guidanceSystem, monthlySystem, onboardingSystem, weeklySystem } from './prompts.ts'

// claude_secret_api_key is the deployed project secret. Retain the conventional
// name as a fallback so existing environments keep working during a rotation.
const ANTHROPIC_KEY =
  Deno.env.get('claude_secret_api_key') ??
  Deno.env.get('ANTHROPIC_API_KEY')
const API = 'https://api.anthropic.com/v1/messages'
const KINDS: CoachKind[] = [
  'rumination', 'distancing', 'pattern', 'fear_setting',
  'agency', 'celebration', 'accountability', 'followup',
]
const asKind = (kind: unknown): CoachKind => KINDS.includes(kind as CoachKind) ? kind as CoachKind : 'followup'

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
interface AnswerBody {
  mode: 'answer'
  name: string
  entry: EntryIn
  reply: { text: string; kind?: string }
  answer: string
  memory?: MemoryIn
}
interface WeeklyBody {
  mode: 'weekly'
  name: string
  entries: { date: string; event: string; emotions: string[]; well: string; next: string }[]
  memory?: MemoryIn
  /** Present when the user did the guided review — their answers + their WOOP. */
  review?: WeeklyReviewIn | null
  woop?: WoopIn | null
}
interface ChatBody {
  mode: 'chat'
  name: string
  entry: EntryIn
  /** The original nightly read, when there was one — anchors tier + context. */
  reply?: { text: string; kind?: string } | null
  thread?: ChatTurnIn[]
  message: string
  memory?: MemoryIn
}
interface OnboardingBody {
  mode: 'onboarding'
  name: string
  answers?: OnboardingIn
  entry: EntryIn
}
interface MonthlyBody {
  mode: 'monthly'
  name: string
  entries?: { date: string; event: string; emotions: string[]; well: string; next: string }[]
  cards?: string[]
  memory?: MemoryIn
  answers?: MonthlyIn | null
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
  if (!ANTHROPIC_KEY) return json({ error: 'Coach API key not set' }, 500)

  try {
    const body = (await req.json()) as DailyBody | AnswerBody | ChatBody | WeeklyBody | MonthlyBody | OnboardingBody | GuidanceBody

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
      const user = buildWeeklyUser(body.name, body.entries ?? [], memory, body.review, body.woop)
      const raw = await callClaude('claude-opus-4-8', weeklySystem(), user, 2200, true)
      const parsed = extractJson<{ text?: string; profile?: unknown; profileDelta?: unknown }>(raw) ?? { text: raw.trim() }
      return json({
        text: parsed.text ?? raw.trim(),
        // Full revision (see weeklySystem); profileDelta kept as a legacy alias.
        profile: parsed.profile ?? parsed.profileDelta ?? null,
        meta: { model: 'claude-opus-4-8', route: 'weekly→opus' },
      })
    }

    if (body.mode === 'monthly') {
      const memory = body.memory ?? {}
      const user = buildMonthlyUser(body.name, body.entries ?? [], body.cards ?? [], memory, body.answers)
      const raw = await callClaude('claude-opus-4-8', monthlySystem(), user, 2400, true)
      const parsed = extractJson<{ text?: string; theme?: string; profile?: unknown }>(raw) ?? { text: raw.trim() }
      return json({
        text: parsed.text ?? raw.trim(),
        theme: parsed.theme ?? null,
        profile: parsed.profile ?? null,
        meta: { model: 'claude-opus-4-8', route: 'monthly→opus' },
      })
    }

    if (body.mode === 'chat') {
      if (!body.entry || !body.message?.trim()) {
        return json({ error: 'entry and message are required' }, 400)
      }
      const memory = body.memory ?? {}
      // Same tier as the night's read — a charged night stays with the
      // strongest model through the whole conversation.
      const { model, route } = routeModelForKind(asKind(body.reply?.kind))
      const thread = (body.thread ?? []).slice(-12).map((t) => ({
        role: t.role === 'coach' ? 'coach' as const : 'you' as const,
        text: String(t.text ?? '').slice(0, 600),
      }))
      const user = buildChatUser(
        body.name,
        body.entry,
        body.reply?.text ? { text: body.reply.text } : null,
        thread,
        body.message.trim().slice(0, 600),
        memory,
      )
      const raw = await callClaude(model, chatSystem(memory), user, 400, false)
      const parsed = extractJson<{ text?: string; memo?: unknown }>(raw)
      const text = (parsed?.text ?? raw).trim()
      if (!text) throw new Error('empty chat reply')
      return json({
        text,
        memo: parsed?.memo ?? null,
        meta: { model, route: `${route}→chat` },
      })
    }

    if (body.mode === 'answer') {
      if (!body.entry || !body.reply?.text || !body.answer?.trim()) {
        return json({ error: 'entry, reply, and answer are required' }, 400)
      }
      const memory = body.memory ?? {}
      const kind = asKind(body.reply.kind)
      // Derive the same tier from the original intervention — never take a
      // browser-supplied model name as authority.
      const { model, route } = routeModelForKind(kind)
      const user = buildAnswerUser(
        body.name,
        body.entry,
        { text: body.reply.text, kind },
        body.answer.trim().slice(0, 600),
        memory,
      )
      const raw = await callClaude(model, answerSystem(memory), user, 260, false)
      const parsed = extractJson<{ close?: string; memo?: unknown }>(raw)
      const close = boundedClose(parsed?.close ?? raw)
      if (!close) throw new Error('empty answer close')
      return json({
        close,
        memo: parsed?.memo ?? null,
        meta: { model, route: `${route}→answer` },
      })
    }

    // daily
    const memory = body.memory ?? {}
    const t = triage(body.entry, memory)
    const { model, route } = routeModel(t)

    let system = dailySystem(memory, t)
    if (body.tone === 'gentler') system += '\n\nKeep it especially gentle tonight; ease the pressure.'
    if (body.tone === 'sharper') system += '\n\nThey asked for the direct version: skip the cushioning, keep the respect. Blunter than usual, never colder.'

    const user = buildDailyUser(body.name, body.entry, body.history ?? [], body.recall ?? [], memory, body.morning)
    const raw = await callClaude(model, system, user, 600, false)
    const parsed =
      extractJson<{ text?: string; lesson?: string; memo?: unknown }>(raw) ?? { text: raw.trim() }

    return json({
      text: parsed.text ?? raw.trim(),
      lesson: parsed.lesson,
      // The router's intervention is the source of truth for a later answer turn.
      kind: t.primary,
      memo: parsed.memo ?? null,
      meta: { model, route },
    })
  } catch (err) {
    console.error('[coach]', err)
    return json({ error: String(err) }, 500)
  }
})
