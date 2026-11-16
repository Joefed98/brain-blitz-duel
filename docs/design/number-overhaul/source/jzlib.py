"""Shared Blender helpers for the game concept renders (phase 2 step 4, concept art only).

Coordinates are phone points: x right, y down, on a 390 x 844 screen; z up in points.
Run a game file with:  /opt/blender/venv/bin/python <category>.py <game-id> <look>
"""
import bpy, bmesh, math, os, sys
from mathutils import Vector

W, H = 390, 844
P = 0.01
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, ".."))
FONT_DIR = os.environ.get("JZ_FONTS", "/opt/blender/fonts")
SAMPLES = int(os.environ.get("JZ_SAMPLES", "96"))
RES_H = int(os.environ.get("JZ_RES_H", "720"))
STUDIO = None
for p in sys.path + [os.path.dirname(bpy.__file__)]:
    import glob
    g = glob.glob(os.path.join(p, "bpy", "*", "datafiles", "studiolights", "world")) + \
        glob.glob(os.path.join(p, "*", "datafiles", "studiolights", "world"))
    if g:
        STUDIO = g[0]; break

def V(x, y, z=0.0):
    return Vector(((x - W / 2) * P, (H / 2 - y) * P, z * P))

def hexc(h, a=1.0):
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(r), lin(g), lin(b), a)

# ----------------------------------------------------------------- scene
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.cycles.samples = SAMPLES
    s.cycles.use_denoising = True
    s.cycles.use_adaptive_sampling = True
    s.cycles.max_bounces = 10
    s.cycles.transmission_bounces = 10
    s.cycles.transparent_max_bounces = 10
    s.cycles.caustics_reflective = False
    s.cycles.caustics_refractive = False
    s.cycles.blur_glossy = 0.5
    s.render.resolution_y = RES_H
    s.render.resolution_x = round(RES_H * W / H)
    s.render.film_transparent = False
    s.view_settings.view_transform = "AgX"
    s.view_settings.look = "AgX - Punchy"
    s.view_settings.exposure = 0.0
    return s

def camera(tilt=7.0, lens=85, focus_y=None, fstop=None, shift_y=0.0):
    """Perspective camera that frames the 390 x 844 screen plane at z=0, tilted forward by `tilt` degrees."""
    s = bpy.context.scene
    cam = bpy.data.cameras.new("cam")
    cam.lens = lens
    cam.sensor_fit = "VERTICAL"
    cam.sensor_height = 24.0
    D = (H * P) * lens / 24.0
    t = math.radians(tilt)
    ob = bpy.data.objects.new("cam", cam)
    s.collection.objects.link(ob)
    ob.location = (0, -D * math.sin(t), D * math.cos(t))
    ob.rotation_euler = (t, 0, 0)
    cam.shift_y = shift_y
    cam.clip_end = 1000
    if fstop:
        cam.dof.use_dof = True
        cam.dof.focus_distance = D * (1.0 if focus_y is None else 1.0)
        cam.dof.aperture_fstop = fstop
    s.camera = ob
    return ob

def world(color="#05070c", strength=0.35, hdri="studio.exr", hdri_strength=0.25, rot=0.0):
    w = bpy.data.worlds.new("w"); bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree; n = nt.nodes; l = nt.links
    bg = n["Background"]
    if STUDIO and hdri:
        env = n.new("ShaderNodeTexEnvironment")
        env.image = bpy.data.images.load(os.path.join(STUDIO, hdri))
        mp = n.new("ShaderNodeMapping"); tc = n.new("ShaderNodeTexCoord")
        mp.inputs["Rotation"].default_value[2] = rot
        l.new(tc.outputs["Generated"], mp.inputs["Vector"]); l.new(mp.outputs[0], env.inputs[0])
        # camera rays see the flat colour, reflections see the studio
        lp = n.new("ShaderNodeLightPath")
        bg2 = n.new("ShaderNodeBackground"); bg2.inputs[0].default_value = hexc(color); bg2.inputs[1].default_value = strength
        l.new(env.outputs[0], bg.inputs[0]); bg.inputs[1].default_value = hdri_strength
        mix = n.new("ShaderNodeMixShader")
        l.new(lp.outputs["Is Camera Ray"], mix.inputs[0])
        l.new(bg.outputs[0], mix.inputs[1]); l.new(bg2.outputs[0], mix.inputs[2])
        l.new(mix.outputs[0], n["World Output"].inputs[0])
    else:
        bg.inputs[0].default_value = hexc(color); bg.inputs[1].default_value = strength

