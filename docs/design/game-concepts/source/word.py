"""Word: concept scenes. One function per live game, each taking the look:

  a  "Today, upgraded": today's navy, glossy black tiles, white letters, yellow-gold and blue highlights,
     rendered with real materials (glazed ceramic tiles, enamel gold, lit glass rims), light and depth.
  b  "Bolder": the same game and colours pushed further: black glass tiles with polished edges, real polished
     gold, sapphire light, a darker room with a pool of light and more glare.

Every board copies the live game's layout from the review screenshots (docs/design/game-reviews/img/word/),
measured on a 390 x 844 grid.
"""
import math

from lib import (area, spot, cbox, disc, dof, emissive, glass, ground, hexc, key_light, mat, metal, outline, prism,
                 rbox, reflector, ring, text, tube, world)


# ------------------------------------------------------------------------------------------- palettes


def palette(look):
    if look == "a":
        return dict(
            ground=mat("w_bg", hexc("#081333"), rough=0.7, rough_var=0.1, bump=0.015, bump_scale=900),
            tray=mat("w_tray", hexc("#0B1430"), rough=0.35, coat=0.4, coat_rough=0.15),
            rim=mat("w_rim", hexc("#24427E"), rough=0.3, coat=0.5),
            well=mat("w_well", hexc("#060A16"), rough=0.55, rough_var=0.08),
            tile=mat("w_tile", hexc("#22252D"), rough=0.32, coat=0.75, coat_rough=0.07, rough_var=0.05),
            tile_dim=mat("w_tile_dim", hexc("#15171D"), rough=0.4, coat=0.4),
            ink=mat("w_ink", hexc("#F4F6FB"), rough=0.35),
            ink_dim=mat("w_ink_dim", hexc("#6B7183"), rough=0.4),
            gold=mat("w_gold", hexc("#F2B33A"), rough=0.3, metal=0.35, coat=0.7, coat_rough=0.06, rough_var=0.05),
            gold_ink=mat("w_gold_ink", hexc("#141006"), rough=0.4),
            gold_text=mat("w_gold_text", hexc("#F4B73E"), rough=0.35),
            blue=emissive("w_blue", hexc("#4C8DFF"), 3.0),
            blue_text=mat("w_blue_text", hexc("#5B95FF"), rough=0.35),
            teal=mat("w_teal", hexc("#2FD0B4"), rough=0.3, coat=0.7, coat_rough=0.06),
            red=mat("w_red", hexc("#C9303C"), rough=0.32, coat=0.6),
            label=mat("w_label", hexc("#C9D3EA"), rough=0.4),
            navy_btn=mat("w_btn", hexc("#121D3C"), rough=0.35, coat=0.5),
        )
    return dict(
        ground=mat("wb_bg", hexc("#040818"), rough=0.55, rough_var=0.15, bump=0.02, bump_scale=900),
        tray=metal("wb_tray", hexc("#16213F"), rough=0.32, aniso=0.5),
        rim=emissive("wb_rim", hexc("#2E5BC4"), 0.9),
        well=mat("wb_well", hexc("#02040A"), rough=0.4, rough_var=0.1),
        tile=mat("wb_tile", hexc("#0E0F14"), rough=0.08, coat=1.0, coat_rough=0.02, spec=0.8, rough_var=0.03),
        tile_dim=mat("wb_tile_dim", hexc("#0A0B0F"), rough=0.2, coat=0.6),
        ink=mat("wb_ink", hexc("#FFFFFF"), rough=0.25),
        ink_dim=mat("wb_ink_dim", hexc("#555B6E"), rough=0.4),
        gold=metal("wb_gold", hexc("#F7BE45"), rough=0.14, aniso=0.2),
        gold_ink=mat("wb_gold_ink", hexc("#0E0A04"), rough=0.4),
        gold_text=emissive("wb_gold_text", hexc("#FFC34D"), 1.6),
        blue=emissive("wb_blue", hexc("#4A8CFF"), 6.0),
        blue_text=emissive("wb_blue_text", hexc("#6AA2FF"), 1.4),
        teal=mat("wb_teal", hexc("#25D3B5"), rough=0.12, coat=1.0, coat_rough=0.02),
        red=mat("wb_red", hexc("#D3263A"), rough=0.12, coat=1.0, coat_rough=0.02),
        label=mat("wb_label", hexc("#D5DEF2"), rough=0.35),
        navy_btn=metal("wb_btn", hexc("#1A2547"), rough=0.3),
    )


