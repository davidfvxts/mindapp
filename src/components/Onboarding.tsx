import { useState } from 'react'
import type { Settings } from '../lib/types'

export function Onboarding({ onDone }: { onDone: (s: Settings) => void }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [cue, setCue] = useState('')
  const [reminderTime, setTime] = useState('21:30')

  const finish = () =>
    onDone({
      name: name.trim() || 'there',
      cue: cue.trim() || 'close my laptop',
      reminderTime,
      tone: 'default',
    })

  return (
    <section className="wrap">
      <header className="bar">
        <span className="wordmark">FACET</span>
      </header>

      <main>
        {step === 0 ? (
          <div className="develop">
            <h1>
              Five minutes,
              <br />every night.
            </h1>
            <p className="sub">
              Reflect on the day. Over time, a stone takes shape. That’s the whole app.
            </p>
            <div className="spacer" />
            <button className="btn" onClick={() => setStep(1)}>Begin</button>
          </div>
        ) : (
          <div className="develop">
            <h1>A few details.</h1>
            <p className="sub">About thirty seconds.</p>

            <div className="section">
              <label className="field-label" htmlFor="ob-name">
                <span className="ambient">Name</span>
                <span className="hint">What should Coach call you?</span>
              </label>
              <input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="David" />
            </div>

            <div className="section">
              <label className="field-label" htmlFor="ob-cue">
                <span className="ambient">Trigger</span>
                <span className="hint">Cues beat willpower. After I ___, I reflect.</span>
              </label>
              <input id="ob-cue" value={cue} onChange={(e) => setCue(e.target.value)} placeholder="close my laptop" />
            </div>

            <div className="section">
              <label className="field-label" htmlFor="ob-time">
                <span className="ambient">Nightly reminder</span>
              </label>
              <input id="ob-time" type="time" value={reminderTime} onChange={(e) => setTime(e.target.value)} />
            </div>

            <div className="spacer" />
            <button className="btn" onClick={finish}>Start tonight</button>
            <p className="mode-note center">
              Your reflections stay on this device. Nothing leaves it unless you turn on sync.
            </p>
          </div>
        )}
      </main>
    </section>
  )
}
