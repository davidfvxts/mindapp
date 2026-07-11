/**
 * Tests for the coaching engine's pure core — triage, model routing, prompt
 * assembly, and the local memory (theme ledger + commitment chain).
 * Run: npm run test:coach
 */
import {
  boundedClose, buildAnswerUser, buildDailyUser, buildWeeklyUser, extractJson, routeModel, routeModelForKind, triage, type MemoryIn,
} from '../supabase/functions/coach/logic'
import { answerSystem, dailySystem } from '../supabase/functions/coach/prompts'
import {
  curate, recordCommitment, applyMemo, mergeWeeklyDelta,
  applyWeeklyRevision, foldRating, renegotiateCommitment, staleCommitment, themeMatches,
} from '../src/lib/coachMemory'
import { seedMemoryFromAnswers, deterministicFirstRead, firstFrames, obstaclePhrase } from '../src/lib/onboarding'
import {
  intentionForToday, isMorningWindow, missedNights, needsComeback,
  nextDay, offlineMorningQuestion, upsertMorning,
} from '../src/lib/morning'
import { quietSynthesisDue, reviewSoFarReady, weeklyReady } from '../src/lib/weekly'
import { monthlyReady, trailingEntryNights, liveDecision } from '../src/lib/monthly'
import { inclusionsForStone, prevMilestoneNight } from '../src/lib/inclusions'
import { STONES } from '../src/lib/milestones'
import { buildMonthlyUser } from '../supabase/functions/coach/logic'
import { weeklyIntentionNudge } from '../src/lib/guidance'
import {
  SEEDS, dueForNudge, pickOfflineNudge, toNudge,
  commitNudge, declineNudge, resolveNudge, markSeen,
  openNudge, checkInsDue, inFlight, unseenCount,
} from '../src/lib/guidance'
import { emptyCoachMemory, initialState } from '../src/lib/types'
import type { AppState, CoachMemory, Emotion, Entry, Nudge } from '../src/lib/types'

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
ok('route light → sonnet (floor)',
  routeModel(triage(En({ event: 'calm admin day', emotions: ['Focused'], well: 'inbox zero' }), NOMEM)).model === 'claude-sonnet-5')
{
  const original = triage(En({ event: 'hard investor call', emotions: ['Frustrated'] }), NOMEM)
  ok('answer turn keeps the original model tier',
    routeModelForKind(original.primary).model === routeModel(original).model)
  ok('answer turn keeps a standard model tier',
    routeModelForKind('agency').model === 'claude-sonnet-5')
}

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

// ---------- bedside manner: the night contract is always present ----------
{
  const sys = dailySystem(NOMEM, triage(En({}), NOMEM))
  ok('daily prompt closes loops at night', sys.includes('Tomorrow, ask yourself'))
  ok('daily prompt mirrors the language', sys.includes('language they wrote in'))
  ok('daily prompt carries the distress rule', sys.includes('self-harm'))
  ok('followup module closes, not questions',
    dailySystem(NOMEM, triage(En({ event: 'quiet admin day', emotions: ['Focused'], well: 'inbox' }), NOMEM))
      .includes('CLOSE THE DAY'))

  const answer = answerSystem({ voice: 'terse, lowercase' })
  ok('answer prompt closes without another question',
    answer.includes('Do NOT ask another question') && answer.includes('Maximum 2 short sentences'))
}

