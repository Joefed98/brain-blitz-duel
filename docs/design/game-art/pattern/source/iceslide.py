"""Skid (iceslide) sprites, the Pattern overhaul (15 Nov 2026, look A: frosted ice, dark stone blocks, a glossy ball).

One cell is 100 points. Every cell sprite is exactly its cell (100 × 100 points, transparent round it), the piece drawn
inside with its own soft shadow, so the board places each image on the cell box the slide maths uses and nothing
leaves it. Arrow tiles are built per direction (not one image turned), so the light stays at the top left. The rink is
the whole 12 × 12 ice sheet, drawn under the grid.

  JZ_THREADS=1 /opt/blender/venv/bin/python docs/design/game-art/pattern/source/iceslide.py [sprite …]
"""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprite import *  # noqa: F401,F403
import jzlib

PX_PER_CELL = int(os.environ.get("ICE_PX", "96"))  # a cell is ~30 css px on a phone; ~3× for DPR 2–3
LIGHT = float(os.environ.get("ICE_LIGHT", "0.38"))

PORTALS = {"a": "#c0208f", "b": "#14a89a"}  # magenta and teal: never near the gold exit or the blue ball


VIEW = os.environ.get("ICE_VIEW", "Standard")


def grade_view(s):
    """Standard view: AgX greys the pale ice and the gold; the pieces keep their own colours under the even light."""
    s.view_settings.view_transform = VIEW
    if VIEW == "Standard":
        s.view_settings.look = "None"


def cell(light=LIGHT, shadow=True):
    grade_view(begin(100, PX_PER_CELL, pad=0, light=light))
    if shadow:
        shadow_catcher(100, 0, 1.0)


def frost(name="frost", tint="#b4d4ec"):
    m = mat(name, tint, 0.32, coat=0.35, coat_rough=0.25, sss=0.15)
    add_bump(m, 9, 0.12, kind="voronoi", distance=0.004)
    return m


def granite_m():
    m = mat("granite", "#121417", 0.72)
    add_bump(m, 90, 0.35, distance=0.003)
    return m


def rink():
    """The 12 × 12 ice sheet: frosted, faintly crazed, an even pale blue (no glare)."""
    V = 1200
    grade_view(begin(V, 720, pad=0, light=LIGHT))
    m = mat("rinkice", "#86b6dc", 0.4, coat=0.2, coat_rough=0.4)
    add_bump(m, 5, 0.45, kind="voronoi", distance=0.004)
    plane(0, 0, V, V, m, z=0)


def block():
    """A dark granite block, square with softened edges, standing proud of the ice."""
    cell()
    box(5, 5, 90, 90, 34, granite_m(), r=8)


def ball():
    """The ball: glossy deep-blue enamel over steel, a crisp highlight, never glowing."""
    cell()
    sphere(50, 50, 45, mat("ballpaint", "#0f5fd0", 0.32, metal=0.15, coat=0.6, coat_rough=0.32))


def hole():
    """A round pit through the ice: crushed-ice rim, black inside."""
    cell(shadow=False)
    rim = frost("holerim", "#d4e8f6")
    cyl(50, 50, 40, 4, rim, bevel=1.5)
    cyl(50, 50, 31, 4.6, mat("pit", "#000000", 1.0), bevel=0)
    for k in range(10):
        a = k * math.tau / 10 + 0.3
        cbox(50 + 37 * math.cos(a), 50 + 37 * math.sin(a), 8, 6, 4 + (k % 3), rim, r=2, z=1, rot=a)


def portal(which):
    """A portal: a bright enamel ring round a dark well, its own colour (the pair matches)."""
    colour = PORTALS[which]
    cell(shadow=False)
    ringm = mat(f"portal-{which}", colour, 0.25, metal=0.4, coat=0.8, coat_rough=0.15, emit=colour, emit_strength=0.12)
    cyl(50, 50, 32, 3, mat("well", "#07050c", 0.9), bevel=0)
    torus(50, 50, 33, 9, ringm, z=5)
    torus(50, 50, 18, 3.2, ringm, z=4)


