"""Attention: concept scenes, one function per live game, each taking the look:

  a  "Today, upgraded": today's plum room, charcoal panels with pink edges, gold actions and each game's own
     pieces, made of real things (a steel bomb with insulated wires and brass posts, enamel sea creatures on oak
     shelves, slate tiles with cast eagles, foil-backed cards, a brushed-metal maze with a gold thread).
  b  "Bolder": the same, darker and more dramatic: lacquer and polished metal, magenta edge light, more glare.

Layouts come from docs/design/game-reviews/img/attention/ measured on a 390 x 844 grid.
"""
import math
import random

from lib import (width, area, box, cbox, disc, dof, emissive, glass, ground, hexc, key_light, mat, metal, outline, poly,
                 prism, rbox, reflector, ring, sphere, text, tube, world, wood)
from word import button, pill, tile


def palette(look):
    a = look == "a"
    return dict(
        ground=mat("at_bg" + look, hexc("#1C0B1A" if a else "#120610"), rough=0.75, sheen=0.4, bump=0.03,
                   bump_scale=1200),
        tray=mat("at_tray" + look, hexc("#221A22" if a else "#18121A"), rough=0.4 if a else 0.18,
                 coat=0.4 if a else 0.9, coat_rough=0.12),
        rim=mat("at_rim", hexc("#7A3768"), rough=0.35, coat=0.5) if a else emissive("at_rimb", hexc("#FF4FC0"), 1.4),
        well=mat("at_well" + look, hexc("#0E090E"), rough=0.6),
        tile=mat("at_tile" + look, hexc("#2A262D" if a else "#1B181E"), rough=0.3 if a else 0.1, coat=0.7 if a else 1,
                 coat_rough=0.05),
        tile_dim=mat("at_tdim" + look, hexc("#1D191E" if a else "#141116"), rough=0.4, coat=0.4),
        ink=mat("at_ink", hexc("#F4F1F6"), rough=0.35),
        ink_dim=mat("at_inkd", hexc("#8B7F8D"), rough=0.4),
        gold=mat("at_gold", hexc("#F4B530"), rough=0.3, metal=0.35, coat=0.7, coat_rough=0.06, rough_var=0.05) if a
        else metal("at_goldb", hexc("#F7BE45"), rough=0.14, aniso=0.2),
        gold_ink=mat("at_goldink", hexc("#160E04"), rough=0.4),
        gold_text=mat("at_goldt", hexc("#F4B73E"), rough=0.35) if a else emissive("at_goldtb", hexc("#FFC34D"), 1.4),
        blue=emissive("at_pink" + look, hexc("#FF5CC6"), 2.2 if a else 5.0),
        blue_text=mat("at_pinkt", hexc("#FF6FCB"), rough=0.35),
        pink=mat("at_pinkm" + look, hexc("#F25DBF"), rough=0.3, coat=0.8, coat_rough=0.05),
        teal=mat("at_teal", hexc("#2FD0B4"), rough=0.3, coat=0.7),
        red=mat("at_red", hexc("#D9343E"), rough=0.3, coat=0.7),
        label=mat("at_label", hexc("#D9CEDC"), rough=0.4),
        navy_btn=mat("at_btn" + look, hexc("#241D26"), rough=0.35, coat=0.5),
    )


def light(look):
    if look == "a":
        world("studio", 0.16, rot=0.6, tint=(1.0, 0.8, 0.95, 1))
        key_light(1200, warm=(1.0, 0.96, 0.93), fill=0.18)
        reflector(0.9, (1.0, 0.94, 0.97))
    else:
        world("night", 0.1, rot=0.6, tint=(1.0, 0.6, 0.9, 1))
        key_light(800, warm=(1.0, 0.94, 0.9), fill=0.05)
        area(560, 80, 120, 500, 900, (1.0, 0.4, 0.8), target=(195, 450))  # magenta rim from the right
        area(-180, 760, 120, 400, 500, (0.6, 0.45, 1.0), target=(195, 450))  # violet kicker from the lower left
        reflector(1.1, (1.0, 0.94, 0.9))


def finish(look):
    dof(10, 5.6 if look == "a" else 3.5)


