"""Joe's second-pass verdicts (15 Nov 2026): the card arts polished or redone, each keeping its original idea.

  emerald        POLISH: a seam of large, brilliant emerald crystals lit from within and behind, a step-cut stone at
                 their foot, green fire glinting
  frost          POLISH: a frozen lake furred with rime and hoar frost, ice crystals on every edge, colder blue dawn,
                 frost glitter catching the light
  neon-skyline   POLISH: calmer and clearer: fewer, larger towers against a clean dusk sky, a few neon accents, the moon
  royal          POLISH ("Royal Navy"): the original's crown, made regal: a gold crown with sapphires on a navy velvet
                 cushion with gold braid and tassels, a sceptre beside it, deep navy drapery
  tier.top-500   POLISH: more majesty: a great jewelled crown raised on its pedestal under a shaft of gold light, crimson
                 drapes and gold columns in the vault, light rays through haze
  crimson        REDO (a new concept): a crimson theatre curtain in heavy velvet folds, a gold rope tieback and tassel,
                 gold fringe, the stage lit warm
  diamond-plate  REDO (true to the name): polished steel tread plate set with brilliant-cut diamonds, one great stone in
                 front, white fire and glints
  static         REDO (keep the idea: TV static): a vintage television in a dark room, its curved glass screen full of
                 soft static and scanlines, its glow on the walnut cabinet

    python cards_redo.py [names…]
"""
import math
import os
import sys

import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import card_lib as C  # noqa: E402
import lib  # noqa: E402


def gradient_world(stops, strength=1.0):
    """A world whose colour follows the view's height: stops [(pos, (r, g, b)), …] on generated Z."""
    w = lib.world((0.0, 0.0, 0.0), strength)
    nt = w.node_tree
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = stops[0][0], (*stops[0][1], 1)
    els[1].position, els[1].color = stops[-1][0], (*stops[-1][1], 1)
    for pos, col in stops[1:-1]:
        els.new(pos).color = (*col, 1)
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], nt.nodes["Background"].inputs[0])
    nt.nodes["Background"].inputs[1].default_value = strength
    return w


def brilliant(loc, r, mat, rot=(0, 0, 0), name="brilliant"):
    """A round brilliant: table, star and kite facets on the crown, a girdle, pavilion mains to the culet."""
    n = 8
    verts = [(0, 0, r * 0.38)]  # 0: table centre
    table = [(r * 0.53 * math.cos(a), r * 0.53 * math.sin(a), r * 0.38) for a in np.linspace(0, math.tau, n, endpoint=False)]
    star = [(r * 0.78 * math.cos(a + math.pi / n), r * 0.78 * math.sin(a + math.pi / n), r * 0.24) for a in np.linspace(0, math.tau, n, endpoint=False)]
    girdle = [(r * math.cos(a), r * math.sin(a), 0.0) for a in np.linspace(0, math.tau, 2 * n, endpoint=False)]
    verts += table + star + girdle + [(0, 0, -r * 0.86)]
    T, S, G, cul = 1, 1 + n, 1 + 2 * n, 1 + 4 * n
    faces = []
    for i in range(n):
        j = (i + 1) % n
        faces.append((0, T + i, T + j))  # table (a fan)
        faces.append((T + i, S + i, T + j))  # star facet
        faces.append((T + i, G + 2 * i, S + i))  # kite, two halves
        faces.append((S + i, G + 2 * i, G + 2 * i + 1))
        faces.append((S + i, G + 2 * i + 1, G + (2 * i + 2) % (2 * n)))
        faces.append((T + j, S + i, G + (2 * i + 2) % (2 * n)))
    for i in range(2 * n):
        faces.append((G + i, cul, G + (i + 1) % (2 * n)))  # pavilion
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = rot
    o.data.materials.append(mat)
    return o


def diamond_material(name="diamond"):
    m = C.glass(name, (0.98, 0.99, 1.0), 2.42)
    b = m.node_tree.nodes["Principled BSDF"]
    if "Dispersion" in b.inputs:
        b.inputs["Dispersion"].default_value = 0.12
    return m


# ---------------------------------------------------------------------------------------------------- emerald


