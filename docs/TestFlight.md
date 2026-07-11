# Facet → TestFlight

Everything in this repo is ready; the only machine that can do the last mile
is a Mac with Xcode, because Apple requires it for signing and upload. Total
time first run: ~45 minutes (most of it App Store Connect forms). Every run
after that: ~10 minutes.

The iOS project is committed and configured: bundle id `so.facet.app`,
display name **Facet**, iPhone-only, portrait-only, forced dark UI, black
launch screen, light status bar, app icon, privacy manifest, and
`ITSAppUsesNonExemptEncryption = NO` (the app uses only standard HTTPS, so
Apple's export-compliance question is answered once, in the project, forever).

---

## 0. One-time prerequisites

1. **Apple Developer Program** membership (99 USD/yr) on your Apple ID —
   [developer.apple.com/programs](https://developer.apple.com/programs/).
2. A Mac with **Xcode 15+** (App Store) and **CocoaPods**
   (`sudo gem install cocoapods`, or `brew install cocoapods`).
3. Node 18+ on the Mac.

## 1. Build the app (Mac terminal)

```bash
git clone https://github.com/davidfvxts/mindapp.git && cd mindapp
npm install
npm test                    # 313 checks — everything green before shipping
npm run ios:sync            # builds the web app + syncs it into ios/ + pod install
npm run ios:open            # opens ios/App/App.xcworkspace in Xcode
```

`npm run ios:sync` is the whole web→native pipeline; run it again after any
web change. Production config is committed in `.env.production` (public
client values only — the Claude key lives server-side in the edge function).

## 2. Sign it (Xcode, once)

1. Xcode → project navigator → **App** → target **App** → *Signing &
   Capabilities*.
2. Tick **Automatically manage signing**, choose your **Team**.
   Xcode registers `so.facet.app` and creates the profiles itself.
3. That's it — no capabilities to add (notifications are local, no push
   entitlement needed).

## 3. Archive & upload (Xcode, every release)

1. Top bar device selector → **Any iOS Device (arm64)**.
2. Menu **Product → Archive** (a few minutes).
3. In the Organizer window that opens: **Distribute App → TestFlight &
   App Store → Upload**, accept the defaults, Upload.
4. Apple processes the build for ~5–15 minutes; you'll get an email.

For the **next** build: bump the build number first (target App → General →
*Build*, e.g. 1 → 2 — or just edit `CURRENT_PROJECT_VERSION` in
`ios/App/App.xcodeproj/project.pbxproj` here and commit). Marketing version
stays `1.0` until you decide otherwise.

## 4. App Store Connect (once, before the first build is testable)

At [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → My Apps →
**＋ New App**: platform iOS, name **Facet** (if taken: "Facet — nightly
reflection"), language English, bundle id `so.facet.app`, SKU `facet-001`.

**App Privacy** (required before external testing; internal testing works
without it). These answers mirror `ios/App/App/PrivacyInfo.xcprivacy` — keep
both in sync if the product changes:

| Data type | Collected? | Linked to identity? | Tracking? | Purpose |
|---|---|---|---|---|
| User Content → Other User Content (reflections & conversations, only when backup is on) | Yes | Yes | No | App Functionality |
| Contact Info → Email Address (only the manually-created pilot logins) | Yes | Yes | No | App Functionality |
| Identifiers → User ID (random per-install analytics token) | Yes | No | No | Analytics |
| Usage Data → Product Interaction (event names only, never content) | Yes | No | No | Analytics |

Everything else: **Not collected**. "Do you track users?" → **No**.

## 5. Invite testers

- **Internal** (you, instantly): TestFlight tab → Internal Testing → add
  yourself → the build appears in the TestFlight app on your phone.
- **External** (the ~10 founders): create an External group, add the build —
  the first external build goes through a light Apple review (usually <24h;
  give it a one-line "What to Test" note) — then invite by email or share the
  public link.

## 6. What to verify on the phone (first install)

- [ ] Cold start lands on the black welcome in well under 2s; no white flash.
- [ ] Onboarding through the First Read; the stone ignites.
- [ ] Notifications: allow the permission prompt; check the evening reminder
      and morning note arrive (they're local — no server involved).
- [ ] Press-and-hold the stone: the film develops **with the haptic pulse**
      (this is the native win — the web can only vibrate on Android).
- [ ] Airplane mode: write a reflection — it saves, Night advances, and the
      read arrives quietly after reconnect.
- [ ] A conversation: the reply, the name it gets, and that it's findable
      under Vault → Conversations.
- [ ] Keyboard up at every writing surface: the field stays visible; nothing
      hides behind the notch or the home indicator.

## Server prerequisites (same as the web pilot)

The app points at the live Supabase project. Before handing builds to
testers, the two pending dashboard steps must be done or Coach/analytics
degrade honestly but visibly:

1. **Redeploy the `coach` edge function** from current `main` (the deployed
   v17 predates conversations and the onboarding why-now).
2. **Apply migrations** `0003_events.sql` + `0004_conversations.sql`
   (SQL Editor or `supabase db push`).

## Rebuilding after changes

```bash
git pull
npm run ios:sync
# Xcode: bump Build, Product → Archive, Distribute
```
