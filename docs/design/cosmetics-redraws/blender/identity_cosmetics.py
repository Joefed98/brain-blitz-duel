"""The identity cosmetics of the second pass (docs/design/cosmetics-redraws/ART-DIRECTION.md), rendered in Blender:

  nc.<name>       name colours: the material itself, a polished bar of it seen straight on (512 x 128); the name's
                  letters are filled with it (background-clip: text), so every name is cut from real chrome, lacquer
                  or anodised metal, with the dark edge every name keeps
  fin.<name>      avatar finishes: a sphere of the material (a matcap, 300 x 300); the avatar's main shapes take it as
                  their paint, so the shading of a real object of that material falls across them
  acc.bolt2       the Neon Bolt accessory: a glass bolt with a lit core
  emote2.*        the reaction packs' objects and plates, at 3x each emote's own size
  cel2.*          the celebrations' stages (720 x 450, 3x the 240 x 150 scene)
  tile2.circuit   the Circuit Trace tile: a real circuit board (270 x 270)

  python identity_cosmetics.py [group …]   groups: names finishes accessory emotes celebrations tile
"""
import math
import os
import sys

import bpy
import bmesh  # noqa: E402 (available once bpy is loaded)
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib  # noqa: E402

SAMPLES = int(os.environ.get("SAMPLES", 128))
GOLD = (1.0, 0.74, 0.34)
NAVY = (0.012, 0.022, 0.07)
PINK, CYAN = (1.0, 0.24, 0.8), (0.13, 0.9, 1.0)
LOG = []


CHROME_ENV = [(0.0, 0.12), (0.3, 0.55), (0.47, 0.42), (0.5, 0.05), (0.53, 2.4), (0.62, 0.95), (0.85, 1.15), (1.0, 1.5)]


def studio(top=0.3, band=2.4, floor=0.04, tint=(1.0, 0.97, 0.92), stops=None):
    """A dark studio with a bright horizon band (what polished things reflect), or `stops` (position, level)."""
    w = lib.world((0, 0, 0), 1.0)
    nt = w.node_tree
    bg = nt.nodes["Background"]
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    stops = stops or [(0.0, floor), (0.48, floor), (0.56, band), (0.63, 0.12), (0.8, 0.05), (1.0, top)]
    el = ramp.color_ramp.elements
    el[0].position, el[0].color = stops[0][0], tuple(stops[0][1] * t for t in tint) + (1,)
    el[1].position, el[1].color = stops[-1][0], tuple(stops[-1][1] * t for t in tint) + (1,)
    for pos, v in stops[1:-1]:
        el.new(pos).color = tuple(v * t for t in tint) + (1,)
    nt.links.new(coord.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], bg.inputs[0])


def nodes(m):
    return m.node_tree, m.node_tree.nodes["Principled BSDF"]


def mat_chrome():
    return lib.material("chrome", base=(0.96, 0.97, 0.99), metallic=1.0, roughness=0.04)


def mat_candy(colour):
    """Candy lacquer: a metallic flake base under a thick clear coat."""
    m = lib.material(f"candy{colour}", base=colour, metallic=0.75, roughness=0.32, coat=1.0)
    nt, b = nodes(m)
    b.inputs["Coat Roughness"].default_value = 0.03
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 600
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.12
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def mat_anodised(colour):
    return lib.material(f"anod{colour}", base=colour, metallic=1.0, roughness=0.18)


