"""Top Bins (freekick, freekickRev 4): the kick from 22 yards: the ball in its ring with the drawn stroke, a wall of
three (4, 8, 6), the keeper in yellow, the goal and net, LED boards and a full stand behind; the HOLD power bar below.
A: today's red wall, yellow keeper, green stripes and floodlit crowd, made real.  B: bolder, a night match: deep sky,
one hard floodlight bank, glowing LED boards, camera flashes in the stand and a dewy sheen on the grass."""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(__file__))
from kit import *


def ball_tex():
    Image, ImageDraw, _, _ = pil()
    path = os.path.join(TEX, "freekick-ball.png")
    w, h = 1024, 512
    im = Image.new("RGB", (w, h), (246, 246, 244))
    d = ImageDraw.Draw(im)
    rnd = random.Random(3)
    # an even scatter of dark pentagon panels (equirect: stretch with latitude)
    for (u_, v_) in [(0.1, 0.5), (0.3, 0.5), (0.5, 0.5), (0.7, 0.5), (0.9, 0.5), (0.2, 0.22), (0.4, 0.22), (0.6, 0.22),
                     (0.8, 0.22), (0.0, 0.22), (0.2, 0.78), (0.4, 0.78), (0.6, 0.78), (0.8, 0.78), (0.0, 0.78)]:
        cx, cy = u_ * w, v_ * h
        lat = (v_ - 0.5) * math.pi
        sx = 1 / max(0.3, math.cos(lat))
        r = 34
        pts = [(cx + math.cos(a) * r * sx, cy + math.sin(a) * r) for a in [i * 2 * math.pi / 5 - math.pi / 2 for i in range(5)]]
        d.polygon(pts, fill=(28, 28, 32))
    d.rectangle([0, 0, w, 16], fill=(28, 28, 32))
    d.rectangle([0, h - 16, w, h], fill=(28, 28, 32))
    im.save(path)
    return path


def net(name, verts_xyz, nu, nv, m):
    """A rectangular net panel from 4 corners (a grid with a wireframe modifier)."""
    import bmesh as _b
    a, b, c, d_ = [Vector(v) for v in verts_xyz]
    me = bpy.data.meshes.new(name)
    bm = _b.new()
    grid = [[bm.verts.new(a + (b - a) * (i / nu) + ((d_ + (c - d_) * (i / nu)) - (a + (b - a) * (i / nu))) * (j / nv))
             for j in range(nv + 1)] for i in range(nu + 1)]
    for i in range(nu):
        for j in range(nv):
            bm.faces.new([grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]])
    bm.to_mesh(me); bm.free()
    o = link(bpy.data.objects.new(name, me))
    wf = o.modifiers.new("w", "WIREFRAME"); wf.thickness = 0.012
    o.data.materials.append(m)
    return o