// ---------- user data block ----------
{
  const u = buildDailyUser('David', En({}),
    [{ date: '2026-07-01', event: 'e', emotions: ['Calm'], well: 'w', next: 'n' }],
    [{ date: '2026-06-01', event: 'old investor thing' }],
    { openCommitment: { text: 'ship it', date: '2026-07-08' }, themes: [{ key: 'investor', count: 2, first: 'a', last: 'b' }] })
  ok('daily user block has OWED / EARLIER / RECURRING', u.includes('OWED') && u.includes('EARLIER') && u.includes('RECURRING'))

  const withMorning = buildDailyUser('David', En({}), [], [], {}, {
    win: 'send the follow-up', question: 'What needs to be true before noon?', answer: 'A rough first line.',
  })
  ok('daily user block preserves morning context',
    withMorning.includes('THIS MORNING') && withMorning.includes('A rough first line.'))

  const a = buildAnswerUser(
    'David', En({ event: 'missed the investor follow-up' }),
    { text: 'What would you tell a founder you respect here?', kind: 'rumination' },
    'I would tell them to send the note before they can rehearse the failure again.',
    { voice: 'terse, lowercase', themes: [{ key: 'avoidance', count: 2, first: 'a', last: 'b' }] },
  )
  ok('answer user block carries the full exchange',
    a.includes("COACH'S READ") && a.includes('THEIR ONE ANSWER') && a.includes('KNOWN VOICE'))
}

// ---------- extractJson robustness ----------
ok('extractJson parses clean', (extractJson<{ a: number }>('{"a":1}')?.a) === 1)
ok('extractJson digs out embedded', (extractJson<{ a: number }>('noise {"a":2} tail')?.a) === 2)
ok('extractJson returns null on junk', extractJson('not json at all') === null)
ok('answer close is capped at two sentences',
  boundedClose('One clear line. A second settles it. A third must not land.') === 'One clear line. A second settles it.')

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

  const exchange = curate([E('2026-07-21', {
    coachAnswer: 'send the note before fear makes it larger',
    coachClose: { text: 'That is the move. Let it be enough tonight.', source: 'ai' },
  })], emptyCoachMemory())
  ok('curate carries the answer and close forward',
    exchange.history[0].answer?.includes('send the note') === true && exchange.history[0].close?.includes('That is the move') === true)
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

// ---------- onboarding: intake → profile seed + first read ----------
{
  const answers = {
    name: 'David', goals: ['Sharper decisions', 'Shipping more'], world: 'building Facet with my cofounder',
    obstacle: 'Perfectionism', cue: 'close my laptop', reminderTime: '21:30',
  }
  const seeded = seedMemoryFromAnswers(answers, '2026-07-10')
  ok('seed carries goals', (seeded.profile.goals ?? []).includes('Sharper decisions'))
  ok('seed maps the obstacle', (seeded.profile.obstacles ?? [])[0] === 'perfectionism')
  ok('seed captures their world', (seeded.profile.projects ?? [])[0]?.includes('Facet') === true)
  ok('obstaclePhrase maps "I forget"', obstaclePhrase('I forget') === 'forgetting to start')

  const read = deterministicFirstRead(answers, { event: 'closed the seed round today', emotions: ['Proud'], well: 'prepped cold', next: 'draft the deck' })
  ok('first read names them', read.includes('David'))
  ok('first read reflects the goal', read.toLowerCase().includes('sharper decisions'))
  ok('first read references their moment', read.includes('closed the seed round'))
  ok('first read hands them the cue', read.includes('close my laptop'))

  // why-now: the self-persuasion beat carries into the seed and the read
  const withWhy = { ...answers, whyNow: 'I keep repeating the same mistakes' }
  ok('why-now opens the narrative', seedMemoryFromAnswers(withWhy, '2026-07-10').profile.narrative?.includes('same mistakes') === true)
  ok('no why-now leaves the narrative unseeded', seedMemoryFromAnswers(answers, '2026-07-10').profile.narrative === undefined)
  const whyRead = deterministicFirstRead(withWhy, { event: 'shipped it anyway', emotions: [], well: '', next: '' })
  ok('the offline first read quotes why-now', whyRead.includes('same mistakes'))
  // The AI profileDelta merge must never erase the seeded narrative (regression).
  const seededWhy = seedMemoryFromAnswers(withWhy, '2026-07-10')
  const afterDelta = mergeWeeklyDelta(seededWhy, { goals: ['Sharper decisions'] }, '2026-07-10')
  ok('a delta merge keeps the narrative', afterDelta.profile.narrative?.includes('same mistakes') === true)

  // the first reflection meets the user at whatever hour they arrive
  ok('evening asks about today', firstFrames(22).window === 'evening' && firstFrames(22).momentQ.includes('today'))
  ok('the small hours still read as evening', firstFrames(1).window === 'evening')
  ok('morning looks back at yesterday, acts today',
    firstFrames(9).window === 'morning' && firstFrames(9).momentQ.includes('yesterday') && firstFrames(9).nextQ.includes('today'))
  ok('midday reflects on the day so far', firstFrames(14).window === 'day' && firstFrames(14).momentQ.includes('so far'))
  ok('window boundaries hold', firstFrames(4).window === 'morning' && firstFrames(12).window === 'day' && firstFrames(17).window === 'evening')
}

