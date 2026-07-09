/**
 * Tests for the coaching engine's pure core — triage, model routing, prompt
 * assembly, and the local memory (theme ledger + commitment chain).
 * Run: npm run test:coach
 */
import { triage, routeModel, buildDailyUser, extractJson, type MemoryIn } from '../supabase/functions/coach/logic'
import { dailySystem } from '../supabase/functions/coach/prompts'
import { curate, recordCommitment, applyMemo, mergeWeeklyDelta } from '../src/lib/coachMemory'
import { emptyCoachMemory } from '../src/lib/types'
import type { CoachMemory, Emotion, Entry } from '../src/lib/types'

let fails = 0
const ok = (name: string, cond: boolean) => {
  if (!cond) { fails++; console.log('FAIL:', name) } else console.log('pass:', name)
}

const En = (o: Partial<{ event: string; emotions: Emotion[]; well: string; next: string }>) => ({
  event: o.event ?? 'x', emotions: o.emotions ?? [], well: o.well ?? 'y', next: o.next ?? 'z',
})
const NOMEM: MemoryIn = {}

// ---------- triage: the research priority order ----------
ok('triage rumination (why-spiral)',
  triage(En({ event: 'why do i keep shipping late', emotions: ['Focused'] }), NOMEM).primary === 'rumination')
ok('triage distancing (charged)',
  triage(En({ event: 'hard investor call', emotions: ['Frustrated'] }), NOMEM).primary === 'distancing')
ok('triage pattern (theme echo)',
  triage(En({ event: 'the investor call again', emotions: ['Focused'] }),
    { themes: [{ key: 'investor', count: 3, first: 'a', last: 'b' }] }).primary === 'pattern')
ok('triage fear_setting (avoided decision)',
  triage(En({ event: 'i keep putting off the cofounder conversation', emotions: ['Calm'] }), NOMEM).primary === 'fear_setting')
ok('triage agency (blank well)',
  triage(En({ event: 'shipped the build', emotions: ['Proud'], well: '' }), NOMEM).primary === 'agency')
ok('triage celebration (clean win)',
  triage(En({ event: 'closed the round', emotions: ['Proud'], well: 'i prepared hard' }), NOMEM).primary === 'celebration')
ok('triage accountability (owed, else nothing)',
  triage(En({ event: 'quiet admin day', emotions: ['Focused'], well: 'cleared the inbox' }),
    { openCommitment: { text: 'email the lawyer', date: '2026-07-01' } }).primary === 'accountability')
ok('triage followup (plain)',
  triage(En({ event: 'quiet admin day', emotions: ['Focused'], well: 'cleared the inbox' }), NOMEM).primary === 'followup')

// ---------- model routing: different models for different feedback ----------
ok('route charged → opus',
  routeModel(triage(En({ emotions: ['Overwhelmed'] }), NOMEM)).model === 'claude-opus-4-8')
ok('route standard → sonnet',
  routeModel(triage(En({ event: 'shipped', emotions: ['Proud'], well: '' }), NOMEM)).model === 'claude-sonnet-5')
ok('route light → haiku',
  routeModel(triage(En({ event: 'calm admin day', emotions: ['Focused'], well: 'inbox zero' }), NOMEM)).model === 'claude-haiku-4-5')

// ---------- prompt assembly: the right expert loads ----------
ok('daily prompt loads the distancing module',
  dailySystem(NOMEM, triage(En({ emotions: ['Frustrated'] }), NOMEM)).includes('SELF-DISTANCING'))
ok('daily prompt loads the rumination module',
  dailySystem(NOMEM, triage(En({ event: 'why am i like this', emotions: ['Focused'] }), NOMEM)).includes('RUMINATION'))
ok('daily prompt mirrors a known voice',
  dailySystem({ voice: 'terse, lowercase, dry' }, triage(En({}), NOMEM)).includes('terse, lowercase, dry'))
ok('daily prompt adds an owed-intention clause',
  dailySystem({ openCommitment: { text: 'call the lawyer', date: 'x' } },
    triage(En({ event: 'good day', emotions: ['Calm'], well: 'shipped' }),
      { openCommitment: { text: 'call the lawyer', date: 'x' } })).includes('OWED intention'))

