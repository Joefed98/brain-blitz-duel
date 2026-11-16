"""Shared stages, palettes and buttons.

Joe's direction (15 Nov 2026): every concept keeps the game as it is today (layout, colours, pieces, character).
  A "Today, upgraded": today's look rendered to the full standard: real materials, light, depth, detail.
  B "Bolder": the same game and colours pushed further: richer materials, more atmosphere, more drama.
  C (flagships only): the best idea, still rooted in today's colours and style.
"""
import math
from jzlib import *

# today's category screens: a dark gradient tinted with the category colour
CAT = {
    "logic":   dict(top="#0a6658", bot="#021614", accent="#2ED3B7", panel="#0a1615", cell="#152321", cell2="#1b2d2a"),
    "number":  dict(top="#0a6a30", bot="#02160a", accent="#3DDC84", panel="#0a150e", cell="#14231a", cell2="#1a2d21"),
    "pattern": dict(top="#4a1a8a", bot="#0c0418", accent="#B26BFF", panel="#120c1c", cell="#1c1528", cell2="#241b33"),
}
GOLD = "#f2c14e"      # today's gold digits and highlights
WHITE = "#f3f2ee"

def stage(cat, bold=False, key=1.0, hdri="studio.exr"):
    c = CAT[cat]
    world("#020304", 0.3, hdri, 0.22 if not bold else 0.16)
    bg = gradient_bg(f"bg_{cat}_{bold}", c["top"], c["bot"], 0.45 if not bold else 0.92, noise=0.0)
    backdrop(bg)
    if not bold:
        area(-260, -260, 900, 700, 3400 * key, "#fff3e2", sx=900, sy=500)
        area(760, 520, 520, 600, 600 * key, "#d6e6ff")
        area(195, 1500, 260, 800, 400 * key, "#ffffff", sx=1200, sy=200)
    else:
        # drama: a tighter, brighter key, a coloured rim in the category accent and a light pool behind the board
        area(-220, -160, 820, 500, 1500 * key, "#fff0dc", sx=520, sy=380)
        sp = spot(60, 120, 900, 6000 * key, "#fff1dc", target=(195, 430, 0), angle=50, blend=0.9, radius=260)
        sp.visible_glossy = False
        area(560, 980, 140, 700, 700 * key, c["accent"], sx=900, sy=160)
        area(-170, 520, 140, 700, 350 * key, c["accent"], sx=160, sy=900)
        # (a volumetric haze washed the colours out at this scale, so B's drama comes from the vignette and glow)

def haze(cat, density=0.0035):
    """A faint volumetric haze so light reads in the air (look B only)."""
    m = bpy.data.materials.new("haze"); m.use_nodes = True
    n = m.node_tree.nodes; l = m.node_tree.links
    n.remove(n["Principled BSDF"])
    vs = n.new("ShaderNodeVolumeScatter"); vs.inputs["Density"].default_value = density; vs.inputs["Anisotropy"].default_value = 0.4
    l.new(vs.outputs[0], n["Material Output"].inputs["Volume"])
    ob = box(-60, -60, W + 120, H + 120, 120, m, r=0, z=-1)
    ob.visible_shadow = False
    return ob

def panel(cat, x, y, w, h, bold=False, d=8, r=16, z=0.0):
    """Today's board panel: a dark rounded slab; A smoked glass over lacquer, B with a glowing accent edge."""
    c = CAT[cat]
    box(x, y, w, h, d, mat(f"panel_{cat}", c["panel"], 0.35, coat=0.5, coat_rough=0.18), r=r, z=z)
    edge = mat(f"pedge_{cat}_{bold}", c["accent"], 0.3, metal=0.6, emit=c["accent"] if bold else None, emit_strength=1.2 if bold else 0)
    if not bold:
        edge = mat(f"pedgeA_{cat}", "#9aa7a4", 0.25, metal=1.0)
    box(x - 1.2, y - 1.2, w + 2.4, h + 2.4, d - 0.6, edge, r=r + 1, z=z - 0.2)

def cellm(cat, which="cell", bold=False):
    c = CAT[cat]
    return mat(f"{which}_{cat}_{bold}", c[which], 0.32 if not bold else 0.22, coat=0.7, coat_rough=0.05)

def T(color, glow=0.35, name=None):
    """A numeral or label colour (today's white, gold or accent)."""
    return ink(name or f"t_{color}_{glow}", color, 0.35, glow=glow)

