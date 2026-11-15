"""Ballpark (`numline`): the ruler and the marker pins.

The ruler is a satin, brushed-steel rule with rounded ends and a darker milled edge, lit evenly (no streak of glare
along it); the app stretches it to the line's width and draws the bold end labels, the notches and the markers. The
pins are a champagne-gold head on a steel needle (the live marker) and a pewter one (a placed marker); the needle's
tip is the pin's anchor, at the bottom centre of the sprite.

Run:  /opt/blender/venv/bin/python docs/design/number-overhaul/source/numline.py [ruler pin pin-placed]
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprites import *  # noqa: F401,F403

GAME = "numline"


def ruler():
    setup(360, 36, scale=3, samples=48)
    steel = brushed("rulersteel", "#aeb4bf", rough=0.42, aniso=0.5, stretch=(60, 1, 1))
    edge = mat("ruleredge", "#5d636e", 0.5, metal=1.0)
    box(4, 6, 352, 24, 4, edge, r=6)
    box(5, 7, 350, 21, 6, steel, r=5)
    write(GAME, "ruler")


def pin(name, head_color, rough):
    setup(40, 80, scale=3, samples=48)
    needle = mat("needle", "#c8ccd4", 0.3, metal=1.0)
    head = mat(f"head{name}", head_color, rough, metal=1.0)
    ycyl(20, 30, 46, 1.6, needle, z=0)
    sphere(20, 20, 14, head, z=0)
    collar = mat(f"collar{name}", "#8d929c", 0.35, metal=1.0)
    cyl(20, 34, 4.5, 2.5, collar, z=0)
    write(GAME, name)


if __name__ == "__main__":
    run({
        "ruler": ruler,
        "pin": lambda: pin("pin", "#d9b56c", 0.36),
        "pin-placed": lambda: pin("pin-placed", "#8a8f9b", 0.42),
    })
