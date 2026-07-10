/**
 * Facet — the Stone's geometry (PURE: no DOM, no randomness, no time).
 *
 * The centerpiece of the game layer. The stone is an evolving artpiece:
 * it begins as a jittered rough, and every completed Night does two visible
 * things — one more facet is CUT (it ignites with light and crisp edges),
 * and the whole silhouette trues up a little toward the final form. At the
 * milestone the last facet lands, the jitter reaches zero, and the cut is
 * complete. Everything is deterministic: the same night always renders the
 * same stone, on every device, forever.
 *
 * Five cuts, one per milestone stone. A banked stone keeps exactly the
 * facets its span earned, so later stones are literally more finely worked:
 *   Ember    (7 nights)  keen classic, few bold planes
 *   Tide     (23 nights) wide cushion, soft shoulders
 *   Iris     (60 nights) tall oval, elegant
 *   Aurora   (90 nights) pear — the culet drifts off-centre
 *   Solstice (185 nights) round brilliant, the finest work
 *
 * Tessellation is crack-free by construction: every horizontal line of the
 * stone is sampled at the same M+1 columns, facets group whole columns, and
 * adjacent bands share the exact same jittered points.
 */

export interface FacetSpec {
  /** SVG polygon points, viewBox 0..100. */
  points: string
  /** 0..1 — how much of the key light this face catches. */
  brightness: number
  /** Cut and polished (true) vs still rough matte (false). */
  revealed: boolean
  /** Tonight's freshly cut face — rendered a touch brighter. */
  isNew: boolean
}

export interface SpecularSpec {
  points: string
  /** Relative strength 0..1; the renderer scales per colour mode. */
  strength: number
}

export interface StoneRender {
  /** The outer silhouette as polygon points — drives the glow and the glint clip. */
  silhouette: string
  facets: FacetSpec[]
  girdle: { x1: number; y1: number; x2: number; y2: number }
  speculars: SpecularSpec[]
  revealedCount: number
  totalFacets: number
  /** 0..1 — overall progress toward the finished cut. */
  progress: number
}

export interface SpanProgress {
  /** Nights completed inside this stone's span. At or past `span` = the finished cut. */
  nightsIntoSpan: number
  /** Total nights the span holds (milestone − previous milestone). */
  span: number
  /** Mark tonight's facet as freshly cut. */
  markNew?: boolean
}

interface CutSpec {
  tableY: number
  girdleY: number
  culetY: number
  tableHalf: number
  girdleHalf: number
  /** 0..~0.15 — how much the side lines bow outward (cushion/round look). */
  bulge: number
  /** Horizontal culet drift — the pear. */
  culetOffset: number
}

/** One cut per milestone stone, in milestone order. */
const CUTS: readonly CutSpec[] = [
  { tableY: 18, girdleY: 47, culetY: 90, tableHalf: 16, girdleHalf: 34, bulge: 0.02, culetOffset: 0 }, // Ember
  { tableY: 20, girdleY: 50, culetY: 86, tableHalf: 22, girdleHalf: 38, bulge: 0.10, culetOffset: 0 }, // Tide
  { tableY: 14, girdleY: 46, culetY: 93, tableHalf: 14, girdleHalf: 30, bulge: 0.06, culetOffset: 0 }, // Iris
  { tableY: 17, girdleY: 48, culetY: 91, tableHalf: 18, girdleHalf: 35, bulge: 0.07, culetOffset: 7 }, // Aurora
  { tableY: 16, girdleY: 48, culetY: 90, tableHalf: 19, girdleHalf: 36, bulge: 0.12, culetOffset: 0 }, // Solstice
]

const MAX_FACETS = 97
const JITTER_AMPLITUDE = 3.4
const CX = 50

// ---- deterministic hashing (no Math.random, ever) ------------------------

const hash = (n: number): number => {
  let x = Math.imul(n | 0, 2654435761)
  x ^= x >>> 16
  x = Math.imul(x, 2246822519)
  x ^= x >>> 13
  return x >>> 0
}
/** Uniform 0..1 from an integer seed. */
const unit = (n: number): number => hash(n) / 4294967295
/** Signed −1..1 from an integer seed. */
const signed = (n: number): number => unit(n) * 2 - 1

const r2 = (n: number): number => Math.round(n * 100) / 100
const pt = (x: number, y: number): string => `${r2(x)},${r2(y)}`

// ---- band plan ------------------------------------------------------------