def area(x, y, z, size, energy, color="#ffffff", target=(195, 420, 0), sx=None, sy=None, spread=180):
    d = bpy.data.lights.new("a", "AREA")
    d.energy = energy; d.color = hexc(color)[:3]
    d.shape = "RECTANGLE"; d.size = (sx or size) * P; d.size_y = (sy or size) * P
    d.spread = math.radians(spread)
    ob = bpy.data.objects.new("a", d); bpy.context.scene.collection.objects.link(ob)
    ob.location = V(x, y, z)
    direction = V(*target) - ob.location
    ob.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return ob

def point(x, y, z, energy, color="#ffffff", radius=10):
    d = bpy.data.lights.new("p", "POINT"); d.energy = energy; d.color = hexc(color)[:3]; d.shadow_soft_size = radius * P
    ob = bpy.data.objects.new("p", d); bpy.context.scene.collection.objects.link(ob); ob.location = V(x, y, z)
    return ob

def studio_lights(key=1.0, warm="#fff1dc", cool="#cfe0ff", rim=0.6):
    """The art kit's rule: one key light from the top left, a soft fill, a gentle rim."""
    area(-260, -260, 900, 700, 5200 * key, warm, sx=900, sy=500)
    area(760, 520, 520, 600, 900 * key, cool)
    area(195, 1500, 260, 800, 700 * rim, "#ffffff", sx=1200, sy=200)

# ----------------------------------------------------------------- materials
_mats = {}
def _bsdf(m):
    return m.node_tree.nodes["Principled BSDF"]

def mat(name, color="#808080", rough=0.4, metal=0.0, coat=0.0, coat_rough=0.05, trans=0.0, ior=1.45,
        emit=None, emit_strength=0.0, alpha=1.0, sheen=0.0, spec=0.5, aniso=0.0, sss=0.0):
    key = name
    if key in _mats: return _mats[key]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = _bsdf(m)
    b.inputs["Base Color"].default_value = hexc(color) if isinstance(color, str) else color
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = coat_rough
    b.inputs["Transmission Weight"].default_value = trans
    b.inputs["IOR"].default_value = ior
    b.inputs["Specular IOR Level"].default_value = spec
    b.inputs["Anisotropic"].default_value = aniso
    b.inputs["Sheen Weight"].default_value = sheen
    b.inputs["Subsurface Weight"].default_value = sss
    if emit:
        b.inputs["Emission Color"].default_value = hexc(emit)
        b.inputs["Emission Strength"].default_value = emit_strength
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
    _mats[key] = m
    return m

def _nodes(m):
    return m.node_tree.nodes, m.node_tree.links

def add_bump(m, scale=40.0, strength=0.05, detail=6.0, kind="noise", stretch=(1, 1, 1), distance=0.02):
    n, l = _nodes(m); b = _bsdf(m)
    tc = n.new("ShaderNodeTexCoord"); mp = n.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = stretch
    l.new(tc.outputs["Object"], mp.inputs[0])
    if kind == "noise":
        t = n.new("ShaderNodeTexNoise"); t.inputs["Scale"].default_value = scale; t.inputs["Detail"].default_value = detail
    else:
        t = n.new("ShaderNodeTexVoronoi"); t.inputs["Scale"].default_value = scale
    l.new(mp.outputs[0], t.inputs[0])
    bp = n.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = strength; bp.inputs["Distance"].default_value = distance
    l.new(t.outputs[0] if kind == "noise" else t.outputs["Distance"], bp.inputs["Height"])
    l.new(bp.outputs[0], b.inputs["Normal"])
    return m