def emerald():
    rng = np.random.default_rng(127)
    lib.world((0.002, 0.008, 0.005), 1.0)
    rock = lib.material("rock", base=(0.035, 0.04, 0.04), roughness=0.7)
    n = rock.node_tree
    nz = n.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 7
    nz.inputs["Detail"].default_value = 12
    bump = n.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.9
    n.links.new(nz.outputs["Fac"], bump.inputs["Height"])
    n.links.new(bump.outputs["Normal"], n.nodes["Principled BSDF"].inputs["Normal"])
    C.heightfield("rock", 200, 120, 14, 8, lambda X, Y: 0.3 * C.fbm2(X, Y, 8, 5, 0.9), (0, 3, -1.0), rock)
    # Brilliant crystals: deep green glass with a faint inner glow, so they read as lit stone, not plastic.
    crystal = lib.material("emerald", base=(0.0, 0.62, 0.22), roughness=0.01, transmission=1.0, ior=1.58, emission=(0.0, 0.8, 0.3), strength=0.12)
    pale = lib.material("emerald2", base=(0.1, 0.85, 0.4), roughness=0.01, transmission=1.0, ior=1.58, emission=(0.1, 0.9, 0.4), strength=0.1)
    for k in range(26):
        big = k < 8
        h = rng.uniform(1.2, 2.4) if big else rng.uniform(0.4, 1.3)
        rad = rng.uniform(0.16, 0.26) if big else rng.uniform(0.06, 0.14)
        x, y = 2.15 + rng.normal(0, 0.55 if not big else 0.35), 1.5 + rng.normal(0, 0.35)
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=rad, depth=h, location=(0, 0, h / 2))
        body = bpy.context.object
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=rad, radius2=rad * 0.15, depth=rad * 1.3, location=(0, 0, h + rad * 0.65))
        tip = bpy.context.object
        bpy.ops.object.select_all(action="DESELECT")
        body.select_set(True)
        tip.select_set(True)
        bpy.context.view_layer.objects.active = body
        bpy.ops.object.join()
        bev = body.modifiers.new("b", "BEVEL")
        bev.width = rad * 0.06
        body.location = (x, y, -0.95)
        body.rotation_euler = (rng.normal(0, 0.3), rng.normal(0, 0.3), rng.uniform(0, 1))
        body.data.materials.append(crystal if k % 3 else pale)
    # A step-cut (emerald-cut) stone at their foot.
    bpy.ops.mesh.primitive_cube_add(size=1, location=(1.35, 0.3, -0.7))
    cut = bpy.context.object
    cut.scale = (0.42, 0.3, 0.16)
    bpy.ops.object.transform_apply(scale=True)
    bev = cut.modifiers.new("b", "BEVEL")
    bev.width = 0.07
    bev.segments = 3
    bev.profile = 0.15
    cut.rotation_euler = (math.radians(18), math.radians(-6), 0.35)
    cut.data.materials.append(crystal)
    # Light: a green glow from inside the seam, a cold back light through the crystals, a key from the top left.
    C.point_light((2.2, 1.9, -0.4), 220, (0.3, 1.0, 0.55), 0.5)
    lib.area_light((3.2, 4.5, 1.8), (2.1, 1.5, -0.3), 900, 2.5, (0.75, 1.0, 0.85))
    C.spot((0.4, -2.2, 2.8), (2.0, 1.2, -0.4), 1500, (1.0, 1.0, 0.95), 28, 0.5, 0.2)
    lib.area_light((5, 0, 0.6), (2.1, 1.4, -0.3), 220, 1.5, (0.9, 1.0, 0.9))
    C.fog(0.008, (0.6, 1.0, 0.75), size=(14, 10, 4), centre=(1.5, 3, 0.5))


# ---------------------------------------------------------------------------------------------------- frost


