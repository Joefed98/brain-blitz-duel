"""Curl Champ's rendered materials (the Sports overhaul, phase 2 step 4; concept A): polished granite stones with gold
and red handles, and the arena behind the far boards (tiered stands packed with a lit crowd, the roof's lights).
Rendered in Blender (Cycles) to public/sports/curling/ as WebP; the renderer (src/lib/arcade/curling.renderer.ts)
draws them over its own painted art once loaded. Display only.

    python render_curling.py [stones] [arena] [--samples=N]      (bpy in a venv outside the project folder)

The stones are seen 12.7° above the ice: every stone the game draws has its top face at ry = 0.22 rx (the renderer's
clamp, and the camera's own angle on curlRev 2–4's sheet), so one view fits every depth. Each stone image is framed so
its granite body spans exactly the image's middle 2R across (STONE_FRAME below), its contact line at a known row.
"""
import math
import os
import random
import sys

import bpy
from mathutils import Vector
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
BLENDER = os.path.abspath(os.path.join(HERE, "../../cosmetics-redraws/blender"))
sys.path.insert(0, BLENDER)
import lib  # noqa: E402

REPO = os.path.abspath(os.path.join(HERE, "../../../.."))
OUT = os.path.join(REPO, "public/sports/curling")
TMP = os.environ.get("RENDER_TMP", "/tmp")
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
OPT = dict(a[2:].split("=", 1) if "=" in a else (a[2:], "1") for a in sys.argv[1:] if a.startswith("--"))
SAMPLES = int(OPT.get("samples", 64))

# Stone: radius 1 (14.5 cm), body height 0.76 (11 cm), seen 12.7° above the ice.
ELEV = math.radians(12.7)
# The frame: 2.6 radii across, so the body spans the middle 2/2.6 of the width; 256 px wide.
STONE_W, STONE_H = 256, 256
ORTHO = 2.6


def granite():
    m = bpy.data.materials.new("granite")
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Metallic"].default_value = 0.0
    b.inputs["Roughness"].default_value = 0.16
    b.inputs["Coat Weight"].default_value = 0.6
    b.inputs["Coat Roughness"].default_value = 0.05
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 60.0
    noise.inputs["Detail"].default_value = 6.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    el = ramp.color_ramp.elements
    el[0].position, el[0].color = 0.38, (0.08, 0.085, 0.095, 1)
    el[1].position, el[1].color = 0.62, (0.42, 0.43, 0.46, 1)
    el.new(0.5).color = (0.2, 0.205, 0.22, 1)
    el.new(0.7).color = (0.7, 0.71, 0.73, 1)
    nt.links.new(noise.outputs["Fac"], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], b.inputs["Base Color"])
    return m


def build_stone(handle_rgb):
    """The stone: a rounded granite body, a darker unpolished striking band, a satin top cup and the handle."""
    g = granite()
    band = lib.material("band", base=(0.09, 0.09, 0.1), roughness=0.55)
    handle = lib.material("handle", base=handle_rgb, roughness=0.2, coat=1.0)
    bolt = lib.material("bolt", base=(0.7, 0.7, 0.72), metallic=1.0, roughness=0.2)
    bpy.ops.mesh.primitive_cylinder_add(radius=1.0, depth=0.76, location=(0, 0, 0.38), vertices=96)
    body = bpy.context.object
    bev = body.modifiers.new("b", "BEVEL")
    bev.width = 0.2
    bev.segments = 8
    bpy.ops.object.shade_smooth()
    body.data.materials.append(g)
    # The striking band round the middle.
    bpy.ops.mesh.primitive_cylinder_add(radius=1.003, depth=0.12, location=(0, 0, 0.36), vertices=96)
    bpy.context.object.data.materials.append(band)
    bpy.ops.object.shade_smooth()
    # The handle: a low pillar at the centre and a curved bar reaching to one side (towards +x, the thrower's grip).
    bpy.ops.mesh.primitive_cylinder_add(radius=0.2, depth=0.14, location=(0, 0, 0.82), vertices=48)
    bpy.context.object.data.materials.append(handle)
    bpy.ops.object.shade_smooth()
    curve = bpy.data.curves.new("bar", "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = 0.085
    curve.bevel_resolution = 6
    sp = curve.splines.new("BEZIER")
    sp.bezier_points.add(2)
    pts = [(-0.1, 0, 0.86), (0.3, 0, 1.02), (0.78, 0, 0.92)]
    for bp, co in zip(sp.bezier_points, pts):
        bp.co = co
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    o = bpy.data.objects.new("bar", curve)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(handle)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.05, location=(0, 0, 0.9))
    bpy.context.object.data.materials.append(bolt)


