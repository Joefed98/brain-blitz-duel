"""Checkout (the Number overhaul; material pass 15 Nov 2026: concept A's lacquered walnut, sisal with fibre,
red and blue rings, a polished steel spider under the product light, 15 Nov 2026): a real bristle dartboard and a steel dart.

The board is drawn in the app's own 200-unit geometry (src/puzzles/checkout.tsx: C 100, doubles 70-78, trebles 43-50,
the x4 ring 21-26, bull 14 and 6.5, the wooden number ring to 100), top down, so every wedge and ring of the render sits
exactly on the app's hit wedges. Wedge numbers are never baked in: they change per board (shuffled, uneven, negative),
so the app draws them over the wooden ring in bold Archivo.

Sprites: board (standard rings), board-quad (with the x4 ring), dart.
Run:  /opt/blender/venv/bin/python docs/design/number-overhaul/source/checkout.py [board board-quad dart]
"""
import math
from sprites import *  # noqa: F401,F403

C = 100
R_NUM, R_DO, R_DI, R_TO, R_TI, R_QO, R_QI, R_BULL, R_IB = 100, 78, 70, 50, 43, 26, 21, 14, 6.5


def ang(w, off=0.0):
    return math.radians(-90 + w * 18 + off)


def pt(r, a):
    return (C + r * math.cos(a), C + r * math.sin(a))


def sector(r0, r1, w, m, depth=2.0, z=0.0, steps=10):
    a0, a1 = ang(w, -9), ang(w, 9)
    pts = [pt(r1, a0 + (a1 - a0) * k / steps) for k in range(steps + 1)]
    pts += [pt(r0, a1 - (a1 - a0) * k / steps) for k in range(steps + 1)]
    return slab(pts, depth, m, z=z, bevel=0.15)


def sisal(name, color):
    """Pressed sisal: the fibre ends as a fine, deep stipple, a soft sheen on top (concept A)."""
    m = mat(name, color, 0.86, sheen=0.12)
    add_bump(m, 240, 1.0, detail=10, distance=0.012)
    return m


def board(quad):
    """Concept A's board under a product light: lacquered walnut, sisal with visible fibre, red and blue rings, a bright
    steel spider that catches the key. Highlights sit on the wire and the wood's polished edge, never across a wedge."""
    setup(200, 200, scale=4.5, samples=48).view_settings.exposure = -0.75
    # The wooden surround: turned walnut under a deep lacquer, its grain running round the ring, a polished rolled edge.
    walnut = wood("walnut", "#6a3c1c", "#2c1608", rough=0.34, coat=0.55, scale=5, stretch=(1, 1, 1))
    # A satin lacquer: the key leaves a soft sheen along the rim, never a hard spot across the numbers.
    walnut.node_tree.nodes["Principled BSDF"].inputs["Coat Roughness"].default_value = 0.32
    cyl(C, C, R_NUM - 0.4, 6, walnut, z=-6.5, bevel=2.4, verts=200)
    # A dark iron band where the sisal meets the wood.
    cyl(C, C, R_DO + 1.2, 1.0, mat("band", "#202024", 0.3, metal=1.0), z=-1.2, bevel=0.3, verts=180)
    black = sisal("sisal_black", "#171615")
    cream = sisal("sisal_cream", "#d9ccae")
    red = sisal("sisal_red", "#b31b26")
    blue = sisal("sisal_blue", "#1f4fb8")
    brass = add_bump(mat("x4brass", "#c9a256", 0.3, metal=1.0), 300, 0.04)
    for w in range(20):
        even = w % 2 == 0
        single = black if even else cream
        ring = red if even else blue
        sector(R_DI, R_DO, w, ring)
        sector(R_TO, R_DI, w, single)
        sector(R_TI, R_TO, w, ring)
        if quad:
            sector(R_QO, R_TI, w, single)
            sector(R_QI, R_QO, w, brass)
            sector(R_BULL, R_QI, w, single)
        else:
            sector(R_BULL, R_TI, w, single)
    cyl(C, C, R_BULL, 2.0, sisal("sisal_green", "#1d7a36"), z=0, bevel=0.15, verts=96)
    cyl(C, C, R_IB, 2.1, red, z=0, bevel=0.15, verts=96)
    # The spider: polished round steel wire exactly on every edge, bright where the key catches it.
    wire = mat("wire", "#dfe3e8", 0.16, metal=1.0)
    radii = [R_DO, R_DI, R_TO, R_TI, R_BULL, R_IB] + ([R_QO, R_QI] if quad else [])
    for r in radii:
        torus(C, C, r, 0.5, wire, z=2.1)
    for w in range(20):
        a = ang(w, -9)
        x0, y0 = pt(R_BULL, a)
        x1, y1 = pt(R_DO, a)
        tube([(x0, y0, 2.1), (x1, y1, 2.1)], 0.5, wire, round_caps=False)
    write("checkout", "board-quad" if quad else "board", max_kb=180)


def dart():
    """A steel dart seen from the thrower's side: tip at the sprite's bottom-left (12, 108), flights up and right."""
    setup(64, 120, scale=4, samples=96)
    steel = mat("steel", "#dfe3e8", 0.14, metal=1.0)
    barrel = add_bump(mat("tungsten", "#6a7078", 0.24, metal=1.0), 120, 0.08, stretch=(1, 1, 8))
    shaft = mat("shaft", "#1c1d21", 0.2, coat=0.8)
    flight = mat("flight", "#c99a48", 0.32, metal=0.7, coat=0.4)
    # The dart runs from the tip (12, 108) up to the right at 55 degrees.
    a = math.radians(-55)
    def along(d):
        return (12 + d * math.cos(a) * 0.62, 108 + d * math.sin(a))
    tube([(*along(0), 6), (*along(16), 6)], 1.1, steel, round_caps=False)
    sphere(*along(0), 1.1, steel, z=6)
    tube([(*along(16), 6), (*along(46), 6)], 4.4, barrel, round_caps=True)
    tube([(*along(46), 6), (*along(70), 6)], 1.4, shaft, round_caps=False)
    fx, fy = along(70)
    gx, gy = along(98)
    slab([(fx, fy), (gx + 13, gy + 4), (gx + 2, gy - 3), (gx - 10, gy + 8)], 0.8, flight, z=5.6, bevel=0.2)
    write("checkout", "dart")


run({"board": lambda: board(False), "board-quad": lambda: board(True), "dart": dart})
