import { useEffect, useState } from 'react'
import { clearDraft, loadDraft, saveDraft } from '../lib/drafts'
import type { Entry } from '../lib/types'

interface Props {
  /** The night this conversation is about — carries the thread. */
  entry: Entry
  online: boolean
  /** Saves the user's turn first, then fetches Coach's reply. False = no reply came. */
  onSend: (entryId: string, message: string) => Promise<boolean>
}

/**
 * The conversation about a night. The field is simply there — talking back
 * is a text box, not a decision. Every turn the user writes is saved to the
 * entry before any network work, so the thread survives anything; a reply
 * that can't arrive is said plainly, never faked or queued.
 */
export function CoachChat({ entry, online, onSend }: Props) {
  const draftKey = `chat.${entry.id}`
  const [draft, setDraft] = useState(() => loadDraft<string>(draftKey) ?? '')
  const [busy, setBusy] = useState(false)
  // Online, sent, and no reply came back — the one case worth a plain word.
  const [unanswered, setUnanswered] = useState(false)

  useEffect(() => {
    if (!busy) saveDraft(draftKey, draft)
  }, [draftKey, draft, busy])

  // A bounded exchange from before threads reads as the first turns of the
  // same conversation — one history, not two formats.
  const turns = [
    ...(entry.coachAnswer ? [{ role: 'you' as const, text: entry.coachAnswer }] : []),
    ...(entry.coachClose ? [{ role: 'coach' as const, text: entry.coachClose.text }] : []),
    ...(entry.thread ?? []),
  ]

  const send = async () => {
    const text = draft.trim()
    if (!text || busy) return
    setBusy(true)
    setUnanswered(false)
    // The turn is persisted inside onSend before any request starts —
    // the draft has done its job the moment we hand the words over.
    setDraft('')
    clearDraft(draftKey)
    const replied = await onSend(entry.id, text)
    setBusy(false)
    if (!replied && online) setUnanswered(true)
  }

  return (
    <div className="chat">
      {turns.map((t, i) =>
        t.role === 'you' ? (
          <div key={i} className="reflection-answer develop">
            <span className="ambient">You</span>
            <p>{t.text}</p>
          </div>
        ) : (
          <div key={i} className="coach coach-close develop">
            <span className="coach-label ambient">Coach</span>
            <p>{t.text}</p>
          </div>
        ),
      )}

      {busy && <p className="secondary chat-status" role="status">Coach is reading…</p>}
      {!busy && unanswered && (
        <p className="secondary chat-status" role="status">
          Kept with this night. Coach couldn’t reply just now.
        </p>
      )}

      <div className="chat-input">
        <textarea
          value={draft}
          maxLength={600}
          placeholder="Write back."
          aria-label="Write to Coach"
          onChange={(event) => setDraft(event.target.value)}
          disabled={busy}
        />
        <button className="btn chat-send" onClick={() => void send()} disabled={!draft.trim() || busy}>
          Send
        </button>
      </div>
      {!online && (
        <p className="secondary chat-status">Offline — your words are kept with this night; Coach replies live.</p>
      )}
    </div>
  )
}