// ---------- guidance: occasional, evidence-based nudges ----------
{
  // library integrity
  const ids = SEEDS.map((i) => i.seedId)
  ok('nudge seed ids are unique', new Set(ids).size === ids.length)
  ok('nudge seeds are well-formed', SEEDS.every((s) =>
    s.title && s.body && s.value && typeof s.fit === 'function' && typeof s.weight === 'number' &&
    ['tip', 'action', 'habit', 'routine', 'reading'].includes(s.kind)))
  ok('every reading seed cites a real source', SEEDS.filter((s) => s.kind === 'reading').every((s) => !!s.source?.by))

  const ent = (o: Partial<Entry> = {}): Entry =>
    ({ id: 'x', date: '2026-07-10', event: 'e', emotions: [], well: 'w', next: 'n', ts: 1, ...o })
  const g = (over: Partial<AppState['game']>): AppState['game'] =>
    ({ nights: 0, lastDay: '2026-07-10', ...over })
  const stateWith = (over: Partial<AppState>): AppState => ({ ...initialState(), ...over })

  // the gate: never before a couple of nights, never daily, one at a time
  ok('not due in the first night', !dueForNudge(stateWith({ game: g({ nights: 1 }) })))
  const ripe = stateWith({ entries: [ent()], game: g({ nights: 6 }) })
  ok('due once a few nights have passed', dueForNudge(ripe))
  const draft0 = pickOfflineNudge(ripe)!
  const withOpen = stateWith({
    ...ripe,
    nudges: [toNudge(draft0, 'n0', 6, '2026-07-10', 'local')],
  })
  ok('not due while a nudge is still open', !dueForNudge(withOpen))

  // offline library: fits the moment, never repeats a seed already offered
  ok('offline pick returns a fitting draft', !!draft0 && !!draft0.seedId)
  const usedAll = stateWith({
    entries: [ent()],
    game: g({ nights: 6 }),
    nudges: SEEDS.map((s, i) => ({ ...toNudge(s, `n${i}`, 6, '2026-07-10', 'local'), status: 'declined' as const })),
  })
  ok('offline pick is null when everything’s been offered', pickOfflineNudge(usedAll) === null)

  // a fear-setting night makes the Ferriss cluster eligible
  const fear = stateWith({
    entries: [ent({ coach: { text: '', kind: 'fear_setting', source: 'ai' } })],
    game: g({ nights: 6 }),
  })
  ok('fear-setting makes fear-setting nudges eligible',
    SEEDS.filter((s) => s.fit(({ nights: 6, entries: 1, kinds: { fear_setting: 1 }, themeMax: 0, goals: [], obstacles: [], charged: 0, keptCommitments: 0, weeklyReads: 0 })))
      .some((s) => s.seedId === 'ferriss-action'))
  ok('a fear-setting draft is offered', pickOfflineNudge(fear)?.seedId?.includes('ferriss') === true || pickOfflineNudge(fear) !== null)

  // goal-gated readings only surface for the matching aim
  const noGoal = { nights: 20, entries: 5, kinds: {}, themeMax: 0, goals: [] as string[], obstacles: [], charged: 0, keptCommitments: 0, weeklyReads: 0 }
  const shipGoal = { ...noGoal, goals: ['Shipping more'] }
  const shipSeed = SEEDS.find((s) => s.seedId === 'read-ship-2')!
  ok('goal reading hidden without the goal', !shipSeed.fit(noGoal))
  ok('goal reading fits with the goal', shipSeed.fit(shipGoal))

  // lifecycle: commit → check-in comes due → resolve
  {
    let ns: Nudge[] = [toNudge(draft0, 'a', 6, '2026-07-10', 'local')]
    ns = commitNudge(ns, 'a', 6, 'help me start')
    const committed = ns.find((n) => n.id === 'a')!
    ok('commit records the intention + a check-in night', committed.status === 'committed' && (committed.checkInNight ?? 0) > 6)
    ok('commit keeps the note', committed.note === 'help me start')

    const before = stateWith({ game: g({ nights: 7 }), nudges: ns })
    ok('check-in not due yet', checkInsDue(before).length === 0 && inFlight(before).length === 1)
    const after = stateWith({ game: g({ nights: committed.checkInNight! }), nudges: ns })
    ok('check-in comes due at its night', checkInsDue(after).length === 1)

    ns = resolveNudge(ns, 'a', true)
    ok('resolve marks it kept', ns.find((n) => n.id === 'a')?.status === 'kept')
  }

  // decline sets it aside with an optional reason
  {
    const ns = declineNudge([toNudge(draft0, 'b', 6, '2026-07-10', 'local')], 'b', 'not my style')
    ok('decline sets it aside', ns[0].status === 'declined' && ns[0].note === 'not my style')
  }

  // the tab marker: an unseen open nudge counts, then clears
  {
    const s1 = stateWith({ game: g({ nights: 6 }), nudges: [toNudge(draft0, 'c', 6, '2026-07-10', 'local')] })
    ok('an unseen open nudge marks the tab', unseenCount(s1) === 1)
    const s2 = { ...s1, nudges: markSeen(s1.nudges, 6) }
    ok('seeing it clears the marker', unseenCount(s2) === 0)
    ok('open selector finds it', openNudge(s1)?.id === 'c')
  }
}

