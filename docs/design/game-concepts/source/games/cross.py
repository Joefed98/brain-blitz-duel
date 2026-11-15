"""Spacewalk: hop an astronaut across space traffic to the docking deck. Station decks at the top, middle and
bottom, lanes of ships (both directions), two cargo freighter lanes, a debris lane; the astronaut on the bottom deck."""
import math, random
from lib import *

SHIP_COLS = [(0.65, 0.5, 1.0), (1.0, 0.35, 0.65), (0.2, 0.9, 0.95), (0.35, 0.95, 0.5), (1.0, 0.6, 0.15), (0.4, 0.6, 1.0)]


def ship(name, c, length, col, d, hull_m, glass_m, rnd):
    """A sleek courier: bevelled wedge hull in its colour, a dark canopy, a white nose band, an engine glow at the back."""
    L = length / 100
    w = 0.22
    par = link(bpy.data.objects.new(name, None))
    par.location = c
    par.scale = (d, 1, 1)
    body = mat(name + 'paint', col, rough=0.25, coat=1.0, emit=col, estr=0.35)
    parts = [prism(name + 'h', [(-L / 2, -w / 2), (L / 2 - 0.06, -w / 2), (L / 2, -w / 4), (L / 2, w / 4), (L / 2 - 0.06, w / 2), (-L / 2, w / 2)], -0.03, 0.04, body, 0.015)]
    parts.append(box(name + 'stripe', (L / 2 - 0.1, 0, 0.042), (0.03, w * 0.9, 0.006), hull_m, 0.002))
    parts.append(box(name + 'canopy', (L / 2 - 0.2, 0, 0.05), (0.12, w * 0.6, 0.03), glass_m, 0.012))
    parts.append(box(name + 'eng', (-L / 2 - 0.005, 0, 0.0), (0.02, w * 0.7, 0.04), emission('engine', (0.5, 0.8, 1.0), 6), 0.004))
    for p in parts:
        p.parent = par
    return par


def freighter(name, x0, x1, y, rnd, cont_mats, spine_m, d):
    tube(name + 'spine', [P(x0, y, 0.0), P(x1, y, 0.0)], 0.012, spine_m)
    x = x0
    i = 0
    while x < x1 - 20:
        w = 24
        m = cont_mats[rnd.randrange(len(cont_mats))]
        box(f'{name}c{i}', P(x + w / 2, y, 0.02), ((w - 3) / 100, 0.27, 0.08), m, 0.012)
        for yy in (-10, 0, 10):  # container ribs
            box(f'{name}r{i}{yy}', P(x + w / 2, y + yy, 0.065), ((w - 5) / 100, 0.012, 0.01), spine_m, 0.002)
        x += w
        i += 1
    cab = P(x1 if d > 0 else x0, y, 0.03)
    box(name + 'cab', cab, (0.28, 0.3, 0.1), mat('cab', (0.85, 0.86, 0.9), metal=0.4, rough=0.3, coat=0.8), 0.03)
    box(name + 'cabw', cab + Vector((0.06 * d, 0, 0.05)), (0.08, 0.22, 0.01), emission('cabw', (0.6, 0.85, 1.0), 2.0), 0.005)


def deck(name, y0, y1, plate, lights_m, rnd):
    h = (y1 - y0)
    box(name, P(195, (y0 + y1) / 2, -0.05), (3.94, h / 100, 0.08), plate, 0.01)
    for x in range(0, 391, 26):
        box(f'{name}seam{x}', P(x, (y0 + y1) / 2, -0.005), (0.006, h / 100, 0.004), mat('seam', (0.02, 0.02, 0.025), rough=0.6), 0.0)
    for x in range(13, 391, 52):
        for yy in (y0 + 4, y1 - 4):
            sphere(f'{name}l{x}{yy}', P(x, yy, 0.0), 0.009, lights_m, seg=8, ring=6)