def render_stones():
    for name, rgb in (("stone-gold", (0.62, 0.33, 0.02)), ("stone-red", (0.5, 0.012, 0.018))):
        lib.reset(STONE_W, STONE_H, samples=SAMPLES, transparent=True)
        # The rink's lights: a broad soft key from above and behind the camera, a cool sky, a little ice bounce.
        lib.world((0.5, 0.56, 0.62), 0.5)
        lib.area_light((-2.5, -4, 7), (0, 0, 0.5), 900, 4, (1.0, 0.97, 0.92))
        lib.area_light((3, 3, 5), (0, 0, 0.5), 260, 3, (0.8, 0.9, 1.0))
        lib.area_light((0, -3, 0.05), (0, 0, 0.4), 60, 4, (0.85, 0.92, 1.0))
        build_stone(rgb)
        # Looking along +y, 12.7° down; centred on the body's mid height.
        d = 30
        target = Vector((0, 0, 0.42))
        cam = lib.camera((0, -d * math.cos(ELEV), 0.42 + d * math.sin(ELEV)), tuple(target), lens=50, ortho_scale=ORTHO)
        png = os.path.join(TMP, f"{name}.png")
        lib.render(png)
        img = Image.open(png).convert("RGBA")
        img.save(os.path.join(OUT, f"{name}.webp"), "WEBP", quality=88, method=6)
        print(f"  curling/{name}: {os.path.getsize(os.path.join(OUT, name + '.webp')) / 1024:.1f} KB")
    # The frame (for the renderer): px per radius, and the contact point's (the body's bottom front edge) row.
    from bpy_extras.object_utils import world_to_camera_view

    co = world_to_camera_view(bpy.context.scene, bpy.context.scene.camera, Vector((0, -1.0, 0.0)))
    top = world_to_camera_view(bpy.context.scene, bpy.context.scene.camera, Vector((0, 0, 0.76)))
    print(f"  STONE_FRAME: radius {STONE_W / ORTHO:.2f} px, centre-bottom row {(1 - world_to_camera_view(bpy.context.scene, bpy.context.scene.camera, Vector((0, 0, 0))).y) * STONE_H:.2f}, front-bottom row {(1 - co.y) * STONE_H:.2f}, top-centre row {(1 - top.y) * STONE_H:.2f}")


# ---------------------------------------------------------------- the arena
ARENA_W, ARENA_H = 1560, 760
ARENA_CROP = 610
SHIRTS = [(0.85, 0.12, 0.1), (0.95, 0.72, 0.1), (0.12, 0.35, 0.85), (0.92, 0.9, 0.86), (0.92, 0.38, 0.08),
          (0.06, 0.6, 0.5), (0.7, 0.06, 0.1), (0.18, 0.25, 0.42), (0.9, 0.55, 0.72), (0.4, 0.26, 0.78), (0.1, 0.1, 0.12)]
SKINS = [(0.92, 0.72, 0.58), (0.78, 0.55, 0.4), (0.58, 0.37, 0.24), (0.36, 0.22, 0.14), (0.96, 0.82, 0.7)]


