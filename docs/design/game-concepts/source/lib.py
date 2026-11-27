"""Shared Blender helpers for the game concept renders (phase 2, step 4).

Concept pictures only; nothing here is used by the app. Run with a Python that has `bpy` (pip's bpy 5.3 wheel):

    python docs/design/game-concepts/source/render.py <category> <game-id> <look>

World units: 1 unit = 100 phone px. The phone screen (390 x 844) is x in [-1.95, 1.95], y in [-4.22, 4.22] on the
z = 0 plane; `P(x, y)` turns phone px (origin top left) into world coordinates. The camera looks down -Z with a long
lens, so the z = 0 plane fills the frame exactly and anything raised gets a touch of depth.
"""
import math, random
import bpy, bmesh
from mathutils import Vector, Matrix

W, H = 390, 844
HEADER_PX = 60          # placeholder band for the game frame's header (drawn in post)
D_CAM = 26.0
LENS = 24.0 * D_CAM / 8.44   # visible height at z = 0 is exactly 8.44


def P(x, y, z=0.0):
    return Vector((x / 100.0 - 1.95, 4.22 - y / 100.0, z))


def depth_scale(z):
    """How much larger something at height z (negative = further away) must be to fill the same screen share."""
    return (D_CAM - z) / D_CAM


# ---------------------------------------------------------------- scene

def reset(samples=64, world=(0.0, 0.0, 0.0), world_strength=1.0):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = 'CYCLES'
    s.cycles.device = 'CPU'
    s.cycles.samples = samples
    s.cycles.use_denoising = True
    s.cycles.denoiser = 'OPENIMAGEDENOISE'
    s.cycles.max_bounces = 8
    s.cycles.glossy_bounces = 4
    s.cycles.transmission_bounces = 8
    s.cycles.blur_glossy = 0.5
    s.cycles.sample_clamp_indirect = 8.0
    s.render.resolution_x = W
    s.render.resolution_y = H
    s.render.resolution_percentage = 125
    s.render.film_transparent = False
    s.view_settings.view_transform = 'AgX'
    try:
        s.view_settings.look = 'AgX - Medium High Contrast'
    except Exception:
        pass
    s.render.image_settings.file_format = 'PNG'
    wd = bpy.data.worlds.new('World')
    s.world = wd
    wd.use_nodes = True
    bg = wd.node_tree.nodes['Background']
    bg.inputs[0].default_value = (*world, 1)
    bg.inputs[1].default_value = world_strength
    cam_data = bpy.data.cameras.new('Cam')
    cam_data.lens = LENS
    cam_data.sensor_fit = 'VERTICAL'
    cam_data.sensor_height = 24.0
    cam_data.clip_end = 400
    cam = bpy.data.objects.new('Cam', cam_data)
    s.collection.objects.link(cam)
    cam.location = (0, 0, D_CAM)
    s.camera = cam
    return s


def world_gradient(top, bottom, strength=1.0, axis='Y'):
    """A vertical gradient sky seen in reflections (top colour above, bottom colour below)."""
    wd = bpy.context.scene.world
    nt = wd.node_tree
    bg = nt.nodes['Background']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['From Min'].default_value = -1
    mr.inputs['From Max'].default_value = 1
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*bottom, 1)
    ramp.color_ramp.elements[1].color = (*top, 1)
    nt.links.new(tc.outputs['Normal'], sep.inputs[0])
    nt.links.new(sep.outputs[axis], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], ramp.inputs[0])
    nt.links.new(ramp.outputs['Color'], bg.inputs[0])
    bg.inputs[1].default_value = strength


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


# ---------------------------------------------------------------- materials

_mats = {}


def mat(name, base=(0.5, 0.5, 0.5), metal=0.0, rough=0.5, emit=None, estr=0.0, transm=0.0, ior=1.45,
        coat=0.0, coat_rough=0.05, alpha=1.0, spec=0.5, aniso=0.0, bump=None, color_noise=None, sss=0.0):
    """Principled BSDF. bump=(scale, strength, detail) adds procedural relief; color_noise=(scale, colour2, mix)."""
    key = name
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*base, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    b.inputs['IOR'].default_value = ior
    b.inputs['Transmission Weight'].default_value = transm
    b.inputs['Coat Weight'].default_value = coat
    b.inputs['Coat Roughness'].default_value = coat_rough
    b.inputs['Alpha'].default_value = alpha
    b.inputs['Specular IOR Level'].default_value = spec
    b.inputs['Anisotropic'].default_value = aniso
    if sss:
        b.inputs['Subsurface Weight'].default_value = sss
    if emit is not None:
        b.inputs['Emission Color'].default_value = (*emit, 1)
        b.inputs['Emission Strength'].default_value = estr
    if bump or color_noise:
        tc = nt.nodes.new('ShaderNodeTexCoord')
    if bump:
        sc, st, det = bump
        n = nt.nodes.new('ShaderNodeTexNoise')
        n.inputs['Scale'].default_value = sc
        n.inputs['Detail'].default_value = det
        n.inputs['Roughness'].default_value = 0.6
        bm = nt.nodes.new('ShaderNodeBump')
        bm.inputs['Strength'].default_value = st
        bm.inputs['Distance'].default_value = 0.02
        nt.links.new(tc.outputs['Object'], n.inputs['Vector'])
        nt.links.new(n.outputs['Fac'], bm.inputs['Height'])
        nt.links.new(bm.outputs['Normal'], b.inputs['Normal'])
    if color_noise:
        sc, c2, mixv = color_noise
        n2 = nt.nodes.new('ShaderNodeTexNoise')
        n2.inputs['Scale'].default_value = sc
        n2.inputs['Detail'].default_value = 6
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].position = 0.35
        ramp.color_ramp.elements[1].position = 0.7
        ramp.color_ramp.elements[0].color = (*base, 1)
        mixed = tuple(base[i] * (1 - mixv) + c2[i] * mixv for i in range(3))
        ramp.color_ramp.elements[1].color = (*mixed, 1)
        nt.links.new(tc.outputs['Object'], n2.inputs['Vector'])
        nt.links.new(n2.outputs['Fac'], ramp.inputs[0])
        nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    _mats[key] = m
    return m


