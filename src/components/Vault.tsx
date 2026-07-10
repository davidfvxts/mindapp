import { useState } from 'react'
import { Stone } from './Stone'
import { STONES, bankedStones, nextStone, type Stone as StoneModel } from '../lib/milestones'
import { inclusionsForStone, prevMilestoneNight, type Inclusion } from '../lib/inclusions'
import type { AppState } from '../lib/types'

export function Vault({ state, onRevisit }: { state: AppState; onRevisit: () => void }) {
  const { game, entries } = state
  // Night is monotonic, so the Vault's stone history is always banked.
  const banked = bankedStones(game.nights)
  const upcoming = nextStone(game.nights)
  const [open, setOpen] = useState<StoneModel | null>(null)
  const [inclusion, setInclusion] = useState<Inclusion | null>(null)

  if (open) {
    // The stone as a container of reflections: tapping an inclusion surfaces
    // the user's own words from a night within the stone's span.
    const points = inclusionsForStone(entries, open, prevMilestoneNight(STONES, open), state.coach.themes)
    return (
      <div className="develop">
        <button className="btn text" onClick={() => { setOpen(null); setInclusion(null) }}>← The Vault</button>
        <div className="section center">
          {/* Colour blooms here, on the detail view. */}
          <Stone colored stone={open} size={200} caption={open.name} />
          <p className="sub" style={{ marginTop: 'var(--s-5)' }}>Night {open.night}.</p>
        </div>

        {points.length > 0 && (
          <div className="section">
            <span className="ambient">Inside this stone</span>
            <div className="spacer" />
            {points.map((p) => (
              <button
                key={p.date}
                className={`inclusion${inclusion?.date === p.date ? ' on' : ''}`}
                onClick={() => setInclusion(inclusion?.date === p.date ? null : p)}
              >
                <span className="inclusion-label">{p.label}</span>
                {inclusion?.date === p.date && <span className="inclusion-words develop">{p.event}</span>}
              </button>
            ))}
          </div>
        )}
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
        {/* Erasing lives behind Revisit setup — deliberate, confirmed, complete.
            A destructive action never sits one thumb-width from a routine one. */}
        <button className="btn text" onClick={onRevisit}>Revisit setup</button>
      </div>
    </div>
  )
}