def wood(name, c1="#6b3f1f", c2="#3a1f0e", rough=0.35, coat=0.6, scale=3.0, stretch=(1, 8, 1), rot=0.0):
    """Straight-grained timber: long stretched noise for the grain, a finer noise for pores, under a clear coat."""
    if name in _mats: return _mats[name]
    m = mat(name, c1, rough, coat=coat, coat_rough=0.06)
    n, l = _nodes(m); b = _bsdf(m)
    tc = n.new("ShaderNodeTexCoord"); mp = n.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (scale * 3.0, scale * 0.12, scale * 3.0)
    mp.inputs["Rotation"].default_value[2] = rot
    l.new(tc.outputs["Object"], mp.inputs[0])
    g1 = n.new("ShaderNodeTexNoise"); g1.inputs["Scale"].default_value = 4.0; g1.inputs["Detail"].default_value = 12
    g1.inputs["Roughness"].default_value = 0.62; g1.inputs["Distortion"].default_value = 0.4
    l.new(mp.outputs[0], g1.inputs[0])
    wv = n.new("ShaderNodeTexWave"); wv.bands_direction = "X"; wv.inputs["Scale"].default_value = 6
    wv.inputs["Distortion"].default_value = 3.0; wv.inputs["Detail"].default_value = 4
    l.new(mp.outputs[0], wv.inputs[0])
    mx = n.new("ShaderNodeMix"); mx.data_type = "FLOAT"; mx.inputs["Factor"].default_value = 0.35
    l.new(g1.outputs["Fac"], mx.inputs[2]); l.new(wv.outputs["Fac"], mx.inputs[3])
    cr = n.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].color = hexc(c2); cr.color_ramp.elements[1].color = hexc(c1)
    cr.color_ramp.elements[0].position = 0.3; cr.color_ramp.elements[1].position = 0.72
    l.new(mx.outputs[0], cr.inputs[0]); l.new(cr.outputs[0], b.inputs["Base Color"])
    bp = n.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.05; bp.inputs["Distance"].default_value = 0.004
    l.new(mx.outputs[0], bp.inputs["Height"]); l.new(bp.outputs[0], b.inputs["Normal"])
    return m

def ink(name, color, rough=0.45, glow=0.0, metal=0.0):
    """A flat, readable colour for numerals and marks (a touch of self-light keeps it legible in shade)."""
    return mat(name, color, rough, metal=metal, emit=color if glow else None, emit_strength=glow)

def marble(name, c1="#ece8e1", c2="#8d8a86", rough=0.12, scale=1.6):
    if name in _mats: return _mats[name]
    m = mat(name, c1, rough, coat=0.3)
    n, l = _nodes(m); b = _bsdf(m)
    tc = n.new("ShaderNodeTexCoord")
    wv = n.new("ShaderNodeTexWave"); wv.inputs["Scale"].default_value = scale; wv.inputs["Distortion"].default_value = 14
    wv.inputs["Detail"].default_value = 8; wv.inputs["Detail Roughness"].default_value = 0.65; wv.bands_direction = "DIAGONAL"
    l.new(tc.outputs["Object"], wv.inputs[0])
    cr = n.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].color = hexc(c2); cr.color_ramp.elements[1].color = hexc(c1)
    cr.color_ramp.elements[0].position = 0.0; cr.color_ramp.elements[1].position = 0.18
    l.new(wv.outputs["Fac"], cr.inputs[0]); l.new(cr.outputs[0], b.inputs["Base Color"])
    return m

def felt(name, color="#0e4a33", scale=900.0):
    if name in _mats: return _mats[name]
    m = mat(name, color, 0.95, sheen=0.6)
    _bsdf(m).inputs["Sheen Tint"].default_value = (1, 1, 1, 1)
    add_bump(m, scale=scale, strength=0.25, detail=2, distance=0.003)
    return m

def brushed(name, color="#c9a35a", rough=0.28, aniso=0.6, stretch=(1, 60, 1)):
    if name in _mats: return _mats[name]
    m = mat(name, color, rough, metal=1.0, aniso=aniso)
    add_bump(m, scale=40, strength=0.04, detail=4, stretch=stretch, distance=0.004)
    return m

