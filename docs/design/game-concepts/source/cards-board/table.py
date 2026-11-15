"""The blue card table shared by Free Cell, Summit, Thirteen and Five Hands (today: a royal-blue felt that falls off
to navy at the edges, a dashed panel outline, white cards, gold HUD highlights).

Look A "Today, upgraded": the same blue baize under a soft pool of light, a stitched panel seam where today's dashed
outline is, white linen-finish cards.  Look B "Bolder": deeper sapphire velvet, one dramatic key light and a dark
vignette, the panel seam as a gold inlay, cards with gilt edges."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from lib import *


def table(look, panel=(6, 64, 384, 836), panel2=None):
    if look == "A":
        reset(samples=128, view="Standard", exposure=-0.1)
        ground(felt("baize", (34, 74, 150), scale=650, sheen=0.5))
        # one broad overhead softbox from the top left, a cool fill; the felt falls off naturally to the edges
        area(P(60, 200, 12), P(195, 430, 0), size=7, energy=380, color=(255, 244, 228), spread=75)
        area(P(380, 760, 9), P(195, 430, 0), size=9, energy=70, color=(206, 222, 255))
        seam_m = mat("seam", (18, 40, 92), rough=0.8)
        stitch = mat("stitch", (120, 150, 210), rough=0.7)
    else:
        reset(samples=128, view="Standard", exposure=-0.15)
        ground(felt("velvet", (16, 40, 110), scale=900, sheen=1.0, bump=0.5))
        area(P(-20, 120, 10), P(195, 400, 0), size=3.0, energy=230, color=(255, 238, 214), spread=45)
        area(P(195, 980, 6), P(195, 500, 0), size=8, energy=40, color=(120, 160, 255))
        seam_m = gold("inlay", CHAMP, rough=0.22)
        stitch = None
    x0, y0, x1, y1 = panel
    _seam(look, x0, y0, x1, y1, seam_m, stitch)
    if panel2:
        _seam(look, *panel2, seam_m, stitch)
    cam_top(ortho=False, lens=180, tilt=3)


def _seam(look, x0, y0, x1, y1, m, stitch):
    w, h = x1 - x0, y1 - y0
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    t = 1.2 if look == "A" else 1.4
    for (x, y, ww, hh) in ((cx, y0, w, t), (cx, y1, w, t), (x0, cy, t, h), (x1, cy, t, h)):
        rbox("seam", u(ww), u(hh), u(0.25 if look == "A" else 0.5), r=u(0.3), mat_=m, loc=P(x, y, 0.0))
    if stitch:
        # running stitches just inside the seam (today's dashed outline, made of thread)
        n = 0
        for i in range(int(w / 7)):
            for yy in (y0 + 4, y1 - 4):
                rbox("st", u(3.6), u(0.9), u(0.4), r=u(0.4), mat_=stitch, loc=P(x0 + 6 + i * 7, yy, 0.0))
        for i in range(int(h / 7)):
            for xx in (x0 + 4, x1 - 4):
                rbox("st", u(0.9), u(3.6), u(0.4), r=u(0.4), mat_=stitch, loc=P(xx, y0 + 6 + i * 7, 0.0))


def slot(look, x, y, w, h, label_suit=None):
    """An empty card place: A a shallow pressed outline in the felt, B a thin gold frame."""
    if look == "A":
        rim = mat("slot-rim", (140, 170, 230), rough=0.6)
        frame(x, y, w + 3, h + 3, 0.9, rim, z=0.2)
        plate("slotin", u(w), u(h), u(0.3), u(5), mat_=felt("slot-felt", (24, 54, 118)), loc=P(x, y, 0.0))
    else:
        frame(x, y, w + 3, h + 3, 1.1, gold("slot-gold", CHAMP, 0.2), z=0.4)
        plate("slotin", u(w), u(h), u(0.3), u(5), mat_=felt("slot-v", (14, 32, 80)), loc=P(x, y, 0.0))
    if label_suit:
        from lib import pil
        Image, ImageDraw, _, _ = pil()
        path = os.path.join(TEX, f"home-{look}-{label_suit}.png")
        im = Image.new("RGBA", (200, 300), (0, 0, 0, 0))
        dd = ImageDraw.Draw(im)
        c = (150, 178, 232, 200) if look == "A" else (226, 192, 122, 255)
        suit_poly(dd, 100, 150, 110, label_suit, c)
        im.save(path)
        m = textured(f"home-{look}-{label_suit}", path, rough=0.4, metal=0.0 if look == "A" else 1.0, alpha=True)
        o = plate("homemark", u(w - 8), u(h - 8), u(0.45), 0, mat_=m, loc=P(x, y, 0.0))
        uv_top(o)


def frame(x, y, w, h, t, m, z=0.0, r=6):
    """A rounded-rectangle outline (a ring of width t px)."""
    outer = plate("fo", u(w), u(h), u(0.5), u(r), mat_=m, loc=P(x, y, u(z)))
    inner = plate("fi", u(w - 2 * t), u(h - 2 * t), u(3), u(max(1, r - t)), loc=P(x, y, u(z) - u(1)))
    b = outer.modifiers.new("cut", "BOOLEAN")
    b.object = inner
    b.operation = "DIFFERENCE"
    inner.hide_render = True
    inner.hide_viewport = True
    return outer


def deal_card(look, rank, suit, x, y, w, h, z=0.0, face_up=True, lift=0.0, rot=0.0, glow=False):
    edge = None
    if look == "B":
        edge = bpy.data.materials.get("gilt") or gold("gilt", (222, 184, 104), rough=0.25)
    o = card(rank, suit, x, y, w, h, style="real", z=z, face_up=face_up, lift=lift, rot=rot, stock_mat=edge,
             back_style="blue-" + look)
    if glow:
        g = emission("sel", (255, 210, 120), 3.0)
        frame(x, y, w + 6, h + 6, 2.0, g, z=z * 100 + lift * 100 - 0.2)
    return o
