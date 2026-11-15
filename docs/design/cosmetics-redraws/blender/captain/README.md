# Captain Joulz in 3D

The approved Captain (`public/art/captain-joulz-ready.svg`, `-win.svg`, `docs/art/source/hero2.py`) as a Blender
character, built entirely from code: a navy-black satin suit with gold piping (the V from the shoulders to the belt),
a round lacquered helmet with a lit cyan visor (its V-notched mask, gold-rimmed) and three cyan crown lines, a polished
gold chest bolt, gold gauntlets with a black lacquer bolt badge, gold gloves, gold shins and boots with knee guards, a
gold belt and buckle, and a pointed gold cape with folds.

| | |
|---|---|
| `captain.py` | The model. `build(pose, location, height, rotation_z, materials)` returns a parent empty with every part (named `captain.<part>`) under it. |
| `render_hero.py` | Hero shots, front three-quarter, 600 × 800 → `docs/design/cosmetics-redraws/samples/captain/captain-<pose>.webp`. |
| `save_blend.py` | Saves `captain.blend` (a pose, materials editable) for work in Blender itself. |
| `../celebrations_captain.py` | The three celebrations with him standing on the winner's drum. |

All run with `bpy` 5.3 (`pip install bpy pillow numpy scipy`): `python render_hero.py win ready`.

## Poses

A pose is the 2D art's joint positions (`docs/art/source/captain-poses.json`: neck, hip, shoulders, elbows, hands,
hips, knees, feet), so every pose the 2D Captain has (`ready`, `run`, `win`) the 3D Captain has too; `POSE_DEPTH` in
`captain.py` adds the depth of each joint (hands a little forward in the win pose). A new pose is a new entry in both:
the 2D joints and their depths. Each body part is placed between its joints (tapered capsules for the limbs, a lofted
torso, a modelled helmet, visor, hands and cape), so posing is exact and needs no weights.

## Skins

Every material is in one table, `MATERIALS` (suit, helmet, gold, gold_brushed, cape, visor, crown_line, badge), each a
small Principled description (base colour, metallic, roughness, coat, sheen, emission). A skin is a new table passed to
`build(..., materials=SKIN)`: a chrome Captain, a crimson cape, a carbon suit, a different visor glow. Nothing else in
the model reads a colour.
