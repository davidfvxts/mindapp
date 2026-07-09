import { useState } from 'react'
import { EMOTIONS, type Emotion, type Settings } from '../lib/types'
import { GOAL_OPTIONS, OBSTACLE_OPTIONS, type OnboardingAnswers } from '../lib/onboarding'
import type { Draft } from '../lib/store'
import { Stone } from './Stone'

interface Props {
  onBegin: (settings: Settings, answers: OnboardingAnswers, first: Draft) => Promise<void>
}

const LAST = 8 // steps 1..8; step 0 is the welcome

/**
 * Guided onboarding as coach intake. It's the product from minute one: a short,
 * gamified flow that teaches Coach who you are, then runs your first real
 * reflection and hands back a personalised First Read as Night 1's Stone forms.
 */
export function Onboarding({ onBegin }: Props) {
  const [step, setStep] = useState(0)
  const [reading, setReading] = useState(false)

  const [name, setName] = useState('')
  const [goals, setGoals] = useState<string[]>([])
  const [world, setWorld] = useState('')
  const [obstacle, setObstacle] = useState('')
  const [cue, setCue] = useState('')
  const [reminderTime, setTime] = useState('21:30')

  const [event, setEvent] = useState('')
  const [emotions, setEmotions] = useState<Emotion[]>([])
  const [well, setWell] = useState('')
  const [next, setNext] = useState('')
  const [err, setErr] = useState('')

  const toggle = <T,>(list: T[], set: (v: T[]) => void, v: T, max: number) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : list.length < max ? [...list, v] : list)

  const finish = () => {
    setReading(true)
    const settings: Settings = {
      name: name.trim() || 'there',
      cue: cue.trim() || 'close my laptop',
      reminderTime,
      tone: 'default',
    }
    const answers: OnboardingAnswers = {
      name: settings.name, goals, world: world.trim(), obstacle, cue: settings.cue, reminderTime,
    }
    void onBegin(settings, answers, { event, emotions, well, next })
  }

  const advance = () => {
    if (step === 6 && !event.trim()) {
      setErr('Error — Coach needs one specific moment.')
      return
    }
    setErr('')
    if (step < LAST) return setStep(step + 1)
    finish()
  }

  // ---- reading: the wow builds while Coach reads the first night ----
  if (reading) {
    return (
      <section className="wrap">
        <header className="bar"><span className="wordmark">FACET</span></header>
        <main>
          <div className="section center develop">
            <Stone size={132} caption="Night 1" />
          </div>
          <div className="section" style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="coach thinking" style={{ maxWidth: 320 }}>
              <span className="coach-label ambient">Coach</span>
              <p>Reading your first night…</p>
            </div>
          </div>
        </main>
      </section>
    )
  }

  // ---- welcome ----
  if (step === 0) {
    return (
      <section className="wrap">
        <header className="bar"><span className="wordmark">FACET</span></header>
        <main className="develop">
          <h1>Five minutes a night.<br />A stone takes shape.</h1>
          <p className="sub">
            Two minutes to set up — then your first real reflection, read by Coach.
            Let’s shape your first stone.
          </p>
          <div className="spacer" />
          <button className="btn" onClick={() => setStep(1)}>Begin</button>
        </main>
      </section>
    )
  }

  const goalLabel = goals[0]?.toLowerCase()

  return (
    <section className="wrap">
      <header className="bar"><span className="wordmark">FACET</span></header>
      <main>
        <div className="meter" aria-hidden><i style={{ width: `${(step / LAST) * 100}%` }} /></div>

        <div className="develop" key={step}>
          {step === 1 && (
            <>
              <span className="ambient">You</span>
              <h1 style={{ marginTop: 'var(--s-3)' }}>First — your name.</h1>
              <p className="sub">What should Coach call you?</p>
              <input id="ob-name" value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="David" />
            </>
          )}

          {step === 2 && (
            <>
              <span className="ambient">Aim</span>
              <h1 style={{ marginTop: 'var(--s-3)' }}>What do you want to get sharper at?</h1>
              <p className="sub">Pick up to three. Coach will aim your nights here.</p>
              <div className="chips">
                {GOAL_OPTIONS.map((g) => {
                  const on = goals.includes(g)
                  return (
                    <button key={g} type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on}
                      disabled={!on && goals.length >= 3} onClick={() => toggle(goals, setGoals, g, 3)}>
                      {g}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <span className="ambient">Context</span>
              <h1 style={{ marginTop: 'var(--s-3)' }}>What are you building — and who with?</h1>
              <p className="sub">{goalLabel ? `Sharper ${goalLabel}, in your world.` : 'Optional.'} Names help Coach follow the thread.</p>
              <textarea value={world} autoFocus onChange={(e) => setWorld(e.target.value)}
                placeholder="e.g. an AI creative agency, with my cofounder Sam" />
            </>
          )}

          {step === 4 && (
            <>
              <span className="ambient">Honesty</span>
              <h1 style={{ marginTop: 'var(--s-3)' }}>When reflection slipped before, what got in the way?</h1>
              <p className="sub">Name it — that’s half the work.</p>
              <div className="chips">
                {OBSTACLE_OPTIONS.map((o) => (
                  <button key={o} type="button" className={`chip${obstacle === o ? ' on' : ''}`} aria-pressed={obstacle === o}
                    onClick={() => setObstacle(obstacle === o ? '' : o)}>
                    {o}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <span className="ambient">The cue</span>
              <h1 style={{ marginTop: 'var(--s-3)' }}>After I ___, I reflect.</h1>
              <p className="sub">Habits beat willpower. This one setting is what makes it stick.</p>
              <input value={cue} autoFocus onChange={(e) => setCue(e.target.value)} placeholder="close my laptop" />
              <div className="section">
                <label className="field-label" htmlFor="ob-time"><span className="ambient">Nightly reminder</span></label>
                <input id="ob-time" type="time" value={reminderTime} onChange={(e) => setTime(e.target.value)} />
              </div>
            </>
          )}

          {step === 6 && (
            <>
              <span className="ambient">Tonight · your first night</span>
              <h1 style={{ marginTop: 'var(--s-3)' }}>One concrete thing that happened today.</h1>
              <p className="subhead">Not how the day went — one moment.</p>
              <div className="spacer" />
              <textarea value={event} autoFocus onChange={(e) => setEvent(e.target.value)}
                placeholder="A specific event, good or hard." />
              <div className="section">
                <label className="field-label">
                  <span className="ambient">How it left you</span>
                  <span className="hint">Name it. Up to three.</span>
                </label>
                <div className="chips">
                  {EMOTIONS.map((e) => {
                    const on = emotions.includes(e)
                    return (
                      <button key={e} type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on}
                        disabled={!on && emotions.length >= 3} onClick={() => toggle(emotions, setEmotions, e, 3)}>
                        {e}
                      </button>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {step === 7 && (
            <>
              <span className="ambient">Tonight</span>
              <h1 style={{ marginTop: 'var(--s-3)' }}>What went well — and what did you do to cause it?</h1>
              <p className="subhead">Agency, not luck.</p>
              <div className="spacer" />
              <textarea value={well} autoFocus onChange={(e) => setWell(e.target.value)}
                placeholder="Name your contribution." />
            </>
          )}

          {step === 8 && (
            <>
              <span className="ambient">Tonight</span>
              <h1 style={{ marginTop: 'var(--s-3)' }}>One thing you’ll do differently tomorrow.</h1>
              <p className="subhead">One concrete, controllable action.</p>
              <div className="spacer" />
              <textarea value={next} autoFocus onChange={(e) => setNext(e.target.value)}
                placeholder="The smallest version you couldn’t skip." />
            </>
          )}

          {err && <p className="field-error">{err}</p>}

          <div className="spacer" />
          <div className="row">
            {step > 1 && (
              <button className="btn ghost back" onClick={() => setStep(step - 1)}>Back</button>
            )}
            <button className="btn" onClick={advance}>
              {step === LAST ? 'Shape my first stone' : 'Continue'}
            </button>
          </div>

          {step === 5 && (
            <p className="mode-note center">
              Your reflections stay on this device. Nothing leaves it unless you turn on sync.
            </p>
          )}
        </div>
      </main>
    </section>
  )
}
