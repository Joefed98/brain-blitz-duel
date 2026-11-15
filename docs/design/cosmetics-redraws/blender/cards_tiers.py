"""The tier card arts (card-art.tier.*), one scene each, a family stepping up in drama (Lightning is tier_lightning.py):

  spark    a forge: an anvil, a white-hot bar, sparks spraying off the hammer's strike, in copper and ember
  charge   a charged cell: a glass capsule holding a green plasma column, cables, its light on the floor
  volt     two coils in a dark hall, a cyan arc leaping between them, sparks to the floor
  surge    a night sea, a great swell rising on the right, lit blue from inside, spray off its crest
  storm    a supercell over a plain: a striated violet storm tower, lightning inside it and to the ground
  top-500  a vault of gold light: a jewelled crown on a velvet cushion on a pedestal, light falling through haze

    python cards_tiers.py [spark charge volt surge storm top-500]
"""
import math
import os
import sys

import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import card_lib as C  # noqa: E402
import lib  # noqa: E402

CAM = dict(location=(0, -7.0, 0.35), target=(0, 0, 0.15), lens=38)


def floor(colour, roughness, z=-1.0, size=200):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 8, z))
    return C.mat_of(bpy.context.object, lib.material("floor", base=colour, metallic=0.6, roughness=roughness))


def spark():
    rng = np.random.default_rng(11)
    lib.world((0.01, 0.006, 0.004), 1.0)
    iron = lib.material("iron", base=(0.05, 0.048, 0.046), metallic=0.85, roughness=0.42)
    floor((0.03, 0.025, 0.02), 0.6)
    # The anvil: a heavy base, a waisted body, the face, a horn to the left.
    ax, ay = 2.0, 1.2
    for loc, sc in (((ax, ay, -0.78), (1.2, 0.7, 0.44)), ((ax, ay, -0.38), (0.62, 0.42, 0.4)), ((ax + 0.1, ay, -0.04), (1.5, 0.62, 0.28))):
        bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
        o = bpy.context.object
        o.scale = sc
        bpy.ops.object.transform_apply(scale=True)
        bv = o.modifiers.new("b", "BEVEL")
        bv.width = 0.05
        bv.segments = 3
        o.data.materials.append(iron)
    bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=0.24, radius2=0.03, depth=0.6, location=(ax - 0.94, ay, -0.04))
    h = bpy.context.object
    h.rotation_euler = (0, math.radians(-90), 0)
    h.scale = (1, 1, 1)
    h.data.materials.append(iron)
    bpy.ops.object.shade_smooth()
    # The white-hot bar on the face.
    bpy.ops.mesh.primitive_cube_add(size=1, location=(ax + 0.1, ay - 0.05, 0.16))
    bar = bpy.context.object
    bar.scale = (0.9, 0.13, 0.1)
    bar.data.materials.append(lib.material("hot", base=(0.3, 0.1, 0.03), roughness=0.5, emission=(1.0, 0.55, 0.2), strength=45))
    C.point_light((ax + 0.1, ay - 0.4, 0.5), 260, (1.0, 0.5, 0.18), 0.2)
    # Sparks: short glowing streaks on falling arcs from the strike.
    hot = C.emit("sparkc", (1.0, 0.62, 0.25), 40)
    o0 = np.array([ax + 0.2, ay - 0.08, 0.24])
    for _ in range(170):
        v = np.array([rng.normal(-0.35, 1.0), rng.normal(-0.6, 0.5), rng.uniform(0.6, 2.4)])
        t0 = rng.uniform(0.02, 0.6)
        pts = [o0 + v * t + np.array([0, 0, -2.4 * t * t]) for t in np.linspace(t0, t0 + rng.uniform(0.03, 0.08), 4)]
        C.tube(pts, rng.uniform(0.004, 0.009), hot, "spark")
    # Embers drifting in the haze, the forge's glow behind.
    for _ in range(40):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=rng.uniform(0.008, 0.02), location=(rng.uniform(-1, 3.3), rng.uniform(-0.5, 3), rng.uniform(-0.6, 1.3)))
        bpy.context.object.data.materials.append(C.emit("ember", (1.0, 0.42, 0.12), rng.uniform(6, 20)))
    C.point_light((3.6, 4.5, -0.3), 2400, (1.0, 0.36, 0.1), 1.5)
    C.noise_volume("smoke", (1.5, 3.5, 0.5), (9, 5, 3), 0.25, (0.6, 0.45, 0.4), noise_scale=0.6, lo=0.4, hi=0.8)
    lib.area_light((-3, -4, 4), (2, 1, 0), 120, 3, (0.7, 0.75, 0.9))


