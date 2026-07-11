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
  themes?: ThemeIn[]
  openCommitment?: { text: string; date: string } | null
  /** The theme the user set for this month — weighed lightly against tonight. */
  monthTheme?: string
}

/** Optional context from the next-morning loop. */
export interface MorningIn {
  win: string
  question?: string
  answer?: string
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

// ---- recall matching: stem-lite, dependency-free ----
// Mirror of src/lib/coachMemory.ts themeMatches — a theme echoes through
// plurals, inflections and rephrasings, not just literal substrings.
const STOP = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'my', 'our', 'der', 'die', 'das', 'und', 'mit', 'ein', 'eine'])
const tokens = (s: string): string[] =>
  s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 3 && !STOP.has(t))
const tokenMatch = (a: string, b: string): boolean =>
  a === b || (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5))
export function themeMatches(themeKey: string, text: string): boolean {
  const keyToks = tokens(themeKey)
  if (!keyToks.length) return false
  const textToks = tokens(text)
  const hits = keyToks.filter((k) => textToks.some((t) => tokenMatch(k, t))).length
  return hits >= Math.ceil(keyToks.length / 2)
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
    .find((t) => themeMatches(t.key, blob))
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

/**
 * The answer turn must stay on the same model tier as the nightly read. This
 * translates the persisted intervention kind back into the normal router rather
 * than trusting a model name sent from the browser.
 */
export function routeModelForKind(kind: CoachKind): { model: Model; route: string } {
  return routeModel({
    primary: kind,
    charged: kind === 'distancing',
    whySpiral: kind === 'rumination',
    missingAgency: kind === 'agency',
    decisionAvoidance: kind === 'fear_setting',
    positive: kind === 'celebration',
    patternEcho: kind === 'pattern' ? 'pattern' : null,
    owedCommitment: kind === 'accountability',
  })
}

const ratedTag = (r?: 0 | 1): string => (r === 1 ? ' | rated: landed' : r === 0 ? ' | rated: off' : '')

/** The DATA block for the daily call — recency, long-ago recall, and what's owed. */
export function buildDailyUser(
  name: string,
  entry: EntryIn,
  history: {
    date: string; event: string; emotions: string[]; well: string; next: string; rating?: 0 | 1; kind?: string
    answer?: string; close?: string
  }[],
  recall: { date: string; event: string }[],
  memory: MemoryIn,
  morning?: MorningIn | null,
): string {
  const lines: string[] = [`Reflector: ${name || 'the user'}`]
  if (memory.narrative) lines.push(`WHO THEY ARE — Coach's running note: ${memory.narrative}`)
  lines.push('', 'TONIGHT')
  lines.push(`Event: ${entry.event}`)
  lines.push(`Emotions: ${entry.emotions.join(', ') || '(none named)'}`)
  lines.push(`What went well / their contribution: ${entry.well || '(left blank)'}`)
  lines.push(`What they'll do differently: ${entry.next || '(left blank)'}`)

  if (morning?.win) {
    let note = `THIS MORNING they set a win: "${morning.win}"`
    if (morning.question) note += ` — Coach asked: "${morning.question}"`
    if (morning.answer) note += ` — they answered: "${morning.answer}"`
    lines.push('', note)
  }

  if (memory.monthTheme) {
    lines.push('', `THIS MONTH'S THEME they set: "${memory.monthTheme}". Weigh tonight against it only when it genuinely fits — never force it.`)
  }
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
      const exchange = h.answer ? ` | answer: ${h.answer}` : ''
      const close = h.close ? ` | Coach close: ${h.close}` : ''
      lines.push(`- ${h.date} [${h.emotions.join(', ')}] ${h.event} | well: ${h.well || '—'} | next: ${h.next || '—'}${ratedTag(h.rating)}${exchange}${close}`)
    }
  }
  return lines.join('\n')
}

export interface ReplyIn {
  text: string
  kind: CoachKind
}

/** The DATA block for the one optional answer turn. */
export function buildAnswerUser(
  name: string,
  entry: EntryIn,
  reply: ReplyIn,
  answer: string,
  memory: MemoryIn,
): string {
  const lines: string[] = [`Reflector: ${name || 'the user'}`, '', 'TONIGHT']
  lines.push(`Event: ${entry.event}`)
  lines.push(`Emotions: ${entry.emotions.join(', ') || '(none named)'}`)
  lines.push(`What went well / their contribution: ${entry.well || '(left blank)'}`)
  lines.push(`What they'll do differently: ${entry.next || '(left blank)'}`)
  lines.push('', `COACH'S READ: ${reply.text}`)
  lines.push('', `THEIR ONE ANSWER: ${answer}`)
  if (memory.narrative) lines.push('', `WHO THEY ARE: ${memory.narrative}`)
  if (memory.voice) lines.push('', `KNOWN VOICE: ${memory.voice}`)
  if (memory.themes?.length) {
    lines.push(`RECURRING THEMES: ${memory.themes.map((t) => `${t.key}×${t.count}`).join('; ')}`)
  }
  return lines.join('\n')
}

