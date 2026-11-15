"""Logic overhaul 2 (phase 2 step 4, 15 Nov 2026): the Blender pieces and surfaces for Tents and Trees, Shikaku,
Lamplighter, Trail, Loopline, Regions and Island Link.

Each sprite is one object (or one tile) rendered alone in Cycles on a transparent film, seen from straight above with
the art kit's light (one warm key from the top left, a cool fill, a soft rim), and written as a 192 px PNG to
docs/design/logic-art/source/<name>.png. `bun scripts/logic-art.ts` cuts those to the WebP sizes the games draw
(public/logic-art/) and writes the data file the games read. Numbers are never rendered here: the games draw them as
flat, bold text over the pieces, so no reflection ever runs across a digit.

Run (Blender 5.x as a Python module in a Python 3.13 venv kept outside the project folder, `pip install bpy`):

    <venv>/bin/python scripts/logic-art/render.py [name ...]

No argument renders every sprite. JZ_SAMPLES (default 128) sets the quality.
"""
import bpy, bmesh, math, os, sys, random
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, "..", "..", "docs", "design", "logic-art", "source"))
SAMPLES = int(os.environ.get("JZ_SAMPLES", "128"))
PX = 192


def hexc(h, a=1.0):
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(r), lin(g), lin(b), a)


