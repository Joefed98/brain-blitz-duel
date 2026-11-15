"""Heave (push) sprites, the Pattern overhaul (15 Nov 2026, look A: a brick warehouse with a stone floor).

One cell is 100 points, every sprite exactly one cell, so the game places each image on its cell and nothing leaves
it. The floor and wall tiles fill the whole cell (the wall's brick courses line up across neighbouring cells, so a run
of walls reads as one brick wall); marks, crates and the worker are transparent round their piece, the crate and the
worker carrying their own soft shadow. The worker is built once per facing (up, right, down, left), so the light stays
at the top left whichever way the worker turns. Nothing glows.

  JZ_THREADS=1 /opt/blender/venv/bin/python docs/design/game-art/pattern/source/push.py [sprite …]
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprite import *  # noqa: F401,F403

PX = 120  # a cell is ~40–50 css px on a phone
LIGHT = float(os.environ.get("PUSH_LIGHT", "0.5"))


def tile(light=LIGHT):
    return begin(100, PX, pad=0, light=light)


def floor():
    """A worn stone flag, grout round its edge, filling the whole cell."""
    tile()
    grout = mat("grout", "#4a443c", 0.95)
    stone = mat("stone", "#968a76", 0.85)
    add_bump(stone, 40, 1.0, distance=0.03)
    box(0, 0, 100, 100, 4, grout, r=0)
    box(2.5, 2.5, 95, 95, 6, stone, r=2.2)


def wall():
    """The top of a brick wall: three courses of bricks, joints offset by a quarter cell, so neighbours line up."""
    tile(LIGHT * 0.95)
    mortar = mat("mortar", "#3a2a22", 0.95)
    brick = mat("brick", "#94492f", 0.78)
    add_bump(brick, 14, 0.3, distance=0.003)
    brick2 = mat("brick2", "#82402a", 0.8)
    add_bump(brick2, 14, 0.3, distance=0.003)
    box(0, 0, 100, 100, 18, mortar, r=0)
    ch = 100 / 3
    for k in range(3):
        off = 25 if k % 2 else 0
        for j in range(-1, 3):
            x0 = off + j * 50
            a, b = max(x0 + 1.6, 0), min(x0 + 50 - 1.6, 100)
            if b - a < 2:
                continue
            m = brick if (j + k) % 2 else brick2
            # Bricks cut by the cell edge run flush to it (no bevel there) so the next cell continues them.
            box(a, k * ch + 1.6, b - a, ch - 3.2, 22, m, r=1.2 if (a > 0.5 and b < 99.5) else 0.0)


def mark():
    """A dark painted target square with light tape corners, flat on the floor."""
    tile()
    paint = mat("markpaint", "#24262b", 0.75)
    tape = mat("tape", "#d9d4c6", 0.6)
    box(14, 14, 72, 72, 0.6, paint, r=3)
    for (x, y, w, h) in ((19, 19, 20, 5), (19, 19, 5, 20), (61, 19, 20, 5), (76, 19, 5, 20),
                         (19, 76, 20, 5), (19, 61, 5, 20), (61, 76, 20, 5), (76, 61, 5, 20)):
        box(x, y, w, h, 1.0, tape, r=0.8)
    # A small cross in the middle: "a crate goes here".
    box(47.5, 40, 5, 20, 1.0, tape, r=1)
    box(40, 47.5, 20, 5, 1.0, tape, r=1)


def gold_mark():
    """The gold crate's own mark: a gold plate with a dark diamond inset, flat on the floor."""
    tile()
    gold = mat("goldplate", "#d39b25", 0.35, metal=0.9)
    dark = mat("golddark", "#4a320a", 0.6)
    box(9, 9, 82, 82, 1.0, gold, r=4)
    box(16, 16, 68, 68, 1.4, dark, r=3)
    box(21, 21, 58, 58, 1.8, gold, r=2)
    s = 32
    box(50 - s / 2, 50 - s / 2, s, s, 2.6, dark, r=2, rot=math.radians(45))


