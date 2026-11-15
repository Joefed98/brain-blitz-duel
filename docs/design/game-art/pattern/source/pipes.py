"""Pipeline (pipes) sprites, the Pattern overhaul stage 1 (look A: chrome pipes on dark tiles, water in the network).

Richness pass (Joe, 15 Nov 2026): sprite.py's rich studio light (HDRI reflections, a crisp key from the top left, fill
and rim, AgX Punchy) on concept A's materials: brushed steel that shines, polished chrome couplings, glossy blue water
behind clear sight glass. So that the key light stays top left on every tile, each shape is rendered in each of its
distinct turns (`<shape>-<turns>-dry|wet`: end, corner and tee 4, straight 2, cross 1); the game picks the file and
only animates the turn with a transform. The tile, the source valve and the leak spill are separate sprites.

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
PX = 128
R = 12.5          # the tube's radius (a quarter of the tile across)
COLLAR_R = 15.5   # the coupling at the tile edge
HUB_R = 17.0

SHAPES = {
    "end": ("N",),
    "straight": ("N", "S"),
    "corner": ("N", "E"),
    "tee": ("N", "E", "S"),
    "cross": ("N", "E", "S", "W"),
}


def chrome():
    return mat("pipeSteel", "#c8ced6", 0.24, metal=1.0, coat=0.4, coat_rough=0.05)


def chrome_dark():
    return mat("flange", "#d8dce0", 0.2, metal=1.0)


def water():
    # Saturated, readable blue; a touch of self-light only so it stays blue under the glass (no glow).
    return mat("water", "#0a56c8", 0.08, coat=1.0, coat_rough=0.03, emit="#1a6fe0", emit_strength=0.3)


def sight_glass():
    return thin_glass("sightGlass", "#f4fbff", rough=0.04, strength=0.6)


def arm(d, m, r, z, a=0.0, b=50.0):
    """A cylinder from `a` to `b` points out from the centre towards side d (N, E, S, W)."""
    c = SIZE / 2
    if d == "N":
        return ycyl(c, c - b, b - a, r, m, z=z, bevel=0.4)
    if d == "S":
        return ycyl(c, c + a, b - a, r, m, z=z, bevel=0.4)
    if d == "W":
        return xcyl(c - b, c, b - a, r, m, z=z, bevel=0.4)
    return xcyl(c + a, c, b - a, r, m, z=z, bevel=0.4)


TURN = {"N": "E", "E": "S", "S": "W", "W": "N"}


def turned(arms, turns):
    out = list(arms)
    for _ in range(turns):
        out = [TURN[d] for d in out]
    return tuple(out)


def pipework(arms, wet):
    begin(SIZE, PX, pad=0, reflect=0.3)
    shadow_catcher(SIZE, 0)
    z = R + 2  # the tube's axis height above the tile
    ch, dk = chrome(), chrome_dark()
    for d in arms:
        # Coupling at the tile edge (half of it; the neighbour's tile draws the other half).
        arm(d, ch, COLLAR_R, z, 44.0, 50.0)
        # Coupling where the arm leaves the hub.
        arm(d, dk if not wet else ch, R + 1.6, z, HUB_R - 2.0, HUB_R + 3.0)
        if wet:
            arm(d, water(), R - 2.2, z, HUB_R, 44.5)
            arm(d, sight_glass(), R, z, HUB_R + 2.5, 44.5)
        else:
            arm(d, ch, R, z, HUB_R, 44.5)
    if len(arms) == 1:
        # An end: a capped stub, the cap a domed boss with a hex nut.
        cyl(SIZE / 2, SIZE / 2, HUB_R - 1, z, dk, z=0, bevel=1.5)
        sphere(SIZE / 2, SIZE / 2, HUB_R - 2, ch, z=z)
        cyl(SIZE / 2, SIZE / 2, 5.5, 4, dk, z=z + HUB_R - 4, verts=6, bevel=0.6)
    else:
        # The junction: a chrome body; in the wet set a glass dome over the water in the middle.
        if wet:
            sphere(SIZE / 2, SIZE / 2, HUB_R, ch, z=z - 3)
            sphere(SIZE / 2, SIZE / 2, HUB_R - 4.5, water(), z=z + 3.2)
            sphere(SIZE / 2, SIZE / 2, HUB_R - 3.6, sight_glass(), z=z + 3.4)
        else:
            sphere(SIZE / 2, SIZE / 2, HUB_R, ch, z=z)
            cyl(SIZE / 2, SIZE / 2, 5.0, 3, dk, z=z + HUB_R - 2.4, verts=6, bevel=0.5)


def make_pipe(shape, turns, wet):
    return lambda: pipework(turned(SHAPES[shape], turns), wet)


#: Distinct turns of each shape (the game's pipeSprite picks the lowest turn that matches).
TURNS = {"end": 4, "straight": 2, "corner": 4, "tee": 4, "cross": 1}


def tile():
    """The dark tile: a satin graphite plate with softly rounded edges (fills its box; the board gap shows round it)."""
    begin(SIZE, PX, pad=0, light=0.8)
    plate = mat("tilePlate", "#221e2a", 0.4, coat=0.7, coat_rough=0.22)
    add_bump(plate, scale=120, strength=0.04, detail=3, distance=0.002)
    box(1.0, 1.0, SIZE - 2.0, SIZE - 2.0, 6, plate, r=8, z=0)
    # A shallow recess for the pipes to sit in.
    box(9, 9, SIZE - 18, SIZE - 18, 0.6, mat("tileWell", "#0f0e13", 0.6), r=10, z=6)


def source():
    """The source valve: a red hand wheel on a chrome boss, sitting on the tile's junction."""
    begin(SIZE, PX, pad=0, reflect=0.3)
    shadow_catcher(SIZE, 0)
    red = mat("valveRed", "#a8141a", 0.3, coat=1.0, coat_rough=0.06)
    ch, dk = chrome(), chrome_dark()
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
