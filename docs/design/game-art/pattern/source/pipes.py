"""Pipeline (pipes) sprites, the Pattern overhaul stage 1 (look A: chrome pipes on dark tiles, water in the network).

Richness pass (Joe, 15 Nov 2026): sprite.py's rich studio light (HDRI reflections, a crisp key from the top left, fill
and rim, AgX Punchy) on concept A's materials. So that the key light stays top left on every tile, each shape is
rendered in each of its distinct turns (`<shape>-<turns>-dry|wet`: end, corner and tee 4, straight 2, cross 1); the game
picks the file and only animates the turn with a transform. The tile, the source valve and the leak spill are separate.

Continuous pass (15 Nov 2026, the captain's review: the first set read as knobbly chains and the water as dashes):
every pipe is one smooth polished-chrome tube (a corner one bend, a run straight across, no collars, beads or rings),
the same radius on the same centre line in every shape and turn. Each sprite runs BLEED points past every tile edge; the
game crops it at half the board gap, so a tube meets its neighbour's tube in the middle of the gap with no seam. Wet:
the same tube in clear glass, full of glossy blue water along its whole length.

Canonical shapes (tile 100 points; arms from the centre to the tile edge, x right, y down):
  end      N            straight  N S          corner  N E
  tee      N E S        cross     N E S W

Run:  JZ_THREADS=1 /opt/blender/venv/bin/python docs/design/game-art/pattern/source/pipes.py [sprite …]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprite import *  # noqa: F401,F403
import bpy, jzlib, math

SIZE = 100
PX = 144
R = 15.0          # the tube's radius (three tenths of the tile across)
BLEED = 12.0      # the sprite runs this far past each tile edge (pipesArt.tsx PIPE_BLEED); the game crops it
BEND = 24.0       # a corner's bend radius (centre line)

SHAPES = {
    "end": ("N",),
    "straight": ("N", "S"),
    "corner": ("N", "E"),
    "tee": ("N", "E", "S"),
    "cross": ("N", "E", "S", "W"),
}

#: The unit step out from the centre towards each side (x right, y down).
STEP = {"N": (0, -1), "E": (1, 0), "S": (0, 1), "W": (-1, 0)}


def chrome():
    # Polished chrome: a mirror with a whisper of roughness, so the studio light reads as one long crisp highlight.
    return mat("pipeChrome", "#e4e8ee", 0.24, metal=1.0, coat=0.7, coat_rough=0.03)


def chrome_cap():
    return mat("pipeCap", "#bfc5cd", 0.18, metal=1.0, coat=0.4, coat_rough=0.05)


W_R = R - 4.2     # the water's radius inside the glass (the clear wall shows round it)
HL_R = 1.15       # the specular stripe's radius


def water():
    """Deep glossy water (stage 2, Joe: "glossy blue water inside glass"): a saturated blue that darkens towards the
    tube's sides (Layer Weight facing), so the column reads round and deep, under a mirror-smooth clear coat."""
    if "water" in jzlib._mats:
        return jzlib._mats["water"]
    m = mat("water", "#1a6cf0", 0.05, coat=1.0, coat_rough=0.015)
    n, l = m.node_tree.nodes, m.node_tree.links
    b = n["Principled BSDF"]
    lw = n.new("ShaderNodeLayerWeight"); lw.inputs["Blend"].default_value = 0.42
    cr = n.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].color = jzlib.hexc("#4aa6ff")
    cr.color_ramp.elements[1].color = jzlib.hexc("#021446")
    cr.color_ramp.elements[0].position = 0.05
    cr.color_ramp.elements[1].position = 0.5
    l.new(lw.outputs["Facing"], cr.inputs[0])
    l.new(cr.outputs[0], b.inputs["Base Color"])
    return m


def tube_glass():
    # Clear glass walls: Fresnel reflections strong enough that the wall reads as a pale rim round the water.
    return thin_glass("tubeGlass", "#f4faff", rough=0.015, strength=1.55)


