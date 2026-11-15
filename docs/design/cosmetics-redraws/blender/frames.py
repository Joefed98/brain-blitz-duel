"""Shared pieces for the redrawn frames (docs/design/cosmetics-redraws/ART-DIRECTION.md, "Frames"): a band swept
from a bevelled profile round the card, metals, engraving, enamel, set stones, crests, the studio and the render.
frame_founding.py keeps its own copies (its render is approved as it is); frame_set.py builds every other frame
from these.

Card units: 1 unit = 1 card px, the card's box x 0..300, y 0..112 (y down), rendered straight down at 960 x 396
with a 10-unit margin, transparent, with the frame's own contact shadow on the card (a shadow catcher).
"""
import math
import os

import bpy
import bmesh  # noqa: E402 (available once bpy is loaded)
from PIL import Image

import lib

W, H, M = 300.0, 112.0, 10.0

METALS = {
    "gold": (1.0, 0.74, 0.34),
    "dark-gold": (0.86, 0.56, 0.22),
    "champagne": (0.95, 0.74, 0.42),
    "platinum": (0.86, 0.88, 0.92),
    "silver": (0.95, 0.96, 0.98),
    "bronze": (0.82, 0.48, 0.26),
    "copper": (0.95, 0.52, 0.34),
    "black": (0.02, 0.02, 0.025),
}


def card_to_world(x, y, z=0.0):
    return (x, -y, z)


def rounded_rect_path(inset, radius, per_corner=24, per_side=60):
    """Points (x, y) clockwise along a rounded rectangle inset from the card's box."""
    pts = []
    x0, y0, x1, y1 = inset, inset, W - inset, H - inset
    corners = [(x1 - radius, y0 + radius, -90), (x1 - radius, y1 - radius, 0), (x0 + radius, y1 - radius, 90), (x0 + radius, y0 + radius, 180)]
    for (cx, cy, a0), nxt in zip(corners, corners[1:] + corners[:1]):
        for i in range(per_corner):
            a = math.radians(a0 + 90 * i / per_corner)
            pts.append((cx + radius * math.cos(a), cy + radius * math.sin(a)))
        a = math.radians(a0 + 90)
        sx, sy = cx + radius * math.cos(a), cy + radius * math.sin(a)
        nx, ny, na = nxt[0], nxt[1], math.radians(nxt[2])
        ex, ey = nx + radius * math.cos(na), ny + radius * math.sin(na)
        for i in range(per_side):
            t = i / per_side
            pts.append((sx + (ex - sx) * t, sy + (ey - sy) * t))
    return pts


def metal(name, colour, roughness):
    return lib.material(name, base=colour, metallic=1.0, roughness=roughness)


def enamel(name, colour, roughness=0.06):
    return lib.material(name, base=colour, roughness=roughness, coat=1.0)


