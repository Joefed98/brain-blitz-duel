"""Coral Pop (bubble, bubbleRev 11): a bubble shooter under the sea. Shown mid-round: the reef hanging from the
surface in today's hex rows (teal fish, yellow star, blue jellyfish, red crab and purple shell bubbles, chests), the
dashed warning line, the shooter on its gold base with the next three bubbles, kelp, coral and sand.

A "Today, upgraded": the same scene with real bubbles (a candy-glass body under a thin clear shell), sunlit water,
a sculpted seabed.
B "Bolder": deeper water with real volumetric light shafts, caustics on the sand, richer coral and a glowing aim
trail."""
import os, sys, random
sys.path.insert(0, os.path.dirname(__file__))
from common import *

COL = {"F": (44, 190, 140), "S": (246, 206, 58), "J": (58, 128, 232), "C": (232, 68, 80), "P": (152, 98, 222),
       "T": (176, 120, 58)}
ROWS = [
    "FSJJPCJPJC",
    "F.CCTPJPS",
    "SC.FCSFSJP",
    "FPCCJCPFP",
]
# rows as read from today's mid frame (even rows 10, odd rows 9, '.' empty)
ROWS = [
    "FSJJPCJPJC",
    "FPCCJCPFP",
    "SC.FCSFSJP",
    "F.CCTPJPS",
    "CF..PJFJ.TP"[:10],
    "FP..T.CSS",
    "PJ........",
    "T........",
]
R = 15.6
PITCH = 34.2
X0, Y0, DY = 41, 266, 27.8


def bubble_xy(r, i):
    return X0 + i * PITCH + (PITCH / 2 if r % 2 else 0), Y0 + r * DY


def icon_tex(kind):
    from PIL import Image, ImageDraw, ImageFilter
    path = os.path.join(TEX, f"bubble-icon-{kind}.png")
    if os.path.exists(path):
        return path
    S = 256
    c = COL[kind]
    im = Image.new("RGBA", (S, S), c + (255,))
    # soft radial shading baked into the colour (lighter centre)
    g = Image.new("L", (S, S), 0)
    ImageDraw.Draw(g).ellipse([40, 30, 200, 190], fill=90)
    g = g.filter(ImageFilter.GaussianBlur(40))
    im = Image.composite(Image.new("RGBA", (S, S), tuple(min(255, int(v * 1.25 + 20)) for v in c) + (255,)), im, g)
    d = ImageDraw.Draw(im)
    ink = tuple(int(v * 0.32) for v in c) + (255,)
    cx = cy = S / 2
    if kind == "F":
        d.ellipse([cx - 52, cy - 30, cx + 34, cy + 30], fill=ink)
        d.polygon([(cx + 22, cy), (cx + 66, cy - 30), (cx + 58, cy), (cx + 66, cy + 30)], fill=ink)
        d.polygon([(cx - 14, cy - 28), (cx + 8, cy - 46), (cx + 14, cy - 26)], fill=ink)
        d.ellipse([cx - 36, cy - 12, cx - 22, cy + 2], fill=c + (255,))
    elif kind == "S":
        pts = []
        for k in range(10):
            a = -math.pi / 2 + k * math.pi / 5
            rr = 62 if k % 2 == 0 else 27
            pts.append((cx + rr * math.cos(a), cy + 4 + rr * math.sin(a)))
        d.polygon(pts, fill=ink)
    elif kind == "J":
        d.pieslice([cx - 46, cy - 52, cx + 46, cy + 30], 180, 360, fill=ink)
        d.rectangle([cx - 46, cy - 12, cx + 46, cy - 4], fill=ink)
        for k in range(4):
            x = cx - 33 + k * 22
            pts = [(x + 6 * math.sin(t / 3), cy - 6 + t * 4) for t in range(14)]
            d.line(pts, fill=ink, width=8)
    elif kind == "C":
        d.ellipse([cx - 44, cy - 22, cx + 44, cy + 34], fill=ink)
        for sx in (-1, 1):
            d.ellipse([cx + sx * 56 - 18, cy - 50, cx + sx * 56 + 18, cy - 14], fill=ink)
            d.line([(cx + sx * 40, cy - 6), (cx + sx * 54, cy - 26)], fill=ink, width=9)
            for k in range(3):
                d.line([(cx + sx * 36, cy + 8 + k * 10), (cx + sx * 62, cy + 20 + k * 12)], fill=ink, width=6)
            d.line([(cx + sx * 14, cy - 20), (cx + sx * 18, cy - 40)], fill=ink, width=6)
            d.ellipse([cx + sx * 18 - 7, cy - 48, cx + sx * 18 + 7, cy - 34], fill=ink)
    elif kind == "P":
        d.pieslice([cx - 58, cy - 54, cx + 58, cy + 62], 200, 340, fill=ink)
        d.polygon([(cx - 14, cy + 4), (cx + 14, cy + 4), (cx + 22, cy + 34), (cx - 22, cy + 34)], fill=ink)
        for k in range(7):
            a = math.radians(205 + k * 21.6)
            d.line([(cx, cy + 6), (cx + 56 * math.cos(a), cy + 4 + 56 * math.sin(a))], fill=c + (255,), width=5)
    elif kind == "T":
        d.rounded_rectangle([cx - 52, cy - 16, cx + 52, cy + 40], radius=8, fill=(92, 52, 22, 255))
        d.pieslice([cx - 52, cy - 52, cx + 52, cy + 20], 180, 360, fill=(120, 70, 30, 255))
        for x in (cx - 40, cx + 32):
            d.rectangle([x, cy - 34, x + 8, cy + 40], fill=(232, 186, 82, 255))
        d.rectangle([cx - 52, cy - 18, cx + 52, cy - 10], fill=(232, 186, 82, 255))
        d.rounded_rectangle([cx - 10, cy - 20, cx + 10, cy + 4], radius=3, fill=(250, 214, 110, 255))
    im.save(path)
    return path


