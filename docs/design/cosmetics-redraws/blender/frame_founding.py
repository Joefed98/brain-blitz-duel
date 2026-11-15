"""Founding frame (frame.founding): a trophy of a frame. A cast champagne-gold band swept from a bevelled profile (an
outer bead, an engraved guilloche field, a polished inner bead), four set diamonds at the corners, a crest medallion at
the top (gold rim, navy enamel, a raised gold bolt) between two gold laurel sprays, and a navy-enamel plaque at the
bottom (its words are drawn live over it: FOUNDER and the player's number). Rendered straight down in card units
(1 unit = 1 card px), the card's box at x 0..300, y 0..112 with a 10-unit margin: 960 x 396, transparent, with the
frame's own contact shadow on the card.
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

W, H, M = 300.0, 112.0, 10.0
GOLD = (1.0, 0.70, 0.29)
CHAMPAGNE = (0.95, 0.74, 0.42)
NAVY = (0.012, 0.022, 0.07)


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


# The band's profile: (across: - outside, + inside; height), and which material each segment takes.
PROFILE = [(u * 1.55, h * 1.35) for (u, h) in [(-3.6, 0.2), (-3.5, 1.4), (-3.0, 2.3), (-2.4, 2.5), (-1.9, 2.0), (-1.5, 2.15), (1.5, 2.15), (1.9, 2.0), (2.5, 2.7), (3.1, 2.3), (3.5, 1.2), (3.6, 0.2)]]
SEG_MAT = [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]  # 0 polished gold, 1 the engraved field


def band():
    path = rounded_rect_path(inset=5.6, radius=5.0)
    n = len(path)
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    rings = []
    along = 0.0
    lengths = [0.0]
    for i in range(1, n + 1):
        a, b = path[i - 1], path[i % n]
        along += math.dist(a, b)
        lengths.append(along)
    for i, (x, y) in enumerate(path):
        px, py = path[i - 1]
        nx, ny = path[(i + 1) % n]
        tx, ty = nx - px, ny - py
        l = math.hypot(tx, ty)
        tx, ty = tx / l, ty / l
        # Inward normal of a clockwise path in card coordinates (y down): (-ty, tx).
        ix, iy = -ty, tx
        ring = [bm.verts.new(card_to_world(x + ix * u, y + iy * u, h)) for (u, h) in PROFILE]
        rings.append(ring)
    for i in range(n):
        r0, r1 = rings[i], rings[(i + 1) % n]
        for k in range(len(PROFILE) - 1):
            f = bm.faces.new((r0[k], r0[k + 1], r1[k + 1], r1[k]))
            f.material_index = SEG_MAT[k]
            f.smooth = True
            for loop, (aa, kk) in zip(f.loops, ((i, k), (i, k + 1), (i + 1, k + 1), (i + 1, k))):
                loop[uv_layer].uv = (lengths[aa] / 40.0, PROFILE[kk][0] / 11.2 + 0.5)
    me = bpy.data.meshes.new("band")
    bm.to_mesh(me)
    o = bpy.data.objects.new("band", me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(gold_material("gold", 0.08))
    o.data.materials.append(engraved_material())
    return o


def gold_material(name, roughness, colour=GOLD):
    return lib.material(name, base=colour, metallic=1.0, roughness=roughness)


def engraved_material():
    """Brushed champagne gold with a guilloche engraving (two crossed wave patterns, cut into the field)."""
    m = gold_material("engraved", 0.3, CHAMPAGNE)
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    uv = nt.nodes.new("ShaderNodeTexCoord")
    w1 = nt.nodes.new("ShaderNodeTexWave")
    w1.wave_type = "BANDS"
    w1.bands_direction = "X"
    w1.inputs["Scale"].default_value = 14
    w1.inputs["Distortion"].default_value = 3.2
    w1.inputs["Detail"].default_value = 0
    w2 = nt.nodes.new("ShaderNodeTexWave")
    w2.wave_type = "BANDS"
    w2.bands_direction = "X"
    w2.inputs["Scale"].default_value = 14
    w2.inputs["Distortion"].default_value = -3.2
    w2.inputs["Detail"].default_value = 0
    mx = nt.nodes.new("ShaderNodeMath")
    mx.operation = "MAXIMUM"
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.55
    bump.inputs["Distance"].default_value = 0.05
    nt.links.new(uv.outputs["UV"], w1.inputs["Vector"])
    nt.links.new(uv.outputs["UV"], w2.inputs["Vector"])
    nt.links.new(w1.outputs["Fac"], mx.inputs[0])
    nt.links.new(w2.outputs["Fac"], mx.inputs[1])
    nt.links.new(mx.outputs[0], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


def diamond(x, y, r):
    """A brilliant-cut stone in a four-claw gold collet."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=r * 1.32, depth=2.6, location=card_to_world(x, y, 1.3))
    collet = bpy.context.object
    collet.data.materials.append(gold_material("collet", 0.14))
    bpy.ops.object.shade_smooth()
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=r, radius2=r * 0.55, depth=r * 0.55, location=card_to_world(x, y, 2.6 + r * 0.27))
    crown = bpy.context.object
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=r, radius2=0.01, depth=r * 0.9, location=card_to_world(x, y, 2.6 - r * 0.45))
    pav = bpy.context.object
    pav.rotation_euler = (math.pi, 0, 0)
    glass = lib.material("diamond", base=(0.92, 0.96, 1.0), roughness=0.0, transmission=1.0, ior=2.42)
    # A small light just above each stone, so its facets catch fire.
    l = bpy.data.lights.new("spark", "POINT")
    l.energy = 3200
    l.shadow_soft_size = 1.5
    lo = bpy.data.objects.new("spark", l)
    bpy.context.scene.collection.objects.link(lo)
    lo.location = card_to_world(x - r * 2.2, y - r * 2.2, 14)
    lo.visible_camera = False
    for o in (crown, pav):
        o.data.materials.append(glass)
    for k in range(4):
        a = math.radians(45 + 90 * k)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=r * 0.28, location=card_to_world(x + math.cos(a) * r * 0.95, y + math.sin(a) * r * 0.95, 2.9))
        bpy.context.object.data.materials.append(gold_material("claw", 0.12))
        bpy.ops.object.shade_smooth()


