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
import bpy
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
    m = mat("granite", "#2a2e35", 0.26, coat=1.0, coat_rough=0.07)
    speckle(m, "#23272d", "#6b727c", scale=70, cut=0.64)
    add_bump(m, 140, 0.05, distance=0.002)
    return m


def rink():
    """The 12 × 12 ice sheet: cool icy blue with depth (the richness pass, 15 Nov 2026).

    A cloudy blue bed (pale to mid, deeper where the ice is thick), faint crystal facets and frost in it, fine skate
    scratches and a scatter of air bubbles caught under the surface, all under a clear coat that gives the sheet a soft,
    even sheen (seen straight down, so no glare patch)."""
    V = 1200
    begin(V, RINK_PX, pad=0, light=LIGHT)
    bed = mat("rinkbed", "#7fb4dd", 0.3, coat=0.45, coat_rough=0.06, sss=0.1)
    n, l = jzlib._nodes(bed)
    b = jzlib._bsdf(bed)
    tc = n.new("ShaderNodeTexCoord")
    # Depth: large soft clouds between a mid and a pale icy blue.
    cloud = n.new("ShaderNodeTexNoise")
    cloud.inputs["Scale"].default_value = 0.9
    cloud.inputs["Detail"].default_value = 6
    cloud.inputs["Roughness"].default_value = 0.55
    l.new(tc.outputs["Object"], cloud.inputs[0])
    cr = n.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].color = jzlib.hexc("#1a4f8e")
    cr.color_ramp.elements[0].position = 0.28
    cr.color_ramp.elements[1].color = jzlib.hexc("#6aa5d8")
    cr.color_ramp.elements[1].position = 0.72
    l.new(cloud.outputs["Fac"], cr.inputs[0])
    # Crystal facets: a gentle per-facet shift in the blue.
    fac = n.new("ShaderNodeTexVoronoi")
    fac.inputs["Scale"].default_value = 2.2
    l.new(tc.outputs["Object"], fac.inputs[0])
    fbw = n.new("ShaderNodeRGBToBW")
    l.new(fac.outputs["Color"], fbw.inputs[0])
    mix = n.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "OVERLAY"
    mix.inputs["Factor"].default_value = 0.22
    l.new(cr.outputs[0], mix.inputs[6])
    l.new(fbw.outputs[0], mix.inputs[7])
    # Frost: fine milky noise lifting the colour here and there.
    fr = n.new("ShaderNodeTexNoise")
    fr.inputs["Scale"].default_value = 22
    fr.inputs["Detail"].default_value = 10
    l.new(tc.outputs["Object"], fr.inputs[0])
    frr = n.new("ShaderNodeValToRGB")
    frr.color_ramp.elements[0].color = (0, 0, 0, 1)
    frr.color_ramp.elements[0].position = 0.55
    frr.color_ramp.elements[1].color = (1, 1, 1, 1)
    frr.color_ramp.elements[1].position = 0.8
    l.new(fr.outputs["Fac"], frr.inputs[0])
    mix2 = n.new("ShaderNodeMix")
    mix2.data_type = "RGBA"
    l.new(frr.outputs[0], mix2.inputs["Factor"])
    l.new(mix.outputs[2], mix2.inputs[6])
    mix2.inputs[7].default_value = jzlib.hexc("#dcefff")
    mf = n.new("ShaderNodeMath")
    mf.operation = "MULTIPLY"
    mf.inputs[1].default_value = 0.16
    l.new(frr.outputs[0], mf.inputs[0])
    l.new(mf.outputs[0], mix2.inputs["Factor"])
    l.new(mix2.outputs[2], b.inputs["Base Color"])
    edges = n.new("ShaderNodeTexVoronoi")
    edges.feature = "DISTANCE_TO_EDGE"
    edges.inputs["Scale"].default_value = 2.2
    l.new(tc.outputs["Object"], edges.inputs[0])
    er = n.new("ShaderNodeValToRGB")
    er.color_ramp.elements[1].position = 0.03
    l.new(edges.outputs["Distance"], er.inputs[0])
    bp = n.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.35
    bp.inputs["Distance"].default_value = 0.004
    l.new(er.outputs[0], bp.inputs["Height"])
    l.new(bp.outputs[0], b.inputs["Normal"])
    plane(0, 0, V, V, bed, z=0)
    rnd = random.Random(7)
    # Skate scratches: long shallow arcs and short straight nicks, pale, in the ice.
    scratch = mat("scratch", "#e8f5ff", 0.35)
    for k in range(70):
        cx, cy = rnd.uniform(-200, V + 200), rnd.uniform(-200, V + 200)
        R = rnd.uniform(300, 1400)
        a0 = rnd.uniform(0, math.tau)
        span = rnd.uniform(0.08, 0.3)
        pts = []
        for i in range(9):
            a = a0 + span * i / 8
            x, y = cx + R * math.cos(a), cy + R * math.sin(a)
            pts.append((x, y, 0.4))
        if all(not (0 <= p[0] <= V and 0 <= p[1] <= V) for p in pts):
            continue
        tube(pts, rnd.uniform(0.5, 0.9), scratch, round_caps=False)
    for k in range(60):
        x, y = rnd.uniform(0, V), rnd.uniform(0, V)
        a = rnd.uniform(0, math.pi)
        L = rnd.uniform(14, 60)
        tube([(x, y, 0.4), (x + L * math.cos(a), y + L * math.sin(a), 0.4)], 0.45, scratch, round_caps=False)
    # Air bubbles trapped under the surface: small pale spheres, some in little clusters.
    bub = mat("bubble", "#eaf6ff", 0.08, coat=1.0, coat_rough=0.02, sss=0.3)
    for k in range(46):
        x, y = rnd.uniform(10, V - 10), rnd.uniform(10, V - 10)
        for j in range(rnd.choice((1, 1, 2, 3))):
            r = rnd.uniform(1.6, 4.2)
            sphere(x + rnd.uniform(-9, 9) * j, y + rnd.uniform(-9, 9) * j, r, bub, z=-r * 0.55)