def bubble(kind, x, y, r=R, look="A", z=0.0):
    key = f"bub-{kind}-{look}"
    m = bpy.data.materials.get(key)
    if m is None:
        m, nt, b = node_mat(key)
        tc = nt.nodes.new("ShaderNodeTexCoord")
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (1 / (2 * u(r) * 1.28), 1 / (2 * u(r) * 1.28), 1)
        mp.inputs["Location"].default_value = (0.5, 0.5, 0)
        nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
        tx = nt.nodes.new("ShaderNodeTexImage")
        tx.image = bpy.data.images.load(icon_tex(kind), check_existing=True)
        tx.extension = "EXTEND"
        nt.links.new(mp.outputs[0], tx.inputs["Vector"])
        nt.links.new(tx.outputs["Color"], b.inputs["Base Color"])
        nt.links.new(tx.outputs["Color"], b.inputs["Subsurface Radius"]) if False else None
        b.inputs["Roughness"].default_value = 0.35
        b.inputs["Subsurface Weight"].default_value = 0.08
        b.inputs["Coat Weight"].default_value = 1.0
        b.inputs["Coat Roughness"].default_value = 0.03
        b.inputs["Coat IOR"].default_value = 1.6
        nt.links.new(tx.outputs["Color"], b.inputs["Emission Color"])
        b.inputs["Emission Strength"].default_value = 0.22 if look == "A" else 0.3
    core = sphere("bub", u(r) * 0.97, m, loc=P(x, y, z + u(r)), seg=40)
    return core


