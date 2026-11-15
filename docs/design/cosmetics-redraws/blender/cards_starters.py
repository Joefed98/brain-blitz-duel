"""The everyday card arts: the free starters and Static. Calm and clean, one material done well, in the Joulz navy,
black and champagne gold; a soft key light from the top left and a little depth of field.

  joulz-navy    navy lacquer with a bolt inlaid in champagne gold, lit like a car's paint
  bolt-stripes  navy lacquer with fine champagne inlay stripes running on the diagonal, a small bolt at the end
  grid          a floor of navy glass tiles with champagne seams, seen low
  waves         navy satin in long slow waves, champagne light along the crests
  hexes         navy enamel hexagons at slightly different heights, champagne rims
  dots          champagne studs on navy, a halftone from small (under the name) to large (right)
  static        dark carbon with fine cyan discharges crackling across it (the Neon Circuit pass)

    python cards_starters.py [names…]
"""
import math
import os
import sys

import bpy
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import card_lib as C  # noqa: E402
import lib  # noqa: E402

LACQUER = lambda name: lib.material(name, base=C.NAVY, roughness=0.12, coat=1.0)  # noqa: E731
CHAMP = lambda name, r=0.22: C.metal(name, C.CHAMPAGNE, r)  # noqa: E731
LOW = dict(location=(0, -6.2, 1.6), target=(0.4, 1.0, -0.8), lens=36)


def studio(key=260, rim=60):
    """A soft studio. The lights shape the forms; the lacquer and metal reflect two large softboxes (emissive panels
    with feathered edges, unseen by the camera), so highlights are long soft gradients, never hard rectangles."""
    lib.world((0.003, 0.005, 0.012), 1.0)
    for loc, rot, size, e, col in (
        ((9.0, 16.0, 4.5), (math.radians(75), 0, math.radians(18)), (16, 5), 7.0, (1.0, 0.9, 0.76)),
        ((14.0, 6.0, 2.0), (math.radians(75), 0, math.radians(55)), (8, 3), 2.5, (0.7, 0.8, 1.0)),
    ):
        bpy.ops.mesh.primitive_plane_add(size=1, location=loc)
        o = bpy.context.object
        o.scale = (*size, 1)
        o.rotation_euler = rot
        o.visible_camera = False
        o.visible_shadow = False
        m = bpy.data.materials.new("softbox")
        m.use_nodes = True
        nt = m.node_tree
        for n in list(nt.nodes):
            nt.nodes.remove(n)
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        em = nt.nodes.new("ShaderNodeEmission")
        em.inputs[0].default_value = (*col, 1)
        tc = nt.nodes.new("ShaderNodeTexCoord")
        g = nt.nodes.new("ShaderNodeTexGradient")
        g.gradient_type = "QUADRATIC_SPHERE"
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Location"].default_value = (-1.0, -1.0, 0)
        mp.inputs["Scale"].default_value = (2, 2, 1)
        nt.links.new(tc.outputs["Generated"], mp.inputs[0])
        nt.links.new(mp.outputs[0], g.inputs[0])
        mul = nt.nodes.new("ShaderNodeMath")
        mul.operation = "MULTIPLY"
        mul.inputs[1].default_value = e
        nt.links.new(g.outputs["Fac"], mul.inputs[0])
        nt.links.new(mul.outputs[0], em.inputs[1])
        nt.links.new(em.outputs[0], out.inputs[0])
        o.data.materials.append(m)
    lib.area_light((-4, -3, 4), (1.5, 1.5, -0.8), key * 1.2, 6, (1.0, 0.94, 0.86)).visible_glossy = False
    lib.area_light((5, 6, 2), (1.5, 1.5, -0.8), rim * 0.6, 4, (0.7, 0.8, 1.0)).visible_glossy = False


def panel(mat, z=-1.0):
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 8, z))
    return C.mat_of(bpy.context.object, mat)


def bolt_obj(loc, s, height, mat, rot=0.0):
    import bmesh

    pts = [(-0.075, 1.0), (0.425, 1.0), (0.075, 0.2), (0.425, 0.2), (-0.325, -1.0), (-0.075, -0.1), (-0.425, -0.1)]
    bm = bmesh.new()
    vs = [bm.verts.new((px * s, py * s, 0)) for px, py in pts]
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]:
        v.co.z += height
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=height * 0.4, segments=3, affect="EDGES")
    me = bpy.data.meshes.new("bolt")
    bm.to_mesh(me)
    o = bpy.data.objects.new("bolt", me)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (0, 0, rot)
    o.data.materials.append(mat)
    return o


def joulz_navy():
    studio()
    panel(LACQUER("lacq"))
    bolt_obj((3.05, 1.3, -1.0), 1.35, 0.09, CHAMP("champ", 0.16), rot=math.radians(8))


def bolt_stripes():
    studio()
    panel(LACQUER("lacq"))
    ch = CHAMP("champ", 0.2)
    for k in range(-6, 9):
        x0 = k * 0.62
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x0 + 1.0, 2.0, -0.99))
        o = bpy.context.object
        o.scale = (0.05, 9.0, 0.02)
        o.rotation_euler = (0, 0, math.radians(-38))
        o.data.materials.append(ch)
    bolt_obj((3.0, 0.4, -1.0), 0.32, 0.04, ch)