def frost():
    rng = np.random.default_rng(123)
    gradient_world([(0.0, (0.62, 0.78, 1.0)), (0.07, (0.32, 0.5, 0.9)), (0.3, (0.01, 0.03, 0.12))], 0.45)
    # The lake: white rime over ice (hoar frost in a fine voronoi crust).
    rime = lib.material("rime", base=(0.82, 0.9, 1.0), roughness=0.35)
    p = rime.node_tree.nodes["Principled BSDF"]
    p.inputs["Subsurface Weight"].default_value = 0.4
    p.inputs["Subsurface Radius"].default_value = (0.5, 0.7, 1.0)
    n = rime.node_tree
    vor = n.nodes.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 40
    nz = n.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 3
    nz.inputs["Detail"].default_value = 8
    mx = n.nodes.new("ShaderNodeMath")
    mx.operation = "ADD"
    bump = n.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.7
    n.links.new(vor.outputs["Distance"], mx.inputs[0])
    n.links.new(nz.outputs["Fac"], mx.inputs[1])
    n.links.new(mx.outputs[0], bump.inputs["Height"])
    n.links.new(bump.outputs["Normal"], p.inputs["Normal"])
    # A mix: frosted crust in patches, clear dark ice between (the frost pattern).
    ice = lib.material("ice", base=(0.2, 0.36, 0.7), roughness=0.04, transmission=0.4, ior=1.31)
    C.heightfield("lake", 260, 160, 40, 30, lambda X, Y: 0.02 * C.fbm2(X, Y, 3, 4, 2.0), (0, 14, -1.0), ice)
    C.heightfield("crust", 260, 160, 40, 30, lambda X, Y: 0.03 + 0.06 * C.fbm2(X, Y, 5, 5, 1.6) - 0.09 * (C.fbm2(X, Y, 9, 3, 0.7) < -0.1), (0, 14, -1.0), rime)
    rock = lib.material("rock", base=(0.5, 0.58, 0.7), roughness=0.75)
    C.heightfield("mtn", 200, 40, 40, 6, lambda X, Y: np.clip(2.4 * np.exp(-((X - 3) / 6) ** 2) + 1.2 * C.fbm2(X, Y, 4, 5, 0.5) + 0.6, 0, None) * np.exp(-((Y) / 2.5) ** 2), (0, 26, -1.0), rock)
    # Crystal spires on the right, each furred with rime at its base and glittering.
    crystal = lib.material("crystal", base=(0.85, 0.94, 1.0), roughness=0.02, transmission=0.95, ior=1.31)
    for k in range(16):
        h = rng.uniform(0.5, 2.0) * (1.4 if k < 5 else 1.0)
        x = 2.2 + rng.normal(0, 0.5)
        y = 1.4 + rng.normal(0, 0.35)
        bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=rng.uniform(0.12, 0.28), radius2=0.0, depth=h, location=(x, y, -1.0 + h / 2))
        o = bpy.context.object
        o.rotation_euler = (rng.normal(0, 0.18), rng.normal(0, 0.18), rng.uniform(0, 1))
        o.data.materials.append(crystal)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=rng.uniform(0.18, 0.32), location=(x, y, -1.0))
        b = bpy.context.object
        b.scale = (1.2, 1.2, 0.45)
        b.data.materials.append(rime)
    # Frost glitter: tiny bright ice crystals scattered on the crust near the spires and in the air.
    glit = C.emit("glitter", (0.85, 0.93, 1.0), 25)
    for _ in range(260):
        r = rng.uniform(0.004, 0.012)
        z = -0.96 if rng.random() < 0.75 else rng.uniform(-0.8, 0.8)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=r, location=(rng.normal(2.1, 1.1), rng.uniform(-0.2, 4.0), z))
        bpy.context.object.data.materials.append(glit)
    C.fog(0.012, (0.75, 0.86, 1.0), size=(60, 30, 3), centre=(0, 22, -0.5))
    sun = bpy.data.lights.new("dawn", "SUN")
    sun.energy = 2.6
    sun.color = (0.85, 0.92, 1.0)
    so = bpy.data.objects.new("dawn", sun)
    bpy.context.scene.collection.objects.link(so)
    so.rotation_euler = (math.radians(74), 0, math.radians(140))
    lib.area_light((4, 6, 1.2), (2.2, 1.4, -0.3), 260, 3, (0.7, 0.85, 1.0))


# ---------------------------------------------------------------------------------------------------- neon skyline


def neon_skyline():
    rng = np.random.default_rng(122)
    gradient_world([(0.0, (0.42, 0.1, 0.24)), (0.05, (0.16, 0.04, 0.2)), (0.14, (0.03, 0.02, 0.09)), (0.3, (0.004, 0.004, 0.02))], 1.0)
    from cards_shop import facade  # the lit-window facade

    mats = [facade(f"fa{k}", g) for k, g in enumerate((0.7, 0.5))]
    neons = {"pink": C.emit("pink", (1.0, 0.24, 0.8), 5), "cyan": C.emit("cyan", (0.13, 0.9, 1.0), 5)}
    # Two rows of larger towers on the right, low and few on the name side.
    for row, (y0, scale) in enumerate(((3.5, 1.0), (8.0, 1.5))):
        x = -3.5
        while x < 7.5:
            wdt = rng.uniform(0.55, 0.95) * scale
            right = x > 0.8
            if not right:
                x += 0.9
                continue
            hgt = rng.uniform(1.6, 3.4) * scale
            cx = x + wdt / 2
            bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, y0 + rng.uniform(0, 0.8), -1.0 + hgt / 2))
            o = bpy.context.object
            o.scale = (wdt, wdt * 0.8, hgt)
            o.data.materials.append(mats[rng.integers(0, 2)])
            x += wdt + rng.uniform(0.12, 0.35) * scale
    # A few neon accents only: two roof trims and one vertical sign.
    for (sx, sy, sz, w, h, c) in ((2.3, 3.0, 1.55, 0.9, 0.025, "pink"), (3.6, 7.2, 2.6, 1.3, 0.035, "cyan"), (1.6, 3.05, 0.6, 0.05, 0.7, "cyan")):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(sx, sy, sz))
        s = bpy.context.object
        s.scale = (w, 0.01, h)
        s.data.materials.append(neons[c])
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.9, location=(5.8, 30, 6.0))
    C.mat_of(bpy.context.object, C.emit("moon", (1.0, 0.85, 0.55), 3))
    bpy.ops.mesh.primitive_plane_add(size=80, location=(0, 20, -1.0))
    C.mat_of(bpy.context.object, lib.material("street", base=(0.01, 0.008, 0.015), roughness=0.15, coat=0.6))
    C.fog(0.02, (0.8, 0.5, 0.85), size=(50, 50, 2.5), centre=(1, 20, -0.8))
    lib.area_light((2, 14, -2.5), (2, 14, 2), 220, 20, (1.0, 0.35, 0.7))