def emission(name, color, strength=5.0):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    e = nt.nodes.new('ShaderNodeEmission')
    e.inputs[0].default_value = (*color, 1)
    e.inputs[1].default_value = strength
    nt.links.new(e.outputs[0], out.inputs[0])
    _mats[name] = m
    return m


def wood(name, base=(0.32, 0.16, 0.07), dark=(0.12, 0.05, 0.02), scale=6.0, rough=0.35, coat=0.6):
    """Polished wood: a stretched wave-texture grain under a clear coat."""
    if name in _mats:
        return _mats[name]
    m = mat(name + '_base', base, rough=rough, coat=coat)
    m.name = name
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1, 8, 1)
    w = nt.nodes.new('ShaderNodeTexWave')
    w.wave_type = 'RINGS'
    w.inputs['Scale'].default_value = scale
    w.inputs['Distortion'].default_value = 6
    w.inputs['Detail'].default_value = 4
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*dark, 1)
    ramp.color_ramp.elements[1].color = (*base, 1)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], w.inputs['Vector'])
    nt.links.new(w.outputs['Fac'], ramp.inputs[0])
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    _mats[name] = m
    return m


def brushed(name, base=(0.8, 0.8, 0.82), rough=0.28):
    return mat(name, base, metal=1.0, rough=rough, aniso=0.6, bump=(200.0, 0.05, 2))


# ---------------------------------------------------------------- geometry

def _finish(obj, m, bevel=0.0, segs=3, smooth=False):
    if m is not None:
        obj.data.materials.append(m)
    if bevel > 0:
        md = obj.modifiers.new('bev', 'BEVEL')
        md.width = bevel
        md.segments = segs
        md.limit_method = 'ANGLE'
        md.harden_normals = False
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def mesh_obj(name, verts, faces):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.update()
    return link(bpy.data.objects.new(name, me))


def box(name, loc, size, m, bevel=0.01, rot=(0, 0, 0), segs=3):
    sx, sy, sz = (s / 2 for s in size)
    v = [(-sx, -sy, -sz), (sx, -sy, -sz), (sx, sy, -sz), (-sx, sy, -sz),
         (-sx, -sy, sz), (sx, -sy, sz), (sx, sy, sz), (-sx, sy, sz)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    o = mesh_obj(name, v, f)
    o.location = loc
    o.rotation_euler = rot
    return _finish(o, m, min(bevel, min(size) * 0.45), segs)


def cyl(name, loc, r, depth, m, verts=48, rot=(0, 0, 0), bevel=0.0, r2=None):
    """Cylinder (or cone/frustum with r2) along local Z."""
    r2 = r if r2 is None else r2
    v, f = [], []
    for i in range(verts):
        a = 2 * math.pi * i / verts
        v.append((r * math.cos(a), r * math.sin(a), -depth / 2))
    for i in range(verts):
        a = 2 * math.pi * i / verts
        v.append((r2 * math.cos(a), r2 * math.sin(a), depth / 2))
    for i in range(verts):
        j = (i + 1) % verts
        f.append((i, j, verts + j, verts + i))
    f.append(tuple(reversed(range(verts))))
    f.append(tuple(range(verts, 2 * verts)))
    o = mesh_obj(name, v, f)
    o.location = loc
    o.rotation_euler = rot
    _finish(o, m, bevel, 2)
    for p in o.data.polygons[:verts]:
        p.use_smooth = True
    return o


def sphere(name, loc, r, m, seg=48, ring=24, scale=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=ring, radius=r)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = link(bpy.data.objects.new(name, me))
    o.location = loc
    o.scale = scale
    return _finish(o, m, smooth=True)


def torus(name, loc, R, r, m, rot=(0, 0, 0), maj=96, minr=16):
    v, f = [], []
    for i in range(maj):
        a = 2 * math.pi * i / maj
        for j in range(minr):
            b = 2 * math.pi * j / minr
            v.append(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b)))
    for i in range(maj):
        for j in range(minr):
            i2, j2 = (i + 1) % maj, (j + 1) % minr
            f.append((i * minr + j, i2 * minr + j, i2 * minr + j2, i * minr + j2))
    o = mesh_obj(name, v, f)
    o.location = loc
    o.rotation_euler = rot
    return _finish(o, m, smooth=True)


