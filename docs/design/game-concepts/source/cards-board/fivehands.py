"""Five Hands (fivehands, fiveHandsRev 3): five rows of five cards with a hand badge each, the next card below and
the discards along the foot. Mid-play: turn 12 of 20, rows filling evenly."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from table import *

ROWS = [
    [("Q", "S"), ("Q", "H"), ("4", "D"), ("9", "C")],
    [("7", "H"), ("7", "C"), ("7", "S")],
    [("2", "D"), ("6", "D"), ("J", "D"), ("K", "D")],
    [("5", "S"), ("6", "H"), ("8", "C")],
    [("10", "C"), ("10", "S"), ("3", "H"), ("3", "C")],
]
BADGE = [("PAIR", "15"), ("THREE", "25"), ("", ""), ("", ""), ("TWO PAIR", "20")]
TAKEN = [("9", "H"), ("2", "S"), ("K", "C"), ("4", "S"), ("J", "H"), ("A", "D"), ("8", "S"), ("5", "D"), ("Q", "C"), ("3", "S"), ("6", "C")]
CW, CH = 50, 74
X0, PITCH = 36, 55
Y0, STEP = 136, 84


def build(look):
    table(look, panel=(8, 94, 382, 834))
    plate_m = gold("plaque", (196, 154, 76) if look == "A" else (236, 196, 120), rough=0.45 if look == "A" else 0.3,
                   brushed=look == "B")
    dim = mat("plaque-off", (26, 52, 110), rough=0.6) if look == "A" else mat("plaque-off", (14, 30, 74), rough=0.5)
    labs = []
    for r, row in enumerate(ROWS):
        y = Y0 + r * STEP
        for c in range(5):
            x = X0 + c * PITCH
            if c < len(row):
                deal_card(look, *row[c], x, y, CW, CH, z=u(0.2))
            else:
                slot(look, x, y, CW, CH)
        name, pts = BADGE[r]
        on = bool(pts)
        plate("badge", u(58), u(CH), u(2.2), u(8), mat_=plate_m if on else dim, loc=P(344, y, 0), edge=u(0.8))
        if name:
            ink = (60, 40, 10, 255) if on else (190, 206, 240, 255)
            labs.append((name, 344, y - 18, 9, ink, 800))
            if pts:
                labs.append((pts, 344, y + 10, 24, (40, 26, 6, 255), 800))
    # the next card, the deck
    deal_card(look, "Q", "D", 160, 600, 66, 97, z=u(0.4), lift=u(3))
    for s in range(3):
        deal_card(look, "A", "S", 262 - s * 1.2, 600 - s, 46, 68, z=u(0.2 + 0.9 * s), face_up=False)
    labs += [("NEXT", 160, 538, 10, (200, 214, 240, 255), 600), ("DECK 13", 262, 548, 10, (200, 214, 240, 255), 600),
             ("TAKEN 11", 40, 700, 9, (200, 214, 240, 255), 600)]
    for i, cd in enumerate(TAKEN):
        deal_card(look, *cd, 34 + i * 29, 752, 40, 59, z=u(0.2 + 0.9 * i))
    return dict(pills=[("Points", 60, False), ("Turn", "12/20", False)], right_pills=[("Hands", "3/5", True)],
                post=labels(labs, then=vignette(0.5) if look == "B" else None))


run("cards-board", "fivehands", ["A", "B"], build)
