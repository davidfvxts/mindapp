# FACET — Design & Development Philosophy

You are building **Facet**: a 5-minute nightly reflection ritual, coached by AI,
with a quiet game layer. It is used at 11pm, on a phone, by tired founders.
It must feel like a precision instrument, never a wellness poster.

Read this before writing any code. When a decision isn't covered here,
apply the heuristics at the bottom — don't invent a new pattern.

---

## 1. The one-sentence product

Every night, five minutes of reflection; over time, a stone takes shape.
That's the whole product. Any feature that doesn't serve tonight's
reflection or the stone is scope creep — flag it, don't build it.

## 2. Voice & language

Plain words. The user is smart and tired — never make them decode anything.

**Three words carry the whole product. Everything else is plain English.**

- **the Stone** — the object your nights shape. Never: gem, badge, trophy, reward.
- **the Vault** — where finished stones live. Never: collection, achievements.
- **Night** — the only unit and the only number: "Night 34". Never: streak,
  run, chain, combo, day count.

Nothing else gets a name:
- The session isn't called anything. The app says **"Tonight"** and asks
  its question.
- The coach is just **"Coach"**. Never: AI, assistant, bot, Lapidary.
- A missed night adds nothing and costs nothing. The Night count only ever
  rises.

The metaphor lives in the **object**, not the vocabulary: facets appear on
the stone; nobody ever has to learn a jeweller's word.

**Banned vocabulary, everywhere (UI, notifications, code-facing copy):**
- Gamification jargon: XP, points, levels, achievements, unlock, streak, combo
- Wellness jargon: journey, mindful, self-care, gratitude, wellness, zen
- Craft/technical jargon: lapidary, girdle, culet, clarity grades, scores,
  percentages. (The GIA scale was explicitly rejected — never reintroduce it.)

**Progression is shown, never scored.** The stone's appearance IS the level:
**Rough → Cut → Polished → Brilliant** — at most one quiet word under the
stone. The night count is the **only number the user ever sees**. No
secondary counters, no percentages, no stats screens in v1.

**Tone:** short sentences. Concrete. Slightly warm, never cheerful.
Coach asks one question at a time and quotes the user's own words back
precisely. It never praises effusively ("Amazing job!! 🎉" is a fireable
offence); it acknowledges like a craftsman: "That's a clear one."

## 3. Visual law (summary — full spec in design-system.md)

1. **Black and white only.** Background is `#000`. Every grey is white at an
   opacity token — never a grey hex. If you are typing a colour hex outside
   the `--gem-*` tokens, stop and re-read this file.
2. **Colour exists only in the Stone**, only at the milestone moment and in
   the Vault detail view. Never as background, tint, border, chart, button,
   confetti, or marketing decoration. Not at 10% opacity. No exceptions.
3. **Structure comes from type scale and whitespace.** No cards, no shadows,
   no icons, no emoji, no icon fonts, no illustrations. If a layout feels
   unclear, fix the size jump or add black space — never add a box.
4. **Six type roles, five SF Pro weights, tabular numerals everywhere.**
   Use the roles in tokens.css; never invent an in-between size.
5. **Errors are monochrome too.** No red. Border weight + plain language.

## 4. Motion law