def prism(name, pts, z0, z1, m, bevel=0.0, segs=2):
    """Extrude a 2-D polygon (world x, y, counter-clockwise or not) between z0 and z1."""
    n = len(pts)
    v = [(x, y, z0) for x, y in pts] + [(x, y, z1) for x, y in pts]
    f = [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
    for i in range(n):
        j = (i + 1) % n
        f.append((i, j, n + j, n + i))
    o = mesh_obj(name, v, f)
    me = o.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    return _finish(o, m, bevel, segs)


def tube(name, pts, r, m, res=12, closed=False):
    """A round tube through world points (vines, wires, rails, rope)."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = r
    cu.bevel_resolution = 4
    cu.use_fill_caps = True
    sp = cu.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (p[0], p[1], p[2] if len(p) > 2 else 0, 1)
    sp.use_cyclic_u = closed
    o = link(bpy.data.objects.new(name, cu))
    if m:
        o.data.materials.append(m)
    return o


def smooth_curve(name, pts, r, m, closed=False, taper=None):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = r
    cu.bevel_resolution = 4
    cu.use_fill_caps = True
    sp = cu.splines.new('NURBS')
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (p[0], p[1], p[2] if len(p) > 2 else 0, 1)
        if taper:
            sp.points[i].radius = taper[i]
    sp.use_endpoint_u = True
    sp.order_u = 4 if len(pts) >= 4 else len(pts)
    sp.use_cyclic_u = closed
    o = link(bpy.data.objects.new(name, cu))
    if m:
        o.data.materials.append(m)
    return o


def plane(name, loc, sx, sy, m, rot=(0, 0, 0)):
    o = mesh_obj(name, [(-sx / 2, -sy / 2, 0), (sx / 2, -sy / 2, 0), (sx / 2, sy / 2, 0), (-sx / 2, sy / 2, 0)],
                 [(0, 1, 2, 3)])
    o.location = loc
    o.rotation_euler = rot
    if m:
        o.data.materials.append(m)
    return o


def ring_flat(name, loc, r_in, r_out, m, segs=96, z=0.0):
    v, f = [], []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        v += [(r_in * math.cos(a), r_in * math.sin(a), 0), (r_out * math.cos(a), r_out * math.sin(a), 0)]
    for i in range(segs):
        j = (i + 1) % segs
        f.append((2 * i, 2 * j, 2 * j + 1, 2 * i + 1))
    o = mesh_obj(name, v, f)
    o.location = loc
    if m:
        o.data.materials.append(m)
    return o


def dashed_ring(name, loc, r, w, m, dashes=48, fill=0.55):
    v, f = [], []
    for d in range(dashes):
        a0 = 2 * math.pi * d / dashes
        a1 = a0 + 2 * math.pi / dashes * fill
        for k in range(5):
            a = a0 + (a1 - a0) * k / 4
            v += [((r - w) * math.cos(a), (r - w) * math.sin(a), 0), ((r + w) * math.cos(a), (r + w) * math.sin(a), 0)]
        base = d * 10
        for k in range(4):
            f.append((base + 2 * k, base + 2 * k + 2, base + 2 * k + 3, base + 2 * k + 1))
    o = mesh_obj(name, v, f)
    o.location = loc
    if m:
        o.data.materials.append(m)
    return o


# ---------------------------------------------------------------- lights

def area(name, loc, energy, size=2.0, color=(1, 1, 1), target=(0, 0, 0), shape='RECTANGLE', sy=None):
    d = bpy.data.lights.new(name, 'AREA')
    d.energy = energy
    d.color = color
    d.shape = shape
    d.size = size
    if sy is not None:
        d.size_y = sy
    o = link(bpy.data.objects.new(name, d))
    o.location = loc
    look_at(o, target)
    return o


def point(name, loc, energy, color=(1, 1, 1), radius=0.1):
    d = bpy.data.lights.new(name, 'POINT')
    d.energy = energy
    d.color = color
    d.shadow_soft_size = radius
    o = link(bpy.data.objects.new(name, d))
    o.location = loc
    return o


def spot(name, loc, energy, target, angle=0.6, blend=0.5, color=(1, 1, 1), radius=0.1):
    d = bpy.data.lights.new(name, 'SPOT')
    d.energy = energy
    d.color = color
    d.spot_size = angle
    d.spot_blend = blend
    d.shadow_soft_size = radius
    o = link(bpy.data.objects.new(name, d))
    o.location = loc
    look_at(o, target)
    return o


def look_at(o, target):
    d = Vector(target) - o.location
    o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def key_light(energy=900, color=(1.0, 0.96, 0.9), size=6.0):
    """The art kit's single key light from the top left."""
    return area('Key', (-9, 10, 18), energy, size=size, color=color, target=(0, 0, 0))


# ---------------------------------------------------------------- figure

def hero(name, loc, scale, body_m, accent_m, visor_m, pose='run', facing=1, rot=0.0, cape_m=None):
    """A small original runner in a helmet and cape, built from bevelled faceted parts (about 0.3 units tall).

    pose: 'run', 'hang' (arms up), 'leap', 'crouch'. Returns an empty parent.
    """
    par = bpy.data.objects.new(name, None)
    link(par)
    par.location = loc
    par.scale = (scale * facing, scale, scale)
    par.rotation_euler = (0, 0, rot)
    parts = []

    def limb(n, a, b, r, m):
        a, b = Vector(a), Vector(b)
        mid = (a + b) / 2
        L = (b - a).length
        o = cyl(n, mid, r, L, m, verts=10, r2=r * 0.82, bevel=0.0)
        o.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler()
        parts.append(o)
        j = sphere(n + 'j', b, r * 0.95, m, seg=12, ring=8)
        parts.append(j)

    # torso: a tapered, bevelled wedge
    t = prism(name + 'torso', [(-0.055, -0.02), (0.055, -0.02), (0.07, 0.13), (-0.07, 0.13)], -0.04, 0.04, body_m, 0.015)
    parts.append(t)
    belt = box(name + 'belt', (0, -0.015, 0), (0.12, 0.022, 0.085), accent_m, 0.006)
    parts.append(belt)
    chest = prism(name + 'bolt', [(-0.012, 0.11), (0.02, 0.11), (0.0, 0.07), (0.018, 0.07), (-0.02, 0.02), (-0.004, 0.06), (-0.02, 0.06)],
                  0.04, 0.05, accent_m, 0.0)
    parts.append(chest)
    head = sphere(name + 'head', (0, 0.19, 0), 0.052, body_m, seg=20, ring=12, scale=(0.95, 1.08, 1.0))
    parts.append(head)
    vis = box(name + 'visor', (0.018, 0.195, 0.035), (0.075, 0.022, 0.03), visor_m, 0.008)
    parts.append(vis)
    if pose == 'run':
        legs = [((-0.03, -0.03, 0), (0.05, -0.11, 0), (0.02, -0.2, 0)), ((0.03, -0.03, 0), (-0.04, -0.1, 0), (-0.1, -0.15, 0))]
        arms = [((-0.06, 0.11, 0), (-0.11, 0.04, 0), (-0.07, -0.01, 0)), ((0.06, 0.11, 0), (0.12, 0.07, 0), (0.17, 0.12, 0))]
    elif pose == 'hang':
        legs = [((-0.03, -0.03, 0), (-0.05, -0.12, 0), (-0.02, -0.21, 0)), ((0.03, -0.03, 0), (0.06, -0.11, 0), (0.1, -0.18, 0))]
        arms = [((-0.05, 0.12, 0), (-0.02, 0.22, 0), (0.0, 0.31, 0)), ((0.05, 0.12, 0), (0.04, 0.22, 0), (0.01, 0.31, 0))]
    elif pose == 'leap':
        legs = [((-0.03, -0.03, 0), (0.02, -0.12, 0), (-0.04, -0.18, 0)), ((0.03, -0.03, 0), (0.1, -0.06, 0), (0.12, -0.15, 0))]
        arms = [((-0.06, 0.11, 0), (-0.13, 0.16, 0), (-0.16, 0.24, 0)), ((0.06, 0.11, 0), (0.13, 0.17, 0), (0.18, 0.24, 0))]
    else:
        legs = [((-0.03, -0.03, 0), (0.06, -0.06, 0), (0.01, -0.13, 0)), ((0.03, -0.03, 0), (-0.05, -0.07, 0), (-0.07, -0.14, 0))]
        arms = [((-0.06, 0.11, 0), (-0.1, 0.03, 0), (-0.05, -0.02, 0)), ((0.06, 0.11, 0), (0.1, 0.03, 0), (0.08, -0.03, 0))]
    for i, (a, b, c) in enumerate(legs):
        limb(name + f'thigh{i}', a, b, 0.024, body_m)
        limb(name + f'shin{i}', b, c, 0.021, body_m)
        parts.append(box(name + f'boot{i}', (c[0] + 0.012, c[1] - 0.008, c[2]), (0.05, 0.025, 0.04), accent_m, 0.008))
    for i, (a, b, c) in enumerate(arms):
        limb(name + f'up{i}', a, b, 0.019, body_m)
        limb(name + f'fore{i}', b, c, 0.017, body_m)
        parts.append(sphere(name + f'fist{i}', c, 0.024, accent_m, seg=12, ring=8))
    cm = cape_m or accent_m
    sway = {'run': -0.16, 'hang': -0.05, 'leap': -0.12, 'crouch': -0.1}[pose]
    cape = prism(name + 'cape', [(-0.06, 0.13), (0.03, 0.13), (sway + 0.02, -0.12), (sway - 0.07, -0.08)], -0.05, -0.035, cm, 0.008)
    parts.append(cape)
    for p in parts:
        p.parent = par
    return par


def crackle(name, crust=(0.03, 0.025, 0.022), glow=(1.0, 0.3, 0.05), strength=6.0, scale=12.0, width=0.06,
            rough=0.8, metal=0.0, crust_bump=0.5, glow_only_emission=True):
    """Dark crusted plates with a glowing crack network between them (Voronoi distance-to-edge).

    Used for lava crust (Look A) and for gold-seamed black stone (Look B, low strength, metallic seams).
    """
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value = rough
    tc = nt.nodes.new('ShaderNodeTexCoord')
    vor = nt.nodes.new('ShaderNodeTexVoronoi')
    vor.feature = 'DISTANCE_TO_EDGE'
    vor.inputs['Scale'].default_value = scale
    vor.inputs['Randomness'].default_value = 0.9
    nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = scale * 0.35
    nz.inputs['Detail'].default_value = 6
    mixv = nt.nodes.new('ShaderNodeVectorMath')
    mixv.operation = 'ADD'
    sc = nt.nodes.new('ShaderNodeVectorMath')
    sc.operation = 'SCALE'
    sc.inputs['Scale'].default_value = 0.08
    nt.links.new(tc.outputs['Object'], mixv.inputs[0])
    nt.links.new(nz.outputs['Color'], sc.inputs[0])
    nt.links.new(sc.outputs['Vector'], mixv.inputs[1])
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    nt.links.new(mixv.outputs['Vector'], vor.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeMapRange')
    ramp.inputs['From Min'].default_value = 0.0
    ramp.inputs['From Max'].default_value = width
    ramp.inputs['To Min'].default_value = 1.0
    ramp.inputs['To Max'].default_value = 0.0
    nt.links.new(vor.outputs['Distance'], ramp.inputs['Value'])
    # crust colour with variation
    cr = nt.nodes.new('ShaderNodeValToRGB')
    cr.color_ramp.elements[0].color = (*crust, 1)
    cr.color_ramp.elements[1].color = (*(c * 2.4 for c in crust), 1)
    nt.links.new(nz.outputs['Fac'], cr.inputs[0])
    mixc = nt.nodes.new('ShaderNodeMix')
    mixc.data_type = 'RGBA'
    nt.links.new(ramp.outputs['Result'], mixc.inputs['Factor'])
    nt.links.new(cr.outputs['Color'], mixc.inputs[6])
    mixc.inputs[7].default_value = (*glow, 1)
    nt.links.new(mixc.outputs[2], b.inputs['Base Color'])
    b.inputs['Emission Color'].default_value = (*glow, 1)
    em = nt.nodes.new('ShaderNodeMath')
    em.operation = 'MULTIPLY'
    em.inputs[1].default_value = strength
    nt.links.new(ramp.outputs['Result'], em.inputs[0])
    nt.links.new(em.outputs[0], b.inputs['Emission Strength'])
    if metal:
        nt.links.new(ramp.outputs['Result'], b.inputs['Metallic'])
    bm = nt.nodes.new('ShaderNodeBump')
    bm.inputs['Strength'].default_value = crust_bump
    bm.inputs['Distance'].default_value = 0.03
    inv = nt.nodes.new('ShaderNodeMath')
    inv.operation = 'ADD'
    nt.links.new(vor.outputs['Distance'], inv.inputs[0])
    nt.links.new(nz.outputs['Fac'], inv.inputs[1])
    nt.links.new(inv.outputs[0], bm.inputs['Height'])
    nt.links.new(bm.outputs['Normal'], b.inputs['Normal'])
    _mats[name] = m
    return m


def strip(name, pts_px, width_px, z0, z1, m, side=1, bevel=0.01):
    """A band of given width along a polyline of phone-px points, offset to one side (+1 = left of travel)."""
    import math as _m
    left, right = [], []
    for i, (x, y) in enumerate(pts_px):
        x2, y2 = pts_px[min(i + 1, len(pts_px) - 1)]
        x1, y1 = pts_px[max(i - 1, 0)]
        dx, dy = x2 - x1, y2 - y1
        L = _m.hypot(dx, dy) or 1
        nx, ny = -dy / L, dx / L
        left.append((x, y))
        right.append((x + nx * width_px * side, y + ny * width_px * side))
    poly = left + list(reversed(right))
    return prism(name, [(x / 100 - 1.95, 4.22 - y / 100) for x, y in poly], z0, z1, m, bevel)


def random_tint(name, c1, c2, rough=0.5, transl=0.0, metal=0.0, bump=None, coat=0.0):
    """Each object picks its own colour between c1 and c2 (Object Info > Random): foliage, bricks, debris."""
    if name in _mats:
        return _mats[name]
    m = mat(name + '_', c1, rough=rough, metal=metal, bump=bump, coat=coat)
    m.name = name
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    oi = nt.nodes.new('ShaderNodeObjectInfo')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (*c1, 1)
    ramp.color_ramp.elements[1].color = (*c2, 1)
    nt.links.new(oi.outputs['Random'], ramp.inputs[0])
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    if transl:
        b.inputs['Subsurface Weight'].default_value = transl
        nt.links.new(ramp.outputs['Color'], b.inputs['Subsurface Radius']) if False else None
    _mats[name] = m
    return m


def leaf(name, loc, length, width, m, rot=(0, 0, 0), fold=0.25, curl=0.0):
    """A pointed leaf with a folded midrib and a slight curl (8 verts)."""
    L, w = length, width
    v = [(0, 0, 0), (L * 0.25, w * 0.42, fold * w), (L * 0.55, w * 0.5, fold * w), (L * 0.85, w * 0.22, fold * w * 0.5 + curl),
         (L, 0, curl * 1.5), (L * 0.85, -w * 0.22, fold * w * 0.5 + curl), (L * 0.55, -w * 0.5, fold * w), (L * 0.25, -w * 0.42, fold * w),
         (L * 0.5, 0, 0)]
    f = [(0, 1, 8), (1, 2, 8), (2, 3, 8), (3, 4, 8), (4, 5, 8), (5, 6, 8), (6, 7, 8), (7, 0, 8)]
    o = mesh_obj(name, v, f)
    o.location = loc
    o.rotation_euler = rot
    o.data.materials.append(m)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def fog(density=0.02, color=(1, 1, 1), z0=-10, z1=1.0, anis=0.3):
    """A volume box filling the view: atmosphere and light shafts."""
    m = bpy.data.materials.new('fog')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    v = nt.nodes.new('ShaderNodeVolumePrincipled')
    v.inputs['Density'].default_value = density
    v.inputs['Color'].default_value = (*color, 1)
    v.inputs['Anisotropy'].default_value = anis
    nt.links.new(v.outputs[0], nt.nodes['Material Output'].inputs['Volume'])
    k = depth_scale(z0)
    o = box('fogbox', (0, 0, (z0 + z1) / 2), (5 * k, 10 * k, z1 - z0), m, bevel=0)
    bpy.context.scene.cycles.volume_bounces = 0
    return o


def smoke_volume(name, loc, r, h, density=1.5, color=(0.05, 0.05, 0.05), scale=1.2, emit=None, estr=0.0):
    """A rising smoke plume: a tapered cylinder of noisy volume (no surface), wider at the top."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    v = nt.nodes.new('ShaderNodeVolumePrincipled')
    v.inputs['Color'].default_value = (*color, 1)
    if emit:
        v.inputs['Emission Color'].default_value = (*emit, 1)
        v.inputs['Emission Strength'].default_value = estr
    tc = nt.nodes.new('ShaderNodeTexCoord')
    nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = scale
    nz.inputs['Detail'].default_value = 8
    ramp = nt.nodes.new('ShaderNodeMapRange')
    ramp.inputs['From Min'].default_value = 0.45
    ramp.inputs['From Max'].default_value = 0.75
    ramp.inputs['To Max'].default_value = density
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    nt.links.new(nz.outputs['Fac'], ramp.inputs['Value'])
    # fade to nothing towards the plume's sides and top
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    dx = nt.nodes.new('ShaderNodeMath'); dx.operation = 'SUBTRACT'; dx.inputs[1].default_value = 0.5
    dy = nt.nodes.new('ShaderNodeMath'); dy.operation = 'SUBTRACT'; dy.inputs[1].default_value = 0.5
    nt.links.new(sep.outputs['X'], dx.inputs[0]); nt.links.new(sep.outputs['Y'], dy.inputs[0])
    cmb = nt.nodes.new('ShaderNodeCombineXYZ')
    nt.links.new(dx.outputs[0], cmb.inputs['X']); nt.links.new(dy.outputs[0], cmb.inputs['Y'])
    ln = nt.nodes.new('ShaderNodeVectorMath'); ln.operation = 'LENGTH'
    nt.links.new(cmb.outputs[0], ln.inputs[0])
    fall = nt.nodes.new('ShaderNodeMapRange')
    fall.inputs['From Min'].default_value = 0.15
    fall.inputs['From Max'].default_value = 0.5
    fall.inputs['To Min'].default_value = 1.0
    fall.inputs['To Max'].default_value = 0.0
    nt.links.new(ln.outputs['Value'], fall.inputs['Value'])
    topf = nt.nodes.new('ShaderNodeMapRange')
    topf.inputs['From Min'].default_value = 0.6
    topf.inputs['From Max'].default_value = 1.0
    topf.inputs['To Min'].default_value = 1.0
    topf.inputs['To Max'].default_value = 0.0
    nt.links.new(sep.outputs['Z'], topf.inputs['Value'])
    m1 = nt.nodes.new('ShaderNodeMath'); m1.operation = 'MULTIPLY'
    m2 = nt.nodes.new('ShaderNodeMath'); m2.operation = 'MULTIPLY'
    nt.links.new(ramp.outputs['Result'], m1.inputs[0]); nt.links.new(fall.outputs['Result'], m1.inputs[1])
    nt.links.new(m1.outputs[0], m2.inputs[0]); nt.links.new(topf.outputs['Result'], m2.inputs[1])
    nt.links.new(m2.outputs[0], v.inputs['Density'])
    nt.links.new(v.outputs[0], nt.nodes['Material Output'].inputs['Volume'])
    o = cyl(name, (loc[0], loc[1], loc[2] + h / 2), r * 0.35, h, m, verts=24, r2=r)
    return o


def windows(name, lit=(1.0, 0.85, 0.55), frame=(0.05, 0.06, 0.08), glass=(0.25, 0.4, 0.55), scale=(14.0, 5.0),
            estr=2.0, lit_share=0.6, metal_frame=True, mortar=0.12):
    """A facade: a grid of window panes (Brick Texture) in a frame; a share of panes lit from inside."""
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (scale[0], scale[1], 1)
    br = nt.nodes.new('ShaderNodeTexBrick')
    br.offset = 0.0
    br.inputs['Scale'].default_value = 1.0
    br.inputs['Mortar Size'].default_value = mortar
    br.inputs['Mortar Smooth'].default_value = 0.1
    br.inputs['Brick Width'].default_value = 1.0
    br.inputs['Row Height'].default_value = 1.0
    br.inputs['Color1'].default_value = (1, 1, 1, 1)
    br.inputs['Color2'].default_value = (0, 0, 0, 1)
    br.inputs['Mortar'].default_value = (0, 0, 0, 1)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], br.inputs['Vector'])
    # pane mask (1 inside panes) and per-pane random lit
    pane = nt.nodes.new('ShaderNodeMath'); pane.operation = 'SUBTRACT'; pane.inputs[0].default_value = 1.0
    nt.links.new(br.outputs['Fac'], pane.inputs[1])
    gt = nt.nodes.new('ShaderNodeMath'); gt.operation = 'LESS_THAN'; gt.inputs[1].default_value = lit_share
    nt.links.new(br.outputs['Color'], gt.inputs[0])
    lit_m = nt.nodes.new('ShaderNodeMath'); lit_m.operation = 'MULTIPLY'
    nt.links.new(pane.outputs[0], lit_m.inputs[0]); nt.links.new(gt.outputs[0], lit_m.inputs[1])
    # the Color1/Color2 random gives each brick a grey value: use it for lit choice
    br.inputs['Color1'].default_value = (0.0, 0.0, 0.0, 1)
    br.inputs['Color2'].default_value = (1.0, 1.0, 1.0, 1)
    br.inputs['Bias'].default_value = 0.0
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
    nt.links.new(pane.outputs[0], mix.inputs['Factor'])
    mix.inputs[6].default_value = (*frame, 1)
    mix.inputs[7].default_value = (*glass, 1)
    nt.links.new(mix.outputs[2], b.inputs['Base Color'])
    if metal_frame:
        inv = nt.nodes.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0
        nt.links.new(pane.outputs[0], inv.inputs[1])
        nt.links.new(inv.outputs[0], b.inputs['Metallic'])
    b.inputs['Roughness'].default_value = 0.15
    b.inputs['Coat Weight'].default_value = 0.4
    b.inputs['Emission Color'].default_value = (*lit, 1)
    em = nt.nodes.new('ShaderNodeMath'); em.operation = 'MULTIPLY'; em.inputs[1].default_value = estr
    nt.links.new(lit_m.outputs[0], em.inputs[0])
    nt.links.new(em.outputs[0], b.inputs['Emission Strength'])
    _mats[name] = m
    return m


def planet_mat(name, c1, c2, c3, banded=True, scale=3.0, rough=0.6, distortion=8.0):
    """Gas-giant bands (wave texture) or rocky mottling (noise), three-colour ramp."""
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value = rough
    tc = nt.nodes.new('ShaderNodeTexCoord')
    if banded:
        t = nt.nodes.new('ShaderNodeTexWave')
        t.bands_direction = 'Y'
        t.inputs['Scale'].default_value = scale
        t.inputs['Distortion'].default_value = distortion
        t.inputs['Detail'].default_value = 6
        t.inputs['Detail Scale'].default_value = 2.0
    else:
        t = nt.nodes.new('ShaderNodeTexNoise')
        t.inputs['Scale'].default_value = scale
        t.inputs['Detail'].default_value = 10
        t.inputs['Roughness'].default_value = 0.65
        bm = nt.nodes.new('ShaderNodeBump')
        bm.inputs['Strength'].default_value = 0.6
        nt.links.new(t.outputs['Fac'], bm.inputs['Height'])
        nt.links.new(bm.outputs['Normal'], b.inputs['Normal'])
    nt.links.new(tc.outputs['Object'], t.inputs['Vector'])
    r = nt.nodes.new('ShaderNodeValToRGB')
    r.color_ramp.elements[0].color = (*c1, 1)
    r.color_ramp.elements[1].color = (*c3, 1)
    e = r.color_ramp.elements.new(0.5)
    e.color = (*c2, 1)
    nt.links.new(t.outputs['Fac'], r.inputs[0])
    nt.links.new(r.outputs['Color'], b.inputs['Base Color'])
    _mats[name] = m
    return m


def atmosphere(name, color, strength=3.0, power=4.0):
    """A shell that glows only at grazing angles: a planet's atmosphere rim."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    lw = nt.nodes.new('ShaderNodeLayerWeight')
    lw.inputs['Blend'].default_value = 0.5
    pw = nt.nodes.new('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = power
    nt.links.new(lw.outputs['Facing'], pw.inputs[0])
    e = nt.nodes.new('ShaderNodeEmission'); e.inputs[0].default_value = (*color, 1)
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = strength
    nt.links.new(pw.outputs[0], mul.inputs[0]); nt.links.new(mul.outputs[0], e.inputs['Strength'])
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    add = nt.nodes.new('ShaderNodeAddShader')
    nt.links.new(e.outputs[0], add.inputs[0]); nt.links.new(tr.outputs[0], add.inputs[1])
    nt.links.new(add.outputs[0], out.inputs[0])
    return m


def nebula_plane(name, z, colours, strength=0.6, scale=1.4, seed=0.0):
    """A far emissive backdrop of soft coloured cloud (noise > colour ramp), for space scenes."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Location'].default_value = (seed, seed * 0.7, seed * 0.3)
    nz = nt.nodes.new('ShaderNodeTexNoise')
    nz.inputs['Scale'].default_value = scale
    nz.inputs['Detail'].default_value = 12
    nz.inputs['Roughness'].default_value = 0.62
    nz.inputs['Distortion'].default_value = 0.6
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.45
    ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    ramp.color_ramp.elements[1].position = 0.78
    ramp.color_ramp.elements[1].color = (*colours[-1], 1)
    if len(colours) > 1:
        e = ramp.color_ramp.elements.new(0.62)
        e.color = (*colours[0], 1)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], nz.inputs['Vector'])
    nt.links.new(nz.outputs['Fac'], ramp.inputs[0])
    e = nt.nodes.new('ShaderNodeEmission')
    e.inputs['Strength'].default_value = strength
    nt.links.new(ramp.outputs['Color'], e.inputs['Color'])
    nt.links.new(e.outputs[0], out.inputs[0])
    k = depth_scale(z)
    return plane(name, (0, 0, z), 4.4 * k, 9.0 * k, m)


def starfield(n=160, z=-12.0, seed=1, size=(0.003, 0.008), colours=((0.8, 0.85, 1.0),)):
    rnd = random.Random(seed)
    k = depth_scale(z)
    ms = [emission(f'sf{i}{j}', c, s) for i, c in enumerate(colours) for j, s in enumerate((1.0, 2.5, 6.0))]
    for i in range(n):
        sphere(f'sf{seed}_{i}', (rnd.uniform(-1.4, 1.4) * k, rnd.uniform(-3.6, 3.6) * k, z), rnd.uniform(*size) * k,
               ms[(i % len(colours)) * 3 + (0 if i % 6 else (1 if i % 4 else 2))], seg=6, ring=4)


def star_shape(name, loc, r_out, r_in, depth, m, points=5, rot=0.0):
    """A faceted (bevelled) star: a raised centre so each arm has two lit faces."""
    v = [(0, 0, depth)]
    for i in range(points * 2):
        a = rot + math.pi / 2 + i * math.pi / points
        r = r_out if i % 2 == 0 else r_in
        v.append((r * math.cos(a), r * math.sin(a), 0))
    v.append((0, 0, -depth * 0.3))
    n = points * 2
    f = [(0, 1 + i, 1 + (i + 1) % n) for i in range(n)] + [(n + 1, 1 + (i + 1) % n, 1 + i) for i in range(n)]
    o = mesh_obj(name, v, f)
    o.location = loc
    o.data.materials.append(m)
    return o


def grid_floor(name, z, base=(0.006, 0.008, 0.02), line=(0.2, 0.4, 1.0), strength=0.25, cells=(10.0, 21.6), w=0.03, gloss=0.6):
    """A dark glossy backboard with a faint emissive grid (retro arcade playfields)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*base, 1)
    b.inputs['Roughness'].default_value = gloss
    b.inputs['Coat Weight'].default_value = 0.0
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping'); mp.inputs['Scale'].default_value = (cells[0] / 4.0, cells[1] / 8.6, 1)
    br = nt.nodes.new('ShaderNodeTexBrick')
    br.offset = 0.0
    br.inputs['Mortar Size'].default_value = w
    br.inputs['Brick Width'].default_value = 1.0 / 2.5
    br.inputs['Row Height'].default_value = 1.0 / 2.5
    br.inputs['Color1'].default_value = (0, 0, 0, 1)
    br.inputs['Color2'].default_value = (0, 0, 0, 1)
    br.inputs['Mortar'].default_value = (1, 1, 1, 1)
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], br.inputs['Vector'])
    b.inputs['Emission Color'].default_value = (*line, 1)
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = strength
    nt.links.new(br.outputs['Fac'], mul.inputs[0])
    nt.links.new(mul.outputs[0], b.inputs['Emission Strength'])
    k = depth_scale(z)
    o = plane(name, (0, 0, z), 4.2 * k, 9.0 * k, m)
    return o


