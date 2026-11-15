"""Cue Ball (pool, poolRev 4): a six-pocket table filling the screen, the stripes rack mid-play, the cue from the top
right, the aim preview, and the power meter and spin ball below.
A: today's mahogany, green cloth and chrome pockets, made real.  B: bolder, a low pendant over a dark hall, rosewood
and brass.  C: heritage, carved walnut with brass castings and leather pocket nets."""
import os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
from kit import *

OUT_ = (20, 84, 370, 734)      # outer rail
CLOTH = (46, 110, 344, 708)    # playing surface
POCKETS = [(46, 110), (344, 110), (46, 708), (344, 708), (40, 409), (350, 409)]
COL = {1: (236, 186, 32), 2: (30, 70, 170), 3: (196, 30, 34), 4: (92, 40, 140), 5: (232, 104, 24),
       6: (22, 120, 64), 7: (128, 22, 30), 8: (16, 16, 18)}
BALLS = [(10, 280, 620), (12, 75, 220), (13, 225, 286), (14, 127, 502), (15, 215, 492), (8, 298, 352)]
CUE = (322, 170)
R = 8.2


def build(look):
    reset(samples=160 if look != "B" else 192, view="AgX", look="AgX - Punchy", exposure=-0.15)
    if look == "A":
        rail = wood("mahog", (124, 62, 30), (62, 26, 10), scale=1.4, coat=0.8, rough=0.3)
        cloth_c = (44, 122, 78)
        pocket_m = mat("chrome", (230, 232, 236), rough=0.08, metal=1.0)
        sight = mat("pearl", (240, 236, 226), rough=0.2, coat=1.0)
        floor = mat("floor", (16, 12, 9), rough=0.7)
        base = (250, 246, 236)
    elif look == "B":
        rail = wood("rose", (86, 30, 18), (30, 8, 4), scale=1.6, coat=1.0, rough=0.22)
        cloth_c = (26, 106, 62)
        pocket_m = gold("brass", (214, 160, 72), rough=0.18)
        sight = gold("sightb", (232, 196, 120), rough=0.2)
        floor = mat("floorb", (6, 6, 8), rough=0.8)
        base = (248, 244, 232)
    else:
        rail = wood("walnut", (140, 92, 52), (64, 36, 16), scale=1.2, coat=0.5, rough=0.38)
        cloth_c = (40, 112, 70)
        pocket_m = gold("castbrass", (190, 140, 64), rough=0.32)
        sight = mat("ivory", (236, 226, 200), rough=0.25, coat=0.6)
        floor = wood("parquet", (92, 56, 30), (52, 30, 14), scale=6, coat=0.3, rough=0.4, rot=1.57)
        base = (242, 232, 210)
    ground(floor, z=-u(30))
    # table body under the rail
    x0, y0, x1, y1 = OUT_
    plate("body", u(x1 - x0), u(y1 - y0), u(28), u(16), mat_=rail, loc=P((x0 + x1) / 2, (y0 + y1) / 2, -u(30)), edge=u(2))
    # cloth bed
    cx0, cy0, cx1, cy1 = CLOTH
    flat(plate("bed", u(cx1 - cx0 + 30), u(cy1 - cy0 + 30), u(1), 0, mat_=felt("cloth", cloth_c, scale=500, sheen=0.4, bump=0.25),
          loc=P((cx0 + cx1) / 2, (cy0 + cy1) / 2, -u(1))))
    # wooden rail ring
    import importlib
    rr = plate("rail", u(x1 - x0), u(y1 - y0), u(7), u(16), mat_=rail, loc=P((x0 + x1) / 2, (y0 + y1) / 2, 0), edge=u(2.4))
    cut = plate("railcut", u(cx1 - cx0 + 20), u(cy1 - cy0 + 20), u(20), u(4), loc=P((cx0 + cx1) / 2, (cy0 + cy1) / 2, -u(5)))
    m_ = rr.modifiers.new("cut", "BOOLEAN"); m_.object = cut; m_.operation = "DIFFERENCE"
    rr.modifiers.move(1, 0)
    cut.hide_render = True
    # cushions: green rubber noses along each edge, broken at the pockets
    cush = felt("cush", tuple(int(c * 0.9) for c in cloth_c), scale=500, sheen=0.4)
    segs = [((cx0 + 14, cy0 - 5), (cx1 - 14, cy0 - 5)), ((cx0 + 14, cy1 + 5), (cx1 - 14, cy1 + 5)),
            ((cx0 - 5, cy0 + 14), (cx0 - 5, 396)), ((cx0 - 5, 422), (cx0 - 5, cy1 - 14)),
            ((cx1 + 5, cy0 + 14), (cx1 + 5, 396)), ((cx1 + 5, 422), (cx1 + 5, cy1 - 14))]
    for (a, b) in segs:
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        w = abs(b[0] - a[0]) or 10
        h = abs(b[1] - a[1]) or 10
        rbox("cush", u(w), u(h), u(5), r=u(2.2), mat_=cush, loc=P(mx, my, u(2.5)))
    # pockets: a dark well, a metal cap (or leather net on C)
    hole = mat("hole", (4, 4, 5), rough=1.0)
    for (px, py) in POCKETS:
        cyl("hole", u(11.5), u(2), hole, loc=P(px, py, u(0.4)), verts=64)
        torus("cap", u(15.5), u(4.6), pocket_m, loc=P(px, py, u(5.6)))
        if look == "C":
            torus("net", u(11), u(1.4), mat("leather", (70, 36, 18), rough=0.5, coat=0.3), loc=P(px, py, u(4)))
    # diamond sights on the rail top
    for i in range(1, 8):
        y = cy0 + (cy1 - cy0) * i / 8
        if abs(y - 409) < 20:
            continue
        for x in (x0 + 9, x1 - 9):
            dm = rbox("dia", u(3.2), u(3.2), u(0.6), r=u(0.5), mat_=sight, loc=P(x, y, u(7.1)), rot=(0, 0, math.radians(45)))
    for i in range(1, 4):
        x = cx0 + (cx1 - cx0) * i / 4
        for y in (y0 + 9, y1 - 9):
            rbox("dia", u(3.2), u(3.2), u(0.6), r=u(0.5), mat_=sight, loc=P(x, y, u(7.1)), rot=(0, 0, math.radians(45)))
    if look == "C":
        for (px, py) in POCKETS[:4]:
            plate("casting", u(34), u(34), u(1.2), u(10), mat_=pocket_m, loc=P(px + (-9 if px < 195 else 9), py + (-9 if py < 409 else 9), u(7)), edge=u(0.6))
    # head string
    plate("string", u(cx1 - cx0), u(0.7), u(0.05), 0, mat_=mat("chalkline", (200, 214, 200), rough=0.9),
          loc=P(195, 585, 0.0))
    # balls
    for n, x, y in BALLS:
        tex = ball_tex(n if n != 8 else 8, COL[n - 8] if n > 8 else COL[n], stripe=n > 8, base=base, tag=look)
        ball(f"b{n}", x, y, R, tex, spin=(n * 37) % 60 - 30, tilt=(n * 13) % 20 - 10)
    cue_tex = ball_tex(None, base, base=base, tag=look + "cue")
    ball("cue", *CUE, R, cue_tex)
    # aim preview: dotted cue path to the ghost ball, the object ball's line to the pocket
    tgt = (225, 286)
    pkt = (46, 708)
    dx, dy = pkt[0] - tgt[0], pkt[1] - tgt[1]
    ln = math.hypot(dx, dy)
    gx, gy = tgt[0] - dx / ln * 2 * R, tgt[1] - dy / ln * 2 * R
    lm = emission("aim", (255, 255, 255), 1.6)
    n = 14
    for i in range(1, n):
        t = i / n
        x = CUE[0] + (gx - CUE[0]) * t
        y = CUE[1] + (gy - CUE[1]) * t
        sphere("dot", u(1.1), lm, loc=P(x, y, u(1)), seg=12)
    torus("ghost", u(R), u(0.6), lm, loc=P(gx, gy, u(R)), rot=(0, 0, 0))
    seg = 10
    for i in range(1, seg):
        t = i / seg * 0.55
        x = tgt[0] + dx * t
        y = tgt[1] + dy * t
        sphere("dot2", u(0.9), emission("aim2", (255, 236, 190), 1.0), loc=P(x, y, u(1)), seg=12)
    # the cue: tapered maple shaft, ivory ferrule, dark butt, out past the top right
    vx, vy = CUE[0] - gx, CUE[1] - gy
    vl = math.hypot(vx, vy)
    vx, vy = vx / vl, vy / vl
    start = (CUE[0] + vx * 14, CUE[1] + vy * 14)
    L = 520
    ang = math.atan2(-vy, vx)

    def stick(nm, a, b, r0, r1, m):
        mid = ((start[0] + vx * (a + b) / 2), (start[1] + vy * (a + b) / 2))
        bpy.ops.mesh.primitive_cone_add(radius1=u(r0), radius2=u(r1), depth=u(b - a), vertices=48,
                                        location=P(mid[0], mid[1], u(9 + (a + b) / 2 * 0.06)))
        o = bpy.context.object
        o.rotation_euler = (0, math.radians(-90), 0)
        o.rotation_euler.rotate_axis("X", 0)
        o.rotation_euler = (0, 0, 0)
        o.rotation_mode = "XYZ"
        d = Vector((vx, -vy, 0.06)).normalized()
        o.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
        o.data.materials.append(m)
        bpy.ops.object.shade_smooth()
        return o
    stick("tip", 0, 3, 2.1, 2.2, mat("tip", (60, 110, 160), rough=0.9))
    stick("ferrule", 3, 10, 2.2, 2.3, mat("ferr", (244, 240, 228), rough=0.2, coat=0.8))
    stick("shaft", 10, 260, 2.3, 3.6, wood("maple", (226, 196, 150), (196, 160, 112), scale=6, coat=0.6, rough=0.3))
    butt_m = wood("ebony", (40, 26, 20), (14, 8, 6), scale=4, coat=1.0, rough=0.2) if look != "C" else rail
    stick("ring", 260, 266, 3.6, 3.65, pocket_m)
    stick("butt", 266, L, 3.65, 5.2, butt_m)
    # power meter and spin ball (the panel below the table)
    panel_m = mat("panel", (14, 14, 16), rough=0.35, coat=0.6) if look != "C" else wood("panelc", (70, 40, 20), (40, 20, 8), scale=3)
    plate("panel", u(306), u(76), u(4), u(14), mat_=panel_m, loc=P(159, 790, -u(1)), edge=u(1.2))
    frame_m = mat("pframe", (200, 200, 204), rough=0.2, metal=1.0) if look == "A" else pocket_m
    from_ = 24
    lit = 15
    for i in range(from_):
        t = i / (from_ - 1)
        c = (int(40 + 200 * t), int(200 - 150 * t), 50)
        for row in (0, 1):
            on = i < lit
            em = emission(f"led{i}{on}", c, 2.2 if on else 0.08) if on else mat(f"ledoff{i}", tuple(int(v * 0.25) for v in c), rough=0.4, coat=0.8)
            rbox("led", u(9.5), u(14), u(1.2), r=u(1.2), mat_=em, loc=P(26 + i * 11.6, 777 + row * 18, u(3.2)))
    rbox("slider", u(150), u(4), u(2), r=u(1.5), mat_=mat("slide", (244, 238, 224), rough=0.25, coat=1),
         loc=P(26 + 11.6 * lit - 75, 786, u(4.6)))
    sb = sphere("spin", u(28), mat("spinm", base, rough=0.12, coat=1.0), loc=P(354, 790, u(10)))
    sphere("spindot", u(5), emission("spindot", (230, 40, 40), 2.5), loc=P(354, 794, u(35.5)))
    torus("spinring", u(31), u(1.2), frame_m, loc=P(354, 790, u(2)))
    # light
    cam_top(ortho=False, lens=200, tilt=3)
    if look == "A":
        area(P(195, 300, 14), P(195, 300, 0), size=3, size_y=1.2, energy=1100, color=(255, 244, 226))
        area(P(195, 560, 14), P(195, 560, 0), size=3, size_y=1.2, energy=1100, color=(255, 244, 226))
        area(P(-200, 100, 10), P(195, 420, 0), size=10, energy=500, color=(220, 230, 255))
        world_color((20, 18, 16), 0.4)
        return dict(right_pills=[("Fouls", 1, False)], pills=[("Stripes", "4 left", False), ("The black", "next", True)])
    if look == "B":
        area(P(195, 400, 9), P(195, 400, 0), size=2.6, size_y=6, energy=700, color=(255, 226, 180), spread=60)
        world_color((4, 4, 6), 0.2)
        return dict(pills=[("Stripes", "4 left", False), ("The black", "next", True)], right_pills=[("Fouls", 1, False)],
                    post=vignette(0.75, 1.8))
    area(P(-120, 80, 12), P(195, 420, 0), size=8, energy=1500, color=(255, 230, 196))
    area(P(500, 700, 9), P(195, 420, 0), size=10, energy=300, color=(214, 226, 255))
    world_color((40, 30, 22), 0.4)
    return dict(pills=[("Stripes", "4 left", False), ("The black", "next", True)], right_pills=[("Fouls", 1, False)],
                post=vignette(0.35))


run("sports", "pool", ["A", "B", "C"], build)
