# Identity art in Blender (S5)

Step 1, the style sheet (27 Nov 2026), for Joe's approval before the full set. Nothing in the app reads these files yet.

- `style-sheet/*.webp`: the 768 px masters (transparent), rendered by `scripts/identity-art/identity_art.py`
  (Blender 5.3 as a Python module, Cycles CPU, fixed seed and samples, OpenImageDenoise, a procedural studio, no
  image inputs). Every shape is the approved geometry (docs/art/source/gen.py, docs/art/badges/source/badges2.py,
  docs/art/avatars/source/avatars.py), extruded, bevelled or moulded, with the `--jz-metal-*` stops as materials.
- The avatar helmet is "inflated": a height field raised from its approved outline (`Dome`, `inflate`), so each of
  the 32 avatar outlines becomes a moulded vinyl-toy body, and the visor and ridges sit on its surface.
- Contact sheets: `scripts/identity-art/contact_sheet.py <masters> <out>` writes 2x WebPs at 36, 56, 96 and 168 px and
  dark / light 390 px pages beside today's art; the screenshots are in `screenshots/identity-blender-nov-2026/`.

Reproduce:

    python -m venv <dir>/bpyvenv && <dir>/bpyvenv/bin/pip install bpy pillow
    <dir>/bpyvenv/bin/python scripts/identity-art/identity_art.py --out=<dir>/renders
