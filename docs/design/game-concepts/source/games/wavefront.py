"""Wavefront: a gallery shooter. A formation of gunmetal ships with magenta neon edges and orange furnace seams,
the gunship top right, the player's white fighter at the bottom, shots in flight, a ringed planet low left."""
import math, random
from lib import *


def enemy(name, c, kind, hull, neon, furnace, s=1.0):
    par = link(bpy.data.objects.new(name, None))
    par.location = c
    par.scale = (s, s, s)
    parts = []
    if kind == 0:   # Dart: an arrowhead
        outline = [(0, -0.12), (0.13, 0.06), (0.05, 0.03), (0, 0.09), (-0.05, 0.03), (-0.13, 0.06)]
    elif kind == 1:  # Raptor: swept wings
        outline = [(0, -0.1), (0.07, -0.02), (0.16, -0.06), (0.14, 0.08), (0.04, 0.05), (0, 0.1), (-0.04, 0.05), (-0.14, 0.08), (-0.16, -0.06), (-0.07, -0.02)]
    else:            # Bulwark: a heavy hexagon
        outline = [(-0.08, -0.1), (0.08, -0.1), (0.15, 0.0), (0.1, 0.09), (-0.1, 0.09), (-0.15, 0.0)]
    parts.append(prism(name + 'hull', outline, -0.03, 0.03, hull, 0.008))
    parts.append(prism(name + 'top', [(x * 0.55, y * 0.55) for x, y in outline], 0.03, 0.05, hull, 0.006))
    pts = [Vector((x, y, 0.035)) for x, y in outline]
    parts.append(tube(name + 'neon', pts + [pts[0]], 0.006, neon))
    parts.append(box(name + 'seam', (0, 0.0, 0.052), (0.06, 0.012, 0.01), furnace, 0.002))
    for sx in (-1, 1):
        parts.append(cyl(name + f'can{sx}', (sx * 0.07, -0.07, 0.0), 0.012, 0.06, hull, verts=12, rot=(math.pi / 2, 0, 0)))
        parts.append(cyl(name + f'ex{sx}', (sx * 0.04, 0.12, 0.0), 0.014, 0.05, emission('exhaust', (1.0, 0.5, 0.15), 6), verts=12, rot=(math.pi / 2, 0, 0), r2=0.0))
    for p in parts:
        p.parent = par
    return par


