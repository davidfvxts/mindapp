import { useEffect, useState } from 'react'
import { EMOTIONS, type Emotion, type Settings } from '../lib/types'
import { firstFrames, GOAL_OPTIONS, OBSTACLE_OPTIONS, type OnboardingAnswers } from '../lib/onboarding'
import { clearDraft, draftHasText, loadDraft, saveDraft } from '../lib/drafts'
import type { Draft } from '../lib/store'
import { Stone } from './Stone'

interface Props {
  mode?: 'first' | 'retune' | 'setup'
  /** First run: name → aim → why now → first reflection → First Read. */
  onBegin?: (settings: Settings, answers: OnboardingAnswers, first: Draft) => Promise<void>
  /** Re-tune: intake only, update what Coach knows. */
  onRetune?: (settings: Settings, answers: OnboardingAnswers) => void
  /** Setup: the make-it-stick step AFTER the First Read. */
  onSetup?: (settings: Settings) => void
  /** Erase everything — offered only from the re-tune flow, behind a confirm. */
  onErase?: () => Promise<boolean>
  initial?: { name?: string; goals?: string[]; cue?: string; reminderTime?: string; morningTime?: string; tone?: Settings['tone']; sync?: Settings['sync'] }
}

/** First-run writing persists as it's typed — the flow is short, but the first
 *  reflection is real words that must survive a refresh or eviction. */
interface OnboardingDraft {
  step: number
  name: string
  goals: string[]
  whyNow: string
  event: string
  emotions: Emotion[]
  well: string
  next: string
}

/** What a brand-new user gets before the make-it-stick step tunes it. */
const DEFAULTS = { cue: 'close my laptop', reminderTime: '21:30', morningTime: '08:30' }

/**
 * Guided onboarding, in four acts (research: value before commitment).
 *   first:  commit (name · aim · why now) → the first reflection, adapted to
 *           the hour → Coach's First Read + the stone igniting. Settings wait.
 *   setup:  make it stick — cue, rhythm, tone, sync — AFTER the wow, skippable.
 *   retune: the full intake, any time, from the Vault.
 */