# ---------------------------------------------------------------------------------------------------- royal


def royal():
    rng = np.random.default_rng(124)
    lib.world((0.003, 0.004, 0.014), 1.0)
    navy = lib.material("velvet", base=(0.006, 0.016, 0.11), roughness=0.95)
    p = navy.node_tree.nodes["Principled BSDF"]
    p.inputs["Sheen Weight"].default_value = 0.25
    p.inputs["Sheen Tint"].default_value = (0.35, 0.5, 1.0, 1)
    # Navy drapery behind, in deep vertical folds; a navy cloth on the table.
    C.heightfield("drape", 240, 60, 16, 4, lambda X, Y: 0.25 * np.sin(X * 3.2 + 0.6 * np.sin(X * 1.1)) + 0.05 * C.fbm2(X, Y, 3, 3, 2), (0, 4.5, 0.6), navy).rotation_euler = (math.radians(90), 0, 0)
    C.heightfield("cloth", 220, 120, 14, 8, lambda X, Y: 0.12 * C.fbm2(X, Y, 31, 4, 0.8), (0, 3, -0.95), navy)
    gold = C.metal("gold", C.GOLD, 0.12)
    braid = C.metal("braid", C.GOLD, 0.35)
    sapph = C.glass("sapph", (0.08, 0.22, 1.0), 1.77)
    diamond = diamond_material()
    cx, cy = 2.45, 1.35
    # The cushion, navy velvet with gold piping and tassels.
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, -0.68))
    cu = bpy.context.object
    cu.scale = (1.5, 1.5, 0.42)
    bpy.ops.object.transform_apply(scale=True)
    sub = cu.modifiers.new("s", "SUBSURF")
    sub.levels = sub.render_levels = 3
    cu.data.materials.append(navy)
    bpy.ops.object.shade_smooth()
    # Gold braid along the cushion's rim.
    bpy.ops.mesh.primitive_torus_add(major_radius=0.6, minor_radius=0.026, location=(cx, cy, -0.66))
    braid_ring = bpy.context.object
    braid_ring.scale = (1.0, 1.0, 1.0)
    C.mat_of(braid_ring, braid)
    C.crown((cx, cy, -0.47), 0.55, gold, [sapph, diamond])
    # The sceptre lying in front at an angle.
    a = math.radians(-24)
    L = 2.0
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.05, depth=L, location=(cx - 0.4, cy - 1.15, -0.82))
    rod = bpy.context.object
    rod.rotation_euler = (0, math.radians(90), a)
    rod.data.materials.append(gold)
    bpy.ops.object.shade_smooth()
    hx, hy = cx - 0.4 + math.cos(a) * L / 2, cy - 1.15 + math.sin(a) * L / 2
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.11, location=(hx, hy, -0.82))
    C.mat_of(bpy.context.object, gold)
    bpy.ops.object.shade_smooth()
    brilliant((hx + 0.05, hy - 0.06, -0.72), 0.07, sapph, rot=(0.9, 0, 0))
    C.spot((1.4, -1.0, 3.0), (cx, cy, -0.3), 1300, (1.0, 0.9, 0.72), 26, 0.6, 0.3)
    lib.area_light((cx + 2.2, cy + 1.6, 1.0), (cx, cy, -0.3), 200, 1.5, (0.55, 0.65, 1.0))
    lib.area_light((cx - 2.0, cy - 1.0, 1.2), (cx, cy, -0.3), 90, 1.5, (1.0, 0.85, 0.65))
    for _ in range(6):
        C.point_light((cx + rng.uniform(-0.8, 0.8), cy - 1.2, rng.uniform(-0.2, 0.6)), 6, (1.0, 0.95, 0.85), 0.02)


