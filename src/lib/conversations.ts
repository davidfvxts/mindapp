/**
 * Facet — conversations with Coach, as a findable, named archive.
 *
 * Every chat is a Conversation: anchored to one night (its id IS that
 * entry's id — one conversation per night, deterministic across devices)
 * or free-standing. All functions here are PURE; the store owns effects.
 */

import type { ChatTurn, Conversation, Entry } from './types'

/** Longest a stored conversation grows — old turns fall off the front.
 *  Far beyond what the server window reads; a guard, not a feature. */
const TURN_CAP = 400

/** The one conversation about a night shares the night's id. */
export const nightConversationId = (entryId: string): string => entryId

const turnKey = (t: ChatTurn): string => `${t.ts}|${t.role}|${t.text}`

/** Union two turn lists by identity, ordered by time (stable on ties). */
export function mergeTurns(a: ChatTurn[], b: ChatTurn[]): ChatTurn[] {
  const seen = new Set<string>()
  const all: ChatTurn[] = []
  for (const t of [...a, ...b]) {
    const k = turnKey(t)
    if (seen.has(k)) continue
    seen.add(k)
    all.push(t)
  }
  return all.sort((x, y) => x.ts - y.ts).slice(-TURN_CAP)
}

/**
 * Merge conversation sets by id — the login/recovery path. Nothing on either
 * side is dropped: turns union, a real title beats none, the newer clock wins.
 */
export function mergeConversations(local: Conversation[], remote: Conversation[]): Conversation[] {
  const byId = new Map<string, Conversation>()
  for (const c of local) byId.set(c.id, c)
  for (const r of remote) {
    const l = byId.get(r.id)
    if (!l) {
      byId.set(r.id, r)
      continue
    }
    byId.set(r.id, {
      ...l,
      title: l.title ?? r.title,
      entryId: l.entryId ?? r.entryId,
      turns: mergeTurns(l.turns, r.turns),
      createdAt: Math.min(l.createdAt, r.createdAt),
      updatedAt: Math.max(l.updatedAt, r.updatedAt),
      // A merge produces a superset — it must travel back up.
      synced: false,
    })
  }
  return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt)
}

/**
 * Lift legacy per-entry exchanges (coachAnswer / coachClose / thread) into
 * conversations. Idempotent: existing conversations only gain turns they
 * don't already hold. Legacy turns get deterministic timestamps off the
 * entry's own clock so every device lifts to the identical result.
 */
export function liftNightConversations(entries: Entry[], conversations: Conversation[]): Conversation[] {
  let next = conversations
  let changed = false
  for (const e of entries) {
    const legacy: ChatTurn[] = [
      ...(e.coachAnswer ? [{ role: 'you' as const, text: e.coachAnswer, ts: e.ts + 1 }] : []),
      ...(e.coachClose ? [{ role: 'coach' as const, text: e.coachClose.text, ts: e.ts + 2 }] : []),
      ...(e.thread ?? []),
    ]
    if (!legacy.length) continue
    const id = nightConversationId(e.id)
    const existing = next.find((c) => c.id === id)
    if (!existing) {
      const first = legacy[0].ts
      const last = legacy[legacy.length - 1].ts
      next = [...next, { id, title: null, entryId: e.id, turns: mergeTurns(legacy, []), createdAt: first, updatedAt: last, synced: false }]
      changed = true
      continue
    }
    const turns = mergeTurns(existing.turns, legacy)
    if (turns.length !== existing.turns.length) {
      next = next.map((c) => (c.id === id ? { ...c, turns, updatedAt: Math.max(c.updatedAt, turns[turns.length - 1].ts), synced: false } : c))
      changed = true
    }
  }
  return changed ? next : conversations
}

/** Append one turn; creates the conversation when it doesn't exist yet. */
export function appendTurn(
  conversations: Conversation[],
  id: string,
  turn: ChatTurn,
  entryId?: string,
): Conversation[] {
  const existing = conversations.find((c) => c.id === id)
  if (!existing) {
    return [
      { id, title: null, entryId, turns: [turn], createdAt: turn.ts, updatedAt: turn.ts, synced: false },
      ...conversations,
    ]
  }
  return conversations.map((c) =>
    c.id === id
      ? { ...c, turns: mergeTurns(c.turns, [turn]), updatedAt: Math.max(c.updatedAt, turn.ts), synced: false }
      : c,
  )
}

/** Set the title Coach gave it. First real name wins; never overwritten. */
export function nameConversation(conversations: Conversation[], id: string, title: string): Conversation[] {
  const clean = title.replace(/\s+/g, ' ').trim().slice(0, 60)
  if (!clean) return conversations
  return conversations.map((c) => (c.id === id && !c.title ? { ...c, title: clean, synced: false } : c))
}

/** One line the list can show before Coach has named a conversation. */
export function fallbackTitle(c: Conversation, entries: Entry[]): string {
  const entry = c.entryId ? entries.find((e) => e.id === c.entryId) : undefined
  const source = entry?.event ?? c.turns.find((t) => t.role === 'you')?.text ?? 'With Coach'
  const line = source.replace(/\s+/g, ' ').trim()
  return line.length > 44 ? `${line.slice(0, 43).trimEnd()}…` : line
}

/** The archive, newest activity first. Empty conversations never list. */
export function conversationList(conversations: Conversation[]): Conversation[] {
  return conversations
    .filter((c) => c.turns.length > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}