def progress(pal, y, done, total=4, x0=16, x1=374):
    w = (x1 - x0 - (total - 1) * 6) / total
    for i in range(total):
        rbox(x0 + w / 2 + i * (w + 6), y, w, 5, 1.5, pal["blue"] if i < done else pal["tile_dim"], r=2.5, bevel=0.5)


# ------------------------------------------------------------------------------------------------ bomb


def bomb(look):
    """Bomb Defusal: the six clues, the device with wires 4 and 6 cut, A and B, DEFUSE."""
    pal = palette(look)
    a = look == "a"
    light(look)
    ground(pal["ground"])
    # The clue card.
    card = mat("bm_card" + look, hexc("#1E1B20" if a else "#141116"), rough=0.5, coat=0.3)
    rbox(195, 228, 366, 264, 3, card, r=14, bevel=1)
    outline(195, 228, 366, 264, 14, 1.2, 3.4, pal["tile_dim"])
    chip = {"y": mat("bm_y", hexc("#F5D90A"), rough=0.3, coat=0.6), "g": mat("bm_g", hexc("#36C46A"), rough=0.3, coat=0.6),
            "w": mat("bm_w", hexc("#F2F2F2"), rough=0.3, coat=0.6), "b": mat("bm_b", hexc("#4C86F0"), rough=0.3, coat=0.6),
            "k": mat("bm_k", hexc("#1A1A1C"), rough=0.3, coat=0.6)}
    lines = [
        (124, [("1.", "n"), ("Step 2:", "t"), ("y", "c"), ("press A.", "b")]),
        (150, [("2.", "n"), ("Cut", "t"), ("g", "c"), ("wire 4", "b"), ("at some point before you cut", "t")]),
        (172, [("b", "c"), ("wire 1.", "b")]),
        (198, [("3.", "n"), ("Cut", "t"), ("w", "c"), ("wire 7", "b"), ("at some point before you cut", "t")]),
        (220, [("k", "c"), ("wire 2.", "b")]),
        (246, [("4.", "n"), ("Cut", "t"), ("g", "c"), ("wire 4", "b"), ("at some point before you cut", "t")]),
        (268, [("w", "c"), ("wire 7.", "b")]),
        (294, [("5.", "n"), ("Step 5: cut", "t"), ("k", "c"), ("wire 2.", "b")]),
        (320, [("6.", "n"), ("Cut", "t"), ("b", "c"), ("wire 6,", "b"), ("then", "t"), ("y", "c"), ("press A", "b"),
               ("as the very", "t")]),
        (342, [("next step.", "t")]),
    ]
    for y, parts in lines:
        x = 26
        for s, kind in parts:
            if kind == "c":
                rbox(x + 7, y, 14, 9, 2, chip[s], r=2, bevel=0.5, z=3)
                x += 18
                continue
            m = pal["gold_text"] if kind == "n" else pal["ink"] if kind == "b" else pal["label"]
            ob = text(s, x, y, 7.6, m, fnt="archivo" if kind != "t" else "archivo6", z=3, depth=0.3, align="LEFT")
            x += width(ob) + 4.5
    # The device: a brushed steel case with screws and a hazard strip.
    case = metal("bm_case" + look, hexc("#3A3D44" if a else "#2A2C33"), rough=0.32 if a else 0.22)
    face = mat("bm_face" + look, hexc("#17161A" if a else "#0F0E12"), rough=0.45 if a else 0.2, coat=0.5)
    rbox(195, 561, 370, 380, 10, case, r=18, bevel=3)
    rbox(195, 566, 352, 356, 11, face, r=12, bevel=1.5)
    for sx, sy in ((26, 386), (364, 386), (26, 738), (364, 738)):
        disc(sx, sy, 4.5, 11.5, metal("bm_screw", hexc("#9AA0AA"), rough=0.25, brushed=False), bevel=1.5)
        tube([(sx - 3, sy - 3, 11.8), (sx + 3, sy + 3, 11.8)], 0.6, pal["well"])
    for i in range(10):
        x = 85 + i * 22
        prism([(-6, -3), (6, -3), (10, 3), (-2, 3)], 1.5, chip["y"] if i % 2 == 0 else chip["k"], z=11, cx=x, cy=375,
              bevel=0.3)
    # The display: red LEDs behind smoked glass, the serial and the light switch.
    rbox(125, 393, 60, 22, 11.5, mat("bm_lcdbg", hexc("#1A0303"), rough=0.2), r=3, bevel=0.6)
    text("01:27", 125, 393.5, 10, emissive("bm_led" + look, hexc("#FF2A1E"), 6 if a else 9), z=11.6, depth=0.2,
         fnt="archivo")
    rbox(234, 393, 40, 20, 11.5, pal["tile_dim"], r=3, bevel=0.8)
    text("350", 234, 393.5, 8.5, pal["ink"], z=11.6, depth=0.2)
    rbox(337, 393, 46, 18, 11.5, pal["well"], r=9, bevel=1)
    disc(346, 393, 7, 4, pal["gold"], z=11.5, bevel=1.5)
    # The seven wires: insulated cable in its colour, copper ends in brass posts; 4 and 6 are cut.
    cols = {"blue": hexc("#3F7BE8"), "black": hexc("#45454D"), "green": hexc("#33B867"), "yellow": hexc("#F2D60B"),
            "white": hexc("#EDEDED")}
    order = ["blue", "black", "blue", "green", "yellow", "blue", "white"]
    brass = metal("bm_brass", hexc("#C99B48"), rough=0.25)
    copper = metal("bm_copper", hexc("#D07A4A"), rough=0.3, brushed=False)
    for i, c in enumerate(order):
        y = 427 + i * 41
        text(str(i + 1), 33, y, 8.5, pal["label"], z=11, depth=0.3)
        for x in (46, 364):
            disc(x, y, 5, 19, brass, z=11, bevel=1)
            ring(x, y, 6.5, 4.8, 13, brass, z=11)
        wm = mat("bm_wire_" + c + look, cols[c], rough=0.35 if a else 0.18, coat=0.4 if a else 0.9, coat_rough=0.1)
        if i in (3, 5):
            for x0, x1 in ((48, 190), (220, 362)):
                tube([(x0, y, 17), (x1, y, 17)], 3.4, wm)
            for x in (190, 220):
                tube([(x - 3 if x == 190 else x - 3, y, 17), (x + 3 if x == 190 else x + 3, y, 17)], 1.5, copper)
        else:
            tube([(48, y, 17), (130, y, 17.4), (260, y, 17.2), (362, y, 17)], 3.4, wm)
    # Buttons A and B: domed caps in bezels.
    for x, c, lab in ((165, "#F5D90A", "A"), (225, "#4C86F0", "B")):
        ring(x, 720, 24, 20, 13, case, z=11)
        sphere(x, 720, 20, mat("bm_btn" + lab + look, hexc(c), rough=0.25 if a else 0.1, coat=1, coat_rough=0.04),
               z=11, squash=0.45)
        text(lab, x, 720.5, 9, pal["gold_ink"] if lab == "A" else pal["ink"], z=20.5, depth=0.3)
    button(pal, 48, 765, 212, 50, "DEFUSE", kind="gold")
    rbox(338, 790, 78, 50, 6, pal["navy_btn"], r=10, bevel=2)
    outline(338, 790, 78, 50, 10, 1.6, 6.4, pal["blue"])
    pts = [(338 + 8 * math.cos(math.radians(a_)), 790 + 8 * math.sin(math.radians(a_)), 6.6) for a_ in range(-60, 230, 15)]
    tube(pts, 1.1, pal["blue_text"])
    finish(look)


