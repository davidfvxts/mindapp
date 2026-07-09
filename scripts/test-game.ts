/**
 * Tests for the habit engine — the heart of the product.
 * Run: npm test
 */
import { applyEntry, daysBetween, todayStr, weekCount, xpForLevel } from '../src/lib/game'
import type { Emotion, Entry, GameState } from '../src/lib/types'

const E = (date: string, full = true): Entry => ({
  id: date,
  date,
  event: 'x',
  emotions: full ? (['Calm'] as Emotion[]) : [],
  well: full ? 'y' : '',
  next: full ? 'z' : '',
  ts: new Date(`${date}T12:00:00`).getTime(),
})

const G = (o: Partial<GameState> = {}): GameState => ({
  xp: 0, level: 1, streak: 0, best: 0, freezes: 1, lastDay: null, ...o,
})

let fails = 0
const ok = (name: string, cond: boolean) => {
  if (!cond) { fails++; console.log('FAIL:', name) } else console.log('pass:', name)
}

ok('daysBetween 1', daysBetween('2026-07-01', '2026-07-02') === 1)
ok('xpForLevel', xpForLevel(1) === 100 && xpForLevel(3) === 300)

let r = applyEntry(G(), E('2026-07-01'), 1)
ok('first entry streak=1', r.game.streak === 1)
ok('full entry gains 35xp', r.gained === 35)
ok('partial entry gains 20xp', applyEntry(G(), E('2026-07-01', false), 1).gained === 20)

r = applyEntry(G({ streak: 3, best: 3, lastDay: '2026-07-01' }), E('2026-07-02'), 4)
ok('consecutive streak=4', r.game.streak === 4 && !r.freezeUsed)
ok('best updated', r.game.best === 4)

// Miss one day, freeze available -> streak survives.
r = applyEntry(G({ streak: 5, best: 5, freezes: 1, lastDay: '2026-07-01' }), E('2026-07-03'), 6)
ok('miss once w/ freeze -> survives', r.game.streak === 6 && r.freezeUsed && r.game.freezes === 0)

// Miss one day, no freeze -> reset.
r = applyEntry(G({ streak: 5, freezes: 0, lastDay: '2026-07-01' }), E('2026-07-03'), 6)
ok('miss once, no freeze -> reset', r.game.streak === 1 && !r.freezeUsed)

// THE CORE RULE: miss twice -> reset, even holding a freeze.
r = applyEntry(G({ streak: 9, best: 9, freezes: 1, lastDay: '2026-07-01' }), E('2026-07-04'), 10)
ok('NEVER MISS TWICE -> reset', r.game.streak === 1 && !r.freezeUsed && r.game.freezes === 1)
ok('best preserved after reset', r.game.best === 9)

r = applyEntry(G({ streak: 4, lastDay: '2026-07-02' }), E('2026-07-02'), 5)
ok('same day no double streak', r.game.streak === 4)

r = applyEntry(G({ xp: 80, level: 1 }), E('2026-07-01'), 1)
ok('level up at 100xp', r.leveledUp && r.game.level === 2 && r.game.xp === 15)

r = applyEntry(G({ freezes: 0, lastDay: '2026-07-01' }), E('2026-07-02'), 7)
ok('freeze refills at 7 entries', r.game.freezes === 1)

const now = Date.now()
ok('weekCount trailing 7d', weekCount([
  { ...E('a'), ts: now - 1 * 86400000 },
  { ...E('b'), ts: now - 3 * 86400000 },
  { ...E('c'), ts: now - 30 * 86400000 },
]) === 2)
ok('todayStr format', /^\d{4}-\d{2}-\d{2}$/.test(todayStr()))

console.log(fails ? `\n${fails} FAILURES` : '\nALL TESTS PASSED')
process.exit(fails ? 1 : 0)
