"""
The Cards & Board overhaul's Blender renders (phase 2 step 4, 15 Nov 2026). Real cards, Mahjong tiles and the two
tables, rendered in Cycles from the flat textures `textures.ts` writes:

  - cards: each face (and the back) laid on a thin linen card with rounded, bevelled edges; ink printed (a faint
    emboss), the court cards' gold as real gold leaf (metallic, a soft sheen, never a glare); one soft overhead light,
    an orthographic camera straight down, so a card's outline is exactly the rectangle the game hits;
  - tiles: each Mahjong face engraved on an ivory slab over a jade back, the slab sheared towards the bottom right so
    the straight-down camera sees its sides as the game's depth;
  - felt: the card games' royal-blue baize with its stitched seam; Mahjong's green mat in a wooden table edge.

Usage (bpy 5.1, the pip module): python render.py <textures dir> <out dir>. `pack.py` crops and packs the results.
Every render is seeded (Cycles' seed 0), so the output is the same on every run on the same Blender.
"""
import math
import sys
import os

import bpy
import bmesh

TEX = os.path.abspath(sys.argv[1])
OUT = os.path.abspath(sys.argv[2])
os.makedirs(OUT, exist_ok=True)

# Card geometry (world units: one unit is one pixel of the packed atlas cell).
CW, CH = 200, 294  # 0.68 aspect, the atlas's card size
CR = CW * 0.085
CT = 2.2  # card thickness
GAP = 24
COLS = 8
ROWS = 7


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 48
    scene.cycles.seed = 0
    scene.cycles.use_denoising = True
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    world = bpy.data.worlds.new("w")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.18, 0.18, 0.2, 1)
    bg.inputs["Strength"].default_value = 0.55
    scene.world = world
    return scene


def ortho_camera(scene, cx, cy, width, height, px_per_unit):
    cam = bpy.data.cameras.new("cam")
    cam.type = "ORTHO"
    cam.ortho_scale = max(width, height)
    obj = bpy.data.objects.new("cam", cam)
    obj.location = (cx, cy, 500)
    scene.collection.objects.link(obj)
    scene.camera = obj
    scene.render.resolution_x = int(round(width * px_per_unit))
    scene.render.resolution_y = int(round(height * px_per_unit))
    scene.render.resolution_percentage = 100
    cam.clip_end = 2000
    return obj


def soft_light(scene, strength=3.2, size=900, at=(0, 0, 700), energy=None):
    light = bpy.data.lights.new("lamp", "AREA")
    light.shape = "DISK"
    light.size = size
    light.energy = energy if energy is not None else strength * 1e6
    obj = bpy.data.objects.new("lamp", light)
    obj.location = at
    scene.collection.objects.link(obj)
    return obj