# ---------------------------------------------------------------------------------------------------- top 500


def top500():
    rng = np.random.default_rng(116)
    lib.world((0.004, 0.003, 0.002), 1.0)
    gold = C.metal("gold", C.GOLD, 0.12)
    marble = lib.material("marble", base=(0.02, 0.02, 0.025), roughness=0.25, coat=0.3)
    velvet = lib.material("velvet", base=(0.12, 0.0, 0.02), roughness=0.95)
    velvet.node_tree.nodes["Principled BSDF"].inputs["Sheen Weight"].default_value = 0.5
    ruby = C.glass("ruby", (1.0, 0.08, 0.18), 1.76)
    diamond = diamond_material()
    cx, cy = 2.1, 1.3
    # A tall stepped pedestal: the crown raised high.
    for k, (r, h) in enumerate(((1.0, 0.25), (0.85, 0.7), (1.0, 0.12))):
        z = -1.0 + sum(hh for _, hh in ((1.0, 0.25), (0.85, 0.7), (1.0, 0.12))[:k]) + h / 2
        bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=r, depth=h, location=(cx, cy, z))
        C.mat_of(bpy.context.object, marble)
        bpy.ops.object.shade_smooth()
        bpy.ops.mesh.primitive_torus_add(major_radius=r + 0.01, minor_radius=0.035, location=(cx, cy, z + h / 2))
        C.mat_of(bpy.context.object, gold)
        bpy.ops.object.shade_smooth()
    top = -1.0 + 1.07
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, top + 0.14))
    cu = bpy.context.object
    cu.scale = (1.3, 1.3, 0.3)
    bpy.ops.object.transform_apply(scale=True)
    sub = cu.modifiers.new("s", "SUBSURF")
    sub.levels = sub.render_levels = 3
    cu.data.materials.append(velvet)
    bpy.ops.object.shade_smooth()
    C.crown((cx, cy, top + 0.26), 0.68, gold, [ruby, diamond])
    # Crimson drapes either side of the vault and gold columns behind.
    C.heightfield("drapeL", 120, 50, 3, 5, lambda X, Y: 0.18 * np.sin(X * 6) + 0.03 * C.fbm2(X, Y, 1, 3, 2), (0.0, 4.0, 1.0), velvet).rotation_euler = (math.radians(90), 0, 0)
    C.heightfield("drapeR", 120, 50, 3, 5, lambda X, Y: 0.18 * np.sin(X * 6 + 1) + 0.03 * C.fbm2(X, Y, 2, 3, 2), (4.4, 4.0, 1.0), velvet).rotation_euler = (math.radians(90), 0, 0)
    for x in (0.9, 3.3):
        bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.18, depth=5, location=(x, 5.2, 1.0))
        C.mat_of(bpy.context.object, C.metal("col", C.GOLD, 0.3))
    # Gold dust in the shaft of light.
    dust = C.emit("dust", (1.0, 0.82, 0.48), 16)
    for _ in range(180):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=4, radius=rng.uniform(0.004, 0.012), location=(rng.normal(cx, 0.6), rng.uniform(0.3, 3.5), rng.uniform(-0.3, 2.2)))
        bpy.context.object.data.materials.append(dust)
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 6, -1.0))
    C.mat_of(bpy.context.object, lib.material("floor", base=(0.02, 0.018, 0.016), roughness=0.2, coat=0.6))
    # The shaft of gold light from above (rays through the haze), a warm back glow, sparkle lights.
    C.spot((cx, cy + 0.4, 5.5), (cx, cy, 0.2), 9000, (1.0, 0.84, 0.55), angle=16, blend=0.35, size=0.15).visible_glossy = False
    C.point_light((cx, 6.5, 1.5), 500, (1.0, 0.65, 0.3), 2.0).visible_glossy = False
    lib.area_light((cx + 1.6, cy - 1.8, 1.6), (cx, cy, 0.5), 300, 1.0, (1.0, 0.9, 0.75))
    lib.area_light((cx - 2.0, cy - 1.0, 1.0), (cx, cy, 0.5), 120, 1.0, (1.0, 0.85, 0.65))
    C.fog(0.05, (1.0, 0.85, 0.6), size=(14, 14, 8), centre=(1.5, 3, 1))


# ---------------------------------------------------------------------------------------------------- crimson


