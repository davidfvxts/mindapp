# The Stone — Higgsfield generation kit (v3, "The Light Learns Its Shape")

Concept: docs/Stone-Story.md. The stone is a mystical crystal monolith with a
luminous heart-thread; every Night one more face WAKES with silver light;
every 7th night a RING LOCKS (structural shift); at the milestone the crystal
floods with colour. Nightly frames are ACHROMATIC (silver/white/obsidian —
radiant, never dull); colour exists only in the milestone finals.

Files land in:
- Finals (colour):   `public/stones/<stone>.webp`  (+ `rock.webp` = the sealed geode)
- Nightly frames:    `public/stones/progress/<stone>-<n>.webp`

Any missing frame falls back to the procedural stone — partial batches ship.
ALWAYS run batches through `node tools/gemrig/ingest.mjs <dir> <outDir>`:
it keys the background, normalizes the crystal to an identical size and
centre in every frame, force-desaturates progress frames, and exports webp.

---

## 1. THE MASTER STYLE BLOCK (append to every single prompt, verbatim)

> Ultra-detailed 3D render of a single levitating crystal monolith — an
> otherworldly gemstone that does not exist in nature: an elongated,
> slightly asymmetric crystalline form with sharp angular faces,
> semi-translucent obsidian-dark glass body, and a thin luminous filament
> of light suspended in its core like a captured star-thread. Faint
> drifting light particles around it, soft volumetric glow, floating
> centred on a pure black background. Cinematic studio lighting, cool key
> light from the upper left, subtle rim light tracing the silhouette.
> Hyperreal octane render, 2026 sci-fi jewellery aesthetic, mystical and
> precious. Square composition, no pedestal, no hands, no text.

## 2. GENERATE THE TWO ANCHORS PER STONE (once each)

**Anchor A — Night-1 state** (`<stone>-1` after ingest):

> [MASTER STYLE BLOCK] The crystal is almost entirely asleep: matte dark
> obsidian faces — except its core, where the star-thread has just IGNITED,
> and one single face at the lower left of the crystal has woken, glowing
> softly from within with silver-white light. Completely achromatic:
> silver, white and deep greys only. The moment the light takes.

**Anchor Z — fully awakened, still colourless** (the edit-chain target):

> [MASTER STYLE BLOCK] The crystal fully awakened: every face glowing from
> within with layered silver-white light, the star-thread blazing in the
> core, rings of faces locked in brilliant alignment — yet completely
> achromatic: silver, white and deep greys only. Radiant moonlight made
> solid.

Regenerate until you love BOTH. They define the stone's identity. For the
second and third stones, pass the previous stone's anchors as style
references and vary the silhouette words: Ember = "a tall keen shard";
Tide = "a broad, wave-smoothed prism"; Iris = "a slender twin-peaked spire".

## 3. THE FRAME CHAIN (the consistency tactic)

Never generate frames independently. **Edit forward from Anchor A**, one
frame per night, attaching BOTH the previous frame (as the image to edit)
and Anchor Z (as the target reference). Per-frame edit prompt:

> Edit this image. Keep the crystal's shape, camera, framing, position and
> size EXACTLY identical; keep every already-glowing face exactly as it is.
> Change ONE thing: the light has spread further toward the target
> reference — about {LIGHT}% of the crystal's faces now glow, and one newly
> woken face at {POSITION} shines the brightest of all (fresh tonight).
> Everything still completely achromatic: silver, white, deep greys.

On **RING-LOCK frames** append:

> Additionally, tonight a whole ring of faces around the crystal's girdle
> LOCKS into brilliant alignment — a clearly visible structural shift; the
> silhouette steps closer to the target reference's final form.

Fill {LIGHT} and {POSITION} from the table below. Export every frame named
`<stone>-<step>.webp` (the STEP column, not the app Night), then ingest.

## 4. THE MILESTONE FINALS (colour — the only colour anywhere)

**Ember final** (`ember.webp`):

> [MASTER STYLE BLOCK] The crystal fully awakened and FLOODED with living
> colour for the first time: fiery orange #FF6A3D flowing into deep crimson
> #C2273B, glowing like an ember sealed in glass, the star-thread white-hot
> in the core, a soft matching glow behind the crystal fading fully to
> black inside the frame. No other hues.

**Tide final** (`tide.webp`): same, with "bright teal #35D0BA flowing into
deep ocean blue #2563EB, glowing like moonlit water sealed in glass."

**Iris final** (`iris.webp`, needed at day 90): "violet #7C5CFF flowing
into vivid magenta #C838F0, like an iris of light."

**The sealed geode** (`rock.webp` — what the user opens at every milestone):

> [MASTER STYLE BLOCK] The crystal SEALED inside a closed, rough, dark
> stone geode: matte charcoal mineral shell, faint hairline seams across
> its surface glowing dimly silver from within, as if something radiant is
> held inside. No colour anywhere — pure greys. Quiet, heavy, precious.

## 5. THE 60-DAY FRAME TABLE (exact, per night)

Step = the number in the filename. Ember has no interior week-lock — its
whole span is week one; the milestone is its lock.

