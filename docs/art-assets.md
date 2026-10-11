# Arcade art assets

How sprite art reaches the arcade games, which pack each world uses, and the exact
files to add. Written 11 Oct 2026 alongside the shared success layer
(`src/lib/arcade/arcadeFx.renderer.ts`) and the art pipeline
(`src/lib/arcade/sprites.renderer.ts`).

## Status: five pilots have art (11 Oct 2026)

All nine packs were downloaded from kenney.nl on 11 Oct 2026 (every zip is served
from kenney.nl itself; no other host was needed). Five pilots now draw Kenney art:
Breaker, Wavefront, Swish and Flightpath (one shared counter), Grappler and Tilt.
Four keep their code art on purpose; see "Worlds left on code art" below. A missing
or failed file still falls back to the code art, so nothing else changed.

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

All nine packs are by Kenney. Kenney's licence is CC0 1.0 (public domain): no
attribution is required. Credit "Kenney (kenney.nl)" is appreciated; it is given in
`src/assets/arcade/CREDITS.md` and here. Three packs have been renamed on kenney.nl
since this table was first written (Puzzle Pack is now Puzzle Pack 1, and the two
"Redux" packs are now "Remastered"); the old URLs return 404. The URLs below are the
current official download pages.

| World | Pack | URL | Licence | Pilot game: what the art replaces | Art in use? |
|---|---|---|---|---|---|
| Retro | Puzzle Pack 1 | https://kenney.nl/assets/puzzle-pack-1 | CC0 1.0 | Breaker: the paddle | Yes |
| Space | Space Shooter Remastered | https://kenney.nl/assets/space-shooter-remastered | CC0 1.0 | Wavefront: the player ship | Yes |
| Real World | Racing Pack | https://kenney.nl/assets/racing-pack | CC0 1.0 | Jaywalk: cars and lorries | No: no lorry in the pack |
| Kitchen | Food Kit | https://kenney.nl/assets/food-kit | CC0 1.0 | Slice: the four foods (chillies stay code-drawn) | No: 3D renders |
| Fairground | Shooting Gallery | https://kenney.nl/assets/shooting-gallery | CC0 1.0 | Swish and Flightpath: the wooden stall counter | Yes |
| Underwater | Fish Pack | https://kenney.nl/assets/fish-pack | CC0 1.0 | Coral Pop: the five creature symbols in the bubbles | No: fish only |
| Cave & Lava | Platformer Pack Remastered | https://kenney.nl/assets/platformer-pack-remastered | CC0 1.0 | Grappler: the rope anchors | Yes |
| Orchard | Foliage Pack | https://kenney.nl/assets/foliage-pack | CC0 1.0 | Scrumper: the golden leaves | No: no single leaf |
| Toybox | Rolling Ball Assets | https://kenney.nl/assets/rolling-ball-assets | CC0 1.0 | Tilt: the player's marble | Yes |

Gemstone (matchup) has its own gem art and no world pack; it keeps its code art.

## What each pack contains

Checked against the downloaded zips (11 Oct 2026). Every zip has a `License.txt`
stating CC0 1.0.

| Pack (zip) | Contents |
|---|---|
| Puzzle Pack 1 (`kenney_puzzle-pack-1.zip`) | 176 PNG in `PNG/Default` and `PNG/Double` (2×): coloured bricks/elements, balls, paddles (`paddleBlu.png`, `paddleRed.png`), buttons; spritesheet and SVG. Flat vector. |
| Space Shooter Remastered (`kenney_space-shooter-remastered.zip`) | 301 PNG: player ships in `PNG/` (`playerShip1–3_{blue,green,orange,red}.png`, `ufo*.png`) and `PNG/Enemies`, `Lasers`, `Meteors`, `Parts`, `Power-ups`, `Damage`, `Effects`, `UI`; `Backgrounds/`, `Bonus/`; spritesheet and SVG. Flat vector with outlines. |
| Racing Pack (`kenney_racing-pack.zip`) | 429 PNG: top-down cars in `PNG/Cars` (`car_{black,blue,green,red,yellow}_{1–5}.png`, ~71×131, and `_small_` versions; all car-length, nothing lorry-length), `PNG/Motorcycles`, `PNG/Characters`, `PNG/Objects` (cones, barriers, tyres, tents, tribunes), road and ground tiles. Cars face **up**. |
| Food Kit (`kenney_food-kit.zip`) | 3D kit: ~200 models in `Models/` (FBX, GLB, OBJ) plus `Previews/` with one 64×64 shaded 3D render per model (`cabbage.png`, `onion.png`, `meat-cooked.png`, `meat-raw.png`, `donut.png`…; no bagel, the nearest ring shape is `donut.png`). No flat 2D art. |
| Shooting Gallery (`kenney_shooting-gallery.zip`) | 115 PNG: `PNG/Stall` (`bg_wood.png` and `bg_blue/green/red.png` 256×256 tiling textures, curtains, clouds, grass, trees, water), `PNG/Objects` (ducks, targets, rifles, sticks), `PNG/HUD`; spritesheets and SVG. |
| Fish Pack, v2 (`kenney_fish-pack_2.zip`) | 256 PNG in `PNG/Default` and `PNG/Double`: fish in seven colours (plus outline and skeleton variants), bubbles, rocks, seaweed, terrain, background pieces, HUD digits. **No crab, starfish, jellyfish or shell.** Folder is `PNG/Default`, not `PNG/Default size`. |
| Platformer Pack Remastered (`kenney_platformer-pack-remastered.zip`) | 430 PNG: `PNG/Items` (`coinBronze/Silver/Gold.png`, flags, gems, keys, `star.png`; 128×128 with transparent margin), `PNG/Tiles` (boxes, bricks, chain, lava, locks, spikes, `weight.png`, torches…), `PNG/Ground/*`, `PNG/Players`, `PNG/Enemies`, `PNG/HUD`, `PNG/Particles`, `PNG/Backgrounds`. |
| Foliage Pack (`kenney_foliage-pack.zip`) | 219 PNG: `PNG/Default size/foliagePack_001–062.png` (trees, bushes, grass tufts, flowers, rocks, a two-leaf sprout `_018`) and `PNG/Default size/Leaves/foliagePack_leaves_001–044.png`, which are canopy-edge tiles, not single leaves; `Retina/` 2× copies, tilesheet. **No single leaf.** |
| Rolling Ball Assets (`kenney_rolling-ball-assets.zip`) | 122 PNG in `PNG/Default` and `PNG/Retina`: `ball_{blue,red}_{large,small}[_alt].png`, blocks, holes, buttons, keys, numbers, particles, backgrounds. |