def glow_glass(name, color, estr=1.2, rough=0.12, coat=0.4):
    """A coloured acrylic/glass tile lit from inside: saturated base, clear coat, soft inner emission."""
    return mat(name, color, rough=rough, coat=coat, emit=color, estr=estr, transm=0.0, spec=0.6)


def fade_glow(name, loc, sx, sy, color, strength=1.0, power=1.6):
    """A plane of light fading from full at its bottom edge to nothing at its top (light columns, lane washes)."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    inv = nt.nodes.new('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0
    nt.links.new(sep.outputs['Y'], inv.inputs[1])
    pw = nt.nodes.new('ShaderNodeMath'); pw.operation = 'POWER'; pw.inputs[1].default_value = power
    nt.links.new(inv.outputs[0], pw.inputs[0])
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = strength
    nt.links.new(pw.outputs[0], mul.inputs[0])
    e = nt.nodes.new('ShaderNodeEmission'); e.inputs[0].default_value = (*color, 1)
    nt.links.new(mul.outputs[0], e.inputs['Strength'])
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    add = nt.nodes.new('ShaderNodeAddShader')
    nt.links.new(e.outputs[0], add.inputs[0]); nt.links.new(tr.outputs[0], add.inputs[1])
    nt.links.new(add.outputs[0], out.inputs[0])
    return plane(name, loc, sx, sy, m)