export interface ChatTurnIn { role: 'you' | 'coach'; text: string }

/** The DATA block for a conversation turn about one night. */
export function buildChatUser(
  name: string,
  entry: EntryIn,
  reply: { text: string } | null,
  thread: ChatTurnIn[],
  message: string,
  memory: MemoryIn,
): string {
  const lines: string[] = [`Reflector: ${name || 'the user'}`, '', 'THE NIGHT THIS IS ABOUT']
  lines.push(`Event: ${entry.event}`)
  lines.push(`Emotions: ${entry.emotions.join(', ') || '(none named)'}`)
  lines.push(`What went well / their contribution: ${entry.well || '(left blank)'}`)
  lines.push(`What they'll do differently: ${entry.next || '(left blank)'}`)
  if (reply?.text) lines.push('', `COACH'S READ OF IT: ${reply.text}`)
  if (thread.length) {
    lines.push('', 'THE CONVERSATION SO FAR:')
    for (const t of thread) lines.push(`${t.role === 'you' ? 'Them' : 'Coach'}: ${t.text}`)
  }
  lines.push('', `THEY JUST SAID: ${message}`)
  if (memory.narrative) lines.push('', `WHO THEY ARE: ${memory.narrative}`)
  if (memory.voice) lines.push(`KNOWN VOICE: ${memory.voice}`)
  if (memory.themes?.length) {
    lines.push(`RECURRING THEMES: ${memory.themes.map((t) => `${t.key}×${t.count}`).join('; ')}`)
  }
  return lines.join('\n')
}

export interface WeeklyReviewIn {
  wins?: string
  friction?: string
  avoided?: string
}
export interface WoopIn {
  wish?: string
  outcome?: string
  obstacle?: string
  plan?: string
}

/** The DATA block for the weekly synthesis — the nights, and (when the user did
 *  the guided review) THEIR answers + THEIR WOOP. */
export function buildWeeklyUser(
  name: string,
  entries: { date: string; event: string; emotions: string[]; well: string; next: string }[],
  memory: MemoryIn,
  review?: WeeklyReviewIn | null,
  woop?: WoopIn | null,
): string {
  const lines = [`Reflector: ${name || 'the user'}`, '', "THIS WEEK'S NIGHTS:"]
  for (const e of entries) {
    lines.push(`- ${e.date} [${e.emotions.join(', ')}] ${e.event} | well: ${e.well || '—'} | next: ${e.next || '—'}`)
  }
  if (review && (review.wins || review.friction || review.avoided)) {
    lines.push('', 'THEIR OWN REVIEW, JUST WRITTEN:')
    if (review.wins) lines.push(`- Wins & what caused them: ${review.wins}`)
    if (review.friction) lines.push(`- What got in the way: ${review.friction}`)
    if (review.avoided) lines.push(`- The decision they're avoiding: ${review.avoided}`)
  }
  if (woop?.wish) {
    lines.push('', `THEIR WOOP FOR NEXT WEEK: wish "${woop.wish}"`
      + (woop.outcome ? ` · outcome "${woop.outcome}"` : '')
      + (woop.obstacle ? ` · obstacle "${woop.obstacle}"` : '')
      + (woop.plan ? ` · plan "${woop.plan}"` : ''))
  }
  lines.push('', 'CURRENT PROFILE ON RECORD (yours to revise — whatever you omit is removed):')
  lines.push(`- narrative: ${memory.narrative || '(none yet)'}`)
  lines.push(`- voice: ${memory.voice || '(unknown)'}`)
  lines.push(`- values: ${memory.values?.join(', ') || '(none)'}`)
  lines.push(`- goals: ${memory.goals?.join(', ') || '(none)'}`)
  lines.push(`- obstacles: ${memory.obstacles?.join(', ') || '(none)'}`)
  lines.push(`- projects: ${memory.projects?.join(', ') || '(none)'}`)
  lines.push(`- people: ${memory.relationships?.join(', ') || '(none)'}`)
  lines.push(`- moves that landed: ${memory.landed?.join('; ') || '(none)'}`)
  lines.push(`- moves to ease off: ${memory.avoided?.join('; ') || '(none)'}`)
  return lines.join('\n')
}

/** The DATA block for the monthly arc — the month's nights, the weekly reads,
 *  the current profile (to revise), and the user's own trajectory / gap / fear. */
