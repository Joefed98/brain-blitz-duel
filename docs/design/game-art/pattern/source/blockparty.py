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

PX = 160  # cells are ~40–50 css px on a phone: about 3× for DPR 2–3 (the brass and lacquer highlights need it)
LIGHT = float(os.environ.get("BP_LIGHT", "1.0"))
BLOCK_LIGHT = float(os.environ.get("BP_BLOCK_LIGHT", "0.35"))
BLOCK_REFLECT = float(os.environ.get("BP_BLOCK_REFLECT", "0.12"))

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
    # Concept A's lacquered block (pattern.py `lacquer`): a hard clear coat over a satin colour, so the block has depth
    # and one crisp highlight from the key light; no emission (no glow).
    return mat(f"lac_{name}", colour, 0.2, coat=0.9, coat_rough=0.05, spec=0.35)


def block(colour_name):
    def make():
        # A low studio reflection on the flat top (the overhead studio washed the colour to pastel: a glare across the
        # face); the key light still draws its crisp highlight on the bevel.
        s = begin(100, PX, light=LIGHT * BLOCK_LIGHT, reflect=BLOCK_REFLECT)
        # AgX (even Punchy) turns the saturated piece colours pastel: the pieces keep the rich studio but the
        # Standard transform, at a lower key, so the colour stays today's.
        s.view_settings.view_transform = "Standard"
        s.view_settings.look = "None"
        shadow_catcher(100)
        box(5, 5, 90, 90, 30, lacquer(colour_name, COLOURS[colour_name]), r=13)
    return make


def recess():
    # The dark slab around the square and the recessed well inside it (concept A's satin cells: a light coat, so the
    # bevels catch the light without a wash across the square).
    slab = mat("slab", "#191a24", 0.45, coat=0.4, coat_rough=0.2)
    box(0, 0, 100, 100, 6, slab, r=2)
    well = mat("well", "#0c0d13", 0.38, coat=0.5, coat_rough=0.12)
    box(7, 7, 86, 86, 3, well, r=12, z=4)


def well():
    begin(100, PX, light=LIGHT)
    recess()


def peg():
    begin(100, PX, light=LIGHT)
    recess()
    # Concept A's polished brass peg: a domed stud on a darker collar, mirror-bright where the studio reflects.
    brass = mat("brass", "#d4ad5c", 0.16, metal=1.0)
    base = mat("brass_base", "#8a6a2c", 0.3, metal=1.0)
    cyl(50, 50, 27, 6, base, z=7, bevel=1.8)              # the collar
    cyl(50, 50, 22, 14, brass, z=11, bevel=7.0)           # the stud, a well-rounded brass dome
    cyl(50, 50, 7, 1.6, mat("brass_dot", "#f0d89a", 0.1, metal=1.0), z=24.8, bevel=0.7)  # the polished cap


SPRITES = {f"block-{name}": block(name) for name in COLOURS}
SPRITES["well"] = well
SPRITES["peg"] = peg

main("blockparty", SPRITES)
