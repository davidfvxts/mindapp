import { useState } from 'react'
import { useMira } from './lib/store'
import { Onboarding } from './components/Onboarding'
import { DailyRitual } from './components/DailyRitual'
import { MiraReply } from './components/MiraReply'
import { Stats } from './components/Stats'
import { Reviews } from './components/Reviews'
import { aiEnabled } from './lib/ai'
import { cloudEnabled } from './lib/supabase'

type Tab = 'today' | 'review' | 'stats'

const TABS: [Tab, string][] = [
  ['today', 'Reflect'],
  ['review', 'Reviews'],
  ['stats', 'Progress'],
]

export default function App() {
  const m = useMira()
  const [tab, setTab] = useState<Tab>('today')

  if (!m.state.onboarded) return <Onboarding onDone={m.completeOnboarding} />

  const { game } = m.state

  return (
    <section className="wrap">
      <header className="bar">
        <span className="wordmark">MIRA</span>
        {game.streak > 0 && (
          <span className="streak-chip">
            <b>{game.streak}</b>
            <span>DAY{game.streak === 1 ? '' : 'S'}</span>
          </span>
        )}
      </header>

      <main>
        {tab === 'today' &&
          (m.lastReply ? (
            <MiraReply
              reply={m.lastReply}
              streak={game.streak}
              gained={m.lastGain}
              level={game.level}
              xp={game.xp}
              xpNeeded={m.derived.xpNeeded}
              xpPct={m.derived.xpPct}
              onRate={m.rateReply}
              onDone={() => { m.clearReply(); setTab('stats') }}
            />
          ) : (
            <DailyRitual
              reflectedToday={m.derived.reflectedToday}
              cue={m.state.settings.cue}
              thinking={m.thinking}
              onSubmit={(d) => void m.submitEntry(d)}
            />
          ))}

        {tab === 'review' && (
          <Reviews
            thisWeek={m.derived.thisWeek}
            cardCount={m.state.cards.length}
            thinking={m.thinking}
            onMint={() => void m.mintCard()}
            onGoToday={() => setTab('today')}
          />
        )}

        {tab === 'stats' && <Stats state={m.state} onReset={m.hardReset} />}

        {(!aiEnabled() || !cloudEnabled()) && (
          <p className="mode-note center">
            {!aiEnabled() && 'Offline coach. '}
            {!cloudEnabled() && 'Local-only storage. '}
            Add keys to <code>.env.local</code> for AI coaching and sync.
          </p>
        )}
      </main>

      <nav className="tabs">
        {TABS.map(([id, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      {m.toast && <div className="toast">{m.toast}</div>}
    </section>
  )
}
