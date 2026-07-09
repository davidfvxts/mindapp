import { useState } from 'react'
import { Stone } from './Stone'
import { isMilestoneNight, stoneForNight, stoneStage } from '../lib/milestones'
import type { CoachReply } from '../lib/types'

interface Props {
  reply: CoachReply
  /** The Night count — the only number shown here. */
  night: number
  onRate: (r: 0 | 1) => void
  onDone: () => void
}

export function AfterReflection({ reply, night, onRate, onDone }: Props) {
  const [rated, setRated] = useState<0 | 1 | null>(null)
  const milestone = stoneForNight(night)

  const rate = (r: 0 | 1) => {
    setRated(r)
    onRate(r)
  }

  return (
    <div>
      {/* Colour appears here only when a Night earns it. Otherwise the rough
          develops in greyscale and the Night count carries the moment. */}
      {milestone && isMilestoneNight(night) ? (
        <div className="section center develop">
          <Stone reveal stone={milestone} size={172} caption={milestone.name} />
          <p className="sub" style={{ marginTop: 'var(--s-5)' }}>
            Night {night}. Kept in the Vault.
          </p>
        </div>
      ) : (
        <div className="section center develop">
          <span className="ambient">Night</span>
          <div className="display" style={{ marginTop: 'var(--s-2)' }}>{night}</div>
          <div className="spacer" />
          <Stone size={104} caption={stoneStage(night)} />
        </div>
      )}

      <div className="section">
        <div className="coach">
          <span className="coach-label ambient">
            Coach
            {reply.source === 'local' && <span className="tag">offline</span>}
          </span>
          <p className="develop">{reply.text}</p>
          {reply.lesson && <p className="lesson develop develop-2">{reply.lesson}</p>}
          <div className="rate">
            <button className={rated === 1 ? 'pick' : ''} onClick={() => rate(1)}>That’s right</button>
            <button className={rated === 0 ? 'pick' : ''} onClick={() => rate(0)}>Not quite</button>
          </div>
        </div>
      </div>

      <div className="spacer" />
      <button className="btn" onClick={onDone}>Done</button>
    </div>
  )
}
