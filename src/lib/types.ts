export const EMOTIONS = [
  'Energized', 'Proud', 'Calm', 'Focused', 'Grateful', 'Excited',
  'Anxious', 'Frustrated', 'Drained', 'Overwhelmed', 'Discouraged', 'Restless',
] as const

export type Emotion = (typeof EMOTIONS)[number]

/** Emotions that trigger the self-distancing intervention (Kross). */
export const CHARGED: Emotion[] = [
  'Anxious', 'Frustrated', 'Drained', 'Overwhelmed', 'Discouraged', 'Restless',
]

export interface Entry {
  id: string
  /** ISO date, YYYY-MM-DD — the "day" this entry belongs to. */
  date: string
  /** The specific event (Pennebaker: specificity). */
  event: string
  emotions: Emotion[]
  /** What went well + your contribution (agency). */
  well: string
  /** One thing to do differently (action-orientation). */
  next: string
  ts: number
  /** Coach's reply, cached so we don't re-bill the API. */
  coach?: CoachReply
  /** The user's one optional answer to Coach's nightly read. Always saved first. */
  coachAnswer?: string
  /** Coach's one short closing line after the optional answer. Never fabricated locally. */
  coachClose?: CoachClose
  /**
   * Written while offline (or a transient online failure): the reflection is
   * saved and the Night advances, but Coach hasn't read it yet. Cleared once a
   * reply is fetched on reconnect. Only set when a Coach endpoint is configured
   * — a fully local-only install never flags this, so it never bills later.
   */
  pendingCoach?: boolean
  /** 1 = helpful, 0 = off, undefined = unrated. Tunes Coach's read. */
  rating?: 0 | 1
  /** The morning bookend of this day, if one was set — the night weighs against it. */
  morning?: { win: string; question?: string; answer?: string }
  synced?: boolean
}

/** Which evidence-based intervention fired (mirrors the expert modules). */
export type CoachKind =
  | 'rumination' // Eurich: rewrite a why-spiral toward what/what-next
  | 'distancing' // Kross: self-distanced, name-addressed reframe
  | 'pattern' // name a recurring theme across entries
  | 'agency' // Goldsmith: what did YOU do to cause it
  | 'fear_setting' // Ferriss: an avoided decision, define/cost-of-inaction
  | 'celebration' // mark a real win, tied to contribution — sparingly
  | 'accountability' // a prior intention came due
  | 'followup' // one sharper question

export interface CoachReply {
  text: string
  lesson?: string
  kind: CoachKind
  source: 'ai' | 'local'
  /** Which model produced it + why it was routed there. Debug only, never shown. */
  meta?: { model?: string; route?: string }
}

/** The final, AI-produced line that closes the optional answer turn. */
export interface CoachClose {
  text: string
  source: 'ai'
  /** Which model produced it + why it was routed there. Debug only, never shown. */
  meta?: CoachReply['meta']
}

/**
 * What Coach carries back per reply to grow its memory of the user. Merged
 * locally — no server state. Small and bounded on purpose.
 */
export interface CoachMemo {
  /** 1–3 short theme tags detected in tonight's entry. */
  themes?: string[]
  /** Whether tonight's entry acted on the prior open intention. */
  commitment?: 'kept' | 'dropped' | 'unknown'
  /** A running read of the user's register, so replies mirror their voice. */
  voiceHint?: string
  /** Tomorrow morning's one question, written tonight while Coach has the full
   *  picture. Usually absent — silence is the common, correct answer. */
  morningQuestion?: string
}

/** The morning bookend: one win for the day, plus Coach's optional question. */
export interface MorningNote {
  date: string
  /** "What would make today a win?" — one specific outcome (Locke & Latham). */
  win: string
  /** The adaptive question Coach asked this morning, if any. */
  question?: string
  answer?: string
}

export interface InsightCard {
  id: string
  text: string
  date: string
}

/** The theme the user sets for the coming month — Coach weighs nights against
 *  it, lightly, through that month. The one number stays the Night count. */
export interface MonthTheme {
  text: string
  date: string
}

/** 'intention' = the standing weekly WOOP intention, born committed from the
 *  weekly review — same lifecycle (check-in → kept/didn't stick), never AI-drawn. */
export type NudgeKind = 'tip' | 'action' | 'habit' | 'routine' | 'reading' | 'intention'
/** open → the user hasn't decided · committed → they'll try it (Coach checks in) ·
 *  kept/dropped → how the check-in resolved · declined → not for them. */
export type NudgeStatus = 'open' | 'committed' | 'kept' | 'dropped' | 'declined'

export interface NudgeSource {
  by: string
  medium: 'book' | 'talk' | 'article' | 'paper' | 'podcast' | 'film' | 'blog'
  url?: string
}

/**
 * An occasional Coach nudge — a tip, action, habit, routine, or reading. Surfaced
 * irregularly (never two nights running) and only when it can make a real
 * difference, the way a good coach mentions one thing between sessions. The user
 * can commit to it, push back on it, or set it aside; Coach checks in later on
 * whatever they committed to. AI-generated when online; drawn from an evidence-
 * based library when not.
 */
