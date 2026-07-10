import { CHARGED } from './types'
import { staleCommitment } from './coachMemory'
import type { AppState, Nudge, NudgeKind, NudgeSource } from './types'

/*
 * Guidance — the occasional nudge Coach leaves between reflections.
 *
 * Not a catalogue the user grinds through. Coach checks in now and then — never
 * two nights running, irregularly (every 2–5 active nights), and only when there
 * is one genuinely useful thing to offer: a tip, an action, a habit or routine,
 * or a reading matched to who they are. Every nudge explains how it creates value.
 * The user can commit to it (Coach checks in later), push back on it, or set it
 * aside. Online, Opus writes the nudge fresh from their reflections; offline (or
 * if the model can't be reached) we draw one from the evidence-based library below
 * so the surface is never dead. All pure; tested.
 *
 * Methods (Reflection-System-2026.md): Pennebaker, Kross, Eurich, Goldsmith,
 * Ferriss, Oettingen, Clear. Readings are real, verifiable works fitted to the
 * user's aims — nothing invented, so every suggestion stays credible.
 */

export type { NudgeKind, NudgeSource } from './types'

export const KIND_LABEL: Record<NudgeKind, string> = {
  tip: 'A tip', action: 'Try this', habit: 'A habit', routine: 'A routine', reading: 'Worth a read',
  intention: 'This week',
}
export const MEDIUM_LABEL: Record<NudgeSource['medium'], string> = {
  book: 'Book', talk: 'Talk', article: 'Article', paper: 'Paper',
  podcast: 'Podcast', film: 'Film', blog: 'Blog',
}

// ---- pacing --------------------------------------------------------------

const MIN_GAP = 2 // never two active nights in a row
const MAX_GAP = 5

/** Deterministic small hash — irregular but reproducible (no Math.random). */
const hash = (n: number): number => {
  let x = (n * 2654435761) >>> 0
  x ^= x >>> 15
  x = (x * 2246822519) >>> 0
  x ^= x >>> 13
  return x >>> 0
}
/** An irregular gap in Nights, 2–5, that varies as the user progresses. */
const gapFor = (seed: number): number => MIN_GAP + (hash(seed) % (MAX_GAP - MIN_GAP + 1))
/** The check-in delay after a commitment — a few nights later, 2–4. */
const checkInGap = (seed: number): number => 2 + (hash(seed + 7) % 3)

const nightsOf = (s: AppState): number => Math.max(s.game.best, s.game.streak)

// ---- context Coach reasons over -----------------------------------------

export interface NudgeCtx {
  nights: number
  entries: number
  /** How many times each intervention has fired. */
  kinds: Record<string, number>
  themeMax: number
  goals: string[]
  obstacles: string[]
  charged: number
  keptCommitments: number
  weeklyReads: number
}

export function buildNudgeCtx(state: AppState): NudgeCtx {
  const kinds: Record<string, number> = {}
  let charged = 0
  for (const e of state.entries) {
    const k = e.coach?.kind
    if (k) kinds[k] = (kinds[k] ?? 0) + 1
    if (e.emotions.some((x) => (CHARGED as string[]).includes(x))) charged += 1
  }
  const themeMax = state.coach.themes.reduce((m, t) => Math.max(m, t.count), 0)
  return {
    nights: nightsOf(state),
    entries: state.entries.length,
    kinds,
    themeMax,
    goals: state.coach.profile.goals ?? [],
    obstacles: state.coach.profile.obstacles ?? [],
    charged,
    keptCommitments: state.coach.commitments.filter((c) => c.status === 'kept').length,
    weeklyReads: state.cards.length,
  }
}

const fired = (c: NudgeCtx, k: string): number => c.kinds[k] ?? 0
const hasObstacle = (c: NudgeCtx, sub: string): boolean => c.obstacles.some((o) => o.includes(sub))
const goalKw = (c: NudgeCtx, kw: string): boolean => c.goals.some((g) => g.toLowerCase().includes(kw))

// ---- the offline library (fallback + grounding) --------------------------

/** A draft nudge before it's stamped with id/night — what the AI and the library both produce. */
export interface NudgeDraft {
  kind: NudgeKind
  title: string
  body: string
  value: string
  source?: NudgeSource
  seedId?: string
}