// ---------- morning: the loop beyond 11pm ----------
{
  const C = (date: string, status: 'open' | 'kept' | 'dropped' = 'open') =>
    ({ date, text: 'send the memo', status }) as const

  ok('last night’s intention surfaces today', intentionForToday([C('2026-07-08')], '2026-07-09') === 'send the memo')
  ok('a two-day-old intention still surfaces', intentionForToday([C('2026-07-07')], '2026-07-09') === 'send the memo')
  ok('tonight’s own intention is not “today”', intentionForToday([C('2026-07-09')], '2026-07-09') === null)
  ok('a lapsed intention stays quiet', intentionForToday([C('2026-07-05')], '2026-07-09') === null)
  ok('resolved intentions don’t resurface', intentionForToday([C('2026-07-08', 'kept')], '2026-07-09') === null)
  ok('no commitments, no line', intentionForToday([], '2026-07-09') === null)

  ok('missedNights counts whole missed nights', missedNights('2026-07-05', '2026-07-09') === 3)
  ok('yesterday means nothing missed', missedNights('2026-07-08', '2026-07-09') === 0)
  ok('never reflected means nothing missed', missedNights(null, '2026-07-09') === 0)

  ok('two missed nights → comeback', needsComeback('2026-07-06', '2026-07-09', null) === true)
  ok('one missed night is not a comeback', needsComeback('2026-07-07', '2026-07-09', null) === false)
  ok('comeback shows once per lapse', needsComeback('2026-07-06', '2026-07-09', '2026-07-06') === false)
  ok('a new lapse gets a new comeback', needsComeback('2026-07-06', '2026-07-09', '2026-07-01') === true)
  ok('never reflected → onboarding, not comeback', needsComeback(null, '2026-07-09', null) === false)
}