# ----------------------------------------------------------------------------------------------- tally


def shape_pts(kind, r):
    if kind == "hex":
        return poly(6, r, rot=0)
    if kind == "tri":
        return poly(3, r * 1.15, rot=math.pi / 2 if random.random() < 0.5 else -math.pi / 2)
    if kind == "star":
        return poly(5, r * 1.2, star=r * 0.5)
    if kind == "pent":
        return poly(5, r)
    if kind == "sq":
        return poly(4, r * 1.2, rot=math.pi / 4 + random.uniform(-0.4, 0.4))
    return poly(40, r)


def countup(look):
    """Tally, stage 4: "How many more purple than green?" over a tray of 110 shapes; 88 typed."""
    pal = palette(look)
    a = look == "a"
    light(look)
    ground(pal["ground"])
    progress(pal, 84, 3)
    text("HOW MANY MORE PURPLE THAN GREEN?", 195, 119, 7.8, pal["label"], depth=0.3, spacing=1.15)
    felt_ = mat("ty_tray" + look, hexc("#2A1E2C" if a else "#1C121E"), rough=0.85, sheen=0.7, bump=0.08,
                bump_scale=1400)
    rbox(195, 406, 374, 530, 8, mat("ty_frame" + look, hexc("#2B262E"), rough=0.3, coat=0.8), r=18, bevel=3)
    rbox(195, 406, 360, 516, 8.5, felt_, r=13, bevel=1)
    cols = ["#EF3E4A", "#F58A35", "#FF68CF", "#A564F2", "#2FD56A", "#F4F4F6"]
    mats = [mat(f"ty_c{i}{look}", hexc(c), rough=0.32 if a else 0.15, coat=0.8 if a else 1, coat_rough=0.05,
                rough_var=0.04) for i, c in enumerate(cols)]
    kinds = ["hex", "tri", "star", "pent", "sq", "circ"]
    rng = random.Random(4)
    random.seed(4)
    placed = []
    n = 0
    while n < 84:
        if rng.random() < 0.4:  # the heap in the middle
            x, y = rng.gauss(210, 55), rng.gauss(440, 60)
        else:
            x, y = rng.uniform(30, 360), rng.uniform(170, 640)
        if not (24 < x < 366 and 160 < y < 652):
            continue
        r = rng.uniform(12, 20)
        z = 8.5 + sum(3.2 for (px, py, pr) in placed if (px - x) ** 2 + (py - y) ** 2 < (pr + r) ** 2 * 0.8)
        z = min(z, 8.5 + 3.2 * 4)
        placed.append((x, y, r))
        k = rng.choice(kinds)
        m = mats[rng.randrange(6)]
        if k == "circ":
            disc(x, y, r, 4, m, z=z, bevel=1.4, verts=48)
        else:
            prism(shape_pts(k, r), 4, m, z=z, cx=x, cy=y, rot=rng.uniform(-0.5, 0.5), bevel=1.2)
        n += 1
    # The answer and the pad.
    rbox(150, 706, 276, 40, 3, pal["well"], r=10, bevel=1)
    text("88", 150, 706.5, 13, pal["ink"], z=3, depth=0.4)
    button(pal, 297, 685, 81, 42, "ENTER", kind="gold", size=9)
    for i, lab in enumerate("123456"):
        tile(pal, 43 + i * 61, 758, 56, lab, d=7, size=12, sh=42)
    for i, lab in enumerate(["7", "8", "9", "0", ""]):
        tile(pal, 43 + i * 61, 806, 56, lab, d=7, size=12, sh=42)
    prism([(-10, 0), (-4, -6), (9, -6), (9, 6), (-4, 6)], 1.0, pal["ink"], z=7, cx=287, cy=806, bevel=0.3)
    finish(look)