def highlight():
    # The water's crisp specular stripe (an emitter on the key light's reflection line; no bloom, so no glow).
    return mat("waterHighlight", "#ffffff", 0.2, emit="#f4faff", emit_strength=3.2)


def sheen():
    # A soft band round the stripe, so the highlight reads as light on a curve, not a painted line.
    return mat("waterSheen", "#7fc2ff", 0.2, emit="#6fb6ff", emit_strength=0.8)


def rim():
    # The glass wall: a thin pale line along each side of the tube, where the glass is seen edge on.
    return mat("glassRim", "#d6ebff", 0.2, emit="#cfe6ff", emit_strength=0.75)


def sides(pts, z, offset):
    """The tube's two silhouette lines (offset each side in the plane), the same on every tile and turn."""
    left, right = [], []
    for i, (x, y) in enumerate(pts):
        a = pts[max(0, i - 1)]
        b = pts[min(len(pts) - 1, i + 1)]
        tx, ty = b[0] - a[0], b[1] - a[1]
        tl = math.hypot(tx, ty) or 1.0
        nx, ny = -ty / tl, tx / tl
        left.append((x + offset * nx, y + offset * ny, z))
        right.append((x - offset * nx, y - offset * ny, z))
    return left, right


def densify(pts, step=2.0):
    fine = [pts[0]]
    for q in pts[1:]:
        p0 = fine[-1]
        n = max(1, int(math.ceil(math.hypot(q[0] - p0[0], q[1] - p0[1]) / step)))
        fine += [(p0[0] + (q[0] - p0[0]) * k / n, p0[1] + (q[1] - p0[1]) * k / n) for k in range(1, n + 1)]
    return fine


def _half_vector():
    """The key sun's half vector with the camera (screen coords, y down, z up): where a mirror shows the light."""
    lx, ly, lz = -0.8, -0.8, 1.1
    n = math.sqrt(lx * lx + ly * ly + lz * lz)
    hx, hy, hz = lx / n, ly / n, lz / n + 1.0
    m = math.sqrt(hx * hx + hy * hy + hz * hz)
    return hx / m, hy / m, hz / m


def stripe(pts, z, radius, sign=1.0, trim=0.0):
    """Points on a tube's surface where it mirrors the key light: the half vector less its part along the path.

    Depends only on the path's direction, so the stripe on one tile meets its neighbour's in the gap exactly and
    follows a bend smoothly. `trim` drops the first points within that distance of the start (arms from a junction).
    """
    hx, hy, hz = _half_vector()
    pts = densify(pts)
    out = []
    for i, (x, y) in enumerate(pts):
        a = pts[max(0, i - 1)]
        b = pts[min(len(pts) - 1, i + 1)]
        tx, ty = b[0] - a[0], b[1] - a[1]
        tl = math.hypot(tx, ty) or 1.0
        tx, ty = tx / tl, ty / tl
        d = hx * tx + hy * ty
        px, py, pz = sign * (hx - d * tx), sign * (hy - d * ty), hz
        pl = math.sqrt(px * px + py * py + pz * pz)
        out.append((x + radius * px / pl, y + radius * py / pl, z + radius * pz / pl))
    if trim:
        x0, y0 = pts[0]
        keep = [p for p, q in zip(out, pts) if math.hypot(q[0] - x0, q[1] - y0) >= trim]
        out = keep
    return out


def edge(d):
    """The point past side d where the sprite ends (the game crops it at half the board gap)."""
    dx, dy = STEP[d]
    c = SIZE / 2
    return (c + dx * (c + BLEED), c + dy * (c + BLEED))


