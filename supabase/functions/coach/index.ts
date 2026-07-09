// Facet — Coach edge function (Deno / Supabase Edge Functions)
//
// Holds the ANTHROPIC_API_KEY server-side so it never reaches the browser.
// Deploy:  supabase functions deploy coach
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const API = 'https://api.anthropic.com/v1/messages'

// Cost routing: cheap+fast for the high-volume daily call,
// stronger reasoning for the once-a-week synthesis.
const MODEL_DAILY = 'claude-haiku-4-5-20251001'
const MODEL_WEEKLY = 'claude-sonnet-5'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DAILY_SYSTEM = `You are Coach, the reflection coach inside Facet, grounded in evidence-based psychology.
The user has just written a short nightly reflection. Respond with EXACTLY ONE intervention,
chosen in this strict priority order:

1. RUMINATION: if they ask "why" about themselves, or spiral/self-blame, gently rewrite the
   question toward "what specifically" and "what next". (Eurich: why-questions cause rumination.)
2. DISTANCING: if the entry is emotionally charged, offer a self-distanced reframe, addressing
   them by name in the second person. (Kross: distanced self-talk lowers reactivity.)
3. PATTERN: if it echoes something in their history, name the pattern concretely.
4. AGENCY: if they didn't say what THEY did to cause a good outcome, ask for their contribution.
5. FOLLOWUP: otherwise, ask one sharper follow-up question.

Rules:
- Maximum 3 sentences. Never an essay. Short sentences. Concrete.
- Quote the user's own words back precisely when you can.
- Slightly warm, never cheerful. Acknowledge like a craftsman ("That's a clear one"),
  never effusive praise ("Amazing job!"). No emoji, ever.
- Never give more than one thing to work on.
- Do not diagnose. You are a coach, not a therapist. Never refer to yourself as an AI or assistant.

Return ONLY minified JSON: {"text": "...", "lesson": "...", "kind": "rumination|distancing|pattern|agency|followup"}
"lesson" is optional: one sentence naming the research behind your move. Omit it most days.`

const WEEKLY_SYSTEM = `You are Coach, the reflection coach inside Facet. Read the user's reflections from the past week
and find ONE non-obvious, concrete pattern connecting them — something they could not easily see themselves.

Rules:
- One sentence. Under 20 words. Specific, not generic.
- Point at a lever they control (a condition, a time of day, a behaviour).
- Good: "Your best ideas all landed before 9am. Protect the morning."
- Bad: "You had a productive week."

Return ONLY minified JSON: {"text": "..."}`

interface DailyBody {
  mode: 'daily'
  name: string
  tone?: string
  entry: { event: string; emotions: string[]; well: string; next: string }
  history: { date: string; event: string; emotions: string[] }[]
}
interface WeeklyBody {
  mode: 'weekly'
  name: string
  entries: { date: string; event: string; emotions: string[]; well: string; next: string }[]
}

async function callClaude(model: string, system: string, user: string, maxTokens: number) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_KEY!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const text: string = data?.content?.[0]?.text ?? ''
  // The model is told to return JSON; be defensive anyway.
  try {
    const match = text.match(/\{[\s\S]*\}/)
    return JSON.parse(match ? match[0] : text)
  } catch {
    return { text: text.trim() }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  if (!ANTHROPIC_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' }), {
      status: 500, headers: { ...CORS, 'content-type': 'application/json' },
    })
  }

  try {
    const body = (await req.json()) as DailyBody | WeeklyBody

    let result: unknown
    if (body.mode === 'weekly') {
      const lines = body.entries
        .map((e) => `- ${e.date} [${e.emotions.join(', ')}] ${e.event} | went well: ${e.well} | next: ${e.next}`)
        .join('\n')
      result = await callClaude(MODEL_WEEKLY, WEEKLY_SYSTEM, `This week's reflections:\n${lines}`, 200)
    } else {
      const e = body.entry
      const hist = body.history.length
        ? body.history.map((h) => `- ${h.date} [${h.emotions.join(', ')}] ${h.event}`).join('\n')
        : '(no history yet)'
      const toneNote = body.tone === 'gentler' ? '\nThe user prefers a gentler tone.' : ''
      const user = `User's name: ${body.name}${toneNote}

TODAY'S ENTRY
Event: ${e.event}
Emotions: ${e.emotions.join(', ') || '(none tagged)'}
What went well / their contribution: ${e.well || '(left blank)'}
What they'll do differently: ${e.next || '(left blank)'}

RECENT HISTORY
${hist}`
      result = await callClaude(MODEL_DAILY, DAILY_SYSTEM, user, 300)
    }

    return new Response(JSON.stringify(result), {
      headers: { ...CORS, 'content-type': 'application/json' },
    })
  } catch (err) {
    console.error('[coach]', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'content-type': 'application/json' },
    })
  }
})
