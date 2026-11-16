"""Shared Blender toolkit (copied from the game concepts, PR #427, docs/design/game-concepts/source/lib.py).

Coordinates are phone pixels on a 390 x 844 screen, origin top left, y down, as the app lays out a
game. `P(x, y)` turns them into Blender metres (1 px = 1 cm), so a board can be copied straight from a
screenshot's geometry. The camera is a long-lens perspective camera straight above the screen, so the
layout is faithful while raised pieces still show a little of their sides.

Run a scene with the bpy module (pip install bpy==5.2.4):
    python render.py <category> <game> <look>
"""
import math
import os
import random

import bpy
import bmesh
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "fonts")
STUDIO = os.path.join(bpy.utils.system_resource("DATAFILES"), "studiolights", "world")

W, H = 390, 844
S = 0.01  # metres per phone pixel
CAM_Z = 20.0


def P(x, y, z=0.0):
    return Vector(((x - W / 2) * S, (H / 2 - y) * S, z * S))


def hexc(h, a=1.0):
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(r), lin(g), lin(b), a)


# ---------------------------------------------------------------------------------------------- scene


def reset(seed=1):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    random.seed(seed)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = 160
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.02
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 8
    sc.cycles.transmission_bounces = 8
    sc.cycles.glossy_bounces = 4
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.cycles.blur_glossy = 1.0
    sc.render.resolution_x = 540
    sc.render.resolution_y = 1169
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "Khronos PBR Neutral"
    sc.render.image_settings.file_format = "PNG"
    cam_data = bpy.data.cameras.new("cam")
    cam_data.sensor_fit = "VERTICAL"
    cam_data.sensor_height = 36
    cam_data.lens = 36 * CAM_Z / (H * S)
    cam_data.clip_end = 200
    cam = bpy.data.objects.new("cam", cam_data)
    cam.location = (0, 0, CAM_Z)
    sc.collection.objects.link(cam)
    sc.camera = cam
    return sc


def dof(focus_z_px=0.0, fstop=2.8):
    cam = bpy.context.scene.camera.data
    cam.dof.use_dof = True
    cam.dof.focus_distance = CAM_Z - focus_z_px * S
    cam.dof.aperture_fstop = fstop


def world(hdri="studio", strength=0.6, rot=0.0, tint=None, bg=None):
    """Image-based light from one of Blender's bundled studio lights; `bg` colours what the camera sees."""
    wd = bpy.data.worlds.new("w")
    bpy.context.scene.world = wd
    wd.use_nodes = True
    nt = wd.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(os.path.join(STUDIO, hdri + ".exr"))
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Rotation"].default_value = (0, 0, rot)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nt.links.new(tc.outputs["Generated"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], env.inputs["Vector"])
    bgn = nt.nodes.new("ShaderNodeBackground")
    bgn.inputs["Strength"].default_value = strength
    src = env.outputs["Color"]
    if tint:
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs["Factor"].default_value = 1.0
        nt.links.new(env.outputs["Color"], mix.inputs["A"])
        mix.inputs["B"].default_value = tint
        src = mix.outputs["Result"]
    nt.links.new(src, bgn.inputs["Color"])
    if bg is not None:
        cam_bg = nt.nodes.new("ShaderNodeBackground")
        cam_bg.inputs["Color"].default_value = bg
        lp = nt.nodes.new("ShaderNodeLightPath")
        mx = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(lp.outputs["Is Camera Ray"], mx.inputs[0])
        nt.links.new(bgn.outputs[0], mx.inputs[1])
        nt.links.new(cam_bg.outputs[0], mx.inputs[2])
        nt.links.new(mx.outputs[0], out.inputs[0])
    else:
        nt.links.new(bgn.outputs[0], out.inputs[0])


def area(x, y, z, size, power, color=(1, 1, 1), target=None, shape="RECTANGLE", size_y=None, spread=180):
    """An area light at phone (x, y) and height z (px), aimed at `target` (phone x, y) on the board."""
    ld = bpy.data.lights.new("a", "AREA")
    ld.shape = shape
    ld.size = size * S
    if size_y:
        ld.size_y = size_y * S
    ld.energy = power
    ld.color = color[:3]
    ld.spread = math.radians(spread)
    ob = bpy.data.objects.new("a", ld)
    ob.location = P(x, y, z)
    bpy.context.scene.collection.objects.link(ob)
    tx, ty = target if target else (W / 2, H / 2)
    d = P(tx, ty, 0) - ob.location
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return ob


