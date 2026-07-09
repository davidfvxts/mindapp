import type { Stone as StoneModel } from '../lib/milestones'

interface StoneProps {
  /** The colourway. Required for a coloured stone; ignored when greyscale. */
  stone?: StoneModel | null
  /** Colour only in two places: the milestone moment and the Vault detail. */
  colored?: boolean
  /** Play the one-time 1200ms reveal (implies coloured). */
  reveal?: boolean
  size?: number
  /** One quiet word, at most — a stage or a stone name. Never a number. */
  caption?: string
}

/*
 * Anatomy (design-system §5): one gradient, five polygons, shaded by opacity
 * of that same gradient — never by a second colour.
 *   Table    — top-centre facet, 100%
 *   Crown    — two flanking facets, 75% / 60%
 *   Pavilion — two lower facets converging to the culet, 85% / 50%
 *   Girdle   — the horizontal seam, achromatic stroke
 *   Culet    — the bottom point; the object reads as light held in a cut
 */
const FACETS = [
  { points: '30,16 70,16 64,46 36,46', o: 1.0, grey: 0.32 }, // table
  { points: '30,16 36,46 14,46', o: 0.75, grey: 0.22 }, // crown L
  { points: '70,16 86,46 64,46', o: 0.6, grey: 0.16 }, // crown R
  { points: '14,46 50,46 50,94', o: 0.85, grey: 0.26 }, // pavilion L
  { points: '50,46 86,46 50,94', o: 0.5, grey: 0.12 }, // pavilion R
] as const

export function Stone({ stone, colored = false, reveal = false, size = 132, caption }: StoneProps) {
  const isColour = (colored || reveal) && !!stone
  const id = `stone-${stone?.name ?? 'rough'}`
  const label = caption ?? (isColour ? stone!.name : 'Stone')

  return (
    <figure className={`stone${reveal ? ' reveal' : ''}`} style={{ width: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={label}>
        {isColour && (
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={stone!.from} />
              <stop offset="100%" stopColor={stone!.to} />
            </linearGradient>
          </defs>
        )}

        {FACETS.map((f, i) => (
          <polygon
            key={i}
            points={f.points}
            fill={isColour ? `url(#${id})` : '#FFFFFF'}
            fillOpacity={isColour ? f.o : f.grey}
          />
        ))}

        {/* Girdle — the seam that reads as "cut". Achromatic in both modes. */}
        <line x1="14" y1="46" x2="86" y2="46" stroke="var(--gem-girdle)" strokeWidth="0.75" />
      </svg>
      {caption && <figcaption className="ambient">{caption}</figcaption>}
    </figure>
  )
}