def light(look):
    if look == "a":
        world("studio", 0.18, rot=0.6, tint=(0.7, 0.8, 1.0, 1))
        key_light(1200, warm=(1.0, 0.97, 0.92), fill=0.2)
        reflector(0.9, (0.9, 0.94, 1.0))
    else:
        world("night", 0.1, rot=0.6, tint=(0.6, 0.7, 1.0, 1))
        key_light(800, warm=(1.0, 0.95, 0.88), fill=0.06, rim=0.0)
        area(560, 80, 120, 500, 900, (0.45, 0.6, 1.0), target=(195, 450))  # sapphire rim from the right
        reflector(1.1, (1.0, 0.95, 0.88))


# ---------------------------------------------------------------------------------------------- pieces


def tile(pal, cx, cy, s, ch, state="plain", d=None, z=0.0, size=None, sh=None):
    """A letter tile, as today: glossy black with a white letter; gold, teal, red, dim or ringed states."""
    w, h = s, sh or s
    d = d or s * 0.2
    face = {"plain": pal["tile"], "sel": pal["tile"], "gold": pal["gold"], "teal": pal["teal"], "red": pal["red"],
            "dim": pal["tile_dim"], "goldring": pal["tile"]}[state]
    rbox(cx, cy, w, h, d, face, r=min(w, h) * 0.16, z=z, bevel=min(w, h) * 0.07, segs=4)
    if state == "sel":
        outline(cx, cy, w + 5, h + 5, min(w, h) * 0.2, 2.2, d * 0.7, pal["blue"], z=z)
    if state == "goldring":
        outline(cx, cy, w + 4, h + 4, min(w, h) * 0.2, 2.4, d + 0.4, pal["gold"], z=z)
    if ch:
        ink = {"gold": pal["gold_ink"], "teal": pal["gold_ink"], "dim": pal["ink_dim"]}.get(state, pal["ink"])
        text(ch, cx, cy + 0.5, size or min(w, h) * 0.42, ink, z=z + d - 0.1, depth=0.5)


def well(pal, cx, cy, s, sh=None, z=0.0):
    """An empty square: a shallow recessed cell with a fine edge."""
    rbox(cx, cy, s, sh or s, 2.5, pal["well"], r=s * 0.14, z=z, bevel=0.8)
    outline(cx, cy, s, sh or s, s * 0.14, 1.2, 3.0, pal["tile_dim"], z=z)


def tray(pal, cx, cy, w, h, r=16, d=4):
    rbox(cx, cy, w, h, d, pal["tray"], r=r, bevel=2)
    outline(cx, cy, w, h, r, 1.6, d + 0.6, pal["rim"])


def pill(pal, cx, cy, w, h, label, value=None, kind="dark", size=8.5, vcol=None):
    face = {"dark": pal["tile_dim"], "gold": pal["gold"], "goldline": pal["tile_dim"]}[kind]
    rbox(cx, cy, w, h, 3.5, face, r=h / 2, bevel=1.2)
    if kind == "goldline":
        outline(cx, cy, w, h, h / 2, 1.8, 4.0, pal["gold"])
    ink = pal["gold_ink"] if kind == "gold" else pal["label"]
    if value is None:
        text(label, cx, cy + 0.5, size, ink, z=3.5, depth=0.3)
    else:
        text(label, cx + 6, cy + 0.5, size, ink, z=3.5, depth=0.3, align="RIGHT")
        text(value, cx + 10, cy + 0.5, size, vcol or pal["gold_text"], z=3.5, depth=0.3, align="LEFT")


def button(pal, x, y, w, h, label, kind="dark", size=10):
    cx, cy = x + w / 2, y + h / 2
    if kind == "gold":
        rbox(cx, cy, w, h, 7, pal["gold"], r=10, bevel=2.5)
        text(label, cx, cy + 0.5, size, pal["gold_ink"], z=7, depth=0.4)
    elif kind == "blue":
        rbox(cx, cy, w, h, 6, pal["navy_btn"], r=10, bevel=2)
        outline(cx, cy, w, h, 10, 1.8, 6.4, pal["blue"])
        text(label, cx, cy + 0.5, size, pal["blue_text"], z=6, depth=0.4)
    else:
        rbox(cx, cy, w, h, 6, pal["tile_dim"], r=10, bevel=2)
        text(label, cx, cy + 0.5, size, pal["ink_dim"], z=6, depth=0.4)


