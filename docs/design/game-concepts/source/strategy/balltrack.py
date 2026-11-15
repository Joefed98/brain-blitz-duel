"""Ball Tracker (balltrack, btRev 8): turn gold tubes so 36 marbles reach the cup of their colour. Shown mid-round as
in today's frame: a 7 x 13 board of wooden tiles, U-turn loops down both edges, straight grooves, gold turnable tubes,
two booster chevrons, the waiting marbles along the top and four cups along the bottom.

A "Today, upgraded": the light maple board carved for real (routed channels, U-turns, seams), brass tubes with flutes and
a pivot pin, glass marbles, enamel cups.
B "Bolder": the same board in darker oiled walnut under a warm low light, polished brass, deeper channels."""
import os, sys, random
sys.path.insert(0, os.path.dirname(__file__))
from common import *

X0, Y0, T = 13, 127, 52  # board origin and tile size (screen px)
GRID = [
    "...c V-R",
    "LHH-VVR",
    "LHH--VR",
    "Lxx-V-R",
    "L---HVR",
    "LHH--VR",
    "LHH-H>R",
    "L<-<-VR",
    "L-H-HVR",
    "LVH-V-R",
    "LV---VR",
    "L-VVHVR",
    "L|||--|",
]
GRID[0] = "...cV-R"
MARBLES = [((211, 151), "B"), ((269, 309), "Y"), ((334, 518), "G"), ((276, 674), "G"), ((195, 812), "B")]
QUEUE = ["Y", "G", "Y", "G", "B", "G"]
CUPS = [(1, "Y", "diamond"), (2, "R", "circle"), (3, "B", "square"), (6, "G", "triangle")]
MC = {"Y": (246, 206, 40), "G": (52, 184, 96), "B": (54, 112, 226), "R": (226, 66, 70)}


def tc(r, c):
    return X0 + T * (c + 0.5), Y0 + T * (r + 0.5)


def add_box(bm, cx, cy, w, h, z0, z1):
    res = bmesh.ops.create_cube(bm, size=1.0)
    for v in res["verts"]:
        v.co.x = v.co.x * u(w) + u(cx)
        v.co.y = v.co.y * u(h) + u(H - cy)
        v.co.z = (v.co.z + 0.5) * (z1 - z0) + z0


def add_half_ring(bm, cx, cy, r0, r1, side, z0, z1, seg=24):
    """A half annulus in plan (opening towards the board's middle) as a prism."""
    a0 = math.pi / 2 if side == "L" else -math.pi / 2
    vs_top, vs_bot = [], []
    pts = []
    for k in range(seg + 1):
        a = a0 + k / seg * math.pi
        pts.append((math.cos(a), math.sin(a)))
    ring = [(cx + r1 * x, cy - r1 * y) for x, y in pts] + [(cx + r0 * x, cy - r0 * y) for x, y in reversed(pts)]
    top = [bm.verts.new((u(x), u(H - y), z1)) for x, y in ring]
    bot = [bm.verts.new((u(x), u(H - y), z0)) for x, y in ring]
    n = len(ring)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    # caps as quads between the two arcs
    m = seg + 1
    for i in range(seg):
        bm.faces.new((top[i], top[i + 1], top[n - 2 - i], top[n - 1 - i]))
        bm.faces.new((bot[n - 1 - i], bot[n - 2 - i], bot[i + 1], bot[i]))


def side_area(poly):
    a = 0
    for i in range(len(poly)):
        x0, y0 = poly[i]
        x1, y1 = poly[(i + 1) % len(poly)]
        a += x0 * y1 - x1 * y0
    return a


