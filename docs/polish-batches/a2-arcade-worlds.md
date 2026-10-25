# Polish batch A2: arcade worlds (Hover, Pinball, Rainbow Bridge, Jaywalk, High Rise)

25 Oct 2026. Display only: "same game, enhanced". Each game keeps its art style, characters, palette,
layout, world size, playfield and in-world HUD. Nothing here touches a sim, scoring, rules, timing,
seeds, hitboxes, physics, server calls, stored data, routes, storage keys or version stamps
(`bun scripts/practice-stamps.ts` writes no change). Accessible names and test ids are unchanged.

Every new layer is static and painted once (a device layer per canvas size, or a cached sprite per
colour), or a cheap per-frame blit of a cached sprite. Glows are skipped under reduced effects
(`arcadeReducedEffects`, slow devices). Reduced motion holds pulses and rises still. No sounds were added.

## Per game

### Hover (`hover.renderer.ts`, `hover.tsx`)

- **Night sky** (normal play; the red "lost" wash is unchanged): a deep navy (#060A22) to purple
  (#22124A) gradient, then two rows of dark pixel city (#171236 far, #0C0A20 near) along the bottom
  with a few dim pixel windows, seeded. Painted once per canvas size (`deviceLayer`). The existing
  pale pixel star field draws over it unchanged (arcade-tuning-e-check pins it). No pink horizon glow.
- **Barriers**: the cached column sprite gains rounded shading (lit left edge, shaded right); each gap
  end gets a lit cap (the barrier colour at full strength, a bright lip, a dark seam under the cap)
  and a soft glow into the gap (one cached sprite per colour, 0.55 alpha). Magenta and the colour
  cycle, the energy blocks, the jagged trace, the pass-through pulse and the scanlines are unchanged.
- **Stars**: a soft gold glow (cached sprite, a slow pulse; still under reduced motion), and a "+1"
  in the retro font rising from a star just taken (its age recovered from the course's distance).
- **Ship**: a soft gold glow and a faint beam under it (one cached sprite, under the saucer's own
  blocks). The saucer is drawn exactly as before (its gold, dome and lights); the game icon, which
  calls `drawSaucer`, is unchanged.
- **Fill below** (`hoverNightFill`, replacing arenaFills' `hoverFill` for this game): the city's dark
  street level runs on from the world's bottom edge with a few dim windows, settling darker.
- HUD (1UP, BARRIERS, STARS) unchanged.

### Pinball (`pinball.renderer.ts`, `pinball.tsx`)

- **Rails**: a 2.2 px neon core on each wall capsule's centre line with a 0.8 px white highlight,
  in a soft glow that fills the capsule faintly (so the solid still reads) and fades just past it.
  The core's edge sits 1.9 px inside the 3 px collision radius (the bounds rule allows 2).
- **Flippers**: a shaped bat, full width (6 px) at the pivot tapering to a round 4 px tip (2 px inside
  the swept capsule), shaded gold across the bat, a highlight line, and a chrome pivot cap in a dark ring.
- **Slingshots**: a purple plastic with fine pink hatching and a lit inner triangle (pink glow); the
  kicker face is glowing gold rubber; chrome posts at the three corners.
- **Bumpers**: when struck they flare (eight short rays fading with the existing 10-tick glow) and
  "+100" (times the multiplier) rises off them for 36 ticks (from the sim's `bumperAt`).
- **Ball**: the same chrome ball; its trail is now faint round ghosts instead of pixel squares.
- **Spinner**: the same bar, brushed chrome (gold while lit), shaded across, with chrome bearings.
- **Deeper purple glow behind the table**: added ("lighter") over the black corners of the world and,
  through `pinballGlowFill`, over the gap above the centred table and rising from the screen's bottom,
  in the same world coordinates, so no seam. The five lamps and their lights are arenaFills' as before.

### Rainbow Bridge (`inkBridge.renderer.ts`, `inkBridge.tsx`)

- **Sky**: a richer blue at the top (#2A86DA), the same pale haze low down, and nine soft sun rays
  from the sun (baked into the sky sprite). The arena scene's sides use the same stops.
- **Clouds**: a shaded cloud (lit tops, blue-grey underside) in the shared cloud's exact cell, used for
  the drifting clouds and the spout cloud. The shared countryside cloud is untouched.
- **Rainbow ink**: a thin white shine line along each stroke's upper side, inside the 6 px stroke
  (baked into the cached bridge raster, rebuilt only when the strokes change).
- **Coins**: a soft gold glow behind the falling coin (the coin's 14 px stamp is unchanged).
- **Birds**: the same straight rows and flap frames, a thinner (1.3 px) outline and a soft grey under
  the body, so the white reads against pale sky.
- **Leprechaun**: the same pixel style, with a hat shine and buckle, rosy cheeks, lapels, buttons, a
  belt and buckle, sleeves and shoe buckles, and a soft shadow on the grass.
- **Pot of gold**: a gold glow out of its mouth (a slow pulse; still under reduced motion). The pot's
  body, rim caps and exact stamp are unchanged (ink-rainbow-check).
- **HUD**: the level and the ink meter (with its fail dots, now outlined) sit on soft white pills.
- **Dock**: the four buttons keep their order, names, size (48 px) and place; Undo, Reset and Drop
  again are dark glass (the toolkit's `.gf-glass` look, set inline), Release is gold, and a dark
  translucent backing is drawn round the row (absolutely placed, so the row's size and the world's
  size are unchanged).

### Jaywalk (`cross.renderer.ts`)

- **Cars and lorries**: a soft shadow 2 px down and right on the road, a light sheen over the upper
  half (clipped to the vehicle's own box) and a small headlight glow at each front corner. Vehicles
  themselves (`drawVehicle`, also used by the game icon) are unchanged. Reduced effects skip all three.
- **Lane dashes**: snapped to the cached road layer's own pixels, so they are crisp.
- **Kerbs**: each kerb stone shaded and lit along its face, with a bright 1 px edge.
- **Pavements**: each slab subtly shaded (lit top-left, a touch darker bottom-right, a light top edge).
- **Grass bands**: soft clover patches and a scatter of tiny daisies and buttercups (seeded, world
  anchored, so the arena scene's grass continues them), and low trimmed hedges along both 8 px verges.
- **HUD**: "Crossings N" and the three lives on soft dark pills; the empty lives are a pale ring.
- No centre line, cycle lanes or roadworks were added.

### High Rise (`skyline.renderer.ts`, `skyline.tsx`)

- **Sky**: a deep navy (#060B1F) lifting to indigo (#2B2766) at the horizon, 90 seeded stars (a few
  brighter with a soft cross), the moon where it was with a glow and faint craters, and a city glow
  low on the horizon. Painted once per canvas size; stars keep clear of the HUD corners. It replaces
  `realNightSky` for this game only (the shared function is unchanged).
- **Two layered skylines** (the same towers and parallax): the far one hazy indigo with sparse cool
  windows, the near one dark with warm lit windows and red roof lights. Painted once into a sprite.
- **Crane**: the jib glows faintly (a cached band); the spotlight is a softer feathered cone fading as
  it falls (a cached sprite) instead of the flat wedge.
- **Blocks**: shaded down each floor with a darker foot and right edge; lit windows get a warm glow
  at their centre. The game icon (which calls `drawBlock`) shows the same shading.
- **"PERFECT" pop**: over the seam of a perfect drop, a gold "PERFECT" (22 px, dark outline, soft
  glow) springs in, settles, rises and fades over 45 ticks (from the sim's `perfectTick`); still
  under reduced motion. The shared success layer's sparks and ring are unchanged; its small label
  was dropped for this game so the word shows once.
- **River** (`skylineRiverFill`, replacing arenaFills' `skylineFill` for this game): a lit stone quay
  under the base, then dark water reflecting the city (gold streaks, the moon's pale path, faint ripple
  lines), settling darker. Static.

## Assumptions

- "Glow" round solids (barrier caps, bumpers, the ship) is low-alpha light, not part of the solid; the
  solids themselves stay within 2 px of their collision bounds.
- Pinball's "+100" shows the bumper's points times the multiplier at the time it is drawn.
- Hover's "+1" is drawn by the game (the shared layer's "GOLD STAR!" banner stays).
- High Rise's moon stays where it was (top right); the river is static (nothing moves after first paint).
- The arena fills for Hover, Pinball and High Rise live in each game's own renderer and are passed by
  each game's stage; `arenaFills.renderer.ts` (shared) is not edited.

## Shared requests

- `arenaFills.renderer.ts`: `hoverFill` and `skylineFill` are no longer used by their games (their
  replacements are `hoverNightFill` and `skylineRiverFill` in the games' renderers); they can be
  deleted in a shared clean-up. `pinballFill` is still used (wrapped by `pinballGlowFill`).
- `docs/game-look-audit.md` and `docs/design-system.md` could mention these worlds' new looks.