# ------------------------------------------------------------------------------------------------- maze


def make_maze(cols, rows, seed=7):
    rng = random.Random(seed)
    walls = {(c, r): {"N", "S", "E", "W"} for c in range(cols) for r in range(rows)}
    seen = {(0, 0)}
    stack = [(0, 0)]
    d = {"N": (0, -1), "S": (0, 1), "E": (1, 0), "W": (-1, 0)}
    opp = {"N": "S", "S": "N", "E": "W", "W": "E"}
    while stack:
        c, r = stack[-1]
        nb = [(k, c + dx, r + dy) for k, (dx, dy) in d.items() if (c + dx, r + dy) in walls and (c + dx, r + dy) not in seen]
        if not nb:
            stack.pop()
            continue
        k, nc, nr = rng.choice(nb)
        walls[(c, r)].discard(k)
        walls[(nc, nr)].discard(opp[k])
        seen.add((nc, nr))
        stack.append((nc, nr))
    # The route from the start to the exit.
    prev = {(0, 0): None}
    q = [(0, 0)]
    while q:
        cur = q.pop(0)
        for k, (dx, dy) in d.items():
            if k not in walls[cur]:
                nx = (cur[0] + dx, cur[1] + dy)
                if nx not in prev:
                    prev[nx] = cur
                    q.append(nx)
    route, cur = [], (cols - 1, rows - 1)
    while cur:
        route.append(cur)
        cur = prev[cur]
    return walls, route[::-1]


