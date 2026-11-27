"""Fission: bubble-splitting on a green phosphor field. Atoms of three sizes bounce (one golden), a beam rises from
the walker at the bottom, two more beams in flight, and the two arrow keys under the field."""
import math, random
from lib import *


def atom(name, c, r, core_m, shell_m, ring_m, tilt):
    sphere(name + 'core', c, r * 0.45, core_m, seg=32, ring=16)
    sphere(name + 'shell', c, r, shell_m, seg=48, ring=24)
    for k in range(2):
        torus(name + f'orb{k}', c, r * 1.25, r * 0.05, ring_m, rot=(1.2, tilt + k * 1.1, k * 0.9))


def build(look):
    rnd = random.Random(101)
    A = look == 'A'
    reset(world=(0.0, 0.0, 0.0))
    world_gradient((0.4, 0.5, 0.4), (0.0, 0.0, 0.0), 0.3, axis='Z')
    grid_floor('field', -0.4, base=(0.002, 0.012, 0.006) if A else (0.0005, 0.004, 0.002), line=(0.15, 0.8, 0.3), strength=0.04 if A else 0.09, cells=(14, 30))
    starfield(90, -0.39, 101, size=(0.002, 0.004), colours=((0.6, 1.0, 0.7),))
    # field bounds (phone px): x 6..384, y 64..700; a lit floor line
    floor = emission('floorline', (0.3, 1.0, 0.45), 1.5)
    plane('floorline', P(195, 702, 0.0), 3.8, 0.012, floor)
    shell = mat('shell', (0.8, 1.0, 0.85), rough=0.05, transm=1.0, ior=1.1)
    core = mat('core', (1.0, 0.6, 0.08), metal=0.6, rough=0.25, emit=(1.0, 0.55, 0.06), estr=0.8 if A else 2.0)
    ring = emission('ering', (0.3, 1.0, 0.45), 1.0 if A else 2.2)
    gcore = mat('gcore', (1.0, 0.8, 0.3), metal=1.0, rough=0.15, emit=(1.0, 0.75, 0.2), estr=1.2)
    gring = emission('gring', (1.0, 0.8, 0.3), 1.5)
    atoms = [(345, 360, 22, False), (90, 430, 16, False), (330, 445, 12, True), (175, 250, 30, False), (270, 560, 11, False),
             (48, 595, 16, False), (220, 150, 13, False)]
    for i, (x, y, r, gold) in enumerate(atoms):
        c = P(x, y, 0.2)
        atom(f'a{i}', c, r / 100, gcore if gold else core, shell, gring if gold else ring, i * 0.7)
        point(f'al{i}', c + Vector((0, 0, 0.25)), 3 if not gold else 6, (1.0, 0.7, 0.3) if gold else (0.6, 1.0, 0.5), 0.05)
    # a split just happening: two halves and a puff
    sc = P(320, 392, 0.2)
    for d in (-1, 1):
        atom(f'split{d}', sc + Vector((d * 0.12, 0.04, 0)), 0.11, core, shell, ring, d)
    puff = emission('puff', (0.6, 1.0, 0.6), 2.5)
    for i in range(14):
        a = i / 14 * 2 * math.pi
        cc = sc + Vector((math.cos(a) * 0.1, math.sin(a) * 0.1, 0))
        tube(f'pf{i}', [cc, cc + Vector((math.cos(a) * 0.04, math.sin(a) * 0.04, 0))], 0.004, puff)
    # beams
    beam = emission('beam', (0.2, 1.0, 0.35), 1.6 if A else 2.6)
    beamcore = emission('beamcore', (0.7, 1.0, 0.75), 3.0)
    for i, (x, y0, y1) in enumerate(((287, 470, 668), (338, 220, 300), (100, 290, 345))):
        cyl(f'beam{i}', P(x, (y0 + y1) / 2, 0.15), 0.012, (y1 - y0) / 100, beam, verts=12, rot=(math.pi / 2, 0, 0))
        cyl(f'beamc{i}', P(x, (y0 + y1) / 2, 0.16), 0.004, (y1 - y0) / 100, beamcore, verts=8, rot=(math.pi / 2, 0, 0))
    # the walker: a cream arrowhead ship on the floor
    pc = P(287, 680, 0.15)
    cream = mat('cream', (0.95, 0.9, 0.7), rough=0.25, coat=1.0)
    prism('walker', [(pc.x, pc.y + 0.2), (pc.x + 0.12, pc.y - 0.08), (pc.x + 0.05, pc.y - 0.04), (pc.x, pc.y - 0.09), (pc.x - 0.05, pc.y - 0.04), (pc.x - 0.12, pc.y - 0.08)], 0.1, 0.17, cream, 0.008)
    sphere('wcock', pc + Vector((0, 0.03, 0.06)), 0.022, mat('wglass', (0.2, 0.9, 0.5), rough=0.05, coat=1, emit=(0.3, 1.0, 0.5), estr=1.0), seg=16, ring=8)
    point('walkl', pc + Vector((0, 0.1, 0.25)), 4, (0.5, 1.0, 0.6), 0.05)
    # the two arrow keys (glass keys on a dark deck)
    deck = mat('deck', (0.01, 0.02, 0.015), rough=0.4)
    box('deck', P(195, 775, -0.1), (3.9, 1.4, 0.1), deck, 0.0)
    key = mat('key', (0.04, 0.12, 0.1), rough=0.08, coat=1.0, emit=(0.05, 0.4, 0.3), estr=0.25)
    keyedge = emission('keyedge', (0.25, 0.9, 0.8), 1.2)
    arrow = emission('arrow', (0.3, 1.0, 0.85), 3.0)
    for i, x in enumerate((100, 290)):
        c = P(x, 776, 0.0)
        box(f'key{i}', c, (1.66, 0.66, 0.08), key, 0.06, segs=5)
        pts = [c + Vector((sx * 0.8, sy * 0.3, 0.045)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1), (-1, -1))]
        tube(f'kedge{i}', pts, 0.005, keyedge)
        d = -1 if i == 0 else 1
        prism(f'arr{i}', [(c.x + d * 0.09, c.y), (c.x - d * 0.05, c.y + 0.08), (c.x - d * 0.05, c.y - 0.08)], 0.045, 0.055, arrow)
    key_light(350, (0.95, 1.0, 0.95))
    if not A:
        fog(0.08, (0.6, 1.0, 0.7), z0=-0.38, z1=0.5)
    return dict(name='Fission', hud=[('left', 0, 'WAVE', '3 / 5'), ('right', 0, 'ATOMS LEFT', '6'), ('right', 1, 'BURST', '4')], bloom=0.6, view='Standard')
