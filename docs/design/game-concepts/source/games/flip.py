"""Roofbound (flip): a lava-cave runner flipping between floor and ceiling. Corridor sloping down to the right,
ceiling spikes ahead on the right, floor spikes behind on the left, the runner on the ceiling (flipped)."""
import math, random
from lib import *


def edge_y(x, top):
    # the two cave edges in phone px (from the live mid-play frame)
    return 150 + (335 - 150) * x / 390 if top else 480 + (690 - 480) * x / 390


def build(look):
    rnd = random.Random(4)
    A = look == 'A'
    reset(world=(0.004, 0.003, 0.004))
    # A: today's charcoal cave with a thin orange-red molten rim. B (bolder): a live lava crust, more glow.
    rock = mat('basalt', (0.045, 0.043, 0.046), rough=0.72, bump=(7.0, 0.55, 8), color_noise=(1.6, (0.11, 0.1, 0.1), 0.7))
    rock2 = mat('basalt2', (0.03, 0.028, 0.03), rough=0.85, bump=(10.0, 0.6, 8), color_noise=(2.0, (0.07, 0.06, 0.06), 0.7))
    if A:
        edge = crackle('edgecrust', (0.05, 0.035, 0.03), (1.0, 0.22, 0.04), 3.0, scale=30.0, width=0.05, rough=0.6)
        hot = emission('lavahot', (1.0, 0.42, 0.08), 4)
    else:
        band = crackle('band', (0.04, 0.03, 0.028), (1.0, 0.2, 0.03), 3.0, scale=8.0, width=0.012, rough=0.75)
        edge = crackle('edgecrust', (0.06, 0.035, 0.025), (1.0, 0.28, 0.05), 5.0, scale=28.0, width=0.09, rough=0.6)
        hot = emission('lavahot', (1.0, 0.45, 0.1), 7)
    spike = mat('redglass', (0.5, 0.06, 0.02), rough=0.12, coat=1.0, spec=0.7, emit=(1.0, 0.18, 0.04), estr=0.5)
    line = emission('rimline', (1.0, 0.24, 0.06), 3.0 if A else 5.0)
    far = mat('far', (0.02, 0.022, 0.026), rough=0.9, bump=(3.0, 0.8, 6), color_noise=(1.5, (0.012, 0.01, 0.01), 0.8))
    body, acc, vis = mat('suit', (0.03, 0.03, 0.036), rough=0.35, coat=0.6), mat('gold', (1.0, 0.72, 0.32), metal=1, rough=0.22), emission('visor', (1.0, 0.55, 0.2), 6)
    cape = mat('cape', (0.95, 0.62, 0.2), metal=1, rough=0.3)

    # far cave wall and hanging rock silhouettes (deep, so drawn larger)
    zf = -6.0
    k = depth_scale(zf)
    plane('farwall', (0, 0, zf), 4.6 * k, 9.4 * k, far)
    for i in range(18):
        h = rnd.uniform(0.8, 2.6)
        cyl(f'stal{i}', (rnd.uniform(-2.3, 2.3) * k, 4.4 * k - h / 2, zf + 0.6), rnd.uniform(0.14, 0.34), h, rock2, verts=7, r2=0.01, rot=(math.pi, 0, 0))
        cyl(f'stag{i}', (rnd.uniform(-2.3, 2.3) * k, -4.4 * k + h / 2, zf + 0.6), rnd.uniform(0.16, 0.4), h * 0.8, rock2, verts=7, r2=0.01)
    shard = mat('shard', (0.06, 0.065, 0.075), rough=0.6, bump=(6.0, 0.3, 6))
    for i in range(16):
        top = i % 2 == 0
        cx = rnd.uniform(-30, 420)
        base_y = edge_y(cx, top) + (-40 if top else 40)
        w = rnd.uniform(50, 120); h = rnd.uniform(60, 170)
        pts = [(cx - w / 2, base_y), (cx + w / 2, base_y), (cx + rnd.uniform(-w / 3, w / 3), base_y + (h if top else -h))]
        prism(f'shard{i}', [(x / 100 - 1.95, 4.22 - y / 100) for x, y in pts], -2.4, -2.2, shard, bevel=0.01)
    point('deep', (0.4, -0.6, -3.2), 260 if A else 900, (1.0, 0.32, 0.07), 2.0)
    point('deep2', (-0.8, 2.2, -3.6), 120 if A else 400, (1.0, 0.4, 0.1), 2.0)
    area('rimback', (-3, 6, -2), 300, 4, (0.6, 0.62, 0.7), target=(0, 0, -6))

    # ceiling and floor rock: layered rugged slabs along each edge
    for top in (True, False):
        sgn = -1 if top else 1
        far_y = -60 if top else 920
        for li, (dz, inset, thick) in enumerate(((0.0, 0, 0.6), (-0.5, -16, 0.5), (-1.0, -30, 0.5))):
            pts = []
            for x in range(-30, 431, 12):
                y = edge_y(x, top) - sgn * inset + rnd.uniform(-4, 4) + 3 * math.sin(x * 0.07 + li)
                pts.append((x, y))
            poly = [(x / 100 - 1.95, 4.22 - y / 100) for x, y in pts] + [(2.4, 4.22 - far_y / 100), (-2.4, 4.22 - far_y / 100)]
            prism(f'rock{top}{li}', poly, dz - thick, dz, rock if li == 0 else rock2, bevel=0.05, segs=3)
            if li == 0:
                edge_pts = pts
        # the molten lip along the edge
        strip(f'lip{top}', edge_pts, 10 if A else 16, -0.4, 0.035, edge, side=(1 if top else -1), bevel=0.02)
        tube(f'rim{top}', [P(x, y, 0.03) for x, y in edge_pts], 0.009 if A else 0.013, line)
        if not A:
            strip(f'band{top}', edge_pts, 60, -0.45, 0.012, band, side=(1 if top else -1), bevel=0.0)
        for x in range(20, 390, 75):
            point(f'el{top}{x}', P(x, edge_y(x, top) - sgn * 16, 0.25), 6 if A else 12,
                  (1.0, 0.38, 0.08), 0.3)

    # spikes: ceiling ahead (right), floor behind (left)
    def spikes(x0, x1, top, n):
        ang = math.atan2(-(335 - 150 if top else 690 - 480), 390)
        nrm = Vector((-math.sin(ang), math.cos(ang), 0)) * (-1 if top else 1)
        for i in range(n):
            x = x0 + (x1 - x0) * i / max(1, n - 1)
            h = 0.44 + 0.08 * ((i * 7) % 3) / 2
            c = P(x, edge_y(x, top), 0.05)
            o = cyl(f'spk{top}{i}', c + nrm * (h / 2 - 0.04), 0.11, h, spike, verts=5, r2=0.0)
            o.rotation_euler = nrm.to_track_quat('Z', 'Y').to_euler()
            o.rotation_euler.rotate_axis('Z', i * 0.7)
    spikes(300, 362, True, 4)
    spikes(46, 104, False, 4)

    # embers drifting up the corridor
    for i in range(40 if A else 24):
        x, y = rnd.uniform(0, 390), rnd.uniform(220, 680)
        sphere(f'em{i}', P(x, y, rnd.uniform(-1.6, 0.3)), rnd.uniform(0.004, 0.008), hot, seg=8, ring=6)

    # the runner on the ceiling, flipped, mid-stride
    hero('runner', P(58, 196, 0.12), 1.45, body, acc, vis, pose='run', rot=math.pi + math.atan2(185, 390), cape_m=cape)
    point('herorim', P(80, 236, 0.7), 6, (1.0, 0.75, 0.45), 0.15)
    key_light(2600, (1.0, 0.92, 0.85))
    area('fill', (7, -7, 10), 200 if A else 300, 8, (1.0, 0.45, 0.2))
    return dict(name='Roofbound', hud=[('left', 0, 'SCORE', '98'), ('right', 0, 'FLOW', '29')], bloom=0.55)
