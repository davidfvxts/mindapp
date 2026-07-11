import { useEffect, useMemo, useState } from 'react'
import { EMOTIONS, type Emotion, type MorningNote } from '../lib/types'
import { todayStr } from '../lib/game'
import { stoneStage } from '../lib/milestones'
import { filmForNight, filmWindow } from '../lib/stoneFilm'
import { secondPerson } from '../lib/onboarding'
import { clearDraft, draftHasText, loadDraft, saveDraft } from '../lib/drafts'
import { Stone } from './Stone'
import { StoneFilm } from './StoneFilm'
import type { Draft } from '../lib/store'

interface Props {
  reflectedToday: boolean
  cue: string
  thinking: boolean
  /** Tonight's Night count + the film press state — the settled screen is the stone's home. */
  night: number
  stoneSeen: number
  onStoneSeen: () => void
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

/** One question per page — nothing shares a screen with the thing being asked. */
const STEPS = [
  { n: 'The moment', hint: 'One concrete thing that happened today.' },
  { n: 'How it left you', hint: 'Name it. Up to three.' },
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
  skippedMorning?: boolean
}

export function DailyRitual({
  reflectedToday, cue, thinking, night, stoneSeen, onStoneSeen, todayIntention,
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
  const [skippedMorning, setSkippedMorning] = useState(saved?.skippedMorning ?? false)

  useEffect(() => {
    if (reflectedToday) return
    saveDraft(draftKey, { step, event, emotions, well, next, win, prep, skippedMorning } satisfies TonightDraft)
  }, [draftKey, reflectedToday, step, event, emotions, well, next, win, prep, skippedMorning])

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
    if (step < STEPS.length - 1) return setStep(step + 1)
    // The entry becomes the real save the moment it's submitted.
    clearDraft(draftKey)
    onSubmit({ event, emotions, well, next })
  }

  if (reflectedToday && !adding) {
    // The settled state is a quiet success screen — and the stone's daytime
    // home: tonight is already in it, waiting for the press if unpressed.
    const sources = filmForNight(night)
    const w = filmWindow(night, stoneSeen)
    return (
      <div className="develop center">
        <span className="ambient">Tonight</span>
        <h1 style={{ marginTop: 'var(--s-3)' }}>Night {night} is in the stone.</h1>
        <div className="spacer" />
        {sources ? (
          <StoneFilm
            sources={sources}
            fromF={w.fromF}
            toF={w.toF}
            owed={w.owed}
            onSettled={onStoneSeen}
            night={night}
            size={140}
            caption={stoneStage(night)}
          />
        ) : (
          <Stone night={night} size={120} caption={stoneStage(night)} />
        )}
        {sources && w.owed && (
          <p className="secondary" style={{ marginTop: 'var(--s-4)' }}>
            Press and hold — the night sinks in.
          </p>
        )}
        <p className="secondary" style={{ marginTop: 'var(--s-5)' }}>
          Come back tomorrow, after you {secondPerson(cue)}.
        </p>
        <div className="center" style={{ marginTop: 'var(--s-6)' }}>
          <button className="btn text" onClick={() => setAdding(true)}>
            Add another note
          </button>
        </div>
      </div>
    )
  }

  // ---- the Today page: the bookend gets a screen of its own, in daylight ----
  // One job: name the day's win (and answer Coach's one question if there is
  // one). Fully skippable — a text step, never a gate.
  if (morningWindow && !morningNote?.win && !skippedMorning) {
    return (
      <div className="develop">
        <span className="ambient">Today</span>
        <h1 style={{ marginTop: 'var(--s-3)' }}>What would make today a win?</h1>
        <p className="sub">
          One outcome, named now — tonight’s reflection weighs the day against it.
          {todayIntention ? ` From last night: ${todayIntention}` : ''}
        </p>
        <div className="spacer" />
        <input
          value={win}
          onChange={(e) => setWin(e.target.value)}
          placeholder="One outcome, in your control."
          aria-label="What would make today a win?"
          autoFocus
        />
        {morningQuestion && (
          <div className="section">
            <p className="morning-q">{morningQuestion}</p>
            <input
              value={prep}
              onChange={(e) => setPrep(e.target.value)}
              placeholder="One line."
              aria-label={morningQuestion}
            />
          </div>
        )}
        <div className="spacer" />
        {win.trim() ? (
          <button className="btn" onClick={() => onSetMorning?.(win, prep)}>Set for today</button>
        ) : (
          <button className="btn ghost" onClick={() => setSkippedMorning(true)}>Not today</button>
        )}
        <div className="center" style={{ marginTop: 'var(--s-4)' }}>
          <button className="btn text" onClick={() => setSkippedMorning(true)}>
            Straight to tonight’s reflection
          </button>
        </div>
      </div>
    )
  }

  // ---- the ritual: one question per page ----
  // At most ONE quiet context line above the dots, chosen by priority.
  const contextLine =
    step === 0
      ? comeback
        ? `You’re back. Night ${comeback.nights} is waiting — one moment tonight is enough.`
        : restored
          ? 'Picked up where you left off.'
          : todayIntention && !morningWindow
            ? `From last night: ${todayIntention}`
            : null
      : null

  return (
    <div className="develop" key={step}>
      {contextLine && <p className="morning-line">{contextLine}</p>}

      <div className="meter" aria-hidden>
        <i style={{ width: `${((step + 1) / (STEPS.length + 1)) * 100}%` }} />
      </div>

      <span className="ambient">{`Step ${step + 1} of ${STEPS.length}`}</span>
      <h1 style={{ marginTop: 'var(--s-3)' }}>{STEPS[step].n}</h1>
      <p className="subhead">{STEPS[step].hint}</p>
      <div className="spacer" />

      {step === 0 && (
        <textarea
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          placeholder="A specific event, good or hard. Not how the day went — one moment."
          aria-label="One concrete thing that happened today"
          autoFocus
        />
      )}

      {step === 1 && (
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
      )}

      {step === 2 && (
        <>
          {/* The declared objective the debrief runs against (AAR). */}
          {morningNote?.win && (
            <p className="morning-line">This morning’s win: “{morningNote.win}”</p>
          )}
          <textarea
            value={well}
            onChange={(e) => setWell(e.target.value)}
            placeholder="Name your contribution. Agency, not luck."
            aria-label="What went well, and what did you do to cause it"
            autoFocus
          />
        </>
      )}

      {step === 3 && (
        <textarea
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="One concrete, controllable action."
          aria-label="One thing you’ll do differently tomorrow"
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
          {thinking ? 'Reading…' : step === STEPS.length - 1 ? 'Finish' : 'Continue'}
        </button>
      </div>
    </div>
  )
}
