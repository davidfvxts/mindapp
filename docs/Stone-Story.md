# The Stone — story & evolution concept (v2, "The Light Learns Its Shape")

> The one-sentence story: **your nights are light gathering in a dark place;
> each stone is that light learning a new form.**

This replaces the jeweller's framing (cutting facets) with a light framing
(waking a crystal). Same mechanic — one facet per Night — but the metaphor
now has a native grammar for daily, weekly and monthly beats, a reason the
first night already feels magical, and a storyline that scales for years.
The three product words (the Stone, the Vault, Night) are unchanged. The
colour law is unchanged: nightly evolution is achromatic radiance
(moonlight-silver, not dull grey); colour floods in ONLY at the milestone
reveal and in the Vault detail.

## The object

Not a natural gem. A **crystal monolith that doesn't exist in real life**:
an elongated, asymmetric crystalline form, semi-translucent obsidian-dark
glass, with a **thin filament of light suspended in its core** — the
*heart-thread*, like a captured star. Mystical, 2026-cool, radiant.

## The nightly grammar (small change, every single day)

- **Night 1 — "the light takes."** The dark shard's core ignites: the
  heart-thread flares alive and the first face of the crystal catches its
  glow. This is already a beautiful object — the wow starts on day one.
- **Every night** one more face *wakes*: it turns from matte obsidian to a
  softly glowing silver plane. Tonight's face always shines brightest
  (mapped to the existing `newFacet` emphasis). The user watches light climb
  the crystal, face by face, night by night.

## The weekly beat (a bigger, structural change)

Every 7th night inside a span, a **ring locks**: a whole band of faces
around the crystal snaps into brilliant alignment and the silhouette steps
visibly closer to its final form. Not +1 face — a reorganization. (In-app,
this needs no new mechanic: the weekly frames are simply drawn with the
lock; the weekly review already gives that day a rhythm.)

## The monthly beat (the payoff)

At the milestone the fully-awakened crystal **seals** — it arrives as a
closed, dark geode with glowing seam lines — and the user opens it with one
press: colour floods the crystal for the first time (the existing reveal +
open mechanic, unchanged). The stone banks to the Vault; a new dark shard
appears with the heart-thread already inside it.

## The storyline across the stones (the heart-thread)

The **same light** migrates from stone to stone — the thread in every new
shard is the light you grew in the last one. Five chapters, one year:

| Stone | Night | Chapter | What the light learns |
|---|---|---|---|
| Ember | 7 | *The spark that survives* | To stay lit — seven nights without going out |
| Tide | 30 | *The rhythm* | To return — not intensity, but coming back |
| Iris | 90 | *The seeing* | To show you patterns — 90 nights make an eye |
| Aurora | 180 | *The movement* | To change shape — who you were vs who you're becoming |
| Solstice | 365 | *The still point* | To hold steady through the longest night |

Vault detail copy can carry the chapter line under each stone (one quiet
sentence, words not numbers). Inclusions stay as-is: the user's own nights
are what's inside the stone — the story never replaces their words.

## Scalability

- **Content scales without new mechanics**: year two is "one light, new
  vessels" — five new crystal forms + palettes, same grammar, same frame
  pipeline, same app code (the stones table + images are data).
- **Generation scales linearly**: one anchor pair per stone + chained edits
  per frame (see tools/gemrig/PROMPTS.md). The ingest tool normalizes size
  and enforces greyscale, so batches from any model drop in.
- **Partial sets always ship**: any missing frame falls back to the
  procedural SVG stone automatically.

## Open decisions (founder's call, not silently changed)

1. **Stage words.** Rough → Cut → Polished → Brilliant still work, but the
   light story suggests: **Asleep → Waking → Rising → Radiant**. One-line
   change in `milestones.ts` if wanted.
2. **The last-two-nights tease.** A variant where a faint hint of the coming
   colour breathes deep in the core on the final two nights of a span. It
   would be a beautiful pull — but it breaks the written law ("never preview
   the colour"). Default: not done.