interface Band {
  kind: 'table' | 'crown' | 'pavilion'
  count: number
  /** Line indices into the shared point grid. bottom −1 = the culet point. */
  top: number
  bottom: number
}

interface Plan {
  bands: Band[]
  total: number
  crownRows: number
  pavRows: number
  /** Index of the girdle in the line list. */
  girdleLine: number
  /** Real horizontal lines (the culet point is extra). */
  lineCount: number
}

/**
 * Decide how many facets the finished cut carries and how they distribute
 * across bands. Exactly one facet per night when the span allows (≤ 97);
 * longer spans still change nightly through the jitter easing.
 */
function planBands(span: number): Plan {
  const total = Math.max(5, Math.min(span, MAX_FACETS))
  const crownRows = total > 40 ? 2 : 1
  const pavRows = total > 60 ? 2 : 1

  const rest = total - 1
  let crownTotal = Math.max(crownRows, Math.round(rest * 0.48))
  let pavTotal = rest - crownTotal
  if (pavTotal < pavRows) {
    pavTotal = pavRows
    crownTotal = rest - pavTotal
  }

  const splitRows = (n: number, rows: number, growToward: 'bottom' | 'top'): number[] => {
    if (rows === 1) return [n]
    const a = Math.max(1, Math.round(n * 0.42))
    const b = Math.max(1, n - a)
    return growToward === 'bottom' ? [a, b] : [b, a]
  }

  // Finer work sits nearer the girdle (crown grows downward, pavilion upward).
  const crownCounts = splitRows(crownTotal, crownRows, 'bottom')
  const pavCounts = splitRows(pavTotal, pavRows, 'top')

  const bands: Band[] = [{ kind: 'table', count: 1, top: 0, bottom: 1 }]
  crownCounts.forEach((count, i) => bands.push({ kind: 'crown', count, top: 1 + i, bottom: 2 + i }))
  const girdleLine = 1 + crownRows
  pavCounts.forEach((count, i) =>
    bands.push({
      kind: 'pavilion',
      count,
      top: girdleLine + i,
      // The last pavilion band converges to the culet point itself.
      bottom: i === pavRows - 1 ? -1 : girdleLine + i + 1,
    }),
  )
  return { bands, total, crownRows, pavRows, girdleLine, lineCount: 1 + crownRows + pavRows }
}

// ---- the renderer ----------------------------------------------------------

/**
 * Render a stone. `cutIndex` picks the milestone cut (0 = Ember … 4 = Solstice).
 * `nightsIntoSpan >= span` renders the finished, banked cut.
 */