interface Seed extends NudgeDraft {
  seedId: string
  /** Higher = more pressing; surfaces first when several fit. */
  weight: number
  fit: (c: NudgeCtx) => boolean
}

/** A goal-fitted reading — only ever offered if that aim is actually theirs. */
const read = (seedId: string, kw: string, s: Omit<Seed, 'seedId' | 'kind' | 'weight' | 'fit'>): Seed => ({
  seedId, kind: 'reading', weight: 1, ...s, fit: (c) => goalKw(c, kw),
})

export const SEEDS: readonly Seed[] = [
  // ---- tips: the methods, offered when the moment calls for them ----
  {
    seedId: 'specificity', kind: 'tip', weight: 3,
    title: 'Reflect on one moment, not the whole day',
    body: 'Put a single concrete event into words rather than “how the day went.” The specific one is what does the work.',
    value: 'Naming a concrete event engages the reasoning brain and lowers the load of carrying it (Pennebaker).',
    fit: (c) => c.entries >= 1 && c.entries <= 4,
  },
  {
    seedId: 'name-it', kind: 'tip', weight: 3,
    title: 'Name the feeling to loosen its grip',
    body: 'Pick the emotion in a word instead of sitting inside it. That small act of labelling is the point of the chips.',
    value: 'Affect labelling measurably lowers an emotion’s intensity; ruminating on it deepens it.',
    fit: (c) => c.charged >= 1 && c.entries <= 6,
  },
  {
    seedId: 'kross', kind: 'tip', weight: 4,
    title: 'Step outside your own head on a hard night',
    body: 'When a night runs hot, write it in the second person — address yourself by name, like an advisor would.',
    value: 'Distanced self-talk lowers emotional reactivity and helps you reason like an advisor, not a victim (Kross).',
    fit: (c) => fired(c, 'distancing') >= 1 || c.charged >= 2,
  },
  {
    seedId: 'eurich', kind: 'tip', weight: 4,
    title: 'Ask “what,” never “why”',
    body: 'Swap “why do I always…” for “what specifically happened, and what will I do next.”',
    value: '“Why” spirals into rumination and invented reasons; “what” produces real insight (Eurich).',
    fit: (c) => fired(c, 'rumination') >= 1,
  },
  {
    seedId: 'pattern', kind: 'tip', weight: 3,
    title: 'A repeat is data, not noise',
    body: 'The same theme keeps surfacing. Ask what conditions produce it, and which single one you can change.',
    value: 'Seeing a pattern across nights is the one thing a paper journal can’t do for you.',
    fit: (c) => c.themeMax >= 3 || fired(c, 'pattern') >= 1,
  },

  // ---- actions: small experiments ----
  {
    seedId: 'kross-action', kind: 'action', weight: 3,
    title: 'Write the next hard night in the second person',
    body: 'Try it once: “<name>, what actually happened — and what would you tell a founder you respect in this exact spot?”',
    value: 'Same facts, calmer head. It’s the fastest way to get useful distance under charge (Kross).',
    fit: (c) => c.charged >= 2,
  },
  {
    seedId: 'eurich-action', kind: 'action', weight: 3,
    title: 'Rewrite one “why” as a “what”',
    body: 'Take a “why am I like this” from a recent night and rewrite it: what exactly happened, and the one thing you’ll do differently.',
    value: 'You’ll feel the difference between a spiral and a plan in a single sentence (Eurich).',
    fit: (c) => fired(c, 'rumination') >= 1,
  },
  {
    seedId: 'ferriss-action', kind: 'action', weight: 4,
    title: 'Run a ten-minute fear-setting',
    body: 'On the decision you’re avoiding: Define the worst cases (1–10) · Prevent · Repair · then the cost of doing nothing in 6, 12, 36 months.',
    value: 'Ten minutes on paper usually shrinks the fear and surfaces the move — the cost of inaction is often the scarier number (Ferriss).',
    fit: (c) => fired(c, 'fear_setting') >= 1,
  },
  {
    seedId: 'goldsmith', kind: 'action', weight: 2,
    title: 'End tomorrow with “did I do my best to…”',
    body: 'Turn your goal into an active question: not “did it happen” but “did I do my best to make it happen.”',
    value: 'Active questions put the focus on effort you control, and make it impossible to blame circumstances (Goldsmith).',
    fit: (c) => fired(c, 'agency') >= 1 || c.keptCommitments >= 1,
  },

  // ---- habits & routines ----
  {
    seedId: 'cue-habit', kind: 'habit', weight: 3,
    title: 'Anchor the reflection to a fixed cue',
    body: 'Write the if-then: “after I close my laptop, I reflect.” Hand the decision to a cue instead of willpower.',
    value: 'Implementation intentions are the most reliable way to make a habit stick (Gollwitzer).',
    fit: (c) => c.entries >= 2 && (hasObstacle(c, 'forget') || c.entries <= 8),
  },
  {
    seedId: 'clear-cap', kind: 'habit', weight: 4,
    title: 'Cap tonight’s entry at three sentences',
    body: 'If perfectionism drags at this, make over-doing it impossible: three sentences, then stop.',
    value: 'Ugly and done beats perfect and abandoned. Consistency compounds; intensity doesn’t (Clear).',
    fit: (c) => hasObstacle(c, 'perfection'),
  },
  {
    seedId: 'woop-routine', kind: 'routine', weight: 2,
    title: 'Set a weekly WOOP',
    body: 'Once a week: Wish (one outcome) · Outcome (how it’ll feel) · Obstacle (the internal one) · Plan (“if X, then I’ll Y”).',
    value: 'Pairing the wish with its real obstacle beats positive visualising, which quietly lowers follow-through (Oettingen).',
    fit: (c) => c.nights >= 7 || c.weeklyReads >= 1,
  },
  {
    seedId: 'thinking-hour', kind: 'routine', weight: 2,
    title: 'Block one thinking hour a month',
    body: 'Away from Slack and email — one protected hour to think, not react.',
    value: 'For a founder, protected reflection time is a duty, not an indulgence; the burnout research is blunt about it.',
    fit: (c) => c.nights >= 30,
  },
  {
    seedId: 'gratitude', kind: 'habit', weight: 1,
    title: 'End on one specific gratitude',
    body: 'One concrete thing you’re grateful for — specificity beats length. A counterweight to all the auditing, not the centrepiece.',
    value: 'A single specific gratitude lifts well-being; its effect is real but modest, so keep it small (Emmons).',
    fit: (c) => c.nights >= 30,
  },

  // ---- readings: method-grounded (offered when the method fires) ----
  {
    seedId: 'read-chatter', kind: 'reading', weight: 2,
    title: 'Chatter',
    body: 'Ethan Kross on the inner voice — why distanced self-talk works, and how to use it under stress.',
    value: 'Because your hard nights keep running hot — this is the science behind the move that helps them.',
    source: { by: 'Ethan Kross', medium: 'book' },
    fit: (c) => fired(c, 'distancing') >= 1 || c.charged >= 3,
  },
  {
    seedId: 'read-eurich', kind: 'reading', weight: 2,
    title: 'The right way to be introspective',
    body: 'Tasha Eurich on why people who introspect more are often less self-aware — and what to do instead.',
    value: 'Because a “why” spiral showed up in your nights; this names the trap and the way out.',
    source: { by: 'Tasha Eurich', medium: 'article', url: 'https://ideas.ted.com/the-right-way-to-be-introspective-yes-theres-a-wrong-way/' },
    fit: (c) => fired(c, 'rumination') >= 1,
  },
  {
    seedId: 'read-ferriss', kind: 'reading', weight: 2,
    title: 'Fear-Setting: “Why you should define your fears”',
    body: 'Tim Ferriss’s method for turning an avoided decision into a concrete, do-able audit.',
    value: 'Because a decision keeps getting dodged — this is the ten-minute exercise that unsticks it.',
    source: { by: 'Tim Ferriss', medium: 'talk', url: 'https://tim.blog/2017/05/15/fear-setting/' },
    fit: (c) => fired(c, 'fear_setting') >= 1,
  },
  {
    seedId: 'read-atomic', kind: 'reading', weight: 2,
    title: 'Atomic Habits',
    body: 'James Clear on systems over goals, identity-based habits, and never-miss-twice.',
    value: 'Because the habit is what you’re building here — this is the clearest manual for making it hold.',
    source: { by: 'James Clear', medium: 'book' },
    fit: (c) => c.nights >= 14 || hasObstacle(c, 'perfection'),
  },
  {
    seedId: 'read-integrity', kind: 'reading', weight: 1,
    title: 'The Integrity Report',
    body: 'Clear’s annual audit of whether he’s living by his stated values — a clean template for a monthly identity check.',
    value: 'Because you’ve a month of nights to look back on; this turns them into a values check.',
    source: { by: 'James Clear', medium: 'blog', url: 'https://jamesclear.com/integrity' },
    fit: (c) => c.nights >= 30,
  },

  // ---- readings: fitted to the user's aim (only if it's theirs) ----
  read('read-decisions-1', 'decision', {
    title: 'The Hard Thing About Hard Things',
    body: 'Ben Horowitz on the calls with no good options — the honest founder’s manual for hard decisions.',
    value: 'Because you’re aiming at sharper decisions; nobody’s more honest about the ugly ones.',
    source: { by: 'Ben Horowitz', medium: 'book' },
  }),
  read('read-decisions-2', 'decision', {
    title: 'Farnam Street',
    body: 'Shane Parrish on mental models and thinking clearly under uncertainty — blog and podcast.',
    value: 'Because you’re aiming at sharper decisions; this is a standing library of how to think, not what to think.',
    source: { by: 'Shane Parrish', medium: 'blog', url: 'https://fs.blog/' },
  }),
  read('read-decisions-3', 'decision', {
    title: 'Moneyball',
    body: 'Data versus gut, and the nerve to decide against the whole room. A film about judgment.',
    value: 'Because you’re aiming at sharper decisions; it’s the feeling of trusting your read under pressure.',
    source: { by: 'dir. Bennett Miller', medium: 'film' },
  }),
  read('read-focus-1', 'focus', {
    title: 'Deep Work',
    body: 'Cal Newport on protecting long, undistracted stretches — and why they’re rare and valuable.',
    value: 'Because you want deeper focus; this is the case and the method in one place.',
    source: { by: 'Cal Newport', medium: 'book' },
  }),
  read('read-focus-2', 'focus', {
    title: 'Huberman Lab',
    body: 'Andrew Huberman on the science of attention, sleep, and energy — source-cited protocols.',
    value: 'Because you want deeper focus; practical levers you can actually run this week.',
    source: { by: 'Andrew Huberman', medium: 'podcast', url: 'https://hubermanlab.com/' },
  }),
  read('read-focus-3', 'focus', {
    title: 'Four Thousand Weeks',
    body: 'Oliver Burkeman on finitude — making peace with not doing it all so you can do what matters.',
    value: 'Because you want deeper focus; the deeper problem under distraction is what you say yes to.',
    source: { by: 'Oliver Burkeman', medium: 'book' },
  }),
  read('read-lead-1', 'lead', {
    title: 'The Coaching Habit',
    body: 'Michael Bungay Stanier on saying less and asking more — seven questions that change how you lead.',
    value: 'Because you’re working on leading people; it’s the fastest read here with the biggest behaviour change.',
    source: { by: 'Michael Bungay Stanier', medium: 'book' },
  }),
  read('read-lead-2', 'lead', {
    title: 'WorkLife with Adam Grant',
    body: 'An organizational psychologist on how the best teams and cultures actually work.',
    value: 'Because you’re working on leading people; evidence, not folklore, on what makes teams tick.',
    source: { by: 'Adam Grant', medium: 'podcast' },
  }),
  read('read-lead-3', 'lead', {
    title: 'Radical Candor',
    body: 'Kim Scott on caring personally while challenging directly — feedback that’s neither brutal nor fake-nice.',
    value: 'Because you’re working on leading people; this fixes the most common feedback failure.',
    source: { by: 'Kim Scott', medium: 'book' },
  }),
  read('read-ship-1', 'ship', {
    title: 'Rework',
    body: 'Fried & Hansson on cutting scope, shipping, and ignoring the theatre of “work.”',
    value: 'Because you want to ship more; short, blunt, and anti-perfectionist — read it in a sitting.',
    source: { by: 'Jason Fried & David Heinemeier Hansson', medium: 'book' },
  }),
  read('read-ship-2', 'ship', {
    title: 'The Diary of a CEO',
    body: 'Steven Bartlett’s long, candid conversations with founders and operators on the real cost of building.',
    value: 'Because you want to ship more; the honest version of what shipping actually takes.',
    source: { by: 'Steven Bartlett', medium: 'podcast' },
  }),
  read('read-ship-3', 'ship', {
    title: 'Shoe Dog',
    body: 'Phil Knight’s memoir of building Nike — persistence, near-death cash crunches, and shipping anyway.',
    value: 'Because you want to ship more; the long game, told without the gloss.',
    source: { by: 'Phil Knight', medium: 'book' },
  }),
  read('read-steady-1', 'stead', {
    title: 'Meditations',
    body: 'Marcus Aurelius’ private notes to himself — the original nightly reflection, on composure and control.',
    value: 'Because you’re working on staying steady; two thousand years on, still the cleanest manual for it.',
    source: { by: 'Marcus Aurelius', medium: 'book' },
  }),
  read('read-steady-2', 'stead', {
    title: 'On Being',
    body: 'Krista Tippett’s slow, deep conversations on meaning, resilience, and being human.',
    value: 'Because you’re working on staying steady; a different pace to end the day on.',
    source: { by: 'Krista Tippett', medium: 'podcast', url: 'https://onbeing.org/' },
  }),
  read('read-steady-3', 'stead', {
    title: 'Man’s Search for Meaning',
    body: 'Viktor Frankl on the last freedom — choosing your response — forged in the worst conditions imaginable.',
    value: 'Because you’re working on staying steady; it resets what “a hard day” even means.',
    source: { by: 'Viktor Frankl', medium: 'book' },
  }),
  read('read-creative-1', 'creativ', {
    title: 'The Creative Act',
    body: 'Rick Rubin on making things — attention, taste, and getting out of your own way.',
    value: 'Because you’re after creative range; less technique, more permission.',
    source: { by: 'Rick Rubin', medium: 'book' },
  }),
  read('read-creative-2', 'creativ', {
    title: 'Jiro Dreams of Sushi',
    body: 'A film on mastery and the discipline of doing one thing extraordinarily well, for decades.',
    value: 'Because you’re after creative range; a study in what depth over novelty actually looks like.',
    source: { by: 'dir. David Gelb', medium: 'film' },
  }),
  read('read-creative-3', 'creativ', {
    title: 'Steal Like an Artist',
    body: 'Austin Kleon on influence, remixing, and the permission to just start making.',
    value: 'Because you’re after creative range; the fastest kick out of a blank-page freeze.',
    source: { by: 'Austin Kleon', medium: 'book' },
  }),
] as const