# ------------------------------------------------------------------------------------------------ scene
def reset(w=PX, h=PX, view=1.0, tilt=0.0):
    """An empty scene with an orthographic camera framing a `view` x `view` square (sprite units) round the origin."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.cycles.samples = SAMPLES
    s.cycles.use_denoising = True
    s.cycles.seed = 7
    s.cycles.max_bounces = 8
    s.cycles.caustics_reflective = False
    s.cycles.caustics_refractive = False
    s.render.resolution_x = w
    s.render.resolution_y = h
    s.render.film_transparent = True
    s.view_settings.view_transform = "AgX"
    s.view_settings.look = "AgX - Punchy"
    s.render.image_settings.file_format = "PNG"
    s.render.image_settings.color_mode = "RGBA"
    cam = bpy.data.cameras.new("cam")
    cam.type = "ORTHO"
    cam.ortho_scale = view * max(1.0, w / h)
    ob = bpy.data.objects.new("cam", cam)
    s.collection.objects.link(ob)
    t = math.radians(tilt)
    ob.location = (0, -10 * math.sin(t), 10 * math.cos(t))
    ob.rotation_euler = (t, 0, 0)
    s.camera = ob
    w_ = bpy.data.worlds.new("w")
    s.world = w_
    w_.use_nodes = True
    # The studio sky (Joe, 15 Nov 2026: real materials, light on them, but no glare across a face): dark straight above,
    # so a flat top seen from above reflects darkness and keeps its depth (and any number over it stays clean), and a
    # bright band low round the horizon, so bevels, rims and curves catch a crisp highlight. The camera sees none of it.
    nt = w_.node_tree
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    rng = nt.nodes.new("ShaderNodeMapRange")
    rng.inputs["From Min"].default_value = -1.0
    rng.inputs["From Max"].default_value = 1.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.elements[0].position = 0.0
    cr.elements[0].color = hexc("#08090b")
    cr.elements[1].position = 1.0
    cr.elements[1].color = hexc("#050506")
    for pos, col in ((0.42, "#1a1b1e"), (0.55, "#f2efe8"), (0.78, "#c8c3b8"), (0.9, "#3a3a3c"), (0.96, "#0c0c0e")):
        e = cr.elements.new(pos)
        e.color = hexc(col)
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs[2], rng.inputs["Value"])
    nt.links.new(rng.outputs[0], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], nt.nodes["Background"].inputs[0])
    nt.nodes["Background"].inputs[1].default_value = 1.4
    lights()
    return s


def area(loc, size, energy, color, target=(0, 0, 0), glossy=True):
    d = bpy.data.lights.new("a", "AREA")
    d.energy = energy
    d.color = hexc(color)[:3]
    d.size = size
    ob = bpy.data.objects.new("a", d)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    ob.visible_glossy = glossy
    return ob


def lights(key=1.0):
    """The art kit's light, re-tuned for Joe's rule of 15 Nov 2026: a warm key from the top left (soft on the surfaces,
    a small crisp highlight on curves, never a wash across a face), an overhead fill seen only diffusely (invisible in
    reflections, so no hot spot over a tile or number), and a cool rim low on the right for the edges."""
    area((-2.6, 2.6, 2.2), 1.2, 230 * key, "#fff1dc")
    area((0.0, 0.0, 4.0), 8.0, 120 * key, "#ffffff", glossy=False)
    area((3.0, -1.6, 1.0), 1.6, 70 * key, "#d6e4ff")


def point(loc, energy, color, radius=0.05):
    d = bpy.data.lights.new("p", "POINT")
    d.energy = energy
    d.color = hexc(color)[:3]
    d.shadow_soft_size = radius
    ob = bpy.data.objects.new("p", d)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc


# ------------------------------------------------------------------------------------------------ materials
def mat(name, color="#808080", rough=0.4, metal=0.0, coat=0.0, trans=0.0, ior=1.45, emit=None, emit_strength=0.0,
        sheen=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = hexc(color)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = 0.06
    b.inputs["Transmission Weight"].default_value = trans
    b.inputs["IOR"].default_value = ior
    b.inputs["Sheen Weight"].default_value = sheen
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
    if emit:
        b.inputs["Emission Color"].default_value = hexc(emit)
        b.inputs["Emission Strength"].default_value = emit_strength
    return m


def bump(m, scale=40.0, strength=0.05, kind="noise", stretch=(1, 1, 1), distance=0.02, detail=6.0):
    n = m.node_tree.nodes
    l = m.node_tree.links
    tc = n.new("ShaderNodeTexCoord")
    mp = n.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = stretch
    tex = n.new("ShaderNodeTexNoise") if kind == "noise" else n.new("ShaderNodeTexVoronoi")
    tex.inputs["Scale"].default_value = scale
    if kind == "noise":
        tex.inputs["Detail"].default_value = detail
    bp = n.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = strength
    bp.inputs["Distance"].default_value = distance
    l.new(tc.outputs["Object"], mp.inputs["Vector"])
    l.new(mp.outputs[0], tex.inputs["Vector"])
    l.new(tex.outputs[0 if kind == "noise" else "Distance"], bp.inputs["Height"])
    l.new(bp.outputs[0], n["Principled BSDF"].inputs["Normal"])
    return m


def wood(name, c1="#8a5a32", c2="#4e2e14", rough=0.35, coat=0.5, scale=6.0, stretch=(1, 10, 1)):
    m = mat(name, c1, rough, coat=coat)
    n = m.node_tree.nodes
    l = m.node_tree.links
    tc = n.new("ShaderNodeTexCoord")
    mp = n.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = stretch
    wave = n.new("ShaderNodeTexWave")
    wave.inputs["Scale"].default_value = scale
    wave.inputs["Distortion"].default_value = 9.0
    wave.inputs["Detail"].default_value = 6.0
    wave.inputs["Detail Scale"].default_value = 1.6
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = hexc(c2)
    ramp.color_ramp.elements[1].color = hexc(c1)
    l.new(tc.outputs["Object"], mp.inputs["Vector"])
    l.new(mp.outputs[0], wave.inputs["Vector"])
    l.new(wave.outputs[0], ramp.inputs[0])
    l.new(ramp.outputs[0], n["Principled BSDF"].inputs["Base Color"])
    return m


def gold(name="gold", rough=0.22):
    # Part metallic: a flat gold face shows champagne under the key light (it would mirror the dark sky overhead as
    # olive otherwise), while rims and curves keep a metal's crisp highlight.
    return mat(name, "#e9c77f", rough, metal=0.72)


def silver(name="silver", rough=0.18):
    return mat(name, "#cfd4d8", rough, metal=1.0)


def emissive(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    n = m.node_tree.nodes
    e = n.new("ShaderNodeEmission")
    e.inputs[0].default_value = hexc(color)
    e.inputs[1].default_value = strength
    m.node_tree.links.new(e.outputs[0], n["Material Output"].inputs[0])
    return m


# ------------------------------------------------------------------------------------------------ shapes
def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob


def setm(ob, m):
    ob.data.materials.clear()
    ob.data.materials.append(m)
    return ob


def rbox(cx, cy, w, h, d, m, r=0.06, z=0.0, seg=4):
    """A rounded box (rounded in plan, bevelled on top) with its base at z."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= w
        v.co.y *= h
        v.co.z = (v.co.z + 0.5) * d
    me = bpy.data.meshes.new("b")
    bm.to_mesh(me)
    bm.free()
    ob = link(bpy.data.objects.new("b", me))
    ob.location = (cx, cy, z)
    mod = ob.modifiers.new("bv", "BEVEL")
    mod.width = min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3)
    mod.segments = seg
    mod.limit_method = "NONE"
    for p in me.polygons:
        p.use_smooth = True
    return setm(ob, m)


