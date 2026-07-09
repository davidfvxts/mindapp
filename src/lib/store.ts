import { useCallback, useEffect, useMemo, useState } from 'react'
import { applyEntry, todayStr, weekCount, xpForLevel } from './game'
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

export function useMira() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [toast, setToast] = useState<string | null>(null)
  const [thinking, setThinking] = useState(false)
  const [lastReply, setLastReply] = useState<CoachReply | null>(null)
  const [lastGain, setLastGain] = useState(0)

  useEffect(() => saveState(state), [state])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2800)
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
    setToast(`Reminder set: after you ${settings.cue}, ${settings.reminderTime}.`)
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

      const { game, freezeUsed, leveledUp, gained } = applyEntry(
        state.game, entry, history.length + 1,
      )

      setState((s) => ({ ...s, game, entries: [entry, ...s.entries] }))
      setLastReply(reply)
      setLastGain(gained)
      setThinking(false)

      if (freezeUsed) setToast('Mira spent a streak-freeze. Your streak survived.')
      else if (leveledUp) setToast(`Level up — you're Level ${game.level}.`)
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
    setToast(rating ? 'Noted — Mira will keep this style.' : 'Got it — Mira will adjust her tone.')
  }, [])

  const mintCard = useCallback(async () => {
    setThinking(true)
    const text = await getWeeklyInsight(state.entries, state.settings)
    const card: InsightCard = { id: uid(), text, date: todayStr() }
    setState((s) => ({ ...s, cards: [card, ...s.cards] }))
    setThinking(false)
    setToast('Insight card minted.')
  }, [state.entries, state.settings])

  const hardReset = useCallback(() => {
    resetState()
    setState(loadState())
  }, [])

  const derived = useMemo(() => {
    const reflectedToday = state.game.lastDay === todayStr()
    const thisWeek = weekCount(state.entries)
    return {
      reflectedToday,
      thisWeek,
      xpNeeded: xpForLevel(state.game.level),
      xpPct: Math.min(100, (state.game.xp / xpForLevel(state.game.level)) * 100),
    }
  }, [state.entries, state.game])

  return {
    state, derived, toast, thinking, lastReply, lastGain,
    completeOnboarding, submitEntry, rateReply, mintCard, hardReset,
    setToast, clearReply: () => setLastReply(null),
  }
}
