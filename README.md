# Mira

**An AI reflection coach.** A five-minute daily reflection, gamified, built on the science of what actually makes reflection work.

React + TypeScript + Vite · installable PWA · optional Supabase sync · optional Claude coaching · Capacitor-ready for iOS.

---

## ⚠️ First: two files to delete

The folder shipped with a partial `node_modules` from the build sandbox, and one
superseded component. Remove both before installing:

```bash
cd mira-app
rm -rf node_modules
rm src/components/Orb.tsx   # superseded by Gem.tsx
```

---

## Run it right now (zero setup, zero keys)

```bash
npm install
npm run dev
```

Open the printed URL. **It works immediately** with no accounts and no API keys:

- entries persist in `localStorage`
- the AI coach falls back to a **rule-based Mira** that implements the exact same intervention priority as the real one

You only need the steps below to turn on cloud sync and real Claude coaching.

Other commands:

```bash
npm test        # tests the habit engine (streaks, never-miss-twice, XP)
npm run build   # production build + service worker
npm run preview # serve the production build
```

---

## What you need to provide

Everything is optional and independent — the app degrades gracefully if you skip either.

| # | What | Cost | Needed for | Status |
|---|------|------|-----------|--------|
| 1 | A **Supabase** project (free tier) | €0 | Sign-in + cloud sync across devices | ⏳ you're sending the key |
| 2 | An **Anthropic API key** | pay-as-you-go, cents/month for one user | Real AI coaching + weekly Insight Cards | ⏳ needed |
| 3 | An **Apple Developer account** | $99/yr | App Store submission only | ✅ you have it |
| 4 | A **Mac with Xcode** | free | Building the iOS shell | needed for `ios:add` |

### 1. Supabase (enables sync)

