"""Apex's Neon Night world theme (world-theme.apex.neon-night): the track running through a glowing neon city.

Renders, for the racing renderer's cached layers (src/lib/arcade/racing.renderer.ts; sizes in its px, x1.6):
  apex.sky        the night sky above the horizon (390 x 205 -> 624 x 328)
  apex.city-far   the far skyline, seamless round the full 360 (1885 x 70 -> 3016 x 112), hazy, deep
  apex.city-near  a nearer band of towers in front of it, seamless (1885 x 58 -> 3016 x 93), transparent above
  apex.tower-0..2 three roadside skyscrapers in place of the trees (60 x 120 -> 120 x 240), transparent
Buildings are dark glass with lit window grids (a few warm, most cool), neon signs and trims in pink, cyan and gold,
red beacons on the roofs; the far city sits in a violet haze lit from below by the streets.
"""
import math
import os
import sys

import bpy
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib  # noqa: E402

PINK, CYAN, GOLD = (1.0, 0.24, 0.8), (0.13, 0.9, 1.0), (1.0, 0.75, 0.3)
K = 1.6  # render scale over the renderer's px
WRAP = 1885.0


def facade_material(name, window_scale, lit_share, warm_share, glass=(0.012, 0.014, 0.03), glow=1.6):
    """Dark glass with a grid of windows, some lit (white noise on the snapped grid decides which)."""
    m = lib.material(name, base=glass, metallic=0.4, roughness=0.22)
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (window_scale, window_scale, window_scale * 0.8)
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], mp.inputs[0])
    nt.links.new(mp.outputs[0], sep.inputs[0])

    def node(op, a=None, b_=None, val=None):
        n = nt.nodes.new("ShaderNodeMath")
        n.operation = op
        if a is not None:
            nt.links.new(a, n.inputs[0])
        if b_ is not None:
            nt.links.new(b_, n.inputs[1])
        if val is not None:
            n.inputs[1].default_value = val
        return n.outputs[0]

    # Horizontal coordinate along the face (x or y, whichever the face spans) and height.
    h = node("ADD", sep.outputs["X"], sep.outputs["Y"])
    v = sep.outputs["Z"]
    fh, fv = node("FRACT", h), node("FRACT", v)
    win = node("MULTIPLY", node("MULTIPLY", node("GREATER_THAN", fh, val=0.22), node("LESS_THAN", fh, val=0.78)), node("MULTIPLY", node("GREATER_THAN", fv, val=0.25), node("LESS_THAN", fv, val=0.72)))
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(node("FLOOR", h), comb.inputs[0])
    nt.links.new(node("FLOOR", v), comb.inputs[1])
    wn = nt.nodes.new("ShaderNodeTexWhiteNoise")
    wn.noise_dimensions = "3D"
    nt.links.new(comb.outputs[0], wn.inputs["Vector"])
    sepc = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(wn.outputs["Color"], sepc.inputs[0])
    lit = node("MULTIPLY", win, node("LESS_THAN", wn.outputs["Value"], val=lit_share))
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["A"].default_value = (0.55, 0.78, 1.0, 1)
    mix.inputs["B"].default_value = (1.0, 0.78, 0.45, 1)
    nt.links.new(node("LESS_THAN", sepc.outputs[1], val=warm_share), mix.inputs["Factor"])
    nt.links.new(mix.outputs["Result"], b.inputs["Emission Color"])
    strength = node("MULTIPLY", lit, val=glow)
    nt.links.new(strength, b.inputs["Emission Strength"])
    return m


def box(x, y, w, d, h, mat, z0=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z0 + h / 2))
    o = bpy.context.object
    o.scale = (w, d, h)
    bpy.ops.object.transform_apply(scale=True)
    bev = o.modifiers.new("bevel", "BEVEL")
    bev.width = min(w, d) * 0.03
    bev.segments = 2
    o.data.materials.append(mat)
    return o


def neon(x, y, z, w, h, colour, strength=5):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z))
    o = bpy.context.object
    o.scale = (w, 0.6, h)
    o.data.materials.append(lib.emission_material(f"neon{colour}", colour, strength))


def beacon(x, y, z, r):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=(x, y, z))
    bpy.context.object.data.materials.append(lib.emission_material("beacon", (1.0, 0.12, 0.08), 30))


