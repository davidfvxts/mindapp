import { useEffect, useState } from 'react'
import { clearDraft, loadDraft, saveDraft } from '../lib/drafts'
import type { WeeklyAnswers, Woop } from '../lib/weekly'
import type { MonthlyAnswers } from '../lib/monthly'
import type { MonthlyResult } from '../lib/ai'
import type { CoachProfile, InsightCard, Nudge } from '../lib/types'

interface Props {
  /** At least three Nights this week and the last guided review is far enough back. */
  ready: boolean
  /** Five Nights means the user has a full week, rather than a review so far. */
  fullWeek: boolean
  /** Coach reads reviews live; drafts remain available when this is false. */
  online: boolean
  cards: InsightCard[]
  arcs: InsightCard[]
  thinking: boolean
  /** Enough weekly reads gathered for a monthly arc, spaced from the last. */
  monthReady: boolean
  /** The decision the user keeps circling, if one is live — drives the fear step. */
  liveDecision: string | null
  /** The standing weekly intention still in flight — checked in at the top of the next review. */
  openIntention: Nudge | null
  onResolveIntention: (id: string, kept: boolean) => void
  onComplete: (review: WeeklyAnswers, woop: Woop) => Promise<InsightCard | null>
  onBeginMonthly: () => Promise<MonthlyResult | null>
  onCompleteMonthly: (answers: MonthlyAnswers, profile: Partial<CoachProfile> | null) => void
}

type StepId = 'checkin' | 'wins' | 'friction' | 'avoided' | 'wish' | 'plan'
type MonthStep = 'trajectory' | 'gap' | 'fear' | 'theme'

/** In-progress review writing, persisted so ten minutes of typing can never be lost. */
interface WeeklyDraft {
  at: StepId
  /** Final answers are written and waiting for Coach after a failed live call. */
  awaitingCoach?: boolean
  wins: string
  friction: string
  avoided: string
  wish: string
  outcome: string
  obstacle: string
  plan: string
}
interface MonthlyDraft {
  result: MonthlyResult
  at: MonthStep
  trajectory: string
  gap: string
  fear: string
  theme: string
}

/** ISO date → "2 July" — an instrument never shows debug output. */
const humanDate = (iso: string): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })

const weeklyDraftText = (d: WeeklyDraft | null): boolean =>
  !!d && [d.wins, d.friction, d.avoided, d.wish, d.outcome, d.obstacle, d.plan].some((v) => v.trim())

/**
 * The weekly review — the user's own work, structured by Coach (AAR: the
 * participant does the review) — plus the monthly arc, the deepest layer
 * (trajectory · identity · fear-setting · theme). One thing per screen.
 */