def maze(look):
    """Labyrinth: the 19 x 23 maze, 68 steps of the route traced in gold, the exit glowing bottom right."""
    pal = palette(look)
    a = look == "a"
    light(look)
    ground(pal["ground"])
    pill(pal, 160, 176, 72, 22, "Steps", "68", size=8, vcol=pal["ink"])
    pill(pal, 236, 176, 62, 22, "Par", "120", size=8, vcol=pal["blue_text"])
    cols, rows = 19, 23
    x0, y0, x1, y1 = 16, 196, 375, 672
    cw, ch = (x1 - x0) / cols, (y1 - y0) / rows
    floor = mat("mz_floor" + look, hexc("#1F2027" if a else "#121218"), rough=0.6 if a else 0.35, rough_var=0.15,
                bump=0.04, bump_scale=900)
    rbox(195, 434, 372, 490, 6, mat("mz_frame" + look, hexc("#2A262D"), rough=0.3, coat=0.7), r=14, bevel=2.5)
    box(x0, y0, x1 - x0, y1 - y0, 6.5, floor, bevel=0.5)
    wallm = mat("mz_wall" + look, hexc("#BFC3CC" if a else "#D5D9E2"), rough=0.35 if a else 0.2, metal=0.5,
                coat=0.4 if a else 0.9, coat_rough=0.1)
    walls, route = make_maze(cols, rows)
    t = 2.2
    segs = set()
    for (c, r), ws in walls.items():
        X, Y = x0 + c * cw, y0 + r * ch
        if "N" in ws:
            segs.add((X, Y, X + cw, Y))
        if "W" in ws:
            segs.add((X, Y, X, Y + ch))
        if "S" in ws:
            segs.add((X, Y + ch, X + cw, Y + ch))
        if "E" in ws:
            segs.add((X + cw, Y, X + cw, Y + ch))
    for (ax, ay, bx, by) in segs:
        if ay == by:
            box(ax - t / 2, ay - t / 2, bx - ax + t, t, 6, wallm, z=6.5, bevel=0.6, segs=2)
        else:
            box(ax - t / 2, ay - t / 2, t, by - ay + t, 6, wallm, z=6.5, bevel=0.6, segs=2)
    goldline = emissive("mz_path" + look, hexc("#F5B530"), 2.0 if a else 3.5)
    path = route[:69]
    tube([(x0 + (c + 0.5) * cw, y0 + (r + 0.5) * ch, 8.5) for c, r in path], 1.7, goldline)
    hx, hy = path[-1]
    sphere(x0 + (hx + 0.5) * cw, y0 + (hy + 0.5) * ch, 5.5, metal("mz_ball", hexc("#F7C24E"), rough=0.12,
                                                                  brushed=False), z=12)
    box(x0 + 1.5, y0 + 1.5, cw - 3, ch - 3, 1, mat("mz_start", hexc("#2AA6A0"), rough=0.4), z=6.5, bevel=0.3)
    ex, ey = x0 + (cols - 0.5) * cw, y0 + (rows - 0.5) * ch
    cbox(ex, ey, cw - 5, ch - 5, 2, pal["gold"], z=6.5, bevel=0.6)
    # The pad: the gold puck and the pink hint button.
    disc(167, 802, 36, 3, pal["well"], bevel=1)
    sphere(167, 802, 17, pal["gold"], z=4, squash=0.5)
    rbox(348, 802, 42, 52, 7, pal["pink"], r=6, bevel=2)
    disc(348, 795, 3, 1.5, pal["gold_ink"], z=7, bevel=0.4)
    rbox(348, 808, 9, 3, 1.5, pal["gold_ink"], z=7, r=1, bevel=0.3)
    finish(look)


# ------------------------------------------------------------------------------------------ matchmaker


def clip_line(o, sg, hw, hh):
    """The part of the line y = sg * x + o inside |x| <= hw, |y| <= hh, or None."""
    pts = []
    for x in (-hw, hw):
        y = sg * x + o
        if -hh <= y <= hh:
            pts.append((x, y))
    for y in (-hh, hh):
        x = (y - o) / sg
        if -hw <= x <= hw:
            pts.append((x, y))
    pts = sorted(set(pts))
    return (pts[0], pts[-1]) if len(pts) >= 2 and pts[0] != pts[-1] else None


