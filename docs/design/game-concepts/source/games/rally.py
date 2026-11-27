"""Rally: solo pong on a tall teal court. Two pink pads at the top, a purple bumper target mid-court, gold balls in
play (one about to be returned), the small paddle at the bottom right."""
import math, random
from lib import *


def build(look):
    rnd = random.Random(81)
    A = look == 'A'
    reset(world=(0.0, 0.0, 0.0))
    world_gradient((0.3, 0.35, 0.4), (0.0, 0.0, 0.0), 0.3, axis='Z')
    grid_floor('surround', -0.4, base=(0.002, 0.004, 0.006), line=(0.1, 0.5, 0.5), strength=0.03)
    # court: x 20..381, y 117..758
    cx0, cx1, cy0, cy1 = 20, 381, 117, 758
    court = mat('court', (0.03, 0.2, 0.3) if A else (0.01, 0.07, 0.11), rough=0.35 if A else 0.12, coat=0.7, bump=(40.0, 0.05, 2), emit=(0.05, 0.3, 0.45), estr=0.18 if A else 0.06)
    box('court', P((cx0 + cx1) / 2, (cy0 + cy1) / 2, -0.06), ((cx1 - cx0) / 100, (cy1 - cy0) / 100, 0.1), court, 0.01)
    linem = emission('lines', (0.35, 0.95, 0.95), 0.6 if A else 1.0)
    faint = emission('faint', (0.25, 0.75, 0.8), 0.06 if A else 0.25)
    # court lines: border, centre line, centre circle, a fine grid
    for x in range(cx0 + 40, cx1, 40):
        plane(f'gx{x}', P(x, (cy0 + cy1) / 2, -0.005), 0.006, (cy1 - cy0) / 100, faint)
    for y in range(cy0 + 40, cy1, 40):
        plane(f'gy{y}', P((cx0 + cx1) / 2, y, -0.005), (cx1 - cx0) / 100, 0.006, faint)
    plane('mid', P((cx0 + cx1) / 2, 430, -0.003), (cx1 - cx0) / 100, 0.008, faint)
    ring_flat('circle', P(200, 430, -0.002), 0.3, 0.308, faint)
    edge = mat('edge', (0.1, 0.4, 0.45), metal=1.0, rough=0.25)
    led = emission('led', (0.3, 1.0, 1.0), 2.5 if A else 6.0)
    for (a, b) in (((cx0, cy0), (cx0, cy1)), ((cx1, cy0), (cx1, cy1)), ((cx0, cy0), (cx1, cy0))):
        pa, pb = P(*a, 0.02), P(*b, 0.02)
        tube(f'rail{a}{b}', [pa, pb], 0.03, edge)
        tube(f'led{a}{b}', [pa + Vector((0, 0, 0.03)), pb + Vector((0, 0, 0.03))], 0.006, led)
    for i, x in enumerate(range(cx0, cx1 + 1, 20)):  # small lamps along the side rails
        for xx in (cx0 - 8, cx1 + 8):
            pass
    lamps = [(1.0, 0.85, 0.3), (0.3, 1.0, 1.0)]
    for i, y in enumerate(range(cy0 + 20, cy1, 48)):
        for j, xx in enumerate((cx0 - 10, cx1 + 10)):
            sphere(f'lamp{i}{j}', P(xx, y, 0.02), 0.012, emission(f'lampm{(i + j) % 2}', lamps[(i + j) % 2], 4), seg=10, ring=6)
    # pink pads at the top
    pink = mat('pink', (1.0, 0.25, 0.65), rough=0.15, coat=1.0, emit=(1.0, 0.2, 0.6), estr=1.2 if A else 2.0)
    for x in (92, 262):
        box(f'pad{x}', P(x, 103, 0.04), (0.46, 0.07, 0.08), pink, 0.025, segs=4)
        box(f'padbase{x}', P(x, 110, 0.0), (0.52, 0.04, 0.05), mat('padbase', (0.2, 0.05, 0.12), metal=1, rough=0.3), 0.01)
        point(f'padl{x}', P(x, 115, 0.25), 3, (1.0, 0.3, 0.7), 0.05)
    # purple bumper target
    bc = P(234, 315, 0.0)
    cyl('bumper', bc + Vector((0, 0, 0.04)), 0.11, 0.08, mat('bump', (0.35, 0.15, 0.6), metal=1.0, rough=0.25), verts=48, bevel=0.01)
    torus('bumpring', bc + Vector((0, 0, 0.085)), 0.085, 0.012, emission('bumpl', (0.7, 0.45, 1.0), 3.0))
    sphere('bumpcap', bc + Vector((0, 0, 0.09)), 0.04, mat('bumpcap', (0.9, 0.85, 1.0), metal=1, rough=0.1), seg=24, ring=12)
    ring_flat('bumphalo', bc + Vector((0, 0, -0.002)), 0.13, 0.2, emission('bumph', (0.5, 0.3, 1.0), 0.6))
    # gold balls and the orange ball
    goldb = mat('goldball', (1.0, 0.75, 0.25), metal=1.0, rough=0.12, emit=(1.0, 0.65, 0.2), estr=0.4)
    orange = mat('orangeball', (1.0, 0.35, 0.08), rough=0.2, coat=1.0, emit=(1.0, 0.3, 0.05), estr=0.5)
    for i, (x, y, dx, dy) in enumerate(((135, 157, 1, 1), (200, 594, -1, -1), (354, 668, -0.4, 1))):
        c = P(x, y, 0.07)
        sphere(f'gb{i}', c, 0.055, goldb, seg=32, ring=16)
        point(f'gbl{i}', c + Vector((0, 0, 0.2)), 1.5, (1.0, 0.75, 0.35), 0.05)
        for t in range(6):
            sphere(f'gt{i}{t}', c - Vector((dx, -dy, 0)).normalized() * 0.06 * (t + 1) * (1 if A else 1.3), 0.04 * (1 - t / 7),
                   emission('gtrail', (1.0, 0.7, 0.25), 1.2 - t * 0.17), seg=12, ring=6)
    sphere('ob', P(139, 623, 0.06), 0.04, orange, seg=24, ring=12)
    # the paddle bottom right
    pc = P(352, 742, 0.05)
    box('paddle', pc, (0.42, 0.06, 0.08), mat('paddle', (0.3, 0.95, 1.0), rough=0.1, coat=1.0, emit=(0.3, 0.95, 1.0), estr=1.5), 0.025, segs=4)
    point('padglow', pc + Vector((0, 0.15, 0.25)), 4, (0.3, 1.0, 1.0), 0.05)
    key_light(250, (1.0, 0.97, 0.94))
    if not A:
        area('under', (0, 0, -0.35), 60, 3, (0.2, 0.9, 0.9), target=(0, 0, 3))
        fog(0.05, (0.5, 1.0, 1.0), z0=-0.1, z1=0.6)
    return dict(name='Rally', hud=[('left', 0, 'GOLD', '8'), ('right', 0, 'PADS', '1'), ('right', 1, 'TARGETS', '0 / 6')], bloom=0.6, view='Standard')