def rounded_outline(w, h, r, seg=10):
    pts = []
    corners = [(w - r, h - r, 0), (r, h - r, 90), (r, r, 180), (w - r, r, 270)]
    for cx, cy, a0 in corners:
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def slab(name, w, h, r, z0, z1, shear=(0.0, 0.0), uv_top=True):
    """A rounded slab from z0 to z1; the bottom outline shifted by `shear` (x, y) per unit of depth below z1."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    outline = rounded_outline(w, h, r)
    depth = z1 - z0
    top = [bm.verts.new((x, y, z1)) for x, y in outline]
    bot = [bm.verts.new((x + shear[0] * depth, y + shear[1] * depth, z0)) for x, y in outline]
    ftop = bm.faces.new(top)
    bm.faces.new(list(reversed(bot)))
    n = len(outline)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    uv = bm.loops.layers.uv.new("UV")
    for f in bm.faces:
        for loop in f.loops:
            v = loop.vert.co
            loop[uv].uv = (v.x / w, v.y / h) if f is ftop else (0.5, 0.5)
    bm.to_mesh(mesh)
    bm.free()
    for p in mesh.polygons:
        p.use_smooth = False
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    mod = obj.modifiers.new("bevel", "BEVEL")
    mod.width = min(1.2, depth * 0.45)
    mod.segments = 2
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(50)
    return obj


def image_node(nodes, path, non_color=False):
    img = bpy.data.images.load(path, check_existing=True)
    if non_color:
        img.colorspace_settings.name = "Non-Color"
    node = nodes.new("ShaderNodeTexImage")
    node.image = img
    node.interpolation = "Cubic"
    return node


def card_material(name, face_path):
    """Linen card stock printed with the face: ink faintly embossed, gold leaf where the face is gold."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nodes, links = nt.nodes, nt.links
    bsdf = nodes["Principled BSDF"]
    tex = image_node(nodes, face_path)
    links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    # Gold mask: warm, saturated, bright pixels (the court frames, crowns, collars and the Ace ring).
    sep = nodes.new("ShaderNodeSeparateColor")
    sep.mode = "HSV"
    links.new(tex.outputs["Color"], sep.inputs["Color"])
    def band(src, lo, hi):
        a = nodes.new("ShaderNodeMath"); a.operation = "GREATER_THAN"; a.inputs[1].default_value = lo
        b = nodes.new("ShaderNodeMath"); b.operation = "LESS_THAN"; b.inputs[1].default_value = hi
        links.new(src, a.inputs[0]); links.new(src, b.inputs[0])
        m = nodes.new("ShaderNodeMath"); m.operation = "MULTIPLY"
        links.new(a.outputs[0], m.inputs[0]); links.new(b.outputs[0], m.inputs[1])
        return m.outputs[0]
    hue = band(sep.outputs[0], 0.08, 0.15)
    sat = band(sep.outputs[1], 0.35, 1.01)
    val = band(sep.outputs[2], 0.45, 1.01)
    m1 = nodes.new("ShaderNodeMath"); m1.operation = "MULTIPLY"
    links.new(hue, m1.inputs[0]); links.new(sat, m1.inputs[1])
    gold = nodes.new("ShaderNodeMath"); gold.operation = "MULTIPLY"
    links.new(m1.outputs[0], gold.inputs[0]); links.new(val, gold.inputs[1])
    metal = nodes.new("ShaderNodeMath"); metal.operation = "MULTIPLY"; metal.inputs[1].default_value = 0.55
    links.new(gold.outputs[0], metal.inputs[0])
    links.new(metal.outputs[0], bsdf.inputs["Metallic"])
    rough = nodes.new("ShaderNodeMapRange")
    rough.inputs["To Min"].default_value = 0.62
    rough.inputs["To Max"].default_value = 0.4
    links.new(gold.outputs[0], rough.inputs["Value"])
    links.new(rough.outputs["Result"], bsdf.inputs["Roughness"])
    bsdf.inputs["Specular IOR Level"].default_value = 0.22
    bsdf.inputs["Coat Weight"].default_value = 0.0
    # Linen grain plus the printed ink, as one gentle bump.
    noise = nodes.new("ShaderNodeTexWave")
    noise.wave_type = "BANDS"
    noise.inputs["Scale"].default_value = 60
    noise.inputs["Distortion"].default_value = 2.0
    noise2 = nodes.new("ShaderNodeTexWave")
    noise2.wave_type = "BANDS"
    noise2.bands_direction = "Y"
    noise2.inputs["Scale"].default_value = 60
    noise2.inputs["Distortion"].default_value = 2.0
    add = nodes.new("ShaderNodeMath"); add.operation = "ADD"
    links.new(noise.outputs["Fac"], add.inputs[0]); links.new(noise2.outputs["Fac"], add.inputs[1])
    ink = nodes.new("ShaderNodeRGBToBW")
    links.new(tex.outputs["Color"], ink.inputs["Color"])
    inv = nodes.new("ShaderNodeMath"); inv.operation = "SUBTRACT"; inv.inputs[0].default_value = 1.0
    links.new(ink.outputs["Val"], inv.inputs[1])
    mix = nodes.new("ShaderNodeMath"); mix.operation = "MULTIPLY_ADD"; mix.inputs[1].default_value = 0.08
    links.new(add.outputs[0], mix.inputs[0]); links.new(inv.outputs[0], mix.inputs[2])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.12
    bump.inputs["Distance"].default_value = 0.4
    links.new(mix.outputs[0], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def plain_material(name, rgb, rough=0.6, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*rgb, 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Specular IOR Level"].default_value = 0.25
    return mat


def srgb(hexstr):
    h = hexstr.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)


def assign(obj, top_mat, side_mat):
    obj.data.materials.append(top_mat)
    obj.data.materials.append(side_mat)
    for p in obj.data.polygons:
        p.material_index = 0 if p.normal.z > 0.9 else 1


def render(scene, name):
    scene.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)


