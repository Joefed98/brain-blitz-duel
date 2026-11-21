"""Kakuro (the Number overhaul, 15 Nov 2026; material pass: concept A's glossy lacquered tiles): the board's squares, blank.

Concept A's material: a white square is a deep slate-green tile with a soft satin top and a bevelled edge; a clue square
is a black lacquered tile split by a thin champagne diagonal; an unused black square is the same black tile without the
diagonal. The app lays each one under its grid cell (background-size 100%), so the tap target is the cell itself, and
draws every digit and clue number over it in bold Archivo.

Spotlight (the polish plan, 21 Nov 2026): a white square is now a white matte tile and the clue and unused squares a
deep green matte tile (the clue's champagne diagonal kept), lit by one soft top light with the Word art's neutral view,
so the digits on the white squares are dark navy ink in the app. The frame keeps the first pass's render.

Sprites: cell, clue, block, frame (the board's tray).
Run:  /opt/blender/venv/bin/python docs/design/number-overhaul/source/kakuro.py [cell clue block frame]
"""
from sprites import *  # noqa: F401,F403

S = 60  # one square, in points
# Material pass (Joe, 15 Nov 2026): the product light, a touch down so the dark lacquer keeps its depth.
EXPOSURE = -1.9


def tile(name, top, diag=False):
    # A low studio reflection keeps the flat face dark; the key still draws a crisp line along the bevel.
    setup(S, S, scale=4, samples=64, reflect=0.18).view_settings.exposure = EXPOSURE
    # Concept A: a deep, glossy lacquered tile (clear coat over a fine satin body), a rounded bevel that takes a crisp
    # highlight along its top-left edge; the flat face stays dark so the digit on it reads.
    m = add_bump(mat(name + "m", top, 0.6, coat=1.0, coat_rough=0.04), 160, 0.02)
    box(2, 2, S - 4, S - 4, 7, m, r=5.5)
    if diag:
        gold = mat("diag", "#d8b670", 0.22, metal=1.0)
        tube([(7, 7, 7.1), (S - 7, S - 7, 7.1)], 0.6, gold, round_caps=False)
    write("kakuro", name)


def frame():
    """The board's tray: a dark, satin lacquered plate with a low rim (stretched under the grid)."""
    setup(120, 120, scale=4, samples=64).view_settings.exposure = EXPOSURE
    plate = mat("plate", "#0b100e", 0.4, coat=0.7, coat_rough=0.2)
    rim = mat("rim", "#3a403d", 0.28, metal=1.0)
    box(0, 0, 120, 120, 4, rim, r=6)
    box(3, 3, 114, 114, 4.4, plate, r=4)
    write("kakuro", "frame")


def lit_tile(name, top, diag=False):
    """Spotlight's matte square: no lacquer, a faint satin coat, true colours (neutral view, a stop down)."""
    sc = setup(S, S, scale=4, samples=64, reflect=0.12)
    sc.view_settings.view_transform = "Khronos PBR Neutral"
    sc.view_settings.look = "None"
    sc.view_settings.exposure = -1.1
    box(2, 2, S - 4, S - 4, 7, mat(name + "m", top, 0.6, coat=0.12, coat_rough=0.4), r=5.5)
    if diag:
        gold = mat("diag", "#d8b670", 0.3, metal=1.0)
        tube([(7, 7, 7.1), (S - 7, S - 7, 7.1)], 0.6, gold, round_caps=False)
    write("kakuro", name)


run({
    "cell": lambda: lit_tile("cell", "#f7f8fa"),
    "clue": lambda: lit_tile("clue", "#17583c", diag=True),
    "block": lambda: lit_tile("block", "#17583c"),
    "frame": frame,
})
