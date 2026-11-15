"""Exact (target) pieces: concept A's polished tiles with blank faces and a big gold target plate, satin, no glare.

  tile         a number tile: dark navy-graphite, satin, a bevelled edge
  tile-large   a large number's tile: the same with a champagne edge inlay
  tile-picked  the picked tile: champagne gold
  op           an operator key: navy, satin
  target       the target plate: cast champagne gold with a raised rim (the app writes the target in dark ink)

Run:  /opt/blender/venv/bin/python docs/design/number-overhaul/source/target.py [sprite ...]
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprites import *  # noqa: F401,F403

G = "target"


def studio(w, h, scale=3):
    setup(w, h, scale)
    world("#06080f", 0.0, hdri="studio.exr", hdri_strength=0.5)


def gold(name="gold", rough=0.42):
    m = mat(name, "#dcb86e", rough, metal=1.0)
    return add_bump(m, 70, 0.025, distance=0.0012)


def slate(name, color):
    m = mat(name, color, 0.5, coat=0.15, coat_rough=0.4)
    return add_bump(m, 120, 0.015, distance=0.001)


def tile_base(name, face, edge=None):
    studio(120, 72, scale=3)
    if edge is not None:
        box(2, 2, 116, 68, 8, edge, r=12)
        box(5, 5, 110, 62, 10, face, r=10)
    else:
        box(2, 2, 116, 68, 10, face, r=12)
    write(G, name)


def tile():
    tile_base("tile", slate("tileface", "#1d2436"))


def tile_large():
    tile_base("tile-large", slate("tilelg", "#232435"), edge=gold("tileedge", 0.45))


def tile_picked():
    tile_base("tile-picked", gold("tilegold", 0.45))


def op():
    studio(90, 52, scale=3)
    box(2, 2, 86, 48, 8, slate("opface", "#1a2440"), r=10)
    write(G, "op")


def target():
    studio(300, 150, scale=3)
    g = gold("plate", 0.44)
    box(2, 2, 296, 146, 6, g, r=22)                                  # the rim
    box(12, 12, 276, 126, 7, gold("plateface", 0.55), r=16, z=-0.5)  # the face, set a touch lower
    write(G, "target")


if __name__ == "__main__":
    run({"tile": tile, "tile-large": tile_large, "tile-picked": tile_picked, "op": op, "target": target})
