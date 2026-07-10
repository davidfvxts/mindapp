import { useId, useMemo } from 'react'
import { STONES, nextStone, type Stone as StoneModel } from '../lib/milestones'
import { renderStone, type StoneRender } from '../lib/stoneGeometry'

interface StoneProps {
  /** The colourway + cut. A banked stone renders its finished form. */
  stone?: StoneModel | null
  /** Colour only in two places: the milestone moment and the Vault detail. */
  colored?: boolean
  /** Play the one-time 1200ms reveal (implies coloured), with the glint. */
  reveal?: boolean
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

/** The span a milestone stone was shaped over (its facet budget). */
const spanOf = (s: StoneModel): number => {
  const i = STONES.findIndex((x) => x.name === s.name)
  return s.night - (i > 0 ? STONES[i - 1].night : 0)
}

/**
 * The Stone — an evolving artpiece, rendered from deterministic geometry
 * (lib/stoneGeometry). Light comes from a fixed key light: every facet
 * catches its own brightness, achromatic speculars make it read as shiny,
 * and at the two colour moments a soft glow blooms behind it. Nothing
 * loops; the 1200ms reveal (with its one glint sweep) is the only motion.
 */
export function Stone({ stone, colored = false, reveal = false, night, newFacet = false, size = 132, caption }: StoneProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const isColour = (colored || reveal) && !!stone

  const geo: StoneRender = useMemo(() => {
    if (stone) {
      // A banked (or just-earned) stone: its own cut, finished.
      const cutIndex = Math.max(0, STONES.findIndex((s) => s.name === stone.name))
      const span = spanOf(stone)
      return renderStone(cutIndex, { nightsIntoSpan: span, span })
    }
    // The stone on the bench: shaped toward the next milestone.
    const n = Math.max(0, night ?? 0)
    const target = nextStone(n) ?? STONES[STONES.length - 1]
    const targetIndex = STONES.findIndex((s) => s.name === target.name)
    const prev = targetIndex > 0 ? STONES[targetIndex - 1].night : 0
    const span = target.night - prev
    return renderStone(targetIndex, {
      nightsIntoSpan: Math.min(n - prev, span),
      span,
      markNew: newFacet,
    })
  }, [stone, night, newFacet])

  const label = caption ?? (isColour ? stone!.name : 'Stone')
  const gradId = `stone-g-${uid}`
  const glowId = `stone-b-${uid}`
  const clipId = `stone-c-${uid}`

  // Fill opacity per facet: colour mode uses the gradient over black for a
  // deep tonal range; greyscale stays quiet — white at low opacities.
  const fillOpacity = (b: number, revealed: boolean, isNew: boolean): number => {
    if (!revealed) return isColour ? 0.16 + b * 0.06 : 0.09 + b * 0.05
    const boosted = isNew ? Math.min(1, b + 0.3) : b
    return isColour ? 0.32 + boosted * 0.68 : 0.10 + boosted * 0.34
  }

  return (
    <figure className={`stone${reveal ? ' reveal' : ''}`} style={{ width: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={label}>
        <defs>
          {isColour && (
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={stone!.from} />
              <stop offset="100%" stopColor={stone!.to} />
            </linearGradient>
          )}
          <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5.5" />
          </filter>
          <clipPath id={clipId}>
            <polygon points={geo.silhouette} />
          </clipPath>
        </defs>

        {/* The bloom — generous at the colour moments, a breath in greyscale. */}
        <polygon
          points={geo.silhouette}
          fill={isColour ? `url(#${gradId})` : '#FFFFFF'}
          opacity={isColour ? 0.5 : 0.05}
          filter={`url(#${glowId})`}
        />

        {/* Facets: rough matte until their night, then cut and lit. */}
        {geo.facets.map((f, i) => (
          <polygon
            key={i}
            points={f.points}
            fill={isColour ? `url(#${gradId})` : '#FFFFFF'}
            fillOpacity={fillOpacity(f.brightness, f.revealed, f.isNew)}
            stroke={f.isNew ? 'rgba(255,255,255,0.55)' : f.revealed ? 'rgba(255,255,255,0.16)' : 'none'}
            strokeWidth={f.isNew ? 0.9 : 0.45}
          />
        ))}

        {/* Speculars — the shine. Achromatic, so they live in both worlds. */}
        {geo.speculars.map((s, i) =>
          i === 0 || geo.progress >= 0.5 ? (
            <polygon
              key={`sp${i}`}
              points={s.points}
              fill="#FFFFFF"
              opacity={s.strength * (isColour ? 0.62 : 0.30) * (0.45 + 0.55 * geo.progress)}
            />
          ) : null,
        )}

        {/* The girdle — the seam that reads as "cut". */}
        <line
          x1={geo.girdle.x1} y1={geo.girdle.y1} x2={geo.girdle.x2} y2={geo.girdle.y2}
          stroke="var(--gem-girdle)" strokeWidth="0.75"
        />

        {/* The one-time glint, swept inside the reveal's 1200ms. */}
        {reveal && (
          <g clipPath={`url(#${clipId})`}>
            <g className="glint">
              <polygon points="-18,0 -6,0 -26,100 -38,100" fill="#FFFFFF" opacity="0.5" />
            </g>
          </g>
        )}
      </svg>
      {caption && <figcaption className="ambient">{caption}</figcaption>}
    </figure>
  )
}
