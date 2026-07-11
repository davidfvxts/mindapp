import { useEffect, useState } from 'react'
import { Stone } from './Stone'
import { StoneFilm } from './StoneFilm'
import { stoneForNight, stoneStage } from '../lib/milestones'
import { filmForNight, filmWindow } from '../lib/stoneFilm'
import { clearDraft, loadDraft, saveDraft } from '../lib/drafts'
import { track } from '../lib/analytics'
import type { CoachClose, CoachReply } from '../lib/types'

interface Props {
  /** The entry this screen belongs to — keys the answer draft. */
  entryId: string
  /** Coach's read. Null when skipped (offline / not configured). */
  reply: CoachReply | null
  /** A read is owed but wasn't reachable — it'll arrive on reconnect. */
  pending: boolean
  /** The Night count — the only number shown here. */
  night: number
  /** The onboarding First Read — labelled, and not rated (it's a welcome). */
  firstRead?: boolean
  /** The milestone callback: the user's own words from the span's first night. */
  echo?: { night: number; words: string } | null
  /** The user's one saved answer and Coach's optional final line. */
  answer?: string
  close?: CoachClose
  /** The last Night whose stone development has been pressed through. */
  stoneSeen: number
  onStoneSeen: () => void
  onRate: (r: 0 | 1) => void
  onAnswer: (answer: string) => Promise<boolean>
  onDone: () => void
}

