import type { CoachMemory, CoachProfile } from './types'

/*
 * Onboarding as coach intake. The guided flow's structured answers seed the
 * CoachMemory profile deterministically (so Coach knows the user from night 1,
 * even offline), and produce a real "First Read" — the wow moment — which the
 * AI enriches when online. All pure; tested in scripts/test-coach.ts.
 */

/** What the guided flow collects, beyond name/cue/time. */
export interface OnboardingAnswers {
  name: string
  /** What they want to get sharper at — the goal. */
  goals: string[]
  /** What they're building + who with — free text, optional. */
  world: string
  /** What's tripped up reflection before — the internal obstacle. */
  obstacle: string
  cue: string
  reminderTime: string
}

export interface FirstReflection {
  event: string
  emotions: string[]
  well: string
  next: string
}

/** The tappable options — single source for the UI and the profile seed. */
export const GOAL_OPTIONS = [
  'Sharper decisions',
  'Deep focus',
  'Leading people',
  'Shipping more',
  'Staying steady',
  'Creative range',
] as const

export const OBSTACLE_OPTIONS = [
  'No time',
  'Perfectionism',
  'I forget',
  'Avoidance',
  'It felt pointless',
] as const

const OBSTACLE_PHRASE: Record<string, string> = {
  'No time': 'protecting the time',
  Perfectionism: 'perfectionism',
  'I forget': 'forgetting to start',
  Avoidance: 'avoidance',
  'It felt pointless': 'doubting it helps',
}

const clean = (s: string): string => s.replace(/\s+/g, ' ').trim()

/** Map an obstacle chip to the phrase Coach carries in the profile. */
export const obstaclePhrase = (o: string): string => OBSTACLE_PHRASE[o] ?? clean(o).toLowerCase()

/**
 * Seed CoachMemory from the intake answers — deterministic, so the profile is
 * populated the moment onboarding finishes, with or without the network.
 */
export function seedMemoryFromAnswers(a: OnboardingAnswers, today: string): CoachMemory {
  const profile: CoachProfile = {
    goals: a.goals.map(clean).filter(Boolean).slice(0, 8),
    obstacles: a.obstacle ? [obstaclePhrase(a.obstacle)] : [],
    projects: a.world.trim() ? [clean(a.world).slice(0, 140)] : [],
    updatedAt: today,
  }
  return { profile, themes: [], commitments: [] }
}

const firstWords = (s: string, n = 12): string => {
  const words = clean(s).split(' ')
  const head = words.slice(0, n).join(' ')
  return words.length > n ? `${head}…` : head
}

/**
 * A genuine, specific First Read stitched from the intake + tonight's first
 * reflection. Used offline / without a key; online, the AI writes a richer one.
 * Warm, concrete, never gushing — references their own answers so it lands.
 */
export function deterministicFirstRead(a: OnboardingAnswers, first: FirstReflection): string {
  const who = a.name || 'there'
  const goal = a.goals[0]?.toLowerCase()
  const obstacle = a.obstacle ? obstaclePhrase(a.obstacle) : ''
  const cue = clean(a.cue) || 'close your laptop'

  const parts: string[] = [`${who}, night one is down — and you already did the hard part: one concrete moment, named.`]
  if (first.event.trim()) parts.push(`"${firstWords(first.event)}" is exactly the kind of specific this practice runs on.`)
  if (goal) parts.push(`You're here to get sharper at ${goal}; this is how that compounds — one night at a time.`)
  if (obstacle) parts.push(`And the thing that's tripped you before — ${obstacle} — I'll watch for it with you.`)
  parts.push(`Come back tomorrow, after you ${cue}. That's the whole trick.`)
  return parts.join(' ')
}