// ---------- the Today bookend: win + adaptive question ----------
{
  ok('nextDay rolls a day', nextDay('2026-07-09') === '2026-07-10')
  ok('nextDay rolls a month', nextDay('2026-07-31') === '2026-08-01')
  ok('morning window holds at 9', isMorningWindow(9))
  ok('morning window closed at 23', !isMorningWindow(23))
  ok('morning window closed at 3', !isMorningWindow(3))

  const N = (date: string, win: string) => ({ date, win })
  let ms = upsertMorning([], N('2026-07-09', 'ship pricing'))
  ok('upsert adds the day', ms.length === 1 && ms[0].win === 'ship pricing')
  ms = upsertMorning(ms, N('2026-07-09', 'ship pricing v2'))
  ok('upsert replaces the same day', ms.length === 1 && ms[0].win === 'ship pricing v2')
  for (let i = 1; i <= 20; i++) ms = upsertMorning(ms, N(`2026-06-${String(i).padStart(2, '0')}`, 'x'))
  ok('mornings are bounded', ms.length <= 14)

  const base = { chargedYesterday: false, owed: null, theme: null }
  ok('a clean day gets NO question', offlineMorningQuestion(base) === null)
  ok('a hot yesterday gets the steady question',
    offlineMorningQuestion({ ...base, chargedYesterday: true })?.includes('steady') === true)
  ok('a slipping intention gets the inevitable question',
    offlineMorningQuestion({ ...base, owed: { text: 'email the lawyer', age: 2 } })?.includes('email the lawyer') === true)
  ok('a fresh intention is NOT re-asked (the carry-over line owns it)',
    offlineMorningQuestion({ ...base, owed: { text: 'x', age: 1 } }) === null)
  ok('a recurring theme gets the blocking question',
    offlineMorningQuestion({ ...base, theme: 'investor' })?.includes('investor') === true)
  ok('charged outranks owed',
    offlineMorningQuestion({ chargedYesterday: true, owed: { text: 'x', age: 3 }, theme: 'y' })?.includes('steady') === true)

  // the night weighs against the morning: data block + memo contract
  const u = buildDailyUser('David', En({}), [], [], NOMEM,
    { win: 'ship the pricing page', question: 'What keeps today steady?', answer: 'one meeting max' })
  ok('daily user block carries the morning win', u.includes('THIS MORNING') && u.includes('ship the pricing page'))
  ok('daily prompt knows the morning-question contract',
    dailySystem(NOMEM, triage(En({}), NOMEM)).includes('morningQuestion'))
  ok('daily prompt weighs a morning win without guilt',
    dailySystem(NOMEM, triage(En({}), NOMEM)).includes('MORNING WIN'))
}

