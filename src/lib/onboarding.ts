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
  /** What they're building + who with — free text, optional (retune collects it). */
  world: string
  /** What's tripped up reflection before — the internal obstacle (retune collects it). */
  obstacle: string
  /** Why now — their own words for what brought them here. The self-persuasion
   *  beat: articulating the motive is itself the commitment. Optional. */
  whyNow?: string
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

/**
 * The cue is written in the first person ("After I close my laptop…") but is
 * quoted back in the second ("after you close your laptop"). Without this,
 * every such line reads "after you close MY laptop" — the kind of seam a
 * tired reader trips on. Conservative on purpose: whole words only.
 */
export function secondPerson(cue: string): string {
  return cue
    .replace(/\bmyself\b/g, 'yourself')
    .replace(/\bMyself\b/g, 'Yourself')
    .replace(/\bmy\b/g, 'your')
    .replace(/\bMy\b/g, 'Your')
    .replace(/\bI\b/g, 'you')
}

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
  // Why-now opens the narrative — Coach's running note starts in the user's
  // own words, and the weekly pass revises it from there.
  if (a.whyNow?.trim()) profile.narrative = `Came to this because: ${clean(a.whyNow).slice(0, 160)}`
  return { profile, themes: [], commitments: [] }
}

/** The hour windows the first reflection adapts to. A signup is never told
 *  to wait for nightfall — the first Night can start any time of day. */
export type FirstWindow = 'morning' | 'day' | 'evening'

export const firstWindow = (hour: number): FirstWindow =>
  hour >= 17 || hour < 4 ? 'evening' : hour < 12 ? 'morning' : 'day'

export interface FirstFrames {
  window: FirstWindow
  /** The moment question — what the reflection looks back on. */
  momentQ: string
  momentPlaceholder: string
  /** The next-step question — aimed at the time still actionable. */
  nextQ: string
}

/** Copy frames for the first reflection, keyed on the clock. Pure. */
export function firstFrames(hour: number): FirstFrames {
  const w = firstWindow(hour)
  if (w === 'morning') {
    return {
      window: w,
      momentQ: 'One concrete thing that happened yesterday.',
      momentPlaceholder: 'A specific event, good or hard. Not how the day went — one moment.',
      nextQ: 'One thing you’ll do differently today.',
    }
  }
  if (w === 'day') {
    return {
      window: w,
      momentQ: 'One concrete thing that’s happened today so far.',
      momentPlaceholder: 'A specific event, good or hard. Not how the day’s going — one moment.',
      nextQ: 'One thing you’ll do differently with the rest of today.',
    }
  }
  return {
    window: w,
    momentQ: 'One concrete thing that happened today.',
    momentPlaceholder: 'A specific event, good or hard. Not how the day went — one moment.',
    nextQ: 'One thing you’ll do differently tomorrow.',
  }
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
  const cue = secondPerson(clean(a.cue)) || 'close your laptop'

  const parts: string[] = [`${who}, night one is down — and you already did the hard part: one concrete moment, named.`]
  if (first.event.trim()) parts.push(`"${firstWords(first.event)}" is exactly the kind of specific this practice runs on.`)
  if (a.whyNow?.trim()) parts.push(`You said why now: "${firstWords(a.whyNow)}" — hold onto that; it's what the nights are for.`)
  if (goal) parts.push(`You're here to get sharper at ${goal}; this is how that compounds — one night at a time.`)
  if (obstacle) parts.push(`And the thing that's tripped you before — ${obstacle} — I'll watch for it with you.`)
  parts.push(`Come back tomorrow, after you ${cue}. That's the whole trick.`)
  return parts.join(' ')
}