1. Create a project at [supabase.com](https://supabase.com) (free tier is plenty).
2. Open **SQL Editor**, paste the contents of `supabase/migrations/0001_init.sql`, and run it. This creates `entries`, `insight_cards`, `profiles` and — importantly — **Row-Level Security** policies so no user can ever read another's reflections.
3. Go to **Project Settings → API** and copy the **Project URL** and the **anon public** key.
4. `cp .env.example .env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### 2. Anthropic (enables real AI coaching)

Your API key must **never** reach the browser, so it lives in a Supabase Edge Function that proxies the call.

1. Get a key at [console.anthropic.com](https://console.anthropic.com).
2. Install the Supabase CLI and link the project:
   ```bash
   npm i -g supabase
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   ```
3. Set the key as a server-side secret and deploy the function:
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase functions deploy coach
   ```
4. Put the function URL in `.env.local`:
   ```
   VITE_COACH_URL=https://YOUR-PROJECT.supabase.co/functions/v1/coach
   ```

Restart `npm run dev`. The "offline coach" badge on Mira's replies disappears once real Claude is answering.

**Cost:** daily coaching runs on Claude Haiku, weekly synthesis on Sonnet (see `supabase/functions/coach/index.ts`). For a single user this is a few cents a month.

### 3. iOS — already wired up

Capacitor is configured (`capacitor.config.ts`, appId `so.mira.app`) and the deps are in
`package.json`. On a Mac with Xcode installed:

```bash
npm run ios:add     # builds, then creates the ios/ project
npm run ios:open    # opens Xcode
```

After that, `npm run ios:sync` pushes any web changes into the native shell.

**Notifications are local, not push.** The daily reminder is scheduled on-device via
`@capacitor/local-notifications` (`src/lib/notifications.ts`), fired at the time chosen during
onboarding. This is deliberate: no APNs certificates, no server, no backend dependency, works
offline, and nothing about the user's reflections ever leaves the device. You only need push
infrastructure if you later want server-initiated messages — which this product doesn't.

That reminder matters more than it sounds: it *is* the implementation-intention cue that makes
the habit work. A reflection app without a reliable trigger is one people forget.

Your Apple Developer account is only needed to submit. Note you can already "Add to Home Screen"
from Safari today and get a full-screen, icon-launched app with no Apple account at all — enough
to test 30-day retention before touching Xcode.

---

## Design system

Inspired by **Opal**'s design language. Mira's own colours; no Opal brand assets are used.

**The whole interface is pure black and white.** Background `#000000`, text `#FFFFFF`,
secondary `#BCBBC0`, hairlines at 6–10% white. SF Pro Text across five weights — Light `300`
for display numerals, Bold `700` with `-0.04em` tracking for headlines.

**Colour is reserved for milestones and nothing else.** The five gradients in
`src/lib/milestones.ts` exist only to cut gems from (`Gem.tsx`). A gem is minted for your
first reflection, streak milestones (1, 3, 7, 14, 30, 60, 100, 180, 365), level-ups, and each
weekly Insight Card. Gradients are never backgrounds, never ambient, never decorative.
Scarcity is what makes the reward land — the moment you use a gradient as wallpaper, a gem
stops meaning anything.

There are no card borders, no shadows, no icons and no emoji. Structure comes from type scale,
whitespace, and hairline rules. If you add a surface, ask first whether whitespace would do.

Open `mira-design-preview.html` (in the parent folder) in a browser to see the three key screens.

## Architecture

```
src/
  lib/
    types.ts      Domain model. EMOTIONS, CHARGED (drives self-distancing).
    game.ts       The habit engine: streaks, "never miss twice", XP/levels.  ← tested
    coach.ts      Offline rule-based Mira (fallback + reference implementation).
    ai.ts         Calls the edge function; falls back to coach.ts on any error.
    supabase.ts   Null client when unconfigured → app runs local-only.
    storage.ts    Local-first persistence + opportunistic cloud sync.
    store.ts      useMira() — the single app hook.
    milestones.ts The five gradients + which streaks earn a gem.
    notifications.ts  On-device daily reminder (no push, no server).
  components/
    Onboarding.tsx   Captures the if-then cue (Gollwitzer).
    DailyRitual.tsx  The 3-step loop: moment → read → next step.
    MiraReply.tsx    Coach response + XP/streak reward + milestone gem.
    Gem.tsx          The only colour in the app.
    Reviews.tsx      Weekly (unlock at 5) and monthly (unlock at 4 reviews).
    Stats.tsx        Streak, heatmap, insight cards, history.
supabase/
  migrations/0001_init.sql    Schema + RLS.
  functions/coach/index.ts    Anthropic proxy. Holds the API key.
```

**Design rule: local-first.** The device is always the source of truth for writes. Supabase and Claude are enhancements that can fail without breaking the app. `getCoachReply()` catches every error and falls through to the local coach — a network blip must never cost a user their streak.

---

## How the research maps to the code

Nothing here is decorative. Each mechanic traces to a finding.

| Finding | Where it lives |
|---|---|
| **Specificity** (Pennebaker) — write about one concrete event | `DailyRitual` step 1 refuses to advance on an empty moment |
| **Self-distancing** (Kross) — address yourself by name | `CHARGED` emotions in `types.ts` trigger the `distancing` intervention |
| **"What," not "why"** (Eurich) — why-questions cause rumination | `coach.ts` priority 1 detects why-spirals and rewrites them |
| **Name it to tame it** | One-tap emotion chips, max 3 |
| **After-Action Review** (~20–25% performance lift) | The daily loop *is* a personal AAR, run on a schedule |
| **Consistency > intensity** | 3 questions, hard-capped; streak is the spine |
| **Never miss twice** | `applyEntry()` — one freeze/week saves a single missed day; two misses reset. Tested. |
| **Implementation intentions** (Gollwitzer) | Onboarding forces "After I ___, I reflect" + a reminder time |
| **Mental contrasting / WOOP** (Oettingen) | The weekly review's closing intention |
| **Agency** (Goldsmith's active questions) | Step 2 asks what *you* did to cause the good outcome |

The production system prompt in `supabase/functions/coach/index.ts` encodes the same priority order as `coach.ts`, so the offline and online coaches behave consistently.

---

## Deliberately excluded

Leaderboards, social feeds, guilt mechanics, notification spam, streak-loss punishment beyond the reset. Social comparison and extrinsic pressure undermine the intrinsic motivation a private reflective practice depends on. The reward is the practice, the insight, and the streak — nothing else.

---

## Deploying the web app

Any static host works. Vercel / Netlify / Cloudflare Pages:

- Build command: `npm run build`
- Output directory: `dist`
- Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_COACH_URL` as environment variables.

Serve over HTTPS — required for service workers and therefore for the PWA install prompt.

---

## Roadmap

**Phase 1 (this repo)** — daily loop, streak engine, XP, offline + AI coach, PWA.
**Phase 2** — magic-link auth UI, the full weekly review form, trend charts from daily data.
**Phase 3** — monthly arc with AI-drafted Integrity Report, fear-setting, seasons, Capacitor iOS + push, premium tier.