def build(look):
    rnd = random.Random(91)
    A = look == 'A'
    reset(world=(0.0, 0.0, 0.0))
    world_gradient((0.5, 0.45, 0.6), (0.0, 0.0, 0.0), 0.35, axis='Z')
    nebula_plane('neb', -14, [(0.12, 0.05, 0.3), (0.35, 0.08, 0.4)], strength=0.12 if A else 0.9, scale=0.11, seed=2.0)
    starfield(220, -12, 91)
    hull = mat('gunmetal', (0.25, 0.26, 0.3), metal=1.0, rough=0.38, bump=(60.0, 0.05, 2))
    neon = emission('neon', (1.0, 0.15, 0.75), 3.0 if A else 5.0)
    furnace = emission('furnace', (1.0, 0.45, 0.08), 6.0)
    # formation: three rows (Bulwark, Raptor, Dart from back to front), a few gaps from kills
    rows = [(150, 2, 5), (205, 1, 6), (258, 0, 7)]
    for r, (y, kind, n) in enumerate(rows):
        for i in range(n):
            if (r, i) in ((1, 2), (2, 5), (2, 0)):
                continue
            x = 195 + (i - (n - 1) / 2) * 44 - 20
            enemy(f'e{r}_{i}', P(x, y, 0.1), kind, hull, neon, furnace, s=1.0 if kind != 2 else 1.1)
    # the gunship top right, the saucer crossing above
    g = enemy('gunship', P(305, 110, 0.2), 2, hull, neon, furnace, s=2.0)
    sc = P(232, 82, 0.2)
    sphere('saucer', sc, 0.1, mat('sauc', (0.6, 0.62, 0.7), metal=1, rough=0.2), seg=48, ring=24, scale=(1, 0.35, 0.3))
    sphere('saucerdome', sc + Vector((0, 0.025, 0.02)), 0.04, emission('sdome', (1.0, 0.3, 0.8), 2), seg=24, ring=12)
    # the player's fighter
    pc = P(121, 762, 0.2)
    white = mat('white', (0.9, 0.92, 0.95), rough=0.25, coat=1.0)
    blue = mat('blue', (0.15, 0.5, 1.0), rough=0.1, coat=1.0, emit=(0.2, 0.55, 1.0), estr=1.5)
    prism('fbody', [(pc.x, pc.y + 0.17), (pc.x + 0.05, pc.y), (pc.x + 0.17, pc.y - 0.09), (pc.x + 0.05, pc.y - 0.07), (pc.x, pc.y - 0.1), (pc.x - 0.05, pc.y - 0.07), (pc.x - 0.17, pc.y - 0.09), (pc.x - 0.05, pc.y)], 0.16, 0.22, white, 0.01)
    sphere('cockpit', pc + Vector((0, 0.04, 0.03)), 0.03, blue, seg=24, ring=12, scale=(0.8, 1.6, 0.8))
    for sx in (-1, 1):
        prism(f'stripe{sx}', [(pc.x + sx * 0.06, pc.y - 0.02), (pc.x + sx * 0.15, pc.y - 0.08), (pc.x + sx * 0.12, pc.y - 0.08)], 0.221, 0.225, blue)
    cyl('flame', pc + Vector((0, -0.16, 0)), 0.03, 0.12, emission('pflame', (0.4, 0.75, 1.0), 6), verts=16, rot=(math.pi / 2, 0, 0), r2=0.0)
    point('plight', pc + Vector((0, -0.15, 0.2)), 4, (0.4, 0.75, 1.0), 0.05)
    # shots: green up from the player, red down from the formation
    shot_g = emission('shotg', (0.35, 1.0, 0.45), 6)
    shot_r = emission('shotr', (1.0, 0.25, 0.25), 6)
    for i, y in enumerate((690, 560, 430)):
        cyl(f'sg{i}', P(121, y, 0.15), 0.008, 0.12, shot_g, verts=8, rot=(math.pi / 2, 0, 0))
    for i, (x, y) in enumerate(((150, 380), (282, 470), (240, 690), (318, 620))):
        cyl(f'sr{i}', P(x, y, 0.15), 0.008, 0.09, shot_r, verts=8, rot=(math.pi / 2, 0, 0))
    # the shield line and ringed planet low left
    plane('shield', P(195, 640, -0.05), 3.9, 0.006, emission('shieldl', (0.4, 0.3, 0.8), 0.6))
    pz = -3.0
    k = depth_scale(pz)
    pl = P(46, 690)
    sphere('planet', (pl.x * k, pl.y * k, pz), 0.22, planet_mat('ringed', (0.12, 0.06, 0.25), (0.3, 0.15, 0.5), (0.6, 0.45, 0.8), scale=3.0), seg=64, ring=32).rotation_euler = (0.3, 0.6, 0.0)
    ring_flat('pring', (pl.x * k, pl.y * k, pz), 0.3, 0.42, mat('pringm', (0.5, 0.4, 0.7), rough=0.6)).rotation_euler = (1.2, 0.35, 0.3)
    if not A:
        # an explosion where a ship just fell, and engine haze
        boom = emission('boom', (1.0, 0.55, 0.15), 8)
        bc = P(238, 205, 0.2)
        sphere('boomcore', bc, 0.05, emission('boomc', (1.0, 0.85, 0.5), 15), seg=16, ring=8)
        for i in range(24):
            a = rnd.uniform(0, 2 * math.pi)
            d = rnd.uniform(0.05, 0.22)
            c = bc + Vector((math.cos(a) * d, math.sin(a) * d, 0))
            tube(f'deb{i}', [c, c + Vector((math.cos(a) * 0.035, math.sin(a) * 0.035, 0))], 0.005, boom)
        point('boomlight', bc + Vector((0, 0, 0.3)), 30, (1.0, 0.55, 0.2), 0.1)
    key_light(500, (0.95, 0.95, 1.0))
    area('rim', (6, 6, 4), 300, 4, (1.0, 0.4, 0.8))
    return dict(name='Wavefront', hud=[('left', 0, 'WAVE', '3 / 5'), ('right', 0, 'LIVES', '3')], bloom=0.6, view='Standard')