def charge():
    rng = np.random.default_rng(12)
    lib.world((0.003, 0.008, 0.006), 1.0)
    floor((0.02, 0.025, 0.03), 0.18)
    steel = lib.material("steel", base=(0.55, 0.58, 0.62), metallic=1.0, roughness=0.28)
    cx, cy = 2.0, 1.0
    # The capsule: steel caps, a glass tube, a plasma column inside.
    for z, h in ((-0.82, 0.36), (1.02, 0.3)):
        bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.52, depth=h, location=(cx, cy, z))
        o = bpy.context.object
        bv = o.modifiers.new("b", "BEVEL")
        bv.width = 0.04
        bv.segments = 3
        o.data.materials.append(steel)
        bpy.ops.object.shade_smooth()
        for k in range(8):
            a = k * math.tau / 8
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.035, location=(cx + math.cos(a) * 0.46, cy + math.sin(a) * 0.46, z + h / 2))
            bpy.context.object.data.materials.append(steel)
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.42, depth=1.56, location=(cx, cy, 0.1))
    C.mat_of(bpy.context.object, C.glass("tube", (0.9, 1.0, 0.95), 1.45))
    bpy.ops.object.shade_smooth()
    # The plasma: a glowing column with a twisting filament round it.
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.1, depth=1.5, location=(cx, cy, 0.1))
    C.mat_of(bpy.context.object, C.emit("plasma", (0.45, 1.0, 0.65), 22))
    pts = [np.array([cx + 0.22 * math.cos(t * 5), cy + 0.22 * math.sin(t * 5), -0.62 + t * 1.45 / math.tau]) for t in np.linspace(0, math.tau, 120)]
    C.arc(pts, 0.012, (0.85, 1.0, 0.9), (0.24, 0.86, 0.52), 30, 0, "fil")
    C.noise_volume("glowfog", (cx, cy, 0.1), (0.8, 0.8, 1.5), 3.0, (0.3, 1.0, 0.55), noise_scale=1.5, lo=0.3, hi=0.9, emission=(0.24, 0.86, 0.52), emission_strength=2.0, fade=True)
    C.point_light((cx, cy - 0.6, 0.1), 900, (0.3, 1.0, 0.55), 0.4)
    # Cables snaking out across the floor to the left.
    rubber = lib.material("rubber", base=(0.015, 0.015, 0.02), roughness=0.45)
    for k in range(3):
        pts = [np.array([cx - 0.3 - t * 3.8, cy + 0.3 * k - 0.3 + 0.18 * math.sin(t * 6 + k), -0.92 + 0.04 * k]) for t in np.linspace(0, 1, 40)]
        C.tube(pts, 0.04, rubber, "cable")
    # Distant indicator lights.
    for _ in range(14):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.02, location=(rng.uniform(-3, 4), rng.uniform(4, 7), rng.uniform(-0.5, 1.2)))
        C.mat_of(bpy.context.object, C.emit("ind", (0.3, 1.0, 0.5), 18))
    lib.area_light((-3, -4, 4), (2, 1, 0), 140, 3, (0.7, 0.8, 0.9))
    C.fog(0.005, (0.6, 0.8, 0.7))


