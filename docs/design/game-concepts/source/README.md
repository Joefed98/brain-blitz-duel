# Game concept renders: sources

Concept art only (phase 2, step 4); nothing here is used by the app.

- `jzlib.py`: scene, camera, light, material and shape helpers (phone points: 390 × 844, x right, y down).
- `kit.py`: today's category screens (teal Logic, green Number, purple Pattern), the A and B stages, panels, buttons, pills.
- `logic.py`, `number.py`, `pattern.py`: one function per game; each builds the scene for a look ("A", "B", "C").
- `make_docs.py`: writes `../<category>.md` from the per-look notes.

## Running

Blender 5.2.4 as a Python module (`pip install bpy==5.2.4` in a Python 3.13 venv, plus `pillow fonttools brotli`).
The scripts use Archivo (the app's font, `public/fonts/archivo-var-latin.woff2`) instanced at weights 600 and 800:

```bash
python -c "from fontTools.ttLib import TTFont; from fontTools.varLib import instancer; [instancer.instantiateVariableFont(TTFont('public/fonts/archivo-var-latin.woff2'), {'wght': w, 'wdth': 100}).save(f'/opt/blender/fonts/archivo-{w}.ttf') for w in (600, 800)]"
```

```bash
python docs/design/game-concepts/source/logic.py tubes:A,C sudoku
```

No argument renders every game and look. `JZ_SAMPLES` (default 96) and `JZ_RES_H` (default 720) set quality; each
render writes `<category>/<game>-<look>.webp` and a 240 px `.thumb.webp`, with the header placeholder band laid over the top.
