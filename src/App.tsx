import { useState } from 'react'
import { useFacet } from './lib/store'
import { Onboarding } from './components/Onboarding'
import { DailyRitual } from './components/DailyRitual'
import { AfterReflection } from './components/AfterReflection'
import { Vault } from './components/Vault'
import { Reviews } from './components/Reviews'
import { aiEnabled } from './lib/ai'
import { cloudEnabled } from './lib/supabase'

type Tab = 'today' | 'review' | 'vault'

const TABS: [Tab, string][] = [
  ['today', 'Tonight'],
  ['review', 'Reviews'],
  ['vault', 'Vault'],
]

export default function App() {
  const m = useFacet()
  const [tab, setTab] = useState<Tab>('today')

  if (!m.state.onboarded) return <Onboarding onDone={m.completeOnboarding} />

  const { game } = m.state

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
          (m.lastReply ? (
            <AfterReflection
              reply={m.lastReply}
              night={game.streak}
              onRate={m.rateReply}
              onDone={() => { m.clearReply(); setTab('vault') }}
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

        {tab === 'vault' && <Vault state={m.state} onReset={m.hardReset} />}

        {(!aiEnabled() || !cloudEnabled()) && (
          <p className="mode-note center">
            {!aiEnabled() && 'Offline coach. '}
            {!cloudEnabled() && 'On this device only. '}
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

      {m.toast && <div className="toast" role="status">{m.toast}</div>}
    </section>
  )
}
