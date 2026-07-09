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
  /** 1 = helpful, 0 = off, undefined = unrated. Tunes Coach's read. */
  rating?: 0 | 1
  synced?: boolean
}

export interface CoachReply {
  text: string
  lesson?: string
  /** Which evidence-based intervention fired. */
  kind: 'rumination' | 'distancing' | 'pattern' | 'agency' | 'followup'
  source: 'ai' | 'local'
}

export interface InsightCard {
  id: string
  text: string
  date: string
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
  onboarded: boolean
}

export const initialState = (): AppState => ({
  settings: { name: '', cue: '', reminderTime: '21:30', tone: 'default' },
  game: { xp: 0, level: 1, streak: 0, best: 0, freezes: 1, lastDay: null },
  entries: [],
  cards: [],
  onboarded: false,
})
