# Game key art

Glossy 3D key art for every live game (83 on 15 Nov 2026: the catalogue in `src/lib/duel/catalogue.ts` less
`RETIRED_TYPES`), in the art kit's style (`docs/design/style-guide/STYLE-GUIDE.md`, "Art kit"). **Not wired into the
app**: the catalogue tiles still show their live board previews; Joe chooses. Pictures: [GALLERY.md](GALLERY.md).

## What there is

| Folder | What | Size |
|---|---|---|
| `tile/<id>.webp` | The square tile, 320 × 320 (2× the catalogue's 160 px card), the art on the game's own colour, the lowest quarter kept quiet for the tile's name and stars | ~4–12 KB each |
| `hero/<id>.webp` | The wide hero, 960 × 600 (16 : 10, 2× a 480 px game-page art panel), the subject a little right of centre | ~10–30 KB each |
| `sheets/<category>.webp` | One contact sheet per category | |
| `mocks/` | The catalogue and a game page, today's art beside the new | |
| `source/` | Everything needed to re-render any image | |

The background is baked in: the art kit's tint (`tint()` in `docs/design/style-guide/source/screens2.mjs`), a radial of
the category's (or the arcade group's) colour at 42 % over surface `#0F1424`. A dark coloured panel reads the same on
the dark and the light theme, so there is one image per game, not two.

## How it was made

The art kit was rendered in code (`docs/design/style-guide/source/art.html`: a WebGL raymarcher run in headless
Chromium, every scene hand-written in GLSL). That pipeline is reused here, made general so 83 scenes are practical:

- `source/engine.html`: the kit's shader (one gloss material, one key light, soft shadows and ambient occlusion, a
  contact shadow on an invisible floor, 2 × 2 supersampling) with the scene and its colours compiled in per game,
  plus a glyph atlas drawn in Archivo (letters, digits, card faces, dartboard, small painted pictures) that decals
  sample, and the composite onto the background and the WebP encode.
- `source/scene.mjs`: the scene language. A game is a list of rounded primitives (`box`, `sphere`, `ell`, `cyl`, `cap`,
  `torus`, `cone`, `prism` for any extruded outline, `star`) with a position, Euler rotation, one colour, and optionally
  a pattern (stripes, rings, bands, checks), decals or cuts; `group()` places a set of them (with scale). `compile()`
  turns the list into GLSL (each primitive behind a bounding-sphere test, so big scenes stay quick).
- `source/kit.mjs`: the shared colours (the kit's art gold, cream, navy, ink and the category and group hues) and
  pieces: letter and number tiles, boards, cards.
- `source/scenes/<category>.mjs` (the arcade by group): one function per game; it is given `'tile'` or `'hero'` and
  may vary the scene (fewer pieces for the tile). `CAMERAS` may pull the camera in (`zoomOut` below 1 crops the board's
  edges for a bigger subject) per game and frame.
- `source/render.mjs`: **one camera for every game** (34° above the floor, from the front right, `focal` 3.2), the key
  light fixed to the view's top left, and automatic framing: the scene's hull is projected and the camera distance and
  aim solved so the subject fills the frame's box.
- `source/games.data.mjs`: the live games with category and group, printed from the catalogue by `games-list.ts`.

Family looks: Word cream letter tiles on navy, blue accents; Number cream number tiles, green accents; Speed orange
action pieces; Attention pink, things to spot; Pattern violet boards; Logic navy grids with teal; Retro neon pieces on
a cyan-rimmed screen; Sports each sport's kit on its playing surface; Cards & Board our own card faces (rank and suit,
no court art) on blue felt; Action Captain Joulz (the app's own hero) as a glossy toy; Strategy marbles, gems and
wooden trays.

## Re-rendering

From the repo root, with the pre-installed Chromium:

```bash
node docs/design/game-art/source/render.mjs --only=pool,tilt
```

```bash
node docs/design/game-art/source/render.mjs --cat=word,retro
```

```bash
node docs/design/game-art/source/sheets.mjs
```

```bash
node docs/design/game-art/source/mocks.mjs
```

`--png` also writes the transparent renders to `png/` (not committed). A game takes 4–15 s for both images (the
gem-heavy ones up to ~100 s on SwiftShader); everything about 25 minutes. When the catalogue changes:

```bash
bun docs/design/game-art/source/games-list.ts > docs/design/game-art/source/games.data.mjs
```

A new game is a new function in its category's scene file; no image is ever drawn by hand.
