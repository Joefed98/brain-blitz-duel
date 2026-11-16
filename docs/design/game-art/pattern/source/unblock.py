"""Gridlock (unblock) sprites, the Pattern overhaul (15 Nov 2026, look A: glossy painted toy cars on a dark lot).

One cell is 100 points. Every car sprite is exactly its vehicle box (2 or 3 cells long, 1 wide), the car drawn inside it
with its own soft shadow, so the game places the image on the box the drag maths uses and nothing leaves it. Vertical
cars are built in their own orientation (not the horizontal image turned), so the light stays at the top left.
The lot is the 1000-point board (kerb 45 points, 7 × 7 bays of 130), the exit gap cut through the right kerb on row 2.

  JZ_THREADS=1 /opt/blender/venv/bin/python docs/design/game-art/pattern/source/unblock.py [sprite …]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprite import *  # noqa: F401,F403
import bpy
import jzlib

PX_PER_CELL = 120
LIGHT = float(os.environ.get("UB_LIGHT", "1.0"))  # a cell is ~45 css px on a phone; ~2.7× for DPR 2–3

# Muted body colours, none near the gold car's (the gold car is the only gold thing on the lot).
BODIES = {
    "blue": "#2f5aa6",
    "teal": "#1f7a72",
    "red": "#a82c3e",
    "violet": "#5a46a8",
    "green": "#357a3a",
    "silver": "#565c66",
}
GOLD_PAINT = "#ecb032"


def frame(long_pts, short_pts, axis):
    """A canvas exactly long × short points (h) or short × long (v), rendered at PX_PER_CELL a cell."""
    s = begin(long_pts, int(round(PX_PER_CELL * long_pts / 100)), pad=0, light=LIGHT)
    shadow_catcher(long_pts, 0, 1.0)
    cam = s.camera
    if axis == "h":
        s.render.resolution_y = int(round(PX_PER_CELL * short_pts / 100))
        cam.location = jzlib.V(long_pts / 2, short_pts / 2, 2000)
    else:
        s.render.resolution_x = int(round(PX_PER_CELL * short_pts / 100))
        cam.location = jzlib.V(short_pts / 2, long_pts / 2, 2000)
    return s


def R(axis, x, y, w, h):
    """A rectangle given along the car (x from the tail, y across) placed for the axis (v: x runs down)."""
    return (x, y, w, h) if axis == "h" else (y, x, h, w)


def car(colour, length, axis, gold=False):
    L = 100 * length
    frame(L, 100, axis)
    paint = mat(
        f"paint-{colour}",
        GOLD_PAINT if gold else BODIES[colour],
        0.24 if gold else 0.34,
        metal=1.0 if gold else 0.35,
        coat=1.0,
        coat_rough=0.03,
    )
    cabin_paint = paint
    glass_m = mat("glass-dark", "#0a1018", 0.05, metal=0.3, coat=1.0, coat_rough=0.02)
    tyre = mat("tyre", "#111216", 0.85)
    head = mat("headlamp", "#f3ecd6", 0.25, emit="#fff4dc", emit_strength=0.25)
    tail = mat("taillamp", "#b8202a", 0.3, emit="#ff3030", emit_strength=0.2)
    trim = mat("trim", "#1a1c22", 0.5)
    stripe = mat("stripe", "#1b1406", 0.4, coat=1.0, coat_rough=0.1)

    def b(x, y, w, h, d, m, r=2.0, z=0.0):
        box(*R(axis, x, y, w, h), d, m, r=r, z=z)

    # Tyres peeking out under the body (the front at the far end: right for h, bottom for v).
    wheels = [0.2, 0.8] if length == 2 else [0.13, 0.42, 0.86]
    for f in wheels:
        cx = L * f
        b(cx - 13, 9, 26, 82, 10, tyre, r=4)
    if length == 2 or gold:
        # Saloon: one body, a raised cabin with glass at both ends.
        b(8, 13, L - 16, 74, 30, paint, r=15)
        cab0, cab1 = L * 0.27, L * 0.70
        b(cab0, 21, cab1 - cab0, 58, 12, cabin_paint, r=10, z=24)
        b(cab0 + 2, 25, 15, 50, 2, glass_m, r=4, z=35.5)       # rear window
        b(cab1 - 22, 23, 18, 54, 2, glass_m, r=5, z=35.5)      # windscreen
        b(cab0 + 22, 21, cab1 - cab0 - 48, 3, 2, glass_m, r=1, z=34.5)   # side windows
        b(cab0 + 22, 76, cab1 - cab0 - 48, 3, 2, glass_m, r=1, z=34.5)
        if gold:
            # Two dark pinstripes along the bonnet and boot: the gold car reads even without colour.
            for yy in (41, 53):
                b(12, yy, cab0 - 14, 6, 1.2, stripe, r=1, z=29.6)
                b(cab1 + 2, yy, L - cab1 - 14, 6, 1.2, stripe, r=1, z=29.6)
    else:
        # Van: cargo box at the back, a lower cab at the front.
        cab = 92
        b(8, 12, L - cab - 12, 76, 40, paint, r=12)
        for k in range(1, int((L - cab - 30) // 34) + 1):
            b(8 + k * 34, 15, 3, 70, 0.8, trim, r=1, z=39.6)
        b(L - cab - 2, 15, cab - 6, 70, 30, paint, r=14)
        b(L - cab + 8, 22, cab - 40, 56, 8, cabin_paint, r=10, z=28)
        b(L - 38, 24, 16, 52, 2, glass_m, r=5, z=35.5)         # windscreen
    # Lamps: headlamps at the front, tail lamps at the back (soft, not glowing).
    van = length == 3 and not gold
    tz = 39 if van else 29
    b(L - 17, 19, 7, 15, 2.5, head, r=2, z=28.5)
    b(L - 17, 66, 7, 15, 2.5, head, r=2, z=28.5)
    b(10, 20, 6, 13, 2.5, tail, r=1.5, z=tz)
    b(10, 67, 6, 13, 2.5, tail, r=1.5, z=tz)


def lot(n=7):
    """The car park: concrete kerb, dark asphalt, worn white bay lines and the exit gap in the right kerb (row 2).
    `n` bays a side: 7 (every level but Easy), 6 (Easy's lot, the difficulty levels of 15 Nov 2026, "lot-6")."""
    V = 1000
    begin(V, 900, pad=0, light=LIGHT * 0.8)
    W0 = 45
    CELL = (V - 2 * W0) / n
    kerb = mat("kerb", "#23252b", 0.7)
    add_bump(kerb, 90, 0.08, distance=0.004)
    asphalt = mat("asphalt", "#0d0e11", 0.72)
    add_bump(asphalt, 320, 0.8, distance=0.004)
    paintm = mat("baypaint", "#4a4944", 0.6)
    box(0, 0, V, V, 10, kerb, r=26)
    box(W0 - 2, W0 - 2, V - 2 * W0 + 4, V - 2 * W0 + 4, 10.6, asphalt, r=8)
    ey = W0 + 2 * CELL
    box(V - W0 - 6, ey, W0 + 6, CELL, 10.6, asphalt, r=0)        # the exit gap through the kerb
    for k in range(1, n):
        at = W0 + k * CELL
        box(at - 1.5, W0 + 10, 3, V - 2 * W0 - 20, 10.75, paintm, r=0.5)
        box(W0 + 10, at - 1.5, V - 2 * W0 - 20, 3, 10.75, paintm, r=0.5)


def gold_sprites():
    return {"gold-2h": lambda: car("gold", 2, "h", gold=True)}


SPRITES = {"lot": lot, "lot-6": lambda: lot(6), **gold_sprites()}
for c in BODIES:
    for n in (2, 3):
        for a in ("h", "v"):
            SPRITES[f"{c}-{n}{a}"] = (lambda c=c, n=n, a=a: car(c, n, a))

if __name__ == "__main__":
    main("unblock", SPRITES)
