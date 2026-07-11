/**
 * The Stone — the only place colour is permitted in Facet.
 *
 * Colour appears in exactly two contexts: the full-screen milestone moment
 * (once, at earning) and the Vault detail view. Everywhere else the Stone
 * renders greyscale. These five gradients are the entire colour budget of
 * the product — never a background, tint, border, or button. Treat them
 * like real money.
 */
export interface Stone {
  /** The stone's plain name. Shown only at the milestone moment / Vault detail. */
  name: string
  /** The Night that earns it. */
  night: number
  from: string
  to: string
  /** The chapter line — what the light learned in this stone. One quiet
   *  sentence for the Vault detail; words, never numbers. */
  chapter: string
}

/** Earned in order. Nights match the design system exactly. The chapters tell
 *  one storyline across the stones (docs/Stone-Story.md): the same light
 *  migrates from stone to stone, learning a new shape in each. */
export const STONES: readonly Stone[] = [
  { name: 'Ember', night: 7, from: '#FF6A3D', to: '#C2273B', chapter: 'The spark that survives — the light learned to stay lit.' },
  { name: 'Tide', night: 30, from: '#35D0BA', to: '#2563EB', chapter: 'The rhythm — the light learned to return.' },
  { name: 'Iris', night: 90, from: '#7C5CFF', to: '#C838F0', chapter: 'The seeing — the light learned to show you patterns.' },
  { name: 'Aurora', night: 180, from: '#34D399', to: '#22D3EE', chapter: 'The movement — the light learned to change shape.' },
  { name: 'Solstice', night: 365, from: '#FFD34D', to: '#FF8A2A', chapter: 'The still point — the light learned to hold steady.' },
] as const

export const isMilestoneNight = (night: number): boolean =>
  STONES.some((s) => s.night === night)

/** The stone earned exactly on this Night, if any. */
export const stoneForNight = (night: number): Stone | null =>
  STONES.find((s) => s.night === night) ?? null

/** The stones already banked at this Night (in the Vault, greyscale in the grid). */
export const bankedStones = (night: number): Stone[] =>
  STONES.filter((s) => s.night <= night)

/** The next milestone still ahead, if any. */
export const nextStone = (night: number): Stone | null =>
  STONES.find((s) => s.night > night) ?? null

/**
 * Progression is shown, never scored. The rough in hand moves through four
 * plain states as it develops toward its next colour milestone. At most one
 * quiet word ever sits under the stone — never a number, never a percentage.
 */
export const STAGES = ['Rough', 'Cut', 'Polished', 'Brilliant'] as const
export type Stage = (typeof STAGES)[number]

export function stoneStage(night: number): Stage {
  if (night <= 0) return 'Rough'
  const prev = STONES.reduce((acc, s) => (s.night < night ? s.night : acc), 0)
  const next = nextStone(night)?.night ?? STONES[STONES.length - 1].night
  if (next <= prev) return 'Brilliant'
  const f = (night - prev) / (next - prev)
  return STAGES[Math.min(STAGES.length - 1, Math.max(0, Math.floor(f * STAGES.length)))]
}
