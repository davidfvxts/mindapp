import { useCallback, useEffect, useMemo, useState } from 'react'
import { applyEntry, todayStr, weekCount } from './game'
import { loadState, resetState, saveState, syncEntries } from './storage'
import { getCoachReply, getWeeklyInsight } from './ai'
import { scheduleDailyReminder } from './notifications'
import type { AppState, CoachReply, Emotion, Entry, InsightCard, Settings } from './types'

const uid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`

export interface Draft {
  event: string
  emotions: Emotion[]
  well: string
  next: string
}

export function useFacet() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [toast, setToast] = useState<string | null>(null)
  const [thinking, setThinking] = useState(false)
  const [lastReply, setLastReply] = useState<CoachReply | null>(null)

  useEffect(() => saveState(state), [state])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // Opportunistic background sync.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const next = await syncEntries(state.entries)
      if (!cancelled && next !== state.entries) {
        setState((s) => ({ ...s, entries: next }))
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.entries.length])

  const completeOnboarding = useCallback((settings: Settings) => {
    setState((s) => ({ ...s, settings, onboarded: true }))
    void scheduleDailyReminder(settings.reminderTime, settings.cue)
    setToast(`Reminder set — after you ${settings.cue}, ${settings.reminderTime}.`)
  }, [])

  const submitEntry = useCallback(
    async (draft: Draft) => {
      setThinking(true)
      const entry: Entry = {
        id: uid(),
        date: todayStr(),
        event: draft.event.trim(),
        emotions: draft.emotions,
        well: draft.well.trim(),
        next: draft.next.trim(),
        ts: Date.now(),
      }

      const history = state.entries
      const reply = await getCoachReply(entry, history, state.settings)
      entry.coach = reply

      const { game, freezeUsed } = applyEntry(state.game, entry, history.length + 1)

      setState((s) => ({ ...s, game, entries: [entry, ...s.entries] }))
      setLastReply(reply)
      setThinking(false)

      // Never punish; never brag. One quiet line when a Night is bridged.
      if (freezeUsed) setToast('Last night is covered.')
    },
    [state.entries, state.game, state.settings],
  )

  const rateReply = useCallback((rating: 0 | 1) => {
    setState((s) => {
      const [head, ...rest] = s.entries
      if (!head) return s
      const tone: Settings['tone'] = rating === 1 ? s.settings.tone : 'gentler'
      return { ...s, settings: { ...s.settings, tone }, entries: [{ ...head, rating }, ...rest] }
    })
    setToast(rating ? 'Noted — Coach will keep this read.' : 'Noted — Coach will ease off.')
  }, [])

  const mintCard = useCallback(async () => {
    setThinking(true)
    const text = await getWeeklyInsight(state.entries, state.settings)
    const card: InsightCard = { id: uid(), text, date: todayStr() }
    setState((s) => ({ ...s, cards: [card, ...s.cards] }))
    setThinking(false)
    setToast('Your week is read.')
  }, [state.entries, state.settings])

  const hardReset = useCallback(() => {
    resetState()
    setState(loadState())
  }, [])

  const derived = useMemo(() => {
    const reflectedToday = state.game.lastDay === todayStr()
    const thisWeek = weekCount(state.entries)
    return { reflectedToday, thisWeek }
  }, [state.entries, state.game])

  return {
    state, derived, toast, thinking, lastReply,
    completeOnboarding, submitEntry, rateReply, mintCard, hardReset,
    setToast, clearReply: () => setLastReply(null),
  }
}