def sand_and_life(look):
    sand = noisy("sand", (150, 122, 84) if look == "A" else (140, 116, 84), (98, 78, 52) if look == "A" else (84, 66, 46),
                 scale=60, rough=0.85, bump=0.6)
    bpy.ops.mesh.primitive_grid_add(x_subdivisions=80, y_subdivisions=40, size=1, location=P(195, 800, 0))
    o = bpy.context.object
    o.scale = (u(440), u(110), 1)
    rnd = random.Random(4)
    for v in o.data.vertices:
        v.co.z = (math.sin(v.co.x * 9) * 0.006 + rnd.random() * 0.004) / 1
    o.data.materials.append(sand)
    o.location.z = u(2)
    o.rotation_euler = (math.radians(-6), 0, 0)
    # pebbles
    for k in range(18):
        x, y = rnd.uniform(10, 380), rnd.uniform(762, 840)
        s = rnd.uniform(2, 5)
        p = sphere("peb", u(s), noisy(f"peb{k%3}", (170, 160, 150), (110, 100, 92), 30, 0.6, bump=0.3),
                   loc=P(x, y, u(4)), seg=16)
        p.scale = (1, 0.7, 0.5)
    # coral fans: branching tubes in pink and coral
    corals = [(20, 768, (240, 120, 150)), (110, 774, (250, 130, 110)), (322, 770, (240, 120, 160)),
              (372, 778, (255, 150, 120)), (66, 790, (250, 160, 140))]
    for (x, y, c) in corals:
        cm = mat(f"coral{x}", c, rough=0.6, sss=0.4, emit=c if look == "B" else None, emit_str=0.08)
        def branch(px, py, a, L, w, depth):
            ex, ey = px + L * math.cos(a), py - L * math.sin(a)
            tube_path("cb", [(u(px), u(H - py), u(6)), (u(ex), u(H - ey), u(6 + depth))], u(w), cm)
            sphere("ct", u(w * 1.1), cm, loc=P(ex, ey, u(6 + depth)), seg=12)
            if depth < 3:
                for da in (-0.45, 0.4):
                    branch(ex, ey, a + da + rnd.uniform(-0.15, 0.15), L * 0.7, w * 0.75, depth + 1)
        branch(x, y, math.pi / 2, 14, 2.4, 0)
    # kelp up the sides
    kelp = mat("kelp", (52, 140, 70), rough=0.5, sss=0.3)
    for (x0, top) in ((10, 520), (24, 610), (372, 560), (384, 650)):
        pts = []
        for t in range(24):
            y = 790 - t * (790 - top) / 23
            pts.append((u(x0 + 4 * math.sin(t * 0.6)), u(H - y), u(3)))
        tube_path("kelp", pts, u(2.2), kelp)
        for t in range(3, 24, 3):
            y = 790 - t * (790 - top) / 23
            lf = sphere("leaf", u(5), kelp, loc=P(x0 + 6 * (1 if t % 2 else -1), y, u(3)), seg=12)
            lf.scale = (1.4, 0.5, 0.3)
            lf.rotation_euler = (0, 0, 0.5 if t % 2 else -0.5)


