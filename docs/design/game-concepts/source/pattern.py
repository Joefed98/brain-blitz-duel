"""Pattern concepts (8 games): A today upgraded, B bolder.
Run:  /opt/blender/venv/bin/python pattern.py [game[:A,B]] ..."""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from jzlib import *
from kit import *

C = "pattern"
ACC = CAT[C]["accent"]

def lacquer(name, color, bold, glow_b=0.45, glow_a=0.08, rough=0.12):
    return mat(f"{name}{bold}", color, rough if not bold else 0.06, coat=1.0, coat_rough=0.02,
               emit=color, emit_strength=glow_a if not bold else glow_b)

# ---------------------------------------------------------------- Tessellate (blockparty)
SHAPES = {
    "plus": ([(0, 1), (1, 0), (1, 1), (1, 2), (2, 1)], PIECE["red"]),
    "bar3": ([(0, 0), (0, 1), (0, 2)], PIECE["blue"]),
    "bar4g": ([(0, 0), (0, 1), (0, 2), (0, 3)], PIECE["green"]),
    "bar4p": ([(0, 0), (0, 1), (0, 2), (0, 3)], PIECE["purple"]),
    "sq": ([(0, 0), (0, 1), (1, 0), (1, 1)], PIECE["pink"]),
    "l3": ([(0, 0), (0, 1), (1, 0)], PIECE["orange"]),
    "l4": ([(0, 0), (1, 0), (2, 0), (2, 1)], PIECE["brown"]),
    "f": ([(0, 0), (1, 0), (1, 1), (2, 0)], PIECE["yellow"]),
    "s": ([(0, 1), (0, 2), (1, 0), (1, 1)], PIECE["white"]),
}
def blockparty(look):
    bold = look == "B"
    cam(bold)
    stage(C, bold)
    N, x0, y0, cs = 7, 13, 152, 52
    panel(C, x0 - 5, y0 - 5, N * cs + 10, N * cs + 10, bold)
    cell = cellm(C, "cell", bold)
    pegs = {(0, 0), (0, 4), (0, 5), (0, 6), (2, 0), (2, 1), (2, 2), (2, 5), (3, 3), (4, 0), (4, 3), (4, 5), (5, 0), (5, 2), (6, 0), (6, 2)}
    gold = mat(f"peg{bold}", GOLD, 0.18, metal=1.0, emit="#a8781c", emit_strength=0.3 if not bold else 0.8)
    for r, c in grid(N, N):
        box(x0 + c * cs + 2, y0 + r * cs + 2, cs - 4, cs - 4, 5, cell, r=5, z=6)
        if (r, c) in pegs: sphere(x0 + c * cs + cs / 2, y0 + r * cs + cs / 2, 10, gold, z=21)
    # one piece placed on the board (mid-play): the green bar on row 1
    gm = lacquer("pg", PIECE["green"], bold)
    for c in range(4): box(x0 + c * cs + 1, y0 + cs + 1, cs - 2, cs - 2, 16, gm, r=6, z=6)
    panel(C, 12, 596, 366, 228, bold, d=5)
    slots = [("plus", 70, 636), ("bar3", 195, 636), ("bar4p", 318, 636), ("sq", 70, 712), ("l3", 195, 712), ("l4", 318, 712),
             ("f", 70, 784), ("s", 195, 784)]
    tc = 21
    for name, cx, cy in slots:
        cells, col = SHAPES[name]
        m = lacquer(f"tp{name}", col, bold)
        rr = max(r for r, c in cells) + 1; cc = max(c for r, c in cells) + 1
        for r, c in cells:
            box(cx - cc * tc / 2 + c * tc + 0.8, cy - rr * tc / 2 + r * tc + 0.8, tc - 1.6, tc - 1.6, 12, m, r=3.5, z=5)
    pills(C, 318, 784, [("Covered", "4 / 33")], bold)
blockparty.looks = ("A", "B")

