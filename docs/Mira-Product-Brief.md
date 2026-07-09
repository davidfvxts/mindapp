# Mira — Product Brief

### An AI reflection coach that turns the science of reflection into a 5-minute game you actually keep playing

*Working name: **Mira** (mirror · Latin "wonder" · a bright star — and the name of your AI coach). Web-first PWA, wrappable to iOS. Prepared July 2026.*

---

## 1. The one-line pitch

**Mira is a 5-minute-a-day reflection app where an AI coach reads what you write, gives you one sharp piece of feedback, and a game keeps you coming back — built entirely on what the research says actually makes reflection work.**

You already have the *system* (the Founder's Reflection System). The problem that kills every reflection habit is adherence, not content. Mira is the delivery mechanism: it removes the blank page, makes the streak feel like a game worth protecting, and gives you a coach that gets smarter about *you* over time.

---

## 2. Why this wins (the strategic bet)

Three things are simultaneously true in 2026, and almost no product sits at their intersection:

1. **The science of *what* makes reflection work is settled** — specificity, self-distancing, emotional labeling, action-orientation, and consistency. Most journaling apps ignore it and just give you a blank page or generic prompts.
2. **Gamification keeps habits alive** — but done cheaply (points, badges, leaderboards) it *undermines* the intrinsic motivation reflection depends on. There's a right way to do it, and it's underused.
3. **AI can finally close the feedback loop** — a journal that talks back, spots your patterns, and coaches you is now technically trivial and was impossible three years ago.

Mira's edge is doing all three *correctly at once*: evidence-based prompts, restrained gamification that reinforces rather than replaces intrinsic motivation, and an AI coach that turns solo journaling into a coached practice. For your positioning as an AI-driven creative agency, it's also a credible flagship product and a live demo of your capability.

---

## 3. Core design principle → feature mapping

Every mechanic traces to a specific finding from the research. Nothing is decorative.

| Research finding | Mechanism (why it works) | How Mira implements it |
|---|---|---|
| **Expressive writing** (Pennebaker, 200+ studies) | Turning a specific experience into a coherent narrative lowers its cognitive load | Daily entry always anchors on **one concrete event** ("the moment of today"), never a vague mood check |
| **Self-distancing** (Kross) | Referring to yourself as "you"/by name lowers emotional reactivity and sharpens thinking | **Distance Mode**: when an entry is charged, Mira replies in second person ("David, here's what I'm noticing…") and asks "what would you tell a founder in your position?" |
| **Name it to tame it** (emotional processing) | Labeling an emotion in words reduces its grip; ruminating deepens it | One-tap **emotion tags** on every entry; Mira reflects the label back and helps reframe, never amplifies |
| **"What," not "why"** (Eurich) | "Why" questions cause rumination; "what" questions produce insight and action | Prompts are structurally "what"-based; Mira's coach **actively rewrites "why" spirals into "what/what-next"** |
| **After-Action Review** (~20–25% performance lift) | Structured, repeated, specific debriefs drive learning | The daily loop *is* a personal AAR; weekly/monthly reviews are scheduled "boss levels" with the same structure each time |
| **Consistency > intensity** | A short practice done often beats a long one done rarely | Hard **5-minute cap**, streaks, and a **"Never Miss Twice"** safety net |
| **Implementation intentions** (Gollwitzer) | If-then cues beat willpower for habit initiation | Onboarding forces you to set your **cue** ("After I ___, I reflect") and time; push notification fires on that cue |
| **Mental contrasting / WOOP** (Oettingen) | Pairing a wish with its obstacle + if-then plan beats positive visualization | Weekly review ends in a guided **WOOP** to set next week's intention |
| **Gratitude** (Emmons & McCullough; modest but real) | A single specific gratitude lifts well-being | Optional one-line **gratitude prompt** as a daily counterweight — small, not central |

---

## 4. The product: three nested loops

Mira mirrors the reflection system's cadence — daily, weekly, monthly — as three game loops of increasing depth.

### Loop 1 — The Daily Ritual (the core, 3–5 min)

The screen you see every evening. Deliberately tiny so you never have an excuse to skip.

1. **The Moment** — "What's one thing that actually happened today?" (specificity)
2. **The Read** — tag the emotion + one line on what went well and what you did to cause it
3. **The Next Step** — "One thing you'll do differently tomorrow" (action-orientation)
4. **Mira responds** — the AI coach reads your entry and gives **exactly one** piece of feedback: a reframe, a pattern it noticed, or one sharper follow-up question. Never an essay.
5. **The reward** — streak ticks up, XP lands, a subtle animation. Done in under 5 minutes.

### Loop 2 — The Weekly Review (the "boss level," 20–30 min)

Unlocks after 5 daily entries in a week. Structured AAR across energy, creativity, product, leadership, relationships — surfaced as **trend charts built from your daily data**, so the review feels like reading your own dashboard, not starting from scratch. Ends in a guided **WOOP** intention for next week. Mira generates an **Insight Card** (see §5).

### Loop 3 — The Monthly Arc (the "season finale," 60 min)

Unlocks after 4 weekly reviews. Trajectory review + values/Integrity Report + fear-setting on the decision you're avoiding. Mira drafts a **first-pass monthly summary from your own entries** for you to edit — the single most valuable AI moment in the app. You set one **theme** for the next month (a "season").

---

## 5. Gamification — the right way

The design constraint: **reinforce intrinsic motivation, never replace it.** Cheap extrinsic rewards (leaderboards, social comparison, notification spam) are deliberately excluded because the research on both intrinsic motivation and rumination says they'd backfire for a private reflective practice.

**In (evidence-aligned):**

- **Streaks with "Never Miss Twice."** The streak is the spine. But you get **one automatic streak-freeze per week** — this directly encodes the only habit rule that matters ("missing once is fine, never miss twice") into a game mechanic, so a single bad day doesn't trigger the quit spiral.
- **XP & levels tied to the *practice*, not vanity.** XP for showing up and for depth (completing a full loop, hitting a weekly review). Levels unlock deeper features (weekly, then monthly), which **scaffolds the cadence** rather than dumping everything on day one.
- **Insight Cards — a collectible deck.** Each week Mira mints one card: a pattern it found in your writing ("Your best ideas this week all came before 9am"). Cards are the reward that makes the weekly review *worth it*, and the growing deck is a tangible record of self-knowledge (narrative integration, made collectible).
- **Seasons & themes.** Each month is a "season" with a theme you set and a monthly-review "finale." Gives rhythm and a fresh start every 30 days.
- **Gentle, variable reinforcement.** Mira's responses and animations vary so the reward never becomes fully predictable — but reminders stay calm and singular (one cue, not nagging).

**Out (deliberately):**

- ❌ Public leaderboards / social feeds (comparison harms intrinsic motivation and privacy)
- ❌ Loss-of-progress punishment beyond the streak (guilt kills habits)
- ❌ Notification spam (one cue-based reminder; that's it)
- ❌ Vanity badges with no meaning

---

## 6. The AI coach: "Mira"

Mira is the differentiator. She is a *coach*, not a chatbot — terse, warm, and evidence-driven. The app and the coach share one identity on purpose.

**What Mira does, by loop:**

- **Daily:** reads the entry, returns **one** intervention chosen by priority: (1) if she detects a "why"-spiral or rumination → rewrite it toward "what/what-next"; (2) if the entry is emotionally charged → offer a self-distanced reframe; (3) if she spots a recurring pattern vs. history → name it; (4) otherwise → one sharper follow-up question. She also validates specifically and briefly (not empty praise).
- **Weekly:** synthesizes the week into an **Insight Card** and a two-line "what to try next week."
- **Monthly:** drafts the trajectory summary and a first-pass Integrity Report from the user's own words.
- **Teaching:** occasionally (not every day) drops a 1-sentence **micro-lesson** on *why* a technique works, so the user gets better at reflecting — and better at working with an AI coach.

**"Gets better over time" means three concrete things:**

1. **Memory** — Mira references prior entries, so feedback is personalized and pattern-aware (this is the whole point of AI vs. a paper journal).
2. **Tuning** — a 👍/👎 on each Mira response adjusts tone and intervention style to your preference.
3. **Progression** — as your entries deepen, Mira's prompts escalate from scaffolding ("try naming the emotion") to advanced ("you keep avoiding this decision — fear-set it now").

**Example system prompt (production, abbreviated):**

> You are Mira, a reflection coach grounded in evidence-based psychology. The user just wrote a daily reflection. Respond with **one** short intervention (≤3 sentences), chosen in this priority order:
> 1. If they ask "why" about themselves or ruminate, gently rewrite toward "what specifically" and "what next."
> 2. If the entry is emotionally charged, offer a self-distanced reframe ("Looking at this from the outside, David…").
> 3. If it echoes a pattern in their history [HISTORY], name the pattern.
> 4. Otherwise, ask one sharper follow-up.
> Be specific, warm, and brief. Never lecture. Never give more than one thing to work on. End with nothing to do unless there's a clear next action.

**Model routing (cost-aware):** Claude Haiku for daily feedback (cheap, fast, high volume); Claude Sonnet for weekly/monthly synthesis (higher reasoning, low volume). Keeps unit economics healthy at scale.

---

## 7. Tech stack & the web → iOS path

Your hard requirement: one web app you can also ship to iPhone. The decisive choice:

- **Frontend:** React + TypeScript + Vite, styled with Tailwind. Built **PWA-first** (installable, offline-capable).
- **iOS:** wrap the same codebase with **Capacitor**. This is the right call over React Native or a separate native build — you reuse ~100% of the web code, and critically you get **native push notifications (APNs)**, which are essential because the daily reminder *is* the implementation-intention cue that makes the habit work. (React Native would mean a parallel codebase; Capacitor gives you App Store presence from your web app with a thin native shell.)
- **Backend:** **Supabase** (Postgres + Auth + Row-Level Security). Fast to stand up, and RLS gives you per-user data isolation out of the box — important for private journals.
- **Data model (core tables):** `users`, `entries` (daily), `reviews` (weekly/monthly), `insight_cards`, `streaks`, `settings` (cue, reminder time, tone prefs).
- **AI:** never call the model from the client. A thin **edge function** (Supabase Edge Function or Cloudflare Worker) proxies to the Anthropic API so your key stays server-side and you can cache/rate-limit.
- **Privacy as a feature:** local-first entry capture (IndexedDB) with **optional end-to-end-encrypted cloud sync**. For a journaling product, "your reflections never train anyone's model and are encrypted" is a real differentiator — market it.
- **Notifications:** web push (browser) + APNs (via Capacitor) firing on the user's chosen cue time.

**Build order:** ship the PWA first (validate the loop with real usage), wrap to iOS once the daily loop retains.

---

## 8. MVP phasing

**Phase 1 — Daily loop (validate retention).** Onboarding + cue-setting, daily ritual, emotion tags, streak with Never-Miss-Twice, XP/levels, single Mira daily feedback, local persistence. *This is the prototype accompanying this brief.*

**Phase 2 — Weekly + intelligence.** Weekly review, trend charts from daily data, Insight Cards, WOOP intention, cloud sync + auth.

**Phase 3 — Monthly + iOS.** Monthly Arc with AI-drafted summary and Integrity Report, fear-setting, seasons/themes, Capacitor iOS build, push notifications, premium tier.

---

## 9. Business model

Freemium. Free forever: the daily loop, streaks, basic stats — enough to build the habit. **Premium (~€8/mo or €70/yr):** full AI coaching depth, weekly/monthly AI synthesis, the Insight Card deck, trend analytics, and encrypted cloud sync. The AI is the paywall — free users get a taste, the coaching that makes it stick is paid. Optional: a one-time "lifetime" tier for early adopters to seed cash and testimonials.

---

## 10. Success metrics

The only metric that matters early is **retention**, because the entire thesis is "reflection that sticks." Track: D1/D7/D30 retention, **weekly active reflectors**, median streak length, % reaching first weekly review, % reaching first monthly arc, and Mira-feedback 👍 rate. Vanity installs are noise; a small cohort with 60-day streaks validates the product.

---

## 11. Risks & mitigations

- **AI feels generic → churn.** Mitigate with strict "one specific intervention" design and real memory of history; generic praise is banned in the prompt.
- **Gamification cheapens the practice.** Mitigate by excluding social/comparison mechanics and tying rewards to the practice itself (already designed in).
- **Privacy fear (people won't put real feelings in the cloud).** Mitigate with local-first + E2E-encrypted sync, and say so loudly.
- **Notification fatigue.** One cue-based reminder, user-controlled; never nag.
- **Cost of AI at scale.** Model routing (Haiku daily / Sonnet weekly) + caching keeps per-user cost well under the subscription price.

---

## 12. What's in the box with this brief

Alongside this document you have **`mira-prototype.html`** — a working, self-contained Phase-1 prototype. Open it in any browser (double-click). It demonstrates the real daily loop: onboarding with cue-setting, the three-step ritual, emotion tagging, a simulated Mira giving evidence-based feedback (why→what rewrites, self-distancing reframes, pattern-spotting), the streak with Never-Miss-Twice, XP/levels, and a small stats view. It persists your data locally, so your streak survives a refresh. The Mira coach in the prototype is rule-based to run offline; §6 above specifies exactly how to swap it for the real Claude API call.

**My recommendation on next step:** don't over-build. Ship the Phase-1 PWA (this loop + real Claude coaching + auth) to yourself and 10 founders, watch the 30-day retention, and only then wrap to iOS. If you want, I'll turn this prototype into the real React + Supabase + Anthropic starter repo next.