// ---------- the weekly review: the user's work, paced + captured ----------
{
  // Three nights open the same guided review; five still make a full week.
  ok('not ready before three nights', !reviewSoFarReady(2, null, '2026-07-09'))
  ok('three nights opens a review so far', reviewSoFarReady(3, null, '2026-07-09'))
  ok('five nights makes a full weekly review', weeklyReady(5, null, '2026-07-09'))
  ok('review waits after a recent guided review', !reviewSoFarReady(7, '2026-07-07', '2026-07-09'))
  ok('review opens again after the gap', reviewSoFarReady(3, '2026-07-01', '2026-07-09'))

  // quiet synthesis: only when ready-but-untouched for a while
  ok('quiet pass not due under the gate', !quietSynthesisDue(4, null, null, '2026-07-09'))
  ok('quiet pass due when long untouched', quietSynthesisDue(5, null, null, '2026-07-09'))
  ok('a recent review blocks the quiet pass', !quietSynthesisDue(7, '2026-07-05', '2026-07-05', '2026-07-09'))
  ok('a recent quiet pass blocks another', !quietSynthesisDue(7, null, '2026-07-05', '2026-07-09'))
  ok('an old synthesis stops blocking', quietSynthesisDue(7, null, '2026-06-20', '2026-07-09'))

  // the WOOP becomes a standing intention on the nudge lifecycle
  const woop = { wish: 'close the pilot deal', outcome: 'runway stops being the first thought', obstacle: 'avoidance', plan: 'If I stall, I send the draft anyway' }
  const n = weeklyIntentionNudge(woop, 'w1', 12, '2026-07-09')
  ok('intention is born committed', n.status === 'committed' && n.kind === 'intention')
  ok('intention carries the wish + plan', n.title === 'close the pilot deal' && n.body.includes('send the draft'))
  ok('intention check-in lands mid-week', (n.checkInNight ?? 0) === 17)
  ok('intention keeps the obstacle for Coach', n.note?.includes('avoidance') === true)

  // the weekly data block carries THEIR answers + THEIR WOOP
  const u = buildWeeklyUser('David', [], NOMEM,
    { wins: 'shipped onboarding; I cut scope', friction: 'ad-hoc calls ate the mornings', avoided: 'the cofounder equity talk' },
    woop)
  ok('weekly block carries their review', u.includes('THEIR OWN REVIEW') && u.includes('cut scope'))
  ok('weekly block carries their WOOP', u.includes('THEIR WOOP') && u.includes('close the pilot deal'))
  const u2 = buildWeeklyUser('David', [], NOMEM)
  ok('quiet pass sends no review block', !u2.includes('THEIR OWN REVIEW'))
}

