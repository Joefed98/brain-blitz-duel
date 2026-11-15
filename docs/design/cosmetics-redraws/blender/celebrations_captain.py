"""The celebrations with Captain Joulz standing on the winner's drum in his win pose (Joe, 15 Nov 2026): the three
stages of the second pass (Spotlight: two stage spots through haze; Shockwave: rings of light racing over a glass floor;
Circuit Overload: a gold circuit board with a surge), each now with the 3D Captain (captain/captain.py) in place of the
flat avatar head. 720 x 450 (3x the 240 x 150 scene); the place is drawn live on the drum's front by the composer.

    python celebrations_captain.py [spotlight|shockwave|circuit …]   → public/cosmetics/redrawn/cel3.<name>.webp
"""
import math
import os
import sys
import time

import bpy
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "captain"))
import captain  # noqa: E402
import lib  # noqa: E402

SAMPLES = int(os.environ.get("SAMPLES", 128))
GOLD = (1.0, 0.74, 0.34)
NAVY = (0.012, 0.022, 0.07)
TOP = 0.59  # the drum's top


def podium():
    """A gold-rimmed navy lacquer drum with a gold top: the winner's step."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=1.0, depth=0.55, location=(0, 0, 0.275))
    d = bpy.context.object
    m = d.modifiers.new("b", "BEVEL")
    m.width, m.segments = 0.04, 4
    d.data.materials.append(lib.material("enamel", base=NAVY, roughness=0.15, coat=1.0))
    bpy.ops.object.shade_smooth()
    for z in (0.04, 0.52):
        bpy.ops.mesh.primitive_torus_add(major_radius=1.0, minor_radius=0.04, location=(0, 0, z))
        bpy.context.object.data.materials.append(lib.material("rimgold", base=GOLD, metallic=1.0, roughness=0.14))
        bpy.ops.object.shade_smooth()
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=0.98, depth=0.04, location=(0, 0, 0.57))
    bpy.context.object.data.materials.append(lib.material("topgold", base=GOLD, metallic=1.0, roughness=0.22))


def floor(material):
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, 0))
    bpy.context.object.data.materials.append(material)


def the_captain():
    # Facing the camera, a touch turned, standing on the drum's top.
    captain.build(pose="win", location=(0, 0.05, TOP), height=1.55, rotation_z=math.radians(-10))
    # His key: from the top left; a soft fill on the visor side.
    lib.area_light((-2.2, -3.0, 4.2), (0, 0, 1.4), 300, 1.6, (1.0, 0.95, 0.88))


def camera():
    lib.camera((0, -8.2, 2.35), (0, 0, 1.22), lens=62)


def spotlight(s):
    s.cycles.volume_bounces = 1
    lib.world((0.004, 0.005, 0.012), 1.0)
    floor(lib.material("stage", base=(0.02, 0.022, 0.035), roughness=0.18))
    podium()
    the_captain()
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 3))
    h = bpy.context.object
    h.scale = (14, 10, 7)
    vm = bpy.data.materials.new("haze")
    vm.use_nodes = True
    nt = vm.node_tree
    for nd in list(nt.nodes):
        nt.nodes.remove(nd)
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Density"].default_value = 0.045
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(vol.outputs[0], out.inputs["Volume"])
    h.data.materials.append(vm)
    for x in (-3.4, 3.4):
        l = bpy.data.lights.new("spot", "SPOT")
        l.energy = 5200
        l.spot_size = math.radians(20)
        l.spot_blend = 0.35
        l.color = (1.0, 0.9, 0.7)
        lo = bpy.data.objects.new("spot", l)
        bpy.context.scene.collection.objects.link(lo)
        lo.location = (x, 1.5, 6.0)
        lib.look_at(lo, (0, 0, 1.2))
    lib.area_light((0, -6, 3), (0, 0, 0.5), 40, 4, (0.6, 0.7, 1.0))
    camera()


def shockwave(s):
    lib.world((0.004, 0.006, 0.016), 1.0)
    floor(lib.material("glassfloor", base=(0.01, 0.015, 0.04), roughness=0.05, coat=1.0))
    podium()
    the_captain()
    for i, (r, e) in enumerate(((1.6, 3.6), (2.4, 2.2), (3.3, 1.3))):
        bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=0.03, location=(0, 0, 0.03))
        bpy.context.object.data.materials.append(lib.emission_material(f"ring{i}", (0.35, 0.85, 1.0), e))
    lib.area_light((-3, -4, 4), (0, 0, 0.5), 220, 3, (1, 0.96, 0.9))
    lib.area_light((3, 2, 1.5), (0, 0, 0.6), 120, 2, (0.35, 0.8, 1.0))
    camera()


def circuit_floor():
    """A dark circuit board floor with raised gold traces, a few lit."""
    rng = np.random.default_rng(9)
    floor(lib.material("pcb", base=(0.012, 0.03, 0.025), roughness=0.3, coat=0.6))
    trace = lib.material("trace", base=GOLD, metallic=1.0, roughness=0.2)
    lit = lib.emission_material("tracelit", (1.0, 0.8, 0.4), 4)
    for k in range(44):
        x, y = rng.uniform(-6, 6), rng.uniform(-1.5, 6)
        if abs(x) < 1.3 and abs(y) < 1.3:
            continue
        pts = [(x, y)]
        for _ in range(3):
            if rng.random() < 0.5:
                x += rng.choice([-1, 1]) * rng.uniform(0.6, 1.8)
            else:
                y += rng.choice([-1, 1]) * rng.uniform(0.6, 1.8)
            pts.append((x, y))
        cu = bpy.data.curves.new("tr", "CURVE")
        cu.dimensions = "3D"
        cu.bevel_depth = 0.035
        sp = cu.splines.new("POLY")
        sp.points.add(len(pts) - 1)
        for i, (px, py) in enumerate(pts):
            sp.points[i].co = (px, py, 0.02, 1)
        o = bpy.data.objects.new("tr", cu)
        bpy.context.scene.collection.objects.link(o)
        o.data.materials.append(lit if k % 3 == 0 else trace)
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.1, depth=0.04, location=(pts[-1][0], pts[-1][1], 0.03))
        bpy.context.object.data.materials.append(trace)


def circuit(s):
    lib.world((0.004, 0.006, 0.012), 1.0)
    circuit_floor()
    podium()
    the_captain()
    lib.area_light((-3, -4, 4), (0, 0, 0.5), 220, 3, (1, 0.96, 0.9))
    lib.area_light((0, 3, 2), (0, 0, 0.6), 80, 3, (1.0, 0.8, 0.45))
    # Higher than the other stages, so the board reads as a circuit; the Captain still fills the frame.
    lib.camera((0, -7.6, 4.6), (0, 0.4, 1.05), lens=60)


SCENES = {"spotlight": spotlight, "shockwave": shockwave, "circuit": circuit}
for name in sys.argv[1:] or list(SCENES):
    s = lib.reset(720, 450, samples=SAMPLES)
    SCENES[name](s)
    png = os.path.join(lib.TMP, f"cel3.{name}.png")
    secs = lib.render(png)
    img = lib.bloom(Image.open(png), threshold=0.72, radius=10, amount=0.35)
    path, size = lib.save_webp(img, f"cel3.{name}", quality=82)
    print(f"cel3.{name}: {secs:.1f} s, {size / 1024:.1f} KB")
