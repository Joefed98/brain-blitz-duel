"""Mahjong Solitaire (mahjong, mahjongRev 2): 72 tiles in four layers on a green mat in a wooden surround.
Mid-play: about half the stack taken, a free tile selected."""
import os, sys, random
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from lib import *

TW, TH, TD = 44, 58, 9   # tile in px (face) and thickness


def face(kind, n, look):
    Image, ImageDraw, ImageFont, _ = pil()
    path = os.path.join(TEX, f"mj-{look}-{kind}{n}.png")
    if os.path.exists(path):
        return path
    w, h = 360, 480
    ivory = (246, 240, 224) if look == "A" else (244, 236, 216)
    im = Image.new("RGBA", (w, h), ivory + (255,))
    d = ImageDraw.Draw(im)
    red, green, blue = (196, 36, 40), (24, 128, 74), (30, 82, 168)
    if kind == "dot":
        layouts = {1: [(0.5, 0.5)], 2: [(0.5, 0.28), (0.5, 0.72)], 3: [(0.25, 0.22), (0.5, 0.5), (0.75, 0.78)],
                   4: [(0.3, 0.3), (0.7, 0.3), (0.3, 0.7), (0.7, 0.7)],
                   5: [(0.28, 0.25), (0.72, 0.25), (0.5, 0.5), (0.28, 0.75), (0.72, 0.75)],
                   6: [(0.3, 0.22), (0.7, 0.22), (0.3, 0.52), (0.7, 0.52), (0.3, 0.8), (0.7, 0.8)]}
        cols = [blue, green, red]
        rr = 70 if n == 1 else (52 if n <= 4 else 40)
        for i, (x, y) in enumerate(layouts[n]):
            c = cols[(i + n) % 3]
            cx, cy = x * w, y * h
            d.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], outline=c, width=12)
            d.ellipse([cx - rr * 0.45, cy - rr * 0.45, cx + rr * 0.45, cy + rr * 0.45], fill=c)
    elif kind == "bam":
        rows = {2: [[0.5], [0.5]], 3: [[0.5], [0.3, 0.7]], 4: [[0.3, 0.7], [0.3, 0.7]], 5: [[0.25, 0.75], [0.5], [0.25, 0.75]],
                6: [[0.2, 0.5, 0.8], [0.2, 0.5, 0.8]]}[n]
        nh = len(rows)
        for ri, row in enumerate(rows):
            cy = h * (ri + 0.5) / nh
            for x in row:
                c = red if (n == 5 and ri == 1) else green
                bx = x * w
                d.rounded_rectangle([bx - 17, cy - h * 0.38 / nh * 1.9 / 2 * 1.0, bx + 17, cy + h * 0.38 / nh * 1.9 / 2], radius=16, fill=c)
                d.line([bx - 17, cy, bx + 17, cy], fill=ivory, width=6)
    elif kind == "chr":
        f = ImageFont.truetype("/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc", 150)
        nums = "一二三四五六七八九"
        d.text((w / 2, h * 0.3), nums[n - 1], font=f, fill=(20, 20, 26), anchor="mm")
        d.text((w / 2, h * 0.7), "萬", font=f, fill=red, anchor="mm")
    elif kind == "dragon":
        if n == 1:
            d.rounded_rectangle([60, 80, w - 60, h - 80], radius=20, outline=blue, width=18)
            d.rounded_rectangle([110, 130, w - 110, h - 130], radius=12, outline=blue, width=10)
        else:
            f = ImageFont.truetype("/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc", 230)
            d.text((w / 2, h / 2), "中" if n == 2 else "發", font=f, fill=red if n == 2 else green, anchor="mm")
    im.save(path)
    return path


KINDS = [("dot", i) for i in range(1, 7)] + [("bam", i) for i in range(2, 7)] + [("chr", i) for i in (1, 3, 5, 7, 9)] + \
        [("dragon", i) for i in (1, 2, 3)]