export function Reviews({
  ready, fullWeek, online, cards, arcs, thinking, monthReady, liveDecision, openIntention,
  onResolveIntention, onComplete, onBeginMonthly, onCompleteMonthly,
}: Props) {
  const [phase, setPhase] = useState<'landing' | 'flow' | 'card' | 'month' | 'monthcard' | 'archive'>('landing')
  const [steps, setSteps] = useState<StepId[]>([])
  const [step, setStep] = useState(0)
  const [err, setErr] = useState('')
  const [card, setCard] = useState<InsightCard | null>(null)

  // Ten minutes of typing must survive anything: both flows persist as drafts
  // and resume from the landing. Cleared only when the review is banked.
  const [weeklyDraft, setWeeklyDraft] = useState<WeeklyDraft | null>(() => loadDraft<WeeklyDraft>('weekly'))
  const [savedMonthly] = useState<MonthlyDraft | null>(() => loadDraft<MonthlyDraft>('monthly'))

  const [wins, setWins] = useState(weeklyDraft?.wins ?? '')
  const [friction, setFriction] = useState(weeklyDraft?.friction ?? '')
  const [avoided, setAvoided] = useState(weeklyDraft?.avoided ?? '')
  const [wish, setWish] = useState(weeklyDraft?.wish ?? '')
  const [outcome, setOutcome] = useState(weeklyDraft?.outcome ?? '')
  const [obstacle, setObstacle] = useState(weeklyDraft?.obstacle ?? '')
  const [plan, setPlan] = useState(weeklyDraft?.plan ?? '')

  // ---- monthly arc state ----
  const [draft, setDraft] = useState<MonthlyResult | null>(savedMonthly?.result ?? null)
  const [mStep, setMStep] = useState<MonthStep>(savedMonthly?.at ?? 'trajectory')
  const [trajectory, setTrajectory] = useState(savedMonthly?.trajectory ?? '')
  const [gap, setGap] = useState(savedMonthly?.gap ?? '')
  const [fear, setFear] = useState(savedMonthly?.fear ?? '')
  const [theme, setTheme] = useState(savedMonthly?.theme ?? '')

  useEffect(() => {
    if (phase !== 'flow') return
    const next: WeeklyDraft = {
      at: steps[step] ?? 'wins', wins, friction, avoided, wish, outcome, obstacle, plan,
    }
    setWeeklyDraft(next)
    saveDraft('weekly', next)
  }, [phase, steps, step, wins, friction, avoided, wish, outcome, obstacle, plan])

  useEffect(() => {
    if (phase !== 'month' || !draft) return
    saveDraft('monthly', { result: draft, at: mStep, trajectory, gap, fear, theme } satisfies MonthlyDraft)
  }, [phase, draft, mStep, trajectory, gap, fear, theme])

  const start = () => {
    if (!online) return
    const order: StepId[] = [...(openIntention ? (['checkin'] as StepId[]) : []), 'wins', 'friction', 'avoided', 'wish', 'plan']
    setSteps(order)
    // Resume where the draft left off; a resolved check-in can't come back.
    const at = weeklyDraft ? order.indexOf(weeklyDraft.at) : 0
    setStep(at > 0 ? at : 0)
    setErr('')
    setPhase('flow')
  }

  const finish = async () => {
    const minted = await onComplete(
      { wins: wins.trim(), friction: friction.trim(), avoided: avoided.trim() },
      { wish: wish.trim(), outcome: outcome.trim(), obstacle: obstacle.trim(), plan: plan.trim() },
    )
    if (minted) {
      clearDraft('weekly')
      setWeeklyDraft(null)
      setCard(minted)
      setPhase('card')
      return
    }
    const pending: WeeklyDraft = {
      at: 'plan', awaitingCoach: true, wins, friction, avoided, wish, outcome, obstacle, plan,
    }
    setWeeklyDraft(pending)
    saveDraft('weekly', pending, 0)
    setPhase('landing')
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

  // ---- monthly: begin (one AI draft), then the guided sub-flow ----
  const beginMonth = async () => {
    // A saved arc-in-progress resumes with the user's edits — no second AI call.
    if (savedMonthly && draft) {
      setErr('')
      setPhase('month')
      return
    }
    const d = await onBeginMonthly()
    if (!d) return // store toasts on failure
    setDraft(d)
    setTrajectory(d.text)
    setTheme(d.theme ?? '')
    setGap(''); setFear('')
    setMStep('trajectory')
    setErr('')
    setPhase('month')
  }

  const monthOrder: MonthStep[] = liveDecision ? ['trajectory', 'gap', 'fear', 'theme'] : ['trajectory', 'gap', 'theme']

  const advanceMonth = () => {
    if (mStep === 'trajectory' && !trajectory.trim()) return setErr('Error — the read should say something true.')
    if (mStep === 'theme' && !theme.trim()) return setErr('Error — one theme to aim the month.')
    setErr('')
    const i = monthOrder.indexOf(mStep)
    if (i < monthOrder.length - 1) return setMStep(monthOrder[i + 1])
    clearDraft('monthly')
    onCompleteMonthly(
      { trajectory: trajectory.trim(), gap: gap.trim(), fear: fear.trim(), theme: theme.trim() },
      draft?.profile ?? null,
    )
    setPhase('monthcard')
  }

  // ---- the minted weekly read: a real success moment ----
  if (phase === 'card' && card) {
    return (
      <div className="develop">
        <span className="ambient">The week, read</span>
        {/* The user's own if-then IS the outcome — it leads, large and theirs. */}
        {plan.trim() && (
          <h1 style={{ marginTop: 'var(--s-3)' }}>“{plan.trim()}”</h1>
        )}
        <p className="secondary">
          Your intention stands for the week. Coach checks in on it in Guidance — no need to carry it yourself.
        </p>
        <div className="section">
          <div className="coach develop-late">
            <span className="coach-label ambient">Coach</span>
            <p className="develop">{card.text}</p>
          </div>
        </div>
        <div className="spacer" />
        <button className="btn" onClick={() => setPhase('landing')}>Done</button>
      </div>
    )
  }

  // ---- the banked month ----
  if (phase === 'monthcard') {
    return (
      <div className="develop">
        <h1>The month is set.</h1>
        {theme.trim() && (
          <div className="section center">
            <span className="ambient">The month ahead</span>
            <p className="display-word" style={{ marginTop: 'var(--s-3)' }}>{theme.trim()}</p>
          </div>
        )}
        <p className="secondary">Coach will weigh your nights against it — lightly, only when it fits.</p>
        <div className="spacer" />
        <button className="btn" onClick={() => setPhase('landing')}>Done</button>
      </div>
    )
  }

  // ---- the weekly guided flow ----
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
              placeholder="What went right this week, and what did you do to cause it?" aria-label="The wins, and what caused them." />
          </>
        )}

        {id === 'friction' && (
          <>
            <span className="ambient">The week</span>
            <h1 style={{ marginTop: 'var(--s-3)' }}>Where you fell short — and what got in the way.</h1>
            <p className="subhead">What, not why. Conditions, not character.</p>
            <div className="spacer" />
            <textarea value={friction} autoFocus onChange={(e) => setFriction(e.target.value)}
              placeholder="The specific thing that got in the way." aria-label="Where you fell short, and what got in the way." />
          </>
        )}

        {id === 'avoided' && (
          <>
            <span className="ambient">Honesty</span>
            <h1 style={{ marginTop: 'var(--s-3)' }}>What decision are you avoiding?</h1>
            <p className="subhead">Naming it is half the battle. Leave it blank if there truly isn’t one.</p>
            <div className="spacer" />
            <textarea value={avoided} autoFocus onChange={(e) => setAvoided(e.target.value)}
              placeholder="A decision, a conversation, a bet." aria-label="What decision are you avoiding?" />
          </>
        )}

        {id === 'wish' && (
          <>
            <span className="ambient">Next week</span>
            <h1 style={{ marginTop: 'var(--s-3)' }}>The one outcome that matters most.</h1>
            <p className="subhead">One wish — and what getting it does for you.</p>
            <div className="spacer" />
            <input value={wish} autoFocus onChange={(e) => setWish(e.target.value)}
              placeholder="The single most important outcome." aria-label="The one outcome that matters most." />
            <div className="section">
              <label className="field-label"><span className="ambient">What it gets you</span></label>
              <input value={outcome} onChange={(e) => setOutcome(e.target.value)}
                placeholder="How it will feel, what it makes possible — one line." aria-label="What it gets you." />
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
              placeholder="The obstacle inside you, not around you." aria-label="The obstacle, and your move." />
            <div className="section">
              <label className="field-label"><span className="ambient">The if-then</span></label>
              <input value={plan} onChange={(e) => setPlan(e.target.value)}
                placeholder="If it shows up, I will…" aria-label="The if-then plan." />
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

  // ---- the monthly guided flow ----
  if (phase === 'month') {
    const last = monthOrder[monthOrder.length - 1]
    const monthIndex = monthOrder.indexOf(mStep)
    return (
      <div className="develop" key={mStep}>
        <div className="dots">
          {monthOrder.map((s) => (
            <i key={s} className={s === mStep ? 'on' : monthOrder.indexOf(s) < monthOrder.indexOf(mStep) ? 'visited' : ''} />
          ))}
        </div>

        {mStep === 'trajectory' && (
          <>
            <span className="ambient">The month</span>
            <h1 style={{ marginTop: 'var(--s-3)' }}>Coach’s read of your month.</h1>
            <p className="subhead">Make it yours — edit anything that isn’t quite true.</p>
            <div className="spacer" />
            <textarea value={trajectory} autoFocus onChange={(e) => setTrajectory(e.target.value)}
              style={{ minHeight: 180 }} aria-label="Coach's read of your month." />
          </>
        )}

        {mStep === 'gap' && (
          <>
            <span className="ambient">Identity</span>
            <h1 style={{ marginTop: 'var(--s-3)' }}>Where are you out of step with what you value?</h1>
            <p className="subhead">One specific gap between what you say matters and how the month went.</p>
            <div className="spacer" />
            <textarea value={gap} autoFocus onChange={(e) => setGap(e.target.value)}
              placeholder="The one place you’re not living what you claim to." aria-label="Where are you out of step with what you value?" />
          </>
        )}

        {mStep === 'fear' && (
          <>
            <span className="ambient">Fear-setting</span>
            <h1 style={{ marginTop: 'var(--s-3)' }}>The decision you keep circling.</h1>
            {liveDecision && <p className="morning-line">You’ve named: “{liveDecision}”</p>}
            <p className="subhead">Worst case if you act — and the cost of not deciding in six months?</p>
            <div className="spacer" />
            <textarea value={fear} autoFocus onChange={(e) => setFear(e.target.value)}
              placeholder="Define · Prevent · Repair · and the cost of inaction." aria-label="The decision you keep circling." />
          </>
        )}

        {mStep === 'theme' && (
          <>
            <span className="ambient">The month ahead</span>
            <h1 style={{ marginTop: 'var(--s-3)' }}>One theme to aim it.</h1>
            <p className="subhead">A north star for the next four weeks. Coach suggested one — keep it or change it.</p>
            <div className="spacer" />
            <input value={theme} autoFocus onChange={(e) => setTheme(e.target.value)}
              placeholder="e.g. Ship, don’t polish" aria-label="One theme to aim the month." />
          </>
        )}

        {err && <p className="field-error">{err}</p>}

        <div className="spacer" />
        <div className="row">
          {monthIndex > 0 && (
            <button className="btn ghost back" onClick={() => setMStep(monthOrder[monthIndex - 1])}>Back</button>
          )}
          <button className="btn" onClick={advanceMonth}>{mStep === last ? 'Set the month' : 'Continue'}</button>
        </div>
      </div>
    )
  }

  // ---- the archive: every past read, on its own page ----
  if (phase === 'archive') {
    const all = [
      ...cards.map((c) => ({ ...c, kind: 'Week' })),
      ...arcs.map((a) => ({ ...a, kind: 'Month' })),
    ].sort((a, b) => (a.date < b.date ? 1 : -1))
    return (
      <div className="develop">
        <button className="btn text back-line" onClick={() => setPhase('landing')}>← Reviews</button>
        <h1>Past reads</h1>
        <div className="section">
          {all.map((c) => (
            <div key={c.id} className="item">
              <div className="item-meta ambient">{c.kind} · {humanDate(c.date)}</div>
              <div className="item-body">{c.text}</div>
            </div>
          ))}
          {all.length === 0 && <p className="secondary">Your reads will gather here.</p>}
        </div>
      </div>
    )
  }

  // ---- landing: ONE next action; everything else waits quietly behind it ----
  // The next sensible step is computed, not offered as a menu: an owed weekly
  // read outranks everything; then the weekly (the lighter, more frequent
  // step); then the monthly arc. What isn't next is a quiet text link.
  const weeklyActionable = !!weeklyDraft?.awaitingCoach || ready
  const monthActionable = !!(savedMonthly && draft) || monthReady

  const weeklyPrimary = weeklyActionable && (
    weeklyDraft?.awaitingCoach ? (
      <>
        <h2 style={{ marginTop: 'var(--s-3)' }}>The week, written — Coach owes it a read</h2>
        <p className="secondary" style={{ margin: 'var(--s-3) 0 var(--s-5)' }}>
          Every word is kept. One tap hands it to Coach.
        </p>
        <button className={online ? 'btn' : 'btn ghost'} onClick={() => void finish()} disabled={!online || thinking}>
          {!online ? 'Coach reads your week live — you’re offline.' : thinking ? 'Coach is reading your week…' : 'Retry Coach'}
        </button>
      </>
    ) : (
      <>
        <h2 style={{ marginTop: 'var(--s-3)' }}>{fullWeek ? 'Review your week' : 'Review the week so far'}</h2>
        <p className="secondary" style={{ margin: 'var(--s-3) 0 var(--s-5)' }}>
          {weeklyDraftText(weeklyDraft)
            ? 'Your review is where you left it — every word kept.'
            : fullWeek
              ? 'Three questions and one intention, in your words — then Coach reads it against your nights. About ten minutes.'
              : 'Three nights is enough to look at the week so far — three questions, one intention.'}
        </p>
        <button className={online ? 'btn' : 'btn ghost'} onClick={start} disabled={!online || thinking}>
          {!online
            ? 'Coach reads your week live — you’re offline.'
            : weeklyDraftText(weeklyDraft)
              ? 'Continue the review'
              : fullWeek ? 'Review my week' : 'Review the week so far'}
        </button>
        {openIntention && (
          <p className="morning-line" style={{ marginTop: 'var(--s-5)', marginBottom: 0 }}>
            Standing: {openIntention.title}
          </p>
        )}
      </>
    )
  )

  const monthlyPrimary = monthActionable && (
    <>
      <h2 style={{ marginTop: 'var(--s-3)' }}>{savedMonthly && draft ? 'Finish the monthly arc' : 'The monthly arc'}</h2>
      <p className="secondary" style={{ margin: 'var(--s-3) 0 var(--s-5)' }}>
        {savedMonthly && draft
          ? 'Your arc is where you left it — the draft is kept.'
          : 'The month’s trajectory, drafted from your own words. You set its theme.'}
      </p>
      <button className={online ? 'btn' : 'btn ghost'} onClick={beginMonth} disabled={!online || thinking}>
        {!online
          ? 'Coach reads your month live — you’re offline.'
          : thinking ? 'Coach is reading your month…'
            : savedMonthly && draft ? 'Continue the monthly arc' : 'Begin the monthly arc'}
      </button>
    </>
  )

  return (
    <div className="develop">
      <h1>Reviews</h1>
      <p className="sub">Zoom out from nights to patterns.</p>

      <div className="section">
        <span className="ambient">{weeklyActionable || monthActionable ? 'Next' : 'Not yet'}</span>
        {weeklyPrimary || monthlyPrimary || (
          <>
            <h2 style={{ marginTop: 'var(--s-3)' }}>The week in review</h2>
            <p className="secondary" style={{ marginTop: 'var(--s-3)' }}>
              Opens after three nights in a week — keep reflecting. The monthly arc
              follows around Night 30.
            </p>
            {openIntention && (
              <p className="morning-line" style={{ marginTop: 'var(--s-5)', marginBottom: 0 }}>
                Standing: {openIntention.title}
              </p>
            )}
          </>
        )}
      </div>

      {(weeklyPrimary && monthActionable) || cards.length > 0 || arcs.length > 0 ? (
        <div className="section">
          <span className="ambient">Also</span>
          <div className="spacer" />
          {weeklyPrimary && monthActionable && (
            <button className="btn text" style={{ paddingLeft: 0, display: 'block' }} onClick={beginMonth} disabled={!online || thinking}>
              {savedMonthly && draft ? 'Continue the monthly arc →' : 'Begin the monthly arc →'}
            </button>
          )}
          {(cards.length > 0 || arcs.length > 0) && (
            <button className="btn text" style={{ paddingLeft: 0, display: 'block' }} onClick={() => setPhase('archive')}>
              Past reads →
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}