def pairmatch(look):
    """Matchmaker: 30 cards face down with pink foil backs, two turned up mid-flip."""
    pal = palette(look)
    a = look == "a"
    light(look)
    ground(pal["ground"])
    for x, lab, val, w in ((115, "Flips", "5", 64), (190, "Streak", "0", 72), (264, "Gold", "25s", 68)):
        pill(pal, x, 113, w, 22, lab, val, size=8, vcol=pal["ink"])
    rbox(195, 479, 374, 398, 5, pal["tray"], r=18, bevel=2)
    outline(195, 479, 374, 398, 18, 1.2, 5.6, pal["tile_dim"])
    back = mat("mm_back" + look, hexc("#4A1F45" if a else "#3A1236"), rough=0.35, coat=0.9 if a else 1, coat_rough=0.06)
    foil = metal("mm_foil" + look, hexc("#E676C9" if a else "#FF6CD2"), rough=0.3 if a else 0.18)
    face = mat("mm_face" + look, hexc("#25202A" if a else "#1A161D"), rough=0.3, coat=0.7)
    for r in range(5):
        for c in range(6):
            x, y = 42 + c * 61.5, 325 + r * 75.5
            up = (c, r) in ((0, 4), (3, 1))
            rbox(x, y, 54, 66, 4, face if up else back, r=6, bevel=1.5, z=5)
            if up:
                outline(x, y, 54, 66, 6, 1.4, 4.4, pal["tile_dim"], z=5)
                if (c, r) == (0, 4):
                    prism(poly(3, 16), 3, pal["pink"], z=9, cx=x, cy=y + 3, bevel=1)
                else:
                    disc(x, y, 14, 3, mat("mm_teal", hexc("#2FC7E0"), rough=0.3, coat=0.8), z=9, bevel=1)
                continue
            outline(x, y, 48, 60, 4, 1.2, 4.6, foil, z=5)
            for k in range(-6, 7):  # the foil cross-hatch, clipped to the inner panel
                for sg in (1, -1):
                    seg = clip_line(k * 9, sg, 20, 26)
                    if seg:
                        (ax, ay), (bx, by) = seg
                        tube([(x + ax, y + ay, 9.1), (x + bx, y + by, 9.1)], 0.4, foil)
            disc(x, y, 6.5, 1.2, back, z=9, bevel=0.3)
            disc(x, y, 4.2, 1.6, foil, z=9, bevel=0.5)
    # The cross-hatch runs past the card faces; a frame of felt hides it at each card's edge.
    finish(look)


# -------------------------------------------------------------------------------------------- spotdiff


def creature(kind, x, y, s, m, z, eye_w, eye_k, look):
    """A small enamel sea creature, drawn in a few bold pieces, facing left."""
    if kind == "fish":
        ts = [0.4 + i * (2 * math.pi - 0.8) / 24 for i in range(25)]
        pts = [(math.cos(t) * s * 0.62 - s * 0.08, math.sin(t) * s * 0.4) for t in ts]
        pts += [(s * 0.5, -s * 0.1), (s * 0.82, -s * 0.38), (s * 0.74, 0), (s * 0.82, s * 0.38), (s * 0.5, s * 0.1)]
        prism(pts, 3, m, z=z, cx=x, cy=y, bevel=1)
    elif kind == "puffer":
        prism(poly(14, s * 0.62, star=s * 0.52), 3, m, z=z, cx=x, cy=y, bevel=0.8)
        prism([(s * 0.45, 0), (s * 0.85, -s * 0.3), (s * 0.85, s * 0.3)], 2.6, m, z=z, cx=x, cy=y, bevel=0.6)
    elif kind == "crab":
        prism([(math.cos(t) * s * 0.6, math.sin(t) * s * 0.4) for t in [i * math.pi / 12 for i in range(24)]], 3, m,
              z=z, cx=x, cy=y + 2, bevel=1)
        for sg in (-1, 1):
            disc(x + sg * s * 0.62, y - s * 0.38, s * 0.22, 3, m, z=z, bevel=0.8)
            for k in range(3):
                tube([(x + sg * s * 0.4, y + 2 + k * 3, z + 1), (x + sg * s * 0.8, y + 6 + k * 4, z + 1)], 0.8, m)
    elif kind == "shell":
        pts = [(0, s * 0.55)] + [(math.cos(t) * s * 0.7, -math.sin(t) * s * 0.6) for t in [i * math.pi / 16 for i in range(17)]]
        prism(pts, 3, m, z=z, cx=x, cy=y, bevel=1)
        for k in range(5):
            t = math.pi * (0.15 + 0.7 * k / 4)
            tube([(x, y + s * 0.45, z + 3.2), (x + math.cos(t) * s * 0.6, y - math.sin(t) * s * 0.5, z + 3.2)], 0.5,
                 eye_k)
        return
    elif kind == "star":
        prism(poly(5, s * 0.7, star=s * 0.3), 3, m, z=z, cx=x, cy=y, bevel=1)
        return
    else:  # seahorse-like squid: a dome and tentacles
        prism([(math.cos(t) * s * 0.45, -abs(math.sin(t)) * s * 0.7) for t in [i * math.pi / 14 for i in range(15)]]
              + [(-s * 0.45, s * 0.1)], 3, m, z=z, cx=x, cy=y, bevel=1)
        for k in range(4):
            xx = x - s * 0.33 + k * s * 0.22
            tube([(xx, y + s * 0.1, z + 1), (xx + 1.5, y + s * 0.4, z + 1), (xx - 1, y + s * 0.65, z + 1)], 0.9, m)
        return
    disc(x - s * 0.38, y - s * 0.08, s * 0.13, 1, eye_w, z=z + 3, bevel=0.3)
    disc(x - s * 0.40, y - s * 0.08, s * 0.07, 1.2, eye_k, z=z + 3, bevel=0.2)


