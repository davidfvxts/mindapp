# Mira — project context

> This file is read automatically by Claude Code at the start of every session.
> It carries the decisions and constraints from the design conversation so they
> don't have to be re-derived. Keep it current when decisions change.

## What this is

**Mira** — an AI reflection coach. A five-minute daily reflection, gamified, built on
peer-reviewed psychology. Installable PWA (React + TypeScript + Vite), wrapped to iOS with
Capacitor. Local-first, with optional Supabase sync and optional Claude coaching.

Owner: David — founder/CEO of an AI-driven creative agency, also acts as PM. Technical and
comfortable with complex solutions, but **not a programmer**. Prefers decisive senior-engineer
recommendations over menus of options. Be concise; skip hedging.

## Current state

Phase 1 is complete and verified: typecheck clean, 16/16 habit-engine tests passing,
production build + service worker generating.

- ✅ Daily loop, streak engine, XP/levels, offline coach, PWA, opal design system, Capacitor config
- ⏳ **Blocked on David:** Supabase URL + anon key; Anthropic API key
- ⬜ Not built: auth UI (magic link), the full weekly-review form, trend charts, monthly arc

David has an Apple Developer account. He does **not** yet have Supabase or Anthropic set up.

## Non-negotiable design rules

Inspired by **Opal** (opal.so). Mira's own colours; no Opal brand assets are used.

1. **The interface is pure black and white.** `#000000` bg, `#FFFFFF` text, `#BCBBC0`
   secondary, hairlines at 6–10% white. SF Pro Text, five weights.
2. **Colour appears ONLY on an earned milestone.** The five gradients in `src/lib/milestones.ts`
   exist solely to cut gems from (`Gem.tsx`). Minted for: first reflection, streak milestones
   (1/3/7/14/30/60/100/180/365), level-ups, weekly Insight Cards. **Never** as a background,
   never ambient, never decorative. Scarcity is the entire mechanism — the moment a gradient
   becomes wallpaper, the gem stops meaning anything.
3. **No emoji, no icons, no card borders, no shadows.** Structure comes from type scale,
   whitespace, and hairline rules. Before adding a surface, ask whether whitespace would do.
4. Display numerals use Light `300`. Headlines Bold `700` at `-0.04em`.

## Non-negotiable product rules

Every mechanic traces to a research finding. Do not add mechanics that don't.

| Finding | Implementation | Don't break |
|---|---|---|
| Specificity (Pennebaker) | Step 1 demands one concrete event | Never allow an empty/vague moment |
| Self-distancing (Kross) | `CHARGED` emotions trigger a 2nd-person reframe | Keep the name-address phrasing |
| "What" not "why" (Eurich) | Coach priority 1 rewrites why-spirals | Never let the coach ask "why do you…" |
| Name it to tame it | Emotion chips, max 3 | Don't allow unlimited tagging |
| After-Action Review (~20–25% lift) | The daily loop *is* a personal AAR | Keep the same questions every day |
| Consistency > intensity | 3 questions, hard cap | Never lengthen the daily loop |
| **Never miss twice** | `applyEntry()` — one freeze/week saves a single missed day; two misses reset | **Covered by tests. Do not "fix" this.** |
| Implementation intentions (Gollwitzer) | Onboarding forces "After I ___, I reflect" + reminder time | The cue is what makes the habit work |
| Mental contrasting / WOOP (Oettingen) | Weekly review's closing intention | — |
| Agency (Goldsmith) | Step 2 asks what *you* did to cause the outcome | — |

**Deliberately excluded:** leaderboards, social feeds, guilt mechanics, notification spam,
streak-loss punishment beyond the reset. Social comparison and extrinsic pressure undermine the
intrinsic motivation a private reflective practice depends on. Do not add them.

## Architecture principles

**Local-first.** The device is always the source of truth for writes. Supabase and Claude are
enhancements that may fail without breaking the app. `getCoachReply()` catches every error and
falls through to the offline coach — a network blip must never cost a user their streak.

**The API key never touches the browser.** Anthropic is called from a Supabase Edge Function
(`supabase/functions/coach/index.ts`) holding `ANTHROPIC_API_KEY` as a server-side secret.

**Notifications are local, not push.** `@capacitor/local-notifications` fires the daily reminder
on-device. No APNs certs, no server, works offline, nothing leaves the phone. Don't switch to
push — this product never needs server-initiated messages.

**Model routing.** Haiku for the high-volume daily coaching, Sonnet for weekly synthesis.

```
src/lib/
  types.ts        Domain model. EMOTIONS, CHARGED (drives self-distancing).
  game.ts         Habit engine: streaks, never-miss-twice, XP/levels.  ← TESTED
  coach.ts        Offline rule-based Mira. Mirrors the production prompt's priority order.
  ai.ts           Calls the edge function; falls back to coach.ts on any error.
  supabase.ts     Null client when unconfigured → app runs local-only.
  storage.ts      Local-first persistence + opportunistic sync.
  store.ts        useMira() — the single app hook.
  milestones.ts   The five gradients + which streaks earn a gem.
  notifications.ts  On-device daily reminder.
src/components/
  Onboarding · DailyRitual · MiraReply · Gem · Reviews · Stats
supabase/
  migrations/0001_init.sql   Schema + Row-Level Security.
  functions/coach/index.ts   Anthropic proxy. Holds the API key.
```

`coach.ts` (offline) and the system prompt in `functions/coach/index.ts` encode the **same**
intervention priority. If you change one, change the other.

## Commands

```bash
npm install
npm run dev        # runs with zero keys: localStorage + offline coach
npm test           # habit engine — streaks, never-miss-twice, XP
npm run typecheck
npm run build      # production + service worker
npm run ios:add    # Mac + Xcode: creates ios/
npm run ios:sync   # push web changes into the native shell
```

## Housekeeping on first open

```bash
rm -rf node_modules            # partial install shipped in the folder
rm src/components/Orb.tsx      # superseded by Gem.tsx (deprecation stub)
```

## Reference docs

See `docs/` — the research report the whole product is derived from
(`Reflection-System-2026.md`), the product brief (`Mira-Product-Brief.md`), and a browser-openable
design preview (`mira-design-preview.html`).

## Next steps, in order

1. Wire Supabase (keys pending) → magic-link auth UI, then enable sync.
2. Deploy the `coach` edge function with the Anthropic key → real AI coaching.
3. Ship the PWA to David + ~10 founders. **Watch 30-day retention.**
4. Only then: weekly-review form, trend charts, monthly arc, iOS submission.

Don't over-build ahead of retention data. Retention is the only metric that matters right now.
