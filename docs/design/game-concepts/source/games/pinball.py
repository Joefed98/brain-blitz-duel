"""Pinball: the full table on a purple playfield. Cyan-lit arch, J-O-U-L-Z rollover lanes, the ramp sweeping from
the left to the LOCK hole, three pop bumpers, drop targets, the x2-x5 lights, slingshots, gold flippers and two
balls in play (multiball)."""
import math, random
from lib import *


def arch(cx, cy, r, a0, a1, n=40):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy - r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]


def build(look):
    rnd = random.Random(141)
    A = look == 'A'
    reset(world=(0.0, 0.0, 0.0))
    world_gradient((0.8, 0.8, 0.9), (0.0, 0.0, 0.0), 0.4, axis='Z')
    cab = wood('cabinet', base=(0.05, 0.02, 0.04), dark=(0.01, 0.005, 0.01), scale=4.0)
    box('cabinet', (0, 0, -0.35), (4.3, 9.2, 0.2), cab, 0)
    # playfield inside the outline
    left, right, lane_x = 22, 372, 352
    top_c = (197, 240)
    outline = [(left, 790)] + arch(top_c[0], top_c[1], (right - left) / 2, 180, 0) + [(right, 790)]
    poly = [(P(x, y).x, P(x, y).y) for x, y in outline] + [(P(right, 860).x, P(right, 860).y), (P(left, 860).x, P(left, 860).y)]
    field = mat('playfield', (0.07, 0.018, 0.13) if A else (0.035, 0.008, 0.075), rough=0.25, coat=1.0, coat_rough=0.03,
                color_noise=(2.5, (0.14, 0.04, 0.22), 0.5))
    fade_glow('fieldglow', P(195, 500, -0.239), 3.4, 5.0, (0.45, 0.15, 0.7), 0.1 if A else 0.16, power=1.2)
    prism('field', poly, -0.26, -0.24, field, 0)
    # printed art: faint concentric arcs and a star burst under the bumpers
    art = emission('art', (0.55, 0.25, 0.85), 0.12 if A else 0.2)
    for r in (60, 85, 110):
        ring_flat(f'arcs{r}', P(190, 400, -0.235), r / 100, r / 100 + 0.006, art)
    # side walls: chrome rails and the cyan neon arch
    chrome = mat('chrome', (0.92, 0.93, 0.96), metal=1.0, rough=0.08)
    neon = emission('neon', (0.25, 0.95, 1.0), 2.2 if A else 3.5)
    tube('rail', [P(x, y, -0.2) for x, y in outline], 0.022, chrome)
    tube('neon', [P(x, y, -0.16) for x, y in outline], 0.007, neon)
    inner = [(lane_x - 4, 800)] + [(x, y) for x, y in arch(top_c[0], top_c[1], (right - left) / 2 - 16, 8, 50, 16)]
    tube('lanewall', [P(lane_x - 4, 810, -0.2), P(lane_x - 4, 330, -0.2)], 0.012, chrome)
    tube('lanecurve', [P(x, y, -0.2) for x, y in arch(top_c[0], top_c[1], (right - left) / 2 - 18, 20, 70, 14)], 0.01, chrome)
    # plunger
    cyl('plunger', P(363, 800, -0.2), 0.03, 0.4, chrome, verts=24, rot=(math.pi / 2, 0, 0))
    box('plungerknob', P(363, 830, -0.18), (0.08, 0.06, 0.06), mat('red', (0.8, 0.05, 0.05), rough=0.2, coat=1), 0.02)
    # J-O-U-L-Z lanes: guide posts and green rollover arrows
    post = mat('post', (0.9, 0.9, 0.95), rough=0.3)
    green = mat('green', (0.15, 0.9, 0.35), rough=0.1, coat=1.0, emit=(0.2, 1.0, 0.4), estr=1.2)
    greendim = mat('greendim', (0.05, 0.25, 0.1), rough=0.1, coat=1.0)
    for i, x in enumerate((95, 140, 185, 230, 275, 320)):
        tube(f'guide{i}', [P(x, 150, -0.2), P(x, 205, -0.2)], 0.01, chrome)
        cyl(f'gpost{i}', P(x, 150, -0.18), 0.018, 0.08, post, verts=16)
    for i, x in enumerate((117, 162, 207, 252, 297)):
        lit = i != 2
        prism(f'roll{i}', [(P(x, 178).x, P(x, 178).y), (P(x + 11, 196).x, P(x + 11, 196).y), (P(x - 11, 196).x, P(x - 11, 196).y)], -0.235, -0.225, green if lit else greendim, 0.002)
    # the ramp: a clear purple tube channel arcing from the left inlane up and across to the LOCK
    ramp_pts = [P(32, 372, -0.05), P(34, 300, 0.0), P(44, 228, 0.06), P(110, 214, 0.1), P(200, 218, 0.1), P(290, 212, 0.08), P(312, 250, 0.04), P(316, 335, -0.02)]
    teal = mat('tealramp', (0.1, 0.6, 0.6), rough=0.05, transm=0.8, ior=1.45, coat=1.0)
    teal_pts = [P(58, 335, -0.05), P(62, 260, 0.02), P(78, 190, 0.06), P(92, 150, 0.04)]
    smooth_curve('tealramp', teal_pts, 0.04, teal)
    for s2 in (-1, 1):
        smooth_curve(f'tealrail{s2}', [p + Vector((s2 * 0.035, 0, 0.035)) for p in teal_pts], 0.007, chrome)
    rampm = mat('ramp', (0.55, 0.2, 0.75), rough=0.05, transm=0.75, ior=1.45, coat=1.0)
    smooth_curve('ramp', ramp_pts, 0.055, rampm)
    for s in (-1, 1):
        smooth_curve(f'ramprail{s}', [p + Vector((0, s * 0.04, 0.04)) for p in ramp_pts], 0.008, chrome)
    lock = P(328, 236, -0.2)
    cyl('lockhole', lock, 0.05, 0.05, mat('hole', (0.0, 0.0, 0.0), rough=1), verts=32)
    torus('lockring', lock + Vector((0, 0, 0.03)), 0.06, 0.01, mat('lockgold', (1.0, 0.75, 0.3), metal=1, rough=0.15, emit=(1.0, 0.7, 0.25), estr=0.8))
    # pop bumpers
    cap = mat('bumpcap', (0.35, 0.08, 0.45), rough=0.1, coat=1.0, emit=(0.6, 0.15, 0.7), estr=0.3 if A else 0.5)
    skirt = mat('skirt', (0.25, 0.08, 0.35), metal=1.0, rough=0.25)
    for i, (x, y) in enumerate(((143, 357), (236, 357), (190, 414))):
        c = P(x, y, -0.2)
        cyl(f'bbase{i}', c, 0.16, 0.06, skirt, verts=48, bevel=0.01)
        cyl(f'bbody{i}', c + Vector((0, 0, 0.08)), 0.12, 0.1, mat('bbody', (0.85, 0.85, 0.9), rough=0.15, transm=0.6, coat=1.0), verts=48)
        cyl(f'bcap{i}', c + Vector((0, 0, 0.15)), 0.14, 0.04, cap, verts=48, bevel=0.012)
        star_shape(f'bstar{i}', c + Vector((0, 0, 0.175)), 0.06, 0.026, 0.01, emission('bstar', (1.0, 0.4, 0.85), 2.0))
        torus(f'bpink{i}', c + Vector((0, 0, 0.17)), 0.12, 0.012, emission('bpink', (1.0, 0.3, 0.8), 2.0 if A else 3.0))
        torus(f'bring{i}', c + Vector((0, 0, 0.0)), 0.165, 0.012, mat('rubber', (0.05, 0.05, 0.05), rough=0.6))
        point(f'bl{i}', c + Vector((0, 0, 0.45)), 5 if A else 10, (1.0, 0.35, 0.8), 0.05)
    # JACKPOT insert and drop targets
    jp = P(190, 470, -0.235)
    box('jackpot', jp, (0.62, 0.11, 0.01), mat('jackpot', (0.9, 0.3, 0.8), rough=0.2, coat=1, emit=(1.0, 0.3, 0.8), estr=0.8), 0.03)
    orange = mat('droptarget', (1.0, 0.45, 0.1), rough=0.2, coat=1.0, emit=(1.0, 0.4, 0.05), estr=0.4)
    for i, x in enumerate((160, 190, 220)):
        box(f'drop{i}', P(x, 500, -0.18), (0.24, 0.06, 0.12), orange, 0.012)
    # multiplier lights x2..x5
    for i, x in enumerate((140, 173, 206, 239)):
        cyl(f'mult{i}', P(x, 615, -0.235), 0.1, 0.01, mat(f'multm{i}', (1.0, 0.65, 0.15), rough=0.2, coat=1, emit=(1.0, 0.6, 0.12), estr=1.0 if i < 2 else 0.08), verts=32)
    # slingshots and inlane guides
    yellow = mat('sling', (1.0, 0.82, 0.2), rough=0.15, coat=1.0, emit=(1.0, 0.75, 0.15), estr=0.4)
    pinkins = mat('slingins', (0.6, 0.15, 0.6), rough=0.2, coat=1.0, emit=(0.8, 0.2, 0.8), estr=0.4)
    for s, (xa, xb) in ((-1, (55, 100)), (1, (335, 290))):
        tri = [(P(xa, 590).x, P(xa, 590).y), (P(xa, 665).x, P(xa, 665).y), (P(xb, 680).x, P(xb, 680).y)]
        prism(f'sling{s}', tri, -0.235, -0.225, pinkins, 0.004)
        tube(f'slingpost{s}', [P(xa + 4 * s, 585, -0.17), P(xb, 680, -0.17)], 0.014, yellow)
        tube(f'outlane{s}', [P(left if s < 0 else right, 640, -0.2), P(left + 4 if s < 0 else right - 4, 700, -0.2), P(117 if s < 0 else 273, 752, -0.2)], 0.008, neon)
        tube(f'inlane{s}', [P(xa, 560, -0.2), P(xa, 690, -0.2), P(xb + 2 * s, 728, -0.2)], 0.01, chrome)
    # flippers: gold bats with red rubber
    gold = mat('flipgold', (1.0, 0.76, 0.28), metal=1.0, rough=0.2, emit=(1.0, 0.7, 0.25), estr=0.45)
    for s, (px, ang) in ((-1, (117, -0.45)), (1, (273, 0.45 + math.pi))):
        piv = P(px, 752, -0.17)
        L = 0.66
        d = Vector((math.cos(ang), math.sin(ang), 0))
        n = Vector((-d.y, d.x, 0))
        pts = [piv + n * 0.045, piv + d * L + n * 0.018, piv + d * L - n * 0.018, piv - n * 0.045]
        prism(f'flip{s}', [(p.x, p.y) for p in pts], -0.2, -0.13, gold, 0.015)
        cyl(f'flippiv{s}', piv + Vector((0, 0, 0.04)), 0.03, 0.02, chrome, verts=24)
    # outlane drain
    box('apron', P(195, 830, -0.15), (3.6, 0.6, 0.1), mat('apron', (0.08, 0.02, 0.12), metal=0.8, rough=0.3), 0.02)
    # balls
    for i, (x, y) in enumerate(((185, 141), (87, 426))):
        c = P(x, y, -0.13)
        sphere(f'ball{i}', c, 0.075, chrome, seg=48, ring=24)
    key_light(320 if A else 200, (1.0, 0.96, 0.92))
    area('top', (0, 6, 6), 200, 6, (0.9, 0.85, 1.0))
    if not A:
        fog(0.06, (0.8, 0.5, 1.0), z0=-0.24, z1=0.3)
    return dict(name='Pinball', hud=[('left', 0, '', '28,420'), ('right', 0, 'BALL', '1 / 3'), ('right', 1, 'MULTIBALL', '13')], bloom=0.6, view='Standard')