# ---------------------------------------------------------------- Chroma Lines (flow)
def flow(look):
    bold = look == "B"
    cam(bold)
    stage(C, bold)
    N, x0, y0, cs = 9, 13, 264, 40.4
    panel(C, x0 - 5, y0 - 5, N * cs + 10, N * cs + 10, bold)
    cell = cellm(C, "cell", bold)
    walls = {(3, 1), (7, 3), (5, 6)}
    for r, c in grid(N, N):
        if (r, c) in walls:
            box(x0 + c * cs + 1.5, y0 + r * cs + 1.5, cs - 3, cs - 3, 10, mat("fwall", "#5a5e66", 0.4, metal=0.6), r=3, z=6)
            for k in range(-2, 3):
                box(x0 + c * cs + 6, y0 + r * cs + cs / 2 + k * 6 - 0.6, cs - 12, 1.2, 10.6, mat("hatch", "#3a3e44", 0.5), r=0.2, z=6)
        else:
            box(x0 + c * cs + 1.5, y0 + r * cs + 1.5, cs - 3, cs - 3, 3, cell, r=3, z=6)
    paths = [
        ("red", [(0, 1), (0, 2), (0, 3), (0, 4), (0, 5), (1, 5), (2, 5), (2, 6), (3, 6)]),
        ("green", [(1, 6), (0, 6), (0, 7), (0, 8), (1, 8)]),
        ("pink", [(2, 0), (3, 0), (4, 0), (5, 0), (6, 0), (6, 1)]),
        ("purple", [(1, 0), (1, 1), (1, 2)]),
        ("blue", [(4, 5), (4, 6)]),
    ]
    loose = {"yellow": [(0, 0), (3, 2)], "teal": [(2, 2), (5, 3)], "orange": [(8, 8), (6, 4)], "brown": [(8, 4), (5, 7)],
             "purple": [(4, 3), (7, 5)], "white": [(8, 0), (7, 7)]}
    def P_(rc): return (x0 + rc[1] * cs + cs / 2, y0 + rc[0] * cs + cs / 2)
    for colname, cells in paths:
        col = PIECE[colname]
        m = mat(f"line{colname}{bold}", col, 0.1, coat=1.0, trans=0.3 if not bold else 0.1, emit=col, emit_strength=0.8 if not bold else 3.0)
        tube([P_(p) for p in cells], 5.5, m, z=12)
        for p in (cells[0], cells[-1]):
            sphere(*P_(p), 12, lacquer(f"dot{colname}", col, bold, 0.9, 0.2), z=20)
    for colname, ps in loose.items():
        for p in ps:
            sphere(*P_(p), 12, lacquer(f"dot{colname}", PIECE[colname], bold, 0.9, 0.2), z=20)
    pills(C, 195, 662, [("Pairs", "0 / 10")], bold)
    pills(C, 195, 815, [("Filled", "31 / 78")], bold)
flow.looks = ("A", "B")

