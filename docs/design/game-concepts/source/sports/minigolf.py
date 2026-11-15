"""Crazy Golf (minigolf, golfRev 2): hole 5, the switchback finale, from above: striped turf, the rope rail with its
gate, the ramp with chevrons and a log, the dome hill, a boulder, the windmill at the doorway, the lower rail, a sand
trap and the tee mat, the cup and flag top right, the ball aiming.
A: today's striped turf, wooden rails and props, made real.  B: bolder, the course at dusk under festoon lights.
C: a hand-built tabletop model, tilted with a shallow depth of field."""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(__file__))
from kit import *


def turf(name, a, b, stripe=22.0, scale=1.0):
    """Mown stripes along y (bands of `stripe` px) with a fibre noise."""
    m, nt, bs = node_mat(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; mul.inputs[1].default_value = math.pi / u(stripe)
    nt.links.new(sep.outputs["Y"], mul.inputs[0])
    sn = nt.nodes.new("ShaderNodeMath"); sn.operation = "SINE"
    nt.links.new(mul.outputs[0], sn.inputs[0])
    gt = nt.nodes.new("ShaderNodeMath"); gt.operation = "GREATER_THAN"; gt.inputs[1].default_value = 0.0
    nt.links.new(sn.outputs[0], gt.inputs[0])
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 900 * scale; nz.inputs["Detail"].default_value = 6
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    mix = nt.nodes.new("ShaderNodeMixRGB"); mix.inputs[1].default_value = lin(a); mix.inputs[2].default_value = lin(b)
    nt.links.new(gt.outputs[0], mix.inputs[0])
    ov = nt.nodes.new("ShaderNodeMixRGB"); ov.blend_type = "OVERLAY"; ov.inputs[0].default_value = 0.25
    nt.links.new(mix.outputs[0], ov.inputs[1]); nt.links.new(nz.outputs["Fac"], ov.inputs[2])
    nt.links.new(ov.outputs[0], bs.inputs["Base Color"])
    bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.5; bp.inputs["Distance"].default_value = 0.002
    nt.links.new(nz.outputs["Fac"], bp.inputs["Height"]); nt.links.new(bp.outputs["Normal"], bs.inputs["Normal"])
    bs.inputs["Roughness"].default_value = 0.85
    bs.inputs["Sheen Weight"].default_value = 0.4
    return m


def rail_run(x0, y0, x1, y1, m, t=9, h=9):
    rbox("rail", u(abs(x1 - x0) or t), u(abs(y1 - y0) or t), u(h), r=u(2.5), mat_=m, loc=P((x0 + x1) / 2, (y0 + y1) / 2, u(h / 2)))


def bush(x, y, r, m, m2, seed):
    rnd = random.Random(seed)
    for i in range(14):
        a = rnd.uniform(0, 6.28)
        d = rnd.uniform(0, r * 0.55)
        rr = r * rnd.uniform(0.35, 0.55)
        sphere("leaf", u(rr), m if i % 3 else m2, loc=P(x + math.cos(a) * d, y + math.sin(a) * d, u(r * 0.5 + rnd.uniform(0, r * 0.4))), seg=20)
    # leaf displacement for a foliage silhouette
    return


def build(look):
    reset(samples=128 if look == "A" else 160, view="AgX", look="AgX - Punchy", exposure=-0.1 if look != "B" else 0.0)
    if look == "A":
        grass = turf("turf", (54, 128, 58), (72, 150, 74))
        wood_m = wood("rail", (150, 96, 56), (96, 56, 28), scale=3, coat=0.3, rough=0.45, rot=0)
        ramp_g = turf("rampturf", (90, 176, 92), (104, 190, 104))
        outside = noisy("paving", (34, 34, 36), (52, 52, 56), scale=12, rough=0.8, bump=0.3)
    elif look == "B":
        grass = turf("turf", (28, 96, 40), (40, 114, 52))
        wood_m = wood("rail", (120, 62, 30), (60, 26, 10), scale=3, coat=0.8, rough=0.25)
        ramp_g = turf("rampturf", (64, 150, 70), (80, 166, 84))
        outside = noisy("paving", (16, 16, 20), (30, 30, 36), scale=12, rough=0.5, bump=0.3, coat=0.4)
    else:
        grass = felt("modelturf", (64, 140, 64), scale=500, sheen=0.5, bump=0.6)
        wood_m = wood("rail", (200, 150, 96), (150, 104, 60), scale=4, coat=0.2, rough=0.5)
        ramp_g = felt("rampfelt", (110, 186, 104), scale=500, sheen=0.5)
        outside = wood("plinth", (60, 40, 26), (34, 20, 12), scale=1.2, coat=0.9, rough=0.25, rot=1.57)
    ground(outside, z=-u(1))
    flat(plate("course", u(382), u(694), u(1), u(4), mat_=grass, loc=P(195, 413, -u(1))))
    # boundary rails
    rail_run(4, 66, 386, 66, wood_m); rail_run(4, 760, 386, 760, wood_m)
    rail_run(4, 66, 4, 760, wood_m); rail_run(386, 66, 386, 760, wood_m)
    # the rope rail with its gate (posts and a twisted rope), gap at x 64-88
    post_m = wood_m
    rope = mat("rope", (200, 170, 120), rough=0.8) if look != "B" else mat("rope", (220, 186, 130), rough=0.6)
    for (a, b) in ((8, 64), (88, 382)):
        tube_path("rope", [P(a, 305, u(7)), P(b, 305, u(7))], u(3), rope)
        tube_path("rope2", [P(a, 305, u(3.5)), P(b, 305, u(3.5))], u(2.2), rope)
        for x in range(int(a), int(b) + 1, 44):
            cyl("post", u(4), u(12), post_m, loc=P(x, 305, u(6)), verts=24, bevel=u(1))
    for x in (64, 88):
        cyl("gatepost", u(5), u(16), post_m, loc=P(x, 305, u(8)), verts=24, bevel=u(1.2))
        sphere("finial", u(4), mat("finial", (196, 40, 40), rough=0.3, coat=0.8), loc=P(x, 305, u(18)), seg=20)
    # ramp: a raised slope rising toward the top, with chevrons
    rp = flat(plate("ramp", u(144), u(210), u(8), u(6), mat_=ramp_g, loc=P(77, 420, -u(6))))
    rp.rotation_euler = (math.radians(3), 0, 0)
    chev = mat("chev", (236, 244, 230), rough=0.5) if look != "B" else emission("chevb", (200, 255, 210), 1.2)
    for r_ in range(3):
        for c_ in range(3):
            x = 32 + c_ * 44
            y = 368 + r_ * 50
            for s in (-1, 1):
                rbox("chev", u(12), u(3), u(0.8), r=u(1), mat_=chev, loc=P(x + s * 5, y + 3, u(2.6 + (3 - r_) * 1.0)),
                     rot=(0, 0, math.radians(-35 * s)))
    # log
    bark = noisy("bark", (70, 44, 24), (120, 80, 46), scale=40, rough=0.8, bump=0.6)
    lg = cyl("log", u(6), u(64), bark, loc=P(46, 476, u(8)), verts=24, rot=(math.radians(90), 0, math.radians(-50)), bevel=u(1.5))
    # dome hill
    dm = sphere("dome", u(40), grass, loc=P(209, 417, -u(26)), seg=64)
    dm.scale = (1, 1, 0.9)
    torus("domerim", u(40), u(2.6), mat("domerim", (34, 90, 40), rough=0.8), loc=P(209, 417, u(0.5)))
    # boulder
    rock = noisy("rock", (78, 84, 92), (128, 134, 140), scale=8, rough=0.7, bump=0.8)
    b = sphere("boulder", u(20), rock, loc=P(319, 406, u(8)), seg=32)
    b.scale = (1.1, 0.95, 0.7)
    disp = b.modifiers.new("d", "DISPLACE")
    tx = bpy.data.textures.new("rk", "CLOUDS"); tx.noise_scale = 0.08
    disp.texture = tx; disp.strength = u(4)
    # windmill: a stone drum at the doorway, four lattice-and-canvas sails
    stone = noisy("mstone", (170, 160, 140), (210, 202, 186), scale=30, rough=0.8, bump=0.4) if look != "B" else \
        noisy("mstone", (120, 110, 96), (170, 160, 140), scale=30, rough=0.6, bump=0.4)
    cyl("mill", u(14), u(24), stone, loc=P(318, 501, u(12)), verts=12, bevel=u(1.5))
    roof = mat("roof", (140, 56, 40), rough=0.6) if look != "C" else mat("roof", (90, 120, 160), rough=0.5)
    bpy.ops.mesh.primitive_cone_add(radius1=u(17), radius2=u(3), depth=u(14), vertices=12, location=P(318, 501, u(31)))
    bpy.context.object.data.materials.append(roof)
    canvas = mat("canvas", (234, 226, 204), rough=0.8, sss=0.1)
    frame_m = wood("sailwood", (170, 120, 70), (110, 70, 36), scale=5)
    for i in range(4):
        a = math.radians(30 + i * 90)
        cx, cy = 318 + math.cos(a) * 26, 501 + math.sin(a) * 26
        rbox("sail", u(36), u(11), u(1), r=u(1), mat_=canvas, loc=P(cx, cy, u(40)), rot=(0, math.radians(8), -a))
        rbox("spar", u(46), u(2), u(2), r=u(0.6), mat_=frame_m, loc=P(318 + math.cos(a) * 22, 501 + math.sin(a) * 22, u(41)), rot=(0, 0, -a))
    sphere("hub", u(5), gold("hub", (200, 160, 80), 0.3), loc=P(318, 501, u(41)), seg=20)
    # lower rail with the doorway gap
    rail_run(4, 534, 282, 534, wood_m)
    rail_run(352, 534, 386, 534, wood_m)
    # cup and flag
    cyl("cup", u(8), u(2), mat("cupd", (6, 6, 6), rough=1.0), loc=P(339, 173, u(0.2)), verts=48)
    torus("cuplip", u(8), u(1), mat("cuplip", (240, 240, 240), rough=0.3), loc=P(339, 173, u(0.3)))
    pole = cyl("pole", u(1.4), u(52), mat("pole", (236, 236, 236), rough=0.2, coat=1), loc=P(339, 173, u(26)), verts=16)
    flag = rbox("flag", u(22), u(1), u(14), r=u(0.5), mat_=mat("flag", (210, 30, 36), rough=0.6, sss=0.2),
                loc=P(350, 173, u(45)), rot=(0, 0, math.radians(-25)))
    # shrubs
    lf = noisy("leaf", (30, 96, 40), (70, 140, 60), scale=40, rough=0.7, bump=0.5) if look != "B" else \
        noisy("leaf", (18, 70, 30), (50, 110, 50), scale=40, rough=0.6, bump=0.5)
    lf2 = noisy("leaf2", (40, 120, 50), (90, 160, 70), scale=40, rough=0.7, bump=0.5)
    for i, (x, y, r) in enumerate(((288, 139, 16), (232, 195, 14), (355, 224, 16))):
        bush(x, y, r, lf, lf2, i)
    # sand trap and tee mat
    sand = noisy("sand", (206, 176, 120), (232, 206, 156), scale=200, rough=0.95, bump=0.5)
    cyl("sand", u(23), u(1.2), sand, loc=P(182, 677, u(0.2)), verts=64, bevel=u(0.5))
    torus("sandrim", u(24), u(2), mat("sandrim", (110, 90, 60), rough=0.9), loc=P(182, 677, u(0.4)))
    plate("tee", u(34), u(20), u(1.5), u(4), mat_=mat("teemat", (26, 70, 34), rough=0.9), loc=P(54, 722, 0), edge=u(0.5))
    # ball and aim
    golf = noisy("golfball", (238, 238, 236), (252, 252, 250), scale=400, rough=0.25, bump=0.4, coat=0.8)
    sphere("ball", u(5.5), golf, loc=P(78, 249, u(5.5)), seg=48)
    aim = emission("aim", (255, 255, 255), 1.4)
    for i in range(1, 10):
        t = i / 10
        sphere("aimdot", u(1.3), aim, loc=P(78 + (250 - 78) * t * 0.7, 249 + (176 - 249) * t * 0.7, u(1.5)), seg=12)
    gh = gold("handle", ARTGOLD, 0.25)
    sphere("pull", u(6), gh, loc=P(78 - 30, 249 + 13, u(6)), seg=32)
    tube_path("band", [P(78, 249, u(4)), P(78 - 30, 249 + 13, u(5))], u(1.0), mat("band", (232, 196, 110), rough=0.4))
    # lights
    if look == "A":
        world_color((200, 214, 236), 0.35)
        sun(rot=(34, 0, -40), energy=2.2, angle=3)
        cam_top(ortho=False, lens=200, tilt=2)
        return dict(pills=[("Hole", "5/5 · Par 5", False)], right_pills=[("Stroke", "4/8", False)])
    if look == "B":
        world_color((4, 6, 14), 0.25)
        sun(rot=(55, 0, 120), energy=1.0, color=(110, 140, 255), angle=4)
        bulb = emission("bulb", (255, 210, 140), 40)
        for (y, sag) in ((96, 10), (568, 12), (790, 8)):
            pts = []
            for i in range(9):
                x = 8 + i * 47
                pts.append((x, y + math.sin(i / 8 * math.pi) * sag))
            tube_path("wire", [P(x, y_, u(60)) for x, y_ in pts], u(0.5), mat("wire", (20, 20, 20), rough=0.6))
            for x, y_ in pts:
                sphere("bulb", u(3), bulb, loc=P(x, y_, u(57)), seg=12)
                point(P(x, y_, u(50)), 50, (255, 190, 110), 0.05)
        area(P(-80, 200, 6), P(195, 420, 0), size=6, energy=420, color=(255, 170, 110))
        cam_top(ortho=False, lens=200, tilt=2)
        return dict(pills=[("Hole", "5/5 · Par 5", False)], right_pills=[("Stroke", "4/8", False)], post=vignette(0.55, 1.8))
    world_color((214, 210, 200), 0.6)
    area(P(-120, 120, 14), P(195, 420, 0), size=10, energy=2600, color=(255, 240, 220))
    area(P(500, 600, 10), P(195, 420, 0), size=12, energy=600, color=(220, 230, 255))
    cam = cam_top(ortho=False, lens=90, tilt=22, fit_h=900, cy=420)
    dof(cam, (cam.location - P(195, 400, 0)).length, fstop=0.5)
    return dict(pills=[("Hole", "5/5 · Par 5", False)], right_pills=[("Stroke", "4/8", False)])


run("sports", "minigolf", ["A", "B", "C"], build)