def render_arena():
    """The stands behind the far boards seen from the thrower's end: 13 tiers of seated fans under the roof's lights."""
    lib.reset(ARENA_W, ARENA_H, samples=SAMPLES, transparent=False)
    lib.world((0.004, 0.005, 0.009), 1.0)
    rnd = random.Random(7)
    shirt_m = [lib.material(f"shirt{i}", base=c, roughness=0.75) for i, c in enumerate(SHIRTS)]
    skin_m = [lib.material(f"skin{i}", base=c, roughness=0.6) for i, c in enumerate(SKINS)]
    seat_m = lib.material("seat", base=(0.05, 0.07, 0.14), roughness=0.5)
    step_m = lib.material("step", base=(0.03, 0.035, 0.05), roughness=0.8)
    # Shared meshes: a seated torso (a rounded box) and a head, one mesh per colour.
    def mesh_of(kind, m):
        if kind == "torso":
            bpy.ops.mesh.primitive_cube_add(size=1)
            o = bpy.context.object
            o.scale = (0.44, 0.3, 0.56)
            bpy.ops.object.transform_apply(scale=True)
            mod = o.modifiers.new("b", "BEVEL")
            mod.width = 0.1
            mod.segments = 3
            bpy.ops.object.modifier_apply(modifier="b")
        else:
            bpy.ops.mesh.primitive_uv_sphere_add(radius=0.13, segments=16, ring_count=10)
            o = bpy.context.object
        bpy.ops.object.shade_smooth()
        o.data.materials.append(m)
        me = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        return me
    torsos = [mesh_of("torso", m) for m in shirt_m]
    heads = [mesh_of("head", m) for m in skin_m]
    col = bpy.context.scene.collection
    tiers = 13
    for t in range(tiers):
        z = 0.55 + t * 0.62
        y = 2.0 + t * 0.85
        # The tier's step and its seat row.
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, y + 0.3, z - 0.42))
        o = bpy.context.object
        o.scale = (60, 0.9, 0.55)
        o.data.materials.append(step_m)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, y + 0.28, z - 0.02))
        o = bpy.context.object
        o.scale = (60, 0.12, 0.42)
        o.data.materials.append(seat_m)
        x = -26.0
        while x < 26.0:
            x += 0.55 + rnd.random() * 0.12
            if rnd.random() < 0.07:
                continue
            ox = x + (rnd.random() - 0.5) * 0.08
            lean = (rnd.random() - 0.5) * 0.25
            a = bpy.data.objects.new("t", torsos[rnd.randrange(len(torsos))])
            a.location = (ox, y, z + 0.3)
            a.rotation_euler = (0, lean, (rnd.random() - 0.5) * 0.3)
            col.objects.link(a)
            h = bpy.data.objects.new("h", heads[rnd.randrange(len(heads))])
            h.location = (ox + lean * 0.4, y - 0.02, z + 0.72 + rnd.random() * 0.04)
            col.objects.link(h)
            if rnd.random() < 0.12:  # an arm up, waving a scarf
                b = bpy.data.objects.new("s", torsos[rnd.randrange(len(torsos))])
                b.location = (ox + 0.25, y - 0.05, z + 0.95)
                b.scale = (0.25, 0.25, 0.7)
                b.rotation_euler = (0, -0.4, 0)
                col.objects.link(b)
    # The far boards with their thin cool LED line, and the glass above them.
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 1.2, 0.18))
    o = bpy.context.object
    o.scale = (60, 0.2, 0.5)
    o.data.materials.append(lib.material("boards", base=(0.02, 0.025, 0.04), roughness=0.4, coat=1.0))
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 1.09, 0.36))
    o = bpy.context.object
    o.scale = (60, 0.01, 0.02)
    o.data.materials.append(lib.emission_material("led", (0.5, 0.88, 1.0), 2.0))
    # The roof: a dark truss line and a row of light fittings, and the lights themselves over the crowd (warm, soft).
    for i in range(-6, 7):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(i * 4.2, 9, 10.6))
        o = bpy.context.object
        o.scale = (1.0, 0.5, 0.12)
        o.data.materials.append(lib.emission_material(f"lamp{i}", (1.0, 0.95, 0.85), 6.0))
    lib.area_light((0, -2, 11), (0, 7, 3), 5200, 30, (1.0, 0.93, 0.82))
    lib.area_light((-14, 0, 6), (0, 6, 4), 1600, 10, (1.0, 0.82, 0.62))
    lib.area_light((14, 0, 6), (0, 6, 4), 1600, 10, (0.8, 0.88, 1.0))
    # The camera at the thrower's end, high, looking along the sheet at the far boards.
    lib.camera((0, -42, 5.2), (0, 6, 3.8), lens=58)
    png = os.path.join(TMP, "arena.png")
    lib.render(png)
    # Cropped just below the far boards (the ice covers the rest): ARENA_BOARDS_ROW is the boards' top edge in the crop.
    img = Image.open(png).convert("RGB").crop((0, 0, ARENA_W, ARENA_CROP))
    path = os.path.join(OUT, "arena.webp")
    img.save(path, "WEBP", quality=80, method=6)
    print(f"  curling/arena: {img.size[0]}x{img.size[1]}, {os.path.getsize(path) / 1024:.1f} KB")


os.makedirs(OUT, exist_ok=True)
for g in ARGS or ["stones", "arena"]:
    {"stones": render_stones, "arena": render_arena}[g]()
