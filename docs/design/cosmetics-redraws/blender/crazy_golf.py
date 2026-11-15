"""Crazy Golf's default course look (default.crazy-golf.course): textures and sprites rendered top down in Blender,
lit from the top left as the course is, painted by src/lib/arcade/minigolf.renderer.ts into its cached hole canvas.

  turf     a 512 px tile (256 world px): grass blades as hair, two greens, seamless
  paving   a 368 x 184 tile (184 x 92 world px, one period of the staggered slabs): bevelled sandstone slabs
  stone    a 256 px tile: dressed stone for the rails' coping, seamless
  sand     a 256 px tile: fine sand with wind ripples, seamless
  boulder  three 128 px sprites: weathered rocks with moss, their contact shadow on transparent
  planter  a 128 px sprite: a carved stone bowl with a clipped box shrub
  shrub    two 128 px sprites: flowering shrubs for the garden beds

`python crazy_golf.py [name ...]`, with bpy 5.3 (pip install bpy).
"""
import math
import os
import sys

import bpy
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib  # noqa: E402

RNG = np.random.default_rng(1515)


def seamless(img):
    """Make a texture tile: blend it with its copies rolled by half a tile across, down and both, each weighted so
    its own seam (where the roll wrapped) gets no weight. The edges then match across the wrap."""
    a = np.asarray(img).astype(np.float32)
    h, w = a.shape[:2]
    rx = np.roll(a, w // 2, axis=1)
    ry = np.roll(a, h // 2, axis=0)
    rxy = np.roll(rx, h // 2, axis=0)
    wx = (1 - np.abs(np.linspace(-1, 1, w)))[None, :, None]
    wy = (1 - np.abs(np.linspace(-1, 1, h)))[:, None, None]
    out = a * wx * wy + rx * (1 - wx) * wy + ry * wx * (1 - wy) + rxy * (1 - wx) * (1 - wy)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


def topdown(size_world, px_w, px_h, transparent=False, samples=96):
    s = lib.reset(px_w, px_h, samples=samples, transparent=transparent)
    s.view_settings.look = "AgX - Medium High Contrast"
    lib.camera((size_world[0] / 2, size_world[1] / 2, 20), (size_world[0] / 2, size_world[1] / 2, 0), ortho_scale=max(size_world))
    return s


def sun(strength=3.2):
    """The key from the top left (the course's light), soft, and a cool sky fill."""
    l = bpy.data.lights.new("sun", "SUN")
    l.energy = strength
    l.angle = math.radians(12)
    l.color = (1.0, 0.95, 0.86)
    o = bpy.data.objects.new("sun", l)
    bpy.context.scene.collection.objects.link(o)
    o.rotation_euler = (math.radians(40), math.radians(-28), math.radians(-35))
    lib.world((0.42, 0.48, 0.58), 0.25)


def noise_colour(mat, scale, c0, c1, detail=6):
    nt = mat.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = scale
    n.inputs["Detail"].default_value = detail
    r = nt.nodes.new("ShaderNodeValToRGB")
    r.color_ramp.elements[0].color = (*c0, 1)
    r.color_ramp.elements[1].color = (*c1, 1)
    nt.links.new(tc.outputs["Object"], n.inputs["Vector"])
    nt.links.new(n.outputs["Fac"], r.inputs[0])
    nt.links.new(r.outputs[0], b.inputs["Base Color"])
    return n


def bump(mat, scale, strength, distance=0.02, detail=8):
    nt = mat.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    t = nt.nodes.new("ShaderNodeTexNoise")
    t.inputs["Detail"].default_value = detail
    t.inputs["Scale"].default_value = scale
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = strength
    bp.inputs["Distance"].default_value = distance
    nt.links.new(tc.outputs["Object"], t.inputs["Vector"])
    nt.links.new(t.outputs["Fac"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])


def finish(name, png, quality=86, make_seamless=False):
    img = Image.open(png)
    img = img.convert("RGBA" if bpy.context.scene.render.film_transparent else "RGB")
    if make_seamless:
        img = seamless(img)
    return lib.save_webp(img, name, quality=quality)


# ---------------------------------------------------------------- turf


def turf():
    """A mown green seen from above: fine blades (stretched noise, so they read as blade tips), two greens and a
    yellower thatch between them, a few clover leaves; lit from the top left."""
    topdown((1.0, 1.0), 512, 512, samples=64)
    sun(3.6)
    bpy.ops.mesh.primitive_plane_add(size=1.4, location=(0.5, 0.5, 0))
    m = lib.material("grass", base=(0.13, 0.36, 0.1), roughness=0.62)
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Subsurface Weight"].default_value = 0.1
    tc = nt.nodes.new("ShaderNodeTexCoord")
    # Blade tips: a fine noise stretched along one direction, a second across it.
    blades = []
    for sx, sy, rot in ((520, 150, 0.4), (520, 150, -0.9)):
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Rotation"].default_value = (0, 0, rot)
        mp.inputs["Scale"].default_value = (sx, sy, 1)
        n = nt.nodes.new("ShaderNodeTexNoise")
        n.inputs["Scale"].default_value = 1.0
        n.inputs["Detail"].default_value = 2
        nt.links.new(tc.outputs["Object"], mp.inputs[0])
        nt.links.new(mp.outputs[0], n.inputs["Vector"])
        blades.append(n)
    mx = nt.nodes.new("ShaderNodeMath")
    mx.operation = "MAXIMUM"
    nt.links.new(blades[0].outputs["Fac"], mx.inputs[0])
    nt.links.new(blades[1].outputs["Fac"], mx.inputs[1])
    # Patches: a broad, soft variation between two greens.
    patch = nt.nodes.new("ShaderNodeTexNoise")
    patch.inputs["Scale"].default_value = 5
    patch.inputs["Detail"].default_value = 3
    nt.links.new(tc.outputs["Object"], patch.inputs["Vector"])
    soft = nt.nodes.new("ShaderNodeMath")
    soft.operation = "MULTIPLY"
    soft.inputs[1].default_value = 0.3
    nt.links.new(patch.outputs["Fac"], soft.inputs[0])
    shade = nt.nodes.new("ShaderNodeMath")
    shade.operation = "MULTIPLY_ADD"
    shade.inputs[1].default_value = 1.0
    nt.links.new(mx.outputs[0], shade.inputs[0])
    nt.links.new(soft.outputs[0], shade.inputs[2])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.55, (0.02, 0.09, 0.02, 1)
    els[1].position, els[1].color = 1.05, (0.22, 0.44, 0.1, 1)
    e = els.new(0.78)
    e.color = (0.06, 0.22, 0.04, 1)
    e2 = els.new(0.92)
    e2.color = (0.13, 0.34, 0.07, 1)
    nt.links.new(shade.outputs[0], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], b.inputs["Base Color"])
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.8
    bp.inputs["Distance"].default_value = 0.002
    nt.links.new(mx.outputs[0], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    bpy.context.object.data.materials.append(m)
    png = os.path.join(lib.TMP, "mg-turf.png")
    secs = lib.render(png)
    return secs, finish("mg.turf", png, quality=78, make_seamless=True)


# ---------------------------------------------------------------- paving

SLAB = 0.25  # one slab: 46 world px


def paving():
    # One period: 4 slabs across, 2 rows (the second row offset by half a slab). 184 x 92 world px.
    W, H = SLAB * 4, SLAB * 2
    s = lib.reset(368, 184, samples=96)
    s.view_settings.look = "AgX - Base Contrast"
    lib.camera((W / 2, H / 2, 20), (W / 2, H / 2, 0), ortho_scale=W)
    sun(3.4)
    bpy.ops.mesh.primitive_plane_add(size=4, location=(W / 2, H / 2, -0.004))
    gravel = lib.material("grout", base=(0.07, 0.065, 0.06), roughness=1.0)
    bump(gravel, 300, 0.6, 0.002)
    bpy.context.object.data.materials.append(gravel)
    tints = [(0.62, 0.5, 0.36), (0.52, 0.42, 0.31), (0.7, 0.58, 0.43), (0.58, 0.47, 0.35), (0.47, 0.39, 0.3)]
    mats = []
    for i, t in enumerate(tints):
        m = lib.material(f"slab{i}", base=t, roughness=0.78)
        noise_colour(m, 22, tuple(c * 0.82 for c in t), tuple(min(1, c * 1.12) for c in t), detail=10)
        bump(m, 26, 0.9, 0.006, detail=10)
        mats.append(m)
    for row in range(2):
        off = row * SLAB / 2
        for col in range(-1, 5):
            x = col * SLAB + off + SLAB / 2
            y = H - (row * SLAB + SLAB / 2)
            idx = (row * 4 + col) % 8  # the same slab one period over, so the tile repeats seamlessly
            rng = np.random.default_rng(idx + 3)
            dz, rx, ry, rz = rng.uniform(0, 0.003), rng.uniform(-0.01, 0.01), rng.uniform(-0.01, 0.01), rng.uniform(-0.012, 0.012)
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, 0.006 + dz))
            o = bpy.context.object
            o.scale = (SLAB - 0.012, SLAB - 0.012, 0.014)
            o.rotation_euler = (rx, ry, rz)
            bpy.ops.object.transform_apply(scale=True)
            bev = o.modifiers.new("bev", "BEVEL")
            bev.width = 0.007
            bev.segments = 3
            o.data.materials.append(mats[idx % len(mats)])
    png = os.path.join(lib.TMP, "mg-paving.png")
    secs = lib.render(png)
    return secs, finish("mg.paving", png, quality=82)


# ---------------------------------------------------------------- stone coping and sand


def stone():
    topdown((1.0, 1.0), 256, 256, samples=64)
    sun(3.2)
    bpy.ops.mesh.primitive_plane_add(size=1.4, location=(0.5, 0.5, 0))
    m = lib.material("stone", base=(0.55, 0.47, 0.37), roughness=0.82)
    noise_colour(m, 9, (0.38, 0.3, 0.22), (0.78, 0.68, 0.52), detail=10)
    bump(m, 18, 1.0, 0.02, detail=14)
    bpy.context.object.data.materials.append(m)
    png = os.path.join(lib.TMP, "mg-stone.png")
    secs = lib.render(png)
    return secs, finish("mg.stone", png, quality=82, make_seamless=True)


def sand():
    topdown((1.0, 1.0), 256, 256, samples=64)
    sun(3.0)
    bpy.ops.mesh.primitive_plane_add(size=1.4, location=(0.5, 0.5, 0))
    m = lib.material("sand", base=(0.86, 0.74, 0.5), roughness=0.95)
    noise_colour(m, 60, (0.7, 0.57, 0.35), (0.96, 0.86, 0.62), detail=6)
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.inputs["Scale"].default_value = 9
    wave.inputs["Distortion"].default_value = 4
    grain = nt.nodes.new("ShaderNodeTexNoise")
    grain.inputs["Scale"].default_value = 400
    add = nt.nodes.new("ShaderNodeMath")
    add.operation = "ADD"
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.45
    bp.inputs["Distance"].default_value = 0.012
    nt.links.new(tc.outputs["Object"], wave.inputs["Vector"])
    nt.links.new(tc.outputs["Object"], grain.inputs["Vector"])
    nt.links.new(wave.outputs["Fac"], add.inputs[0])
    nt.links.new(grain.outputs["Fac"], add.inputs[1])
    nt.links.new(add.outputs[0], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    bpy.context.object.data.materials.append(m)
    png = os.path.join(lib.TMP, "mg-sand.png")
    secs = lib.render(png)
    return secs, finish("mg.sand", png, quality=82, make_seamless=True)


# ---------------------------------------------------------------- sprites (transparent, contact shadow)


def sprite_scene():
    """A 1 x 1 unit square seen from above; the sprite's footprint is the circle of radius 0.4 (80 % of the frame)."""
    s = topdown((1.0, 1.0), 128, 128, transparent=True, samples=128)
    sun(3.4)
    bpy.ops.mesh.primitive_plane_add(size=2, location=(0.5, 0.5, 0))
    bpy.context.object.is_shadow_catcher = True
    return s


def boulder(k):
    sprite_scene()
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=5, radius=0.38, location=(0.5, 0.5, 0.12))
    o = bpy.context.object
    # Each rock its own form: the mesh turned before the displacement, so the same textures fall differently.
    o.rotation_euler = (k * 0.9, k * 1.7, k * 2.3)
    bpy.ops.object.transform_apply(rotation=True)
    o.scale = (1.0, 0.86 + 0.05 * k, 0.6)
    tex = bpy.data.textures.new(f"rock{k}", "VORONOI")
    tex.noise_scale = 0.22 + 0.06 * k
    d = o.modifiers.new("d", "DISPLACE")
    d.texture = tex
    d.strength = 0.11
    tex2 = bpy.data.textures.new(f"rockn{k}", "CLOUDS")
    tex2.noise_scale = 0.12
    d2 = o.modifiers.new("d2", "DISPLACE")
    d2.texture = tex2
    d2.strength = 0.03
    bpy.ops.object.shade_smooth()
    m = lib.material(f"rock{k}", base=(0.3, 0.28, 0.26), roughness=0.85)
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    # Moss on the upward faces, broken up by noise.
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = 14
    mix = nt.nodes.new("ShaderNodeMath")
    mix.operation = "MULTIPLY"
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.5
    ramp.color_ramp.elements[0].color = (0.3 + 0.03 * k, 0.28, 0.26, 1)
    ramp.color_ramp.elements[1].position = 0.68
    ramp.color_ramp.elements[1].color = (0.16, 0.26, 0.08, 1)
    nt.links.new(geo.outputs["Normal"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], mix.inputs[0])
    nt.links.new(n.outputs["Fac"], mix.inputs[1])
    nt.links.new(mix.outputs[0], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], b.inputs["Base Color"])
    bump(m, 40, 0.6, 0.01, detail=12)
    o.data.materials.append(m)
    png = os.path.join(lib.TMP, f"mg-boulder{k}.png")
    secs = lib.render(png)
    return secs, finish(f"mg.boulder-{k}", png, quality=88)


