import { CHARGED, type CoachReply, type Entry } from './types'

/**
 * Offline, rule-based Coach.
 *
 * This is the fallback when no AI endpoint is configured, and it mirrors the
 * exact intervention priority the production system prompt uses:
 *   1. rumination ("why" spiral)  -> rewrite toward what / what-next  (Eurich)
 *   2. emotionally charged         -> self-distanced reframe           (Kross)
 *   3. recurring pattern           -> name the pattern
 *   4. missing agency              -> ask for their contribution
 *   5. otherwise                   -> one sharper follow-up
 */
export function localCoach(entry: Entry, history: Entry[], name: string): CoachReply {
  const who = name || 'there'
  const blob = `${entry.event} ${entry.well} ${entry.next}`.toLowerCase()

  // 1. Rumination / "why" spiral
  if (
    /\bwhy (am|do|did|is|are|can'?t|does|would)\b/.test(blob) ||
    /(always|never able|what'?s wrong with me|i'?m such a)/.test(blob)
  ) {
    return {
      kind: 'rumination',
      source: 'local',
      text: `${who}, there's a "why me" thread running through that — and that's the road to rumination, not insight. Reframe it: what specifically happened, and what's the one thing you'll do next time?`,
      lesson: `Eurich's research: "why" questions spiral; "what" questions produce action.`,
    }
  }

  // 2. Emotionally charged -> self-distancing
  if (entry.emotions.some((e) => CHARGED.includes(e))) {
    return {
      kind: 'distancing',
      source: 'local',
      text: `That sounds genuinely heavy. Step outside it for a second: "${who}, what's actually going on here — and what would you tell a founder you respect who was in this exact spot?" Same facts, calmer head.`,
      lesson: `Kross: addressing yourself by name lowers emotional reactivity under stress.`,
    }
  }

  // 3. Pattern across history
  const pattern = findPattern(entry, history, who)
  if (pattern) {
    return {
      kind: 'pattern',
      source: 'local',
      text: pattern,
      lesson: `Spotting patterns across entries is what a paper journal can't do.`,
    }
  }

  // 4. Missing agency
  if (!entry.well.trim()) {
    return {
      kind: 'agency',
      source: 'local',
      text: `You logged the moment — good. But you skipped what you did to shape it. Next time, name your contribution: reflecting on your own agency is what compounds into confidence.`,
    }
  }

  // 5. One sharper follow-up
  const followups = [
    `Solid, specific entry. One nudge: is that next step fully in your control? If it depends on someone else, shrink it to the part that's yours.`,
    `Good — a real moment and a real next step. Quick test: could you do that action in the first 30 minutes tomorrow? Front-load it.`,
    `Clear read on yourself today. What's the smallest version of tomorrow's action you couldn't skip even on a chaotic day?`,
  ]
  return {
    kind: 'followup',
    source: 'local',
    text: `${who}, ${followups[entry.event.length % followups.length]}`,
  }
}

function findPattern(entry: Entry, history: Entry[], who: string): string | null {
  const recent = history.slice(0, 14)
  if (recent.length < 3) return null

  const tally: Record<string, number> = {}
  for (const h of recent) for (const e of h.emotions) tally[e] = (tally[e] ?? 0) + 1

  const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]
  if (top && top[1] >= 3 && entry.emotions.includes(top[0] as never)) {
    return `"${top[0]}" keeps showing up — that's ${top[1] + 1} entries now. That's a signal, not noise. Worth a weekly review: what conditions produce it, and which one can you change?`
  }

  if (/(decision|decide|avoid|putting off|procrastinat|should talk|need to tell)/.test(
    `${entry.event} ${entry.next}`.toLowerCase(),
  )) {
    return `${who}, an avoided decision has surfaced again. That's exactly what the monthly fear-setting exercise is for — define the worst case, and the cost of not deciding.`
  }
  return null
}