def spot(x, y, z, power, color=(1, 1, 1), angle=70, blend=1.0, radius=40, target=None):
    """A soft spot from above: a pool of light on the board that glossy tiles reflect only as a small highlight."""
    ld = bpy.data.lights.new("s", "SPOT")
    ld.energy = power
    ld.color = color[:3]
    ld.spot_size = math.radians(angle)
    ld.spot_blend = blend
    ld.shadow_soft_size = radius * S
    ob = bpy.data.objects.new("s", ld)
    ob.location = P(x, y, z)
    bpy.context.scene.collection.objects.link(ob)
    tx, ty = target if target else (x, y)
    d = P(tx, ty, 0) - ob.location
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return ob


def point(x, y, z, power, color=(1, 1, 1), radius=20):
    ld = bpy.data.lights.new("p", "POINT")
    ld.energy = power
    ld.color = color[:3]
    ld.shadow_soft_size = radius * S
    ob = bpy.data.objects.new("p", ld)
    ob.location = P(x, y, z)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def reflector(strength=2.0, color=(1, 1, 1), z=1400, size=2600, x=60, y=200):
    """A big softbox above the set that only reflections see: what makes flat metal and lacquer read."""
    me = bpy.data.meshes.new("refl")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=size * S / 2)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("refl", me)
    ob.location = P(x, y, z)
    ob.rotation_euler = (math.pi, 0, 0)
    link(ob)
    m = bpy.data.materials.new("refl")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    e = nt.nodes.new("ShaderNodeEmission")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    gr = nt.nodes.new("ShaderNodeTexGradient")
    gr.gradient_type = "QUADRATIC_SPHERE"
    mp = nt.nodes.new("ShaderNodeMapping")
    r = size * S / 2
    mp.inputs["Scale"].default_value = (1.05 / r, 1.05 / r, 1)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], gr.inputs["Vector"])
    mth = nt.nodes.new("ShaderNodeMath")
    mth.operation = "MULTIPLY"
    mth.inputs[1].default_value = strength
    nt.links.new(gr.outputs["Fac"], mth.inputs[0])
    e.inputs["Color"].default_value = (*color, 1)
    nt.links.new(mth.outputs[0], e.inputs["Strength"])
    nt.links.new(e.outputs[0], o.inputs[0])
    me.materials.append(m)
    ob.visible_camera = False
    ob.visible_diffuse = False
    ob.visible_shadow = False
    ob.visible_transmission = False
    ob.visible_volume_scatter = False
    return ob


def key_light(power=900, warm=(1.0, 0.95, 0.88), fill=0.25, rim=0.0):
    """The art kit's lighting: one soft key from the top left, a quiet fill and an optional rim."""
    area(-260, -420, 900, 520, power, warm, target=(195, 420))
    if fill:
        area(700, 900, 700, 700, power * fill, (0.85, 0.9, 1.0), target=(195, 420))
    if rim:
        area(195, 1500, 260, 900, power * rim, (1, 1, 1), target=(195, 300), size_y=80)


# ------------------------------------------------------------------------------------------ materials

_MATS = {}


