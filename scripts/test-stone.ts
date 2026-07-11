/**
 * Tests for the Stone's geometry — the evolving centerpiece.
 * Run: npm test
 */
import { renderStone } from '../src/lib/stoneGeometry'
import { milestoneEcho } from '../src/lib/inclusions'
import { STONES } from '../src/lib/milestones'
import type { Entry } from '../src/lib/types'

let fails = 0
const ok = (name: string, cond: boolean) => {
  if (!cond) { fails++; console.log('FAIL:', name) } else console.log('pass:', name)
}

// ---- determinism: the same night renders the same stone, always ----
const a = renderStone(0, { nightsIntoSpan: 3, span: 7 })
const b = renderStone(0, { nightsIntoSpan: 3, span: 7 })
ok('geometry is fully deterministic', JSON.stringify(a) === JSON.stringify(b))

// ---- one facet per night (spans that allow 1:1) ----
const ember = (n: number) => renderStone(0, { nightsIntoSpan: n, span: 7 })
ok('night 0 reveals nothing (pure rough)', ember(0).revealedCount === 0)
ok('night 1 cuts the first facet', ember(1).revealedCount === 1)
ok('facets accrue one per night (span 7)', ember(4).revealedCount === 4)
ok('the milestone completes the cut', ember(7).revealedCount === ember(7).totalFacets)
ok('Ember carries exactly its 7 nights', ember(7).totalFacets === 7)

const tide = renderStone(1, { nightsIntoSpan: 23, span: 23 })
ok('Tide carries exactly its 23 nights', tide.totalFacets === 23)
const iris = renderStone(2, { nightsIntoSpan: 60, span: 60 })
ok('Iris carries exactly its 60 nights', iris.totalFacets === 60)
const solstice = renderStone(4, { nightsIntoSpan: 185, span: 185 })
ok('Solstice caps at the finest workable cut', solstice.totalFacets === 97)

// ---- monotonic reveal ----
let monotone = true
let prev = 0
for (let n = 0; n <= 23; n++) {
  const r = renderStone(1, { nightsIntoSpan: n, span: 23 }).revealedCount
  if (r < prev) monotone = false
  prev = r
}
ok('reveal count never decreases night over night', monotone)

// ---- the nightly evolution is visible: geometry changes every night ----
let changes = true
for (let n = 1; n <= 7; n++) {
  const prevNight = renderStone(0, { nightsIntoSpan: n - 1, span: 7 })
  const thisNight = renderStone(0, { nightsIntoSpan: n, span: 7 })
  if (JSON.stringify(prevNight) === JSON.stringify(thisNight)) changes = false
}
ok('every night visibly changes the stone', changes)

// even beyond 1:1 spans, the silhouette trues up nightly (jitter easing)
const s1 = renderStone(4, { nightsIntoSpan: 100, span: 185 })
const s2 = renderStone(4, { nightsIntoSpan: 101, span: 185 })
ok('long spans still change nightly', s1.silhouette !== s2.silhouette)

// ---- the finished cut is crisp: zero jitter at completion ----
const doneA = renderStone(0, { nightsIntoSpan: 7, span: 7 })
const doneB = renderStone(0, { nightsIntoSpan: 99, span: 7 })
ok('past the span renders the same finished cut', JSON.stringify(doneA) === JSON.stringify(doneB))
ok('the finished cut reports full progress', doneA.progress === 1)

// ---- tonight's facet is marked, exactly one, and only when asked ----
const marked = renderStone(0, { nightsIntoSpan: 3, span: 7, markNew: true })
ok('markNew marks exactly one facet', marked.facets.filter((f) => f.isNew).length === 1)
ok('the marked facet is a revealed one', marked.facets.every((f) => !f.isNew || f.revealed))
ok('no mark without markNew', a.facets.every((f) => !f.isNew))
const markedDone = renderStone(0, { nightsIntoSpan: 7, span: 7, markNew: true })
ok('the finished cut carries no fresh mark', markedDone.facets.every((f) => !f.isNew))

// ---- geometry stays inside the viewBox ----
const allPoints = (r: ReturnType<typeof renderStone>): number[][] =>
  [r.silhouette, ...r.facets.map((f) => f.points), ...r.speculars.map((s) => s.points)]
    .flatMap((s) => s.split(' '))
    .map((p) => p.split(',').map(Number))
let inBounds = true
for (const ci of [0, 1, 2, 3, 4]) {
  for (const n of [0, 1, 5, 60, 185]) {
    for (const [x, y] of allPoints(renderStone(ci, { nightsIntoSpan: n, span: 185 }))) {
      if (!(x >= -2 && x <= 102 && y >= -2 && y <= 102) || Number.isNaN(x) || Number.isNaN(y)) inBounds = false
    }
  }
}
ok('all geometry stays inside the viewBox', inBounds)