- Nothing bounces, nothing loops (except Coach's thinking pulse).
- Elements *develop* — fade + 8px rise, 420ms, settle easing — like a print
  in a darkroom. Press feedback 120ms. State changes 240ms.
- 1200ms belongs exclusively to the Stone reveal. Once, at earning.
- `prefers-reduced-motion` is a hard requirement in every component you
  ship: transforms off, fades ≤150ms, Stone renders static and coloured.

## 5. The game layer — rules of the mechanic

- **One stone at a time.** Each completed night adds one visible facet
  (monochrome). Milestones (Night 7 / 30 / 90 / 180 / 365) bring the colour
  moment; the stone is banked to the Vault; a new rough begins.
- **Inclusions:** Coach marks points inside banked stones; tapping one
  surfaces the user's own past words. Build the artefact as a container
  of reflections, not a badge.
- **Never punish.** A missed night adds nothing and costs nothing; the Night
  count only ever rises. The stone never regresses, shatters, or greys out.
  No guilt copy, ever. This app is used at bedtime — anxiety is a churn
  mechanic and a moral failure here.
- **Locked milestones show an outline only.** Never preview the colour.
- No leaderboards, no sharing prompts, no friend graphs in v1.

## 6. Engineering philosophy

- **Tokens are the only source of truth.** Every colour, size, space, radius,
  duration and easing comes from tokens.css. A hardcoded `16px` or `#999` in
  a component is a bug, even if it looks identical.
- **Every interactive component ships with all five states** — default,
  hover, focus-visible, active, disabled — or it doesn't ship. Focus ring:
  2px white, 3px offset, keyboard-only.
- **Accessibility is computed, not asserted.** Text ≥ 4.5:1, large text and
  UI boundaries ≥ 3:1 (the token table already guarantees this — don't
  bypass it). Progress and state are always readable as text, never colour
  or geometry alone. Respect dynamic type; layouts must survive 135% text.
- **Boring technology, small surface.** Prefer the platform. No dependency
  for anything under ~50 lines. No animation libraries — the motion spec is
  four durations and three curves; CSS/Core Animation can do it.
- **Offline-first for the reflection.** Writing must never block on the
  network. Coach's reply may arrive late; the reflection is saved locally
  the moment it's written. Losing a user's words is the one unforgivable bug.
- **Privacy is product.** Reflections are the most sensitive text a founder
  types anywhere. Encrypt at rest, never log content, never use entries in
  any analytics event. Analytics may count *that* a reflection happened,
  never *what* it said.
- **Performance budget:** cold start to writable field < 2s; the nightly
  path (open → write → done) must work flawlessly one-handed, in the dark,
  at lowest brightness.

## 7. Decision heuristics — when this file is silent

1. **Would a tired person at 11pm understand it in one glance?** If not, cut it.
2. **Does it make colour less scarce?** Then it's wrong, whatever it is.
3. **Does it add a number, a box, or an icon?** Find the version that doesn't.
4. **Instrument or poster?** An instrument shows a reading and gets out of
   the way. A poster explains, decorates and cheers. Build the instrument.
5. **When two implementations are equal, choose the one with less code.**
6. If genuinely stuck between product directions, stop and ask the founder —
   don't ship both behind a flag.

---

*Reference files: `src/styles/tokens.css` (all values), `docs/design-system.md`
(full spec). A `preview.html` living reference is not yet in the repo — build
to the spec until it exists.*

---

## Project operations (Facet, current state)

> Kept below the philosophy so the intent above always wins. These are the
> operational facts a new session needs; update them when they change.

**Owner:** David — founder/CEO, acts as PM. Technical, not a programmer.
Wants decisive senior recommendations over menus. Be concise; skip hedging.

**Stack:** installable PWA (React + TypeScript + Vite), wrapped to iOS with
Capacitor. Local-first, with optional Supabase sync and optional Claude coaching.

**Backend (Supabase project "Mindapp", ref `sxcuolzzigxzertblhlt`):** schema + RLS applied,
the `coach` edge function is deployed (verify_jwt on, reading `claude_secret_api_key`, currently
v17), `.env.local` is wired (URL + anon key + coach URL), and both manual dashboard steps are
done: the `claude_secret_api_key` secret is set (real Coach is live) and "Anonymous sign-ins" is
enabled (Authentication → Sign In / Providers — sync is live). `ANTHROPIC_API_KEY` remains
supported as a fallback for existing environments.

### Commands
```bash
npm install
npm run dev        # runs with zero keys: localStorage + offline coach
npm test           # monotonic Night engine + Coach logic
npm run typecheck
npm run build      # production + service worker
npm run ios:add    # Mac + Xcode: creates ios/
npm run ios:sync   # push web changes into the native shell
```

### Architecture
```
src/
  styles/tokens.css   The design tokens. The ONLY source of colour/size/motion values.
  styles.css          Component layer, built entirely on the tokens.
  lib/
    types.ts        Domain model. EMOTIONS, CHARGED, CoachMemory (profile/themes/commitments).
    game.ts         Habit engine: the monotonic Night clock + legacy migration.  ← TESTED
    coachMemory.ts  Local-first coach memory: curate() (recency + long-ago recall),
                    narrative, full weekly revision, renegotiation, rating folds,
                    stem-lite theme matcher. Bounded.  ← TESTED
    onboarding.ts   Guided-intake → profile seed + deterministic First Read.  ← TESTED
    guidance.ts     The occasional nudge: irregular gate + evidence-based library + lifecycle.  ← TESTED
    morning.ts      The loop beyond 11pm: Today bookend (win + adaptive question), intention line, comeback. PURE.  ← TESTED
    weekly.ts       Weekly review pacing: readiness + quiet-synthesis clocks; WOOP types. PURE.  ← TESTED
    monthly.ts      Monthly arc pacing (readiness) + the live-decision signal. PURE.  ← TESTED
    inclusions.ts   The marked points inside a banked stone (deterministic). PURE.  ← TESTED
    ai.ts           Online-only Coach: sends entry + curated memory; returns reply + memo. Also fetchNudge().
    supabase.ts     Null client when unconfigured → local-only. ensureSession() = anon auth.
    storage.ts      Local-first persistence + opportunistic sync (unsynced entries).
    drafts.ts       In-progress writing survives anything: debounced per-flow drafts.  ← TESTED
    store.ts        useFacet() — the single app hook. Owns online/offline + deferral + memory merge + nudges.
    milestones.ts   The five Stone colourways (Night 7/30/90/180/365) + stage words.
    stoneGeometry.ts The Stone's evolving form: five cuts, one facet per Night,
                    deterministic light/jitter — the game layer's centerpiece.  ← TESTED
  components/
    Onboarding · DailyRitual (Tonight) · AfterReflection · Stone · Guidance · Reviews · Vault
supabase/
  migrations/0001_init.sql   Schema + Row-Level Security.
  functions/coach/
    logic.ts        Triage + model routing + data-block builders. PURE.  ← TESTED
    prompts.ts      COACH_CORE voice contract + one expert module per intervention. PURE.
    index.ts        Deno glue: triage → route → assemble → call Claude → reply. Holds the key.
```

The intervention priority (rumination → distancing → pattern → fear-setting → agency →
celebration → accountability → follow-up) lives in **`logic.ts` (triage) + `prompts.ts`
(expert modules)**. `scripts/test-coach.ts` covers it, plus routing and the memory merges.
There is no offline rule-based coach — see "Online / offline" below.

### Online / offline — the core contract
The reflection is **local-first and always works offline**: it's saved the instant it's
written and the Night advances, with no network in the path. **Direct feedback (Coach's
reply) is online-only** — fetched live when online, and *skipped* when offline rather than
faked with a stand-in. An offline reflection is flagged `pendingCoach`; the moment
connectivity returns, `store.ts` quietly fetches the owed reply, attaches it, and says so
with one toast ("Coach read Tuesday's night. It's in the Vault.") — no hijacking tonight's
screen. Past Coach reads are always readable under their nights in the Vault list. The
weekly read is online-only too. This is deliberate: maximum value online, still fully
usable offline.

### The answer turn — one answer, one close
After an **online** nightly Coach read, the user may optionally choose **Answer Coach** once.
Their answer is saved to the `Entry` locally **before** any request starts, then synced inside
the existing `entries.coach` JSONB payload along with the final close. `mode:'answer'` on the
edge function receives the entry, original read, answer, and curated memory; it derives the
same model tier from the original intervention via `routeModel`, runs thinking-off, and returns
one closing line of at most two sentences plus a memo. The answer and close are part of future
Coach context (history + memo) and appear with the original read in the Vault.

This is deliberately not a chat thread: no second answer, no follow-up question in the close,
and no retry queue. If the user is offline or the close request fails, the answer remains saved
and the exchange ends without a fabricated close or reconnect catch-up. Keep this boundary
simple; the nightly ritual must stay optional, short, and safe to leave at any point.

### The loop beyond 11pm — the Today bookend, morning note + comeback
The intention written at night ("one thing I'll do differently") comes back **the next
morning**, when it can be acted on (Gollwitzer: cues work at execution time): a quiet
`Today: <intention>` line on the Tonight screen (`morning.ts` → `intentionForToday`, shown
for a 1–2-night-old open intention only), plus an optional one-shot **local** morning
notification (`settings.morningTime`, default 08:30, one-tap off in onboarding/retune;
rescheduled after every reflection so the text is always tonight's intention). After a real
lapse (**≥2 missed nights**), Tonight shows one quiet inline line above the first field:
"You're back. Night N is waiting — one moment tonight is enough." It adds no tap and is
acknowledged automatically when tonight's reflection saves (`state.comebackAck` records the
prior `game.lastDay`). No guilt copy, no streak vocabulary, Night count the only number.

**The Today bookend (~2 min, daylight only, fully skippable):** one specific **win** for the
day ("What would make today a win?" — Locke & Latham: the evening AAR then debriefs against a
declared objective) plus **Coach's one adaptive morning question**. The question is written
THE NIGHT BEFORE by the daily reply (`memo.morningQuestion` — zero extra API calls, zero
morning latency, works offline); offline nights fall back to a deterministic library in
`morning.ts` keyed on real signals (charged yesterday / slipping intention / recurring
theme) — and a clean day rightly gets NO question. The bookend is stored in
`state.mornings` (bounded), stamped onto the night's entry (`entry.morning`, synced via the
`morning` jsonb column, migration 0002), and sent with the daily call so Coach weighs
tonight against the declared win — plainly, never with guilt. Step 2 of the ritual shows
"This morning's win: …" so the debrief runs against it. Questions belong to mornings;
nights close loops.

