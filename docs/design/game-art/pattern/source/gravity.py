"""Topsy-Turvy (gravity) sprites for the Pattern overhaul (look A): grey stone blocks, a dark slate floor cell, a glossy
glass marble per ball colour, a rimmed cup per ball colour (the hole, clearly in its ball's colour) and the tray frame.
The balls' and holes' marks stay vector (drawn by the game over the sprites, so colour is never the only cue).

Run:  JZ_THREADS=1 /opt/blender/venv/bin/python docs/design/game-art/pattern/source/gravity.py [sprite …]
Writes public/pattern-art/gravity/<sprite>.webp.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprite import *  # noqa: F401,F403
import jzlib

# The game's ball colours (src/components/puzzles/pattern/topsyBoard.tsx TOPSY_COLOURS), in ball order. The last two
# (lime green, pearl white) are Expert's seventh and eighth balls (the difficulty levels, 16 Nov 2026).
COLOURS = {
    "yellow": "#F5C542", "teal": "#2FD4C4", "purple": "#A97BFF", "pink": "#FF5FA2", "blue": "#4F8BFF", "orange": "#FF8A3D",
    "green": "#8BE04A", "white": "#E8ECF2",
}


def _shade(hexs, t):
    """`hexs` mixed towards white (t > 0) or black (t < 0)."""
    h = hexs.lstrip("#")
    c = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    tgt = 255 if t > 0 else 0
    return "#" + "".join(f"{round(v + (tgt - v) * abs(t)):02x}" for v in c)


def glass_marble(name, colour):
    """A glossy glass marble: the colour with soft deeper swirls inside, under a clear coat (one small soft highlight)."""
    # Richness pass (Joe, 15 Nov 2026): real glass: a clear glossy coat that takes a crisp highlight on its curve, a
    # little transmission and subsurface for colour depth.
    m = jzlib.mat(name, colour, 0.12, coat=1.0, coat_rough=0.02, spec=0.6, trans=0.04, sss=0.08)
    n, l = jzlib._nodes(m)
    b = jzlib._bsdf(m)
    tc = n.new("ShaderNodeTexCoord")
    wv = n.new("ShaderNodeTexWave")
    wv.inputs["Scale"].default_value = 1.3
    wv.inputs["Distortion"].default_value = 6
    wv.inputs["Detail"].default_value = 5
    wv.inputs["Detail Roughness"].default_value = 0.55
    wv.bands_direction = "DIAGONAL"
    l.new(tc.outputs["Object"], wv.inputs[0])
    cr = n.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].color = jzlib.hexc(_shade(colour, -0.38))
    cr.color_ramp.elements[1].color = jzlib.hexc(colour)
    cr.color_ramp.elements[0].position = 0.28
    cr.color_ramp.elements[1].position = 0.6
    e = cr.color_ramp.elements.new(0.92)
    e.color = jzlib.hexc(_shade(colour, 0.06))
    l.new(wv.outputs["Fac"], cr.inputs[0])
    l.new(cr.outputs[0], b.inputs["Base Color"])
    return m


def marble(colour):
    def make():
        begin(100, 128, pad=4, light=0.9)
        sphere(50, 50, 44, glass_marble(f"marble{colour}", colour), z=44)
    return make


def stone_mat():
    """Grey honed stone: a fine mottle in the colour and a faint pitted bump, satin, never shiny."""
    m = jzlib.mat("stone", "#9aa0aa", 0.48, spec=0.45, coat=0.25, coat_rough=0.35)
    n, l = jzlib._nodes(m)
    b = jzlib._bsdf(m)
    tc = n.new("ShaderNodeTexCoord")
    nz = n.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 9
    nz.inputs["Detail"].default_value = 8
    nz.inputs["Roughness"].default_value = 0.6
    l.new(tc.outputs["Object"], nz.inputs[0])
    cr = n.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].color = jzlib.hexc("#5c616b")
    cr.color_ramp.elements[1].color = jzlib.hexc("#8d929b")
    cr.color_ramp.elements[0].position = 0.35
    cr.color_ramp.elements[1].position = 0.68
    l.new(nz.outputs["Fac"], cr.inputs[0])
    l.new(cr.outputs[0], b.inputs["Base Color"])
    jzlib.add_bump(m, scale=45, strength=0.28, detail=8)
    return m


def block():
    """A raised grey stone block with softly chamfered edges: plainly a wall."""
    begin(100, 128, pad=0, light=0.6)
    box(3, 3, 94, 94, 26, stone_mat(), r=14)


def floor():
    """A dark slate floor square, slightly recessed inside a fine lighter lip."""
    begin(100, 96, pad=0, light=0.55)
    lip = mat("floorlip", "#262b38", 0.45, coat=0.4, coat_rough=0.25)
    slate = mat("floorslate", "#12151e", 0.55, coat=0.3, coat_rough=0.3)
    jzlib.add_bump(slate, scale=30, strength=0.12)
    box(1, 1, 98, 98, 2, slate, r=5)
    for x, y, w, h in ((1, 1, 98, 5), (1, 94, 98, 5), (1, 1, 5, 98), (94, 1, 5, 98)):
        box(x, y, w, h, 3.2, lip, r=2)


def hole(colour):
    """A cup sunk into the floor, its raised rim in the ball's colour (satin lacquer), dark inside with the colour's
    shade on the cup's walls, so each hole plainly belongs to one ball."""
    def make():
        begin(100, 128, pad=0, light=0.85)
        # Glossy enamel in the ball's colour (a deep coat that takes the key light on the curve of the rim).
        rim = mat(f"rim{colour}", _shade(colour, -0.12), 0.18, coat=1.0, coat_rough=0.03, spec=0.55)
        wall = mat(f"cup{colour}", _shade(colour, -0.62), 0.6)
        pit = mat("pit", "#050608", 0.9)
        # The cup's inner wall (a short dark tube in the colour's deep shade), the pit and the rim on top.
        jzlib.disc_ring(50, 50, 36, 9, 10, wall, z=0)
        cyl(50, 50, 28, 2, pit, z=0, bevel=0)
        jzlib.disc_ring(50, 50, 46, 11, 6, rim, z=8)
        torus(50, 50, 40.5, 5.2, rim, z=12)
    return make


def frame():
    """The tray frame: a dark gunmetal rim round the board, satin, a soft bevel; the middle is empty."""
    begin(100, 640, pad=0, light=0.9)
    metal = mat("trayframe", "#4a5266", 0.26, metal=0.85, spec=0.5)
    inner = mat("trayinner", "#1c2029", 0.6, metal=0.4)
    t = 2.2
    for x, y, w, h in ((0.3, 0.3, 99.4, t), (0.3, 100 - t - 0.3, 99.4, t), (0.3, 0.3, t, 99.4), (100 - t - 0.3, 0.3, t, 99.4)):
        box(x, y, w, h, 3.2, metal, r=0.9)
    # A thin dark inner lip where the frame meets the floor.
    s = 0.6
    for x, y, w, h in ((t, t, 100 - 2 * t, s), (t, 100 - t - s, 100 - 2 * t, s), (t, t, s, 100 - 2 * t), (100 - t - s, t, s, 100 - 2 * t)):
        box(x, y, w, h, 1.4, inner, r=0.2)


SPRITES = {}
for k, v in COLOURS.items():
    SPRITES[f"marble-{k}"] = marble(v)
    SPRITES[f"hole-{k}"] = hole(v)
SPRITES["block"] = block
SPRITES["floor"] = floor
SPRITES["frame"] = frame

main("gravity", SPRITES)
