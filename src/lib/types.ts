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
  /**
   * Written while offline (or a transient online failure): the reflection is
   * saved and the Night advances, but Coach hasn't read it yet. Cleared once a
   * reply is fetched on reconnect. Only set when a Coach endpoint is configured
   * — a fully local-only install never flags this, so it never bills later.
   */
  pendingCoach?: boolean
  /** 1 = helpful, 0 = off, undefined = unrated. Tunes Coach's read. */
  rating?: 0 | 1
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
}

export interface InsightCard {
  id: string
  text: string
  date: string
}

/** A recurring topic: recency (last) + longevity (first, count). */
export interface ThemeLedgerEntry {
  key: string
  count: number
  first: string
  last: string
}

/** A "one thing I'll do differently" intention, tracked to close the loop. */
export interface Commitment {
  date: string
  text: string
  status: 'open' | 'kept' | 'dropped'
}

/**
 * Who the user is, learned over time. Revised by the weekly Opus pass,
 * nudged by daily replies. Every field is bounded (see coachMemory.ts).
 */
export interface CoachProfile {
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
  tone: 'default' | 'gentler' | 'sharper'
}

export interface GameState {
  /** xp/level drive the Stone's stage internally — NEVER shown to the user. */
  xp: number
  level: number
  /** The Night count. The only number the user ever sees. */
  streak: number
  best: number
  /** "Never miss twice" — one auto-freeze per week bridges a single missed Night. */
  freezes: number
  lastDay: string | null
}

export interface AppState {
  settings: Settings
  game: GameState
  entries: Entry[]
  cards: InsightCard[]
  coach: CoachMemory
  onboarded: boolean
}

export const emptyCoachMemory = (): CoachMemory => ({ profile: {}, themes: [], commitments: [] })

export const initialState = (): AppState => ({
  settings: { name: '', cue: '', reminderTime: '21:30', tone: 'default' },
  game: { xp: 0, level: 1, streak: 0, best: 0, freezes: 1, lastDay: null },
  entries: [],
  cards: [],
  coach: emptyCoachMemory(),
  onboarded: false,
})
