/**
 * Tests for the monotonic Night engine.
 * Run: npm test
 */
import { applyEntry, daysBetween, mergeEntries, migrateGame, nightsFromEntries, todayStr, weekCount } from '../src/lib/game'
import { needsComeback } from '../src/lib/morning'
import { stoneForNight } from '../src/lib/milestones'
import type { Emotion, Entry, GameState } from '../src/lib/types'

const E = (date: string): Entry => ({
  id: date,
  date,
  event: 'x',
  emotions: ['Calm'] as Emotion[],
  well: 'y',
  next: 'z',
  ts: new Date(`${date}T12:00:00`).getTime(),
})

const G = (over: Partial<GameState> = {}): GameState => ({ nights: 0, lastDay: null, ...over })

let fails = 0
const ok = (name: string, cond: boolean) => {
  if (!cond) { fails++; console.log('FAIL:', name) } else console.log('pass:', name)
}

ok('daysBetween one day', daysBetween('2026-07-01', '2026-07-02') === 1)
ok('daysBetween handles a long gap', daysBetween('2026-07-01', '2026-07-30') === 29)

let r = applyEntry(G(), E('2026-07-01'))
ok('first reflection creates Night 1', r.game.nights === 1 && r.addedNight)
ok('first reflection records its day', r.game.lastDay === '2026-07-01')

r = applyEntry(G({ nights: 3, lastDay: '2026-07-01' }), E('2026-07-02'))
ok('next-day reflection increments Night', r.game.nights === 4 && r.addedNight)

r = applyEntry(G({ nights: 4, lastDay: '2026-07-02' }), E('2026-07-02'))
ok('same-day second entry does not increment', r.game.nights === 4 && !r.addedNight)
ok('same-day second entry keeps its original day', r.game.lastDay === '2026-07-02')

r = applyEntry(G({ nights: 9, lastDay: '2026-07-01' }), E('2026-07-03'))
ok('one missed day does not reset Night', r.game.nights === 10 && r.addedNight)

r = applyEntry(G({ nights: 29, lastDay: '2026-07-01' }), E('2026-07-30'))
ok('a long gap only pauses progress', r.game.nights === 30 && r.addedNight)
ok('a long gap updates the last reflected day', r.game.lastDay === '2026-07-30')

const migratedBest = migrateGame({ xp: 80, level: 2, streak: 12, best: 29, freezes: 0, lastDay: '2026-07-01' }, 100)
ok('migration preserves the highest historic Night', migratedBest.nights === 29)
ok('migration preserves the last reflected day', migratedBest.lastDay === '2026-07-01')
ok('migration drops legacy progression fields', !('xp' in migratedBest) && !('level' in migratedBest) && !('streak' in migratedBest) && !('best' in migratedBest) && !('freezes' in migratedBest))

const migratedCorrupt = migrateGame({ streak: 31, best: 28, lastDay: '2026-07-01' }, 29)
ok('migration takes the maximum when legacy values disagree', migratedCorrupt.nights === 31)
ok('migration keeps a current Night over stale legacy values', migrateGame({ nights: 45, streak: 10, best: 30 }, 30).nights === 45)
ok('modern state ignores extra same-day entries on reload', migrateGame({ nights: 1 }, 3).nights === 1)

ok('Night 7 is Ember', stoneForNight(7)?.name === 'Ember')
ok('Night 30 is Tide', stoneForNight(30)?.name === 'Tide')
ok('non-milestone Nights do not fire a stone', stoneForNight(29) === null)

const beforeComeback = G({ nights: 29, lastDay: '2026-07-07' })
const returnDay = '2026-07-10'
ok('two missed nights trigger a comeback', needsComeback(beforeComeback.lastDay, returnDay, null))
ok('one missed night does not trigger a comeback', !needsComeback('2026-07-08', returnDay, null))
const returned = applyEntry(beforeComeback, E(returnDay))
ok('a comeback reflection reaches Night 30', returned.game.nights === 30 && stoneForNight(returned.game.nights)?.name === 'Tide')
ok('a comeback clears after the reflection submits', !needsComeback(returned.game.lastDay, returnDay, beforeComeback.lastDay))

const now = Date.now()
ok('weekCount counts the trailing seven days', weekCount([
  { ...E('a'), ts: now - 1 * 86400000 },
  { ...E('b'), ts: now - 3 * 86400000 },
  { ...E('c'), ts: now - 30 * 86400000 },
]) === 2)
ok('todayStr returns an ISO date', /^\d{4}-\d{2}-\d{2}$/.test(todayStr()))

// ---- sign-in recovery: merging a device's nights with an account's own ----
ok('nightsFromEntries counts distinct dates', nightsFromEntries([E('2026-07-01'), E('2026-07-02'), E('2026-07-02')]).nights === 2)
ok('nightsFromEntries lastDay is the latest date', nightsFromEntries([E('2026-07-02'), E('2026-07-05'), E('2026-07-01')]).lastDay === '2026-07-05')
ok('nightsFromEntries on an empty history', nightsFromEntries([]).nights === 0 && nightsFromEntries([]).lastDay === null)

const localOnly = [{ ...E('2026-07-05'), id: 'local-1' }]
const remote = [{ ...E('2026-07-01'), id: 'remote-1' }, { ...E('2026-07-03'), id: 'remote-2' }]
const merged = mergeEntries(localOnly, remote)
ok('mergeEntries unions both sides', merged.length === 3)
ok('mergeEntries keeps the device’s own unsynced entry', merged.some((e) => e.id === 'local-1'))
ok('mergeEntries brings in the account’s remote nights', merged.every((e) => ['local-1', 'remote-1', 'remote-2'].includes(e.id)))
ok('mergeEntries sorts newest first, like the rest of state', merged[0].id === 'local-1')
const dupe = mergeEntries([{ ...E('2026-07-05'), id: 'same', ts: 5 }], [{ ...E('2026-07-05'), id: 'same', ts: 999 }])
ok('mergeEntries never duplicates a shared id', dupe.length === 1 && dupe[0].ts === 5)
ok('a fresh device recovers a whole account’s history by id union', nightsFromEntries(mergeEntries([], remote)).nights === 2)

console.log(fails ? `\n${fails} FAILURES` : '\nALL TESTS PASSED')
process.exit(fails ? 1 : 0)
