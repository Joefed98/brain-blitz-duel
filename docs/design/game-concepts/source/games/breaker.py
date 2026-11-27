"""Breaker: a 9 x 12 wall of coloured bricks (some broken mid-round), special and gold bricks, the ball heading up
and the gold paddle near the bottom, on today's dark blue playfield."""
import math, random
from lib import *

ROWS = [(1.0, 0.12, 0.2), (1.0, 0.45, 0.1), (1.0, 0.82, 0.12), (0.45, 0.95, 0.25), (0.1, 0.85, 0.95), (0.3, 0.55, 1.0),
        (0.6, 0.35, 1.0), (1.0, 0.12, 0.2), (1.0, 0.45, 0.1), (1.0, 0.82, 0.12), (0.45, 0.95, 0.25), (0.1, 0.85, 0.95)]


def build(look):
    rnd = random.Random(71)
    A = look == 'A'
    reset(world=(0.0, 0.0, 0.01))
    world_gradient((0.3, 0.32, 0.4), (0.0, 0.0, 0.0), 0.3, axis='Z')
    grid_floor('board', -0.3, base=(0.002, 0.003, 0.012), line=(0.15, 0.3, 0.9), strength=0.08 if A else 0.16, gloss=0.6 if A else 0.12)
    # the wall: phone px x 11..379, rows from y 125, 20 px pitch (the live layout)
    x0, x1, y0, pitch = 11, 379, 125, 21.0
    cw = (x1 - x0) / 9
    # which bricks remain (mid-round: lower rows mostly broken)
    gone = set()
    for r in range(12):
        for c in range(9):
            p = 0.0 if r < 6 else (0.25 if r < 8 else (0.55 if r < 10 else 0.8))
            if rnd.random() < p:
                gone.add((r, c))
    gold_cells = {(1, 1), (2, 4), (6, 8)}
    special = {(0, 0): 'ring', (0, 7): 'tri', (9, 1): 'dots', (10, 0): 'ring', (10, 8): 'tri'}
    gold = mat('goldbrick', (1.0, 0.76, 0.3), metal=1.0, rough=0.2, emit=(1.0, 0.7, 0.25), estr=0.35)
    dark = mat('special', (0.02, 0.025, 0.03), rough=0.1, coat=1.0)
    icon = emission('icon', (0.95, 0.95, 1.0), 2.5)
    mats = [glow_glass(f'row{r}', tuple(c * 0.7 for c in col), 0.5 if A else 0.9) for r, col in enumerate(ROWS)]
    for r in range(12):
        for c in range(9):
            if (r, c) in gone and (r, c) not in special:
                continue
            cx = x0 + cw * (c + 0.5)
            cy = y0 + pitch * (r + 0.5)
            m = gold if (r, c) in gold_cells else (dark if (r, c) in special else mats[r])
            box(f'b{r}_{c}', P(cx, cy, 0.0), ((cw - 3) / 100, (pitch - 3) / 100, 0.12), m, 0.018, segs=4)
            if (r, c) in special:
                kind = special[(r, c)]
                if kind == 'ring':
                    torus(f'ic{r}{c}', P(cx, cy, 0.07), 0.035, 0.007, icon)
                elif kind == 'tri':
                    prism(f'ic{r}{c}', [(P(cx - 8, cy + 5).x, P(cx - 8, cy + 5).y), (P(cx + 8, cy + 5).x, P(cx + 8, cy + 5).y), (P(cx, cy - 6).x, P(cx, cy - 6).y)], 0.06, 0.07, icon)
                else:
                    for dx in (-6, 6):
                        sphere(f'ic{r}{c}{dx}', P(cx + dx, cy, 0.07), 0.018, icon, seg=12, ring=8)
    # side walls: thin lit rails
    rail = mat('rail', (0.3, 0.45, 0.9), metal=1.0, rough=0.25, emit=(0.25, 0.45, 1.0), estr=0.5 if A else 1.2)
    for x in (3, 387):
        box(f'wall{x}', P(x, 460, 0.0), (0.04, 8.0, 0.1), rail, 0.01)
    box('ceiling', P(195, 64, 0.0), (3.9, 0.04, 0.1), rail, 0.01)
    # ball and paddle
    chrome = mat('chrome', (0.95, 0.96, 1.0), metal=1.0, rough=0.05)
    bc = P(186, 382, 0.15)
    sphere('ball', bc, 0.065, chrome, seg=48, ring=24)
    point('balll', bc + Vector((0, 0, 0.25)), 2.5, (0.7, 0.85, 1.0), 0.05)
    for i in range(6):  # the ball's light trail
        sphere(f'trail{i}', bc + Vector((-0.04 * (i + 1), -0.08 * (i + 1), -0.02)), 0.05 * (1 - i / 7), emission('trail', (0.5, 0.8, 1.0), 1.4 - i * 0.2), seg=12, ring=8)
    pad = mat('paddle', (1.0, 0.76, 0.3), metal=1.0, rough=0.22, emit=(1.0, 0.7, 0.25), estr=0.3)
    pc = P(195, 724, 0.05)
    box('paddle', pc, (0.82, 0.12, 0.14), pad, 0.05, segs=5)
    box('padstrip', pc + Vector((0, 0.0, 0.075)), (0.66, 0.025, 0.01), emission('padlight', (1.0, 0.85, 0.5), 3.0), 0.0)
    for s in (-1, 1):
        cyl(f'padcap{s}', pc + Vector((s * 0.42, 0, 0)), 0.06, 0.14, mat('padend', (0.3, 0.32, 0.36), metal=1, rough=0.25), verts=32)
    point('padglow', pc + Vector((0, 0.2, 0.3)), 6, (1.0, 0.8, 0.45), 0.1)
    if not A:
        # sparks from a brick just broken next to the ball
        spark = emission('spark', (1.0, 0.85, 0.4), 10)
        for i in range(22):
            a = rnd.uniform(0, 2 * math.pi)
            d = rnd.uniform(0.05, 0.35)
            c = P(210, 352, 0.2) + Vector((math.cos(a) * d, math.sin(a) * d, 0))
            tube(f'sp{i}', [c, c + Vector((math.cos(a) * 0.04, math.sin(a) * 0.04, 0))], 0.004, spark)
    key_light(300, (1.0, 0.96, 0.92))
    area('rim', (5, -6, 6), 150, 5, (0.5, 0.65, 1.0))
    return dict(name='Breaker', hud=[('left', 0, 'BRICKS', '17 / 108'), ('right', 0, 'GOLD', '0 / 3')], bloom=0.55 if A else 0.85, view='Standard')