def volt():
    rng = np.random.default_rng(13)
    lib.world((0.002, 0.006, 0.01), 1.0)
    floor((0.02, 0.025, 0.035), 0.14)
    chrome = lib.material("chrome", base=(0.82, 0.86, 0.9), metallic=1.0, roughness=0.08)
    copper = lib.material("copper", base=(0.95, 0.5, 0.3), metallic=1.0, roughness=0.3)
    tops = []
    for cx, h in ((1.15, 0.95), (2.75, 1.12)):
        cy = 1.4
        bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.42, depth=0.22, location=(cx, cy, -0.89))
        C.mat_of(bpy.context.object, chrome)
        bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.16, depth=h, location=(cx, cy, -0.78 + h / 2))
        coil = bpy.context.object
        coil.data.materials.append(copper)
        # The winding: a fine bump of rings.
        nt = copper.node_tree
        if "Wave Texture" not in nt.nodes:
            w = nt.nodes.new("ShaderNodeTexWave")
            w.bands_direction = "Z"
            w.inputs["Scale"].default_value = 60
            bump = nt.nodes.new("ShaderNodeBump")
            bump.inputs["Strength"].default_value = 0.6
            nt.links.new(w.outputs["Fac"], bump.inputs["Height"])
            nt.links.new(bump.outputs["Normal"], nt.nodes["Principled BSDF"].inputs["Normal"])
        bpy.ops.object.shade_smooth()
        top = (cx, cy, -0.78 + h + 0.12)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.34, minor_radius=0.13, location=top)
        C.mat_of(bpy.context.object, chrome)
        bpy.ops.object.shade_smooth()
        tops.append(np.array(top))
    a, b = tops[0] + np.array([0.3, 0, 0.08]), tops[1] - np.array([0.3, 0, -0.05])
    for k in range(3):
        C.arc(C.path(rng, a, b, 6, 0.18, (0.3, 0.5, 1)), 0.012 if k == 0 else 0.006, (0.85, 1.0, 1.0), (0.18, 0.86, 0.95), 50 if k == 0 else 26, 140 if k == 0 else 0, f"arc{k}")
    for t in tops:
        for k in range(2):
            end = t + np.array([rng.uniform(-0.9, 0.9), rng.uniform(-0.6, 0.3), -rng.uniform(0.6, 1.0)])
            C.arc(C.path(rng, t, end, 5, 0.25), 0.005, (0.85, 1.0, 1.0), (0.18, 0.86, 0.95), 20, 0, "spk")
    C.fog(0.01, (0.5, 0.8, 0.9))
    lib.area_light((-3, -4, 4), (2, 1, 0), 90, 3, (0.7, 0.8, 1.0))


def surge():
    rng = np.random.default_rng(14)
    lib.world((0.002, 0.004, 0.014), 1.0)

    def sea(X, Y):
        # A long wave rolling in towards us across the right of the sea: its back a gentle slope, its face steep,
        # rising from a swell on the left to its full height on the right.
        y0 = 0.4
        u = Y - y0
        tall = 0.15 + 1.25 * np.clip((X + 1.0) / 4.0, 0, 1) ** 1.4
        prof = np.where(u > 0, np.exp(-(u / 1.5) ** 2), np.exp(-(u / 0.38) ** 2))
        return -1.0 + tall * prof + 0.05 * C.fbm2(X, Y, 3, 4, 1.4)

    water = lib.material("water", base=(0.005, 0.03, 0.12), roughness=0.06, transmission=0.0, ior=1.33)
    nt = water.node_tree
    b = nt.nodes["Principled BSDF"]
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = 0.05
    mr.inputs["From Max"].default_value = 0.42
    mr.inputs["To Max"].default_value = 2.2
    nt.links.new(geo.outputs["Position"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
    b.inputs["Emission Color"].default_value = (0.25, 0.55, 1.0, 1)
    nt.links.new(mr.outputs[0], b.inputs["Emission Strength"])
    C.heightfield("sea", 260, 160, 16, 10, sea, (0, 3.5, 0), water)
    # Spray off the crest.
    spray = C.emit("spray", (0.7, 0.85, 1.0), 10)
    for _ in range(200):
        lx = rng.uniform(-0.5, 4.5)
        tall = 0.15 + 1.25 * np.clip((lx + 1.0) / 4.0, 0, 1) ** 1.4
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=4, radius=rng.uniform(0.004, 0.012), location=(lx, 0.4 + 3.5 + rng.normal(-0.05, 0.08), -1.0 + tall + abs(rng.normal(0, 0.1 * tall))))
        bpy.context.object.data.materials.append(spray)
    # Stars in the sky above.
    star = C.emit("star", (0.85, 0.9, 1.0), 10)
    for _ in range(160):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=rng.uniform(0.006, 0.014), location=(rng.uniform(-9, 9), 20, rng.uniform(0.2, 5)))
        bpy.context.object.data.materials.append(star)
    C.point_light((2.6, 3.2, 0.4), 60, (0.3, 0.55, 1.0), 1.0)


