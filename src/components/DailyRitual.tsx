import { useEffect, useMemo, useState } from 'react'
import { EMOTIONS, type Emotion, type MorningNote } from '../lib/types'
import { todayStr } from '../lib/game'
import { clearDraft, draftHasText, loadDraft, saveDraft } from '../lib/drafts'
import type { Draft } from '../lib/store'

interface Props {
  reflectedToday: boolean
  cue: string
  thinking: boolean
  /** Last night's intention, when it's due today — one quiet line, no box. */
  todayIntention?: string | null
  /** Today's bookend, once set. */
  morningNote?: MorningNote | null
  /** Coach's one adaptive morning question — often none; silence is fine. */
  morningQuestion?: string | null
  /** The bookend belongs to daylight; at night the ritual owns the screen. */
  morningWindow?: boolean
  onSetMorning?: (win: string, answer?: string) => void
  /** A real lapse (≥2 missed nights) → one quiet line above the ritual. */
  comeback?: { nights: number } | null
  onSubmit: (d: Draft) => void
}

const STEPS = [
  { n: 'The moment', hint: 'One concrete thing that happened today.' },
  { n: 'The read', hint: 'What went well — and what did you do to cause it?' },
  { n: 'The next step', hint: 'One thing you’ll do differently tomorrow.' },
]

/** What tonight's in-progress writing looks like on disk. */
interface TonightDraft {
  step: number
  event: string
  emotions: Emotion[]
  well: string
  next: string
  win: string
  prep: string
}

export function DailyRitual({
  reflectedToday, cue, thinking, todayIntention,
  morningNote, morningQuestion, morningWindow, onSetMorning,
  comeback, onSubmit,
}: Props) {
  // Words are never lost: tonight's writing persists as it's typed and is
  // restored silently if the page is refreshed or evicted mid-ritual.
  const draftKey = useMemo(() => `tonight.${todayStr()}`, [])
  const [saved] = useState<TonightDraft | null>(() => (reflectedToday ? null : loadDraft<TonightDraft>(draftKey)))
  const restored = draftHasText(saved as Record<string, unknown> | null)

  const [step, setStep] = useState(saved?.step ?? 0)
  const [event, setEvent] = useState(saved?.event ?? '')
  const [emotions, setEmotions] = useState<Emotion[]>(saved?.emotions ?? [])
  const [well, setWell] = useState(saved?.well ?? '')
  const [next, setNext] = useState(saved?.next ?? '')
  const [err, setErr] = useState('')
  const [adding, setAdding] = useState(false)
  const [win, setWin] = useState(saved?.win ?? '')
  const [prep, setPrep] = useState(saved?.prep ?? '')

  useEffect(() => {
    if (reflectedToday) return
    saveDraft(draftKey, { step, event, emotions, well, next, win, prep } satisfies TonightDraft)
  }, [draftKey, reflectedToday, step, event, emotions, well, next, win, prep])

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
    // The entry becomes the real save the moment it's submitted.
    clearDraft(draftKey)
    onSubmit({ event, emotions, well, next })
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

  // The Today bookend (~2 min): last night's intention, one win for the day,
  // and Coach's one adaptive question. Type only — no boxes, no icons, no
  // numbers. Entirely skippable; skipping costs nothing.
  const today = (
    <div className="today-block">
      {(todayIntention || morningNote || morningWindow) && <span className="ambient">Today</span>}
      {todayIntention && <p className="morning-line">From last night: {todayIntention}</p>}
      {morningNote?.win ? (
        <p className="morning-line">A win today: {morningNote.win}</p>
      ) : morningWindow ? (
        <>
          <input
            value={win}
            onChange={(e) => setWin(e.target.value)}
            placeholder="What would make today a win?"
            aria-label="What would make today a win?"
          />
          {morningQuestion && (
            <>
              <p className="morning-q">{morningQuestion}</p>
              <input
                value={prep}
                onChange={(e) => setPrep(e.target.value)}
                placeholder="One line."
                aria-label={morningQuestion}
              />
            </>
          )}
          {win.trim() && (
            <button className="btn text" onClick={() => onSetMorning?.(win, prep)}>
              Set for today
            </button>
          )}
        </>
      ) : null}
    </div>
  )

  return (
    <div className="develop" key={step}>
      {today}
      {step === 0 && comeback && !reflectedToday && (
        <p className="morning-line">You’re back. Night {comeback.nights} is waiting — one moment tonight is enough.</p>
      )}

      {restored && <p className="morning-line">Picked up where you left off.</p>}

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
        <>
          {/* The declared objective the debrief runs against (AAR). */}
          {morningNote?.win && (
            <p className="morning-line">This morning’s win: “{morningNote.win}”</p>
          )}
          <textarea
            value={well}
            onChange={(e) => setWell(e.target.value)}
            placeholder="Name your contribution. Agency, not luck."
            autoFocus
          />
        </>
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