def accent_m(cat, glow=0.8):
    return mat(f"acc_{cat}_{glow}", CAT[cat]["accent"], 0.25, metal=0.2, coat=0.6, emit=CAT[cat]["accent"], emit_strength=glow)

def gold_m(bold=False, name=None):
    return mat(name or f"gold_{bold}", GOLD, 0.2, metal=1.0, emit="#a8781c", emit_strength=0.5 if bold else 0.25)

def btn(cat, x, y, w, h, label, kind="outline", bold=False, size=15, fnt="sans6"):
    """Today's buttons: dark with an accent outline (undo, reset, pencil), gold primary (TRY, NEXT), plain dark keys."""
    c = CAT[cat]
    if kind == "gold":
        box(x, y, w, h, 8, mat(f"btn_gold_{bold}", GOLD, 0.28, metal=0.7, coat=0.6, emit="#8a5c10", emit_strength=0.3 if bold else 0.12), r=12)
        text(x + w / 2, y + h / 2, label, size, ink("ongold", "#1a1206", 0.5), z=8, fnt=fnt)
    elif kind == "outline":
        box(x, y, w, h, 6, mat(f"btn_dark_{cat}", c["panel"], 0.3, coat=0.8), r=10)
        box(x - 1.3, y - 1.3, w + 2.6, h + 2.6, 5.6, accent_m(cat, 1.2 if bold else 0.5), r=11, z=-0.2)
        text(x + w / 2, y + h / 2, label, size, T(c["accent"], 0.9 if bold else 0.5), z=6, fnt=fnt)
    elif kind == "accent":
        box(x, y, w, h, 7, mat(f"btn_acc_{cat}_{bold}", c["accent"], 0.3, coat=0.8, emit=c["accent"], emit_strength=0.5 if bold else 0.2), r=10)
        text(x + w / 2, y + h / 2, label, size, ink("onacc", "#06120f", 0.5), z=7, fnt=fnt)
    else:  # key
        box(x, y, w, h, 7, mat(f"key_{cat}", "#1c2422" if cat != "pattern" else "#211a2c", 0.3, coat=0.8), r=9)
        text(x + w / 2, y + h / 2, label, size, T(WHITE, 0.3), z=7, fnt=fnt)

UNDO, REDO = "↶", "↻"
def undo_redo(cat, xs, y=779, w=82, h=44, bold=False):
    for i, x in enumerate(xs):
        btn(cat, x, y, w, h, (UNDO, REDO)[i % 2], "outline", bold, size=20, fnt="sym")

def pills(cat, cx, y, items, bold=False):
    """Today's HUD pills under a board: label and value."""
    widths = [len(a) * 6.2 + len(b) * 7.5 + 22 for a, b in items]
    x = cx - (sum(widths) + 6 * (len(items) - 1)) / 2
    for (a, b), w in zip(items, widths):
        box(x, y - 10, w, 20, 2, mat(f"pill_{cat}", "#0d1312" if cat != "pattern" else "#120e19", 0.4), r=10, z=0.5)
        text(x + 10, y, a, 10, T("#b8c0be", 0.25), z=2.5, fnt="sans6", align="LEFT")
        text(x + w - 10, y, b, 10.5, T(WHITE, 0.4), z=2.5, fnt="sans", align="RIGHT")
        x += w + 6

def grid(cols, rows):
    for r in range(rows):
        for c in range(cols):
            yield r, c

PIECE = dict(red="#e8414a", orange="#f08a2a", yellow="#f2cc2a", green="#3cc46a", teal="#2fcfb6", blue="#3f7cf0",
             purple="#9a5cf0", pink="#f063b8", brown="#9a5a34", white="#f1efe9", grey="#9aa0a6")


def outline(x, y, w, h, r, m, z=2.0, rad=1.6):
    """A rounded-rectangle line (selection rings)."""
    pts = []
    for (cx, cy, a0) in ((x + w - r, y + r, -90), (x + w - r, y + h - r, 0), (x + r, y + h - r, 90), (x + r, y + r, 180)):
        for k in range(7):
            a = math.radians(a0 + k * 15)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return tube(pts, rad, m, z=z, closed=True, round_caps=False)

def test_tube(x, ytop, length, r, m, z):
    """A test tube: a straight glass body with a round bottom."""
    ycyl(x, ytop, length - r, r, m, z=z, bevel=1.0)
    s = sphere(x, ytop + length - r, r, m, z=z)
    return s


def cam(bold, tilt=6):
    """A looks straight on with a slight tilt; B leans in further with a wider lens for drama."""
    camera(tilt=tilt + (9 if bold else 0), lens=85 if not bold else 70)
