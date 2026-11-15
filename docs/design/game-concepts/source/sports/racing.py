"""Apex (racing, racingRev 3): the chase camera on lap 2: the car from behind on the straight into a right-hander,
red and white kerbs, a sand verge, grass and a tree line, the sunset with hills; the speed readout, the faint
joystick and the rev lights below.  A: today's sunset circuit and dark red car, made real.  B: bolder, the last
of the light, speed in the motion blur, the tail lights lit.  C: after a shower: a wet, mirror-dark track holding
the sunset, spray off the rear wheels."""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(__file__))
from kit import *
import bmesh as _b


def path(n=260, ds=1.0):
    pts = []
    x, y, h = 0.0, -30.0, 0.0
    for i in range(n):
        s = i * ds
        k = 0.0
        if 58 < s < 150:
            k = 1 / 52.0
        elif 150 <= s < 210:
            k = -1 / 90.0
        pts.append((x, y, h))
        h += k * ds
        x += math.sin(h) * ds
        y += math.cos(h) * ds
    return pts


def strip(name, pts, off0, off1, m, z=0.0, every=None, mats=None):
    """A ribbon between lateral offsets off0..off1 (metres, + = right) along the path."""
    me = bpy.data.meshes.new(name)
    bm = _b.new()
    prev = None
    for i, (x, y, h) in enumerate(pts):
        nx, ny = math.cos(h), -math.sin(h)   # right-hand normal
        a = bm.verts.new((x + nx * off0, y + ny * off0, z))
        b = bm.verts.new((x + nx * off1, y + ny * off1, z))
        if prev:
            f = bm.faces.new([prev[0], prev[1], b, a])
            if every and mats:
                f.material_index = (i // every) % len(mats)
        prev = (a, b)
    bm.to_mesh(me); bm.free()
    o = link(bpy.data.objects.new(name, me))
    for mm in (mats or [m]):
        o.data.materials.append(mm)
    me.uv_layers.new()
    return o


def tree(x, y, h, leaf, trunk, rnd):
    cyl("trunk", 0.22, h * 0.35, trunk, loc=(x, y, h * 0.17), verts=8)
    for j in range(5):
        r = h * rnd.uniform(0.16, 0.24)
        o = sphere("crown", r, leaf, loc=(x + rnd.uniform(-0.4, 0.4), y + rnd.uniform(-0.4, 0.4), h * (0.45 + j * 0.11)), seg=12)
        o.scale = (1, 1, 1.25)
        d = o.modifiers.new("d", "DISPLACE")
        tx = bpy.data.textures.get("leafn") or bpy.data.textures.new("leafn", "CLOUDS")
        tx.noise_scale = 0.4
        d.texture = tx
        d.strength = r * 0.35


def car(look, x, y, h, body_c=(110, 18, 22)):
    """An original closed-wheel prototype seen from behind: low body, rear wing, wide tyres, tail lights."""
    body = mat("carbody", body_c, rough=0.18, coat=1.0, coat_rough=0.03, metal=0.3)
    carbon = noisy("carbon", (14, 14, 16), (34, 34, 38), scale=180, rough=0.3, coat=0.6, bump=0.05)
    stripe = mat("carstripe", (236, 140, 40), rough=0.3, coat=1.0)
    tyre = mat("tyre", (18, 18, 20), rough=0.75)
    rim = mat("rim", (60, 62, 68), rough=0.25, metal=1.0)
    tail = emission("tail", (255, 40, 30), 6.0 if look == "A" else 14.0)
    glass_ = mat("canopy", (14, 18, 26), rough=0.05, coat=1.0)
    parts = []
    def add(o):
        parts.append(o); return o
    add(rbox("tub", 1.9, 4.4, 0.55, r=0.22, mat_=body, loc=(0, 0, 0.42)))
    add(rbox("sidepod", 2.05, 2.2, 0.42, r=0.18, mat_=body, loc=(0, -0.7, 0.4)))
    add(rbox("cockpit", 0.95, 1.4, 0.45, r=0.2, mat_=glass_, loc=(0, 0.3, 0.82)))
    add(rbox("engine", 0.8, 1.6, 0.42, r=0.18, mat_=body, loc=(0, -1.0, 0.8)))
    add(rbox("stripe", 0.22, 4.42, 0.02, r=0.01, mat_=stripe, loc=(0, 0, 0.705)))
    add(rbox("diffuser", 1.7, 0.3, 0.25, r=0.04, mat_=carbon, loc=(0, -2.2, 0.25)))
    add(rbox("wing", 1.95, 0.42, 0.06, r=0.02, mat_=carbon, loc=(0, -2.05, 1.18)))
    for s in (-1, 1):
        add(rbox("endplate", 0.04, 0.6, 0.55, r=0.01, mat_=carbon, loc=(s * 0.98, -2.05, 1.0)))
        add(rbox("pylon", 0.05, 0.2, 0.4, mat_=carbon, loc=(s * 0.25, -2.0, 0.95)))
        add(rbox("taillight", 0.42, 0.04, 0.07, r=0.02, mat_=tail, loc=(s * 0.55, -2.21, 0.55)))
        for wy in (-1.45, 1.35):
            add(cyl("tyre", 0.36, 0.38, tyre, loc=(s * 0.98, wy, 0.36), verts=48, rot=(0, math.radians(90), 0), bevel=0.06))
            add(cyl("rim", 0.24, 0.39, rim, loc=(s * 0.98, wy, 0.36), verts=32, rot=(0, math.radians(90), 0)))
    add(rbox("rainlight", 0.18, 0.04, 0.12, r=0.02, mat_=tail, loc=(0, -2.26, 0.3)))
    root = bpy.data.objects.new("car", None)
    link(root)
    for p in parts:
        p.parent = root
    root.location = (x, y, 0.0)
    root.rotation_euler = (0, 0, -h)
    return root


def build(look):
    reset(samples=128 if look == "A" else 160, view="AgX", look="AgX - Punchy", exposure=0.0 if look != "B" else 1.0)
    pts = path()
    tarmac = noisy("tarmac", (44, 44, 50), (70, 70, 76), scale=300, rough=0.72 if look != "C" else 0.12, bump=0.12,
                   coat=0.0 if look != "C" else 1.0)
    if look == "C":
        bpy.data.materials["tarmac"].node_tree.nodes["Principled BSDF"].inputs["Coat Roughness"].default_value = 0.06
    grass = stripes("grass", (52, 106, 40), (62, 120, 48), band=6.0, fibre=60, sheen=0.0, rough=0.8)
    sand = noisy("sand", (184, 150, 104), (210, 180, 132), scale=60, rough=0.95, bump=0.3)
    red = mat("kred", (204, 32, 36), rough=0.4, coat=0.4)
    white = mat("kwhite", (240, 240, 238), rough=0.4, coat=0.4)
    plate("ground", 600, 600, 0.1, 0, mat_=grass, loc=(0, 150, -0.12))
    strip("road", pts, -6.0, 6.0, tarmac, z=0.02)
    strip("kerbL", pts, -7.2, -6.0, None, z=0.04, every=3, mats=[red, white])
    strip("kerbR", pts, 6.0, 7.2, None, z=0.04, every=3, mats=[red, white])
    strip("sand", pts, -14.0, -7.2, sand, z=0.01)
    strip("edgeL", pts, -6.0, -5.82, white, z=0.03)
    strip("edgeR", pts, 5.82, 6.0, white, z=0.03)
    # skid marks
    strip("skid", pts[20:90], 0.6, 1.1, mat("skid", (24, 24, 26), rough=0.7), z=0.025)
    # barrier: a low tyre wall beyond the sand
    strip("barrier", pts, -14.6, -14.0, mat("barrier", (30, 32, 40), rough=0.6), z=0.5)
    # trees
    rnd = random.Random(5)
    leaf = noisy("leaf", (34, 70, 30), (66, 104, 46), scale=6, rough=0.75, bump=0.4)
    trunk = mat("trunk", (60, 44, 30), rough=0.8)
    for i in range(70):
        s = rnd.randrange(40, 250)
        x, y, h = pts[s]
        side = rnd.choice((-1, 1))
        off = rnd.uniform(22, 50) * side
        nx, ny = math.cos(h), -math.sin(h)
        tree(x + nx * off, y + ny * off, rnd.uniform(7, 12), leaf, trunk, rnd)
    for i in range(40):
        tree(rnd.uniform(-160, 200), rnd.uniform(230, 300), rnd.uniform(9, 15), leaf, trunk, rnd)
    # hills on the horizon
    hill = mat("hill", (60, 70, 96), rough=0.9)
    for i in range(8):
        hs = sphere("hill", rnd.uniform(60, 110), hill, loc=(rnd.uniform(-300, 400), rnd.uniform(500, 600), -40), seg=24)
        hs.scale = (2.0, 1.0, 0.55)
    # corner sign (red ring) on the right before the turn
    signpost = mat("signpost", (200, 200, 204), rough=0.3, metal=1)
    x, y, h = pts[44]
    nx, ny = math.cos(h), -math.sin(h)
    sx, sy = x + nx * 9.5, y + ny * 9.5
    cyl("sp", 0.06, 2.4, signpost, loc=(sx, sy, 1.2), verts=12)
    cyl("sface", 0.7, 0.05, mat("sface", (248, 248, 246), rough=0.4), loc=(sx, sy, 2.7), verts=48, rot=(math.radians(90), 0, 0))
    torus("sring", 0.62, 0.09, mat("sring", (210, 30, 36), rough=0.4), loc=(sx, sy - 0.04, 2.7), rot=(math.radians(90), 0, 0))
    text3d("120", 0.42, mat("stext", (20, 20, 22), rough=0.5), (sx, sy - 0.06, 2.7), rot=(math.radians(90), 0, 0))
    # the car
    cs = 26
    x, y, h = pts[cs]
    nx, ny = math.cos(h), -math.sin(h)
    c = car(look, x + nx * 1.0, y + ny * 1.0, h)
    c.rotation_euler = (0, 0, -h - math.radians(3.5))
    if look == "C":
        # a fine mist off the rear tyres (many tiny faint droplets)
        drop = mat("drop", (240, 244, 250), rough=0.1, alpha=0.18)
        for i in range(160):
            sx_ = rnd.choice((-1, 1)) * 0.98 + rnd.uniform(-0.25, 0.25)
            t = rnd.uniform(0, 1)
            sphere("drop", 0.012 + 0.02 * t, drop, loc=(c.location.x + sx_ * (1 + t * 0.4), c.location.y - 2.0 - t * 4.0,
                   0.15 + t * rnd.uniform(0.2, 0.9)), seg=6)
    # sky and light
    if look == "B":
        world_gradient([(0.0, (255, 136, 60)), (0.06, (236, 96, 70)), (0.2, (120, 56, 110)), (0.5, (36, 26, 66)), (1.0, (10, 10, 30))], 1.0)
        sun_disc((60, 700, 18), 14, strength=40)
        sun(rot=(-88, 0, 5), energy=2.6, color=(255, 150, 80), angle=1.0)
        sun(rot=(70, 0, -25), energy=1.6, color=(255, 170, 120), angle=3.0)
    else:
        world_gradient([(0.0, (255, 196, 120)), (0.05, (250, 150, 90)), (0.16, (190, 96, 110)), (0.4, (84, 66, 130)), (1.0, (30, 32, 78))], 1.0)
        sun_disc((60, 700, 34), 16, strength=40)
        sun(rot=(-86, 0, 5), energy=3.0, color=(255, 196, 140), angle=1.0)
        sun(rot=(62, 0, -25), energy=2.2, color=(255, 214, 170), angle=3.0)
    cx, cy, ch = pts[11]
    cam = cam_look((cx + math.cos(ch) * 1.0, cy - math.sin(ch) * 1.0, 3.0), (pts[80][0] - 3.5, pts[80][1], -6.5), lens=24)
    if look == "B":
        s = bpy.context.scene
        s.render.use_motion_blur = True
        s.render.motion_blur_shutter = 0.9
        s.frame_set(1)
        for ob, dy in ((cam, 2.0), (c, 2.0)):
            ob.keyframe_insert("location", frame=1)
            ob.location.y += dy
            ob.keyframe_insert("location", frame=2)
            ob.location.y -= dy
        s.frame_set(1)
    post = (lambda im, l=look: hud(im, l))
    return dict(pills=[("Lap", "2/2", False)], right_pills=[("Time", "0:44.8", False)], post=post)


def hud(im, look):
    from PIL import ImageDraw
    k = im.size[1] / H
    d = ImageDraw.Draw(im, "RGBA")
    d.rounded_rectangle([12 * k, 690 * k, 100 * k, 742 * k], radius=12 * k, fill=(10, 12, 20, 220), outline=(70, 76, 96, 255), width=max(1, int(k)))
    d.text((56 * k, 710 * k), "254", font=font(800, int(24 * k)), fill=(245, 245, 247), anchor="mm")
    d.text((56 * k, 731 * k), "KM/H", font=font(600, int(8 * k)), fill=(170, 176, 196), anchor="mm")
    d.ellipse([130 * k, 680 * k, 260 * k, 760 * k], outline=(255, 255, 255, 70), width=max(1, int(1.5 * k)))
    d.ellipse([186 * k, 752 * k, 206 * k, 772 * k], fill=(214, 168, 74, 255))
    d.rounded_rectangle([290 * k, 690 * k, 378 * k, 742 * k], radius=12 * k, fill=(10, 12, 20, 220), outline=(70, 76, 96, 255), width=max(1, int(k)))
    cols = [(240, 200, 60), (240, 200, 60), (250, 150, 50), (250, 100, 40), (230, 60, 50), (80, 80, 90), (80, 80, 90), (80, 80, 90)]
    for i, c in enumerate(cols):
        d.rounded_rectangle([(300 + i * 9.5) * k, 702 * k, (306 + i * 9.5) * k, 730 * k], radius=2 * k, fill=c)
    if look == "B":
        im = vignette(0.5, 1.8)(im)
    return im


run("sports", "racing", ["A", "B", "C"], build)
