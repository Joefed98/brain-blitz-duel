"""Exact (target) pieces: concept A's lacquered black tiles with blank faces and a big cast-gold target plate.

Materials (Joe's clarification, 15 Nov 2026: lit, not flat): the tiles a deep black lacquer (a clear coat over dark
graphite) that catches a crisp highlight along the bevel; the picked and large tiles polished gold; the target plate
cast gold, its rim polished to shine and its face brushed so the number on it stays clean.

  tile         a number tile: dark navy-graphite, satin, a bevelled edge
  tile-large   a large number's tile: the same with a champagne edge inlay
  tile-picked  the picked tile: champagne gold
  op           an operator key: navy, satin
  target       the target plate: cast champagne gold with a raised rim (the app writes the target in dark ink)

Run:  /opt/blender/venv/bin/python docs/design/number-overhaul/source/target.py [sprite ...]
"""
import os, sys
import bpy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprites import *  # noqa: F401,F403

G = "target"


def studio(w, h, scale=3):
    setup(w, h, scale)


def gold(name="gold", rough=0.2):
    m = mat(name, "#d6ac5c", rough, metal=1.0)
    return add_bump(m, 70, 0.012, distance=0.0008)


def slate(name, color):
    """Black lacquer: dark graphite under a glossy clear coat (depth, a crisp edge highlight)."""
    m = mat(name, color, 0.32, coat=1.0, coat_rough=0.06)
    return add_bump(m, 120, 0.01, distance=0.0008)


def tile_base(name, face, edge=None):
    studio(120, 72, scale=3)
    face, edge = face(), (edge() if edge else None)
    if edge is not None:
        box(2, 2, 116, 68, 8, edge, r=12)
        box(5, 5, 110, 62, 10, face, r=10)
    else:
        box(2, 2, 116, 68, 10, face, r=12)
    write(G, name)


def tile():
    tile_base("tile", lambda: slate("tileface", "#1f252b"))


def tile_large():
    tile_base("tile-large", lambda: slate("tilelg", "#1b1f24"), edge=lambda: gold("tileedge", 0.2))


def tile_picked():
    tile_base("tile-picked", lambda: gold("tilegold", 0.24))


def op():
    studio(90, 52, scale=3)
    box(2, 2, 86, 48, 8, slate("opface", "#172040"), r=10)
    write(G, "op")


def target():
    studio(300, 150, scale=3)
    g = gold("plate", 0.16)
    box(2, 2, 296, 146, 6, g, r=22)                                  # the rim, polished
    face = add_bump(mat("plateface", "#cfa75e", 0.38, metal=1.0), 60, 0.02, stretch=(1, 40, 1), distance=0.001)
    box(12, 12, 276, 126, 7, face, r=16, z=-0.5)                     # the face, brushed and set a touch lower
    write(G, "target")


if __name__ == "__main__":
    run({"tile": tile, "tile-large": tile_large, "tile-picked": tile_picked, "op": op, "target": target})