### Sync — explicit opt-in (the privacy contract)
Backup & sync is **user consent, not a default**: `settings.sync` (chosen on the welcome
screen, changeable in Revisit setup) gates ALL of it. Only when it's `true` does
`supabase.ts` sign the device in **anonymously** (no magic-link UI needed) and
`storage.ts` push unsynced entries under RLS. With sync off, **no account is created and
no reflection is ever stored off the device** — Coach still reads a night live to reply
(a separate, visible act; `authHeaders` falls back to the anon key). Legacy states
(`sync: null`) migrate once on load: `true` only if the device already had a session.
A real sign-in can later be linked to the anonymous user, carrying history over.
Requires "Anonymous sign-ins" enabled in the project's Auth settings.

**Erase everything** lives at the end of the retune flow behind a two-step confirm
(never beside a routine action): it deletes the user's backup rows FIRST when a session
exists (online required — refuses rather than half-erase), then signs out, clears all
drafts, and wipes local state. Never claim at-rest encryption in copy — it isn't built.

### Drafts — words are never lost
`lib/drafts.ts` (TESTED) persists every writing surface's in-progress text to
localStorage, debounced, keyed per flow (`tonight.<date>`, `onboarding`,
`answer.<entryId>`, `weekly`, `monthly`). Surfaces hydrate from their draft on mount
(one quiet "Picked up where you left off." line — no box), save on change, and clear on
successful submit. The weekly/monthly reviews resume from the Reviews landing
("Continue the review"), and the monthly resume reuses the saved AI draft — no second
call. Keep this wired on any NEW writing surface.

