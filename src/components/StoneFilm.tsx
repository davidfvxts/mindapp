import { useEffect, useRef, useState } from 'react'
import { Stone } from './Stone'
import { startDevelopPulse, stopDevelopPulse, settledPulse } from '../lib/haptics'

interface Props {
  /** Film sources, tried in order (local first, then remote). */
  sources: string[]
  /** The stretch this press develops — fractions of the film. */
  fromF: number
  toF: number
  /** Anything new to develop? False = settled; a press gives one quiet pulse. */
  owed: boolean
  /** Commit: tonight's development has been seen in full. */
  onSettled: () => void
  /** Fallback night for the procedural stone if the film can't load. */
  night: number
  size?: number
  caption?: string
}

/**
 * The stone as film. The video IS the stone on the bench: paused at the last
 * frame the user has seen. Press and hold to develop — the film runs forward
 * to tonight's frame with a soft haptic pulse under the finger; release
 * pauses, hold again to continue. A settled stone answers a press with one
 * quiet pulse and no motion. Reduced motion: one press, tonight's frame,
 * no playback. If no source loads, the procedural SVG stone takes over.
 */
export function StoneFilm({ sources, fromF, toF, owed, onSettled, night, size = 132, caption }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const settled = useRef(false)
  const holding = useRef(false)
  // Sources are tried one at a time; a load error advances to the next.
  const [srcIdx, setSrcIdx] = useState(0)
  const failed = srcIdx >= sources.length
  const reduced = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  // Rest position: the last seen frame (or tonight's, once settled).
  useEffect(() => {
    settled.current = !owed
    const v = video.current
    if (!v) return
    const seek = () => { v.currentTime = fromF * (v.duration || 0) }
    if (v.readyState >= 1) seek()
    else v.addEventListener('loadedmetadata', seek, { once: true })
    return () => v.removeEventListener('loadedmetadata', seek)
    // Deliberately keyed on the window, not on every render.
  }, [fromF, owed, srcIdx])

  useEffect(() => () => stopDevelopPulse(), [])

  const settle = () => {
    if (settled.current) return
    settled.current = true
    stopDevelopPulse()
    onSettled()
  }

  const press = () => {
    const v = video.current
    if (!v || holding.current) return
    holding.current = true
    if (settled.current || !owed) {
      settledPulse()
      return
    }
    if (reduced) {
      // Motion off: tonight's frame arrives at once.
      v.currentTime = toF * (v.duration || 0)
      settledPulse()
      settle()
      return
    }
    startDevelopPulse()
    void v.play().catch(() => { stopDevelopPulse(); setSrcIdx(sources.length) })
  }

  const release = () => {
    holding.current = false
    const v = video.current
    if (!v) return
    if (!settled.current) {
      v.pause()
      stopDevelopPulse()
    }
  }

  const onTime = () => {
    const v = video.current
    if (!v || settled.current) return
    if (v.currentTime >= toF * (v.duration || 0) - 0.04) {
      v.pause()
      settle()
    }
  }

  if (failed) {
    // No film reachable — the procedural stone carries the night.
    return <Stone night={night} newFacet={owed} size={size} caption={caption} />
  }

  return (
    <figure className="stone stone-film" style={{ width: size }}>
      <button
        type="button"
        className="stone-press"
        aria-label={owed ? 'Press and hold — the stone develops' : 'The stone, settled'}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); press() }}
        onPointerUp={release}
        onPointerCancel={release}
        onKeyDown={(e) => { if (!e.repeat && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); press() } }}
        onKeyUp={(e) => { if (e.key === 'Enter' || e.key === ' ') release() }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <video
          key={sources[srcIdx]}
          ref={video}
          src={sources[srcIdx]}
          width={size}
          height={size}
          muted
          playsInline
          preload="auto"
          // A failed source falls through to the next; when all fail, the SVG takes over.
          onError={() => { stopDevelopPulse(); setSrcIdx((i) => i + 1) }}
          onTimeUpdate={onTime}
          onEnded={settle}
        />
      </button>
      {caption && <figcaption className="ambient">{caption}</figcaption>}
    </figure>
  )
}
