"""Cue Ball's table as a rendered layer (the Sports overhaul, concept C): lacquered walnut rails with real grain, brass
corner castings, middle plates and sights, the cushions' rubber, the deep green felt with nap under a soft lamp pool,
and leather-lined pockets, rendered from straight above in Blender (Cycles) at 3× the world's 390 × 740 px, transparent
outside the rails. Every rail, cushion and pocket is built from the sim's own geometry (src/lib/arcade/pool.ts), passed
in as JSON, so the image sits exactly on the painted table it replaces (pool.renderer.ts draws it once loaded, its
painted table until then).

    bun -e 'import * as P from "./src/lib/arcade/pool"; console.log(JSON.stringify({W:P.POOL_W,H:P.POOL_H,CL:P.POOL_CL,
      CR:P.POOL_CR,CT:P.POOL_CT,CB:P.POOL_CB,RAIL:P.POOL_RAIL,MID:P.POOL_MID_Y,BAULK:P.POOL_BAULK_Y,pockets:P.POOL_POCKETS
      .map(p=>({x:p.x/256,y:p.y/256,r:p.r/256,corner:!!p.corner}))}))' > geom.json
    python render_pool_table.py geom.json [--samples=96] [--scale=3]   → public/sports/pool/table.webp
"""
import json
import math
import os
import sys

import bpy
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "../../../.."))
sys.path.insert(0, os.path.abspath(os.path.join(HERE, "../../cosmetics-redraws/blender")))
import lib  # noqa: E402

ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
OPT = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--") and "=" in a)
G = json.load(open(ARGS[0]))
SAMPLES = int(OPT.get("samples", 96))
SCALE = float(OPT.get("scale", 3))
OUT = OPT.get("out", os.path.join(REPO, "public/sports/pool/table.webp"))
TMP = os.environ.get("RENDER_TMP", "/tmp")

W, H = G["W"], G["H"]
CL, CR, CT, CB, RAIL = G["CL"], G["CR"], G["CT"], G["CB"], G["RAIL"]


def P(x, y, z=0.0):
    """World px (x right, y down) → Blender (x, -y, z)."""
    return (x, -y, z)


