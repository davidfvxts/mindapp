import { useId, useMemo } from 'react'
import { STONES, nextStone, type Stone as StoneModel } from '../lib/milestones'
import { fireBlobs, renderStone, rockShell, type StoneRender } from '../lib/stoneGeometry'

interface StoneProps {
  /** The colourway + cut. A banked stone renders its finished form. */
  stone?: StoneModel | null
  /** Colour only in two places: the milestone moment and the Vault detail. */
  colored?: boolean
  /** Play the one-time 1200ms reveal (implies coloured), with the glint. */
  reveal?: boolean
  /**
   * The milestone stone arrives encased in rock — 'intact' shows ONLY the
   * rock (no colour reaches the DOM), 'cracked' bursts the shards and
   * reveals the gem beneath.
   */
  shellState?: 'intact' | 'cracked'
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

/** Deterministic colour math for the body/fire palettes. */
const shade = (hex: string, f: number): string => {
  // f > 0 lightens toward white, f < 0 deepens toward black.
  const n = parseInt(hex.slice(1), 16)
  const ch = (c: number) => {
    const v = f >= 0 ? c + (255 - c) * f : c * (1 + f)
    return Math.max(0, Math.min(255, Math.round(v)))
  }
  const r = ch((n >> 16) & 255)
  const g = ch((n >> 8) & 255)
  const b = ch(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/**
 * The Stone — an evolving artpiece rendered from deterministic geometry.
 * Colour lives INSIDE the stone: a deep radial body, a turbulence-swirled
 * fire of the stone's own palette, glassy facet overlays, one soft gloss and
 * a rim light. Milestone stones arrive encased in lit rock and are cracked
 * open by hand. Nothing loops; the 1200ms reveal (with its one glint) is
 * the only motion, plus the one-time shard burst it belongs to.
 */
export function Stone({
  stone, colored = false, reveal = false, shellState, night, newFacet = false, size = 132, caption,
}: StoneProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const isColour = (colored || reveal) && !!stone
  const encased = shellState === 'intact'
  const cracked = shellState === 'cracked'

  const { geo, cutIndex } = useMemo(() => {
    if (stone) {
      const ci = Math.max(0, STONES.findIndex((s) => s.name === stone.name))
      const span = spanOf(stone)
      return { geo: renderStone(ci, { nightsIntoSpan: span, span }), cutIndex: ci }
    }
    const n = Math.max(0, night ?? 0)
    const target = nextStone(n) ?? STONES[STONES.length - 1]
    const ci = STONES.findIndex((s) => s.name === target.name)
    const prev = ci > 0 ? STONES[ci - 1].night : 0
    const span = target.night - prev
    return {
      geo: renderStone(ci, { nightsIntoSpan: Math.min(n - prev, span), span, markNew: newFacet }),
      cutIndex: ci,
    }
  }, [stone, night, newFacet]) as { geo: StoneRender; cutIndex: number }

  const shell = useMemo(() => (encased || cracked ? rockShell(cutIndex) : null), [encased, cracked, cutIndex])
  const fire = useMemo(() => (isColour ? fireBlobs(cutIndex) : []), [isColour, cutIndex])

  const label = caption ?? (encased ? 'Stone' : isColour ? stone!.name : 'Stone')
  const id = (k: string) => `st-${k}-${uid}`
  const fireTone = (t: 0 | 1 | 2): string =>
    t === 0 ? shade(stone?.from ?? '#888', 0.3) : t === 1 ? shade(stone?.to ?? '#666', 0.25) : shade(stone?.from ?? '#aaa', 0.62)

  // Facet overlays: in colour mode the fire shines THROUGH — bright faces get
  // a white glaze, dark faces a smoked one, so the cut reads over the depth.
  // Greyscale keeps the quiet white-on-black build of the nightly bench.
  const facetFill = (b: number, revealed: boolean, isNew: boolean): { fill: string; opacity: number } => {
    const boosted = isNew ? Math.min(1, b + 0.3) : b
    if (isColour) {
      if (!revealed) return { fill: '#000000', opacity: 0.5 }
      return boosted >= 0.52
        ? { fill: '#FFFFFF', opacity: (boosted - 0.52) * 0.36 }
        : { fill: '#000000', opacity: (0.52 - boosted) * 0.8 }
    }
    if (!revealed) return { fill: '#FFFFFF', opacity: 0.09 + b * 0.05 }
    return { fill: '#FFFFFF', opacity: 0.10 + boosted * 0.34 }
  }

  return (
    <figure className={`stone${reveal && !encased ? ' reveal' : ''}${cracked ? ' cracked' : ''}`} style={{ width: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={label}>
        <defs>
          {isColour && !encased && (
            <>
              {/* The body: deep — the fire provides the light, like a real opal. */}
              <radialGradient id={id('body')} cx="0.38" cy="0.30" r="0.85">
                <stop offset="0%" stopColor={stone!.from} />
                <stop offset="48%" stopColor={shade(stone!.to, -0.18)} />
                <stop offset="100%" stopColor={shade(stone!.to, -0.86)} />
              </radialGradient>
              {/* The rim shadow that gives it mass. */}
              <radialGradient id={id('rim')} cx="0.5" cy="0.46" r="0.60">
                <stop offset="0%" stopColor="#000000" stopOpacity="0" />
                <stop offset="70%" stopColor="#000000" stopOpacity="0" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.72" />
              </radialGradient>
              <linearGradient id={id('grad')} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={stone!.from} />
                <stop offset="100%" stopColor={stone!.to} />
              </linearGradient>
              {/* The fire: seeded turbulence swirls the palette blobs. */}
              <filter id={id('swirl')} x="-30%" y="-30%" width="160%" height="160%">
                <feTurbulence type="fractalNoise" baseFrequency="0.032" numOctaves="3" seed={11 + cutIndex * 7} result="n" />
                <feDisplacementMap in="SourceGraphic" in2="n" scale="30" />
                <feGaussianBlur stdDeviation="1.6" />
                <feColorMatrix type="saturate" values="1.45" />
              </filter>
              <filter id={id('soft')} x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="2.6" />
              </filter>
            </>
          )}
          {(encased || cracked) && (
            <>
              {/* Rock: real lighting over fractal noise — each shard catches its own. */}
              <filter id={id('rock')} x="-25%" y="-25%" width="150%" height="150%">
                <feTurbulence type="fractalNoise" baseFrequency="0.11" numOctaves="4" seed={7 + cutIndex} result="n" />
                <feDiffuseLighting in="n" lightingColor="#9d9d9d" surfaceScale="3.2" result="lit">
                  <feDistantLight azimuth="235" elevation="40" />
                </feDiffuseLighting>
                <feComposite in="lit" in2="SourceAlpha" operator="in" />
              </filter>
              {/* Volume: the rock turns from the light like any real mass. */}
              <radialGradient id={id('rockshade')} cx="0.36" cy="0.32" r="0.95">
                <stop offset="0%" stopColor="#000000" stopOpacity="0" />
                <stop offset="55%" stopColor="#000000" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.66" />
              </radialGradient>
            </>
          )}
          <filter id={id('glow')} x="-45%" y="-45%" width="190%" height="190%">
            <feGaussianBlur stdDeviation="5.5" />
          </filter>
          <filter id={id('halo')} x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="11" />
          </filter>
          <clipPath id={id('clip')}>
            <polygon points={geo.silhouette} />
          </clipPath>
        </defs>

        {/* ---- the gem (never in the DOM while the rock is intact) ---- */}
        {!encased && (
          <>
            {/* The bloom — two breaths of it at the colour moments. */}
            {isColour && (
              <polygon points={geo.silhouette} fill={`url(#${id('grad')})`} opacity="0.34" filter={`url(#${id('halo')})`} />
            )}
            <polygon
              points={geo.silhouette}
              fill={isColour ? `url(#${id('grad')})` : '#FFFFFF'}
              opacity={isColour ? 0.5 : 0.05}
              filter={`url(#${id('glow')})`}
            />

            <g clipPath={`url(#${id('clip')})`}>
              {isColour ? (
                <>
                  <polygon points={geo.silhouette} fill={`url(#${id('body')})`} />
                  {/* The fire lives inside — screen-blended pops of the palette
                      over the deep body, so it reads as light held in the stone. */}
                  <g filter={`url(#${id('swirl')})`} style={{ mixBlendMode: 'screen' }} opacity="0.95">
                    {fire.map((f, i) => (
                      <circle key={i} cx={f.cx} cy={f.cy} r={f.r * 0.82} fill={fireTone(f.tone)} opacity={0.9} />
                    ))}
                  </g>
                </>
              ) : (
                /* The bench stone breathes a little volume even in grey. */
                <polygon points={geo.silhouette} fill="#FFFFFF" opacity="0.05" />
              )}

              {/* The cut: facet glazes + edges over the depth. */}
              {geo.facets.map((f, i) => {
                const { fill, opacity } = facetFill(f.brightness, f.revealed, f.isNew)
                return (
                  <polygon
                    key={i}
                    points={f.points}
                    fill={fill}
                    fillOpacity={opacity}
                    stroke={f.isNew ? 'rgba(255,255,255,0.55)' : f.revealed ? 'rgba(255,255,255,0.15)' : 'none'}
                    strokeWidth={f.isNew ? 0.9 : 0.4}
                  />
                )
              })}

              {isColour ? (
                <>
                  {/* Mass: the rim falls into shadow. */}
                  <polygon points={geo.silhouette} fill={`url(#${id('rim')})`} />
                  {/* Gloss: one soft surface light + its hot spot. */}
                  <ellipse
                    cx="38" cy="23" rx="22" ry="8.5" fill="#FFFFFF" opacity="0.24"
                    filter={`url(#${id('soft')})`} transform="rotate(-15 38 23)"
                  />
                  <circle cx="33" cy="21" r="2.4" fill="#FFFFFF" opacity="0.7" filter={`url(#${id('soft')})`} />
                </>
              ) : (
                geo.speculars.map((s, i) =>
                  i === 0 || geo.progress >= 0.5 ? (
                    <polygon
                      key={`sp${i}`}
                      points={s.points}
                      fill="#FFFFFF"
                      opacity={s.strength * 0.3 * (0.45 + 0.55 * geo.progress)}
                    />
                  ) : null,
                )
              )}
            </g>

            {/* Rim light + the girdle seam. */}
            <polygon
              points={geo.silhouette}
              fill="none"
              stroke={isColour ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.16)'}
              strokeWidth="0.7"
            />
            <line
              x1={geo.girdle.x1} y1={geo.girdle.y1} x2={geo.girdle.x2} y2={geo.girdle.y2}
              stroke="var(--gem-girdle)" strokeWidth="0.75"
            />

            {/* The one-time glint, swept inside the reveal's 1200ms. */}
            {reveal && (
              <g clipPath={`url(#${id('clip')})`}>
                <g className="glint">
                  <polygon points="-18,0 -6,0 -26,100 -38,100" fill="#FFFFFF" opacity="0.5" />
                </g>
              </g>
            )}
          </>
        )}

        {/* ---- the rock shell: intact holds; cracked bursts ---- */}
        {shell && (
          <g className="shards">
            {shell.shards.map((s, i) => (
              <g
                key={i}
                className="shard"
                style={{ '--sdx': `${s.dx}px`, '--sdy': `${s.dy}px`, '--srot': `${s.rot}deg` } as React.CSSProperties}
              >
                <polygon points={s.points} fill="#5a5a5a" filter={`url(#${id('rock')})`} />
                {/* Each fracture face turns from the light a little differently. */}
                <polygon points={s.points} fill="#000000" opacity={0.12 + s.tone * 0.22} />
                <polygon points={s.points} fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="0.8" />
              </g>
            ))}
            {/* The mass: one shade over the whole rock while it holds. */}
            {encased && <polygon points={shell.outline} fill={`url(#${id('rockshade')})`} />}
          </g>
        )}
      </svg>
      {caption && !encased && <figcaption className="ambient">{caption}</figcaption>}
    </figure>
  )
}
