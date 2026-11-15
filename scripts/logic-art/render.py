"""Logic overhaul, session 1: the piece and surface art for Box Six, Polypotions, Hanoi, Safe Cracker, Mosaic, Colour
Flood and Minefield (public/logic-art/*.webp), the app laying them out and animating them.

Second pass (Joe, 15 Nov 2026: match the concept A renders Joe picked, Box Six with B's lighting; real materials with
light on them, no glare washing across panels, tiles or numbers). Every piece is built in its concept's own scene:
the same stage lights (kit.py `stage`, A or B), the same materials (logic.py's: lacquer, thin glass, B's potions, turned
oak, B's candy-glass rings, brushed steel and gold drums, A's glazed tiles, enamel, steel-and-stone plates, iron) and
the same place on the 390 x 844 screen, with an orthographic camera framed on that one piece and a transparent film,
so each sprite carries the concept's light exactly. Numerals are never rendered: the app draws them sharp.

Glass and highlights that sit in front of app-drawn content (Polypotions' tube, the paint pots' glass) are rendered on
black and keyed by their own brightness (alpha = brightest channel), so only the glass's highlights and edges remain.

Run (Blender as a Python module: `pip install bpy pillow` in a Python 3.13 venv; Archivo is not needed: no text):

    JZ_SAMPLES=128 python scripts/logic-art/render.py [name ...]

No name renders every sprite. Output: public/logic-art/<name>.webp.
"""
import bpy, math, os, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from jzlib import *  # noqa: F401,F403,E402  (V, P, W, H, mat, box, cyl, sphere, ... from the concepts)
import jzlib as J  # noqa: E402
from kit import CAT, GOLD, PIECE, cellm, gold_m, test_tube  # noqa: E402

OUT = os.path.abspath(os.path.join(HERE, "..", "..", "public", "logic-art"))
SAMPLES = int(os.environ.get("JZ_SAMPLES", "128"))
TMP = os.environ.get("JZ_TMP", tempfile.gettempdir())
C = "logic"
ACC = CAT[C]["accent"]


def lights(bold=False, key=1.0):
    """kit.py's stage() without its backdrop: the concept's world and lights, the film left transparent."""
    c = CAT[C]
    world("#020304", 0.3, "studio.exr", 0.22 if not bold else 0.16)
    if not bold:
        area(-260, -260, 900, 700, 3400 * key, "#fff3e2", sx=900, sy=500)
        area(760, 520, 520, 600, 600 * key, "#d6e6ff")
        area(195, 1500, 260, 800, 400 * key, "#ffffff", sx=1200, sy=200)
    else:
        area(-220, -160, 820, 500, 1500 * key, "#fff0dc", sx=520, sy=380)
        sp = spot(60, 120, 900, 6000 * key, "#fff1dc", target=(195, 430, 0), angle=50, blend=0.9, radius=260)
        sp.visible_glossy = False
        area(560, 980, 140, 700, 700 * key, c["accent"], sx=900, sy=160)
        area(-170, 520, 140, 700, 350 * key, c["accent"], sx=160, sy=900)


def strip(cx, cy, key=1.0):
    """A long, narrow light parallel to a tube's axis, up and to the left: a cylinder (liquid, glass, a drum) takes one
    clean highlight down its curve instead of the studio's square windows."""
    area(cx - 120, cy, 260, 30, 900 * key, "#fff6ea", sx=900, sy=24, target=(cx, cy, 0))


def frame(cx, cy, w, h, px_w, px_h, tilt=0.0, black=False, bold=False, key=1.0):
    """A fresh scene: the concept's lights, an orthographic camera looking down on (cx, cy) in screen points covering
    w x h points, rendering px_w x px_h. `tilt` leans the camera forward (degrees) to see a piece's side."""
    reset()
    J._mats.clear(); J._meshes.clear()
    s = bpy.context.scene
    s.cycles.samples = SAMPLES
    s.render.resolution_x, s.render.resolution_y = px_w, px_h
    s.render.film_transparent = not black
    lights(bold, key)
    if black:
        nt = s.world.node_tree; n = nt.nodes
        lp = n.new("ShaderNodeLightPath"); bg2 = n.new("ShaderNodeBackground"); bg2.inputs[0].default_value = (0, 0, 0, 1)
        out = n["World Output"].inputs[0]
        prev = out.links[0].from_socket if out.links else n["Background"].outputs[0]
        mix = n.new("ShaderNodeMixShader")
        nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs[0]); nt.links.new(prev, mix.inputs[1])
        nt.links.new(bg2.outputs[0], mix.inputs[2]); nt.links.new(mix.outputs[0], out)
    cam = bpy.data.cameras.new("cam"); cam.type = "ORTHO"
    cam.ortho_scale = max(w, h) * P; cam.sensor_fit = "AUTO"; cam.clip_end = 100
    ob = bpy.data.objects.new("cam", cam); s.collection.objects.link(ob)
    t = math.radians(tilt)
    target = V(cx, cy, 0)
    ob.location = (target.x, target.y - 10 * math.sin(t), 10 * math.cos(t))
    ob.rotation_euler = (t, 0, 0)
    s.camera = ob


