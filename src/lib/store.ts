import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyEntry, todayStr, weekCount } from './game'
import { loadState, resetState, saveState, syncEntries } from './storage'
import { aiEnabled, fetchCoachReply, fetchFirstRead, fetchNudge, getWeeklyInsight } from './ai'
import { applyMemo, recordCommitment, mergeWeeklyDelta } from './coachMemory'
import { seedMemoryFromAnswers, deterministicFirstRead, type OnboardingAnswers } from './onboarding'
import {
  dueForNudge, pickOfflineNudge, toNudge, markSeen,
  commitNudge as commit, declineNudge as decline, resolveNudge as resolve,
} from './guidance'
import { ensureSession } from './supabase'
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

/** What the post-reflection screen shows. reply is null when Coach was skipped. */
export interface Reveal {
  night: number
  reply: CoachReply | null
  /** True when a reply is owed but couldn't be fetched (offline / transient). */
  pending: boolean
  /** The onboarding First Read — presented a touch more prominently. */
  firstRead?: boolean
}

/** Live connectivity. Drives whether direct feedback is fetched or skipped. */
function useOnline(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

export function useFacet() {
  const [state, setState] = useState<AppState>(() => loadState())
  const [toast, setToast] = useState<string | null>(null)
  const [thinking, setThinking] = useState(false)
  const [reveal, setReveal] = useState<Reveal | null>(null)
  const online = useOnline()

  useEffect(() => saveState(state), [state])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  // Give this device a sync identity once (anonymous — no sign-in UI needed).
  useEffect(() => { void ensureSession() }, [])

  // The occasional nudge. When Coach is due (irregular, never daily, one at a
  // time), consider surfacing one thing worth trying. Online, Opus decides what —
  // and may decline ("nothing meaningful tonight"); offline, or if the model
  // can't be reached, we draw a fitting one from the local library. Either way we
  // advance the pacing clock so the next check waits its gap.
  const nudging = useRef(false)
  useEffect(() => {
    if (nudging.current || !dueForNudge(state)) return
    nudging.current = true
    void (async () => {
      try {
        const nights = Math.max(state.game.best, state.game.streak)
        const today = todayStr()
        const res = aiEnabled() && online ? await fetchNudge(state) : 'offline'
        // 'skip' = Coach deliberately held back; null/'offline' = fall back to the library.
        const draft = res === 'skip' ? null : res && res !== 'offline' ? res : pickOfflineNudge(state)
        const origin: 'ai' | 'local' = res && res !== 'offline' && res !== 'skip' ? 'ai' : 'local'
        setState((s) => {
          const base = { ...s, lastNudgeCheck: Math.max(s.lastNudgeCheck, nights) }
          if (!draft) return base
          return { ...base, nudges: [toNudge(draft, uid(), nights, today, origin), ...s.nudges] }
        })
        if (draft) setToast('Coach left you something in Guidance.')
      } finally {
        nudging.current = false
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, state.entries.length, state.nudges.length, state.lastNudgeCheck])

  // Local-first sync: push any unsynced reflections whenever they change or we
  // come back online. Never blocks a write; failures just retry next time.
  useEffect(() => {
    if (!online) return
    let cancelled = false
    void (async () => {
      await ensureSession()
      const next = await syncEntries(state.entries)
      if (!cancelled && next !== state.entries) setState((s) => ({ ...s, entries: next }))
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.entries.length, online])

  // Deferred coaching: reflections written offline are read by Coach the moment
  // connectivity returns. Quiet — attaches replies to past entries and folds
  // what Coach learned into memory (themes/voice only; not commitment outcomes,
  // which a late reply could misattribute to a newer intention).
  const catchingUp = useRef(false)
  useEffect(() => {
    if (!online || !aiEnabled() || catchingUp.current) return
    const pending = state.entries.filter((e) => e.pendingCoach && !e.coach)
    if (!pending.length) return
    catchingUp.current = true
    void (async () => {
      try {
        const today = todayStr()
        const caughtUp: string[] = []
        for (const entry of pending.slice(0, 5)) {
          const history = state.entries.filter((e) => e.ts < entry.ts)
          const result = await fetchCoachReply(entry, history, state.settings, state.coach)
          if (!result) break // still unreachable — leave pending, try again later
          setState((s) => ({
            ...s,
            entries: s.entries.map((e) =>
              e.id === entry.id ? { ...e, coach: result.reply, pendingCoach: false, synced: false } : e,
            ),
            coach: applyMemo(s.coach, result.memo, today, false),
          }))
          caughtUp.push(entry.date)
        }
        // The owed reads exist now — say so quietly, and point nowhere. They
        // live under their nights in the Vault.
        if (caughtUp.length === 1) {
          const day = new Date(`${caughtUp[0]}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long' })
          setToast(`Coach read ${day}’s night. It’s in the Vault.`)
        } else if (caughtUp.length > 1) {
          setToast('Coach caught up on your nights. They’re in the Vault.')
        }
      } finally {
        catchingUp.current = false
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, state.entries, state.settings])

  const completeOnboarding = useCallback((settings: Settings) => {
    setState((s) => ({ ...s, settings, onboarded: true }))
    void scheduleDailyReminder(settings.reminderTime, settings.cue)
    setToast(`Reminder set — after you ${settings.cue}, ${settings.reminderTime}.`)
  }, [])

  /**
   * The guided onboarding's payoff. Seeds the coach profile from the intake,
   * runs their first-ever reflection, and returns the First Read (AI when
   * online, a deterministic-but-specific read otherwise) with Night 1's Stone.
   */
  const beginJourney = useCallback(
    async (settings: Settings, answers: OnboardingAnswers, first: Draft) => {
      setThinking(true)
      const today = todayStr()
      const entry: Entry = {
        id: uid(),
        date: today,
        event: first.event.trim(),
        emotions: first.emotions,
        well: first.well.trim(),
        next: first.next.trim(),
        ts: Date.now(),
      }

      let coach = seedMemoryFromAnswers(answers, today)
      let reply: CoachReply = { text: deterministicFirstRead(answers, first), kind: 'celebration', source: 'local' }
      if (aiEnabled() && online) {
        const r = await fetchFirstRead(answers, entry, settings)
        if (r) {
          reply = r.reply
          coach = mergeWeeklyDelta(coach, r.profileDelta ?? undefined, today)
        }
      }
      entry.coach = reply
      coach = recordCommitment(coach, entry, today)

      const { game } = applyEntry(state.game, entry, 1)
      void scheduleDailyReminder(settings.reminderTime, settings.cue)
      setState((s) => ({ ...s, settings, onboarded: true, coach, entries: [entry], game }))
      setReveal({ night: game.streak, reply, pending: false, firstRead: true })
      setThinking(false)
    },
    [state.game, online],
  )

  const submitEntry = useCallback(
    async (draft: Draft) => {
      setThinking(true)
      const today = todayStr()
      const entry: Entry = {
        id: uid(),
        date: today,
        event: draft.event.trim(),
        emotions: draft.emotions,
        well: draft.well.trim(),
        next: draft.next.trim(),
        ts: Date.now(),
      }
      const history = state.entries

      // The reflection is saved no matter what. Direct feedback is online-only:
      // fetched now when online, skipped (and owed) when not.
      let reply: CoachReply | null = null
      let pending = false
      let coach = state.coach
      if (aiEnabled()) {
        if (online) {
          const result = await fetchCoachReply(entry, history, state.settings, state.coach)
          if (result) {
            reply = result.reply
            entry.coach = result.reply
            // Resolve the previously-owed intention, then fold themes/voice.
            coach = applyMemo(coach, result.memo, today, true)
          } else { pending = true; entry.pendingCoach = true }
        } else {
          pending = true
          entry.pendingCoach = true
        }
      }
      // Record tonight's intention as newly owed — online, offline, or key-less.
      coach = recordCommitment(coach, entry, today)

      const { game, freezeUsed } = applyEntry(state.game, entry, history.length + 1)
      setState((s) => ({ ...s, game, entries: [entry, ...s.entries], coach }))
      setReveal({ night: game.streak, reply, pending })
      setThinking(false)

      if (freezeUsed) setToast('Last night is covered.')
    },
    [state.entries, state.game, state.settings, state.coach, online],
  )

  const rateReply = useCallback((rating: 0 | 1) => {
    setState((s) => {
      const [head, ...rest] = s.entries
      if (!head) return s
      // Symmetric: a miss eases Coach off; a hit lifts the easing again.
      // A deliberate 'sharper' setting is never overridden by ratings.
      const tone: Settings['tone'] =
        rating === 0 ? 'gentler' : s.settings.tone === 'gentler' ? 'default' : s.settings.tone
      return { ...s, settings: { ...s.settings, tone }, entries: [{ ...head, rating }, ...rest] }
    })
    setToast(rating ? 'Noted — Coach will keep this read.' : 'Noted — Coach will ease off.')
  }, [])

  const mintCard = useCallback(async () => {
    if (!online) { setToast('Coach reads your week when you’re online.'); return }
    setThinking(true)
    const result = await getWeeklyInsight(state.entries, state.settings, state.coach)
    setThinking(false)
    if (!result) { setToast('Coach couldn’t be reached. Try again in a moment.'); return }
    const card: InsightCard = { id: uid(), text: result.text, date: todayStr() }
    setState((s) => ({
      ...s,
      cards: [card, ...s.cards],
      coach: mergeWeeklyDelta(s.coach, result.profileDelta ?? undefined, todayStr()),
    }))
    setToast('Your week is read.')
  }, [online, state.entries, state.settings, state.coach])

  /** Re-run the intake at any time: update settings + augment the profile.
   *  No new entry, no Night change — just re-tune what Coach knows. */
  const retune = useCallback((settings: Settings, answers: OnboardingAnswers) => {
    const today = todayStr()
    const seed = seedMemoryFromAnswers(answers, today)
    setState((s) => ({ ...s, settings, coach: mergeWeeklyDelta(s.coach, seed.profile, today) }))
    void scheduleDailyReminder(settings.reminderTime, settings.cue)
    setToast('Coach re-tuned to you.')
  }, [])

  /** Opening the Guidance tab clears the "new" marker. */
  const markGuidanceSeen = useCallback(() => {
    setState((s) => ({ ...s, nudges: markSeen(s.nudges, Math.max(s.game.best, s.game.streak)) }))
  }, [])

  /** "I'll try this" — Coach checks in a few nights on. */
  const commitNudge = useCallback((id: string, note?: string) => {
    setState((s) => ({ ...s, nudges: commit(s.nudges, id, Math.max(s.game.best, s.game.streak), note) }))
    setToast('Noted — Coach will check in on this.')
  }, [])

  /** "Not for me" — set it aside; Coach learns from an optional reason. */
  const declineNudge = useCallback((id: string, note?: string) => {
    setState((s) => ({ ...s, nudges: decline(s.nudges, id, note) }))
  }, [])

  /** Resolve a due check-in — kept it or not. Never punishing either way. */
  const resolveNudge = useCallback((id: string, kept: boolean) => {
    setState((s) => ({ ...s, nudges: resolve(s.nudges, id, kept) }))
    setToast(kept ? 'That’s a good one to keep.' : 'No pressure — it’s off your plate.')
  }, [])

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
    state, derived, toast, thinking, reveal, online,
    completeOnboarding, beginJourney, retune, submitEntry, rateReply, mintCard,
    markGuidanceSeen, commitNudge, declineNudge, resolveNudge, hardReset,
    setToast, clearReveal: () => setReveal(null),
  }
}
