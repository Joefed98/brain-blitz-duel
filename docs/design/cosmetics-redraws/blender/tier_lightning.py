"""Lightning tier card art (card-art.tier.lightning): the moment of a strike. Heavy storm clouds (a volume) lit from
inside by a branching bolt in the tier's gold, the strike landing in a dark sea that mirrors it, distant flashes in
the cloud deck, rain. 900 x 336 (3x the card); the strike sits in the right third, the name side stays in the
clouds' shadow.
"""
import math
import os
import sys

import bpy
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib  # noqa: E402

RNG = np.random.default_rng(42)
TIER_GOLD = (1.0, 0.68, 0.18)
CORE = (1.0, 0.9, 0.62)


def bolt_path(a, b, depth, rough):
    """Midpoint displacement between two 3D points: a jagged channel."""
    pts = [np.array(a, float), np.array(b, float)]
    for _ in range(depth):
        out = [pts[0]]
        for p, q in zip(pts, pts[1:]):
            mid = (p + q) / 2
            L = np.linalg.norm(q - p)
            mid = mid + RNG.normal(0, rough * L, 3) * np.array([1, 0.35, 0.25])
            out += [mid, q]
        pts = out
    return pts


def channel(pts, radius, strength, name):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 2
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        taper = 1.0 - 0.6 * i / len(pts)
        sp.points[i].co = (*p, 1)
        sp.points[i].radius = taper
    o = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(lib.emission_material(name + "m", CORE, strength))
    # A glow sheath round the core in the tier's gold.
    cu2 = cu.copy()
    cu2.bevel_depth = radius * 3.2
    o2 = bpy.data.objects.new(name + "g", cu2)
    bpy.context.scene.collection.objects.link(o2)
    m = bpy.data.materials.new(name + "glow")
    m.use_nodes = True
    nt = m.node_tree
    for nd in list(nt.nodes):
        nt.nodes.remove(nd)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs[0].default_value = (*TIER_GOLD, 1)
    em.inputs[1].default_value = strength * 0.18
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    mix.inputs[0].default_value = 0.5
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0])
    o2.data.materials.append(m)
    # Light it casts (a few points along the channel).
    for p in pts[:: max(1, len(pts) // 5)][:-1]:
        l = bpy.data.lights.new(name + "L", "POINT")
        l.energy = strength * 13
        l.color = TIER_GOLD
        l.shadow_soft_size = 0.4
        lo = bpy.data.objects.new(name + "L", l)
        bpy.context.scene.collection.objects.link(lo)
        lo.location = p
    return pts


def strike():
    main = bolt_path((2.7, 3.4, 2.1), (2.2, 2.4, -1.02), 7, 0.2)
    channel(main, 0.009, 60, "main")
    for k, i in enumerate((12, 30, 46, 70, 90)):
        if i >= len(main):
            continue
        start = main[i]
        end = start + np.array([RNG.uniform(-1.2, 1.2), RNG.uniform(-0.3, 0.3), -RNG.uniform(0.5, 1.4)])
        channel(bolt_path(start, end, 5, 0.25), 0.0045, 30, f"branch{k}")
    # Cloud-to-cloud forks spreading through the cloud base from the strike.
    for k, (dx, dz) in enumerate(((-1.9, 0.15), (1.3, 0.1), (-1.0, 0.35))):
        a = main[4]
        channel(bolt_path(a, a + np.array([dx, 0.3, dz]), 5, 0.22), 0.005, 22, f"fork{k}")


def clouds():
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 5.0, 2.45))
    o = bpy.context.object
    o.scale = (18, 8, 2.4)
    m = bpy.data.materials.new("cloud")
    m.use_nodes = True
    nt = m.node_tree
    for nd in list(nt.nodes):
        nt.nodes.remove(nd)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (0.14, 0.17, 0.27, 1)
    vol.inputs["Anisotropy"].default_value = 0.3
    tc = nt.nodes.new("ShaderNodeTexCoord")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (18, 8, 2.4)  # undo the box's stretch, so billows are round
    noise.inputs["Scale"].default_value = 0.55
    noise.inputs["Detail"].default_value = 12
    noise.inputs["Distortion"].default_value = 0.6
    noise.inputs["Roughness"].default_value = 0.6
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    # Thicker towards the top, a ragged base.
    base = nt.nodes.new("ShaderNodeMapRange")
    base.inputs["From Min"].default_value = -0.5
    base.inputs["From Max"].default_value = 0.1
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.46
    ramp.color_ramp.elements[1].position = 0.6
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    dens = nt.nodes.new("ShaderNodeMath")
    dens.operation = "MULTIPLY"
    dens.inputs[1].default_value = 7.0
    nt.links.new(tc.outputs["Object"], mp.inputs[0])
    nt.links.new(mp.outputs[0], noise.inputs["Vector"])
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], base.inputs["Value"])
    nt.links.new(noise.outputs["Fac"], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], mul.inputs[0])
    nt.links.new(base.outputs[0], mul.inputs[1])
    nt.links.new(mul.outputs[0], dens.inputs[0])
    nt.links.new(dens.outputs[0], vol.inputs["Density"])
    nt.links.new(vol.outputs[0], out.inputs["Volume"])
    o.data.materials.append(m)