# ---------------------------------------------------------------- Topsy-Turvy (gravity)
GRAV_SYM = {"teal": "▲", "purple": "■", "orange": "−", "yellow": "●", "pink": "✦", "blue": "+"}
def gravity(look):
    bold = look == "B"
    cam(bold)
    stage(C, bold)
    N, x0, y0, cs = 10, 16, 212, 35.8
    order = ["yellow", "teal", "purple", "pink", "blue", "orange"]
    for i, n in enumerate(order):
        x = 140 + i * 22
        torus(x, 190, 7.5, 1.5, lacquer(f"gr{n}", PIECE[n], bold, 0.9, 0.3), z=2)
    panel(C, x0 - 6, y0 - 6, N * cs + 12, N * cs + 12, bold)
    rnd = random.Random(21)
    walls = {(0, 3), (0, 4), (1, 1), (1, 5), (1, 9), (2, 0), (2, 1), (2, 2), (2, 9), (3, 4), (3, 9), (4, 8), (4, 9), (5, 5), (5, 9),
             (6, 6), (7, 3), (8, 1), (8, 7), (9, 0), (9, 9), (3, 6)}
    balls = {(1, 2): "teal", (2, 3): "purple", (4, 4): "orange", (5, 0): "yellow", (5, 7): "pink", (7, 0): "blue"}
    holes = {(6, 1): "teal", (0, 6): "purple", (8, 4): "yellow"}
    cell = cellm(C, "cell", bold)
    block = mat(f"gblock{bold}", "#9aa0aa", 0.35, metal=0.2, coat=0.6)
    for r, c in grid(N, N):
        x, y = x0 + c * cs, y0 + r * cs
        if (r, c) in walls: box(x + 1, y + 1, cs - 2, cs - 2, 16, block, r=3, z=6)
        else: box(x + 1.5, y + 1.5, cs - 3, cs - 3, 3, cell, r=2.5, z=6)
    for (r, c), n in holes.items():
        cx, cy = x0 + c * cs + cs / 2, y0 + r * cs + cs / 2
        cyl(cx, cy, 13, 1, mat("holeblk", "#020203", 0.9), z=8.6, bevel=0)
        torus(cx, cy, 13, 1.8, lacquer(f"hr{n}", PIECE[n], bold, 1.5, 0.5), z=9.5)
    for (r, c), n in balls.items():
        cx, cy = x0 + c * cs + cs / 2, y0 + r * cs + cs / 2
        mm = mat(f"marble{n}{bold}", PIECE[n], 0.05, coat=1.0, trans=0.25 if not bold else 0.1, sss=0.2,
                 emit=PIECE[n], emit_strength=0.15 if not bold else 0.6)
        sphere(cx, cy, 14, mm, z=23)
        text(cx, cy, GRAV_SYM[n], 11, T("#ffffff", 0.6, "gsym"), z=37, fnt="sym")
    pills(C, 195, 687, [("Tilts", "11"), ("Par", "13"), ("Home", "11 / 18"), ("Left", "24")], bold)
    sphere(195, 733, 13, mat(f"swipe{bold}", GOLD, 0.2, metal=0.8, emit=GOLD, emit_strength=0.3 if not bold else 1.0), z=13)
    btn(C, 334, 712, 40, 42, "☰", "outline", bold, size=14, fnt="sym")
    undo_redo(C, [114, 200], y=778, bold=bold)
gravity.looks = ("A", "B")

# ---------------------------------------------------------------- Skid (iceslide)
def iceslide(look):
    bold = look == "B"
    cam(bold)
    stage(C, bold)
    N, x0, y0, cs = 10, 12, 190, 36.6
    ice = mat(f"ice{bold}", "#a9cde6", 0.12, coat=1.0, coat_rough=0.03, trans=0.15, sss=0.25,
              emit="#7ab8e8", emit_strength=0.05 if not bold else 0.35)
    add_bump(ice, 9, 0.15, kind="voronoi", distance=0.006)
    box(x0 - 4, y0 - 4, N * cs + 8, N * cs + 8, 8, mat("rim", "#5a6a7a", 0.3, metal=1.0), r=6)
    box(x0, y0, N * cs, N * cs, 9, ice, r=3)
    blocks = {(0, 3), (0, 7), (1, 3), (1, 4), (2, 1), (2, 4), (2, 6), (3, 3), (3, 8), (4, 0), (4, 4), (4, 6), (5, 2), (5, 5),
              (6, 1), (6, 4), (6, 7), (7, 3), (7, 6), (8, 0), (8, 8), (9, 2), (9, 5), (3, 1), (1, 8)}
    granite = mat("granite", "#1f2226", 0.45, coat=0.4); add_bump(granite, 120, 0.12, distance=0.002)
    for (r, c) in blocks:
        box(x0 + c * cs + 1.5, y0 + r * cs + 1.5, cs - 3, cs - 3, 14, granite, r=2.5, z=9)
    for (r, c) in ((2, 9), (4, 9), (6, 9), (1, 9)):
        cx, cy = x0 + c * cs + cs / 2, y0 + r * cs + cs / 2
        cyl(cx, cy, 12, 2, mat("vortex", "#120208", 0.5), z=9, bevel=0)
        torus(cx, cy, 10, 2, mat(f"vrim{bold}", "#d0306a", 0.3, emit="#d0306a", emit_strength=0.5 if not bold else 1.5), z=11)
    for (r, c) in ((5, 7), (8, 4)):
        cyl(x0 + c * cs + cs / 2, y0 + r * cs + cs / 2, 9, 1, mat("pit", "#000000", 1.0), z=9.4, bevel=0)
    ex, ey = x0 + 9 * cs + cs / 2, y0 + cs / 2
    box(ex - 15, ey - 15, 30, 30, 4, mat(f"exit{bold}", GOLD, 0.25, metal=0.9, emit=GOLD, emit_strength=0.5 if not bold else 1.6), r=5, z=9)
    text(ex, ey, "⇥", 18, ink("exitT", "#2a1a04", 0.5), z=13.2, fnt="sym")
    sphere(x0 + 6 * cs + cs / 2, y0 + 7 * cs + cs / 2, 12, mat(f"skidball{bold}", "#3a8af0", 0.05, coat=1.0, metal=0.2,
           emit="#3a8af0", emit_strength=0.2 if not bold else 0.8), z=21)
    pills(C, 195, 679, [("Slides", "7"), ("Par", "19")], bold)
    sphere(195, 725, 13, mat(f"swipe{bold}", GOLD, 0.2, metal=0.8, emit=GOLD, emit_strength=0.3 if not bold else 1.0), z=13)
    btn(C, 334, 704, 40, 42, "☰", "outline", bold, size=14, fnt="sym")
    undo_redo(C, [114, 200], y=772, bold=bold)
