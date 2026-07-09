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
        <span className="wordmark">MIRA</span>
      </header>

      <main className="fade">
        {step === 0 ? (
          <>
            <h1 className="grad-text">
              Five minutes a day.
              <br />A sharper you.
            </h1>
            <p className="sub">
              A daily reflection, coached by AI, built on the science of what actually
              makes reflection work. Let’s set it up so it sticks.
            </p>
            <div className="spacer" />
            <button className="btn" onClick={() => setStep(1)}>Begin</button>
          </>
        ) : (
          <>
            <h1>A few details.</h1>
            <p className="sub">This takes about thirty seconds.</p>

            <div className="section">
              <label className="q" htmlFor="ob-name">
                What should Mira call you?
              </label>
              <input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="David" />
            </div>

            <div className="section">
              <label className="q" htmlFor="ob-cue">
                Your trigger
                <span className="hint">Cues beat willpower. “After I ___, I reflect.”</span>
              </label>
              <input id="ob-cue" value={cue} onChange={(e) => setCue(e.target.value)} placeholder="close my laptop" />
            </div>

            <div className="section">
              <label className="q" htmlFor="ob-time">Daily reminder</label>
              <input id="ob-time" type="time" value={reminderTime} onChange={(e) => setTime(e.target.value)} />
            </div>

            <div className="spacer" />
            <button className="btn" onClick={finish}>Start my first reflection</button>
            <p className="mode-note center">
              Your entries live on this device. Nothing leaves it unless you turn on sync.
            </p>
          </>
        )}
      </main>
    </section>
  )
}
