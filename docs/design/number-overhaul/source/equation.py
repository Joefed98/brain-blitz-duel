"""Operator pieces (Number overhaul, 15 Nov 2026): concept A's polished tiles in champagne gold and navy.

- num:        a number tile, polished dark stone (the given numbers, the tray's keys, a filled number gap)
- gap-number: an empty number gap, a navy square sunk into the panel
- gap-sign:   an empty sign gap, a champagne-gold ring round a sunk navy well
- sign:       a sign key and a filled sign gap, a champagne-gold disc

Faces are blank: the app draws numbers and signs in Archivo over them.
Run:  /opt/blender/venv/bin/python docs/design/number-overhaul/source/equation.py [sprite ...]
"""
from sprites import *  # noqa: F401,F403

G = "equation"


def relief(exposure=-1.6):
    W, H = jzlib.W, jzlib.H
    bpy.context.scene.view_settings.exposure = exposure
    area(-W * 1.2, -H * 1.0, max(W, H) * 0.9, max(W, H) * 1.2, 300 * (max(W, H) / 60) ** 2, "#fff2dc", target=(W / 2, H / 2, 0))


def polished(name="polished"):
    """Dark polished stone: a satin finish (no mirror), a faint cloud in the stone."""
    m = mat(name, "#1d2233", 0.36, coat=0.25, coat_rough=0.3)
    n, l = jzlib._nodes(m); b = jzlib._bsdf(m)
    tc = n.new("ShaderNodeTexCoord")
    nz = n.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 6; nz.inputs["Detail"].default_value = 8
    l.new(tc.outputs["Object"], nz.inputs[0])
    cr = n.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].color = hexc("#121726"); cr.color_ramp.elements[1].color = hexc("#232b42")
    l.new(nz.outputs["Fac"], cr.inputs[0]); l.new(cr.outputs[0], b.inputs["Base Color"])
    return m


def num():
    setup(56, 56, scale=3)
    relief()
    box(3, 3, 50, 50, 12, polished(), r=8)
    write(G, "num")


def gap_number():
    setup(56, 56, scale=3)
    relief()
    rim = mat("navyrim", "#2b3a66", 0.5)
    well = mat("well", "#0e1838", 0.85)
    box(3, 3, 50, 50, 1.5, well, r=8)
    t = 4
    box(3, 3, 50, t, 6, rim, r=2); box(3, 53 - t, 50, t, 6, rim, r=2)
    box(3, 3, t, 50, 6, rim, r=2); box(53 - t, 3, t, 50, 6, rim, r=2)
    write(G, "gap-number")


def gap_sign():
    setup(56, 56, scale=3)
    relief()
    gold = champagne("ring", rough=0.42)
    add_bump(gold, 120, 0.03, distance=0.002)
    well = mat("well", "#0e1838", 0.85)
    cyl(28, 28, 24, 1.5, well, bevel=1)
    disc_ring(28, 28, 25, 4.5, 6, gold)
    write(G, "gap-sign")


def sign():
    setup(56, 56, scale=3)
    relief()
    gold = champagne("disc", rough=0.72)
    add_bump(gold, 120, 0.03, distance=0.002)
    cyl(28, 28, 25, 8, gold, bevel=2.5)
    write(G, "sign")


if __name__ == "__main__":
    run({"num": num, "gap-number": gap_number, "gap-sign": gap_sign, "sign": sign})
