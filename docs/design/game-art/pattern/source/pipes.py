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


def water():
    # Deep, saturated blue liquid; glossy, a touch of self-light only so it stays blue under the glass (no glow).
    return mat("water", "#1466ea", 0.08, coat=1.0, coat_rough=0.02, emit="#0e54d0", emit_strength=0.08)


def tube_glass():
    return thin_glass("tubeGlass", "#f2f9ff", rough=0.02, strength=0.75)


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
            tube([(x, y, z) for x, y in pts], R - 1.1, water(), round_caps=False)
            tube([(x, y, z) for x, y in pts], R, tube_glass(), round_caps=False)
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
    """The dark tile: a glossy graphite plate with a soft bevel (fills its box; the board gap shows round it)."""
    begin(SIZE, PX, pad=0, light=0.7)
    plate = mat("tilePlate", "#121016", 0.32, coat=0.8, coat_rough=0.16)
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