def mat_carbon():
    """Woven carbon fibre (a two-direction weave) under a clear coat."""
    m = lib.material("carbon", base=(0.03, 0.03, 0.035), metallic=0.3, roughness=0.42, coat=1.0)
    nt, b = nodes(m)
    b.inputs["Coat Roughness"].default_value = 0.02
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (9, 9, 9)
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], mp.inputs[0])
    nt.links.new(mp.outputs[0], sep.inputs[0])

    def math_(op, a, b_=None, v=None):
        n = nt.nodes.new("ShaderNodeMath")
        n.operation = op
        nt.links.new(a, n.inputs[0])
        if b_ is not None:
            nt.links.new(b_, n.inputs[1])
        if v is not None:
            n.inputs[1].default_value = v
        return n.outputs[0]

    cx = math_("FLOOR", sep.outputs["X"])
    cz = math_("FLOOR", sep.outputs["Z"])
    par = math_("MODULO", math_("ADD", cx, cz), v=2)
    fx = math_("SINE", math_("MULTIPLY", sep.outputs["X"], v=math.pi))
    fz = math_("SINE", math_("MULTIPLY", sep.outputs["Z"], v=math.pi))
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "FLOAT"
    nt.links.new(par, mix.inputs["Factor"])
    nt.links.new(math_("ABSOLUTE", fx), mix.inputs["A"])
    nt.links.new(math_("ABSOLUTE", fz), mix.inputs["B"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.012, 0.012, 0.016, 1)
    ramp.color_ramp.elements[1].color = (0.13, 0.135, 0.15, 1)
    nt.links.new(mix.outputs["Result"], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], b.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.4
    nt.links.new(mix.outputs["Result"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def mat_holo():
    """Holographic foil: polished silver whose colour runs through the spectrum with the viewing angle and a drifting
    grain (the foil's diffraction), under a thin clear coat."""
    m = lib.material("holo", base=(0.92, 0.94, 0.98), metallic=1.0, roughness=0.1, coat=0.6)
    nt, b = nodes(m)
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.6
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 9.0
    noise.inputs["Distortion"].default_value = 2.0
    add = nt.nodes.new("ShaderNodeMath")
    add.operation = "MULTIPLY_ADD"
    add.inputs[1].default_value = 1.4
    nt.links.new(lw.outputs["Facing"], add.inputs[0])
    nt.links.new(noise.outputs["Fac"], add.inputs[2])
    fr = nt.nodes.new("ShaderNodeMath")
    fr.operation = "FRACT"
    nt.links.new(add.outputs[0], fr.inputs[0])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    el = ramp.color_ramp.elements
    cols = [(0.55, 0.95, 1.0), (0.75, 0.6, 1.0), (1.0, 0.6, 0.9), (1.0, 0.9, 0.55), (0.6, 1.0, 0.8), (0.55, 0.95, 1.0)]
    el[0].color = (*cols[0], 1)
    el[1].color = (*cols[-1], 1)
    for i, c in enumerate(cols[1:-1], 1):
        el.new(i / (len(cols) - 1)).color = (*c, 1)
    nt.links.new(fr.outputs[0], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], b.inputs["Base Color"])
    return m


def mat_glass(colour=(1, 1, 1)):
    return lib.material(f"glass{colour}", base=colour, roughness=0.0, transmission=1.0, ior=1.5)


def mat_enamel(colour, rough=0.12):
    return lib.material(f"enamel{colour}", base=colour, roughness=rough, coat=1.0)


def lift(floor, saturate=1.0):
    """Levels in HSV: the darkest value raised to `floor` (a name's letters never go dark), hue and saturation kept
    (times `saturate`), highlights kept."""
    def post(img):
        hsv = np.asarray(img.convert("RGB").convert("HSV")).astype(np.float32) / 255
        hsv[..., 2] = floor + (1 - floor) * hsv[..., 2]
        hsv[..., 1] = np.clip(hsv[..., 1] * saturate, 0, 1)
        return Image.fromarray((hsv * 255).astype(np.uint8), "HSV").convert("RGB")
    return post


def go(name, w, h, build, transparent=True, samples=SAMPLES, quality=86, view="AgX", post=None):
    s = lib.reset(w, h, samples=samples, transparent=transparent)
    if view == "Standard":
        s.view_settings.view_transform = "Standard"
    build(s)
    png = os.path.join(lib.TMP, f"{name}.png")
    secs = lib.render(png)
    img = Image.open(png)
    img = img.convert("RGBA") if transparent else img.convert("RGB")
    if post:
        img = post(img)
    _, size = lib.save_webp(img, name, quality=quality)
    LOG.append((name, secs, size))
    print(f"{name}: {secs:.1f} s, {size / 1024:.1f} KB")


# ------------------------------------------------------------------ name colours (512 x 128 bars)

def name_bar(material):
    def build(s):
        studio(stops=CHROME_ENV, tint=(0.95, 0.97, 1.0))
        bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=1.25, depth=20, location=(0, 0, 0), rotation=(0, math.pi / 2, 0))
        bpy.ops.object.shade_smooth()
        bpy.context.object.data.materials.append(material())
        lib.area_light((-4, -6, 8), (0, 0, 0), 900, 6, (1, 0.97, 0.92))
        lib.camera((0, -12, 0.0), (0, 0, 0), ortho_scale=8.0)
    return build


NAMES = {
    "chrome": mat_chrome,
    "neon-pink": lambda: mat_candy((1.0, 0.22, 0.7)),
    "neon-cyan": lambda: mat_candy((0.05, 0.75, 0.95)),
    "neon-red": lambda: mat_candy((0.95, 0.08, 0.12)),
    "electric-orange": lambda: mat_anodised((1.0, 0.42, 0.06)),
}


def names():
    for n, m in NAMES.items():
        go(f"nc.{n}", 512, 128, name_bar(m), transparent=False, samples=64, quality=84, post=lift(0.42, 1.0) if n == "chrome" else lift(0.48, 1.25))


# ------------------------------------------------------------------ finishes (matcaps, 300 x 300)

def matcap(material):
    def build(s):
        studio(stops=CHROME_ENV, tint=(0.95, 0.97, 1.0))
        bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=1.0)
        bpy.ops.object.shade_smooth()
        bpy.context.object.data.materials.append(material())
        lib.area_light((-3, -4, 4), (0, 0, 0), 500, 3, (1, 0.97, 0.92))
        lib.area_light((4, -2, -1), (0, 0, 0), 120, 2, (0.75, 0.85, 1.0))
        lib.camera((0, -10, 0), (0, 0, 0), ortho_scale=2.0)
    return build


