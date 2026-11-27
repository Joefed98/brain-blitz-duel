"""Meteor: snake as a comet on a 19 x 34 field. The comet (white-gold head, pink beads fading) turns through the grid,
two gold stars ahead, rocks, two wormhole pairs, and the purple speed lanes crossing the field."""
import math, random
from lib import *

CELL = 390 / 19.0
TOP = 96


def cell(cx, cy):
    return (CELL * (cx + 0.5), TOP + CELL * (cy + 0.5))


def rock(name, c, r, m, rnd):
    o = sphere(name, c, r, m, seg=24, ring=16)
    md = o.modifiers.new('disp', 'DISPLACE')
    tex = bpy.data.textures.new(name + 't', 'VORONOI')
    tex.noise_scale = 0.4
    md.texture = tex
    md.strength = r * 0.35
    md.texture_coords = 'OBJECT'
    o.rotation_euler = (rnd.random() * 3, rnd.random() * 3, rnd.random() * 3)
    return o


def build(look):
    rnd = random.Random(121)
    A = look == 'A'
    reset(world=(0.0, 0.0, 0.0))
    world_gradient((0.4, 0.4, 0.5), (0.0, 0.0, 0.0), 0.3, axis='Z')
    starfield(140, -6, 121, size=(0.003, 0.006))
    if not A:
        nebula_plane('neb', -14, [(0.25, 0.05, 0.3), (0.45, 0.1, 0.35)], strength=0.4, scale=0.1, seed=5.0)
    # the board: dark field washed violet at the top and teal at the bottom (as today), faint grid, lit border
    if A:
        box('board', (0, 0, -0.34), (4.2, 9.0, 0.02), mat('board', (0.004, 0.003, 0.01), rough=0.5), 0)
        fade_glow('wtop', P(195, 260, -0.32), 3.9, 3.6, (0.35, 0.15, 0.6), 0.12, power=2.0).rotation_euler = (0, 0, math.pi)
        fade_glow('wbot', P(195, 640, -0.32), 3.9, 3.6, (0.05, 0.4, 0.35), 0.11, power=2.0)
    gridl = emission('gridl', (0.35, 0.25, 0.6), 0.12 if A else 0.2)
    y0, y1 = TOP, TOP + CELL * 34
    for i in range(20):
        plane(f'gv{i}', P(CELL * i, (y0 + y1) / 2, -0.29), 0.004, (y1 - y0) / 100, gridl)
    for j in range(35):
        plane(f'gh{j}', P(195, y0 + CELL * j, -0.29), 3.9, 0.004, gridl)
    border = emission('border', (0.6, 0.35, 1.0), 1.4)
    pts = [P(1, y0, -0.25), P(389, y0, -0.25), P(389, y1, -0.25), P(1, y1, -0.25), P(1, y0, -0.25)]
    tube('border', pts, 0.006, border)
    # speed lanes: one vertical column, one horizontal row, glowing violet glass strips with chevrons
    lane = mat('lane', (0.05, 0.02, 0.1), rough=0.1, coat=1.0, emit=(0.4, 0.2, 0.9), estr=0.06 if A else 0.12)
    lx, ly = 7, 13
    box('vlane', P(cell(lx, 0)[0], (y0 + y1) / 2, -0.27), (CELL / 100 * 0.9, (y1 - y0) / 100, 0.02), lane, 0.005)
    box('hlane', P(195, cell(0, ly)[1], -0.27), (3.9, CELL / 100 * 0.9, 0.02), lane, 0.005)
    chev = emission('chev', (0.75, 0.55, 1.0), 1.0)
    for j in range(0, 34, 3):
        x, y = cell(lx, j)
        prism(f'cv{j}', [(P(x - 5, y + 3).x, P(x - 5, y + 3).y), (P(x, y - 3).x, P(x, y - 3).y), (P(x + 5, y + 3).x, P(x + 5, y + 3).y), (P(x, y).x, P(x, y).y)], -0.255, -0.25, chev)
    # the comet: head moving up, body turning left then down
    path = [(5, 21), (5, 22), (5, 23), (5, 24), (5, 25), (4, 25), (3, 25), (2, 25), (1, 25), (1, 26), (1, 27), (1, 28), (1, 29), (1, 30), (1, 31), (1, 32)]
    head = mat('head', (1.0, 0.82, 0.4), metal=0.5, rough=0.1, emit=(1.0, 0.8, 0.4), estr=1.6)
    for i, (cx, cy) in enumerate(path):
        x, y = cell(cx, cy)
        t = i / (len(path) - 1)
        if i == 0:
            sphere('chead', P(x, y, 0.1), CELL / 100 * 0.48, head, seg=32, ring=16)
            point('cheadl', P(x, y - 10, 0.4), 12 if A else 25, (1.0, 0.8, 0.6), 0.05)
            continue
        col = (1.0, 0.45 - 0.2 * t, 0.75 - 0.15 * t)
        r = CELL / 100 * (0.42 - 0.22 * t)
        m = mat(f'seg{i}', col, rough=0.1, coat=1.0, emit=col, estr=(1.2 if A else 2.0) * (1 - 0.75 * t))
        sphere(f'cs{i}', P(x, y, 0.08), r, m, seg=24, ring=12)
    # wake streaks behind the head for B
    if not A:
        for i in range(8):
            x, y = cell(5, 21)
            tube(f'wk{i}', [P(x + rnd.uniform(-6, 6), y + 8, 0.05), P(x + rnd.uniform(-8, 8), y + 50 + rnd.uniform(0, 30), 0.05)], 0.003, emission('wake', (1.0, 0.7, 0.85), 2))
    # gold stars
    gold = mat('gold', (1.0, 0.76, 0.25), metal=1.0, rough=0.12, emit=(1.0, 0.7, 0.2), estr=0.6)
    for i, (cx, cy) in enumerate(((3, 17), (10, 16), (14, 6))):
        x, y = cell(cx, cy)
        star_shape(f'gs{i}', P(x, y, 0.08), 0.1, 0.045, 0.04, gold, points=4)
        point(f'gsl{i}', P(x, y, 0.35), 2, (1.0, 0.8, 0.4), 0.05)
    # rocks (one with its red landing shadow)
    rk = crackle('rockc', (0.12, 0.06, 0.03), (1.0, 0.4, 0.08), 2.5, scale=22.0, width=0.08, rough=0.8)
    for i, (cx, cy) in enumerate(((11, 4), (7, 12), (15, 22))):
        x, y = cell(cx, cy)
        rock(f'rk{i}', P(x, y, 0.06), CELL / 100 * 0.42, rk, rnd)
    x, y = cell(12, 27)
    ring_flat('shadow', P(x, y, -0.24), 0.06, 0.1, emission('shadowm', (1.0, 0.1, 0.1), 1.5))
    # wormholes: swirling portal discs in pairs
    for i, ((cx, cy), col) in enumerate((((13, 2), (0.3, 1.0, 0.6)), ((4, 9), (0.3, 1.0, 0.6)), ((16, 11), (1.0, 0.3, 0.45)), ((10, 30), (1.0, 0.3, 0.45)))):
        x, y = cell(cx, cy)
        c = P(x, y, -0.15)
        torus(f'wh{i}', c, CELL / 100 * 0.62, 0.008, emission(f'whr{i}', col, 2.5))
        for k in range(10):
            a = k / 10 * 2 * math.pi
            pts = [c + Vector((math.cos(a + s * 0.25) * CELL / 100 * (0.58 - s * 0.1), math.sin(a + s * 0.25) * CELL / 100 * (0.58 - s * 0.1), 0)) for s in range(5)]
            tube(f'whs{i}{k}', pts, 0.003, emission(f'whs{i}', col, 1.2))
        sphere(f'whc{i}', c, 0.02, emission('whcore', (0.0, 0.0, 0.0), 0), seg=8, ring=6)
    key_light(250, (1.0, 0.95, 1.0))
    return dict(name='Meteor', hud=[('left', 0, 'STARS', '17'), ('right', 0, 'COMBO', '×9'), ('right', 1, 'ROCKS', '2')], bloom=0.6, view='Standard')
