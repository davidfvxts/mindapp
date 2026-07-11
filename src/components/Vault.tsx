import { useState } from 'react'
import { Stone } from './Stone'
import { StoneFilm } from './StoneFilm'
import { CoachChat } from './CoachChat'
import { STONES, bankedStones, nextStone, stoneStage, type Stone as StoneModel } from '../lib/milestones'
import { filmForNight, filmWindow } from '../lib/stoneFilm'
import { inclusionsForStone, prevMilestoneNight, type Inclusion } from '../lib/inclusions'
import { conversationList, fallbackTitle, nightConversationId } from '../lib/conversations'
import type { AppState, Conversation, Entry } from '../lib/types'

type OnChat = (entryId: string, message: string) => Promise<boolean>
type OnConverse = (conversationId: string | null, message: string) => Promise<{ id: string; replied: boolean } | null>

/** ISO date → "Tue 8 July" — an instrument never shows debug output. */
const humanDate = (iso: string): string =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long' })

const humanTs = (ts: number): string =>
  new Date(ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long' })

/** The full night: reflection, Coach's read, and the conversation — which
 *  stays open here. Shared by the nights archive, the inclusions inside a
 *  banked stone, and a night-anchored conversation opened from the list. */
function NightDetail({ e, turns, online, onChat }: {
  e: Entry; turns: Conversation['turns']; online: boolean; onChat: OnChat
}) {
  return (
    <div className="night-detail develop">
      {e.well && (
        <p className="secondary"><span className="ambient">Went well · </span>{e.well}</p>
      )}
      {e.next && (
        <p className="secondary"><span className="ambient">Next · </span>{e.next}</p>
      )}
      {e.coach && (
        <div className="item-coach">
          <span className="ambient">Coach</span>
          <p>{e.coach.text}</p>
        </div>
      )}
      <CoachChat
        turns={turns}
        draftKey={`chat.${e.id}`}
        online={online}
        onSend={(message) => onChat(e.id, message)}
      />
    </div>
  )
}

/** One archived night: a quiet row that opens into the full entry + exchange. */
function NightRow({ e, turns, open, online, onChat, onToggle }: {
  e: Entry; turns: Conversation['turns']; open: boolean; online: boolean; onChat: OnChat; onToggle: () => void
}) {
  return (
    <div className={open ? 'item surface night-open' : 'item'}>
      <button className="night-row" onClick={onToggle} aria-expanded={open}>
        <span className="item-meta ambient">
          {humanDate(e.date)}
          {e.emotions.length > 0 && ` · ${e.emotions.join(' · ')}`}
        </span>
        <span className="item-body">{e.event}</span>
      </button>
      {open && <NightDetail e={e} turns={turns} online={online} onChat={onChat} />}
    </div>
  )
}

export function Vault({ state, online, onChat, onConverse, onStoneSeen, onSettings }: {
  state: AppState; online: boolean; onChat: OnChat; onConverse: OnConverse; onStoneSeen: () => void; onSettings: () => void
}) {
  const { game, entries, conversations } = state
  // Night is monotonic, so the Vault's stone history is always banked.
  const banked = bankedStones(game.nights)
  const upcoming = nextStone(game.nights)
  const [view, setView] = useState<'stones' | 'nights' | 'chats'>('stones')
  const [open, setOpen] = useState<StoneModel | null>(null)
  const [inclusion, setInclusion] = useState<Inclusion | null>(null)
  const [openNight, setOpenNight] = useState<string | null>(null)
  // The open conversation: an id, or 'new' while one is being started.
  const [openChat, setOpenChat] = useState<string | null>(null)

  const turnsFor = (e: Entry) =>
    conversations.find((c) => c.id === nightConversationId(e.id))?.turns ?? []

  // ---- a banked stone, in colour, with the nights held inside it ----
  if (open) {
    const points = inclusionsForStone(entries, open, prevMilestoneNight(STONES, open), state.coach.themes)
    return (
      <div className="develop">
        <button className="btn text back-line" onClick={() => { setOpen(null); setInclusion(null) }}>← The Vault</button>
        <div className="section center">
          {/* Colour blooms here, on the detail view. */}
          <Stone colored stone={open} size={200} caption={open.name} />
          <p className="sub" style={{ marginTop: 'var(--s-5)', marginBottom: 'var(--s-2)' }}>Night {open.night}.</p>
          {/* The chapter — what the light learned in this stone. Words, never numbers. */}
          <p className="secondary">{open.chapter}</p>
        </div>

        {points.length > 0 && (
          <div className="section">
            <span className="ambient">Inside this stone</span>
            <div className="spacer" />
            {points.map((p) => {
              const on = inclusion?.date === p.date
              // An open inclusion surfaces the WHOLE night — the reflection
              // and the Coach exchange — not just the event line.
              const night = on ? entries.find((e) => e.date === p.date) : undefined
              return (
                <div key={p.date} className={on ? 'inclusion-open surface' : undefined}>
                  <button
                    className={`inclusion${on ? ' on' : ''}`}
                    aria-expanded={on}
                    onClick={() => setInclusion(on ? null : p)}
                  >
                    <span className="inclusion-label">{p.label}</span>
                    {on && <span className="inclusion-words develop">{p.event}</span>}
                  </button>
                  {on && night && <NightDetail e={night} turns={turnsFor(night)} online={online} onChat={onChat} />}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ---- one conversation, on its own page ----
  if (view === 'chats' && openChat) {
    const convo = openChat === 'new' ? undefined : conversations.find((c) => c.id === openChat)
    const entry = convo?.entryId ? entries.find((e) => e.id === convo.entryId) : undefined
    const title = openChat === 'new'
      ? 'With Coach'
      : convo ? (convo.title ?? fallbackTitle(convo, entries)) : 'With Coach'
    return (
      <div className="develop">
        <button className="btn text back-line" onClick={() => setOpenChat(null)}>← Conversations</button>
        <h1>{title}</h1>
        {entry ? (
          <>
            {/* A conversation about one night carries the night with it. */}
            <p className="sub">
              {humanDate(entry.date)}
              {entry.emotions.length > 0 && ` · ${entry.emotions.join(' · ')}`}
            </p>
            <p className="body">{entry.event}</p>
            <NightDetail e={entry} turns={turnsFor(entry)} online={online} onChat={onChat} />
          </>
        ) : (
          <>
            {openChat === 'new' && (
              <p className="sub">Anything on your mind. Coach knows your nights.</p>
            )}
            {/* No key: the 'new' → real-id handoff must not remount the field
                (a remount would wipe the honest "couldn't reply" status). */}
            <CoachChat
              turns={convo?.turns ?? []}
              draftKey={`chat.${openChat}`}
              online={online}
              autoFocus={openChat === 'new'}
              placeholder={openChat === 'new' ? 'What’s on your mind?' : 'Write back.'}
              onSend={async (message) => {
                const result = await onConverse(openChat === 'new' ? null : openChat, message)
                if (result && openChat === 'new') setOpenChat(result.id)
                return result?.replied ?? false
              }}
            />
          </>
        )}
      </div>
    )
  }

  // ---- the conversations archive, on its own page ----
  if (view === 'chats') {
    const list = conversationList(conversations)
    return (
      <div className="develop">
        <button className="btn text back-line" onClick={() => setView('stones')}>← The Vault</button>
        <h1>Conversations</h1>
        <button className="btn text" style={{ paddingLeft: 0 }} onClick={() => setOpenChat('new')}>
          New conversation →
        </button>
        <div className="section">
          {list.length === 0 ? (
            <p className="secondary">
              Talk with Coach about a night, or about anything — every conversation
              is kept here, by name.
            </p>
          ) : (
            list.map((c) => (
              <div key={c.id} className="item">
                <button className="night-row" onClick={() => setOpenChat(c.id)}>
                  <span className="item-meta ambient">{humanTs(c.updatedAt)}</span>
                  <span className="item-body">{c.title ?? fallbackTitle(c, entries)}</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // ---- the nights archive, on its own page ----
  if (view === 'nights') {
    return (
      <div className="develop">
        <button className="btn text back-line" onClick={() => { setView('stones'); setOpenNight(null) }}>← The Vault</button>
        <h1>Your nights</h1>
        <div className="section">
          {entries.length === 0 ? (
            <p className="secondary">Your reflections will gather here.</p>
          ) : (
            entries.slice(0, 60).map((e) => (
              <NightRow
                key={e.id}
                e={e}
                turns={turnsFor(e)}
                open={openNight === e.id}
                online={online}
                onChat={onChat}
                onToggle={() => setOpenNight(openNight === e.id ? null : e.id)}
              />
            ))
          )}
        </div>
      </div>
    )
  }

  // ---- the Vault: the stones, and nothing else ----
  return (
    <div className="develop">
      <h1>The Vault</h1>

      <div className="section">
        {banked.length > 0 && (
          <div className="vault-grid">
            {banked.map((s) => (
              <button key={s.name} className="vault-cell" onClick={() => setOpen(s)}>
                {/* Each banked stone keeps its own cut — greyscale here, colour inside. */}
                <Stone stone={s} size={92} caption={s.name} />
              </button>
            ))}
          </div>
        )}
        {upcoming && (
          <>
            {/* The stone on the bench — tonight's state of the work. With a
                film, undeveloped nights wait here for the press. */}
            <div className="vault-current">
              {(() => {
                const sources = filmForNight(game.nights)
                const w = filmWindow(game.nights, state.stoneSeen)
                return sources ? (
                  <StoneFilm
                    sources={sources}
                    fromF={w.fromF}
                    toF={w.toF}
                    owed={w.owed}
                    onSettled={onStoneSeen}
                    night={game.nights}
                    size={140}
                    caption={stoneStage(game.nights)}
                  />
                ) : (
                  <Stone night={game.nights} size={120} caption={stoneStage(game.nights)} />
                )
              })()}
            </div>
            {filmForNight(game.nights) && filmWindow(game.nights, state.stoneSeen).owed && (
              <p className="secondary center" style={{ marginTop: 'var(--s-4)' }}>
                Press and hold — the last nights sink in.
              </p>
            )}
            <p className="secondary center" style={{ marginTop: 'var(--s-6)' }}>
              The next stone takes shape at Night {upcoming.night}.
            </p>
          </>
        )}
      </div>

      <div className="section">
        <button className="btn text" style={{ paddingLeft: 0, display: 'block' }} onClick={() => setView('nights')}>
          Your nights →
        </button>
        <button className="btn text" style={{ paddingLeft: 0, display: 'block' }} onClick={() => setView('chats')}>
          Conversations →
        </button>
        {/* Settings live behind the Vault — reachable, never a tab. */}
        <button className="btn text" style={{ paddingLeft: 0, display: 'block' }} onClick={onSettings}>
          Settings →
        </button>
      </div>
    </div>
  )
}
