"""Integer Pyramid pieces (Number overhaul, 15 Nov 2026): concept A made real.

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


def relief():
    """A low key from the top left over the even studio light, so bevels and chisel marks read."""
    W, H = jzlib.W, jzlib.H
    bpy.context.scene.view_settings.exposure = -1.1
    area(-W * 1.2, -H * 1.0, max(W, H) * 0.9, max(W, H) * 1.2, 300 * (max(W, H) / 60) ** 2, "#fff2dc", target=(W / 2, H / 2, 0))


def limestone(name="lime", c="#e4dac4", c2="#cbbd9f"):
    m = mat(name, c, 0.82)
    n, l = jzlib._nodes(m); b = jzlib._bsdf(m)
    tc = n.new("ShaderNodeTexCoord")
    nz = n.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 28; nz.inputs["Detail"].default_value = 10
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
    setup(BW, BH, scale=3)
    relief()
    stone = limestone("lime", "#dcceb0", "#b9a888")
    box(3, 3, BW - 6, BH - 6, 14, stone, r=7)
    if cap:
        gold = champagne("cap", rough=0.38)
        add_bump(gold, 90, 0.04, stretch=(1, 30, 1), distance=0.002)
        box(3, 3, BW - 6, 9, 15.5, gold, r=4.0)


def given():
    block(False)
    write(G, "given")


def placed():
    block(True)
    write(G, "placed")


def socket():
    setup(BW, BH, scale=3)
    relief()
    dark = limestone("dark", "#4a443a", "#2c2822")
    inner = limestone("inner", "#1b1915", "#100f0c")
    box(3, 3, BW - 6, BH - 6, 2, inner, r=4.5)
    t = 5  # the socket's rim: four bevelled stones round a sunk floor
    box(3, 3, BW - 6, t, 8, dark, r=2.4)
    box(3, BH - 3 - t, BW - 6, t, 8, dark, r=2.4)
    box(3, 3, t, BH - 6, 8, dark, r=2.4)
    box(BW - 3 - t, 3, t, BH - 6, 8, dark, r=2.4)
    write(G, "socket")


def tile():
    setup(BW, 50, scale=3)
    relief()
    oak = wood("oak", "#a8784a", "#7a5232", rough=0.6, coat=0.1, scale=1.6)
    box(3, 3, BW - 6, 44, 10, oak, r=6)
    write(G, "tile")


def plinth():
    setup(360, 14, scale=3)
    relief()
    stone = limestone("plinth", "#9a907e", "#7d7464")
    box(2, 2, 356, 10, 8, stone, r=3)
    write(G, "plinth")


if __name__ == "__main__":
    run({"given": given, "placed": placed, "socket": socket, "tile": tile, "plinth": plinth})
