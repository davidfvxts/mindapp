// Facet — Coach routing & triage (PURE: no Deno, no network).
// Unit-tested by scripts/test-coach.ts. index.ts is the only Deno glue.
//
// The intervention priority here is the research spine of the product
// (Reflection-System-2026.md) and MUST match the expert modules in prompts.ts:
//   1 rumination   Eurich — "what" not "why"
//   2 distancing   Kross — self-distanced, name-addressed
//   3 pattern      recurring theme across nights (recency + longevity)
//   4 fear_setting Ferriss — an avoided decision / cost of inaction
//   5 agency       Goldsmith — what YOU did to cause it
//   6 celebration  mark a real win, tied to contribution (sparingly)
//   7 accountability  a prior intention came due
//   8 followup     one sharper question

export type CoachKind =
  | 'rumination' | 'distancing' | 'pattern' | 'fear_setting'
  | 'agency' | 'celebration' | 'accountability' | 'followup'

export type Model = 'claude-haiku-4-5' | 'claude-sonnet-5' | 'claude-opus-4-8'

/** Emotions that trigger self-distancing (Kross). Mirror of src/lib/types.ts. */
export const CHARGED = ['Anxious', 'Frustrated', 'Drained', 'Overwhelmed', 'Discouraged', 'Restless']
// Positive AFFECT that marks a genuine win — not merely calm/focused (those are
// neutral and fall through to accountability/followup).
const POSITIVE = ['Proud', 'Energized', 'Excited', 'Grateful']

export interface EntryIn {
  event: string
  emotions: string[]
  well: string
  next: string
}

export interface ThemeIn { key: string; count: number; first: string; last: string }
export interface MemoryIn {
  voice?: string
  values?: string[]
  goals?: string[]
  obstacles?: string[]
  relationships?: string[]
  projects?: string[]
  landed?: string[]
  avoided?: string[]
  themes?: ThemeIn[]
  openCommitment?: { text: string; date: string } | null
}

export interface Triage {
  primary: CoachKind
  charged: boolean
  whySpiral: boolean
  missingAgency: boolean
  decisionAvoidance: boolean
  positive: boolean
  patternEcho: string | null
  owedCommitment: boolean
}