def paths(arms):
    """The tube's centre lines: straight runs across the tile, a corner as one smooth bend, other arms from the centre."""
    c = SIZE / 2
    out = []
    left = set(arms)
    for a, b in (("N", "S"), ("E", "W")):
        if a in left and b in left:
            out.append([edge(a), edge(b)])
            left -= {a, b}
    if len(arms) == 2 and len(left) == 2:
        a, b = sorted(left, key="NESW".index)
        (ax, ay), (bx, by) = STEP[a], STEP[b]
        # The bend's centre sits BEND in from the tile centre towards both open sides.
        ox, oy = c + (ax + bx) * BEND, c + (ay + by) * BEND
        # start lies on a's centre line (x = c for N/S), stop on b's.
        start = (c, oy) if ax == 0 else (ox, c)
        stop = (ox, c) if ax == 0 else (c, oy)
        a0 = math.atan2(start[1] - oy, start[0] - ox)
        a1 = math.atan2(stop[1] - oy, stop[0] - ox)
        da = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
        pts = [edge(a), start]
        for i in range(1, 24):
            t = a0 + da * i / 24
            pts.append((ox + BEND * math.cos(t), oy + BEND * math.sin(t)))
        pts += [stop, edge(b)]
        out.append(pts)
        left = set()
    for d in sorted(left, key="NESW".index):
        out.append([(c, c), edge(d)])
    return out


TURN = {"N": "E", "E": "S", "S": "W", "W": "N"}


def turned(arms, turns):
    out = list(arms)
    for _ in range(turns):
        out = [TURN[d] for d in out]
    return tuple(out)


def sun(dx, dy, dz, strength, angle, color="#ffffff"):
    """A distant light from screen direction (dx, dy) (y down) and height dz: the same on every point of the sprite."""
    from mathutils import Vector
    d = bpy.data.lights.new("sun", "SUN")
    d.energy = strength
    d.angle = math.radians(angle)
    d.color = jzlib.hexc(color)[:3]
    ob = bpy.data.objects.new("sun", d)
    bpy.context.scene.collection.objects.link(ob)
    ob.rotation_euler = Vector((-dx, dy, -dz)).to_track_quat("-Z", "Y").to_euler()
    return ob


def even_light():
    """sprite.py's rich studio (HDRI reflections, a crisp top-left key, cool fill, soft top, rim) as distant lights.

    begin()'s area lights sit close to the tile, so a tube's shade drifts along its length and two tiles' ends would not
    match; distant lights (and the HDRI at infinity) light every point alike, so tubes join across tiles seamlessly.
    """
    for ob in [o for o in bpy.context.scene.objects if o.type == "LIGHT"]:
        bpy.data.objects.remove(ob, do_unlink=True)
    sun(-0.8, -0.8, 1.1, 3.2, 5, "#fff3e0")
    sun(1.0, 0.9, 0.9, 0.9, 30, "#dfe8ff")
    sun(0.0, 0.0, 1.0, 0.5, 45)
    sun(0.9, -0.9, 0.35, 0.9, 8)


def pipework(arms, wet):
    begin(SIZE, PX, pad=BLEED, reflect=0.9)
    even_light()
    shadow_catcher(SIZE, BLEED)
    z = R + 0.5  # the tube's axis, resting just above the tile
    c = SIZE / 2
    for pts in paths(arms):
        if wet:
            # Arms from a junction start inside the through tube: their glass, stripe and rims start at its wall, open
            # (no cap disc showing through the through tube's glass).
            junction = pts[0] == (c, c) and len(arms) > 2
            trim = R - 0.6 if junction else 0.0
            tube([(x, y, z) for x, y in pts], W_R, water(), round_caps=False)
            cut = W_R if junction else 0.0
            soft = stripe(pts, z, W_R - 1.5, trim=cut)
            core = stripe(pts, z, W_R + 0.7, trim=cut)
            if len(core) >= 2:
                tube(soft, 2.6, sheen(), round_caps=False)
                tube(core, HL_R * 1.15, highlight(), round_caps=False)
            fine = [q for q in densify(pts) if not trim or math.hypot(q[0] - c, q[1] - c) >= trim]
            for side in sides(fine, z, R - 0.55):
                tube(side, 0.55, rim(), round_caps=False)
            g = tube([(x, y, z) for x, y in fine], R, tube_glass(), round_caps=False)
            if junction:
                g.data.use_fill_caps = False
        else:
            tube([(x, y, z) for x, y in pts], R, chrome(), round_caps=False)
    if len(arms) == 1:
        # An end: a domed chrome cap closing the tube.
        cyl(c, c, R + 2.0, z, chrome_cap(), z=0, bevel=1.2)
        sphere(c, c, R + 2.0, chrome(), z=z)