export interface MonthlyIn {
  trajectory?: string
  gap?: string
  fear?: string
  theme?: string
}
export function buildMonthlyUser(
  name: string,
  entries: { date: string; event: string; emotions: string[]; well: string; next: string }[],
  cards: string[],
  memory: MemoryIn,
  answers?: MonthlyIn | null,
): string {
  const lines = [`Reflector: ${name || 'the user'}`, '', "THIS MONTH'S NIGHTS (most recent first):"]
  for (const e of entries) {
    lines.push(`- ${e.date} [${e.emotions.join(', ')}] ${e.event} | well: ${e.well || '—'} | next: ${e.next || '—'}`)
  }
  if (cards.length) {
    lines.push('', 'THEIR WEEKLY READS THIS MONTH:')
    for (const c of cards) lines.push(`- ${c}`)
  }
  if (answers && (answers.trajectory || answers.gap || answers.fear)) {
    lines.push('', 'THEIR OWN WORK, JUST WRITTEN:')
    if (answers.trajectory) lines.push(`- Trajectory, in their words: ${answers.trajectory}`)
    if (answers.gap) lines.push(`- The values-vs-lived gap they named: ${answers.gap}`)
    if (answers.fear) lines.push(`- Fear-setting on the avoided decision: ${answers.fear}`)
    if (answers.theme) lines.push(`- The theme they're leaning toward: ${answers.theme}`)
  }
  lines.push('', 'CURRENT PROFILE ON RECORD (yours to revise — whatever you omit is removed):')
  lines.push(`- narrative: ${memory.narrative || '(none yet)'}`)
  lines.push(`- voice: ${memory.voice || '(unknown)'}`)
  lines.push(`- values: ${memory.values?.join(', ') || '(none)'}`)
  lines.push(`- goals: ${memory.goals?.join(', ') || '(none)'}`)
  lines.push(`- obstacles: ${memory.obstacles?.join(', ') || '(none)'}`)
  lines.push(`- projects: ${memory.projects?.join(', ') || '(none)'}`)
  lines.push(`- people: ${memory.relationships?.join(', ') || '(none)'}`)
  return lines.join('\n')
}

/** The DATA block for the occasional nudge — recent nights, who they are, what's
 *  already been offered (so Coach never repeats itself). */
export function buildGuidanceUser(
  name: string,
  nights: number,
  entries: { date: string; event: string; emotions: string[]; well: string; next: string; kind?: string }[],
  memory: MemoryIn,
  avoid: string[],
): string {
  const lines = [`Reflector: ${name || 'the user'}`, `Nights so far: ${nights}`]
  if (memory.narrative) lines.push(`WHO THEY ARE — Coach's running note: ${memory.narrative}`)
  lines.push('', 'RECENT NIGHTS:')
  for (const e of entries) {
    lines.push(`- ${e.date} [${e.emotions.join(', ')}] ${e.event} | well: ${e.well || '—'} | next: ${e.next || '—'}${e.kind ? ` | coach: ${e.kind}` : ''}`)
  }
  const known: string[] = []
  if (memory.voice) known.push(`voice: ${memory.voice}`)
  if (memory.values?.length) known.push(`values: ${memory.values.join(', ')}`)
  if (memory.goals?.length) known.push(`goals: ${memory.goals.join(', ')}`)
  if (memory.obstacles?.length) known.push(`obstacles: ${memory.obstacles.join(', ')}`)
  if (memory.projects?.length) known.push(`projects: ${memory.projects.join(', ')}`)
  if (memory.relationships?.length) known.push(`people: ${memory.relationships.join(', ')}`)
  if (known.length) lines.push('', `KNOWN PROFILE — ${known.join(' · ')}`)
  if (memory.themes?.length) {
    lines.push('', 'RECURRING THEMES: ' + memory.themes.map((t) => `${t.key}×${t.count}`).join('; '))
  }
  if (avoid.length) lines.push('', 'ALREADY OFFERED (do NOT repeat these): ' + avoid.join(' | '))
  return lines.join('\n')
}

export interface OnboardingIn {
  goals?: string[]
  world?: string
  obstacle?: string
  /** Their own words for what brought them here — quote it back if it's strong. */
  whyNow?: string
  cue?: string
}

/** The DATA block for the onboarding First Read — intake + their first-ever reflection. */
export function buildOnboardingUser(name: string, a: OnboardingIn, entry: EntryIn): string {
  const lines = [`Reflector: ${name || 'the user'}`, '', 'INTAKE (their guided setup):']
  if (a.goals?.length) lines.push(`- Wants to get sharper at: ${a.goals.join(', ')}`)
  if (a.whyNow?.trim()) lines.push(`- Why now, in their words: "${a.whyNow.trim()}"`)
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

/** Enforce the answer-turn contract even if the model over-explains. */
export function boundedClose(text: string): string {
  const sentences = text.trim().match(/[^.!?]+(?:[.!?]+|$)/g) ?? []
  return sentences.slice(0, 2).join('').trim()
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