def cards():
    scene = reset()
    edge = plain_material("edge", srgb("#E9E2D2"), 0.7)
    names = [f"card-{i}.png" for i in range(52)] + ["card-back.png"]
    for k, n in enumerate(names):
        col, row = k % COLS, k // COLS
        x0 = GAP + col * (CW + GAP)
        y0 = GAP + (ROWS - 1 - row) * (CH + GAP)
        obj = slab(f"c{k}", CW, CH, CR, 0, CT)
        obj.location = (x0, y0, 0)
        assign(obj, card_material(f"m{k}", os.path.join(TEX, n)), edge)
    W = GAP + COLS * (CW + GAP)
    H = GAP + ROWS * (CH + GAP)
    # One even sun, a little from the top left (every card in the sheet lit the same), soft-edged.
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 2.6
    sun.angle = math.radians(22)
    sobj = bpy.data.objects.new("sun", sun)
    sobj.rotation_euler = (math.radians(14), math.radians(-10), 0)
    scene.collection.objects.link(sobj)
    ortho_camera(scene, W / 2, H / 2, W, H, 1)
    render(scene, "cards-raw.png")


def tiles():
    scene = reset()
    TW, TH, TR = 56 * 4, 74 * 4, 56 * 4 * 0.1
    D = 6 * 4  # depth drawn to the bottom right
    gap = 40
    cols = 6
    ivory_side = plain_material("ivs", srgb("#E4D9BC"), 0.5)
    jade = plain_material("jade", srgb("#1E7A58"), 0.4)
    for k in range(34):
        col, row = k % cols, k // cols
        rows = 6
        x0 = gap + col * (TW + D + gap)
        y0 = gap + D + (rows - 1 - row) * (TH + D + gap)
        # Jade back (lower), then the ivory slab with the face on top; both sheared so the camera sees the sides.
        back = slab(f"j{k}", TW, TH, TR, 0, D * 0.45, shear=(1.0, -1.0))
        back.location = (x0 + D * 0.55, y0 - D * 0.55, 0)
        back.data.materials.append(jade)
        face_mat = bpy.data.materials.new(f"t{k}")
        face_mat.use_nodes = True
        nt = face_mat.node_tree
        bsdf = nt.nodes["Principled BSDF"]
        tex = image_node(nt.nodes, os.path.join(TEX, f"tile-{k}.png"))
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = 0.42
        bsdf.inputs["Specular IOR Level"].default_value = 0.25
        bsdf.inputs["Subsurface Weight"].default_value = 0.08
        bw = nt.nodes.new("ShaderNodeRGBToBW")
        nt.links.new(tex.outputs["Color"], bw.inputs["Color"])
        bump = nt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.35
        bump.inputs["Distance"].default_value = 1.2
        bump.invert = False
        nt.links.new(bw.outputs["Val"], bump.inputs["Height"])
        nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
        top = slab(f"i{k}", TW, TH, TR, D * 0.45, D, shear=(1.0, -1.0))
        top.location = (x0, y0, 0)
        assign(top, face_mat, ivory_side)
    W = gap + cols * (TW + D + gap)
    H = gap + 6 * (TH + D + gap) + D
    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = 2.4
    sun.angle = math.radians(25)
    sobj = bpy.data.objects.new("sun", sun)
    sobj.rotation_euler = (math.radians(18), math.radians(-14), 0)
    scene.collection.objects.link(sobj)
    ortho_camera(scene, W / 2, H / 2, W, H, 1)
    render(scene, "tiles-raw.png")