### Engine invariant — do not "fix"
`game.ts` keeps one progression value: **`nights`**, the total number of days with a
completed first reflection. It increments once per day and never resets; a gap simply
does not add a Night. `lastDay` drives same-day detection and the comeback line. Old
`xp`/`level`/`streak`/`best`/`freezes` state is folded into the highest safe Night count
on load and never written back. XP, levels, streaks, and freezes are **removed**. The
stone stage and milestones derive from `nights`; `scripts/test-game.ts` guards this
contract. The UI never shows a number other than the Night count.

### Coaching engine — expert-driven, multi-model, learns who you are
Every reply is a real intervention, not chat. The flow (stateless server, local memory):
1. **Triage** (`logic.ts`, deterministic) reads tonight's entry + the memory the client sends
   and picks the one intervention, in the research priority order above.
2. **Route** — different models for different feedback: charged / why-spiral / decision-avoidance
   / recurring-pattern → **Opus 4.8**; everything else → **Sonnet 5** (the near-Opus daily floor).
   Weekly synthesis + the onboarding First Read → **Opus 4.8**. Daily runs thinking-off for a fast
   nightly loop; weekly/onboarding think. **Haiku 4.5 stays wired as the scale lever** — route the
   lightest nights to it (one line in `routeModel`) once you're optimising cost at scale; for the
   testing phase Sonnet is the floor so first impressions land.