def build(look):
    rnd = random.Random(131)
    A = look == 'A'
    reset(world=(0.0, 0.0, 0.0))
    world_gradient((0.4, 0.42, 0.5), (0.0, 0.0, 0.0), 0.3, axis='Z')
    starfield(160, -8, 131, size=(0.003, 0.007))
    if A:
        box('back', (0, 0, -0.4), (4.2, 9.0, 0.02), mat('back', (0.004, 0.005, 0.016), rough=0.6), 0)
        starfield(90, -0.38, 132, size=(0.002, 0.004))
    if not A:
        nebula_plane('neb', -14, [(0.05, 0.08, 0.3), (0.3, 0.06, 0.35)], strength=0.35, scale=0.1, seed=9.0)
    plate = mat('deckplate', (0.22, 0.24, 0.3), metal=0.6, rough=0.4, bump=(80.0, 0.08, 2))
    lights = emission('decklights', (1.0, 0.8, 0.3), 3.0)
    glass = mat('canopy', (0.02, 0.03, 0.05), rough=0.05, coat=1.0)
    white = mat('white', (0.9, 0.9, 0.92), rough=0.3)
    spine = mat('spine', (0.25, 0.26, 0.3), metal=1.0, rough=0.3)
    conts = [mat(f'cont{i}', c, rough=0.4, coat=0.5, bump=(60.0, 0.1, 2)) for i, c in enumerate(((0.35, 0.8, 0.2), (1.0, 0.45, 0.1), (0.15, 0.55, 0.9), (0.85, 0.85, 0.88), (0.55, 0.55, 0.6)))]
    deck('topdeck', 92, 128, plate, lights, rnd)
    deck('middeck', 436, 472, plate, lights, rnd)
    deck('botdeck', 748, 844, plate, lights, rnd)
    # plasma lane borders (pink) and dashed amber freighter rails
    pinkl = emission('plasma', (1.0, 0.3, 0.75), 1.6 if A else 2.6)
    amber = emission('amber', (1.0, 0.75, 0.2), 1.6)
    for (ya, yb) in ((142, 205), (578, 612)):
        box(f'band{ya}', P(195, (ya + yb) / 2, -0.06), (3.9, (yb - ya) / 100, 0.01), emission(f'bandm{ya}', (0.35, 0.08, 0.4), 0.06 if A else 0.12), 0)
    for y in (142, 345, 392, 578, 612):
        tube(f'pl{y}', [P(0, y, -0.03), P(390, y, -0.03)], 0.005, pinkl)
    for y in (350, 388, 518, 568):
        for x in range(0, 390, 16):
            box(f'am{y}{x}', P(x + 4, y, -0.03), (0.08, 0.012, 0.005), amber, 0)
    # lanes of ships: (y, direction, [(x, length)])
    lanes = [(222, 1, [(200, 80)]), (260, -1, [(45, 56), (300, 60)]), (296, 1, [(120, 66), (350, 50)]), (325, -1, [(220, 58)]),
             (412, 1, [(150, 34)]), (497, -1, [(30, 60), (250, 70)]), (595, 1, [(130, 60), (380, 50)]), (640, -1, [(40, 70), (220, 58)]),
             (690, 1, [(100, 76), (300, 66)])]
    for li, (y, d, ships) in enumerate(lanes):
        for si, (x, L) in enumerate(ships):
            col = SHIP_COLS[(li * 2 + si) % len(SHIP_COLS)]
            ship(f's{li}_{si}', P(x, y, 0.05), L, col, d, white, glass, rnd)
            if not A:
                tube(f'tr{li}{si}', [P(x - d * L / 2, y, 0.03), P(x - d * (L / 2 + 50), y, 0.03)], 0.01, emission(f'trail{li}{si}', col, 0.8))
    freighter('fr1', -10, 300, 368, rnd, conts, spine, 1)
    freighter('fr2', 110, 400, 543, rnd, conts, spine, -1)
    # debris lane
    deb = random_tint('debris', (0.25, 0.25, 0.28), (0.5, 0.5, 0.55), metal=0.7, rough=0.45)
    for i in range(22):
        x = rnd.uniform(0, 390)
        box(f'deb{i}', P(x, rnd.uniform(168, 196), 0.0), (rnd.uniform(0.05, 0.14), rnd.uniform(0.03, 0.07), 0.04), deb, 0.008,
            rot=(rnd.random(), rnd.random(), rnd.random() * 3))
    # the astronaut on the bottom deck, about to hop
    hero('astro', P(195, 722, 0.15), 1.25, white, mat('visorgold', (1.0, 0.75, 0.3), metal=1, rough=0.1), emission('vglow', (1.0, 0.8, 0.4), 2), pose='leap', rot=0.0,
         cape_m=mat('pack', (0.6, 0.62, 0.66), metal=0.6, rough=0.35))
    point('astrol', P(195, 700, 0.6), 4, (1.0, 0.95, 0.9), 0.1)
    key_light(500, (1.0, 0.97, 0.95))
    return dict(name='Spacewalk', hud=[('left', 0, 'CROSSINGS', '5'), ('right', 0, 'NO-STOP', '×3')], bloom=0.55, view='Standard')