def glass_tube_sheen(s):
    """Neon Glow: what a glass tube adds over the player's own colour: only its reflections, on a black sphere."""
    studio(top=0.6, band=3.2)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=1.0)
    bpy.ops.object.shade_smooth()
    m = lib.material("sheen", base=(0, 0, 0), roughness=0.03, metallic=0.0, coat=1.0)
    bpy.context.object.data.materials.append(m)
    lib.area_light((-3, -4, 4), (0, 0, 0), 600, 2, (1, 1, 1))
    lib.camera((0, -10, 0), (0, 0, 0), ortho_scale=2.0)


def finishes():
    go("fin.chrome", 300, 300, matcap(mat_chrome), transparent=False, quality=84, post=lift(0.2))
    go("fin.carbon", 300, 300, matcap(mat_carbon), transparent=False, quality=84)
    go("fin.holographic", 300, 300, matcap(mat_holo), transparent=False, quality=84, post=lift(0.3, 2.2))
    go("fin.neon-glow", 300, 300, glass_tube_sheen, transparent=False, quality=84)


# ------------------------------------------------------------------ the bolt (accessory and Zap)

BOLT = [(-0.075, 1.0), (0.425, 1.0), (0.075, 0.2), (0.425, 0.2), (-0.325, -1.0), (-0.075, -0.1), (-0.425, -0.1)]


def bolt_obj(scale, depth, bevel, mat):
    bm = bmesh.new()
    vs = [bm.verts.new((x * scale, -depth / 2, y * scale)) for x, y in BOLT]
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]:
        v.co.y += depth
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("bolt")
    bm.to_mesh(me)
    o = bpy.data.objects.new("bolt", me)
    bpy.context.scene.collection.objects.link(o)
    b = o.modifiers.new("bevel", "BEVEL")
    b.width = bevel
    b.segments = 4
    o.data.materials.append(mat)
    return o


def glass_bolt(core_colour, glass_tint):
    def build(s):
        studio(stops=CHROME_ENV, tint=(0.95, 0.97, 1.0))
        o = bolt_obj(1.0, 0.36, 0.07, mat_glass(glass_tint))
        o.rotation_euler = (0, 0, math.radians(-24))
        core = bolt_obj(0.62, 0.1, 0.03, lib.emission_material("core", core_colour, 9))
        core.rotation_euler = (0, 0, math.radians(-24))
        lib.area_light((-3, -4, 4), (0, 0, 0), 500, 2.5, (1, 0.97, 0.92))
        l = bpy.data.lights.new("in", "POINT")
        l.energy = 120
        l.color = core_colour
        lo = bpy.data.objects.new("in", l)
        bpy.context.scene.collection.objects.link(lo)
        lib.camera((3.5, -9, 1.5), (0, 0, 0), ortho_scale=2.15)
    return build


def accessory():
    go("acc.bolt2", 120, 120, glass_bolt((0.2, 0.92, 1.0), (0.85, 0.97, 1.0)), view="Standard")


# ------------------------------------------------------------------ emotes

def rounded_box(size, bevel, loc=(0, 0, 0), segments=6):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    m = o.modifiers.new("b", "BEVEL")
    m.width, m.segments = bevel, segments
    return o


