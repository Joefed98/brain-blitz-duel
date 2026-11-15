"""Joulz key art kit for Blender (bpy 5.2 LTS, Cycles on the CPU).

Shared by every game scene in ./scenes: materials (plastic, glass, liquid, metal, wood, felt, ceramic, emission),
geometry helpers (rounded boxes, lathed bodies, tubes along points, text in Archivo), a studio light rig, a camera
with depth of field, and the render to a tile (square) and a hero (16:10) from two cameras on the same scene.
Art direction: docs/design/game-art/ART-DIRECTION.md. Not app code.
"""
import bpy, bmesh, math, os, random
from mathutils import Vector, Matrix, Euler

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../../..'))
FONT_CACHE = {}

def hexrgb(h, a=1.0):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*lin, a)

# ---------------------------------------------------------------- scene
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    random.seed(7)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.use_denoising = True
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.02
    sc.cycles.max_bounces = 8; sc.cycles.glossy_bounces = 4; sc.cycles.transmission_bounces = 10
    sc.cycles.diffuse_bounces = 3; sc.cycles.transparent_max_bounces = 8
    sc.cycles.caustics_reflective = False; sc.cycles.caustics_refractive = False
    sc.cycles.blur_glossy = 1.0
    sc.view_settings.view_transform = 'AgX'
    try: sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception: pass
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = 'PNG'
    w = bpy.data.worlds.new('World'); sc.world = w
    return sc

def world(col='#05070D', strength=1.0, top=None):
    """A dark studio: an even colour, optionally brighter above (a soft gradient for reflections)."""
    w = bpy.context.scene.world; w.use_nodes = True
    nt = w.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputWorld'); bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = strength
    if top:
        tc = nt.nodes.new('ShaderNodeTexCoord'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); ramp = nt.nodes.new('ShaderNodeValToRGB')
        nt.links.new(tc.outputs['Generated'], sep.inputs[0]); nt.links.new(sep.outputs['Z'], ramp.inputs[0])
        ramp.color_ramp.elements[0].position = 0.45; ramp.color_ramp.elements[0].color = hexrgb(col)
        ramp.color_ramp.elements[1].position = 0.9; ramp.color_ramp.elements[1].color = hexrgb(top)
        nt.links.new(ramp.outputs['Color'], bg.inputs['Color'])
    else:
        bg.inputs['Color'].default_value = hexrgb(col)
    nt.links.new(bg.outputs[0], out.inputs[0])

# ---------------------------------------------------------------- materials
def _mat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    return m, m.node_tree, m.node_tree.nodes['Principled BSDF']

def _set(b, **kw):
    names = {'base': 'Base Color', 'rough': 'Roughness', 'metal': 'Metallic', 'trans': 'Transmission Weight', 'ior': 'IOR',
             'coat': 'Coat Weight', 'coat_rough': 'Coat Roughness', 'emit': 'Emission Color', 'emit_s': 'Emission Strength',
             'sheen': 'Sheen Weight', 'sss': 'Subsurface Weight', 'spec': 'Specular IOR Level', 'alpha': 'Alpha'}
    for k, v in kw.items():
        b.inputs[names[k]].default_value = v

_MATS = {}
def plastic(col, rough=0.28, coat=0.6, key=None):
    """Glossy moulded plastic or lacquer, with a clear coat."""
    k = ('plastic', col, rough, coat)
    if k in _MATS: return _MATS[k]
    m, nt, b = _mat('plastic'); _set(b, base=hexrgb(col), rough=rough, coat=coat, coat_rough=0.08); _MATS[k] = m; return m

def ceramic(col, rough=0.18):
    return plastic(col, rough, 0.9)

def metal(col, rough=0.22):
    k = ('metal', col, rough)
    if k in _MATS: return _MATS[k]
    m, nt, b = _mat('metal'); _set(b, base=hexrgb(col), rough=rough, metal=1.0); _MATS[k] = m; return m

def gold(rough=0.2): return metal('#E8B04A', rough)
def chrome(rough=0.08): return metal('#D8DDE6', rough)
def brass(rough=0.3): return metal('#C9A15A', rough)

def glass(tint='#FFFFFF', rough=0.02, ior=1.45):
    k = ('glass', tint, rough, ior)
    if k in _MATS: return _MATS[k]
    m, nt, b = _mat('glass'); _set(b, base=hexrgb(tint), rough=rough, trans=1.0, ior=ior, spec=0.6); _MATS[k] = m; return m

def liquid(col, glow=0.35):
    """Coloured liquid: a little translucent, a little self-lit so it reads as saturated colour in glass."""
    k = ('liquid', col, glow)
    if k in _MATS: return _MATS[k]
    m, nt, b = _mat('liquid'); _set(b, base=hexrgb(col), rough=0.06, trans=0.25, ior=1.33, emit=hexrgb(col), emit_s=glow, coat=0.5, sss=0.0); _MATS[k] = m; return m

