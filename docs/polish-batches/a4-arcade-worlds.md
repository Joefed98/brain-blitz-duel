# Polish batch A4: arcade worlds (25 Oct 2026)

Orbit, Grappler, Roofbound, Wavefront, Scrumper and Tilt. "Same game, enhanced": art only, in each
game's own renderer. No sim, rule, timing, seed, hitbox, input, server, storage or version-stamp change;
old rounds replay and score as before. `bun scripts/practice-stamps.ts` shows no change.

Before and after at 414 × 896: `screenshots/polish-a4-oct-2026/` (one full-size sheet a game, plus `overview.png`).

## Files

Only these six renderers changed: `orbit.renderer.ts`, `swing.renderer.ts`, `flipArt.renderer.ts`,
`wavefront.renderer.ts`, `snip.renderer.ts`, `tiltArt.renderer.ts` (all in `src/lib/arcade/`). No shared
file, CSS, toolkit or check changed. The shared helpers are used as they are (`drawFxGlow`,
`countryStamp`, `countryCloud`, `artHash`, `toyMarble`, the hero renderer).

## Per game

- **Orbit**: richer nebula (purple, magenta, teal clouds with brighter hearts); one star in four twinkles
  deeply; a faint ambient shooting star every 8 s at a seeded place (none under reduced motion or reduced
  effects; the milestone star is unchanged); every planet gets a soft atmosphere glow in its colour; orbits
  are glowing dashed lines (the current one brighter, its dashes drifting the way the rocket turns); the
  rocket always has a small flame with a nozzle glow, longer in flight; the trail warms near the ship.
- **Grappler**: a far roof of stalactites at slow parallax (warm-lit, lighter than the cave, so it reads as
  distance, never as a hazard); the distant rock layers' faces warm towards the lava and their ridges catch
  an orange rim light; a taller warm glow over the lower cave; lava with a flowing highlight, crust plates
  with glowing molten edges, bubbles that swell and pop, and embers with a soft glow; pickups (and the HUD
  icon, and rev-4 anchor stars) are glowing gold coins with a raised star and a passing glint, at the
  pickup's own radius.
- **Roofbound**: five lava seams in the rock, with a wider glow and a hot core; brighter roof edges (a
  wider glow and a white-gold core on the lava line); a faint dark city skyline with a few warm windows in
  the tunnel between the roofs (slow parallax); embers drifting up the tunnel; spikes shaded (a shadowed
  far face, a lit near edge) over a soft lava glow; the star has a halo ring and four slow rays.
- **Wavefront**: the three enemy kinds redrawn as dark gunmetal craft with neon trim in their old colours
  (teal, pink, blue), a faint trim-coloured glow inside the cell and glowing red eyes, at the same cells,
  sizes and hitboxes: the arrows are delta-wing interceptors (wing struts, twin engine lights, a red cockpit
  eye), the octagons armoured gunships (plating seams, rivets, side cannons, a big red core eye), the crabs
  pincer fighters (bat-wing hull, two forward claws, two red eyes). Also a richer blue and purple nebula,
  glowing bullets (≤ 2 px past the bolt box, a bright core), an always-on engine flame under the player
  ship, a faintly glowing shield line with a slow shimmer, and a four-point sparkle on every hit.
- **Scrumper**: its own sky (`orchardBackdrop`, cached): a deep-blue-to-pale gradient, the sun's glow,
  soft shaded clouds, the same hills, grass blades and small flowers along the bottom; the hedge is leafy
  clumps in four greens on a soil strip with a scalloped edge (still within y 0–28); the twine shows its
  twist; the apple is shiny with a curved stalk, veined leaf and glint; the hive is shaded round with raised
  rings and the bees have stripes and beating wings; the basket has an over-and-under weave, round shading,
  a thick rolled rim, a dark inside and a soft shadow below.
- **Tilt**: plank seams, more grain and a warm pool of lamplight on the table (in the cached board layer,
  kept clear of the world's top and bottom edges so it meets the screen fill with no line); the maze board
  has a deeper drop shadow and a wider bevelled rim; walls are carved deeper (a darker shadow edge, a
  brighter lit edge); every marble casts a soft shadow from the screen-fixed lamp and the blue marble gets a
  glossy highlight; stars glow, with a gradient face and a glint; pits are deeper (shadowed inner walls, a
  lit far wall, a black core). The mazes are unchanged.

## Second pass (25 Oct 2026): Orbit and Tilt pushed further

Joe's review: the other four read clearly; Orbit and Tilt were still too subtle beside main.

- **Orbit**: the nebula clouds at about twice the first pass's strength (still soft, each fading to
  nothing); clear sphere shading on every planet (a bright lit side, a soft terminator, a dark night side);
  a stronger two-layer atmosphere glow; a longer, wider flame with a bigger nozzle glow (orbiting and in
  flight); a longer, brighter, wider trail.
- **Tilt**: a brighter lamplight pool over the board's centre and a darker vignette towards the sides,
  painted on their own layer that fades out over the 48 px nearest the world's top and bottom (those edges
  meet the screen fill's plain oak, so the board's box never shows); a deeper drop shadow; a wider rim with
  a clearly visible bevel (a bright lit face upper left, a dark one lower right, a bright outer highlight);
  deeper carved walls (stronger shadow and dark edge, brighter lit edge); a stronger glow round the stars;
  a warmer lamp gloss on the board.
- Re-run for both: arcade-play-check, arcade-fill-check and arcade-lowend-check pass (at 4× slowdown
  Tilt 43.1 fps, was 46.9; Orbit 46.7 fps, was 56.0; the floor is 30).

## Assumptions and decisions

- **Wavefront's "+10" on a hit is left out.** A shape is one raw point and the HUD's 0–150 score rises by
  about one a hit on a curve, so "+10" would be untrue, and the arcade rule is that pops show counter facts,
  never points (`src/lib/arcade/AGENTS.md`). Each hit gets the sparkle only. Joe can ask for a true figure.
- **Grappler's stalactites** are a far parallax layer, not drawn on the ceiling line: anything hanging from
  the real ceiling would sit outside the sim's bounds (the 2 px rule) and could read as a hazard.
- **Scrumper's sky** is drawn in `snip.renderer.ts` (the countryside backdrop is shared with Rainbow Bridge,
  which stays as it was). The bottom hills keep their colours, so the screen fill still meets them.
- **Tilt's "table"** is the world's board area; the oak beyond the world is the shared fill (not changed).
- Every glow, flame or halo past a body's outline is light, not a body; collision shapes are untouched.
- Reduced motion: no ambient shooting star, embers and bubbles still or skipped, dash drift, shimmer and
  sparkle movement off. Reduced effects (low end): the new glow passes, far layers, city, embers, bubbles
  and highlights are skipped. No new sounds (mute and the Effects slider are unaffected).

## Checks run (all pass)

arcade-play-check (the six games), arcade-fill-check (the six), arcade-lowend-check (tilt, swing, orbit:
46.9 / 33.2 / 56.0 fps at 4× in the first pass; 43.1 / – / 46.7 after the second), arcade-fx-check, arcade-tuning-a-check, arcade-self-replay-check,
reveal-score-check, swing-rev8-check, snip-rev7-check, orbit-legacy-replay-check, orbit-camera-check,
orbit-outside-belt-check, flip-bend-check, bullseye-cross-flip-tuning-check, first-paint-check,
no-wrap-check, plus `tsc --noEmit`.

## Shared requests

None needed.