export function AfterReflection({
  entryId, reply, pending, night, firstRead, echo, answer, close, stoneSeen, onStoneSeen, onRate, onAnswer, onDone,
}: Props) {
  const draftKey = `answer.${entryId}`
  const [rated, setRated] = useState<0 | 1 | null>(null)
  // The milestone stone arrives encased in rock — the user cracks it open.
  const [cracked, setCracked] = useState(false)
  // An in-progress answer survives a refresh; a non-empty draft reopens the composer.
  const [answerDraft, setAnswerDraft] = useState(() => (answer ? '' : loadDraft<string>(draftKey) ?? ''))
  const [composerOpen, setComposerOpen] = useState(() => !answer && !!answerDraft.trim())
  const [answerStatus, setAnswerStatus] = useState<'idle' | 'sending' | 'closed' | 'unavailable'>('idle')
  const milestone = stoneForNight(night)
  const savedAnswer = answer ?? (answerStatus === 'idle' ? '' : answerDraft.trim())

  useEffect(() => {
    if (answerStatus !== 'idle' || answer) return
    saveDraft(draftKey, answerDraft)
  }, [draftKey, answerDraft, answerStatus, answer])

  // The pilot's wow-counter: the First Read reached the screen. Name only.
  useEffect(() => {
    if (firstRead) track('first_read_viewed')
  }, [firstRead])

  const rate = (r: 0 | 1) => {
    setRated(r)
    onRate(r)
  }

  const sendAnswer = async () => {
    const text = answerDraft.trim()
    if (!text || answerStatus === 'sending') return
    setAnswerStatus('sending')
    const closed = await onAnswer(text)
    // The answer is saved to the entry either way — the draft has done its job.
    clearDraft(draftKey)
    setComposerOpen(false)
    setAnswerStatus(closed ? 'closed' : 'unavailable')
  }

  return (
    <div>
      {/* The Night and the Stone carry the moment. Colour only when earned —
          and the milestone gem shows nothing at all until it's cracked open. */}
      {milestone && !cracked ? (
        <div className="section center develop">
          <button className="stone-crack" aria-label="Open the stone" onClick={() => setCracked(true)}>
            <Stone stone={milestone} shellState="intact" size={172} />
          </button>
          <p className="sub" style={{ marginTop: 'var(--s-5)' }}>
            Night {night}. The stone is ready — open it.
          </p>
        </div>
      ) : milestone ? (
        <div className="section center">
          <Stone reveal stone={milestone} shellState="opened" size={172} caption={milestone.name} />
          <p className="sub develop-late" style={{ marginTop: 'var(--s-5)' }}>
            Night {night}. Kept in the Vault.
          </p>
          {echo && (
            <p className="secondary develop-late">
              Night {echo.night}, you wrote: “{echo.words}”
            </p>
          )}
        </div>
      ) : (
        <div className="section center develop">
          <span className="ambient">Night</span>
          <div className="display" style={{ marginTop: 'var(--s-2)' }}>{night}</div>
          <div className="spacer" />
          {/* Tonight's evolution. With a film: press and hold to develop it.
              Without one: the procedural stone cuts tonight's facet. */}
          {(() => {
            const sources = filmForNight(night)
            const w = filmWindow(night, stoneSeen)
            return sources ? (
              <>
                <StoneFilm
                  sources={sources}
                  fromF={w.fromF}
                  toF={w.toF}
                  owed={w.owed}
                  onSettled={onStoneSeen}
                  night={night}
                  size={firstRead ? 156 : 132}
                  caption={stoneStage(night)}
                />
                {w.owed && (
                  <p className="secondary" style={{ marginTop: 'var(--s-4)' }}>
                    Press and hold — the night sinks in.
                  </p>
                )}
              </>
            ) : (
              <Stone night={night} newFacet size={firstRead ? 132 : 104} caption={stoneStage(night)} />
            )
          })()}
          {firstRead && (
            /* The stone, introduced once — at the moment it first ignites. */
            <p className="secondary develop-late" style={{ marginTop: 'var(--s-5)' }}>
              Your stone. Hold it and tonight becomes part of it.
              On the seventh night, it opens.
            </p>
          )}
        </div>
      )}

      {/* Direct feedback is an online-only event. On a milestone night the
          ceremony leads: crack first, then the read develops in. */}
      {milestone && !cracked ? null : reply ? (
        <div className={milestone ? 'section develop-late' : 'section'}>
          <div className="coach">
            <span className="coach-label ambient">{firstRead ? 'Coach · your first read' : 'Coach'}</span>
            <p className="develop">{reply.text}</p>
            {reply.lesson && <p className="lesson develop develop-2">{reply.lesson}</p>}
            {!firstRead && (
              <div className="rate">
                {/* One quiet word of why: rating is how Coach learns this person.
                    Sentence case — it's 11pm, nothing shouts. */}
                <span className="rate-label secondary">Did it land? It tunes Coach.</span>
                <button className={rated === 1 ? 'pick' : ''} onClick={() => rate(1)}>That’s right</button>
                <button className={rated === 0 ? 'pick' : ''} onClick={() => rate(0)}>Not quite</button>
              </div>
            )}
          </div>

          {!firstRead && !savedAnswer && !composerOpen && (
            <div className="answer-turn">
              {/* Optional stays optional: one quiet action, never a second
                  full-weight button competing with Done. */}
              <button className="btn text" style={{ paddingLeft: 0 }} onClick={() => setComposerOpen(true)}>
                Answer Coach →
              </button>
            </div>
          )}

          {!firstRead && !savedAnswer && composerOpen && (
            <div className="answer-turn develop">
              <label className="field-label ambient" htmlFor="coach-answer">Your answer</label>
              <textarea
                id="coach-answer"
                value={answerDraft}
                maxLength={600}
                placeholder="Write it down."
                aria-label="Your answer to Coach"
                onChange={(event) => setAnswerDraft(event.target.value)}
                disabled={answerStatus === 'sending'}
              />
              <div className="row">
                <button
                  className="btn answer-send"
                  onClick={() => void sendAnswer()}
                  disabled={!answerDraft.trim() || answerStatus === 'sending'}
                >
                  {answerStatus === 'sending' ? 'Coach is reading' : 'Send'}
                </button>
                {answerStatus !== 'sending' && (
                  /* Stepping back keeps the draft — words are never lost. */
                  <button className="btn text" onClick={() => setComposerOpen(false)}>Cancel</button>
                )}
              </div>
            </div>
          )}

          {savedAnswer && (
            <div className="reflection-answer develop">
              <span className="ambient">You</span>
              <p>{savedAnswer}</p>
            </div>
          )}

          {close && (
            <div className="coach coach-close develop">
              <span className="coach-label ambient">Coach</span>
              <p>{close.text}</p>
            </div>
          )}

          {savedAnswer && !close && answerStatus === 'unavailable' && (
            <p className="secondary answer-unavailable" role="status">Saved. Coach couldn’t close this one.</p>
          )}
        </div>
      ) : pending ? (
        <div className="section">
          <p className="secondary">Saved. Coach reads this when you’re back online.</p>
        </div>
      ) : null}

      <div className="spacer" />
      {/* On a milestone night, the crack comes before anything else. The first
          read flows onward — into make-it-stick — rather than closing. */}
      {(!milestone || cracked) && (
        <button className="btn" onClick={onDone}>{firstRead ? 'Continue' : 'Done'}</button>
      )}
    </div>
  )
}
