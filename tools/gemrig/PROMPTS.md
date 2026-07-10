# Generating the stones with an image model (Nano Banana 2 / any top model)

All stone visuals are plain images the app swaps in. Two kinds:

1. **Finals** — the five coloured gems + the raw rock. One image each.
   Live in `public/stones/`: `ember.webp` `tide.webp` `iris.webp`
   `aurora.webp` `solstice.webp` `rock.webp`.
2. **Nightly progress frames** — the stone on the bench, one GREYSCALE frame
   per night inside a span. Live in `public/stones/progress/`, named
   `<stone>-<nightIntoSpan>.webp`. Counts:
   - Ember (Nights 1–6): `ember-1.webp` … `ember-6.webp` — **6 frames**
   - Tide (Nights 8–29 → into-span 1–22): `tide-1.webp` … `tide-22.webp` — **22 frames**
   - Iris (into-span 1–59): `iris-1.webp` … — only needed after day 30; defer.
   Night 0 of a span (`<stone>-0.webp`, the fresh rough) is optional.
   **Any missing frame automatically falls back to the built-in procedural
   stone — partial sets are always safe to ship.**

## You do NOT need pixel-perfect size or background

Run every image through the ingest tool — it keys out the background (black
or any solid colour), finds the stone, and normalizes its size and centring
to the canonical frame. Model scale-drift is corrected here, not in the
prompt:

```bash
npm i --no-save playwright-core
node tools/gemrig/ingest.mjs ~/Downloads/stone-batch public/stones            # finals
node tools/gemrig/ingest.mjs ~/Downloads/frames public/stones/progress       # frames
npm run build
```

Progress frames are force-desaturated on ingest (colour law). Or send the
raw images to Claude in a session — it runs ingest and wires everything.

## THE consistency tactic: edit a chain, never regenerate

Independent generations of "the same gem, slightly more cut" will drift.
The reliable workflow with Nano Banana 2 (or any editing-capable model):

1. **Generate the FINAL greyscale stone once** (prompt below) until you love
   it. This is the anchor — call it frame N.
2. **Walk BACKWARD by editing the previous image**, one step per frame:
   > Edit this image. Keep the camera, framing, lighting, background and the
   > stone's size and position EXACTLY identical. Change only one thing:
   > this stone at an EARLIER stage of gem-cutting — convert roughly one
   > seventh of the polished facets back into raw, matte, uncut rock
   > surface, starting from the outer edges. The polished part stays
   > identical where it remains.
   (For Tide say "one twenty-second"; repeat the edit on each result until
   you reach frame 1, which should be almost entirely raw rock with the
   very first polished window on top.)
3. Export each step. Name by frame number. Ingest normalizes the rest.

Walking backward from the hero frame preserves identity far better than
building forward from a rough, and far better than fresh generations.

## Final-gem prompts (colour)

Shared style block (append to every gem prompt):

> Photorealistic 3D render of a single faceted gemstone floating on a pure
> black background, studio product photography, dramatic key light from the
> upper left, luminous internal fire glowing from inside the stone, crisp
> facet edges with tiny white specular flashes, a soft coloured glow behind
> the stone fading fully to black inside the frame, octane render, physically
> based refraction, no pedestal, no text, centred, square.

Generate **Ember first**; then generate the other four passing Ember's image
as a style reference, changing only palette + cut words:

- **ember** — "A bold radiant-cut gem with few large facets, colours
  exclusively fiery orange `#FF6A3D` into deep crimson `#C2273B`, like an
  ember burning from within."
- **tide** — "A wide cushion-cut gem, colours exclusively bright teal
  `#35D0BA` into deep ocean blue `#2563EB`, like light through a wave."
- **iris** — "A tall elegant oval-cut gem with finer facets, colours
  exclusively violet `#7C5CFF` into vivid magenta `#C838F0`."
- **aurora** — "A pear-cut gem (teardrop, slightly asymmetric point), finely
  faceted, colours exclusively spring green `#34D399` into ice cyan
  `#22D3EE`, like aurora light."
- **solstice** — "A round brilliant-cut gem with the finest, densest
  faceting of the set, colours exclusively warm gold `#FFD34D` into amber
  `#FF8A2A`, like low winter sun."
- **rock** — "A single raw grey stone, rough matte surface with subtle
  fracture lines, moody low-key lighting from the upper left, pure black
  background, photorealistic, only greys, no glow. It should look like
  something precious could be hidden inside."

## Progress-frame anchor prompts (greyscale, per stone)

Frame N (the anchor — the finished cut, still uncoloured):

> Photorealistic 3D render of a single fully cut and polished gemstone made
> of colourless grey crystal, [CUT WORDS FROM THE STONE ABOVE], floating on
> a pure black background, studio key light from the upper left, crisp facet
> edges, subtle white specular flashes, completely achromatic — greys only,
> no colour anywhere, no glow, no pedestal, no text, centred, square.

Then run the backward edit chain from "THE consistency tactic". The frame-1
end state should read as: a raw rough stone with one single polished facet
catching the light — that is Night 1's cut.

## Checklist per batch

- [ ] Square-ish source images (ingest crops/centres, but square is safest)
- [ ] Solid background (black preferred; any solid colour keys fine)
- [ ] Frames: greys only — ingest also enforces this
- [ ] Filenames follow `<stone>-<n>` for frames, `<stone>` for finals
- [ ] `node tools/gemrig/ingest.mjs <dir> <outDir>` then `npm run build`
- [ ] Eyeball three places at phone width: milestone reveal, Vault grid
      (greyscale), Vault detail (colour)
