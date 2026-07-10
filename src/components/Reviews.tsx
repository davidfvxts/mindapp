import { useEffect, useState } from 'react'
import { KIND_LABEL } from '../lib/guidance'
import { clearDraft, loadDraft, saveDraft } from '../lib/drafts'
import type { WeeklyAnswers, Woop } from '../lib/weekly'
import type { MonthlyAnswers } from '../lib/monthly'
import type { MonthlyResult } from '../lib/ai'
import type { CoachProfile, InsightCard, Nudge } from '../lib/types'

interface Props {
  /** A week is gathered and the last guided review is far enough back. */
  ready: boolean
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
  onGoToday: () => void
}

type StepId = 'checkin' | 'wins' | 'friction' | 'avoided' | 'wish' | 'plan'
type MonthStep = 'trajectory' | 'gap' | 'fear' | 'theme'

/** In-progress review writing, persisted so ten minutes of typing can never be lost. */
interface WeeklyDraft {
  at: StepId
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

const weeklyDraftText = (d: WeeklyDraft | null): boolean =>
  !!d && [d.wins, d.friction, d.avoided, d.wish, d.outcome, d.obstacle, d.plan].some((v) => v.trim())

/**
 * The weekly review — the user's own work, structured by Coach (AAR: the
 * participant does the review) — plus the monthly arc, the deepest layer
 * (trajectory · identity · fear-setting · theme). One thing per screen.
 */
export function Reviews({
  ready, cards, arcs, thinking, monthReady, liveDecision, openIntention,
  onResolveIntention, onComplete, onBeginMonthly, onCompleteMonthly, onGoToday,
}: Props) {
  const [phase, setPhase] = useState<'landing' | 'flow' | 'card' | 'month' | 'monthcard'>('landing')
  const [steps, setSteps] = useState<StepId[]>([])
  const [step, setStep] = useState(0)
  const [err, setErr] = useState('')
  const [card, setCard] = useState<InsightCard | null>(null)

  // Ten minutes of typing must survive anything: both flows persist as drafts
  // and resume from the landing. Cleared only when the review is banked.
  const [savedWeekly] = useState<WeeklyDraft | null>(() => loadDraft<WeeklyDraft>('weekly'))
  const [savedMonthly] = useState<MonthlyDraft | null>(() => loadDraft<MonthlyDraft>('monthly'))

  const [wins, setWins] = useState(savedWeekly?.wins ?? '')
  const [friction, setFriction] = useState(savedWeekly?.friction ?? '')
  const [avoided, setAvoided] = useState(savedWeekly?.avoided ?? '')
  const [wish, setWish] = useState(savedWeekly?.wish ?? '')
  const [outcome, setOutcome] = useState(savedWeekly?.outcome ?? '')
  const [obstacle, setObstacle] = useState(savedWeekly?.obstacle ?? '')
  const [plan, setPlan] = useState(savedWeekly?.plan ?? '')

  // ---- monthly arc state ----
  const [draft, setDraft] = useState<MonthlyResult | null>(savedMonthly?.result ?? null)
  const [mStep, setMStep] = useState<MonthStep>(savedMonthly?.at ?? 'trajectory')
  const [trajectory, setTrajectory] = useState(savedMonthly?.trajectory ?? '')
  const [gap, setGap] = useState(savedMonthly?.gap ?? '')
  const [fear, setFear] = useState(savedMonthly?.fear ?? '')
  const [theme, setTheme] = useState(savedMonthly?.theme ?? '')

  useEffect(() => {
    if (phase !== 'flow') return
    saveDraft('weekly', {
      at: steps[step] ?? 'wins', wins, friction, avoided, wish, outcome, obstacle, plan,
    } satisfies WeeklyDraft)
  }, [phase, steps, step, wins, friction, avoided, wish, outcome, obstacle, plan])

  useEffect(() => {
    if (phase !== 'month' || !draft) return
    saveDraft('monthly', { result: draft, at: mStep, trajectory, gap, fear, theme } satisfies MonthlyDraft)
  }, [phase, draft, mStep, trajectory, gap, fear, theme])

  const start = () => {
    const order: StepId[] = [...(openIntention ? (['checkin'] as StepId[]) : []), 'wins', 'friction', 'avoided', 'wish', 'plan']
    setSteps(order)
    // Resume where the draft left off; a resolved check-in can't come back.
    const at = savedWeekly ? order.indexOf(savedWeekly.at) : 0
    setStep(at > 0 ? at : 0)
    setErr('')
    setPhase('flow')
  }

  const finish = async () => {
    const minted = await onComplete(
      { wins: wins.trim(), friction: friction.trim(), avoided: avoided.trim() },
      { wish: wish.trim(), outcome: outcome.trim(), obstacle: obstacle.trim(), plan: plan.trim() },
    )
    if (minted) { clearDraft('weekly'); setCard(minted); setPhase('card') }
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

  // ---- the minted weekly read ----
  if (phase === 'card' && card) {
    return (
      <div className="develop">
        <h1>The week, read.</h1>
        <div className="section">
          <div className="coach">
            <span className="coach-label ambient">Coach</span>
            <p className="develop">{card.text}</p>
          </div>
        </div>
        <div className="spacer" />
        <p className="secondary">Your intention stands for the week — Coach will check in on it in Guidance.</p>
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
              placeholder="What went right this week, and what did you do to cause it?" />
          </>
        )}

        {id === 'friction' && (
          <>
            <span className="ambient">The week</span>
            <h1 style={{ marginTop: 'var(--s-3)' }}>Where you fell short — and what got in the way.</h1>
            <p className="subhead">What, not why. Conditions, not character.</p>
            <div className="spacer" />
            <textarea value={friction} autoFocus onChange={(e) => setFriction(e.target.value)}
              placeholder="The specific thing that got in the way." />
          </>
        )}

        {id === 'avoided' && (
          <>
            <span className="ambient">Honesty</span>
            <h1 style={{ marginTop: 'var(--s-3)' }}>What decision are you avoiding?</h1>
            <p className="subhead">Naming it is half the battle. Leave it blank if there truly isn’t one.</p>
            <div className="spacer" />
            <textarea value={avoided} autoFocus onChange={(e) => setAvoided(e.target.value)}
              placeholder="A decision, a conversation, a bet." />
          </>
        )}

        {id === 'wish' && (
          <>
            <span className="ambient">Next week</span>
            <h1 style={{ marginTop: 'var(--s-3)' }}>The one outcome that matters most.</h1>
            <p className="subhead">One wish — and what getting it does for you.</p>
            <div className="spacer" />
            <input value={wish} autoFocus onChange={(e) => setWish(e.target.value)}
              placeholder="The single most important outcome." />
            <div className="section">
              <label className="field-label"><span className="ambient">What it gets you</span></label>
              <input value={outcome} onChange={(e) => setOutcome(e.target.value)}
                placeholder="How it will feel, what it unlocks — one line." />
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
              placeholder="The obstacle inside you, not around you." />
            <div className="section">
              <label className="field-label"><span className="ambient">The if-then</span></label>
              <input value={plan} onChange={(e) => setPlan(e.target.value)}
                placeholder="If it shows up, I will…" />
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
              style={{ minHeight: 180 }} />
          </>
        )}

        {mStep === 'gap' && (
          <>
            <span className="ambient">Identity</span>
            <h1 style={{ marginTop: 'var(--s-3)' }}>Where are you out of step with what you value?</h1>
            <p className="subhead">One specific gap between what you say matters and how the month went.</p>
            <div className="spacer" />
            <textarea value={gap} autoFocus onChange={(e) => setGap(e.target.value)}
              placeholder="The one place you’re not living what you claim to." />
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
              placeholder="Define · Prevent · Repair · and the cost of inaction." />
          </>
        )}

        {mStep === 'theme' && (
          <>
            <span className="ambient">The month ahead</span>
            <h1 style={{ marginTop: 'var(--s-3)' }}>One theme to aim it.</h1>
            <p className="subhead">A north star for the next four weeks. Coach suggested one — keep it or change it.</p>
            <div className="spacer" />
            <input value={theme} autoFocus onChange={(e) => setTheme(e.target.value)}
              placeholder="e.g. Ship, don’t polish" />
          </>
        )}

        {err && <p className="field-error">{err}</p>}

        <div className="spacer" />
        <div className="row">
          <button className="btn" onClick={advanceMonth}>{mStep === last ? 'Set the month' : 'Continue'}</button>
        </div>
      </div>
    )
  }

