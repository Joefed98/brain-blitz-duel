"""Curl Champ (curling, curlRev 4): the sheet from the hack end, the far house with three red stones and two of yours,
your eighth stone travelling, the crowd behind the boards, the house view top right, the power bar right, and
In / Out / Throw.  A: today's bright ice, blue and red house, dark arena with cyan board lights, made real.
B: bolder, a darkened arena with pools of light down the sheet, glossy pebbled ice and a warm haze."""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(__file__))
from kit import *

TEE_FAR = 34.75
SW = 4.75
STONES = [("red", 0.35, TEE_FAR + 0.55), ("red", -0.62, TEE_FAR - 0.15), ("red", 0.05, TEE_FAR + 1.15),
          ("yel", -0.12, TEE_FAR + 0.12), ("yel", 0.9, TEE_FAR - 0.9), ("yel", 0.08, 17.5)]


def stone(look, kind, x, y, rot=0.0):
    gran = noisy("granite", (70, 72, 78), (138, 140, 146), scale=60, rough=0.35, bump=0.15, coat=0.4) \
        if look == "A" else noisy("granite-b", (40, 42, 48), (120, 122, 130), scale=70, rough=0.25, bump=0.2, coat=0.8)
    band = mat("band", (36, 36, 40), rough=0.4)
    top = mat("top-" + kind, (204, 30, 40) if kind == "red" else (238, 190, 40), rough=0.3, coat=0.8)
    r = 0.145
    body = cyl("st", r, 0.09, gran, loc=(x, y, 0.06), verts=64, bevel=0.035)
    cyl("st-band", r * 1.005, 0.02, band, loc=(x, y, 0.065), verts=64)
    cyl("st-top", r * 0.78, 0.012, top, loc=(x, y, 0.108), verts=64, bevel=0.004)
    # handle: a curved bar on two posts
    h = rbox("handle", 0.05, 0.17, 0.035, r=0.016, mat_=top, loc=(x, y + 0.01, 0.15), rot=(0, 0, rot))
    rbox("post", 0.03, 0.03, 0.05, r=0.012, mat_=top, loc=(x, y - 0.05, 0.125), rot=(0, 0, rot))