def plate(w, h, colour, kind):
    """A plate seen straight on, a little from above: a ceramic bubble, a key cap, a sign box, a gold plaque."""
    def build(s):
        studio(top=0.45, band=2.2)
        aspect = w / h
        hw, hh = 0.9 * aspect, 0.86
        if kind == "bubble":
            mat = mat_enamel(colour, 0.18)
            o = rounded_box((hw * 2 - 0.1, 0.4, (hh - 0.2) * 2), 0.36, loc=(0, 0, 0.12), segments=8)
            o.data.materials.append(mat)
            bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.24, radius2=0.02, depth=0.5, location=(-hw + 0.6, 0, -hh + 0.06), rotation=(0, math.radians(200), 0))
            t = bpy.context.object
            t.data.materials.append(mat)
            bpy.ops.object.shade_smooth()
        elif kind == "key":
            o = rounded_box((hw * 2 - 0.05, 0.5, hh * 2 - 0.05), 0.24)
            o.data.materials.append(lib.material(f"keyside{colour}", base=tuple(c * 0.6 for c in colour), roughness=0.35))
            top = rounded_box((hw * 2 - 0.42, 0.2, hh * 2 - 0.44), 0.12, loc=(0, -0.3, 0.06))
            top.data.materials.append(lib.material(f"keytop{colour}", base=colour, roughness=0.28, coat=0.4))
        elif kind == "sign":
            o = rounded_box((hw * 2, 0.3, hh * 2), 0.1, segments=4)
            o.data.materials.append(lib.material("signbox", base=(0.01, 0.012, 0.02), metallic=0.5, roughness=0.3))
            cu = bpy.data.curves.new("tube", "CURVE")
            cu.dimensions = "3D"
            cu.bevel_depth = 0.05
            sp = cu.splines.new("POLY")
            ix, iz = hw - 0.16, hh - 0.16
            pts = [(-ix, iz), (ix, iz), (ix, -iz), (-ix, -iz), (-ix, iz)]
            sp.points.add(len(pts) - 1)
            for i, (x, z) in enumerate(pts):
                sp.points[i].co = (x, -0.2, z, 1)
            t = bpy.data.objects.new("tube", cu)
            bpy.context.scene.collection.objects.link(t)
            t.data.materials.append(lib.emission_material(f"neon{colour}", colour, 6))
        elif kind == "plaque":
            o = rounded_box((hw * 2, 0.3, hh * 2), 0.2)
            o.data.materials.append(lib.material("plaquegold", base=GOLD, metallic=1.0, roughness=0.16))
            f = rounded_box((hw * 2 - 0.3, 0.1, hh * 2 - 0.34), 0.04, loc=(0, -0.12, 0))
            f.data.materials.append(lib.material("plaquebrushed", base=(1.0, 0.86, 0.55), metallic=1.0, roughness=0.42))
        lib.area_light((-2 * aspect, -5, 4), (0, 0, 0), (700 if kind in ('bubble', 'plaque') else 300) * aspect, 3 * aspect, (1, 0.97, 0.92))
        lib.camera((0, -10, 1.2), (0, 0, 0), ortho_scale=2 * max(hw, hh) * 1.04 + (0.1 if kind == "bubble" else 0))
    return build


def heart_key(s):
    plate(60, 60, (0.95, 0.45, 0.78), "key")(s)
    heart = lib.material("heart", base=(0.95, 0.06, 0.18), roughness=0.08, coat=1.0)
    for (x, z) in ((-0.17, 0.14), (0.17, 0.14)):
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.24, location=(x, -0.42, z))
        o = bpy.context.object
        o.scale = (1, 0.55, 1)
        o.data.materials.append(heart)
        bpy.ops.object.shade_smooth()
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=0.4, depth=0.42, location=(0, -0.42, -0.12), rotation=(math.pi, 0, 0))
    c = bpy.context.object
    c.scale = (1, 0.55, 1)
    c.data.materials.append(heart)
    bpy.ops.object.shade_smooth()


