"""Gemstone (matchup, matchupRev 12): match-3 on 7 x 10, six colour goals above, six treasures, ice, counts below.
Today: a purple starry backdrop, a near-black board of cells, six faceted stones (yellow round, red square,
green rhombus, blue triangle, purple star, pink hexagon), a bronze treasure coin, frosted ice cells.

A "Today, upgraded": the same scene with real cut stones (refraction, fire), a glassy black board under a soft key.
B "Bolder": a deeper nebula, obsidian cells with bevels, a gold rim, a hard sparkle light.
C "Jeweller's tray": the board as a purple velvet tray with brass dividers under a warm loupe light."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import *

GRID = [
    "YRYGBPG",
    "BPPKGPR",
    "RRGYBBR",
    "KGYGRGG",
    "RYGBYBK",
    "GYPYKGG",
    "KBKYRBB",
    "RPPGPGY",
    "KYRBTBR",
    "PYRRKPG",
]
ICE = {(9, 5), (9, 6)}
GOALS = "KGGBBGR"
COUNTS = [("Y", "32"), ("R", "23"), ("B", "10"), ("G", "✓"), ("P", "2"), ("K", "21")]
BX0, BY0, CW, CH = 11, 160, 52.57, 53.3


def cell_c(r, c):
    return BX0 + CW * (c + 0.5), BY0 + CH * (r + 0.5)


def build(look):
    reset(samples=160 if look != "A" else 128, view="AgX", look="AgX - Punchy", exposure=-0.2)
    s = bpy.context.scene
    s.cycles.max_bounces = 12
    s.cycles.transmission_bounces = 12
    s.cycles.caustics_refractive = True
    s.cycles.blur_glossy = 0.5
    if look == "A":
        sky = stars_image(780, 1688, (36, 20, 64), (18, 11, 36), n=160,
                          glow=[(150, 900, 420, (70, 42, 96), 0.6)])
    elif look == "B":
        sky = stars_image(780, 1688, (40, 14, 70), (10, 6, 26), n=260,
                          glow=[(80, 300, 420, (150, 40, 150), 0.7), (720, 1400, 520, (60, 40, 170), 0.8),
                                (600, 120, 300, (90, 50, 180), 0.6)])
    else:
        sky = stars_image(780, 1688, (30, 16, 54), (14, 8, 30), n=90,
                          glow=[(390, 800, 600, (60, 30, 90), 0.5)])
    backdrop("gem-sky-" + look, sky, z=-0.3, emit=1.5)
    world_color((40, 30, 70), 0.25)

    # board slab
    bw, bh = CW * 7, CH * 10
    bcx, bcy = BX0 + bw / 2, BY0 + bh / 2
    if look == "A":
        rim_m = mat("gem-rim", (92, 80, 126), rough=0.3, metal=0.8)
        cell_m = mat("gem-cell", (9, 9, 15), rough=0.6, coat=0.15, coat_rough=0.4)
        base_m = mat("gem-base", (4, 4, 8), rough=0.8)
    elif look == "B":
        rim_m = gold("gem-gold", CHAMP, 0.18)
        cell_m = mat("gem-obsidian", (3, 2, 6), rough=0.45, spec=0.15, coat=0.4, coat_rough=0.08)
        base_m = emission("gem-seam-b", (128, 70, 230), 1.0)
    else:
        rim_m = gold("gem-brass", (200, 152, 82), 0.3)
        cell_m = felt("gem-velvet", (70, 24, 120), scale=1200, sheen=1.0, bump=0.5)
        base_m = felt("gem-velvet-d", (40, 12, 70), scale=1200, sheen=1.0)
    plate("rim", u(bw + 10), u(bh + 10), u(3), u(14), mat_=rim_m, loc=P(bcx, bcy, -u(3)), edge=u(1.2))
    plate("base", u(bw + 2), u(bh + 2), u(3.2), u(10), mat_=base_m, loc=P(bcx, bcy, -u(3)))
    for r in range(10):
        for c in range(7):
            x, y = cell_c(r, c)
            if look == "B":
                plate("cell", u(CW - 3.5), u(CH - 3.5), u(3.4), u(5), mat_=cell_m, loc=P(x, y, -u(3)))
            elif look == "C":
                plate("cell", u(CW - 3), u(CH - 3), u(2.8), u(4), mat_=cell_m, loc=P(x, y, -u(3)))
            else:
                plate("cell", u(CW - 3), u(CH - 3), u(3.4), u(6), mat_=cell_m, loc=P(x, y, -u(3)),
                      edge=u(1.0 if look == "B" else 0.5))
    if look == "C":
        brass = gold("gem-divider", (206, 160, 88), 0.25)
        for c in range(8):
            rbox("dv", u(2.4), u(bh), u(2.2), r=u(0.8), mat_=brass, loc=P(BX0 + CW * c, bcy, u(0.6)))
        for r in range(11):
            rbox("dh", u(bw), u(2.4), u(2.2), r=u(0.8), mat_=brass, loc=P(bcx, BY0 + CH * r, u(0.6)))
    # stones
    for r, row in enumerate(GRID):
        for c, k in enumerate(row):
            x, y = cell_c(r, c)
            size = 40 if k in "YRK" else 42
            if k == "T":
                size = 38
            gem(k, x, y, size, look, z=u(0.6))
    for (r, c) in ICE:
        x, y = cell_c(r, c)
        ice = mat("ice", (210, 232, 255), rough=0.55, trans=0.85, ior=1.31, emit=(170, 200, 240), emit_str=0.25)
        rbox("ice", u(CW - 6), u(CH - 6), u(30), r=u(5), mat_=ice, loc=P(x, y, u(14)))
    # goal strip
    gm = (mat("goal-glass", (120, 90, 170), rough=0.25, trans=0.6, ior=1.4) if look == "A" else
          (mat("goal-b", (30, 14, 50), rough=0.15, coat=1) if look == "B" else gold("goal-brass", (196, 150, 84), 0.32)))
    plate("goals", u(370), u(34), u(2), u(10), mat_=gm, loc=P(195, 139, -u(1)), edge=u(0.8))
    if look != "C":
        frame_ring(195, 139, 372, 36, 1.4, mat("goal-edge", (170, 150, 220), rough=0.3, metal=0.6) if look == "A"
                   else rim_m)
    for i, k in enumerate(GOALS):
        gem(k, cell_c(0, i)[0], 139, 20, look, z=u(1.2))
    # bottom panel
    pm = mat("panel", (20, 16, 34), rough=0.35, coat=0.4) if look != "C" else felt("panel-v", (54, 22, 78), 1100)
    plate("panel", u(372), u(76), u(2), u(14), mat_=pm, loc=P(195, 748, -u(1)), edge=u(1))
    frame_ring(195, 748, 374, 78, 1.4, rim_m if look != "A" else mat("goal-edge2", (110, 96, 150), rough=0.3, metal=0.6))
    for i, (k, _) in enumerate(COUNTS):
        gem(k, 26 + 62 * i, 758, 18, look, z=u(1.2))
        bar_c = GEM_COLOURS[k]
        rbox("bar", u(44), u(3), u(1), r=u(1.4), mat_=emission("bar-" + k, bar_c, 1.6), loc=P(43 + 62 * i, 778, u(1.6)))

    # light: a soft key from the top left, small sparkle lights to throw glints off facets
    if look == "A":
        area(P(-80, 120, 12), P(195, 420, 0), size=6, energy=520, color=(255, 244, 236), spread=80)
        area(P(460, 700, 10), P(195, 420, 0), size=8, energy=120, color=(200, 190, 255))
        for (x, y) in ((60, 260), (330, 520), (200, 120)):
            point(P(x, y, 4), 30, (255, 255, 255), 0.02)
    elif look == "B":
        area(P(-60, 80, 14), P(195, 420, 0), size=2.5, energy=800, color=(255, 240, 226), spread=60)
        area(P(460, 900, 6), P(195, 500, 0), size=6, energy=220, color=(170, 110, 255))
        for (x, y) in ((40, 220), (340, 380), (120, 560), (300, 660), (200, 160)):
            point(P(x, y, 6), 25, (255, 255, 255), 0.01)
    else:
        sp = area(P(150, 300, 12), P(195, 430, 0), size=3.5, energy=520, color=(255, 242, 228), spread=60)
        area(P(420, 900, 8), P(195, 430, 0), size=8, energy=120, color=(190, 170, 255))
        for (x, y) in ((80, 300), (300, 520), (180, 200)):
            point(P(x, y, 3), 25, (255, 240, 220), 0.01)
    cam_top(ortho=False, lens=200, tilt=2)

    def post(im):
        im = pills_at(im, [("Score", 64, False), ("Goals", "1/6", False)], 101)
        im = pills_at(im, [("Next drops", "↓", False)], 101, right=True)
        im = pills_at(im, [("Ice", 2, False), ("Treasure", "0/6", False), ("Big lines", 1, False)], 727, x0=20)
        from PIL import ImageDraw
        k = im.size[1] / H
        d = ImageDraw.Draw(im)
        f = font(800, int(14 * k))
        for i, (_, v) in enumerate(COUNTS):
            x = (38 + 62 * i) * k
            if v == "\u2713":
                d.line([(x + 1 * k, 758 * k), (x + 5 * k, 762 * k), (x + 12 * k, 752 * k)], fill=(90, 220, 140), width=int(2.6 * k))
            else:
                d.text((x, 758 * k), v, font=f, fill=(246, 244, 252), anchor="lm")
        if look == "B":
            im = vignette(0.35)(im)
        return im
    return dict(post=post)


def frame_ring(x, y, w, h, t, m, r=12):
    outer = plate("fo", u(w), u(h), u(0.6), u(r), mat_=m, loc=P(x, y, 0))
    inner = plate("fi", u(w - 2 * t), u(h - 2 * t), u(4), u(r - t), loc=P(x, y, -u(1)))
    b = outer.modifiers.new("cut", "BOOLEAN")
    b.object = inner
    b.operation = "DIFFERENCE"
    inner.hide_render = True


run("strategy", "matchup", ["A", "B", "C"], build)