def glass(name, tint="#ffffff", rough=0.02, ior=1.47):
    return mat(name, tint, rough, trans=1.0, ior=ior, spec=0.5)

def liquid(name, color, dens=1.0):
    """Coloured liquid: clear surface plus volume absorption so the colour stays rich and readable."""
    if name in _mats: return _mats[name]
    m = mat(name, "#ffffff", 0.03, trans=1.0, ior=1.34)
    n, l = _nodes(m)
    va = n.new("ShaderNodeVolumeAbsorption")
    c = hexc(color)
    va.inputs["Color"].default_value = c; va.inputs["Density"].default_value = 18 * dens
    sc = n.new("ShaderNodeVolumeScatter"); sc.inputs["Color"].default_value = c; sc.inputs["Density"].default_value = 3 * dens
    ad = n.new("ShaderNodeAddShader"); l.new(va.outputs[0], ad.inputs[0]); l.new(sc.outputs[0], ad.inputs[1])
    l.new(ad.outputs[0], n["Material Output"].inputs["Volume"])
    return m

def emissive(name, color, strength=4.0):
    if name in _mats: return _mats[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    n, l = _nodes(m); b = _bsdf(m)
    b.inputs["Base Color"].default_value = hexc(color)
    b.inputs["Emission Color"].default_value = hexc(color); b.inputs["Emission Strength"].default_value = strength
    _mats[name] = m
    return m

def gradient_bg(name, top="#0b1220", bottom="#04060a", vignette=0.55, rough=0.9, noise=0.0):
    """A soft vertical gradient and vignette for the backdrop plane (the screen's background)."""
    if name in _mats: return _mats[name]
    m = mat(name, top, rough)
    n, l = _nodes(m); b = _bsdf(m)
    tc = n.new("ShaderNodeTexCoord"); sep = n.new("ShaderNodeSeparateXYZ")
    l.new(tc.outputs["Generated"], sep.inputs[0])
    cr = n.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].color = hexc(bottom); cr.color_ramp.elements[1].color = hexc(top)
    l.new(sep.outputs["Y"], cr.inputs[0])
    gr = n.new("ShaderNodeTexGradient"); gr.gradient_type = "SPHERICAL"
    mp = n.new("ShaderNodeMapping"); mp.inputs["Location"].default_value = (0.5, 0.5, 0)
    mp.inputs["Scale"].default_value = (1.6, 0.75, 1)
    sub = n.new("ShaderNodeVectorMath"); sub.operation = "SUBTRACT"; sub.inputs[1].default_value = (0.5, 0.5, 0)
    l.new(tc.outputs["Generated"], sub.inputs[0])
    mp2 = n.new("ShaderNodeMapping"); mp2.inputs["Scale"].default_value = (1.4, 0.7, 1)
    l.new(sub.outputs[0], mp2.inputs[0]); l.new(mp2.outputs[0], gr.inputs[0])
    mr = n.new("ShaderNodeMapRange"); mr.inputs["From Min"].default_value = 0; mr.inputs["From Max"].default_value = 1
    mr.inputs["To Min"].default_value = 1 - vignette; mr.inputs["To Max"].default_value = 1
    l.new(gr.outputs["Fac"], mr.inputs[0])
    mul = n.new("ShaderNodeMix"); mul.data_type = "RGBA"; mul.blend_type = "MULTIPLY"; mul.inputs["Factor"].default_value = 1
    l.new(cr.outputs[0], mul.inputs[6])
    l.new(mr.outputs[0], mul.inputs[7])
    l.new(mul.outputs[2], b.inputs["Base Color"])
    # self-lit so the screen colour stays true to today's whatever the key light does; a little diffuse keeps shadows
    l.new(mul.outputs[2], b.inputs["Emission Color"]); b.inputs["Emission Strength"].default_value = 1.0
    b.inputs["Base Color"].default_value = (0.02, 0.02, 0.02, 1)
    if b.inputs["Base Color"].links: l.remove(b.inputs["Base Color"].links[0])
    b.inputs["Base Color"].default_value = (0.012, 0.012, 0.012, 1)
    b.inputs["Specular IOR Level"].default_value = 0.0
    if noise:
        add_bump(m, scale=600, strength=noise, distance=0.002)
    _mats[name] = m
    return m