def leafy(name, centre, radius, count, colours, flowers=None, flower_count=0, height=0.2, base_z=0.0):
    """A clipped shrub: a dome of small leaves with flowers on top."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1)
    proto = bpy.context.object
    mats = [lib.material(f"{name}l{i}", base=c, roughness=0.6) for i, c in enumerate(colours)]
    for m in mats:
        m.node_tree.nodes["Principled BSDF"].inputs["Subsurface Weight"].default_value = 0.2
    meshes = []
    for m in mats:
        me = proto.data.copy()
        me.materials.append(m)
        meshes.append(me)
    for i in range(count):
        a = RNG.uniform(0, math.tau)
        r = radius * math.sqrt(RNG.uniform(0, 1))
        z = base_z + height * math.sqrt(max(0, 1 - (r / radius) ** 2)) + RNG.uniform(0, 0.02)
        o = bpy.data.objects.new(f"{name}{i}", meshes[i % len(meshes)])
        bpy.context.scene.collection.objects.link(o)
        o.location = (centre[0] + math.cos(a) * r, centre[1] + math.sin(a) * r, z)
        sz = RNG.uniform(0.022, 0.04)
        o.scale = (sz, sz * 0.55, sz * 0.3)
        o.rotation_euler = (RNG.uniform(0, 1), RNG.uniform(0, 1), RNG.uniform(0, math.tau))
    if flowers:
        fm = [lib.material(f"{name}f{i}", base=c, roughness=0.5) for i, c in enumerate(flowers)]
        for i in range(flower_count):
            a = RNG.uniform(0, math.tau)
            r = radius * 0.9 * math.sqrt(RNG.uniform(0, 1))
            z = base_z + height * math.sqrt(max(0, 1 - (r / radius) ** 2)) + 0.03
            bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.016, location=(centre[0] + math.cos(a) * r, centre[1] + math.sin(a) * r, z))
            bpy.context.object.data.materials.append(fm[i % len(fm)])
    bpy.data.objects.remove(proto)


def planter():
    sprite_scene()
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.4, depth=0.14, location=(0.5, 0.5, 0.07))
    bowl = bpy.context.object
    bev = bowl.modifiers.new("bev", "BEVEL")
    bev.width = 0.02
    bev.segments = 4
    m = lib.material("bowl", base=(0.7, 0.64, 0.55), roughness=0.75)
    bump(m, 30, 0.4, 0.005)
    bowl.data.materials.append(m)
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.33, depth=0.02, location=(0.5, 0.5, 0.141))
    bpy.context.object.data.materials.append(lib.material("soil2", base=(0.08, 0.05, 0.03), roughness=1))
    leafy("box", (0.5, 0.5), 0.3, 900, [(0.08, 0.26, 0.07), (0.12, 0.34, 0.09), (0.06, 0.2, 0.06)], height=0.16, base_z=0.15)
    png = os.path.join(lib.TMP, "mg-planter.png")
    secs = lib.render(png)
    return secs, finish("mg.planter", png, quality=88)


def shrub(k):
    sprite_scene()
    flowers = [[(0.95, 0.35, 0.55), (1.0, 0.85, 0.9)], [(0.98, 0.78, 0.25), (0.95, 0.95, 0.9)]][k]
    leafy(f"shrub{k}", (0.5, 0.5), 0.38, 1100, [(0.09, 0.27, 0.08), (0.14, 0.36, 0.1), (0.07, 0.22, 0.07)], flowers, 140, height=0.22)
    png = os.path.join(lib.TMP, f"mg-shrub{k}.png")
    secs = lib.render(png)
    return secs, finish(f"mg.shrub-{k}", png, quality=86)


JOBS = {
    "turf": turf,
    "paving": paving,
    "stone": stone,
    "sand": sand,
    "boulder-0": lambda: boulder(0),
    "boulder-1": lambda: boulder(1),
    "boulder-2": lambda: boulder(2),
    "planter": planter,
    "shrub-0": lambda: shrub(0),
    "shrub-1": lambda: shrub(1),
}
only = sys.argv[1:]
for name, job in JOBS.items():
    if only and name not in only:
        continue
    secs, (path, size) = job()
    print(f"crazy-golf {name}: {secs:.1f} s render, {size / 1024:.1f} KB -> {os.path.basename(path)}")
