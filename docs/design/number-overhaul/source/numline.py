"""Ballpark (`numline`): the ruler and the marker pins.

The ruler is a satin, brushed-steel rule with rounded ends and a darker milled edge, lit evenly (no streak of glare
along it); the app stretches it to the line's width and draws the bold end labels, the notches and the markers. The
pins are a champagne-gold head (the live marker) and a pewter one (a placed marker); the app draws the needle.

Run:  /opt/blender/venv/bin/python docs/design/number-overhaul/source/numline.py [ruler pin pin-placed]
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprites import *  # noqa: F401,F403

GAME = "numline"


def ruler():
    setup(360, 36, scale=3, samples=48)
    steel = brushed("rulersteel", "#767d8a", rough=0.55, aniso=0.5, stretch=(60, 1, 1))
    edge = mat("ruleredge", "#5d636e", 0.5, metal=1.0)
    box(4, 6, 352, 24, 4, edge, r=6)
    box(5, 7, 350, 21, 6, steel, r=5)
    write(GAME, "ruler")


def pin(name, head_color, rough):
    """A pin's head alone (32 x 32 points, its centre the sprite's centre); the app draws the needle."""
    setup(32, 32, scale=3, samples=48)
    head = mat(f"head{name}", head_color, rough, metal=1.0)
    sphere(16, 16, 14, head, z=0)
    write(GAME, name)


if __name__ == "__main__":
    run({
        "ruler": ruler,
        "pin": lambda: pin("pin", "#d4ae62", 0.48),
        "pin-placed": lambda: pin("pin-placed", "#7f8592", 0.5),
    })
