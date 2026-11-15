"""Summit (tripeaks, tripeaksRev 3): three peaks of 28 cards (rows 3, 6, 9, 10), stock and discard below.
Mid-play: six of the bottom row and one of the row above cleared, a run of three going."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from table import *

CW, CH = 36, 54
PITCH = 37.6
X0 = 195 - PITCH * 4.5
ROW_Y = [156, 196, 236, 276]
ROW3 = {2: ("9", "C"), 3: ("J", "D"), 7: ("2", "S"), 8: ("Q", "H")}
ROW2_UP = {4: ("5", "H"), 5: ("7", "D")}
ROW2_GONE = {0}


def build(look):
    table(look, panel=(8, 94, 382, 834), panel2=(40, 430, 350, 600))
    z = 0.2
    # row 0 and row 1: face down
    for k in range(3):
        deal_card(look, "A", "S", X0 + (3 * k + 1.5) * PITCH, ROW_Y[0], CW, CH, z=u(z), face_up=False)
        for j in (1, 2):
            deal_card(look, "A", "S", X0 + (3 * k + j) * PITCH, ROW_Y[1], CW, CH, z=u(z + 0.9), face_up=False)
    for i in range(9):
        if i in ROW2_GONE:
            continue
        up = ROW2_UP.get(i)
        deal_card(look, *(up or ("A", "S")), X0 + (i + 0.5) * PITCH, ROW_Y[2], CW, CH, z=u(z + 1.8),
                  face_up=bool(up), glow=(look == "A" and up is not None and up[0] == "5"))
    for i, cd in ROW3.items():
        playable = cd[0] in ("7", "5")
        deal_card(look, *cd, X0 + i * PITCH, ROW_Y[3], CW, CH, z=u(z + 2.7))
    # stock (three left, fanned) and the discard with a run of three under it
    for s in range(3):
        deal_card(look, "A", "S", 128 - s * 3, 514 - s * 1.5, 62, 92, z=u(0.2 + s * 0.9), face_up=False)
    for s, cd in enumerate([("4", "C"), ("5", "D"), ("6", "S")]):
        deal_card(look, *cd, 262 + (s - 2) * 3, 514, 62, 92, z=u(0.2 + s * 0.9), rot=(s - 2) * 3)
    return dict(pills=[("Cleared", "7/28", False), ("Stock par", "5/20", True)], right_pills=[("Peaks", "0/3", False)],
                post=vignette(0.5) if look == "B" else None)


run("cards-board", "tripeaks", ["A", "B"], build)
