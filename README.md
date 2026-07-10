# Facet

**A five-minute nightly reflection ritual, coached by AI.** Reflect on the day;
over time, a stone takes shape. That's the whole app.

React + TypeScript + Vite · installable PWA · optional Supabase sync · optional Claude coaching · Capacitor-ready for iOS.

---

## Run it right now (zero setup, zero keys)

```bash
npm install
npm run dev
```

Open the printed URL. **It works immediately** with no accounts and no API keys:

- reflections persist in `localStorage` and the Night mechanic runs entirely on-device
- direct feedback (Coach) is **online-only** — with no key configured it's simply skipped;
  the reflection and the Stone still work

You only need the steps below to turn on cloud sync and real Claude coaching.

### Online / offline

The reflection is local-first and always works offline — saved instantly, Night advances, no
network in the path. **Coach's reply is fetched only when online and skipped when offline**
(never a canned stand-in); an offline reflection is quietly read the moment you reconnect.
Reflections sync to Supabase under Row-Level Security via an anonymous session — no sign-in
screen required.

Other commands:

```bash
npm test        # the monotonic Night engine + Coach logic
npm run typecheck
npm run build   # production build + service worker
npm run preview # serve the production build
```

---

## What you need to provide

Everything is optional and independent — the app degrades gracefully if you skip either.

| # | What | Cost | Needed for | Status |
|---|------|------|-----------|--------|
| 1 | A **Supabase** project (free tier) | €0 | Sign-in + cloud sync across devices | ⏳ pending |
| 2 | An **Anthropic API key** | pay-as-you-go, cents/month for one user | Real Coach + weekly reads | ⏳ pending |
| 3 | An **Apple Developer account** | $99/yr | App Store submission only | ✅ |
| 4 | A **Mac with Xcode** | free | Building the iOS shell | needed for `ios:add` |

### 1. Supabase (enables sync)