def crimson():
    rng = np.random.default_rng(128)
    lib.world((0.003, 0.0015, 0.002), 1.0)
    velvet = lib.material("velvet", base=(0.34, 0.0, 0.03), roughness=0.85)
    p = velvet.node_tree.nodes["Principled BSDF"]
    p.inputs["Sheen Weight"].default_value = 0.9
    p.inputs["Sheen Tint"].default_value = (1.0, 0.4, 0.4, 1)
    gold = C.metal("gold", C.GOLD, 0.2)
    # The curtain: heavy vertical folds, gathered towards the tieback on the right.
    def folds(X, Y):
        gather = np.exp(-((X - 2.4) / 1.6) ** 2)
        return 0.28 * np.sin(X * (4.0 + 6.0 * gather)) * (0.6 + 0.6 * gather) + 0.04 * C.fbm2(X, Y, 4, 3, 2.0)

    cur = C.heightfield("curtain", 320, 90, 12, 4.6, folds, (0.5, 2.6, 0.9), velvet)
    cur.rotation_euler = (math.radians(90), 0, 0)
    # The gold fringe along the hem.
    hem_y = lambda x: 2.6 - float(folds(np.array([x - 0.5]), np.array([-2.3]))[0])  # the cloth's front at the hem
    for x in np.linspace(-5.4, 6.4, 300):
        bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.011, depth=0.15, location=(x, hem_y(x) - 0.01, -1.42))
        bpy.context.object.data.materials.append(gold)
    pts_hem = [np.array((x, hem_y(x) - 0.012, -1.34)) for x in np.linspace(-5.4, 6.4, 400)]
    C.tube(pts_hem, 0.02, gold, "hem")
    # The gold rope tieback and its tassel.
    front = lambda x: 2.6 - float(folds(np.array([x - 0.5]), np.array([-0.25]))[0])
    pts = [np.array((x, front(x) - 0.06 - 0.12 * math.sin((x - 1.85) / 1.1 * math.pi), -0.25 + 0.06 * math.sin((x - 1.85) * 3))) for x in np.linspace(1.85, 2.95, 40)]
    C.tube(pts, 0.045, gold, "rope")
    # The tassel hangs from the rope's knot at the front.
    kx = 2.75
    ky = front(kx) - 0.2
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.09, location=(kx, ky, -0.3))
    C.mat_of(bpy.context.object, gold)
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.15, radius2=0.05, depth=0.48, location=(kx, ky, -0.62))
    C.mat_of(bpy.context.object, C.metal("tassel", C.GOLD, 0.45))
    # A polished stage floor catching the light.
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 4, -1.45))
    C.mat_of(bpy.context.object, lib.material("stage", base=(0.03, 0.015, 0.01), roughness=0.18, coat=0.5))
    C.spot((2.6, -2.5, 3.0), (2.4, 2.4, 0.0), 2600, (1.0, 0.82, 0.6), 30, 0.7, 0.4)
    lib.area_light((-2.5, -1.5, 2.0), (1.0, 2.4, 0.0), 40, 3, (1.0, 0.7, 0.6))
    C.point_light((3.4, 1.4, -1.2), 40, (1.0, 0.6, 0.3), 0.4)


# ---------------------------------------------------------------------------------------------------- diamond plate


def diamond_plate():
    rng = np.random.default_rng(121)
    gradient_world([(0.0, (0.01, 0.01, 0.012)), (0.5, (0.008, 0.008, 0.01)), (0.6, (0.55, 0.55, 0.58)), (0.66, (0.02, 0.02, 0.025)), (1.0, (0.12, 0.12, 0.13))], 1.0)
    steel = C.metal("steel", (0.45, 0.47, 0.5), 0.34)
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 6, -0.9))
    C.mat_of(bpy.context.object, steel)
    loz = C.metal("loz", (0.6, 0.62, 0.66), 0.36)
    for i in range(-14, 16):
        for j in range(-3, 22):
            x, y = i * 0.32, j * 0.32
            bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=1, location=(x, y, -0.9))
            o = bpy.context.object
            o.scale = (0.12, 0.03, 0.025)
            o.rotation_euler = (0, 0, math.radians(45 if (i + j) % 2 == 0 else -45))
            o.data.materials.append(loz)
    dia = diamond_material()
    brilliant((1.85, 0.6, -0.57), 0.6, dia, rot=(math.radians(22), math.radians(-12), 0.2), name="hero")
    for _ in range(12):
        r = rng.uniform(0.08, 0.2)
        brilliant((rng.uniform(1.1, 3.4), rng.uniform(0.6, 3.0), -0.9 + r * 0.42), r, dia, rot=(rng.uniform(-0.25, 0.25), rng.uniform(-0.25, 0.25), rng.uniform(0, 6)))
    # A jeweller's light: a big soft key, a hard spot for fire, small points for sparkle.
    lib.area_light((-3, -2.5, 3.5), (1.8, 1.2, -0.8), 170, 3, (1.0, 0.97, 0.94))
    C.spot((2.4, -2.2, 2.4), (1.85, 0.6, -0.57), 4200, (1.0, 1.0, 1.0), 9, 0.2, 0.03)
    for x, y, z, e in ((1.0, -1.2, 1.6, 180), (3.4, -0.6, 1.0, 160), (2.2, 2.6, 1.6, 140), (0.6, 0.4, 0.4, 60)):
        C.point_light((x, y, z), e, (1.0, 1.0, 1.0), 0.02)