def grid():
    studio(320, 80)
    panel(CHAMP("under", 0.35), -1.04)
    tile = lib.material("tile", base=(0.015, 0.03, 0.09), roughness=0.08, transmission=0.0, coat=1.0)
    for i in range(-12, 16):
        for j in range(-4, 16):
            bpy.ops.mesh.primitive_cube_add(size=1, location=(i * 0.5, j * 0.5, -1.0))
            o = bpy.context.object
            o.scale = (0.46, 0.46, 0.08)
            bv = o.modifiers.new("b", "BEVEL")
            bv.width = 0.02
            bv.segments = 2
            o.data.materials.append(tile)


def waves():
    studio(220, 70)
    satin = lib.material("satin", base=(0.01, 0.018, 0.06), roughness=0.3, coat=0.3)
    C.heightfield("satin", 260, 140, 14, 8, lambda X, Y: 0.22 * np.sin(X * 1.3 + Y * 0.5 + 0.4 * np.sin(Y * 0.9)) + 0.05 * C.fbm2(X, Y, 9, 3, 1.0), (0, 3, -1.0), satin)


def hexes():
    studio(280, 70)
    rng = np.random.default_rng(41)
    enamel = lib.material("enamel", base=C.NAVY, roughness=0.1, coat=1.0)
    rim = CHAMP("rim", 0.18)
    r = 0.3
    for i in range(-10, 14):
        for j in range(-3, 16):
            x = i * r * 1.75 + (j % 2) * r * 0.875
            y = j * r * 1.52
            h = 0.06 + 0.07 * rng.random() * np.clip((x + 1) / 4, 0, 1)
            bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=r * 0.96, depth=h, location=(x, y, -1.0 + h / 2))
            o = bpy.context.object
            o.rotation_euler = (0, 0, math.radians(30))
            bv = o.modifiers.new("b", "BEVEL")
            bv.width = 0.015
            o.data.materials.append(enamel)
            bpy.ops.mesh.primitive_torus_add(major_radius=r * 0.9, minor_radius=0.012, major_segments=6, minor_segments=6, location=(x, y, -1.0 + h + 0.004))
            t = bpy.context.object
            t.rotation_euler = (0, 0, math.radians(30))
            t.data.materials.append(rim)
    panel(lib.material("gap", base=(0.01, 0.01, 0.02), roughness=0.6), -1.001)


def dots():
    studio(260, 70)
    panel(LACQUER("lacq"))
    ch = CHAMP("stud", 0.16)
    for i in range(-16, 18):
        for j in range(-5, 18):
            x, y = i * 0.3 + (j % 2) * 0.15, j * 0.26
            size = 0.02 + 0.11 * np.clip((x + 1.5) / 5.0, 0, 1) ** 1.5
            if size < 0.025:
                continue
            bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=size, location=(x, y, -1.0))
            o = bpy.context.object
            o.scale = (1, 1, 0.45)
            o.data.materials.append(ch)
            bpy.ops.object.shade_smooth()


def static():
    rng = np.random.default_rng(43)
    studio(140, 40)
    carbon = lib.material("carbon", base=(0.02, 0.022, 0.03), roughness=0.3, coat=1.0)
    nt = carbon.node_tree
    tc = nt.nodes.new("ShaderNodeTexCoord")
    ch = nt.nodes.new("ShaderNodeTexChecker")
    ch.inputs["Scale"].default_value = 60
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.25
    nt.links.new(tc.outputs["Object"], ch.inputs["Vector"])
    nt.links.new(ch.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], nt.nodes["Principled BSDF"].inputs["Normal"])
    panel(carbon)
    for k in range(7):
        a = np.array([rng.uniform(2.4, 3.8), rng.uniform(0.0, 3.0), -0.98])
        b = a + np.array([rng.uniform(-0.9, 0.5), rng.uniform(-0.8, 0.8), 0])
        C.arc(C.path(rng, a, b, 7, 0.3, (1, 1, 0)), 0.0022, (0.85, 1.0, 1.0), (0.13, 0.85, 1.0), 12 if k < 3 else 6, 0, f"s{k}")


# Static is now rendered by cards_redo.py (Joe, 15 Nov 2026: keep the idea, TV static).
SCENES = {
    "joulz-navy": (joulz_navy, dict(location=(0.4, -4.4, 1.3), target=(1.2, 1.0, -0.9), lens=36, dof_target=(2.35, 0.9, -1.0), fstop=4.0)),
    "bolt-stripes": (bolt_stripes, dict(LOW, dof_target=(2.4, 1.2, -1.0), fstop=4.0)),
    "grid": (grid, dict(location=(0, -5.5, 0.6), target=(0.6, 2.0, -1.0), lens=34, dof_target=(2.2, 1.5, -1.0), fstop=3.2)),
    "waves": (waves, dict(location=(0, -6.0, 0.9), target=(0.4, 2.5, -1.0), lens=36, dof_target=(2.0, 2.0, -1.0), fstop=4.0)),
    "hexes": (hexes, dict(location=(0, -5.5, 1.0), target=(0.6, 2.0, -1.0), lens=36, dof_target=(2.2, 1.6, -1.0), fstop=3.6)),
    "dots": (dots, dict(LOW, dof_target=(2.4, 1.2, -1.0), fstop=4.0)),
}

for name in sys.argv[1:] or list(SCENES):
    build, cam = SCENES[name]
    C.run(f"card-art.{name}", build, cam, samples=128, bloom=(0.7, 12, 0.35), tone=None)