def _principled(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    return m, nt, b


def _noise_into(nt, socket, scale=40.0, detail=8.0, lo=0.0, hi=1.0, coord="Object", stretch=None, rough=0.55):
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = detail
    nz.inputs["Roughness"].default_value = rough
    src = tc.outputs[coord]
    if stretch:
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = stretch
        nt.links.new(src, mp.inputs["Vector"])
        src = mp.outputs["Vector"]
    nt.links.new(src, nz.inputs["Vector"])
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["To Min"].default_value = lo
    mr.inputs["To Max"].default_value = hi
    nt.links.new(nz.outputs["Fac"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], socket)
    return nz


def _bump(nt, b, scale=200.0, strength=0.08, detail=6.0, stretch=None, dist=0.002):
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = detail
    src = tc.outputs["Object"]
    if stretch:
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = stretch
        nt.links.new(src, mp.inputs["Vector"])
        src = mp.outputs["Vector"]
    nt.links.new(src, nz.inputs["Vector"])
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = strength
    bp.inputs["Distance"].default_value = dist
    nt.links.new(nz.outputs["Fac"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    return bp


def mat(key, color, rough=0.4, metal=0.0, coat=0.0, coat_rough=0.05, spec=0.5, sheen=0.0,
        bump=0.0, bump_scale=300.0, rough_var=0.0, emit=None, emit_strength=0.0, aniso=0.0, ior=1.5):
    """A general physically based surface; `rough_var` breaks up the roughness so nothing looks plastic."""
    if key in _MATS:
        return _MATS[key]
    m, nt, b = _principled(key)
    b.inputs["Base Color"].default_value = color if len(color) == 4 else (*color, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Specular IOR Level"].default_value = spec
    b.inputs["IOR"].default_value = ior
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = coat_rough
    b.inputs["Sheen Weight"].default_value = sheen
    b.inputs["Anisotropic"].default_value = aniso
    if rough_var:
        _noise_into(nt, b.inputs["Roughness"], scale=60, lo=max(0, rough - rough_var), hi=rough + rough_var)
    else:
        b.inputs["Roughness"].default_value = rough
    if bump:
        _bump(nt, b, scale=bump_scale, strength=bump)
    if emit is not None:
        b.inputs["Emission Color"].default_value = emit
        b.inputs["Emission Strength"].default_value = emit_strength
    _MATS[key] = m
    return m


def glass(key, color=(1, 1, 1, 1), rough=0.02, ior=1.48, tint_depth=None):
    if key in _MATS:
        return _MATS[key]
    m, nt, b = _principled(key)
    b.inputs["Base Color"].default_value = color
    b.inputs["Transmission Weight"].default_value = 1.0
    b.inputs["Roughness"].default_value = rough
    b.inputs["IOR"].default_value = ior
    _MATS[key] = m
    return m


def metal(key, color, rough=0.28, brushed=True, aniso=0.6):
    """Real metal: full metallic, with brushing (stretched noise in the roughness) and fine wear."""
    if key in _MATS:
        return _MATS[key]
    m, nt, b = _principled(key)
    b.inputs["Base Color"].default_value = color
    b.inputs["Metallic"].default_value = 1.0
    if brushed:
        _noise_into(nt, b.inputs["Roughness"], scale=6, detail=12, lo=rough * 0.6, hi=rough * 1.4,
                    stretch=(1, 90, 1))
        b.inputs["Anisotropic"].default_value = aniso
    else:
        _noise_into(nt, b.inputs["Roughness"], scale=30, lo=rough * 0.7, hi=rough * 1.3)
    _MATS[key] = m
    return m


def wood(key, light, dark, rough=0.38, scale=14.0, coat=0.6, rot90=False, ring=4.0):
    """Procedural figured wood: a stretched wave grain broken by noise, oiled or lacquered."""
    if key in _MATS:
        return _MATS[key]
    m, nt, b = _principled(key)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1, 0.06, 1) if not rot90 else (0.06, 1, 1)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    wv = nt.nodes.new("ShaderNodeTexWave")
    wv.wave_type = "BANDS"
    wv.bands_direction = "X" if not rot90 else "Y"
    wv.inputs["Scale"].default_value = scale
    wv.inputs["Distortion"].default_value = ring * 2.5
    wv.inputs["Detail"].default_value = 6
    wv.inputs["Detail Scale"].default_value = 1.6
    nt.links.new(mp.outputs["Vector"], wv.inputs["Vector"])
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 22
    nz.inputs["Detail"].default_value = 10
    nt.links.new(mp.outputs["Vector"], nz.inputs["Vector"])
    mx = nt.nodes.new("ShaderNodeMix")
    mx.data_type = "FLOAT"
    mx.inputs["Factor"].default_value = 0.42
    nt.links.new(wv.outputs["Fac"], mx.inputs["A"])
    nt.links.new(nz.outputs["Fac"], mx.inputs["B"])
    cr = nt.nodes.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].color = dark
    cr.color_ramp.elements[1].color = light
    cr.color_ramp.elements[0].position = 0.25
    cr.color_ramp.elements[1].position = 0.8
    nt.links.new(mx.outputs["Result"], cr.inputs["Fac"])
    nt.links.new(cr.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = rough
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = 0.08
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.05
    bp.inputs["Distance"].default_value = 0.002
    nt.links.new(mx.outputs["Result"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    _MATS[key] = m
    return m


def felt(key, color, scale=900.0):
    if key in _MATS:
        return _MATS[key]
    m, nt, b = _principled(key)
    b.inputs["Base Color"].default_value = color
    b.inputs["Roughness"].default_value = 0.95
    b.inputs["Sheen Weight"].default_value = 0.6
    b.inputs["Sheen Roughness"].default_value = 0.4
    b.inputs["Specular IOR Level"].default_value = 0.2
    _bump(nt, b, scale=scale, strength=0.25, detail=12)
    _MATS[key] = m
    return m


def leather(key, color, rough=0.5):
    if key in _MATS:
        return _MATS[key]
    m, nt, b = _principled(key)
    b.inputs["Base Color"].default_value = color
    b.inputs["Coat Weight"].default_value = 0.15
    b.inputs["Coat Roughness"].default_value = 0.3
    _noise_into(nt, b.inputs["Roughness"], scale=80, lo=rough - 0.1, hi=rough + 0.1)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    vo = nt.nodes.new("ShaderNodeTexVoronoi")
    vo.inputs["Scale"].default_value = 260
    nt.links.new(tc.outputs["Object"], vo.inputs["Vector"])
    bp = nt.nodes.new("ShaderNodeBump")
    bp.inputs["Strength"].default_value = 0.18
    bp.inputs["Distance"].default_value = 0.002
    nt.links.new(vo.outputs["Distance"], bp.inputs["Height"])
    nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    _MATS[key] = m
    return m


def stone(key, light, dark, rough=0.35, scale=6.0, veins=True):
    """Polished stone: soft cloudy colour with fine dark veins."""
    if key in _MATS:
        return _MATS[key]
    m, nt, b = _principled(key)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = 12
    nz.inputs["Distortion"].default_value = 0.6
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    cr = nt.nodes.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].color = dark
    cr.color_ramp.elements[1].color = light
    cr.color_ramp.elements[0].position = 0.3
    cr.color_ramp.elements[1].position = 0.7
    nt.links.new(nz.outputs["Fac"], cr.inputs["Fac"])
    col = cr.outputs["Color"]
    if veins:
        wv = nt.nodes.new("ShaderNodeTexWave")
        wv.inputs["Scale"].default_value = scale * 0.6
        wv.inputs["Distortion"].default_value = 14
        wv.inputs["Detail"].default_value = 10
        nt.links.new(tc.outputs["Object"], wv.inputs["Vector"])
        vr = nt.nodes.new("ShaderNodeValToRGB")
        vr.color_ramp.elements[0].position = 0.0
        vr.color_ramp.elements[1].position = 0.06
        vr.color_ramp.elements[0].color = (0.35, 0.35, 0.35, 1)
        vr.color_ramp.elements[1].color = (1, 1, 1, 1)
        nt.links.new(wv.outputs["Fac"], vr.inputs["Fac"])
        mx = nt.nodes.new("ShaderNodeMix")
        mx.data_type = "RGBA"
        mx.blend_type = "MULTIPLY"
        mx.inputs["Factor"].default_value = 1.0
        nt.links.new(col, mx.inputs["A"])
        nt.links.new(vr.outputs["Color"], mx.inputs["B"])
        col = mx.outputs["Result"]
    nt.links.new(col, b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = rough
    b.inputs["Coat Weight"].default_value = 0.3
    b.inputs["Coat Roughness"].default_value = 0.1
    _MATS[key] = m
    return m


def paper(key, color, rough=0.85, fibre=0.05):
    if key in _MATS:
        return _MATS[key]
    m, nt, b = _principled(key)
    b.inputs["Base Color"].default_value = color
    b.inputs["Roughness"].default_value = rough
    b.inputs["Specular IOR Level"].default_value = 0.25
    _bump(nt, b, scale=1200, strength=fibre, detail=14)
    _MATS[key] = m
    return m


def emissive(key, color, strength=4.0):
    if key in _MATS:
        return _MATS[key]
    m = bpy.data.materials.new(key)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = color
    e.inputs["Strength"].default_value = strength
    nt.links.new(e.outputs[0], o.inputs[0])
    _MATS[key] = m
    return m


def gradient_mat(key, c0, c1, axis="Y", rough=0.5, metal=0.0, coat=0.0, lo=0.0, hi=1.0, radial=False):
    """A surface whose colour runs from c0 to c1 across the object (or out from its centre)."""
    if key in _MATS:
        return _MATS[key]
    m, nt, b = _principled(key)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    gr = nt.nodes.new("ShaderNodeTexGradient")
    if radial:
        gr.gradient_type = "SPHERICAL"
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Location"].default_value = (0, 0, 0)
        nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
        nt.links.new(mp.outputs["Vector"], gr.inputs["Vector"])
    else:
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(tc.outputs["Generated"], sep.inputs[0])
        comb = nt.nodes.new("ShaderNodeCombineXYZ")
        nt.links.new(sep.outputs[axis], comb.inputs["X"])
        nt.links.new(comb.outputs[0], gr.inputs["Vector"])
    cr = nt.nodes.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].color = c0
    cr.color_ramp.elements[1].color = c1
    cr.color_ramp.elements[0].position = lo
    cr.color_ramp.elements[1].position = hi
    nt.links.new(gr.outputs["Fac"], cr.inputs["Fac"])
    nt.links.new(cr.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Coat Weight"].default_value = coat
    _MATS[key] = m
    return m


# --------------------------------------------------------------------------------------------- shapes

_coll = None


def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob


def _finish(ob, bevel, segs=4, smooth=True, angle=60):
    if bevel and bevel > 0:
        md = ob.modifiers.new("bv", "BEVEL")
        md.width = bevel * S
        md.segments = segs
        md.limit_method = "ANGLE"
        md.angle_limit = math.radians(angle)
        md.harden_normals = True
        md.miter_outer = "MITER_ARC"
    if smooth:
        for p in ob.data.polygons:
            p.use_smooth = True
    return ob


_MESHES = {}


def box(x, y, w, h, d, mat_, z=0.0, bevel=2.0, segs=4, rot=0.0, name="box"):
    """A bevelled block whose top-left corner is at phone (x, y); `d` its height above `z` (px)."""
    key = ("box", round(w, 2), round(h, 2), round(d, 2))
    me = _MESHES.get(key)
    if me is None:
        me = bpy.data.meshes.new(name)
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co.x *= w * S
            v.co.y *= h * S
            v.co.z = (v.co.z + 0.5) * d * S
        bm.to_mesh(me)
        bm.free()
        _MESHES[key] = me
    ob = bpy.data.objects.new(name, me)
    ob.location = P(x + w / 2, y + h / 2, z)
    ob.rotation_euler.z = rot
    ob.data.materials.clear() if False else None
    link(ob)
    if not me.materials:
        me.materials.append(mat_)
    ob.material_slots[0].link = "OBJECT"
    ob.material_slots[0].material = mat_
    return _finish(ob, min(bevel, w / 2.05, h / 2.05, d / 2.05), segs)


def cbox(cx, cy, w, h, d, mat_, z=0.0, bevel=2.0, segs=4, rot=0.0):
    return box(cx - w / 2, cy - h / 2, w, h, d, mat_, z, bevel, segs, rot)


def disc(cx, cy, r, d, mat_, z=0.0, bevel=1.5, verts=96, segs=4, name="disc"):
    key = ("disc", round(r, 2), round(d, 2), verts)
    me = _MESHES.get(key)
    if me is None:
        me = bpy.data.meshes.new(name)
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r * S, radius2=r * S, depth=d * S)
        bmesh.ops.translate(bm, vec=(0, 0, d * S / 2), verts=bm.verts)
        bm.to_mesh(me)
        bm.free()
        _MESHES[key] = me
    ob = bpy.data.objects.new(name, me)
    ob.location = P(cx, cy, z)
    link(ob)
    if not me.materials:
        me.materials.append(mat_)
    ob.material_slots[0].link = "OBJECT"
    ob.material_slots[0].material = mat_
    return _finish(ob, min(bevel, r / 2, d / 2.05), segs)


def ring(cx, cy, r_out, r_in, d, mat_, z=0.0, bevel=0.8, verts=96):
    me = bpy.data.meshes.new("ring")
    bm = bmesh.new()
    outer, inner = [], []
    for i in range(verts):
        a = 2 * math.pi * i / verts
        outer.append(bm.verts.new((math.cos(a) * r_out * S, math.sin(a) * r_out * S, 0)))
        inner.append(bm.verts.new((math.cos(a) * r_in * S, math.sin(a) * r_in * S, 0)))
    for i in range(verts):
        j = (i + 1) % verts
        bm.faces.new((outer[i], outer[j], inner[j], inner[i]))
    ext = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:])
    bmesh.ops.translate(bm, vec=(0, 0, d * S), verts=[e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("ring", me)
    ob.location = P(cx, cy, z)
    link(ob)
    me.materials.append(mat_)
    return _finish(ob, min(bevel, (r_out - r_in) / 2.2, d / 2.2), 3)


def sphere(cx, cy, r, mat_, z=None, squash=1.0, segs=48):
    key = ("sph", segs)
    me = _MESHES.get(key)
    if me is None:
        me = bpy.data.meshes.new("sph")
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=segs // 2, radius=1.0)
        bm.to_mesh(me)
        bm.free()
        for p in me.polygons:
            p.use_smooth = True
        _MESHES[key] = me
    ob = bpy.data.objects.new("sph", me)
    ob.scale = (r * S, r * S, r * S * squash)
    ob.location = P(cx, cy, r * squash if z is None else z)
    link(ob)
    if not me.materials:
        me.materials.append(mat_)
    ob.material_slots[0].link = "OBJECT"
    ob.material_slots[0].material = mat_
    return ob


def prism(points, d, mat_, z=0.0, bevel=1.5, segs=3, cx=0.0, cy=0.0, rot=0.0, scale=1.0, name="prism"):
    """Extrude a 2D outline (phone px relative to (cx, cy), y down) upward by d px, bevelled."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    vs = []
    c, s_ = math.cos(rot), math.sin(rot)
    for (px, py) in points:
        px, py = px * scale, py * scale
        rx, ry = px * c - py * s_, px * s_ + py * c
        vs.append(bm.verts.new((rx * S, -ry * S, 0)))
    f = bm.faces.new(vs)
    bmesh.ops.triangulate(bm, faces=[f]) if False else None
    if f.normal.z < 0:
        f.normal_flip()
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    bmesh.ops.translate(bm, vec=(0, 0, d * S), verts=[e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    ob.location = P(cx, cy, z)
    link(ob)
    me.materials.append(mat_)
    return _finish(ob, bevel, segs, angle=40)


def poly(n, r, rot=-math.pi / 2, star=None):
    """Points of a regular polygon (or a star with inner radius `star`), y down."""
    pts = []
    k = n * 2 if star else n
    for i in range(k):
        a = rot + 2 * math.pi * i / k
        rr = (star if (star and i % 2) else r)
        pts.append((math.cos(a) * rr, math.sin(a) * rr))
    return pts


def rounded_rect(w, h, r, n=8):
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180),
                       (w / 2 - r, -h / 2 + r, 270)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
    return pts


def tube(points3, r, mat_, verts=16):
    """A round tube through phone-space points (x, y, z px): wires, path lines, rails."""
    cu = bpy.data.curves.new("tube", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r * S
    cu.bevel_resolution = 6
    cu.use_fill_caps = True
    sp = cu.splines.new("POLY")
    sp.points.add(len(points3) - 1)
    for i, (x, y, z) in enumerate(points3):
        v = P(x, y, z)
        sp.points[i].co = (v.x, v.y, v.z, 1)
    ob = bpy.data.objects.new("tube", cu)
    link(ob)
    cu.materials.append(mat_)
    return ob


def bezier_tube(points3, r, mat_, res=24):
    cu = bpy.data.curves.new("btube", "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = r * S
    cu.bevel_resolution = 6
    cu.resolution_u = res
    cu.use_fill_caps = True
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(points3) - 1)
    for i, (x, y, z) in enumerate(points3):
        bp = sp.bezier_points[i]
        bp.co = P(x, y, z)
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    ob = bpy.data.objects.new("btube", cu)
    link(ob)
    cu.materials.append(mat_)
    return ob


_FONTS = {}


def font(name):
    path = {"archivo": "archivo-800.ttf", "archivo6": "archivo-600.ttf", "serif": "Caladea-Bold.ttf"}[name]
    if name not in _FONTS:
        _FONTS[name] = bpy.data.fonts.load(os.path.join(FONTS, path))
    return _FONTS[name]


def text(s, x, y, size, mat_, fnt="archivo", z=0.0, depth=0.0, align="CENTER", valign="CENTER", bevel=0.0,
         rot=0.0, spacing=1.0):
    """Text centred (by default) on phone (x, y); `size` is the cap-to-cap em in px; `depth` extrudes it."""
    cu = bpy.data.curves.new("t", "FONT")
    cu.body = s
    cu.font = font(fnt)
    cu.size = size * S / 0.72  # `size` is the cap height
    cu.align_x = align
    cu.align_y = "CENTER" if valign == "CENTER" else valign
    cu.extrude = depth * S / 2
    cu.bevel_depth = bevel * S
    cu.bevel_resolution = 3
    cu.space_character = spacing
    ob = bpy.data.objects.new("t", cu)
    ob.location = P(x, y, z + depth / 2)
    ob.rotation_euler.z = rot
    link(ob)
    cu.materials.append(mat_)
    return ob


def plane(x, y, w, h, mat_, z=0.0):
    me = bpy.data.meshes.new("pl")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    for v in bm.verts:
        v.co.x *= w * S
        v.co.y *= h * S
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("pl", me)
    ob.location = P(x + w / 2, y + h / 2, z)
    link(ob)
    me.materials.append(mat_)
    return ob


def ground(mat_, z=0.0, margin=600):
    """The surface everything sits on, wider than the frame."""
    return plane(-margin, -margin, W + 2 * margin, H + 2 * margin, mat_, z)


# ------------------------------------------------------------------------------------------- render


def render(path_png, samples=None):
    sc = bpy.context.scene
    if samples:
        sc.cycles.samples = samples
    sc.render.threads_mode = "FIXED"
    sc.render.threads = os.cpu_count() or 4
    sc.render.filepath = path_png
    bpy.ops.render.render(write_still=True)


def rbox(cx, cy, w, h, d, mat_, r=8.0, z=0.0, bevel=1.5, segs=3):
    """A rounded-rectangle slab (pills, buttons, trays): corner radius r in plan, bevelled edges."""
    return prism(rounded_rect(w, h, min(r, w / 2, h / 2), n=10), d, mat_, z=z, bevel=min(bevel, d / 2.1),
                 segs=segs, cx=cx, cy=cy)


def outline(cx, cy, w, h, r, t, d, mat_, z=0.0):
    """A rounded-rectangle frame t px wide (selection rings, tray rims)."""
    import bmesh as _bm
    me = bpy.data.meshes.new("ol")
    bm = _bm.new()
    o = rounded_rect(w, h, min(r, w / 2, h / 2), n=10)
    i = rounded_rect(w - 2 * t, h - 2 * t, max(0.5, min(r - t, (w - 2 * t) / 2, (h - 2 * t) / 2)), n=10)
    vo = [bm.verts.new((x * S, -y * S, 0)) for x, y in o]
    vi = [bm.verts.new((x * S, -y * S, 0)) for x, y in i]
    n = len(vo)
    for k in range(n):
        j = (k + 1) % n
        bm.faces.new((vo[k], vo[j], vi[j], vi[k]))
    ext = _bm.ops.extrude_face_region(bm, geom=bm.faces[:])
    _bm.ops.translate(bm, vec=(0, 0, d * S), verts=[e for e in ext["geom"] if isinstance(e, _bm.types.BMVert)])
    _bm.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new("ol", me)
    ob.location = P(cx, cy, z)
    link(ob)
    me.materials.append(mat_)
    return _finish(ob, min(0.6, t / 2.5, d / 2.5), 2, angle=40)


def width(ob):
    """A text or mesh object's drawn width in phone px."""
    bpy.context.view_layer.update()
    return ob.dimensions.x / S
