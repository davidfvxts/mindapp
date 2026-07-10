import { useEffect, useState } from 'react'
import { EMOTIONS, type Emotion, type Settings } from '../lib/types'
import { GOAL_OPTIONS, OBSTACLE_OPTIONS, type OnboardingAnswers } from '../lib/onboarding'
import { clearDraft, draftHasText, loadDraft, saveDraft } from '../lib/drafts'
import type { Draft } from '../lib/store'
import { Stone } from './Stone'

interface Props {
  mode?: 'first' | 'retune'
  /** First run: intake + first reflection + First Read. */
  onBegin?: (settings: Settings, answers: OnboardingAnswers, first: Draft) => Promise<void>
  /** Re-tune: intake only, update what Coach knows. */
  onRetune?: (settings: Settings, answers: OnboardingAnswers) => void
  /** Erase everything — offered only from the re-tune flow, behind a confirm. */
  onErase?: () => Promise<boolean>
  initial?: { name?: string; goals?: string[]; cue?: string; reminderTime?: string; morningTime?: string; tone?: Settings['tone']; sync?: Settings['sync'] }
}

/** First-run writing persists as it's typed — setup is short, but the first
 *  reflection is real words that must survive a refresh or eviction. */
interface OnboardingDraft {
  step: number
  name: string
  goals: string[]
  world: string
  obstacle: string
  cue: string
  reminderTime: string
  morningTime: string
  tone: Settings['tone']
  sync: boolean
  event: string
  emotions: Emotion[]
  well: string
  next: string
}

/**
 * Guided onboarding as coach intake. First run: a gamified flow that teaches
 * Coach who you are, runs your first real reflection, and returns the First
 * Read as Night 1's Stone forms. Re-tune (any time): the intake steps only.
 */
