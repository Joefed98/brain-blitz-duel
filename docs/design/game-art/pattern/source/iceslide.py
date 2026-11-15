"""Skid (iceslide) sprites, the Pattern overhaul (15 Nov 2026, look A: frosted ice, polished granite, a glossy ball).

One cell is 100 points. Every cell sprite is exactly its cell (100 × 100 points, transparent round it), the piece drawn
inside with its own soft shadow, so the board places each image on the cell box the slide maths uses and nothing
leaves it. Arrow tiles are built per direction (not one image turned), so the light stays at the top left. The rink is
the whole 12 × 12 ice sheet, drawn under the grid.

The richness pass (Joe, 15 Nov 2026: "premium materials need light on them"): sprite.py's rich studio (HDRI in the
reflections, a small key for a crisp highlight, fill and rim, AgX Punchy). The ice is a clear-coated sheet over faceted
frost with scattered crystal flakes that catch the key (sparkle without a wash); the blocks are polished speckled
granite; the ball is blue enamel over steel with one crisp highlight; the hazards are enamel, lacquer and polished gold.

  JZ_THREADS=1 /opt/blender/venv/bin/python docs/design/game-art/pattern/source/iceslide.py [sprite …]
"""
import sys, os, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprite import *  # noqa: F401,F403
import jzlib

PX_PER_CELL = int(os.environ.get("ICE_PX", "112"))  # a cell is ~30 css px on a phone; ~3.5× for DPR 2–3
RINK_PX = int(os.environ.get("ICE_RINK_PX", "1080"))
LIGHT = float(os.environ.get("ICE_LIGHT", "1.0"))

PORTALS = {"a": "#c0208f", "b": "#14a89a"}  # magenta and teal: never near the gold exit or the blue ball


def cell(light=LIGHT, shadow=True):
    begin(100, PX_PER_CELL, pad=0, light=light)
    if shadow:
        shadow_catcher(100, 0, 1.0)


def speckle(m, dark, light, scale=60.0, cut=0.62):
    """Granite-like speckle in the base colour: hard-edged noise between two colours."""
    n, l = jzlib._nodes(m)
    b = jzlib._bsdf(m)
    tc = n.new("ShaderNodeTexCoord")
    t = n.new("ShaderNodeTexNoise")
    t.inputs["Scale"].default_value = scale
    t.inputs["Detail"].default_value = 8
    l.new(tc.outputs["Object"], t.inputs[0])
    cr = n.new("ShaderNodeValToRGB")
    cr.color_ramp.interpolation = "CONSTANT"
    cr.color_ramp.elements[0].color = jzlib.hexc(dark)
    cr.color_ramp.elements[1].color = jzlib.hexc(light)
    cr.color_ramp.elements[1].position = cut
    l.new(t.outputs["Fac"], cr.inputs[0])
    l.new(cr.outputs[0], b.inputs["Base Color"])
    return m


def cells(m, dark, light, scale=1.0, groove=0.5):
    """Crystalline ice: flat facets each a slightly different blue, with fine grooves where the crystals meet."""
    n, l = jzlib._nodes(m)
    b = jzlib._bsdf(m)
    tc = n.new("ShaderNodeTexCoord")
    facets = n.new("ShaderNodeTexVoronoi")
    facets.inputs["Scale"].default_value = scale
    l.new(tc.outputs["Object"], facets.inputs[0])
    bw = n.new("ShaderNodeRGBToBW")
    l.new(facets.outputs["Color"], bw.inputs[0])
    cr = n.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].color = jzlib.hexc(dark)
    cr.color_ramp.elements[1].color = jzlib.hexc(light)
    l.new(bw.outputs[0], cr.inputs[0])
    l.new(cr.outputs[0], b.inputs["Base Color"])
    edges = n.new("ShaderNodeTexVoronoi")
    edges.feature = "DISTANCE_TO_EDGE"
    edges.inputs["Scale"].default_value = scale
    l.new(tc.outputs["Object"], edges.inputs[0])
    er = n.new("ShaderNodeValToRGB")
    er.color_ramp.elements[0].color = (0, 0, 0, 1)
    er.color_ramp.elements[1].color = (1, 1, 1, 1)
    er.color_ramp.elements[1].position = 0.04
    l.new(edges.outputs["Distance"], er.inputs[0])
    bp = n.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = groove
    bp.inputs["Distance"].default_value = 0.004
    l.new(er.outputs[0], bp.inputs["Height"])
    l.new(bp.outputs[0], b.inputs["Normal"])
    return m


def frost(name="frost", tint="#b9d8ee"):
    """Frosted ice: a satin base with crystalline facets under a thin clear coat."""
    m = mat(name, tint, 0.28, coat=0.7, coat_rough=0.08, sss=0.2)
    add_bump(m, 11, 0.35, kind="voronoi", distance=0.004)
    return m


def granite_m():
    m = mat("granite", "#1a1d22", 0.3, coat=0.9, coat_rough=0.12)
    speckle(m, "#15171b", "#4a4f57", scale=70, cut=0.66)
    add_bump(m, 140, 0.06, distance=0.002)
    return m