def sea():
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 10, -1.05))
    o = bpy.context.object
    m = lib.material("sea", base=(0.004, 0.006, 0.012), roughness=0.06, coat=0.0)
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Specular IOR Level"].default_value = 0.9
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1.0, 4.0, 1.0)
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 6
    noise.inputs["Detail"].default_value = 6
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.35
    nt.links.new(tc.outputs["Object"], mp.inputs[0])
    nt.links.new(mp.outputs[0], noise.inputs[0])
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    o.data.materials.append(m)


def flashes():
    """Distant lightning inside the cloud deck (lights only: the cloud glows where they are)."""
    for x, y, z, e in ((-3.2, 7, 2.9, 220), (0.4, 9, 3.1, 160), (-1.2, 5.5, 2.7, 80)):
        l = bpy.data.lights.new("flash", "POINT")
        l.energy = e
        l.color = (0.85, 0.82, 1.0)
        l.shadow_soft_size = 1.2
        lo = bpy.data.objects.new("flash", l)
        bpy.context.scene.collection.objects.link(lo)
        lo.location = (x, y, z)


def rain():
    """Thin falling streaks in front of the strike, lit by it."""
    mat = lib.material("rain", base=(0.8, 0.8, 0.9), roughness=0.2, transmission=0.6, alpha=0.18)
    for _ in range(46):
        x, y, z = RNG.uniform(0.8, 4.4), RNG.uniform(-0.5, 2.0), RNG.uniform(-0.9, 1.4)
        bpy.ops.mesh.primitive_cylinder_add(vertices=4, radius=0.0022, depth=0.16, location=(x, y, z))
        o = bpy.context.object
        o.rotation_euler = (0, math.radians(8), 0)
        o.data.materials.append(mat)


s = lib.reset(900, 336, samples=int(os.environ.get("SAMPLES", 160)))
s.cycles.volume_bounces = 2
lib.world((0.012, 0.014, 0.03), 1.0)
clouds()
sea()
strike()
flashes()
rain()
lib.camera((0, -6.5, -0.45), (0.6, 3.0, 0.75), lens=30, dof_target=(2.3, 2.6, 0.5), fstop=5.6)
png = os.path.join(lib.TMP, "tier-lightning.png")
secs = lib.render(png)
img = lib.split_tone(lib.bloom(Image.open(png), threshold=0.7, radius=18, amount=0.45), amount=0.46)
path, size = lib.save_webp(img, "card-art.tier.lightning")
print(f"lightning: {secs:.1f} s render, {size / 1024:.1f} KB -> {path}")