def felt_material(name, base_hex, stitch_path=None, stitch_hex="#D9B45A", scale=2.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nodes, links = nt.nodes, nt.links
    bsdf = nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.95
    bsdf.inputs["Specular IOR Level"].default_value = 0.05
    bsdf.inputs["Sheen Weight"].default_value = 0.35
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 260 * scale
    noise.inputs["Detail"].default_value = 6
    ramp = nodes.new("ShaderNodeMapRange")
    ramp.inputs["To Min"].default_value = 0.9
    ramp.inputs["To Max"].default_value = 1.08
    links.new(noise.outputs["Fac"], ramp.inputs["Value"])
    tint = nodes.new("ShaderNodeMix")
    tint.data_type = "RGBA"
    tint.blend_type = "MULTIPLY"
    tint.inputs["Factor"].default_value = 1.0
    tint.inputs[6].default_value = (*srgb(base_hex), 1)
    comb = nodes.new("ShaderNodeCombineColor")
    for i in range(3):
        links.new(ramp.outputs["Result"], comb.inputs[i])
    links.new(comb.outputs["Color"], tint.inputs[7])
    colour = tint.outputs[2]
    if stitch_path:
        st = image_node(nodes, stitch_path, non_color=True)
        tc = nodes.new("ShaderNodeTexCoord")
        links.new(tc.outputs["UV"], st.inputs["Vector"])
        mix = nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        links.new(st.outputs["Color"], mix.inputs["Factor"])
        links.new(colour, mix.inputs[6])
        mix.inputs[7].default_value = (*srgb(stitch_hex), 1)
        mix.inputs["Factor"].default_value = 1.0
        colour = mix.outputs[2]
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.6
        add = nodes.new("ShaderNodeMath"); add.operation = "MULTIPLY_ADD"; add.inputs[1].default_value = 0.3
        links.new(noise.outputs["Fac"], add.inputs[0]); links.new(st.outputs["Color"], add.inputs[2])
        links.new(add.outputs[0], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    links.new(colour, bsdf.inputs["Base Color"])
    return mat


def plane(name, x, y, w, h, z=0.0):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in ((x, y, z), (x + w, y, z), (x + w, y + h, z), (x, y + h, z))]
    f = bm.faces.new(vs)
    uv = bm.loops.layers.uv.new("UV")
    for loop in f.loops:
        v = loop.vert.co
        loop[uv].uv = ((v.x - x) / w, (v.y - y) / h)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def felt():
    """The card games' blue baize at 2× the 414 × 772 world, lit from above, the seam as a stitched gold thread."""
    scene = reset()
    scene.render.film_transparent = False
    W, H = 828, 1544
    obj = plane("felt", 0, 0, W, H)
    obj.data.materials.append(felt_material("felt", "#163E86", os.path.join(TEX, "stitch-felt.png")))
    soft_light(scene, size=W * 0.55, at=(W / 2, H * 0.6, 1100), energy=W * H * 3.6)
    ortho_camera(scene, W / 2, H / 2, W, H, 1)
    render(scene, "felt-raw.png")


def mahjong_table():
    """Mahjong's green mat in a dark wooden table edge, at 2× its world (textures.ts writes the sizes)."""
    scene = reset()
    scene.render.film_transparent = False
    import json
    spec = json.load(open(os.path.join(TEX, "mahjong.json")))
    wh, mat_y0, mat_h = spec["worldH"], spec["matY"], spec["matH"]
    W, H = 712, wh * 2
    wood = plane("wood", 0, 0, W, H, 0)
    wm = bpy.data.materials.new("wood")
    wm.use_nodes = True
    nt = wm.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.inputs["Scale"].default_value = 3.0
    wave.inputs["Distortion"].default_value = 8.0
    wave.inputs["Detail"].default_value = 3.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*srgb("#1E120A"), 1)
    ramp.color_ramp.elements[1].color = (*srgb("#4A2E1A"), 1)
    nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.55
    bsdf.inputs["Specular IOR Level"].default_value = 0.15
    wood.data.materials.append(wm)
    m = 8
    y_top = H - mat_y0 * 2
    mat = slab("mat", W - 2 * m, mat_h * 2, 32, 0.5, 2.0)
    mat.location = (m, y_top - mat_h * 2, 0)
    mat.data.materials.append(felt_material("mat", "#1F6B4E", os.path.join(TEX, "stitch-mat.png")))
    soft_light(scene, size=W * 0.7, at=(W * 0.4, H * 0.6, 1100), energy=W * H * 4.2)
    ortho_camera(scene, W / 2, H / 2, W, H, 1)
    render(scene, "mahjong-table-raw.png")


what = os.environ.get("ONLY", "cards,tiles,felt,mahjong").split(",")
if "cards" in what:
    cards()
if "tiles" in what:
    tiles()
if "felt" in what:
    felt()
if "mahjong" in what:
    mahjong_table()