def build(look):
    reset(samples=128, view="AgX", look="AgX - Punchy", exposure=-0.1)
    s = bpy.context.scene
    s.cycles.max_bounces = 10
    # water backdrop: lighter near the surface, deep below; light shafts painted into it for look A
    from PIL import Image, ImageDraw, ImageFilter
    import numpy as np
    w, h = 780, 1688
    top, mid, bot = ((70, 128, 170), (20, 64, 104), (8, 30, 60)) if look == "A" else ((40, 110, 160), (10, 40, 86), (3, 14, 36))
    t = np.linspace(0, 1, h)[:, None]
    surf = 488
    col = np.where(t < surf / h, 0, 1)
    arr = np.zeros((h, w, 3))
    for c in range(3):
        k = np.clip((t * h - surf) / (h - surf), 0, 1)
        arr[:, :, c] = (top[c] * (1 - k) + mid[c] * k) * (1 - k ** 2) + bot[c] * k ** 2
    above = np.array((30, 52, 64) if look == "A" else (16, 30, 44))
    arr[:surf] = above
    im = Image.fromarray(arr.astype("uint8"))
    ray = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(ray)
    rnd = random.Random(2)
    for k in range(7):
        x = rnd.uniform(60, 720)
        d.polygon([(x - 18, surf), (x + 18, surf), (x + 140, h), (x + 40, h)],
                  fill=rnd.randint(18, 40) if look == "A" else rnd.randint(40, 80))
    ray = ray.filter(ImageFilter.GaussianBlur(18))
    im = Image.composite(Image.new("RGB", (w, h), (170, 220, 255)), im, ray)
    d = ImageDraw.Draw(im)
    for x in range(0, w, 26):
        d.line([(x, surf - 2), (x + 14, surf - 2)], fill=(160, 210, 230), width=3)
    backdrop("bubble-water-" + look, im, z=-0.2, emit=1.2)
    world_color((30, 60, 90), 0.35)

    # the reef
    for r, row in enumerate(ROWS):
        for i, k in enumerate(row):
            if k == ".":
                continue
            x, y = bubble_xy(r, i)
            if x > 376:
                continue
            bubble(k, x, y, look=look)
    # warning line
    dash = emission("dash", (200, 220, 240), 0.8)
    for x in range(14, 380, 12):
        rbox("dash", u(6), u(1.2), u(0.5), mat_=dash, loc=P(x + 3, 690, u(1)))
    # shooter: gold base, loaded bubble, next tray
    g = gold("bub-gold", (226, 178, 80), 0.25)
    cyl("base", u(22), u(6), g, loc=P(195, 738, u(4)), bevel=u(1.5))
    torus("base-ring", u(22), u(2), g, loc=P(195, 738, u(7)))
    bubble("P", 195, 712, look=look, z=u(6))
    plate("tray", u(66), u(22), u(3), u(11), mat_=mat("tray", (22, 40, 52), rough=0.3, coat=0.5),
          loc=P(258, 738, u(3)), edge=u(1))
    for j, k in enumerate("FJC"):
        bubble(k, 238 + j * 20, 738, r=8, look=look, z=u(6))
    # aim trail: soft glowing dots from the shooter to the left wall and up
    am = emission("aim", (220, 240, 255), 2.5 if look == "A" else 6)
    pts = []
    sx, sy, ex, ey = 195, 694, 16, 470
    for k in range(16):
        f = k / 15
        pts.append((sx + (ex - sx) * f, sy + (ey - sy) * f))
    for k in range(1, 6):
        pts.append((16 + k * 12, 470 - k * 14))
    for (x, y) in pts[1:]:
        sphere("aim", u(2.2), am, loc=P(x, y, u(16)), seg=12)
    sand_and_life(look)

    if look == "A":
        area(P(140, 120, 10), P(195, 450, 0), size=6, energy=700, color=(220, 240, 255), spread=80)
        area(P(420, 860, 6), P(195, 450, 0), size=8, energy=80, color=(120, 180, 255))
    else:
        area(P(140, 120, 10), P(195, 450, 0), size=4, energy=600, color=(200, 236, 255), spread=60)
        area(P(420, 860, 6), P(195, 450, 0), size=8, energy=60, color=(80, 140, 255))
        # caustics: a voronoi light pattern thrown on the sand by a textured spot
        cm, nt, b = node_mat("caustic")
        for n in list(nt.nodes):
            if n.type != "OUTPUT_MATERIAL":
                nt.nodes.remove(n)
        tc = nt.nodes.new("ShaderNodeTexCoord")
        vo = nt.nodes.new("ShaderNodeTexVoronoi")
        vo.feature = "DISTANCE_TO_EDGE"
        vo.inputs["Scale"].default_value = 7
        nz = nt.nodes.new("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = 3
        mx = nt.nodes.new("ShaderNodeVectorMath")
        mx.operation = "MULTIPLY_ADD"
        mx.inputs[1].default_value = (0.25, 0.25, 0.25)
        nt.links.new(nz.outputs["Color"], mx.inputs[0])
        nt.links.new(tc.outputs["Object"], mx.inputs[2])
        nt.links.new(mx.outputs[0], vo.inputs["Vector"])
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["From Min"].default_value = 0.0
        mr.inputs["From Max"].default_value = 0.022
        mr.inputs["To Min"].default_value = 0.22
        mr.inputs["To Max"].default_value = 0.0
        nt.links.new(vo.outputs["Distance"], mr.inputs["Value"])
        e = nt.nodes.new("ShaderNodeEmission")
        e.inputs[0].default_value = lin((170, 230, 255))
        nt.links.new(mr.outputs[0], e.inputs[1])
        tr = nt.nodes.new("ShaderNodeBsdfTransparent")
        ad = nt.nodes.new("ShaderNodeAddShader")
        nt.links.new(e.outputs[0], ad.inputs[0])
        nt.links.new(tr.outputs[0], ad.inputs[1])
        nt.links.new(ad.outputs[0], nt.nodes["Material Output"].inputs[0])
        o = plate("caustics", u(420), u(100), u(0.1), 0, mat_=cm, loc=P(195, 800, u(12)))
        o.rotation_euler = (math.radians(-6), 0, 0)
        o.visible_shadow = False
    cam_top(ortho=False, lens=200, tilt=2)

    def post(im):
        im = pills_at(im, [("Popped", 68, False)], 79)
        im = pills_at(im, [("Treasure", "2/6", False)], 79, right=True)
        im = pills_at(im, [("Combo", "×2", True)], 108)
        if look == "B":
            im = vignette(0.4)(im)
        return im
    return dict(post=post)


run("strategy", "bubble", ["A", "B"], build)
