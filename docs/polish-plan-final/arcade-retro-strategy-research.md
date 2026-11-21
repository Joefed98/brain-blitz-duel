# Arcade looks Joe wants changed: Retro, Strategy, Orbit — research (read-only)

Trees: HEAD = `main` at 18 Nov 2026 (`/home/user/brain-blitz-duel`), OLD = `82f2f648` (`/home/user/old`, before #449 / #450).
704 commits between them. The Retro overhaul landed through #440 (merged into the arcade train `ef4fc263`, train merged as #450 `61fc8ad4`);
the Strategy overhaul through #442 (`a6cf82e0`); the Action overhaul (Orbit) through #436 (`4a7bb4de`).

Key Retro look commits (all in #440):
- `f0c67960` Breaker brkRev 12; `93d3feac` Rally rallyRev 13; `273521e7` Fission burstRev 12; `79f13df7` Wavefront wavRev 14; `04db81ac` Tempo beatRev 12 + retro-overhaul-check.
- `5b694acd` **lit materials** (pixel-sphere balls, metal paddles, enamel bricks and gold-framed power bricks, glass atoms, glossy Blockzone blocks) — touched `retro.renderer.ts`, `breaker.renderer.ts`, `burst.renderer.ts`, `blockfall.renderer.ts`, 5 tiles.
- `1903d0e4` stage 1 finished: Hover pixel nebula, Rally two-tone dithered court, Meteor snakeRev 14 (three rock sizes), Fission burstRev 13 (bigger atoms), glowing comet tail, real-frame intro stills.
- `74ba5d2f` stage 2 look lifts: `retroSpace.renderer.ts` (new, shared pixel nebula / pixel planet / drifting star layers), Wavefront space, Meteor field and wormholes (spiral), Hover nebula richer, Spacewalk, Pinball, Blockzone.
- `7778c6d4` stage 2 in-world effects (retroFx); `61954402` stage 3 levels, payoffs, demos (Meteor wormholes redrawn as glowing rings).

Key Strategy look commits (all in #442): `a22ab428` looks / text off boards; `feb336f3` lit cut gems (code); `08b8f44f` real intro stills (FrameStill); `5b9fe29a` **stage 2 Blender renders** (gems, bubbles, marbles, walnut disc, Captain); `3ad07732` reveals/effects/coin+chest renders; `40f79896` follow-up (rendered wood, re-cut gems, candy glass, calm walnut, Captain 70 px, kit effects); `bcafbfdb` matchupRev 13; `de81fd10` Tilt levels; `305a50f6` Ball Tracker levels; `b6b41570` Coral Pop levels; `ef7b52e5` gem-heart / bubble-orange renders.

Key Orbit commits (#436): `10ab3ce4` grace orbitRev 15 + rendered planets + edge to edge + held checkpoint; `49170233` materials pass (projected spheres, metal rocket, glass gauge); `7e623f7e` Blender planets; `0012e040`/`998696d9` stage 2 effects + run picture; `831bd6a5` 1.5 s sun hold; `9f116874` orbitRev 16 bigger planets; `3c6382e9` levels.

## What a change would and would not disturb (shared across items)

- **skins-default-check** (`scripts/fixtures/skins-default-frames.json`, `-cards.json`, `-overhaul.json`): covers pool, minigolf, curling, racing, freekick and the card games only. **None of the ten games here is digest-pinned there.**
- **retro-overhaul-check** (`scripts/retro-overhaul-check.ts`): no pixel digests. Its only renderer assertion is the text floor (lines 713–750 via `scripts/retro-render-lib.ts` `textRecorder`): every text draw ≥ 11 px on a 390×844 phone. Any Retro look change is free so long as no text shrinks.
- **snake-renderer-check** (`scripts/snake-renderer-check.ts`): counts `fillRect` sizes on Meteor frames (2×2 / 4×4 particle caps, no line between segments, pixels inside cells, "2 × 2 rock pixels inside its block"). A background rewrite that adds 2×2/4×4 rects on the death frame or under reduced motion could trip lines 54–56; the cached backdrop is painted once (backdrop layer), so static background rects are fine.
- **burst-renderer-performance-check**: counts rects/blits/live shadowBlur on a 40-atom frame; `paintAtom` runs once per cached stamp (`cachedArt("atom:${size}:${r}")`, burst.renderer.ts:279), so simplifying it is safe.
- **wavefront-ships-check**: every hull point inside its 28 px cell, three silhouettes, a tint exists. A `paintHull` signature change needs an optional parameter (the check calls the exported `drawHull`/hull painters).
- **arcade-fx-check** (thirds): draw must not change state; particle/pop caps; art pipeline bounds. No digests.
- **arcade-fill-check** (headless, `play11`–`play13`): no black strip, no border line or seam at each world edge (SEAM_MAX / LINE_MAX), fills hold still under reduced motion. **Any background change in Hover, Wavefront, Meteor, Tilt must keep the world's edge colour continuous with its fill** (`arenaFills.renderer.ts`).
- **tile-scenes-check**: hashes of `public/tiles/<type>.webp` vs `src/components/app/gameIcons/tileScenes.data.ts`. Tiles are drawn from the renderers' exported painters (`scripts/shots/tile-scenes/arcade.tsx` imports `retroBall`, `retroPaddle`, `paintBrick`, `drawHull`, `paintMatchupGem`, `paintBubble`, hover `drawPipe/drawSaucer`, meteor `stamp`; `arcade2.tsx` imports `btMarble`, `paintAtom`; `harness.tsx:94-101` waits for every `STRATEGY_ART` image before painting). **After any of these fixes re-run `bun scripts/shots/tile-scenes.ts <ids>`** (and `bun scripts/reveal-palette.ts`, which reads tiles; CLAUDE.md), then re-record `celebrations-off.json` only if tile hashes feed it (they did on 88fad17b).
- **Intro stills**: Retro games and Orbit use `ArtStill` (the renderer draws the still live: breaker.tsx:57, rally.tsx:56, hover.tsx:53, wavefront.tsx:32, burst.tsx:60, snake.tsx:54, orbit.tsx:53) — they follow the renderer automatically. Strategy games use `FrameStill` from `public/intro/<type>.webp` (matchup.tsx:87, bubble.tsx:57, tilt.tsx:29, ballTrack.tsx:58), hashed in `src/components/puzzles/strategyStills.data.ts` and asserted by strategy-overhaul-check 5b ("Intro stills", lines 247–258: real frame 4–60 KB, hash matches). **Re-run `bun scripts/shots/strategy-stills.ts` after changing a Strategy look.**
- **Intro demo fixtures** (`scripts/retro-demos.json`: hover, breaker, rally, beat, snake, burst, wavefront, pinball, cross, blockfall; `scripts/fixtures/strategy-demos.json`: tilt, matchup, bubble, inkbridge, balltrack; `scripts/fixtures/action-demos.json` incl. orbit) are input logs replayed on the real stage; a look change does not invalidate them unless a tap target moves (none of these fixes moves one). Stop rules: `SAME_PLAY_DEMO_REVS`, `ACTION_DEMO_REVS`, `STRATEGY_DEMO_GAMES` in `src/lib/duel/introDemo.functions.ts`.
- **Reveal pictures**: `RetroRunSummary.tsx` + `src/lib/replay/retroSummary.ts` (replays the stored run through the steppers and draws the final board through the game's renderer: Breaker, Meteor, Blockzone) — follows the renderer; `StrategyRunSummary.tsx` (stored lines + run replay) uses the reveal coin / chest renders (`inkbridge-coin`, `matchup-chest`), not the gems/marbles/bubbles; Orbit's `RunPicture` (`orbitReveal.renderer.ts`) draws its own dotted course line (`setLineDash([2,4])`, line 85).
- **strategy-overhaul-check 5c/5f source-text assertions** (lines 270–306, 354–405) grep the renderers for the rendered-art code paths: `/if \(rendered\) ctx\.drawImage\(rendered, …\);\s*else flatGem/` (Gemstone), `/c\.drawImage\(body, 0, 0, size, size\)/` (Coral Pop), `/ctx\.drawImage\(body, x - r, y - r, r \* 2, r \* 2\)/` (Ball Tracker), `/strategyImage\("tilt-disc"\)/` (Tilt), plus "gem-heart" and "bubble-orange" present and "every rendered image is in strategyArt.data.ts, and nothing else", and the 400 KB budget per game. **Reverting to code art for gems / marbles / bubbles fails these by design; the session must change them with Joe's approval (not loosen silently).** Also `src/lib/arcade/strategyArt.data.ts` is generated by `bun scripts/strategy-art-data.ts [--check]`; removing a WebP from `public/strategy/` requires re-running it.
- The `strategyImage()` loader (`src/lib/arcade/strategyArt.ts:20`) returns null in Bun and until loaded, so every Strategy renderer still carries the **code-art fallback path**: the pre-render drawing is in the same function right after the `if (rendered)` / `if (body && shine)` branch. Deleting the branch restores the code art with no other change.

## Retro "lit pixel materials": where they live

One shared module plus per-renderer passes:

| Piece | Module / function | Lines (HEAD) | Added by |
|---|---|---|---|
| Balls (Breaker, Rally; Rally's lives HUD) | `src/lib/arcade/retro.renderer.ts` `retroBall` | 331–360 | `5b694acd` |
| Paddles (Breaker, Rally) | `retro.renderer.ts` `retroPaddle` ("Polished metal" block) | 279–311 (metal 299–306) | `5b694acd` |
| `retroMix` helper (used by both and by Breaker bricks) | `retro.renderer.ts` | 313–330 | `5b694acd` |
| Breaker bricks: smoked-glass plate in gold frame (power bricks), enamel streak (plain bricks) | `breaker.renderer.ts` `paintBrick` | 214–255 (power 216–224, enamel 241–244) | `5b694acd` |
| Breaker capsule icons + top highlight | `breaker.renderer.ts` `drawCapsuleIcon`, call at 387–389 | 168–190 | `1903d0e4` |
| Fission glass atoms | `burst.renderer.ts` `paintAtom` | 75–103 (glass 90–102) | `5b694acd` |
| Blockzone glossy solid blocks | `blockfall.renderer.ts` `drawBfSquare` | 159–210 | `5b694acd` |
| Hover glass dome / polished hull | `hover.renderer.ts` `drawSaucerBody` | 680–716 | `1903d0e4` |
| Tempo glass lane buttons | `beat.renderer.ts` | 93, 481 | `1903d0e4` |
| Spacewalk lit metal ships | `spacewalk.renderer.ts` | 258 | `1903d0e4`, `74ba5d2f` |
| Rally two-tone dithered court | `rally.renderer.ts` `paintCourtFinish` | 181–238 | `1903d0e4`, `74ba5d2f` |
| Shared pixel nebula / planet / star layers | `retroSpace.renderer.ts` (new file) | whole | `74ba5d2f` |

So switching balls/paddles back is **one function each in retro.renderer.ts** and affects Breaker and Rally together; every other material is per renderer.

---

## 1. Breaker and Rally: "bring back the old balls, not the new 3D ones"

**(a) Files / commits.** `src/lib/arcade/retro.renderer.ts` (`5b694acd`, `04db81ac`, `1903d0e4`, `74ba5d2f`), `breaker.renderer.ts` (`f0c67960`, `5b694acd`, `1903d0e4`, `7778c6d4`, `61954402`), `rally.renderer.ts` (`93d3feac`, `1903d0e4`, `74ba5d2f`, `7778c6d4`, `61954402`, `c3b14c06`).

**(b) What draws it at HEAD.** `retroBall(ctx, x, y, r, colour, core)` in `retro.renderer.ts:337-360`: a `pixelShape` with a top-left light (`shade = (-dx*0.55 - dy*0.65)/r + nz*0.5`), a crisp white spot at (−0.38 r, −0.38 r) of radius 0.26 r, four shade bands via `retroMix`. Callers: Breaker `breaker.renderer.ts:413` (`retroBall(ctx, bx, by, BRK_BALL_R, colour, state.pause > 0 ? colour : RETRO_WHITE)`), Rally `rally.renderer.ts:363` (gold balls), `:374` (serve blink, rallyRev 13), `:380` (main ball), `:401` (lives HUD, r 5). The paddles: `retroPaddle` `retro.renderer.ts:279-311`, the lit band + white highlight + dark lower band at 299–306; callers `breaker.renderer.ts:403`, `rally.renderer.ts:355`.

**(c) At 82f2f648.** `/home/user/old/src/lib/arcade/retro.renderer.ts:279-287` `retroBall`: flat two-tone pixel disc (`d < (r*0.45)**2 ? core : colour`). `retroPaddle` `:255-277` trapezium only (no metal block). Same callers (`breaker.renderer.ts:363`, `rally.renderer.ts:292, 302`).

**(d) Disturbs.** Tiles `public/tiles/breaker.webp`, `rally.webp` (tile-scenes/arcade.tsx imports `retroBall`, `retroPaddle`) → re-export; the Retro intro stills follow automatically (ArtStill); RetroRunSummary's final board follows. No digest check pins the ball. retro-overhaul-check's text floor untouched. Rally's `retroBall(…, "rgba(122,170,255,0.22)")` lives call relies on the `lit` regex guard at HEAD; the old function handles any colour string.

**(e) Recipe (display only).** Replace `retroBall` body with the OLD 8-line body (`old/.../retro.renderer.ts:280-287`). Optionally drop the "Polished metal" block (`retro.renderer.ts:297-306`) to restore the old paddle; keep `retroMix` (Breaker's `paintBrick` uses it). If Joe also means the bricks, restore OLD `paintBrick` (`old/.../breaker.renderer.ts:187-227`) but keep HEAD's `powerSymbol` / `SYMBOL_FIRE` / `drawCapsuleIcon` (icons were a separate Joe request, and capsule text under 11 px would fail the text floor). Then `bun scripts/shots/tile-scenes.ts breaker rally`. Nothing in the sims changes (ball radius `BRK_BALL_R`, `RALLY_BALL_R` unchanged).

---

## 2. Hover: "unpixelate the background; make it change colour to match the gates"

**(a)** `src/lib/arcade/hover.renderer.ts` — `1903d0e4` (pixel nebula, parallax stars, glass saucer), `74ba5d2f` (richer nebula, concept B), `61954402`. Fill: `arenaFills.renderer.ts` `hoverFill` (unchanged, 201–208) and `hover.renderer.ts` `hoverNightFill` (717–728, unchanged content).

**(b) HEAD.** `paintNight(c, H)` `hover.renderer.ts:159-179` (sky gradient `HOVER_SKY_TOP/MID/LOW`, dust band, stars) now calls `paintNebula(c, H)` at line 178; `paintNebula` `:217-240` is the pixel art: 3 px blocks (`NEB_BLOCK`), Bayer 4×4 dither (`NEB_BAYER`), six opaque steps `NEB_STEPS` (lines 190–196, navy→pale blue-white), `nebulaNoise` (:197-209), young white stars in the brightest gas. Cached once per canvas as a device layer: `drawNight` `:241-243` → `deviceLayer(ctx, \`hover-space-${H}\`, …)`; called from `drawWorld` :309 (play and reveal). `drawNearStars` (:279) is the new parallax layer. Gate colours: `BARRIER_CYCLES` `:54` (`#FF4DFF, #3DFFE0, #FFD84A, #4BFF7A, #FF9A3C, #B49CFF`), applied per pillar at `:319` as `BARRIER_CYCLES[Math.floor(index / 7) % 6]` (a new colour every 7 gates; `index` is the pillar index). The **next gate** the saucer must pass is pillar `state.gates`, so "the gate colour now" = `BARRIER_CYCLES[Math.floor(state.gates / 7) % 6]`; the success layer already uses that at `:368` and a faint border flash on the change at `:371` (`state.gates % 7 === 0`).

**(c) OLD.** `old/.../hover.renderer.ts:155-175` `paintNight`: gradient + dust band + two `spaceStars` passes, **no nebula**; same `drawNight` device layer; same `BARRIER_CYCLES` (:50, :226).

**(d) Disturbs.** arcade-fill-check: `hoverNightFill` (fill above/below the world, 717–728) paints `HOVER_SKY_LOW`→`#030410` with stars; the in-world sky ends at `HOVER_SKY_LOW` at the bottom so the seam check passes — a tinted background must still end in the fill's colour at the world's bottom/top (or the fill must follow the same tint; see below). Hover's tile (`drawPipe`, `drawSaucer`, `hoverStar`) does not draw the sky. The intro still (ArtStill) follows. Reduced motion: the device layer is static; a colour change at a gate crossing is a discrete repaint, not motion — fine, but under `prefers-reduced-motion` arcade-fill-check requires the *fill canvas* pixels to hold still over 1.5 s; a sceneKey repaint happens only on a gate colour change (every 7 gates), so keep the fill static or key it (see recipe) — a repaint coinciding with the 1.5 s sample would fail, so safest is leaving `hoverNightFill` black/static and tinting only the in-world layer, whose edges stay `HOVER_SKY_LOW`.

**(e) Recipe (display only).**
1. Unpixelate: replace `paintNebula`'s block/dither loop with soft radial clouds, e.g. the existing `blob()` helper (`polishA1.renderer.ts:72`, used by OLD Meteor's `paintSpace`) or `createRadialGradient` ellipses; keep it inside `paintNight`.
2. Follow the gates: make the layer key carry the colour index — `drawNight(ctx, H, idx)` → `deviceLayer(ctx, \`hover-space-${H}-${idx}\`, …)` with `idx = Math.floor(state.gates / 7) % 6` from `drawWorld` (:309), and tint the nebula towards `BARRIER_CYCLES[idx]` (mix with `retroMix` from retro.renderer.ts, keep alpha low so barriers/saucer/stars stay brighter). Six cached layers at most. Keep the top and bottom rows at `HOVER_SKY_TOP/LOW` so `hoverNightFill` still meets the world with no seam.
3. If Joe wants the fill around the world to follow too: `hover.tsx:268` uses `ArcadeArenaSlot … scene={hoverNightFill}` with no `sceneKey`; `ArcadeArenaSlot` takes `sceneKey` (ArcadeArenaSlot.tsx:48) — pass the colour index from a ref and tint inside `hoverNightFill`. Check the reduced-motion hold in arcade-fill-check before doing this.
No stamp: the sim (`hover.ts`) only defines `HOVER_PILLAR_COLOUR` for its dev preview (:548).

---

## 3. Wavefront

**(a)** `src/lib/arcade/wavefront.renderer.ts` (`79f13df7`, `5b694acd`, `74ba5d2f`, `7778c6d4`, `61954402`), `retroSpace.renderer.ts` (`74ba5d2f`), `arenaFills.renderer.ts` `wavefrontFill` (unchanged since OLD), sim `wavefront.ts` (`79f13df7` wavRev 14, stage 3 wavRev 15 in `61954402`).

**(b) HEAD.**
- *Background:* `paintSpace(c, H)` `wavefront.renderer.ts:387-439`: sky gradient `#0D0B22 → #08081A → #07070C`, then `paintPixelNebula` (:398-416) with violet steps (`rgba(34,18,78)…rgba(156,120,226)`) and a second teal palette (`steps2`), band thin where the formation flies; `paintPixelPlanet` ringed planet at (W−40, H−150) r 46 and a moon at (60,120) r 9 (:417-418); 150 stars + 4 glints (:419-438). Cached per device scale and world height in `drawSpace` `:447-473` (key `${scale}:${WAV_WORLD_H}`); `drawStarLayers` (three drifting layers, `WAV_STAR_LAYERS` :441) and 8 twinkles drawn each frame. Called from `drawWavefrontArtWorld` :1107 after `ctx.fillStyle = "#07070C"; fillRect` (:1103-1104) and the uniform-scale transform (:1099-1106).
- *Purple:* the nebula `steps` palette :405; the sky top `#0D0B22`; `WAV_PURPLE` (`wavefront.ts:1114`, `#A78BFA`) is the wave-clear success-layer colour (:1111). Enemy edge lights `WAV_NEON = "#3FE6FF"` (:112, cyan since `1903d0e4`; was magenta), `WAV_FURNACE = "#FF8A2A"` (:113).
- *Fit to the border backgrounds:* the world is 390 × `wavWorldH(state)` (`WAV_WORLD_H` 620 / `WAV_TALL_H` 730 / `WAV_X_H` 800 for x10 states, `wavefront.ts:33, 1497, 1568`); the arena draws it at the largest uniform scale, top-anchored (ArcadeArenaSlot.tsx:19-26); `docs/arena-sizes-oct-2026.md:33` → at 390×844 the box 390×768 holds a 374×768 world (0.96×) with 8 px side strips; `ARENA_FILL_SIDES` includes wavefront (arenaFills.renderer.ts:33). The side/below fill is `wavefrontFill` `arenaFills.renderer.ts:503-517`: flat `#0B0B18` + random stars, plus a faint `rgba(70,60,140,0.10)` radial below. The world's own sky is darker (`#07070C` at the bottom, violet nebula within) and its bottom-anchored content is `#07070C` (the fill colour of the stage, :1103), so the strips read as a different, bluer panel — "looks bad". arcade-fill-check's SEAM_MAX tolerates it today.
- *Ship border colour per wave:* hulls are painted by `paintHull(ctx, kind, colour, x, y, s)` (:224-320) with `neonLine` (:166-178) and `cannon` (:210-223) all using the module constant `WAV_NEON`; sprites cached in `drawHull` (:361-380) by key `s6:${kind}:${colour}:${s}` — **no wave in the key**. `colour` is the steel finish (`WAV_COLOURS[(code-1)%3]`, `wavefront.ts:1115`) or `wavHullTint(cell, wave)` (:125-131, 3 in 16 ships maroon/navy/darkred). The armour hull (:555), boss (:617), saucer (:1047) also use `WAV_NEON`. Call sites: `:1118`, `:1130` (`drawWavefrontArtWorld`).
- *Formation width:* sim constants `wavefront.ts:75-82`: `WAV_COLS 6`, `WAV_CELL 28`, `PITCH_X 44`, `PITCH_Y 36`, `START_X` centred; shaped waves `WAV_FORMS` (:1389, `WAV_FORM_STEP_Y` :1419) and the x10 `WAV_FORMS_X`; `wavShapeBox` (:488-494) places hit boxes from them; wavRev 15 pads hit boxes by `WAV_V15_HIT_PAD` 3 (:2585). **Widening = hit-box/spawn change = new stamp (wavRev 16)**, dealt only on seeds proved at 200 at every level (`bun scripts/wavefront-big-deal.ts`, wavefront-deal-check), and `docs/design/retro-overhaul.md:142` already records it as "the wider formation is a follow-up after the trains (Joe, 16 Nov 2026)".

**(c) OLD.** `old/.../wavefront.renderer.ts:377-438` `paintSpace`: the same sky gradient, **six soft radial-gradient nebula clouds** (purple/blue, alphas 0.05–0.2), stars, glints, a dim ringed planet low left drawn with `arc`/`ellipse`. `drawSpace` :440 cached the same way, no star layers/twinkles. `WAV_NEON = "#FF3FD0"` (:104, magenta). No pixel art.

**(d) Disturbs.** Tile `public/tiles/wavefront.webp` (`drawHull`, `drawFighter`, `drawShipFlame`, `drawWavefrontBeam`) → re-export if hull colour logic changes; wavefront-ships-check (points inside the cell for each kind/colour) — keep `paintHull`'s bounds; arcade-fill-check seam at the world's left/right/bottom edges; the intro ArtStill follows; retro-overhaul-check text floor (the Wave banner). `docs/design/pages-review/retro/concept/wavefront-A.webp` is "mockup A" (GALLERY.md:83: "Concept A's purple nebula").

**(e) Recipe.**
- *Unpixelate / less purple:* in `paintSpace` replace the `paintPixelNebula` call (:398-416) with OLD's radial `blob`-style clouds (`old:386-401`) using the `blob()` helper (`polishA1.renderer.ts:72`) and a cooler palette (e.g. indigo/teal, drop the `rgba(150,70,220)` / `rgba(180,80,230)` purples); keep or drop `paintPixelPlanet` (:417-418 — swap for OLD's gradient planet `old:426-437`). Keep `drawStarLayers` if the depth is liked (they are stars, not pixel art). Display only.
- *Fit the strips:* make `wavefrontFill` (arenaFills.renderer.ts:503-517) continue the world's sky: paint the fill regions with the same vertical gradient (`#0D0B22 → #08081A → #07070C` mapped on `view.worldH`) and the same star seed, or export a `wavefrontSkyAt(y)`/`paintWavefrontSky(ctx, rect, worldH)` from wavefront.renderer.ts and call it from the fill (fills may import renderers: arenaFills already imports `METEOR_BORDER_COLOURS` from snake.renderer). Also change `ctx.fillStyle = "#07070C"` at :1103 to match. Proof: arcade-fill-check wavefront part.
- *Ship border per wave:* add a `neon` parameter to `paintHull`/`neonLine`/`cannon` (default `WAV_NEON`), compute `wavNeonFor(wave)` (a 5-entry palette in the renderer), pass `state.wave` through `drawHull(…, t, neon)` and include `neon` in the sprite key (`:362`). Armour/boss/saucer can keep cyan or take the same. Display only; wavefront-ships-check still passes if signatures gain optional params.
- *Wider formation:* new stamp; sim change in `wavefront.ts` (`PITCH_X`, `WAV_FORMS*`, `START_X`, `SHIP_MIN_X/MAX_X` unaffected), re-prove deals, `pinPreRetro`-style pin for older checks, `LIVE_BANDS` / `ARCADE_STANDARD` entry, intro demo re-record. Out of a display-only session's scope.
- *Meteor/wormhole backgrounds closer to mockup A:* see item 10 (the mockup is `docs/design/pages-review/retro/concept/snake-A.webp`; GALLERY.md:8 shows stage 3's rings beside it).

---

## 4. Fission: "smaller atoms, and no white shine on them"

**(a)** Sim `src/lib/arcade/burst.ts` (`1903d0e4`: `BURST_REV_BIG 13`, `BURST_RADIUS_BIG`, `burstRadius`), renderer `burst.renderer.ts` (`04db81ac`, `273521e7`, `5b694acd`, `1903d0e4`, `7778c6d4`, `61954402`). Doc `docs/arcade-standard/burst.md:3-19`.

**(b) HEAD.** Sizes: `burst.ts:90-98` — `BURST_RADIUS = [32, 22, 14, 8]`, `BURST_RADIUS_BIG = [38, 26, 17, 10]`, `burstRadius(state, size)` picks BIG when `state.big` (burstRev 13, `BURST_REV_BIG = 13` at :1845) and scales by a level's `lv.sizePct`. It is read by the sim (:397, :464, :489, :533), the renderer (:234, :277, :288, :298, :396) and the sound observer. Shine: `paintAtom` `burst.renderer.ts:75-103`: the pre-existing Polish A1 sphere shading (:79-89) already has a small white dot at (−0.06 r) r 0.12 (:88-89); the Retro overhaul's **glass block** at :90-102 adds a deeper body gradient, an **85 % white ellipse highlight** at (0.62 r, 0.5 r) 0.3×0.15 r, and a 55 % white rim arc. Atoms are cached per size and radius (`cachedArt(\`atom:${ball.size}:${r}\`)`, :279).

**(c) OLD.** `old/.../burst.renderer.ts:72-90` `paintAtom`: the same body up to the small white dot (:88-89), no glass block. Sizes: only `BURST_RADIUS [32,22,14,8]` (burstRev 12 and before).

**(d) Disturbs.** Smaller atoms change hit circles → **a new stamp (burstRev 14)**: `BURST_RADIUS_*` table or `big` off, `burstArtGameFor` (:461-470), `LIVE_BANDS`, `ARCADE_STANDARD.burst` entry (`scripts/arcade-standard/burst.ts`, `PERFECT_SEED` found again on 13), Retro levels (`retroLevels.ts` burst sizePct), the intro demo (`scripts/retro-demos.json` burst was recorded on 13; the demo stop rule in introDemo.functions.ts), bots `scripts/arcade-skill-bands/bots/burst.ts`, `scoring-audit-arcade-check`'s help-stamp assertion, legacy replays (burst-standard-check, fission-carry-check, retro-overhaul-check section on burstRev 12/13). The shine alone is display only: tile `public/tiles/burst.webp` (arcade2.tsx imports `paintAtom`) → re-export; burst-renderer-performance-check counts rects/blits only.

**(e) Recipe.** *Shine (display only):* delete `burst.renderer.ts:90-102` (the glass block) — exactly OLD's function; optionally also drop the small dot at :88-89 if "no white shine" means none at all. *Size:* either (i) deal `burstRev 14` = rev 13's rules with a middle table (e.g. `[35, 24, 15, 9]`) through a new `burstRadius` branch keyed on a state flag outside the checksum of older revs, re-measure with `bun scripts/level-tune.ts burst --level=all`, re-find the perfect seed; or (ii) deal burstRev 12 again (`BURST_RADIUS`) — not allowed by the stamp rule without a new number, so (i). Record the choice in `docs/arcade-standard/burst.md`.

---

## 5. Ball Tracker: "go back to the 2D balls"

**(a)** `src/lib/arcade/ballTrackArt.renderer.ts` (`a22ab428` MARBLE_DRAW_R 27, `5b9fe29a` rendered marbles, `3ad07732`, `40f79896` rendered wood, `305a50f6`); renders `public/strategy/bt-marble-{red,blue,green,yellow}.webp`, `marble-gloss.webp`, `bt-board.webp`, `bt-walnut.webp` (Blender `docs/design/cosmetics-redraws/blender/strategy_art.py` jobs `marbles`, `btwood`); hashes `src/lib/arcade/strategyArt.data.ts`.

**(b) HEAD.** `btMarble(ctx, x, y, r, colour, seed)` `ballTrackArt.renderer.ts:487-537`: lines 490–496 draw `strategyImage(BT_MARBLE_ART[colour])` + `strategyImage("marble-gloss")` at the marble's radius and return; lines 497–536 are the OLD code marble (toyMarble + gradients + gloss), used until the images load. Drawn at `MARBLE_DRAW_R = 27` (:33; call sites :901 shadow, :929 marble, :930 gold band), **larger than the sim radius `BALL_R 22.5`** (`ballTrack.ts:494`; marbles never collide with drawn things, comment :30-32). Wood: `woodPattern(ctx, "bt-board" | "bt-walnut")` :238-246 (strategy-overhaul-check 5f asserts both patterns are used).

**(c) OLD.** `old/.../ballTrackArt.renderer.ts:440-480` `btMarble`: code marble only; drawn at `BALL_R` (22.5) at :823/:829/:830.

**(d) Disturbs.** strategy-overhaul-check 5c asserts `/ctx\.drawImage\(body, x - r, y - r, r \* 2, r \* 2\)/` **and** `/toyMarble\(ctx, x, y, r, colour, 0, seed\)/` in this file (line 302) — reverting fails the first regex (Joe's approval to change the assertion); "every rendered image is in strategyArt.data.ts and nothing else" + budget — keep or remove the WebPs consistently (`bun scripts/strategy-art-data.ts`); tile `public/tiles/balltrack.webp` (arcade2.tsx `btMarble`; harness waits for STRATEGY_ART) → re-export; intro still `public/intro/balltrack.webp` + `strategyStills.data.ts` → `bun scripts/shots/strategy-stills.ts balltrack`; StrategyRunSummary for balltrack replays on the phone (unaffected). `tap-mapping` not involved.

**(e) Recipe (display only).** Delete `ballTrackArt.renderer.ts:490-496` (`const art … return;`) and the `BT_MARBLE_ART` map (:480-485) and the `strategyImage`/`StrategyArtName` imports if unused (the wood patterns still use `strategyImage`). Decide `MARBLE_DRAW_R`: 27 keeps the overhaul's bigger marble; `BALL_R` (22.5) restores the OLD size exactly. Remove `bt-marble-*.webp` + `marble-gloss.webp`? `marble-gloss` is shared with Tilt (`tiltRenderedMarble` :1653-1667) — keep unless Tilt reverts too. Update strategy-overhaul-check 5c (line 302) with Joe's approval; re-export tile and still.

---

## 6. Gemstone: "go back to the old gems"

**(a)** `src/lib/arcade/matchup.renderer.ts` (`a22ab428`, `08b8f44f`, `feb336f3` lit cut gems in code, `5b9fe29a` rendered gems, `40f79896` re-cut renders, `bcafbfdb`, `e2364622`, `ef7b52e5` gem-heart); renders `public/strategy/gem-{circle,diamond,heart,hexagon,square,star,triangle}.webp` (`strategy_art.py` job `gems`, `gem7`); `matchup-chest.webp` is the reveal's (Joe didn't name it).

**(b) HEAD.** `paintMatchupGem(ctx, kind, cx, cy, radius, time)` `matchup.renderer.ts:338-482`; the ordinary-gem branch at :472-480: `const rendered = strategyImage(\`gem-${shape}\`); if (rendered) ctx.drawImage(rendered, cx - radius, cy - radius, radius*2, radius*2); else flatGem(…)`. `flatGem` (:232-302) and `facetedGem` (:193-231, "A cut stone… each bevel facet lit…") were themselves re-lit by `feb336f3` (diff vs OLD: per-facet light `lx,ly`, refracting table gradient, a white specular strip on the most lit facet, darker outline). Specials (bomb, cross, jackpot, star) use `facetedGem`; the treasure is now a chest (:401-460, `a22ab428`, Joe's audit — keep). Sprites cached in `drawMatchupGem` (:484-492) by `${kind}:${radius}:${strategyArtVersion()}`.

**(c) OLD.** `old/.../matchup.renderer.ts:298-404` `paintMatchupGem`; ordinary gems at :399-402 → `flatGem(ctx, shape, cx, cy, radius, colour)`; OLD `facetedGem` :182-215 ("Flat table and bevel planes: fixed per cut, with three own-colour shades": `light = shade(colour, 0.28)`, `dark = shade(colour, -0.3)`, facet by height, an own-colour inner shine at alpha 0.16); OLD `flatGem` :216-262, `gemGlint` :263-297. OLD treasure was the bronze octagon medallion (:355-390) — superseded by the chest, not part of this ask.

**(d) Disturbs.** strategy-overhaul-check 5c lines 299 and 305 (`if (rendered) … else flatGem`, `strategyImage(\`gem-${shape}\``, "gem-heart" in STRATEGY_ART) and the "nothing else" / budget assertions; tile `public/tiles/matchup.webp` (arcade.tsx `paintMatchupGem`, harness waits for images); intro still `public/intro/matchup.webp` (`strategy-stills.ts matchup`); the gem sprite cache key includes `strategyArtVersion()` — harmless. gemstone-levels-check / gemstone-rev12-check are sim checks. Gem FX (`drawStrategyGemFx` :1526, sparks) read gem positions only.

**(e) Recipe (display only).** In `paintMatchupGem` replace :472-480 with OLD's two lines (`flatGem(ctx, shape, cx, cy, radius, colour)`, keeping `matchupGemShape`/`matchupGemColour` which handle matchupRev 13's heart). Restore OLD `facetedGem`/`flatGem`/`gemGlint` bodies (`old:182-297`) if "old gems" means the pre-`feb336f3` flat cut (likely: the lit cut was the first step towards the renders); the heart shape must exist in `cutPoints` (HEAD :158 handles "heart"; OLD did not — keep HEAD's `cutPoints`). Remove `gem-*.webp` and re-run `bun scripts/strategy-art-data.ts`; update strategy-overhaul-check 5c (Joe's approval); re-export tile and still; `bun scripts/reveal-palette.ts` (tile hues feed the reveal gradient).

---

## 7. Coral Pop: "remove the whiteness from the bubbles"

**(a)** `src/lib/arcade/bubble.renderer.ts` (`268a1883` bubbleRev 12 sim/stage, `a22ab428` candy-glass depth, `5b9fe29a` rendered bubbles, `3ad07732`, `40f79896` re-lit renders ("a big window of light and a rim light"), `b6b41570`, `ef7b52e5` bubble-orange); renders `public/strategy/bubble-{red,yellow,green,blue,purple,orange}.webp` + `bubble-gloss.webp` (`strategy_art.py` jobs `bubbles`, `bubble6`).

**(b) HEAD.** `paintBubble(value)` `bubble.renderer.ts:504-569`: lines 512–522 draw `strategyImage(BUBBLE_ART[value-1] | "bubble-orange")`, the creature, then `strategyImage("bubble-gloss")` over it and return — the whiteness is baked into the renders (the "big window of light", rim light) plus the gloss WebP. Fallback (:523-567) is OLD's code bubble. `bubbleGloss(c, r)` :388-442: the Strategy overhaul added a far-side shade and a `rgba(255,255,255,0.28)` "light through the glass" radial at (1.22 r, 1.42 r) (:389-406) on top of the OLD sheen (0.9 white radial at (0.66 r, 0.46 r)), rim arc 0.45, highlight crescent 0.92 (:407-441). Sprites cached per value/size in `blitBubble` → `seaSprite` (:765-781).

**(c) OLD.** `old/.../bubble.renderer.ts:450-500` `paintBubble` (code only: colour radial, shade, rim 0.55, creature, highlight crescent 0.85, glint dot 0.9, far arc 0.35, `bubbleGloss`); OLD `bubbleGloss` :353-388 (sheen, rim arc, crescent — no "through" light).

**(d) Disturbs.** strategy-overhaul-check 5c lines 300 (`c.drawImage(body, 0, 0, size, size)` + `drawCreature`), 304 ("bubble-orange" in STRATEGY_ART), 306 (`sixth ? "bubble-orange"`), and the file/budget assertions; tile `public/tiles/bubble.webp` (arcade.tsx `paintBubble`), still `public/intro/bubble.webp`; bubble-levels-check is a sim check; arcade-fill-check (reef edge unchanged).

**(e) Recipe (display only).** Two options. *Keep renders, cut the white:* re-render with `strategy_art.py bubbles bubble6` after lowering the window/rim light strengths in `bubbles()` / `sphere_render()` (lines 222–313 of the script; Blender via a venv outside the repo), and re-run `strategy-art-data.ts`, `strategy-stills.ts bubble`, `tile-scenes.ts bubble`; 5c passes unchanged. *Or drop renders:* delete `:508-522`, remove `bubble-*.webp` and `bubble-gloss.webp`, and, if the code bubble is still too white, lower the code highlights (`bubbleGloss` sheen 0.9→~0.5, crescent 0.92→~0.6, glint 0.9, rim 0.55) and delete the "through" radial (:401-406); update 5c lines 300/304/306 with Joe's approval.

---

## 8. Tilt: "add the dark wooden background"

**(a)** `src/lib/arcade/tiltArt.renderer.ts` (`a22ab428` fill zoom + darker shaded table + `WALNUT_TABLE_EDGE`, `4e826b8b`, `5b9fe29a` rendered walnut disc, `3ad07732`, `40f79896` calm walnut, `de81fd10`); `arenaFills.renderer.ts` `tiltWalnutFill` (`a22ab428`); render `public/strategy/tilt-disc.webp`, `tilt-disc-gloss.webp`, `tilt-marble-{amber,blue}.webp`, `marble-gloss.webp`.

**(b) HEAD — what is drawn around the disc now.** tiltRev 12 (`big`) stage `drawWorldX` :1100-…: a screen-fixed cached board layer (:1126-1138) filled `WALNUT_TABLE = "#140C07"` (:1472, near-black) then `drawWalnutTable(c, W, H)` :1499-1527: 70 grain curves, a small warm lamp pool (`rgba(255,190,120,0.16)` radial, W/2−10), and a radial **shade to `TILT_TABLE_SHADE` 0.5 black at the world's edge** (:1522-1526), giving `WALNUT_TABLE_EDGE = "#0A0603"` (:1476) — the edge colour the fill continues. The fill beyond the world: `tiltWalnutFill` `arenaFills.renderer.ts:718-745` paints `#0A0603` + very faint grain (`rgba(6,3,1,0.3)` / `rgba(160,104,60,0.05)`) + a 0.4 black fall-off — i.e. **almost black, barely wooden**. Scene wiring: `tilt.tsx:49` `scene={tiltArenaSceneFor(data?.tiltRev)}` → `tiltArenaSceneFor` :758-762 picks `tiltWalnutFill` for `TILT_REV_BIG`. The disc itself fills the width (`tiltFillZoom` :813-815, a22ab428), so little table shows beside it; the walnut disc face is the Blender render (`paintWalnutDisc` :1530, `strategyImage("tilt-disc")`, lacquer `tilt-disc-gloss` :1227).

**(c) OLD (3 Nov 2026 walnut, pre-overhaul).** `WALNUT_TABLE = "#2B1A10"` (`old/tiltArt.renderer.ts:1360`, a readable dark brown), `drawWalnutTable` :1382-1402 with a larger warm pool (0.22 → 0.08, radius 0.6·max(W,H)) and **no edge shade**; fill `tiltWalnutFill` (`old/arenaFills.renderer.ts`) painted `#2B1A10` with grain `rgba(12,6,2,0.3)` / `rgba(160,104,60,0.10)`; `tiltFixedZoom` (:790) left table visible round smaller discs; the disc was code walnut (`paintWalnutDisc` :1404…, `WALNUT_DISC "#5A3721"`).

What Joe likely means: the 15 Nov pass darkened the table to near-black (#140C07 shaded to #0A0603) and zoomed the disc to the full width, so the "dark wooden background" vanished into black. Restoring OLD's `#2B1A10` table, pool and fill brings the wood back.

**(d) Disturbs.** arcade-fill-check seam: the world's edge colour and the fill must agree — change `WALNUT_TABLE`, `TILT_TABLE_SHADE`/`WALNUT_TABLE_EDGE` and `tiltWalnutFill`'s base together (tilt.tsx imports `WALNUT_TABLE_EDGE` :4 — check its use there, likely the canvas background). strategy-overhaul-check 5c line 301 (`strategyImage("tilt-disc")`, rendered marbles) only matters if the disc/marble renders go too; 5f Tilt effect regexes (dial, knock, wobble, swap) are untouched by table colours. Tile `public/tiles/tilt.webp` (tile scene uses `tiltArt` painters? arcade.tsx has no tiltArt import — the scene draws its own; check `backgrounds.ts` tilt entry) and intro still `public/intro/tilt.webp` (`strategy-stills.ts tilt`).

**(e) Recipe (display only).** In `tiltArt.renderer.ts`: `WALNUT_TABLE` → `#2B1A10`; `drawWalnutTable` pool back to OLD's (:1392-1397 old) and either drop the edge shade (:1522-1526) or lower `TILT_TABLE_SHADE` (0.5 → ~0.25) and recompute `WALNUT_TABLE_EDGE` to the shaded value; in `arenaFills.renderer.ts` `tiltWalnutFill` base (:722) and grain alphas (:731) back to OLD's `#2B1A10` / 0.3 / 0.10. Optionally revert `tiltFillZoom` (:813-815) to `tiltFixedZoom` so table shows beside mazes 1–3 — but Joe asked for the fill-the-width disc in the Strategy stage 1 review (gallery), so ask first. Re-export still (and tile if its background is the table: `scripts/shots/tile-scenes/backgrounds.ts`).

---

## 9. Orbit: thin solid orbit lines; known bugs

**(a)** `src/lib/arcade/orbit.renderer.ts` (orbit path code unchanged since OLD — the dashes predate the overhaul: "Polish A4 (25 Oct 2026)"). Overhaul commits touching the file: `10ab3ce4`, `49170233`, `7e623f7e`, `0012e040`, `998696d9`, `831bd6a5`, `9f116874`, `3c6382e9`.

**(b) HEAD.** `drawOrbitPaths(ctx, state, visible, camX, camY, t)` `orbit.renderer.ts:496-515`: for each visible planet, a soft wide glow stroke (lineWidth 7 / 4, alpha 0.2 / 0.08, skipped under reduced effects) then **`ctx.setLineDash(cur ? [7, 5] : [4, 6])`** with a drifting `lineDashOffset` for the current orbit, `lineWidth` 2 / 1.2, alpha 0.95 / 0.5, `tracePath(ctx, p, …, 72)`. Called from the legacy world at :688 and the live expansion world (`drawOrbitRev3ArtWorld`, orbitRev 3+ incl. 12–16) at :1112. The release guide line is also dashed (`setLineDash([4, 6])`, :731 and :1174). Planet rings (`drawPlanetRing`, orbitPlanets.renderer.ts:262-308) are the ringed planets' own rings inside the collision circle, not orbits. The reveal's run picture draws the course dotted (`orbitReveal.renderer.ts:85` `setLineDash([2, 4])`).

**(c) OLD.** Identical: `old/.../orbit.renderer.ts:491-510` — the dashes were there before the overhaul too (so this is a new request, not a revert).

**(d) Disturbs.** orbit-camera-check / orbit-overhaul-check / play-control-clearance-check judge geometry and the SET CHECKPOINT corner, not line style; `scripts/shots/orbit-*` tools only. Intro ArtStill follows. Reduced effects path (`lite`) must still draw.

**(e) Recipe (display only).** In `drawOrbitPaths` replace :512-513 with `ctx.setLineDash([])` and drop `lineDashOffset`; set `lineWidth` to e.g. 1.5 (current) / 1 (others) and keep alphas; optionally remove the glow pass (:505-511) if "thin" means no halo. Leave the release guide (:1174) and the reveal's dotted course (`orbitReveal.renderer.ts:85`) unless Joe says otherwise.

**Orbit bugs / notes found.**
- `docs/design/game-reviews/action.md:325`: "Wrong numbers in the pops: 'SLINGSHOT! +4' and 'PERFECT ORBIT +1' show orbitRev 12's values (live slingshot 3, perfect orbit 11/21)… Gate them on the stamp or drop the numbers" — check whether `orbit.renderer.ts` ~:1299/:1304 (review's lines) were fixed; `:326`: "Likely bug: `misses: 1 - state.respawns` … goes down on a crash, so the success layer's capture chain never resets" — orbit.md:221 says the capture chain now resets on every slip (`orbitSlips`), so this one was fixed in `10ab3ce4`.
- `action.md:330`: no skill-band bot for orbitRev 14 at review time (bands measured on other stamps); orbit.md:235-237 says the bot now plays 14 and 15.
- Fix commits in the range: `95eaa2d3`/`2c55d876` "arcade-play-check: Orbit's and High Rise's grace respawns count as resets" (check plumbing); `831bd6a5` "hold a finished run 1.5 s for the sun moment"; `583ec04e` "Review fixes: … arcade bugs" (pre-overhaul).
- `orbitRev3.ts:1252` comment documents the historical black-hole bug (orbitRev 4–6, fixed by orbitRev 7's swept holes).
- Open decisions in `docs/arcade-standard/orbit.md:350` (Easy's belts from 25 vs Normal's 31) and :389 (Expert's speed part).
- Still camera (orbitRev 14+): `orbitCamera.ts` `orbitStillCamera`/`advanceStill`, `clearTopEdge` (3 Nov); no TODO/FIXME in `src/lib/arcade/orbit*.ts` or `src/puzzles/orbit.tsx`.

---

## 10. Meteor: "better backgrounds" and wormholes (towards mockup A)

**(a)** `src/lib/arcade/snake.renderer.ts` — `1903d0e4` (snakeRev 14 mid rock, glowing tail), `74ba5d2f` (field + wormhole spiral, stage 2), `7778c6d4`, `61954402` (stage 3: wormholes as glowing rings). Mockup A = `docs/design/pages-review/retro/concept/snake-A.webp`; GALLERY.md:8-12 shows "today | concept A | new" wormhole crops (`stage3/snake-wormholes*.webp`).

**(b) HEAD.** Background `paintSpace(c, rows, worldH, W, cols, boardX)` `snake.renderer.ts:633-688`: black `#04030A`, sparse `pixelStars` outside the board, then **`pixelField`** (:619-631) — 3 px blocks dithered (`FIELD_BAYER`) through `FIELD_STOPS` (:606: violet `#2A1550` → plum → near-black → deep teal → teal `#0E4642`, twelve bands via `fieldColourAt` :608-618), stars on the board, the pre-existing edge glow, black border rows/margins (kept for arcade-device-bottom-check) and edge fades. Cached once per world size via `backdrop(ctx, \`meteor-space:${W}\`, …)` at :384. Grid `drawGrid` :332 ("a fine violet-white grid"). Wormholes: `drawFeatures` :880-895 → `glow(…)` then `drawSpiral(ctx, p.x, p.y, 12, colour, turn, flash)` :550-587 (dark mouth, six 2 px vanes swirling in, a 2 px rim with a hot→pale→colour gradient, dark centre; turn 0.05 rad/tick); `dashedRing` :589-599 kept but unused by warps. `WARP_COLOURS` :816.

**(c) OLD.** `old/.../snake.renderer.ts:437-490` `paintSpace`: black, **four soft `blob()` nebulae** (purple `#5B2A9E` 0.42, teal `#137A78` 0.34, violet `#7A3FC4` 0.16, teal `#1FA8A0` 0.14), 190 pixel stars, the same edge glow/black rows/fades. Wormholes `:683-697`: glow, a 9 px dark mouth, two `dashedRing`s (12 px outer in the pair's colour, 7.5 px inner white counter-turning, turn 0.08 rad/tick).

**(d) Disturbs.** snake-renderer-check (rect-size counts; the backdrop layer paints once so field rects don't count on later frames, but the wormhole vanes are 2×2 `fillRect`s per frame: line 55 asserts **no 2×2 rects under reduced motion** on the death frame — `drawSpiral` vanes are 2×2 and drawn regardless of motion; verify `drawFeatures` is skipped in that test state (it has `warps` only on snakeRev 9+; the check's state likely has none)). arcade-device-bottom-check's Meteor passes judge the canvas bottom rows and the border pulse (keep the black bottom rows and `drawBorder`). arcade-fill-check: Meteor's border is exempt from the seam rule; `snakeFill`/`snakeAmbient` (arenaFills :340-348) continue black space + stars. Tile `public/tiles/snake.webp` uses `stamp()` only.

**(e) Recipe (display only).** Background: replace `pixelField(...)` + the on-board `pixelStars` (:641-643) with OLD's four `blob()` clouds (`polishA1.renderer.ts:72`) or a smooth gradient field in mockup A's colours (keep `#04030A` base, black border rows at :664-669, edge fades at :670-686). Wormholes: if Joe wants mockup A's look more closely, adjust `drawSpiral` (:550-587) — e.g. thicker rim (`lineWidth 2 + flash` → 3), fewer/brighter vanes — all inside r 12 (the cell is 24 px; "still within 2 px of the cell", bounds rule); or restore OLD's two dashed rings (`old:689-696`, `dashedRing` is still present at HEAD :589). No stamp either way.

---

## Per-item summary of stamps vs display-only

| Item | Display only? | Needs a new stamp |
|---|---|---|
| 1 Breaker/Rally balls (and paddles/bricks) | yes | – |
| 2 Hover background colour follows gates | yes | – |
| 3 Wavefront background, purple, fill fit, per-wave ship colour | yes | **wider formation** (hit boxes/spawns) |
| 4 Fission no shine | yes | **smaller atoms** (hit circles → burstRev 14) |
| 5 Ball Tracker 2D marbles | yes | – |
| 6 Gemstone old gems | yes | – |
| 7 Coral Pop whiteness | yes (re-render or code) | – |
| 8 Tilt dark wood | yes | – |
| 9 Orbit solid orbit lines | yes | – |
| 10 Meteor background / wormholes | yes | – |

Checks to run per change: the game's own check(s), retro-overhaul-check (Retro text floor) or strategy-overhaul-check (its 5b/5c/5f source assertions will need Joe-approved edits for 5–7), snake-renderer-check (10), wavefront-ships-check (3), burst-renderer-performance-check (4), arcade-fx-check, arcade-fill-check and arcade-play-check for the touched games, tile-scenes-check after `bun scripts/shots/tile-scenes.ts <ids>`, reveal-palette-check after re-exporting tiles, strategy-art-data `--check` and strategy-stills after any Strategy change.
