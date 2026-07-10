import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyEntry, daysBetween, todayStr, weekCount } from './game'
import { loadState, resetState, saveState, syncEntries } from './storage'
import { aiEnabled, fetchCoachClose, fetchCoachReply, fetchFirstRead, fetchNudge, getMonthlyArc, getWeeklyInsight } from './ai'
import { applyMemo, applyWeeklyRevision, foldRating, isCharged, recordCommitment, renegotiateCommitment, mergeWeeklyDelta, staleCommitment } from './coachMemory'
import { seedMemoryFromAnswers, deterministicFirstRead, type OnboardingAnswers } from './onboarding'
import {
  dueForNudge, pickOfflineNudge, toNudge, markSeen, weeklyIntentionNudge,
  commitNudge as commit, declineNudge as decline, resolveNudge as resolve,
} from './guidance'
import {
  intentionForToday, isMorningWindow, needsComeback, nextDay,
  offlineMorningQuestion, upsertMorning,
} from './morning'
import { quietSynthesisDue, weeklyReady, type WeeklyAnswers, type Woop } from './weekly'
import { liveDecision, monthlyReady, type MonthlyAnswers } from './monthly'
import { ensureSession } from './supabase'
import { cancelMorningIntention, scheduleDailyReminder, scheduleMorningIntention } from './notifications'
import type { AppState, CoachReply, Emotion, Entry, InsightCard, MonthTheme, MorningNote, Settings } from './types'

