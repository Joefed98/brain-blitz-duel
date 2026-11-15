# Cosmetics art direction (15 Nov 2026)

Joe's bar: **top-tier elegance**. Beautiful, premium, sleek, clean, detailed, desirable: things players want to own.
Never “clearly AI-rendered”, never a stock 3D prop on a gradient. This page is the standard every redraw is judged
against; the five samples in [SAMPLES.md](SAMPLES.md) are its first proof. The first pass (the 75 redraws in
[GALLERY.md](GALLERY.md)) fell short of it and stays switched off.

## What went wrong in the first pass (and the rule each mistake became)

| First pass | The rule now |
|---|---|
| One recipe for every card art: a dark gradient, one 3D object on the right | **A card art is a whole scene**: a place with depth (foreground, subject, background), atmosphere and light that belongs to the scene |
| Lava read as a blob; shapes were arbitrary | **Every form is modelled from something real**: a lava field has a crust, cracks, heat and glow; never a lone smooth blob |
| Plastic sheen on everything (one gloss material) | **Physically based materials**: metals with real reflections and wear, glass with refraction, enamel, emissive light that lights its surroundings |
| Lightning tier lost its drama | **Prestige items are events**: scale, contrast, a moment caught (a strike, a burst), never a still icon |
| Founding, Top 500 and Season 1 Top 500 looked the same | **Each prestige frame is its own crafted object** with its own motif, material and story |
| Objects covered the end of the name on the leaderboard strip | **The name always reads**: the name side is darkened gently on the card, and the strip has its own veil (below) |

## The pipeline

Blender (Cycles, path traced, OpenImageDenoise) driven headless from Python, `bpy` 5.3 from PyPI. One script per item
in `docs/design/cosmetics-redraws/blender/`, sharing `lib.py` (studio lighting, materials, camera, output). Every
render is reproducible from its script and fixed seeds. Output is WebP in `public/cosmetics/redrawn/` (out of the
offline download), at 3× the item's size in card units: a card art 900 × 336, a frame 960 × 396 (its 10-unit
margin for the shadow and the crest), a game texture at its use size.

- **Light**: a soft studio rig (a large key from the top left, a cool rim, a warm fill) or an HDRI-like world
  gradient; emissive surfaces light what is near them. Depth of field on scenes, never on frames.
- **Materials**: Principled BSDF only, from a small shared set: champagne and art gold (`#E2C07A`, `#EDB43E`),
  brushed and polished steel, black enamel, navy lacquer, cut glass and gems, emissive neon. Roughness and bump
  carry wear and engraving, never a flat colour.
- **Palette**: the Joulz black, navy and champagne gold wherever an item has no colour story of its own; an item
  with a story (Galaxy, Lava, a tier's colour) keeps it, and gold is still its metal.

## Rarity at a glance

| Tier | Items | What it looks like |
|---|---|---|
| Everyday | free starters, Common, Rare | Calm, clean, one material done well; no motion; a quiet scene |
| Special | Epic, Elite | A full scene with a subject, two materials, real light; an Elite may move subtly |
| Prestige | Legendary, Founding, Top 500, Championship, Season 1 Top 500, the top tiers | An event: scale, a moment caught, precious materials (gold, gems, glass), its own motif and a slow animation |

Each step is unmistakable from the one below at the leaderboard strip's size, not only on the full card.

## Card arts

- **A full scene across the whole card**, composed for the card: the subject's weight on the right two-fifths, the
  scene continuing calmly behind the avatar and name.
- **The name side is darkened gently** (a soft falloff from the left, never a hard band), so the name, title and pill
  read on every art.
- **The strip veil.** On the leaderboard strip the whole card is squeezed into one 40 px row and the name runs most
  of its width; a card art carries a veil (`pc-strip-veil`) drawn only on the strip, darkening everything under the
  name and leaving the subject's light at the far right. Nothing bright or busy ever sits under the name.
- **Motion** only on prestige items, slow and quiet (a drift, a shimmer), stopped under Reduce Motion.

## Frames

- **A crafted object**, not a stroke: cast or machined metal with bevels, engraving and inlays, gems in settings,
  enamel fields; it sits on the card with a real contact shadow.
- **Its own motif**: Founding is the first edition (a crest, a founder's plaque, laurels), Top 500 is a crown
  (a coronet, rubies), Season 1 Top 500 is the season (its gem, its numeral); never the same frame recoloured.
- **Inside the card's box** (a 10-unit shadow margin), never over the name, the pill or the score beside a strip;
  any plaque text is the full card's only and hidden on the strip.

## In-game looks

- **What matters stays as clear or clearer**: track edges, walls, holes, the ball and every hazard keep their exact
  places and outlines and read at least as well as today; nothing new sits on the play area's lines.
- **Detail lives in materials and surroundings**: turf grain and mowing stripes, stone and timber walls, water with
  depth, a city around the track; pre-rendered textures and sprites, drawn on cached canvases, so a frame costs what
  it did.
- **Smooth**: arcade-play-check and arcade-lowend-check pass with the look on; images stay modest.

## Never

Lone blobs; plastic sheen; arbitrary shapes; one recipe for many items; glows that wash out a name; real people,
brands, logos or known characters; anything over the name, the score or the play area's lines.