iceslide.looks = ("A", "B")

# ---------------------------------------------------------------- Lightbender (laser)
def laser(look):
    bold = look == "B"
    cam(bold)
    stage(C, bold, key=0.75 if bold else 1.0)
    N, x0, y0, cs = 10, 12, 190, 36.6
    panel(C, x0 - 5, y0 - 5, N * cs + 10, N * cs + 10, bold)
    cell = cellm(C, "cell", bold)
    bricks = {(0, 0), (1, 8), (2, 2), (2, 3), (2, 7), (3, 3), (3, 4), (4, 8), (4, 9), (5, 5), (6, 2), (6, 3), (6, 4), (6, 5),
              (6, 7), (6, 8), (7, 5), (7, 8), (3, 7), (5, 0)}
    gems = [(3, 6), (3, 8), (4, 6), (4, 7), (7, 3), (1, 5)]
    lit = {(4, 6)}
    bombs = [(4, 2), (5, 3), (6, 6)]
    mirrors = [((4, 1), "/"), ((8, 1), "\\"), ((8, 4), "/")]
    brick = mat("brick", "#a8603a", 0.6); add_bump(brick, 30, 0.2, distance=0.003)
    mortar = mat("mortar", "#3a2418", 0.8)
    for r, c in grid(N, N):
        x, y = x0 + c * cs, y0 + r * cs
        if (r, c) in bricks:
            box(x + 1, y + 1, cs - 2, cs - 2, 6, mortar, r=1.5, z=6)
            for k in range(2):
                for j in range(2 - (k % 2) + (k % 2)):
                    w = (cs - 4) / 2 if k == 0 else (cs - 4) / 2
                    box(x + 2 + j * (w + 0.5) - (0 if k == 0 else 0), y + 2 + k * (cs - 4) / 2, w - 0.5, (cs - 4) / 2 - 1, 12, brick, r=1.5, z=6)
        else:
            box(x + 1.5, y + 1.5, cs - 3, cs - 3, 3, cell, r=2.5, z=6)
    beam = emissive(f"lbeam{bold}", "#ffcf4a", 4.0 if not bold else 9.0)
    P_ = lambda r, c: (x0 + c * cs + cs / 2, y0 + r * cs + cs / 2)
    route = [P_(-0.4, 1), P_(4, 1), P_(4, 0.2)]
    route2 = [P_(4, 1), P_(8, 1), P_(8, 4), P_(4.6, 4)]
    tube([P_(-0.4, 1), P_(8, 1)], 2.4, beam, z=14, round_caps=False)
    tube([P_(8, 1), P_(8, 4)], 2.4, beam, z=14, round_caps=False)
    tube([P_(8, 4), P_(4, 4), P_(4, 6)], 2.4, beam, z=14, round_caps=False)
    if bold:
        for p in (P_(4, 1), P_(8, 1), P_(8, 4)): point(p[0], p[1], 20, 4, "#ffcf4a", radius=4)
    sx, sy = P_(0, 1)
    box(sx - 14, sy - 14, 28, 28, 14, mat("emitter", "#2a2a30", 0.3, metal=1.0), r=4, z=6)
    cyl(sx, sy, 6, 3, emissive("emitglow", "#ffe08a", 8), z=20)
    silver = mat("mirror", "#f2f4f6", 0.02, metal=1.0)
    for (r, c), kind in mirrors:
        cx, cy = P_(r, c)
        ob = box(cx - 20, cy - 2, 40, 4, 16, silver, r=1, z=6, rot=math.radians(45 if kind == "/" else -45))
    gemm = mat(f"gem{bold}", "#e8eef8", 0.02, trans=1.0, ior=2.2)
    gemlit = mat(f"gemlit{bold}", "#d8b8ff", 0.02, trans=0.6, ior=2.2, emit=ACC, emit_strength=2.0 if not bold else 5.0)
    for (r, c) in gems:
        cx, cy = P_(r, c)
        m = gemlit if (r, c) in lit else gemm
        g1 = cone(cx, cy, 13, 0.5, 9, m, z=14, verts=8); g1.rotation_euler[2] = math.pi / 8
        g2 = cone(cx, cy, 13, 0.5, 9, m, z=14, verts=8); g2.rotation_euler[0] = math.pi; g2.location.z = 14 * P
    for (r, c) in bombs:
        cx, cy = P_(r, c)
        sphere(cx, cy, 11, mat("bomb", "#18181c", 0.25, coat=1.0), z=17)
        tube([(cx + 6, cy - 6, 26), (cx + 10, cy - 12, 30)], 1.2, mat("fuse", "#c8a060", 0.7), round_caps=False)
        sphere(cx + 10, cy - 12, 2, emissive("spark", "#ffb040", 10), z=30)
    pills(C, 195, 683, [("Mirrors", "4"), ("Par", "8"), ("Splitter", "1/1"), ("Gems", "1 / 6")], bold)
    for i, (lab, cnt) in enumerate((("/", "6"), ("◆", "0"))):
        x = 110 + i * 64
        box(x, 704, 56, 42, 6, mat("chipbox", "#1a1424", 0.35, coat=0.8), r=10)
        text(x + 18, 725, lab, 16, T(WHITE, 0.4, "chipL"), z=6.2, fnt="sym")
        text(x + 40, 725, cnt, 14, T(WHITE, 0.4, "chipL"), z=6.2, fnt="sans")
    btn(C, 240, 704, 70, 42, REDO, "outline", bold, size=18, fnt="sym")
    btn(C, 12, 764, 230, 50, "FIRE", "key", bold, size=15, fnt="sans")
    btn(C, 252, 764, 62, 50, UNDO, "outline", bold, size=18, fnt="sym")
    text(350, 782, "FIRES", 10, T(WHITE, 0.4, "fl"), z=1, fnt="sans6")
    text(350, 796, "LEFT: 2", 10, T(WHITE, 0.4, "fl"), z=1, fnt="sans6")