def cyl(cx, cy, r, d, m, z=0.0, bevel=0.02, verts=96):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r, radius2=r, depth=d)
    for v in bm.verts:
        v.co.z += d / 2
    me = bpy.data.meshes.new("c")
    bm.to_mesh(me)
    bm.free()
    ob = link(bpy.data.objects.new("c", me))
    ob.location = (cx, cy, z)
    if bevel:
        mod = ob.modifiers.new("bv", "BEVEL")
        mod.width = min(bevel, d / 2 - 1e-3)
        mod.segments = 4
        mod.limit_method = "ANGLE"
    for p in me.polygons:
        p.use_smooth = True
    return setm(ob, m)


def cone(cx, cy, r1, r2, h, m, z=0.0, verts=64):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r1, radius2=r2, depth=h)
    for v in bm.verts:
        v.co.z += h / 2
    me = bpy.data.meshes.new("k")
    bm.to_mesh(me)
    bm.free()
    ob = link(bpy.data.objects.new("k", me))
    ob.location = (cx, cy, z)
    for p in me.polygons:
        p.use_smooth = True
    return setm(ob, m)


def sphere(cx, cy, r, m, z=None, sz=1.0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=r, location=(cx, cy, r if z is None else z))
    ob = bpy.context.active_object
    ob.scale = (1, 1, sz)
    bpy.ops.object.shade_smooth()
    return setm(ob, m)


def torus(cx, cy, R, r, m, z=0.0):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=96, minor_segments=24, location=(cx, cy, z))
    ob = bpy.context.active_object
    bpy.ops.object.shade_smooth()
    return setm(ob, m)