def emission(col, strength=4.0):
    k = ('emit', col, strength)
    if k in _MATS: return _MATS[k]
    m = bpy.data.materials.new('emit'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    o = nt.nodes.new('ShaderNodeOutputMaterial'); e = nt.nodes.new('ShaderNodeEmission')
    e.inputs['Color'].default_value = hexrgb(col); e.inputs['Strength'].default_value = strength
    nt.links.new(e.outputs[0], o.inputs[0]); _MATS[k] = m; return m

def _noise_bump(nt, b, scale=60.0, strength=0.15, detail=8.0):
    n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = detail
    bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = strength
    nt.links.new(n.outputs['Fac'], bump.inputs['Height']); nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    return n

def felt(col, rough=0.95):
    """Cloth: matte, a soft sheen, a fine fibre bump."""
    k = ('felt', col)
    if k in _MATS: return _MATS[k]
    m, nt, b = _mat('felt'); _set(b, base=hexrgb(col), rough=rough, sheen=0.6, spec=0.2); _noise_bump(nt, b, 400, 0.08)
    _MATS[k] = m; return m

def wood(col='#6B4226', dark='#3A2212', rough=0.35, scale=2.0, coat=0.5):
    """Varnished wood: wave rings disturbed by noise, a clear coat."""
    k = ('wood', col, dark, rough, scale)
    if k in _MATS: return _MATS[k]
    m, nt, b = _mat('wood'); _set(b, rough=rough, coat=coat, coat_rough=0.12)
    tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (scale * 0.12, scale, scale)
    wv = nt.nodes.new('ShaderNodeTexWave'); wv.inputs['Scale'].default_value = 1.6; wv.inputs['Distortion'].default_value = 9.0; wv.inputs['Detail'].default_value = 6; wv.inputs['Detail Scale'].default_value = 2.0
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color = hexrgb(dark); ramp.color_ramp.elements[1].color = hexrgb(col)
    ramp.color_ramp.elements[0].position = 0.25; ramp.color_ramp.elements[1].position = 0.95
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector']); nt.links.new(mp.outputs['Vector'], wv.inputs['Vector'])
    nt.links.new(wv.outputs['Fac'], ramp.inputs[0]); nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    _MATS[k] = m; return m

def rough_surface(col, rough=0.6, bump=0.25, scale=20.0, var='#000000', metal_v=0.0):
    """Stone, concrete, worn metal: a colour mottled by noise with a matching bump."""
    k = ('rough', col, rough, bump, scale, var, metal_v)
    if k in _MATS: return _MATS[k]
    m, nt, b = _mat('rough'); _set(b, rough=rough, metal=metal_v)
    n = _noise_bump(nt, b, scale, bump)
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color = hexrgb(var if var != '#000000' else col); ramp.color_ramp.elements[1].color = hexrgb(col)
    ramp.color_ramp.elements[0].position = 0.35; ramp.color_ramp.elements[1].position = 0.7
    nt.links.new(n.outputs['Fac'], ramp.inputs[0]); nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    _MATS[k] = m; return m

def image_mat(path, rough=0.35, coat=0.4, emit=0.0):
    """A picture printed on a surface (card faces, labels): the image's colours on a coated base."""
    m, nt, b = _mat('img'); _set(b, rough=rough, coat=coat)
    tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = bpy.data.images.load(path); tx.interpolation = 'Cubic'
    nt.links.new(tx.outputs['Color'], b.inputs['Base Color'])
    if emit:
        nt.links.new(tx.outputs['Color'], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = emit
    return m

# ---------------------------------------------------------------- objects
def _link(ob):
    bpy.context.scene.collection.objects.link(ob); return ob

def _finish(ob, mat, smooth=True, bevel=0.0, segs=4, loc=None, rot=None, scale=None):
    if mat is not None:
        ob.data.materials.clear(); ob.data.materials.append(mat)
    if smooth and hasattr(ob.data, 'polygons'):
        for p in ob.data.polygons: p.use_smooth = True
    if bevel:
        md = ob.modifiers.new('bevel', 'BEVEL'); md.width = bevel; md.segments = segs; md.limit_method = 'ANGLE'; md.harden_normals = False
    if loc is not None: ob.location = loc
    if rot is not None: ob.rotation_euler = [math.radians(a) for a in rot]
    if scale is not None: ob.scale = scale if isinstance(scale, (tuple, list)) else (scale,) * 3
    return ob

def _mesh_from_bm(bm, name):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); return _link(bpy.data.objects.new(name, me))

def box(size, mat, loc=(0, 0, 0), rot=None, bevel=0.04, segs=4):
    """size = full (x, y, z) in metres; Blender Z is up."""
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    ob = _mesh_from_bm(bm, 'box')
    return _finish(ob, mat, smooth=False, bevel=min(bevel, min(size) * 0.49), segs=segs, loc=loc, rot=rot)

def sphere(r, mat, loc=(0, 0, 0), scale=None, rot=None, segs=48):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=segs // 2, radius=r)
    return _finish(_mesh_from_bm(bm, 'sphere'), mat, loc=loc, scale=scale, rot=rot)

def lathe(profile, mat, loc=(0, 0, 0), rot=None, segs=64, close_top=True, close_bottom=True, bevel=0.0):
    """Spin a (radius, height) profile about Z; radius 0 at an end closes it."""
    bm = bmesh.new(); rings = []
    for (r, z) in profile:
        if r <= 1e-6: rings.append([bm.verts.new((0, 0, z))]); continue
        rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / segs), r * math.sin(2 * math.pi * i / segs), z)) for i in range(segs)])
    for a, b in zip(rings, rings[1:]):
        if len(a) == 1 and len(b) == 1: continue
        if len(a) == 1:
            for i in range(segs): bm.faces.new((a[0], b[i], b[(i + 1) % segs]))
        elif len(b) == 1:
            for i in range(segs): bm.faces.new((a[i], b[0], a[(i + 1) % segs]))
        else:
            for i in range(segs): bm.faces.new((a[i], a[(i + 1) % segs], b[(i + 1) % segs], b[i]))
    if close_bottom and len(rings[0]) > 1: bm.faces.new(list(reversed(rings[0])))
    if close_top and len(rings[-1]) > 1: bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _finish(_mesh_from_bm(bm, 'lathe'), mat, loc=loc, rot=rot, bevel=bevel)

