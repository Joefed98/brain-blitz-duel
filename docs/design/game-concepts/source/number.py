"""Number concepts (8 games): A today upgraded, B bolder.
Run:  /opt/blender/venv/bin/python number.py [game[:A,B]] ..."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jzlib import *
from kit import *

C = "number"
ACC = CAT[C]["accent"]

# ---------------------------------------------------------------- Counterweight (balance)
def balance(look):
    bold = look == "B"
    cam(bold)
    stage(C, bold)
    # the scene box: dark walnut wall, a plank floor
    wall = wood(f"wall{bold}", "#3a2414", "#1a0d06", scale=1.6, rough=0.5, coat=0.2)
    box(10, 100, 370, 594, 6, wall, r=12)
    floor_ = wood("planks", "#8a5a32", "#4a2a12", scale=2.2)
    box(14, 590, 362, 96, 9, floor_, r=8)
    if bold: point(195, 300, 180, 40, "#ffd49a", radius=40)
    iron = mat("ironpost", "#15171a", 0.28, metal=1.0)
    brass = mat(f"beam{bold}", "#d6a94a", 0.22, metal=1.0, emit="#7a5410", emit_strength=0.2 if not bold else 0.5)
    add_bump(brass, 50, 0.05, stretch=(1, 40, 1), distance=0.003)
    box(150, 586, 90, 12, 14, brass, r=4, z=6)                 # foot
    box(183, 350, 24, 240, 30, iron, r=10, z=6)               # pillar
    sphere(195, 349, 11, brass, z=40)                         # pivot
    tilt = math.radians(-2.0)
    bx0, bx1, by = 18, 372, 352
    beam = box(bx0, by - 7, bx1 - bx0, 14, 12, brass, r=6, z=34)
    beam.rotation_euler[2] = tilt
    num = ink("dark", "#16100a", 0.5)
    notch = [(-4, 37), (-3, 82), (-2, 127), (-1, 172), (1, 218), (2, 263), (3, 308), (4, 353)]
    for n, x in notch:
        y = by + (x - 195) * math.tan(-tilt)
        box(x - 12, y - 12, 24, 24, 8, brass, r=5, z=44)
        text(x, y, abs(n), 14, num, z=52.1, fnt="sans")
    weight = mat(f"wt{bold}", "#2c2f34", 0.3, metal=1.0, coat=0.4)
    def hang(x, n, drop=40):
        y = by + (x - 195) * math.tan(-tilt)
        tube([(x, y + 10, 40), (x, y + drop - 14, 40)], 1.2, mat("chain", "#c9ced1", 0.2, metal=1), round_caps=False)
        torus(x, y + drop - 14, 8, 2.6, mat("shackle", "#c9ced1", 0.2, metal=1), z=40)
        cyl(x, y + drop + 6, 17, 22, weight, z=30, bevel=5)
        text(x, y + drop + 6, n, 17, T(WHITE, 0.4, "wtN"), z=52.2, fnt="sans")
    hang(82, 8); hang(218, 8); hang(263, 2)
    pills(C, 195, 708, [("Hangs", "1 / 12"), ("Balanced", "1 / 4"), ("To hang", "2")], bold)
    box(12, 728, 366, 86, 6, wall, r=12)
    bronze = mat(f"bronze{bold}", "#b07a3a", 0.25, metal=1.0, emit="#5a3a10", emit_strength=0.1 if not bold else 0.3)
    for x, n in ((153, 2), (237, 1)):
        torus(x, 752, 8, 3, bronze, z=16)
        cyl(x, 774, 24, 22, bronze, z=6, bevel=6)
        text(x, 774, n, 22, num, z=28.2, fnt="sans")
balance.looks = ("A", "B")

# ---------------------------------------------------------------- Checkout (darts)
def checkout(look):
    bold = look == "B"
    cam(bold)
    stage(C, bold)
    chips = [("✓", 64), ("93", 64), ("243", 64), ("383", 64), ("101", 64)]
    for i, (lab, w) in enumerate(chips):
        x = 12 + i * 74
        if i == 0: box(x, 96, w, 32, 6, gold_m(bold, "chipg"), r=8)
        else:
            box(x, 96, w, 32, 6, mat("chipd", "#0d1a12", 0.3, coat=0.8), r=8)
            if i == 1: box(x - 1.2, 95, w + 2.4, 34, 5.6, accent_m(C, 0.6 if not bold else 1.4), r=9, z=-0.2)
        text(x + w / 2, 112, lab, 14, T("#1a1206" if i == 0 else WHITE, 0.0 if i == 0 else 0.4, f"chipT{i}"), z=6.2, fnt="sym" if i == 0 else "sans")
    for x, a, b in ((60, "Finish ", "Double"), (195, "", "Bull/treble"), (318, "Darts ", "up to 3")):
        text(x, 146, a + b, 12, T(WHITE, 0.35, "fineprint"), z=1, fnt="sans6")
    # cabinet: a purple-lit panel behind the board, as today
    cab = mat(f"cab{bold}", "#3a2a6a", 0.45, emit="#4a2a8a", emit_strength=0.15 if not bold else 0.4)
    box(12, 236, 366, 370, 6, cab, r=14)
    for i in range(14):
        sphere(26 + i * 26.5, 248, 2.2, emissive("bulb", "#ffe6a0", 4 if not bold else 9), z=8)
    cx, cy, R = 195, 424, 176
    ringwood = wood("dartring", "#8a5a30", "#4e2e14", scale=4)
    cyl(cx, cy, R, 14, ringwood, z=6, bevel=4)
    nums = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]
    order = [11, 7, 5, 16, 3, 17, 2, 15, 10, 6, 13, 4, 18, 1, 20, 5]  # unused
    for i, n in enumerate(nums):
        a = math.radians(90 - i * 18)
        text(cx + math.cos(a) * (R - 18), cy - math.sin(a) * (R - 18), n, 17, T(WHITE, 0.4, "ringN"), z=20.2, fnt="sans")
    # segments as slabs: white/black singles, red/blue rings, as today's board
    sisal_w = mat("sisal_w", "#efe6d4", 0.85); add_bump(sisal_w, 500, 0.3, stretch=(1, 1, 1), distance=0.002)
    sisal_b = mat("sisal_b", "#1a1a1c", 0.85); add_bump(sisal_b, 500, 0.3, distance=0.002)
    red = mat(f"dred{bold}", "#c8242c", 0.6, emit="#c8242c", emit_strength=0.0 if not bold else 0.15)
    blue = mat(f"dblue{bold}", "#2a5ad8", 0.6, emit="#2a5ad8", emit_strength=0.0 if not bold else 0.15)
    hl = mat(f"seghl{bold}", "#e8f04a", 0.5, emit="#d8e83a", emit_strength=0.6 if not bold else 1.4)
    def seg(r0, r1, a0, a1, m, z):
        pts = [(cx + math.cos(math.radians(a)) * r0, cy - math.sin(math.radians(a)) * r0) for a in [a0 + (a1 - a0) * k / 6 for k in range(7)]]
        pts += [(cx + math.cos(math.radians(a)) * r1, cy - math.sin(math.radians(a)) * r1) for a in [a1 - (a1 - a0) * k / 6 for k in range(7)]]
        slab(pts, 3, m, z=z, bevel=0.3)
    rings = [(16, 72, "single"), (72, 82, "treble"), (82, 128, "single"), (128, 138, "double")]
    for i, n in enumerate(nums):
        a0, a1 = 90 - i * 18 - 9, 90 - i * 18 + 9
        for r0, r1, kind in rings:
            if kind == "single": m = sisal_b if i % 2 == 0 else sisal_w
            else: m = red if i % 2 == 0 else blue
            if n == 19 and kind != "double" and r0 >= 16: m = hl if kind != "treble" else red
            seg(r0 + 0.6, r1 - 0.6, a0 + 0.35, a1 - 0.35, m, 20)
    cyl(cx, cy, 15, 4, mat("bullg", "#2a8a3a", 0.6), z=20, bevel=0.5)
    cyl(cx, cy, 7, 5, red, z=20, bevel=0.5)
    wire = mat("wire", "#d8dcdf", 0.25, metal=1.0)
    for r_ in (16, 72, 82, 128, 138):
        torus(cx, cy, r_, 0.7, wire, z=23)
    # one dart in treble 19
    a = math.radians(90 - 11 * 18)
    dx, dy = cx + math.cos(a) * 77, cy - math.sin(a) * 77
    tube([(dx, dy, 24), (dx + 8, dy - 8, 60)], 1.4, mat("barrel", "#c9ced1", 0.15, metal=1), round_caps=False)
    tube([(dx + 8, dy - 8, 60), (dx + 20, dy - 20, 92)], 3.2, mat("tungsten", "#4a4e54", 0.3, metal=1), round_caps=True)
    slab([(dx + 18, dy - 22), (dx + 34, dy - 40), (dx + 26, dy - 18)], 1, mat("flight", ACC, 0.4, emit=ACC, emit_strength=0.3), z=94)
    torus(dx, dy, 9, 1.6, gold_m(bold, "hitring"), z=24)
    # throw strip and buttons
    box(12, 664, 366, 38, 5, mat("strip", "#0d1a12", 0.3, coat=0.8), r=10)
    box(11, 663, 368, 40, 4.6, gold_m(bold, "stripedge"), r=10.5, z=-0.2)
    text(24, 683, "93 – T19", 13, T(WHITE, 0.4, "stripT"), z=5.2, fnt="sans6", align="LEFT")
    text(318, 683, "1/3 darts", 12, T("#b8c0be", 0.3, "stripT2"), z=5.2, fnt="sans6", align="RIGHT")
    text(364, 683, "36", 19, T(WHITE, 0.5, "stripT3"), z=5.2, fnt="sans", align="RIGHT")
    for i, (lab, col) in enumerate((("X1", "#20262a"), ("X2", "#c8242c"), ("X3", "#2a6ae0"))):
        x = 12 + i * 124
        box(x, 710, 118, 48, 8, mat(f"xb{i}{bold}", col, 0.3, coat=0.8, emit=col, emit_strength=0.0 if not bold else 0.25), r=10)
        if i == 0: box(x - 1.2, 709, 120.4, 50, 7.6, gold_m(bold, "x1edge"), r=10.5, z=-0.2)
        text(x + 59, 734, lab, 15, T(WHITE, 0.4, "xbT"), z=8.2, fnt="sans")
    btn(C, 12, 766, 176, 48, "↶", "key", bold, size=20, fnt="sym")
    btn(C, 196, 766, 182, 48, "THROW", "gold", bold, size=16, fnt="sans")
checkout.looks = ("A", "B")

# ---------------------------------------------------------------- Operator (equation)
def equation(look):
    bold = look == "B"
    cam(bold)
    stage(C, bold)
    panel(C, 12, 114, 366, 514, bold, d=5)
    text(195, 300, "Fill the squares from the numbers below · left to right", 12, T("#b8c0be", 0.3, "hint"), z=6, fnt="sans6")
    box(18, 322, 354, 58, 6, mat("eqwell", "#081009", 0.35, coat=0.6), r=10, z=5)
    tealtile = mat(f"teal{bold}", "#33c7c9", 0.12, coat=1.0, trans=0.2, emit="#33c7c9", emit_strength=0.25 if not bold else 0.8)
    items = [("tile", "10", 48), ("op", "\u2212", 22), ("num", "5", 22), ("op", "\u2212", 22), ("tile", "3", 48), ("op", "+", 22),
             ("gap", "#", 48), ("op", "=", 22), ("num", "11", 38)]
    x = 30
    for kind, lab, w in items:
        cx = x + w / 2
        if kind == "tile":
            box(x, 330, w, 42, 9, tealtile, r=8, z=10)
            text(cx, 351, lab, 24, ink("ontile", "#06201f", 0.5), z=19.2, fnt="sans")
        elif kind == "gap":
            outline(x, 330, w, 42, 8, accent_m(C, 0.8 if not bold else 2.0), z=12, rad=1.6)
            text(cx, 351, lab, 16, T(ACC, 0.8, "gapT"), z=11, fnt="sans")
        else:
            text(cx, 351, lab, 26, T(GOLD if lab == "11" else WHITE, 0.5, f"eq{lab=='11'}"), z=12, fnt="sym" if kind == "op" else "sans")
        x += w + 6
    pills(C, 195, 408, [("Tries", "0 / 3"), ("Gaps", "2 / 3"), ("Right", "1 / 4")], bold)
    box(12, 648, 366, 42, 4, mat("hintp", "#0b1510", 0.4), r=10)
    text(195, 669, "The signs are given", 13, T("#b8c0be", 0.3, "hint"), z=4.2, fnt="sans6")
    stone = mat(f"ntile{bold}", "#24302a", 0.35, coat=0.9)
    used = {1, 3}
    for i, n in enumerate(("14", "10", "9", "3", "15")):
        x = 12 + i * 74
        box(x, 700, 68, 52, 9 if i not in used else 3, stone, r=9)
        text(x + 34, 726, n, 24, T(WHITE if i not in used else "#55625c", 0.5 if i not in used else 0.05, f"nt{i in used}"), z=(9 if i not in used else 3) + 0.2, fnt="sans")
    btn(C, 12, 764, 366, 50, "NEXT", "gold", bold, size=17, fnt="sans")
equation.looks = ("A", "B")

# ---------------------------------------------------------------- Kakuro
def kakuro(look):
    bold = look == "B"
    cam(bold)
    stage(C, bold)
    # 6x6: X = black block; (d, r) = clue cell (down, right); "." empty; digit filled
    G = [["X", (27, None), (7, None), (13, None), "X", "X"],
         [(None, 13), "7", "4", "2", (16, None), "X"],
         [(None, 23), "8", "4", "5", "1", "7"],
         [(13, None), "7", ".", (5, 16), ".", "."],
         [(None, 24), ".", ".", ".", ".", "X"],
         [(None, 7), ".", ".", ".", "X", "X"]]
    # fix row 2: first cell is a clue cell (None, 23)? keep as drawn today (5 white cells)
    G[2] = [(None, 23), "8", "4", "5", "1", "7"]
    red = {(1, 3)}
    x0, y0, cs = 14, 206, 60
    panel(C, x0 - 6, y0 - 6, 6 * cs + 12, 6 * cs + 12, bold)
    blk = mat("kblk", "#0a0f0c", 0.4, coat=0.5)
    cell = mat(f"kcell{bold}", "#1c2a22", 0.3, coat=0.9)
    digit = mat(f"kdig{bold}", GOLD, 0.3, metal=0.5, emit=GOLD, emit_strength=0.7 if not bold else 1.5)
    for r, c in grid(6, 6):
        x, y = x0 + c * cs, y0 + r * cs
        v = G[r][c]
        if v == "X" or isinstance(v, tuple):
            box(x + 1.5, y + 1.5, cs - 3, cs - 3, 4, blk, r=3, z=6)
            if isinstance(v, tuple):
                tube([(x + 6, y + 6), (x + cs - 6, y + cs - 6)], 0.8, mat("diag", "#4a5a52", 0.4, metal=1), z=10.5, round_caps=False)
                d, rt = v
                if d: text(x + 18, y + cs - 14, d, 15, T("#ff5a5a" if (r, c) == (0, 2) else WHITE, 0.45, f"kd{(r,c)==(0,2)}"), z=10.3, fnt="sans")
                if rt: text(x + cs - 16, y + 16, rt, 15, T("#ff5a5a" if rt == 23 else ACC, 0.45, f"kr{rt==23}"), z=10.3, fnt="sans")
        else:
            box(x + 1.5, y + 1.5, cs - 3, cs - 3, 6, cell, r=4, z=6)
            if v != ".": text(x + cs / 2, y + cs / 2 + 2, v, 30, digit, z=12.2, fnt="sans")
    # red tint on the broken row (today's warning)
    for c in range(1, 6):
        box(x0 + c * cs + 2, y0 + 2 * cs + 2, cs - 4, cs - 4, 0.6, mat("redtint", "#c02a2a", 0.4, trans=0.5, emit="#c02a2a", emit_strength=0.25 if not bold else 0.6), r=4, z=12)
    pills(C, 195, 590, [("Runs", "1 / 12")], bold)
    for i in range(12):
        x = 12 + (i % 6) * 62; y = 718 + (i // 6) * 58
        if i == 5: btn(C, x, y, 56, 50, "PENCIL", "outline", bold, size=10)
        elif i == 11: btn(C, x, y, 56, 50, "CLEAR", "outline", bold, size=10)
        else:
            n = i + 1 if i < 5 else i
            btn(C, x, y, 56, 50, str(n), "key", bold, size=19, fnt="sans")
kakuro.looks = ("A", "B")

# ---------------------------------------------------------------- Brimful (measure)
def measure(look):
    bold = look == "B"
    cam(bold, 4)
    stage(C, bold)
    pills(C, 150, 118, [("Moves", "2 / 23"), ("Par", "4")], bold)
    text(372, 118, "Make 6 L in any jug", 12, T(GOLD, 0.6, "make"), z=1, fnt="sans", align="RIGHT")
    panel(C, 12, 156, 366, 572, bold, d=4)
    g = thin_glass(f"jug{bold}", "#f2fbff", 0.02, 1.2 if not bold else 1.5)
    water = mat(f"water{bold}", "#3a9cf0", 0.05, trans=0.6, coat=1.0, ior=1.33, emit="#3a8ae8", emit_strength=0.35 if not bold else 0.9)
    tick = T(WHITE, 0.35, "tick")
    def jug(x0, top, w, h, cap, level):
        # glass walls (front-facing jar): back panel, two sides, base
        box(x0, top, w, h, 1.2, g, r=6, z=4)                       # back
        box(x0 - 3, top, 4, h, 30, g, r=2, z=4)
        box(x0 + w - 1, top, 4, h, 30, g, r=2, z=4)
        box(x0 - 3, top + h - 4, w + 6, 6, 30, g, r=2, z=4)
        box(x0 - 3, top - 2, w + 6, 30, 3, g, r=6, z=33)            # front pane
        unit = (h - 8) / cap
        if level: box(x0 + 2, top + h - 4 - level * unit, w - 4, level * unit, 24, water, r=2, z=6)
        for k in range(1, cap):
            yy = top + h - 4 - k * unit
            box(x0 + 4, yy - 0.6, 9, 1.2, 0.4, tick, r=0.2, z=36.2)
            text(x0 + 18, yy, k, 9, tick, z=36.2, fnt="sans6", align="LEFT")
        return unit
    jug(56, 562, 120, 120, 3, 0)
    unit = jug(212, 206, 120, 476, 12, 3)
    ty = 206 + 476 - 4 - 6 * unit
    for k in range(12):
        box(214 + k * 10, ty - 1, 6, 2, 0.5, gold_m(bold, "target"), r=0.5, z=36.4)
    text(116, 704, "0/3", 15, T(WHITE, 0.4, "jl"), z=1, fnt="sans")
    text(272, 704, "3/12", 15, T(WHITE, 0.4, "jl"), z=1, fnt="sans")
    text(150, 748, "Tap a jug", 13, T(WHITE, 0.4, "tap"), z=1, fnt="sans6")
    text(250, 748, "Left 21", 13, T(WHITE, 0.4, "tap"), z=1, fnt="sans6")
    btn(C, 12, 768, 110, 46, "FILL", "key", bold, size=13)
    btn(C, 134, 768, 110, 46, "EMPTY", "key", bold, size=13)
    btn(C, 256, 768, 122, 46, "↻", "outline", bold, size=20, fnt="sym")
measure.looks = ("A", "B")

# ---------------------------------------------------------------- Ballpark (numline)
def numline(look):
    bold = look == "B"
    cam(bold)
    stage(C, bold)
    text(195, 256, "Number 4 of 5", 13, T("#b8c0be", 0.35, "nof"), z=1, fnt="sans6")
    card = mat(f"card{bold}", "#1a2620", 0.25, coat=1.0)
    box(13, 276, 364, 170, 10, card, r=16)
    box(12, 275, 366, 172, 9.6, mat("cardedge", "#5a6a62", 0.3, metal=1.0), r=16.5, z=-0.2)
    big = mat(f"big{bold}", "#e8fff0", 0.3, emit="#bfffd8", emit_strength=0.8 if not bold else 2.0)
    text(195, 361, "53%", 76, big, z=10.2, depth=2.5, fnt="sans")
    text(195, 466, "Touch the line to place a marker", 13, T("#b8c0be", 0.3, "touch"), z=1, fnt="sans6")
    rail = mat(f"rail{bold}", "#e9ecee", 0.18, metal=1.0)
    xcyl(28, 558, 334, 7, rail, z=12, bevel=6)
    for x, lab in ((28, "0"), (362, "1")):
        box(x - 1.5, 540, 3, 38, 18, rail, r=1)
        text(x, 592, lab, 16, T(WHITE, 0.4, "end"), z=1, fnt="mono")
    pinm = mat(f"pin{bold}", "#c9ced1", 0.15, metal=1.0)
    for x, lab, glow in ((101, "22%", False), (285, "7/9", False), (291, "4/5", True)):
        y0 = 524 if lab != "4/5" else 508
        tube([(x, y0, 30), (x, 558, 30)], 1.3, pinm, round_caps=False)
        sphere(x, y0, 7, mat(f"pinhead{glow}{bold}", ACC if glow else "#e9ecee", 0.2, metal=0.3 if glow else 1.0, emit=ACC if glow else None, emit_strength=1.5 if glow else 0), z=30)
        text(x, y0 - 16, lab, 11, T(WHITE, 0.4, "pinT"), z=30, fnt="sans6")
    pills(C, 195, 757, [("Placed", "3 of 5"), ("", "Touch the line"), ("", "◎ Bullseyes")], bold)
    btn(C, 56, 778, 278, 48, "PLACE", "key", bold, size=15, fnt="sans")
numline.looks = ("A", "B")

# ---------------------------------------------------------------- Integer Pyramid (numpyramid)
def numpyramid(look):
    bold = look == "B"
    cam(bold)
    stage(C, bold)
    text(16, 207, "9 given  ·  2 placed  ·  4 to go", 12, T("#b8c0be", 0.3, "pyrT"), z=1, fnt="sans6", align="LEFT")
    btn(C, 322, 190, 56, 34, "Skip", "outline", bold, size=13)
    rows = [["94"], ["50", "44"], ["", "", "18"], ["", "15", "11", "7"], ["1", "8", "7", "4", ""]]
    placed = {(0, 0), (1, 0)}
    stone = mat(f"pstone{bold}", "#6e6a64", 0.6, coat=0.15); add_bump(stone, 40, 0.25, distance=0.004)
    tan = mat(f"ptan{bold}", "#d8b878", 0.45, coat=0.4, emit="#c89a40", emit_strength=0.0 if not bold else 0.3); add_bump(tan, 40, 0.15, distance=0.003)
    empty = mat("pempty", "#0d120f", 0.7); add_bump(empty, 400, 0.6, kind="voronoi", distance=0.002)
    tw, th = 66, 72
    for r, row in enumerate(rows):
        y = 238 + r * 82
        x0 = 195 - len(row) * tw / 2 - (len(row) - 1) * 2
        for c, v in enumerate(row):
            x = x0 + c * (tw + 4)
            if v == "":
                box(x, y, tw, th, 3, empty, r=4, z=4)
                outline(x + 2, y + 2, tw - 4, th - 4, 4, mat("emptyedge", "#3a2e1e", 0.6), z=7, rad=0.6)
            else:
                m = tan if (r, c) in placed else stone
                box(x, y, tw, th, 16, m, r=5, z=4)
                text(x + tw / 2, y + th / 2, v, 28, T("#2a1a08" if (r, c) in placed else WHITE, 0.0 if (r, c) in placed else 0.45, f"pyT{(r,c) in placed}"), z=20.2, fnt="sans")
    box(22, 648, 346, 10, 10, mat("plinth", "#3a3a36", 0.5), r=3, z=0)
    tray = wood(f"ptray{bold}", "#3a2414", "#1a0d06", scale=2)
    box(12, 712, 366, 70, 6, tray, r=12)
    tile = wood("ptile", "#d0a060", "#9a6a30", scale=6)
    for i, n in enumerate(("6", "92", "26", "9", "24", "3")):
        x = 22 + i * 58
        box(x, 722, 52, 50, 10, tile, r=6, z=6)
        text(x + 26, 747, n, 20, T("#24160a", 0.0, "tileT"), z=16.2, fnt="sans")
numpyramid.looks = ("A", "B")

# ---------------------------------------------------------------- Exact (target)
def target(look):
    bold = look == "B"
    cam(bold)
    stage(C, bold)
    panel(C, 12, 98, 366, 424, bold, d=5)
    text(195, 178, "TARGET", 12, T("#c8d0cc", 0.35, "tgtL"), z=6, fnt="sans6")
    goldbig = mat(f"bigold{bold}", GOLD, 0.25, metal=1.0, emit="#c89020", emit_strength=0.6 if not bold else 1.4)
    text(195, 226, "714", 74, goldbig, z=6, depth=4.0, fnt="sans")
    box(86, 268, 218, 78, 4, mat("steps", "#08100b", 0.35, coat=0.6), r=10, z=5)
    text(195, 290, "9 × 4 = 36", 19, T(WHITE, 0.4, "stepT"), z=9.2, fnt="sym")
    text(195, 322, "100 + 50 = 150", 19, T(WHITE, 0.4, "stepT"), z=9.2, fnt="sym")
    pills(C, 195, 474, [("Left", "4"), ("Closest", "150"), ("✦ Elegant", "5 numbers")], bold)
    face = mat(f"numface{bold}", "#22282b", 0.3, coat=1.0)
    sel = mat(f"numsel{bold}", "#3a2a08", 0.25, coat=1.0, emit="#7a5410", emit_strength=0.2 if not bold else 0.5)
    for i, (n, state) in enumerate((("36", 1), ("5", 1), ("150", 2), ("10", 1), ("50", 0), ("4", 0))):
        x = 12 + (i % 3) * 124; y = 536 + (i // 3) * 82
        if state == 0:
            box(x, y, 116, 68, 2, mat("used", "#121614", 0.5), r=12)
            text(x + 58, y + 34, n, 26, T("#3e4a44", 0.0, "usedT"), z=2.2, fnt="sans")
            continue
        box(x, y, 116, 68, 12, sel if state == 2 else face, r=12)
        if state == 2: box(x - 2, y - 2, 120, 72, 11.4, gold_m(bold, "selrim"), r=13, z=-0.3)
        text(x + 58, y + 34, n, 28, T(GOLD if state == 2 else WHITE, 0.6, f"nfT{state}"), z=12.2, fnt="sans")
    for i, op in enumerate(("+", "−", "×", "÷")):
        btn(C, 12 + i * 93, 698, 86, 44, op, "key", bold, size=22, fnt="sym")
    btn(C, 12, 756, 46, 48, "↶", "outline", bold, size=18, fnt="sym")
    btn(C, 66, 756, 46, 48, "↻", "outline", bold, size=18, fnt="sym")
    btn(C, 204, 756, 174, 48, "Lock in 150 (564 away)", "gold", bold, size=12, fnt="sans")
target.looks = ("A", "B")

GAMES = dict(balance=balance, checkout=checkout, equation=equation, kakuro=kakuro, measure=measure, numline=numline,
             numpyramid=numpyramid, target=target)
if __name__ == "__main__":
    run(C, GAMES)