laser.looks = ("A", "B")

# ---------------------------------------------------------------- Pipeline (pipes)
def pipes(look):
    bold = look == "B"
    cam(bold)
    stage(C, bold)
    N, x0, y0, cs = 7, 13, 245, 52
    rnd = random.Random(9)
    D = {"N": (-1, 0), "S": (1, 0), "E": (0, 1), "W": (0, -1)}
    OPP = {"N": "S", "S": "N", "E": "W", "W": "E"}
    kinds = [("N", "S"), ("E", "W"), ("N", "E"), ("E", "S"), ("S", "W"), ("W", "N"), ("N", "E", "S"), ("E", "S", "W"), ("N", "E", "W"), ("N", "S", "W"), ("N",), ("E",)]
    T_ = {(r, c): rnd.choice(kinds) for r, c in grid(N, N)}
    # a hand-made connected run from the source at the bottom right
    T_[(6, 6)] = ("N", "W"); T_[(5, 6)] = ("S", "W", "N"); T_[(4, 6)] = ("S", "W"); T_[(4, 5)] = ("E", "S")
    T_[(5, 5)] = ("N", "E"); T_[(6, 5)] = ("E", "N"); T_[(5, 5)] = ("N", "E", "S")
    T_[(3, 6)] = ("S",)
    conn = set(); st = [(6, 6)]
    while st:
        p = st.pop()
        if p in conn: continue
        conn.add(p)
        for d in T_[p]:
            q = (p[0] + D[d][0], p[1] + D[d][1])
            if q in T_ and OPP[d] in T_[q]: st.append(q)
    tilem = mat(f"ptile{bold}", "#2a2533", 0.35, coat=0.8)
    steel = brushed("pipesteel", "#b8bec6", 0.28)
    flange = mat("flange", "#d8dce0", 0.2, metal=1.0)
    water = mat(f"pwater{bold}", "#3a8af0", 0.1, coat=1.0, trans=0.3, emit="#3aa0ff", emit_strength=0.8 if not bold else 2.4)
    panel(C, x0 - 5, y0 - 5, N * cs + 10, N * cs + 10, bold)
    for (r, c), arms in T_.items():
        x, y = x0 + c * cs, y0 + r * cs
        cx, cy = x + cs / 2, y + cs / 2
        on = (r, c) in conn
        box(x + 1.5, y + 1.5, cs - 3, cs - 3, 6, tilem if not on else mat(f"ptileOn{bold}", "#1c2a48", 0.3, coat=0.8, emit="#2a5ab8", emit_strength=0.1 if not bold else 0.3), r=6, z=6)
        m = water if on else steel
        rad = 6.5
        for a in arms:
            dy, dx = D[a]
            ex, ey = cx + dx * (cs / 2 - 2), cy + dy * (cs / 2 - 2)
            tube([(cx, cy), (ex, ey)], rad, m, z=20, round_caps=False)
        sphere(cx, cy, rad + 1.5, m, z=20)
        if len(arms) == 1: cyl(cx, cy, rad + 3, 4, flange, z=24, bevel=1)
    vx, vy = x0 + 6 * cs + cs / 2, y0 + 6 * cs + cs / 2
    torus(vx, vy, 11, 3, mat(f"valve{bold}", "#d83a3a", 0.3, emit="#d83a3a", emit_strength=0.2 if not bold else 0.8), z=30)
    for a in range(4):
        tube([(vx, vy, 30), (vx + 11 * math.cos(a * math.pi / 2), vy + 11 * math.sin(a * math.pi / 2), 30)], 1.6, mat("valve0", "#d83a3a", 0.3), round_caps=False)
    pills(C, 195, 815, [("Taps", "10"), ("Par", "84")], bold)