def city_band(seed, height_range, width_range, depth_rows, window_scale, sign_share, ymin, glow=1.2):
    """Buildings along x round the wrap (each one near an end is copied a wrap away, so the strip tiles)."""
    rng = np.random.default_rng(seed)
    mats = [facade_material(f"f{seed}{i}", window_scale * s, ls, 0.25, glow=glow) for i, (s, ls) in enumerate(((1.0, 0.3), (1.3, 0.22), (0.8, 0.36)))]
    for row in range(depth_rows):
        x = rng.uniform(0, 12)
        y = ymin + row * 40
        while x < WRAP:
            w = rng.uniform(*width_range)
            h = rng.uniform(*height_range) * (0.75 + 0.25 * (depth_rows - row) / depth_rows)
            mat = mats[rng.integers(0, len(mats))]
            for dx in (0, -WRAP, WRAP):
                cx = x + w / 2 + dx
                if cx + w < -20 or cx - w > WRAP + 20:
                    continue
                box(cx, y, w, 24, h, mat)
                if rng.random() < 0.35:  # a stepped crown
                    box(cx, y, w * 0.6, 18, h * 0.12, mat, z0=h)
                if rng.random() < sign_share:
                    col = (PINK, CYAN, GOLD)[rng.integers(0, 3)]
                    sh = rng.uniform(0.08, 0.3) * h
                    neon(cx + rng.uniform(-0.25, 0.25) * w, y - 12.4, h * rng.uniform(0.3, 0.85), max(1.2, w * 0.07), sh, col)
                if rng.random() < 0.5:
                    col = (PINK, CYAN, GOLD)[rng.integers(0, 3)]
                    neon(cx, y - 12.4, h - 0.8, w * 0.96, 0.9, col, 4)  # a trim along the roof line
                if rng.random() < 0.3:
                    beacon(cx, y, h + 2 + (h * 0.12 if rng.random() < 0.35 else 0), 0.9)
            x += w + rng.uniform(1, 6)


def haze(z_top, density, colour=(0.45, 0.16, 0.7)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(WRAP / 2, 120, z_top / 2 - 10))
    o = bpy.context.object
    o.scale = (WRAP * 1.4, 300, z_top + 20)
    m = bpy.data.materials.new("haze")
    m.use_nodes = True
    nt = m.node_tree
    for nd in list(nt.nodes):
        nt.nodes.remove(nd)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (*colour, 1)
    vol.inputs["Density"].default_value = density
    # Denser near the ground (the streets' glow).
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = -0.5
    mr.inputs["From Max"].default_value = 0.5
    mr.inputs["To Min"].default_value = 1.0
    mr.inputs["To Max"].default_value = 0.1
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = density
    em = nt.nodes.new("ShaderNodeMath")
    em.operation = "MULTIPLY"
    em.inputs[1].default_value = 0.0035
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
    nt.links.new(mr.outputs[0], mul.inputs[0])
    nt.links.new(mul.outputs[0], vol.inputs["Density"])
    nt.links.new(mr.outputs[0], em.inputs[0])
    nt.links.new(em.outputs[0], vol.inputs["Emission Strength"])
    vol.inputs["Emission Color"].default_value = (1.0, 0.3, 0.75, 1)
    nt.links.new(vol.outputs[0], out.inputs["Volume"])
    o.data.materials.append(m)


def strip_camera(height_px):
    cam = lib.camera((WRAP / 2, -800, height_px / 2), (WRAP / 2, 0, height_px / 2), ortho_scale=WRAP)
    return cam


def render_strip(name, height_px, setup, samples):
    s = lib.reset(int(WRAP * K), int(round(height_px * K)), samples=samples, transparent=True)
    s.cycles.volume_bounces = 1
    lib.world((0.0, 0.0, 0.0), 0.0)
    setup()
    strip_camera(height_px)
    png = os.path.join(lib.TMP, f"{name}.png")
    secs = lib.render(png)
    img = Image.open(png).convert("RGBA")
    path, size = lib.save_webp(img, name, quality=84)
    print(f"{name}: {secs:.1f} s, {size / 1024:.1f} KB")


