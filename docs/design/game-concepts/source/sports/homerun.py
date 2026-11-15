"""Home Run (homerun, homerunRev 4): the batter's-eye view at night: the batter in the foreground, home plate and the
chalked boxes, the pitcher on the mound, six fielders with their catch circles, the outfield wall (334 / 365 / 400 /
365 / 334), the signs and the full stands under the light towers, the pitch arriving inside its closing ring.
A: today's night ballpark (navy batter, red fielders, green wall, gold signs), made real.  B: bolder, a darker sky,
hard white stadium light, rim-lit players and glowing signs."""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(__file__))
from kit import *

WALL_R = 96.0


def build(look):
    reset(samples=128 if look == "A" else 160, view="AgX", look="AgX - Punchy", exposure=0.0 if look == "A" else -0.1)
    grass = stripes("grass", (30, 116, 40), (44, 138, 52), band=4.0, angle=math.radians(45), fibre=200)
    grass2 = stripes("grass2", (34, 122, 44), (48, 142, 56), band=1.6, angle=math.radians(45), fibre=200)
    dirt = noisy("dirt", (150, 96, 60), (178, 120, 78), scale=40, rough=0.95, bump=0.3)
    chalk = mat("chalk", (240, 240, 236), rough=0.8)
    disc("field", 140, grass, (0, 40), z=0.0, verts=160)
    disc("infield-dirt", 29, dirt, (0, 19), z=0.01)
    o = disc("infield-grass", 13.5, grass2, (0, 13.7), z=0.02, verts=4)
    o.rotation_euler = (0, 0, math.radians(45))
    disc("plate-dirt", 4.2, dirt, (0, 0), z=0.03)
    m = sphere("mound", 2.9, dirt, loc=(0, 18.4, -0.9), seg=48)
    m.scale = (1, 1, 0.38)
    rbox("rubber", 0.6, 0.15, 0.04, mat_=chalk, loc=(0, 18.4, 0.22))
    # bases
    for (bx, by) in ((19.4, 19.4), (0, 38.8), (-19.4, 19.4)):
        rbox("base", 0.38, 0.38, 0.08, r=0.02, mat_=chalk, loc=(bx, by, 0.05), rot=(0, 0, math.radians(45)))
    # home plate (pentagon) and the batter's boxes
    me = bpy.data.meshes.new("plate")
    import bmesh as _b
    bm = _b.new()
    pts = [(-0.22, 0.0), (0.22, 0.0), (0.22, 0.22), (0.0, 0.43), (-0.22, 0.22)]
    f = bm.faces.new([bm.verts.new((x, y - 0.2, 0.05)) for x, y in pts])
    bm.to_mesh(me); bm.free()
    pl = link(bpy.data.objects.new("plate", me)); pl.data.materials.append(mat("plate", (250, 250, 248), rough=0.4))
    sol = pl.modifiers.new("s", "SOLIDIFY"); sol.thickness = 0.03
    for sx in (-1, 1):
        for (x0, y0, x1, y1) in ((0.35, -0.9, 1.55, -0.9), (0.35, 0.9, 1.55, 0.9), (0.35, -0.9, 0.35, 0.9), (1.55, -0.9, 1.55, 0.9)):
            rbox("box", abs(x1 - x0) * 1 or 0.05, abs(y1 - y0) or 0.05, 0.005, mat_=chalk,
                 loc=(sx * (x0 + x1) / 2, (y0 + y1) / 2, 0.04))
    # foul lines
    for s in (-1, 1):
        a = math.radians(45 * s)
        L = WALL_R - 4
        rbox("foul", 0.08, L, 0.005, mat_=chalk, loc=(math.sin(a) * L / 2, math.cos(a) * L / 2, 0.035), rot=(0, 0, -a))
    # warning track and wall
    track = noisy("track", (130, 84, 52), (156, 104, 68), scale=20, rough=0.95)
    pad = mat("pad", (22, 70, 52), rough=0.7) if look == "A" else mat("pad", (14, 52, 40), rough=0.5, coat=0.3)
    yellow = mat("yellow", (240, 200, 40), rough=0.4, coat=0.4)
    n = 60
    for i in range(n):
        a0 = math.radians(-47 + 94 * i / n)
        a1 = math.radians(-47 + 94 * (i + 1) / n)
        am = (a0 + a1) / 2
        seg = 2 * WALL_R * math.sin((a1 - a0) / 2) + 0.05
        rbox("trk", seg, 5, 0.01, mat_=track, loc=(math.sin(am) * (WALL_R - 3), math.cos(am) * (WALL_R - 3), 0.04), rot=(0, 0, -am))
        rbox("wall", seg, 0.6, 3.2, r=0.05, mat_=pad, loc=(math.sin(am) * WALL_R, math.cos(am) * WALL_R, 1.6), rot=(0, 0, -am))
        rbox("cap", seg, 0.7, 0.12, mat_=yellow, loc=(math.sin(am) * WALL_R, math.cos(am) * WALL_R, 3.25), rot=(0, 0, -am))
    for s in (-1, 1):
        a = math.radians(45 * s)
        cyl("pole", 0.25, 30, yellow, loc=(math.sin(a) * WALL_R, math.cos(a) * WALL_R, 15), verts=16)
    # distances on the wall
    numm = mat("num", (240, 240, 236), rough=0.5)
    for deg, t in ((-40, "334"), (-20, "365"), (0, "400"), (20, "365"), (40, "334")):
        a = math.radians(deg)
        r = WALL_R - 0.35
        text3d(t, 1.4, numm, (math.sin(a) * r, math.cos(a) * r, 1.9), rot=(math.radians(90), 0, -a), font=800)
    # stands and crowd, rising behind the wall
    stand = mat("stand", (26, 30, 46), rough=0.7)
    for k in range(5):
        r0 = WALL_R + 2 + k * 6
        for i in range(n):
            a0 = math.radians(-60 + 120 * i / n); a1 = math.radians(-60 + 120 * (i + 1) / n); am = (a0 + a1) / 2
            seg = 2 * r0 * math.sin((a1 - a0) / 2) + 0.1
            rbox("st", seg, 6, 4 + k * 4.4, mat_=stand, loc=(math.sin(am) * r0, math.cos(am) * r0, (4 + k * 4.4) / 2), rot=(0, 0, -am))
    pal = [(200, 40, 50), (240, 240, 240), (30, 60, 140), (200, 40, 50), (60, 60, 70), (230, 200, 60), (90, 150, 220), (30, 30, 36)]
    for k in range(5):
        r0 = WALL_R + 2 + k * 6
        ring = []
        for j in range(3):
            rr = r0 - 2 + j * 2
            z = 4 + k * 4.4 + j * 1.45 - 2.9 + 1.4
            o = crowd(f"crowd{k}{j}", 1, 150, (-rr * 1.05, 0, 0), (0, 0), rr * 2.1 / 150, 0, pal, seed=k * 10 + j,
                      person=(0.55, 0.45, 0.7))
            # bend the straight row round the park
            for v in o.data.vertices:
                ang = v.co.x / rr
                v.co.x, v.co.y = math.sin(ang) * (rr + v.co.y), math.cos(ang) * (rr + v.co.y)
                v.co.z += z
    # signs over the wall (DEEP, MOON, 450 CLUB, LIGHTS) and the lit bonus sign with YOUR SPOT
    sign_bg = mat("signbg", (16, 20, 34), rough=0.4, coat=0.6)
    gold_txt = emission("signtxt", (255, 214, 120), 2.0 if look == "A" else 5.0)
    for deg, t, rr, z in ((-28, "MOON", WALL_R + 26, 26), (-10, "DEEP", WALL_R + 14, 15), (-32, "450 CLUB", WALL_R + 8, 9),
                          (26, "LIGHTS", WALL_R + 26, 26), (22, "BONUS", WALL_R + 8, 9)):
        a = math.radians(deg)
        x, y = math.sin(a) * rr, math.cos(a) * rr
        w = 2.2 + len(t) * 1.25
        rbox("sign", w, 0.4, 2.6, r=0.1, mat_=sign_bg, loc=(x, y, z), rot=(0, 0, -a))
        rbox("signframe", w + 0.3, 0.3, 2.9, r=0.1, mat_=gold("signgold", ARTGOLD, 0.3), loc=(x + math.sin(a) * 0.1, y + math.cos(a) * 0.1, z), rot=(0, 0, -a))
        text3d(t, 1.6, gold_txt, (x - math.sin(a) * 0.25, y - math.cos(a) * 0.25, z), rot=(math.radians(90), 0, -a))
        if t == "BONUS":
            torus("spot", 2.2, 0.12, emission("spotring", (255, 210, 110), 6), loc=(x - math.sin(a) * 0.6, y - math.cos(a) * 0.6, z + 3.4), rot=(math.radians(90), 0, -a))
    # light towers
    for deg in (-52, -18, 18, 52):
        a = math.radians(deg)
        x, y = math.sin(a) * (WALL_R + 34), math.cos(a) * (WALL_R + 34)
        cyl("tower", 0.6, 40, mat("steel", (60, 64, 72), rough=0.4, metal=1), loc=(x, y, 20), verts=12)
        rbox("lamps", 10, 1.0, 5, r=0.2, mat_=emission("lamp", (255, 250, 236), 18 if look == "A" else 60), loc=(x, y, 42), rot=(math.radians(-12), 0, -a))
    # players: navy batter, red fielders (all faceless)
    navy = mat("navy", (24, 34, 70), rough=0.6, sheen=0.3)
    white = mat("white", (236, 236, 232), rough=0.65, sheen=0.3)
    red = mat("red", (196, 34, 42), rough=0.6, sheen=0.3)
    helmet = mat("helmet", (20, 30, 64), rough=0.15, coat=1.0)
    cap = mat("capr", (170, 26, 34), rough=0.5)
    figure("pitcher", (0, 18.6, 0.85), 1.88, red, shorts_mat=white, sock_mat=red, head_mat=cap, face_dir=(0, -1))
    fielders = [(-26, 44), (24, 47), (6, 54), (-50, 78), (0, 84), (48, 80)]
    ringm = mat("catch", (255, 255, 255), rough=0.4, alpha=0.35)
    for i, (x, y) in enumerate(fielders):
        figure(f"f{i}", (x, y, 0.0), 1.85, red, shorts_mat=white, sock_mat=red, head_mat=cap, face_dir=(-x / 100, -1))
        torus("circle", 5.5, 0.07, emission("circ", (255, 255, 255), 0.6), loc=(x, y, 0.06))
        disc("circfill", 5.5, ringm, (x, y), z=0.05, verts=48)
    # batter: back to the camera, bat cocked over the shoulder
    parts = figure("batter", (-1.0, -0.15, 0.0), 1.9, navy, shorts_mat=white, sock_mat=navy, head_mat=helmet, face_dir=(0.55, 0.85))
    bat = cyl("bat", 0.035, 0.86, wood("ash", (214, 172, 112), (176, 132, 76), scale=8, coat=0.6), loc=(-1.12, -0.05, 2.1), verts=24)
    bat.rotation_euler = (math.radians(-20), math.radians(-28), 0)
    # the pitch: the ball and its closing ring
    ball_m = mat("ball", (250, 248, 240), rough=0.4)
    bp = (0.15, 5.5, 1.15)
    sphere("ball", 0.075, ball_m, loc=bp, seg=32)
    rg = torus("ring", 0.32, 0.018, emission("ringe", (255, 255, 255), 3.0), loc=bp)
    if look == "A":
        world_color((10, 16, 34), 0.4)
        sun(rot=(55, 0, 160), energy=1.6, color=(230, 236, 255), angle=8)
        for deg in (-52, -18, 18, 52):
            a = math.radians(deg)
            area((math.sin(a) * 120, math.cos(a) * 120, 45), (0, 30, 0), size=14, energy=2.4e4, color=(255, 246, 230))
        area((6, -12, 10), (0, 0, 1), size=6, energy=2600, color=(220, 230, 255))
    else:
        world_color((2, 3, 8), 0.3)
        for o in bpy.data.objects:
            pass
        bpy.data.materials["grass"].node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.4
        bpy.data.materials["grass"].node_tree.nodes["Principled BSDF"].inputs["Coat Weight"].default_value = 0.3
        sun(rot=(60, 0, 170), energy=0.6, color=(200, 214, 255), angle=8)
        for deg in (-52, -18, 18, 52):
            a = math.radians(deg)
            area((math.sin(a) * 120, math.cos(a) * 120, 45), (0, 30, 0), size=6, energy=3.2e4, color=(255, 250, 240))
        area((-10, 6, 4), (-1, 0, 1.4), size=2, energy=1600, color=(140, 190, 255))
        area((8, -10, 8), (0, 0, 1), size=5, energy=1000, color=(255, 220, 190))
    cam_look((-0.55, -5.2, 3.6), (0.1, 40, -7.5), lens=24)
    pills = [("Pitch", "6/10", False), ("HR", 5, False), ("Bonus", 2, False)]
    return dict(pills=pills, right_pills=[("Perfect", "×1", True)], post=vignette(0.55, 1.8) if look == "B" else None)


run("sports", "homerun", ["A", "B"], build)