# ---------------------------------------------------------------------------------------------------- static


def static():
    lib.world((0.004, 0.004, 0.006), 1.0)
    walnut = lib.material("walnut", base=(0.09, 0.045, 0.022), roughness=0.3, coat=0.8)
    n = walnut.node_tree
    wave = n.nodes.new("ShaderNodeTexWave")
    wave.inputs["Scale"].default_value = 4
    wave.inputs["Distortion"].default_value = 6
    ramp = n.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.05, 0.025, 0.012, 1)
    ramp.color_ramp.elements[1].color = (0.13, 0.07, 0.035, 1)
    n.links.new(wave.outputs["Fac"], ramp.inputs[0])
    n.links.new(ramp.outputs[0], n.nodes["Principled BSDF"].inputs["Base Color"])
    cx, cy, cz = 2.2, 1.6, -0.15
    # The cabinet.
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy + 0.35, cz))
    cab = bpy.context.object
    cab.scale = (1.9, 1.3, 1.4)
    bpy.ops.object.transform_apply(scale=True)
    bev = cab.modifiers.new("b", "BEVEL")
    bev.width = 0.12
    bev.segments = 5
    cab.data.materials.append(walnut)
    # The screen: a bulging glass face over static (white noise, fine scanlines), softly lit.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=2.2, location=(cx - 0.15, cy - 1.95, cz + 0.05))
    sc = bpy.context.object
    sc.scale = (1.0, 1.0, 1.0)
    sm = lib.material("screen", base=(0.02, 0.02, 0.025), roughness=0.05, coat=1.0)
    nt = sm.node_tree
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (170, 170, 170)
    wn = nt.nodes.new("ShaderNodeTexWhiteNoise")
    snap = nt.nodes.new("ShaderNodeVectorMath")
    snap.operation = "SNAP"
    snap.inputs[1].default_value = (1, 1, 1)
    lines = nt.nodes.new("ShaderNodeTexWave")
    lines.bands_direction = "Z"
    lines.inputs["Scale"].default_value = 110
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul2 = nt.nodes.new("ShaderNodeMath")
    mul2.operation = "MULTIPLY"
    mul2.inputs[1].default_value = 1.6
    tint = nt.nodes.new("ShaderNodeMix")
    tint.data_type = "RGBA"
    tint.inputs["A"].default_value = (0.75, 0.85, 1.0, 1)
    tint.inputs["B"].default_value = (1.0, 1.0, 1.0, 1)
    nt.links.new(tc.outputs["Object"], mp.inputs[0])
    nt.links.new(mp.outputs[0], snap.inputs[0])
    nt.links.new(snap.outputs[0], wn.inputs["Vector"])
    nt.links.new(tc.outputs["Object"], lines.inputs["Vector"])
    nt.links.new(wn.outputs["Value"], mul.inputs[0])
    nt.links.new(lines.outputs["Fac"], mul.inputs[1])
    nt.links.new(mul.outputs[0], mul2.inputs[0])
    nt.links.new(wn.outputs["Value"], tint.inputs["Factor"])
    b = nt.nodes["Principled BSDF"]
    nt.links.new(tint.outputs["Result"], b.inputs["Emission Color"])
    nt.links.new(mul2.outputs[0], b.inputs["Emission Strength"])
    sc.data.materials.append(sm)
    # Only the screen's front cap shows, inside a dark bezel cut in the cabinet front.
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx - 0.15, cy - 0.3, cz + 0.05))
    cutter = bpy.context.object
    cutter.scale = (1.25, 0.6, 0.95)
    bpy.ops.object.transform_apply(scale=True)
    boo = sc.modifiers.new("in", "BOOLEAN")
    boo.operation = "INTERSECT"
    boo.object = cutter
    cutter.hide_render = True
    bezel = lib.material("bezel", base=(0.012, 0.012, 0.014), roughness=0.4)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx - 0.15, cy - 0.26, cz + 0.05))
    bz = bpy.context.object
    bz.scale = (1.42, 0.06, 1.12)
    bpy.ops.object.transform_apply(scale=True)
    bevb = bz.modifiers.new("b", "BEVEL")
    bevb.width = 0.08
    bevb.segments = 4
    bz.data.materials.append(bezel)
    # Two knobs and a speaker grille on the right of the cabinet front.
    brass = C.metal("brass", C.CHAMPAGNE, 0.3)
    for z in (0.25, -0.15):
        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.08, depth=0.08, location=(cx + 0.78, cy - 0.32, cz + z))
        k = bpy.context.object
        k.rotation_euler = (math.radians(90), 0, 0)
        k.data.materials.append(brass)
    # The room: a floor, the screen's own glow on the walls.
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 4, -0.85))
    C.mat_of(bpy.context.object, lib.material("floor", base=(0.02, 0.02, 0.025), roughness=0.4))
    C.point_light((cx - 0.15, cy - 1.0, cz), 25, (0.75, 0.85, 1.0), 0.8)
    lib.area_light((-2.0, -2.0, 2.4), (cx, cy, cz), 110, 3, (1.0, 0.85, 0.7))
    lib.area_light((cx + 1.5, cy + 2.5, 1.5), (cx, cy, cz), 30, 2, (0.6, 0.7, 1.0))


