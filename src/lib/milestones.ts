/**
 * Milestones — the only moments colour is permitted.
 *
 * Mira's palette is pure black and white. These five gradients exist solely
 * to cut milestone gems from. They are never used as backgrounds, never
 * ambient, never decorative. If colour appears, the user earned it.
 */
export const GRADIENTS: readonly [string, string][] = [
  ['#D9C7FF', '#8FF3DA'],
  ['#9FC4FF', '#C0A8FF'],
  ['#D6FFA3', '#A3F5FF'],
  ['#F0CBF5', '#F2FF6B'],
  ['#EFBCFF', '#FFDCB0'],
]

/** Streak lengths that mint a gem. */
export const STREAK_MILESTONES = [1, 3, 7, 14, 30, 60, 100, 180, 365] as const

export const isStreakMilestone = (streak: number): boolean =>
  (STREAK_MILESTONES as readonly number[]).includes(streak)

/** Stable gradient choice per milestone, so a given streak always looks the same. */
export const gemVariant = (streak: number): number => {
  const i = (STREAK_MILESTONES as readonly number[]).indexOf(streak)
  return (i >= 0 ? i : streak) % GRADIENTS.length
}

export const milestoneLabel = (streak: number): string => {
  if (streak === 1) return 'First reflection'
  if (streak >= 365) return 'One year'
  return `${streak}-day streak`
}