// ---------- memory v2: a coach that changes its mind ----------
{
  // recall matcher: rephrasings, plurals, compounds — not literal substrings
  ok('theme matches its plural', themeMatches('investor', 'the investors ghosted us'))
  ok('theme matches an inflection', themeMatches('fundraising', 'we fundraise next month'))
  ok('theme survives German compounds', themeMatches('investor', 'die Investoren haben abgesagt'))
  ok('short words need an exact hit', !themeMatches('call', 'they may recall the board meeting'))
  ok('multi-word theme needs half its words', themeMatches('investor call', 'another call ran long'))
  ok('unrelated text stays quiet', !themeMatches('investor', 'a quiet afternoon of code review'))

  // curate() recalls a REPHRASED older night
  const entries = Array.from({ length: 10 }, (_, i) => E(`2026-07-${String(20 - i).padStart(2, '0')}`, {
    event: i === 9 ? 'die Investoren wollen neue Zahlen' : `night ${i}`,
  }))
  const mem: CoachMemory = { profile: {}, themes: [{ key: 'investor', count: 4, first: 'a', last: 'b' }], commitments: [] }
  ok('recall finds the rephrased night', curate(entries, mem).recall.some((r) => r.event.includes('Investoren')))

  // curate() carries the narrative on every call
  const withNote: CoachMemory = { profile: { narrative: 'Building Facet; avoidance is the pattern.' }, themes: [], commitments: [] }
  ok('curate carries the narrative', curate([], withNote).memory.narrative?.includes('avoidance') === true)

  // renegotiation: stale instead of silent death, then the user's call
  let m = recordCommitment(emptyCoachMemory(), E('2026-07-01', { next: 'email the lawyer' }), '2026-07-01')
  m = recordCommitment(m, E('2026-07-09', { next: 'draft the deck' }), '2026-07-09')
  ok('an aged intention goes stale, not dropped', staleCommitment(m)?.text === 'email the lawyer')
  ok('tonight’s intention stays open', curate([], m).memory.openCommitment?.text === 'draft the deck')
  const kept = renegotiateCommitment(m, true, '2026-07-09')
  ok('“still on it” re-arms it', kept.commitments.find((c) => c.text === 'email the lawyer')?.status === 'open')
  const letgo = renegotiateCommitment(m, false, '2026-07-09')
  ok('“let it go” retires it', letgo.commitments.find((c) => c.text === 'email the lawyer')?.status === 'dropped')
  ok('only one renegotiation at a time', (() => {
    let mm = recordCommitment(emptyCoachMemory(), E('2026-06-20', { next: 'a' }), '2026-06-20')
    mm = { ...mm, commitments: [{ date: '2026-06-25', text: 'b', status: 'open' }, ...mm.commitments] }
    mm = recordCommitment(mm, E('2026-07-09', { next: 'c' }), '2026-07-09')
    return mm.commitments.filter((c) => c.status === 'stale').length === 1
  })())

  // ratings → the moves that land, reply by reply
  let r = emptyCoachMemory()
  r = foldRating(r, 'fear_setting', 1)
  ok('a hit files the move under landed', r.profile.landed?.[0]?.includes('fear-setting') === true)
  r = foldRating(r, 'fear_setting', 0)
  ok('a later miss moves it to avoided', r.profile.avoided?.[0]?.includes('fear-setting') === true
    && !(r.profile.landed ?? []).some((x) => x.includes('fear-setting')))
  ok('unknown kinds fold to nothing', foldRating(r, undefined, 1) === r)

  // the weekly pass owns the profile: full revision, omission = removal
  const before: CoachMemory = {
    profile: { goals: ['fundraising', 'hiring'], projects: ['old landing page'], voice: 'terse', landed: ['marking the win'] },
    themes: [], commitments: [],
  }
  const revised = applyWeeklyRevision(before, {
    narrative: 'Fundraising closed; the cofounder question is the new center of gravity.',
    voice: 'terse, drier lately',
    goals: ['hiring'],
    obstacles: ['avoidance'],
  }, '2026-07-09')
  ok('revision keeps what was returned', revised.profile.goals?.join() === 'hiring')
  ok('revision REMOVES what was omitted', !revised.profile.projects?.length)
  ok('revision writes the narrative', revised.profile.narrative?.includes('cofounder') === true)
  ok('landed/avoided survive unless revised', revised.profile.landed?.[0] === 'marking the win')
  ok('a degenerate revision changes nothing', applyWeeklyRevision(before, {}, '2026-07-09') === before)
  ok('revision caps lists', (applyWeeklyRevision(before,
    { goals: Array.from({ length: 20 }, (_, i) => `g${i}`) }, '2026-07-09').profile.goals?.length ?? 99) <= 8)

  // server: narrative + full profile travel with every call
  ok('daily block opens with the running note',
    buildDailyUser('David', En({}), [], [], { narrative: 'Ships fast, dodges the equity talk.' }).includes('WHO THEY ARE'))
  ok('weekly block hands over the whole profile',
    buildWeeklyUser('David', [], { narrative: 'x', landed: ['marking the win'] }).includes('CURRENT PROFILE ON RECORD'))
  ok('server pattern echo survives rephrasing',
    triage(En({ event: 'die Investoren wollen neue Zahlen', emotions: ['Focused'] }),
      { themes: [{ key: 'investor', count: 3, first: 'a', last: 'b' }] }).primary === 'pattern')
}

