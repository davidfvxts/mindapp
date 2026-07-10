import { useState } from 'react'
import { useFacet } from './lib/store'
import { Onboarding } from './components/Onboarding'
import { DailyRitual } from './components/DailyRitual'
import { AfterReflection } from './components/AfterReflection'
import { Guidance } from './components/Guidance'
import { Vault } from './components/Vault'
import { Reviews } from './components/Reviews'
import { unseenCount } from './lib/guidance'
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

  if (!m.state.onboarded) return <Onboarding onBegin={m.beginJourney} />

  if (retuning) {
    const p = m.state.settings
    return (
      <Onboarding
        mode="retune"
        initial={{
          name: p.name === 'there' ? '' : p.name,
          goals: (m.state.coach.profile.goals ?? []).filter((g) => (GOAL_OPTIONS as readonly string[]).includes(g)),
          cue: p.cue,
          reminderTime: p.reminderTime,
          morningTime: p.morningTime,
          tone: p.tone,
        }}
        onRetune={(settings, answers) => { m.retune(settings, answers); setRetuning(false); setTab('today') }}
      />
    )
  }

  const { game } = m.state
  const guidanceNew = unseenCount(m.state) > 0
  const reviewNew = m.derived.reviewReady
  const revealedEntry = m.reveal ? m.state.entries.find((entry) => entry.id === m.reveal?.entryId) : undefined

  return (
    <section className="wrap">
      <header className="bar">
        <span className="wordmark">FACET</span>
        {game.streak > 0 && (
          <span className="night-chip">
            <span className="ambient">Night</span>
            <span className="n">{game.streak}</span>
          </span>
        )}
      </header>

      <main>
        {tab === 'today' &&
          (m.reveal ? (
            <AfterReflection
              reply={m.reveal.reply}
              pending={m.reveal.pending}
              night={m.reveal.night}
              firstRead={m.reveal.firstRead}
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
              onComebackSeen={m.acknowledgeComeback}
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
            thinking={m.thinking}
            openIntention={m.derived.openWeeklyIntention}
            onResolveIntention={m.resolveNudge}
            onComplete={(r, w) => m.completeWeekly(r, w)}
            onGoToday={() => setTab('today')}
          />
        )}

        {tab === 'vault' && <Vault state={m.state} onReset={m.hardReset} onRevisit={() => setRetuning(true)} />}

        {(!aiEnabled() || !cloudEnabled()) && (
          <p className="mode-note center">
            {!aiEnabled() && 'Coach is off. '}
            {!cloudEnabled() && 'On this device only. '}
            Add keys to <code>.env.local</code> to turn on Coach and sync.
          </p>
        )}
      </main>

      <nav className="tabs">
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {label}
            {((id === 'guidance' && guidanceNew) || (id === 'review' && reviewNew)) && tab !== id && (
              <i className="tab-dot" aria-hidden />
            )}
          </button>
        ))}
      </nav>

      {m.toast && <div className="toast" role="status">{m.toast}</div>}
    </section>
  )
}
