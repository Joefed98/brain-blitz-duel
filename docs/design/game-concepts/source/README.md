# Game concept scenes (Blender)

The scenes behind `docs/design/game-concepts/`. Concept art only: nothing here is used by the app.

## Setup

Blender as a Python module (Blender 5.2 LTS, headless, CPU Cycles):

```bash
python3 -m venv .venv && .venv/bin/pip install bpy==5.2.4 pillow numpy
```

## Render

```bash
.venv/bin/python render.py <category> <game-id> <look> [--samples=160] [--preview]
```

`category` is `word`, `attention` or `speed`; `look` is `a` (Today, upgraded) or `b` (Bolder). It writes
`../<category>/<game-id>-<look>.webp` (333 × 720) and `../<category>/thumbs/<game-id>-<look>.webp` (120 × 260).
A final render is 540 × 1169 at 160 samples with denoising (about 1 to 4 minutes a scene on 4 cores); `--preview` is
a quick quarter-size check. Set `CONCEPT_TMP` for the intermediate PNG.

## Files

- `lib.py`: the shared kit. Coordinates are phone pixels on a 390 × 844 screen (1 px = 1 cm in the scene), so a board
  is copied straight from a screenshot. A long-lens camera straight above; materials (glaze, enamel, brushed and
  polished metal, procedural wood, felt, leather, stone, glass); bevelled blocks, rounded slabs, rings, extruded
  outlines, tubes and text; an overhead softbox only reflections see (what makes flat metal read); studio lights.
- `post.py`: light glare and vignette (more in B), the plain header band, the WebP export.
- `word.py`, `attention.py`, `speed.py`: one function per live game. Each game's palette at the top of its file is
  where a look is tuned.
- `fonts/`: Archivo (the app's font, OFL, static instances of the variable font) and Caladea Bold (Apache 2.0).

Lighting uses the studio lights bundled with Blender; Pull! uses Blender's physical sky and a light haze volume.