def sky():
    """The night sky: deep navy to a violet glow on the horizon (the city's light), stars, a thin moon."""
    s = lib.reset(int(390 * K), int(205 * K), samples=64)
    w = lib.world((0.0, 0.0, 0.0), 1.0)
    nt = w.node_tree
    bg = nt.nodes["Background"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.16, 0.03, 0.2, 1)
    ramp.color_ramp.elements[1].position = 0.32
    ramp.color_ramp.elements[1].color = (0.003, 0.004, 0.018, 1)
    ramp.color_ramp.elements.new(0.08).color = (0.05, 0.02, 0.11, 1)
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], bg.inputs[0])
    rng = np.random.default_rng(5)
    star = lib.emission_material("star", (0.9, 0.93, 1.0), 9)
    for _ in range(320):
        a = rng.uniform(-0.85, 0.85)
        e = rng.uniform(0.1, 0.75)
        d = 400
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=rng.choice([0.35, 0.5, 0.8], p=[0.6, 0.3, 0.1]), location=(d * math.sin(a), d * math.cos(a) * math.cos(e), d * math.sin(e)))
        bpy.context.object.data.materials.append(star)
    # The moon: a lit sphere with its shadow side.
    bpy.ops.mesh.primitive_uv_sphere_add(radius=10, location=(-120, 400, 150))
    moon = bpy.context.object
    moon.data.materials.append(lib.material("moon", base=(0.85, 0.84, 0.8), roughness=0.9))
    bpy.ops.object.shade_smooth()
    lib.area_light((300, 380, 260), (-120, 400, 150), 4.0e6, 40, (1.0, 0.95, 0.85))
    lib.camera((0, 0, 0), (0, 400, 52), lens=18)
    png = os.path.join(lib.TMP, "apex.sky.png")
    secs = lib.render(png)
    img = lib.bloom(Image.open(png), threshold=0.5, radius=8, amount=0.5)
    path, size = lib.save_webp(img, "apex.sky", quality=86)
    print(f"apex.sky: {secs:.1f} s, {size / 1024:.1f} KB")


def far():
    city_band(11, (18, 66), (14, 34), 3, 0.42, 0.18, 30, glow=0.9)
    haze(70, 0.004)


def near():
    city_band(23, (16, 54), (22, 48), 1, 0.3, 0.45, 0, glow=1.6)
    # The street glow along the base.
    lib.area_light((WRAP / 2, -60, -6), (WRAP / 2, 0, 20), 3.0e6, 300, PINK)


def towers():
    for v in range(3):
        s = lib.reset(120, 240, samples=96, transparent=True)
        lib.world((0.0, 0.0, 0.0), 0.0)
        rng = np.random.default_rng(100 + v)
        mat = facade_material(f"t{v}", 0.24, 0.42, 0.3, glow=2.0)
        h = 104
        w = 34 + v * 4
        box(0, 0, w, w, h, mat)
        box(0, 0, w * 0.7, w * 0.7, 12, mat, z0=h)
        if v == 1:
            box(0, 0, w * 0.45, w * 0.45, 8, mat, z0=h + 12)
        col = (PINK, CYAN, GOLD)[v]
        for z in (h - 0.6, h * 0.62):
            bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, z))
            o = bpy.context.object
            o.scale = (w + 0.6, w + 0.6, 0.9)
            o.data.materials.append(lib.emission_material(f"trim{v}", col, 4))
        # A vertical sign down one corner.
        neon(w * 0.42, -w / 2 - 0.4, h * 0.5, 2.2, h * 0.36, (PINK, CYAN, GOLD)[(v + 1) % 3])
        beacon(0, 0, h + 14 + (8 if v == 1 else 0), 1.0)
        lib.area_light((-120, -120, 160), (0, 0, 50), 1.6e5, 80, (0.75, 0.8, 1.0))
        cam = lib.camera((80, -150, 40), (0, 0, 58), ortho_scale=120 * 2 * 1.0)
        cam.data.ortho_scale = 128
        s.render.resolution_x, s.render.resolution_y = 120, 240
        png = os.path.join(lib.TMP, f"apex.tower-{v}.png")
        secs = lib.render(png)
        img = Image.open(png).convert("RGBA")
        path, size = lib.save_webp(img, f"apex.tower-{v}", quality=86)
        print(f"apex.tower-{v}: {secs:.1f} s, {size / 1024:.1f} KB")


only = set(sys.argv[1:])
if not only or "sky" in only:
    sky()
if not only or "far" in only:
    render_strip("apex.city-far", 70, far, int(os.environ.get("SAMPLES", 96)))
if not only or "near" in only:
    render_strip("apex.city-near", 58, near, int(os.environ.get("SAMPLES", 96)))
if not only or "towers" in only:
    towers()
