"""Rainbow Bridge (inkbridge, inkRev 14): draw rainbow lines so a dropped coin rolls into the pot. Shown mid-level 7:
two drawn lines (the coin resting at the top of the first), the bounce cloud, a clover, rows of birds, the pot of gold on
the hill and the sun. Today: a bright blue sky, small white clouds, white birds in rows, a striped rainbow line, a
black pot of gold on green hills, a little figure beside the pot (here an original fox, not today's figure).

The scene is built standing up: objects are modelled z-up and turned to face the top-down camera (FACE)."""
import os, sys, random
sys.path.insert(0, os.path.dirname(__file__))
from common import *

FACE = (math.radians(-90), 0, 0)
LINE1 = [(150, 135), (200, 160), (250, 186), (300, 210), (331, 224)]
LINE2 = [(385, 257), (372, 330), (358, 410), (343, 490), (330, 560), (322, 604)]
BIRDS = [(130, 206, 235), (141, 217, 271), (114, 222, 325), (54, 146, 360), (22, 97, 415), (65, 255, 504)]


def stand(o, x, y, z=0.0):
    o.rotation_euler = FACE
    o.location = P(x, y, z)
    return o


def rainbow_mat(name, p0, p1, look):
    """Spectrum bands along the line (today's striping) as glossy enamel; B a glass tube with the bands inside."""
    m, nt, b = node_mat(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    dx, dy = p1[0] - p0[0], -(p1[1] - p0[1])
    L = math.hypot(dx, dy)
    dot = nt.nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = (dx / L * 100 / 70, dy / L * 100 / 70, 0)  # one spectrum every 70 px
    nt.links.new(tc.outputs["Object"], dot.inputs[0])
    fr = nt.nodes.new("ShaderNodeMath")
    fr.operation = "FRACT"
    nt.links.new(dot.outputs["Value"], fr.inputs[0])
    hsv = nt.nodes.new("ShaderNodeCombineColor")
    hsv.mode = "HSV"
    nt.links.new(fr.outputs[0], hsv.inputs[0])
    hsv.inputs[1].default_value = 1.0
    hsv.inputs[2].default_value = 1.0
    nt.links.new(hsv.outputs[0], b.inputs["Base Color"])
    nt.links.new(hsv.outputs[0], b.inputs["Emission Color"])
    b.inputs["Emission Strength"].default_value = 0.35 if look == "A" else 0.8
    b.inputs["Roughness"].default_value = 0.25
    b.inputs["Coat Weight"].default_value = 1.0
    b.inputs["Coat Roughness"].default_value = 0.05
    if look == "B":
        b.inputs["Subsurface Weight"].default_value = 0.3
    return m


def line(name, pts, look):
    m = rainbow_mat(name, pts[0], pts[-1], look)
    tube_path(name, [(u(x), u(H - y), u(10)) for x, y in pts], u(4.2 if look == "A" else 4.8), m)
    for (x, y) in (pts[0], pts[-1]):
        sphere(name + "-cap", u(4.2 if look == "A" else 4.8), m, loc=P(x, y, u(10)), seg=16)


def cloud(x, y, s, m, seed=0):
    """A cumulus puff: a flat base of small spheres under a few big domes."""
    rnd = random.Random(seed)
    for k in range(6):
        dx = (k - 2.5) * s * 0.2
        o = sphere("cl", u(s * 0.16), m, loc=P(x + dx, y + s * 0.06, u(4)), seg=18)
        o.scale = (1.3, 0.8, 0.5)
    for (dx, dy, rr) in ((-0.22, -0.06, 0.2), (0.02, -0.16, 0.27), (0.25, -0.05, 0.19), (-0.38, 0.02, 0.12),
                         (0.4, 0.03, 0.12)):
        o = sphere("cl", u(s * rr * rnd.uniform(0.92, 1.08)), m, loc=P(x + dx * s, y + dy * s, u(5)), seg=22)
        o.scale = (1, 1, 0.55)


def bird(x, y, m, eye):
    """A small gull: a white body and two raised, swept wings with grey tips."""
    body = sphere("bb", u(3.0), m, loc=P(x, y, u(8)), seg=16)
    body.scale = (1.6, 0.9, 0.9)
    tip = bpy.data.materials.get("wingtip") or mat("wingtip", (120, 128, 140), rough=0.6)
    for sx in (-1, 1):
        wg = sphere("bw", u(4.2), m, loc=P(x + sx * 5.2, y - 2.6, u(8)), seg=16)
        wg.scale = (1.25, 0.42, 0.25)
        wg.rotation_euler = (0, 0, math.radians(sx * 28))
        tp = sphere("bt", u(1.8), tip, loc=P(x + sx * 9.4, y - 5.2, u(8.4)), seg=10)
        tp.scale = (1.4, 0.6, 0.3)
        tp.rotation_euler = (0, 0, math.radians(sx * 40))
    sphere("be", u(0.8), eye, loc=P(x - 2.6, y - 0.6, u(10.4)), seg=8)
    sphere("bk", u(0.9), mat("beak", (240, 170, 60), rough=0.4), loc=P(x - 4.6, y + 0.2, u(9.4)), seg=8)


def fox(x, y):
    """An original little fox sitting beside the pot (stands in for today's figure)."""
    fur = mat("fur", (222, 110, 40), rough=0.7, sheen=0.6)
    white = mat("fur-w", (246, 238, 226), rough=0.7, sheen=0.5)
    dark = mat("fur-d", (40, 26, 20), rough=0.5)
    b = sphere("fb", u(7), fur, loc=P(x, y - 6, u(10)), seg=24)
    b.scale = (0.9, 1.15, 0.8)
    sphere("fchest", u(4), white, loc=P(x - 1, y - 6, u(15)), seg=16).scale = (0.8, 1.1, 0.5)
    h = sphere("fh", u(6), fur, loc=P(x - 1, y - 19, u(11)), seg=24)
    sphere("fsn", u(2.6), white, loc=P(x - 4, y - 16.5, u(15)), seg=12)
    sphere("fno", u(1.0), dark, loc=P(x - 6, y - 16.5, u(17)), seg=8)
    for sx in (-1, 1):
        e = cyl("fear", u(2.6), u(7), fur, loc=P(x - 1 + sx * 4, y - 26, u(11)), verts=16)
        e.rotation_euler = (math.radians(-90), math.radians(sx * 18), 0)
        e.scale = (1, 1, 1)
        sphere("feye", u(0.9), dark, loc=P(x - 1 + sx * 2.4 - 1, y - 20.5, u(16.5)), seg=8)
    t = sphere("ft", u(4.5), fur, loc=P(x + 9, y - 2, u(8)), seg=16)
    t.scale = (1.6, 0.7, 0.6)
    sphere("ftt", u(2.6), white, loc=P(x + 14.5, y - 4, u(8)), seg=12)


def build(look):
    reset(samples=128, view="Standard", exposure=0.0)
    from PIL import Image, ImageDraw, ImageFilter
    import numpy as np
    w, h = 780, 1688
    if look == "A":
        stops = [(0.0, (30, 70, 140)), (0.12, (62, 146, 220)), (0.55, (120, 196, 240)), (0.74, (176, 222, 244)),
                 (1.0, (190, 228, 246))]
        sun_xy, sun_c = (660, 282), (255, 252, 236)
    else:
        stops = [(0.0, (24, 40, 104)), (0.18, (60, 92, 176)), (0.48, (230, 140, 120)), (0.68, (255, 196, 128)),
                 (1.0, (255, 220, 160))]
        sun_xy, sun_c = (640, 330), (255, 236, 190)
    t = np.linspace(0, 1, h)
    arr = np.zeros((h, w, 3))
    for c in range(3):
        arr[:, :, c] = np.interp(t, [s[0] for s in stops], [s[1][c] for s in stops])[:, None]
    im = Image.fromarray(arr.astype("uint8"))
    glow = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(glow)
    d.ellipse([sun_xy[0] - 260, sun_xy[1] - 260, sun_xy[0] + 260, sun_xy[1] + 260], fill=120 if look == "A" else 170)
    for k in range(14):
        a = k / 14 * 2 * math.pi + 0.2
        d.polygon([sun_xy, (sun_xy[0] + 900 * math.cos(a - 0.03), sun_xy[1] + 900 * math.sin(a - 0.03)),
                   (sun_xy[0] + 900 * math.cos(a + 0.03), sun_xy[1] + 900 * math.sin(a + 0.03))], fill=30)
    glow = glow.filter(ImageFilter.GaussianBlur(60))
    im = Image.composite(Image.new("RGB", (w, h), sun_c), im, glow)
    d = ImageDraw.Draw(im)
    d.ellipse([sun_xy[0] - 40, sun_xy[1] - 40, sun_xy[0] + 40, sun_xy[1] + 40], fill=(255, 254, 246))
    # far hills, hazy
    hill = Image.new("L", (w, h), 0)
    hd = ImageDraw.Draw(hill)
    pts = [(0, 1290)] + [(x, 1268 - 34 * math.sin(x / 140) - 18 * math.sin(x / 47)) for x in range(0, w + 10, 10)] + [(w, h), (0, h)]
    hd.polygon(pts, fill=255)
    hill = hill.filter(ImageFilter.GaussianBlur(3))
    im = Image.composite(Image.new("RGB", (w, h), (118, 170, 168) if look == "A" else (150, 130, 140)), im, hill)
    im = im.filter(ImageFilter.GaussianBlur(0.6))
    backdrop("ink-sky-" + look, im, z=-0.3, emit=1.0)
    world_color((170, 210, 240) if look == "A" else (255, 200, 160), 0.6)

    # near hill: a sculpted grass mound
    grass = noisy("grass", (104, 196, 76) if look == "A" else (70, 150, 56), (58, 150, 52) if look == "A" else (34, 96, 36),
                  scale=90, rough=0.75, bump=0.8, detail=10)
    bm = bmesh.new()
    xs = list(range(-20, 420, 8))
    top = [(x, 664 - 18 * math.exp(-((x - 160) / 120) ** 2) + 6 * math.sin(x / 33)) for x in xs]
    rows = []
    for j in range(14):
        row = []
        for (x, ty) in top:
            y = ty + j * (H + 20 - ty) / 13
            zz = (6 if j == 0 else 18 + 4 * math.sin(x / 21 + j)) if j < 13 else 0
            row.append(bm.verts.new((u(x), u(H - y), u(zz))))
        rows.append(row)
    for a, b2 in zip(rows, rows[1:]):
        for i in range(len(xs) - 1):
            bm.faces.new((a[i], a[i + 1], b2[i + 1], b2[i]))
    me = bpy.data.meshes.new("hill")
    bm.to_mesh(me)
    bm.free()
    ho = link(bpy.data.objects.new("hill", me))
    ho.data.materials.append(grass)
    for p in me.polygons:
        p.use_smooth = True
    rnd = random.Random(5)
    for k in range(10):
        x, y = rnd.uniform(20, 370), rnd.uniform(700, 840)
        f = sphere("fl", u(2.2), mat("flower", (250, 170, 196), rough=0.5, sss=0.3), loc=P(x, y, u(22)), seg=10)
        f.scale = (1, 1, 0.4)

    # clouds
    cm = mat("cloud", (255, 255, 255), rough=0.8, sss=0.5, emit=(255, 255, 255), emit_str=0.3) if look == "A" else mat("cloud-b", (255, 236, 226), rough=0.8, sss=0.5, emit=(255, 214, 190), emit_str=0.25)
    for i, (x, y, s) in enumerate(((150, 98, 40), (32, 166, 26), (180, 400, 22), (120, 228, 28), (60, 560, 24))):
        cloud(x, y, s, cm, i)
    # bounce cloud: a puffed cloud in a gold ring (today's pill with a spring line)
    cloud(346, 242, 38, cm, 9)
    g = gold("ink-gold", (232, 186, 86), 0.2)
    ring = torus("bc-ring", u(22), u(1.6), g, loc=P(346, 243, u(6)))
    ring.scale = (1.0, 0.5, 1)
    # drawn lines
    line("ink1", LINE1, look)
    line("ink2", LINE2, look)
    # coin resting at the top of the first line
    coin = cyl("coin", u(8), u(2.4), gold("coin", (244, 196, 70), 0.18), loc=P(186, 142, u(18)), bevel=u(0.8))
    torus("coin-rim", u(6), u(0.8), gold("coin", (244, 196, 70), 0.18), loc=P(186, 142, u(19.4)))
    # clover
    leaf = mat("clover", (46, 168, 70), rough=0.5, sss=0.2)
    for k in range(3):
        a = math.radians(90 + k * 120)
        lf = sphere("cl", u(4.6), leaf, loc=P(375 + 5 * math.cos(a), 190 - 5 * math.sin(a), u(10)), seg=16)
        lf.scale = (1, 1, 0.35)
    tube_path("stem", [(u(375), u(H - 190), u(10)), (u(380), u(H - 206), u(10))], u(1), leaf)
    # birds
    bm_ = mat("bird", (250, 250, 248), rough=0.6, sss=0.3)
    eye = mat("eye", (20, 22, 30), rough=0.2)
    for (x0, x1, y) in BIRDS:
        n = max(2, int((x1 - x0) / 21) + 1)
        for k in range(n):
            bird(x0 + k * (x1 - x0) / (n - 1), y, bm_, eye)
    # the pot of gold
    iron = mat("iron", (24, 24, 28), rough=0.3, metal=0.6, coat=0.4)
    pot = sphere("pot", u(26), iron, loc=P(309, 638, u(14)), seg=40)
    pot.scale = (1.35, 0.95, 0.9)
    torus("potrim", u(30), u(3.2), iron, loc=P(309, 617, u(14)), rot=(math.radians(90), 0, 0)).scale = (1, 1, 0.3)
    for k in range(9):
        cy_ = 613 - (2 if k % 2 else 0)
        sphere("gc", u(4.4), gold("coin", (244, 196, 70), 0.18), loc=P(283 + k * 6.6, cy_, u(30)), seg=16).scale = (1, 0.55, 1)
    for sx in (-1, 1):
        sphere("handle", u(3.2), iron, loc=P(309 + sx * 33, 615, u(16)), seg=12)
    fox(352, 650)

    if look == "A":
        area(P(420, 120, 24), P(195, 450, 0), size=10, energy=1400, color=(255, 248, 232))
        area(P(-100, 600, 18), P(195, 450, 0), size=10, energy=300, color=(200, 224, 255))
    else:
        area(P(420, 200, 14), P(195, 450, 0), size=6, energy=1500, color=(255, 214, 160))
        area(P(-100, 600, 18), P(195, 450, 0), size=10, energy=300, color=(160, 170, 255))
    cam_top(ortho=False, lens=200, tilt=0)

    def post(im):
        im = pills_at(im, [("Level", "7/10", False), ("Ink", "545 · par 587", False)], 79)
        # the ink meter, a rainbow bar in a dark pill on the right
        from PIL import ImageDraw
        k = im.size[1] / H
        d = ImageDraw.Draw(im, "RGBA")
        x0, x1 = 300 * k, 378 * k
        d.rounded_rectangle([x0, 68 * k, x1, 90 * k], radius=11 * k, fill=(8, 11, 22, 200))
        d.text((x0 + 9 * k, 79 * k), "LEFT", font=font(600, int(10 * k)), fill=(170, 176, 196), anchor="lm")
        bx0, bx1 = x0 + 36 * k, x1 - 8 * k
        import colorsys
        for i in range(int(bx1 - bx0)):
            r_, g_, b_ = colorsys.hsv_to_rgb(i / (bx1 - bx0) * 0.8, 0.7, 1)
            d.line([(bx0 + i, 76 * k), (bx0 + i, 82 * k)], fill=(int(r_ * 255), int(g_ * 255), int(b_ * 255)))
        # the action row (interface, drawn flat): Undo, Reset, Release (gold), Drop again
        d.rectangle([0, 778 * k, im.size[0], 844 * k], fill=(10, 14, 24, 235))
        labels = [("UNDO", False), ("RESET", False), ("RELEASE", True), ("DROP AGAIN", False)]
        bw = (390 - 5 * 8) / 4
        for i, (lab, hi) in enumerate(labels):
            bx = 8 + i * (bw + 8)
            d.rounded_rectangle([bx * k, 786 * k, (bx + bw) * k, 826 * k], radius=12 * k,
                                fill=(226, 192, 122, 255) if hi else (34, 40, 56, 255))
            d.text(((bx + bw / 2) * k, 806 * k), lab, font=font(800, int(12 * k)),
                   fill=(26, 18, 6) if hi else (236, 238, 244), anchor="mm")
        if look == "B":
            im = vignette(0.3)(im)
        return im
    return dict(post=post)


run("strategy", "inkbridge", ["A", "B"], build)