// ---- the gate: is Coach due to check in? --------------------------------

/**
 * True when it's time to consider surfacing a nudge: at least a couple of nights
 * in, no nudge currently awaiting the user's decision (one at a time), and enough
 * Nights have passed since the last check — an irregular 2–5 gap, so it never
 * lands daily and never feels scheduled. Whether anything actually surfaces is a
 * further judgement (Opus online, a fitting seed offline).
 */
export function dueForNudge(state: AppState): boolean {
  const nights = nightsOf(state)
  if (nights < MIN_GAP) return false
  if (openNudge(state)) return false
  const gap = gapFor(nights + state.nudges.length)
  return nights - state.lastNudgeCheck >= gap
}

/** Draw the best-fitting library nudge not already offered — or null if none fits. */
export function pickOfflineNudge(state: AppState): NudgeDraft | null {
  const c = buildNudgeCtx(state)
  const used = new Set(state.nudges.map((n) => n.seedId).filter(Boolean))
  const cands = SEEDS.filter((s) => !used.has(s.seedId) && s.fit(c))
  if (!cands.length) return null
  cands.sort((a, b) => b.weight - a.weight || hash(c.nights + a.weight) - hash(c.nights + b.weight))
  const { seedId, kind, title, body, value, source } = cands[0]
  return { seedId, kind, title, body, value, source }
}

