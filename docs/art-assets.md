# Arcade art assets

How sprite art reaches the arcade games, which pack each world uses, and the exact
files to add. Written 11 Oct 2026 alongside the shared success layer
(`src/lib/arcade/arcadeFx.renderer.ts`) and the art pipeline
(`src/lib/arcade/sprites.renderer.ts`).

## Status: pipeline built, art not yet downloaded

The session that built the pipeline could not reach kenney.nl or opengameart.org
(the cloud environment's network policy denies both hosts). No art files are in the
repo yet. Every pilot therefore draws its existing code art today, which is the
designed fallback; nothing on screen has changed. Adding the files below switches
each pilot on with no code change.

## How the pipeline works

- **Location:** `src/assets/arcade/<world>/<file>.png` (or `.webp`). Vite bundles
  every file there through `import.meta.glob`, with hashed URLs cached with the app.
  A sprite can name an explicit `url` instead (for example a Lovable-hosted asset).
- **Manifest:** `ART_WORLDS` in `sprites.renderer.ts` lists each world's pack, page,
  licence and sprite names. Sprite sheets are supported: give a sprite a `frame`
  rectangle `[x, y, w, h]`, or `frames` for an animation, all in one sheet file.
- **Drawing:** `drawArtSprite(ctx, world, name, x, y, w, h, { angle, flipX, frame })`
  fills the given rectangle and returns `true`. When the file is missing, still
  loading or failed, it returns `false` and does not touch the context, and the
  caller draws its original code art. Loading starts on first use and never blocks
  a frame.
- **Resolution:** every arcade canvas caps its backing store at devicePixelRatio 2.
  Each sprite is pre-scaled once per drawn size to the context's device scale and
  cached (96 entries max), so a frame draws one small image without resampling a
  large one.
- **Bounds rule:** callers pass the sim's collision rectangle, and the sprite fills
  it exactly. Trim every PNG to its visible content (no transparent margin) so what
  players see is what collides. `scripts/arcade-fx-check.ts` checks that drawn
  pixels stay within 2 px of the rectangle.
- **Presentation only:** sprite modules are `*.renderer.ts`, never imported by a sim
  or the server. Swapping art cannot change gameplay, scoring or replay, so it needs
  no version stamp.

## One pack per world

All nine packs are by Kenney, from the same flat-vector range, so the worlds share
one style. Kenney's licence is CC0 1.0 (public domain): no attribution is required.
Credit "Kenney (kenney.nl)" is appreciated, and this file records it. Each page is
the official download.

| World | Pack | URL | Licence | Pilot game: what the art replaces |
|---|---|---|---|---|
| Retro | Puzzle Pack | https://kenney.nl/assets/puzzle-pack | CC0 1.0 | Breaker: the paddle |
| Space | Space Shooter Redux | https://kenney.nl/assets/space-shooter-redux | CC0 1.0 | Wavefront: the player ship |
| Real World | Racing Pack | https://kenney.nl/assets/racing-pack | CC0 1.0 | Jaywalk: cars and lorries |
| Kitchen | Food Kit | https://kenney.nl/assets/food-kit | CC0 1.0 | Slice: the four foods (chillies stay code-drawn) |
| Fairground | Shooting Gallery | https://kenney.nl/assets/shooting-gallery | CC0 1.0 | Swish and Flightpath: the wooden stall counter |
| Underwater | Fish Pack | https://kenney.nl/assets/fish-pack | CC0 1.0 | Coral Pop: the fish symbol inside fish bubbles |
| Cave & Lava | Platformer Pack Redux | https://kenney.nl/assets/platformer-pack-redux | CC0 1.0 | Grappler: the rope anchors |
| Orchard | Foliage Pack | https://kenney.nl/assets/foliage-pack | CC0 1.0 | Scrumper: the golden leaves |
| Toybox | Rolling Ball Assets | https://kenney.nl/assets/rolling-ball-assets | CC0 1.0 | Tilt: the player's marble |

Gemstone (matchup) has its own gem art and no world pack; it keeps its code art.

**Style caveat:** Food Kit is a 3D kit. Use its rendered preview PNGs, which are
close to the flat-vector look. If they read as out of place next to the other
worlds, the alternative is to keep Slice's code-drawn food. That is Joe's call.

## Files to add

Download each pack's zip from its page, then save the chosen PNG under the exact
target path. File names inside the zips are the ones I could identify without
access to kenney.nl. Confirm each on download; if a name differs, pick the
closest match and still save it under the target path. The target path is what
the code reads.

| Target path (exact) | Take from the pack | Prep |
|---|---|---|
| `src/assets/arcade/retro/paddle.png` | Puzzle Pack: `PNG/paddleBlu.png` | Trim. Drawn into the 84 × 12 paddle box. |
| `src/assets/arcade/space/player.png` | Space Shooter Redux: `PNG/playerShip1_blue.png` | Trim, nose pointing up. Drawn into the 40 × 24 hit box. |
| `src/assets/arcade/realworld/car.png` | Racing Pack: a car from `PNG/Cars/` (e.g. `car_red_1.png`) | Rotate so the car faces **right**, then trim. Leftward traffic is mirrored in code. |
| `src/assets/arcade/realworld/lorry.png` | Racing Pack: the longest vehicle in `PNG/Cars/` | Same as `car.png`. |
| `src/assets/arcade/kitchen/bagel.png` | Food Kit preview: bagel | Square, trimmed, centred. |
| `src/assets/arcade/kitchen/cabbage.png` | Food Kit preview: cabbage (or lettuce) | Square, trimmed, centred. |
| `src/assets/arcade/kitchen/onion.png` | Food Kit preview: onion | Square, trimmed, centred. |
| `src/assets/arcade/kitchen/meat.png` | Food Kit preview: a steak/meat item | Square, trimmed, centred. |
| `src/assets/arcade/fairground/counter.png` | Shooting Gallery: `PNG/Stall/bg_wood.png` | None. Stretched over the counter strip below the play area. |
| `src/assets/arcade/underwater/fish.png` | Fish Pack: one side-on fish from `PNG/Default size/` | Square, trimmed. Drawn small inside the bubble. |
| `src/assets/arcade/cavelava/anchor.png` | Platformer Pack Redux: a round metal item from `PNG/Items/` or `PNG/Tiles/` | Square, trimmed. Drawn at the 12 × 12 anchor ring. |
| `src/assets/arcade/orchard/leaf.png` | Foliage Pack: a single leaf from `PNG/`, tinted gold if needed | Square, trimmed. Drawn into the 48 px pickup disc's square. |
| `src/assets/arcade/toybox/marble.png` | Rolling Ball Assets: a blue ball from `PNG/` (e.g. `ball_blue_large.png`) | Square, trimmed. Drawn into the marble's collision circle. |

After adding files, run `bun scripts/arcade-fx-check.ts`, then check each pilot on a
phone (Joe). Only the pilots above use art for now. Applying a pack to the rest of
a world means adding sprite names to `ART_WORLDS` and wrapping each draw site in
`if (!drawArtSprite(...)) <existing code art>`.
