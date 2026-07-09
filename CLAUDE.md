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
- A missed night is bridged automatically (once per month). No feature name —
  the copy simply says: *"Last night is covered."*

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
- **Never punish.** A missed night pauses progress; the stone never
  regresses, shatters, or greys out. Once a month, a single missed night is
  bridged automatically with a quiet note ("Last night is covered"). No
  guilt copy, ever. This app is used at bedtime — anxiety is a churn
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

**Blocked on David:** Supabase URL + anon key; Anthropic API key. With none of
these the app runs fully local: localStorage + the offline rule-based Coach.

### Commands
```bash
npm install
npm run dev        # runs with zero keys: localStorage + offline coach
npm test           # habit engine — the Night mechanic + never-miss-twice + internal XP
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
    types.ts        Domain model. EMOTIONS, CHARGED (drives self-distancing).
    game.ts         Habit engine: the Night mechanic, never-miss-twice, internal XP.  ← TESTED
    coach.ts        Offline rule-based Coach. Mirrors the production prompt's priority order.
    ai.ts           Calls the edge function; falls back to coach.ts on any error.
    supabase.ts     Null client when unconfigured → app runs local-only.
    storage.ts      Local-first persistence + opportunistic sync.
    store.ts        useFacet() — the single app hook.
    milestones.ts   The five Stone colourways (Night 7/30/90/180/365) + stage words.
  components/
    Onboarding · DailyRitual (Tonight) · AfterReflection · Stone · Reviews · Vault
supabase/
  migrations/0001_init.sql   Schema + Row-Level Security.
  functions/coach/index.ts   Anthropic proxy. Holds ANTHROPIC_API_KEY server-side.
```

`coach.ts` (offline) and the system prompt in `functions/coach/index.ts` encode the
**same** intervention priority (rumination → distancing → pattern → agency → follow-up).
If you change one, change the other.

### Engine invariant — do not "fix"
`game.ts` still computes `xp`/`level`/`streak` internally. **`xp` and `level` are
never shown** — they only drive the Stone's Rough→Cut→Polished→Brilliant stage.
`streak` is surfaced only as the **Night** count. **Never-miss-twice** (one
freeze/week bridges a single missed Night; two misses reset) is covered by 16
tests in `scripts/test-game.ts` — keep them green. The UI never shows a number
other than the Night count.

### The API key never touches the browser
Anthropic is called from the Supabase Edge Function (`supabase/functions/coach/index.ts`)
holding `ANTHROPIC_API_KEY` as a server-side secret. Notifications are **local**, not
push (`@capacitor/local-notifications`) — no APNs, no server, works offline.
Model routing: Haiku for daily coaching, Sonnet for weekly synthesis.

### Next steps, in order
1. Wire Supabase (keys pending) → magic-link auth UI, then enable sync.
2. Deploy the `coach` edge function with the Anthropic key → real Coach.
3. Ship the PWA to David + ~10 founders. **Watch 30-day retention** — the only
   metric that matters right now. Don't over-build ahead of it.

### Reference docs
`docs/design-system.md` (full visual spec), `docs/Reflection-System-2026.md` (the
research the product derives from), `docs/Mira-Product-Brief.md` (original product
brief — predates the Facet rename; treat its naming as historical).