def shuffle_icon(pal, cx, cy, z=6.4, mat_=None):
    m = mat_ or pal["label"]
    for sg in (-1, 1):
        tube([(cx - 11, cy + 5 * sg, z), (cx - 4, cy + 5 * sg, z), (cx + 3, cy - 5 * sg, z), (cx + 7, cy - 5 * sg, z)],
             1.2, m)
        prism([(0, -3.5), (5, 0), (0, 3.5)], 1.4, m, z=z - 0.7, cx=cx + 7, cy=cy - 5 * sg, bevel=0.3)


def cross_icon(m, cx, cy, z, r=6, t=0.9):
    tube([(cx - r, cy - r, z), (cx + r, cy + r, z)], t, m)
    tube([(cx - r, cy + r, z), (cx + r, cy - r, z)], t, m)


def padlock(pal, cx, cy, closed=False):
    """Today's open padlock: a body and a shackle lifted to one side."""
    m = pal["gold"] if closed else pal["label"]
    rbox(cx, cy + 5, 20, 15, 3, m, r=3, bevel=0.8)
    dx = 0 if closed else 6
    pts = [(cx + dx + 6.5 * math.cos(math.pi + math.pi * i / 12), cy - 3 + 8 * math.sin(math.pi + math.pi * i / 12), 1.5)
           for i in range(13)]
    tube([(pts[0][0], cy + 1, 1.5)] + pts + [(pts[-1][0], cy + (1 if closed else -3), 1.5)], 1.3, m)


def keyboard(pal, top, rows, specials, offs, pitch, kw=33, kh=46, row_gap=57.5):
    """The shared QWERTY pad: rows of glossy keys; `specials` maps a letter to its state."""
    for ri, row in enumerate(rows):
        y = top + ri * row_gap + kh / 2
        for ci, ch in enumerate(row):
            x = offs[ri] + ci * pitch[ri] + kw / 2
            tile(pal, x, y, kw, ch, specials.get(ch, "plain"), d=7, size=12, sh=kh)


def finish(look):
    dof(10, 5.6 if look == "a" else 3.5)


# ----------------------------------------------------------------------------------------------- games


def wordsmith(look):
    """Nucleus: eight letters round the centre R; E and H picked, REH typed."""
    pal = palette(look)
    light(look)
    ground(pal["ground"])
    cx, cy, R = 195, 406, 136
    disc(cx, cy, 190, 3, pal["tray"], bevel=1.5)
    ring(cx, cy, R + 1.2, R - 1.2, 3.6, pal["rim"])
    letters = ["E", "C", "H", "E", "H", "W", "I", "V"]
    for i, ch in enumerate(letters):
        a = -math.pi / 2 + i * 2 * math.pi / 8
        x, y = cx + math.cos(a) * R, cy + math.sin(a) * R
        hot = i in (0, 2)
        if hot:
            disc(x, y, 38, 1.5, pal["blue"], z=0.5, bevel=0.5)
        disc(x, y, 34, 12, pal["gold"] if hot else pal["tile"], z=3, bevel=4.5)
        text(ch, x, y + 0.5, 23, pal["gold_ink"] if hot else pal["ink"], z=15, depth=0.6)
    ring(cx, cy, 57, 52.5, 16, pal["ink"], z=3, bevel=1)
    disc(cx, cy, 53, 16, mat("w_centre" + look, hexc("#2C4A9A" if look == "a" else "#1D3A8C"), rough=0.2,
                             coat=1.0, coat_rough=0.03), z=3, bevel=5)
    disc(cx, cy, 64, 1.5, pal["blue"], z=0.5, bevel=0.4)
    text("R", cx, cy + 1, 36, pal["ink"], z=19, depth=0.8)
    text("POINTS", 12, 105, 8.5, pal["label"], align="LEFT", depth=0.3)
    text("15", 62, 105, 8.5, pal["gold_text"], align="LEFT", depth=0.3)
    pill(pal, 326, 105, 96, 28, "WORDS 1 / 25", size=9)
    pill(pal, 195, 207, 104, 26, "PANGRAM +20", kind="gold", size=8.5)
    rbox(195, 694, 366, 44, 4, pal["navy_btn"], r=10, bevel=1.5)
    outline(195, 694, 366, 44, 10, 1.5, 4.5, pal["rim"])
    text("REH", 195, 694.5, 13, pal["ink"], z=4, depth=0.4, spacing=1.15)
    pill(pal, 161, 735, 66, 22, "Letters", "3", size=8, vcol=pal["ink"])
    pill(pal, 236, 735, 58, 22, "Need", "4", size=8, vcol=pal["blue_text"])
    rbox(36, 782, 46, 50, 6, pal["tile_dim"], r=8, bevel=2)
    shuffle_icon(pal, 37, 782)
    button(pal, 65, 756, 150, 52, "Clear", kind="blue")
    button(pal, 225, 756, 153, 52, "Enter", kind="gold")
    finish(look)


