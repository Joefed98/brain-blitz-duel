"""Blockzone: a 10 x 20 well with a stacked mid-game board in seven neon hues, the falling piece and its ghost,
the cyan-lit well frame, and the three NEXT previews with the SPEED readout at the right."""
import math, random
from lib import *

HUES = {'T': (0.2, 0.75, 0.8), 'L': (0.5, 0.85, 0.2), 'A': (1.0, 0.55, 0.15), 'R': (0.95, 0.2, 0.25),
        'M': (0.95, 0.3, 0.75), 'V': (0.55, 0.35, 0.95), 'S': (0.8, 0.82, 0.88)}
# bottom row first; '.' empty (from the live mid-play frame, simplified)
STACK = [
    "LVMTTARMV.",
    "MSSSRRAVVM",
    "MTMTT.TAAM",
    "LLTTRRAMM.",
    ".TTAAAMM..",
    ".T....M...",
    "......M...",
]


def build(look):
    rnd = random.Random(151)
    A = look == 'A'
    reset(world=(0.0, 0.0, 0.0))
    world_gradient((0.5, 0.5, 0.6), (0.0, 0.0, 0.0), 0.1, axis='Z')
    box('back', (0, 0, -0.4), (4.2, 9.0, 0.02), mat('back', (0.003, 0.004, 0.01), rough=0.6), 0)
    x0, y1, cs = 8, 740, 32.0
    y0 = y1 - cs * 20
    well = mat('well', (0.004, 0.012, 0.02), rough=0.2, coat=0.6, emit=(0.05, 0.3, 0.4), estr=0.03 if A else 0.06)
    box('wellback', P(x0 + cs * 5, (y0 + y1) / 2, -0.2), (cs * 10 / 100, cs * 20 / 100, 0.02), well, 0)
    gridl = emission('wgrid', (0.2, 0.6, 0.7), 0.05 if A else 0.09)
    for i in range(11):
        plane(f'wg{i}', P(x0 + cs * i, (y0 + y1) / 2, -0.185), 0.003, cs * 20 / 100, gridl)
    for j in range(21):
        plane(f'wh{j}', P(x0 + cs * 5, y0 + cs * j, -0.185), cs * 10 / 100, 0.003, gridl)
    frame = mat('frame', (0.2, 0.7, 0.8), metal=1.0, rough=0.2)
    neon = emission('wneon', (0.25, 0.9, 1.0), 2.0 if A else 3.2)
    corners = [P(x0 - 3, y0 - 3, -0.12), P(x0 + cs * 10 + 3, y0 - 3, -0.12), P(x0 + cs * 10 + 3, y1 + 3, -0.12), P(x0 - 3, y1 + 3, -0.12), P(x0 - 3, y0 - 3, -0.12)]
    tube('wframe', corners, 0.016, frame)
    tube('wneon', [c + Vector((0, 0, 0.02)) for c in corners], 0.005, neon)
    if not A:
        fade_glow('wellglow', P(x0 + cs * 5, y1 - 160, -0.18), cs * 10 / 100, 3.2, (0.2, 0.7, 0.9), 0.12, power=1.5)
    mats = {k: mat(f'blk{k}', tuple(c * 0.55 for c in v), rough=0.18, coat=0.5, emit=v, estr=0.2 if A else 0.35) for k, v in HUES.items()}
    inset = {k: mat(f'ins{k}', tuple(c * 0.35 for c in v), rough=0.3, emit=v, estr=0.06 if A else 0.12) for k, v in HUES.items()}

    def block(name, cx, cy, m, z=0.0, ghost=False):
        c = P(x0 + cs * (cx + 0.5), y1 - cs * (cy + 0.5), z)
        if ghost:
            pts = [c + Vector((sx * 0.135, sy * 0.135, 0.0)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1), (-1, -1))]
            tube(name, pts, 0.006, m)
            return
        box(name, c, ((cs - 2.5) / 100, (cs - 2.5) / 100, 0.18), m, 0.05, segs=1)
        box(name + 'face', c + Vector((0, 0, 0.088)), ((cs - 14) / 100, (cs - 14) / 100, 0.006), inset[m.name[3:]] if m.name.startswith('blk') else m, 0.002)

    for r, row in enumerate(STACK):
        for cidx, ch in enumerate(row):
            if ch != '.':
                block(f'b{r}_{cidx}', cidx, r, mats[ch], z=-0.08)
    # a tall right-hand tower (as today) on column 6 already in STACK; falling piece (teal L) near the top
    piece = [(1, 19), (2, 19), (2, 18), (2, 17)]
    for i, (cx, cy) in enumerate(piece):
        block(f'p{i}', cx, cy, mats['T'], z=-0.06)
    ghost_m = emission('ghost', (0.3, 0.9, 1.0), 1.2 if A else 2.0)
    for i, (cx, cy) in enumerate(piece):
        block(f'g{i}', cx, cy - 12, ghost_m, z=-0.12, ghost=True)
    # NEXT panel at the right: three glass trays with the next pieces
    tray = mat('tray', (0.01, 0.03, 0.05), rough=0.1, coat=1.0, emit=(0.1, 0.4, 0.6), estr=0.05)
    trayedge = emission('trayedge', (0.4, 0.5, 1.0), 1.2)
    nexts = [('V', [(0, 0), (1, 0), (2, 0), (0, 1)]), ('R', [(0, 0), (1, 0), (1, 1), (2, 1)]), ('R', [(0, 1), (1, 1), (1, 0), (2, 0)])]
    for k, (hue, cells) in enumerate(nexts):
        ty = 150 + k * 62
        box(f'tray{k}', P(359, ty, -0.1), (0.5, 0.5, 0.04), tray, 0.03)
        pts = [P(359 + sx * 25, ty + sy * 25, -0.07) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1), (-1, -1))]
        tube(f'trayedge{k}', pts, 0.004, trayedge if k == 0 else emission('trayedge2', (0.3, 0.4, 0.8), 0.6))
        sc = 11.0
        for (cx, cy) in cells:
            c = P(359 + (cx - 1) * sc, ty - (cy - 0.5) * sc, -0.05)
            box(f'n{k}{cx}{cy}', c, ((sc - 1.5) / 100, (sc - 1.5) / 100, 0.06), mats[hue], 0.015)
    key_light(320, (1.0, 0.97, 0.95))
    area('rim', (6, -4, 5), 120, 4, (0.4, 0.8, 1.0))

    def overlay(img, sc_, look_):
        from PIL import ImageDraw, ImageFont
        d = ImageDraw.Draw(img, 'RGBA')
        f = ImageFont.truetype('/home/user/brain-blitz-duel/public/fonts/archivo-var-latin.woff2', int(9 * sc_)); f.set_variation_by_name(b'Bold')
        f2 = ImageFont.truetype('/home/user/brain-blitz-duel/public/fonts/archivo-var-latin.woff2', int(15 * sc_)); f2.set_variation_by_name(b'ExtraBold')
        d.text((359 * sc_, 112 * sc_), 'NEXT', font=f, fill=(200, 205, 220), anchor='mm')
        d.text((359 * sc_, 345 * sc_), 'SPEED', font=f, fill=(200, 205, 220), anchor='mm')
        d.text((359 * sc_, 365 * sc_), '4/6', font=f2, fill=(245, 245, 250), anchor='mm')
    return dict(name='Blockzone', hud=[('left', 0, 'LINES', '19'), ('right', 0, 'PIECES', '60')], bloom=0.55, view='Standard', overlay=overlay)