  // ---- landing ----
  return (
    <div className="develop">
      <h1>Reviews</h1>
      <p className="sub">Zoom out from nights to patterns.</p>

      <div className="section">
        <span className="ambient">Weekly</span>
        <h2 style={{ marginTop: 'var(--s-3)' }}>The week in review</h2>
        {ready ? (
          <>
            <p className="secondary" style={{ marginBottom: 'var(--s-5)' }}>
              {weeklyDraftText(savedWeekly)
                ? 'Your review is where you left it — every word kept.'
                : 'The week is gathered. You do the review — three questions and an intention — and Coach reads it against your nights. About ten minutes.'}
            </p>
            <button className="btn" onClick={start}>
              {weeklyDraftText(savedWeekly) ? 'Continue the review' : 'Review my week'}
            </button>
          </>
        ) : (
          <>
            <p className="secondary" style={{ marginBottom: 'var(--s-5)' }}>
              A week’s review comes after a few nights. Keep going.
            </p>
            <button className="btn ghost" onClick={onGoToday}>Reflect tonight</button>
          </>
        )}
        {openIntention && (
          <div className="item" style={{ marginTop: 'var(--s-5)' }}>
            <div className="item-meta ambient">{KIND_LABEL[openIntention.kind]} · standing</div>
            <div className="item-body">{openIntention.title}</div>
          </div>
        )}
      </div>

      {cards.length > 0 && (
        <div className="section">
          <span className="ambient">Past reads</span>
          <div className="spacer" />
          {cards.slice(0, 6).map((c) => (
            <div key={c.id} className="item">
              <div className="item-meta ambient">{c.date}</div>
              <div className="item-body">{c.text}</div>
            </div>
          ))}
        </div>
      )}

      <div className="section">
        <span className="ambient">Monthly</span>
        <h2 style={{ marginTop: 'var(--s-3)' }}>The monthly arc</h2>
        <p className="secondary" style={{ marginBottom: 'var(--s-5)' }}>
          Trajectory and what you’re building toward — drafted from your own words.
          You set next month’s theme.
        </p>
        {savedMonthly && draft ? (
          <button className="btn" onClick={beginMonth}>Continue the monthly arc</button>
        ) : monthReady ? (
          <button className="btn" onClick={beginMonth} disabled={thinking}>
            {thinking ? 'Coach is reading your month…' : 'Begin the monthly arc'}
          </button>
        ) : (
          <p className="secondary">Opens once you’ve gathered a few weekly reads.</p>
        )}
        {arcs.length > 0 && (
          <>
            <div className="spacer" />
            {arcs.slice(0, 4).map((a) => (
              <div key={a.id} className="item">
                <div className="item-meta ambient">{a.date}</div>
                <div className="item-body">{a.text}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
