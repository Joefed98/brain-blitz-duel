"""Shared toolkit for the game concept renders (phase 2, step 4). Concept art only: nothing here ships in the app.

Run a game script with Blender's Python module (bpy 5.3, `pip install bpy`):
    python docs/design/game-concepts/source/<category>/<game>.py [look ...]

Coordinates: the phone screen is 390 x 844 px. `P(x, y)` maps screen px (y down from the top) to Blender units
(1 unit = 100 px, y up), so a top-down camera over the screen rectangle frames the real layout exactly.
"""
import math, os, sys, random
import bpy
import bmesh
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
OUT = os.path.abspath(os.path.join(HERE, ".."))
TEX = os.path.join("/tmp", "game-concepts-tex")
os.makedirs(TEX, exist_ok=True)
FONT = {
    600: os.path.join(HERE, "Archivo-600.ttf"),
    800: os.path.join(HERE, "Archivo-800.ttf"),
    "serif": "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
    "serif-r": "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
    "sym": "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
}
W, H = 390, 844
HEADER = 60  # the game frame's header height in px

# Joulz palette (src/design/tokens.css and the art kit)
INK = (0x06, 0x08, 0x0F)
NAVY = (0x0F, 0x14, 0x24)
NAVY2 = (0x1E, 0x26, 0x40)
CHAMP = (0xE2, 0xC0, 0x7A)
ARTGOLD = (0xED, 0xB4, 0x3E)
CREAM = (0xF5, 0xEE, 0xDC)


def lin(c):
    """sRGB 0-255 (or hex) -> linear RGBA for Blender."""
    if isinstance(c, str):
        c = c.lstrip("#")
        c = tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))
    out = []
    for v in c[:3]:
        v = v / 255.0
        out.append(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)


def P(x, y, z=0.0):
    return Vector((x / 100.0, (H - y) / 100.0, z))


def u(px):
    return px / 100.0


# ---------------------------------------------------------------- scene

def reset(samples=96, scale=1.2, view="AgX", look="AgX - Punchy", exposure=-0.3):
    if os.environ.get("QUICK"):
        samples, scale = 24, 0.8
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.cycles.samples = samples
    s.cycles.use_denoising = True
    s.cycles.denoiser = "OPENIMAGEDENOISE"
    s.cycles.max_bounces = 8
    s.cycles.transparent_max_bounces = 16
    s.cycles.transmission_bounces = 8
    s.render.resolution_x = int(W * scale)
    s.render.resolution_y = int(H * scale)
    s.render.film_transparent = False
    try:
        s.view_settings.view_transform = view
        s.view_settings.look = look if view == "AgX" else "None"
        s.view_settings.exposure = exposure
    except Exception:
        pass
    s.world = bpy.data.worlds.new("World")
    s.world.use_nodes = True
    world_color((8, 10, 16), 0.3)
    return s


def world_color(rgb, strength=1.0):
    nt = bpy.context.scene.world.node_tree
    bg = nt.nodes["Background"]
    bg.inputs[0].default_value = lin(rgb)
    bg.inputs[1].default_value = strength


def world_sky(strength=0.4, sun_elev=25, sun_rot=200):
    """A procedural sky (no downloaded HDRI is needed)."""
    nt = bpy.context.scene.world.node_tree
    sky = nt.nodes.new("ShaderNodeTexSky")
    try:
        sky.sky_type = "NISHITA"
    except Exception:
        pass
    try:
        sky.sun_elevation = math.radians(sun_elev)
        sky.sun_rotation = math.radians(sun_rot)
    except Exception:
        pass
    bg = nt.nodes["Background"]
    nt.links.new(sky.outputs[0], bg.inputs[0])
    bg.inputs[1].default_value = strength


def cam_top(lens=None, tilt=0.0, dist=40.0, cx=W / 2, cy=H / 2, ortho=True, fit_h=H):
    """A camera over the screen. ortho: exact layout. tilt (deg) leans it back for a tabletop feel."""
    target = P(cx, cy)
    cam_data = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    if ortho:
        cam_data.type = "ORTHO"
        cam_data.ortho_scale = u(fit_h)
        cam.location = target + Vector((0, 0, dist))
        cam.rotation_euler = (0, 0, 0)
    else:
        cam_data.lens = lens or 120
        cam_data.sensor_fit = "VERTICAL"
        cam_data.sensor_height = 36
        # distance so the vertical field covers fit_h at the target
        fov = 2 * math.atan(18 / cam_data.lens)
        d = (u(fit_h) / 2) / math.tan(fov / 2)
        t = math.radians(tilt)
        cam.location = target + Vector((0, -d * math.sin(t), d * math.cos(t)))
        cam.rotation_euler = (t, 0, 0)
    cam_data.clip_end = 1000
    return cam