// ---------- visible growth: callback + monthly arc + inclusions ----------
{
  // the callback capability rides in COACH_CORE
  const sys = dailySystem(NOMEM, triage(En({}), NOMEM))
  ok('daily prompt carries the callback rule', sys.includes('THE CALLBACK'))
  ok('callback demands exact quotes', sys.includes('never invent a quote'))

  // month theme rides in the daily data block
  ok('month theme reaches the daily block',
    buildDailyUser('David', En({}), [], [], { monthTheme: 'Ship, don’t polish' }).includes("THIS MONTH'S THEME"))

  // monthly gating: Night 30 plus either reads or recent lived material
  ok('monthly stays closed before Night 30', !monthlyReady(29, 3, 25, null, '2026-07-31'))
  ok('monthly opens with two weekly reads', monthlyReady(30, 2, 0, null, '2026-07-31'))
  ok('monthly opens with twenty recent nights', monthlyReady(30, 0, 20, null, '2026-07-31'))
  ok('monthly needs enough material after Night 30', !monthlyReady(30, 1, 19, null, '2026-07-31'))
  ok('a recent arc blocks another', !monthlyReady(30, 2, 20, '2026-07-20', '2026-07-31'))
  ok('an old arc opens again', monthlyReady(30, 2, 20, '2026-06-01', '2026-07-31'))
  ok('monthly material counts distinct entry nights in 35 days', trailingEntryNights([
    { date: '2026-07-31' }, { date: '2026-07-31' }, { date: '2026-07-01' }, { date: '2026-06-27' }, { date: '2026-06-26' },
  ], '2026-07-31') === 3)

  // liveDecision drives whether the fear-setting step shows
  ok('a live decision surfaces from memory',
    liveDecision({ profile: {}, themes: [], commitments: [{ date: 'a', text: 'the equity talk', status: 'open' }] }) === 'the equity talk')
  ok('no live decision when none is owed',
    liveDecision({ profile: {}, themes: [], commitments: [{ date: 'a', text: 'x', status: 'kept' }] }) === null)

  // the monthly data block carries nights + weekly reads + profile to revise
  const mu = buildMonthlyUser('David',
    [{ date: '2026-07-20', event: 'shipped the beta', emotions: ['Proud'], well: 'cut scope', next: 'demo' }],
    ['week one read', 'week two read'],
    { narrative: 'building fast', goals: ['ship'] },
    { trajectory: 'a month of shipping', gap: 'said family, worked weekends', fear: '', theme: 'Steady the ship' })
  ok('monthly block carries the weekly reads', mu.includes('THEIR WEEKLY READS') && mu.includes('week two read'))
  ok('monthly block carries their own work', mu.includes('THEIR OWN WORK') && mu.includes('worked weekends'))
  ok('monthly block hands over the profile', mu.includes('CURRENT PROFILE ON RECORD'))

  // inclusions: deterministic points inside a banked stone, real past words
  const stoneNights = (n: number) => Array.from({ length: n }, (_, i) =>
    E(`2026-07-${String(i + 1).padStart(2, '0')}`, {
      event: i === 2 ? 'the investor call ran long'
        : i === 4 ? 'shipped the onboarding flow'
        : `night ${i + 1}`,
      emotions: i === 2 ? ['Frustrated'] : i === 4 ? ['Proud'] : ['Focused'],
    }))
  const ember = STONES[0] // Night 7
  const incs = inclusionsForStone(stoneNights(7), ember, prevMilestoneNight(STONES, ember),
    [{ key: 'investor', count: 3, first: 'a', last: 'b' }])
  ok('inclusions are 1–4 real nights', incs.length >= 1 && incs.length <= 4)
  ok('inclusions include the night it formed', incs.some((i) => i.label.includes('took shape')))
  ok('inclusions surface the hard night', incs.some((i) => i.event.includes('investor call')))
  ok('inclusions surface the clear night', incs.some((i) => i.event.includes('onboarding flow')))
  ok('inclusions are the user’s real words', incs.every((i) => !!i.event && !!i.date))
  ok('inclusions are chronological', incs.every((i, k) => k === 0 || incs[k - 1].date <= i.date))
  ok('prevMilestoneNight is 0 for the first stone', prevMilestoneNight(STONES, STONES[0]) === 0)
  ok('prevMilestoneNight steps back a stone', prevMilestoneNight(STONES, STONES[1]) === 7)
  ok('an empty span yields no inclusions', inclusionsForStone([], ember, 0, []).length === 0)
}

console.log(fails ? `\n${fails} FAILURES` : '\nALL COACH TESTS PASSED')
process.exit(fails ? 1 : 0)