def rink():
    """The 12 × 12 ice sheet: pale frosted ice with faceted depth and crystal flakes that sparkle (no wash)."""
    V = 1200
    begin(V, RINK_PX, pad=0, light=LIGHT)
    m = mat("rinkice", "#8cc0e8", 0.25, coat=0.6, coat_rough=0.08, sss=0.15)
    cells(m, "#86bae2", "#c6e3f6", scale=1.6, groove=0.6)
    plane(0, 0, V, V, m, z=0)
    # Crystal flakes: small flat facets at random tilts, a few catching the key as sparkles.
    flake = mat("flake", "#eef8ff", 0.04, coat=1.0, coat_rough=0.0, metal=0.2)
    rnd = random.Random(7)
    for _ in range(260):
        x, y = rnd.uniform(4, V - 4), rnd.uniform(4, V - 4)
        s = round(rnd.uniform(3.0, 8.0))
        ob = cbox(x, y, s, s * rnd.uniform(0.4, 1.0), 0.6, flake, r=0.2, z=0.2, rot=rnd.uniform(0, math.pi))
        ob.rotation_euler[0] = rnd.uniform(-0.6, 0.6)
        ob.rotation_euler[1] = rnd.uniform(-0.6, 0.6)


def block():
    """A polished granite block, square with softened edges, standing proud of the ice."""
    cell()
    box(5, 5, 90, 90, 34, granite_m(), r=8)


def ball():
    """The ball: deep-blue enamel over steel, a clear coat with one crisp highlight, never glowing."""
    cell()
    sphere(50, 50, 45, mat("ballpaint", "#1460d8", 0.22, metal=0.55, coat=1.0, coat_rough=0.03))


def hole():
    """A round pit through the ice: a glassy crushed-ice rim, black inside."""
    cell(shadow=False)
    rim = frost("holerim", "#d6eaf8")
    cyl(50, 50, 40, 4, rim, bevel=1.5)
    cyl(50, 50, 31, 4.6, mat("pit", "#000000", 1.0), bevel=0)
    for k in range(10):
        a = k * math.tau / 10 + 0.3
        cbox(50 + 37 * math.cos(a), 50 + 37 * math.sin(a), 8, 6, 4 + (k % 3), rim, r=2, z=1, rot=a)


def portal(which):
    """A portal: a glossy enamel ring round a dark well, its own colour (the pair matches)."""
    colour = PORTALS[which]
    cell(shadow=False)
    ringm = mat(f"portal-{which}", colour, 0.2, metal=0.3, coat=1.0, coat_rough=0.04, emit=colour, emit_strength=0.1)
    cyl(50, 50, 32, 3, mat("well", "#07050c", 0.5, coat=0.6), bevel=0)
    torus(50, 50, 33, 9, ringm, z=5)
    torus(50, 50, 18, 3.2, ringm, z=4)


ARROW_PTS = [(28, 22), (48, 22), (76, 50), (48, 78), (28, 78), (56, 50)]


def arrow(direction):
    """A one-way tile: a bold navy lacquer chevron raised on a frosted plate, pointing the way the ball is sent."""
    cell()
    box(6, 6, 88, 88, 5, frost("plate", "#d4e8f6"), r=8)
    turn = {"R": 0, "D": 90, "L": 180, "U": 270}[direction]
    t = math.radians(turn)
    pts = []
    for x, y in ARROW_PTS:
        dx, dy = x - 50, y - 50
        pts.append((50 + dx * math.cos(t) - dy * math.sin(t), 50 + dx * math.sin(t) + dy * math.cos(t)))
    slab(pts, 6, mat("chevron", "#0b1d44", 0.25, coat=1.0, coat_rough=0.05), z=5, bevel=1.4)


def thin():
    """Thin ice: a clouded grey-blue slab with white cracks running from an impact point."""
    cell(shadow=False)
    box(4, 4, 92, 92, 3, mat("thinice", "#6a8499", 0.3, coat=0.6, coat_rough=0.1), r=6)
    crack = mat("crack", "#f4faff", 0.2, coat=0.6)
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
    cyl(cx, cy, 6, 1.5, mat("impact", "#ffffff", 0.3), z=3)


def broken():
    """Thin ice that gave way: a jagged black hole, glassy shards round its lip."""
    cell(shadow=False)
    pit = [(18, 30), (30, 16), (44, 22), (56, 12), (74, 20), (86, 36), (82, 50), (90, 64), (78, 82), (62, 84), (50, 90),
           (34, 84), (18, 76), (14, 60), (19, 48)]
    slab(pit, 2, mat("brokenpit", "#000000", 1.0), z=0, bevel=0)
    shard = frost("shard", "#d6eaf8")
    for (x, y, r) in ((14, 18, 0.4), (88, 18, 1.2), (90, 86, 2.1), (12, 88, 2.9), (50, 6, 0.1), (94, 50, 1.6)):
        cbox(x, y, 12, 7, 3, shard, r=1.5, z=0, rot=r)


def exit_():
    """The exit: a polished gold plate with a dark enamel arrow out of a doorway (bold, read at a glance)."""
    cell()
    box(5, 5, 90, 90, 8, mat("exitgold", "#ffb000", 0.3, metal=1.0), r=10)
    ink_m = mat("exitink", "#241604", 0.35, coat=0.8, coat_rough=0.1)
    slab([(22, 22), (44, 22), (44, 30), (30, 30), (30, 70), (44, 70), (44, 78), (22, 78)], 2.5, ink_m, z=8, bevel=0.6)
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