/** Stamp a draft into a live nudge. */
export function toNudge(d: NudgeDraft, id: string, night: number, date: string, origin: 'ai' | 'local'): Nudge {
  return {
    id, night, date, kind: d.kind, title: d.title, body: d.body, value: d.value,
    source: d.source, seedId: d.seedId, status: 'open', origin, seen: false,
  }
}

/**
 * The weekly WOOP becomes a standing intention — born COMMITTED (the user just
 * set it themselves; there's nothing to accept) and checked in on a few nights
 * later through the same lifecycle as every other commitment: kept or didn't
 * stick, never punishing. Distinct from the nightly commitment ledger.
 */
export function weeklyIntentionNudge(
  woop: { wish: string; outcome: string; obstacle: string; plan: string },
  id: string,
  nights: number,
  date: string,
): Nudge {
  return {
    id, night: nights, date, kind: 'intention',
    title: woop.wish.trim(),
    body: woop.plan.trim(),
    value: woop.outcome.trim() || 'The one outcome that makes next week a win.',
    note: woop.obstacle.trim() ? `The obstacle: ${woop.obstacle.trim()}` : undefined,
    status: 'committed', checkInNight: nights + 5, origin: 'local',
    seen: true, checkInSeen: false,
  }
}

// ---- lifecycle (pure over Nudge[]) --------------------------------------

