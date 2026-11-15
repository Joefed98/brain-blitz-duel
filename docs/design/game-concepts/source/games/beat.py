"""Tempo: a rhythm game. Four lit lanes (gold, violet, magenta, cyan), notes falling as glass bars, the hit line
near the bottom with its four pads (a PERFECT hit on the gold lane), the fever meter filling across the top."""
import math, random
from lib import *

LANES = [(0.15, 0.9, 0.9), (1.0, 0.72, 0.1), (0.62, 0.3, 1.0), (0.25, 0.55, 1.0)]


def build(look):
    rnd = random.Random(111)
    A = look == 'A'
    reset(world=(0.0, 0.0, 0.0))
    world_gradient((0.4, 0.4, 0.5), (0.0, 0.0, 0.0), 0.3, axis='Z')
    box('back', (0, 0, -0.4), (4.2, 9.0, 0.1), mat('back', (0.004, 0.003, 0.01), rough=0.5), 0)
    lw = 390 / 4
    hit_y = 688
    for i, col in enumerate(LANES):
        cx = lw * (i + 0.5)
        dim = (0.03, 0.012, 0.045)
        # the lane: dark glass with a soft vertical wash of its colour toward the hit line
        lane = mat(f'lane{i}', dim, rough=0.2, coat=0.8, emit=(0.3, 0.12, 0.45), estr=0.03 if A else 0.05)
        box(f'lane{i}', P(cx, 450, -0.25), ((lw - 4) / 100, 7.9, 0.06), lane, 0.01)
        fade_glow(f'wash{i}', P(cx, 560, -0.21), (lw - 10) / 100, 2.6, col, 0.08 if A else 0.16)
        for sx in (-1, 1):
            tube(f'edge{i}{sx}', [P(cx + sx * (lw / 2 - 2), 98, -0.19), P(cx + sx * (lw / 2 - 2), 844, -0.19)], 0.004, emission(f'edgel{i}', col, 1.2 if A else 2.0))
    # notes in flight: (lane, y, length px)
    notes = [(3, 355, 14), (1, 550, 14), (2, 240, 14), (0, 150, 14), (0, 470, 14), (2, 610, 14), (3, 560, 14), (1, 200, 14)]
    for k, (ln, y, L) in enumerate(notes):
        col = LANES[ln]
        cx = lw * (ln + 0.5)
        m = mat(f'note{ln}', col, rough=0.08, coat=1.0, emit=col, estr=0.7 if A else 1.1)
        box(f'note{k}', P(cx, y, -0.08), ((lw - 22) / 100, L / 100, 0.08), m, 0.02, segs=4)
        if L > 20:  # a hold note's spine
            box(f'hold{k}', P(cx, y + L / 2 + 40, -0.12), (0.08, 0.8, 0.03), emission(f'holdm{ln}', col, 0.8), 0.01)
    # hit line and pads
    rail = mat('rail', (0.85, 0.85, 0.9), metal=1.0, rough=0.2)
    box('hitline', P(195, hit_y, -0.05), (3.9, 0.025, 0.04), rail, 0.008)
    tube('hitglow', [P(0, hit_y, -0.02), P(390, hit_y, -0.02)], 0.004, emission('hitg', (1.0, 1.0, 1.0), 3.0))
    for i, col in enumerate(LANES):
        cx = lw * (i + 0.5)
        c = P(cx, hit_y + 2, 0.0)
        cyl(f'pad{i}', c, 0.2, 0.05, mat(f'padm{i}', tuple(x * 0.2 for x in col), rough=0.1, coat=1.0, emit=col, estr=0.3 if i != 1 else 1.2), verts=48, bevel=0.01)
        torus(f'padring{i}', c + Vector((0, 0, 0.03)), 0.2, 0.008, emission(f'padr{i}', col, 2.0))
    # the PERFECT hit on lane 0: a burst on the pad, a column of light
    pc = P(lw * 1.5, hit_y, 0.05)
    burst = emission('burst', (1.0, 0.75, 0.25), 3)
    for i in range(18):
        a = i / 18 * 2 * math.pi
        cc = pc + Vector((math.cos(a) * 0.24, math.sin(a) * 0.24, 0.05))
        tube(f'bst{i}', [cc, cc + Vector((math.cos(a) * 0.08, math.sin(a) * 0.08, 0))], 0.005, burst)
    fade_glow('column', P(lw * 1.5, hit_y - 290, -0.15), (lw - 8) / 100, 5.8, (1.0, 0.62, 0.1), 0.5 if A else 0.9, power=1.2)
    point('perfectl', pc + Vector((0, 0, 0.4)), 15, (1.0, 0.75, 0.3), 0.1)
    # the fever meter under the HUD: a glass tube, pink fill to 60 %
    fy = 116
    tube_glass = mat('tubeglass', (0.9, 0.9, 1.0), rough=0.05, transm=1.0, ior=1.4)
    cyl('fever', P(195, fy, 0.1), 0.06, 3.7, tube_glass, verts=32, rot=(0, math.pi / 2, 0))
    cyl('feverfill', P(20 + 0.6 * 350 / 2, fy, 0.1), 0.045, 3.5 * 0.6, emission('feverp', (1.0, 0.2, 0.65), 1.4), verts=24, rot=(0, math.pi / 2, 0))
    for x in (8, 382):
        cyl(f'fcap{x}', P(x, fy, 0.1), 0.07, 0.06, rail, verts=32, rot=(0, math.pi / 2, 0))
    # the deck below the hit line
    box('deck', P(195, 790, -0.02), (3.9, 1.6, 0.04), mat('deckm', (0.01, 0.01, 0.015), rough=0.35, coat=0.6), 0.01)
    key_light(300, (1.0, 0.97, 0.95))
    if not A:
        fog(0.04, (0.9, 0.8, 1.0), z0=-0.3, z1=0.4)
    return dict(name='Tempo', hud=[('left', 0, 'COMBO', '55'), ('right', 0, 'BONUS', '+26')], bloom=0.65, view='Standard')