def build_scene(look):
    reset(samples=128 if look == "A" else 160, view="AgX", look="AgX - Punchy", exposure=0.0 if look == "A" else -0.2)
    # ice: pebbled, faint blue, glossy
    ice = noisy("ice", (226, 234, 242), (246, 249, 252), scale=900, rough=0.3 if look == "A" else 0.06, bump=0.03, coat=0.0 if look == "A" else 0.5)
    plate("ice", SW, 46, 0.1, 0, mat_=ice, loc=(0, 17, -0.1))
    # house rings at both ends (thin inlays under the ice surface)
    blue = mat("hblue", (24, 82, 196), rough=0.25, coat=0.6)
    red = mat("hred", (206, 28, 40), rough=0.25, coat=0.6)
    white = mat("hwhite", (246, 248, 250), rough=0.25, coat=0.6)
    for ty in (0.0, TEE_FAR):
        for (rr, m, z) in ((1.83, blue, 0.001), (1.22, white, 0.002), (0.61, red, 0.003), (0.15, white, 0.004)):
            cyl("ring", rr, 0.002, m, loc=(0, ty, z), verts=128)
    # lines: hog (red, thick), tee and centre (thin dark)
    line_r = mat("lred", (200, 26, 36), rough=0.3)
    line_d = mat("ldark", (40, 50, 70), rough=0.4)
    for y in (6.4, TEE_FAR - 6.4):
        plate("hog", SW, 0.10, 0.003, 0, mat_=line_r, loc=(0, y, 0.0))
    for y in (0.0, TEE_FAR):
        plate("tee", SW, 0.012, 0.004, 0, mat_=line_d, loc=(0, y, 0.0))
    plate("centre", 0.012, 46, 0.004, 0, mat_=line_d, loc=(0, 17, 0.0))
    # boards with cyan light strips
    board = mat("board", (12, 18, 30), rough=0.35, coat=0.6)
    strip = emission("cyan", (40, 220, 255), 6.0 if look == "A" else 10.0)
    for s in (-1, 1):
        rbox("board", 0.12, 46, 0.22, r=0.02, mat_=board, loc=(s * (SW / 2 + 0.06), 17, 0.11))
        rbox("strip", 0.025, 46, 0.012, r=0.004, mat_=strip, loc=(s * (SW / 2 + 0.002), 17, 0.21))
    # far end: back board, then tiered stands with a stylised crowd
    rbox("back", SW + 2, 0.15, 0.6, r=0.03, mat_=board, loc=(0, 39.0, 0.3))
    rbox("backstrip", SW + 2, 0.02, 0.02, mat_=strip, loc=(0, 38.92, 0.58))
    random.seed(7)
    tier = mat("tier", (30, 32, 44), rough=0.7)
    palette = [(200, 60, 60), (240, 240, 240), (40, 90, 200), (240, 190, 50), (60, 60, 70), (90, 160, 220),
               (220, 120, 60), (30, 30, 36), (150, 40, 60)]
    mats = [mat(f"crowd{i}", c, rough=0.7) for i, c in enumerate(palette)]
    skin = [mat(f"skn{i}", c, rough=0.6) for i, c in enumerate([(224, 182, 150), (176, 124, 92), (110, 74, 52), (236, 200, 170)])]
    for row in range(8):
        y = 40.0 + row * 0.9
        z = 0.6 + row * 0.55
        rbox("tier", 22, 0.9, 0.55, mat_=tier, loc=(0, y, z - 0.27))
        for i in range(44):
            x = -10.5 + i * 0.48 + random.uniform(-0.08, 0.08)
            if random.random() < 0.1:
                continue
            m = random.choice(mats)
            rbox("torso", 0.34, 0.24, 0.42, r=0.1, mat_=m, loc=(x, y, z + 0.21))
            sphere("hd", 0.11, random.choice(skin), loc=(x, y, z + 0.52), seg=16)
    # stones
    for kind, x, y in STONES:
        stone(look, kind, x, y, rot=random.uniform(-0.6, 0.6))
    # sweep marks ahead of the travelling stone (B only: the bend has a cause)
    if look == "B":
        for i in range(6):
            plate("sweep", 0.5, 0.05, 0.001, 0.02, mat_=mat("sweepm", (255, 255, 255), rough=0.05, coat=1.0),
                  loc=(0.18 - i * 0.02, 18.3 + i * 0.35, 0.0005), rot=(0, 0, 0.1))
    # lights
    if look == "A":
        world_color((10, 14, 22), 0.6)
        for y in (2, 12, 22, 32):
            area((0, y, 9), (0, y, 0), size=10, size_y=10, energy=1300, color=(244, 248, 255))
        area((0, 44, 10), (0, 40, 2), size=12, energy=1600, color=(255, 244, 230))
    else:
        world_color((4, 6, 12), 0.3)
        for y in (0.0, 8.5, 17, 25.5, TEE_FAR):
            ld = bpy.data.lights.new("spot", "SPOT")
            ld.energy = 3000
            ld.spot_size = math.radians(100)
            ld.spot_blend = 0.9
            ld.shadow_soft_size = 0.6
            ld.color = lin((255, 238, 214))[:3]
            o = link(bpy.data.objects.new("spot", ld))
            o.location = (0, y, 7)
        area((0, 44, 10), (0, 40, 2), size=12, energy=500, color=(120, 160, 255))
        area((-12, 30, 3), (0, 30, 0), size=6, energy=300, color=(60, 200, 255))