def star(s):
    studio(stops=CHROME_ENV, tint=(1.0, 0.97, 0.9))
    bm = bmesh.new()
    pts = []
    for i in range(8):
        a = math.pi / 2 + i * math.pi / 4
        r = 1.0 if i % 2 == 0 else 0.3
        pts.append((r * math.cos(a), r * math.sin(a)))
    top = bm.verts.new((0, -0.32, 0))
    bot = bm.verts.new((0, 0.32, 0))
    ring = [bm.verts.new((x, 0, y)) for x, y in pts]
    for i in range(8):
        bm.faces.new((top, ring[i], ring[(i + 1) % 8]))
        bm.faces.new((bot, ring[(i + 1) % 8], ring[i]))
    me = bpy.data.meshes.new("star")
    bm.to_mesh(me)
    o = bpy.data.objects.new("star", me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(lib.material("stargold", base=(1.0, 0.8, 0.3), metallic=1.0, roughness=0.1))
    o.rotation_euler = (0, 0, math.radians(8))
    for (x, z, r) in ((0.72, 0.68, 0.16), (-0.7, -0.62, 0.11)):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=r, location=(x, -0.2, z))
        bpy.context.object.data.materials.append(lib.emission_material("glint", (1, 0.92, 0.7), 6))
    lib.area_light((-3, -4, 4), (0, 0, 0), 500, 2.5, (1, 0.97, 0.92))
    lib.camera((2.5, -9, 1.6), (0, 0, 0), ortho_scale=2.12)


def emotes():
    go("emote2.spark", 228, 228, star)
    go("emote2.zap", 240, 228, glass_bolt((1.0, 0.85, 0.35), (0.95, 0.98, 1.0)), view="Standard")
    go("emote2.clutch", 354, 144, plate(118, 48, GOLD, "plaque"))
    for i, w in enumerate((102, 114, 96, 144)):
        go(f"emote2.bubble-{i}", w * 3, 138, plate(w, 46, (0.97, 0.96, 0.93), "bubble"))
    go("emote2.key-0", 180, 180, heart_key)
    for i, c in enumerate(((0.12, 0.78, 0.92), (1.0, 0.72, 0.18), (0.24, 0.84, 0.48))):
        go(f"emote2.key-{i + 1}", 180, 180, plate(60, 60, c, "key"))
    for i, (w, c) in enumerate(zip((74, 64, 114, 74), (PINK, CYAN, (1.0, 0.5, 0.15), (0.75, 1.0, 0.2)))):
        go(f"emote2.sign-{i}", w * 3, 120, plate(w, 40, c, "sign"), view="Standard")


# ------------------------------------------------------------------ celebrations (720 x 450)