def build(look):
    reset(samples=128 if look == "A" else 160, view="AgX", look="AgX - Punchy", exposure=0.0 if look == "A" else -0.1)
    grass = stripes("pitch", (38, 124, 46), (50, 142, 58), band=2.75, axis="Y", fibre=150, sheen=0.0, rough=0.75 if look == "A" else 0.55)
    if look == "B":
        bpy.data.materials["pitch"].node_tree.nodes["Principled BSDF"].inputs["Coat Weight"].default_value = 0.12
    disc("pitch", 120, grass, (0, -20), z=0.0, verts=96)
    line = mat("line", (244, 244, 240), rough=0.7)
    def ln(x0, y0, x1, y1, w=0.12):
        rbox("ln", abs(x1 - x0) or w, abs(y1 - y0) or w, 0.004, mat_=line, loc=((x0 + x1) / 2, (y0 + y1) / 2, 0.002))
    ln(-30, 0, 30, 0)
    ln(-9.16, -5.5, 9.16, -5.5); ln(-9.16, 0, -9.16, -5.5); ln(9.16, 0, 9.16, -5.5)
    ln(-20.16, -16.5, 20.16, -16.5); ln(-20.16, 0, -20.16, -16.5); ln(20.16, 0, 20.16, -16.5)
    cyl("spot", 0.11, 0.004, line, loc=(0, -11, 0.002), verts=24)
    # goal: posts, bar, net
    post = mat("post", (248, 248, 246), rough=0.25, coat=0.6)
    for x in (-3.66, 3.66):
        cyl("post", 0.06, 2.44, post, loc=(x, 0, 1.22), verts=24)
    cyl("bar", 0.06, 7.44, post, loc=(0, 0, 2.44), verts=24, rot=(0, math.radians(90), 0))
    netm = mat("net", (236, 236, 236), rough=0.7)
    net("back", [(-3.66, 2.0, 0), (3.66, 2.0, 0), (3.66, 0.8, 2.44), (-3.66, 0.8, 2.44)], 60, 22, netm)
    net("top", [(-3.66, 0.05, 2.44), (3.66, 0.05, 2.44), (3.66, 0.8, 2.44), (-3.66, 0.8, 2.44)], 60, 6, netm)
    for x in (-3.66, 3.66):
        net("side", [(x, 0.05, 0), (x, 2.0, 0), (x, 0.8, 2.44), (x, 0.05, 2.44)], 16, 22, netm)
    # the gold corner hoop (the bonus target, top right corner)
    torus("hoop", 0.42, 0.03, emission("hoop", (255, 206, 100), 4.0), loc=(3.0, 0.02, 1.95), rot=(math.radians(90), 0, 0))
    # LED boards
    board_c = [(140, 50, 220), (40, 210, 240), (140, 50, 220), (40, 210, 240)]
    for i, c in enumerate(board_c):
        rbox("board", 9.8, 0.2, 0.95, r=0.03, mat_=emission(f"led{i}", c, 2.5 if look == "A" else 6.0), loc=(-15 + i * 10, 5.0, 0.5))
    # stand and crowd
    stand = mat("stand", (24, 26, 36), rough=0.7)
    for k in range(26):
        rbox("tier", 70, 0.8, 0.55, mat_=stand, loc=(0, 7 + k * 0.8, 0.55 + k * 0.55))
    pal = [(170, 36, 46), (200, 200, 200), (170, 36, 46), (36, 52, 110), (60, 60, 70), (40, 40, 48), (30, 30, 36), (150, 150, 156), (70, 110, 170)]
    crowd("crowd", 26, 150, (-32, 7.1, 0.82), (0.8, 0.55), 0.43, 0, pal, seed=4, person=(0.34, 0.28, 0.42), gap=0.08)
    if look == "B":
        rnd = random.Random(9)
        fl = emission("flash", (255, 255, 255), 40)
        for i in range(36):
            k = rnd.randrange(26)
            sphere("flash", 0.06, fl, loc=(rnd.uniform(-30, 30), 6.9 + k * 0.8, 1.45 + k * 0.55), seg=8)
    # wall of three and the keeper
    red = mat("kitred", (196, 30, 40), rough=0.6, sheen=0.3)
    white = mat("kitwhite", (238, 238, 234), rough=0.65, sheen=0.3)
    yel = mat("kityel", (226, 236, 40), rough=0.55, sheen=0.3)
    blk = mat("kitblk", (26, 26, 30), rough=0.6)
    hair = [mat(f"hair{i}", c, rough=0.7) for i, c in enumerate([(40, 26, 18), (20, 16, 14), (140, 96, 50)])]
    for i, (x, n) in enumerate(((-2.1, "4"), (-1.56, "8"), (-1.02, "6"))):
        figure(f"w{i}", (x, -11.0, 0), 1.83, red, shorts_mat=white, sock_mat=red, head_mat=hair[i], face_dir=(0.05, -1), pose="wall")
        text3d(n, 0.28, white, (x, -11.21, 1.27), rot=(math.radians(90), 0, 0), font=800)
    figure("keeper", (0.7, -0.4, 0), 1.9, yel, shorts_mat=blk, sock_mat=yel, head_mat=hair[1], face_dir=(0, -1), pose="keeper")
    # the ball, its ring, and the drawn stroke (curl) out from it
    bm_ = textured("fkball", ball_tex(), rough=0.35, coat=0.5)
    bm_.node_tree.nodes["Image Texture"].extension = "REPEAT"
    b = sphere("ball", 0.11, bm_, loc=(1.0, -20.0, 0.11), seg=48)
    b.rotation_euler = (0.4, 0.3, 0.2)
    torus("ballring", 0.42, 0.012, emission("bring", (255, 255, 255), 1.6), loc=(1.0, -20.0, 0.01))
    stroke = []
    for i in range(25):
        t = i / 24
        x = 1.0 - 0.1 - 1.9 * t
        y = -20.0 + 0.4 + 3.2 * t + 0.6 * math.sin(t * math.pi)
        x += 0.5 * math.sin(t * math.pi)
        stroke.append((x, y, 0.02))
    tube_path("stroke", stroke, 0.045, emission("strokee", (255, 255, 255), 3.0))
    # lights
    if look == "A":
        world_color((14, 20, 40), 0.5)
        sun(rot=(50, 0, 200), energy=2.6, color=(255, 246, 232), angle=6)
        area((0, -30, 25), (0, 0, 0), size=40, energy=4.0e4, color=(230, 236, 255))
        area((0, -5, 30), (0, 15, 8), size=40, energy=3.0e4, color=(255, 244, 226))
    else:
        world_color((3, 5, 14), 0.4)
        area((-30, -30, 30), (0, -10, 0), size=8, energy=1.2e5, color=(255, 248, 236))
        area((30, -5, 25), (0, 10, 6), size=20, energy=2.0e4, color=(140, 170, 255))
    cam = cam_look((0.95, -26.5, 2.9), (-0.9, 0, 0.1), lens=33)
    dof(cam, 16.0, fstop=0.9)
    return dict(pills=[("Kick", "10/10", False), ("Yds", 22, False)], right_pills=[("Score", 193, True)],
                post=lambda im, l=look: ui(im, l))


def ui(im, look):
    from PIL import ImageDraw
    if look == "B":
        im = vignette(0.5, 1.8)(im)
    w, h = im.size
    k = h / H
    d = ImageDraw.Draw(im, "RGBA")
    d.text((195 * k, 694 * k), "DRAW THE SHOT FROM THE BALL", font=font(800, int(12 * k)), fill=(245, 245, 247), anchor="mm")
    d.rounded_rectangle([46 * k, 712 * k, 344 * k, 734 * k], radius=11 * k, fill=(8, 11, 22, 210), outline=(80, 96, 80, 255), width=max(1, int(k)))
    d.rounded_rectangle([248 * k, 715 * k, 272 * k, 731 * k], radius=6 * k, fill=(226, 192, 122, 255))
    d.text((60 * k, 723 * k), "HOLD", font=font(800, int(10 * k)), fill=(200, 210, 200), anchor="lm")
    return im


run("sports", "freekick", ["A", "B"], build)
