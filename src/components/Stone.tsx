import { useId, useMemo, useState } from 'react'
import { STONES, nextStone, type Stone as StoneModel } from '../lib/milestones'
import { renderStone, type StoneRender } from '../lib/stoneGeometry'

interface StoneProps {
  /** The colourway + cut. A banked stone renders its pre-baked artwork. */
  stone?: StoneModel | null
  /** Colour only in two places: the milestone moment and the Vault detail. */
  colored?: boolean
  /** Play the one-time 1200ms reveal (implies coloured). */
  reveal?: boolean
  /**
   * The milestone stone arrives inside raw rock — 'intact' shows ONLY the
   * rock (no colour reaches the screen), 'opened' fades the rock away and
   * reveals the gem.
   */
  shellState?: 'intact' | 'opened'
  /**
   * The Night count — drives the stone on the bench: its cut is the NEXT
   * milestone's, one facet per completed night, the silhouette truing up
   * as the milestone nears. Ignored when a banked `stone` is given.
   */
  night?: number
  /** Tonight's freshly cut facet catches extra light. */
  newFacet?: boolean
  size?: number
  /** One quiet word, at most — a stage or a stone name. Never a number. */
  caption?: string
}

/**
 * The five finished stones are pre-baked renders — a real 3D pipeline
 * (three.js, physically lit, baked offline in tools/gemrig) shipped as
 * static artwork, the way the best gem apps do it. The stone on the bench
 * stays procedural SVG: quiet, greyscale, one facet per night.
 */
const ART: Record<string, string> = {
  Ember: '/stones/ember.webp',
  Tide: '/stones/tide.webp',
  Iris: '/stones/iris.webp',
  Aurora: '/stones/aurora.webp',
  Solstice: '/stones/solstice.webp',
}
const ROCK = '/stones/rock.webp'

export function Stone({
  stone, colored = false, reveal = false, shellState, night, newFacet = false, size = 132, caption,
}: StoneProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const isColour = (colored || reveal) && !!stone
  const encased = shellState === 'intact'
  const opened = shellState === 'opened'

  // All hooks run unconditionally, before any branch returns.
  const bench = useMemo(() => {
    const n = Math.max(0, night ?? 0)
    const target = nextStone(n) ?? STONES[STONES.length - 1]
    const ci = STONES.findIndex((s) => s.name === target.name)
    const prev = ci > 0 ? STONES[ci - 1].night : 0
    const span = target.night - prev
    const into = Math.min(n - prev, span)
    return { ci: Math.max(0, ci), span, into, name: target.name.toLowerCase() }
  }, [night])

  const frameSrc = `/stones/progress/${bench.name}-${bench.into}.webp`
  const [framesFailed, setFramesFailed] = useState<Record<string, boolean>>({})

  const geo: StoneRender = useMemo(
    () => renderStone(bench.ci, { nightsIntoSpan: bench.into, span: bench.span, markNew: newFacet }),
    [bench, newFacet],
  )

  // ---- a banked / milestone stone: the baked artwork ----
  if (stone) {
    const label = encased ? 'Stone' : caption ?? stone.name
    return (
      <figure className={`stone${reveal && !encased ? ' reveal' : ''}`} style={{ width: size }}>
        <div className="stone-art" style={{ width: size, height: size }}>
          {/* The gem never reaches the screen while the rock holds. */}
          {!encased && (
            <img
              src={ART[stone.name]}
              alt={label}
              width={size}
              height={size}
              className={isColour ? 'stone-img' : 'stone-img grey'}
              draggable={false}
            />
          )}
          {(encased || opened) && (
            <img
              src={ROCK}
              alt={encased ? label : ''}
              width={size}
              height={size}
              className={`stone-img rock${opened ? ' away' : ''}`}
              draggable={false}
              aria-hidden={opened}
            />
          )}
        </div>
        {caption && !encased && <figcaption className="ambient">{caption}</figcaption>}
      </figure>
    )
  }

  // ---- the stone on the bench: evolving nightly ----
  // Per-night baked frames (AI or rig renders, greyscale by law) are used
  // when present: /stones/progress/<stone>-<nightIntoSpan>.webp. A missing
  // frame falls back to the procedural SVG — partial frame sets ship safely.
  if (!framesFailed[frameSrc]) {
    return (
      <figure className="stone" style={{ width: size }}>
        <div className="stone-art" style={{ width: size, height: size }}>
          <img
            src={frameSrc}
            alt={caption ?? 'Stone'}
            width={size}
            height={size}
            className="stone-img grey"
            draggable={false}
            onError={() => setFramesFailed((f) => ({ ...f, [frameSrc]: true }))}
          />
        </div>
        {caption && <figcaption className="ambient">{caption}</figcaption>}
      </figure>
    )
  }

  const id = (k: string) => `st-${k}-${uid}`
  const fillOpacity = (b: number, revealed: boolean, isNew: boolean): number => {
    if (!revealed) return 0.09 + b * 0.05
    const boosted = isNew ? Math.min(1, b + 0.3) : b
    return 0.10 + boosted * 0.34
  }

  return (
    <figure className="stone" style={{ width: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={caption ?? 'Stone'}>
        <defs>
          <filter id={id('glow')} x="-45%" y="-45%" width="190%" height="190%">
            <feGaussianBlur stdDeviation="5.5" />
          </filter>
          <clipPath id={id('clip')}>
            <polygon points={geo.silhouette} />
          </clipPath>
        </defs>

        <polygon points={geo.silhouette} fill="#FFFFFF" opacity="0.05" filter={`url(#${id('glow')})`} />

        <g clipPath={`url(#${id('clip')})`}>
          <polygon points={geo.silhouette} fill="#FFFFFF" opacity="0.05" />
          {/* The heart-thread: the captured light in the core — there from the
              first dark shard, brighter as the crystal wakes. Achromatic. */}
          <polyline
            points={geo.heart.points}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity={geo.heart.strength * 0.5}
            filter={`url(#${id('glow')})`}
          />
          <polyline
            points={geo.heart.points}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="0.7"
            strokeLinecap="round"
            opacity={geo.heart.strength * 0.85}
          />
          {geo.facets.map((f, i) => (
            <polygon
              key={i}
              points={f.points}
              fill="#FFFFFF"
              fillOpacity={fillOpacity(f.brightness, f.revealed, f.isNew)}
              stroke={
                f.isNew
                  ? 'rgba(255,255,255,0.55)'
                  : f.revealed
                    ? f.locked ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.15)'
                    : 'none'
              }
              strokeWidth={f.isNew ? 0.9 : f.locked ? 0.55 : 0.4}
            />
          ))}
          {geo.speculars.map((s, i) =>
            i === 0 || geo.progress >= 0.5 ? (
              <polygon
                key={`sp${i}`}
                points={s.points}
                fill="#FFFFFF"
                opacity={s.strength * 0.3 * (0.45 + 0.55 * geo.progress)}
              />
            ) : null,
          )}
        </g>

        <polygon points={geo.silhouette} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="0.7" />
        <line
          x1={geo.girdle.x1} y1={geo.girdle.y1} x2={geo.girdle.x2} y2={geo.girdle.y2}
          stroke="var(--gem-girdle)" strokeWidth="0.75"
        />
      </svg>
      {caption && <figcaption className="ambient">{caption}</figcaption>}
    </figure>
  )
}
