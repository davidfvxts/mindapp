import { useState } from 'react'
import { EMOTIONS, type Emotion } from '../lib/types'
import type { Draft } from '../lib/store'

interface Props {
  reflectedToday: boolean
  cue: string
  thinking: boolean
  /** Last night's intention, when it's due today — one quiet line, no box. */
  todayIntention?: string | null
  /** A real lapse (≥2 missed nights) → the guilt-free re-entry, once. */
  comeback?: { best: number } | null
  onComebackSeen?: () => void
  onSubmit: (d: Draft) => void
}

const STEPS = [
  { n: 'The moment', hint: 'One concrete thing that happened today.' },
  { n: 'The read', hint: 'What went well — and what did you do to cause it?' },
  { n: 'The next step', hint: 'One thing you’ll do differently tomorrow.' },
]

export function DailyRitual({
  reflectedToday, cue, thinking, todayIntention, comeback, onComebackSeen, onSubmit,
}: Props) {
  const [step, setStep] = useState(0)
  const [event, setEvent] = useState('')
  const [emotions, setEmotions] = useState<Emotion[]>([])
  const [well, setWell] = useState('')
  const [next, setNext] = useState('')
  const [err, setErr] = useState('')
  const [adding, setAdding] = useState(false)

  const toggle = (e: Emotion) =>
    setEmotions((cur) =>
      cur.includes(e) ? cur.filter((x) => x !== e) : cur.length < 3 ? [...cur, e] : cur,
    )

  const advance = () => {
    if (step === 0 && !event.trim()) {
      setErr('Error — Coach needs one specific moment.')
      return
    }
    setErr('')
    if (step < 2) return setStep(step + 1)
    onSubmit({ event, emotions, well, next })
  }

  // The comeback: a real lapse ends here, without a trace of guilt. Once.
  if (comeback && !reflectedToday) {
    return (
      <div className="develop">
        <span className="ambient">Tonight</span>
        <h1 style={{ marginTop: 'var(--s-3)' }}>You’re back.</h1>
        <p className="sub">
          {comeback.best > 1
            ? `You reached Night ${comeback.best} — that ground is yours. `
            : ''}
          What’s kept is kept. One moment tonight is enough.
        </p>
        <div className="spacer" />
        <button className="btn" onClick={onComebackSeen}>Begin tonight</button>
      </div>
    )
  }

  if (reflectedToday && !adding) {
    return (
      <div className="develop">
        <span className="ambient">Tonight</span>
        <h1 style={{ marginTop: 'var(--s-3)' }}>You’ve reflected tonight.</h1>
        <p className="sub">Come back tomorrow, after you {cue}.</p>
        <button className="btn ghost" onClick={() => setAdding(true)}>
          Add another note
        </button>
      </div>
    )
  }

  return (
    <div className="develop" key={step}>
      {/* Last night's intention, back in daylight. Plain text — no box, no icon. */}
      {todayIntention && <p className="morning-line">Today: {todayIntention}</p>}

      <div className="dots">
        {STEPS.map((_, i) => (
          <i key={i} className={i === step ? 'on' : i < step ? 'visited' : ''} />
        ))}
      </div>

      <span className="ambient">{`Step ${step + 1} of 3`}</span>
      <h1 style={{ marginTop: 'var(--s-3)' }}>{STEPS[step].n}</h1>
      <p className="subhead">{STEPS[step].hint}</p>
      <div className="spacer" />

      {step === 0 && (
        <>
          <textarea
            value={event}
            onChange={(e) => setEvent(e.target.value)}
            placeholder="A specific event, good or hard. Not how the day went — one moment."
            autoFocus
          />
          <div className="section">
            <label className="field-label">
              <span className="ambient">How it left you</span>
              <span className="hint">Name it. Up to three.</span>
            </label>
            <div className="chips">
              {EMOTIONS.map((e) => {
                const on = emotions.includes(e)
                return (
                  <button
                    key={e}
                    type="button"
                    className={`chip${on ? ' on' : ''}`}
                    aria-pressed={on}
                    disabled={!on && emotions.length >= 3}
                    onClick={() => toggle(e)}
                  >
                    {e}
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {step === 1 && (
        <textarea
          value={well}
          onChange={(e) => setWell(e.target.value)}
          placeholder="Name your contribution. Agency, not luck."
          autoFocus
        />
      )}

      {step === 2 && (
        <textarea
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="One concrete, controllable action."
          autoFocus
        />
      )}

      {err && <p className="field-error">{err}</p>}

      <div className="spacer" />
      <div className="row">
        {step > 0 && (
          <button className="btn ghost back" onClick={() => setStep(step - 1)} disabled={thinking}>
            Back
          </button>
        )}
        <button className="btn" onClick={advance} disabled={thinking}>
          {thinking ? 'Reading…' : step === 2 ? 'Finish' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