| App Night | File | Step | Light | Tonight's face wakes at | Week-lock |
|---|---|---|---|---|---|
| 1 | `ember-1.webp` | 1/7 | ~14% | the lower left of the crystal | — |
| 2 | `ember-2.webp` | 2/7 | ~29% | the lower right | — |
| 3 | `ember-3.webp` | 3/7 | ~43% | the mid left flank | — |
| 4 | `ember-4.webp` | 4/7 | ~57% | the mid right flank | — |
| 5 | `ember-5.webp` | 5/7 | ~71% | the upper left shoulder | — |
| 6 | `ember-6.webp` | 6/7 | ~86% | the upper right shoulder | — |
| 8 | `tide-1.webp` | 1/23 | ~4% | the lower left of the crystal | — |
| 9 | `tide-2.webp` | 2/23 | ~9% | the lower right | — |
| 10 | `tide-3.webp` | 3/23 | ~13% | the mid left flank | — |
| 11 | `tide-4.webp` | 4/23 | ~17% | the mid right flank | — |
| 12 | `tide-5.webp` | 5/23 | ~22% | the upper left shoulder | — |
| 13 | `tide-6.webp` | 6/23 | ~26% | the upper right shoulder | — |
| 14 | `tide-7.webp` | 7/23 | ~30% | just beneath the crown | **RING LOCKS** |
| 15 | `tide-8.webp` | 8/23 | ~35% | the lower left of the crystal | — |
| 16 | `tide-9.webp` | 9/23 | ~39% | the lower right | — |
| 17 | `tide-10.webp` | 10/23 | ~43% | the mid left flank | — |
| 18 | `tide-11.webp` | 11/23 | ~48% | the mid right flank | — |
| 19 | `tide-12.webp` | 12/23 | ~52% | the upper left shoulder | — |
| 20 | `tide-13.webp` | 13/23 | ~57% | the upper right shoulder | — |
| 21 | `tide-14.webp` | 14/23 | ~61% | just beneath the crown | **RING LOCKS** |
| 22 | `tide-15.webp` | 15/23 | ~65% | the lower left of the crystal | — |
| 23 | `tide-16.webp` | 16/23 | ~70% | the lower right | — |
| 24 | `tide-17.webp` | 17/23 | ~74% | the mid left flank | — |
| 25 | `tide-18.webp` | 18/23 | ~78% | the mid right flank | — |
| 26 | `tide-19.webp` | 19/23 | ~83% | the upper left shoulder | — |
| 27 | `tide-20.webp` | 20/23 | ~87% | the upper right shoulder | — |
| 28 | `tide-21.webp` | 21/23 | ~91% | just beneath the crown | **RING LOCKS** |
| 29 | `tide-22.webp` | 22/23 | ~96% | the lower left of the crystal | — |
| 31 | `iris-1.webp` | 1/60 | ~2% | the lower left of the crystal | — |
| 32 | `iris-2.webp` | 2/60 | ~3% | the lower right | — |
| 33 | `iris-3.webp` | 3/60 | ~5% | the mid left flank | — |
| 34 | `iris-4.webp` | 4/60 | ~7% | the mid right flank | — |
| 35 | `iris-5.webp` | 5/60 | ~8% | the upper left shoulder | — |
| 36 | `iris-6.webp` | 6/60 | ~10% | the upper right shoulder | — |
| 37 | `iris-7.webp` | 7/60 | ~12% | just beneath the crown | **RING LOCKS** |
| 38 | `iris-8.webp` | 8/60 | ~13% | the lower left of the crystal | — |
| 39 | `iris-9.webp` | 9/60 | ~15% | the lower right | — |
| 40 | `iris-10.webp` | 10/60 | ~17% | the mid left flank | — |
| 41 | `iris-11.webp` | 11/60 | ~18% | the mid right flank | — |
| 42 | `iris-12.webp` | 12/60 | ~20% | the upper left shoulder | — |
| 43 | `iris-13.webp` | 13/60 | ~22% | the upper right shoulder | — |
| 44 | `iris-14.webp` | 14/60 | ~23% | just beneath the crown | **RING LOCKS** |
| 45 | `iris-15.webp` | 15/60 | ~25% | the lower left of the crystal | — |
| 46 | `iris-16.webp` | 16/60 | ~27% | the lower right | — |
| 47 | `iris-17.webp` | 17/60 | ~28% | the mid left flank | — |
| 48 | `iris-18.webp` | 18/60 | ~30% | the mid right flank | — |
| 49 | `iris-19.webp` | 19/60 | ~32% | the upper left shoulder | — |
| 50 | `iris-20.webp` | 20/60 | ~33% | the upper right shoulder | — |
| 51 | `iris-21.webp` | 21/60 | ~35% | just beneath the crown | **RING LOCKS** |
| 52 | `iris-22.webp` | 22/60 | ~37% | the lower left of the crystal | — |
| 53 | `iris-23.webp` | 23/60 | ~38% | the lower right | — |
| 54 | `iris-24.webp` | 24/60 | ~40% | the mid left flank | — |
| 55 | `iris-25.webp` | 25/60 | ~42% | the mid right flank | — |
| 56 | `iris-26.webp` | 26/60 | ~43% | the upper left shoulder | — |
| 57 | `iris-27.webp` | 27/60 | ~45% | the upper right shoulder | — |
| 58 | `iris-28.webp` | 28/60 | ~47% | just beneath the crown | **RING LOCKS** |
| 59 | `iris-29.webp` | 29/60 | ~48% | the lower left of the crystal | — |
| 60 | `iris-30.webp` | 30/60 | ~50% | the lower right | — |

## 6. BATCH CHECKLIST

- [ ] Two anchors per stone approved before chaining
- [ ] Chain edits: previous frame + Anchor Z attached every time
- [ ] Ring-lock line added on lock frames only
- [ ] Filenames `<stone>-<step>` (progress) / `<stone>` (finals)
- [ ] `node tools/gemrig/ingest.mjs <dir> public/stones/progress` (frames)
      and `... public/stones` (finals), then `npm run build`
- [ ] Eyeball Nights 1, 2, 14 (first lock), the Ember reveal, and the Vault
      grid at phone width
