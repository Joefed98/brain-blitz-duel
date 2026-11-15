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
    # A studio sky for the metals to reflect: dark below, a soft bright band above-left (the camera sees none of it:
    # the film is transparent).
    nt = w_.node_tree
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.35
    ramp.color_ramp.elements[0].color = hexc("#121418")
    ramp.color_ramp.elements[1].position = 0.9
    ramp.color_ramp.elements[1].color = hexc("#8a8884")
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs[2], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], nt.nodes["Background"].inputs[0])
    nt.nodes["Background"].inputs[1].default_value = 0.6
    lights()
    return s


def area(loc, size, energy, color, target=(0, 0, 0)):
    d = bpy.data.lights.new("a", "AREA")
    d.energy = energy
    d.color = hexc(color)[:3]
    d.size = size
    ob = bpy.data.objects.new("a", d)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    ob.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return ob


def lights(key=1.0):
    """Clean, even studio light (Joe, 15 Nov 2026: no glare): a large soft key from the top left, a broad overhead
    wash and a soft fill, so no surface shows a hot spot or a reflected light."""
    area((-2.2, 2.4, 3.2), 6.0, 200 * key, "#fff4e6")
    area((0.0, 0.0, 4.0), 8.0, 160 * key, "#ffffff")
    area((2.6, -1.0, 2.2), 6.0, 70 * key, "#e6eeff")


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
    # No glare (Joe, 15 Nov 2026): never a clear coat, and every surface satin or matte (metals brushed), so no
    # reflection runs across a panel, tile or number.
    coat = 0.0
    rough = max(rough, 0.45 if metal else 0.55)
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
    wave.inputs["Distortion"].default_value = 6.0
    wave.inputs["Detail"].default_value = 4.0
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = hexc(c2)
    ramp.color_ramp.elements[1].color = hexc(c1)
    l.new(tc.outputs["Object"], mp.inputs["Vector"])
    l.new(mp.outputs[0], wave.inputs["Vector"])
    l.new(wave.outputs[0], ramp.inputs[0])
    l.new(ramp.outputs[0], n["Principled BSDF"].inputs["Base Color"])
    return m


def gold(name="gold", rough=0.22):
    return mat(name, "#d8b56a", rough, metal=1.0)


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
@sprite("tents-turf")
def _turf():
    m = bump(mat("turf", "#1d3a27", 0.82, sheen=0.5), 260, 0.35, distance=0.004)
    tile(m, edge=0.07)


def pine(seed, tiers=3):
    rnd = random.Random(seed)
    trunk = wood("trunk", "#7a4a26", "#3e220e", scale=12)
    rbox(0, -0.30, 0.10, 0.16, 0.10, trunk, r=0.02)
    greens = ["#2f8f4c", "#3aa858", "#4cbb68"]
    for k in range(tiers):
        w = 0.74 - k * 0.17
        bot = -0.24 + k * 0.17
        top = bot + 0.36
        c = greens[k]
        m = bump(mat(f"pine{k}", c, 0.5, coat=0.35, sheen=0.3), 90, 0.18, distance=0.003)
        jig = rnd.uniform(-0.015, 0.015)
        slab([(-w / 2 + jig, bot), (w / 2 + jig, bot), (jig * 0.5, top)], 0.08 + k * 0.03, m, z=0.06 + k * 0.03, bevel=0.012)
    # a soft contact shadow is the film's own: nothing under the tree


@sprite("tents-tree-a")
def _tree_a():
    pine(1, 3)


@sprite("tents-tree-b")
def _tree_b():
    trunk = wood("trunk", "#7a4a26", "#3e220e", scale=12)
    rbox(0, -0.28, 0.10, 0.20, 0.10, trunk, r=0.02)
    leaf = bump(mat("leaf", "#3f9d55", 0.55, coat=0.3, sheen=0.4), 70, 0.35, kind="voronoi", distance=0.006)
    for (x, y, r) in ((0, 0.05, 0.27), (-0.15, -0.04, 0.17), (0.15, -0.03, 0.18), (0.02, 0.2, 0.17)):
        sphere(x, y, r, leaf, z=0.12 + r * 0.6, sz=0.55)


def tent(lit):
    canvas = bump(mat("canvas", "#e2c58d", 0.6, sheen=0.4, coat=0.15), 220, 0.10, stretch=(1, 4, 1), distance=0.002)
    seam = mat("seam", "#a9884e", 0.55)
    # A ridge tent seen from the front-top: a gable triangle and the roof falling away.
    slab([(-0.40, -0.30), (0.40, -0.30), (0.0, 0.34)], 0.16, canvas, z=0.02, bevel=0.02)
    slab([(-0.36, -0.30), (-0.30, -0.30), (-0.02, 0.28)], 0.17, seam, z=0.02, bevel=0.004)
    slab([(0.36, -0.30), (0.30, -0.30), (0.02, 0.28)], 0.17, seam, z=0.02, bevel=0.004)
    if lit:
        door = mat("doorlit", "#e89a3c", 0.7, emit="#ffa040", emit_strength=1.2)
        point((0, -0.18, 0.12), 0.6, "#ffc26b", 0.04)
    else:
        door = mat("door", "#3c2810", 0.7)
    slab([(-0.12, -0.30), (0.12, -0.30), (0.0, 0.02)], 0.185, door, z=0.02, bevel=0.004)
    pole = wood("pole", "#8a5a32", "#4e2e14", scale=14)
    cyl(0, 0.36, 0.022, 0.24, pole, z=0.02, bevel=0)