def storm():
    """A supercell's base over a plain: a low, heavy violet cloud deck, a wall cloud hanging under its right side,
    forks of lightning racing through the base and one strike to the ground."""
    rng = np.random.default_rng(15)
    lib.world((0.008, 0.006, 0.02), 1.0)
    bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 20, -1.0))
    C.mat_of(bpy.context.object, lib.material("plain", base=(0.02, 0.018, 0.03), roughness=0.55))
    C.noise_volume("deck", (0, 6.5, 2.2), (20, 9, 2.4), 5.0, (0.5, 0.45, 0.66), noise_scale=0.6, lo=0.44, hi=0.6, fade=True, distortion=0.8)
    C.noise_volume("wall", (2.6, 6.0, 0.55), (3.4, 3.0, 1.6), 4.0, (0.42, 0.38, 0.56), noise_scale=0.9, lo=0.42, hi=0.62, distortion=0.8)
    main = C.path(rng, (2.9, 6.2, 0.9), (2.4, 6.0, -1.0), 6, 0.2)
    C.arc(main, 0.012, (0.96, 0.92, 1.0), (0.66, 0.48, 1.0), 45, 22, "main")
    for k, (a, b) in enumerate((((2.9, 6.6, 1.25), (-0.4, 7.4, 1.35)), ((2.9, 6.6, 1.25), (4.8, 7.0, 1.5)), ((1.2, 7.2, 1.4), (0.2, 6.8, 1.1)))):
        C.arc(C.path(rng, a, b, 6, 0.18, (1, 0.6, 0.3)), 0.006, (0.95, 0.9, 1.0), (0.66, 0.48, 1.0), 26, 10, f"fork{k}")
    for x, z, e in ((2.7, 1.5, 700), (0.8, 1.8, 380), (4.2, 1.8, 420), (-2.5, 2.0, 200)):
        C.point_light((x, 6.6, z), e, (0.72, 0.56, 1.0), 1.0)
    lib.area_light((0, 12, 5), (1, 6, 1.5), 1500, 14, (0.55, 0.5, 0.85))


