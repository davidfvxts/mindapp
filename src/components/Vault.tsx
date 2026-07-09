import { useState } from 'react'
import { Stone } from './Stone'
import { bankedStones, nextStone, type Stone as StoneModel } from '../lib/milestones'
import type { AppState } from '../lib/types'

export function Vault({ state, onReset, onRevisit }: { state: AppState; onReset: () => void; onRevisit: () => void }) {
  const { game, entries } = state
  // Stones are banked off the best Night ever reached — they never regress.
  const banked = bankedStones(game.best)
  const upcoming = nextStone(game.best)
  const [open, setOpen] = useState<StoneModel | null>(null)

  if (open) {
    return (
      <div className="develop">
        <button className="btn text" onClick={() => setOpen(null)}>← The Vault</button>
        <div className="section center">
          {/* Colour blooms here, on the detail view. */}
          <Stone colored stone={open} size={200} caption={open.name} />
          <p className="sub" style={{ marginTop: 'var(--s-5)' }}>Night {open.night}.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="develop">
      <h1>The Vault</h1>

      <div className="section">
        {banked.length === 0 ? (
          <div className="vault-empty">
            <Stone size={120} caption="Rough" />
          </div>
        ) : (
          <div className="vault-grid">
            {banked.map((s) => (
              <button key={s.name} className="vault-cell" onClick={() => setOpen(s)}>
                <Stone size={92} caption={s.name} />
              </button>
            ))}
          </div>
        )}
        {upcoming && (
          <p className="secondary center" style={{ marginTop: 'var(--s-6)' }}>
            The next stone takes shape at Night {upcoming.night}.
          </p>
        )}
      </div>

      <div className="section">
        <span className="ambient">Your nights</span>
        <div className="spacer" />
        {entries.length === 0 ? (
          <p className="secondary">Your reflections will gather here.</p>
        ) : (
          entries.slice(0, 30).map((e) => (
            <div key={e.id} className="item">
              {e.emotions.length > 0 && (
                <div className="item-meta ambient">{e.emotions.join(' · ')}</div>
              )}
              <div className="item-body">{e.event}</div>
              {e.coach && (
                <div className="item-coach">
                  <span className="ambient">Coach</span>
                  <p>{e.coach.text}</p>
                </div>
              )}
              {e.coachAnswer && (
                <div className="item-coach item-answer">
                  <span className="ambient">You</span>
                  <p>{e.coachAnswer}</p>
                </div>
              )}
              {e.coachClose && (
                <div className="item-coach item-close">
                  <span className="ambient">Coach</span>
                  <p>{e.coachClose.text}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="section">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button className="btn text" onClick={onRevisit}>Revisit setup</button>
          <button className="btn text" onClick={onReset}>Reset everything</button>
        </div>
      </div>
    </div>
  )
}