def podium(z0=0.0):
    """A gold-rimmed navy lacquer drum with a gold top: the winner's step."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=1.0, depth=0.55, location=(0, 0, z0 + 0.275))
    d = bpy.context.object
    m = d.modifiers.new("b", "BEVEL")
    m.width, m.segments = 0.04, 4
    d.data.materials.append(mat_enamel(NAVY, 0.15))
    bpy.ops.object.shade_smooth()
    for z in (z0 + 0.04, z0 + 0.52):
        bpy.ops.mesh.primitive_torus_add(major_radius=1.0, minor_radius=0.04, location=(0, 0, z))
        bpy.context.object.data.materials.append(lib.material("rimgold", base=GOLD, metallic=1.0, roughness=0.14))
        bpy.ops.object.shade_smooth()
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=0.98, depth=0.04, location=(0, 0, z0 + 0.57))
    bpy.context.object.data.materials.append(lib.material("topgold", base=GOLD, metallic=1.0, roughness=0.22))


def stage_floor(material):
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0))
    bpy.context.object.data.materials.append(material)


def cel_camera(dist=7.2):
    lib.camera((0, -dist, 2.0 * dist / 7.2), (0, 0, 0.62), lens=50)


def spotlight(s):
    s.cycles.volume_bounces = 1
    lib.world((0.004, 0.005, 0.012), 1.0)
    stage_floor(lib.material("stage", base=(0.02, 0.022, 0.035), roughness=0.18))
    podium()
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 3))
    h = bpy.context.object
    h.scale = (14, 10, 6)
    vm = bpy.data.materials.new("haze")
    vm.use_nodes = True
    nt = vm.node_tree
    for nd in list(nt.nodes):
        nt.nodes.remove(nd)
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Density"].default_value = 0.09
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(vol.outputs[0], out.inputs["Volume"])
    h.data.materials.append(vm)
    for x in (-3.4, 3.4):
        l = bpy.data.lights.new("spot", "SPOT")
        l.energy = 6000
        l.spot_size = math.radians(18)
        l.spot_blend = 0.35
        l.color = (1.0, 0.9, 0.7)
        lo = bpy.data.objects.new("spot", l)
        bpy.context.scene.collection.objects.link(lo)
        lo.location = (x, 1.5, 5.2)
        lib.look_at(lo, (0, 0, 0.6))
    lib.area_light((0, -6, 3), (0, 0, 0.5), 40, 4, (0.6, 0.7, 1.0))
    cel_camera()


def shockwave(s):
    lib.world((0.004, 0.006, 0.016), 1.0)
    stage_floor(lib.material("glassfloor", base=(0.01, 0.015, 0.04), roughness=0.05, coat=1.0))
    podium()
    for i, (r, e) in enumerate(((1.6, 7), (2.4, 4), (3.3, 2.2))):
        bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=0.03, location=(0, 0, 0.03))
        bpy.context.object.data.materials.append(lib.emission_material(f"ring{i}", (0.35, 0.85, 1.0), e))
    lib.area_light((-3, -4, 4), (0, 0, 0.5), 260, 3, (1, 0.96, 0.9))
    lib.area_light((3, 2, 1.5), (0, 0, 0.6), 120, 2, (0.35, 0.8, 1.0))
    cel_camera()


def circuit_floor():
    """A dark circuit board floor with raised gold traces, a few lit."""
    rng = np.random.default_rng(9)
    stage_floor(lib.material("pcb", base=(0.012, 0.03, 0.025), roughness=0.3, coat=0.6))
    trace = lib.material("trace", base=GOLD, metallic=1.0, roughness=0.2)
    lit = lib.emission_material("tracelit", (1.0, 0.8, 0.4), 4)
    for k in range(44):
        x, y = rng.uniform(-6, 6), rng.uniform(-1.5, 6)
        if abs(x) < 1.3 and abs(y) < 1.3:
            continue
        pts = [(x, y)]
        for _ in range(3):
            if rng.random() < 0.5:
                x += rng.choice([-1, 1]) * rng.uniform(0.6, 1.8)
            else:
                y += rng.choice([-1, 1]) * rng.uniform(0.6, 1.8)
            pts.append((x, y))
        cu = bpy.data.curves.new("tr", "CURVE")
        cu.dimensions = "3D"
        cu.bevel_depth = 0.035
        sp = cu.splines.new("POLY")
        sp.points.add(len(pts) - 1)
        for i, (px, py) in enumerate(pts):
            sp.points[i].co = (px, py, 0.02, 1)
        o = bpy.data.objects.new("tr", cu)
        bpy.context.scene.collection.objects.link(o)
        o.data.materials.append(lit if k % 3 == 0 else trace)
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.1, depth=0.04, location=(pts[-1][0], pts[-1][1], 0.03))
        bpy.context.object.data.materials.append(trace)


def circuit(s):
    lib.world((0.004, 0.006, 0.012), 1.0)
    circuit_floor()
    podium()
    lib.area_light((-3, -4, 4), (0, 0, 0.5), 260, 3, (1, 0.96, 0.9))
    lib.area_light((0, 3, 2), (0, 0, 0.6), 80, 3, (1.0, 0.8, 0.45))
    # From higher than the other stages, so the board's traces read as a circuit, not sticks.
    lib.camera((0, -6.6, 5.4), (0, 0.55, -0.35), lens=46)


def celebrations():
    go("cel2.spotlight", 720, 450, spotlight, transparent=False, quality=82)
    go("cel2.shockwave", 720, 450, shockwave, transparent=False, quality=82)
    go("cel2.circuit", 720, 450, circuit, transparent=False, quality=82)


# ------------------------------------------------------------------ the tile (270 x 270)

def tile(s):
    studio(top=0.4, band=1.6)
    circuit_floor()
    for (x, y, w, h) in ((-0.8, 0.9, 1.1, 0.8), (1.0, -0.9, 0.8, 0.8)):
        o = rounded_box((w, h, 0.18), 0.03, loc=(x, y, 0.1), segments=3)
        o.data.materials.append(lib.material("epoxy", base=(0.02, 0.02, 0.025), roughness=0.5))
    lib.area_light((-3, -3, 5), (0, 0, 0), 1100, 3, (1, 0.97, 0.92))
    lib.camera((0, 0, 12), (0, 0, 0), ortho_scale=4.4)


GROUPS = {
    "names": names,
    "finishes": finishes,
    "accessory": accessory,
    "emotes": emotes,
    "celebrations": celebrations,
    "circuit": lambda: go("cel2.circuit", 720, 450, circuit, transparent=False, quality=82),
    "tile": lambda: go("tile2.circuit", 270, 270, tile, transparent=False, quality=84),
}
for g in sys.argv[1:] or list(GROUPS):
    GROUPS[g]()
print("sizes:", ", ".join(f"{n} {t:.1f} s {s / 1024:.1f} KB" for n, t, s in LOG))