pipes.looks = ("A", "B")

# ---------------------------------------------------------------- Heave (push)
def push(look):
    bold = look == "B"
    cam(bold)
    stage(C, bold, key=0.8 if bold else 1.0)
    N, x0, y0, cs = 10, 11, 186, 36.8
    walls = {(r, c) for r, c in grid(N, N) if r in (0, 9) or c in (0, 9)} | {(2, 3), (3, 2), (4, 3), (4, 4), (6, 5), (7, 2)}
    targets = [(1, 7), (8, 3), (8, 4), (8, 5), (8, 6)]
    crates = [(2, 5), (3, 3), (5, 7), (8, 4), (8, 5)]
    brick = mat(f"hbrick{bold}", "#8a4a32", 0.7); add_bump(brick, 26, 0.25, distance=0.003)
    floor_ = mat(f"sand{bold}", "#c8b898", 0.75, coat=0.1); add_bump(floor_, 90, 0.12, distance=0.002)
    for r, c in grid(N, N):
        x, y = x0 + c * cs, y0 + r * cs
        if (r, c) in walls:
            box(x, y, cs, cs, 22, mat("hmortar", "#3a2418", 0.9), r=0.5, z=0)
            for k in range(3):
                off = (cs / 4) if k % 2 else 0
                for j in range(-1, 3):
                    bx_ = x + off + j * cs / 2 + 0.6
                    a, b = max(bx_, x + 0.6), min(bx_ + cs / 2 - 1.2, x + cs - 0.6)
                    if b - a > 2: box(a, y + 0.6 + k * cs / 3, b - a, cs / 3 - 1.2, 23, brick, r=0.8, z=0)
        else:
            box(x + 0.5, y + 0.5, cs - 1, cs - 1, 3, floor_, r=1, z=0)
    stripe_y = mat("hazy", "#f2c42a", 0.5, emit="#f2c42a", emit_strength=0.0 if not bold else 0.3)
    stripe_k = mat("hazk", "#151515", 0.6)
    for (r, c) in targets:
        x, y = x0 + c * cs + 3, y0 + r * cs + 3
        box(x, y, cs - 6, cs - 6, 1, stripe_k, r=1, z=3)
        outline(x + 1, y + 1, cs - 8, cs - 8, 2, stripe_y, z=4.6, rad=1.6)
    crate = wood("crate", "#b07a42", "#6a4220", scale=5)
    for (r, c) in crates:
        x, y = x0 + c * cs + 3, y0 + r * cs + 3
        box(x, y, cs - 6, cs - 6, 26, crate, r=2, z=3)
        tube([(x + 4, y + 4), (x + cs - 10, y + cs - 10)], 1.6, wood("crate2", "#8a5a30", "#4a2a12", scale=5), z=29.5, round_caps=False)
        if (r, c) in targets:
            text(x + cs / 2 - 3, y + cs / 2 - 3, "✓", 14, T("#4ade80", 0.8 if not bold else 1.6, "tick"), z=31, fnt="sym")
    px, py = x0 + 5 * cs + cs / 2, y0 + 2 * cs + cs / 2
    cyl(px, py, 13, 14, mat(f"player{bold}", GOLD, 0.2, metal=0.9, emit=GOLD, emit_strength=0.3 if not bold else 1.0), z=3, bevel=4)
    for dx in (-4, 4): sphere(px + dx, py - 2, 2.2, ink("eye", "#1a1206", 0.4), z=17)
    if bold:
        for (x, y) in ((40, 220), (350, 220)): point(x, y, 40, 30, "#ffb060", radius=8)
    pills(C, 195, 595, [("Pushes", "12"), ("Moves", "39"), ("Gold crate", "not yet")], bold)
    sphere(195, 641, 13, mat(f"swipe{bold}", GOLD, 0.2, metal=0.8, emit=GOLD, emit_strength=0.3 if not bold else 1.0), z=13)
    btn(C, 334, 620, 40, 42, "☰", "outline", bold, size=14, fnt="sym")
    undo_redo(C, [114, 200], y=688, bold=bold)