def tilegrid(look):
    """Interlock: the 7 x 7 board with HUNK across and SHE down through its H; the rest in the tray."""
    pal = palette(look)
    light(look)
    ground(pal["ground"])
    tray(pal, 195, 380, 366, 366, r=18)
    x0, y0, p = 23, 208, 49.5
    placed = {(1, 3): "H", (2, 3): "U", (3, 3): "N", (4, 3): "K", (1, 2): "S", (1, 4): "E"}
    for r in range(7):
        for c in range(7):
            x, y = x0 + c * p + p / 2, y0 + r * p + p / 2
            if (c, r) in placed:
                tile(pal, x, y, 44, placed[(c, r)], "goldring", z=4)
            else:
                well(pal, x, y, 46, z=4)
    for i, ch in enumerate(["A", "E", "A", "P", "F", "R", "G", "R", "S"]):
        rr, cc = divmod(i, 8)
        tile(pal, 35 + cc * 46, 693 + rr * 45, 42, ch, size=15)
    text("6 / 15 placed · 2 in words", 14, 790, 8.5, pal["label"], align="LEFT", depth=0.3)
    button(pal, 186, 765, 76, 50, "CLEAR", kind="blue")
    button(pal, 270, 765, 108, 50, "DONE", kind="dark")
    finish(look)


def wordslide(look):
    """Slider: five scrambled rows of five and the lock column on the right."""
    pal = palette(look)
    light(look)
    ground(pal["ground"])
    tray(pal, 168, 400, 316, 320, r=16)
    rows = ["FWOAB", "OLCAE", "ESHLV", "DALMY", "SHITR"]
    x0, y0, p = 45, 280, 60
    for r, word in enumerate(rows):
        for c, ch in enumerate(word):
            tile(pal, x0 + c * p, y0 + r * p, 54, ch, size=21, z=4)
        rbox(352, y0 + r * p, 40, 54, 2, pal["well"], r=8, bevel=0.6)
        padlock(pal, 352, y0 + r * p + 1)
    for lab, val, x, w in (("Words", "0 / 5", 96, 80), ("Locked", "0", 180, 66), ("Moves", "1", 253, 64),
                           ("Par", "8", 318, 50)):
        pill(pal, x, 743, w, 22, lab, val, size=7.5, vcol=pal["ink"] if lab != "Par" else pal["blue_text"])
    button(pal, 78, 777, 110, 49, "UNDO", kind="blue")
    button(pal, 202, 777, 110, 49, "RESET", kind="blue")
    finish(look)


def wordhunt(look):
    """Forage: the 6 x 6 grid, C-A-T traced, the golden tile beside it."""
    pal = palette(look)
    light(look)
    ground(pal["ground"])
    rows = ["OTAWOG", "ODDLUG", "NDCAEE", "EKATER", "NRBISZ", "AALBER"]
    x0, y0, p = 40, 278, 62
    tray(pal, 195, 432, 382, 404, r=18)
    path = [(2, 2), (2, 3), (3, 3)]
    for r, word in enumerate(rows):
        for c, ch in enumerate(word):
            st = "sel" if (c, r) in path else "goldring" if (c, r) == (4, 2) else "plain"
            tile(pal, x0 + c * p, y0 + r * p, 56, ch, st, z=4, size=22)
    pts = [(x0 + c * p, y0 + r * p, 15.9) for c, r in path]
    tube(pts, 2.4, pal["blue"])
    for (c, r), (x, y, z) in zip(path, pts):
        text(rows[r][c], x, y + 0.5, 22, pal["ink"], z=18.4, depth=0.5)  # the letter stays over the line
    text("POINTS", 12, 197, 9.5, pal["ink"], align="LEFT", depth=0.3)
    text("44", 73, 197, 9.5, pal["gold_text"], align="LEFT", depth=0.3)
    text("WORDS: 1", 378, 197, 9.5, pal["ink"], align="RIGHT", depth=0.3)
    pill(pal, 195, 221, 52, 22, "CAT", kind="goldline", size=8.5)
    pill(pal, 160, 640, 66, 22, "Letters", "3", size=8, vcol=pal["ink"])
    pill(pal, 235, 640, 58, 22, "Need", "4", size=8, vcol=pal["blue_text"])
    button(pal, 12, 662, 366, 48, "SUBMIT", kind="gold", size=10)
    finish(look)