def slab(points, d, m, z=0.0, bevel=0.01):
    """An extruded polygon (plan points, x right, y up)."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, 0)) for x, y in points]
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in ext["geom"]:
        if isinstance(v, bmesh.types.BMVert):
            v.co.z += d
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("s")
    bm.to_mesh(me)
    bm.free()
    ob = link(bpy.data.objects.new("s", me))
    ob.location = (0, 0, z)
    if bevel:
        mod = ob.modifiers.new("bv", "BEVEL")
        mod.width = bevel
        mod.segments = 3
    return setm(ob, m)


def tube(points, r, m, z=0.0):
    cu = bpy.data.curves.new("t", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r
    cu.bevel_resolution = 6
    sp = cu.splines.new("POLY")
    sp.points.add(len(points) - 1)
    for i, (x, y) in enumerate(points):
        sp.points[i].co = (x, y, z, 1)
    ob = link(bpy.data.objects.new("t", cu))
    ob.data.materials.append(m)
    return ob


# ------------------------------------------------------------------------------------------------ shared surfaces
def slate_mat(name, c1, c2):
    """Slate: layered grey (or navy) clefts with fine grain in the bump and a low satin sheen."""
    m = mat(name, c1, 0.78)
    # Low specular: the slate keeps its texture with no soft glare patch from the key light.
    m.node_tree.nodes["Principled BSDF"].inputs["Specular IOR Level"].default_value = 0.12
    n = m.node_tree.nodes
    l = m.node_tree.links
    tc = n.new("ShaderNodeTexCoord")
    mp = n.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1.0, 3.5, 1.0)
    noise = n.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 4.0
    noise.inputs["Detail"].default_value = 12.0
    noise.inputs["Roughness"].default_value = 0.7
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = hexc(c2)
    ramp.color_ramp.elements[1].color = hexc(c1)
    l.new(tc.outputs["Object"], mp.inputs["Vector"])
    l.new(mp.outputs[0], noise.inputs["Vector"])
    l.new(noise.outputs[0], ramp.inputs[0])
    l.new(ramp.outputs[0], n["Principled BSDF"].inputs["Base Color"])
    grain = n.new("ShaderNodeTexNoise")
    grain.inputs["Scale"].default_value = 90.0
    grain.inputs["Detail"].default_value = 8.0
    bp = n.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.35
    bp.inputs["Distance"].default_value = 0.004
    l.new(tc.outputs["Object"], grain.inputs["Vector"])
    l.new(grain.outputs[0], bp.inputs["Height"])
    l.new(bp.outputs[0], n["Principled BSDF"].inputs["Normal"])
    return m


def tile(m, edge=0.06, d=0.08, inset=0.03):
    """A full-sprite square tile (the sprite is 1 x 1), raised `d`, its plan inset a hair so the bevel shows."""
    return rbox(0, 0, 1 - 2 * inset, 1 - 2 * inset, d, m, r=edge)


def lacquer(name="lacquer", color="#141a17"):
    return bump(mat(name, color, 0.32, coat=0.8), 160, 0.02, distance=0.002)


# ------------------------------------------------------------------------------------------------ sprites
SPRITES = {}


def sprite(name, **opts):
    def wrap(fn):
        SPRITES[name] = (fn, opts)
        return fn
    return wrap


# Tents and Trees ------------------------------------------------------------------------------------------
def shadow_catcher(size=1.2):
    """A ground plane that only catches shadows (the film stays transparent): a soft contact shadow under a piece."""
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, 0))
    ob = bpy.context.active_object
    ob.is_shadow_catcher = True
    return ob


def grass(name, c1, c2):
    """Turf: two greens mixed by noise, short blades in the bump, no gloss."""
    m = mat(name, c1, 0.82, sheen=0.6)
    n = m.node_tree.nodes
    l = m.node_tree.links
    tc = n.new("ShaderNodeTexCoord")
    noise = n.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 9.0
    noise.inputs["Detail"].default_value = 8.0
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = hexc(c2)
    ramp.color_ramp.elements[1].color = hexc(c1)
    l.new(tc.outputs["Object"], noise.inputs["Vector"])
    l.new(noise.outputs[0], ramp.inputs[0])
    l.new(ramp.outputs[0], n["Principled BSDF"].inputs["Base Color"])
    vor = n.new("ShaderNodeTexVoronoi")
    vor.inputs["Scale"].default_value = 140.0
    bp = n.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.6
    bp.inputs["Distance"].default_value = 0.006
    l.new(tc.outputs["Object"], vor.inputs["Vector"])
    l.new(vor.outputs["Distance"], bp.inputs["Height"])
    l.new(bp.outputs[0], n["Principled BSDF"].inputs["Normal"])
    return m


@sprite("tents-turf")
def _turf():
    # Rich turf on B's darker ground: deep greens with blades, a soft bevel.
    tile(grass("turf", "#163319", "#08170c"), edge=0.07)


# The standing pieces (trees, tents, tufts) are seen from the front and above (35°), so they stand up with real relief
# and a soft contact shadow; they are drawn inside their square, as before.
PIECE_TILT = 58.0


def pine(seed, tiers=3, scale=1.0):
    rnd = random.Random(seed)
    trunk = wood("trunk", "#7a4a26", "#3e220e", scale=12)
    cyl(0, 0, 0.045 * scale, 0.2 * scale, trunk, z=0, bevel=0.01)
    greens = [("#2f8a49", "#1f6236"), ("#3ca257", "#2a7a42"), ("#4dba68", "#348f4e")]
    for k in range(tiers):
        c1, c2 = greens[k]
        m = bump(mat(f"pine{k}", c1, 0.72, sheen=0.1), 60, 0.35, distance=0.004)
        r = (0.30 - k * 0.07) * scale
        z = (0.13 + k * 0.15) * scale
        h = (0.34 - k * 0.04) * scale
        ob = cone(rnd.uniform(-0.01, 0.01), rnd.uniform(-0.01, 0.01), r, 0.0, h, m, z=z, verts=9)
        ob.rotation_euler[2] = rnd.uniform(0, 1)


@sprite("tents-tree-a", tilt=PIECE_TILT)
def _tree_a():
    shadow_catcher()
    pine(1, 3, 1.28)


@sprite("tents-tree-b", tilt=PIECE_TILT)
def _tree_b():
    shadow_catcher()
    trunk = wood("trunk", "#7a4a26", "#3e220e", scale=12)
    cyl(0, 0, 0.06, 0.26, trunk, z=0, bevel=0.01)
    leaf = bump(mat("leaf", "#47a85c", 0.72, sheen=0.1), 70, 0.45, kind="voronoi", distance=0.006)
    k = 1.2
    for (x, y, z, r) in ((0, 0, 0.42, 0.25), (-0.16, 0.02, 0.32, 0.17), (0.16, -0.02, 0.33, 0.18), (0.02, 0.06, 0.58, 0.16)):
        sphere(x * k, y * k, r * k, leaf, z=z * k)


def canvas_mat(lit):
    """Canvas: a woven texture in the bump and a warm cream; the lit tent glows faintly through its walls."""
    m = mat("canvas", "#e4cc98", 0.7, sheen=0.5, emit="#ffb860" if lit else None, emit_strength=0.25 if lit else 0.0)
    n = m.node_tree.nodes
    l = m.node_tree.links
    tc = n.new("ShaderNodeTexCoord")
    weave = n.new("ShaderNodeTexWave")
    weave.inputs["Scale"].default_value = 60.0
    weave.inputs["Distortion"].default_value = 0.6
    stripes = n.new("ShaderNodeTexWave")
    stripes.wave_type = "BANDS"
    stripes.bands_direction = "Y"
    stripes.inputs["Scale"].default_value = 3.0
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = hexc("#c9aa70")
    ramp.color_ramp.elements[1].color = hexc("#e9d4a4")
    bp = n.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.25
    bp.inputs["Distance"].default_value = 0.002
    l.new(tc.outputs["Object"], weave.inputs["Vector"])
    l.new(tc.outputs["Object"], stripes.inputs["Vector"])
    l.new(stripes.outputs[0], ramp.inputs[0])
    l.new(ramp.outputs[0], n["Principled BSDF"].inputs["Base Color"])
    l.new(weave.outputs[0], bp.inputs["Height"])
    l.new(bp.outputs[0], n["Principled BSDF"].inputs["Normal"])
    return m


def mesh(name, verts, faces, m):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    ob = link(bpy.data.objects.new(name, me))
    return setm(ob, m)


def tent(lit):
    shadow_catcher()
    canvas = canvas_mat(lit)
    w, h, d = 0.72, 0.5, 0.58
    # A ridge tent: its triangle faces the camera (−y), the roof runs back along +y.
    tent_ob = mesh("tent", [(-w / 2, -d / 2, 0), (w / 2, -d / 2, 0), (0, -d / 2, h), (-w / 2, d / 2, 0), (w / 2, d / 2, 0), (0, d / 2, h)],
                   [(0, 1, 2), (3, 5, 4), (1, 4, 5, 2), (0, 2, 5, 3)], canvas)
    mod = tent_ob.modifiers.new("bv", "BEVEL")
    mod.width = 0.01
    mod.segments = 2
    # The door: a dark opening, or a warm lantern-lit one.
    door = mat("doorlit", "#f09a3c", 0.6, emit="#ffa040", emit_strength=4.0) if lit else mat("door", "#2a1a0a", 0.8)
    dw, dh = 0.2, 0.3
    mesh("door", [(-dw, -d / 2 - 0.004, 0), (dw, -d / 2 - 0.004, 0), (0, -d / 2 - 0.004, dh)], [(0, 1, 2)], door)
    # Tied-back flaps either side of the door.
    flap = canvas_mat(lit)
    mesh("flapL", [(-dw - 0.02, -d / 2 - 0.006, 0), (-dw + 0.04, -d / 2 - 0.006, 0), (-0.02, -d / 2 - 0.006, dh + 0.02)], [(0, 1, 2)], flap)
    mesh("flapR", [(dw - 0.04, -d / 2 - 0.006, 0), (dw + 0.02, -d / 2 - 0.006, 0), (0.02, -d / 2 - 0.006, dh + 0.02)], [(0, 1, 2)], flap)
    pole = wood("pole", "#8a5a32", "#4e2e14", scale=14)
    cyl(0, -d / 2 - 0.01, 0.014, h + 0.08, pole, z=0, bevel=0)
    rope = mat("rope", "#d8c8a4", 0.8)
    for sx in (-1, 1):
        tube([(sx * 0.48, -d / 2 - 0.08), (sx * 0.02, -d / 2)], 0.004, rope, z=0.02)
    if lit:
        point((0, -d / 2 - 0.12, 0.12), 1.2, "#ffb860", 0.05)


@sprite("tents-tent", tilt=PIECE_TILT)
def _tent():
    tent(False)


@sprite("tents-tent-lit", tilt=PIECE_TILT)
def _tent_lit():
    tent(True)


@sprite("tents-tuft", tilt=PIECE_TILT)
def _tuft():
    g = mat("tuft", "#5fae5a", 0.6, sheen=0.4)
    rnd = random.Random(4)
    for k in range(9):
        x = -0.18 + k * 0.045 + rnd.uniform(-0.01, 0.01)
        cone(x, rnd.uniform(-0.04, 0.04), 0.018, 0.0, 0.14 + rnd.uniform(0, 0.12), g, z=0, verts=6).rotation_euler = (rnd.uniform(-0.3, 0.3), rnd.uniform(-0.3, 0.3), 0)


@sprite("tents-sign")
def _sign():
    rbox(0, 0, 0.86, 0.74, 0.10, wood("tag", "#c48d55", "#5c3414", scale=5, stretch=(12, 1.2, 1)), r=0.08)
    for x in (-0.33, 0.33):
        sphere(x, 0.24, 0.035, silver("nail"), z=0.11, sz=0.5)


@sprite("tents-sign-met")
def _sign_met():
    rbox(0, 0, 0.86, 0.74, 0.10, gold("plaque", 0.38), r=0.08)
    for x in (-0.33, 0.33):
        sphere(x, 0.24, 0.035, mat("nailg", "#6b5428", 0.4, metal=1), z=0.11, sz=0.5)


# Shikaku ------------------------------------------------------------------------------------------------------
@sprite("logic-cell")
def _cell():
    tile(lacquer("cell", "#18201c"), edge=0.08, d=0.06)


JEWELS = {"sapphire": "#1d4bb8", "emerald": "#137a4a", "amber": "#c27e14", "ruby": "#a51f38"}


def pane(color):
    rim = gold("rim", 0.2)
    rbox(0, 0, 0.96, 0.96, 0.07, rim, r=0.12)
    glassm = mat("glass", color, 0.12, coat=1.0, emit=color, emit_strength=0.05)
    rbox(0, 0, 0.86, 0.86, 0.10, glassm, r=0.10, z=0.0)


for _k, _c in JEWELS.items():
    sprite(f"shikaku-pane-{_k}")((lambda c: (lambda: pane(c)))(_c))


# Lamplighter ----------------------------------------------------------------------------------------------------
@sprite("lightup-cell-lit")
def _cell_lit():
    # A lit square: the dark lacquer floor with warm light falling across it, brightest in the middle and soft at the
    # edges (an emission pool shaped by a spherical gradient), so lit and dark read at a glance.
    m = mat("litfloor", "#4a3216", 0.35, coat=0.6)
    n = m.node_tree.nodes
    l = m.node_tree.links
    tc = n.new("ShaderNodeTexCoord")
    mp = n.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1.2, 1.2, 1.0)
    grad = n.new("ShaderNodeTexGradient")
    grad.gradient_type = "SPHERICAL"
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = hexc("#7a3a08")
    ramp.color_ramp.elements[1].color = hexc("#ffbf5c")
    mid = ramp.color_ramp.elements.new(0.5)
    mid.color = hexc("#e07a18")
    l.new(tc.outputs["Object"], mp.inputs["Vector"])
    l.new(mp.outputs[0], grad.inputs["Vector"])
    l.new(grad.outputs[0], ramp.inputs[0])
    l.new(ramp.outputs[0], n["Principled BSDF"].inputs["Emission Color"])
    n["Principled BSDF"].inputs["Emission Strength"].default_value = 1.1
    tile(m, edge=0.08, d=0.06)


@sprite("lightup-wall")
def _wall():
    rbox(0, 0, 0.96, 0.96, 0.24, mat("walledge", "#3a4442", 0.3, metal=1.0), r=0.08)
    rbox(0, 0, 0.88, 0.88, 0.26, mat("wallblk", "#0b0d0d", 0.38, coat=0.8), r=0.07)


@sprite("lightup-lamp", tilt=20.0)
def _lamp():
    # A brass socket and a lit bulb: a bright warm core inside frosted glass, a crisp highlight on the glass's curve.
    cyl(0, 0, 0.26, 0.1, gold("brass", 0.3), z=0, bevel=0.03)
    cyl(0, 0, 0.17, 0.12, gold("brassring", 0.22), z=0.08, bevel=0.02)
    sphere(0, 0, 0.21, mat("bulbglass", "#ffd08a", 0.1, coat=1.0, emit="#ff9c2a", emit_strength=5.0), z=0.32)
    sphere(0, 0, 0.08, emissive("filament", "#fff2c8", 14.0), z=0.32)


# Trail ---------------------------------------------------------------------------------------------------------
@sprite("trail-given")
def _given():
    rbox(0, 0, 0.92, 0.92, 0.12, gold("tedge", 0.34), r=0.12)
    stone = bump(mat("tstone", "#3b4440", 0.55, coat=0.2), 90, 0.18, distance=0.003)
    rbox(0, 0, 0.80, 0.80, 0.14, stone, r=0.10)


@sprite("trail-stone")
def _stone():
    cyl(0, 0, 0.40, 0.12, bump(mat("ceramic", "#efe6d0", 0.28, coat=0.7), 60, 0.04, distance=0.002), z=0, bevel=0.05)


@sprite("trail-cell")
def _tcell():
    tile(lacquer("tcell", "#1b2a23"), edge=0.1, d=0.05)


# Loopline -------------------------------------------------------------------------------------------------------
@sprite("fences-slate", px=768)
def _slate():
    m = slate_mat("slate", "#24282d", "#121417")
    rbox(0, 0, 1.0, 1.0, 0.04, m, r=0.0, seg=1)


@sprite("fences-peg")
def _peg():
    cyl(0, 0, 0.26, 0.10, silver("pegbase", 0.25), bevel=0.03)
    sphere(0, 0, 0.22, silver("peg", 0.12), z=0.18, sz=0.7)


# Regions ----------------------------------------------------------------------------------------------------------
# Enamel by region size (1 to 9): rich, distinct, dark enough for white digits (the game picks the tile, never "correct").
ENAMEL = {1: "#a8306f", 2: "#2f63c4", 3: "#1f9479", 4: "#b07a1c", 5: "#6c48c0", 6: "#4a9236", 7: "#bf4430", 8: "#2380a6", 9: "#8a7428"}


def enamel(color, name):
    m = mat(name, color, 0.18, coat=1.0)
    bump(m, 200, 0.015, distance=0.001)
    tile(m, edge=0.1, d=0.08)


for _n, _c in ENAMEL.items():
    sprite(f"fillomino-tile-{_n}")((lambda c, n: (lambda: enamel(c, f"en{n}")))(_c, _n))
sprite("fillomino-tile-0")(lambda: enamel("#1a221e", "en0"))
sprite("fillomino-tile-clash")(lambda: enamel("#5a1414", "enx"))


# Island Link -----------------------------------------------------------------------------------------------------
@sprite("bridges-slate", px=768)
def _bslate():
    m = slate_mat("bslate", "#1a2a4c", "#0b1428")
    rbox(0, 0, 1.0, 1.0, 0.04, m, r=0.0, seg=1)


def coin(full):
    bezel = gold("bez", 0.2) if full else silver("bez", 0.18)
    cyl(0, 0, 0.46, 0.10, bezel, bevel=0.035)
    # A brushed gold face (rough enough to gather the bright band, so it shines without mirroring a light).
    face = gold("face", 0.36) if full else mat("enamelblk", "#0b1110", 0.14, coat=1.0)
    cyl(0, 0, 0.37, 0.115, face, bevel=0.012)


@sprite("bridges-coin")
def _coin():
    coin(False)


@sprite("bridges-coin-met")
def _coin_met():
    coin(True)


# ------------------------------------------------------------------------------------------------------- run
def render(name):
    fn, opts = SPRITES[name]
    px = opts.get("px", PX)
    reset(px, px, view=1.0, tilt=opts.get("tilt", 0.0))
    if opts.get("tilt"):
        # A standing piece: its ground point sits a little below the middle, so its top stays inside the square.
        bpy.context.scene.camera.data.shift_y = 0.16
    fn()
    os.makedirs(OUT, exist_ok=True)
    s = bpy.context.scene
    s.render.filepath = os.path.join(OUT, f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print("wrote", name, flush=True)


if __name__ == "__main__":
    names = [a for a in sys.argv[1:] if not a.startswith("-")] or list(SPRITES)
    for n in names:
        render(n)