def textured(name, base_mat_fn, **kw):
    return base_mat_fn(name, **kw)

# ----------------------------------------------------------------- geometry
_meshes = {}
def _link(ob, coll=None):
    (coll or bpy.context.scene.collection).objects.link(ob)
    return ob

def _rbox_mesh(w, h, d, r):
    key = ("rbox", round(w, 2), round(h, 2), round(d, 2), round(r, 2))
    if key in _meshes: return _meshes[key]
    me = bpy.data.meshes.new("rbox")
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= w * P; v.co.y *= h * P; v.co.z = (v.co.z + 0.5) * d * P
    if r > 0:
        rr = min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01) * P
        bmesh.ops.bevel(bm, geom=bm.verts[:] + bm.edges[:], offset=rr, segments=5, profile=0.5, affect="EDGES", clamp_overlap=True)
    bm.to_mesh(me); bm.free()
    for poly in me.polygons: poly.use_smooth = True
    _meshes[key] = me
    return me

def box(x, y, w, h, d, m, r=2.0, z=0.0, name="box", rot=0.0):
    """A bevelled box whose top-left corner is (x, y) in points, d deep, sitting on z."""
    ob = bpy.data.objects.new(name, _rbox_mesh(w, h, d, r))
    ob.location = V(x + w / 2, y + h / 2, z)
    ob.rotation_euler[2] = rot
    _set_mat(ob, m)
    return _link(ob)

def cbox(cx, cy, w, h, d, m, r=2.0, z=0.0, rot=0.0):
    return box(cx - w / 2, cy - h / 2, w, h, d, m, r, z, rot=rot)

def _set_mat(ob, m):
    if not ob.data.materials:
        ob.data.materials.append(m)
    elif ob.data.materials[0] != m:
        ob.material_slots[0].link = "OBJECT"; ob.material_slots[0].material = m

def cyl(cx, cy, r, d, m, z=0.0, bevel=1.0, verts=64, name="cyl"):
    key = ("cyl", round(r, 2), round(d, 2), round(bevel, 2), verts)
    me = _meshes.get(key)
    if not me:
        me = bpy.data.meshes.new("cyl"); bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts, radius1=r * P, radius2=r * P, depth=d * P)
        for v in bm.verts: v.co.z += d * P / 2
        if bevel > 0:
            edges = [e for e in bm.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-6]
            bmesh.ops.bevel(bm, geom=edges, offset=min(bevel, d / 2 - 0.01, r - 0.01) * P, segments=4, affect="EDGES", clamp_overlap=True)
        bm.to_mesh(me); bm.free()
        for p in me.polygons: p.use_smooth = True
        _meshes[key] = me
    ob = bpy.data.objects.new(name, me); ob.location = V(cx, cy, z); _set_mat(ob, m)
    return _link(ob)

def sphere(cx, cy, r, m, z=None, name="sph"):
    key = ("sph", round(r, 2))
    me = _meshes.get(key)
    if not me:
        me = bpy.data.meshes.new("sph"); bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=r * P)
        bm.to_mesh(me); bm.free()
        for p in me.polygons: p.use_smooth = True
        _meshes[key] = me
    ob = bpy.data.objects.new(name, me); ob.location = V(cx, cy, r if z is None else z); _set_mat(ob, m)
    return _link(ob)

def torus(cx, cy, R, r, m, z=0.0):
    bpy.ops.mesh.primitive_torus_add(major_radius=R * P, minor_radius=r * P, major_segments=64, minor_segments=16,
                                     location=V(cx, cy, z))
    ob = bpy.context.object; bpy.ops.object.shade_smooth(); _set_mat(ob, m)
    return ob