export function renderStone(cutIndex: number, opts: SpanProgress): StoneRender {
  const ci = Math.max(0, Math.min(CUTS.length - 1, cutIndex | 0))
  const cut = CUTS[ci]

  const span = Math.max(1, Math.floor(opts.span))
  const nights = Math.max(0, Math.min(Math.floor(opts.nightsIntoSpan), span))
  const progress = nights / span
  const markNew = !!opts.markNew && nights >= 1 && nights < span

  const plan = planBands(span)
  const revealedCount =
    nights <= 0 ? 0 : nights >= span ? plan.total : Math.max(1, Math.round((plan.total * nights) / span))

  // Jitter eases out as the cut nears completion — the stone trues up nightly.
  const λ = (1 - progress) * JITTER_AMPLITUDE

  // ---- the shared point grid ----
  const { girdleLine, lineCount } = plan
  const M = Math.max(...plan.bands.map((b) => b.count), 1)

  const lineY: number[] = []
  const lineHalf: number[] = []
  for (let l = 0; l < lineCount; l++) {
    if (l <= girdleLine) {
      const t = l / girdleLine
      lineY.push(cut.tableY + (cut.girdleY - cut.tableY) * t)
      // The side bows outward between table and girdle (cushion/round cuts).
      const w = cut.tableHalf + (cut.girdleHalf - cut.tableHalf) * t
      lineHalf.push(w * (1 + cut.bulge * Math.sin(Math.PI * t)))
    } else {
      // Pavilion mid lines march toward the culet.
      const t = (l - girdleLine) / plan.pavRows
      lineY.push(cut.girdleY + (cut.culetY - cut.girdleY) * t * 0.92)
      lineHalf.push(cut.girdleHalf * (1 - t * 0.62))
    }
  }

  const gridX = (l: number, c: number): number => {
    const w = lineHalf[l]
    const jitter = signed(ci * 7919 + l * 131 + c * 17) * λ
    return CX - w + (2 * w * c) / M + jitter
  }
  const gridY = (l: number, c: number): number => {
    const jitter = signed(ci * 7919 + l * 131 + c * 17 + 500009) * λ * 0.6
    return lineY[l] + jitter
  }
  const culet = {
    x: CX + cut.culetOffset + signed(ci * 7919 + 999331) * λ * 0.5,
    y: cut.culetY + signed(ci * 7919 + 999787) * λ * 0.5,
  }

  // ---- facets ----
  const light = { x: -0.55, y: -0.835 } // fixed key light, top-left
  const raw: { points: string; brightness: number; cx: number; cy: number }[] = []

  for (const band of plan.bands) {
    const toCulet = band.bottom === -1
    for (let f = 0; f < band.count; f++) {
      const c0 = Math.floor((f * M) / band.count)
      const c1 = Math.floor(((f + 1) * M) / band.count)
      const top: string[] = []
      for (let c = c0; c <= c1; c++) top.push(pt(gridX(band.top, c), gridY(band.top, c)))
      const bottom: string[] = []
      if (toCulet) {
        bottom.push(pt(culet.x, culet.y))
      } else {
        for (let c = c1; c >= c0; c--) bottom.push(pt(gridX(band.bottom, c), gridY(band.bottom, c)))
      }
      const points = [...top, ...bottom].join(' ')

      const midC = Math.round((c0 + c1) / 2)
      const cx = gridX(band.top, midC)
      const cy = (gridY(band.top, midC) + (toCulet ? culet.y : gridY(band.bottom, midC))) / 2
      const dx = Math.max(-1, Math.min(1, (cx - CX) / cut.girdleHalf))

      // Pseudo-normal per band kind: the table faces up, the crown tilts up
      // and outward, the pavilion faces down and away.
      let nx = 0
      let ny = 0
      if (band.kind === 'table') { nx = dx * 0.1; ny = -0.95 }
      else if (band.kind === 'crown') { nx = dx * 0.8; ny = -0.62 }
      else { nx = dx * 0.72; ny = 0.58 }
      const nl = Math.hypot(nx, ny) || 1
      const lambert = (nx / nl) * light.x + (ny / nl) * light.y
      // Sparkle: adjacent faces catch slightly different light.
      const sparkle = signed(ci * 104729 + raw.length * 7907) * 0.11
      const brightness = Math.max(0.05, Math.min(1, 0.5 + 0.5 * lambert + sparkle))

      raw.push({ points, brightness, cx, cy })
    }
  }

  // ---- reveal order: the table is the first cut, then the light spreads
  // outward from the heart of the stone, organically. ----
  const order = raw
    .map((f, i) => ({
      i,
      score: i === 0 ? -1 : Math.hypot(f.cx - CX, f.cy - cut.girdleY) + unit(ci * 31 + i * 613) * 9,
    }))
    .sort((a, b) => a.score - b.score)
    .map((o) => o.i)

  const revealedSet = new Set(order.slice(0, revealedCount))
  const newest = markNew && revealedCount > 0 ? order[revealedCount - 1] : -1

  const facets: FacetSpec[] = raw.map((f, i) => ({
    points: f.points,
    brightness: f.brightness,
    revealed: revealedSet.has(i),
    isNew: i === newest,
  }))

  // ---- silhouette (shares the exact grid points — crack-free) ----
  const right: string[] = []
  const left: string[] = []
  for (let l = 0; l < lineCount; l++) {
    right.push(pt(gridX(l, M), gridY(l, M)))
    left.unshift(pt(gridX(l, 0), gridY(l, 0)))
  }
  const silhouette = [...right, pt(culet.x, culet.y), ...left].join(' ')

  // ---- speculars: what makes it read as shiny. Achromatic by law. ----
  const tY0 = lineY[0]
  const tY1 = lineY[1]
  const th = lineHalf[0]
  const yA = tY0 + (tY1 - tY0) * 0.22
  const yB = tY0 + (tY1 - tY0) * 0.85
  const speculars: SpecularSpec[] = [
    {
      // The table streak — a slanted flash across the top.
      points: [pt(CX - th * 0.58, yA), pt(CX - th * 0.22, yA), pt(CX + th * 0.10, yB), pt(CX - th * 0.26, yB)].join(' '),
      strength: 1,
    },
    {
      // The long crown flash, upper-left edge toward the girdle.
      points: [
        pt(CX - th * 0.72, tY0 + 1.6),
        pt(CX - th * 0.5, tY0 + 1.6),
        pt(CX - cut.girdleHalf * 0.66, cut.girdleY - 1.8),
        pt(CX - cut.girdleHalf * 0.82, cut.girdleY - 1.8),
      ].join(' '),
      strength: 0.55,
    },
  ]

  return {
    silhouette,
    facets,
    girdle: {
      x1: r2(gridX(girdleLine, 0)),
      y1: r2(gridY(girdleLine, 0)),
      x2: r2(gridX(girdleLine, M)),
      y2: r2(gridY(girdleLine, M)),
    },
    speculars,
    revealedCount,
    totalFacets: plan.total,
    progress,
  }
}

