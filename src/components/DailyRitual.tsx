import { useState } from 'react'
import { EMOTIONS, type Emotion } from '../lib/types'
import type { Draft } from '../lib/store'

interface Props {
  reflectedToday: boolean
  cue: string
  thinking: boolean
  onSubmit: (d: Draft) => void
}

const STEPS = [
  { n: 'The moment', hint: 'One concrete thing that happened today.' },
  { n: 'The read', hint: 'What went well — and what did you do to cause it?' },
  { n: 'The next step', hint: 'One thing you’ll do differently tomorrow.' },
]

export function DailyRitual({ reflectedToday, cue, thinking, onSubmit }: Props) {
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
      setErr('Give Mira one specific moment.')
      return
    }
    setErr('')
    if (step < 2) return setStep(step + 1)
    onSubmit({ event, emotions, well, next })
  }

  if (reflectedToday && !adding) {
    return (
      <div className="fade">
        <h1>Done for today.</h1>
        <p className="sub">Your streak is safe. Come back tomorrow after you {cue}.</p>
        <button className="btn ghost" onClick={() => setAdding(true)}>
          Add another note
        </button>
      </div>
    )
  }

  return (
    <div className="fade">
      <div className="dots">
        {STEPS.map((_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}
      </div>

      <h3>{`Step ${step + 1} of 3`}</h3>
      <h1>{STEPS[step].n}</h1>
      <p className="sub">{STEPS[step].hint}</p>

      {step === 0 && (
        <>
          <textarea
            value={event}
            onChange={(e) => setEvent(e.target.value)}
            placeholder="A specific event, good or hard. Not how the day went — one moment."
            autoFocus
          />
          <div className="section">
            <label className="q">
              How did it leave you?
              <span className="hint">Name it to tame it. Up to three.</span>
            </label>
            <div className="chips">
              {EMOTIONS.map((e) => (
                <button
                  key={e} type="button"
                  className={`chip${emotions.includes(e) ? ' on' : ''}`}
                  aria-pressed={emotions.includes(e)}
                  onClick={() => toggle(e)}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {step === 1 && (
        <textarea
          value={well} onChange={(e) => setWell(e.target.value)}
          placeholder="Name your contribution. Agency, not luck."
          autoFocus
        />
      )}

      {step === 2 && (
        <textarea
          value={next} onChange={(e) => setNext(e.target.value)}
          placeholder="One concrete, controllable action."
          autoFocus
        />
      )}

      {err && <p className="err">{err}</p>}

      <div className="spacer" />
      <div className="row">
        {step > 0 && (
          <button className="btn ghost back" onClick={() => setStep(step - 1)} disabled={thinking}>
            Back
          </button>
        )}
        <button className="btn" onClick={advance} disabled={thinking}>
          {thinking ? 'Mira is reading…' : step === 2 ? 'Finish' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