def ui(im, look, inset):
    """App chrome over the render: the stone pill, the house view, the power bar, In / Out / Throw."""
    from PIL import ImageDraw, Image
    w, h = im.size
    k = h / H
    d = ImageDraw.Draw(im, "RGBA")
    # house view (rendered top-down, framed)
    x0, y0, x1, y1 = 262 * k, 70 * k, 381 * k, 190 * k
    iw, ih = int(x1 - x0), int(y1 - y0)
    ins = Image.open(inset).convert("RGB").resize((iw, ih), Image.LANCZOS)
    mask = Image.new("L", (iw, ih), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, iw - 1, ih - 1], radius=int(12 * k), fill=255)
    im.paste(ins, (int(x0), int(y0)), mask)
    d.rounded_rectangle([x0, y0, x1, y1], radius=12 * k, outline=(255, 255, 255, 200), width=max(1, int(2 * k)))
    # stone pill and brush meter
    f = font(800, int(15 * k))
    d.rounded_rectangle([10 * k, 70 * k, 120 * k, 98 * k], radius=14 * k, fill=(8, 11, 22, 220), outline=(226, 192, 122, 255), width=max(1, int(2 * k)))
    d.text((65 * k, 84 * k), "STONE 8/8", font=f, fill=(245, 245, 247), anchor="mm")
    d.rounded_rectangle([10 * k, 104 * k, 132 * k, 122 * k], radius=9 * k, fill=(8, 11, 22, 200))
    d.text((20 * k, 113 * k), "BRUSH", font=font(800, int(10 * k)), fill=(220, 224, 236), anchor="lm")
    d.rounded_rectangle([68 * k, 110 * k, 124 * k, 116 * k], radius=3 * k, fill=(60, 66, 84))
    d.rounded_rectangle([68 * k, 110 * k, 100 * k, 116 * k], radius=3 * k, fill=(40, 220, 255) if look == "B" else (180, 200, 230))
    # power bar
    bx0, by0, bx1, by1 = 356 * k, 228 * k, 380 * k, 534 * k
    d.rounded_rectangle([bx0, by0, bx1, by1], radius=8 * k, fill=(10, 14, 26, 230), outline=(80, 90, 120, 255), width=max(1, int(1 * k)))
    d.rounded_rectangle([bx0 + 3 * k, 410 * k, bx1 - 3 * k, 466 * k], radius=4 * k, outline=(226, 192, 122, 255), width=max(1, int(2 * k)), fill=(226, 192, 122, 60))
    d.rounded_rectangle([bx0 + 3 * k, 438 * k, bx1 - 3 * k, by1 - 3 * k], radius=5 * k, fill=(226, 192, 122, 150))
    d.rounded_rectangle([bx0 - 4 * k, 434 * k, bx1 + 4 * k, 442 * k], radius=3 * k, fill=(250, 246, 236))
    d.rounded_rectangle([302 * k, 426 * k, 348 * k, 446 * k], radius=10 * k, fill=(8, 11, 22, 220))
    d.text((325 * k, 436 * k), "HOUSE", font=font(800, int(9 * k)), fill=(245, 245, 247), anchor="mm")
    d.text((368 * k, 218 * k), "POWER", font=font(800, int(9 * k)), fill=(245, 245, 247), anchor="mm")
    # In / Out / Throw
    fb = font(800, int(15 * k))
    for i, (lab, on) in enumerate((("In", True), ("Out", False), ("Throw", False))):
        x = 10 + i * 124
        fill = (14, 20, 38, 235) if on else (44, 52, 72, 225)
        d.rounded_rectangle([x * k, 642 * k, (x + 116) * k, 682 * k], radius=12 * k, fill=fill,
                            outline=(226, 192, 122, 255) if on else (110, 120, 150, 200), width=max(1, int(2 * k)))
        d.text(((x + 58) * k, 662 * k), lab, font=fb, fill=(245, 245, 247) if lab != "Throw" else (200, 206, 220), anchor="mm")
    return im


def build(look):
    build_scene(look)
    cam = cam_look((0.0, -17.0, 6.2), (0.0, 22.0, -0.7), lens=66)
    return cam


def main():
    looks = sys.argv[1:] or ["A", "B"]
    for look in looks:
        build(look)
        png = os.path.join(TEX, f"curling-{look}.png")
        render_to(png)
        # the house view: same scene, an orthographic camera over the far house
        s = bpy.context.scene
        rx, ry = s.render.resolution_x, s.render.resolution_y
        s.render.resolution_x, s.render.resolution_y = 300, 300
        cd = bpy.data.cameras.new("hcam")
        cd.type = "ORTHO"
        cd.ortho_scale = 4.4
        hc = link(bpy.data.objects.new("hcam", cd))
        hc.location = (0, TEE_FAR, 10)
        s.camera = hc
        ins = os.path.join(TEX, f"curling-inset-{look}.png")
        render_to(ins)
        finish(png, "sports", "curling", look,
               post=lambda im, l=look, i=ins: (vignette(0.6, 1.8)(ui(im, l, i)) if l == "B" else ui(im, l, i)))


main()
