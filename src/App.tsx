import { useEffect, useState } from 'react'
import { useFacet } from './lib/store'
import { Onboarding } from './components/Onboarding'
import { DailyRitual } from './components/DailyRitual'
import { AfterReflection } from './components/AfterReflection'
import { Guidance } from './components/Guidance'
import { Vault } from './components/Vault'
import { Reviews } from './components/Reviews'
import { unseenCount } from './lib/guidance'
import { milestoneEcho } from './lib/inclusions'
import { GOAL_OPTIONS } from './lib/onboarding'
import { aiEnabled } from './lib/ai'
import { cloudEnabled } from './lib/supabase'

type Tab = 'today' | 'guidance' | 'review' | 'vault'

const TABS: [Tab, string][] = [
  ['today', 'Tonight'],
  ['guidance', 'Guidance'],
  ['review', 'Reviews'],
  ['vault', 'Vault'],
]

export default function App() {
  const m = useFacet()
  const [tab, setTab] = useState<Tab>('today')
  const [retuning, setRetuning] = useState(false)

  useEffect(() => { window.scrollTo(0, 0) }, [tab])

  // Distinct keys: first-run and retune must never share component state —
  // an erase ends retune and lands on a FRESH welcome.
  if (!m.state.onboarded) return <Onboarding key="first" onBegin={m.beginJourney} />

  if (retuning) {
    const p = m.state.settings
    return (
      <Onboarding
        key="retune"
        mode="retune"
        initial={{
          name: p.name === 'there' ? '' : p.name,
          goals: (m.state.coach.profile.goals ?? []).filter((g) => (GOAL_OPTIONS as readonly string[]).includes(g)),
          cue: p.cue,
          reminderTime: p.reminderTime,
          morningTime: p.morningTime,
          tone: p.tone,
          sync: p.sync,
        }}
        onRetune={(settings, answers) => { m.retune(settings, answers); setRetuning(false); setTab('today') }}
        onErase={async () => {
          const done = await m.eraseEverything()
          if (done) { setRetuning(false); setTab('today') }
          return done
        }}
      />
    )
  }

  const { game } = m.state
  const guidanceNew = unseenCount(m.state) > 0
  const reviewNew = m.derived.reviewReady || m.derived.monthReady
  const revealedEntry = m.reveal ? m.state.entries.find((entry) => entry.id === m.reveal?.entryId) : undefined

  return (
    <section className="wrap">
      <header className="bar">
        <span className="wordmark">FACET</span>
        {/* The reveal screen carries the Night itself — one number per page. */}
        {!(tab === 'today' && m.reveal) && (
          <span className="night-chip">
            <span className="ambient">Night</span>
            <span className="n">{game.nights}</span>
          </span>
        )}
      </header>

      <main>
        {tab === 'today' &&
          (m.reveal ? (
            <AfterReflection
              entryId={m.reveal.entryId}
              reply={m.reveal.reply}
              pending={m.reveal.pending}
              night={m.reveal.night}
              firstRead={m.reveal.firstRead}
              echo={milestoneEcho(m.state.entries, m.reveal.night)}
              answer={revealedEntry?.coachAnswer}
              close={revealedEntry?.coachClose}
              onRate={m.rateReply}
              onAnswer={(answer) => m.answerCoach(m.reveal!.entryId, answer)}
              onDone={() => { m.clearReveal(); setTab('vault') }}
            />
          ) : (
            <DailyRitual
              reflectedToday={m.derived.reflectedToday}
              cue={m.state.settings.cue}
              thinking={m.thinking}
              todayIntention={m.derived.todayIntention}
              morningNote={m.derived.morningNote}
              morningQuestion={m.derived.morningQuestion}
              morningWindow={m.derived.morningWindow}
              onSetMorning={m.setMorning}
              comeback={m.derived.comeback}
              onSubmit={(d) => void m.submitEntry(d)}
            />
          ))}

        {tab === 'guidance' && (
          <Guidance
            state={m.state}
            onCommit={m.commitNudge}
            onDecline={m.declineNudge}
            onResolve={m.resolveNudge}
            onRenegotiate={m.renegotiateIntention}
            onSeen={m.markGuidanceSeen}
          />
        )}

        {tab === 'review' && (
          <Reviews
            ready={m.derived.reviewReady}
            cards={m.state.cards}
            arcs={m.state.arcs}
            thinking={m.thinking}
            monthReady={m.derived.monthReady}
            liveDecision={m.derived.liveDecision}
            openIntention={m.derived.openWeeklyIntention}
            onResolveIntention={m.resolveNudge}
            onComplete={(r, w) => m.completeWeekly(r, w)}
            onBeginMonthly={m.beginMonthly}
            onCompleteMonthly={m.completeMonthly}
          />
        )}

        {tab === 'vault' && <Vault state={m.state} onRevisit={() => setRetuning(true)} />}

        {/* Developer plumbing never reaches end users: local-only is a designed
            mode in production, not an error to explain. */}
        {import.meta.env.DEV && (!aiEnabled() || !cloudEnabled()) && (
          <p className="mode-note center">
            {!aiEnabled() && 'Coach is off. '}
            {!cloudEnabled() && 'On this device only. '}
            Add keys to <code>.env.local</code> to turn on Coach and sync.
          </p>
        )}
      </main>

      <nav className="tabs" aria-label="Primary navigation">
        {TABS.map(([id, label]) => {
          const hasNew = ((id === 'guidance' && guidanceNew) || (id === 'review' && reviewNew)) && tab !== id
          return (
            <button
              key={id}
              className={tab === id ? 'on' : ''}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id)}
            >
              {label}
              {hasNew && <span className="sr-only">, new</span>}
              {hasNew && <i className="tab-dot" aria-hidden />}
            </button>
          )
        })}
      </nav>

      {m.toast && <div className="toast" role="status">{m.toast}</div>}
    </section>
  )
}
