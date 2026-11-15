"""Hover: a saucer threads the gap in a scrolling barrier through deep space. The barrier stands left of centre with
its gap at the saucer, a gold star in the gap below it, the next barrier entering on the right."""
import math, random
from lib import *


def barrier(name, x, y0, y1, gap0, gap1, plate, edge, light, w=36):
    """A pillar of stacked amber plates with lit seams, broken by the gap."""
    for seg, (a, b) in enumerate(((y0, gap0), (gap1, y1))):
        if b - a < 2:
            continue
        box(f'{name}core{seg}', P(x, (a + b) / 2, -0.05), (w / 100 * 0.8, (b - a) / 100, 0.12), mat('core', (0.02, 0.02, 0.025), metal=1, rough=0.4), 0.0)
        y = a
        i = 0
        while y < b - 3:
            h = min(7.0, b - y)
            box(f'{name}pl{seg}_{i}', P(x, y + h / 2, 0.05), (w / 100, (h - 1.6) / 100, 0.1), plate, 0.004)
            y += h
            i += 1
        # the gap's end caps: bright lit lips
        cap_y = b if seg == 0 else a
        box(f'{name}cap{seg}', P(x, cap_y + (-2 if seg == 0 else 2), 0.08), ((w + 6) / 100, 0.05, 0.14), edge, 0.01)
        tube(f'{name}lip{seg}', [P(x - w / 2 - 3, cap_y + (-4.5 if seg == 0 else 4.5), 0.16), P(x + w / 2 + 3, cap_y + (-4.5 if seg == 0 else 4.5), 0.16)], 0.006, light)
    for sx in (-1, 1):
        tube(f'{name}rail{sx}a', [P(x + sx * (w / 2 + 1), y0, 0.12), P(x + sx * (w / 2 + 1), gap0 - 5, 0.12)], 0.006, edge)
        tube(f'{name}rail{sx}b', [P(x + sx * (w / 2 + 1), gap1 + 5, 0.12), P(x + sx * (w / 2 + 1), y1, 0.12)], 0.006, edge)


def build(look):
    rnd = random.Random(61)
    A = look == 'A'
    reset(world=(0.0, 0.0, 0.003))
    starfield(200, -12, 61)
    starfield(60, -5, 62, size=(0.003, 0.006))
    if not A:
        nebula_plane('neb', -14, [(0.05, 0.1, 0.35), (0.3, 0.12, 0.45)], strength=0.45, scale=0.1, seed=7.0)
        fog(0.015, (0.8, 0.8, 1.0), z0=-3, z1=0.6)
    plate = mat('plate', (0.95, 0.72, 0.28), rough=0.3, coat=0.8, emit=(1.0, 0.68, 0.25), estr=0.35 if A else 0.55, bump=(30.0, 0.1, 2))
    edge = mat('edge', (1.0, 0.82, 0.45), metal=1.0, rough=0.15, emit=(1.0, 0.75, 0.35), estr=0.4)
    light = emission('lip', (1.0, 0.8, 0.4), 4.0 if A else 7.0)
    barrier('b1', 128, 50, 860, 258, 362, plate, edge, light)
    barrier('b2', 392, 50, 860, 470, 574, plate, edge, light)
    # the saucer in the gap
    sc = P(128, 290, 0.35)
    body = mat('saucer', (0.95, 0.75, 0.32), metal=1.0, rough=0.2)
    dome = mat('dome', (0.1, 0.55, 0.9), rough=0.05, coat=1.0, emit=(0.2, 0.7, 1.0), estr=0.6)
    ringl = emission('ringl', (0.35, 0.95, 1.0), 2.0 if A else 3.5)
    sp = sphere('disc', sc, 0.2, body, seg=64, ring=32, scale=(1, 1, 0.22))
    sp.rotation_euler = (math.radians(28), 0, 0)
    d = sphere('dome', sc + Vector((0, 0.035, 0.03)), 0.09, dome, seg=48, ring=24, scale=(1, 0.8, 1))
    sphere('pilot', sc + Vector((0, 0.03, 0.03)), 0.035, mat('pilotm', (0.1, 0.12, 0.15), rough=0.4), seg=16, ring=8)
    t = torus('saucerring', sc + Vector((0, -0.005, 0)), 0.19, 0.012, ringl, rot=(math.radians(28), 0, 0))
    for i in range(8):
        a = i * 2 * math.pi / 8
        sphere(f'bulb{i}', sc + Vector((0.16 * math.cos(a), 0.075 * math.sin(a), 0.03)), 0.01, emission('bulb', (1.0, 0.8, 0.35), 4), seg=8, ring=6)
    point('underglow', sc + Vector((0, -0.25, 0.2)), 8 if A else 18, (0.35, 0.95, 1.0), 0.1)
    # thruster wake trailing left
    for i in range(6):
        sphere(f'wake{i}', sc + Vector((-0.24 - i * 0.04, -0.01 * i, -0.02)), 0.012 * (1 - i / 12), emission('wake', (0.35, 0.9, 1.0), 3 - i * 0.25), seg=8, ring=6)
    # the gold star in the gap below the saucer
    gs = star_shape('gstar', P(128, 340, 0.3), 0.07, 0.03, 0.03, mat('goldstar', (1.0, 0.75, 0.25), metal=1.0, rough=0.12, emit=(1.0, 0.7, 0.2), estr=0.6))
    point('starl', P(128, 340, 0.6), 3, (1.0, 0.8, 0.4), 0.05)
    key_light(900, (1.0, 0.95, 0.9))
    area('rim', (6, -4, 5), 300, 4, (0.4, 0.8, 1.0))
    return dict(name='Hover', hud=[('left', 0, 'BARRIERS', '17 / 42'), ('right', 0, 'STARS', '0 / 10'), ('right', 1, 'CHAINS', '2 / 5')], bloom=0.55, view='Standard')