def write(name, key_glass=False, shading=False, quality=88, saturate=1.0, crop=None):
    s = bpy.context.scene
    png = os.path.join(TMP, f"logic-art-{name}.png"); s.render.filepath = png
    s.render.image_settings.file_format = "PNG"; s.render.image_settings.color_mode = "RGBA"
    bpy.ops.render.render(write_still=True)
    from PIL import Image, ImageOps
    im = Image.open(png).convert("RGBA")
    if crop:
        im = im.crop(crop)
    if key_glass:
        # Keep only what the glass adds: alpha = its brightest channel, colour normalised by it.
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, _ = px[x, y]
                a = max(r, g, b)
                px[x, y] = (min(255, r * 255 // a), min(255, g * 255 // a), min(255, b * 255 // a), a) if a else (0, 0, 0, 0)
    if shading:
        # A shading map for hard-light tinting: grey, the body's median at mid-grey.
        r, g, b, a = im.split()
        lum = ImageOps.grayscale(Image.merge("RGB", (r, g, b)))
        vals = sorted(v for v, al in zip(lum.getdata(), a.getdata()) if al > 200)
        med = vals[len(vals) // 2] if vals else 128
        lum = lum.point(lambda v: round(v * 128 / max(1, med)) if v <= med else min(255, round(128 + (v - med) * 127 / max(1, 255 - med))))
        im = Image.merge("RGBA", (lum, lum, lum, a))
    if saturate != 1.0:
        # AgX's tone mapping desaturates strong colours; give the concept's colour back (alpha untouched).
        from PIL import ImageEnhance
        a = im.getchannel("A")
        im = ImageEnhance.Color(im.convert("RGB")).enhance(saturate).convert("RGBA")
        im.putalpha(a)
    os.makedirs(OUT, exist_ok=True)
    im.save(os.path.join(OUT, f"{name}.webp"), "WEBP", quality=quality, method=6)
    print("wrote", name, im.size, os.path.getsize(os.path.join(OUT, f"{name}.webp")))


# ------------------------------------------------------------------ Box Six: lacquered tiles under B's light
def box_tile(given):
    cs = 60
    x, y = 195 - cs / 2, 380 - cs / 2
    frame(195, 380, cs, cs, 240, 240, bold=True)
    tile = mat("sdkB", "#0f1d1c" if not given else "#141c1a", 0.12, coat=1.0, coat_rough=0.04)
    box(x + 2, y + 2, cs - 4, cs - 4, 5, tile, r=3, z=9)
    write("box-tile-given" if given else "box-tile")


# ------------------------------------------------------------------ Polypotions: A's glass, B's liquids, C's cork
TUBE_X, TUBE_TOP, TUBE_LEN, TUBE_R = 195, 300, 300, 25
SEG = 50
POTION_COLOURS = {  # the app's eight (ShapeGlyph GLYPH_COLOURS order in sortTubes BALL_COLOURS), B's richer glazes
    "red": "#FF4D4D", "blue": "#4D8CFF", "green": "#3DDC84", "purple": "#B26BFF",
    "pink": "#FF6BD6", "orange": "#FF8A3D", "brown": "#9a5a34", "yellow": "#FFE600",
}


def tube_glass():
    """The empty test tube, glass only (keyed), 2 x the tube's points wide plus a margin."""
    w, h = 2 * TUBE_R + 16, TUBE_LEN + 16
    frame(TUBE_X, TUBE_TOP + TUBE_LEN / 2, w, h, 264, round(264 * h / w), black=True, key=0.5)
    strip(TUBE_X, TUBE_TOP + TUBE_LEN / 2, 1.6)
    glass_ = thin_glass("tube", "#f6fbff", 0.02, 1.0)
    test_tube(TUBE_X, TUBE_TOP, TUBE_LEN, TUBE_R, glass_, z=TUBE_R + 6)
    ycyl(TUBE_X, TUBE_TOP - 2, 5, TUBE_R + 1.8, glass_, z=TUBE_R + 6, bevel=2)
    write("flask-glass", key_glass=True)


def liquid(colour, bottom):
    """One liquid layer (B's potion), as wide as the tube's inside: the round-bottomed first layer or a straight one."""
    r = TUBE_R - 3.5
    w, h = 2 * r + 4, SEG + (r if bottom else 0) + 2
    yb = 500
    frame(TUBE_X, yb - h / 2, w, h, 200, round(200 * h / w), key=0.35)
    strip(TUBE_X, yb - h / 2, 1.4)
    # B's richer liquid: deep, saturated colour with a little light coming through, a glossy coat.
    lm = mat(f"pot{colour}", POTION_COLOURS[colour], 0.08, coat=1.0, coat_rough=0.08, trans=0.12, ior=1.33, sss=0.15,
             emit=POTION_COLOURS[colour], emit_strength=0.3)
    if bottom:
        ycyl(TUBE_X, yb - h + 1, SEG - 1, r, lm, z=TUBE_R + 6, bevel=0.5)
        sphere(TUBE_X, yb - r - 1, r, lm, z=TUBE_R + 6)
    else:
        ycyl(TUBE_X, yb - SEG - 1, SEG, r, lm, z=TUBE_R + 6, bevel=0.6)
    write(f"potion-{colour}{'-bottom' if bottom else ''}", saturate=1.45)


def meniscus():
    """The liquid's top: a gentle curved surface catching the light (keyed, laid on the top layer)."""
    r = TUBE_R - 3.5
    frame(TUBE_X, 400, 2 * r + 4, 16, 200, 76, tilt=0, black=True)
    surf = mat("surf", "#ffffff", 0.05, coat=1.0, trans=0.6, ior=1.33)
    ob = ellipsoid(TUBE_X, 400, r, 5, 3, surf, z=TUBE_R + 6)
    write("potion-meniscus", key_glass=True)


def cork():
    """C's cork, side on (it pops into the tube's mouth)."""
    frame(TUBE_X, 281, 2 * TUBE_R, 26, 200, 104)
    ck = mat("cork", "#b08a5a", 0.85); add_bump(ck, 220, 0.4, kind="voronoi", distance=0.003)
    ycyl(TUBE_X, 270, 22, TUBE_R - 3, ck, z=TUBE_R, bevel=3)
    write("cork")


# ------------------------------------------------------------------ Hanoi: turned oak, gold plate, B's candy-glass rings
HANOI_SHADES = ["#FFE14D", "#FFC23D", "#FF9A3D", "#F2675E", "#E0508F", "#B85CD6", "#7E6BF0", "#4D8CFF", "#34B3E4"]


def hanoi_post():
    frame(150, 410, 16, 312, 48, 936)
    oak = wood("oak", "#b07a45", "#6e4422", rough=0.35, coat=0.8, scale=4)
    ycyl(150, 260, 310, 6, oak, z=26, bevel=5.5)
    write("hanoi-post")


def hanoi_plate(gold):
    frame(195, 576, 350, 24, 1050, 72)
    m = gold_m(False, "gpost") if gold else wood("oakbase", "#8a5a30", "#4e2e14", scale=3)
    box(24, 566, 342, 20, 12, m, r=5, z=8)
    write("hanoi-plate-gold" if gold else "hanoi-plate")


def hanoi_ring(i):
    """B's candy-glass ring (coat, a little transmission, a soft inner glow), one per shade, a medium width (the app
    slices its rounded ends with border-image, so any width keeps round ends)."""
    rh, w = 26, 110
    frame(195, 500, w + 6, w + 6, 456, 456, bold=True)
    col = HANOI_SHADES[i]
    m = mat(f"ring{i}", col, 0.08, coat=1.0, coat_rough=0.03, trans=0.25, emit=col, emit_strength=0.45)
    box(195 - w / 2, 500 - (rh - 3) / 2, w, rh - 3, 26, m, r=11.5, z=12)
    write(f"hanoi-ring-{i + 1}", saturate=1.2, crop=(0, round(456 * (0.5 - (rh + 2) / 2 / (w + 6))), 456, round(456 * (0.5 + (rh + 2) / 2 / (w + 6)))))


# ------------------------------------------------------------------ Safe Cracker: A's steel door and gold drums
def safe_door():
    frame(195, 525, 346, 214, 1038, 642)
    steel = brushed("steel", "#3a3f44", 0.38, aniso=0.0, stretch=(60, 1, 1))
    box(22, 418, 346, 214, 19, steel, r=9)
    for i in range(4):
        cyl([32, 358][i % 2], [428, 622][i // 2], 4, 21, mat("rivet", "#9aa0a6", 0.25, metal=1), bevel=1.5)
    write("safe-door")


def safe_drum():
    x = 152
    frame(x, 524, 68, 100, 204, 300, key=0.6)
    area(x, 380, 300, 30, 500, "#fff6ea", sx=24, sy=900, target=(x, 524, 0))
    box(x - 34, 474, 68, 100, 21, mat("well", "#050607", 0.5), r=6)
    drum = mat("drum", GOLD, 0.5, metal=1.0, emit="#7a5410", emit_strength=0.3)
    add_bump(drum, 40, 0.06, stretch=(1, 30, 1), distance=0.003)
    xcyl(x - 29, 524, 58, 36, drum, z=4, bevel=2)
    write("safe-drum")


# ------------------------------------------------------------------ Mosaic: A's glazed tiles in dark wells
def mosaic_tile():
    cs = 36
    x, y = 84 + 3 * cs, 342 + 2 * cs
    frame(x + cs / 2, y + cs / 2, cs, cs, 192, 192)
    tile = mat("mtileA", ACC, 0.12, coat=1.0, coat_rough=0.02, emit=ACC, emit_strength=0.25)
    add_bump(tile, 14, 0.05, distance=0.01)
    box(x + 2, y + 2, cs - 4, cs - 4, 9, tile, r=4, z=8)
    write("mosaic-tile")


def mosaic_well():
    cs = 36
    x, y = 84 + 3 * cs, 342 + 2 * cs
    frame(x + cs / 2, y + cs / 2, cs, cs, 192, 192)
    box(x - 2, y - 2, cs + 4, cs + 4, 8, mat("slatebed", "#070b0b", 0.6), r=0.5, z=0)
    slate = cellm(C, "cell", False)
    add_bump(slate, 40, 0.12, distance=0.004)
    box(x + 2.5, y + 2.5, cs - 5, cs - 5, 3, slate, r=3, z=8)
    write("mosaic-well")


# ------------------------------------------------------------------ Colour Flood: enamel, glass paint pots
FLOOD = ["#E0508F", "#3D7BFF", "#5EE6C8", "#FFE14D", "#FF8A1F"]


def flood_enamel():
    """A glazed enamel surface (A's hand-glazed ripple), as a shading map the app tints per region."""
    frame(195, 400, 120, 120, 384, 384)
    m = mat("enamel", "#9a9a9a", 0.35, coat=0.6, coat_rough=0.4)
    add_bump(m, 14, 0.06, detail=3, distance=0.01)
    box(195 - 70, 400 - 70, 140, 140, 6, m, r=0, z=5)
    write("flood-enamel", shading=True)


def flood_pot(i):
    """A glass paint pot with its paint, seen from above and a little in front."""
    x, y = 195, 788
    frame(x, y + 2, 64, 64, 192, 192, tilt=28)
    g = thin_glass("potglass", "#f6fbff", 0.02, 1.3)
    paint = mat(f"paint{i}", FLOOD[i], 0.12, coat=1.0, coat_rough=0.12, emit=FLOOD[i], emit_strength=0.15)
    cyl(x, y, 25, 30, g, z=0, bevel=2)
    disc_ring(x, y, 25, 2.2, 31, mat("potrim", "#e8eef2", 0.2, metal=1.0), z=0)
    cyl(x, y, 23, 20, paint, z=1, bevel=1)
    write(f"flood-pot-{i + 1}")


# ------------------------------------------------------------------ Minefield: stone plates, slate, iron
def stone_mat(name, c1, c2, rough, scale, bump):
    m = mat(name, c1, rough)
    n = m.node_tree.nodes; l = m.node_tree.links; b = n["Principled BSDF"]
    tc = n.new("ShaderNodeTexCoord"); nz = n.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale; nz.inputs["Detail"].default_value = 12; nz.inputs["Roughness"].default_value = 0.7
    l.new(tc.outputs["Object"], nz.inputs[0])
    cr = n.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].color = hexc(c2); cr.color_ramp.elements[1].color = hexc(c1)
    cr.color_ramp.elements[0].position = 0.35; cr.color_ramp.elements[1].position = 0.7
    l.new(nz.outputs["Fac"], cr.inputs[0]); l.new(cr.outputs[0], b.inputs["Base Color"])
    vor = n.new("ShaderNodeTexVoronoi"); vor.inputs["Scale"].default_value = scale * 6
    l.new(tc.outputs["Object"], vor.inputs[0])
    bp = n.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = bump; bp.inputs["Distance"].default_value = 0.004
    mx = n.new("ShaderNodeMath"); mx.operation = "ADD"
    l.new(nz.outputs["Fac"], mx.inputs[0]); l.new(vor.outputs["Distance"], mx.inputs[1])
    l.new(mx.outputs[0], bp.inputs["Height"]); l.new(bp.outputs[0], b.inputs["Normal"])
    return m


MINE_CELL = 37.8


def mine_raised():
    x, y = 6 + 4 * MINE_CELL, 104 + 3 * MINE_CELL
    cs = MINE_CELL
    frame(x + cs / 2, y + cs / 2, cs, cs, 168, 168)
    raised = stone_mat("stone", "#a3a8ad", "#5d6368", 0.55, 22, 0.35)
    box(x + 1.2, y + 1.2, cs - 2.4, cs - 2.4, 9, raised, r=3.5, z=4)
    write("mine-raised")


def mine_open():
    x, y = 6 + 4 * MINE_CELL, 104 + 9 * MINE_CELL
    cs = MINE_CELL
    frame(x + cs / 2, y + cs / 2, cs, cs, 168, 168)
    box(x - 1, y - 1, cs + 2, cs + 2, 3, mat("slatebed2", "#0c1012", 0.6), r=0.3, z=1)
    sunk = stone_mat("slate", "#283035", "#151a1d", 0.6, 9, 0.18)
    box(x + 0.6, y + 0.6, cs - 1.2, cs - 1.2, 3, sunk, r=1.5, z=4)
    write("mine-open")


def mine_mine():
    x, y = 6 + 6 * MINE_CELL + MINE_CELL / 2, 104 + 12 * MINE_CELL + MINE_CELL / 2
    frame(x, y, MINE_CELL, MINE_CELL, 168, 168)
    iron = mat("iron", "#2a2c2f", 0.38, metal=1.0)
    add_bump(iron, 120, 0.15, distance=0.002)
    sphere(x, y, 9.5, iron, z=14)
    for a in range(8):
        ang = a * math.pi / 4
        ob = cone(x, y, 2.4, 0.7, 8, iron, z=14)
        ob.rotation_euler = (0, math.pi / 2, ang)
        ob.location = V(x + math.cos(ang) * 8.5, y - math.sin(ang) * 8.5, 14)
    cyl(x, y, 3.2, 26, mat("cap", "#4a4d52", 0.3, metal=1.0), z=0, bevel=1)
    write("mine-mine")


def mine_flag():
    x, y = 6 + 6 * MINE_CELL, 104 + 5 * MINE_CELL
    cs = MINE_CELL
    frame(x + cs / 2, y + cs / 2, cs, cs, 168, 168, tilt=25)
    ycyl(x + cs / 2 - 4, y + 7, 22, 1.4, mat("pin", "#d9dde0", 0.2, metal=1), z=14.5, bevel=0.5)
    cloth = mat("flag", "#e8414a", 0.6, sheen=0.5, emit="#e8414a", emit_strength=0.2)
    add_bump(cloth, 60, 0.2, distance=0.002)
    box(x + cs / 2 - 3, y + 7, 13, 10, 1.5, cloth, r=1, z=15)
    cyl(x + cs / 2 - 4, y + 29, 4, 2, mat("pinbase", "#3a3e44", 0.4, metal=0.8), z=4, bevel=0.5)
    write("mine-flag")


SPRITES = {
    "box-tile": lambda: box_tile(False), "box-tile-given": lambda: box_tile(True),
    "flask-glass": tube_glass, "potion-meniscus": meniscus, "cork": cork,
    **{f"potion-{c}": (lambda c=c: liquid(c, False)) for c in POTION_COLOURS},
    **{f"potion-{c}-bottom": (lambda c=c: liquid(c, True)) for c in POTION_COLOURS},
    "hanoi-post": hanoi_post, "hanoi-plate": lambda: hanoi_plate(False), "hanoi-plate-gold": lambda: hanoi_plate(True),
    **{f"hanoi-ring-{i + 1}": (lambda i=i: hanoi_ring(i)) for i in range(9)},
    "safe-door": safe_door, "safe-drum": safe_drum,
    "mosaic-tile": mosaic_tile, "mosaic-well": mosaic_well,
    "flood-enamel": flood_enamel, **{f"flood-pot-{i + 1}": (lambda i=i: flood_pot(i)) for i in range(5)},
    "mine-raised": mine_raised, "mine-open": mine_open, "mine-mine": mine_mine, "mine-flag": mine_flag,
}

if __name__ == "__main__":
    names = [a for a in sys.argv[1:] if not a.startswith("-")] or list(SPRITES)
    for name in names:
        SPRITES[name]()