def cyl(r, h, mat, loc=(0, 0, 0), rot=None, bevel=0.01, segs=64):
    """A cylinder standing on loc (base at loc z) with rounded edges."""
    k = min(bevel, r * 0.45, h * 0.45); p = []
    n = 6
    for i in range(n + 1):
        a = -math.pi / 2 + (math.pi / 2) * i / n; p.append((r - k + k * math.cos(a), k + k * math.sin(a)))
    for i in range(n + 1):
        a = (math.pi / 2) * i / n; p.append((r - k + k * math.cos(a), h - k + k * math.sin(a)))
    p = [(0, 0)] + p + [(0, h)]
    return lathe(p, mat, loc=loc, rot=rot, segs=segs, close_top=False, close_bottom=False)

def tube(points, r, mat, closed=False, res=12):
    """A round tube along points (a bevelled curve)."""
    cu = bpy.data.curves.new('tube', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = r; cu.bevel_resolution = res; cu.use_fill_caps = True
    sp = cu.splines.new('POLY' if len(points) < 3 else 'NURBS'); sp.points.add(len(points) - 1)
    for p, q in zip(sp.points, points): p.co = (*q, 1)
    if sp.type == 'NURBS': sp.use_endpoint_u = True; sp.order_u = min(4, len(points))
    sp.use_cyclic_u = closed
    ob = _link(bpy.data.objects.new('tube', cu)); ob.data.materials.append(mat); return ob

def font(weight=800):
    if weight in FONT_CACHE: return FONT_CACHE[weight]
    path = os.path.join(bpy.app.tempdir or '/tmp', f'archivo-{weight}.ttf')
    if not os.path.exists(path):
        from fontTools.ttLib import TTFont
        from fontTools.varLib import instancer
        f = instancer.instantiateVariableFont(TTFont(os.path.join(REPO, 'public/fonts/archivo-var-latin.woff2')), {'wght': weight, 'wdth': 100})
        f.flavor = None; f.save(path)
    FONT_CACHE[weight] = bpy.data.fonts.load(path); return FONT_CACHE[weight]

def text(s, mat, size=0.2, loc=(0, 0, 0), rot=(90, 0, 0), depth=0.01, bevel=0.003, align='CENTER', weight=800, fnt=None):
    cu = bpy.data.curves.new('txt', 'FONT'); cu.body = s; cu.font = fnt or font(weight); cu.size = size
    cu.extrude = depth; cu.bevel_depth = bevel; cu.bevel_resolution = 2; cu.align_x = align; cu.align_y = 'CENTER'
    ob = _link(bpy.data.objects.new('txt', cu)); ob.data.materials.append(mat)
    ob.location = loc; ob.rotation_euler = [math.radians(a) for a in rot]; return ob

def poly_prism(pts, h, mat, loc=(0, 0, 0), rot=None, bevel=0.005):
    """Extrude a 2D outline (x, y) up by h."""
    bm = bmesh.new(); bot = [bm.verts.new((x, y, 0)) for x, y in pts]; top = [bm.verts.new((x, y, h)) for x, y in pts]
    bm.faces.new(list(reversed(bot))); bm.faces.new(top)
    n = len(pts)
    for i in range(n): bm.faces.new((bot[i], bot[(i + 1) % n], top[(i + 1) % n], top[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _finish(_mesh_from_bm(bm, 'prism'), mat, smooth=False, bevel=bevel, segs=3, loc=loc, rot=rot)

def bolt_pts(s=1.0):
    """The Joulz bolt outline (the app's mark), in x/y, height 2 × s."""
    v = [(-.075, 1.), (.425, 1.), (.075, .2), (.425, .2), (-.325, -1.), (-.075, -.1), (-.425, -.1)]
    return [(x * s, y * s) for x, y in v]

def parent(children, parent_ob):
    for c in children: c.parent = parent_ob
    return parent_ob

def empty(loc=(0, 0, 0), rot=(0, 0, 0), scale=1.0):
    e = _link(bpy.data.objects.new('grp', None)); e.location = loc; e.rotation_euler = [math.radians(a) for a in rot]; e.scale = (scale,) * 3; return e

# ---------------------------------------------------------------- lights and camera
def area(loc, target, size, energy, col='#FFFFFF', shape='RECTANGLE', size_y=None):
    li = bpy.data.lights.new('area', 'AREA'); li.energy = energy; li.color = hexrgb(col)[:3]; li.shape = shape; li.size = size
    if size_y: li.size_y = size_y
    ob = _link(bpy.data.objects.new('area', li)); ob.location = loc; _aim(ob, target); return ob

def point(loc, energy, col='#FFFFFF', radius=0.05):
    li = bpy.data.lights.new('pt', 'POINT'); li.energy = energy; li.color = hexrgb(col)[:3]; li.shadow_soft_size = radius
    ob = _link(bpy.data.objects.new('pt', li)); ob.location = loc; return ob

def spot(loc, target, energy, angle=40, blend=0.6, col='#FFFFFF', radius=0.1):
    li = bpy.data.lights.new('spot', 'SPOT'); li.energy = energy; li.spot_size = math.radians(angle); li.spot_blend = blend; li.color = hexrgb(col)[:3]; li.shadow_soft_size = radius
    ob = _link(bpy.data.objects.new('spot', li)); ob.location = loc; _aim(ob, target); return ob

def _aim(ob, target):
    d = Vector(target) - Vector(ob.location); ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()

def studio(target=(0, 0, 0), key=600, rim_col='#9FC8FF', rim=300, fill=80, scale=1.0):
    """The rig every scene starts from: a large soft key from the upper left of the view, a rim from behind
    right (in the category's colour when given), a low fill from the front."""
    t = Vector(target); s = scale
    area(t + Vector((-2.6, -2.2, 3.2)) * s, t, 2.4 * s, key, '#FFF4E6')
    area(t + Vector((2.8, 2.6, 2.2)) * s, t, 1.6 * s, rim, rim_col)
    area(t + Vector((0.6, -3.5, 0.8)) * s, t, 3.0 * s, fill, '#DDE6FF')

def camera(name, loc, target, lens=50, fstop=2.8, focus=None, shift=(0, 0)):
    cd = bpy.data.cameras.new(name); cd.lens = lens; cd.sensor_width = 36
    cd.dof.use_dof = fstop is not None
    if fstop: cd.dof.aperture_fstop = fstop; cd.dof.aperture_blades = 7; cd.dof.focus_distance = (Vector(focus or target) - Vector(loc)).length
    cd.shift_x, cd.shift_y = shift
    ob = _link(bpy.data.objects.new(name, cd)); ob.location = loc; _aim(ob, target); return ob

def bokeh_lights(center, n=14, spread=(6, 2, 2.5), cols=('#FFC66B', '#FF6BD6', '#36E2F5'), r=(0.05, 0.12), strength=12, seed=3):
    """Small lights far behind the subject, thrown out of focus into soft discs: depth and atmosphere."""
    rnd = random.Random(seed); obs = []
    for i in range(n):
        p = Vector(center) + Vector(((rnd.random() - .5) * spread[0], (rnd.random()) * spread[1], (rnd.random() - .3) * spread[2]))
        obs.append(sphere(rnd.uniform(*r), emission(rnd.choice(cols), strength), loc=p, segs=16))
    return obs

# ---------------------------------------------------------------- render
def render(out_base, cams, samples=96):
    """cams: {'hero': cam_ob, 'tile': cam_ob}. Writes <out_base>-<kind>.png at the frame's render size."""
    sc = bpy.context.scene; sizes = {'hero': (1440, 900), 'tile': (640, 640)}
    sc.cycles.samples = samples
    for kind, cam in cams.items():
        sc.camera = cam; w, h = sizes[kind]; sc.render.resolution_x, sc.render.resolution_y = w, h; sc.render.resolution_percentage = 100
        sc.render.filepath = f'{out_base}-{kind}.png'; bpy.ops.render.render(write_still=True)
