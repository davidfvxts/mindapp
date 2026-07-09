# FACET — Design System

Direction: **Instrument Bench × Darkroom.** The lapidary's workbench rendered in
photographic black. Structure comes from type scale and whitespace — never from
cards, borders, shadows, or icons. Motion behaves like a print developing:
things *emerge*, they don't slide or bounce.

Working name: **Facet.** Three words carry the product; everything else is
plain English. Milestone artefact = *the Stone*, stored in *the Vault*; the
unit is the *Night* ("Night 34"). The coach is just *Coach*; the session is
just *Tonight*. Progression is shown, never scored: the stone moves through
four plain states — *Rough → Cut → Polished → Brilliant*. The night count is
the only number the user ever sees.

---

## 1. Colour

One background. One ink, at measured opacities. Colour exists in exactly one
place: the Stone.

| Token | Value | Composite | Contrast vs #000 | Passes |
|---|---|---|---|---|
| `--surface` | `#000000` | — | — | — |
| `--ink-primary` | `#FFFFFF` | #FFFFFF | **21.00:1** | AAA |
| `--ink-body` | `rgba(255,255,255,.84)` | #D6D6D6 | **14.45:1** | AAA |
| `--ink-secondary` | `rgba(255,255,255,.62)` | #9E9E9E | **7.84:1** | AAA (AA large+normal) |
| `--ink-tertiary` | `rgba(255,255,255,.40)` | #666666 | **3.66:1** | AA **large text / UI marks only** |
| `--ink-disabled` | `rgba(255,255,255,.26)` | #424242 | 2.09:1 | exempt (disabled) |
| `--line-control` | `rgba(255,255,255,.38)` | #616161 | **3.39:1** | AA non-text (≥3:1) |
| `--line-hairline` | `rgba(255,255,255,.14)` | #242424 | 1.35:1 | decorative only |
| `--fill-field` | `rgba(255,255,255,.07)` | #121212 | — | — |
| `--ink-on-inverse` | `#000000` on `#FFFFFF` | — | **21.00:1** | AAA |
| `--ink-body` on `--fill-field` | — | — | **12.89:1** | AAA |
| `--ink-secondary` on `--fill-field` | — | — | **6.99:1** | AA |

Ratios computed with the WCAG 2.1 relative-luminance formula (script, not
eyeballed). Rules of use:

- `--ink-tertiary` never carries body-size text. Large numerals, inactive step
  dots, decorative counters only.
- `--line-hairline` is a texture, not a boundary. Anything a finger can hit is
  bounded by `--line-control` (3.39:1) or a fill.
- Never introduce a grey hex. Greys are white at an opacity, full stop —
  this keeps the palette honest when a second surface ever appears.

## 2. Typography

SF Pro (system stack), five weights doing all the structural work.
All numerals set `font-variant-numeric: tabular-nums` — this is an instrument;
digits don't wobble.

| Role | Size | Weight | Tracking | Line-height | Ink | Use |
|---|---|---|---|---|---|---|
| **Display numeral** | 72 | 300 Light | −0.022em | 1.02 | primary | The night count. One per screen, max. |
| **Headline** | 28 | 600 Semibold | −0.015em | 1.16 | primary | Screen title, milestone title |
| **Subhead** | 20 | 500 Medium | −0.010em | 1.30 | primary | Prompt of the night, section lead |
| **Body** | 17 | 400 Regular | 0 | 1.50 | body | Reflection text, coach replies |
| **Secondary** | 15 | 400 Regular | +0.002em | 1.45 | secondary | Timestamps, helper text, meta |
| **Ambient label** | 11 | 500 Medium | +0.10em, UPPERCASE | 1.20 | secondary | Engraved tool-labels: "COACH", "NIGHT 127", "THE VAULT" |

Hierarchy is built by *jumping* the scale (72 → 28 → 15), never by nudging.
If two adjacent sizes feel needed, the layout is wrong.

## 3. Spacing, radii

4pt base: `4, 8, 12, 16, 24, 32, 48, 64, 96`. Screen gutter 24. Sections
separate by 48–64 of empty black — whitespace is the card replacement.
Radii: 8 (chips) / 12 (buttons, fields) / 20 (coach block) / pill.

## 4. Components

Focus state everywhere: `outline: 2px solid #FFF; outline-offset: 3px`.
The 3px offset shows pure black between element and ring, so the ring is
visible even on the white primary button (21:1 against the gap). Keyboard
`:focus-visible` only — taps don't paint rings.

### Button — primary
White fill, black text (21:1), radius 12, height 52, subhead type at 17/600.
- hover: fill `rgba(255,255,255,.90)`
- focus: ring
- active: scale 0.98, `--t-micro`
- disabled: fill `--fill-pressed`, text `--ink-disabled`

### Button — ghost
Transparent, 1px `--line-control` boundary, white text.
- hover: border `rgba(255,255,255,.60)`
- active: fill `--fill-pressed`
- disabled: border `--line-hairline`, text `--ink-disabled`

### Button — text
Bare label, `--ink-primary`.
- hover: underline (1px, offset 3px)
- active: `--ink-secondary`
- disabled: `--ink-disabled`