1. Create a project at [supabase.com](https://supabase.com) (free tier is plenty).
2. Open **SQL Editor**, paste `supabase/migrations/0001_init.sql`, and run it. This creates
   `entries`, `insight_cards`, `profiles` and — importantly — **Row-Level Security** so no
   user can ever read another's reflections.
3. Go to **Project Settings → API** and copy the **Project URL** and the **anon public** key.
4. `cp .env.example .env.local` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

### 2. Anthropic (enables real Coach)

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

Restart `npm run dev`. The "offline" tag on Coach's replies disappears once real Claude is answering.

**Cost:** daily coaching runs on Claude Haiku, weekly synthesis on Sonnet
(`supabase/functions/coach/index.ts`). For a single user this is a few cents a month.

### 3. iOS — already wired up

Capacitor is configured (`capacitor.config.ts`, appId `so.facet.app`). On a Mac with Xcode:

```bash
npm run ios:add     # builds, then creates the ios/ project
npm run ios:open    # opens Xcode
```

After that, `npm run ios:sync` pushes any web changes into the native shell.

**Notifications are local, not push** (`src/lib/notifications.ts`) — the nightly reminder is
scheduled on-device via `@capacitor/local-notifications` at the time chosen during onboarding.
No APNs certificates, no server, works offline, and nothing about the user's reflections ever
leaves the device. That reminder is the implementation-intention cue that makes the habit work.

You can "Add to Home Screen" from Safari today and get a full-screen, icon-launched app with no
Apple account at all — enough to test 30-day retention before touching Xcode.

---

## Design system

Facet is **black and white only.** Background `#000`; every grey is white at an opacity token —
never a grey hex. **Colour exists in exactly one place: the Stone**, and only at the milestone
moment (Night 7 / 30 / 90 / 180 / 365) and in the Vault detail view. Never a background, tint,
border, or button. Structure comes from the type scale and whitespace — no cards, shadows,
icons, or emoji.

- **Tokens** — the single source of truth for every colour, size, space, radius, and motion
  value: `src/styles/tokens.css`.
- **Full spec** — `docs/design-system.md`.
- **Philosophy** — `CLAUDE.md` (read it before writing any code).

Three words carry the product: **the Stone** (the object your nights shape), **the Vault**
(where finished stones live), and **Night** (the only unit and the only number). The coach is
just **Coach**. Progression is *shown, never scored* — the stone moves Rough → Cut → Polished →
Brilliant; the Night count is the only number the user ever sees.

## Architecture

```
src/
  styles/
    tokens.css    Design tokens — the only source of colour/size/motion values.
  styles.css      Component layer, built entirely on the tokens.
  lib/
    types.ts      Domain model. EMOTIONS, CHARGED (drives self-distancing), Nudge.
    game.ts       The habit engine: monotonic Night clock + legacy migration.  ← tested
    guidance.ts   The occasional nudge: irregular gate + evidence-based library + lifecycle.  ← tested
    ai.ts         Online-only Coach: fetches the edge function when online, skips offline.
    supabase.ts   Null client when unconfigured → local-only. Anonymous session for sync.
    storage.ts    Local-first persistence + opportunistic cloud sync.
    store.ts      useFacet() — the single app hook. Owns online/offline + deferred catch-up + nudges.
    milestones.ts The five Stone colourways + the Rough→Cut→Polished→Brilliant stages.
  components/
    Onboarding.tsx      Captures the if-then cue (Gollwitzer). Reruns anytime as retune.
    DailyRitual.tsx     "Tonight" — the 3-step loop: moment → read → next step.
    AfterReflection.tsx Coach's read + the Night count + the Stone.
    Stone.tsx           The only colour in the app.
    Guidance.tsx        The occasional Coach nudge — commit, push back, or set aside.
    Reviews.tsx         Weekly and monthly reads.
    Vault.tsx           Banked stones + your own past words.
supabase/
  migrations/0001_init.sql    Schema + RLS.
  functions/coach/index.ts    Anthropic proxy. Holds the API key.
```

**Local-first.** The device is always the source of truth for writes. Supabase and Claude are
enhancements that can fail without breaking the app. `getCoachReply()` catches every error and
falls through to the offline coach — a network blip must never cost a user their night.

---

## How the research maps to the code

Nothing here is decorative. Each mechanic traces to a finding.

| Finding | Where it lives |
|---|---|
| **Specificity** (Pennebaker) | `DailyRitual` step 1 refuses to advance on an empty moment |
| **Self-distancing** (Kross) | `CHARGED` emotions in `types.ts` trigger the `distancing` intervention |
| **"What," not "why"** (Eurich) | `coach.ts` priority 1 detects why-spirals and rewrites them |
| **Name it to tame it** | One-tap emotion chips, max 3 |
| **After-Action Review** (~20–25% lift) | The nightly loop *is* a personal AAR, run on a schedule |
| **Consistency > intensity** | 3 questions, hard-capped |
| **Never punish** | `applyEntry()` adds one Night for a day's first reflection; missed nights only pause progress. Tested. |
| **Implementation intentions** (Gollwitzer) | Onboarding captures "After I ___, I reflect" + a reminder time |
| **Agency** (Goldsmith) | Step 2 asks what *you* did to cause the good outcome |

The intervention priority lives in one place — the system prompt in
`supabase/functions/coach/index.ts`. Offline, direct feedback is skipped rather than
approximated, and caught up on reconnect.

## Deliberately excluded

Leaderboards, social feeds, guilt mechanics, notification spam, streak-loss punishment beyond
the reset. Social comparison and extrinsic pressure undermine the intrinsic motivation a private
reflective practice depends on.

---

## Deploying the web app

Any static host works (Vercel / Netlify / Cloudflare Pages):

- Build command: `npm run build`
- Output directory: `dist`
- Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_COACH_URL` as environment variables.

Serve over HTTPS — required for service workers and therefore for the PWA install prompt.