def wordsearch(look):
    """Lookout: the 10 x 10 Science lab board; MOLECULE found, the bonus COMPOUND up the left."""
    pal = palette(look)
    light(look)
    ground(pal["ground"])
    rows = ["IDASALNLHD", "NOITCIRFET", "DAEBUYTPRP", "NLIUETOAIS", "UWERLEHPNS", "OTHEHCEABC", "PAWTKTSFWR",
            "MTUTTVABEA", "OAEEETEBIO", "CDMOLECULE"]
    x0, y0, p = 30, 273, 36.6
    text("Science lab", 195, 235, 14, pal["ink"], depth=0.4)
    for r, word in enumerate(rows):
        for c, ch in enumerate(word):
            tile(pal, x0 + c * p, y0 + r * p, 33, ch, size=13, d=6)
    outline(x0 + 5.5 * p, y0 + 9 * p, 8 * p + 2, 36, 17, 2.4, 7.5, pal["gold"])
    outline(x0, y0 + 5.5 * p, 36, 8 * p + 2, 17, 2.4, 7.5, pal["blue"])
    chips = [(67, 650, 94, "MOLECULE", "gold"), (167, 650, 92, "9", None), (262, 650, 86, "5", None),
             (340, 650, 62, "4", None), (110, 684, 72, "7", None), (205, 684, 82, "7", None),
             (290, 684, 72, "★ COMPOUND", "gold")]
    for x, y, w, lab, kind in chips:
        if kind:
            pill(pal, x, y, w, 24, lab, kind="gold", size=7)
        else:
            rbox(x, y, w, 24, 2.5, pal["tile_dim"], r=5, bevel=0.8)
            tube([(x - w / 2 + 10, y + 5, 3), (x + w / 2 - 22, y + 5, 3)], 0.6, pal["ink_dim"])
            text(lab, x + w / 2 - 12, y + 1, 7.5, pal["label"], z=2.5, depth=0.3)
    finish(look)


def letterwheel(look):
    """Roundabout: the crossword with SET in, the seven-letter wheel, the bonus jar."""
    pal = palette(look)
    light(look)
    ground(pal["ground"])
    cells = {0: [4, 5, 6, 7], 1: [2, 4, 7], 2: [1, 2, 3, 4, 5, 6, 7], 3: [2, 6], 4: [3, 6], 5: [1, 3, 5, 6, 7],
             6: [1, 3, 5, 7], 7: [0, 1, 2, 3, 5, 6, 7, 8], 8: [1, 3, 4, 5]}
    filled = {(7, 0): "S", (7, 1): "E", (7, 2): "T"}
    for r, cs in cells.items():
        for c in cs:
            x, y = 38 + c * 39, 113 + r * 39
            if (c, r) in filled:
                tile(pal, x, y, 36, filled[(c, r)], z=0, size=15)
            else:
                well(pal, x, y, 36)
    cx, cy = 195, 600
    disc(cx, cy, 136, 6, pal["tray"], bevel=2.5)
    ring(cx, cy, 137, 134.5, 6.6, pal["rim"])
    for i, ch in enumerate("OLTNVSE"):
        a = -math.pi / 2 + i * 2 * math.pi / 7
        x, y = cx + math.cos(a) * 96, cy + math.sin(a) * 96
        disc(x, y, 33, 12, pal["tile"], z=6, bevel=4)
        text(ch, x, y + 0.5, 21, pal["ink"], z=18, depth=0.6)
    jx, jy = 322, 467  # the bonus jar: clear glass with gold coins inside
    disc(jx, jy, 14, 3, mat("w_jarlid" + look, hexc("#8A93A8"), rough=0.3, metal=1), z=30, bevel=1)
    disc(jx, jy, 13, 30, glass("w_jar" + look, (0.9, 0.95, 1.0, 1), rough=0.05), bevel=3)
    for k in range(5):
        disc(jx - 5 + (k % 3) * 5, jy + 4 - k * 1.5, 4.5, 1.6, pal["gold"], z=1 + k * 1.8, bevel=0.5)
    pill(pal, 352, 467, 26, 24, "2", size=8.5)
    text("Words", 30, 785, 8, pal["label"], align="LEFT", depth=0.3)
    text("1 / 14", 64, 785, 8, pal["blue_text"], align="LEFT", depth=0.3)
    button(pal, 140, 762, 110, 48, "SUBMIT", kind="dark")
    rbox(296, 785, 40, 48, 5, pal["tile_dim"], r=8, bevel=1.5)
    cross_icon(pal["ink_dim"], 296, 785, 5.6)
    rbox(347, 785, 40, 48, 5, pal["tile_dim"], r=8, bevel=1.5)
    shuffle_icon(pal, 349, 785, z=5.4)
    finish(look)


