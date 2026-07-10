/**
 * Tests for the Stone's geometry — the evolving centerpiece.
 * Run: npm test
 */
import { fireBlobs, renderStone, rockShell } from '../src/lib/stoneGeometry'
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

// ---- the rock shell: the crack-open mechanic ----
const shellA = rockShell(0)
const shellB = rockShell(0)
ok('rock shell is deterministic', JSON.stringify(shellA) === JSON.stringify(shellB))
ok('shell has 9–11 shards', shellA.shards.length >= 9 && shellA.shards.length <= 11)
ok('every shard drifts outward with spin', shellA.shards.every((s) => Math.hypot(s.dx, s.dy) >= 10 && Number.isFinite(s.rot)))
const shellPts = shellA.shards.flatMap((s) => s.points.split(' ').map((p) => p.split(',').map(Number)))
ok('shards stay near the stage', shellPts.every(([x, y]) => x >= -10 && x <= 110 && y >= -10 && y <= 110))
const xs = shellPts.map(([x]) => x)
const ys = shellPts.map(([, y]) => y)
ok('the shell fully hides the gem', Math.min(...xs) < 12 && Math.max(...xs) > 88 && Math.min(...ys) < 14 && Math.max(...ys) > 93)
ok('shells differ per stone', JSON.stringify(rockShell(1)) !== JSON.stringify(shellA))

// ---- the fire: colour inside the stone ----
const fireA = fireBlobs(2)
ok('fire is deterministic', JSON.stringify(fireA) === JSON.stringify(fireBlobs(2)))
ok('fire carries 5–6 blobs in range', fireA.length >= 5 && fireA.length <= 6 &&
  fireA.every((f) => f.cx >= 20 && f.cx <= 80 && f.cy >= 18 && f.cy <= 82 && f.r >= 8 && f.r <= 21))
ok('fire uses all three tones', new Set(fireA.map((f) => f.tone)).size === 3)

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
