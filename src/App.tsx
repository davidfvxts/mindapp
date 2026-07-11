import { useEffect, useState } from 'react'
import { useFacet } from './lib/store'
import { Onboarding } from './components/Onboarding'
import { DailyRitual } from './components/DailyRitual'
import { AfterReflection } from './components/AfterReflection'
import { Guidance } from './components/Guidance'
import { Vault } from './components/Vault'
import { Reviews } from './components/Reviews'
import { Settings } from './components/Settings'
import { Method } from './components/Method'
import { Account } from './components/Account'
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

/** Each tab explains itself exactly once — the first time it's opened. */
const INTROS: Record<Exclude<Tab, 'today'>, { title: string; body: string }> = {
  guidance: {
    title: 'Guidance',
    body: 'Now and then — never daily — Coach leaves one thing here worth trying: '
      + 'a tip, an action, a book. Most of the time it’s empty. That’s deliberate: '
      + 'only what fits you, only when it counts.',
  },
  review: {
    title: 'Reviews',
    body: 'Nights are the ground floor; this is where you zoom out. After three '
      + 'nights in a week you can review it — three questions, one intention — and '
      + 'Coach reads it with you. Around Night thirty, a monthly arc opens above it.',
  },
  vault: {
    title: 'The Vault',
    body: 'Everything you write lands here. The stone on the bench grows as your '
      + 'nights add up — press and hold it to watch the last nights sink in. At '
      + 'each milestone it opens, in colour, and keeps your words inside.',
  },
}

/** A one-time introduction: one page, one idea, one button. */
function TabIntro({ title, body, onContinue }: { title: string; body: string; onContinue: () => void }) {
  return (
    <div className="develop">
      <span className="ambient">First time here</span>
      <h1 style={{ marginTop: 'var(--s-3)' }}>{title}</h1>
      <p className="sub">{body}</p>
      <div className="spacer" />
      <button className="btn" onClick={onContinue}>Continue</button>
    </div>
  )
}

export default function App() {
  const m = useFacet()
  const [tab, setTab] = useState<Tab>('today')
  const [retuning, setRetuning] = useState(false)
  // The make-it-stick step runs AFTER the First Read — value first, setup second.
  const [settingUp, setSettingUp] = useState(false)
  // Settings live on their own quiet page, reached from the Vault — never a tab.
  const [screen, setScreen] = useState<'app' | 'settings' | 'method' | 'account'>('app')

  useEffect(() => { window.scrollTo(0, 0) }, [tab, screen])

  // Distinct keys: first-run and retune must never share component state —
  // an erase ends retune and lands on a FRESH welcome.
  if (!m.state.onboarded) return <Onboarding key="first" onBegin={m.beginJourney} />

  if (settingUp) {
    const p = m.state.settings
    return (
      <Onboarding
        key="setup"
        mode="setup"
        initial={{ cue: p.cue === 'close my laptop' ? '' : p.cue, reminderTime: p.reminderTime, morningTime: p.morningTime, tone: p.tone, sync: p.sync }}
        onSetup={(settings) => { m.completeOnboarding(settings); setSettingUp(false) }}
      />
    )
  }

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
  // A tab's first visit gets its introduction; every later visit goes straight in.
  const intro = tab !== 'today' && !m.state.seenIntros.includes(tab) ? INTROS[tab] : null
  const accountLabel = !m.account
    ? 'Set up your rhythm to turn on backup, then log in from anywhere.'
    : m.account.email && !m.account.anonymous
      ? `Signed in as ${m.account.email}.`
      : m.account.anonymous
        ? 'Backed up anonymously — log in to reach it from another device.'
        : 'Log in to bring back an account’s backed-up nights.'

  return (
    <section className="wrap">
      <header className="bar">
        <span className="wordmark">FACET</span>
        {/* The reveal screen carries the Night itself — one number per page. */}
        {!(tab === 'today' && m.reveal && screen === 'app') && (
          <span className="night-chip">
            <span className="ambient">Night</span>
            <span className="n">{game.nights}</span>
          </span>
        )}
      </header>

      <main>
        {screen === 'settings' && (
          <Settings
            accountLabel={accountLabel}
            onRhythm={() => { setScreen('app'); setSettingUp(true) }}
            onRetune={() => { setScreen('app'); setRetuning(true) }}
            onAccount={() => setScreen('account')}
            onMethod={() => setScreen('method')}
            onBack={() => setScreen('app')}
          />
        )}
        {screen === 'method' && <Method onBack={() => setScreen('settings')} />}
        {screen === 'account' && (
          <Account
            account={m.account}
            busy={m.authBusy}
            onLogin={m.logIn}
            onLogout={m.logOut}
            onBack={() => setScreen('settings')}
          />
        )}

        {screen === 'app' && intro && (
          <TabIntro title={intro.title} body={intro.body} onContinue={() => m.markIntroSeen(tab)} />
        )}

        {screen === 'app' && !intro && (
          <>
            {tab === 'today' &&
              (m.reveal ? (
                <AfterReflection
                  entryId={m.reveal.entryId}
                  chatTurns={m.state.conversations.find((c) => c.id === m.reveal?.entryId)?.turns ?? []}
                  reply={m.reveal.reply}
                  pending={m.reveal.pending}
                  night={m.reveal.night}
                  firstRead={m.reveal.firstRead}
                  echo={milestoneEcho(m.state.entries, m.reveal.night)}
                  stoneSeen={m.state.stoneSeen}
                  online={m.online}
                  onStoneSeen={m.markStoneSeen}
                  onRate={m.rateReply}
                  onChat={(message) => m.chatWithCoach(m.reveal!.entryId, message)}
                  onDone={() => {
                    const wasFirst = m.reveal?.firstRead
                    m.clearReveal()
                    // The first read flows into make-it-stick; every later read banks to the Vault.
                    if (wasFirst) setSettingUp(true)
                    else setTab('vault')
                  }}
                />
              ) : (
                <DailyRitual
                  reflectedToday={m.derived.reflectedToday}
                  cue={m.state.settings.cue}
                  thinking={m.thinking}
                  night={game.nights}
                  stoneSeen={m.state.stoneSeen}
                  onStoneSeen={m.markStoneSeen}
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
                fullWeek={m.derived.fullWeeklyReview}
                online={m.online}
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

            {tab === 'vault' && (
              <Vault
                state={m.state}
                online={m.online}
                onChat={m.chatWithCoach}
                onConverse={m.converseWithCoach}
                onStoneSeen={m.markStoneSeen}
                onSettings={() => setScreen('settings')}
              />
            )}
          </>
        )}

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
              onClick={() => { setTab(id); setScreen('app') }}
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