@sprite("tents-tent")
def _tent():
    tent(False)


@sprite("tents-tent-lit")
def _tent_lit():
    tent(True)


@sprite("tents-tuft")
def _tuft():
    g = mat("tuft", "#6cc276", 0.5, sheen=0.4)
    rnd = random.Random(4)
    for k in range(7):
        x = -0.16 + k * 0.055 + rnd.uniform(-0.01, 0.01)
        tube([(x, -0.18), (x + rnd.uniform(-0.08, 0.08), 0.12 + rnd.uniform(0, 0.12))], 0.022, g, z=0.03)


@sprite("tents-sign")
def _sign():
    rbox(0, 0, 0.86, 0.74, 0.10, wood("tag", "#b07a46", "#6e4320", scale=7, stretch=(10, 1, 1)), r=0.08)
    for x in (-0.33, 0.33):
        sphere(x, 0.24, 0.035, silver("nail"), z=0.11, sz=0.5)


@sprite("tents-sign-met")
def _sign_met():
    rbox(0, 0, 0.86, 0.74, 0.10, gold("plaque", 0.28), r=0.08)
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
    glassm = mat("glass", color, 0.6)
    rbox(0, 0, 0.86, 0.86, 0.10, glassm, r=0.10, z=0.0)


for _k, _c in JEWELS.items():
    sprite(f"shikaku-pane-{_k}")((lambda c: (lambda: pane(c)))(_c))


# Lamplighter ----------------------------------------------------------------------------------------------------
@sprite("lightup-cell-lit")
def _cell_lit():
    m = bump(mat("litfloor", "#a8661c", 0.6, emit="#e8922a", emit_strength=0.25), 160, 0.02, distance=0.002)
    tile(m, edge=0.08, d=0.06)


@sprite("lightup-wall")
def _wall():
    rbox(0, 0, 0.96, 0.96, 0.24, mat("walledge", "#3a4442", 0.3, metal=1.0), r=0.08)
    rbox(0, 0, 0.88, 0.88, 0.26, mat("wallblk", "#0b0d0d", 0.38, coat=0.8), r=0.07)


@sprite("lightup-lamp")
def _lamp():
    cyl(0, 0, 0.30, 0.08, gold("brass", 0.25), z=0, bevel=0.02)
    sphere(0, 0, 0.22, mat("bulb", "#ffd08a", 0.1, coat=1.0, emit="#ff9a24", emit_strength=0.9), z=0.24)
    point((0, 0, 0.6), 4.0, "#ffcf7a")


# Trail ---------------------------------------------------------------------------------------------------------
@sprite("trail-given")
def _given():
    rbox(0, 0, 0.92, 0.92, 0.12, gold("tedge", 0.24), r=0.12)
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
    m = bump(mat("slate", "#15181b", 0.85), 26, 0.22, distance=0.004)
    rbox(0, 0, 1.0, 1.0, 0.04, m, r=0.0, seg=1)


@sprite("fences-peg")
def _peg():
    cyl(0, 0, 0.26, 0.10, silver("pegbase", 0.25), bevel=0.03)
    sphere(0, 0, 0.22, silver("peg", 0.12), z=0.18, sz=0.7)


# Regions ----------------------------------------------------------------------------------------------------------
# Enamel by region size (1 to 9): rich, distinct, dark enough for white digits (the game picks the tile, never "correct").
ENAMEL = {1: "#7a2f5a", 2: "#2f5aa8", 3: "#2a7d6a", 4: "#8a6420", 5: "#5a3f9a", 6: "#3d7a2e", 7: "#9a3a2c", 8: "#24607a", 9: "#6a5a2a"}


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
    m = bump(mat("bslate", "#0f1a33", 0.85), 26, 0.2, distance=0.004)
    rbox(0, 0, 1.0, 1.0, 0.04, m, r=0.0, seg=1)


def coin(full):
    bezel = gold("bez", 0.2) if full else silver("bez", 0.18)
    cyl(0, 0, 0.46, 0.10, bezel, bevel=0.035)
    face = gold("face", 0.4) if full else mat("enamelblk", "#0b1110", 0.14, coat=1.0)
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
    reset(px, px, view=1.0)
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