/** Commit to trying it — Coach will check in a few nights on. */
export function commitNudge(nudges: Nudge[], id: string, nights: number, note?: string): Nudge[] {
  const gap = checkInGap(nights)
  return nudges.map((n) =>
    n.id === id
      ? { ...n, status: 'committed', checkInNight: nights + gap, note: note?.trim() || n.note, seen: true, checkInSeen: false }
      : n,
  )
}
/** Not for them — set it aside, optionally with a reason Coach can learn from. */
export function declineNudge(nudges: Nudge[], id: string, note?: string): Nudge[] {
  return nudges.map((n) => (n.id === id ? { ...n, status: 'declined', note: note?.trim() || n.note, seen: true } : n))
}
/** Resolve a due check-in. */
export function resolveNudge(nudges: Nudge[], id: string, kept: boolean): Nudge[] {
  return nudges.map((n) => (n.id === id ? { ...n, status: kept ? 'kept' : 'dropped', checkInSeen: true } : n))
}
/** Attach or replace the user's pushback / ask-for-help note. */
export function noteNudge(nudges: Nudge[], id: string, note: string): Nudge[] {
  return nudges.map((n) => (n.id === id ? { ...n, note: note.trim() } : n))
}
/** Mark whatever's currently demanding attention as seen (clears the tab marker). */
export function markSeen(nudges: Nudge[], nights: number): Nudge[] {
  return nudges.map((n) => {
    if (n.status === 'open' && !n.seen) return { ...n, seen: true }
    if (n.status === 'committed' && n.checkInNight != null && nights >= n.checkInNight && !n.checkInSeen) {
      return { ...n, checkInSeen: true }
    }
    return n
  })
}

