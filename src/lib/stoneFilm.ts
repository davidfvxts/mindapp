import { STONES, nextStone } from './milestones'

/*
 * The stone's evolution as FILM (PURE: no DOM). One short video per stone is
 * the whole span's evolution — raw shard to polished-and-alive. Every night
 * earns a slice of it; the user presses and holds the stone and the film
 * develops forward from the last frame they've seen to tonight's. Nothing is
 * ever lost or replayed punitively:
 *
 *   - a missed night just means the next press develops a longer stretch
 *   - pressing a settled stone does nothing but a single quiet pulse
 *   - a new span starts a new film from its beginning
 *
 * The mapping is fractional so any film length works: night n of a span s
 * ends at fraction n/s of that stone's film.
 */

/** Film sources per stone, tried in order: the local (offline, vendored)
 *  file first, then the remote master. A stone without a film falls back to
 *  the procedural SVG stone automatically. */
export const STONE_FILMS: Record<string, string[]> = {
  Ember: [
    '/stones/video/ember.mp4',
    'https://pub-cbaba171dd9345789653e0cb803ac31d.r2.dev/hf_20260711_104654_a387b859-73f8-42fb-abcf-e04cfd288e1e.mp4',
  ],
}

/** The film sources for the stone currently on the bench at this Night. */
export function filmForNight(night: number): string[] | null {
  const target = nextStone(night) ?? STONES[STONES.length - 1]
  return STONE_FILMS[target.name] ?? null
}

export interface FilmWindow {
  /** Where the press starts, as a fraction of the film (the last seen frame). */
  fromF: number
  /** Where it settles: tonight's frame. */
  toF: number
  /** Anything new to develop? False = a single pulse, no motion. */
  owed: boolean
}

/**
 * The stretch of film a press develops, given the Night count and the last
 * night whose development the user has seen. Pure; clamped at both ends.
 */
export function filmWindow(nights: number, seen: number): FilmWindow {
  const n = Math.max(0, Math.floor(nights))
  const target = nextStone(n) ?? STONES[STONES.length - 1]
  const idx = STONES.findIndex((s) => s.name === target.name)
  const prev = idx > 0 ? STONES[idx - 1].night : 0
  const span = Math.max(1, target.night - prev)

  const frac = (night: number): number =>
    Math.max(0, Math.min(1, (night - prev) / span))

  // Seen can never exceed tonight, and a seen-night from an earlier span
  // simply means the new film starts at its beginning.
  const toF = frac(n)
  const fromF = Math.min(frac(Math.max(0, Math.floor(seen))), toF)
  return { fromF, toF, owed: toF > fromF }
}
