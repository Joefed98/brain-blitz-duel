"""Kakuro (the Number overhaul, 15 Nov 2026): the board's squares, blank.

Concept A's material: a white square is a deep slate-green tile with a soft satin top and a bevelled edge; a clue square
is a black lacquered tile split by a thin champagne diagonal; an unused black square is the same black tile without the
diagonal. The app lays each one under its grid cell (background-size 100%), so the tap target is the cell itself, and
draws every digit and clue number over it in bold Archivo.

Sprites: cell, clue, block, frame (the board's tray).
Run:  /opt/blender/venv/bin/python docs/design/number-overhaul/source/kakuro.py [cell clue block frame]
"""
from sprites import *  # noqa: F401,F403

S = 60  # one square, in points
# The sprite light is set for a large piece; a small tile reads true to its colours a stop and a half down.
EXPOSURE = -1.6


def tile(name, top, diag=False):
    setup(S, S, scale=4, samples=64).view_settings.exposure = EXPOSURE
    m = add_bump(mat(name + "m", top, 0.55, coat=0.08, coat_rough=0.4), 160, 0.025)
    box(2, 2, S - 4, S - 4, 7, m, r=3.4)
    if diag:
        gold = mat("diag", "#c9a964", 0.45, metal=1.0)
        tube([(8, 8, 7.1), (S - 8, S - 8, 7.1)], 0.55, gold, round_caps=False)
    write("kakuro", name)


def frame():
    """The board's tray: a dark, satin lacquered plate with a low rim (stretched under the grid)."""
    setup(120, 120, scale=4, samples=64).view_settings.exposure = EXPOSURE
    plate = mat("plate", "#0d1110", 0.6)
    rim = mat("rim", "#2a2f2d", 0.5, metal=0.6)
    box(0, 0, 120, 120, 4, rim, r=6)
    box(3, 3, 114, 114, 4.4, plate, r=4)
    write("kakuro", "frame")


run({
    "cell": lambda: tile("cell", "#1f3329"),
    "clue": lambda: tile("clue", "#0c0f0e", diag=True),
    "block": lambda: tile("block", "#0c0f0e"),
    "frame": frame,
})
