"""Free Cell (freecell, freecellRev 5): 40 cards Ace-10, eight columns of five, 4 free cells and 4 home piles.
Today: blue felt, white cards, free cells and homes in one top row, the eight columns below."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from table import *

HOME = [("3", "H"), ("2", "S"), ("A", "D"), None]
CELLS = [("10", "C"), None, ("7", "D"), None]
COLS = [
    [("6", "D"), ("8", "D"), ("9", "S")],
    [("9", "D"), ("8", "S"), ("7", "H")],
    [("9", "C"), ("10", "H"), ("9", "H"), ("8", "H"), ("7", "S")],
    [("7", "C"), ("6", "S"), ("5", "H")],
    [("A", "C"), ("6", "H"), ("5", "S"), ("4", "D")],
    [("5", "D"), ("4", "C"), ("3", "D")],
    [("3", "C"), ("2", "C")],
    [("10", "S"), ("10", "D"), ("8", "C"), ("6", "C"), ("5", "C"), ("4", "S"), ("3", "S")],
]
CW, CH = 43, 66
X0, PITCH = 34, 46
TOP_Y, COL_Y, STEP = 134, 236, 42


def build(look):
    table(look, panel=(8, 94, 382, 834))
    for i in range(4):
        x = X0 + i * PITCH
        slot(look, x, TOP_Y, CW, CH)
        if CELLS[i]:
            deal_card(look, *CELLS[i], x, TOP_Y, CW, CH, z=u(0.6))
    for i in range(4):
        x = X0 + (i + 4) * PITCH
        suit = "HSDC"[i]
        slot(look, x, TOP_Y, CW, CH, suit)
        if HOME[i]:
            deal_card(look, *HOME[i], x, TOP_Y, CW, CH, z=u(1.0))
    for c, col in enumerate(COLS):
        for r, cd in enumerate(col):
            top = c == 2 and r == len(col) - 1
            deal_card(look, *cd, X0 + c * PITCH, COL_Y + r * STEP, CW, CH, z=u(0.8 * r + 0.2),
                      lift=u(5) if top else 0)
    return dict(pills=[("Moves", 21, False), ("Home", "19/40", False)], right_pills=[("Par", 27, True)],
                post=vignette(0.5) if look == "B" else None)


run("cards-board", "freecell", ["A", "B"], build)
