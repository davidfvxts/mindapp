import { useEffect, useState } from 'react'
import { clearDraft, loadDraft, saveDraft } from '../lib/drafts'
import type { ChatTurn } from '../lib/types'

interface Props {
  /** The conversation so far — night-anchored or free-standing. */
  turns: ChatTurn[]
  /** Keys the in-progress draft (`chat.<conversationId>`). */
  draftKey: string
  online: boolean
  /** Saves the user's turn first, then fetches Coach's reply. False = no reply came. */
  onSend: (message: string) => Promise<boolean>
  placeholder?: string
  autoFocus?: boolean
}

/**
 * The conversation with Coach. The field is simply there — talking is a text
 * box, not a decision. Every turn the user writes is saved before any network
 * work, so the thread survives anything; a reply that can't arrive is said
 * plainly, never faked or queued.
 */
export function CoachChat({ turns, draftKey, online, onSend, placeholder, autoFocus }: Props) {
  const [draft, setDraft] = useState(() => loadDraft<string>(draftKey) ?? '')
  const [busy, setBusy] = useState(false)
  // Online, sent, and no reply came back — the one case worth a plain word.
  const [unanswered, setUnanswered] = useState(false)

  useEffect(() => {
    if (!busy) saveDraft(draftKey, draft)
  }, [draftKey, draft, busy])

  const send = async () => {
    const text = draft.trim()
    if (!text || busy) return
    setBusy(true)
    setUnanswered(false)
    // The turn is persisted inside onSend before any request starts —
    // the draft has done its job the moment we hand the words over.
    setDraft('')
    clearDraft(draftKey)
    const replied = await onSend(text)
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
            {/* Depth arrives as paragraphs; each renders as quiet type. */}
            {t.text.split(/\n{2,}|\n(?=[-•])/).map((para, j) => (
              <p key={j}>{para}</p>
            ))}
          </div>
        ),
      )}

      {busy && <p className="secondary chat-status" role="status">Coach is reading…</p>}
      {!busy && unanswered && (
        <p className="secondary chat-status" role="status">
          Kept with this conversation. Coach couldn’t reply just now.
        </p>
      )}

      <div className="chat-input">
        <textarea
          value={draft}
          maxLength={2000}
          placeholder={placeholder ?? 'Write back.'}
          aria-label="Write to Coach"
          autoFocus={autoFocus}
          onChange={(event) => setDraft(event.target.value)}
          disabled={busy}
        />
        <button className="btn chat-send" onClick={() => void send()} disabled={!draft.trim() || busy}>
          Send
        </button>
      </div>
      {!online && (
        <p className="secondary chat-status">Offline — your words are kept here; Coach replies live.</p>
      )}
    </div>
  )
}