def plane(x, y, w, h, m, z=0.0):
    me = bpy.data.meshes.new("pl"); bm = bmesh.new()
    vs = [bm.verts.new((sx * w * P / 2, sy * h * P / 2, 0)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    bm.faces.new(vs); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new("pl", me); ob.location = V(x + w / 2, y + h / 2, z)
    _set_mat(ob, m)
    return _link(ob)

def backdrop(m, z=-2.0):
    return plane(-400, -400, W + 800, H + 800, m, z)

def tube(points, radius, m, z=0.0, closed=False, res=12, round_caps=True):
    """A rounded tube through points [(x, y) or (x, y, z)] in points."""
    cu = bpy.data.curves.new("tube", "CURVE"); cu.dimensions = "3D"
    cu.bevel_depth = radius * P; cu.bevel_resolution = 6; cu.use_fill_caps = True
    sp = cu.splines.new("POLY"); sp.points.add(len(points) - 1)
    for i, p in enumerate(points):
        zz = p[2] if len(p) > 2 else z
        v = V(p[0], p[1], zz); sp.points[i].co = (v.x, v.y, v.z, 1)
    sp.use_cyclic_u = closed
    ob = bpy.data.objects.new("tube", cu); _link(ob); cu.materials.append(m)
    if round_caps and not closed:
        for p in (points[0], points[-1]):
            sphere(p[0], p[1], radius, m, z=(p[2] if len(p) > 2 else z))
    return ob

def smooth_tube(points, radius, m, z=0.0, closed=False):
    cu = bpy.data.curves.new("st", "CURVE"); cu.dimensions = "3D"
    cu.bevel_depth = radius * P; cu.bevel_resolution = 6; cu.use_fill_caps = True
    sp = cu.splines.new("BEZIER"); sp.bezier_points.add(len(points) - 1)
    for i, p in enumerate(points):
        bp = sp.bezier_points[i]; bp.co = V(p[0], p[1], p[2] if len(p) > 2 else z)
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    sp.use_cyclic_u = closed
    ob = bpy.data.objects.new("st", cu); _link(ob); cu.materials.append(m)
    return ob

_fonts = {}
def font(nm):
    paths = {"sans": os.path.join(FONT_DIR, "archivo-800.ttf"), "sans6": os.path.join(FONT_DIR, "archivo-600.ttf"),
             "serif": "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
             "serifr": "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf",
             "mono": "/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Bold.ttf",
             "sym": "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"}
    if nm not in _fonts:
        _fonts[nm] = bpy.data.fonts.load(paths[nm])
    return _fonts[nm]

def text(cx, cy, s, size, m, z=0.0, depth=0.3, fnt="sans", align="CENTER", bevel=0.0, rot=0.0, rx=0.0):
    cu = bpy.data.curves.new("t", "FONT"); cu.body = str(s); cu.font = font(fnt)
    cu.size = size * P; cu.extrude = depth * P / 2; cu.bevel_depth = bevel * P; cu.bevel_resolution = 2
    cu.align_x = align; cu.align_y = "CENTER"
    ob = bpy.data.objects.new("t", cu); _link(ob); cu.materials.append(m)
    ob.location = V(cx, cy, z + depth / 2); ob.rotation_euler[2] = rot; ob.rotation_euler[0] = rx
    return ob

def disc_ring(cx, cy, r, w, d, m, z=0.0):
    """A flat ring (washer)."""
    me = bpy.data.meshes.new("ring"); bm = bmesh.new()
    segs = 72
    outer = [bm.verts.new((math.cos(a) * r * P, math.sin(a) * r * P, 0)) for a in [i * 2 * math.pi / segs for i in range(segs)]]
    inner = [bm.verts.new((math.cos(a) * (r - w) * P, math.sin(a) * (r - w) * P, 0)) for a in [i * 2 * math.pi / segs for i in range(segs)]]
    for i in range(segs):
        j = (i + 1) % segs; bm.faces.new((outer[i], outer[j], inner[j], inner[i]))
    ext = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:])
    for v in [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]: v.co.z += d * P
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new("ring", me); ob.location = V(cx, cy, z); _set_mat(ob, m)
    return _link(ob)