def box(name, x0, y0, x1, y1, z0, z1, mat, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=P((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
    o = bpy.context.object
    o.name = name
    o.scale = (x1 - x0, y1 - y0, z1 - z0)
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        b = o.modifiers.new("b", "BEVEL")
        b.width = bevel
        b.segments = 5
        b.limit_method = "ANGLE"
    if mat:
        o.data.materials.append(mat)
    return o


def cyl(name, x, y, r, z0, z1, mat=None, verts=96):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=z1 - z0, location=P(x, y, (z0 + z1) / 2), vertices=verts)
    o = bpy.context.object
    o.name = name
    if mat:
        o.data.materials.append(mat)
    return o


def cut(target, cutter, apply=True):
    m = target.modifiers.new("cut", "BOOLEAN")
    m.operation = "DIFFERENCE"
    m.object = cutter
    m.solver = "EXACT"
    if apply:
        bpy.context.view_layer.objects.active = target
        bpy.ops.object.modifier_apply(modifier=m.name)


def hide(o):
    o.hide_render = True
    o.hide_viewport = True


def node_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    return m, m.node_tree, m.node_tree.nodes["Principled BSDF"]


def walnut():
    """Lacquered walnut: grain bands along each rail (x on the ends, y down the sides), distorted, under a clear coat."""
    m, nt, b = node_mat("walnut")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    waves = []
    for axis in ("X", "Y"):
        w = nt.nodes.new("ShaderNodeTexWave")
        w.wave_type = "BANDS"
        w.bands_direction = axis
        w.inputs["Scale"].default_value = 0.022
        w.inputs["Distortion"].default_value = 9.0
        w.inputs["Detail"].default_value = 6.0
        w.inputs["Detail Scale"].default_value = 1.6
        nt.links.new(tc.outputs["Object"], w.inputs["Vector"])
        waves.append(w)
    # Side rails (x beyond the cloth) run their grain down the table; the ends across it.
    lt = nt.nodes.new("ShaderNodeMath")
    lt.operation = "LESS_THAN"
    lt.inputs[1].default_value = CL
    gt = nt.nodes.new("ShaderNodeMath")
    gt.operation = "GREATER_THAN"
    gt.inputs[1].default_value = CR
    nt.links.new(sep.outputs["X"], lt.inputs[0])
    nt.links.new(sep.outputs["X"], gt.inputs[0])
    side = nt.nodes.new("ShaderNodeMath")
    side.operation = "MAXIMUM"
    nt.links.new(lt.outputs[0], side.inputs[0])
    nt.links.new(gt.outputs[0], side.inputs[1])
    # Not within the end rails' y bands (corners read as the sides').
    ymask_lo = nt.nodes.new("ShaderNodeMath")
    ymask_lo.operation = "GREATER_THAN"
    ymask_lo.inputs[1].default_value = -(CT)
    ymask_hi = nt.nodes.new("ShaderNodeMath")
    ymask_hi.operation = "LESS_THAN"
    ymask_hi.inputs[1].default_value = -(CB)
    nt.links.new(sep.outputs["Y"], ymask_lo.inputs[0])
    nt.links.new(sep.outputs["Y"], ymask_hi.inputs[0])
    ends = nt.nodes.new("ShaderNodeMath")
    ends.operation = "MAXIMUM"
    nt.links.new(ymask_lo.outputs[0], ends.inputs[0])
    nt.links.new(ymask_hi.outputs[0], ends.inputs[1])
    notend = nt.nodes.new("ShaderNodeMath")
    notend.operation = "SUBTRACT"
    notend.inputs[0].default_value = 1.0
    nt.links.new(ends.outputs[0], notend.inputs[1])
    mask = nt.nodes.new("ShaderNodeMath")
    mask.operation = "MULTIPLY"
    nt.links.new(side.outputs[0], mask.inputs[0])
    nt.links.new(notend.outputs[0], mask.inputs[1])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "FLOAT"
    nt.links.new(mask.outputs[0], mix.inputs["Factor"])
    nt.links.new(waves[0].outputs["Fac"], mix.inputs["A"])
    nt.links.new(waves[1].outputs["Fac"], mix.inputs["B"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    el = ramp.color_ramp.elements
    el[0].position, el[0].color = 0.0, (0.035, 0.012, 0.004, 1)
    el[1].position, el[1].color = 1.0, (0.2, 0.085, 0.032, 1)
    el.new(0.55).color = (0.11, 0.045, 0.016, 1)
    nt.links.new(mix.outputs["Result"], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], b.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.08
    nt.links.new(mix.outputs["Result"], bump.inputs["Height"])
    nt.links.new(bump.outputs[0], b.inputs["Normal"])
    b.inputs["Roughness"].default_value = 0.42
    b.inputs["Coat Weight"].default_value = 0.35
    b.inputs["Specular IOR Level"].default_value = 0.25
    b.inputs["Coat Roughness"].default_value = 0.22
    return m


def felt():
    """Deep green baize: a fine nap (noise bump and colour), sheen, no gloss."""
    m, nt, b = node_mat("felt")
    tc = nt.nodes.new("ShaderNodeTexCoord")
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.inputs["Scale"].default_value = 0.9
    n.inputs["Detail"].default_value = 12.0
    nt.links.new(tc.outputs["Object"], n.inputs["Vector"])
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    el = ramp.color_ramp.elements
    el[0].position, el[0].color = 0.35, (0.006, 0.05, 0.022, 1)
    el[1].position, el[1].color = 0.65, (0.012, 0.075, 0.036, 1)
    nt.links.new(n.outputs["Fac"], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], b.inputs["Base Color"])
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.25
    bump.inputs["Distance"].default_value = 0.3
    nt.links.new(n.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs[0], b.inputs["Normal"])
    b.inputs["Roughness"].default_value = 0.95
    b.inputs["Sheen Weight"].default_value = 0.8
    b.inputs["Sheen Tint"].default_value = (0.3, 0.8, 0.5, 1)
    return m


def build():
    lib.reset(int(W * SCALE), int(H * SCALE), samples=SAMPLES, transparent=True)
    s = bpy.context.scene
    s.view_settings.look = "AgX - Base Contrast"
    lib.world((0.02, 0.018, 0.016), 0.5)
    m_wood = walnut()
    m_felt = felt()
    m_cush = lib.material("cushion", base=(0.008, 0.06, 0.028), roughness=0.85)
    m_brass = lib.material("brass", base=(0.78, 0.45, 0.12), metallic=1.0, roughness=0.28)
    m_leather = lib.material("leather", base=(0.025, 0.011, 0.005), roughness=0.6)
    m_hole = lib.material("hole", base=(0.0, 0.0, 0.0), roughness=1.0)
    # The rails: a rounded walnut slab with its lacquered edge, the cloth's well cut out of it.
    rails = box("rails", CL - RAIL, CT - RAIL, CR + RAIL, CB + RAIL, 0, 14, m_wood, bevel=5)
    rb = rails.modifiers["b"]
    rb.limit_method = "NONE"
    bpy.context.view_layer.objects.active = rails
    bpy.ops.object.modifier_apply(modifier="b")
    well = box("well", CL - 6, CT - 6, CR + 6, CB + 6, -5, 30, None)
    cut(rails, well)
    hide(well)
    # The carved channel: a shallow groove part way across the rail.
    groove_o = box("groove_o", CL - RAIL + 9, CT - RAIL + 9, CR + RAIL - 9, CB + RAIL - 9, 13.4, 20, None)
    groove_i = box("groove_i", CL - RAIL + 11, CT - RAIL + 11, CR + RAIL - 11, CB + RAIL - 11, 10, 25, None)
    cut(groove_o, groove_i)
    cut(rails, groove_o)
    hide(groove_o)
    hide(groove_i)
    # The cushions: a dark green rubber band round the cloth, its nose a touch lower than the rail.
    cush = box("cushion", CL - 6, CT - 6, CR + 6, CB + 6, 0, 10, m_cush, bevel=0)
    bed_cut = box("bedcut", CL, CT, CR, CB, -5, 30, None)
    cut(cush, bed_cut)
    hide(bed_cut)
    bed = box("bed", CL, CT, CR, CB, 0, 4, m_felt)
    # The pockets: holes through everything (corners round, the middles a half disc on the outer side).
    cups = []
    for i, p in enumerate(G["pockets"]):
        x, y, r = p["x"], p["y"], p["r"]
        c = cyl(f"hole{i}", x, y, r, -20, 40, None)
        if not p["corner"]:
            sx = -1 if x < W / 2 else 1
            inner = box(f"half{i}", x if sx < 0 else x - r - 2, y - r - 2, x + r + 2 if sx < 0 else x, y + r + 2, -30, 50, None)
            cut(c, inner)
            hide(inner)
        for o in (rails, cush, bed):
            cut(o, c)
        # The leather cup below each hole, black at the bottom.
        bpy.ops.mesh.primitive_uv_sphere_add(radius=r + 1, location=P(x, y, -2), segments=48, ring_count=24)
        cup = bpy.context.object
        cup.scale = (1, 1, 0.55)
        cup.data.materials.append(m_leather)
        bpy.ops.mesh.primitive_cylinder_add(radius=r * 0.8, depth=1, location=P(x, y, -5), vertices=48)
        bpy.context.object.data.materials.append(m_hole)
        cups.append(c)
        # Brass: a corner casting round the outside of the corner, on the rails only; a plate at the middles.
        if p["corner"]:
            sx = -1 if x < W / 2 else 1
            sy = -1 if y < G["MID"] else 1
            cast = cyl(f"cast{i}", x + sx * 2, y + sy * 2, r + 7, 0, 16, m_brass)
            bev = cast.modifiers.new("b", "BEVEL")
            bev.width = 2.5
            bev.segments = 4
            bpy.context.view_layer.objects.active = cast
            bpy.ops.object.modifier_apply(modifier="b")
            cut(cast, c)
            wcut = box(f"wc{i}", CL - 6, CT - 6, CR + 6, CB + 6, -5, 30, None)
            cut(cast, wcut)
            hide(wcut)
            # An engraved ring.
            ring_o = cyl(f"ro{i}", x + sx * 2, y + sy * 2, r + 4.7, 15.2, 20, None)
            ring_i = cyl(f"ri{i}", x + sx * 2, y + sy * 2, r + 3.7, 10, 25, None)
            cut(ring_o, ring_i)
            cut(cast, ring_o)
            hide(ring_o)
            hide(ring_i)
        else:
            sx = -1 if x < W / 2 else 1
            px0 = x + sx * 2 - (0 if sx > 0 else 12)
            plate = box(f"plate{i}", px0, y - 21, px0 + 12, y + 21, 0, 15.5, m_brass, bevel=2)
            pb = plate.modifiers["b"]
            pb.limit_method = "NONE"
            bpy.context.view_layer.objects.active = plate
            bpy.ops.object.modifier_apply(modifier="b")
            cut(plate, c)
    for c in cups:
        hide(c)
    # Brass sights on the rails: three between pockets on each long rail half, three on each end.
    half = (CB - CT) / 2
    for k in (1, 2, 3):
        for yy in (CT + half * k / 4, G["MID"] + half * k / 4):
            for xx in (CL - RAIL / 2 - 2, CR + RAIL / 2 + 2):
                cyl("sight", xx, yy, 2.2, 13, 14.6, m_brass, verts=24)
        xx = CL + (CR - CL) * k / 4
        for yy in (CT - RAIL / 2 - 2, CB + RAIL / 2 + 2):
            cyl("sight", xx, yy, 2.2, 13, 14.6, m_brass, verts=24)
    # Light: the lamp's soft pool over the cloth's middle, a warm window key from the top left, a cool fill.
    # The lamp over the table: a soft spot whose pool fades towards the cushions (off the camera's axis, so the
    # lacquer never mirrors it as a sheet of glare).
    sp = bpy.data.lights.new("lamp", "SPOT")
    sp.energy = 2.2e7
    sp.spot_size = math.radians(70)
    sp.spot_blend = 1.0
    sp.shadow_soft_size = 120
    sp.color = (1.0, 0.9, 0.72)
    so = bpy.data.objects.new("lamp", sp)
    bpy.context.scene.collection.objects.link(so)
    so.location = P(W / 2 - 40, H * 0.42, 700)
    lib.look_at(so, P(W / 2, H * 0.46, 0))
    lib.area_light(P(-600, -500, 700), P(W / 2, H / 2, 0), 5.5e6, 600, (1.0, 0.8, 0.56))
    lib.area_light(P(W + 700, H + 400, 600), P(W / 2, H / 2, 0), 1.0e6, 800, (0.6, 0.72, 1.0))
    # Straight down, orthographic, exactly the world's box.
    cam = lib.camera(P(W / 2, H / 2, 2000), P(W / 2, H / 2, 0), ortho_scale=max(W, H))
    cam.rotation_euler = (0, 0, 0)
    cam.data.clip_end = 5000
    s.render.film_transparent = True


build()
png = os.path.join(TMP, "pool-table.png")
lib.render(png)
img = Image.open(png).convert("RGBA")
img.save(OUT, "WEBP", quality=int(OPT.get("quality", 82)), method=6)
print(f"pool/table: {img.size[0]}x{img.size[1]}, {os.path.getsize(OUT) / 1024:.1f} KB")
