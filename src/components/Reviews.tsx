import { useState } from 'react'
import { MONTHLY_UNLOCK } from '../lib/game'
import { KIND_LABEL } from '../lib/guidance'
import type { WeeklyAnswers, Woop } from '../lib/weekly'
import type { InsightCard, Nudge } from '../lib/types'

interface Props {
  /** A week is gathered and the last guided review is far enough back. */
  ready: boolean
  cards: InsightCard[]
  thinking: boolean
  /** The standing weekly intention still in flight — checked in at the top of the next review. */
  openIntention: Nudge | null
  onResolveIntention: (id: string, kept: boolean) => void
  onComplete: (review: WeeklyAnswers, woop: Woop) => Promise<InsightCard | null>
  onGoToday: () => void
}

type StepId = 'checkin' | 'wins' | 'friction' | 'avoided' | 'wish' | 'plan'

/**
 * The weekly review — the user's own work, structured by Coach (AAR: the
 * participant does the review). Three prompts, then a WOOP for next week.
 * One thing per screen, in the ritual's own style. ~10 minutes.
 */
export function Reviews({ ready, cards, thinking, openIntention, onResolveIntention, onComplete, onGoToday }: Props) {
  const [phase, setPhase] = useState<'landing' | 'flow' | 'card'>('landing')
  const [steps, setSteps] = useState<StepId[]>([])
  const [step, setStep] = useState(0)
  const [err, setErr] = useState('')
  const [card, setCard] = useState<InsightCard | null>(null)

  const [wins, setWins] = useState('')
  const [friction, setFriction] = useState('')
  const [avoided, setAvoided] = useState('')
  const [wish, setWish] = useState('')
  const [outcome, setOutcome] = useState('')
  const [obstacle, setObstacle] = useState('')
  const [plan, setPlan] = useState('')

  const start = () => {
    setSteps([...(openIntention ? (['checkin'] as StepId[]) : []), 'wins', 'friction', 'avoided', 'wish', 'plan'])
    setStep(0)
    setErr('')
    setPhase('flow')
  }

  const finish = async () => {
    const minted = await onComplete(
      { wins: wins.trim(), friction: friction.trim(), avoided: avoided.trim() },
      { wish: wish.trim(), outcome: outcome.trim(), obstacle: obstacle.trim(), plan: plan.trim() },
    )
    if (minted) { setCard(minted); setPhase('card') }
    // On failure the store toasts; the answers stay right here — try again.
  }

  const advance = () => {
    const id = steps[step]
    if (id === 'wins' && !wins.trim()) return setErr('Error — one real win, and what caused it.')
    if (id === 'wish' && !wish.trim()) return setErr('Error — one outcome. The most important one.')
    if (id === 'plan' && !plan.trim()) return setErr('Error — the if-then is the part that works.')
    setErr('')
    if (step < steps.length - 1) return setStep(step + 1)
    void finish()
  }

  const resolveCheckin = (kept: boolean) => {
    if (openIntention) onResolveIntention(openIntention.id, kept)
    setStep(step + 1)
  }

  // ---- the minted read ----
  if (phase === 'card' && card) {
    return (
      <div className="develop">
        <h1>The week, read.</h1>
        <div className="section">
          <div className="coach">
            <span className="coach-label ambient">Coach</span>
            <p className="develop">{card.text}</p>
          </div>
        </div>
        <div className="spacer" />
        <p className="secondary">
          Your intention stands for the week — Coach will check in on it in Guidance.
        </p>
        <div className="spacer" />
        <button className="btn" onClick={() => setPhase('landing')}>Done</button>
      </div>
    )
  }

  // ---- the guided flow ----
  if (phase === 'flow') {
    const id = steps[step]
    return (
      <div className="develop" key={step}>
        <div className="dots">
          {steps.map((_, i) => (
            <i key={i} className={i === step ? 'on' : i < step ? 'visited' : ''} />
          ))}
        </div>

        {id === 'checkin' && openIntention && (
          <>
            <span className="ambient">Last week</span>
            <h1 style={{ marginTop: 'var(--s-3)' }}>“{openIntention.title}”</h1>
            <p className="subhead">You set this last week. Did it hold?</p>
            <div className="spacer" />
            <div className="row">
              <button className="btn ghost back" onClick={() => resolveCheckin(false)}>Didn’t stick</button>
              <button className="btn" onClick={() => resolveCheckin(true)}>It held</button>
            </div>
          </>
        )}

        {id === 'wins' && (
          <>
            <span className="ambient">The week</span>
            <h1 style={{ marginTop: 'var(--s-3)' }}>The wins — and what caused them.</h1>
            <p className="subhead">Two or three, specific. Name your hand in each.</p>
            <div className="spacer" />
            <textarea value={wins} autoFocus onChange={(e) => setWins(e.target.value)}
              placeholder="What went right this week, and what did you do to cause it?" />
          </>
        )}

        {id === 'friction' && (
          <>
            <span className="ambient">The week</span>
            <h1 style={{ marginTop: 'var(--s-3)' }}>Where you fell short — and what got in the way.</h1>
            <p className="subhead">What, not why. Conditions, not character.</p>
            <div className="spacer" />
            <textarea value={friction} autoFocus onChange={(e) => setFriction(e.target.value)}
              placeholder="The specific thing that got in the way." />
          </>
        )}

        {id === 'avoided' && (
          <>
            <span className="ambient">Honesty</span>
            <h1 style={{ marginTop: 'var(--s-3)' }}>What decision are you avoiding?</h1>
            <p className="subhead">Naming it is half the battle. Leave it blank if there truly isn’t one.</p>
            <div className="spacer" />
            <textarea value={avoided} autoFocus onChange={(e) => setAvoided(e.target.value)}
              placeholder="A decision, a conversation, a bet." />
          </>
        )}

        {id === 'wish' && (
          <>
            <span className="ambient">Next week</span>
            <h1 style={{ marginTop: 'var(--s-3)' }}>The one outcome that matters most.</h1>
            <p className="subhead">One wish — and what getting it does for you.</p>
            <div className="spacer" />
            <input value={wish} autoFocus onChange={(e) => setWish(e.target.value)}
              placeholder="The single most important outcome." />
            <div className="section">
              <label className="field-label"><span className="ambient">What it gets you</span></label>
              <input value={outcome} onChange={(e) => setOutcome(e.target.value)}
                placeholder="How it will feel, what it unlocks — one line." />
            </div>
          </>
        )}

        {id === 'plan' && (
          <>
            <span className="ambient">Next week</span>
            <h1 style={{ marginTop: 'var(--s-3)' }}>The obstacle — and your move.</h1>
            <p className="subhead">The internal one: avoidance, perfectionism, distraction. Not “no time.”</p>
            <div className="spacer" />
            <input value={obstacle} autoFocus onChange={(e) => setObstacle(e.target.value)}
              placeholder="The obstacle inside you, not around you." />
            <div className="section">
              <label className="field-label"><span className="ambient">The if-then</span></label>
              <input value={plan} onChange={(e) => setPlan(e.target.value)}
                placeholder="If it shows up, I will…" />
            </div>
          </>
        )}

        {err && <p className="field-error">{err}</p>}

        {id !== 'checkin' && (
          <>
            <div className="spacer" />
            <div className="row">
              {step > 0 && steps[step - 1] !== 'checkin' && (
                <button className="btn ghost back" onClick={() => setStep(step - 1)} disabled={thinking}>Back</button>
              )}
              <button className="btn" onClick={advance} disabled={thinking}>
                {thinking ? 'Coach is reading your week…' : step === steps.length - 1 ? 'Set the week' : 'Continue'}
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  // ---- landing ----
  const monthlyOpen = cards.length >= MONTHLY_UNLOCK
  return (
    <div className="develop">
      <h1>Reviews</h1>
      <p className="sub">Zoom out from nights to patterns.</p>

      <div className="section">
        <span className="ambient">Weekly</span>
        <h2 style={{ marginTop: 'var(--s-3)' }}>The week in review</h2>
        {ready ? (
          <>
            <p className="secondary" style={{ marginBottom: 'var(--s-5)' }}>
              The week is gathered. You do the review — three questions and an
              intention — and Coach reads it against your nights. About ten minutes.
            </p>
            <button className="btn" onClick={start}>Review my week</button>
          </>
        ) : (
          <>
            <p className="secondary" style={{ marginBottom: 'var(--s-5)' }}>
              A week’s review comes after a few nights. Keep going.
            </p>
            <button className="btn ghost" onClick={onGoToday}>Reflect tonight</button>
          </>
        )}
        {openIntention && (
          <div className="item" style={{ marginTop: 'var(--s-5)' }}>
            <div className="item-meta ambient">{KIND_LABEL[openIntention.kind]} · standing</div>
            <div className="item-body">{openIntention.title}</div>
          </div>
        )}
      </div>

      {cards.length > 0 && (
        <div className="section">
          <span className="ambient">Past reads</span>
          <div className="spacer" />
          {cards.slice(0, 6).map((c) => (
            <div key={c.id} className="item">
              <div className="item-meta ambient">{c.date}</div>
              <div className="item-body">{c.text}</div>
            </div>
          ))}
        </div>
      )}

      <div className="section">
        <span className="ambient">Monthly</span>
        <h2 style={{ marginTop: 'var(--s-3)' }}>The monthly arc</h2>
        <p className="secondary" style={{ marginBottom: 'var(--s-5)' }}>
          Trajectory and what you’re building toward — drafted from your own words.
          You set next month’s theme.
        </p>
        {monthlyOpen ? (
          <button className="btn ghost" onClick={onGoToday}>Begin the monthly arc</button>
        ) : (
          <p className="secondary">Opens once you’ve gathered a few weekly reads.</p>
        )}
      </div>
    </div>
  )
}
