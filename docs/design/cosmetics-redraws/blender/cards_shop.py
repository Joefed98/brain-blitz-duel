"""The shop's and the pass's card arts, one scene each:

  diamond-plate  gold tread plate in a jeweller's light, a scatter of cut diamonds on it, one large stone in front
  neon-skyline   a city at dusk from a rooftop: lit towers, neon signs, a violet sky with a gold moon over the haze
  frost          a frozen lake at dawn: cracked ice, crystal spires on the right, mountains in cold mist
  royal          regalia on deep blue velvet: a gold sceptre and an orb, folds of cloth catching the light
  lava           a lava field at night: black crust broken by glowing cracks, a molten channel, steam and embers
  crimson        crimson satin in deep folds, a gold ring resting in them, one warm light
  emerald        a cave seam of raw emerald crystals growing from dark rock, a cut stone at their foot
  sunburst       a golden sunrise over a sea of cloud, rays breaking through the haze

    python cards_shop.py [names…]
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


def diamond_plate():
    rng = np.random.default_rng(21)
    lib.world((0.01, 0.008, 0.006), 1.0)
    gold = C.metal("plate", (1.0, 0.76, 0.38), 0.28)
    nt = gold.node_tree
    # Tread: raised diamonds in alternate directions (a bump from two crossed wave patterns).
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (2.6, 2.6, 2.6)
    br = nt.nodes.new("ShaderNodeTexBrick")
    br.inputs["Scale"].default_value = 1.0
    br.inputs["Mortar Size"].default_value = 0.0
    br.offset = 0.5
    br.inputs["Brick Width"].default_value = 0.5
    br.inputs["Row Height"].default_value = 0.25
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.feature = "DISTANCE_TO_EDGE"
    vor.inputs["Scale"].default_value = 3.2
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = 0.02
    mr.inputs["From Max"].default_value = 0.08
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.8
    nt.links.new(tc.outputs["Object"], mp.inputs[0])
    nt.links.new(mp.outputs[0], vor.inputs["Vector"])
    nt.links.new(vor.outputs["Distance"], mr.inputs["Value"])
    nt.links.new(mr.outputs[0], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], nt.nodes["Principled BSDF"].inputs["Normal"])
    # The plate itself, with real raised lozenges.
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 6, -0.9))
    C.mat_of(bpy.context.object, gold)
    loz = C.metal("loz", (1.0, 0.78, 0.4), 0.18)
    for i in range(-14, 16):
        for j in range(-3, 22):
            x, y = i * 0.32, j * 0.32
            bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=1, location=(x, y, -0.9))
            o = bpy.context.object
            o.scale = (0.12, 0.03, 0.025)
            o.rotation_euler = (0, 0, math.radians(45 if (i + j) % 2 == 0 else -45))
            o.data.materials.append(loz)
    stone = C.glass("dia", (0.97, 0.98, 1.0), 2.42)
    sb = stone.node_tree.nodes["Principled BSDF"]
    if "Dispersion" in sb.inputs:
        sb.inputs["Dispersion"].default_value = 0.08
    C.gem((2.0, 0.5, -0.5), 0.6, stone, rot=(math.radians(14), math.radians(-8), 0.3))
    for _ in range(9):
        r = rng.uniform(0.09, 0.22)
        C.gem((rng.uniform(1.0, 3.3), rng.uniform(0.4, 2.6), -0.9 + r * 0.6), r, stone, rot=(rng.uniform(-1.4, 1.4), rng.uniform(-1.4, 1.4), rng.uniform(0, 6)))
    for x, y, z, e in ((1.0, -1.2, 1.6, 300), (3.2, -0.6, 1.2, 200), (2.0, 2.5, 1.8, 160)):
        C.point_light((x, y, z), e, (1.0, 0.95, 0.88), 0.05)
    lib.area_light((-4, -3, 4), (1.5, 1.5, -0.8), 260, 4, (1.0, 0.92, 0.8))


def facade(name, glow):
    """Dark glass with lit windows on a grid (white noise on the snapped cell picks which are lit)."""
    m = lib.material(name, base=(0.012, 0.014, 0.03), metallic=0.5, roughness=0.2)
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (9, 9, 7)
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], mp.inputs[0])
    nt.links.new(mp.outputs[0], sep.inputs[0])

    def op(o, a, b_=None, v=None):
        n = nt.nodes.new("ShaderNodeMath")
        n.operation = o
        nt.links.new(a, n.inputs[0])
        if b_ is not None:
            nt.links.new(b_, n.inputs[1])
        if v is not None:
            n.inputs[1].default_value = v
        return n.outputs[0]

    h = op("ADD", sep.outputs["X"], sep.outputs["Y"])
    v = sep.outputs["Z"]
    fh, fv = op("FRACT", h), op("FRACT", v)
    win = op("MULTIPLY", op("MULTIPLY", op("GREATER_THAN", fh, v=0.2), op("LESS_THAN", fh, v=0.8)), op("MULTIPLY", op("GREATER_THAN", fv, v=0.25), op("LESS_THAN", fv, v=0.7)))
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(op("FLOOR", h), comb.inputs[0])
    nt.links.new(op("FLOOR", v), comb.inputs[1])
    wn = nt.nodes.new("ShaderNodeTexWhiteNoise")
    nt.links.new(comb.outputs[0], wn.inputs["Vector"])
    lit = op("MULTIPLY", win, op("LESS_THAN", wn.outputs["Value"], v=0.17))
    b.inputs["Emission Color"].default_value = (1.0, 0.82, 0.55, 1)
    nt.links.new(op("MULTIPLY", lit, v=glow), b.inputs["Emission Strength"])
    return m


def neon_skyline():
    rng = np.random.default_rng(22)
    w = lib.world((0.0, 0.0, 0.0), 1.0)
    nt = w.node_tree
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.22, 0.04, 0.16, 1)
    ramp.color_ramp.elements[1].position = 0.3
    ramp.color_ramp.elements[1].color = (0.004, 0.004, 0.02, 1)
    ramp.color_ramp.elements.new(0.1).color = (0.06, 0.015, 0.1, 1)
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], nt.nodes["Background"].inputs[0])
    mats = [facade(f"fa{k}", g) for k, g in enumerate((1.6, 1.1, 2.2))]
    neons = [C.emit(f"neon{k}", c, 6) for k, c in enumerate(((1.0, 0.24, 0.8), (0.13, 0.9, 1.0), (1.0, 0.75, 0.3)))]
    for row, (y0, scale) in enumerate(((2.0, 0.9), (4.5, 1.0), (7.5, 1.2), (11.0, 1.5), (15.0, 1.9), (20.0, 2.4))):
        x = -6.0 - row * 1.5
        while x < 9 + row * 1.5:
            wdt = rng.uniform(0.35, 0.8) * scale
            hgt = rng.uniform(0.9, 3.2) * scale * (1.2 if x > 1 else 0.7) * (0.3 if x < 0 and row < 4 else 1.0)
            cx = x + wdt / 2
            bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, y0 + rng.uniform(0, 1.2), -1.0 + hgt / 2))
            o = bpy.context.object
            o.scale = (wdt, wdt * 0.8, hgt)
            o.data.materials.append(mats[rng.integers(0, 3)])
            if rng.random() < 0.6:
                bpy.ops.mesh.primitive_cube_add(size=1, location=(cx + rng.uniform(-0.3, 0.3) * wdt, o.location.y - wdt * 0.42, -1.0 + hgt * rng.uniform(0.35, 0.85)))
                s = bpy.context.object
                s.scale = (wdt * 0.08, 0.01, hgt * rng.uniform(0.12, 0.3))
                s.data.materials.append(neons[rng.integers(0, 3)])
            if rng.random() < 0.5:
                bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, o.location.y - wdt * 0.41, -1.0 + hgt - 0.02))
                t = bpy.context.object
                t.scale = (wdt * 0.98, 0.01, 0.025)
                t.data.materials.append(neons[rng.integers(0, 3)])
            x += wdt + rng.uniform(0.05, 0.3) * scale
    # The moon, gold through the haze.
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.9, location=(4.2, 30, 5.2))
    C.mat_of(bpy.context.object, C.emit("moon", (1.0, 0.82, 0.45), 4))
    C.fog(0.03, (0.8, 0.45, 0.85), size=(50, 50, 3), centre=(1, 20, -0.5))
    lib.area_light((2, 14, -2.5), (2, 14, 2), 400, 20, (1.0, 0.3, 0.7))


def frost():
    rng = np.random.default_rng(23)
    w = lib.world((0.0, 0.0, 0.0), 1.0)
    nt = w.node_tree
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.55, 0.68, 0.95, 1)
    ramp.color_ramp.elements[1].position = 0.3
    ramp.color_ramp.elements[1].color = (0.015, 0.04, 0.14, 1)
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], nt.nodes["Background"].inputs[0])
    nt.nodes["Background"].inputs[1].default_value = 0.35
    ramp.color_ramp.elements.new(0.08).color = (1.0, 0.6, 0.62, 1)
    ice = lib.material("ice", base=(0.45, 0.65, 0.95), roughness=0.08, transmission=0.3, ior=1.31)
    n = ice.node_tree
    vor = n.nodes.new("ShaderNodeTexVoronoi")
    vor.feature = "DISTANCE_TO_EDGE"
    vor.inputs["Scale"].default_value = 1.6
    bump = n.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.4
    bump.invert = True
    mr = n.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Max"].default_value = 0.03
    n.links.new(vor.outputs["Distance"], mr.inputs["Value"])
    n.links.new(mr.outputs[0], bump.inputs["Height"])
    n.links.new(bump.outputs["Normal"], n.nodes["Principled BSDF"].inputs["Normal"])
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 15, -1.0))
    C.mat_of(bpy.context.object, ice)
    # Mountains far off.
    rock = lib.material("rock", base=(0.28, 0.32, 0.42), roughness=0.8)
    C.heightfield("mtn", 200, 40, 40, 6, lambda X, Y: np.clip(2.4 * np.exp(-((X - 3) / 6) ** 2) + 1.2 * C.fbm2(X, Y, 4, 5, 0.5) + 0.6, 0, None) * np.exp(-((Y) / 2.5) ** 2), (0, 26, -1.0), rock)
    # Crystal spires on the right.
    crystal = lib.material("crystal", base=(0.82, 0.92, 1.0), roughness=0.02, transmission=0.95, ior=1.31)
    for k in range(13):
        h = rng.uniform(0.6, 2.2) * (1.35 if k < 4 else 1.0)
        x = 2.2 + rng.normal(0, 0.45)
        y = 1.4 + rng.normal(0, 0.35)
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=rng.uniform(0.14, 0.3), radius2=0.0, depth=h, location=(x, y, -1.0 + h / 2))
        o = bpy.context.object
        o.rotation_euler = (rng.normal(0, 0.18), rng.normal(0, 0.18), rng.uniform(0, 1))
        o.data.materials.append(crystal)
    C.fog(0.008, (0.7, 0.82, 1.0), size=(60, 30, 3), centre=(0, 22, -0.5))
    sun = bpy.data.lights.new("dawn", "SUN")
    sun.energy = 3
    sun.color = (1.0, 0.85, 0.75)
    so = bpy.data.objects.new("dawn", sun)
    bpy.context.scene.collection.objects.link(so)
    so.rotation_euler = (math.radians(70), 0, math.radians(130))


def cloth(name, colour, seed, sx, sy, loc, amp=0.12, freq=1.6, mat=None):
    m = mat or lib.material(name, base=colour, roughness=0.8)
    p = m.node_tree.nodes["Principled BSDF"]
    if "Sheen Weight" in p.inputs:
        p.inputs["Sheen Weight"].default_value = 0.6
        p.inputs["Sheen Tint"].default_value = (0.45, 0.6, 1.0, 1)
    return C.heightfield(name, 220, 120, sx, sy, lambda X, Y: amp * C.fbm2(X, Y, seed, 4, freq), loc, m)


def royal():
    lib.world((0.004, 0.005, 0.015), 1.0)
    cloth("velvet", (0.03, 0.07, 0.4), 31, 14, 8, (0, 3, -0.9), 0.32, 0.55)
    gold = C.metal("gold", C.GOLD, 0.14)
    sapph = C.glass("sapph", (0.1, 0.25, 1.0), 1.77)
    ruby = C.glass("ruby", (1.0, 0.06, 0.15), 1.76)
    # The sceptre: a long gold rod with rings, a jewelled head.
    sx, sy = 1.75, 0.6
    a = math.radians(-32)
    L = 2.3
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.075, depth=L, location=(sx + 0.6, sy, -0.55))
    rod = bpy.context.object
    rod.rotation_euler = (0, math.radians(90), a)
    rod.data.materials.append(gold)
    bpy.ops.object.shade_smooth()
    for t in (-0.4, 0.0, 0.35):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.075, minor_radius=0.025, location=(sx + 0.6 + math.cos(a) * L * t, sy + math.sin(a) * L * t, -0.62))
        r = bpy.context.object
        r.rotation_euler = (0, math.radians(90), a)
        r.data.materials.append(gold)
    hx, hy = sx + 0.6 + math.cos(a) * L * 0.5, sy + math.sin(a) * L * 0.5
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.16, location=(hx, hy, -0.6))
    C.mat_of(bpy.context.object, gold)
    bpy.ops.object.shade_smooth()
    C.gem((hx + 0.02, hy - 0.12, -0.5), 0.1, ruby, rot=(1.2, 0, 0))
    # The orb: gold with a jewelled band and a cross.
    ox, oy = 2.6, 1.9
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=0.42, location=(ox, oy, -0.42))
    C.mat_of(bpy.context.object, gold)
    bpy.ops.object.shade_smooth()
    bpy.ops.mesh.primitive_torus_add(major_radius=0.425, minor_radius=0.03, location=(ox, oy, -0.42))
    C.mat_of(bpy.context.object, gold)
    for k in range(10):
        b_ = k * math.tau / 10
        C.gem((ox + math.cos(b_) * 0.44, oy + math.sin(b_) * 0.44, -0.42), 0.04, sapph if k % 2 else ruby, rot=(math.pi / 2, 0, b_ + math.pi / 2))
    bpy.ops.mesh.primitive_cube_add(size=1, location=(ox, oy, 0.12))
    c = bpy.context.object
    c.scale = (0.05, 0.05, 0.3)
    c.data.materials.append(gold)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(ox, oy, 0.16))
    c = bpy.context.object
    c.scale = (0.2, 0.05, 0.05)
    c.data.materials.append(gold)
    C.spot((1.2, -1.5, 3.2), (2.0, 1.3, -0.6), 1600, (1.0, 0.9, 0.75), 34, 0.6, 0.4)
    lib.area_light((5, 2, 2), (2, 1.3, -0.6), 60, 3, (0.5, 0.6, 1.0))
    lib.area_light((-2, 3, 2.5), (2.4, 1.6, -0.5), 120, 2, (1.0, 0.8, 0.5))


def lava():
    rng = np.random.default_rng(25)
    lib.world((0.005, 0.003, 0.003), 1.0)
    crust = lib.material("crust", base=(0.025, 0.02, 0.02), roughness=0.85)
    nt = crust.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.feature = "DISTANCE_TO_EDGE"
    vor.inputs["Scale"].default_value = 1.3
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 3
    mix = nt.nodes.new("ShaderNodeMath")
    mix.operation = "ADD"
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = 0.0
    mr.inputs["From Max"].default_value = 0.035
    mr.inputs["To Min"].default_value = 9.0
    mr.inputs["To Max"].default_value = 0.0
    nt.links.new(tc.outputs["Object"], vor.inputs["Vector"])
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    sc = nt.nodes.new("ShaderNodeMath")
    sc.operation = "MULTIPLY"
    sc.inputs[1].default_value = 0.04
    nt.links.new(nz.outputs["Fac"], sc.inputs[0])
    nt.links.new(vor.outputs["Distance"], mix.inputs[0])
    nt.links.new(sc.outputs[0], mix.inputs[1])
    nt.links.new(mix.outputs[0], mr.inputs["Value"])
    b.inputs["Emission Color"].default_value = (1.0, 0.24, 0.03, 1)
    sepx = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sepx.inputs[0])
    side = nt.nodes.new("ShaderNodeMapRange")
    side.inputs["From Min"].default_value = -2.5
    side.inputs["From Max"].default_value = 1.5
    calm = nt.nodes.new("ShaderNodeMath")
    calm.operation = "MULTIPLY"
    nt.links.new(sepx.outputs["X"], side.inputs["Value"])
    nt.links.new(mr.outputs[0], calm.inputs[0])
    nt.links.new(side.outputs[0], calm.inputs[1])
    nt.links.new(calm.outputs[0], b.inputs["Emission Strength"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.8
    nt.links.new(nz.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    C.heightfield("field", 260, 140, 18, 12, lambda X, Y: 0.25 * C.fbm2(X, Y, 5, 5, 0.8) - 0.4 * np.exp(-((X - 2.3 - 0.4 * Y) / 0.45) ** 2), (0, 4, -1.0), crust)
    # The molten channel running towards us on the right.
    molten = lib.material("molten", base=(0.2, 0.05, 0.02), roughness=0.4, emission=(1.0, 0.36, 0.05), strength=3)
    C.heightfield("channel", 80, 140, 18, 12, lambda X, Y: -0.32 + 0.03 * C.fbm2(X, Y, 6, 3, 2.0) + -100 * (np.abs(X - 2.3 - 0.4 * Y) > 0.42), (0, 4, -1.0), molten)
    for _ in range(70):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=rng.uniform(0.006, 0.016), location=(rng.normal(2.3, 0.8), rng.uniform(0, 4), rng.uniform(-0.6, 1.2)))
        C.mat_of(bpy.context.object, C.emit("ember", (1.0, 0.5, 0.15), rng.uniform(8, 24)))
    C.noise_volume("steam", (2.3, 4, 0.2), (5, 7, 2.0), 0.25, (0.6, 0.5, 0.48), noise_scale=0.7, lo=0.45, hi=0.85)
    C.point_light((2.3, 2.5, -0.4), 160, (1.0, 0.35, 0.08), 1.0)
    lib.area_light((-5, 8, 3), (0, 0, 0), 40, 6, (0.5, 0.5, 0.8))


def crimson():
    lib.world((0.004, 0.002, 0.003), 1.0)
    satin = lib.material("satin", base=(0.32, 0.0, 0.025), roughness=0.26, coat=0.15)
    p = satin.node_tree.nodes["Principled BSDF"]
    p.inputs["Sheen Weight"].default_value = 0.6
    if "Anisotropic" in p.inputs:
        p.inputs["Anisotropic"].default_value = 0.6
    C.heightfield("satin", 260, 140, 12, 7, lambda X, Y: 0.34 * np.abs(np.sin(X * 1.7 + 0.8 * np.sin(Y * 1.1))) ** 0.7 * np.exp(-((X - 1.8) / 3.2) ** 2) + 0.08 * C.fbm2(X, Y, 7, 3, 1.5), (0, 2.5, -0.9), satin)
    gold = C.metal("gold", C.GOLD, 0.12)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.34, minor_radius=0.075, location=(2.15, 1.2, -0.45))
    r = bpy.context.object
    r.rotation_euler = (math.radians(62), 0, math.radians(20))
    r.data.materials.append(gold)
    bpy.ops.object.shade_smooth()
    C.gem((2.15 + 0.06, 1.2 - 0.18, -0.12), 0.11, C.glass("ruby", (1.0, 0.07, 0.12), 1.76), rot=(0.5, 0, 0.3))
    C.spot((5.0, 0.0, 0.6), (1.5, 1.6, -0.6), 2200, (1.0, 0.6, 0.55), 45, 0.8, 0.8)
    lib.area_light((-3, -2, 3), (2, 1, -0.6), 25, 3, (1.0, 0.75, 0.7))


def emerald():
    rng = np.random.default_rng(27)
    lib.world((0.002, 0.005, 0.004), 1.0)
    rock = lib.material("rock", base=(0.04, 0.045, 0.045), roughness=0.75)
    n = rock.node_tree
    nz = n.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 6
    nz.inputs["Detail"].default_value = 10
    bump = n.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.9
    n.links.new(nz.outputs["Fac"], bump.inputs["Height"])
    n.links.new(bump.outputs["Normal"], n.nodes["Principled BSDF"].inputs["Normal"])
    C.heightfield("rock", 200, 120, 14, 8, lambda X, Y: 0.35 * C.fbm2(X, Y, 8, 5, 0.9), (0, 3, -1.0), rock)
    crystal = lib.material("emerald", base=(0.1, 0.85, 0.42), roughness=0.03, transmission=0.9, ior=1.58)
    for k in range(16):
        h = rng.uniform(0.4, 1.8)
        x, y = 2.1 + rng.normal(0, 0.5), 1.5 + rng.normal(0, 0.4)
        rad = rng.uniform(0.07, 0.17)
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=rad, depth=h, location=(0, 0, h / 2))
        body = bpy.context.object
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=rad, radius2=0.0, depth=rad * 1.6, location=(0, 0, h + rad * 0.8))
        tip = bpy.context.object
        bpy.ops.object.select_all(action="DESELECT")
        body.select_set(True)
        tip.select_set(True)
        bpy.context.view_layer.objects.active = body
        bpy.ops.object.join()
        body.location = (x, y, -0.95)
        body.rotation_euler = (rng.normal(0, 0.35), rng.normal(0, 0.35), rng.uniform(0, 1))
        body.data.materials.append(crystal)
    cut = C.glass("cut", (0.12, 0.9, 0.45), 1.58)
    C.gem((1.45, 0.3, -0.62), 0.26, cut, rot=(math.radians(70), 0, 0.4))
    C.point_light((2.1, 1.0, 0.0), 150, (0.4, 1.0, 0.6), 0.6)
    C.spot((1.0, -2, 2.5), (2.0, 1.2, -0.5), 900, (0.9, 1.0, 0.9), 30, 0.6, 0.3)
    C.fog(0.03, (0.6, 0.9, 0.7), size=(14, 10, 4), centre=(1.5, 3, 0.5))


def sunburst():
    """A golden sunrise seen from above a sea of cloud: the sun low on the right, its light raking the cloud tops."""
    w = lib.world((0.0, 0.0, 0.0), 1.0)
    nt = w.node_tree
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    # The world's generated Z is the view direction's height: 0 at the horizon.
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (1.0, 0.5, 0.15, 1)
    ramp.color_ramp.elements[1].position = 0.22
    ramp.color_ramp.elements[1].color = (0.01, 0.02, 0.09, 1)
    ramp.color_ramp.elements.new(0.06).color = (0.55, 0.18, 0.22, 1)
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], nt.nodes["Background"].inputs[0])
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.4, location=(7.0, 40, 0.4))
    C.mat_of(bpy.context.object, C.emit("sun", (1.0, 0.85, 0.55), 24))
    cloud = lib.material("cloud", base=(0.98, 0.95, 0.97), roughness=1.0)
    p = cloud.node_tree.nodes["Principled BSDF"]
    p.inputs["Subsurface Weight"].default_value = 0.6
    p.inputs["Subsurface Radius"].default_value = (1.0, 0.7, 0.5)
    C.heightfield("clouds", 320, 200, 60, 40, lambda X, Y: 0.7 * np.abs(C.fbm2(X, Y, 12, 5, 0.3)) + 0.18 * np.abs(C.fbm2(X, Y, 13, 3, 1.0)), (0, 20, -1.2), cloud)
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 3
    sun.color = (1.0, 0.72, 0.42)
    sun.angle = math.radians(3)
    so = bpy.data.objects.new("sun", sun)
    bpy.context.scene.collection.objects.link(so)
    so.rotation_euler = (math.radians(86), 0, math.radians(190))
    C.fog(0.0015, (1.0, 0.8, 0.6), size=(80, 60, 6), centre=(0, 30, 0.5))
    lib.area_light((0, 0, 10), (0, 20, -1), 300, 30, (0.35, 0.45, 0.9))


# Diamond Plate, Neon Skyline, Frost, Royal, Crimson and Emerald are now rendered by cards_redo.py (Joe, 15 Nov 2026);
# their first second-pass scenes stay here for reference.
SCENES = {
    "lava": (lava, dict(location=(0, -5.5, 0.6), target=(0.4, 3, -0.6), lens=34, dof_target=(2.3, 2.5, -0.6), fstop=4.5), (0.55, 18, 0.6), None),
    "sunburst": (sunburst, dict(location=(0, -4.0, 0.3), target=(1.0, 20, 0.0), lens=30), (0.55, 24, 0.7), dict(highlight=(1.0, 0.8, 0.45), amount=0.3)),
}

if __name__ == "__main__":
    for name in sys.argv[1:] or list(SCENES):
        build, cam, bloom, tone = SCENES[name]
        C.run(f"card-art.{name}", build, cam, samples=160, bloom=bloom, tone=tone)