ARROW_PTS = [(28, 22), (48, 22), (76, 50), (48, 78), (28, 78), (56, 50)]


def arrow(direction):
    """A one-way tile: a bold navy chevron raised on a frosted plate, pointing the way the ball is sent."""
    cell()
    box(6, 6, 88, 88, 5, frost("plate", "#cfe4f3"), r=8)
    turn = {"R": 0, "D": 90, "L": 180, "U": 270}[direction]
    t = math.radians(turn)
    pts = []
    for x, y in ARROW_PTS:
        dx, dy = x - 50, y - 50
        pts.append((50 + dx * math.cos(t) - dy * math.sin(t), 50 + dx * math.sin(t) + dy * math.cos(t)))
    slab(pts, 5, mat("chevron", "#06112a", 0.55), z=5, bevel=1.2)


def thin():
    """Thin ice: a clouded grey slab with dark cracks running from an impact point."""
    cell(shadow=False)
    box(4, 4, 92, 92, 3, mat("thinice", "#6f8799", 0.55), r=6)
    crack = mat("crack", "#eef6fb", 0.5)
    rnd = random.Random(11)
    cx, cy = 46, 54
    for k in range(7):
        a = k * math.tau / 7 + rnd.uniform(-0.3, 0.3)
        pts = [(cx, cy, 3.2)]
        x, y = cx, cy
        for s in range(3):
            a += rnd.uniform(-0.45, 0.45)
            step = rnd.uniform(11, 16)
            x, y = x + step * math.cos(a), y + step * math.sin(a)
            x, y = min(94, max(6, x)), min(94, max(6, y))
            pts.append((x, y, 3.2))
        tube(pts, 2.4, crack)
    cyl(cx, cy, 6, 1.5, mat("impact", "#ffffff", 0.4), z=3)


def broken():
    """Thin ice that gave way: a jagged black hole, broken shards round its lip."""
    cell(shadow=False)
    pit = [(18, 30), (30, 16), (44, 22), (56, 12), (74, 20), (86, 36), (82, 50), (90, 64), (78, 82), (62, 84), (50, 90),
           (34, 84), (18, 76), (14, 60), (19, 48)]
    slab(pit, 2, mat("brokenpit", "#000000", 1.0), z=0, bevel=0)
    shard = frost("shard", "#d4e8f6")
    for (x, y, r) in ((14, 18, 0.4), (88, 18, 1.2), (90, 86, 2.1), (12, 88, 2.9), (50, 6, 0.1), (94, 50, 1.6)):
        cbox(x, y, 12, 7, 3, shard, r=1.5, z=0, rot=r)


def exit_():
    """The exit: a brushed gold plate with a dark arrow into a doorway (bold, read at a glance)."""
    cell()
    box(5, 5, 90, 90, 8, mat("exitgold", "#c98d1c", 0.36, metal=1.0), r=10)
    ink_m = mat("exitink", "#2a1a05", 0.6)
    # The doorway: an open bracket on the left.
    slab([(22, 22), (44, 22), (44, 30), (30, 30), (30, 70), (44, 70), (44, 78), (22, 78)], 2.5, ink_m, z=8, bevel=0.6)
    # The arrow out of it, to the right (today's exit mark).
    slab([(36, 46), (62, 46), (62, 36), (80, 50), (62, 64), (62, 54), (36, 54)], 2.5, ink_m, z=8, bevel=0.6)


SPRITES = {
    "rink": rink,
    "block": block,
    "ball": ball,
    "hole": hole,
    "portal-a": lambda: portal("a"),
    "portal-b": lambda: portal("b"),
    "thin": thin,
    "broken": broken,
    "exit": exit_,
}
for d in ("U", "D", "L", "R"):
    SPRITES[f"arrow-{d}"] = (lambda d=d: arrow(d))

if __name__ == "__main__":
    main("iceslide", SPRITES)
