"""Operator pieces (Number overhaul, 15 Nov 2026; the material pass after Joe's clarification): concept A's board
made real, in champagne gold and navy.

- num:        a number tile: deep navy-black lacquer over dark stone, a clear coat with depth, a crisp highlight on
              its bevel (the given numbers, the tray's keys, a filled number gap)
- gap-number: an empty number gap: a navy enamel well sunk into the board, a lacquered rim
- gap-sign:   an empty sign gap: a polished champagne-gold ring round a sunk navy enamel well
- sign:       a sign key and a filled sign gap: a polished champagne-gold domed disc
- panel:      the board: dark lacquered panel with a bevelled edge (drawn 9-slice by the app)

Faces are blank: the app draws numbers and signs in Archivo over them. Highlights sit on bevels and curves; the
faces stay dark and clear so the numbers read.
Run:  /opt/blender/venv/bin/python docs/design/number-overhaul/source/equation.py [sprite ...]
"""
from sprites import *  # noqa: F401,F403

G = "equation"


def lacquer(name="lacquer", c1="#060912", c2="#0e1528", coat=1.0, rough=0.55):
    """Dark lacquer over stone: a faint cloud in the base, a clear coat that gives depth and a crisp edge highlight."""
    m = mat(name, c1, rough, coat=coat, coat_rough=0.06)
    n, l = jzlib._nodes(m); b = jzlib._bsdf(m)
    tc = n.new("ShaderNodeTexCoord")
    nz = n.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 5; nz.inputs["Detail"].default_value = 8
    l.new(tc.outputs["Object"], nz.inputs[0])
    cr = n.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].color = hexc(c1); cr.color_ramp.elements[1].color = hexc(c2)
    l.new(nz.outputs["Fac"], cr.inputs[0]); l.new(cr.outputs[0], b.inputs["Base Color"])
    return m


def polished_gold(name="pgold", rough=0.2):
    m = mat(name, "#dcb86e", rough, metal=1.0)
    return add_bump(m, 160, 0.015, distance=0.0008)


def enamel(name="enamel", color="#14204a"):
    return mat(name, color, 0.35, coat=0.8, coat_rough=0.1)


DARK_REFLECT = 0.12  # a dark face must not mirror the studio across where the number sits


def dark_piece(w, h):
    """A dark lacquered piece: low studio reflection and a deeper exposure, so its face stays near-black and clear
    and the light lives on its bevel."""
    setup(w, h, scale=3, reflect=DARK_REFLECT)
    sc = bpy.context.scene
    sc.view_settings.look = "AgX - Punchy"
    sc.view_settings.exposure = -0.9


def num():
    dark_piece(60, 56)
    box(2, 2, 56, 52, 12, lacquer(), r=10)
    write(G, "num")


def gap_number():
    dark_piece(60, 56)
    box(2, 2, 56, 52, 1.5, enamel("well", "#0b1433"), r=10)
    rim = lacquer("rim", "#121c3a", "#1a2750", coat=1.0, rough=0.45)
    t = 4.5
    box(2, 2, 56, t, 6, rim, r=2.2); box(2, 54 - t, 56, t, 6, rim, r=2.2)
    box(2, 2, t, 52, 6, rim, r=2.2); box(58 - t, 2, t, 52, 6, rim, r=2.2)
    write(G, "gap-number")


def gap_sign():
    setup(56, 56, scale=3, reflect=0.22)
    cyl(28, 28, 22, 1.5, mat("swell", "#0b1433", 0.4, coat=0.6, coat_rough=0.3), bevel=0.3)
    ring = disc_ring(28, 28, 26, 5, 7, polished_gold("ring", 0.22))
    bevel_mod(ring, 1.6, 4)
    write(G, "gap-sign")


def sign():
    setup(56, 56, scale=3, reflect=0.22)
    face = mat("brushedgold", "#d8b46c", 0.42, metal=1.0)
    add_bump(face, 3, 0.02, stretch=(1, 60, 1), distance=0.0006)
    cyl(28, 28, 26, 8, face, bevel=2.2)
    disc_ring(28, 28, 26, 3.2, 8.6, polished_gold("discrim", 0.2))
    write(G, "sign")


def panel():
    # 120 x 120 points; the app 9-slices it (the corners 24 points).
    dark_piece(120, 120)
    box(2, 2, 116, 116, 6, lacquer("board", "#05080f", "#0b1120", coat=1.0, rough=0.6), r=18)
    write(G, "panel")


if __name__ == "__main__":
    run({"num": num, "gap-number": gap_number, "gap-sign": gap_sign, "sign": sign, "panel": panel})