def block():
    """A polished granite block, square with softened edges, standing proud of the ice."""
    cell()
    box(6, 6, 88, 88, 34, granite_m(), r=13)


def ball():
    """The ball: deep-blue enamel over steel, a clear coat with one crisp highlight, never glowing."""
    cell()
    # One crisp highlight: only the key light shows in the ball's reflections (the fill, top and rim light it but
    # are not mirrored as extra squares on its curve).
    lights = [o for o in bpy.context.scene.objects if o.type == "LIGHT"]
    for o in lights[1:]:
        o.visible_glossy = False
    sphere(50, 50, 44, mat("ballpaint", "#1a64dc", 0.18, metal=0.75, coat=1.0, coat_rough=0.01))


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
    # Dark, glassy: the cold water shows through the thin sheet, so it stands apart from the pale-to-mid rink.
    box(4, 4, 92, 92, 3, mat("thinice", "#103050", 0.2, coat=1.0, coat_rough=0.04), r=6)
    crack = mat("crack", "#f4faff", 0.25, coat=0.6, emit="#e8f6ff", emit_strength=0.15)
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
    box(5, 5, 90, 90, 8, mat("exitgold", "#ffb000", 0.2, metal=1.0, coat=0.6, coat_rough=0.06), r=10)
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

def soften_shadow_edges(name):
    """The soft shadow is caught on the whole cell; fade the faint part of it towards the cell's edge so no square
    outline of shadow shows round a piece on the ice (the piece itself is untouched)."""
    from PIL import Image
    path = os.path.join(PUBLIC, "iceslide", f"{name}.webp")
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    px = im.load()
    band = w * 0.12
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0 or a > 150 or max(r, g, b) > 40:
                continue
            d = min(x, y, w - 1 - x, h - 1 - y)
            if d < band:
                px[x, y] = (r, g, b, int(a * (d / band) ** 1.5))
    im.save(path, "WEBP", quality=88, method=6)


def soften_ball_shadow():
    """The ball's shadow falls to the bottom right; fade it out before the cell's edge (round, never a square)."""
    from PIL import Image
    path = os.path.join(PUBLIC, "iceslide", "ball.webp")
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    px = im.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            d = math.hypot(x + 0.5 - w / 2, y + 0.5 - h / 2) / w
            if a == 0 or d < 0.44 or max(r, g, b) > 40:
                continue
            k = max(0.0, min(1.0, (0.52 - d) / 0.08))
            px[x, y] = (r, g, b, int(a * 0.8 * k))
    im.save(path, "WEBP", quality=88, method=6)


SHADOWED = ("block", "ball", "exit", "arrow-U", "arrow-D", "arrow-L", "arrow-R")

if __name__ == "__main__":
    main("iceslide", SPRITES)
    for n in [a for a in sys.argv[1:] if not a.startswith("-")] or list(SPRITES):
        if n in SHADOWED:
            soften_shadow_edges(n)
        if n == "ball":
            soften_ball_shadow()
