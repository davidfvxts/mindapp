# Generating the stones with an image model (Nano Banana 2 / any top model)

The five finished gems + the rock are plain images in `public/stones/*.webp`.
The app treats them as swap-in artwork: replace a file, rebuild, done. No code
changes. The three.js rig (`gem.html` + `bake.mjs`) is the fallback renderer;
a great AI render simply replaces its output.

## Hard requirements for every image

- **Square**, ideally 1024×1024. Subject centred, filling ~65–75% of the frame.
- **Pure black background** (#000). The app's stage is black; the image edge
  is melted by a radial CSS mask, so a soft glow/halo around the gem is good —
  but it must fade fully to black *inside* the frame.
- One gem only. No pedestal, no text, no watermark, no hands, no scene.
- Colours ONLY from the stone's two palette hexes (plus white highlights and
  near-black depths). Never a second hue — this is the product's colour law.
- Convert to webp (quality ~90) and keep each file under ~120 KB.
- Filenames: `ember.webp` `tide.webp` `iris.webp` `aurora.webp`
  `solstice.webp` `rock.webp` → drop into `public/stones/`.

## Consistency workflow (important)

Generate **Ember first** until you love it. Then generate the other four
using Ember's image as a style/reference image, changing only the palette and
cut words — that's what keeps the five reading as one family.

## The prompts

Shared style block (append to every gem prompt):

> Photorealistic 3D render of a single faceted gemstone floating on a pure
> black background, studio product photography, dramatic key light from the
> upper left, luminous internal fire glowing from inside the stone, crisp
> facet edges with tiny white specular flashes, a soft coloured glow/halo
> behind the stone fading fully to black at the frame edges, octane render,
> physically based refraction, no pedestal, no text, centred, square.

Per stone (palette + cut personality — later stones are more finely cut):

- **ember.webp** — "A bold radiant-cut gem with few large facets, colours
  exclusively fiery orange `#FF6A3D` into deep crimson `#C2273B`, like an
  ember burning from within."
- **tide.webp** — "A wide cushion-cut gem, colours exclusively bright teal
  `#35D0BA` into deep ocean blue `#2563EB`, like light through a wave."
- **iris.webp** — "A tall elegant oval-cut gem with finer facets, colours
  exclusively violet `#7C5CFF` into vivid magenta `#C838F0`."
- **aurora.webp** — "A pear-cut gem (teardrop, slightly asymmetric point),
  finely faceted, colours exclusively spring green `#34D399` into ice cyan
  `#22D3EE`, like aurora light."
- **solstice.webp** — "A round brilliant-cut gem with the finest, densest
  faceting of the set, colours exclusively warm gold `#FFD34D` into amber
  `#FF8A2A`, like low winter sun."
- **rock.webp** — "A single raw grey stone, rough matte surface with subtle
  fracture lines, moody low-key lighting from the upper left, pure black
  background, photorealistic, no colour anywhere — pure greys. It should look
  like something precious could be hidden inside." (No glow on this one.)

## After swapping

```bash
npm run build     # re-precaches the new images for offline
```

Check three places at a phone width: the milestone reveal (colour), the
Vault grid (must read clearly through the greyscale filter), and the Vault
detail (colour). Nothing else needs touching.
