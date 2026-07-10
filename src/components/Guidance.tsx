import { useEffect, useState } from 'react'
import {
  KIND_LABEL,
  MEDIUM_LABEL,
  openNudge,
  checkInsDue,
  inFlight,
  resolvedNudges,
} from '../lib/guidance'
import { staleCommitment } from '../lib/coachMemory'
import type { AppState, Commitment, Nudge } from '../lib/types'

interface Actions {
  onCommit: (id: string, note?: string) => void
  onDecline: (id: string, note?: string) => void
  onResolve: (id: string, kept: boolean) => void
  onRenegotiate: (keep: boolean) => void
  onSeen: () => void
}

function SourceLine({ n }: { n: Nudge }) {
  const s = n.source
  if (!s) return null
  return (
    <p className="g-source ambient">
      {MEDIUM_LABEL[s.medium]} · {s.by}
      {s.url && (
        <>
          {' · '}
          <a href={s.url} target="_blank" rel="noopener noreferrer">Open</a>
        </>
      )}
    </p>
  )
}

/** The one open nudge, awaiting the user's call: commit, push back, or set aside. */
function OpenCard({ n, onCommit, onDecline }: { n: Nudge } & Pick<Actions, 'onCommit' | 'onDecline'>) {
  const [note, setNote] = useState('')
  const trimmed = note.trim() || undefined
  return (
    <div className="nudge develop">
      <span className="nudge-kind ambient">{KIND_LABEL[n.kind]}</span>
      <h2 className="g-title">{n.title}</h2>
      <p className="secondary">{n.body}</p>
      <p className="nudge-value">{n.value}</p>
      <SourceLine n={n} />

      <textarea
        className="nudge-note"
        rows={2}
        placeholder="Push back, or ask Coach for help with it — optional."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="row nudge-actions">
        <button className="btn primary" onClick={() => onCommit(n.id, trimmed)}>I’ll try this</button>
        <button className="btn text" onClick={() => onDecline(n.id, trimmed)}>Not for me</button>
      </div>
    </div>
  )
}

/** A commitment whose check-in has come due — how did it go? */
function CheckInCard({ n, onResolve }: { n: Nudge } & Pick<Actions, 'onResolve'>) {
  return (
    <div className="nudge develop">
      <span className="nudge-kind ambient">Checking in</span>
      <h2 className="g-title">{n.title}</h2>
      <p className="secondary">You said you’d try this. How did it go?</p>
      {n.note && <p className="nudge-value">Your note: {n.note}</p>}
      <div className="row nudge-actions">
        <button className="btn primary" onClick={() => onResolve(n.id, true)}>Kept it up</button>
        <button className="btn text" onClick={() => onResolve(n.id, false)}>Didn’t stick</button>
      </div>
    </div>
  )
}

/** An intention that aged out unresolved — the user decides, Coach never does. */
function AdriftCard({ c, onRenegotiate }: { c: Commitment } & Pick<Actions, 'onRenegotiate'>) {
  return (
    <div className="nudge develop">
      <span className="nudge-kind ambient">An intention, adrift</span>
      <h2 className="g-title">“{c.text}”</h2>
      <p className="secondary">
        You set this a few nights ago and it hasn’t closed. Still on it, or let it go?
        Either answer is a good one.
      </p>
      <div className="row nudge-actions">
        <button className="btn primary" onClick={() => onRenegotiate(true)}>Still on it</button>
        <button className="btn text" onClick={() => onRenegotiate(false)}>Let it go</button>
      </div>
    </div>
  )
}

const STATUS_WORD: Record<string, string> = { kept: 'Kept', dropped: 'Set down', declined: 'Passed' }

export function Guidance({ state, onCommit, onDecline, onResolve, onRenegotiate, onSeen }: { state: AppState } & Actions) {
  // Clear the tab marker once the user is looking at it.
  useEffect(() => { onSeen() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const open = openNudge(state)
  const due = checkInsDue(state)
  const flight = inFlight(state)
  const past = resolvedNudges(state)
  const adrift = staleCommitment(state.coach)
  const nothing = !open && !adrift && due.length === 0 && flight.length === 0 && past.length === 0

  return (
    <div className="develop">
      <h1>Guidance</h1>
      <p className="sub">One thing worth trying, now and then — only when Coach thinks it counts.</p>

      {adrift && <AdriftCard c={adrift} onRenegotiate={onRenegotiate} />}

      {due.map((n) => (
        <CheckInCard key={n.id} n={n} onResolve={onResolve} />
      ))}

      {open && <OpenCard n={open} onCommit={onCommit} onDecline={onDecline} />}

      {nothing && (
        <div className="section">
          <p className="secondary">
            Nothing right now. Coach surfaces something only when it can make a real difference —
            usually every few nights. Keep reflecting; it’s learning you.
          </p>
        </div>
      )}

      {flight.length > 0 && (
        <div className="section">
          <span className="ambient">In progress</span>
          <div className="spacer" />
          {flight.map((n) => (
            <div key={n.id} className="item">
              <div className="item-meta ambient">{KIND_LABEL[n.kind]} · Coach will check in</div>
              <div className="item-body">{n.title}</div>
            </div>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div className="section">
          <span className="ambient">Earlier</span>
          <div className="spacer" />
          {past.slice(0, 20).map((n) => (
            <div key={n.id} className="item">
              <div className="item-meta ambient">{STATUS_WORD[n.status] ?? ''}</div>
              <div className="item-body">{n.title}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