// ---- brightness is a sane range, and faces differ (sparkle) ----
const lit = renderStone(1, { nightsIntoSpan: 23, span: 23 })
ok('brightness stays in 0..1', lit.facets.every((f) => f.brightness >= 0 && f.brightness <= 1))
ok('facets catch different light', new Set(lit.facets.map((f) => Math.round(f.brightness * 100))).size > 5)

// ---- five distinct cuts ----
const silhouettes = [0, 1, 2, 3, 4].map((ci) => renderStone(ci, { nightsIntoSpan: 20, span: 20 }).silhouette)
ok('every stone has its own cut', new Set(silhouettes).size === 5)

// ---- the heart-thread: the captured light in the core ----
const shard = renderStone(1, { nightsIntoSpan: 0, span: 23 })
ok('the new dark shard already carries the thread', shard.heart.strength > 0)
const heartPts = shard.heart.points.split(' ').map((p) => p.split(',').map(Number))
ok('the thread lives inside the viewBox', heartPts.every(([x, y]) => x > 0 && x < 100 && y > 0 && y < 100))
const early = renderStone(1, { nightsIntoSpan: 5, span: 23 }).heart.strength
const late = renderStone(1, { nightsIntoSpan: 20, span: 23 }).heart.strength
ok('the thread brightens as the crystal wakes', late > early)
ok('thread strength stays in 0..1', early >= 0 && late <= 1)
const ignition = renderStone(1, { nightsIntoSpan: 1, span: 23, markNew: true }).heart.strength
const nightOneQuiet = renderStone(1, { nightsIntoSpan: 1, span: 23 }).heart.strength
ok('Night 1 ignites the core — the light takes', ignition === 1 && ignition > nightOneQuiet)
const laterNew = renderStone(1, { nightsIntoSpan: 5, span: 23, markNew: true }).heart.strength
ok('later nights wake a face, not the whole core', laterNew < 1)

// ---- the weekly beat: every 7th night a ring locks ----
ok('no ring before the seventh night', renderStone(1, { nightsIntoSpan: 6, span: 23 }).ringsLocked === 0)
ok('the seventh night locks the first ring', renderStone(1, { nightsIntoSpan: 7, span: 23 }).ringsLocked === 1)
ok('the fourteenth locks the second', renderStone(1, { nightsIntoSpan: 14, span: 23 }).ringsLocked === 2)
const week1 = renderStone(1, { nightsIntoSpan: 7, span: 23 })
ok('a locked ring marks its faces', week1.facets.some((f) => f.locked))
ok('rings never exceed the bands', renderStone(4, { nightsIntoSpan: 185, span: 185 }).ringsLocked <= 5)
// The lock is structural: the locked band's lines shed their jitter, so the
// ring's geometry from night 7 survives unchanged into night 8.
const week1Locked = week1.facets.filter((f) => f.locked).map((f) => f.points).join('|')
const week2 = renderStone(1, { nightsIntoSpan: 8, span: 23 })
const week2Locked = week2.facets.filter((f) => f.locked).map((f) => f.points).join('|')
ok('a locked ring holds its shape the next night', week1Locked === week2Locked)

// ---- the milestone echo: the user's own first words of the span ----
const E = (i: number, event: string): Entry =>
  ({ id: `e${i}`, date: `2026-07-${String(i).padStart(2, '0')}`, event, emotions: [], well: '', next: '', ts: i })
// entries are newest-first in state; Night i = i-th oldest
const entries = Array.from({ length: 7 }, (_, k) => E(7 - k, 7 - k === 1 ? 'the first night, honest words' : `night ${7 - k}`))
const echo = milestoneEcho(entries, 7)
ok('milestone echo quotes the span’s first night', echo?.night === 1 && echo.words === 'the first night, honest words')
ok('no echo off a milestone', milestoneEcho(entries, 6) === null)
ok('no echo when the night is missing', milestoneEcho(entries.slice(0, 3), 7) === null)
const long = [...entries]
long[long.length - 1] = E(1, 'x'.repeat(200))
const trimmed = milestoneEcho(long, 7)
ok('long echoes are trimmed with an ellipsis', !!trimmed && trimmed.words.length <= 72 && trimmed.words.endsWith('…'))
ok('milestones table intact (echo depends on it)', STONES[0].night === 7 && STONES.length === 5)

console.log(fails ? `\n${fails} FAILURES` : '\nALL STONE TESTS PASSED')
if (fails) process.exit(1)