def engraved(name, colour, pattern="guilloche", roughness=0.3, strength=0.55):
    """A metal field cut with an engraving: guilloche (two crossed waves), scroll (filigree-like rings along the band),
    lines (fine parallel cuts) or none."""
    m = metal(name, colour, roughness)
    if pattern == "none":
        return m
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    uv = nt.nodes.new("ShaderNodeTexCoord")
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = 0.05
    if pattern == "guilloche":
        w1 = nt.nodes.new("ShaderNodeTexWave")
        w1.bands_direction = "X"
        w1.inputs["Scale"].default_value = 14
        w1.inputs["Distortion"].default_value = 3.2
        w1.inputs["Detail"].default_value = 0
        w2 = nt.nodes.new("ShaderNodeTexWave")
        w2.bands_direction = "X"
        w2.inputs["Scale"].default_value = 14
        w2.inputs["Distortion"].default_value = -3.2
        w2.inputs["Detail"].default_value = 0
        mx = nt.nodes.new("ShaderNodeMath")
        mx.operation = "MAXIMUM"
        nt.links.new(uv.outputs["UV"], w1.inputs["Vector"])
        nt.links.new(uv.outputs["UV"], w2.inputs["Vector"])
        nt.links.new(w1.outputs["Fac"], mx.inputs[0])
        nt.links.new(w2.outputs["Fac"], mx.inputs[1])
        nt.links.new(mx.outputs[0], bump.inputs["Height"])
    elif pattern == "scroll":
        w = nt.nodes.new("ShaderNodeTexWave")
        w.wave_type = "RINGS"
        w.inputs["Scale"].default_value = 9
        w.inputs["Distortion"].default_value = 6
        w.inputs["Detail"].default_value = 1.5
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (3.0, 1.0, 1.0)
        nt.links.new(uv.outputs["UV"], mp.inputs[0])
        nt.links.new(mp.outputs[0], w.inputs["Vector"])
        nt.links.new(w.outputs["Fac"], bump.inputs["Height"])
    else:  # lines
        w = nt.nodes.new("ShaderNodeTexWave")
        w.bands_direction = "Y"
        w.inputs["Scale"].default_value = 30
        nt.links.new(uv.outputs["UV"], w.inputs["Vector"])
        nt.links.new(w.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


# A profile: (across: - outside, + inside; height; material index), one entry per vertex; a segment takes the
# material of its first vertex. 0 polished metal, 1 the engraved field, 2 an inlay (enamel or a second metal).
BASE_PROFILE = [(-3.6, 0.2, 0), (-3.5, 1.4, 0), (-3.0, 2.3, 0), (-2.4, 2.5, 0), (-1.9, 2.0, 0), (-1.5, 2.15, 1), (1.5, 2.15, 0), (1.9, 2.0, 0), (2.5, 2.7, 0), (3.1, 2.3, 0), (3.5, 1.2, 0), (3.6, 0.2, 0)]
INLAY_PROFILE = [(-3.6, 0.2, 0), (-3.5, 1.4, 0), (-3.0, 2.3, 0), (-2.4, 2.5, 0), (-1.9, 2.0, 0), (-1.6, 2.15, 1), (-0.9, 2.15, 0), (-0.75, 1.75, 2), (0.75, 1.75, 0), (0.9, 2.15, 1), (1.6, 2.15, 0), (1.9, 2.0, 0), (2.5, 2.7, 0), (3.1, 2.3, 0), (3.5, 1.2, 0), (3.6, 0.2, 0)]
PLAIN_PROFILE = [(-3.6, 0.2, 0), (-3.4, 1.6, 0), (-2.6, 2.4, 0), (2.6, 2.4, 0), (3.4, 1.6, 0), (3.6, 0.2, 0)]


def band(name, mats, profile=BASE_PROFILE, scale=(1.55, 1.35), inset=5.6, radius=5.0, z0=0.0):
    """A band swept along a rounded rectangle; `mats` are the materials for indices 0, 1, 2."""
    prof = [(u * scale[0], h * scale[1] + z0, k) for (u, h, k) in profile]
    span = prof[-1][0] - prof[0][0]
    path = rounded_rect_path(inset=inset, radius=radius)
    n = len(path)
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    lengths = [0.0]
    for i in range(1, n + 1):
        lengths.append(lengths[-1] + math.dist(path[i - 1], path[i % n]))
    rings = []
    for i, (x, y) in enumerate(path):
        px, py = path[i - 1]
        nx, ny = path[(i + 1) % n]
        tx, ty = nx - px, ny - py
        l = math.hypot(tx, ty)
        ix, iy = -ty / l, tx / l
        rings.append([bm.verts.new(card_to_world(x + ix * u, y + iy * u, h)) for (u, h, _) in prof])
    for i in range(n):
        r0, r1 = rings[i], rings[(i + 1) % n]
        for k in range(len(prof) - 1):
            f = bm.faces.new((r0[k], r0[k + 1], r1[k + 1], r1[k]))
            f.material_index = prof[k][2]
            f.smooth = True
            for loop, (aa, kk) in zip(f.loops, ((i, k), (i, k + 1), (i + 1, k + 1), (i + 1, k))):
                loop[uv_layer].uv = (lengths[aa] / 40.0, (prof[kk][0] - prof[0][0]) / span)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    for m in mats:
        o.data.materials.append(m)
    return o


def point_light(x, y, z, energy, colour=(1, 1, 1), size=1.5):
    l = bpy.data.lights.new("spark", "POINT")
    l.energy = energy
    l.color = colour
    l.shadow_soft_size = size
    lo = bpy.data.objects.new("spark", l)
    bpy.context.scene.collection.objects.link(lo)
    lo.location = card_to_world(x, y, z)
    lo.visible_camera = False
    return lo


def stone(x, y, r, colour, setting, z=2.6, ior=1.77, cut="brilliant", claws=4, spark=1400):
    """A cut stone (brilliant or cabochon) in a collet of `setting` metal with claws, lit by a small light above."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=r * 1.3, depth=z, location=card_to_world(x, y, z / 2))
    c = bpy.context.object
    bev = c.modifiers.new("bevel", "BEVEL")
    bev.width = r * 0.18
    bev.segments = 3
    c.data.materials.append(setting)
    bpy.ops.object.shade_smooth()
    gem = lib.material("gem", base=colour, roughness=0.0, transmission=1.0, ior=ior)
    if cut == "cabochon":
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=r, location=card_to_world(x, y, z))
        o = bpy.context.object
        o.scale = (1, 1, 0.62)
        o.data.materials.append(lib.material("cab", base=colour, roughness=0.04, coat=1.0, transmission=0.35, ior=ior))
        bpy.ops.object.shade_smooth()
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=r, radius2=r * 0.55, depth=r * 0.55, location=card_to_world(x, y, z + r * 0.27))
        bpy.context.object.data.materials.append(gem)
        bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=r, radius2=0.01, depth=r * 0.9, location=card_to_world(x, y, z - r * 0.45))
        p = bpy.context.object
        p.rotation_euler = (math.pi, 0, 0)
        p.data.materials.append(gem)
    for k in range(claws):
        a = math.radians(45 + 360 / claws * k)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=r * 0.27, location=card_to_world(x + math.cos(a) * r * 0.96, y + math.sin(a) * r * 0.96, z + 0.3))
        bpy.context.object.data.materials.append(setting)
        bpy.ops.object.shade_smooth()
    if spark:
        point_light(x - r * 2.2, y - r * 2.2, 14, spark)


def disc(x, y, r, depth, mat, z=0.0, bevel=0.6, vertices=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=r, depth=depth, location=card_to_world(x, y, z + depth / 2))
    o = bpy.context.object
    if bevel:
        b = o.modifiers.new("bevel", "BEVEL")
        b.width = bevel
        b.segments = 4
    o.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return o


def ring(x, y, R, r, mat, z):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=96, minor_segments=16, location=card_to_world(x, y, z))
    bpy.context.object.data.materials.append(mat)
    bpy.ops.object.shade_smooth()


def poly_relief(pts, cx, cy, scale, z, height, mat, bevel=0.35, name="relief"):
    """A flat shape (points in -1..1, y up) raised from z by height, bevelled."""
    bm = bmesh.new()
    vs = [bm.verts.new(card_to_world(cx + px * scale, cy - py * scale, z)) for px, py in pts]
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]:
        v.co.z += height
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=3, affect="EDGES")
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(mat)
    return o


def leaf_spray(cx, cy, side, mat, count=8, length=30, start=18, size=1.0, rise=4.2):
    """A spray of leaves along the top band, from a crest outwards (laurels)."""
    for i in range(count):
        t = i / max(1, count - 1)
        x = cx + side * (start + t * length)
        y = cy - 1.5 + t * rise
        for s in (-1, 1):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=1.0, location=card_to_world(x, y + s * (2.3 - t * 0.6) * size, 3.0))
            o = bpy.context.object
            o.scale = ((3.0 - t * 1.0) * size, (1.15 - t * 0.25) * size, 0.55 * size)
            o.rotation_euler = (0, 0, math.radians(side * (s * 38) + (0 if side > 0 else 180)))
            o.data.materials.append(mat)
            bpy.ops.object.shade_smooth()


def plaque(cx, cy, w, h, rim, field):
    bpy.ops.mesh.primitive_cube_add(size=1, location=card_to_world(cx, cy, 1.6))
    p = bpy.context.object
    p.scale = (w, h, 3.2)
    bpy.ops.object.transform_apply(scale=True)
    b = p.modifiers.new("bevel", "BEVEL")
    b.width = 1.4
    b.segments = 4
    p.data.materials.append(rim)
    bpy.ops.mesh.primitive_cube_add(size=1, location=card_to_world(cx, cy, 3.25))
    e = bpy.context.object
    e.scale = (w - 6, h - 4, 0.5)
    bpy.ops.object.transform_apply(scale=True)
    b = e.modifiers.new("bevel", "BEVEL")
    b.width = 0.6
    e.data.materials.append(field)


def studio(horizon=2.6, zenith=0.34, warm=True):
    """Soft boxes above and a dark sky with a bright horizon band (the metal's contrast), and a shadow catcher."""
    lib.area_light(card_to_world(-60, -80, 160), card_to_world(150, 56, 0), 260000, 160, (1.0, 0.96, 0.9) if warm else (0.95, 0.97, 1.0))
    lib.area_light(card_to_world(380, 40, 120), card_to_world(150, 56, 0), 70000, 120, (0.8, 0.88, 1.0))
    lib.area_light(card_to_world(150, 200, 200), card_to_world(150, 56, 0), 50000, 200, (1.0, 0.92, 0.85))
    w = lib.world((0.0, 0.0, 0.0), 1.0)
    nt = w.node_tree
    bg = nt.nodes["Background"]
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    stops = [(0.0, 0.03), (0.5, 0.04), (0.57, horizon), (0.64, 0.14), (0.82, 0.05), (1.0, zenith)]
    ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[0].color = stops[0][0], (stops[0][1],) * 3 + (1,)
    ramp.color_ramp.elements[1].position, ramp.color_ramp.elements[1].color = stops[-1][0], (stops[-1][1],) * 3 + (1,)
    for pos, v in stops[1:-1]:
        ramp.color_ramp.elements.new(pos).color = ((v * 1.05, v, v * 0.92) if warm else (v, v, v * 1.05)) + (1,)
    nt.links.new(coord.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], bg.inputs[0])
    bg.inputs[1].default_value = 0.9
    bpy.ops.mesh.primitive_plane_add(size=1, location=card_to_world(150, 56, 0))
    g = bpy.context.object
    g.scale = (W + 2 * M, H + 2 * M, 1)
    g.is_shadow_catcher = True


def begin(samples=None):
    s = lib.reset(960, 396, samples=samples or int(os.environ.get("SAMPLES", 256)), transparent=True)
    s.view_settings.look = "AgX - Base Contrast"
    return s


def finish(item_id, quality=90):
    lib.camera(card_to_world(150, 56, 400), card_to_world(150, 56, 0), ortho_scale=W + 2 * M)
    png = os.path.join(lib.TMP, f"{item_id}.png")
    secs = lib.render(png)
    img = Image.open(png).convert("RGBA")
    path, size = lib.save_webp(img, item_id, quality=quality)
    while size > 78 * 1024 and quality > 60:
        quality -= 6
        path, size = lib.save_webp(img, item_id, quality=quality)
    print(f"{item_id}: {secs:.1f} s render, {size / 1024:.1f} KB (q{quality})")
    return secs, size
