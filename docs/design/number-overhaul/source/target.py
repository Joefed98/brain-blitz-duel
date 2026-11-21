"""Exact (target) pieces. Spotlight (the polish plan, 21 Nov 2026): ivory number tiles over a warm ledge, champagne
enamel for the large numbers, the picked tile in the Number green, and a white target plate with a green ring; matte,
one soft top light, no chrome. The operator keys stay navy (they are controls). The first pass (15 Nov 2026) was
concept A's lacquered black tiles and a cast-gold plate, described below.

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
    # The studio's reflection kept modest: a flat face looking at the camera would mirror the whole studio back
    # (a wash across the number); the bevels still catch the key's crisp highlight.
    setup(w, h, scale, reflect=0.35)
    bpy.context.scene.view_settings.look = "AgX - Punchy"  # the concepts' colour look


def gold(name="gold", rough=0.2):
    m = mat(name, "#d6ac5c", rough, metal=1.0)
    return add_bump(m, 70, 0.012, distance=0.0008)


def slate(name, color):
    """Black lacquer: dark graphite under a glossy clear coat (depth, a crisp edge highlight)."""
    m = mat(name, color, 0.38, coat=0.8, coat_rough=0.14)
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


def neutral():
    # Light pieces keep their true colours: AgX's look bleaches pale colours, so they take the Word art's view.
    bpy.context.scene.view_settings.view_transform = "Khronos PBR Neutral"
    bpy.context.scene.view_settings.look = "None"
    bpy.context.scene.view_settings.exposure = -1.1


def matte(name, color, rough=0.6):
    """Spotlight's light pieces: a matte body under a faint satin coat (no chrome, no lacquer, no glare)."""
    return mat(name, color, rough, coat=0.12, coat_rough=0.4)


def lit_tile(name, face, ledge):
    """A light tile: its matte face standing on a warmer, darker ledge that shows along the bottom edge."""
    studio(120, 72, scale=3)
    neutral()
    box(2, 2, 116, 68, 6, matte(name + "ledge", ledge), r=12)
    box(2, 2, 116, 63, 6, matte(name + "face", face), r=12, z=6)
    write(G, name)


def tile():
    lit_tile("tile", "#f3ead3", "#c9a56a")


def tile_large():
    lit_tile("tile-large", "#e9cc86", "#b48a40")


def tile_picked():
    lit_tile("tile-picked", "#79e3a7", "#2f9f64")


def op():
    studio(90, 52, scale=3)
    box(2, 2, 86, 48, 8, slate("opface", "#0b1022"), r=10)
    write(G, "op")


def target():
    studio(300, 150, scale=3)
    neutral()
    box(2, 2, 296, 146, 6, matte("platering", "#2fb36a", 0.5), r=22)   # the ring, the Number green
    box(12, 12, 276, 126, 7, matte("plateface", "#f7f8fa"), r=16, z=-0.5)  # the plate, white, set a touch lower
    write(G, "target")


if __name__ == "__main__":
    run({"tile": tile, "tile-large": tile_large, "tile-picked": tile_picked, "op": op, "target": target})