def make_pipe(shape, turns, wet):
    return lambda: pipework(turned(SHAPES[shape], turns), wet)


#: Distinct turns of each shape (the game's pipeSprite picks the lowest turn that matches).
TURNS = {"end": 4, "straight": 2, "corner": 4, "tee": 4, "cross": 1}


def tile():
    """The dark tile: a glossy graphite plate with a soft bevel (fills its box; the board gap shows round it). Darker since
    stage 2 (Joe: "make the tiles darker so the water stands out")."""
    begin(SIZE, PX, pad=0, light=0.3, reflect=0.12)
    plate = mat("tilePlate", "#08070b", 0.38, coat=0.55, coat_rough=0.26)
    add_bump(plate, scale=120, strength=0.03, detail=3, distance=0.002)
    box(1.0, 1.0, SIZE - 2.0, SIZE - 2.0, 6, plate, r=8, z=0)


def source():
    """The source valve: a red hand wheel on a chrome boss, sitting on the tile's junction."""
    begin(SIZE, PX, pad=0, reflect=0.3)
    shadow_catcher(SIZE, 0)
    red = mat("valveRed", "#a8141a", 0.3, coat=1.0, coat_rough=0.06)
    ch, dk = chrome(), chrome_cap()
    z = R + 2
    cyl(SIZE / 2, SIZE / 2, 9, z + 10, dk, z=0, bevel=1.0)
    torus(SIZE / 2, SIZE / 2, 22, 3.6, red, z=z + 13)
    for a in range(3):
        ang = a * math.pi / 3
        dx, dy = 22 * math.cos(ang), 22 * math.sin(ang)
        tube([(SIZE / 2 - dx, SIZE / 2 - dy, z + 13), (SIZE / 2 + dx, SIZE / 2 + dy, z + 13)], 2.4, red, round_caps=False)
    sphere(SIZE / 2, SIZE / 2, 7.5, ch, z=z + 14)


def spill():
    """A leak: water spraying out of an open pipe end (drawn at the end of an arm, pointing north)."""
    begin(SIZE, PX // 2, pad=0)
    w = mat("spillWater", "#3d97ee", 0.08, coat=1.0, coat_rough=0.03, emit="#2a86e6", emit_strength=0.45)
    sheet = mat("spillSheet", "#62b4f6", 0.1, coat=1.0, emit="#3d97ee", emit_strength=0.3, alpha=0.8)
    # A fan of drops from the bottom middle (the pipe mouth) outwards and up.
    import random
    rnd = random.Random(7)
    ellipsoid(50, 84, 26, 12, 2.0, sheet, z=1.0)
    for i in range(16):
        ang = math.radians(-90 + rnd.uniform(-52, 52))
        dist = rnd.uniform(18, 70)
        x, y = 50 + dist * math.cos(ang), 92 + dist * math.sin(ang)
        rr = max(3.2, 9.5 - dist * 0.08) * rnd.uniform(0.8, 1.15)
        sphere(x, y, rr, w, z=rr + 2)


SPRITES = {"tile": tile, "valve": source, "spill": spill}
for _shape in SHAPES:
    for _t in range(TURNS[_shape]):
        SPRITES[f"{_shape}-{_t}-dry"] = make_pipe(_shape, _t, False)
        SPRITES[f"{_shape}-{_t}-wet"] = make_pipe(_shape, _t, True)

if __name__ == "__main__":
    main("pipes", SPRITES)
