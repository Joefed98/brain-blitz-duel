"""Chroma Lines (flow) sprites for the Pattern overhaul (look A): glossy marble beads, one per colour, a hatched steel
wall block and a dark recessed cell. The lines stay vector (the game draws them as rich tubes in each colour).

Run:  JZ_THREADS=1 /opt/blender/venv/bin/python docs/design/game-art/pattern/source/flow.py [sprite …]
Writes public/pattern-art/flow/<sprite>.webp.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprite import *  # noqa: F401,F403
import jzlib

# The game's twelve line colours (src/lib/duel/flow.ts FLOW_COLOUR_HEX), so a bead matches its line.
COLOURS = {
    "red": "#FF4D4D", "blue": "#4D8CFF", "green": "#3DDC84", "purple": "#B26BFF", "pink": "#FF6BD6",
    "orange": "#FF8A3D", "brown": "#A86B32", "yellow": "#FFE600", "teal": "#19C9C0", "white": "#F2F2F2",
    "lime": "#A8F03A", "silver": "#8E98AE",
}


def _shade(hexs, t):
    """`hexs` mixed towards white (t > 0) or black (t < 0)."""
    h = hexs.lstrip("#")
    c = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    tgt = 255 if t > 0 else 0
    return "#" + "".join(f"{round(v + (tgt - v) * abs(t)):02x}" for v in c)


def marble_bead(name, colour):
    """A glass-hard marble: the colour with soft lighter swirls inside, under a clear coat (a soft, small highlight)."""
    m = jzlib.mat(name, colour, 0.3, coat=1.0, coat_rough=0.06, spec=0.3)
    n, l = jzlib._nodes(m)
    b = jzlib._bsdf(m)
    tc = n.new("ShaderNodeTexCoord")
    wv = n.new("ShaderNodeTexWave")
    wv.inputs["Scale"].default_value = 1.6
    wv.inputs["Distortion"].default_value = 5
    wv.inputs["Detail"].default_value = 6
    wv.inputs["Detail Roughness"].default_value = 0.6
    wv.bands_direction = "DIAGONAL"
    l.new(tc.outputs["Object"], wv.inputs[0])
    cr = n.new("ShaderNodeValToRGB")
    light = _shade(colour, 0.16) if colour.upper() != "#F2F2F2" else "#ffffff"
    deep = _shade(colour, -0.14) if colour.upper() != "#F2F2F2" else "#c9ccd4"
    cr.color_ramp.elements[0].color = jzlib.hexc(deep)
    cr.color_ramp.elements[1].color = jzlib.hexc(colour)
    cr.color_ramp.elements[0].position = 0.3
    cr.color_ramp.elements[1].position = 0.62
    e = cr.color_ramp.elements.new(0.9)
    e.color = jzlib.hexc(light)
    l.new(wv.outputs["Fac"], cr.inputs[0])
    l.new(cr.outputs[0], b.inputs["Base Color"])
    return m


def bead(colour):
    def make():
        sc = begin(100, 128, pad=4, light=0.75)
        sc.view_settings.look = "AgX - Punchy"
        shadow_catcher(100, 4)
        sphere(50, 50, 44, marble_bead(f"bead{colour}", colour), z=44)
    return make


def wall():
    """A raised steel block with a hatched top: plainly not a cell, nothing a line can enter."""
    begin(100, 128, pad=0, light=0.5)
    steel = mat("wallsteel", "#2f333c", 0.6, metal=0.6)
    box(3, 3, 94, 94, 14, steel, r=7)
    hatch = mat("wallhatch", "#7d8494", 0.5, metal=0.5)
    # Diagonal hatching bars set into the top face, clipped inside the block.
    for k in range(-2, 3):
        off = k * 17
        cbox(50 + off * 0.7071, 50 + off * 0.7071, 96 - abs(off) * 2.0, 4.2, 1.0, hatch, r=0.6, z=14.0,
             rot=0.7854)
    # A thin rim frame over the bar ends keeps the hatching inside the block.
    rim = mat("wallrim", "#3a3f4a", 0.55, metal=0.6)
    box(3, 3, 94, 9, 15.4, rim, r=3)
    box(3, 88, 94, 9, 15.4, rim, r=3)
    box(3, 3, 9, 94, 15.4, rim, r=3)
    box(88, 3, 9, 94, 15.4, rim, r=3)


def cell():
    """A dark recessed slot: a satin black tray floor inside a slightly lighter rim."""
    begin(100, 96, pad=0, light=0.45)
    rim = mat("cellrim", "#1a1b22", 0.6)
    floor = mat("cellfloor", "#0b0c10", 0.75)
    box(1, 1, 98, 98, 2, floor, r=6)
    for x, y, w, h in ((1, 1, 98, 6), (1, 93, 98, 6), (1, 1, 6, 98), (93, 1, 6, 98)):
        box(x, y, w, h, 4, rim, r=2.5)


SPRITES = {f"bead-{k}": bead(v) for k, v in COLOURS.items()}
SPRITES["wall"] = wall
SPRITES["cell"] = cell

main("flow", SPRITES)
