"""Thirteen (pyramid, pyramidRev 2): a 28-card pyramid, pairs adding to 13, Kings alone, stock turned once.
Mid-play: the bottom row half cleared, a 5 selected and the waste showing an 8."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from table import *

ROWS = [
    ["K"], ["8", "5"], ["Q", "3", "10"], ["7", "A", "9", "4"], ["2", "J", "6", "Q", "5"],
    ["9", "4", "8", "K", "2", "7"], ["6", "3", "J", "A", "10", "5", "8"],
]
SUITS = "DSHCSDHCDHSCHDSCHDCSHDCSHDSC"
GONE = {(6, 0), (6, 1), (6, 3), (6, 4), (6, 6), (5, 0)}
CW, CH = 46, 68
PITCH, STEP, Y0 = 50, 36, 140


def free(r, i):
    if r == 6:
        return True
    return (r + 1, i) in GONE and (r + 1, i + 1) in GONE


def build(look):
    table(look, panel=(8, 94, 382, 834), panel2=(24, 548, 366, 770))
    n = 0
    for r, row in enumerate(ROWS):
        for i, rank in enumerate(row):
            suit = SUITS[n % len(SUITS)]
            n += 1
            if (r, i) in GONE:
                continue
            x = 195 + (i - r / 2) * PITCH
            sel = (r, i) == (6, 5)
            o = deal_card(look, rank, suit, x, Y0 + r * STEP, CW, CH, z=u(0.9 * r + 0.2), glow=sel,
                          lift=u(5) if sel else 0)
            if not free(r, i) and look == "B":
                pass
    # stock (24) and waste
    for s in range(4):
        deal_card(look, "A", "S", 118 - s * 1.5, 640 - s * 1.2, 64, 94, z=u(0.2 + s * 0.9), face_up=False)
    deal_card(look, "8", "C", 272, 640, 64, 94, z=u(0.3))
    lab = labels([("STOCK 24", 118, 572, 10, (200, 214, 240, 255), 600), ("WASTE 1", 272, 572, 10, (200, 214, 240, 255), 600),
                  ("Need 8", 195, 640, 14, (240, 226, 190, 255), 800)],
                 then=vignette(0.5) if look == "B" else None)
    return dict(pills=[("Removed", "6/28", False)], right_pills=[("Pairs", "3/10", True)], post=lab)


run("cards-board", "pyramid", ["A", "B"], build)