const uid = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`

const ANSWER_LIMIT = 600

export interface Draft {
  event: string
  emotions: Emotion[]
  well: string
  next: string
}

/** What the post-reflection screen shows. reply is null when Coach was skipped. */
export interface Reveal {
  /** The saved entry, so an optional answer can only close this one night. */
  entryId: string
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
          const result = await fetchCoachReply(entry, history, state.settings, state.coach, state.monthTheme?.text)
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
    if (!settings.morningTime) void cancelMorningIntention()
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
      void scheduleMorningIntention(settings.morningTime, entry.next)
      setState((s) => ({ ...s, settings, onboarded: true, coach, entries: [entry], game }))
      setReveal({ entryId: entry.id, night: game.streak, reply, pending: false, firstRead: true })
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
      // The night carries its morning: the win (and Coach's question) it's weighed against.
      const morning = state.mornings.find((m) => m.date === today)
      if (morning?.win) {
        entry.morning = { win: morning.win, question: morning.question, answer: morning.answer }
      }
      const history = state.entries

      // The reflection is saved no matter what. Direct feedback is online-only:
      // fetched now when online, skipped (and owed) when not.
      let reply: CoachReply | null = null
      let pending = false
      let coach = state.coach
      // Tomorrow's morning question is written tonight (or not at all) — a
      // stale one must never carry over.
      let nextMorningQuestion: AppState['nextMorningQuestion'] = null
      if (aiEnabled()) {
        if (online) {
          const result = await fetchCoachReply(entry, history, state.settings, state.coach, state.monthTheme?.text)
          if (result) {
            reply = result.reply
            entry.coach = result.reply
            // Resolve the previously-owed intention, then fold themes/voice.
            coach = applyMemo(coach, result.memo, today, true)
            const mq = result.memo?.morningQuestion?.trim()
            if (mq) nextMorningQuestion = { forDate: nextDay(today), text: mq }
          } else { pending = true; entry.pendingCoach = true }
        } else {
          pending = true
          entry.pendingCoach = true
        }
      }
      // Record tonight's intention as newly owed — online, offline, or key-less.
      coach = recordCommitment(coach, entry, today)

      const { game, freezeUsed } = applyEntry(state.game, entry, history.length + 1)
      setState((s) => ({ ...s, game, entries: [entry, ...s.entries], coach, nextMorningQuestion }))
      setReveal({ entryId: entry.id, night: game.streak, reply, pending })
      setThinking(false)

      // Tonight's intention comes back tomorrow morning, when it can be acted on.
      void scheduleMorningIntention(state.settings.morningTime, entry.next)

      if (freezeUsed) setToast('Last night is covered.')
    },
    [state.entries, state.game, state.settings, state.coach, state.mornings, online],
  )

  const rateReply = useCallback((rating: 0 | 1) => {
    setState((s) => {
      const [head, ...rest] = s.entries
      if (!head) return s
      // Tone drifts one step at a time and recovers the same way; the user's
      // deliberate calibration is only ever nudged, never jumped over.
      const tone: Settings['tone'] =
        rating === 0
          ? (s.settings.tone === 'sharper' ? 'default' : 'gentler')
          : (s.settings.tone === 'gentler' ? 'default' : s.settings.tone)
      return {
        ...s,
        settings: { ...s.settings, tone },
        entries: [{ ...head, rating }, ...rest],
        // The move itself is filed under landed/avoided — Coach learns which
        // interventions work on THIS person, reply by reply.
        coach: foldRating(s.coach, head.coach?.kind, rating),
      }
    })
    setToast(rating ? 'Noted — Coach will keep this read.' : 'Noted — Coach will ease off.')
  }, [])

  /**
   * The guided weekly review's payoff. The user did the work (three prompts +
   * a WOOP); Coach synthesizes FROM their answers, the WOOP becomes a standing
   * weekly intention (checked in on like any commitment), and the profile
   * revision folds in. Returns the minted card, or null on failure — the
   * user's answers stay in the flow so they can simply try again.
   */
  const completeWeekly = useCallback(
    async (review: WeeklyAnswers, woop: Woop): Promise<InsightCard | null> => {
      if (!online) { setToast('Coach reads your week when you’re online.'); return null }
      setThinking(true)
      const result = await getWeeklyInsight(state.entries, state.settings, state.coach, { review, woop })
      setThinking(false)
      if (!result) { setToast('Coach couldn’t be reached. Try again in a moment.'); return null }
      const today = todayStr()
      const card: InsightCard = { id: uid(), text: result.text, date: today }
      const nights = Math.max(state.game.best, state.game.streak)
      setState((s) => ({
        ...s,
        cards: [card, ...s.cards],
        coach: applyWeeklyRevision(s.coach, result.profile, today),
        nudges: woop.wish.trim() && woop.plan.trim()
          ? [weeklyIntentionNudge(woop, uid(), nights, today), ...s.nudges]
          : s.nudges,
        lastWeeklyReview: today,
        lastWeeklySynthesis: today,
      }))
      setToast('Your week is read.')
      return card
    },
    [online, state.entries, state.settings, state.coach, state.game],
  )

  /**
   * The monthly arc — the deepest layer. Coach drafts the month's trajectory
   * and a theme; the user edits/confirms, names their identity gap and (if a
   * decision is live) a fear-setting note, and sets the month's theme. One AI
   * call up front. Returns the draft (or null offline) so the flow can hold.
   */
  const beginMonthly = useCallback(async () => {
    if (!online) { setToast('Coach reads your month when you’re online.'); return null }
    setThinking(true)
    const result = await getMonthlyArc(state.entries, state.cards.map((c) => c.text), state.settings, state.coach)
    setThinking(false)
    if (!result) { setToast('Coach couldn’t be reached. Try again in a moment.'); return null }
    return result
  }, [online, state.entries, state.cards, state.settings, state.coach])

  /** Bank the arc: store the read, set the month's theme, fold the revision. */
  const completeMonthly = useCallback(
    (answers: MonthlyAnswers, profile: Parameters<typeof applyWeeklyRevision>[1]) => {
      const today = todayStr()
      const card: InsightCard = { id: uid(), text: answers.trajectory.trim(), date: today }
      const theme = answers.theme.trim()
      const monthTheme: MonthTheme | null = theme ? { text: theme, date: today } : null
      setState((s) => ({
        ...s,
        arcs: [card, ...s.arcs],
        coach: applyWeeklyRevision(s.coach, profile ?? undefined, today),
        monthTheme: monthTheme ?? s.monthTheme,
        lastMonthlyArc: today,
      }))
      setToast('The month is set.')
    },
    [],
  )

  // Quiet memory synthesis: a week that sat ready and untouched still teaches
  // Coach. Online-only, memory-only — profileDelta folds in, no card is minted,
  // nothing is shown, and the ready marker stays so the guided review remains
  // theirs to do. One attempt per day, guarded against racing the manual flow.
  const quietWeekly = useRef<string | null>(null)
  useEffect(() => {
    if (!online || !aiEnabled() || thinking) return
    const today = todayStr()
    if (quietWeekly.current === today) return
    if (!quietSynthesisDue(weekCount(state.entries), state.lastWeeklyReview, state.lastWeeklySynthesis, today)) return
    quietWeekly.current = today
    void (async () => {
      const result = await getWeeklyInsight(state.entries, state.settings, state.coach)
      if (!result) return // try again tomorrow (or next session)
      setState((s) => ({
        ...s,
        coach: applyWeeklyRevision(s.coach, result.profile, today),
        lastWeeklySynthesis: today,
      }))
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, state.entries.length, state.lastWeeklyReview, state.lastWeeklySynthesis, thinking])

  /**
   * One optional answer, saved to the entry before any network work begins.
   * A missing close is final for this night: no synthetic line and no reconnect
   * queue, so the nightly ritual never becomes a chat thread.
   */
  const answerCoach = useCallback(async (entryId: string, rawAnswer: string): Promise<boolean> => {
    const answer = rawAnswer.trim().slice(0, ANSWER_LIMIT)
    const entry = state.entries.find((e) => e.id === entryId)
    if (!answer || !entry?.coach || entry.coachAnswer || entry.coachClose) return false

    const answeredEntry: Entry = { ...entry, coachAnswer: answer, synced: false }
    const locallySaved = {
      ...state,
      entries: state.entries.map((e) => (e.id === entryId ? answeredEntry : e)),
    }
    // Persist synchronously before starting the optional online close.
    saveState(locallySaved)
    setState((s) => ({
      ...s,
      entries: s.entries.map((e) => (e.id === entryId ? { ...e, coachAnswer: answer, synced: false } : e)),
    }))

    if (!online || !aiEnabled()) return false

    const result = await fetchCoachClose(
      answeredEntry,
      state.entries.filter((e) => e.id !== entryId),
      state.settings,
      state.coach,
    )
    if (!result) return false

    const today = todayStr()
    setState((s) => {
      const target = s.entries.find((e) => e.id === entryId)
      if (!target || target.coachAnswer !== answer || target.coachClose) return s
      return {
        ...s,
        entries: s.entries.map((e) =>
          e.id === entryId ? { ...e, coachClose: result.close, synced: false } : e,
        ),
        // The answer can sharpen themes and voice, but must not re-resolve an
        // intention already handled by the nightly read.
        coach: applyMemo(s.coach, result.memo, today, false),
      }
    })
    return true
  }, [state, online])

  /** Re-run the intake at any time: update settings + augment the profile.
   *  No new entry, no Night change — just re-tune what Coach knows. */
  const retune = useCallback((settings: Settings, answers: OnboardingAnswers) => {
    const today = todayStr()
    const seed = seedMemoryFromAnswers(answers, today)
    setState((s) => ({ ...s, settings, coach: mergeWeeklyDelta(s.coach, seed.profile, today) }))
    void scheduleDailyReminder(settings.reminderTime, settings.cue)
    if (!settings.morningTime) void cancelMorningIntention()
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

  /** The user's call on an intention that aged out: still on it, or let it go. */
  const renegotiateIntention = useCallback((keep: boolean) => {
    setState((s) => ({ ...s, coach: renegotiateCommitment(s.coach, keep, todayStr()) }))
    setToast(keep ? 'Still on. Coach will hold the thread.' : 'Let go. Nothing carried forward.')
  }, [])

  /** The comeback is shown once per lapse — acknowledging flows into the ritual. */
  const acknowledgeComeback = useCallback(() => {
    setState((s) => ({ ...s, comebackAck: s.game.lastDay }))
  }, [])

  const hardReset = useCallback(() => {
    resetState()
    setState(loadState())
  }, [])

  const derived = useMemo(() => {
    const today = todayStr()
    const reflectedToday = state.game.lastDay === today
    const thisWeek = weekCount(state.entries)
    // Last night's intention, surfaced while it can still shape today.
    const todayIntention = reflectedToday ? null : intentionForToday(state.coach.commitments, today)
    // A real lapse (≥2 missed nights) gets a designed re-entry, once.
    const comeback = needsComeback(state.game.lastDay, today, state.comebackAck)
      ? { best: state.game.best }
      : null

    // The Today bookend: the day's note, and (until a win is set) Coach's one
    // morning question — written last night when possible, else drawn from the
    // deterministic library. A clean day rightly gets none.
    const morningNote = state.mornings.find((m) => m.date === today) ?? null
    let morningQuestion: string | null = null
    if (!morningNote && !reflectedToday) {
      if (state.nextMorningQuestion?.forDate === today) {
        morningQuestion = state.nextMorningQuestion.text
      } else {
        const last = state.entries[0]
        const open = state.coach.commitments.find((c) => c.status === 'open')
        const topTheme = [...state.coach.themes].sort((a, b) => b.count - a.count)[0]
        morningQuestion = offlineMorningQuestion({
          chargedYesterday: !!last && daysBetween(last.date, today) === 1 && isCharged(last.emotions),
          owed: open ? { text: open.text, age: daysBetween(open.date, today) } : null,
          theme: topTheme && topTheme.count >= 3 ? topTheme.key : null,
        })
      }
    }
    const morningWindow = isMorningWindow(new Date().getHours())

    // The weekly review: ready when the week is gathered and the last guided
    // review is far enough back. The open standing intention (if any) is
    // checked in on at the top of the next review.
    const reviewReady = weeklyReady(thisWeek, state.lastWeeklyReview, today)
    const openWeeklyIntention =
      state.nudges.find((n) => n.kind === 'intention' && n.status === 'committed') ?? null

    // An intention that aged out unresolved — awaiting the user's call in Guidance.
    const staleIntention = staleCommitment(state.coach)

    // The monthly arc: enough weekly reads gathered, spaced from the last arc.
    const monthReady = monthlyReady(state.cards.length, state.lastMonthlyArc, today)
    const liveDecisionText = liveDecision(state.coach)

    return {
      reflectedToday, thisWeek, todayIntention, comeback, morningNote, morningQuestion, morningWindow,
      reviewReady, openWeeklyIntention, staleIntention, monthReady, liveDecision: liveDecisionText,
    }
  }, [state.entries, state.game, state.coach, state.comebackAck, state.mornings, state.nextMorningQuestion, state.nudges, state.lastWeeklyReview, state.cards.length, state.lastMonthlyArc])

  /** Set the Today bookend: one win, optionally an answer to Coach's question. */
  const setMorning = useCallback((win: string, answer?: string) => {
    const w = win.trim()
    if (!w) return
    const today = todayStr()
    const note: MorningNote = {
      date: today,
      win: w,
      question: derived.morningQuestion ?? undefined,
      answer: answer?.trim() || undefined,
    }
    setState((s) => ({ ...s, mornings: upsertMorning(s.mornings, note) }))
    setToast('Noted for today.')
  }, [derived.morningQuestion])

  return {
    state, derived, toast, thinking, reveal, online,
    completeOnboarding, beginJourney, retune, submitEntry, rateReply, completeWeekly, answerCoach,
    markGuidanceSeen, commitNudge, declineNudge, resolveNudge, renegotiateIntention,
    beginMonthly, completeMonthly, acknowledgeComeback, setMorning, hardReset,
    setToast, clearReveal: () => setReveal(null),
  }
}