push.looks = ("A", "B")

# ---------------------------------------------------------------- Gridlock (unblock)
def unblock(look):
    bold = look == "B"
    cam(bold)
    stage(C, bold)
    N, x0, y0, cs = 6, 16, 226, 58
    board = mat(f"asphalt{bold}", "#2a2a30", 0.7); add_bump(board, 160, 0.2, distance=0.002)
    panel(C, x0 - 8, y0 - 8, N * cs + 16, N * cs + 16, bold)
    box(x0, y0, N * cs, N * cs, 8, board, r=4)
    paint = mat("roadpaint", "#5a5a64", 0.6)
    for k in range(1, N):
        for j in range(N * 3):
            box(x0 + k * cs - 0.5, y0 + j * cs / 3 + 4, 1, cs / 3 - 8, 8.3, paint, r=0.2)
    # exit on the right of row 2
    ex = mat(f"exit{bold}", GOLD, 0.3, metal=0.6, emit=GOLD, emit_strength=0.5 if not bold else 1.6)
    box(x0 + N * cs + 2, y0 + 2 * cs + 8, 8, cs - 16, 10, ex, r=2)
    text(x0 + N * cs + 6, y0 + 2.5 * cs, "❯", 14, ink("exT", "#2a1a04", 0.5), z=10.2, fnt="sym")
    cars = [(0, 0, 2, "h", "#3a9a5a"), (0, 2, 2, "h", "#b8bcc4"), (0, 4, 2, "h", "#3a6ad8"), (1, 1, 2, "v", "#2fb3a6"),
            (1, 4, 2, "h", "#2fb3a6"), (2, 2, 2, "h", GOLD), (2, 4, 2, "v", "#d8485a"), (3, 1, 2, "v", "#4aa860"),
            (3, 2, 2, "h", "#c8606a"), (4, 3, 2, "v", "#9a8ad8"), (4, 4, 2, "h", "#d8a070"), (5, 0, 3, "h", "#4a7ad8")]
    glass_ = mat("carglass", "#0a1018", 0.05, coat=1.0, metal=0.3)
    chrome = mat("chrome", "#e8eaee", 0.08, metal=1.0)
    for (r, c, L, o, col) in cars:
        w, h = (L * cs, cs) if o == "h" else (cs, L * cs)
        x, y = x0 + c * cs + 4, y0 + r * cs + 4
        w -= 8; h -= 8
        body = mat(f"paint{col}{bold}", col, 0.25, coat=1.0, coat_rough=0.02, metal=0.4,
                   emit=col, emit_strength=0.0 if col != GOLD else (0.3 if not bold else 1.0))
        box(x, y, w, h, 18, body, r=9, z=8)
        # cabin, windscreens and lights
        if o == "h":
            box(x + w * 0.28, y + 5, w * 0.42, h - 10, 22, body, r=7, z=8)
            box(x + w * 0.62, y + 7, w * 0.1, h - 14, 22.6, glass_, r=3, z=8)
            box(x + w * 0.24, y + 7, w * 0.08, h - 14, 22.6, glass_, r=3, z=8)
            for yy in (y + 8, y + h - 12):
                box(x + w - 4, yy, 3, 6, 14, emissive(f"hl{bold}", "#fff4d0", 1.5 if not bold else 6), r=1, z=10)
                box(x + 1, yy, 3, 6, 14, emissive(f"tl{bold}", "#ff3030", 1.0 if not bold else 4), r=1, z=10)
        else:
            box(x + 5, y + h * 0.28, w - 10, h * 0.42, 22, body, r=7, z=8)
            box(x + 7, y + h * 0.24, w - 14, h * 0.08, 22.6, glass_, r=3, z=8)
            box(x + 7, y + h * 0.62, w - 14, h * 0.1, 22.6, glass_, r=3, z=8)
            for xx in (x + 8, x + w - 12):
                box(xx, y + 1, 6, 3, 14, emissive(f"hl{bold}", "#fff4d0", 1.5 if not bold else 6), r=1, z=10)
                box(xx, y + h - 4, 6, 3, 14, emissive(f"tl{bold}", "#ff3030", 1.0 if not bold else 4), r=1, z=10)
    pills(C, 195, 625, [("Moves", "2"), ("Par", "20")], bold)
    undo_redo(C, [12, 200], y=772, w=178, bold=bold)
unblock.looks = ("A", "B")

GAMES = dict(blockparty=blockparty, flow=flow, gravity=gravity, iceslide=iceslide, laser=laser, pipes=pipes, push=push, unblock=unblock)
if __name__ == "__main__":
    run(C, GAMES)