def top500():
    rng = np.random.default_rng(16)
    lib.world((0.004, 0.003, 0.002), 1.0)
    gold = C.metal("gold", C.GOLD, 0.16)
    marble = lib.material("marble", base=(0.02, 0.02, 0.025), roughness=0.3, coat=0.15)
    velvet = lib.material("velvet", base=(0.07, 0.0, 0.012), roughness=1.0)
    velvet.node_tree.nodes["Principled BSDF"].inputs["Sheen Weight"].default_value = 0.12
    ruby = C.glass("ruby", (1.0, 0.08, 0.18), 1.76)
    diamond = C.glass("diamond", (0.95, 0.97, 1.0), 2.42)
    cx, cy = 2.05, 1.2
    # The pedestal: black marble with gold rims.
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=0.95, depth=1.1, location=(cx, cy, -0.75))
    C.mat_of(bpy.context.object, marble)
    bpy.ops.object.shade_smooth()
    for z in (-0.22, -1.28):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.96, minor_radius=0.04, location=(cx, cy, z))
        C.mat_of(bpy.context.object, gold)
        bpy.ops.object.shade_smooth()
    # The cushion, tasselled at the corners.
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, -0.06))
    cu = bpy.context.object
    cu.scale = (1.35, 1.35, 0.34)
    bpy.ops.object.transform_apply(scale=True)
    sub = cu.modifiers.new("s", "SUBSURF")
    sub.levels = 3
    sub.render_levels = 3
    cu.data.materials.append(velvet)
    bpy.ops.object.shade_smooth()
    for dx, dy in ((-0.5, -0.5), (0.5, -0.5), (-0.5, 0.5), (0.5, 0.5)):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.05, location=(cx + dx * 0.95, cy + dy * 0.95, -0.12))
        C.mat_of(bpy.context.object, gold)
    C.crown((cx, cy, 0.06), 0.6, gold, [ruby, diamond])
    # Gold dust in the light, near and far (the near specks out of focus).
    dust = C.emit("dust", (1.0, 0.8, 0.45), 14)
    for _ in range(140):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=4, radius=rng.uniform(0.004, 0.012), location=(rng.normal(cx, 0.9), rng.uniform(0.3, 3.5), rng.uniform(-0.5, 1.4)))
        bpy.context.object.data.materials.append(dust)
    # The vault behind: gold-lined columns fading into the dark.
    # The vault's back wall: a warm glow far behind in the haze.
    bpy.ops.mesh.primitive_plane_add(size=30, location=(1.5, 9, 0.5))
    wall = bpy.context.object
    wall.rotation_euler = (math.radians(90), 0, 0)
    C.mat_of(wall, lib.material("wall", base=(0.05, 0.035, 0.02), roughness=0.6))
    C.point_light((2.0, 7.5, 0.8), 400, (1.0, 0.7, 0.35), 2.0).visible_glossy = False
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 6, -1.3))
    C.mat_of(bpy.context.object, lib.material("vaultfloor", base=(0.02, 0.018, 0.016), roughness=0.55))
    C.spot((cx, cy - 0.3, 3.4), (cx, cy, 0.1), 3200, (1.0, 0.86, 0.6), angle=24, blend=0.5, size=0.2).visible_glossy = False
    lib.area_light((-3, -3, 2), (cx, cy, 0.2), 60, 2, (1.0, 0.85, 0.6)).visible_glossy = False
    C.point_light((cx + 1.2, cy - 1.0, 0.6), 60, (1.0, 0.8, 0.5), 0.3)
    lib.area_light((cx + 1.6, cy + 1.8, 1.4), (cx, cy, 0.3), 260, 1.2, (1.0, 0.85, 0.6))
    lib.area_light((cx - 1.8, cy - 1.2, 1.2), (cx, cy, 0.3), 120, 1.0, (1.0, 0.9, 0.75))
    C.fog(0.035, (1.0, 0.85, 0.6), size=(14, 14, 8), centre=(1.5, 3, 1))


# Top 500 is now rendered by cards_redo.py (Joe, 15 Nov 2026: more majesty).
SCENES = {
    "spark": (spark, dict(target=(0.1, 0, -0.05), location=(0, -7.0, 0.5), lens=38, dof_target=(2.0, 1.1, 0.0), fstop=4.0), (0.6, 14, 0.5), dict(highlight=(1.0, 0.62, 0.3), amount=0.35)),
    "charge": (charge, dict(CAM, dof_target=(2.0, 1.0, 0.1), fstop=4.0), (0.6, 16, 0.55), dict(highlight=(0.75, 1.0, 0.8), amount=0.3)),
    "volt": (volt, dict(location=(0, -7.6, 0.2), target=(0.3, 0, 0.0), lens=36, dof_target=(2.0, 1.4, 0.4), fstop=4.0), (0.58, 18, 0.6), dict(highlight=(0.75, 0.95, 1.0), amount=0.3)),
    "surge": (surge, dict(location=(0, -3.0, -0.55), target=(0.4, 4, -0.35), lens=30, dof_target=(2.2, 3.9, -0.3), fstop=5.6), (0.55, 18, 0.6), dict(highlight=(0.7, 0.82, 1.0), amount=0.3)),
    "storm": (storm, dict(location=(0, -5.0, -0.5), target=(0.5, 6, 0.55), lens=28), (0.6, 18, 0.6), dict(highlight=(0.85, 0.75, 1.0), amount=0.35)),
}

for name in sys.argv[1:] or list(SCENES):
    build, cam, bloom, tone = SCENES[name]
    C.run(f"card-art.tier.{name}", build, cam, samples=160, bloom=bloom, tone=tone)