// ---------- user data block ----------
{
  const u = buildDailyUser('David', En({}),
    [{ date: '2026-07-01', event: 'e', emotions: ['Calm'], well: 'w', next: 'n' }],
    [{ date: '2026-06-01', event: 'old investor thing' }],
    { openCommitment: { text: 'ship it', date: '2026-07-08' }, themes: [{ key: 'investor', count: 2, first: 'a', last: 'b' }] })
  ok('daily user block has OWED / EARLIER / RECURRING', u.includes('OWED') && u.includes('EARLIER') && u.includes('RECURRING'))
}

// ---------- extractJson robustness ----------
ok('extractJson parses clean', (extractJson<{ a: number }>('{"a":1}')?.a) === 1)
ok('extractJson digs out embedded', (extractJson<{ a: number }>('noise {"a":2} tail')?.a) === 2)
ok('extractJson returns null on junk', extractJson('not json at all') === null)

// ---------- local memory: theme ledger + commitment chain ----------
const E = (date: string, o: Partial<Entry> = {}): Entry => ({
  id: date, date, event: o.event ?? 'x', emotions: o.emotions ?? [],
  well: o.well ?? 'y', next: o.next ?? 'z', ts: new Date(`${date}T20:00:00`).getTime(), ...o,
})

// curate: recency window + long-ago recall by live theme
{
  const entries = Array.from({ length: 10 }, (_, i) => E(`2026-07-${String(20 - i).padStart(2, '0')}`, {
    event: i === 9 ? 'the investor sync ran long' : `night ${i}`,
  }))
  const mem: CoachMemory = { profile: {}, themes: [{ key: 'investor', count: 4, first: 'a', last: 'b' }], commitments: [] }
  const c = curate(entries, mem)
  ok('curate keeps 8 recent', c.history.length === 8)
  ok('curate recalls an older themed night', c.recall.some((r) => r.event.includes('investor')))
}

// commitment chain: record tonight, resolve it next night
{
  let m = emptyCoachMemory()
  m = recordCommitment(m, E('2026-07-08', { next: 'email the lawyer' }), '2026-07-08')
  ok('recordCommitment opens tonight’s intention', curate([], m).memory.openCommitment?.text === 'email the lawyer')

  // next night, Coach reports it kept → resolve owed BEFORE recording the new one
  m = applyMemo(m, { commitment: 'kept', themes: ['legal'], voiceHint: 'dry and terse' }, '2026-07-09', true)
  ok('applyMemo resolves the owed intention', m.commitments.find((c) => c.text === 'email the lawyer')?.status === 'kept')
  ok('applyMemo folds a theme', m.themes.some((t) => t.key === 'legal'))
  ok('applyMemo learns the voice', m.profile.voice === 'dry and terse')
  m = recordCommitment(m, E('2026-07-09', { next: 'draft the deck' }), '2026-07-09')
  ok('new intention becomes the open one', curate([], m).memory.openCommitment?.text === 'draft the deck')
}

// deferred replies must NOT resolve a newer intention
{
  let m = recordCommitment(emptyCoachMemory(), E('2026-07-09', { next: 'draft the deck' }), '2026-07-09')
  m = applyMemo(m, { commitment: 'kept' }, '2026-07-10', false) // resolveCommitment=false
  ok('deferred reply leaves the open intention open', m.commitments.find((c) => c.text === 'draft the deck')?.status === 'open')
}

// theme ledger is bounded
{
  let m = emptyCoachMemory()
  for (let i = 0; i < 40; i++) m = applyMemo(m, { themes: [`t${i}`] }, '2026-07-10', false)
  ok('theme ledger capped at 24', m.themes.length <= 24)
}

// weekly delta merges + caps
{
  let m = emptyCoachMemory()
  m = mergeWeeklyDelta(m, {
    voice: 'clipped, technical',
    values: ['craft', 'speed'],
    goals: Array.from({ length: 20 }, (_, i) => `g${i}`),
  }, '2026-07-10')
  ok('weekly delta sets voice', m.profile.voice === 'clipped, technical')
  ok('weekly delta caps a list at 8', (m.profile.goals?.length ?? 0) === 8)
}

console.log(fails ? `\n${fails} FAILURES` : '\nALL COACH TESTS PASSED')
process.exit(fails ? 1 : 0)
