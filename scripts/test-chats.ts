/**
 * Facet — conversations engine tests (pure logic, no DOM).
 * Run: npm run test:chats
 */
import {
  appendTurn, conversationList, fallbackTitle, liftNightConversations,
  mergeConversations, mergeTurns, nameConversation, nightConversationId,
} from '../src/lib/conversations'
import type { ChatTurn, Conversation, Entry } from '../src/lib/types'

let failures = 0
const ok = (name: string, cond: boolean) => {
  if (cond) console.log(`pass: ${name}`)
  else { failures += 1; console.error(`FAIL: ${name}`) }
}

const T = (role: 'you' | 'coach', text: string, ts: number): ChatTurn => ({ role, text, ts })
const E = (id: string, o: Partial<Entry> = {}): Entry => ({
  id, date: o.date ?? '2026-07-09', event: o.event ?? 'a long investor call', emotions: o.emotions ?? [],
  well: o.well ?? 'w', next: o.next ?? 'n', ts: o.ts ?? 1_000_000, ...o,
})
const C = (id: string, o: Partial<Conversation> = {}): Conversation => ({
  id, title: o.title ?? null, entryId: o.entryId, turns: o.turns ?? [],
  createdAt: o.createdAt ?? 1, updatedAt: o.updatedAt ?? 1, synced: o.synced,
})

// ---------- turns: union by identity, ordered by time ----------
{
  const a = [T('you', 'first', 10), T('coach', 'reply', 20)]
  const b = [T('coach', 'reply', 20), T('you', 'second', 30)]
  const merged = mergeTurns(a, b)
  ok('turn union drops exact duplicates', merged.length === 3)
  ok('turn union stays in time order', merged.map((t) => t.ts).join(',') === '10,20,30')
}

// ---------- lift: legacy entry exchanges become conversations ----------
{
  const entries = [
    E('e1', { ts: 100, coachAnswer: 'my answer', coachClose: { text: 'the close', source: 'ai' } }),
    E('e2', { ts: 200, thread: [T('you', 'hey', 201), T('coach', 'read it', 202)] }),
    E('e3', { ts: 300 }), // no exchange — never lifts
  ]
  const lifted = liftNightConversations(entries, [])
  ok('one conversation per entry with an exchange', lifted.length === 2)
  const c1 = lifted.find((c) => c.id === nightConversationId('e1'))!
  ok('legacy answer + close read as the first turns',
    c1.turns.length === 2 && c1.turns[0].text === 'my answer' && c1.turns[1].text === 'the close')
  ok('legacy turns get deterministic clocks off the entry',
    c1.turns[0].ts === 101 && c1.turns[1].ts === 102)
  ok('night conversation carries its entry', c1.entryId === 'e1')
  ok('lift is idempotent', liftNightConversations(entries, lifted) === lifted)
  const again = liftNightConversations(
    [E('e2', { ts: 200, thread: [T('you', 'hey', 201), T('coach', 'read it', 202), T('you', 'more', 203)] })],
    lifted,
  )
  ok('a new turn lifts into the existing conversation',
    again.find((c) => c.id === 'e2')!.turns.length === 3)
}

// ---------- append / name ----------
{
  const one = appendTurn([], 'c1', T('you', 'hello', 10))
  ok('appending to nothing creates the conversation', one.length === 1 && one[0].turns.length === 1)
  const two = appendTurn(one, 'c1', T('coach', 'read', 20))
  ok('append advances the clock', two[0].updatedAt === 20 && two[0].synced === false)

  const named = nameConversation(two, 'c1', '  The investor question  ')
  ok('Coach’s name lands trimmed', named[0].title === 'The investor question')
  ok('a name never overwrites a name',
    nameConversation(named, 'c1', 'Something else')[0].title === 'The investor question')
  ok('an empty name is ignored', nameConversation(two, 'c1', '   ')[0].title === null)
}

// ---------- merge: the login path — nothing dropped on either side ----------
{
  const local = [C('a', { turns: [T('you', 'l1', 10)], updatedAt: 10 })]
  const remote = [
    C('a', { title: 'Named remotely', turns: [T('you', 'l1', 10), T('coach', 'r1', 20)], updatedAt: 20 }),
    C('b', { turns: [T('you', 'other device', 5)], updatedAt: 5, synced: true }),
  ]
  const merged = mergeConversations(local, remote)
  ok('merge unions by id', merged.length === 2)
  const a = merged.find((c) => c.id === 'a')!
  ok('merge unions turns and keeps the remote title', a.turns.length === 2 && a.title === 'Named remotely')
  ok('a merged superset travels back up', a.synced === false)
  ok('merge sorts by last activity', merged[0].id === 'a')
}

// ---------- the list ----------
{
  const entries = [E('e1', { event: 'the board meeting that ran long into the evening again' })]
  const convos = [
    C('e1', { entryId: 'e1', turns: [T('you', 'x', 10)], updatedAt: 10 }),
    C('f1', { turns: [T('you', 'how do I plan the raise?', 30)], updatedAt: 30 }),
    C('empty', { turns: [] }),
  ]
  const list = conversationList(convos)
  ok('empty conversations never list', list.length === 2)
  ok('newest activity first', list[0].id === 'f1')
  ok('a night conversation falls back to the night’s words',
    fallbackTitle(list[1], entries).startsWith('the board meeting'))
  ok('long fallbacks trim with an ellipsis', fallbackTitle(list[1], entries).endsWith('…'))
  ok('a free conversation falls back to its first words',
    fallbackTitle(list[0], entries) === 'how do I plan the raise?')
}

if (failures) {
  console.error(`\n${failures} CHAT TEST(S) FAILED`)
  process.exit(1)
}
console.log('\nALL CHAT TESTS PASSED')
