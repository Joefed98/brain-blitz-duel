"""Logic concepts (14 games). Each function builds one game's scene for a look: A today upgraded, B bolder, C flagship extra.
Run:  /opt/blender/venv/bin/python logic.py [game[:A,B]] ...   (no argument renders every game and look)."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jzlib import *
from kit import *
from jzlib import _bsdf

C = "logic"
ACC = CAT[C]["accent"]

def cam(bold, tilt=6):
    camera(tilt=tilt + (9 if bold else 0), lens=85 if not bold else 70)

# ---------------------------------------------------------------- Box Six (sudoku)
def sudoku(look):
    bold = look == "B"
    cam(bold)
    sol = [[3,5,2,1,6,4],[4,1,6,5,2,3],[6,3,1,4,5,2],[2,4,5,3,1,6],[5,6,4,2,3,1],[1,2,3,6,4,5]]
    shown = {(r, c) for r in range(3) for c in range(6)} | {(3,1),(3,2),(3,5),(4,0),(4,2),(4,4),(5,3)}
    shown -= {(2,5)}
    sel = (2, 5)
    bx, by, bs = 15, 196, 360
    cs = bs / 6
    if look == "C":   # gold leaf on black marble, the white grid as polished silver
        world("#020304", 0.3, "studio.exr", 0.3)
        backdrop(gradient_bg("bgC", CAT[C]["top"], CAT[C]["bot"], 0.7, noise=0.03))
        area(-260, -260, 900, 700, 4800, "#fff3e2", sx=900, sy=500); area(760, 520, 520, 600, 700, "#d6e6ff")
        area(195, 1500, 260, 800, 600, "#ffffff", sx=1200, sy=200)
        tile = marble("nero", "#2a2b2d", "#0b0b0c", 0.12, 1.3)
        _bsdf(tile).inputs["Coat Weight"].default_value = 1.0
        # swap ramp so the veins are pale on black
        cr = [n for n in tile.node_tree.nodes if n.type == "VALTORGB"][0]
        cr.color_ramp.elements[0].color = hexc("#4a4844"); cr.color_ramp.elements[1].color = hexc("#09090a")
        cr.color_ramp.elements[0].position = 0.0; cr.color_ramp.elements[1].position = 0.008
        silver = mat("silverC", "#e6e8ea", 0.12, metal=1.0)
        goldleaf = mat("goldleaf", "#f2c14e", 0.22, metal=1.0, emit="#a07018", emit_strength=0.55)
        add_bump(goldleaf, 90, 0.15, distance=0.003)
        box(bx - 10, by - 10, bs + 20, bs + 20, 10, silver, r=8)
        box(bx - 4, by - 4, bs + 8, bs + 8, 11, mat("blackbed", "#050506", 0.3), r=4)
        for r, c in grid(6, 6):
            x, y = bx + c * cs + 2, by + r * cs + 2
            box(x, y, cs - 4, cs - 4, 5, tile, r=2, z=11)
            if (r, c) in shown: text(x + cs / 2 - 2, y + cs / 2, sol[r][c], 34, goldleaf, z=16, depth=1.2, fnt="sans")
        box(bx + 3 * cs - 2, by - 4, 4, bs + 8, 17.5, silver, r=1)
        for rr in (2, 4): box(bx - 4, by + rr * cs - 2, bs + 8, 4, 17.5, silver, r=1)
        r, c = sel
        box(bx + c * cs + 2, by + r * cs + 2, cs - 4, cs - 4, 6, mat("tealglass", ACC, 0.05, trans=0.6, emit=ACC, emit_strength=0.9), r=2, z=11)
        for i in range(6):
            x = 15 + i * 61
            box(x, 704, 54, 46, 8, tile, r=6)
            text(x + 27, 727, i + 1, 22, goldleaf, z=8, depth=0.6)
        btn(C, 15, 764, 174, 46, "PENCIL", "outline", False, size=14)
        btn(C, 201, 764, 174, 46, "CLEAR", "outline", False, size=14)
        return
    stage(C, bold)
    frame = mat(f"frame{bold}", "#e9ecee", 0.18, metal=1.0) if True else None
    box(bx - 8, by - 8, bs + 16, bs + 16, 8, frame, r=6)
    box(bx - 3, by - 3, bs + 6, bs + 6, 9, mat("bed", "#071010", 0.3), r=3)
    tile = mat(f"sdk{bold}", "#162523" if not bold else "#0f1d1c", 0.3 if not bold else 0.12, coat=1.0, coat_rough=0.04)
    digit = gold_m(bold, "sgold") if not bold else mat("sgoldB", GOLD, 0.25, metal=0.6, emit=GOLD, emit_strength=1.6)
    if not bold: digit = mat("sgoldA", GOLD, 0.3, metal=0.5, emit=GOLD, emit_strength=0.7)
    for r, c in grid(6, 6):
        x, y = bx + c * cs + 2, by + r * cs + 2
        box(x, y, cs - 4, cs - 4, 5, tile, r=3, z=9)
        if (r, c) in shown: text(x + cs / 2 - 2, y + cs / 2, sol[r][c], 32, digit, z=14, depth=0.8)
    for xx in (3,):
        box(bx + xx * cs - 2, by - 3, 4, bs + 6, 15.5, frame, r=1)
    for rr in (2, 4): box(bx - 3, by + rr * cs - 2, bs + 6, 4, 15.5, frame, r=1)
    for k in (1, 2, 4, 5):
        box(bx + k * cs - 0.6, by, 1.2, bs, 14.2, mat("thin", "#55605e", 0.4, metal=1), r=0.3)
    for k in (1, 3, 5):
        box(bx, by + k * cs - 0.6, bs, 1.2, 14.2, mat("thin", "#55605e", 0.4, metal=1), r=0.3)
    r, c = sel
    box(bx + c * cs + 2, by + r * cs + 2, cs - 4, cs - 4, 5.6, mat(f"sel{bold}", ACC, 0.08, trans=0.5, coat=1, emit=ACC, emit_strength=1.4 if bold else 0.6), r=3, z=9)
    for i in range(6):
        btn(C, 15 + i * 61, 704, 54, 46, str(i + 1), "key", bold, size=20, fnt="sans")
    btn(C, 15, 764, 174, 46, "PENCIL", "outline", bold, size=14)
    btn(C, 201, 764, 174, 46, "CLEAR", "outline", bold, size=14)
sudoku.looks = ("A", "B", "C")

# ---------------------------------------------------------------- Hanoi (tower)
def tower(look):
    bold = look == "B"
    cam(bold)
    stage(C, bold)
    posts = [62, 150, 238, 326]
    stacks = {0: [9, 8, 7], 2: [6, 5, 4, 3, 1], 3: [2]}
    cols = ["#f2cc2a", "#a050f0", "#f063b8", "#e8414a", "#f08a2a", "#3cc46a", "#2fcfb6", "#3f9cf0", "#2f5fe0"]
    base_y, top_y, rh = 566, 260, 26
    oak = wood("oak", "#b07a45", "#6e4422", rough=0.35, coat=0.8, scale=4)
    panel(C, 14, 230, 362, 400, bold)
    box(24, 566, 342, 20, 12, wood("oakbase", "#8a5a30", "#4e2e14", scale=3), r=5, z=8)
    box(posts[0] - 40, 566, 80, 5, 20.5, gold_m(bold, "gpost"), r=2)
    for x in posts:
        ycyl(x, top_y, base_y - top_y + 4, 6, oak, z=26, bevel=5.5)
    for p, rings in stacks.items():
        for k, size in enumerate(rings):
            w = 24 + size * 7.6
            y = base_y - (k + 1) * rh
            m = mat(f"ring{size}{bold}", cols[size - 1], 0.18 if not bold else 0.08, coat=1.0, coat_rough=0.03,
                    trans=0.0 if not bold else 0.25, emit=cols[size - 1], emit_strength=0.15 if not bold else 0.45)
            box(posts[p] - w / 2, y + 1.5, w, rh - 3, 26, m, r=11.5, z=12)
    pills(C, 195, 604, [("Moves", "17"), ("Par", "34")], bold)
    undo_redo(C, [104, 204], bold=bold)
tower.looks = ("A", "B")

# ---------------------------------------------------------------- Polypotions (tubes)
TUBE_SYM = {"purple": "◆", "red": "■", "green": "▲", "orange": "✚", "brown": "♥",
            "yellow": "★", "pink": "●", "blue": "▼"}
def tubes(look):
    bold = look == "B"
    cam(bold, 4)
    order = ["purple", "red", "green", "orange", "brown", "yellow", "pink", "blue"]
    fills = [[], ["red", "orange", "green", "red", "purple"], ["red", "yellow", "green", "brown", "red"],
             ["yellow", "yellow", "yellow", "purple", "purple"], ["pink", "brown", "red", "brown"],
             ["blue", "orange", "brown", "orange"], ["green", "blue", "blue", "orange"],
             ["pink", "green", "pink", "purple", "orange"], ["blue", "purple", "pink", "yellow"], ["pink", "green", "blue", "yellow", "brown"]]
    xs = [52, 124, 195, 267, 339]
    rows = [(104, 300), (426, 300)]
    seg, tr, sel = 50, 25, 6
    colmap = dict(PIECE, brown="#9a5a34")
    if look == "C":   # the apothecary: cork-stoppered vials in a walnut rack with brass fittings, glowing tinctures
        world("#020304", 0.3, "night.exr", 0.25)
        backdrop(gradient_bg("bgC", CAT[C]["top"], CAT[C]["bot"], 0.8, noise=0.03))
        area(-220, -160, 820, 500, 3600, "#ffe6c0", sx=520, sy=380)
        area(560, 980, 140, 700, 1300, ACC, sx=900, sy=160)
        walnut = wood("walnutC", "#5a3519", "#24130a", scale=2.5)
        brass = brushed("brassC", "#d2a85c", 0.24)
        cork = mat("cork", "#b08a5a", 0.85); add_bump(cork, 220, 0.4, kind="voronoi", distance=0.003)
        glass_ = thin_glass("vial", "#f6fbff", 0.02, 1.2)
        for ry, rh in rows:
            box(10, ry - 12, 370, rh + 26, 14, walnut, r=8)
            box(10, ry + 40, 370, 10, 34, brass, r=3, z=0)
        for i, f in enumerate(fills):
            x = xs[i % 5]; ry, rh = rows[i // 5]; ytop = ry + (-16 if i == sel else 0)
            test_tube(x, ytop, rh - 6, tr, glass_, z=tr + 16)
            ycyl(x, ytop - 16, 22, tr - 3, cork, z=tr + 16, bevel=3)
            bottom = ytop + rh - 14
            for k, cn in enumerate(f):
                yb = bottom - k * seg
                lm = potion(f"potC{cn}", colmap[cn], 0.5)
                if k == 0:
                    ycyl(x, yb - seg + 1, seg - (tr - 3.5), tr - 3.5, lm, z=tr + 16, bevel=0.5)
                    sphere(x, yb - (tr - 3.5) + 1, tr - 3.5, lm, z=tr + 16)
                else:
                    ycyl(x, yb - seg + 1, seg - 1.5, tr - 3.5, lm, z=tr + 16, bevel=2.5)
                text(x, yb - seg / 2, TUBE_SYM[cn], 14, mat("symC", "#f6e7bf", 0.3, metal=1, emit="#f6e7bf", emit_strength=0.6), z=2 * tr + 14, fnt="sym")
            if i == sel:
                outline(x - tr - 7, ytop - 22, 2 * tr + 14, rh + 22, tr + 7, emissive("selC", GOLD, 3.0), z=15)
        pills(C, 195, 744, [("Pours", "1 / 30"), ("Par", "24")])
        undo_redo(C, [100, 206], y=772)
        return
    stage(C, bold)
    glass_ = thin_glass(f"tube{bold}", "#f6fbff", 0.02 if not bold else 0.01, 1.0 if not bold else 1.4)
    panel(C, 14, 86, 362, 676, bold, d=4)
    box(22, 94, 346, 660, 4.5, mat("tubeback", "#123632", 0.5, coat=0.4), r=12)
    for i, f in enumerate(fills):
        x = xs[i % 5]; ry, rh = rows[i // 5]; ytop = ry + (-14 if i == sel else 0)
        test_tube(x, ytop, rh, tr, glass_, z=tr + 6)
        ycyl(x, ytop - 2, 5, tr + 1.8, glass_, z=tr + 6, bevel=2)
        bottom = ytop + rh - 8
        for k, cn in enumerate(f):
            yb = bottom - k * seg
            lm = potion(f"pot{cn}{bold}", colmap[cn], 0.35 if not bold else 0.9)
            if k == 0:
                ycyl(x, yb - seg + 1, seg - (tr - 3.5), tr - 3.5, lm, z=tr + 6, bevel=0.5)
                sphere(x, yb - (tr - 3.5) + 1, tr - 3.5, lm, z=tr + 6)
            else:
                ycyl(x, yb - seg + 1, seg - 1.5, tr - 3.5, lm, z=tr + 6, bevel=2.0)
            text(x, yb - seg / 2, TUBE_SYM[cn], 14, T("#ffffff", 0.6, "symW"), z=2 * tr + 4, fnt="sym")
        if i == sel:
            outline(x - tr - 6, ytop - 6, 2 * tr + 12, rh + 12, tr + 6, emissive("selG", GOLD, 3.0 if bold else 2.0), z=5)
    pills(C, 195, 744, [("Pours", "1 / 30"), ("Par", "24")], bold)
    undo_redo(C, [100, 206], y=772, bold=bold)
tubes.looks = ("A", "B", "C")

# ---------------------------------------------------------------- Safe Cracker
def safe(look):
    bold = look == "B"
    cam(bold)
    stage(C, bold)
    clues = ["④ − ③ = −2", "④ is even", "The dials add up to 9",
             "② is less than ①", "① and ② differ by exactly 5"]
    panel(C, 14, 200, 362, 196, bold, d=5)
    for i, c in enumerate(clues): text(195, 232 + i * 33, c, 19, T(WHITE, 0.45, "clue"), z=6, fnt="sym")
    steel = brushed(f"steel{bold}", "#3a3f44" if not bold else "#2a2e33", 0.32, aniso=0.5, stretch=(60, 1, 1))
    box(14, 410, 362, 230, 18, mat("safeedge", "#0b0d0f", 0.3, metal=1.0), r=12)
    box(22, 418, 346, 214, 19, steel, r=9)
    for i in range(4): cyl([32, 358][i % 2], [428, 622][i // 2], 4, 21, mat("rivet", "#9aa0a6", 0.25, metal=1), bevel=1.5)
    drum = mat(f"drum{bold}", GOLD, 0.24, metal=1.0, emit="#7a5410", emit_strength=0.3 if not bold else 0.6)
    add_bump(drum, 40, 0.06, stretch=(1, 30, 1), distance=0.003)
    digm = ink("drumdig", "#120d04", 0.5)
    for x, d in zip([66, 152, 238, 324], [5, 0, 0, 0]):
        box(x - 34, 474, 68, 100, 21, mat("well", "#050607", 0.5), r=6)
        xcyl(x - 29, 524, 58, 36, drum, z=4, bevel=2)
        text(x, 524, d, 42, digm, z=40.2, fnt="sans")
        text(x, 486, (d + 1) % 10, 16, ink("dimd", "#6a4c14", 0.5), z=33, fnt="sans", rx=-0.8)
        text(x, 562, (d - 1) % 10, 16, ink("dimd", "#6a4c14", 0.5), z=33, fnt="sans", rx=0.8)
        for yy, sym in ((444, "▲"), (606, "▼")):
            box(x - 24, yy - 17, 48, 34, 6, accent_m(C, 0.6 if not bold else 1.4), r=7, z=19)
            text(x, yy, sym, 15, ink("arr", "#04110e", 0.5), z=25, fnt="sym")
    text(195, 656, "tries left 3  ·  clean crack", 13, T("#b8c0be", 0.35, "tries"), z=1, fnt="sans6")
    btn(C, 16, 764, 358, 50, "TRY", "gold", bold, size=18, fnt="sans")
safe.looks = ("A", "B")

# ---------------------------------------------------------------- Mosaic (nonogram)
def nonogram(look):
    bold = look == "B"
    cam(bold)
    stage(C, bold)
    pic = ["..####..", ".######.", "###..###", "##....##", "########", ".##..##.", "..#..#..", ".##..##."]
    N = 8
    def runs(seq):
        out, k = [], 0
        for ch in seq + ".":
            if ch == "#": k += 1
            elif k: out.append(k); k = 0
        return out or [0]
    rows_c = [runs(r) for r in pic]
    cols_c = [runs("".join(pic[r][c] for r in range(N))) for c in range(N)]
    filled = ({(r, c) for r in range(4) for c in range(N) if pic[r][c] == "#"} | {(4, c) for c in range(5)}) - {(1, 6), (3, 7)}
    x0, y0, cs = 84, 342, 36
    panel(C, 12, 262, 366, 392, bold)
    tile = mat(f"mtile{bold}", ACC, 0.12 if not bold else 0.05, coat=1.0, coat_rough=0.02, trans=0.0 if not bold else 0.3,
               emit=ACC, emit_strength=0.25 if not bold else 0.9)
    add_bump(tile, 14, 0.05, distance=0.01)
    empty = cellm(C, "cell", bold)
    for r, c in grid(N, N):
        x, y = x0 + c * cs, y0 + r * cs
        if (r, c) in filled: box(x + 2, y + 2, cs - 4, cs - 4, 9, tile, r=4, z=8)
        else: box(x + 2.5, y + 2.5, cs - 5, cs - 5, 3, empty, r=3, z=8)
    num = T(WHITE, 0.45, "clueW")
    for r, rc in enumerate(rows_c):
        text(74, y0 + r * cs + cs / 2, "  ".join(map(str, rc)), 16, num, z=9, align="RIGHT", fnt="sans")
    for c, cc in enumerate(cols_c):
        for k, v in enumerate(reversed(cc)):
            text(x0 + c * cs + cs / 2, y0 - 14 - k * 19, v, 16, num, z=9, fnt="sans")
    pills(C, 195, 678, [("Lines", "4 / 16")], bold)
nonogram.looks = ("A", "B")

# ---------------------------------------------------------------- Colour Flood
def flood(look):
    bold = look == "B"
    cam(bold)
    stage(C, bold)
    N = 14
    rnd = random.Random(7)
    g = [[rnd.randrange(5) for _ in range(N)] for _ in range(N)]
    for _ in range(3):
        g2 = [row[:] for row in g]
        for r in range(N):
            for c in range(N):
                if rnd.random() < 0.55:
                    rr, cc = r + rnd.choice((-1, 0, 1)), c + rnd.choice((-1, 0, 1))
                    if 0 <= rr < N and 0 <= cc < N: g2[r][c] = g[rr][cc]
        g = g2
    def flood_to(col):
        start = g[0][0]; seen = {(0, 0)}; st = [(0, 0)]
        while st:
            r, c = st.pop()
            for rr, cc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
                if 0 <= rr < N and 0 <= cc < N and (rr, cc) not in seen and g[rr][cc] == start:
                    seen.add((rr, cc)); st.append((rr, cc))
        for r, c in seen: g[r][c] = col
        return seen
    for col in (1, 3, 0, 2, 4, 0): flood_to(col)
    region = flood_to(0)
    cols = ["#e46aa8", "#3d6ee6", "#35c2a6", "#e8c53a", "#e8862e"]
    x0, y0, cs = 12, 205, 366 / N
    panel(C, x0 - 6, y0 - 6, N * cs + 12, N * cs + 12, bold, d=5, r=10)
    ms = []
    for i, cc in enumerate(cols):
        m = mat(f"fl{i}{bold}", cc, 0.1 if not bold else 0.04, coat=1.0, coat_rough=0.02, emit=cc, emit_strength=0.12 if not bold else 0.4)
        if not bold: add_bump(m, 14, 0.06, detail=3, distance=0.01)   # a hand-glazed ripple
        ms.append(m)
    rnd2 = random.Random(3)
    for r, c in grid(N, N):
        x, y = x0 + c * cs, y0 + r * cs
        inr = (r, c) in region
        box(x + 0.9, y + 0.9, cs - 1.8, cs - 1.8, 6 + (2.5 if inr else 0), ms[g[r][c]], r=2.4, z=5)
    pills(C, 195, 735, [("Moves", "6 / 18"), ("Par", "12")], bold)
    pxs = [70, 132, 195, 258, 320]
    for i, x in enumerate(pxs):
        sphere(x, 788, 24, mat(f"pick{i}{bold}", cols[i], 0.04, coat=1.0, emit=cols[i], emit_strength=0.15 if not bold else 0.5), z=26)
    torus(pxs[0], 788, 29, 2.4, emissive("pickring", "#ffffff", 1.5 if bold else 0.8), z=4)
flood.looks = ("A", "B")

# ---------------------------------------------------------------- Minefield
def minesweeper(look):
    bold = look == "B"
    cam(bold, 5)
    stage(C, bold)
    COLS, ROWS = 10, 16
    rnd = random.Random(11)
    mines = set()
    while len(mines) < 20:
        p = (rnd.randrange(ROWS), rnd.randrange(COLS))
        if not (6 <= p[0] <= 10 and 2 <= p[1] <= 7): mines.add(p)
    def cnt(r, c): return sum((r + a, c + b) in mines for a in (-1, 0, 1) for b in (-1, 0, 1))
    open_ = set(); st = [(8, 4)]
    while st:
        r, c = st.pop()
        if (r, c) in open_ or not (0 <= r < ROWS and 0 <= c < COLS) or (r, c) in mines: continue
        open_.add((r, c))
        if cnt(r, c) == 0: st += [(r + a, c + b) for a in (-1, 0, 1) for b in (-1, 0, 1)]
    hits = set(list(sorted(m for m in mines if m[0] > 11))[:2])
    flags = set(list(sorted(m for m in mines if 4 <= m[0] <= 11))[:3])
    ncol = {1: "#4aa3ff", 2: "#53d36b", 3: "#ff6a5a", 4: "#b98aff", 5: "#ffb24a"}
    x0, y0, cs = 6, 104, 37.8
    panel(C, x0 - 3, y0 - 3, COLS * cs + 6, ROWS * cs + 6, bold, d=4, r=6)
    raised = mat(f"plate{bold}", "#6b7179", 0.35, metal=0.7, coat=0.5)
    add_bump(raised, 60, 0.03, stretch=(1, 40, 1), distance=0.003)
    sunk = mat(f"sunk{bold}", "#1b2124", 0.5)
    red = mat("hitred", "#d8242c", 0.3, emit="#d8242c", emit_strength=0.6 if bold else 0.3)
    iron = mat("iron", "#141516", 0.3, metal=1.0)
    for r, c in grid(COLS, ROWS):
        x, y = x0 + c * cs, y0 + r * cs
        if (r, c) in hits:
            box(x + 1, y + 1, cs - 2, cs - 2, 3, red, r=3, z=4)
            sphere(x + cs / 2, y + cs / 2, 9, iron, z=14)
            for a in range(8):
                ang = a * math.pi / 4
                ob = cone(x + cs / 2 + math.cos(ang) * 8, y + cs / 2 + math.sin(ang) * 8, 2.6, 0.6, 7, iron, z=14)
                ob.rotation_euler = (0, math.pi / 2, -ang); ob.location = V(x + cs / 2 + math.cos(ang) * 7, y + cs / 2 - math.sin(ang) * -7, 14)
        elif (r, c) in open_:
            box(x + 0.6, y + 0.6, cs - 1.2, cs - 1.2, 3, sunk, r=1.5, z=4)
            n = cnt(r, c)
            if n: text(x + cs / 2, y + cs / 2, n, 20, T(ncol[n], 0.6 if not bold else 1.2, f"n{n}{bold}"), z=7, fnt="sans")
        else:
            box(x + 1.2, y + 1.2, cs - 2.4, cs - 2.4, 9, raised, r=3.5, z=4)
            if (r, c) in flags:
                ycyl(x + cs / 2 - 4, y + 7, 22, 1.4, mat("pin", "#d9dde0", 0.2, metal=1), z=14.5, bevel=0.5)
                box(x + cs / 2 - 3, y + 7, 13, 10, 1.5, mat("flag", "#e8414a", 0.6, sheen=0.5, emit="#e8414a", emit_strength=0.2), r=1, z=15)
    pills(C, 195, 88, [("Safe", "86 / 140"), ("Mines", "20"), ("Hits", "2")], bold)
    btn(C, 4, 776, 186, 48, "Reveal", "outline", bold, size=15)
    box(4 - 2, 776 - 2, 190, 52, 5.2, gold_m(bold, "revgold"), r=12, z=-0.3)
    btn(C, 200, 776, 186, 48, "⚑ Flag", "key", bold, size=15, fnt="sym")
minesweeper.looks = ("A", "B")

# ---------------------------------------------------------------- Tents and Trees
def tents(look):
    bold = look == "B"
    cam(bold)
    stage(C, bold)
    COLS, ROWS = 8, 9
    trees = [(0, 1), (0, 6), (1, 3), (2, 1), (3, 0), (3, 4), (4, 1), (4, 4), (6, 0), (6, 5), (7, 7), (8, 3)]
    tents_ = [(0, 2), (0, 7), (1, 4), (2, 2), (3, 5), (4, 5)]
    grass = [(1, 0), (2, 6), (5, 3)]
    colc = ["2", "0", "4", "0", "3", "?", "1", "?"]
    rowc = ["2", "1", "?", "?", "?", "?", "2", "2", "1"]
    x0, y0, cs = 44, 262, 41.5
    panel(C, 8, 226, 374, 420, bold)
    grassm = mat(f"turf{bold}", "#1e3326" if not bold else "#132519", 0.85, sheen=0.4)
    add_bump(grassm, 500, 0.4, distance=0.002)
    tag = wood("tag", "#b07040", "#7a4a26", scale=6)
    for c, v in enumerate(colc):
        box(x0 + c * cs + 7, 232, cs - 14, 22, 5, tag, r=4, z=5)
        text(x0 + c * cs + cs / 2, 243, v, 14, T(WHITE, 0.4, "tagT"), z=10, fnt="sans")
    for r, v in enumerate(rowc):
        box(14, y0 + r * cs + 9, 24, cs - 18, 5, tag, r=4, z=5)
        text(26, y0 + r * cs + cs / 2, v, 14, T(WHITE, 0.4, "tagT"), z=10, fnt="sans")
    for r, c in grid(COLS, ROWS):
        box(x0 + c * cs + 1.2, y0 + r * cs + 1.2, cs - 2.4, cs - 2.4, 4, grassm, r=3, z=5)
    pine = mat(f"pine{bold}", "#3aa858", 0.45, coat=0.6, emit="#3aa858", emit_strength=0.05 if not bold else 0.35)
    trunk = wood("trunk", "#7a4a26", "#4a2a12", scale=8)
    for r, c in trees:
        cx, cy = x0 + c * cs + cs / 2, y0 + r * cs + cs / 2
        box(cx - 2.5, cy + 8, 5, 8, 4, trunk, r=1, z=9)
        for k, (w_, top, bot) in enumerate(((26, -4, 10), (20, -10, 3), (13, -16, -5))):
            slab([(cx - w_ / 2, cy + bot), (cx + w_ / 2, cy + bot), (cx, cy + top - 4)], 5 + k * 1.5, pine, z=9 + k * 1.2, bevel=0.8)
    canvas = mat(f"canvas{bold}", GOLD, 0.55, sheen=0.4, coat=0.3, emit="#ffae3a", emit_strength=0.1 if not bold else 1.0)
    add_bump(canvas, 300, 0.12, stretch=(1, 3, 1), distance=0.002)
    door = mat("tentdoor", "#4a3010", 0.6)
    for r, c in tents_:
        cx, cy = x0 + c * cs + cs / 2, y0 + r * cs + cs / 2
        slab([(cx - 15, cy + 12), (cx + 15, cy + 12), (cx, cy - 14)], 7, canvas, z=9, bevel=1.0)
        slab([(cx - 4.5, cy + 12), (cx + 4.5, cy + 12), (cx, cy + 1)], 7.6, door, z=9, bevel=0.3)
    for r, c in grass:
        sphere(x0 + c * cs + cs / 2, y0 + r * cs + cs / 2, 4, mat("grassdot", "#5fbf6a", 0.5), z=10)
    pills(C, 195, 668, [("Grass marked", "3")], bold)
tents.looks = ("A", "B")

# ---------------------------------------------------------------- Shikaku
def _partition(cols, rows, seed):
    rnd = random.Random(seed)
    rects = [(0, 0, cols, rows)]
    out = []
    while rects:
        x, y, w, h = rects.pop()
        a = w * h
        if a <= 9 and (a <= 4 or rnd.random() < 0.6) or (w == 1 and h == 1):
            out.append((x, y, w, h)); continue
        if (w >= h and w > 1) or h == 1:
            k = rnd.randint(1, w - 1); rects += [(x, y, k, h), (x + k, y, w - k, h)]
        else:
            k = rnd.randint(1, h - 1); rects += [(x, y, w, k), (x, y + k, w, h - k)]
    return out

def shikaku(look):
    bold = look == "B"
    cam(bold)
    stage(C, bold)
    COLS, ROWS = 10, 11
    rects = _partition(COLS, ROWS, 5)
    rnd = random.Random(2)
    x0, y0, cs = 15, 240, 36
    panel(C, x0 - 6, y0 - 6, COLS * cs + 12, ROWS * cs + 12, bold)
    cellm_ = cellm(C, "cell", bold)
    for r, c in grid(COLS, ROWS):
        box(x0 + c * cs + 1.5, y0 + r * cs + 1.5, cs - 3, cs - 3, 3, cellm_, r=2.5, z=6)
    placed = sorted(rects, key=lambda t: (t[1], t[0]))[:5]
    goldglass = mat(f"gglass{bold}", "#e6b54a", 0.08, trans=0.55, coat=1.0, emit="#c8921e", emit_strength=0.25 if not bold else 0.7)
    rim = gold_m(bold, "srim")
    for (x, y, w, h) in placed:
        px, py, pw, ph = x0 + x * cs + 2, y0 + y * cs + 2, w * cs - 4, h * cs - 4
        box(px, py, pw, ph, 5, goldglass, r=5, z=9)
        box(px - 1, py - 1, pw + 2, ph + 2, 4.6, rim, r=5.5, z=9)
    for (x, y, w, h) in rects:
        cx, cy = x + rnd.randrange(w), y + rnd.randrange(h)
        text(x0 + cx * cs + cs / 2, y0 + cy * cs + cs / 2, w * h, 17, T(WHITE, 0.45, "shiN"), z=14.5, fnt="sans")
    pills(C, 195, 662, [("Rectangles", f"{len(placed)} / {len(rects)}")], bold)
shikaku.looks = ("A", "B")

# ---------------------------------------------------------------- Lamplighter (lightup)
def lightup(look):
    bold = look == "B"
    cam(bold)
    stage(C, bold, key=0.6 if bold else 0.85)
    N = 10
    walls = {(0, 0): None, (0, 5): None, (0, 6): None, (0, 9): "0", (1, 0): "0", (1, 1): "0", (1, 3): "2", (1, 9): None,
             (2, 0): None, (2, 4): "3", (2, 9): None, (3, 8): "1", (4, 1): "2", (4, 4): "0", (5, 0): None, (5, 9): None,
             (6, 2): "0", (6, 3): None, (7, 4): "0", (7, 5): "0", (7, 6): "1", (8, 6): "0", (9, 0): None, (9, 7): None}
    lamps = [(0, 7), (1, 2), (1, 4), (2, 3), (3, 6), (4, 8), (6, 4)]
    lit = set()
    for (r, c) in lamps:
        lit.add((r, c))
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            rr, cc = r + dr, c + dc
            while 0 <= rr < N and 0 <= cc < N and (rr, cc) not in walls:
                lit.add((rr, cc)); rr += dr; cc += dc
    x0, y0, cs = 10, 236, 37
    panel(C, x0 - 5, y0 - 5, N * cs + 10, N * cs + 10, bold)
    dark = cellm(C, "cell", bold)
    litm = mat(f"lit{bold}", "#1f2a24", 0.3, coat=0.6, emit="#f2b84a", emit_strength=0.0 if not bold else 0.05)
    wall = mat("wallblk", "#050606", 0.35, coat=0.8)
    beam = emissive(f"beam{bold}", "#f6c35a", 2.0 if not bold else 4.0)
    for r, c in grid(N, N):
        x, y = x0 + c * cs, y0 + r * cs
        if (r, c) in walls:
            box(x + 1, y + 1, cs - 2, cs - 2, 14, wall, r=2.5, z=5)
            box(x + 0.4, y + 0.4, cs - 0.8, cs - 0.8, 13.6, mat("walledge", "#3a4442", 0.3, metal=1), r=2.8, z=5)
            if walls[(r, c)] is not None:
                text(x + cs / 2, y + cs / 2, walls[(r, c)], 17, T(WHITE, 0.5, "wallN"), z=19.2, fnt="sans")
                text(x + cs - 7, y + 7, "✓", 8, T(ACC, 0.8, "tick"), z=19.2, fnt="sym")
        else:
            box(x + 1.5, y + 1.5, cs - 3, cs - 3, 3, litm if (r, c) in lit else dark, r=2.5, z=5)
    # beams along lit runs
    for (r, c) in lamps:
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            rr, cc = r, c
            while 0 <= rr + dr < N and 0 <= cc + dc < N and (rr + dr, cc + dc) not in walls: rr += dr; cc += dc
            if (rr, cc) != (r, c):
                ax, ay = x0 + c * cs + cs / 2, y0 + r * cs + cs / 2
                bx_, by_ = x0 + cc * cs + cs / 2, y0 + rr * cs + cs / 2
                tube([(ax, ay), (bx_, by_)], 0.9, beam, z=9, round_caps=False)
    brass = gold_m(bold, "lampbrass")
    bulb = emissive(f"bulb{bold}", "#ffd98a", 8.0 if not bold else 14.0)
    for (r, c) in lamps:
        cx, cy = x0 + c * cs + cs / 2, y0 + r * cs + cs / 2
        cyl(cx, cy, 10, 4, brass, z=8, bevel=1.5)
        sphere(cx, cy, 8, bulb, z=18)
        point(cx, cy, 22, 3 if not bold else 7, "#ffcf7a", radius=6)
    pills(C, 195, 640, [("Lamps", "7"), ("Dots", "0")], bold)
lightup.looks = ("A", "B")

# ---------------------------------------------------------------- Trail
def trail(look):
    bold = look == "B"
    cam(bold)
    stage(C, bold)
    N = 6
    path = [(5, 0), (5, 1), (4, 1), (4, 0), (3, 0), (2, 0), (1, 0), (0, 0), (0, 1), (1, 1), (2, 1), (3, 1), (3, 2), (2, 2),
            (1, 2), (0, 2), (0, 3), (0, 4), (0, 5), (1, 5), (1, 4), (1, 3), (2, 3), (2, 4), (2, 5), (3, 5), (4, 5), (5, 5),
            (5, 4), (4, 4), (3, 4), (3, 3), (4, 3), (4, 2), (5, 2), (5, 3)]
    num = {p: i + 1 for i, p in enumerate(path)}
    givens = {1, 7, 9, 13, 16, 20, 22, 24, 25, 27, 29, 33, 36}
    done = 9
    x0, y0, cs = 15, 232, 60
    panel(C, x0 - 6, y0 - 6, N * cs + 12, N * cs + 12, bold)
    cellm_ = mat(f"tcell{bold}", "#1b2a23", 0.4, coat=0.5)
    stone = mat(f"stone{bold}", "#8d9294", 0.55, coat=0.2); add_bump(stone, 70, 0.15, distance=0.003)
    cream = mat("cream", "#efe6d0", 0.3, coat=0.6)
    for r, c in grid(N, N):
        box(x0 + c * cs + 2, y0 + r * cs + 2, cs - 4, cs - 4, 4, cellm_, r=5, z=6)
    pts = [(x0 + c * cs + cs / 2, y0 + r * cs + cs / 2) for (r, c) in path[:done]]
    pathm = wood("pathwood", "#8a5a32", "#5a3518", scale=5) if not bold else mat("pathB", "#c8893a", 0.3, metal=0.4, emit="#e09a3a", emit_strength=1.2)
    tube(pts, 6, pathm, z=12)
    for p in path:
        n = num[p]; r, c = p
        cx, cy = x0 + c * cs + cs / 2, y0 + r * cs + cs / 2
        if n <= done:
            cyl(cx, cy, 17, 8, cream, z=10, bevel=3)
            if n == done: torus(cx, cy, 18.5, 2.2, accent_m(C, 0.8 if not bold else 1.8), z=17)
            text(cx, cy, n, 18, T("#1c1712", 0.0, "dark"), z=18.1, fnt="sans")
        elif n in givens:
            box(cx - 22, cy - 22, 44, 44, 12, stone, r=6, z=10)
            text(cx, cy, n, 20, T(WHITE, 0.45, "trailN"), z=22.1, fnt="sans")
    pills(C, 195, 620, [("Next", "10"), ("", "26 to go")], bold)
    btn(C, 15, 779, 174, 46, UNDO, "outline", bold, size=20, fnt="sym")
    btn(C, 201, 779, 174, 46, REDO, "outline", bold, size=20, fnt="sym")
trail.looks = ("A", "B")

# ---------------------------------------------------------------- Loopline (fences)
def _region_loop(N, seed):
    rnd = random.Random(seed)
    reg = {(2, 2)}
    while len(reg) < 15:
        r, c = rnd.choice(sorted(reg))
        nb = (r + rnd.choice((-1, 0, 1)), c) if rnd.random() < 0.5 else (r, c + rnd.choice((-1, 0, 1)))
        if 0 <= nb[0] < N and 0 <= nb[1] < N: reg.add(nb)
    edges = set()
    for r, c in reg:
        for (dr, dc, e) in ((-1, 0, ("h", r, c)), (1, 0, ("h", r + 1, c)), (0, -1, ("v", r, c)), (0, 1, ("v", r, c + 1))):
            if (r + dr, c + dc) not in reg: edges.add(e)
    return reg, edges

def fences(look):
    bold = look == "B"
    cam(bold)
    stage(C, bold)
    N = 6
    reg, edges = _region_loop(N, 4)
    def count(r, c): return sum(e in edges for e in (("h", r, c), ("h", r + 1, c), ("v", r, c), ("v", r, c + 1)))
    rnd = random.Random(1)
    shown = {(r, c) for r, c in grid(N, N) if rnd.random() < 0.45}
    def ends(e):
        k, r, c = e
        return ((r, c), (r, c + 1)) if k == "h" else ((r, c), (r + 1, c))
    order = [sorted(edges)[0]]; left = set(edges) - {order[0]}; tip = ends(order[0])[1]
    while left:
        nxt = next(e for e in left if tip in ends(e)); left.discard(nxt); order.append(nxt)
        a, b = ends(nxt); tip = b if a == tip else a
    drawn = order[: len(order) * 2 // 3]
    x0, y0, cs = 30, 250, 55
    panel(C, 12, 232, 366, 366, bold)
    peg = mat(f"peg{bold}", "#e9ecee", 0.15, metal=1.0)
    for r in range(N + 1):
        for c in range(N + 1):
            sphere(x0 + c * cs, y0 + r * cs, 3.8, peg, z=10)
            cyl(x0 + c * cs, y0 + r * cs, 2, 6, peg, z=4, bevel=0.4)
    wire = mat(f"wire{bold}", GOLD, 0.2, metal=1.0, emit=GOLD, emit_strength=0.4 if not bold else 2.2)
    for (k, r, c) in drawn:
        if k == "h": a, b = (x0 + c * cs, y0 + r * cs), (x0 + (c + 1) * cs, y0 + r * cs)
        else: a, b = (x0 + c * cs, y0 + r * cs), (x0 + c * cs, y0 + (r + 1) * cs)
        tube([a, b], 3.2, wire, z=10, round_caps=False)
    for r, c in shown:
        n = count(r, c)
        met = n == sum((k == "h" and ((rr, cc) in ((r, c), (r + 1, c))) or (k == "v" and (rr, cc) in ((r, c), (r, c + 1)))) for (k, rr, cc) in drawn)
        text(x0 + c * cs + cs / 2, y0 + r * cs + cs / 2, n, 24, T(WHITE if met else "#8a9692", 0.5 if met else 0.2, f"fn{met}"), z=8.4, fnt="sans")
    pills(C, 195, 616, [("Lines", str(len(drawn)))], bold)
    undo_redo(C, [24, 200], w=166, bold=bold)
fences.looks = ("A", "B")

# ---------------------------------------------------------------- Regions (fillomino)
def fillomino(look):
    bold = look == "B"
    cam(bold)
    stage(C, bold)
    g = ["1555333", "3355422", "7371477", "7777...", "7..15..", "..11.54", "3.24..1"]
    N = 7
    cells = {(r, c): int(g[r][c]) for r, c in grid(N, N) if g[r][c] != "."}
    comp = {}; tints = {}
    pal = ["#3b3f7a", "#5a4826", "#2a5a52", "#5a2f5a", "#2f4a6e", "#4e5a26", "#6a3a2a"]
    seen = set(); k = 0
    for p in cells:
        if p in seen: continue
        st = [p]; grp = set()
        while st:
            q = st.pop()
            if q in grp: continue
            grp.add(q)
            for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nq = (q[0] + d[0], q[1] + d[1])
                if cells.get(nq) == cells[p] and nq not in grp: st.append(nq)
        seen |= grp
        if len(grp) == cells[p]:
            for q in grp: tints[q] = pal[k % len(pal)]
            k += 1
        elif len(grp) > cells[p]:
            for q in grp: tints[q] = "clash"
    x0, y0, cs = 15, 168, 360 / N
    panel(C, x0 - 6, y0 - 6, 372, 372, bold)
    for r, c in grid(N, N):
        x, y = x0 + c * cs, y0 + r * cs
        t = tints.get((r, c))
        if t == "clash": m = mat("clash", "#5a1414", 0.3, coat=0.8, emit="#c02020", emit_strength=0.3 if not bold else 0.8)
        elif t: m = mat(f"tint{t}{bold}", t, 0.25, coat=1.0, emit=t, emit_strength=0.0 if not bold else 0.3)
        else: m = cellm(C, "cell", bold)
        box(x + 1.5, y + 1.5, cs - 3, cs - 3, 5, m, r=3.5, z=6)
        if (r, c) in cells:
            col = "#ff6a6a" if t == "clash" else (GOLD if (r + c) % 3 == 0 and not t else WHITE)
            text(x + cs / 2, y + cs / 2, cells[(r, c)], 24, T(col, 0.5 if not bold else 0.9, f"fil{col}{bold}"), z=11.2, fnt="sans")
    pills(C, 195, 560, [("In finished regions", "23 / 49")], bold)
    for i in range(10):
        x, y = 15 + (i % 5) * 73, 652 + (i // 5) * 56
        lab = str(i + 1) if i < 9 else "⌫"
        btn(C, x, y, 66, 48, lab, "accent" if i == 3 else "key", bold, size=19, fnt="sans" if i < 9 else "sym")
    undo_redo(C, [15, 201], y=774, w=174, bold=bold)
fillomino.looks = ("A", "B")

# ---------------------------------------------------------------- Island Link (bridges)
def bridges(look):
    bold = look == "B"
    cam(bold)
    stage(C, bold)
    xs = [42, 143, 246, 348]; ys = [265, 367, 470, 571]
    isl = {(0, 2): 2, (1, 0): 1, (1, 1): 2, (1, 2): 5, (1, 3): 4, (2, 0): 1, (2, 2): 1, (3, 0): 2, (3, 1): 4, (3, 3): 4}
    br = [((1, 0), (1, 1), 1), ((0, 2), (1, 2), 2), ((1, 2), (1, 3), 2), ((1, 1), (3, 1), 1)]
    deg = {k: 0 for k in isl}
    for a, b, n in br: deg[a] += n; deg[b] += n
    panel(C, 12, 226, 366, 386, bold)
    for x in range(30, 370, 34):
        for y in range(244, 600, 34):
            cyl(x, y, 1.2, 1, mat("latt", "#2c3b38", 0.5), z=8, bevel=0)
    rod = mat(f"rod{bold}", GOLD, 0.2, metal=1.0, emit=GOLD, emit_strength=0.3 if not bold else 1.6)
    for a, b, n in br:
        ax, ay = xs[a[1]], ys[a[0]]; bx_, by_ = xs[b[1]], ys[b[0]]
        horiz = ay == by_
        offs = [0] if n == 1 else [-5, 5]
        for o in offs:
            pa = (ax + (0 if horiz else o), ay + (o if horiz else 0)); pb = (bx_ + (0 if horiz else o), by_ + (o if horiz else 0))
            tube([pa, pb], 2.6, rod, z=14, round_caps=False)
    enamel = mat(f"enamel{bold}", "#0b1110", 0.12, coat=1.0)
    for (r, c), n in isl.items():
        cx, cy = xs[c], ys[r]
        full = deg[(r, c)] == n
        rim = gold_m(bold, "irim") if full else mat("silv", "#c9ced1", 0.18, metal=1.0)
        cyl(cx, cy, 19, 12, rim, z=8, bevel=2.5)
        cyl(cx, cy, 15, 13.4, mat(f"ifill{bold}", "#c39a3a", 0.35, metal=0.8) if full else enamel, z=8, bevel=0.6)
        text(cx, cy, n, 21, ink(f"isl{full}", WHITE if not full else "#1a1206", 0.6, glow=0.5 if not full else 0.0), z=21.6, depth=0.8, fnt="sans")
    pills(C, 195, 630, [("Islands", "3 / 10"), ("Bridges", "6")], bold)
    undo_redo(C, [24, 200], w=166, bold=bold)
bridges.looks = ("A", "B")

GAMES = dict(sudoku=sudoku, tower=tower, tubes=tubes, safe=safe, nonogram=nonogram, flood=flood, minesweeper=minesweeper,
             tents=tents, shikaku=shikaku, lightup=lightup, trail=trail, fences=fences, fillomino=fillomino, bridges=bridges)
if __name__ == "__main__":
    run(C, GAMES)