SCENES = {
    "emerald": (emerald, dict(location=(0.3, -5.0, 0.2), target=(0.8, 1.6, -0.15), lens=40, dof_target=(2.1, 1.5, -0.35), fstop=4.0), (0.58, 16, 0.6), dict(highlight=(0.75, 1.0, 0.82), amount=0.25), dict(threshold=0.9, count=30, length=9)),
    "frost": (frost, dict(location=(0, -6.5, -0.35), target=(0.3, 8, -0.25), lens=34, dof_target=(2.1, 1.6, -0.4), fstop=5.6), (0.7, 12, 0.4), dict(shadow=(0.02, 0.05, 0.16), highlight=(0.82, 0.92, 1.0), amount=0.3), dict(threshold=0.9, count=45, length=7)),
    "neon-skyline": (neon_skyline, dict(location=(-0.5, -4.0, 1.6), target=(0.8, 10, 0.9), lens=32), (0.6, 14, 0.45), None, None),
    "royal": (royal, dict(location=(0.4, -3.0, 0.5), target=(1.5, 1.2, -0.4), lens=40, dof_target=(2.45, 1.35, -0.3), fstop=3.2), (0.62, 14, 0.45), dict(shadow=(0.01, 0.03, 0.16), highlight=(1.0, 0.86, 0.55), amount=0.3), dict(threshold=0.92, count=24, length=8)),
    "tier.top-500": (top500, dict(location=(0, -6.0, 0.3), target=(0.4, 1.2, 0.35), lens=40, dof_target=(2.1, 1.3, 0.5), fstop=3.2), (0.58, 20, 0.6), dict(highlight=(1.0, 0.82, 0.45), amount=0.35), dict(threshold=0.93, count=30, length=9)),
    "crimson": (crimson, dict(location=(0, -4.8, 0.0), target=(0.8, 2.6, -0.2), lens=34, dof_target=(2.6, 2.3, -0.2), fstop=4.0), (0.62, 14, 0.45), dict(shadow=(0.06, 0.0, 0.02), highlight=(1.0, 0.82, 0.6), amount=0.25), None),
    "diamond-plate": (diamond_plate, dict(location=(0, -5.6, 1.2), target=(0.3, 1.0, -0.8), lens=36, dof_target=(1.85, 0.6, -0.57), fstop=2.8), (0.72, 12, 0.45), None, dict(threshold=0.86, count=36, length=12)),
    "static": (static, dict(location=(0.2, -4.6, 0.3), target=(1.5, 1.4, -0.2), lens=36, dof_target=(2.05, 1.3, -0.1), fstop=4.0), (0.72, 10, 0.3), None, None),
}

if __name__ == "__main__":
    for name in sys.argv[1:] or list(SCENES):
        build, cam, bloom, tone, glint = SCENES[name]
        C.card(int(os.environ.get("SAMPLES", 128)))
        build()
        lib.camera(**cam)
        png = os.path.join(lib.TMP, f"card-art.{name}.png")
        secs = lib.render(png)
        from PIL import Image

        img = Image.open(png)
        if bloom:
            img = lib.bloom(img, *bloom)
        if tone:
            img = lib.split_tone(img, **tone)
        if glint:
            img = C.glints(img, **glint)
        q = 86
        while True:
            _, size = lib.save_webp(img, f"card-art.{name}", quality=q)
            if size <= 78 * 1024 or q <= 60:
                break
            q -= 6
        print(f"card-art.{name}: {secs:.1f} s, {size / 1024:.1f} KB")