def cam_look(loc, target, lens=35, roll=0.0):
    cam_data = bpy.data.cameras.new("cam")
    cam = bpy.data.objects.new("cam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    cam_data.lens = lens
    cam_data.sensor_fit = "VERTICAL"
    cam_data.sensor_height = 24
    cam_data.clip_end = 5000
    cam.location = Vector(loc)
    d = Vector(target) - Vector(loc)
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    cam.rotation_euler.rotate_axis("Z", math.radians(roll))
    return cam


def dof(cam, focus_obj_or_dist, fstop=2.8):
    cam.data.dof.use_dof = True
    if isinstance(focus_obj_or_dist, (int, float)):
        cam.data.dof.focus_distance = focus_obj_or_dist
    else:
        cam.data.dof.focus_object = focus_obj_or_dist
    cam.data.dof.aperture_fstop = fstop


def area(loc, target, size=4.0, energy=500, color=(255, 255, 255), size_y=None, spread=None):
    ld = bpy.data.lights.new("area", "AREA")
    ld.energy = energy
    ld.color = lin(color)[:3]
    if size_y:
        ld.shape = "RECTANGLE"
        ld.size = size
        ld.size_y = size_y
    else:
        ld.size = size
    if spread:
        ld.spread = math.radians(spread)
    o = bpy.data.objects.new("area", ld)
    bpy.context.scene.collection.objects.link(o)
    o.location = Vector(loc)
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return o


def point(loc, energy=50, color=(255, 255, 255), radius=0.1):
    ld = bpy.data.lights.new("pt", "POINT")
    ld.energy = energy
    ld.color = lin(color)[:3]
    ld.shadow_soft_size = radius
    o = bpy.data.objects.new("pt", ld)
    bpy.context.scene.collection.objects.link(o)
    o.location = Vector(loc)
    return o


def sun(rot=(40, 0, 30), energy=3.0, color=(255, 244, 228), angle=2.0):
    ld = bpy.data.lights.new("sun", "SUN")
    ld.energy = energy
    ld.color = lin(color)[:3]
    ld.angle = math.radians(angle)
    o = bpy.data.objects.new("sun", ld)
    bpy.context.scene.collection.objects.link(o)
    o.rotation_euler = tuple(math.radians(a) for a in rot)
    return o


def studio(key=900, fill=150, rim=300, cx=W / 2, cy=H / 2, h=12.0, warm=(255, 244, 230)):
    """The art kit's rig: one key from the top left, a soft fill, a faint rim."""
    c = P(cx, cy)
    area(c + Vector((-6, 5, h)), c, size=8, energy=key, color=warm)
    area(c + Vector((7, -3, h * 0.8)), c, size=10, energy=fill, color=(220, 230, 255))
    area(c + Vector((0, 9, 3)), c, size=6, energy=rim, color=(255, 255, 255))


# ---------------------------------------------------------------- materials

def node_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    return m, nt, bsdf


def _set(bsdf, key, val):
    if key in bsdf.inputs:
        bsdf.inputs[key].default_value = val


def mat(name, color, rough=0.4, metal=0.0, coat=0.0, coat_rough=0.05, spec=0.5, trans=0.0, ior=1.45,
        emit=None, emit_str=0.0, sheen=0.0, alpha=1.0, aniso=0.0, sss=0.0):
    m, nt, b = node_mat(name)
    _set(b, "Base Color", lin(color))
    _set(b, "Roughness", rough)
    _set(b, "Metallic", metal)
    _set(b, "Coat Weight", coat)
    _set(b, "Coat Roughness", coat_rough)
    _set(b, "Specular IOR Level", spec)
    _set(b, "Transmission Weight", trans)
    _set(b, "IOR", ior)
    _set(b, "Sheen Weight", sheen)
    _set(b, "Anisotropic", aniso)
    _set(b, "Alpha", alpha)
    _set(b, "Subsurface Weight", sss)
    if emit is not None:
        _set(b, "Emission Color", lin(emit))
        _set(b, "Emission Strength", emit_str)
    return m


def glass(name="glass", color=(255, 255, 255), rough=0.02, ior=1.5):
    return mat(name, color, rough=rough, trans=1.0, ior=ior, spec=0.5)


def gold(name="gold", color=ARTGOLD, rough=0.22, brushed=False):
    m = mat(name, color, rough=rough, metal=1.0, aniso=0.6 if brushed else 0.0)
    return m


def textured(name, img_path, rough=0.4, coat=0.0, metal=0.0, bump=None, bump_str=0.05, emit=0.0, alpha=False,
             sheen=0.0, coat_rough=0.05):
    m, nt, b = node_mat(name)
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(img_path, check_existing=True)
    tex.interpolation = "Cubic"
    tex.extension = "CLIP"
    nt.links.new(tex.outputs["Color"], b.inputs["Base Color"])
    if alpha:
        nt.links.new(tex.outputs["Alpha"], b.inputs["Alpha"])
    _set(b, "Roughness", rough)
    _set(b, "Coat Weight", coat)
    _set(b, "Coat Roughness", coat_rough)
    _set(b, "Metallic", metal)
    _set(b, "Sheen Weight", sheen)
    if emit:
        nt.links.new(tex.outputs["Color"], b.inputs["Emission Color"])
        _set(b, "Emission Strength", emit)
    if bump:
        bt = nt.nodes.new("ShaderNodeTexImage")
        bt.image = bpy.data.images.load(bump, check_existing=True)
        bt.image.colorspace_settings.name = "Non-Color"
        bn = nt.nodes.new("ShaderNodeBump")
        bn.inputs["Strength"].default_value = bump_str
        nt.links.new(bt.outputs["Color"], bn.inputs["Height"])
        nt.links.new(bn.outputs["Normal"], b.inputs["Normal"])
    return m


def felt(name, color, scale=900.0, bump=0.35, sheen=0.6):
    """Baize: a fine fibre noise in the colour and the normal, with a velvet sheen."""
    m, nt, b = node_mat(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = scale
    n.inputs["Detail"].default_value = 8
    nt.links.new(tc.outputs["Object"], n.inputs["Vector"])
    n2 = nt.nodes.new("ShaderNodeTexNoise")
    n2.inputs["Scale"].default_value = 6
    nt.links.new(tc.outputs["Object"], n2.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeMapRange")
    ramp.inputs["To Min"].default_value = 0.88
    ramp.inputs["To Max"].default_value = 1.08
    nt.links.new(n.outputs["Fac"], ramp.inputs["Value"])
    mul = nt.nodes.new("ShaderNodeMixRGB")
    mul.blend_type = "MULTIPLY"
    mul.inputs["Fac"].default_value = 1.0
    mul.inputs[1].default_value = lin(color)
    nt.links.new(ramp.outputs[0], mul.inputs[2])
    mul2 = nt.nodes.new("ShaderNodeMixRGB")
    mul2.blend_type = "OVERLAY"
    mul2.inputs["Fac"].default_value = 0.12
    nt.links.new(mul.outputs[0], mul2.inputs[1])
    nt.links.new(n2.outputs["Fac"], mul2.inputs[2])
    nt.links.new(mul2.outputs[0], b.inputs["Base Color"])
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = bump
    bp.inputs["Distance"].default_value = 0.002
    nt.links.new(n.outputs["Fac"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    _set(b, "Roughness", 0.92)
    _set(b, "Sheen Weight", sheen)
    _set(b, "Sheen Roughness", 0.4)
    _set(b, "Specular IOR Level", 0.2)
    return m


def wood(name, light=(170, 110, 62), dark=(96, 54, 26), scale=2.0, coat=0.6, rough=0.35, rot=0.0, stretch=12.0,
         coat_rough=0.04):
    """Lacquered wood: stretched ring noise for grain, a fine pore noise, a clear coat."""
    m, nt, b = node_mat(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (scale, scale * stretch, scale)
    mp.inputs["Rotation"].default_value = (0, 0, rot)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    wv = nt.nodes.new("ShaderNodeTexWave")
    wv.wave_type = "RINGS"
    wv.inputs["Scale"].default_value = 1.4
    wv.inputs["Distortion"].default_value = 6.0
    wv.inputs["Detail"].default_value = 3.0
    wv.inputs["Detail Scale"].default_value = 1.5
    nt.links.new(mp.outputs[0], wv.inputs["Vector"])
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 40
    nz.inputs["Detail"].default_value = 6
    nt.links.new(mp.outputs[0], nz.inputs["Vector"])
    mix = nt.nodes.new("ShaderNodeMath")
    mix.operation = "MULTIPLY_ADD"
    mix.inputs[1].default_value = 0.75
    nt.links.new(wv.outputs["Fac"], mix.inputs[0])
    sc = nt.nodes.new("ShaderNodeMath")
    sc.operation = "MULTIPLY"
    sc.inputs[1].default_value = 0.25
    nt.links.new(nz.outputs["Fac"], sc.inputs[0])
    nt.links.new(sc.outputs[0], mix.inputs[2])
    cr = nt.nodes.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].color = lin(dark)
    cr.color_ramp.elements[1].color = lin(light)
    nt.links.new(mix.outputs[0], cr.inputs["Fac"])
    nt.links.new(cr.outputs[0], b.inputs["Base Color"])
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.08
    nt.links.new(nz.outputs["Fac"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    _set(b, "Roughness", rough)
    _set(b, "Coat Weight", coat)
    _set(b, "Coat Roughness", coat_rough)
    return m


def noisy(name, color, color2, scale=20.0, rough=0.5, metal=0.0, bump=0.1, coat=0.0, detail=6):
    """A two-tone noise material (stone, ice, paper, brushed or worn surfaces)."""
    m, nt, b = node_mat(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = detail
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    cr = nt.nodes.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].color = lin(color)
    cr.color_ramp.elements[1].color = lin(color2)
    nt.links.new(nz.outputs["Fac"], cr.inputs["Fac"])
    nt.links.new(cr.outputs[0], b.inputs["Base Color"])
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = bump
    nt.links.new(nz.outputs["Fac"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    _set(b, "Roughness", rough)
    _set(b, "Metallic", metal)
    _set(b, "Coat Weight", coat)
    return m


def emission(name, color, strength=5.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(n)
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs[0].default_value = lin(color)
    e.inputs[1].default_value = strength
    nt.links.new(e.outputs[0], nt.nodes["Material Output"].inputs[0])
    return m


# ---------------------------------------------------------------- geometry

def link(o):
    bpy.context.scene.collection.objects.link(o)
    return o


def rbox(name, w, h, d, r=0.0, seg=6, mat_=None, loc=(0, 0, 0), rot=(0, 0, 0)):
    """A box w x h x d (Blender units) with rounded vertical and top edges (bevel)."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= w
        v.co.y *= h
        v.co.z *= d
    bm.to_mesh(me)
    bm.free()
    o = link(bpy.data.objects.new(name, me))
    if r > 0:
        bv = o.modifiers.new("bevel", "BEVEL")
        bv.width = min(r, min(w, h, d) * 0.499)
        bv.segments = seg
        bv.limit_method = "NONE"
        bv.harden_normals = False
    o.location = Vector(loc)
    o.rotation_euler = rot
    if mat_:
        o.data.materials.append(mat_)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def plate(name, w, h, d, r, seg=8, mat_=None, loc=(0, 0, 0), edge=0.0, rot=(0, 0, 0)):
    """A slab with rounded corners in plan (r) and an optional small edge round (edge)."""
    bpy.ops.mesh.primitive_plane_add(size=1)
    o = bpy.context.object
    o.name = name
    me = o.data
    bm = bmesh.new()
    bm.from_mesh(me)
    for v in bm.verts:
        v.co.x *= w
        v.co.y *= h
    if r > 0:
        bmesh.ops.bevel(bm, geom=list(bm.verts), offset=min(r, min(w, h) * 0.499), segments=seg, affect="VERTICES")
    ret = bmesh.ops.extrude_face_region(bm, geom=list(bm.faces))
    for v in [e for e in ret["geom"] if isinstance(e, bmesh.types.BMVert)]:
        v.co.z += d
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(me)
    bm.free()
    if edge > 0:
        bv = o.modifiers.new("bevel", "BEVEL")
        bv.width = edge
        bv.segments = 3
        bv.limit_method = "ANGLE"
        bv.angle_limit = math.radians(50)
    o.location = Vector(loc)
    o.rotation_euler = rot
    if mat_:
        me.materials.append(mat_)
    for p in me.polygons:
        p.use_smooth = True
    return o


def uv_top(o):
    """Planar UVs from the object's own x/y bounds, so a texture covers its top face once."""
    me = o.data
    if not me.uv_layers:
        me.uv_layers.new()
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    uvl = me.uv_layers.active.data
    for poly in me.polygons:
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index].co
            uvl[li].uv = ((v.x - x0) / (x1 - x0), (v.y - y0) / (y1 - y0))


def faced_plate(name, w, h, d, r, face_mat, side_mat, loc=(0, 0, 0), edge=0.0, rot=(0, 0, 0), seg=8):
    """A rounded slab whose top face carries face_mat (UV-mapped once) and other faces side_mat."""
    o = plate(name, w, h, d, r, seg=seg, mat_=side_mat, loc=loc, edge=edge, rot=rot)
    o.data.materials.append(face_mat)
    uv_top(o)
    top = max(v.co.z for v in o.data.vertices)
    for p in o.data.polygons:
        if p.normal.z > 0.9 and abs(p.center.z - top) < 1e-4:
            p.material_index = 1
    return o


def cyl(name, r, d, mat_=None, loc=(0, 0, 0), verts=64, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d, vertices=verts, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    if bevel:
        bv = o.modifiers.new("bevel", "BEVEL")
        bv.width = bevel
        bv.segments = 4
        bv.limit_method = "ANGLE"
    if mat_:
        o.data.materials.append(mat_)
    bpy.ops.object.shade_smooth()
    return o


def sphere(name, r, mat_=None, loc=(0, 0, 0), seg=48):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, segments=seg, ring_count=seg // 2, location=loc)
    o = bpy.context.object
    o.name = name
    if mat_:
        o.data.materials.append(mat_)
    bpy.ops.object.shade_smooth()
    return o


def torus(name, R, r, mat_=None, loc=(0, 0, 0), rot=(0, 0, 0), seg=64):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=seg, minor_segments=16,
                                     location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    if mat_:
        o.data.materials.append(mat_)
    bpy.ops.object.shade_smooth()
    return o


def text3d(s, size, mat_, loc, font=800, depth=0.0, align="CENTER", rot=(0, 0, 0), bevel=0.0):
    cu = bpy.data.curves.new("txt", "FONT")
    cu.body = s
    cu.font = bpy.data.fonts.load(FONT[font], check_existing=True)
    cu.size = size
    cu.align_x = align
    cu.align_y = "CENTER"
    cu.extrude = depth
    cu.bevel_depth = bevel
    o = link(bpy.data.objects.new("txt", cu))
    o.location = Vector(loc)
    o.rotation_euler = rot
    o.data.materials.append(mat_)
    return o


def tube_path(name, pts, r, mat_, closed=False, res=12):
    """A round tube along a list of 3D points (rails, kerbs, rainbow lines)."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r
    cu.bevel_resolution = 6
    cu.resolution_u = res
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (p[0], p[1], p[2], 1)
    sp.use_cyclic_u = closed
    o = link(bpy.data.objects.new(name, cu))
    o.data.materials.append(mat_)
    return o


def ground(mat_, size=60, z=0.0, loc=None):
    bpy.ops.mesh.primitive_plane_add(size=size, location=loc or (W / 200, H / 200, z))
    o = bpy.context.object
    o.data.materials.append(mat_)
    return o


# ---------------------------------------------------------------- textures (PIL)

def pil():
    from PIL import Image, ImageDraw, ImageFont, ImageFilter
    return Image, ImageDraw, ImageFont, ImageFilter


def font(key, size):
    _, _, ImageFont, _ = pil()
    return ImageFont.truetype(FONT[key], size)


SUITS = {"S": "♠", "H": "♥", "D": "♦", "C": "♣"}


def suit_poly(d, cx, cy, s, suit, fill):
    """Draws a suit pip as a smooth vector shape (no font glyphs), size s = pip height."""
    import math as m
    pts = []
    if suit == "D":
        pts = [(cx, cy - s / 2), (cx + s * 0.36, cy), (cx, cy + s / 2), (cx - s * 0.36, cy)]
        # slightly curved sides
        out = []
        for i in range(4):
            a, b = pts[i], pts[(i + 1) % 4]
            for t in range(10):
                tt = t / 10
                x = a[0] + (b[0] - a[0]) * tt
                y = a[1] + (b[1] - a[1]) * tt
                bulge = m.sin(tt * m.pi) * s * 0.03
                mx, my = (cx - x), (cy - y)
                ln = (mx * mx + my * my) ** 0.5 or 1
                out.append((x + mx / ln * bulge, y + my / ln * bulge))
        d.polygon(out, fill=fill)
        return
    if suit == "H":
        for i in range(200):
            t = i / 200 * 2 * m.pi
            x = 16 * m.sin(t) ** 3
            y = 13 * m.cos(t) - 5 * m.cos(2 * t) - 2 * m.cos(3 * t) - m.cos(4 * t)
            pts.append((cx + x * s / 34, cy - y * s / 32 - s * 0.04))
        d.polygon(pts, fill=fill)
        return
    if suit == "S":
        for i in range(200):
            t = i / 200 * 2 * m.pi
            x = 16 * m.sin(t) ** 3
            y = 13 * m.cos(t) - 5 * m.cos(2 * t) - 2 * m.cos(3 * t) - m.cos(4 * t)
            pts.append((cx + x * s / 34, cy + y * s / 32 - s * 0.1))
        d.polygon(pts, fill=fill)
        d.polygon([(cx, cy + s * 0.05), (cx - s * 0.2, cy + s * 0.5), (cx + s * 0.2, cy + s * 0.5)], fill=fill)
        return
    if suit == "C":
        r = s * 0.22
        for (dx, dy) in ((0, -0.2), (-0.23, 0.08), (0.23, 0.08)):
            d.ellipse([cx + dx * s - r, cy + dy * s - r, cx + dx * s + r, cy + dy * s + r], fill=fill)
        d.polygon([(cx, cy - s * 0.05), (cx - s * 0.2, cy + s * 0.5), (cx + s * 0.2, cy + s * 0.5)], fill=fill)
        d.ellipse([cx - s * 0.1, cy - s * 0.1, cx + s * 0.1, cy + s * 0.3], fill=fill)


def card_face(rank, suit, style="real", W_=300, H_=440):
    """A card face texture. style 'real': ivory stock, classic red/black; 'joulz': ivory with ink and a
    champagne-gold court frame. Court cards are an original monogram plaque (no traditional portraits)."""
    Image, ImageDraw, ImageFont, ImageFilter = pil()
    path = os.path.join(TEX, f"card-{style}-{rank}{suit}.png")
    if os.path.exists(path):
        return path
    S = 2
    w, h = W_ * S, H_ * S
    stock = (250, 246, 236) if style == "real" else (246, 243, 236)
    im = Image.new("RGBA", (w, h), stock + (255,))
    d = ImageDraw.Draw(im)
    red = (168, 12, 30) if style == "real" else (182, 22, 44)
    black = (8, 8, 12) if style == "real" else (6, 10, 24)
    col = red if suit in "HD" else black
    # fine paper border
    d.rounded_rectangle([6, 6, w - 7, h - 7], radius=34, outline=(225, 218, 200) if style == "real" else (214, 196, 150), width=3)
    f = font("serif", int(h * 0.27)) if style == "real" else font(800, int(h * 0.25))
    # large corner index (the game's style: rank and suit side by side across the top strip)
    tw = d.textlength(rank, font=f)
    if rank == "10":
        f2 = font("serif", int(h * 0.24)) if style == "real" else font(800, int(h * 0.22))
        tw = d.textlength(rank, font=f2)
        d.text((w * 0.07, h * 0.15), rank, font=f2, fill=col, anchor="lm")
    else:
        d.text((w * 0.09, h * 0.15), rank, font=f, fill=col, anchor="lm")
    suit_poly(d, w * 0.84, h * 0.15, h * 0.2, suit, col)
    # small rotated index at the foot
    ix = Image.new("RGBA", (w, int(h * 0.2)), (0, 0, 0, 0))
    di = ImageDraw.Draw(ix)
    fs = font("serif", int(h * 0.13)) if style == "real" else font(800, int(h * 0.12))
    di.text((w * 0.08, h * 0.1), rank, font=fs, fill=col, anchor="lm")
    suit_poly(di, w * 0.08 + di.textlength(rank, font=fs) + w * 0.1, h * 0.1, h * 0.1, suit, col)
    im.alpha_composite(ix.rotate(180), (0, int(h * 0.8)))
    cx, cy = w / 2, h * 0.56
    if rank in ("J", "Q", "K"):
        gold_ = (184, 142, 62) if style == "real" else (196, 158, 86)
        d.rounded_rectangle([w * 0.16, h * 0.32, w * 0.84, h * 0.78], radius=22, outline=gold_, width=7)
        d.rounded_rectangle([w * 0.21, h * 0.35, w * 0.79, h * 0.75], radius=14, outline=col, width=3)
        fm = font("serif", int(h * 0.22))
        d.text((cx, cy - h * 0.035), rank, font=fm, fill=col, anchor="mm")
        suit_poly(d, cx, cy + h * 0.13, h * 0.07, suit, gold_)
    else:
        suit_poly(d, cx, cy, h * 0.3 if rank == "A" else h * 0.26, suit, col)
    im = im.resize((W_, H_), Image.LANCZOS)
    im.save(path)
    return path


def card_back(style="real", W_=300, H_=440):
    Image, ImageDraw, ImageFont, ImageFilter = pil()
    path = os.path.join(TEX, f"back-{style}.png")
    if os.path.exists(path):
        return path
    S = 2
    w, h = W_ * S, H_ * S
    if style == "real":
        bg, line, rim = (122, 24, 34), (176, 64, 70), (250, 246, 236)
    else:
        bg, line, rim = (16, 26, 62), (40, 58, 112), (246, 243, 236)
    im = Image.new("RGBA", (w, h), rim + (255,))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([18, 18, w - 19, h - 19], radius=26, fill=bg)
    # fine diamond lattice
    step = 30
    for k in range(-h, w + h, step):
        d.line([(k, 30), (k + h, 30 + h)], fill=line, width=2)
        d.line([(k, 30), (k - h, 30 + h)], fill=line, width=2)
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([30, 30, w - 31, h - 31], radius=18, fill=255)
    base = Image.new("RGBA", (w, h), rim + (255,))
    ImageDraw.Draw(base).rounded_rectangle([18, 18, w - 19, h - 19], radius=26, fill=bg)
    base.paste(im, (0, 0), mask)
    d = ImageDraw.Draw(base)
    d.rounded_rectangle([30, 30, w - 31, h - 31], radius=18, outline=(214, 180, 112) if style != "real" else line, width=4)
    if style != "real":
        # a small champagne bolt medallion (Joulz mark: original geometry)
        cx, cy = w / 2, h / 2
        gd = (214, 180, 112)
        d.ellipse([cx - 74, cy - 74, cx + 74, cy + 74], fill=bg, outline=gd, width=7)
        d.polygon([(cx + 12, cy - 48), (cx - 26, cy + 6), (cx - 2, cy + 6), (cx - 12, cy + 48), (cx + 26, cy - 6),
                   (cx + 2, cy - 6)], fill=gd)
    base = base.resize((W_, H_), Image.LANCZOS)
    base.save(path)
    return path


# ---------------------------------------------------------------- cards in 3D

CARD_W, CARD_H = 0.5, 0.75  # default card size in units (50 x 75 px)


def card(rank, suit, x_px, y_px, w_px=50, h_px=None, style="real", z=0.0, face_up=True, rot=0.0, lift=0.0,
         stock_mat=None, name="card", back_style=None):
    """A card centred on screen px (x, y), w_px wide (aspect 1.47), thickness 0.6 px."""
    h_px = h_px or w_px * 1.47
    bs = "joulz" if (back_style or "").startswith("blue") else (back_style or style)
    key = f"{style}-{rank}{suit}" if face_up else f"back-{bs}"
    m = bpy.data.materials.get("face-" + key)
    if m is None:
        img = card_face(rank, suit, style) if face_up else card_back(bs)
        m = textured("face-" + key, img, rough=0.5, coat=0.12, coat_rough=0.25)
    if stock_mat is None:
        stock_mat = bpy.data.materials.get("card-edge") or mat("card-edge", (236, 230, 214), rough=0.5)
    o = faced_plate(name, u(w_px), u(h_px), u(0.8), u(w_px * 0.085), m, stock_mat,
                    loc=P(x_px, y_px, z + lift), edge=0, rot=(0, 0, math.radians(rot)), seg=6)
    return o


# ---------------------------------------------------------------- output

def render_to(out_png):
    s = bpy.context.scene
    s.render.filepath = out_png
    s.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)


def header_band(im, style="dark"):
    """The placeholder for the app's game header (60 px of 844): a flat band with grey stand-ins for the name,
    timer ring, best score and menu. Proportions only; the real header is the app's."""
    from PIL import ImageDraw
    w, h = im.size
    k = h / H
    band = int(HEADER * k)
    d = ImageDraw.Draw(im, "RGBA")
    d.rectangle([0, 0, w, band], fill=(6, 8, 15, 255))
    g = (70, 78, 98, 255)
    g2 = (46, 52, 70, 255)
    d.rounded_rectangle([16 * k, 15 * k, 120 * k, 29 * k], radius=6 * k, fill=g)
    d.rounded_rectangle([16 * k, 35 * k, 92 * k, 44 * k], radius=4 * k, fill=g2)
    cx, cy, r = w / 2, band / 2, 20 * k
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=g, width=max(2, int(4 * k)))
    d.rounded_rectangle([w - 110 * k, 18 * k, w - 64 * k, 40 * k], radius=6 * k, fill=g2)
    for i in range(3):
        d.ellipse([w - 26 * k - 2 * k, (22 + i * 7) * k - 2 * k, w - 26 * k + 2 * k, (22 + i * 7) * k + 2 * k], fill=g)
    return im


def hud_pills(im, pills, y=74, style="dark", gap=8, x0=12):
    """Small HUD chips drawn flat over the render (the app draws these in the interface, not the art):
    pills = [(label, value, highlight)] laid left to right from x0 at screen y."""
    from PIL import ImageDraw
    w, h = im.size
    k = h / H
    d = ImageDraw.Draw(im, "RGBA")
    fl = font(600, int(10 * k))
    fv = font(800, int(13 * k))
    x = x0 * k
    for item in pills:
        if item is None:
            continue
        label, value, hi = item
        lw = d.textlength(label.upper(), font=fl)
        vw = d.textlength(str(value), font=fv)
        pw = lw + vw + 26 * k
        if style == "light":
            fill, tl, tv = ((245, 241, 232, 225), (90, 84, 70, 255), (24, 22, 18, 255))
        else:
            fill, tl, tv = ((8, 11, 22, 200), (170, 176, 196, 255), (245, 245, 247, 255))
        if hi:
            fill, tl, tv = ((226, 192, 122, 240), (60, 44, 14, 255), (26, 18, 6, 255))
        d.rounded_rectangle([x, (y - 11) * k, x + pw, (y + 11) * k], radius=11 * k, fill=fill)
        d.text((x + 10 * k, y * k), label.upper(), font=fl, fill=tl, anchor="lm")
        d.text((x + 16 * k + lw, y * k), str(value), font=fv, fill=tv, anchor="lm")
        x += pw + gap * k
    return im


def finish(png, category, game, look, pills=None, pill_style="dark", right_pills=None, post=None):
    """Header band and HUD chips over the render, then the 720 px WebP and a 240 px thumbnail."""
    from PIL import Image
    im = Image.open(png).convert("RGB")
    if post:
        im = post(im)
    im = header_band(im)
    if pills:
        hud_pills(im, pills, style=pill_style)
    if right_pills:
        # right-aligned: measure then draw
        from PIL import ImageDraw
        k = im.size[1] / H
        d = ImageDraw.Draw(im)
        fl, fv = font(600, int(10 * k)), font(800, int(13 * k))
        tot = sum(d.textlength(l.upper(), font=fl) + d.textlength(str(v), font=fv) + 26 * k for l, v, _ in right_pills)
        tot += 8 * k * (len(right_pills) - 1)
        hud_pills(im, right_pills, style=pill_style, x0=(im.size[0] - tot) / k - 12)
    d = os.path.join(OUT, category)
    os.makedirs(os.path.join(d, "thumbs"), exist_ok=True)
    h = 720
    w = round(im.size[0] * h / im.size[1])
    big = im.resize((w, h), Image.LANCZOS)
    big.save(os.path.join(d, f"{game}-{look}.webp"), "WEBP", quality=80, method=6)
    th = im.resize((round(w * 240 / h), 240), Image.LANCZOS)
    th.save(os.path.join(d, "thumbs", f"{game}-{look}.webp"), "WEBP", quality=72, method=6)
    print("WROTE", os.path.join(d, f"{game}-{look}.webp"))


def run(category, game, looks, build):
    """build(look) sets up the scene and returns finish() kwargs. Looks from argv when given."""
    want = sys.argv[1:] or looks
    for look in want:
        kw = build(look) or {}
        png = os.path.join(TEX, f"{game}-{look}.png")
        render_to(png)
        finish(png, category, game, look, **kw)


def vignette(strength=0.45, power=2.2):
    """A post-render falloff to the edges (used sparingly on the 'Bolder' looks for drama)."""
    def _p(im):
        from PIL import Image
        import numpy as np
        a = np.asarray(im).astype("float32")
        h, w = a.shape[:2]
        yy, xx = np.mgrid[0:h, 0:w]
        dx = (xx - w / 2) / (w / 2)
        dy = (yy - h * 0.45) / (h / 2)
        r = np.sqrt(dx * dx * 0.8 + dy * dy)
        f = 1 - strength * np.clip(r, 0, 1.4) ** power / (1.4 ** power) * 1.6
        a = a * np.clip(f, 0.25, 1)[..., None]
        return Image.fromarray(np.clip(a, 0, 255).astype("uint8"))
    return _p


def labels(items, then=None):
    """Post step drawing small interface labels [(text, x, y, size, rgba, weight)] in screen px."""
    def _p(im):
        from PIL import ImageDraw
        if then:
            im = then(im)
        k = im.size[1] / H
        d = ImageDraw.Draw(im, "RGBA")
        for it in items:
            text, x, y, size, col, wt = (list(it) + [None, None, None])[:6]
            d.text((x * k, y * k), text, font=font(wt or 800, int((size or 11) * k)), fill=col or (200, 210, 235, 255),
                   anchor="mm")
        return im
    return _p


def button(im_items, x, y, w, h, text, gold_=False):
    """Returns a post step drawing an interface button (the app draws these; shown for proportion)."""
    pass