const WHY_SPIRAL = /\bwhy (am|do|did|is|are|can'?t|does|would) i\b/
const SELF_BLAME = /(always screw|never able|what'?s wrong with me|i'?m such a|i always|why do i keep)/
const AVOIDANCE = /(decision|decide|avoid|putting off|procrastinat|should talk|need to tell|keep dodging|been meaning to)/

export function triage(entry: EntryIn, memory: MemoryIn): Triage {
  const blob = `${entry.event} ${entry.well} ${entry.next}`.toLowerCase()
  const emotions = entry.emotions ?? []

  const whySpiral = WHY_SPIRAL.test(blob) || SELF_BLAME.test(blob)
  const charged = emotions.some((e) => CHARGED.includes(e))
  const decisionAvoidance = AVOIDANCE.test(blob)
  const missingAgency = !entry.well.trim()

  const echoed = (memory.themes ?? [])
    .filter((t) => t.count >= 2)
    .find((t) => blob.includes(t.key))
  const patternEcho = echoed ? echoed.key : null

  const positive =
    !charged && !!entry.well.trim() && emotions.some((e) => POSITIVE.includes(e))

  const owedCommitment = !!memory.openCommitment?.text

  let primary: CoachKind = 'followup'
  if (whySpiral) primary = 'rumination'
  else if (charged) primary = 'distancing'
  else if (patternEcho) primary = 'pattern'
  else if (decisionAvoidance) primary = 'fear_setting'
  else if (missingAgency) primary = 'agency'
  else if (positive) primary = 'celebration'
  else if (owedCommitment) primary = 'accountability'

  return { primary, charged, whySpiral, missingAgency, decisionAvoidance, positive, patternEcho, owedCommitment }
}

/**
 * Different models for different feedback types. Quality-first, cost-aware:
 * the psychologically demanding nights get the strongest model; everything else
 * gets Sonnet 5 (the near-Opus daily floor). The weekly + onboarding reads
 * (elsewhere) get Opus with thinking.
 *
 * Testing-phase choice: Sonnet 5 is the floor so every reply mirrors voice well
 * and first impressions land — the per-reply cost delta vs. Haiku is a fraction
 * of a cent. Haiku 4.5 stays wired as the scale lever: when you're optimising
 * cost at hundreds of users, route the lightest nights (below) to it.
 */
export function routeModel(t: Triage): { model: Model; route: string } {
  if (t.whySpiral || t.charged || t.decisionAvoidance || t.patternEcho) {
    return { model: 'claude-opus-4-8', route: 'charged→opus' }
  }
  // Scale lever: swap to 'claude-haiku-4-5' here for the lightest nights at scale.
  return { model: 'claude-sonnet-5', route: 'standard→sonnet' }
}

const ratedTag = (r?: 0 | 1): string => (r === 1 ? ' | rated: landed' : r === 0 ? ' | rated: off' : '')

/** The DATA block for the daily call — recency, long-ago recall, and what's owed. */
export function buildDailyUser(
  name: string,
  entry: EntryIn,
  history: { date: string; event: string; emotions: string[]; well: string; next: string; rating?: 0 | 1; kind?: string }[],
  recall: { date: string; event: string }[],
  memory: MemoryIn,
): string {
  const lines: string[] = [`Reflector: ${name || 'the user'}`, '', 'TONIGHT']
  lines.push(`Event: ${entry.event}`)
  lines.push(`Emotions: ${entry.emotions.join(', ') || '(none named)'}`)
  lines.push(`What went well / their contribution: ${entry.well || '(left blank)'}`)
  lines.push(`What they'll do differently: ${entry.next || '(left blank)'}`)

  if (memory.openCommitment?.text) {
    lines.push('', `OWED — on ${memory.openCommitment.date} they intended: "${memory.openCommitment.text}". Does tonight's entry act on it? Report kept/dropped/unknown in memo.commitment.`)
  }
  if (recall.length) {
    lines.push('', 'EARLIER, IN THEIR OWN WORDS (a live theme echoes these):')
    for (const r of recall) lines.push(`- ${r.date}: ${r.event}`)
  }
  if (memory.themes?.length) {
    lines.push('', 'RECURRING THEMES: ' + memory.themes.map((t) => `${t.key}×${t.count} (since ${t.first})`).join('; '))
  }
  if (history.length) {
    lines.push('', 'RECENT NIGHTS:')
    for (const h of history) {
      lines.push(`- ${h.date} [${h.emotions.join(', ')}] ${h.event} | well: ${h.well || '—'} | next: ${h.next || '—'}${ratedTag(h.rating)}`)
    }
  }
  return lines.join('\n')
}

/** The DATA block for the weekly synthesis. */
export function buildWeeklyUser(
  name: string,
  entries: { date: string; event: string; emotions: string[]; well: string; next: string }[],
  memory: MemoryIn,
): string {
  const lines = [`Reflector: ${name || 'the user'}`, '', "THIS WEEK'S NIGHTS:"]
  for (const e of entries) {
    lines.push(`- ${e.date} [${e.emotions.join(', ')}] ${e.event} | well: ${e.well || '—'} | next: ${e.next || '—'}`)
  }
  if (memory.voice) lines.push('', `KNOWN VOICE: ${memory.voice}`)
  const known: string[] = []
  if (memory.values?.length) known.push(`values: ${memory.values.join(', ')}`)
  if (memory.goals?.length) known.push(`goals: ${memory.goals.join(', ')}`)
  if (memory.obstacles?.length) known.push(`obstacles: ${memory.obstacles.join(', ')}`)
  if (memory.projects?.length) known.push(`projects: ${memory.projects.join(', ')}`)
  if (memory.relationships?.length) known.push(`people: ${memory.relationships.join(', ')}`)
  if (known.length) lines.push(`KNOWN PROFILE — ${known.join(' · ')}`)
  return lines.join('\n')
}

export interface OnboardingIn {
  goals?: string[]
  world?: string
  obstacle?: string
  cue?: string
}

/** The DATA block for the onboarding First Read — intake + their first-ever reflection. */
export function buildOnboardingUser(name: string, a: OnboardingIn, entry: EntryIn): string {
  const lines = [`Reflector: ${name || 'the user'}`, '', 'INTAKE (their guided setup):']
  if (a.goals?.length) lines.push(`- Wants to get sharper at: ${a.goals.join(', ')}`)
  if (a.world?.trim()) lines.push(`- Building: ${a.world.trim()}`)
  if (a.obstacle) lines.push(`- What's tripped reflection up before: ${a.obstacle}`)
  if (a.cue?.trim()) lines.push(`- Their cue: after they ${a.cue.trim()}, they reflect.`)
  lines.push('', 'THEIR FIRST-EVER REFLECTION, TONIGHT:')
  lines.push(`Event: ${entry.event}`)
  lines.push(`Emotions: ${entry.emotions.join(', ') || '(none named)'}`)
  lines.push(`What went well / their contribution: ${entry.well || '(left blank)'}`)
  lines.push(`What they'll do differently: ${entry.next || '(left blank)'}`)
  return lines.join('\n')
}

/** Robustly pull the JSON object out of a model response. */
export function extractJson<T>(text: string): T | null {
  try {
    const match = text.match(/\{[\s\S]*\}/)
    return JSON.parse(match ? match[0] : text) as T
  } catch {
    return null
  }
}
