"""Tessellate (blockparty) sprites, the Pattern overhaul (look A: brass studs as pegs, glossy coloured pieces, a dark
tray). Each sprite is one board cell (100 points square) seen straight down; the game draws one image per cell.

  block-<colour>  one square of a piece: a glossy lacquered block (the nine piece colours of today's game)
  well            an empty board square: a dark satin recess
  peg             a board square holding a peg: the same recess with a brass stud

Run:  JZ_THREADS=1 /opt/blender/venv/bin/python docs/design/game-art/pattern/source/blockparty.py [sprite …]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprite import *  # noqa: F401,F403

PX = 128  # cells are ~40–50 css px on a phone: about 2.5× for DPR 2–3
LIGHT = float(os.environ.get("BP_LIGHT", "0.4"))
BLOCK_LIGHT = float(os.environ.get("BP_BLOCK_LIGHT", "0.7"))

# Today's piece colours (GLYPH_COLOURS in src/components/duel/ShapeGlyph.tsx), the ninth the light foreground.
COLOURS = {
    "red": "#FF4D4D",
    "blue": "#4D8CFF",
    "green": "#3DDC84",
    "purple": "#B26BFF",
    "pink": "#FF6BD6",
    "orange": "#FF8A3D",
    "brown": "#8B5A2B",
    "yellow": "#FFE600",
    "white": "#E9E6DE",
}


def lacquer(name, colour):
    # A glossy lacquer: a clear coat over a satin base; no emission (no glow), a soft top-left key, so no glare.
    return mat(f"lac_{name}", colour, 0.42, coat=0.55, coat_rough=0.28, spec=0.3)


def block(colour_name):
    def make():
        s = begin(100, PX, light=LIGHT * BLOCK_LIGHT)
        # Standard view transform for the pieces: AgX washes the saturated piece colours towards pastel.
        s.view_settings.view_transform = "Standard"
        s.view_settings.look = "None"
        shadow_catcher(100)
        box(5, 5, 90, 90, 26, lacquer(colour_name, COLOURS[colour_name]), r=11)
    return make


def recess():
    # The dark slab around the square and the recessed well inside it (top-down, the bevel gives the depth).
    slab = mat("slab", "#1b1d27", 0.55, coat=0.3, coat_rough=0.3)
    box(0, 0, 100, 100, 6, slab, r=2)
    well = mat("well", "#0d0e14", 0.6)
    box(7, 7, 86, 86, 3, well, r=12, z=4)


def well():
    begin(100, PX, light=LIGHT)
    recess()


def peg():
    begin(100, PX, light=LIGHT)
    recess()
    brass = mat("brass", "#c9a35a", 0.34, metal=1.0, aniso=0.2)
    base = mat("brass_base", "#8a6a2c", 0.45, metal=1.0)
    cyl(50, 50, 27, 6, base, z=7, bevel=1.5)            # the collar
    cyl(50, 50, 22, 12, brass, z=11, bevel=4.0)          # the stud, a domed brass head
    cyl(50, 50, 9, 2.0, mat("brass_dot", "#e8cf8e", 0.3, metal=1.0), z=22.6, bevel=0.8)  # the polished centre


SPRITES = {f"block-{name}": block(name) for name in COLOURS}
SPRITES["well"] = well
SPRITES["peg"] = peg

main("blockparty", SPRITES)