def spotdiff(look):
    """Double Take, picture 2: the rock pool twice, two differences found and ringed, one being looked at."""
    pal = palette(look)
    a = look == "a"
    light(look)
    ground(pal["ground"])
    text("2 / 6 FOUND", 160, 167, 8.5, pal["gold_text"], depth=0.3, align="RIGHT")
    text("MISSES 0 / 5", 240, 167, 8.5, pal["label"], depth=0.3)
    disc(282, 167, 4.5, 1, pal["gold"], bevel=0.3)
    kinds = ["fish", "puffer", "crab", "shell", "star", "squid"]
    cols = ["#9156E8", "#F5D42F", "#E8434C", "#3F86F0", "#F58A2C", "#FF8AD0", "#3BCB6A"]
    mats = [mat(f"sd{i}{look}", hexc(c), rough=0.3 if a else 0.12, coat=0.9, coat_rough=0.04) for i, c in enumerate(cols)]
    eye_w = mat("sd_eyew", hexc("#FFFFFF"), rough=0.3)
    eye_k = mat("sd_eyek", hexc("#120E10"), rough=0.2, coat=1)
    rng = random.Random(11)
    board = [[(rng.randrange(6), rng.randrange(7)) for _ in range(8)] for _ in range(6)]
    diffs = {(0, 2): "found", (3, 2): "found", (4, 5): "looking"}
    oak = wood("sd_oak" + look, hexc("#B98A55"), hexc("#7A5430"), rough=0.4, scale=16) if a else \
        wood("sd_oakb" + look, hexc("#6B4A2B"), hexc("#3A2412"), rough=0.25, scale=16, coat=0.9)
    water = mat("sd_water" + look, hexc("#16304A" if a else "#0D2036"), rough=0.25, coat=0.6, coat_rough=0.1)
    for pi, top in enumerate((190, 490)):
        rbox(195, top + 134, 372, 272, 5, mat("sd_frame" + look, hexc("#3A2A3C" if a else "#2A1A2C"), rough=0.3,
                                               coat=0.8), r=16, bevel=2)
        rbox(195, top + 134, 360, 260, 5.4, water, r=11, bevel=1)
        for r in range(6):
            y = top + 22 + r * 44.6
            box(16, y + 18, 358, 4, 3, oak, z=5.4, bevel=1)  # the shelf under the row
            for c in range(8):
                x = 34 + c * 46
                k, ci = board[r][c]
                if pi == 1 and (c, r) in diffs:
                    ci = (ci + 3) % 7
                creature(kinds[k], x, y, 26, mats[ci], 7, eye_w, eye_k, look)
                if (c, r) in diffs:
                    ring(x, y, 20, 18, 11, pal["gold"], z=5.5, bevel=0.5)
    finish(look)