export function Onboarding({ mode = 'first', onBegin, onRetune, onSetup, onErase, initial }: Props) {
  const retune = mode === 'retune'
  const setup = mode === 'setup'
  const first = mode === 'first'
  // first: steps 1..7 (name aim why moment emotions well next); retune: 1..5; setup: 1..2.
  const LAST = retune ? 5 : setup ? 2 : 7

  const [saved] = useState<OnboardingDraft | null>(() => (first ? loadDraft<OnboardingDraft>('onboarding') : null))
  const restored = draftHasText(saved as Record<string, unknown> | null)
  // The first reflection meets the user at whatever hour they arrive.
  const [frames] = useState(() => firstFrames(new Date().getHours()))

  const [step, setStep] = useState(() => (setup ? 1 : Math.min(saved?.step ?? 0, LAST)))
  const [view, setView] = useState<'flow' | 'method'>('flow')
  const [reading, setReading] = useState(false)
  const [erasing, setErasing] = useState(false)

  const [name, setName] = useState(saved?.name ?? initial?.name ?? '')
  const [goals, setGoals] = useState<string[]>(saved?.goals ?? initial?.goals ?? [])
  const [whyNow, setWhyNow] = useState(saved?.whyNow ?? '')
  const [world, setWorld] = useState('')
  const [obstacle, setObstacle] = useState('')
  const [cue, setCue] = useState(initial?.cue ?? '')
  const [reminderTime, setTime] = useState(initial?.reminderTime ?? DEFAULTS.reminderTime)
  const [morningTime, setMorning] = useState(initial?.morningTime ?? DEFAULTS.morningTime)
  const [tone, setTone] = useState<Settings['tone']>(initial?.tone ?? 'default')
  // Backup & sync is explicit opt-in: "on this device only" is the default.
  const [sync, setSync] = useState<boolean>(initial?.sync ?? false)

  const [event, setEvent] = useState(saved?.event ?? '')
  const [emotions, setEmotions] = useState<Emotion[]>(saved?.emotions ?? [])
  const [well, setWell] = useState(saved?.well ?? '')
  const [next, setNext] = useState(saved?.next ?? '')
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!first || reading) return
    saveDraft('onboarding', {
      step, name, goals, whyNow, event, emotions, well, next,
    } satisfies OnboardingDraft)
  }, [first, reading, step, name, goals, whyNow, event, emotions, well, next])

  const toggle = <T,>(list: T[], set: (v: T[]) => void, v: T, max: number) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : list.length < max ? [...list, v] : list)

  const buildSettings = (): Settings => ({
    name: name.trim() || 'there',
    cue: cue.trim() || DEFAULTS.cue,
    reminderTime,
    morningTime,
    tone,
    sync,
  })

  const finish = () => {
    if (retune) {
      const settings = buildSettings()
      onRetune?.(settings, {
        name: settings.name, goals, world: world.trim(), obstacle, cue: settings.cue, reminderTime,
      })
      return
    }
    if (setup) {
      onSetup?.(buildSettings())
      return
    }
    // First run: the reflection is done — Coach reads it now. Settings come
    // after the read (defaults until then), so nothing stands before the wow.
    clearDraft('onboarding')
    setReading(true)
    const settings: Settings = {
      name: name.trim() || 'there',
      cue: DEFAULTS.cue, reminderTime: DEFAULTS.reminderTime, morningTime: DEFAULTS.morningTime,
      tone: 'default', sync: false,
    }
    void onBegin?.(
      settings,
      // No cue yet — Coach must never claim a habit the user hasn't chosen.
      { name: settings.name, goals, world: '', obstacle: '', whyNow: whyNow.trim(), cue: '', reminderTime },
      { event, emotions, well, next },
    )
  }

  const FIRST_MOMENT = 4 // the step index of the moment question in first mode
  const advance = () => {
    if (first && step === FIRST_MOMENT && !event.trim()) {
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
            <Stone night={1} size={132} caption="Night 1" />
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

  // ---- the method: the evidence and the privacy contract, on its own page ----
  if (view === 'method') {
    return (
      <section className="wrap">
        <header className="bar"><span className="wordmark">FACET</span></header>
        <main className="develop">
          <button className="btn text back-line" onClick={() => setView('flow')}>← Back</button>
          <h1>The method.</h1>
          <p className="sub">
            Five minutes a night, built on findings that held up. Coach works from these — nothing else.
          </p>
          <div className="section">
            <div className="item">
              <div className="item-meta ambient">Name the moment, in writing</div>
              <div className="item-body">Putting a hard moment into words cools it. — Pennebaker, expressive writing</div>
            </div>
            <div className="item">
              <div className="item-meta ambient">Step back to see it</div>
              <div className="item-body">Distanced self-talk turns rumination into perspective. — Kross, Chatter</div>
            </div>
            <div className="item">
              <div className="item-meta ambient">Ask what, not why</div>
              <div className="item-body">What-questions build accurate self-insight; why-questions spiral. — Eurich, Insight</div>
            </div>
            <div className="item">
              <div className="item-meta ambient">One next step, if-then</div>
              <div className="item-body">Naming when and where you’ll act markedly raises follow-through. — Gollwitzer, implementation intentions</div>
            </div>
            <div className="item">
              <div className="item-meta ambient">Debrief against the goal</div>
              <div className="item-body">Reviewing the day against a declared aim is how teams — and people — compound. — Locke &amp; Latham; after-action reviews</div>
            </div>
          </div>
          <div className="section">
            <span className="ambient">Your words</span>
            <p className="secondary" style={{ marginTop: 'var(--s-3)' }}>
              No account. No email. Your words stay on this phone unless you choose backup.
              Coach reads a night only to reply to it — nothing you write is used for anything else, ever.
            </p>
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
          {retune ? (
            <>
              <h1>Re-tune Coach.</h1>
              <p className="sub">Update what Coach knows about you — your aim, your world, your cue. Thirty seconds.</p>
            </>
          ) : (
            <>
              {/* The first stone, met before a word is asked: a dark shard,
                  the heart-thread waiting inside. */}
              <div className="center" style={{ marginBottom: 'var(--s-6)' }}>
                <Stone night={0} size={104} />
              </div>
              <h1>Five minutes a night.<br />A stone takes shape.</h1>
              <p className="sub">
                A minute to point Coach at you — then your first reflection, read back to you.
                No account, no email.
              </p>
            </>
          )}
          <div className="spacer" />
          <button className="btn" onClick={() => setStep(1)}>{retune ? 'Start' : 'Begin'}</button>
          {first && (
            <div className="center" style={{ marginTop: 'var(--s-5)' }}>
              <button className="btn text" onClick={() => setView('method')}>The method →</button>
            </div>
          )}
        </main>
      </section>
    )
  }

  const goalLabel = goals[0]?.toLowerCase()

  return (
    <section className="wrap">
      <header className="bar"><span className="wordmark">FACET</span></header>
      <main>
        {!setup && <div className="meter" aria-hidden><i style={{ width: `${(step / LAST) * 100}%` }} /></div>}

        <div className="develop" key={step}>
          {restored && step === (saved?.step ?? 0) && (
            <p className="morning-line">Picked up where you left off.</p>
          )}

          {/* ================= first run + retune: name ================= */}
          {!setup && step === 1 && (
            <>
              <span className="ambient">You</span>
              <h1 style={{ marginTop: 'var(--s-3)' }}>{retune ? 'Your name.' : 'First — your name.'}</h1>
              <p className="sub">What should Coach call you?</p>
              <input id="ob-name" value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="David" aria-label="What should Coach call you?" />
            </>
          )}

          {!setup && step === 2 && (
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

          {/* ================= first run: why now → the reflection ================= */}
          {first && step === 3 && (
            <>
              <span className="ambient">Why now</span>
              <h1 style={{ marginTop: 'var(--s-3)' }}>What made you open this today?</h1>
              <p className="sub">One honest line. Coach holds you to your own reasons — no one else’s.</p>
              <textarea value={whyNow} autoFocus onChange={(e) => setWhyNow(e.target.value)}
                placeholder="In your words. Skip it if nothing comes." aria-label="What made you open this today?" />
            </>
          )}

          {first && step === 4 && (
            <>
              <span className="ambient">Your first night</span>
              <h1 style={{ marginTop: 'var(--s-3)' }}>{frames.momentQ}</h1>
              <p className="subhead">Specific beats summary — one moment is enough.</p>
              <div className="spacer" />
              <textarea value={event} autoFocus onChange={(e) => setEvent(e.target.value)}
                placeholder={frames.momentPlaceholder} aria-label={frames.momentQ} />
            </>
          )}

          {first && step === 5 && (
            <>
              <span className="ambient">Your first night</span>
              <h1 style={{ marginTop: 'var(--s-3)' }}>How did it leave you?</h1>
              <p className="subhead">Name it to cool it. Up to three.</p>
              <div className="spacer" />
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
            </>
          )}

          {first && step === 6 && (
            <>
              <span className="ambient">Your first night</span>
              <h1 style={{ marginTop: 'var(--s-3)' }}>What went well — and what did you do to cause it?</h1>
              <p className="subhead">Agency, not luck.</p>
              <div className="spacer" />
              <textarea value={well} autoFocus onChange={(e) => setWell(e.target.value)}
                placeholder="Name your contribution." aria-label="What went well, and what did you do to cause it?" />
            </>
          )}

          {first && step === 7 && (
            <>
              <span className="ambient">Your first night</span>
              <h1 style={{ marginTop: 'var(--s-3)' }}>{frames.nextQ}</h1>
              <p className="subhead">Small and concrete beats big and vague.</p>
              <div className="spacer" />
              <textarea value={next} autoFocus onChange={(e) => setNext(e.target.value)}
                placeholder="The smallest version you couldn’t skip." aria-label={frames.nextQ} />
            </>
          )}

          {/* ================= retune: world · obstacle+tone · cue+settings ================= */}
          {retune && step === 3 && (
            <>
              <span className="ambient">Context</span>
              <h1 style={{ marginTop: 'var(--s-3)' }}>What are you building — and who with?</h1>
              <p className="sub">{goalLabel ? `Sharper ${goalLabel}, in your world.` : 'Optional.'} Names help Coach follow the thread.</p>
              <textarea value={world} autoFocus onChange={(e) => setWorld(e.target.value)}
                placeholder="e.g. an AI creative agency, with my cofounder Sam" aria-label="What are you building, and who with?" />
            </>
          )}

          {retune && step === 4 && (
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

          {/* ================= setup (after the read) + retune: the habit ================= */}
          {((retune && step === 5) || (setup && step === 1)) && (
            <>
              <span className="ambient">{setup ? 'Make it stick' : 'The cue'}</span>
              <h1 style={{ marginTop: 'var(--s-3)' }}>After I ___, I reflect.</h1>
              <p className="sub">Habits beat willpower. This one setting is what makes it stick.</p>
              <input value={cue} autoFocus onChange={(e) => setCue(e.target.value)} placeholder="close my laptop" aria-label="After I finish what, I reflect?" />
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
                    <span className="ambient">Your words</span>
                    <span className="hint">
                      {sync
                        ? 'Your nights back up under an anonymous account — no email needed. Turning this off stops future backups.'
                        : 'Reflections stay on this phone. Turn on backup so your nights survive a lost phone — anonymous, no email needed.'}
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

          {setup && step === 2 && (
            <>
              <span className="ambient">Coach</span>
              <h1 style={{ marginTop: 'var(--s-3)' }}>How should Coach push?</h1>
              <p className="sub">You can change this any time.</p>
              <div className="chips">
                {([['gentler', 'Gently'], ['default', 'Straight'], ['sharper', 'Sharper']] as const).map(([v, label]) => (
                  <button key={v} type="button" className={`chip${tone === v ? ' on' : ''}`} aria-pressed={tone === v}
                    onClick={() => setTone(v)}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="section">
                <label className="field-label">
                  <span className="ambient">Your words</span>
                  <span className="hint">
                    {sync
                      ? 'Your nights back up under an anonymous account — no email needed. Turning this off stops future backups.'
                      : 'Reflections stay on this phone. Turn on backup so your nights survive a lost phone — anonymous, no email needed.'}
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
            </>
          )}

          {err && <p className="field-error">{err}</p>}

          <div className="spacer" />
          <div className="row">
            {step > 1 && (
              <button className="btn ghost back" onClick={() => setStep(step - 1)}>Back</button>
            )}
            <button className="btn" onClick={advance}>
              {step === LAST
                ? retune ? 'Re-tune Coach' : setup ? 'Done' : 'Shape my first stone'
                : 'Continue'}
            </button>
          </div>

          {setup && step === 1 && (
            <div className="center" style={{ marginTop: 'var(--s-5)' }}>
              {/* Skippable by design: the read is already theirs. Defaults hold. */}
              <button className="btn text" onClick={finish}>Later</button>
            </div>
          )}

          {retune && step === LAST && (
            <div className="center" style={{ marginTop: 'var(--s-8)' }}>
              <button type="button" className="btn text" onClick={() => setErasing(true)}>
                Erase everything…
              </button>
            </div>
          )}
        </div>
      </main>
    </section>
  )
}
