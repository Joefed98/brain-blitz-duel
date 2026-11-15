"""Orbit: the rocket circles a green banded planet; the next planet (red) waits up and to the right with its own
dashed orbit, a third (orange ringed) at the right edge. Stardust between them, the fuel gauge bottom right."""
import math, random
from lib import *


def build(look):
    rnd = random.Random(51)
    A = look == 'A'
    reset(world=(0.0, 0.0, 0.002))
    starm = [emission(f'star{i}', c, s) for i, (c, s) in enumerate((((0.8, 0.85, 1.0), 1.5), ((1.0, 0.9, 0.8), 3), ((0.7, 0.8, 1.0), 6)))]
    zs = -12.0
    k = depth_scale(zs)
    for i in range(170):
        sphere(f'st{i}', (rnd.uniform(-1.4, 1.4) * k, rnd.uniform(-3.6, 3.6) * k, zs), rnd.uniform(0.003, 0.008) * k,
               starm[0 if i % 7 else (1 if i % 2 else 2)], seg=6, ring=4)
    if not A:
        nebula_plane('neb', -14, [(0.05, 0.3, 0.2), (0.5, 0.12, 0.25)], strength=0.35, scale=0.12, seed=3.0)

    planets = [
        # x, y, r px, orbit px, colours, banded, ring colour
        (130, 560, 30, 82, ((0.04, 0.3, 0.14), (0.12, 0.55, 0.3), (0.45, 0.85, 0.55)), True, (0.3, 1.0, 0.55), 'dash'),
        (300, 330, 25, 72, ((0.25, 0.03, 0.03), (0.75, 0.2, 0.15), (1.0, 0.65, 0.5)), False, (1.0, 0.35, 0.3), 'dash'),
        (398, 520, 40, 0, ((0.45, 0.2, 0.06), (0.75, 0.42, 0.15), (0.95, 0.75, 0.5)), True, (1.0, 0.6, 0.3), 'rings'),
        (96, 165, 18, 56, ((0.05, 0.14, 0.35), (0.15, 0.35, 0.7), (0.55, 0.7, 0.95)), True, (0.45, 0.65, 1.0), 'dash'),
    ]
    for i, (x, y, r, orb, cols, banded, rc, kind) in enumerate(planets):
        c = P(x, y, 0.0)
        pm = planet_mat(f'pl{i}', *cols, banded=banded, scale=2.5 if banded else 6.0, distortion=14 + i)
        p = sphere(f'planet{i}', c, r / 100, pm, seg=96, ring=48)
        p.rotation_euler = (0.4, 0.3 + i, 0.2 * i)
        sphere(f'atm{i}', c, r / 100 * 1.06, atmosphere(f'atm{i}', rc, 2.0 if A else 3.5), seg=64, ring=32)
        if kind == 'dash':
            dashed_ring(f'orb{i}', c + Vector((0, 0, -0.01)), orb / 100, 0.004, emission(f'orbm{i}', rc, 1.4 if A else 2.2), dashes=56, fill=0.5)
        else:
            torus(f'prings{i}', c, r / 100 * 1.6, 0.006, emission(f'pr{i}', rc, 1.8), rot=(1.15, 0.2, 0.4))
            ring_flat(f'pdisc{i}', c, r / 100 * 1.35, r / 100 * 2.1, mat('ringdust', (0.7, 0.5, 0.3), rough=0.8)).rotation_euler = (1.15, 0.2, 0.4)

    # the rocket on the green planet's orbit, nose along its path
    a = math.radians(42)
    oc = P(130, 560)
    rc = oc + Vector((math.cos(a), math.sin(a), 0)) * 0.82
    rc.z = 0.3
    hull = mat('hull', (0.92, 0.92, 0.95), metal=0.2, rough=0.25, coat=0.8)
    red = mat('fin', (0.8, 0.08, 0.06), rough=0.3, coat=0.8)
    glass = mat('port', (0.05, 0.25, 0.4), rough=0.05, coat=1.0)
    rk = link(bpy.data.objects.new('rocket', None))
    rk.location = rc
    rk.rotation_euler = (0, 0, a + math.pi / 2 - math.pi / 2)
    parts = [cyl('rbody', (0, 0, 0), 0.032, 0.13, hull, verts=32, rot=(-math.pi / 2, 0, 0), r2=0.03),
             cyl('rnose', (0, 0.1, 0), 0.03, 0.07, red, verts=32, rot=(-math.pi / 2, 0, 0), r2=0.0),
             sphere('rport', (0, 0.025, 0.026), 0.012, glass, seg=16, ring=8),
             cyl('rnozzle', (0, -0.075, 0), 0.02, 0.025, mat('noz', (0.2, 0.2, 0.22), metal=1, rough=0.3), verts=24, rot=(-math.pi / 2, 0, 0), r2=0.026)]
    for s in (-1, 1):
        parts.append(prism(f'rfin{s}', [(s * 0.03, -0.065), (s * 0.06, -0.085), (s * 0.03, -0.02)], -0.006, 0.006, red, 0.002))
    flame = cyl('flame', (0, -0.12, 0), 0.018, 0.07, emission('flame', (1.0, 0.55, 0.15), 8), verts=16, rot=(math.pi / 2, 0, 0), r2=0.0)
    parts.append(flame)
    for p in parts:
        p.parent = rk
    rk.rotation_euler = (0, 0, a)  # tangent to the orbit (rocket's nose is +Y)
    point('exhaust', rc + Vector((0, 0, 0.1)), 4, (1.0, 0.55, 0.2), 0.05)
    # stardust specks along the line to the next planet and a few beyond
    dust = emission('dust', (1.0, 0.85, 0.5), 5)
    for j in range(7):
        t = j / 6
        p = P(170 + 110 * t, 470 - 120 * t, 0.15)
        for q in range(5):
            sphere(f'sd{j}{q}', p + Vector((rnd.uniform(-0.02, 0.02), rnd.uniform(-0.02, 0.02), 0)), rnd.uniform(0.004, 0.008), dust, seg=8, ring=6)
    # fuel gauge bottom right: a glass tube with lit green cells
    gx, gy0, gy1 = 360, 640, 780
    glassm = mat('gaugeglass', (0.8, 0.9, 1.0), rough=0.05, transm=1.0, ior=1.45)
    cyl('gauge', P(gx, (gy0 + gy1) / 2, 0.2), 0.11, (gy1 - gy0) / 100, glassm, verts=32, rot=(math.pi / 2, 0, 0))
    cell_on = emission('cellon', (0.2, 1.0, 0.35), 0.9)
    cell_off = mat('celloff', (0.05, 0.08, 0.06), rough=0.4)
    n = 14
    for i in range(n):
        y = gy1 - 8 - i * ((gy1 - gy0 - 16) / (n - 1))
        box(f'cell{i}', P(gx, y, 0.2), (0.12, 0.06, 0.06), cell_on if i < 10 else cell_off, 0.01)
    for yy in (gy0 - 4, gy1 + 4):
        cyl(f'cap{yy}', P(gx, yy, 0.2), 0.13, 0.05, mat('capm', (0.6, 0.62, 0.66), metal=1, rough=0.3), verts=32, rot=(math.pi / 2, 0, 0))
    key_light(900, (1.0, 0.95, 0.88))
    area('rim', (8, -6, 4), 500 if A else 900, 5, (0.5, 0.6, 1.0) if A else (1.0, 0.45, 0.6))
    if not A:
        sphere('sun', (-2.8, 6.0, -6), 1.0, emission('sun', (1.0, 0.8, 0.5), 8), seg=32, ring=16)
        point('sunl', (-2.0, 5.0, -2), 4000, (1.0, 0.8, 0.55), 1.0)
    return dict(name='Orbit', hud=[('left', 0, 'PLANETS', '7 / 40'), ('right', 0, 'DUST', '12 / 30'), ('left', 1, 'SLING', '2 / 4')], bloom=0.55)