def tile(look, kind, n, x, y, layer, sel=False):
    key = f"mjface-{look}-{kind}{n}"
    fm = bpy.data.materials.get(key) or textured(key, face(kind, n, look), rough=0.42, coat=0.15, coat_rough=0.2)
    body = bpy.data.materials.get("mj-body") or (mat("mj-body", (228, 216, 190), rough=0.35, coat=0.3)
                                                  if look == "A" else mat("mj-body", (226, 212, 184), rough=0.3, coat=0.5))
    back = bpy.data.materials.get("mj-back") or (mat("mj-back", (28, 120, 82), rough=0.25, coat=0.6)
                                                  if look == "A" else mat("mj-back", (14, 96, 84), rough=0.2, coat=0.8))
    # layers step up and to the top-left as on today's stack
    ox, oy = -layer * 4.5, -layer * 6.5
    z = layer * (TD + 0.5)
    X, Y = x + ox, y + oy
    rbox("mjback", u(TW - 1), u(TH - 1), u(TD * 0.5), r=u(3.0), mat_=back, loc=P(X, Y, u(z + TD * 0.25)))
    rbox("mjbody", u(TW - 1), u(TH - 1), u(TD * 0.55), r=u(3.0), mat_=body, loc=P(X, Y, u(z + TD * 0.5 + TD * 0.27)))
    bpy.ops.mesh.primitive_plane_add(size=1, location=P(X, Y, u(z + TD * 1.05) + 0.0005))
    o = bpy.context.object
    o.scale = (u(TW - 7), u(TH - 7), 1)
    o.data.materials.append(fm)
    if sel:
        g = emission("mj-sel", (255, 206, 110), 4.0)
        pass
    return o


def build(look):
    reset(samples=128, view="Standard", exposure=-0.2 if look == "A" else -0.2)
    random.seed(7)
    if look == "A":
        ground(wood("surround", (62, 38, 20), (26, 14, 6), scale=1.2, coat=0.15, rough=0.55))
        plate("mat", u(358), u(616), u(1.0), u(14), mat_=felt("mat", (36, 116, 82), scale=700), loc=P(195, 404, 0), edge=u(0.6))
        area(P(-80, 120, 8), P(195, 420, 0), size=6, energy=300, color=(255, 242, 222), spread=75)
        area(P(380, 760, 9), P(195, 420, 0), size=9, energy=70, color=(210, 230, 220))
    else:
        ground(wood("surround", (52, 28, 14), (18, 8, 3), scale=1.2, coat=0.8, rough=0.2))
        plate("mat", u(358), u(616), u(1.0), u(14), mat_=felt("mat", (16, 92, 70), scale=900, sheen=1.0), loc=P(195, 404, 0), edge=u(0.6))
        frame_m = gold("matedge", (214, 176, 100), 0.25)
        plate("matrim", u(364), u(622), u(0.6), u(16), mat_=frame_m, loc=P(195, 404, 0))
        area(P(30, 130, 9), P(195, 380, 0), size=3, energy=170, color=(255, 226, 186), spread=50)
        area(P(195, 980, 6), P(195, 500, 0), size=8, energy=30, color=(150, 220, 200))
    cam_top(ortho=False, lens=160, tilt=12)
    MASKS = [
        ["..xxx..", ".xx.xx.", "xxx.xxx", "x.xxx.x", "xxx.xxx", ".xx.xx.", "..x.x.."],
        ["x.x", ".x.", "x.x"],
        ["x"],
    ]
    cx, cy = 195, 400
    count = 0
    picks = KINDS * 4
    random.shuffle(picks)
    for layer, rows in enumerate(MASKS):
        ny, nx = len(rows), len(rows[0])
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != "x":
                    continue
                x = cx + (i - (nx - 1) / 2) * TW
                y = cy + (j - (ny - 1) / 2) * TH
                k, n = picks[count % len(picks)]
                count += 1
                tile(look, k, n, x, y, layer)
    print("tiles", count)
    post = labels([], then=vignette(0.45) if look == "B" else None)
    return dict(pills=[("Pairs", "18/36", False), ("Free pairs", 4, False)], right_pills=[("Shuffles", 0, False)],
                post=post)


run("cards-board", "mahjong", ["A", "B"], build)