def bolt_mesh(cx, cy, scale, z, height):
    pts = [(-0.075, 1.0), (0.425, 1.0), (0.075, 0.2), (0.425, 0.2), (-0.325, -1.0), (-0.075, -0.1), (-0.425, -0.1)]
    bm = bmesh.new()
    vs = [bm.verts.new(card_to_world(cx + px * scale, cy - py * scale, z)) for px, py in pts]
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]:
        v.co.z += height
    bmesh.ops.bevel(bm, geom=[e for e in bm.edges], offset=0.35, segments=3, affect="EDGES")
    me = bpy.data.meshes.new("bolt")
    bm.to_mesh(me)
    o = bpy.data.objects.new("bolt", me)
    bpy.context.scene.collection.objects.link(o)
    return o


def crest(cx, cy):
    """The medallion: a gold rim, a navy enamel field, a raised gold bolt."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=17.5, depth=4.0, location=card_to_world(cx, cy, 2.0))
    rim = bpy.context.object
    bev = rim.modifiers.new("bevel", "BEVEL")
    bev.width = 0.9
    bev.segments = 4
    rim.data.materials.append(gold_material("rim", 0.13))
    bpy.ops.object.shade_smooth()
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=13.9, depth=0.6, location=card_to_world(cx, cy, 3.85))
    enamel = bpy.context.object
    enamel.data.materials.append(lib.material("enamel", base=NAVY, roughness=0.08, coat=1.0))
    bpy.ops.object.shade_smooth()
    # A fine gold ring inside the rim.
    bpy.ops.mesh.primitive_torus_add(major_radius=14.6, minor_radius=0.5, location=card_to_world(cx, cy, 4.15))
    bpy.context.object.data.materials.append(gold_material("ring", 0.1))
    bpy.ops.object.shade_smooth()
    b = bolt_mesh(cx, cy, 11.0, 4.0, 1.8)
    b.data.materials.append(gold_material("boltgold", 0.12))


def laurel(cx, cy, side):
    """A spray of gold leaves along the top band, from the crest outwards."""
    leaf_mat = gold_material("leaf", 0.2)
    for i in range(8):
        t = i / 7
        x = cx + side * (21 + t * 34)
        y = cy - 1.5 + t * 4.2
        for s in (-1, 1):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=1.0, location=card_to_world(x, y + s * (2.3 - t * 0.6), 3.0))
            o = bpy.context.object
            o.scale = (3.0 - t * 1.0, 1.15 - t * 0.25, 0.55)
            o.rotation_euler = (0, 0, math.radians(side * (s * 38) + (0 if side > 0 else 180)))
            o.data.materials.append(leaf_mat)
            bpy.ops.object.shade_smooth()
    # The stem.
    bpy.ops.curve.primitive_bezier_curve_add(location=(0, 0, 0))
    c = bpy.context.object
    sp = c.data.splines[0]
    sp.bezier_points[0].co = card_to_world(cx + side * 20, cy - 1.5, 2.7)
    sp.bezier_points[0].handle_left = card_to_world(cx + side * 10, cy - 2, 2.7)
    sp.bezier_points[0].handle_right = card_to_world(cx + side * 25, cy - 0.5, 2.7)
    sp.bezier_points[1].co = card_to_world(cx + side * 48, cy + 3, 2.7)
    sp.bezier_points[1].handle_left = card_to_world(cx + side * 38, cy + 1.5, 2.7)
    sp.bezier_points[1].handle_right = card_to_world(cx + side * 55, cy + 4, 2.7)
    c.data.bevel_depth = 0.5
    c.data.materials.append(leaf_mat)


def plaque(cx, cy):
    bpy.ops.mesh.primitive_cube_add(size=1, location=card_to_world(cx, cy, 1.6))
    p = bpy.context.object
    p.scale = (68, 12.5, 3.2)
    bpy.ops.object.transform_apply(scale=True)
    bev = p.modifiers.new("bevel", "BEVEL")
    bev.width = 1.6
    bev.segments = 4
    p.data.materials.append(gold_material("plaquegold", 0.14))
    bpy.ops.mesh.primitive_cube_add(size=1, location=card_to_world(cx, cy, 3.25))
    e = bpy.context.object
    e.scale = (62, 8.4, 0.5)
    bpy.ops.object.transform_apply(scale=True)
    bev = e.modifiers.new("bevel", "BEVEL")
    bev.width = 0.6
    e.data.materials.append(lib.material("plaqueenamel", base=NAVY, roughness=0.08, coat=1.0))


def studio():
    """Soft boxes above (their reflections shape the metal), the key from the top left."""
    lib.area_light(card_to_world(-60, -80, 160), card_to_world(150, 56, 0), 260000, 160, (1.0, 0.96, 0.9))
    lib.area_light(card_to_world(380, 40, 120), card_to_world(150, 56, 0), 70000, 120, (0.8, 0.88, 1.0))
    lib.area_light(card_to_world(150, 200, 200), card_to_world(150, 56, 0), 50000, 200, (1.0, 0.92, 0.85))
    # The studio's walls: what the metal reflects (a warm bright top, a darker floor), never seen directly.
    w = lib.world((0.0, 0.0, 0.0), 1.0)
    nt = w.node_tree
    bg = nt.nodes["Background"]
    grad = nt.nodes.new("ShaderNodeTexGradient")
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    stops = [(0.0, 0.03), (0.5, 0.04), (0.57, 3.4), (0.635, 0.14), (0.82, 0.04), (1.0, 0.2)]  # brighter (15 Nov: luminous)
    ramp.color_ramp.elements[0].position, ramp.color_ramp.elements[0].color = stops[0][0], (stops[0][1],) * 3 + (1,)
    ramp.color_ramp.elements[1].position, ramp.color_ramp.elements[1].color = stops[-1][0], (stops[-1][1],) * 3 + (1,)
    for pos, v in stops[1:-1]:
        ramp.color_ramp.elements.new(pos).color = (v * 1.05, v, v * 0.92, 1)
    nt.links.new(coord.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], bg.inputs[0])
    bg.inputs[1].default_value = 0.9
    # A shadow catcher under the frame: only the frame's shadow on the card is kept.
    bpy.ops.mesh.primitive_plane_add(size=1, location=card_to_world(150, 56, 0))
    g = bpy.context.object
    g.scale = (W + 2 * M, H + 2 * M, 1)
    g.is_shadow_catcher = True


s = lib.reset(960, 396, samples=int(os.environ.get("SAMPLES", 256)), transparent=True)
s.view_settings.look = "AgX - Base Contrast"
studio()
band()
for (x, y) in ((8, 8), (292, 8), (8, 104), (292, 104)):
    diamond(x, y, 5.4)
crest(150, 8)
laurel(150, 8, 1)
laurel(150, 8, -1)
plaque(150, 104.5)
cam = lib.camera(card_to_world(150, 56, 400), card_to_world(150, 56, 0), ortho_scale=W + 2 * M)
png = os.path.join(lib.TMP, "frame-founding.png")
secs = lib.render(png)
img = Image.open(png).convert("RGBA")
# Joe, 15 Nov 2026: the special frames glow, shine and sparkle (frames.radiate: luminous gold, star glints, an aura).
import frames as F  # noqa: E402

img = F.radiate(img, 1.0, (1.0, 0.8, 0.42), sparkles=14, protect=F.NAME_ZONE)
quality = 90
path, size = lib.save_webp(img, "frame.founding", quality=quality)
while size > 78 * 1024 and quality > 60:
    quality -= 6
    path, size = lib.save_webp(img, "frame.founding", quality=quality)
print(f"founding: {secs:.1f} s render, {size / 1024:.1f} KB -> {path}")
