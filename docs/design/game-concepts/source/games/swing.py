"""Grappler (swing): a jungle canopy. Three vines hang from the leaves with glowing grab rings; the hero hangs from
the middle one over a teal river. Layered trunks behind, lighter with distance."""
import math, random
from lib import *


def build(look):
    rnd = random.Random(11)
    A = look == 'A'
    reset(world=(0.01, 0.03, 0.02))
    world_gradient((0.05, 0.16, 0.1), (0.005, 0.02, 0.015), 1.0)
    bark = random_tint('bark', (0.03, 0.06, 0.035), (0.07, 0.1, 0.05), rough=0.85, bump=(14.0, 0.9, 10))
    leafm = random_tint('leaf', (0.04, 0.2, 0.05), (0.18, 0.42, 0.08), rough=0.45, coat=0.25)
    vinem = mat('vine', (0.12, 0.3, 0.06), rough=0.55, bump=(60.0, 0.4, 4))
    ring = mat('ring', (0.85, 0.9, 0.3), metal=1.0, rough=0.18, emit=(0.7, 1.0, 0.2), estr=0.8)
    halo = emission('halo', (0.55, 1.0, 0.15), 1.6)
    water = mat('water', (0.01, 0.16, 0.19), rough=0.03, ior=1.33, coat=1.0, bump=(2.2, 0.5, 6), color_noise=(1.2, (0.0, 0.07, 0.1), 0.7))
    foam = mat('foam', (0.6, 0.85, 0.82), rough=0.4)
    body, acc, vis = mat('suit', (0.03, 0.035, 0.04), rough=0.35, coat=0.6), mat('gold', (1.0, 0.72, 0.32), metal=1, rough=0.22), emission('visor', (1.0, 0.7, 0.3), 6)
    rope = mat('rope', (0.62, 0.5, 0.3), rough=0.8, bump=(120.0, 0.5, 2))

    # trunks in three depth layers (far = paler, bluer)
    for layer, (z, n, col, rr) in enumerate(((-7.0, 9, (0.05, 0.14, 0.11), (0.18, 0.3)), (-3.5, 6, (0.04, 0.09, 0.06), (0.16, 0.24)), (-1.2, 4, None, (0.15, 0.2)))):
        k = depth_scale(z)
        m = mat(f'trunk{layer}', col, rough=0.9, bump=(10.0, 0.7, 8)) if col else bark
        xs = [(-1.75 + 3.5 * i / (n - 1)) * k + rnd.uniform(-0.15, 0.15) for i in range(n)]
        for i, x in enumerate(xs):
            r = rnd.uniform(*rr) * k
            cyl(f'tr{layer}{i}', (x, 0, z), r, 11 * k, m, verts=24, rot=(math.pi / 2, 0, 0), r2=r * 0.9)
            for j in range(5):  # buttress roots and knots
                y = rnd.uniform(-4, 4) * k
                sphere(f'knot{layer}{i}{j}', (x + rnd.uniform(-0.6, 0.6) * r, y, z + r * 0.7), r * rnd.uniform(0.18, 0.3), m, seg=12, ring=8, scale=(1, 1.8, 0.6))
            # hanging lianas on near layers
            if layer == 1 and i % 2 == 0:
                x0 = x + r * 1.2
                pts = [(x0, 4.3 * k, z + 0.2), (x0 + 0.08, 2.0 * k, z + 0.25), (x0 - 0.05, 0.0, z + 0.2), (x0 + 0.1, -1.6 * k, z + 0.25)]
                smooth_curve(f'lia{layer}{i}', pts, 0.015 * k, vinem)

    # canopy: leaves bunched across the top, a lower dark band of leaves mid-distance
    def canopy(y0, y1, z0, z1, n, scale):
        for i in range(n):
            x = rnd.uniform(-2.2, 2.2)
            y = rnd.uniform(y0, y1)
            z = rnd.uniform(z0, z1)
            k = depth_scale(z)
            L = rnd.uniform(0.2, 0.36) * scale * k
            leaf(f'lf{i}_{y0}', (x * k, y * k, z), L, L * 0.42, leafm,
                 rot=(rnd.uniform(-0.6, 0.6), rnd.uniform(-0.5, 0.5), rnd.uniform(0, 2 * math.pi)), fold=0.3, curl=rnd.uniform(-0.04, 0.02))
    canopy(3.5, 4.4, -0.3, 0.6, 420, 1.0)
    canopy(1.0, 1.6, -4.0, -2.0, 240, 1.4)
    canopy(-0.1, 0.4, -7.5, -6.0, 160, 1.8)

    # three vines from the canopy to their grab rings (phone px from the live frame)
    vines = [(87, 422), (224, 422), (361, 430)]
    for i, (x, y) in enumerate(vines):
        top = P(x + rnd.uniform(-6, 6), 70, 0.15)
        bot = P(x, y - 16, 0.15)
        mid = (top + bot) / 2 + Vector((0.03 * (1 if i % 2 else -1), 0, 0))
        smooth_curve(f'vine{i}', [top, mid, bot], 0.022, vinem)
        for j in range(7):  # little leaves along the vine
            t = 0.1 + j * 0.12
            p = top.lerp(bot, t)
            leaf(f'vl{i}{j}', p + Vector((0, 0, 0.02)), 0.11, 0.05, leafm, rot=(0, 0, (1 if j % 2 else -1) * 0.8 - math.pi / 2), fold=0.3)
        c = P(x, y, 0.2)
        torus(f'ring{i}', c, 0.1, 0.024, ring)
        sphere(f'core{i}', c, 0.05, emission('core', (0.85, 1.0, 0.35), 3.0 if i == 1 else 1.2))
        ring_flat(f'halo{i}', c - Vector((0, 0, 0.05)), 0.13, 0.15 if A else 0.17, halo)
        point(f'rl{i}', c + Vector((0, 0, 0.4)), 25 if A else 45, (0.8, 1.0, 0.4), 0.1)
    # the hero hanging from the middle ring
    hx, hy = 216, 560
    tube('rope', [P(224, 422, 0.22), P(219, 495, 0.22), P(hx + 2, hy - 30, 0.22)], 0.008, rope)
    hero('hero', P(hx, hy, 0.25), 1.6, body, acc, vis, pose='hang', rot=0.06)
    point('herokey', P(hx - 30, hy - 40, 0.8), 10, (1, 0.95, 0.85), 0.2)

    # the river: water surface with a gentle wave line, foam along the bank
    wy = 748
    pts = [(x, wy + 6 * math.sin(x * 0.045) + 3 * math.sin(x * 0.11)) for x in range(-20, 421, 10)]
    poly = [(x / 100 - 1.95, 4.22 - y / 100) for x, y in pts] + [(2.3, -4.6), (-2.3, -4.6)]
    prism('water', poly, -0.6, 0.0, water, bevel=0.02)
    tube('foam', [P(x, y - 1, 0.02) for x, y in pts], 0.012, foam)

    # light: a soft green-gold sky above, a sun shaft for B, fireflies
    area('sky', (0, 3, 12), 1400, 6, (0.85, 1.0, 0.75), target=(0, 0, 0))
    key_light(900, (1.0, 0.95, 0.8))
    if A:
        fog(0.035, (0.7, 0.95, 0.8), z0=-9, z1=0.0)
    else:
        fog(0.06, (0.75, 1.0, 0.8), z0=-9, z1=0.0, anis=0.6)
        for i, x in enumerate((-1.2, 0.4, 1.4)):
            spot(f'shaft{i}', (x - 1.4, 3.3, -1.6), 4000, (x + 0.8, -3.5, -6.0), angle=0.22, blend=0.4, color=(1.0, 0.92, 0.6), radius=0.05)
        for i in range(26):
            sphere(f'ff{i}', P(rnd.uniform(10, 380), rnd.uniform(160, 720), rnd.uniform(-2, 0.4)), 0.009, emission('ff', (0.75, 1.0, 0.25), 4), seg=8, ring=6)
    return dict(name='Grappler', hud=[('left', 0, 'STRETCH', '23 / 51'), ('right', 0, 'STREAK', '×52'),
                                      ('left', 1, 'PAR', '2.0 / 4.4 s'), ('right', 1, 'GATES', '3 / 5')], bloom=0.5)