// ---- the fire: colour that lives INSIDE the stone -------------------------
// Deterministic blob field, swirled by an feTurbulence displacement in the
// renderer. Tones index the stone's palette (0 = from, 1 = to, 2 = a light).

export interface FireBlob {
  cx: number
  cy: number
  r: number
  tone: 0 | 1 | 2
}

export function fireBlobs(cutIndex: number): FireBlob[] {
  const ci = Math.max(0, Math.min(CUTS.length - 1, cutIndex | 0))
  const blobs: FireBlob[] = []
  const n = 5 + (hash(ci * 37 + 5) % 2) // 5–6
  for (let i = 0; i < n; i++) {
    blobs.push({
      cx: r2(28 + unit(ci * 977 + i * 71) * 44),
      cy: r2(26 + unit(ci * 977 + i * 71 + 13) * 48),
      r: r2(9 + unit(ci * 977 + i * 71 + 29) * 11),
      tone: (i % 3) as 0 | 1 | 2,
    })
  }
  return blobs
}

// ---- the rock shell: the milestone stone arrives encased ------------------
// A jittered blob partitioned into shards that tile it exactly; on the crack,
// each shard flies along its precomputed drift. Deterministic, like all else.

export interface Shard {
  points: string
  /** 0..1 — per-shard face brightness, so the fracture faces differ. */
  tone: number
  /** Drift vector + spin for the crack-open burst (viewBox units / degrees). */
  dx: number
  dy: number
  rot: number
}

export function rockShell(cutIndex: number): { shards: Shard[]; outline: string } {
  const ci = Math.max(0, Math.min(CUTS.length - 1, cutIndex | 0))
  const cx = 50
  const cy = 52
  const V = 9 + (hash(ci * 53 + 3) % 3) // 9–11 rim vertices

  // One off-centre heart: every shard shares it, so the shards tile the
  // rock exactly — the crack pattern is the shared edges, never a gap.
  const heart = { x: 47 + signed(ci * 11 + 1) * 4, y: 50 + signed(ci * 11 + 2) * 4 }

  const rim: { x: number; y: number }[] = []
  const outer: { x: number; y: number }[] = []
  for (let i = 0; i < V; i++) {
    const angle = (i / V) * Math.PI * 2 + signed(ci * 211 + i * 7) * 0.16
    const radius = 43 + signed(ci * 211 + i * 7 + 991) * 4.5
    rim.push({ x: cx + Math.cos(angle) * radius * 1.02, y: cy + Math.sin(angle) * radius * 0.98 })
  }

  const shards: Shard[] = []
  for (let i = 0; i < V; i++) {
    const a = rim[i]
    const b = rim[(i + 1) % V]
    // The outer edge bulges a little, so the rock reads as mass, not a wheel.
    const bulge = 2 + unit(ci * 389 + i * 17) * 3
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2
    const ml = Math.hypot(mx - cx, my - cy) || 1
    const m = { x: mx + ((mx - cx) / ml) * bulge, y: my + ((my - cy) / ml) * bulge }
    outer.push({ ...a })
    outer.push({ ...m })

    const gx = (heart.x + a.x + m.x + b.x) / 4
    const gy = (heart.y + a.y + m.y + b.y) / 4
    const gl = Math.hypot(gx - cx, gy - cy) || 1
    const speed = 14 + unit(ci * 389 + i * 17 + 7) * 10

    shards.push({
      points: [pt(heart.x, heart.y), pt(a.x, a.y), pt(m.x, m.y), pt(b.x, b.y)].join(' '),
      tone: r2(unit(ci * 389 + i * 17 + 41)),
      dx: r2(((gx - cx) / gl) * speed),
      dy: r2(((gy - cy) / gl) * speed),
      rot: r2(signed(ci * 389 + i * 17 + 23) * 26),
    })
  }
  return { shards, outline: outer.map((p) => pt(p.x, p.y)).join(' ') }
}