## Files

The target paths are what the code reads and are unchanged. The "Taken from" column
gives the real file name in each zip (several earlier names were guesses). Every
file is trimmed to its visible content and stored as an optimised PNG.

| Target path (exact) | Taken from | Size | Notes |
|---|---|---|---|
| `src/assets/arcade/retro/paddle.png` | Puzzle Pack 1: `PNG/Double/paddleBlu.png` | 208 × 48, 1,219 B | Already trimmed; the 2× copy keeps it sharp at DPR 2. |
| `src/assets/arcade/space/player.png` | Space Shooter Remastered: `PNG/playerShip1_blue.png` | 99 × 75, 2,208 B | Nose up as shipped. |
| `src/assets/arcade/fairground/counter.png` | Shooting Gallery: `PNG/Stall/bg_wood.png` | 256 × 256, 1,799 B | A tiling texture: the counter tiles it in 96-unit squares clipped to the strip (stretching it smeared the planks). |
| `src/assets/arcade/cavelava/anchor.png` | Platformer Pack Remastered: `PNG/Items/coinGold.png` | 48 × 48, 2,644 B | Trimmed from 128 × 128 and downscaled. Gold matches the old gold rings; `coinSilver.png` read as a grey dot against the lava. |
| `src/assets/arcade/toybox/marble.png` | Rolling Ball Assets: `PNG/Default/ball_blue_large.png` | 64 × 64, 1,124 B | Already trimmed. |
| `src/assets/arcade/realworld/car.png`, `lorry.png` | Not added | | Racing Pack has `PNG/Cars/car_*_{1–5}.png` but no lorry. |
| `src/assets/arcade/kitchen/*.png` | Not added | | Food Kit `Previews/*.png` are 3D renders. |
| `src/assets/arcade/underwater/{crab,starfish,fish,jellyfish,shell}.png` | Not added | | Fish Pack has fish only (`PNG/Default/fish_*.png`). |
| `src/assets/arcade/orchard/leaf.png` | Not added | | Foliage Pack has no single leaf. |

Total added to the app bundle: 5 files, 8,994 bytes (about 9 KB).

## Worlds left on code art

- **Kitchen (Slice):** Food Kit is a 3D kit. Its only images are 64 × 64 shaded 3D
  renders at a three-quarter angle, which do not match the flat 2D art. Slice keeps its
  code-drawn food.
- **Underwater (Coral Pop):** the five bubble symbols must all be art from one pack,
  or none. Fish Pack has fish but no crab, starfish, jellyfish or shell, so none is
  used. `ART_WORLDS.underwater` lists all five creatures, and `bubble.renderer.ts`
  draws creature art only when all five are ready, so adding one file alone never
  mixes art with drawn symbols.
- **Real World (Jaywalk, also Junction and Skyline through `drawVehicle`):** Racing Pack
  has cars only. A car stretched into the lorry box looks wrong, and Kenney cars with
  code-drawn lorries would clash. The sprite would also make every car the same colour.
- **Orchard (Scrumper):** Foliage Pack has no single leaf. Its `Leaves/` files are
  canopy-edge tiles, and the nearest shape (the two-leaf sprout `foliagePack_018.png`)
  would read worse than the current gold leaf disc.

## Style notes (flagged for Joe)

- **Retro (Breaker):** the Kenney paddle is a smooth glossy blue capsule. The rest of
  the Retro screen is pixel/neon (pixel font, scanline bricks), and the old paddle was
  gold. It reads fine in play but is the one smooth object on a pixel screen. If it
  jars on a phone, `paddleRed.png` is the only alternative in the pack; removing the
  file restores the code paddle.
- **Space (Wavefront):** the ship has Kenney's dark outline and more detail than the
  flat code enemies. It reads well and also replaces the lives icons in the HUD.
- **Fairground, Cave & Lava, Toybox:** consistent with the surrounding code art.

After adding files, run `bun scripts/arcade-fx-check.ts` (it checks every bundled file
is named in `ART_WORLDS` and trimmed, and that Coral Pop has all five creature files
or none), then check each pilot on a phone (Joe). Only the pilots above use art for now. Applying a pack to the rest of
a world means adding sprite names to `ART_WORLDS` and wrapping each draw site in
`if (!drawArtSprite(...)) <existing code art>`.
