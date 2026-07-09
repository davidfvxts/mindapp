import { todayStr } from '../lib/game'
import { Gem } from './Gem'
import type { AppState } from '../lib/types'

export function Stats({ state, onReset }: { state: AppState; onReset: () => void }) {
  const { game, entries, cards } = state
  const days = new Set(entries.map((e) => e.date))

  const cells = Array.from({ length: 28 }, (_, i) => {
    const d = new Date(Date.now() - (27 - i) * 86400000)
    const key = todayStr(d)
    return { key, lit: days.has(key), today: key === todayStr() }
  })

  return (
    <div className="fade">
      <h1>Your practice</h1>
      <div className="spacer" />

      <div className="section">
        <div className="metrics">
          <div className="metric"><b>{game.streak}</b><span>CURRENT STREAK</span></div>
          <div className="metric"><b>{game.best}</b><span>BEST STREAK</span></div>
          <div className="metric"><b>{entries.length}</b><span>REFLECTIONS</span></div>
          <div className="metric"><b>{game.freezes}</b><span>FREEZES LEFT</span></div>
        </div>
      </div>

      <div className="section">
        <h3>Last 28 days</h3>
        <div className="heat">
          {cells.map((c) => (
            <i key={c.key} className={`${c.lit ? 'on' : ''}${c.today ? ' today' : ''}`} title={c.key} />
          ))}
        </div>
        <p className="muted" style={{ marginTop: 16 }}>
          Miss once and Mira spends a freeze, so your streak survives. Never miss twice.
        </p>
      </div>

      <div className="section">
        <h3>Insight cards</h3>
        {cards.length === 0 ? (
          <p className="muted">Reach a weekly review to mint your first.</p>
        ) : (
          cards.map((c, i) => (
            <div key={c.id} className="card-line">
              <Gem variant={i} size={34} />
              <div>
                <div className="body">{c.text}</div>
                <div className="meta">{c.date}</div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="section">
        <h3>Recent moments</h3>
        {entries.length === 0 ? (
          <p className="muted">Your reflections will appear here.</p>
        ) : (
          entries.slice(0, 6).map((e) => (
            <div key={e.id} className="item">
              <div className="meta">
                {e.date}{e.emotions.length > 0 && ` · ${e.emotions.join(' · ')}`}
              </div>
              <div className="body">{e.event}</div>
            </div>
          ))
        )}
      </div>

      <div className="section">
        <button className="btn text" onClick={onReset}>Reset all data</button>
      </div>
    </div>
  )
}