def bevel_mod(ob, w=1.0, seg=3):
    md = ob.modifiers.new("bv", "BEVEL"); md.width = w * P; md.segments = seg; md.limit_method = "ANGLE"
    return ob

# ----------------------------------------------------------------- render
def render(cat, game, look, extra_settings=None):
    s = bpy.context.scene
    os.makedirs(os.path.join(OUT, cat), exist_ok=True)
    png = os.path.join("/tmp", f"jz-{cat}-{game}-{look}.png")
    s.render.filepath = png
    s.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True)
    finish(png, os.path.join(OUT, cat, f"{game}-{look}.webp"))

def finish(png, webp):
    """Lays the header placeholder band over the top and writes the WebP and its thumbnail."""
    from PIL import Image, ImageDraw
    im = Image.open(png).convert("RGB")
    w, h = im.size; k = h / H
    ov = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    band = int(64 * k)
    d.rectangle([0, 0, w, band], fill=(6, 8, 15, 236))
    d.line([0, band, w, band], fill=(255, 255, 255, 22), width=1)
    g = (255, 255, 255, 40)
    d.rounded_rectangle([int(14 * k), int(18 * k), int(120 * k), int(30 * k)], radius=int(4 * k), fill=(255, 255, 255, 70))
    d.rounded_rectangle([int(14 * k), int(36 * k), int(84 * k), int(44 * k)], radius=int(3 * k), fill=g)
    cx, cy, r = w / 2, int(32 * k), int(20 * k)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(226, 192, 122, 140), width=max(2, int(3 * k)))
    d.rounded_rectangle([int(290 * k), int(20 * k), int(334 * k), int(42 * k)], radius=int(4 * k), fill=g)
    d.ellipse([int(352 * k), int(22 * k), int(372 * k), int(42 * k)], fill=g)
    im = Image.alpha_composite(im.convert("RGBA"), ov).convert("RGB")
    im.save(webp, "WEBP", quality=84, method=6)
    th = im.resize((int(w * 240 / h), 240), Image.LANCZOS)
    th.save(webp.replace(".webp", ".thumb.webp"), "WEBP", quality=78, method=6)
    print("wrote", webp)

def run(cat, games):
    """Command line: <game> <look> [<game> <look> ...] or 'all'."""
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    jobs = []
    if not args or args == ["all"]:
        for g, fn in games.items():
            for lk in getattr(fn, "looks", ("A", "B")):
                jobs.append((g, lk))
    else:
        for a in args:
            g, _, lk = a.partition(":")
            for l in (lk.split(",") if lk else getattr(games[g], "looks", ("A", "B"))):
                jobs.append((g, l))
    for g, lk in jobs:
        _mats.clear(); _meshes.clear(); _fonts.clear()
        reset()
        games[g](lk)
        render(cat, g, lk)


def ycyl(cx, ytop, length, r, m, z=None, bevel=1.0, verts=64):
    """A cylinder lying along the screen's vertical, from ytop downwards, resting at depth z (default: on the wall)."""
    ob = cyl(cx, ytop, r, length, m, z=0, bevel=bevel, verts=verts)
    ob.rotation_euler[0] = math.pi / 2
    ob.location = V(cx, ytop, r if z is None else z)
    return ob

def xcyl(xleft, cy, length, r, m, z=None, bevel=1.0, verts=64):
    """A cylinder lying along the screen's horizontal, from xleft rightwards."""
    ob = cyl(xleft, cy, r, length, m, z=0, bevel=bevel, verts=verts)
    ob.rotation_euler[1] = math.pi / 2
    ob.location = V(xleft, cy, r if z is None else z)
    return ob