3. **Assemble** (`prompts.ts`) — `COACH_CORE` (identity + the five mechanisms + hard rules +
   voice-mirroring) plus the ONE expert module for the chosen intervention (Pennebaker, Kross,
   Eurich, Goldsmith, Ferriss, Oettingen…). Each cites the finding in `docs/Reflection-System-2026.md`.
4. **Reply** carries a small `memo` (1–3 theme tags, commitment outcome, voice read); the weekly
   reply carries a `profileDelta`. Both fold into **local** `CoachMemory` via `coachMemory.ts`.

**Bedside manner (hard rules in `COACH_CORE` — keep these):** it's 11pm, so nightly replies
CLOSE loops — never a question that demands an answer tonight; anything worth asking is handed
to the morning ("Tomorrow, ask yourself…"), and charged nights end parked. Coach replies in the
language the user writes in (German entry → German reply). An entry signalling acute distress
gets a quiet signpost to a real person/professional instead of an intervention — no diagnosis,
no lists. Reply ratings tune tone **one step at a time** (sharper↔default↔gentler — never jumping
over a level) and file the fired move under landed/avoided so Coach learns what works;
the baseline comes from the calibration question in onboarding/retune.

**Memory is local-first** (in app state, persisted, synced like entries — no server state, no
new table) **and it can change its mind (memory v2):**
- **The narrative** (`profile.narrative`, ~120 words): Coach's running note on who the user is
  and how they're CHANGING — written and revised by every weekly pass, prepended to every
  coaching call. Narrative carries what flat lists can't: trajectory, tension, shifts.
- **Full revision, not accretion:** the weekly pass receives the CURRENT profile and returns
  the COMPLETE revised one (`applyWeeklyRevision`) — whatever it omits is deleted. Deliberate
  forgetting; stale goals don't survive by accident. Daily memos still merge lightly
  (`applyMemo`); onboarding/retune seeds still merge via `mergeWeeklyDelta`.
- **Theme ledger** (first/last/count) with a **stem-lite matcher** (`themeMatches`, mirrored in
  server `logic.ts` for the pattern echo): recall survives plurals, inflections, German
  compounds — "investor" recalls "die Investoren".
- **Commitment ledger** with **renegotiation**: an intention past its TTL goes `stale` instead
  of dying silently; Guidance shows one "An intention, adrift" card — *Still on it* (re-armed,
  dated today) or *Let it go* (retired, no guilt). One renegotiation at a time.
- **Ratings teach the moves** (`foldRating`): "That's right"/"Not quite" files the fired
  intervention under `landed`/`avoided` immediately (latest verdict wins) — Coach learns which
  moves work on THIS person without waiting for the weekly pass. Tone drifts one step per
  rating (sharper↔default↔gentler) and never jumps; the baseline is set by the **calibration
  question** in onboarding/retune ("How should Coach push?" → gentler/default/sharper, all
  three honored server-side).
