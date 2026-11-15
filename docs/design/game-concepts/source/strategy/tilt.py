"""Tilt (tilt, tiltRev 12): spin a disc maze so each marble rolls into its own cup. Shown mid-maze 3: two marbles
(blue and amber), their cups, a key and its gate, a pit and an ice patch. Today: a walnut disc with a brass rim on a
plank table, gold-edged walls in a square maze turned inside the disc.

A "Today, upgraded": the same walnut, brass and planks as real lacquered wood and polished brass, glass marbles.
B "Bolder": an ebony table in a single pool of warm light, a dial-engraved brass bezel, deeper lacquer, depth of field."""
import os, sys, random
sys.path.insert(0, os.path.dirname(__file__))
from common import *

CX, CY, RIM, R_IN = 195, 446, 170, 156
N, CELL = 15, 19.6
ANG = math.radians(32)


def to_screen(gx, gy):
    """Maze grid coords (cells, centre 0,0) -> screen px."""
    x, y = gx * CELL, gy * CELL
    c, s = math.cos(ANG), math.sin(ANG)
    return CX + x * c - y * s, CY + x * s + y * c


def maze():
    rnd = random.Random(7)
    half = (N - 1) / 2
    active = {(i, j) for i in range(N) for j in range(N)
              if math.hypot(i - half, j - half) * CELL < R_IN - CELL * 0.62}
    seen, stack, open_ = {(7, 7)}, [(7, 7)], set()
    while stack:
        i, j = stack[-1]
        nb = [(i + di, j + dj) for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)) if (i + di, j + dj) in active
              and (i + di, j + dj) not in seen]
        if not nb:
            stack.pop()
            continue
        n = rnd.choice(nb)
        open_.add(frozenset(((i, j), n)))
        seen.add(n)
        stack.append(n)
    # a few loops so the maze reads like today's (not a perfect tree)
    for _ in range(14):
        i, j = rnd.choice(sorted(active))
        n = (i + rnd.choice((0, 1)), j)
        if n in active and n != (i, j):
            open_.add(frozenset(((i, j), n)))
    walls = []
    for (i, j) in active:
        for (di, dj) in ((1, 0), (0, 1), (-1, 0), (0, -1)):
            n = (i + di, j + dj)
            if n in active and frozenset(((i, j), n)) in open_:
                continue
            if n in active and (di < 0 or dj < 0):
                continue  # shared wall drawn once
            gx, gy = i - half + di * 0.5, j - half + dj * 0.5
            walls.append((gx, gy, dj != 0))  # horizontal wall when stepping in y
    return walls, active, half


def wall_mesh(name, walls, width, height, z, m):
    bm = bmesh.new()
    for (gx, gy, horiz) in walls:
        x, y = to_screen(gx, gy)
        L = u(CELL + width)
        ww, hh = (L, u(width)) if horiz else (u(width), L)
        res = bmesh.ops.create_cube(bm, size=1.0)
        for v in res["verts"]:
            v.co.x *= ww
            v.co.y *= hh
            v.co.z *= u(height)
            # rotate about z by -ANG (screen y is flipped in Blender)
            c, s = math.cos(-ANG), math.sin(-ANG)
            vx, vy = v.co.x, v.co.y
            v.co.x, v.co.y = vx * c - vy * s, vx * s + vy * c
            v.co += P(x, y, z + u(height) / 2)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = link(bpy.data.objects.new(name, me))
    o.data.materials.append(m)
    bv = o.modifiers.new("b", "BEVEL")
    bv.width = u(0.6)
    bv.segments = 2
    return o


def key_obj(x, y, m, rot=20):
    parts = [torus("kring", u(4.2), u(1.4), m, loc=P(x - 6, y, u(2)))]
    parts.append(rbox("kshaft", u(13), u(2.2), u(2.2), r=u(0.6), mat_=m, loc=P(x + 4, y, u(2))))
    parts.append(rbox("kbit", u(2.2), u(4.5), u(2), r=u(0.4), mat_=m, loc=P(x + 8, y + 2.5, u(2))))
    parts.append(rbox("kbit2", u(2.2), u(3.2), u(2), r=u(0.4), mat_=m, loc=P(x + 4.5, y + 2, u(2))))
    return parts