def prism(cx, cy, w, l, h, m, z=0.0, rot=0.0):
    """A triangular prism (a tent): base w wide, l long (screen vertical), ridge h high."""
    me = bpy.data.meshes.new("prism"); bm = bmesh.new()
    a = [bm.verts.new((-w / 2 * P, y * P, 0)) for y in (-l / 2, l / 2)]
    b = [bm.verts.new((w / 2 * P, y * P, 0)) for y in (-l / 2, l / 2)]
    c = [bm.verts.new((0, y * P, h * P)) for y in (-l / 2, l / 2)]
    bm.faces.new((a[0], b[0], c[0])); bm.faces.new((a[1], c[1], b[1]))
    bm.faces.new((a[0], c[0], c[1], a[1])); bm.faces.new((b[0], b[1], c[1], c[0])); bm.faces.new((a[0], a[1], b[1], b[0]))
    bmesh.ops.bevel(bm, geom=bm.edges[:], offset=0.6 * P, segments=2, affect="EDGES", clamp_overlap=True)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new("prism", me); ob.location = V(cx, cy, z); ob.rotation_euler[2] = rot; _set_mat(ob, m)
    return _link(ob)

def cone(cx, cy, r1, r2, h, m, z=0.0, verts=48):
    me = bpy.data.meshes.new("cone"); bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts, radius1=r1 * P, radius2=r2 * P, depth=h * P)
    for v in bm.verts: v.co.z += h * P / 2
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new("cone", me); ob.location = V(cx, cy, z); _set_mat(ob, m)
    return _link(ob)

def ellipsoid(cx, cy, rx, ry, rz, m, z=None):
    ob = sphere(cx, cy, 1.0, m, z=(rz if z is None else z))
    ob.data = ob.data.copy(); ob.scale = (rx, ry, rz)
    return ob

def thin_glass(name, tint="#ffffff", rough=0.03, strength=1.0):
    """Thin-walled glass: clear transmission plus Fresnel reflections, so what is inside stays readable."""
    if name in _mats: return _mats[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    n, l = _nodes(m); n.remove(n["Principled BSDF"])
    tr = n.new("ShaderNodeBsdfTransparent"); tr.inputs[0].default_value = hexc(tint)
    gl = n.new("ShaderNodeBsdfGlossy"); gl.inputs["Roughness"].default_value = rough
    lw = n.new("ShaderNodeLayerWeight"); lw.inputs["Blend"].default_value = 0.22
    mp = n.new("ShaderNodeMath"); mp.operation = "MULTIPLY"; mp.inputs[1].default_value = strength
    l.new(lw.outputs["Fresnel"], mp.inputs[0])
    mx = n.new("ShaderNodeMixShader"); l.new(mp.outputs[0], mx.inputs[0]); l.new(tr.outputs[0], mx.inputs[1]); l.new(gl.outputs[0], mx.inputs[2])
    l.new(mx.outputs[0], n["Material Output"].inputs["Surface"])
    _mats[name] = m
    return m

def potion(name, color, glow=0.35):
    """A rich, readable liquid colour."""
    return mat(name, color, 0.06, coat=1.0, coat_rough=0.02, trans=0.35, ior=1.33, sss=0.0, emit=color, emit_strength=glow)

def spot(x, y, z, energy, color="#ffffff", target=(195, 420, 0), angle=55, blend=0.6, radius=40):
    d = bpy.data.lights.new("s", "SPOT"); d.energy = energy; d.color = hexc(color)[:3]
    d.spot_size = math.radians(angle); d.spot_blend = blend; d.shadow_soft_size = radius * P
    ob = bpy.data.objects.new("s", d); bpy.context.scene.collection.objects.link(ob); ob.location = V(x, y, z)
    ob.rotation_euler = (V(*target) - ob.location).to_track_quat("-Z", "Y").to_euler()
    return ob

def slab(points, depth, m, z=0.0, bevel=0.6):
    """A flat shape (screen points) extruded upwards: inlays, icons in relief."""
    me = bpy.data.meshes.new("slab"); bm = bmesh.new()
    vs = [bm.verts.new(((px - W / 2) * P, (H / 2 - py) * P, 0)) for px, py in points]
    f = bm.faces.new(vs)
    if f.normal.z < 0: f.normal_flip()
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]: v.co.z += depth * P
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    if bevel:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel * P, segments=2, affect="EDGES", clamp_overlap=True)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new("slab", me); ob.location = (0, 0, z * P); _set_mat(ob, m)
    return _link(ob)
