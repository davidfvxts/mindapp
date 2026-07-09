import { GRADIENTS } from '../lib/milestones'

interface GemProps {
  /** Which of the five gradients to cut the gem from. */
  variant?: number
  size?: number
  label?: string
}

/* Four facets of a brilliant cut. Lighting is applied as white/black
   overlays rather than by lowering facet opacity — dropping alpha would
   wash the gradient out against the black canvas. */
const FACETS = [
  { points: '50,10 22,38 50,46', grad: 'a', shade: '#fff', alpha: 0.20 },
  { points: '50,10 78,38 50,46', grad: 'a', shade: '#fff', alpha: 0.04 },
  { points: '22,38 50,46 50,92', grad: 'b', shade: '#000', alpha: 0.10 },
  { points: '78,38 50,46 50,92', grad: 'b', shade: '#000', alpha: 0.30 },
] as const

/**
 * The Gem — the ONLY place colour is allowed in Mira.
 *
 * Design rule (after Opal): the interface is pure black and white. Gradients
 * are reserved for milestone moments, rendered crisp on black, never used as
 * backgrounds or ambient decoration. Scarcity is what makes the reward land.
 *
 * Minted for: your first reflection, streak milestones, level-ups, and each
 * weekly Insight Card. Nothing else.
 */
export function Gem({ variant = 0, size = 120, label }: GemProps) {
  const [from, to] = GRADIENTS[variant % GRADIENTS.length]
  const id = `gem${variant}`

  return (
    <figure className="gem" style={{ width: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={label ?? 'Milestone gem'}>
        <defs>
          <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
          <linearGradient id={`${id}b`} x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={to} />
            <stop offset="100%" stopColor={from} />
          </linearGradient>
          <radialGradient id={`${id}glow`}>
            <stop offset="40%" stopColor={from} stopOpacity="0.22" />
            <stop offset="100%" stopColor={from} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* A restrained halo. Large enough to feel lit, small enough to stay crisp. */}
        <circle cx="50" cy="52" r="36" fill={`url(#${id}glow)`} />

        {FACETS.map((f, i) => (
          <g key={i}>
            <polygon points={f.points} fill={`url(#${id}${f.grad})`} />
            <polygon points={f.points} fill={f.shade} opacity={f.alpha} />
          </g>
        ))}

        {/* Girdle — the hard edge that reads as "cut". */}
        <polyline
          points="22,38 50,46 78,38" fill="none"
          stroke="#fff" strokeOpacity="0.28" strokeWidth="0.8"
        />
        <polyline
          points="22,38 50,10 78,38" fill="none"
          stroke="#fff" strokeOpacity="0.18" strokeWidth="0.8"
        />
      </svg>
      {label && <figcaption>{label}</figcaption>}
    </figure>
  )
}