export interface Nudge {
  id: string
  /** Night count when it was surfaced. */
  night: number
  date: string
  kind: NudgeKind
  title: string
  /** The suggestion itself. */
  body: string
  /** How it creates value / why it fits them now — always shown. */
  value: string
  /** For readings: the real, credible work. */
  source?: NudgeSource
  status: NudgeStatus
  /** The user's pushback or ask-for-help — kept for Coach's next read. */
  note?: string
  /** Set on commit: the Night at/after which Coach checks in. */
  checkInNight?: number
  /** Seed id when drawn from the offline library (dedupe); absent for AI nudges. */
  seedId?: string
  origin: 'ai' | 'local'
  /** The user has seen this in its current actionable state. */
  seen?: boolean
  /** The user has seen the "how did it go?" check-in once it came due. */
  checkInSeen?: boolean
}

/** A recurring topic: recency (last) + longevity (first, count). */
export interface ThemeLedgerEntry {
  key: string
  count: number
  first: string
  last: string
}

/** A "one thing I'll do differently" intention, tracked to close the loop.
 *  'stale' = it aged out unresolved and awaits the user's call — still on, or
 *  let go — instead of dying silently (a real coach would ask). */
export interface Commitment {
  date: string
  text: string
  status: 'open' | 'kept' | 'dropped' | 'stale'
}

/**
 * Who the user is, learned over time. Revised by the weekly Opus pass,
 * nudged by daily replies. Every field is bounded (see coachMemory.ts).
 */
export interface CoachProfile {
  /** Coach's running note on who this person is and how they're changing —
   *  ~120 words, revised by the weekly pass, prepended to every coaching call.
   *  Narrative carries what flat lists can't: trajectory, tension, change. */
  narrative?: string
  /** Learned register: terse/warm/technical/lowercase/etc. Drives voice-mirroring. */
  voice?: string
  values?: string[]
  goals?: string[]
  /** Internal obstacles (WOOP): avoidance, perfectionism, distraction… */
  obstacles?: string[]
  /** Named people / roles that recur. */
  relationships?: string[]
  /** Named projects / products. */
  projects?: string[]
  /** Coaching moves that landed (rated helpful). */
  landed?: string[]
  /** Moves to ease off (rated not-quite). */
  avoided?: string[]
  updatedAt?: string
}

/** Local-first coach memory. Persisted and synced like the rest of state. */
export interface CoachMemory {
  profile: CoachProfile
  themes: ThemeLedgerEntry[]
  commitments: Commitment[]
}

export interface Settings {
  name: string
  /** Implementation intention: "After I <cue>, I reflect." (Gollwitzer) */
  cue: string
  reminderTime: string
  /** Morning note: last night's intention, delivered when it can be acted on.
   *  Empty string = off. */
  morningTime: string
  tone: 'default' | 'gentler' | 'sharper'
  /**
   * Backup & sync is EXPLICIT OPT-IN. false = reflections are never stored
   * off the device (Coach still reads a night live to reply — a separate,
   * visible act, not storage). true = entries back up under the anonymous
   * account. null = undecided: legacy states, migrated once on load to true
   * only if this device already had a sync session.
   */
  sync: boolean | null
}

export interface GameState {
  /** Total completed Nights. It only rises when a new day is reflected on. */
  nights: number
  lastDay: string | null
}

export interface AppState {
  settings: Settings
  game: GameState
  entries: Entry[]
  cards: InsightCard[]
  coach: CoachMemory
  /** Occasional Coach nudges, newest first. */
  nudges: Nudge[]
  /** Night count at the last nudge check (whether or not one surfaced) — paces them. */
  lastNudgeCheck: number
  /** The `game.lastDay` a comeback was acknowledged for — shows it once per lapse. */
  comebackAck: string | null
  /** Morning bookends, newest first. Bounded; the day's entry carries its own copy. */
  mornings: MorningNote[]
  /** Tomorrow's Coach question, written by tonight's reply (memo.morningQuestion).
   *  Fetched at night so the morning needs no network. */
  nextMorningQuestion: { forDate: string; text: string } | null
  /** Date of the last GUIDED weekly review (the user's own work). Paces readiness. */
  lastWeeklyReview: string | null
  /** Date of the last weekly synthesis of ANY kind (guided or quiet memory-only). */
  lastWeeklySynthesis: string | null
  /** Past monthly-arc reads, newest first. */
  arcs: InsightCard[]
  /** The theme set at the last monthly arc — referenced in nightly reads. */
  monthTheme: MonthTheme | null
  /** Date of the last monthly arc — paces the next. */
  lastMonthlyArc: string | null
  /** The last Night whose stone development the user has pressed through.
   *  Below game.nights = the stone holds undeveloped film, waiting. */
  stoneSeen: number
  onboarded: boolean
}

export const emptyCoachMemory = (): CoachMemory => ({ profile: {}, themes: [], commitments: [] })

export const initialState = (): AppState => ({
  settings: { name: '', cue: '', reminderTime: '21:30', morningTime: '08:30', tone: 'default', sync: null },
  game: { nights: 0, lastDay: null },
  entries: [],
  cards: [],
  coach: emptyCoachMemory(),
  nudges: [],
  lastNudgeCheck: 0,
  comebackAck: null,
  mornings: [],
  nextMorningQuestion: null,
  lastWeeklyReview: null,
  lastWeeklySynthesis: null,
  arcs: [],
  monthTheme: null,
  lastMonthlyArc: null,
  stoneSeen: 0,
  onboarded: false,
})