// ---- selectors -----------------------------------------------------------

export const openNudge = (state: AppState): Nudge | null =>
  state.nudges.find((n) => n.status === 'open') ?? null

/** Commitments whose check-in has come due. */
export const checkInsDue = (state: AppState): Nudge[] => {
  const n = nightsOf(state)
  return state.nudges.filter((x) => x.status === 'committed' && x.checkInNight != null && n >= x.checkInNight)
}
/** Commitments still in flight (check-in not yet due). */
export const inFlight = (state: AppState): Nudge[] => {
  const n = nightsOf(state)
  return state.nudges.filter((x) => x.status === 'committed' && !(x.checkInNight != null && n >= x.checkInNight))
}
/** Resolved nudges, newest first — the quiet history. */
export const resolvedNudges = (state: AppState): Nudge[] =>
  state.nudges.filter((n) => n.status === 'kept' || n.status === 'dropped' || n.status === 'declined')

/** Attention worth a tab dot: an unseen open nudge, a check-in newly due, or
 *  an intention adrift awaiting the user's call (still on / let go). */
export const unseenCount = (state: AppState): number => {
  const open = openNudge(state)
  let c = open && !open.seen ? 1 : 0
  for (const x of checkInsDue(state)) if (!x.checkInSeen) c += 1
  if (staleCommitment(state.coach)) c += 1
  return c
}