def build(look):
    reset(samples=128, view="AgX", look="AgX - Medium High Contrast" if look == "A" else "AgX - Punchy",
          exposure=-0.4 if look == "A" else -0.15)
    s = bpy.context.scene
    s.cycles.max_bounces = 10
    world_color((60, 50, 40), 0.3 if look == "A" else 0.08)
    if look == "A":
        board_m = wood("maple", (200, 152, 96), (158, 112, 64), scale=1.5, coat=0.3, rough=0.45, stretch=14,
                       coat_rough=0.25)
        floor_m = wood("maple-dk", (132, 88, 48), (96, 62, 32), scale=1.5, coat=0.1, rough=0.6, stretch=14)
        brass = gold("bt-brass", (222, 164, 58), 0.3)
    else:
        board_m = wood("walnut-bt", (124, 78, 44), (70, 40, 20), scale=1.5, coat=0.5, rough=0.35, stretch=14,
                       coat_rough=0.15)
        floor_m = wood("walnut-bt-dk", (64, 38, 20), (34, 18, 8), scale=1.5, coat=0.1, rough=0.6, stretch=14)
        brass = gold("bt-brass-b", (236, 190, 92), 0.12)
    depth = u(4.2)
    floor = plate("floor", u(392), u(790), u(0.5), 0, mat_=floor_m, loc=P(195, 452, -depth - u(0.5)))
    rbox("under", u(392), u(790), u(4), mat_=floor_m, loc=P(195, 452, -depth - u(2.6)))
    ch, g = 20, 0.7  # channel width, half seam
    pieces = []

    def rect(x0, y0, x1, y1):
        pieces.append([(x0, y0), (x1, y0), (x1, y1), (x0, y1)])

    top_h = u(0)
    for r, row in enumerate(GRID):
        for c, k in enumerate(row):
            if k in "LR":
                continue
            x0, y0 = X0 + T * c + g, Y0 + T * r + g
            x1, y1 = X0 + T * (c + 1) - g, Y0 + T * (r + 1) - g
            xm, ym = (x0 + x1) / 2, (y0 + y1) / 2
            if k in "-H<>x":
                rect(x0, y0, x1, ym - ch / 2)
                rect(x0, ym + ch / 2, x1, y1)
            elif k in "V|c":
                rect(x0, y0, xm - ch / 2, y1)
                rect(xm + ch / 2, y0, x1, y1)
            else:
                rect(x0, y0, x1, y1)
    r0, r1 = T / 2 - ch / 2, T / 2 + ch / 2
    for side, rows in (("L", range(1, 13, 2)), ("R", range(0, 12, 2))):
        for r in rows:
            if side == "L":
                bx0, bx1, cx, sgn = X0 + g, X0 + T + 0.01, X0 + T, -1
            else:
                bx0, bx1, cx, sgn = X0 + 6 * T - 0.01, X0 + 7 * T - g, X0 + 6 * T, 1
            ty, by = Y0 + T * r + g, Y0 + T * (r + 2) - g
            cy = Y0 + T * (r + 1)
            arc = lambda rad: [(cx + sgn * rad * math.sin(k / 24 * math.pi), cy - rad * math.cos(k / 24 * math.pi))
                               for k in range(25)]
            pieces.append(arc(r0))  # inner half disc (closed along x = cx)
            outer = [(cx, ty)] + arc(r1) + [(cx, by), (bx0 if side == "L" else bx1, by), (bx0 if side == "L" else bx1, ty)]
            pieces.append(outer)
    bm = bmesh.new()
    for poly in pieces:
        if side_area(poly) > 0:
            poly = list(reversed(poly))
        top = [bm.verts.new((u(x), u(H - y), 0)) for x, y in poly]
        bot = [bm.verts.new((u(x), u(H - y), -depth - u(0.4))) for x, y in poly]
        bm.faces.new(top)
        bm.faces.new(list(reversed(bot)))
        n = len(poly)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((bot[i], bot[j], top[j], top[i]))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    me = bpy.data.meshes.new("lands")
    bm.to_mesh(me)
    bm.free()
    lands = link(bpy.data.objects.new("lands", me))
    lands.data.materials.append(board_m)
    bv = lands.modifiers.new("b", "BEVEL")
    bv.width = u(0.8)
    bv.segments = 2
    bv.limit_method = "ANGLE"
    bv.angle_limit = math.radians(60)
    # the frame strip at the top (behind the HUD and queue)
    rbox("topband", u(392), u(68), u(4.4), mat_=board_m, loc=P(195, 92, -u(2.2)))
    # fine routed lines in each channel floor (today's triple grooves)
    line_m = mat("groove-line", (40, 26, 14) if look == "B" else (120, 82, 44), rough=0.7)
    for r, row in enumerate(GRID):
        for c, k in enumerate(row):
            x, y = tc(r, c)
            if k in "-H<>":
                for dy in (-5, 5):
                    rbox("gl", u(T), u(0.9), u(0.3), mat_=line_m, loc=P(x, y + dy, -depth))
            elif k in "V|":
                for dx in (-5, 5):
                    rbox("gl", u(0.9), u(T), u(0.3), mat_=line_m, loc=P(x + dx, y, -depth))
    # gold tubes: fluted brass blocks with a pivot pin
    for r, row in enumerate(GRID):
        for c, k in enumerate(row):
            x, y = tc(r, c)
            if k in "HV":
                w, h = (T - 6, 30) if k == "H" else (30, T - 6)
                rbox("tube", u(w), u(h), u(6), r=u(2.4), mat_=brass, loc=P(x, y, u(1.8)))
                for d in (-9, -4.5, 4.5, 9):
                    if k == "H":
                        rbox("flute", u(w - 4), u(1.1), u(0.6), r=u(0.3), mat_=brass, loc=P(x, y + d, u(5)))
                    else:
                        rbox("flute", u(1.1), u(h - 4), u(0.6), r=u(0.3), mat_=brass, loc=P(x + d, y, u(5)))
                cyl("pin", u(2.4), u(1.2), mat("pin", (120, 84, 34), rough=0.3, metal=1), loc=P(x, y, u(5.4)))
            if k == "x":
                d = rbox("diam", u(9), u(9), u(1), r=u(0.4), mat_=brass, loc=P(x, y, u(2)),
                         rot=(0, 0, math.radians(45)))
            if k in "<>":
                sgn = 1 if k == "<" else -1
                om = mat("chev", (238, 112, 50), rough=0.4, emit=(238, 112, 50), emit_str=0.6)
                for j in (-5, 3):
                    for sy in (-1, 1):
                        bar = rbox("chev", u(8), u(2.4), u(1.2), r=u(0.6), mat_=om,
                                   loc=P(x + sgn * j, y + sy * 2.6, -depth + u(0.6)),
                                   rot=(0, 0, math.radians(sgn * sy * -40)))
    # top strip: the waiting marbles; bottom: the cups
    for i, k in enumerate(QUEUE):
        marble(f"q{i}", 24 + i * 34, 106, 10, MC[k], z=u(0.2))
    torus("qsel", u(13), u(1.3), brass, loc=P(194, 106, u(1.4)))
    for (c, k, sym) in CUPS:
        x = X0 + T * (c + 0.5)
        col = MC[k]
        en = mat(f"cup-{k}", col, rough=0.2, coat=0.8)
        plate("cupf", u(46), u(22), u(1.6), u(4), mat_=en, loc=P(x, 816, -depth), edge=u(0.4))
        plate("cupin", u(40), u(16), u(1.8), u(3), mat_=mat("cupin", (40, 28, 18), rough=0.6), loc=P(x, 816, -depth + u(0.1)))
        if sym == "diamond":
            rbox("sym", u(5), u(5), u(0.8), mat_=en, loc=P(x, 816, -depth + u(2)), rot=(0, 0, math.radians(45)))
        elif sym == "circle":
            torus("sym", u(3.6), u(0.9), en, loc=P(x, 816, -depth + u(2.2)))
        elif sym == "triangle":
            cyl("sym", u(4.4), u(0.8), en, loc=P(x, 817, -depth + u(2.2)), verts=3)
    for (x, y), k in MARBLES:
        marble(f"m{x}", x, y, 11, MC[k], z=-depth + u(0.5))
    if look == "A":
        area(P(-160, 120, 10), P(195, 450, 0), size=7, energy=1200, color=(255, 242, 224))
        area(P(560, 820, 8), P(195, 450, 0), size=8, energy=350, color=(206, 222, 255))
        cam_top(ortho=False, lens=200, tilt=2)
    else:
        area(P(-220, 200, 6), P(195, 420, 0), size=3, energy=1500, color=(255, 214, 168))
        area(P(560, 820, 8), P(195, 450, 0), size=8, energy=120, color=(170, 190, 255))
        area(P(195, 450, 16), P(195, 450, 0), size=14, energy=260, color=(255, 236, 210))
        cam = cam_top(ortho=False, lens=200, tilt=4)

    def post(im):
        im = pills_at(im, [("Home", "18/36", False), ("Gold", 3, False), ("Combo", "×18", True)], 79)
        im = pills_at(im, [("Switch up", "13 s", False)], 79, right=True)
        if look == "B":
            im = vignette(0.5)(im)
        return im
    return dict(post=post)


run("strategy", "balltrack", ["A", "B"], build)
