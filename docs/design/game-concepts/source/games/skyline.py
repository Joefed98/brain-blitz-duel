"""High Rise (skyline): a glass tower of stacked floors over a night city. The crane girder runs across the top with
the next block hanging from its cable, the moon top right, the skyline and harbour water along the bottom."""
import math, random
from lib import *


def build(look):
    rnd = random.Random(41)
    A = look == 'A'
    reset(world=(0.01, 0.01, 0.03))
    world_gradient((0.006, 0.008, 0.03), (0.06, 0.03, 0.12) if A else (0.16, 0.04, 0.14), 1.0)
    floor_m = windows('floors', lit=(0.55, 0.8, 1.0), frame=(0.32, 0.38, 0.48), glass=(0.12, 0.25, 0.42), scale=(16.0, 9.5), estr=1.6, lit_share=0.8, mortar=0.18)
    gold_m = windows('goldfloors', lit=(1.0, 0.72, 0.3), frame=(0.4, 0.3, 0.15), glass=(0.35, 0.22, 0.08), scale=(16.0, 9.5), estr=1.8, lit_share=0.85, mortar=0.18)
    city_m = windows('city', lit=(1.0, 0.82, 0.5), frame=(0.015, 0.016, 0.03), glass=(0.02, 0.03, 0.06), scale=(18.0, 14.0), estr=1.5, lit_share=0.2, mortar=0.3)
    city_m2 = windows('city2', lit=(0.6, 0.75, 1.0), frame=(0.012, 0.012, 0.025), glass=(0.02, 0.03, 0.06), scale=(14.0, 11.0), estr=1.0, lit_share=0.15, mortar=0.35)
    slab = mat('slab', (0.7, 0.72, 0.76), metal=1.0, rough=0.3)
    base_m = mat('base', (0.9, 0.7, 0.3), metal=1.0, rough=0.3)
    yellow = mat('craneyellow', (0.95, 0.68, 0.08), metal=0.3, rough=0.35, coat=0.4)
    cable = mat('cable', (0.6, 0.62, 0.65), metal=1.0, rough=0.35)
    water = mat('harbour', (0.01, 0.012, 0.03), rough=0.05, coat=1.0, bump=(1.5, 0.35, 6))
    moonm = emission('moon', (1.0, 0.95, 0.85), 3.0)

    # stars and moon
    zs = -10.0
    k = depth_scale(zs)
    for i in range(140):
        sphere(f'st{i}', (rnd.uniform(-1.4, 1.4) * k, rnd.uniform(-1.5, 4) * k, zs), rnd.uniform(0.004, 0.009) * k,
               emission('star', (0.85, 0.88, 1.0), rnd.choice((1, 2, 4))), seg=6, ring=4)
    mk = depth_scale(-5)
    mc = P(318, 162)
    sphere('moon', (mc.x * mk, mc.y * mk, -5), 0.14 * mk, moonm, seg=48, ring=24)
    point('moonglow', (mc.x * mk, mc.y * mk, -4.0), 30, (0.9, 0.9, 1.0), 0.5)

    # far and near skyline with lit windows
    for layer, (z, m, hmin, hmax, n) in enumerate(((-6.0, city_m2, 60, 170, 22), (-2.5, city_m, 40, 140, 16))):
        kk = depth_scale(z)
        x = -40
        for i in range(n * 2):
            w = rnd.uniform(18, 40)
            h = rnd.uniform(hmin, hmax)
            if x > 430:
                break
            c = P(x + w / 2, 790 - h / 2)
            box(f'bld{layer}{i}', (c.x * kk, c.y * kk, z), (w / 100 * kk, h / 100 * kk, 0.4), m, 0.004)
            if rnd.random() < 0.3:
                cyl(f'ant{layer}{i}', (c.x * kk, (c.y + h / 200) * kk + 0.12, z), 0.006, 0.25, cable, verts=6)
                sphere(f'antl{layer}{i}', (c.x * kk, (c.y + h / 200) * kk + 0.25, z), 0.012, emission('red', (1.0, 0.1, 0.05), 8), seg=8, ring=6)
            x += w + rnd.uniform(-4, 6)
    # harbour water across the bottom (reflects the city)
    plane('water', (0, P(0, 815).y, 0.05), 6, 0.6, water)

    # the tower: 38 floors, slight offsets from imperfect drops, a gold plinth
    y = 735
    box('plinth', P(212, y + 6, 0.0), (0.74, 0.12, 0.5), base_m, 0.01)
    xs = 212
    for f in range(38):
        hgt = 10.2
        w = 62 - 48 * (f / 37) ** 0.8
        xs += rnd.uniform(-0.6, 0.6) if f > 3 else 0
        c = P(xs, y - hgt / 2, 0.0)
        gold = f < 3 or f in (9, 10, 17, 25, 31)
        box(f'fl{f}', c, (w / 100, (hgt - 1.6) / 100, 0.46), gold_m if gold else floor_m, 0.004)
        box(f'sl{f}', P(xs, y - 0.8, 0.0), ((w + 3) / 100, 0.016, 0.5), slab, 0.003)
        y -= hgt
    # crane: lattice girder across the top, trolley, cable and the next block
    gy = P(0, 92).y
    for yy in (gy + 0.05, gy - 0.05):
        box(f'chord{yy}', (0, yy, 0.6), (4.6, 0.025, 0.04), yellow, 0.006)
    xx = -2.3
    i = 0
    while xx < 2.3:
        tube(f'lat{i}', [(xx, gy - 0.05, 0.6), (xx + 0.1, gy + 0.05, 0.6)], 0.008, yellow)
        tube(f'lt{i}', [(xx + 0.1, gy + 0.05, 0.6), (xx + 0.2, gy - 0.05, 0.6)], 0.008, yellow)
        xx += 0.2
        i += 1
    tx = P(212, 0).x
    box('trolley', (tx, gy - 0.07, 0.65), (0.14, 0.06, 0.1), mat('dark', (0.06, 0.06, 0.07), metal=1, rough=0.4), 0.01)
    by = P(0, 300).y
    tube('cable', [(tx, gy - 0.1, 0.62), (tx - 0.3, by + 0.08, 0.55)], 0.004, cable)
    box('hook', (tx - 0.3, by + 0.07, 0.55), (0.04, 0.03, 0.03), yellow, 0.005)
    box('next', (tx - 0.31, by, 0.55), (0.15, 0.088, 0.46), floor_m, 0.004)
    box('nextslab', (tx - 0.31, by - 0.045, 0.55), (0.17, 0.016, 0.5), slab, 0.003)
    # a cone of work light under the trolley
    spot('craneLight', (tx, gy - 0.1, 0.9), 40 if A else 120, (tx - 0.1, by - 2, 0), angle=0.5, blend=0.6, color=(1.0, 0.92, 0.75))

    area('moonkey', (6, 8, 10), 500, 4, (0.75, 0.8, 1.0))
    area('cityfill', (0, -12, 6), 300 if A else 600, 8, (1.0, 0.6, 0.35) if A else (1.0, 0.4, 0.5))
    fog(0.008 if A else 0.03, (0.6, 0.6, 0.9) if A else (0.8, 0.6, 0.9), z0=-9, z1=1.0)
    if not A:
        for i, (x, ang) in enumerate(((-1.2, 0.35), (1.3, -0.3))):
            spot(f'search{i}', (x * depth_scale(-3), -4.0, -3.0), 30000, (x * 2 + ang * 6, 6, -6), angle=0.06, blend=0.3, color=(0.75, 0.85, 1.0), radius=0.02)
    return dict(name='High Rise', hud=[('left', 0, 'BLOCKS', '38'), ('right', 0, 'STREAK', '2')], bloom=0.55)