def build(look):
    reset(samples=128, view="AgX", look="AgX - Punchy", exposure=-0.1 if look == "A" else -0.25)
    s = bpy.context.scene
    s.cycles.max_bounces = 10
    world_color((40, 30, 24), 0.4 if look == "A" else 0.08)
    # table planks
    if look == "A":
        for i, y0 in enumerate(range(-40, 900, 96)):
            shade = 1 + (i % 3 - 1) * 0.07
            wm = wood(f"plank{i}", (int(96 * shade), int(60 * shade), int(36 * shade)),
                      (int(44 * shade), int(26 * shade), int(15 * shade)), scale=1.2 + i * 0.05, coat=0.2,
                      rough=0.55, rot=math.radians(90), stretch=10, coat_rough=0.3)
            rbox("plank", u(420), u(94), u(4), r=u(1.2), mat_=wm, loc=P(195, y0 + 48, -u(4)))
    else:
        for i, y0 in enumerate(range(-40, 900, 96)):
            wm = wood(f"eplank{i}", (34, 21, 14), (10, 6, 4), scale=1.4 + i * 0.05, coat=0.15, rough=0.5,
                      rot=math.radians(90), stretch=10, coat_rough=0.25)
            rbox("plank", u(420), u(94), u(4), r=u(1.2), mat_=wm, loc=P(195, y0 + 48, -u(4)))
    # the disc
    walnut = wood("walnut", (118, 74, 42) if look == "A" else (92, 44, 22), (58, 34, 18) if look == "A" else (30, 12, 6),
                  scale=1.0, coat=0.5, rough=0.35, stretch=14, rot=0.3,
                  coat_rough=0.12 if look == "A" else 0.2)
    brass = gold("brass", (214, 168, 84), 0.2)
    cyl("disc", u(RIM - 6), u(10), walnut, loc=P(CX, CY, u(1)), verts=128, bevel=u(2))
    torus("rim", u(RIM - 4), u(5), brass, loc=P(CX, CY, u(6)), seg=128)
    torus("rim-in", u(R_IN + 3), u(1.6), brass, loc=P(CX, CY, u(6.2)), seg=128)
    if look == "B":
        for t in range(120):
            a = t / 120 * 2 * math.pi
            L = 5 if t % 10 == 0 else 2.5
            rr = RIM - 4
            x, y = CX + rr * math.cos(a), CY + rr * math.sin(a)
            o = rbox("tick", u(L), u(0.7), u(0.6), mat_=mat("engrave", (60, 40, 14), rough=0.5),
                     loc=P(x, y, u(10.6)), rot=(0, 0, -a))
    walls, active, half = maze()
    wall_mesh("walls", walls, 4.6, 6, u(6), walnut)
    wall_mesh("cap", walls, 1.6, 0.6, u(12), brass)
    # pieces (grid coords)
    def at(i, j):
        return to_screen(i - half, j - half)
    blue_c, amber_c = (52, 120, 236), (240, 160, 40)
    x, y = at(2, 4)
    torus("cupb", u(9.5), u(1.8), brass, loc=P(x, y, u(6.4)))
    cyl("cupb-in", u(8.5), u(1), mat("enamel-b", blue_c, rough=0.15, coat=1), loc=P(x, y, u(6.1)))
    x, y = at(12, 10)
    torus("cupa", u(9.5), u(1.8), brass, loc=P(x, y, u(6.4)))
    cyl("cupa-in", u(8.5), u(1), mat("enamel-a", amber_c, rough=0.15, coat=1), loc=P(x, y, u(6.1)))
    x, y = at(7, 7)
    marble("mb", x, y, 8, blue_c, z=u(6))
    x, y = at(4, 11)
    marble("ma", x, y, 8, amber_c, z=u(6))
    x, y = at(9, 3)
    key_obj(x, y, brass)
    x, y = at(10, 5.5)
    gx, gy = 10 - half, 5.5 - half
    wall_mesh("gate", [(gx, gy, True)], 3.2, 7, u(6), mat("gate", (222, 182, 96), rough=0.15, metal=1, coat=0.4))
    x, y = at(5, 2)
    cyl("pit", u(8), u(2), mat("pit", (4, 3, 2), rough=0.9), loc=P(x, y, u(6.2)))
    torus("pit-lip", u(8.6), u(1.2), mat("pitlip", (40, 22, 12), rough=0.4), loc=P(x, y, u(6.6)))
    for (i, j) in ((9, 9), (10, 9), (9, 10)):
        x, y = at(i, j)
        rbox("ice", u(CELL - 4), u(CELL - 4), u(1), r=u(2), mat_=mat("ice", (210, 236, 255), rough=0.35, trans=0.7,
             ior=1.31, emit=(200, 228, 255), emit_str=0.25), loc=P(x, y, u(6.6)), rot=(0, 0, -ANG))
    if look == "A":
        area(P(-420, 60, 7), P(CX, CY, 0), size=7, energy=2600, color=(255, 236, 214))
        area(P(700, 900, 6), P(CX, CY, 0), size=8, energy=500, color=(200, 214, 255))
        cam_top(ortho=False, lens=200, tilt=3)
    else:
        area(P(-300, 140, 8), P(CX, CY, 0), size=2.2, energy=280, color=(255, 226, 190), spread=30)
        area(P(450, 800, 6), P(CX, CY, 0), size=6, energy=40, color=(160, 180, 255))
        cam = cam_top(ortho=False, lens=150, tilt=8)
        dof(cam, (cam.location - P(CX, CY)).length, fstop=1.4)

    def post(im):
        im = pills_at(im, [("Maze", "3/4", False), ("Par", "18 s", False), ("Clean", "", True)], 104)
        if look == "B":
            im = vignette(0.6)(im)
        return im
    return dict(post=post)


run("strategy", "tilt", ["A", "B"], build)
