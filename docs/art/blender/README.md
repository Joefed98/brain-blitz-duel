# Identity art in Blender (S5)

Step 1, the style sheets, for Joe's approval before the full set. Nothing in the app reads these files yet.

- Sheet 1 (27 Nov 2026): `style-sheet/`, rendered by the script as it stood at commit f7955be6.
- Sheet 2 (28 Nov 2026): `style-sheet-2/`, the script as it stands: all seven tiers (matte → brushed → polished →
  live current), the avatar helmet at 70 % of the disc, the player-colour tint passes, both podium options, heavier
  and glossier pins, both collection stars.
- `badge-shapes.md`: the proposed shape for each of the 54 badges (waiting for Joe's OK; no badge is rendered before it).

Player colours: an avatar's paint is not rendered in 32 colours. Three passes are rendered once per avatar
(`avatar-<id>-tint-base`: the avatar with the helmet in white paint and no gloss; `-tint-gloss`: only the helmet's
clear coat; `-tint-mask`: the helmet's coverage), and the app draws base, then the player colour multiplied inside the
mask, then the gloss screened on top. Finishes and gems are pre-rendered whole.

- `style-sheet/*.webp`, `style-sheet-2/*.webp`: the 768 px masters (transparent), rendered by `scripts/identity-art/identity_art.py`
  (Blender 5.3 as a Python module, Cycles CPU, fixed seed and samples, OpenImageDenoise, a procedural studio, no
  image inputs). Every shape is the approved geometry (docs/art/source/gen.py, docs/art/badges/source/badges2.py,
  docs/art/avatars/source/avatars.py), extruded, bevelled or moulded, with the `--jz-metal-*` stops as materials.
- The avatar helmet is "inflated": a height field raised from its approved outline (`Dome`, `inflate`), so each of
  the 32 avatar outlines becomes a moulded vinyl-toy body, and the visor and ridges sit on its surface.
- Contact sheets: `scripts/identity-art/contact_sheet.py <masters> <out>` writes 2x WebPs at 36, 56, 96 and 168 px and
  dark / light 390 px pages beside today's art (sheet 2's layout); the screenshots are in
  `screenshots/identity-blender-nov-2026/` (`style-sheet-*` sheet 1, `style-sheet-2-*` sheet 2, each page in two halves).

Reproduce:

    python -m venv <dir>/bpyvenv && <dir>/bpyvenv/bin/pip install bpy pillow
    <dir>/bpyvenv/bin/python scripts/identity-art/identity_art.py --out=<dir>/renders --size=768 --samples=96