def strikeout(look):
    """Strikeout: two strikes, CHEMIST solved, word 3 with D, P and H shown; E and R missed."""
    pal = palette(look)
    light(look)
    ground(pal["ground"])
    for i in range(12):
        x = 62 + i * 24.3
        if i < 2:
            disc(x, 110, 10, 3, pal["red"], bevel=1)
            cross_icon(pal["ink"], x, 110, 3.4, r=3.8, t=0.9)
        else:
            disc(x, 110, 10, 1.5, pal["tile_dim"], bevel=0.6)
            ring(x, 110, 10, 8.6, 2.2, pal["tile"])
    text("WORD 2/5", 18, 141, 8, pal["label"], align="LEFT", depth=0.3)
    for i in range(4):
        disc(94 + i * 10, 141, 3.5, 1.5, pal["gold"] if i == 0 else pal["tile"], bevel=0.4)
    pill(pal, 195, 141, 72, 22, "EARLY +4", kind="gold", size=7.5)
    text("VOWELS", 265, 141, 8, pal["label"], align="LEFT", depth=0.3)
    for i in range(3):
        disc(334 + i * 10, 141, 3.5, 1.5, pal["gold"] if i < 2 else pal["tile"], bevel=0.4)
    pill(pal, 195, 188, 76, 22, "CHEMIST", kind="gold", size=8)
    tray(pal, 195, 257, 374, 86, r=14)
    for i, ch in enumerate(["D", "", "", "P", "H", "", ""]):
        x = 42 + i * 51
        if ch:
            tile(pal, x, 257, 46, ch, z=4, sh=70, size=20)
        else:
            well(pal, x, 257, 46, sh=70, z=4)
    pill(pal, 118, 354, 68, 22, "Found", "0", size=7.5, vcol=pal["blue_text"])
    pill(pal, 195, 354, 72, 22, "Missed", "2", size=7.5, vcol=pal["red"])
    pill(pal, 272, 354, 66, 22, "To go", "4", size=7.5, vcol=pal["ink"])
    specials = {"E": "red", "R": "red", "D": "dim", "H": "dim", "P": "dim"}
    keyboard(pal, 375, ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"], specials, offs=[14, 32, 69], pitch=[36.2, 36.2, 35])
    rbox(40, 515, 52, 46, 7, pal["tile"], r=6, bevel=2.2)
    prism([(-10, 0), (-4, -6), (9, -6), (9, 6), (-4, 6)], 1.2, pal["ink"], z=7, cx=40, cy=515, bevel=0.3)
    rbox(345, 515, 62, 50, 8, pal["gold"], r=7, bevel=2.5)
    text("SOLVE", 345, 515.5, 9, pal["gold_ink"], z=8, depth=0.4)
    finish(look)


def codeword(look):
    """Cryptogrid: the 7 x 7 codeword with six numbers cracked, number 9 picked; the strip and the pad."""
    pal = palette(look)
    light(look)
    ground(pal["ground"])
    grid = [
        ["1W", "7E", "9D", "#", "#", "9D", "#"],
        ["2A", "5", "7E", "#", "12", "14", "7E"],
        ["14", "7E", "3", "2A", "6", "7E", "#"],
        ["#", "15", "10O", "14", "13P", "8", "#"],
        ["#", "4", "11", "6", "10O", "8", "11"],
        ["2A", "11", "7E", "#", "8", "7E", "2A"],
        ["#", "7E", "#", "#", "7E", "14", "14"],
    ]
    x0, y0, p = 12, 95, 52.3
    rbox(195, 278, 370, 372, 2, pal["well"], r=10, bevel=0.6)
    tint = mat("w_goldtint" + look, hexc("#4A3A1A"), rough=0.3, coat=0.8)
    for r, row in enumerate(grid):
        for c, cell in enumerate(row):
            x, y = x0 + c * p + p / 2, y0 + r * p + p / 2
            if cell == "#":
                continue
            num = "".join(ch for ch in cell if ch.isdigit())
            let = "".join(ch for ch in cell if ch.isalpha())
            rbox(x, y, 49, 49, 8, tint if num == "9" else pal["tile"], r=6, bevel=2)
            if num == "9":
                outline(x, y, 51, 51, 7, 2.2, 8.6, pal["gold"])
            text(num, x - 20, y - 15, 7.5, pal["label"], z=8, depth=0.3, align="LEFT")
            if let:
                text(let, x, y + 4, 17, pal["gold_text"], z=8, depth=0.5)
    letters = {1: "W", 2: "A", 7: "E", 9: "D", 10: "O", 13: "P"}
    for i in range(15):
        x, n = 26 + i * 24.2, i + 1
        rbox(x, 497, 21, 34, 4, pal["tile_dim"], r=4, bevel=1)
        if n == 9:
            outline(x, 497, 24, 37, 5, 2, 5, pal["gold"])
        text(str(n), x, 487, 6, pal["label"], z=4, depth=0.2)
        text(letters.get(n, "·"), x, 504, 9, pal["gold_text"] if n in letters else pal["ink_dim"], z=4, depth=0.3)
    specials = {"W": "dim", "E": "dim", "A": "dim", "D": "dim", "O": "dim", "P": "dim"}
    keyboard(pal, 553, ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"], specials, offs=[14, 32, 89], pitch=[36.2, 36.2, 32.6],
             kh=44, row_gap=53.5)
    rbox(48, 684, 72, 46, 6, pal["navy_btn"], r=7, bevel=2)
    text("CLEAR", 48, 684.5, 9, pal["blue_text"], z=6, depth=0.3)
    rbox(345, 684, 62, 46, 7, pal["tile"], r=7, bevel=2.2)
    text("NEXT", 345, 684.5, 9, pal["ink"], z=7, depth=0.3)
    finish(look)


def swapword(look):
    """Swapword: the figure-eight of 21 tiles mid-solve, R picked; gold, teal and plain tiles."""
    pal = palette(look)
    light(look)
    ground(pal["ground"])
    cols = [40, 102, 164, 226, 288, 350]
    rows_y = [167, 229, 291, 354, 416, 479]
    tiles_ = [
        (0, 0, "P", "plain"), (1, 0, "R", "goldring"), (2, 0, "A", "plain"), (3, 0, "N", "plain"),
        (0, 1, "I", "teal"), (3, 1, "O", "plain"),
        (0, 2, "S", "plain"), (3, 2, "O", "plain"), (5, 2, "A", "plain"),
        (0, 3, "S", "plain"), (1, 3, "I", "plain"), (2, 3, "U", "gold"), (3, 3, "B", "plain"), (4, 3, "E", "teal"),
        (5, 3, "L", "gold"),
        (3, 4, "A", "gold"), (5, 4, "U", "gold"),
        (2, 5, "S", "plain"), (3, 5, "G", "teal"), (4, 5, "M", "plain"), (5, 5, "L", "teal"),
    ]
    rbox(195, 323, 380, 400, 3, pal["tray"], r=18, bevel=1)
    for c, r, ch, st in tiles_:
        tile(pal, cols[c], rows_y[r], 55, ch, st, z=3, size=22)
    pill(pal, 118, 113, 170, 34, "22 SWAPS LEFT", kind="goldline", size=9)
    pill(pal, 285, 113, 144, 30, "1 USED · PAR 11", size=8.5)
    for x, col, lab in ((37, pal["gold"], "4 IN PLACE"), (155, pal["teal"], "4 ELSEWHERE"),
                        (275, pal["tile"], "13 NEITHER")):
        disc(x, 531, 5, 2, col, bevel=0.6)
        text(lab, x + 11, 531.5, 8, pal["label"], align="LEFT", depth=0.3)
    finish(look)