`curate()` sends Coach the narrative + recent nights verbatim + older nights a live theme
echoes + what's owed — so it knows both tonight and what you said weeks ago, in your voice.

### Onboarding = coach intake + the wow moment
The guided flow (`components/Onboarding.tsx` → `store.beginJourney`) is the product from minute one:
a gamified, ~2-minute intake (name → goals → world → obstacle → the implementation-intention cue)
that **seeds the profile deterministically** (so Coach knows the user with or without the network),
then runs their **first real reflection**, then hands back a personalised **First Read** as Night 1's
Stone forms. Online, `mode:'onboarding'` gets an **Opus 4.8** First Read + a profile extraction
(`onboarding.ts` seed is enriched by the AI `profileDelta`); offline, `deterministicFirstRead()`
stitches a specific read from their answers so the moment still lands. Colour stays scarce — Night 1
is a greyscale Rough stone; the wow is the read + the object, never an early gradient.

### Guidance = the occasional nudge, not a content feed
The **Guidance** tab is where Coach leaves *one* thing worth trying — a tip, action, habit,
routine, or reading — the way a good coach mentions a single idea between sessions. It is
deliberately **not** a catalogue the user grinds through:
- **Irregular & rare.** `dueForNudge()` gates on the Night clock: never two nights running,
  an irregular 2–5-Night gap, and only **one open nudge at a time**. `lastNudgeCheck` advances
  on every check (even when nothing surfaces), so it never feels scheduled or daily.
- **Only when it counts.** Online, `mode:'guidance'` sends recent nights + memory to **Opus 4.8**
  (with thinking) which returns one bespoke nudge fitted to the user *or* `{skip:true}` when
  nothing meaningful applies — holding back is the common, correct answer. Offline (or if the
  model can't be reached), `pickOfflineNudge()` draws from an **evidence-based library** in
  `guidance.ts` (methods: Pennebaker/Kross/Eurich/Goldsmith/Ferriss/Oettingen/Clear; plus real,
  credible readings — books, podcasts, blogs, films — goal-gated so only the user's aims show).
- **Every nudge explains its value** and is interactive: **I'll try this** (commit → Coach checks
  in a few nights on, "how did it go?", never punishing), **Not for me** (set aside), plus an
  optional note to push back or ask for help. Lifecycle is pure + tested; state is local
  (`state.nudges`), persisted and synced like everything else — no new table.

### The weekly review = the user's work, structured by Coach
The weekly is a GUIDED flow (`Reviews.tsx`), not a one-tap card: check-in on last week's
standing intention ("did it hold?") → three prompts (wins & causes / what got in the way —
"what", never "why" / the decision being avoided) → a captured **WOOP** (wish → outcome →
internal obstacle → if-then). Coach's read (Opus 4.8, thinking) receives THEIR answers +
THEIR WOOP alongside the nights — it builds on what they saw and **pressure-tests their
WOOP** rather than writing its own. The if-then becomes a **standing weekly intention** on
the nudge lifecycle (`weeklyIntentionNudge`, kind `intention`, born committed, check-in
~5 nights on, resolved in Guidance or at the top of the next review). Pacing lives in
`weekly.ts`: `weeklyReady` (≥5 nights in the trailing week + ≥5 nights since the last
guided review → quiet dot on the Reviews tab) and `quietSynthesisDue` — **memory no longer
depends on the button**: a week left untouched gets a background memory-only synthesis
(profileDelta folds in, no card, nothing shown, ready marker stays). Past reads list on
the Reviews landing.

### Visible growth — the callback, the monthly arc, inclusions
Growth is made FELT, in words never numbers:
- **The Stone evolves nightly** (`stoneGeometry.ts` + `Stone.tsx`, TESTED): the stone on the
  bench starts as a jittered rough; every Night cuts ONE facet (tonight's is freshly bright on
  the after-reflection screen via `newFacet`) and trues the silhouette toward the final form
  (jitter eases to zero at the milestone). Each milestone has its OWN cut — Ember a keen
  classic (7 facets), Tide a cushion (23), Iris an oval (60), Aurora a pear (90), Solstice a
  round brilliant (97 capped) — so a banked stone literally carries its span's work. Light is
  a fixed key light with per-facet brightness + achromatic speculars; colour contexts add a
  deep radial body, a screen-blended turbulence FIRE of the stone's own palette (colour lives
  INSIDE the stone), one gloss, a rim light and the soft glow — ONLY in the reveal/Vault-detail
  (colour law intact). **The milestone stone arrives encased in rock** (`rockShell`: lit
  fractal-noise shards that tile exactly) and shows ZERO colour until the user CRACKS IT OPEN —
  one press, shards burst along precomputed drifts, the gem reveals with the 1200ms beat + one
  glint, then the read develops in (`develop-late`) under a quiet echo of the span's first
  night (`milestoneEcho`, quoted exactly). Reduced motion: instant swap, no shards, coloured.
  All geometry is deterministic — same night, same stone, every device.