### Text field
Fill `--fill-field`, radius 12, no border at rest — the fill is the boundary.
Ambient label above; placeholder `--ink-secondary` (7.84:1, real AA — not
decorative grey).
- focus: inset 1px `#FFF` box-shadow + ring
- filled: ink-body text
- error: 1px `--line-control` border + secondary-type message prefixed
  "Error —". **No red.** Monochrome discipline includes failure.
- disabled: fill `rgba(255,255,255,.04)`, text `--ink-disabled`

### Chip
Pill, `--fill-field`, secondary type in `--ink-body`.
- selected: inverted — white fill, black text
- active: `--fill-pressed`
- disabled: `--ink-disabled`

### Progress bar
2px track `--line-hairline`, white fill, pill ends. Width animates
`--t-standard / --ease-settle`. Always paired with a text value
(e.g. "3 OF 5") — the bar alone never carries the information (a11y).

### Step indicator
Dots 6px: active white, visited `--ink-tertiary` (3.66:1), upcoming
`--line-hairline`. Paired with ambient label "STEP 3 OF 5".

### Tab bar
Text only, no icons. Ambient-label type. Active: `--ink-primary` + 2px white
rule above the label. Inactive: `--ink-secondary` (7.84:1). Hairline top border
on the bar itself.

### Toast
Inverted pill: white fill, black text (21:1), secondary type, centered,
bottom-anchored. Enters by develop-fade (`--t-enter`), auto-dismisses 4s,
`role="status"`.

### Coach reply block
No avatar, no bubble-tail, no icon. A white left rule (2px × full height),
ambient label "COACH", then body type. Paragraphs develop in sequence
(60ms stagger). The rule is the voice — when Coach thinks, the rule
pulses opacity .38→1 at 1.2s intervals (off under reduced motion).

## 5. The Stone (reward object)

The only coloured object in the product.

**Anatomy** (rendered as layered SVG polygons, one shared gradient per stone):
- **Table** — top centre facet, gradient at 100% opacity
- **Crown** — two flanking facets, 75% / 60% opacity
- **Pavilion** — two lower facets converging to the culet, 85% / 50%
- **Girdle** — the horizontal seam, stroked `--gem-girdle` (achromatic white)
- **Culet** — the bottom point; the whole object reads as light held in a cut

Facet shading is done by *opacity of the same gradient*, never by additional
colours — one stone, one gradient, five polygons.

**Colourways** (earned, in order):

| Stone | Night | Gradient |
|---|---|---|
| Ember | 7 | `#FF6A3D → #C2273B` |
| Tide | 30 | `#35D0BA → #2563EB` |
| Iris | 90 | `#7C5CFF → #C838F0` |
| Aurora | 180 | `#34D399 → #22D3EE` |
| Solstice | 365 | `#FFD34D → #FF8A2A` |

**Rules of appearance — non-negotiable:**
1. A Stone appears coloured in exactly two places: the full-screen milestone
   moment (once, at the moment of earning) and the Vault detail view.
2. In every list, grid, tab, or thumbnail context, Stones render greyscale
   (white-opacity facets). Colour blooms only on the detail view, once per visit.
3. Gradients never appear as backgrounds, text fills, borders, buttons, charts,
   confetti, onboarding art, or paywall decoration. Not at 10% opacity. Not
   "just this once for the launch screen."
4. Locked milestones show an empty girdle outline — never a grey preview of
   the gradient (previewing the colour devalues earning it).
5. Push notifications, emails, and marketing surfaces inside the app follow the
   same law. The Stone is scarce or it is nothing.

## 6. Motion

What animates, and only this:

| Event | Duration | Easing | Behaviour |
|---|---|---|---|
| Press feedback | 120ms | settle | scale 0.98 |
| State change (chip, tab, progress) | 240ms | settle | opacity/width |
| Screen & element entrance | 420ms | settle | opacity 0→1 + rise 8px ("develop") |
| Element exit | 240ms | exit | opacity → 0, no transform |
| Coach paragraphs | 420ms, 60ms stagger | settle | develop, sequential |
| **Stone reveal** | **1200ms** | reward | scale 0.9→1, facet opacities cascade, one girdle light-sweep. Once. |

Nothing loops except Coach's thinking pulse. Nothing bounces, ever —
overshoot is a toy signature, not an instrument's.

**`prefers-reduced-motion: reduce`:** all transforms off; opacity-only fades
capped at 150ms; thinking pulse off; Stone renders static, instantly, fully
coloured — the reward is the object, not the animation. (Encoded in
tokens.css via the media query.)

## 7. Do / Don't

**Do**
- Build hierarchy with size jumps and black space.
- Keep every interactive boundary at ≥3:1 (`--line-control` or stronger).
- Keep numerals tabular everywhere.
- Ship every state: default, hover, focus-visible, active, disabled.
- Treat the Stone's colour budget like real money.

**Don't**
- Don't add a card, shadow, or icon to "clarify" a layout — fix the type scale.
- Don't introduce any grey hex, any accent colour, or any gradient outside `--gem-*`.
- Don't use `--ink-tertiary` for body-size text (3.66:1 fails AA at 17px).
- Don't animate longer than 420ms outside the Stone, or loop anything but the pulse.
- Don't show gradient previews of unearned Stones.
- Don't use red for errors, green for success, or gold for premium. Monochrome
  has no exceptions for emotions.
