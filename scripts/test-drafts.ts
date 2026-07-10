/**
 * Tests for the draft layer — words are never lost.
 * Run: npm test
 */

// A localStorage stub so the module runs under node exactly as in the browser.
const backing = new Map<string, string>()
;(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => backing.get(k) ?? null,
  setItem: (k: string, v: string) => void backing.set(k, v),
  removeItem: (k: string) => void backing.delete(k),
  key: (i: number) => [...backing.keys()][i] ?? null,
  get length() {
    return backing.size
  },
  clear: () => backing.clear(),
}

import { clearAllDrafts, clearDraft, draftHasText, loadDraft, saveDraft } from '../src/lib/drafts'

let fails = 0
const ok = (name: string, cond: boolean) => {
  if (!cond) {
    fails++
    console.log('FAIL:', name)
  } else console.log('pass:', name)
}

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  // save → load roundtrip (short debounce for the test)
  saveDraft('tonight.2026-07-10', { event: 'the call ran long', step: 1 }, 5)
  await tick(20)
  const d = loadDraft<{ event: string; step: number }>('tonight.2026-07-10')
  ok('roundtrip restores the draft', d?.event === 'the call ran long' && d?.step === 1)

  // debounce collapses rapid saves — only the last value lands
  saveDraft('weekly', { wins: 'a' }, 20)
  saveDraft('weekly', { wins: 'ab' }, 20)
  saveDraft('weekly', { wins: 'abc' }, 20)
  await tick(50)
  ok('debounce keeps only the latest value', loadDraft<{ wins: string }>('weekly')?.wins === 'abc')

  // clearDraft removes stored value AND cancels a pending write
  saveDraft('monthly', { gap: 'queued' }, 30)
  clearDraft('monthly')
  await tick(60)
  ok('clearDraft cancels pending writes', loadDraft('monthly') === null)

  // clearAllDrafts removes only facet.draft.* keys
  backing.set('facet.state.v1', '{"app":"state"}')
  saveDraft('answer.e1', { text: 'my answer' }, 5)
  await tick(20)
  clearAllDrafts()
  ok('clearAllDrafts removes drafts', loadDraft('answer.e1') === null && loadDraft('tonight.2026-07-10') === null)
  ok('clearAllDrafts leaves app state alone', backing.get('facet.state.v1') === '{"app":"state"}')

  // corrupt JSON never throws
  backing.set('facet.draft.bad', '{oops')
  ok('corrupt draft reads as null', loadDraft('bad') === null)

  // draftHasText
  ok('draftHasText: empty', !draftHasText(null) && !draftHasText({ a: '', b: '   ' }))
  ok('draftHasText: real words', draftHasText({ a: '', b: 'kept it' }))

  console.log(fails ? `\n${fails} FAILURES` : '\nALL DRAFT TESTS PASSED')
  if (fails) process.exit(1)
}

void main()