export function Onboarding({ mode = 'first', onBegin, onRetune, onErase, initial }: Props) {
  const retune = mode === 'retune'
  const LAST = retune ? 5 : 8 // steps 1..LAST; step 0 is the welcome

  const [saved] = useState<OnboardingDraft | null>(() => (retune ? null : loadDraft<OnboardingDraft>('onboarding')))
  const restored = draftHasText(saved as Record<string, unknown> | null)

  const [step, setStep] = useState(saved?.step ?? 0)
  const [reading, setReading] = useState(false)
  const [erasing, setErasing] = useState(false)

  const [name, setName] = useState(saved?.name ?? initial?.name ?? '')
  const [goals, setGoals] = useState<string[]>(saved?.goals ?? initial?.goals ?? [])
  const [world, setWorld] = useState(saved?.world ?? '')
  const [obstacle, setObstacle] = useState(saved?.obstacle ?? '')
  const [cue, setCue] = useState(saved?.cue ?? initial?.cue ?? '')
  const [reminderTime, setTime] = useState(saved?.reminderTime ?? initial?.reminderTime ?? '21:30')
  const [morningTime, setMorning] = useState(saved?.morningTime ?? initial?.morningTime ?? '08:30')
  const [tone, setTone] = useState<Settings['tone']>(saved?.tone ?? initial?.tone ?? 'default')
  // Backup & sync is explicit opt-in: "on this device only" is the default.
  const [sync, setSync] = useState<boolean>(saved?.sync ?? initial?.sync ?? false)

  const [event, setEvent] = useState(saved?.event ?? '')
  const [emotions, setEmotions] = useState<Emotion[]>(saved?.emotions ?? [])
  const [well, setWell] = useState(saved?.well ?? '')
  const [next, setNext] = useState(saved?.next ?? '')
  const [err, setErr] = useState('')

  useEffect(() => {
    if (retune || reading) return
    saveDraft('onboarding', {
      step, name, goals, world, obstacle, cue, reminderTime, morningTime, tone, sync,
      event, emotions, well, next,
    } satisfies OnboardingDraft)
  }, [retune, reading, step, name, goals, world, obstacle, cue, reminderTime, morningTime, tone, sync, event, emotions, well, next])

  const toggle = <T,>(list: T[], set: (v: T[]) => void, v: T, max: number) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : list.length < max ? [...list, v] : list)

  const buildAnswers = (settings: Settings): OnboardingAnswers => ({
    name: settings.name, goals, world: world.trim(), obstacle, cue: settings.cue, reminderTime,
  })

  const finish = () => {
    const settings: Settings = {
      name: name.trim() || 'there',
      cue: cue.trim() || 'close my laptop',
      reminderTime,
      morningTime,
      tone,
      sync,
    }
    if (retune) {
      onRetune?.(settings, buildAnswers(settings))
      return
    }
    clearDraft('onboarding')
    setReading(true)
    void onBegin?.(settings, buildAnswers(settings), { event, emotions, well, next })
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

  // ---- erase everything: deliberate, two-step, complete ----
  if (erasing) {
    return (
      <section className="wrap">
        <header className="bar"><span className="wordmark">FACET</span></header>
        <main className="develop">
          <h1>Erase everything?</h1>
          <p className="sub">
            Every night, every read, every stone — gone from this phone and from your backup.
            There’s no way back.
          </p>
          <div className="spacer" />
          <button className="btn" onClick={() => setErasing(false)}>Keep everything</button>
          <div className="spacer" />
          <button
            className="btn ghost"
            onClick={() => { void onErase?.().then((done) => { if (!done) setErasing(false) }) }}
          >
            Erase everything
          </button>
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
          {retune ? (
            <>
              <h1>Re-tune Coach.</h1>
              <p className="sub">Update what Coach knows about you — your aim, your world, your cue. Thirty seconds.</p>
            </>
          ) : (
            <>
              <h1>Five minutes a night.<br />A stone takes shape.</h1>
              <p className="sub">
                Two minutes to set up — then your first real reflection, read by Coach.
                Let’s shape your first stone.
              </p>
              <div className="section">
                <label className="field-label">
                  <span className="ambient">Your words</span>
                  <span className="hint">
                    Reflections are yours. Coach reads a night only to reply to it — nothing is kept on a server unless you choose backup.
                  </span>
                </label>
                <div className="chips">
                  <button type="button" className={`chip${!sync ? ' on' : ''}`} aria-pressed={!sync} onClick={() => setSync(false)}>
                    On this device only
                  </button>
                  <button type="button" className={`chip${sync ? ' on' : ''}`} aria-pressed={sync} onClick={() => setSync(true)}>
                    Backed up + synced
                  </button>
                </div>
                {sync && (
                  <p className="secondary" style={{ marginTop: 'var(--s-3)' }}>
                    Backed up under an anonymous account — no email needed. Survives a lost phone. Change this any time.
                  </p>
                )}
              </div>
            </>
          )}
          <div className="spacer" />
          <button className="btn" onClick={() => setStep(1)}>{retune ? 'Start' : 'Begin'}</button>
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
          {restored && step === (saved?.step ?? 0) && (
            <p className="morning-line">Picked up where you left off.</p>
          )}
          {step === 1 && (
            <>
              <span className="ambient">You</span>
              <h1 style={{ marginTop: 'var(--s-3)' }}>{retune ? 'Your name.' : 'First — your name.'}</h1>
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
              <div className="section">
                <label className="field-label">
                  <span className="ambient">How should Coach push?</span>
                  <span className="hint">You can change this any time.</span>
                </label>
                <div className="chips">
                  {([['gentler', 'Gently'], ['default', 'Straight'], ['sharper', 'Sharper']] as const).map(([v, label]) => (
                    <button key={v} type="button" className={`chip${tone === v ? ' on' : ''}`} aria-pressed={tone === v}
                      onClick={() => setTone(v)}>
                      {label}
                    </button>
                  ))}
                </div>
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
              <div className="section">
                <label className="field-label" htmlFor="ob-morning">
                  <span className="ambient">Morning note</span>
                  <span className="hint">Last night’s intention, back when you can act on it.</span>
                </label>
                {morningTime ? (
                  <>
                    <input id="ob-morning" type="time" value={morningTime} onChange={(e) => setMorning(e.target.value)} />
                    <button type="button" className="btn text" onClick={() => setMorning('')}>No morning note</button>
                  </>
                ) : (
                  <button type="button" className="btn text" onClick={() => setMorning('08:30')}>Add a morning note</button>
                )}
              </div>
              {retune && (
                <div className="section">
                  <label className="field-label">
                    <span className="ambient">Backup & sync</span>
                    <span className="hint">
                      {sync
                        ? 'Your nights back up under an anonymous account. Turning this off stops future backups; what’s already backed up stays until you erase everything.'
                        : 'On this device only. Turn on backup so your nights survive a lost phone — anonymous, no email needed.'}
                    </span>
                  </label>
                  <div className="chips">
                    <button type="button" className={`chip${!sync ? ' on' : ''}`} aria-pressed={!sync} onClick={() => setSync(false)}>
                      On this device only
                    </button>
                    <button type="button" className={`chip${sync ? ' on' : ''}`} aria-pressed={sync} onClick={() => setSync(true)}>
                      Backed up + synced
                    </button>
                  </div>
                </div>
              )}
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
              {step === LAST ? (retune ? 'Re-tune Coach' : 'Shape my first stone') : 'Continue'}
            </button>
          </div>

          {retune && step === LAST && (
            <div className="center" style={{ marginTop: 'var(--s-8)' }}>
              <button type="button" className="btn text" onClick={() => setErasing(true)}>
                Erase everything…
              </button>
            </div>
          )}

          {step === 5 && !retune && (
            <p className="mode-note center">
              {sync
                ? 'Your nights back up under an anonymous account — no email needed. You can turn this off any time.'
                : 'Your reflections stay on this phone. You can turn on backup any time.'}
            </p>
          )}
        </div>
      </main>
    </section>
  )
}