def crate_body(face, frame, brace, nails, gold=False):
    shadow_catcher(100, 0, 1.0)
    box(9, 9, 82, 82, 30, face, r=2.5, z=0.5)
    # The frame round the lid and the diagonal brace.
    for (x, y, w, h) in ((9, 9, 82, 11), (9, 80, 82, 11), (9, 9, 11, 82), (80, 9, 11, 82)):
        box(x, y, w, h, 3, frame, r=1.6, z=30)
    br = box(50 - 5.5, 15, 11, 74, 2.6, brace, r=1.5, z=30.2, rot=math.radians(45))
    # Plank seams across the face.
    seam = mat("seam" + ("g" if gold else ""), "#2c1a0c" if not gold else "#5a3a08", 0.9)
    for y in (36, 63):
        box(20, y - 0.8, 60, 1.6, 0.6, seam, r=0.3, z=30.1)
    for (x, y) in ((14.5, 14.5), (85.5, 14.5), (14.5, 85.5), (85.5, 85.5)):
        sphere(x, y, 2.0, nails, z=33)
    return br


def crate():
    tile()
    crate_body(
        wood("crateface", "#cf7a2c", "#7e3f12", scale=4, coat=0.15),
        wood("crateframe", "#7a4018", "#3a1c08", scale=4, coat=0.15),
        wood("cratebrace", "#94521e", "#4a260a", scale=4, coat=0.15),
        mat("nail", "#8a8a88", 0.35, metal=1.0),
    )


def gold_crate():
    tile()
    crate_body(
        mat("goldface", "#e0a92e", 0.32, metal=0.85),
        mat("goldframe", "#9a6a12", 0.4, metal=0.85),
        mat("goldbrace", "#b9851c", 0.35, metal=0.85),
        mat("goldnail", "#f3d27a", 0.3, metal=1.0),
        gold=True,
    )


ROT = {"U": 0, "R": 90, "D": 180, "L": 270}


def worker(facing):
    """A warehouse worker seen from above: white hard hat, orange hi-vis vest, navy arms reaching forward."""
    tile()
    shadow_catcher(100, 0, 1.0)
    a = math.radians(ROT[facing])

    def P(x, y):
        # Local coordinates face up (towards y = 0); turn about the cell's centre.
        dx, dy = x - 50, y - 50
        return 50 + dx * math.cos(a) - dy * math.sin(a), 50 + dx * math.sin(a) + dy * math.cos(a)

    def E(x, y, rx, ry, rz, m, z):
        # Drawn 1.35× about the cell’s centre: the worker fills most of its cell.
        x, y, rx, ry, rz, z = 50 + (x - 50) * 1.35, 50 + (y - 50) * 1.35, rx * 1.35, ry * 1.35, rz * 1.35, z * 1.35
        cx, cy = P(x, y)
        if ROT[facing] % 180:
            rx, ry = ry, rx
        ellipsoid(cx, cy, rx, ry, rz, m, z=z)

    shirt = mat("shirt", "#26324a", 0.7)
    vest = mat("vest", "#f06a1c", 0.6)
    stripe = mat("reflect", "#e8ece6", 0.45)
    skin = mat("skin", "#c98b62", 0.6)
    hat = mat("hat", "#f2f0ea", 0.35, coat=0.4, coat_rough=0.25)
    hatrim = mat("hatrim", "#c9c4b6", 0.45)
    boot = mat("boot", "#2a201a", 0.8)
    # Boots peeping out behind, arms forward to push, the body, the vest and its stripes, then the hat.
    E(39, 74, 6, 8, 4, boot, 4)
    E(61, 74, 6, 8, 4, boot, 4)
    E(29, 36, 6.5, 15, 6, shirt, 18)
    E(71, 36, 6.5, 15, 6, shirt, 18)
    E(29, 21, 5.5, 5, 5, skin, 22)
    E(71, 21, 5.5, 5, 5, skin, 22)
    E(50, 55, 25, 17, 12, vest, 14)
    # Reflective stripes across the back of the vest.
    for y in (58, 66):
        E(50, y, 21, 2.2, 1.2, stripe, 25.6 - (y - 58) * 0.35)
    E(50, 48, 16, 15.5, 1.5, hatrim, 29)
    E(50, 47, 13.5, 13, 9, hat, 29)
    # A ridge along the hat's crown, front to back, shows which way the worker faces.
    E(50, 45, 2.4, 11, 2.4, hatrim, 37.2)


SPRITES = {
    "floor": floor,
    "wall": wall,
    "mark": mark,
    "gold-mark": gold_mark,
    "crate": crate,
    "gold-crate": gold_crate,
}
for f in ROT:
    SPRITES[f"worker-{f.lower()}"] = (lambda f=f: worker(f))

if __name__ == "__main__":
    main("push", SPRITES)
