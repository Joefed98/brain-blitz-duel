"""Integer Pyramid pieces (Number overhaul, 15 Nov 2026; the material pass after Joe's clarification): concept A made
real. Cut stone blocks with crisp bevels that catch the key light, a fine honed limestone texture, polished champagne
gold caps that shine, oiled oak tray tiles with real grain under a satin oil.

- given:  a pale limestone block (the numbers the pyramid gives)
- placed: the same limestone with a champagne-gold cap (a stone the player set)
- socket: an empty stone socket, sunk into darker stone
- tile:   a wooden tray tile (oak, satin oil finish)
- plinth: the stone plinth the pyramid stands on

Faces are blank: the app draws the numbers in Archivo over them.
Run:  /opt/blender/venv/bin/python docs/design/number-overhaul/source/numpyramid.py [sprite ...]
"""
from sprites import *  # noqa: F401,F403

G = "numpyramid"
BW, BH = 64, 58  # a block's sprite box in points (the app stretches it to the cell)
BLOCK_Y, BLOCK_H = float(os.environ.get("NP_Y", "5.2")), float(os.environ.get("NP_H", "55.5"))


def relief():
    """The product rig (sprites.setup's default) plus a low raking key from the top left, so the cut bevels catch the
    light on two sides and fall into shade on the others, and the stone's texture shows."""
    W, H = jzlib.W, jzlib.H
    sc = bpy.context.scene
    sc.view_settings.exposure = -0.4
    sc.view_settings.look = "AgX - Punchy"
    span = max(W, H)
    # The rig's fill (right) and rim (below) light the very bevels that should fall into shade on pale stone: keep a
    # little of each, so the lit and shaded sides of every cut edge read.
    for ob in bpy.data.objects:
        if ob.type == "LIGHT" and ob.name != "a":
            ob.data.energy *= 0.2
    area(-span * 1.4, -span * 1.2, span * 0.45, span * 0.5, 3200 * (span / 120) ** 2 / 9, "#fff1da", target=(W / 2, H / 2, 0))


def tilt_camera(deg=30):
    """Look at the piece a little from the front, as the concept does, so its cut front face shows as a band under
    the top: a real block, not a flat swatch."""
    import math
    cam = bpy.context.scene.camera
    t = math.radians(deg)
    cam.location = (0, -50 * math.sin(t), 50 * math.cos(t))
    cam.rotation_euler = (t, 0, 0)


def limestone(name="lime", c="#e4dac4", c2="#cbbd9f"):
    m = mat(name, c, 0.58, coat=0.12, coat_rough=0.35)
    n, l = jzlib._nodes(m); b = jzlib._bsdf(m)
    tc = n.new("ShaderNodeTexCoord")
    nz = n.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 9; nz.inputs["Detail"].default_value = 14
    l.new(tc.outputs["Object"], nz.inputs[0])
    cr = n.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].color = hexc(c2); cr.color_ramp.elements[1].color = hexc(c)
    cr.color_ramp.elements[0].position = 0.35; cr.color_ramp.elements[1].position = 0.7
    l.new(nz.outputs["Fac"], cr.inputs[0]); l.new(cr.outputs[0], b.inputs["Base Color"])
    vo = n.new("ShaderNodeTexVoronoi"); vo.inputs["Scale"].default_value = 160
    l.new(tc.outputs["Object"], vo.inputs[0])
    mx = n.new("ShaderNodeMath"); mx.operation = "ADD"
    l.new(vo.outputs["Distance"], mx.inputs[0]); l.new(nz.outputs["Fac"], mx.inputs[1])
    bp = n.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.22; bp.inputs["Distance"].default_value = 0.004
    l.new(mx.outputs[0], bp.inputs["Height"]); l.new(bp.outputs[0], b.inputs["Normal"])
    return m


def block(cap=False):
    # A placed stone's raised gold cap would stand above the socket's top, so its block starts 2 points lower: the cap's
    # top meets the socket's top as the given stone's does (8 px of 174).
    y, h = (BLOCK_Y + 2, BLOCK_H - 2) if cap else (BLOCK_Y, BLOCK_H)
    setup(BW, BH, scale=3, reflect=0.2)
    relief()
    tilt_camera()
    stone = limestone("lime", "#d9c6a0", "#ad9670")
    # The block fills the socket's height in the sprite (Joe, 16 Nov 2026: no step between a given stone and an empty
    # one now that the stones grow into the band above the board). BLOCK_Y / BLOCK_H put its drawn top and bottom on the
    # socket's (8 and 166 px of 174) through the tilted camera.
    box(3, y, BW - 6, h, 14, stone, r=4.2)
    if cap:
        gold = mat("cap", "#dcb86e", 0.24, metal=1.0)
        add_bump(gold, 3, 0.02, stretch=(1, 50, 1), distance=0.0006)
        box(3, y, BW - 6, 10, 15.5, gold, r=2.4)


def given():
    block(False)
    write(G, "given")


def placed():
    block(True)
    write(G, "placed")


def socket():
    setup(BW, BH, scale=3, reflect=0.2)
    relief()
    dark = limestone("dark", "#4a443a", "#2c2822")
    inner = limestone("inner", "#1b1915", "#100f0c")
    box(3, 3, BW - 6, BH - 6, 2, inner, r=2.5)
    t = 5  # the socket's rim: four bevelled stones round a sunk floor
    box(3, 3, BW - 6, t, 8, dark, r=2.4)
    box(3, BH - 3 - t, BW - 6, t, 8, dark, r=2.4)
    box(3, 3, t, BH - 6, 8, dark, r=2.4)
    box(BW - 3 - t, 3, t, BH - 6, 8, dark, r=2.4)
    write(G, "socket")


def tile():
    setup(BW, 50, scale=3, reflect=0.25)
    relief()
    tilt_camera()
    oak = wood("oak", "#b07a44", "#6a4220", rough=0.4, coat=0.5, scale=1.6)
    box(3, 6, BW - 6, 36, 10, oak, r=2.4)
    write(G, "tile")


def plinth():
    setup(360, 14, scale=3, reflect=0.2)
    relief()
    stone = limestone("plinth", "#9a907e", "#7d7464")
    box(2, 2, 356, 10, 8, stone, r=3)
    write(G, "plinth")


if __name__ == "__main__":
    run({"given": given, "placed": placed, "socket": socket, "tile": tile, "plinth": plinth})
