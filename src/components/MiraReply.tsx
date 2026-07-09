import { useState } from 'react'
import { Gem } from './Gem'
import { gemVariant, isStreakMilestone, milestoneLabel } from '../lib/milestones'
import type { CoachReply } from '../lib/types'

interface Props {
  reply: CoachReply
  streak: number
  gained: number
  level: number
  xp: number
  xpNeeded: number
  xpPct: number
  onRate: (r: 0 | 1) => void
  onDone: () => void
}

export function MiraReply(p: Props) {
  const [rated, setRated] = useState<0 | 1 | null>(null)
  const milestone = isStreakMilestone(p.streak)

  const rate = (r: 0 | 1) => {
    setRated(r)
    p.onRate(r)
  }

  return (
    <div className="fade">
      {/* Colour appears only here, and only when earned. */}
      {milestone ? (
        <div className="section center">
          <Gem variant={gemVariant(p.streak)} size={148} label={milestoneLabel(p.streak)} />
        </div>
      ) : (
        <div className="section center">
          <div className="display">{p.streak}</div>
          <h3 style={{ marginTop: 10 }}>Day streak</h3>
        </div>
      )}

      <div className="section">
        <div className="reply">
          <div className="av" aria-hidden />
          <div style={{ flex: 1 }}>
            <div className="who">
              Mira
              {p.reply.source === 'local' && <span className="tag">offline</span>}
            </div>
            <div className="txt">{p.reply.text}</div>
            {p.reply.lesson && <div className="lesson">{p.reply.lesson}</div>}
            <div className="rate">
              <button className={rated === 1 ? 'pick' : ''} onClick={() => rate(1)}>Helpful</button>
              <button className={rated === 0 ? 'pick' : ''} onClick={() => rate(0)}>Not quite</button>
            </div>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="bar-track"><i style={{ width: `${p.xpPct}%` }} /></div>
        <div className="bar-meta">
          <span>Level {p.level}</span>
          <span>+{p.gained} · {p.xp}/{p.xpNeeded}</span>
        </div>
      </div>

      <div className="spacer" />
      <button className="btn" onClick={p.onDone}>Done for today</button>
    </div>
  )
}