# -------------------------------------------------------------------------------------------- eagle eye


EAGLE_R = [(0, -0.98), (0.1, -0.95), (0.16, -0.82), (0.15, -0.62), (0.3, -0.5), (0.55, -0.52), (0.8, -0.6),
           (1.0, -0.66), (0.95, -0.52), (1.0, -0.46), (0.88, -0.36), (0.93, -0.27), (0.78, -0.2), (0.6, -0.12),
           (0.4, -0.06), (0.22, 0.05), (0.2, 0.3), (0.42, 0.72), (0.25, 0.8), (0.12, 0.7), (0, 0.82)]
EAGLE = EAGLE_R + [(-x, y) for x, y in reversed(EAGLE_R[1:-1])]


def symscan(look):
    """Eagle Eye, stage 3: the 7 x 7 field of eagles, two target directions, eight marked."""
    pal = palette(look)
    a = look == "a"
    light(look)
    ground(pal["ground"])
    progress(pal, 84, 2, total=3)
    slate = mat("ee_slate" + look, hexc("#2C4153" if a else "#1E3142"), rough=0.45 if a else 0.2, coat=0.5 if a else 0.9,
                bump=0.05, bump_scale=700)
    pewter = metal("ee_pewter" + look, hexc("#A9AFB8" if a else "#C3C9D2"), rough=0.35 if a else 0.2, brushed=False)
    goldm = metal("ee_goldm", hexc("#E9B24A"), rough=0.22, brushed=False)
    beak = mat("ee_beak", hexc("#F2B33A"), rough=0.3, coat=0.6)
    tint = mat("ee_tint" + look, hexc("#6A5320" if a else "#5A4414"), rough=0.35, coat=0.8)
    text("TARGETS", 63, 250, 8.5, pal["label"], depth=0.3, align="LEFT")
    targets = [math.radians(-120), math.radians(-60)]
    for x, ang in ((156, targets[0]), (238, targets[1])):
        rbox(x, 250, 46, 46, 5, tint, r=10, bevel=1.5)
        outline(x, 250, 48, 48, 11, 2, 5.6, pal["gold"])
        prism(EAGLE, 2.5, goldm, z=5, cx=x, cy=250, rot=ang + math.pi / 2, scale=17, bevel=0.6)
    text("OR", 197, 250, 8.5, pal["gold_text"], depth=0.3)
    text("8 marked", 274, 250, 8.5, pal["label"], depth=0.3, align="LEFT")
    rbox(195, 466, 374, 382, 5, pal["tray"], r=18, bevel=2)
    rng = random.Random(3)
    marked = {(1, 1), (0, 2), (2, 4), (5, 4), (6, 4), (5, 5), (1, 6), (6, 6)}
    for r in range(7):
        for c in range(7):
            x, y = 38 + c * 52.4, 309 + r * 52.4
            m = (c, r) in marked
            rbox(x, y, 47, 47, 6, tint if m else slate, r=7, bevel=1.5, z=5)
            outline(x, y, 49, 49, 8, 1.8, 7, pal["gold"] if m else pal["blue"], z=5)
            ang = rng.choice(targets) if m else rng.choice([math.radians(d) for d in (-150, -90, -30, 0, 30, 90, 150, 180)])
            ang += rng.uniform(-0.05, 0.05)
            prism(EAGLE, 2.5, goldm if m else pewter, z=11, cx=x, cy=y, rot=ang + math.pi / 2, scale=18, bevel=0.6)
            prism([(math.cos(t) * 3.2, math.sin(t) * 9) for t in [i * math.pi / 8 for i in range(16)]], 2.0,
                  goldm if m else pewter, z=13, cx=x - math.cos(ang) * 1, cy=y - math.sin(ang) * 1, rot=ang + math.pi / 2,
                  bevel=0.8)
            hx, hy = x + math.cos(ang) * 18.5, y + math.sin(ang) * 18.5
            prism(poly(3, 3.4, rot=ang), 1.5, beak, z=12.5, cx=hx, cy=hy, bevel=0.3)
    button(pal, 12, 776, 366, 52, "SUBMIT", kind="gold", size=11)
    finish(look)
