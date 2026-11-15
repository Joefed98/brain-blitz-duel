"""Logic: puzzles on a desk at night, teal light. Each scene fills the frame: a working surface, the game's
pieces in real materials, a dark room with soft out-of-focus lights behind."""
import math
from jz import *

TEAL = '#2ED3B7'

def test_tube(x, y, layers, r=0.13, h=1.0, tilt=None, loc_z=0.0):
    """A glass test tube with a rounded foot holding stacked coloured liquid (bottom first), one layer = 0.2."""
    t = 0.012; p = []
    n = 10
    for i in range(n + 1):                    # outer foot, from the axis up to the wall
        a = -math.pi / 2 + (math.pi / 2) * i / n; p.append((r * math.cos(a), r + r * math.sin(a)))
    p += [(r, h), (r + 0.012, h + 0.01), (r + 0.012, h + 0.03), (r - t, h + 0.03)]
    for i in range(n + 1):                    # inner wall down and round the foot
        a = (math.pi / 2) * (1 - i / n) - math.pi / 2 * 0; a = -(math.pi / 2) * i / n
        p.append(((r - t) * math.cos(a), r + (r - t) * math.sin(a))) if i else p.append((r - t, r))
    p.append((0, t))
    obs = [lathe(p, glass('#EEF8FF', 0.01), close_top=False, close_bottom=False, segs=64)]
    ri = r - t - 0.004; z = t + 0.004
    for k, col in enumerate(layers):
        top = r + 0.2 * k + 0.2 if k else r + 0.2
        if k == 0:
            q = [(0, z)] + [(ri * math.cos(-math.pi / 2 + (math.pi / 2) * i / 8), r + ri * math.sin(-math.pi / 2 + (math.pi / 2) * i / 8)) for i in range(9)] + [(ri, top), (0, top)]
        else:
            q = [(0, bottom), (ri, bottom), (ri, top), (0, top)]
        obs.append(lathe(q, liquid(col), segs=48))
        bottom = top
    g = empty(loc=(x, y, loc_z), rot=tilt or (0, 0, 0))
    for o in obs: o.parent = g
    return g, bottom

def tubes():
    world('#04060B')
    # bench: dark walnut, a brass-edged slate tray
    box((6, 3, 0.12), wood('#5A3A24', '#2C1A0F', 0.3, 1.0), loc=(0, 0.6, -0.06), bevel=0.02)
    box((2.4, 0.9, 0.04), rough_surface('#1E2A33', 0.45, 0.05, 30, '#16202A'), loc=(-0.25, 0, 0.02), bevel=0.015)
    # the rack: two bars and posts, brass
    for y in (-0.18, 0.18):
        box((2.1, 0.06, 0.06), brass(0.28), loc=(-0.25, y, 0.42), bevel=0.012)
    for x in (-1.25, 0.75):
        for y in (-0.18, 0.18): cyl(0.03, 0.42, brass(0.28), loc=(x, y, 0.04), bevel=0.01)
    cols = {'o': '#FF7A2E', 'b': '#3D7BFF', 'p': '#FF4FC2', 'g': '#33D67E', 't': TEAL, 'v': '#8E6BFF', 'y': '#FFC83D'}
    stacks = ['obpo', 'bpbg', 'gggt', 'ty', 'pvv']
    for i, s in enumerate(stacks):
        test_tube(-1.05 + i * 0.4, 0, [cols[c] for c in s], loc_z=0.05)
    # the pour: a tube lifted and tipped over the short stack, a stream into it
    g, _ = test_tube(0, 0, [cols['y'], cols['y']], tilt=(0, -118, 0))
    g.location = (0.58, -0.05, 1.62)
    tube([(0.2, -0.05, 1.42), (0.2, -0.05, 1.2), (0.2, -0.05, 0.98), (0.2, -0.05, 0.82)], 0.022, liquid(cols['y'], 0.5))
    # shelf of flasks behind, out of focus, catching the teal rim
    for i, (x, col) in enumerate([(-2.2, '#3D7BFF'), (-1.3, TEAL), (0.4, '#FF4FC2'), (1.6, '#33D67E'), (2.4, '#FF7A2E')]):
        rr = 0.22 + 0.05 * (i % 2)
        lathe([(0, 0), (rr * 0.7, 0.0), (rr, rr * 0.6), (rr, rr * 1.1), (0.06, rr * 2.0), (0.06, rr * 2.6), (0.0, rr * 2.6)], glass('#DDEEFF', 0.02), loc=(x, 2.6, 0.02))
        lathe([(0, 0.02), (rr * 0.65, 0.02), (rr * 0.92, rr * 0.6), (0.0, rr * 0.6)], liquid(col, 0.5), loc=(x, 2.6, 0.02))
    box((7, 0.3, 0.06), wood('#4A2E1C', '#24150B'), loc=(0, 2.6, -0.03))
    bokeh_lights((0, 7, 0.8), n=16, spread=(12, 3, 4), cols=('#FFC66B', TEAL, '#8EE8FF'))
    studio((0, 0, 0.6), key=520, rim_col=TEAL, rim=420, fill=60)
    point((0.25, -0.3, 0.85), 6, '#FFC83D', 0.05)
    hero = camera('hero', (0.9, -4.6, 1.75), (-0.05, 0, 0.7), lens=58, fstop=1.6, focus=(-0.25, -0.05, 0.6))
    tile = camera('tile', (0.6, -3.9, 1.7), (0.0, 0, 0.88), lens=50, fstop=1.8, focus=(0.0, -0.05, 0.7))
    return {'hero': hero, 'tile': tile}

SCENES = {'tubes': tubes}