- **The callback** (prompt-level, rare): a hard rule in `COACH_CORE` lets Coach set tonight's
  words against the user's OWN words from weeks ago when a theme has spanned time and the
  language has clearly shifted — quoting BOTH exactly, never inventing a quote. `curate()`
  biases recall toward SPAN (keeps the oldest theme-echo, not just recent ones) so the raw
  material exists. It still counts as the one nightly move.
- **The monthly arc** (`Reviews.tsx` → `beginMonthly`/`completeMonthly`, server `mode:'monthly'`,
  Opus 4.8 thinking): gated on ≥`MONTHLY_UNLOCK` weekly reads + spaced by `monthly.ts`
  (`monthlyReady`, `ARC_GAP`). Coach drafts the month's **trajectory** (with callbacks) + a
  **theme** suggestion + a full profile revision; the user edits the trajectory, names a
  Clear **Integrity gap**, does **Ferriss fear-setting** *only if a decision is live*
  (`liveDecision`), and sets **one theme** for the month. The theme is stored (`state.monthTheme`)
  and rides every nightly read (`memory.monthTheme`) — weighed lightly, never forced. Past arcs
  list on the Reviews landing; the read is banked to `state.arcs`.
- **Inclusions** (`inclusions.ts`, Vault detail): a banked stone shows 1–4 marked points chosen
  deterministically from the nights in its span (the night it formed, the hardest, the clearest,
  where a theme began); tapping one surfaces the user's own words from that night. The i-th
  oldest reflection maps to Night i, exactly matching the monotonic Night history.
  The stone becomes a container of reflections; colour stays exactly as scarce.

**Retune anytime.** `components/Onboarding.tsx` runs in `mode:'retune'` from the Vault's "Revisit
setup" — updates settings and augments the profile (`store.retune`), no new entry, no Night change.

### The API key never touches the browser
Anthropic is called from the Supabase Edge Function (`supabase/functions/coach/`) holding
`claude_secret_api_key` as a server-side secret (`ANTHROPIC_API_KEY` is a compatibility
fallback). Notifications are **local**, not push
(`@capacitor/local-notifications`) — no APNs, no server, works offline; the evening cue reminder and the one-shot morning note both schedule on-device.

### Next steps, in order
1. Ship the PWA to David + ~10 founders. **Watch 30-day retention** — the only
   metric that matters right now. Don't over-build ahead of it.
2. Later: magic-link auth UI (link it to the anonymous user so history carries over).

### Reference docs
`docs/design-system.md` (full visual spec), `docs/Reflection-System-2026.md` (the
research the product derives from), `docs/Mira-Product-Brief.md` (original product
brief — predates the Facet rename; treat its naming as historical).
