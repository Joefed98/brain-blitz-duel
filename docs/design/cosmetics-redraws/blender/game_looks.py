"""The in-game looks' Blender pieces (second pass; docs/design/cosmetics-redraws/ART-DIRECTION.md "In-game looks").

  python game_looks.py [group…]   groups: golf pool stones backs cloth course rink (default: all)

Sprites are rendered top-down (orthographic, the art kit's key light from the top left), transparent, filling their
image edge to edge so a painter draws them exactly into the object's existing draw box:
  game-skin.crazy-golf.<art>.webp      the golf ball, 192 x 192 (radius = half the image)
  pool.gloss / pool.glass              neutral lighting for a pool ball (grey 0.5 = no change), drawn with hard-light
  stone.<name>.webp                    a stone's polished top (192 x 192 disc), drawn squashed into its top ellipse
  card-back.<name>.webp                a card back at 3x its 84 x 118 frame (252 x 354)
  cloth.weave / cloth.velvet           neutral tileable cloth (256 x 256), drawn with hard-light over the felt
  course.turf                          the Neon Course's night turf (256 x 256 tile)
  rink.ice                             the Neon Rink's ice (512 x 256 tile)
"""
import math
import os
import sys

import bpy
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib  # noqa: E402

TIMES = []


def nodes(m):
    return m.node_tree.nodes, m.node_tree.links


def top_camera(scale, z=10.0):
    return lib.camera((0, 0, z), (0, 0, 0), ortho_scale=scale)


def key_light(energy=900, size=4.0):
    """The art kit's key from the top left and a cool rim; round soft boxes, so highlights are round."""
    for o in (lib.area_light((-4, 4, 6), (0, 0, 0), energy, size, (1.0, 0.97, 0.92)), lib.area_light((5, -3, 3), (0, 0, 0), energy * 0.18, 6, (0.75, 0.85, 1.0))):
        o.data.shape = "DISK"


def studio_world(strength=0.6, top=(0.9, 0.9, 0.95), bottom=(0.04, 0.045, 0.06)):
    """A soft studio sphere: bright above, dark below (what glossy and metal surfaces reflect)."""
    w = lib.world((0, 0, 0), strength)
    nt = w.node_tree
    bg = nt.nodes["Background"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.45
    ramp.color_ramp.elements[0].color = (*bottom, 1)
    ramp.color_ramp.elements[1].position = 0.8
    ramp.color_ramp.elements[1].color = (*top, 1)
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], bg.inputs[0])
    return w


def out(name, png, quality=86, post=None):
    secs = lib.render(png)
    img = Image.open(png).convert("RGBA")
    if post:
        img = post(img)
    path, size = lib.save_webp(img, name, quality=quality)
    TIMES.append((name, secs, size))
    print(f"{name}: {secs:.1f} s, {size / 1024:.1f} KB")


def tmp(name):
    return os.path.join(lib.TMP, f"gl-{name}.png")


def bump_dimples(m, scale=16.0, strength=0.28):
    ns, ls = nodes(m)
    b = ns["Principled BSDF"]
    v = ns.new("ShaderNodeTexVoronoi")
    v.feature = "F1"
    v.inputs["Scale"].default_value = scale
    bump = ns.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    ls.new(v.outputs["Distance"], bump.inputs["Height"])
    ls.new(bump.outputs["Normal"], b.inputs["Normal"])
    ls.new(bump.outputs["Normal"], b.inputs["Coat Normal"])


def sphere(radius=1.0, segments=96, rings=48, smooth=True):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, segments=segments, ring_count=rings)
    o = bpy.context.object
    if smooth:
        bpy.ops.object.shade_smooth()
    return o


def golf():
    for art in ("watermelon", "disco", "neon-glow", "plasma"):
        s = lib.reset(192, 192, samples=128, transparent=True)
        s.view_settings.view_transform = "Standard"
        studio_world(0.22 if art == "disco" else 0.5, bottom=(0.16, 0.15, 0.22) if art == "disco" else (0.04, 0.045, 0.06))
        key_light()
        if art == "disco":
            o = sphere(segments=28, rings=14, smooth=False)
            m = lib.material("mirror", base=(0.92, 0.93, 0.98), metallic=1.0, roughness=0.03)
            ns, ls = nodes(m)
            vc = ns.new("ShaderNodeTexVoronoi")
            vc.inputs["Scale"].default_value = 5
            sep = ns.new("ShaderNodeSeparateColor")
            mix = ns.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.inputs["A"].default_value = (0.92, 0.93, 0.98, 1)
            mix.inputs["B"].default_value = (1.0, 0.55, 0.85, 1)
            gt = ns.new("ShaderNodeMath")
            gt.operation = "GREATER_THAN"
            gt.inputs[1].default_value = 0.78
            ls.new(vc.outputs["Color"], sep.inputs[0])
            ls.new(sep.outputs[0], gt.inputs[0])
            ls.new(gt.outputs[0], mix.inputs["Factor"])
            ls.new(mix.outputs["Result"], ns["Principled BSDF"].inputs["Base Color"])
            o.data.materials.append(m)
            # A dark room scattered with coloured lights (the world: Voronoi spots on every side), so every mirror tile
            # catches one: a mosaic of white, pink, cyan and gold on a silver ball.
            w = bpy.context.scene.world
            wn = w.node_tree
            bg = wn.nodes["Background"]
            tc = wn.nodes.new("ShaderNodeTexCoord")
            vo = wn.nodes.new("ShaderNodeTexVoronoi")
            vo.inputs["Scale"].default_value = 9
            spot = wn.nodes.new("ShaderNodeMath")
            spot.operation = "LESS_THAN"
            spot.inputs[1].default_value = 0.42
            hue = wn.nodes.new("ShaderNodeValToRGB")
            for pos, col in ((0.0, (1.0, 0.35, 0.8)), (0.33, (0.25, 0.9, 1.0)), (0.66, (1.0, 0.85, 0.5)), (1.0, (1.0, 1.0, 1.0))):
                e = hue.color_ramp.elements.new(pos) if 0 < pos < 1 else (hue.color_ramp.elements[0] if pos == 0 else hue.color_ramp.elements[len(hue.color_ramp.elements) - 1])
                e.position = pos
                e.color = (*col, 1)
            sepw = wn.nodes.new("ShaderNodeSeparateColor")
            mixw = wn.nodes.new("ShaderNodeMix")
            mixw.data_type = "RGBA"
            mixw.inputs["A"].default_value = (0.03, 0.03, 0.05, 1)
            wn.links.new(tc.outputs["Generated"], vo.inputs["Vector"])
            wn.links.new(vo.outputs["Distance"], spot.inputs[0])
            wn.links.new(vo.outputs["Color"], sepw.inputs[0])
            wn.links.new(sepw.outputs[0], hue.inputs[0])
            wn.links.new(spot.outputs[0], mixw.inputs["Factor"])
            wn.links.new(hue.outputs[0], mixw.inputs["B"])
            wn.links.new(mixw.outputs["Result"], bg.inputs[0])
            bg.inputs[1].default_value = 3.4
        elif art == "watermelon":
            o = sphere()
            m = lib.material("melon", base=(0.24, 0.69, 0.29), roughness=0.35, coat=1.0)
            ns, ls = nodes(m)
            b = ns["Principled BSDF"]
            b.inputs["Coat Roughness"].default_value = 0.08
            tc = ns.new("ShaderNodeTexCoord")
            sep = ns.new("ShaderNodeSeparateXYZ")
            ang = ns.new("ShaderNodeMath")
            ang.operation = "ARCTAN2"
            noise = ns.new("ShaderNodeTexNoise")
            noise.inputs["Scale"].default_value = 4
            noise.inputs["Detail"].default_value = 6
            mul = ns.new("ShaderNodeMath")
            mul.operation = "MULTIPLY"
            mul.inputs[1].default_value = 7
            add = ns.new("ShaderNodeMath")
            add.operation = "MULTIPLY_ADD"
            add.inputs[1].default_value = 1.4
            sinn = ns.new("ShaderNodeMath")
            sinn.operation = "SINE"
            ramp = ns.new("ShaderNodeValToRGB")
            ramp.color_ramp.elements[0].position = 0.35
            ramp.color_ramp.elements[0].color = (0.06, 0.28, 0.09, 1)
            ramp.color_ramp.elements[1].position = 0.55
            ramp.color_ramp.elements[1].color = (0.36, 0.78, 0.36, 1)
            ls.new(tc.outputs["Object"], sep.inputs[0])
            ls.new(sep.outputs["Z"], ang.inputs[0])
            ls.new(sep.outputs["X"], ang.inputs[1])
            ls.new(ang.outputs[0], mul.inputs[0])
            ls.new(tc.outputs["Object"], noise.inputs["Vector"])
            ls.new(noise.outputs["Fac"], add.inputs[0])
            ls.new(mul.outputs[0], add.inputs[2])
            ls.new(add.outputs[0], sinn.inputs[0])
            ls.new(sinn.outputs[0], ramp.inputs[0])
            ls.new(ramp.outputs[0], b.inputs["Base Color"])
            o.data.materials.append(m)
            bump_dimples(m, 16, 0.18)
        else:
            neon = art == "neon-glow"
            o = sphere()
            tint = (0.25, 0.85, 1.0) if neon else (0.42, 0.14, 0.95)
            m = lib.material("glass", base=tint, roughness=0.04, transmission=1.0, ior=1.45, coat=1.0)
            o.data.materials.append(m)
            if neon:
                bump_dimples(m, 16, 0.6)
            core = sphere(radius=0.48 if neon else 0.45)
            if neon:
                core.data.materials.append(lib.emission_material("core", (0.2, 0.85, 1.0), 1.7))
            else:
                core.data.materials.append(lib.emission_material("core", (1.0, 0.35, 0.8), 2.6))
                # Arcs: filaments where a Voronoi cell edge runs through a shell inside the glass.
                shell = sphere(radius=0.88)
                am = bpy.data.materials.new("arcs")
                am.use_nodes = True
                ns, ls = nodes(am)
                for n_ in list(ns):
                    ns.remove(n_)
                o_ = ns.new("ShaderNodeOutputMaterial")
                v = ns.new("ShaderNodeTexVoronoi")
                v.feature = "DISTANCE_TO_EDGE"
                v.inputs["Scale"].default_value = 3.0
                lt = ns.new("ShaderNodeMath")
                lt.operation = "LESS_THAN"
                lt.inputs[1].default_value = 0.035
                em = ns.new("ShaderNodeEmission")
                em.inputs[0].default_value = (1.0, 0.75, 1.0, 1)
                em.inputs[1].default_value = 9
                tr = ns.new("ShaderNodeBsdfTransparent")
                mx = ns.new("ShaderNodeMixShader")
                ls.new(v.outputs["Distance"], lt.inputs[0])
                ls.new(lt.outputs[0], mx.inputs[0])
                ls.new(tr.outputs[0], mx.inputs[1])
                ls.new(em.outputs[0], mx.inputs[2])
                ls.new(mx.outputs[0], o_.inputs[0])
                shell.data.materials.append(am)
        top_camera(2.0)
        out(f"game-skin.crazy-golf.{art}", tmp(art), quality=88)


def neutral(img, gain=1.0):
    """Scale a lighting render so its typical lit value is mid-grey (0.5: hard-light leaves the colour as it is)."""
    a = np.asarray(img.convert("RGBA")).astype(np.float32) / 255
    rgb, al = a[..., :3], a[..., 3]
    lum = rgb.mean(axis=2)
    sel = lum[al > 0.9] if (al > 0.9).any() else lum
    med = float(np.median(sel))
    rgb = rgb * (0.5 / max(med, 1e-3))
    if gain > 1:
        # A tile: keep only its fine detail (fibres, threads), never the light's broad falloff across the plane,
        # which would repeat as blotches once tiled (a high-pass against a wrapped blur), then lift it.
        from scipy.ndimage import gaussian_filter

        g0 = rgb.mean(axis=2)
        detail = g0 - gaussian_filter(g0, 10, mode="wrap")
        rgb = np.repeat((0.5 + detail * gain)[..., None], 3, axis=2)
    rgb = np.clip(rgb, 0, 1)
    grey = rgb.mean(axis=2, keepdims=True).repeat(3, axis=2)
    return Image.fromarray((np.concatenate([grey, al[..., None]], axis=2) * 255).astype(np.uint8), "RGBA")


def pool():
    for name, rough, glass in (("pool.gloss", 0.28, False), ("pool.glass", 0.05, True), ("pool.pixel", 0.28, False)):
        size = 10 if name == "pool.pixel" else 160  # the pixel set: one light value per cell of its 10 x 10 grid
        s = lib.reset(size, size, samples=256, transparent=True)
        s.render.filter_size = 0.01 if size == 10 else 1.5
        s.view_settings.view_transform = "Standard"
        studio_world(0.35)
        key_light(700)
        if glass:
            lib.area_light((3, -3, -1), (0, 0, 0), 250, 2, (1, 1, 1))  # the glint low on the far side
        o = sphere()
        m = lib.material("ball", base=(0.5, 0.5, 0.5), roughness=rough, coat=1.0)
        nodes(m)[0]["Principled BSDF"].inputs["Coat Roughness"].default_value = 0.03 if glass else 0.06
        o.data.materials.append(m)
        top_camera(2.0)
        out(name, tmp(name), quality=90, post=neutral)


def granite(m, base, speck, scale=26):
    ns, ls = nodes(m)
    b = ns["Principled BSDF"]
    noise = ns.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = 10
    v = ns.new("ShaderNodeTexVoronoi")
    v.inputs["Scale"].default_value = scale * 1.6
    mix = ns.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["A"].default_value = (*base, 1)
    mix.inputs["B"].default_value = (*speck, 1)
    gt = ns.new("ShaderNodeMath")
    gt.operation = "GREATER_THAN"
    gt.inputs[1].default_value = 0.62
    sep = ns.new("ShaderNodeSeparateColor")
    ls.new(v.outputs["Color"], sep.inputs[0])
    ls.new(sep.outputs[0], gt.inputs[0])
    ls.new(gt.outputs[0], mix.inputs["Factor"])
    mul = ns.new("ShaderNodeMix")
    mul.data_type = "RGBA"
    mul.blend_type = "MULTIPLY"
    mul.inputs["Factor"].default_value = 0.35
    ls.new(mix.outputs["Result"], mul.inputs["A"])
    ls.new(noise.outputs["Color"], mul.inputs["B"])
    ls.new(mul.outputs["Result"], b.inputs["Base Color"])


def stones():
    specs = {
        "glacier": dict(base=(0.42, 0.7, 0.88), speck=(1.0, 1.0, 1.0), inner=("frost", (0.48, 0.7, 0.86)), rings=[]),
        "aurora": dict(base=(0.035, 0.04, 0.08), speck=(0.22, 0.25, 0.38), inner=("aurora", None), rings=[]),
        "neon-stones": dict(base=(0.04, 0.035, 0.09), speck=(0.18, 0.16, 0.3), inner=("dark", (0.03, 0.02, 0.08)), rings=[(0.86, (0.13, 0.9, 1.0)), (0.62, (1.0, 0.24, 0.8))]),
        "rink-mine": dict(base=(0.05, 0.06, 0.14), speck=(0.2, 0.22, 0.4), inner=None, rings=[(0.86, (0.13, 0.9, 1.0)), (0.62, (0.13, 0.9, 1.0))]),
        "rink-theirs": dict(base=(0.1, 0.04, 0.12), speck=(0.32, 0.18, 0.36), inner=None, rings=[(0.86, (1.0, 0.24, 0.8)), (0.62, (1.0, 0.24, 0.8))]),
    }
    for name, sp in specs.items():
        s = lib.reset(192, 192, samples=128, transparent=True)
        s.view_settings.view_transform = "Standard"
        studio_world(0.18)
        key_light(800)
        bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=1.0, depth=0.2, location=(0, 0, 0))
        top = bpy.context.object
        bev = top.modifiers.new("bevel", "BEVEL")
        bev.width = 0.12
        bev.segments = 6
        bpy.ops.object.shade_smooth()
        m = lib.material("granite", roughness=0.18, coat=1.0)
        granite(m, sp["base"], sp["speck"])
        top.data.materials.append(m)
        if sp["inner"]:
            kind, col = sp["inner"]
            bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=0.62, depth=0.04, location=(0, 0.05, 0.1))
            disc = bpy.context.object
            if kind == "aurora":
                am = lib.material("aurora", base=(0.1, 0.8, 0.5), roughness=0.1, coat=1.0, emission=(0.1, 0.9, 0.6), strength=0.7)
                ns, ls = nodes(am)
                tc = ns.new("ShaderNodeTexCoord")
                noise = ns.new("ShaderNodeTexNoise")
                noise.inputs["Scale"].default_value = 5.5
                noise.inputs["Distortion"].default_value = 2.5
                ramp = ns.new("ShaderNodeValToRGB")
                ramp.color_ramp.elements[0].color = (0.2, 1.0, 0.6, 1)
                ramp.color_ramp.elements[0].position = 0.4  # the noise clusters round 0.5: spread it over all three colours
                ramp.color_ramp.elements[1].position = 0.6
                ramp.color_ramp.elements[1].color = (1.0, 0.24, 0.8, 1)
                ramp.color_ramp.elements.new(0.5).color = (0.13, 0.9, 1.0, 1)
                ls.new(tc.outputs["Object"], noise.inputs["Vector"])
                ls.new(noise.outputs["Fac"], ramp.inputs[0])
                ls.new(ramp.outputs[0], ns["Principled BSDF"].inputs["Base Color"])
                ls.new(ramp.outputs[0], ns["Principled BSDF"].inputs["Emission Color"])
                disc.data.materials.append(am)
            elif kind == "frost":
                fm = lib.material("frost", base=col, roughness=0.3, coat=1.0)
                bump_dimples(fm, 40, 0.25)
                disc.data.materials.append(fm)
            else:
                disc.data.materials.append(lib.material("dark", base=col, roughness=0.08, coat=1.0))
        for r, col in sp["rings"]:
            bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=0.03, location=(0, 0.02 if r < 0.8 else 0, 0.11))
            bpy.context.object.data.materials.append(lib.emission_material("tube", col, 2.6))
        top_camera(2.0)
        out(f"stone.{name}", tmp(f"stone-{name}"), quality=88)


def card_shape(w=84, h=118, r=7.5, depth=1.2):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -depth / 2))
    o = bpy.context.object
    o.scale = (w, h, depth)
    bpy.ops.object.transform_apply(scale=True)
    bev = o.modifiers.new("bevel", "BEVEL")
    bev.width = r
    bev.segments = 10
    bev.affect = "EDGES"
    bev.limit_method = "ANGLE"
    return o


def damask_image(n=512):
    """A damask repeat (quatrefoils and diamonds on a half drop) as a height map, for the gold foil's emboss."""
    y, x = np.mgrid[0:n, 0:n].astype(np.float32) / n
    h = np.zeros((n, n), np.float32)
    cells = 6
    for row in range(-1, cells + 2):
        for col in range(-1, cells + 2):
            cx = (col + (0.5 if row % 2 else 0.0)) / cells
            cy = row / cells
            for dx, dy in ((0, -1), (1, 0), (0, 1), (-1, 0)):
                px, py = cx + dx * 0.022, cy + dy * 0.022
                d = np.sqrt((x - px) ** 2 + (y - py) ** 2)
                h = np.maximum(h, np.clip(1 - np.abs(d - 0.02) / 0.006, 0, 1))
            dd = np.abs(x - cx - 0.5 / cells) + np.abs(y - cy - 0.5 / cells) * 0.6
            h = np.maximum(h, np.clip(1 - np.abs(dd - 0.03) / 0.005, 0, 1))
    img = bpy.data.images.new("damask", n, n, float_buffer=True)
    rgba = np.stack([h, h, h, np.ones_like(h)], axis=-1)
    img.pixels.foreach_set(rgba[::-1].reshape(-1))
    return img


def bolt_obj(scale, z, height, mat, x=0.0, y=0.0):
    import bmesh

    pts = [(-0.075, 1.0), (0.425, 1.0), (0.075, 0.2), (0.425, 0.2), (-0.325, -1.0), (-0.075, -0.1), (-0.425, -0.1)]
    bm = bmesh.new()
    vs = [bm.verts.new((x + px * scale, y + py * scale, z)) for px, py in pts]
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    for v in [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]:
        v.co.z += height
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=scale * 0.04, segments=3, affect="EDGES")
    me = bpy.data.meshes.new("bolt")
    bm.to_mesh(me)
    o = bpy.data.objects.new("bolt", me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(mat)
    return o


def frame_band(w, h, inset, width, height, mat):
    """A raised rectangular frame (a ring) on the card face."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, height / 2))
    outer = bpy.context.object
    outer.scale = (w - 2 * inset, h - 2 * inset, height)
    bpy.ops.object.transform_apply(scale=True)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, height / 2))
    inner = bpy.context.object
    inner.scale = (w - 2 * inset - 2 * width, h - 2 * inset - 2 * width, height * 4)
    bpy.ops.object.transform_apply(scale=True)
    b = outer.modifiers.new("cut", "BOOLEAN")
    b.object = inner
    b.operation = "DIFFERENCE"
    bpy.context.view_layer.objects.active = outer
    bpy.ops.object.modifier_apply(modifier="cut")
    bpy.data.objects.remove(inner)
    bev = outer.modifiers.new("bevel", "BEVEL")
    bev.width = min(width, height) * 0.45
    bev.segments = 4
    bpy.ops.object.shade_smooth()
    outer.data.materials.append(mat)
    return outer


def backs():
    import bmesh

    W, H = 84.0, 118.0
    for name in ("royal-damask", "holo-foil", "neon"):
        s = lib.reset(252, 354, samples=160, transparent=True)
        s.view_settings.view_transform = "Standard"
        studio_world(0.25 if name == "neon" else 0.8)
        lib.area_light((-60, 70, 90), (0, 0, 0), 9.0e4, 70, (1.0, 0.96, 0.9))
        lib.area_light((60, -40, 50), (0, 0, 0), 1.5e4, 60, (0.8, 0.88, 1.0))
        card = card_shape()
        gold = lib.material("gold", base=(1.0, 0.74, 0.34), metallic=1.0, roughness=0.2)
        if name == "royal-damask":
            m = lib.material("navy", base=(0.03, 0.05, 0.16), roughness=0.5, coat=0.4)
            ns, ls = nodes(m)
            b = ns["Principled BSDF"]
            tex = ns.new("ShaderNodeTexImage")
            tex.image = damask_image()
            tc = ns.new("ShaderNodeTexCoord")
            mp = ns.new("ShaderNodeMapping")
            mp.inputs["Scale"].default_value = (1 / 42, 1 / 42, 1)
            ls.new(tc.outputs["Object"], mp.inputs[0])
            ls.new(mp.outputs[0], tex.inputs[0])
            mix = ns.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.inputs["A"].default_value = (0.03, 0.05, 0.16, 1)
            mix.inputs["B"].default_value = (0.95, 0.7, 0.32, 1)
            ls.new(tex.outputs["Color"], mix.inputs["Factor"])
            ls.new(mix.outputs["Result"], b.inputs["Base Color"])
            ls.new(tex.outputs["Color"], b.inputs["Metallic"])
            bump = ns.new("ShaderNodeBump")
            bump.inputs["Strength"].default_value = 0.4
            ls.new(tex.outputs["Color"], bump.inputs["Height"])
            ls.new(bump.outputs["Normal"], b.inputs["Normal"])
            card.data.materials.append(m)
            frame_band(W, H, 4.5, 3.2, 0.9, gold)
            frame_band(W, H, 9.5, 0.8, 0.6, gold)
            bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=15, depth=1.6, location=(0, 0, 0.8))
            med = bpy.context.object
            bev = med.modifiers.new("bevel", "BEVEL")
            bev.width = 0.7
            bev.segments = 4
            bpy.ops.object.shade_smooth()
            med.data.materials.append(gold)
            bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=12, depth=0.4, location=(0, 0, 1.65))
            bpy.context.object.data.materials.append(lib.material("enamel", base=(0.02, 0.04, 0.14), roughness=0.06, coat=1.0))
            bolt_obj(10.5, 1.7, 1.4, gold)
            for sx, sy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
                bpy.ops.mesh.primitive_uv_sphere_add(radius=2.2, location=(sx * (W / 2 - 6.1), sy * (H / 2 - 6.1), 0.8))
                bpy.ops.object.shade_smooth()
                bpy.context.object.data.materials.append(gold)
        elif name == "holo-foil":
            m = lib.material("holo", base=(0.7, 0.7, 0.76), metallic=0.55, roughness=0.18, coat=1.0)
            ns, ls = nodes(m)
            b = ns["Principled BSDF"]
            b.inputs["Thin Film IOR"].default_value = 1.33  # a faint film over the printed prism, not over everything
            wave = ns.new("ShaderNodeTexWave")
            wave.inputs["Scale"].default_value = 0.32
            wave.bands_direction = "DIAGONAL"
            wave.inputs["Distortion"].default_value = 1.2
            tc = ns.new("ShaderNodeTexCoord")
            mp = ns.new("ShaderNodeMapping")
            mp.inputs["Scale"].default_value = (1 / 30, 1 / 30, 1)
            bump = ns.new("ShaderNodeBump")
            bump.inputs["Strength"].default_value = 0.6
            ls.new(tc.outputs["Object"], mp.inputs[0])
            ls.new(mp.outputs[0], wave.inputs[0])
            ls.new(wave.outputs["Fac"], bump.inputs["Height"])
            ls.new(bump.outputs["Normal"], b.inputs["Normal"])
            thick = ns.new("ShaderNodeMath")
            thick.operation = "MULTIPLY_ADD"
            thick.inputs[1].default_value = 0.0
            thick.inputs[2].default_value = 0.0  # no film: the printed prism carries the colour (the film turned it all mint)
            ls.new(wave.outputs["Fac"], thick.inputs[0])
            ls.new(thick.outputs[0], b.inputs["Thin Film Thickness"])
            # The foil's prism: pastel bands of spectrum following the grooves (the film shifts them further).
            prism = ns.new("ShaderNodeValToRGB")
            for pos, col in ((0.0, (0.4, 0.82, 1.0)), (0.25, (0.7, 0.52, 1.0)), (0.5, (1.0, 0.52, 0.82)), (0.75, (1.0, 0.85, 0.5)), (1.0, (0.5, 1.0, 0.72))):
                e = prism.color_ramp.elements.new(pos) if 0 < pos < 1 else (prism.color_ramp.elements[0] if pos == 0 else prism.color_ramp.elements[len(prism.color_ramp.elements) - 1])
                e.position = pos
                e.color = (*col, 1)
            ls.new(wave.outputs["Fac"], prism.inputs[0])
            ls.new(prism.outputs[0], b.inputs["Base Color"])
            card.data.materials.append(m)
            silver = lib.material("silver", base=(0.92, 0.94, 0.98), metallic=1.0, roughness=0.12)
            frame_band(W, H, 4.5, 2.6, 0.8, silver)
            bm = bmesh.new()
            vs = []
            for i in range(16):
                a = i / 16 * math.tau - math.pi / 2
                rr = 17 if i % 2 == 0 else 7
                vs.append(bm.verts.new((math.cos(a) * rr, -math.sin(a) * rr, 0.1)))
            f = bm.faces.new(vs)
            ext = bmesh.ops.extrude_face_region(bm, geom=[f])
            for v in [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]:
                v.co.z += 1.6
            bmesh.ops.bevel(bm, geom=list(bm.edges), offset=0.6, segments=3, affect="EDGES")
            me = bpy.data.meshes.new("star")
            bm.to_mesh(me)
            st = bpy.data.objects.new("star", me)
            bpy.context.scene.collection.objects.link(st)
            pearl = lib.material("pearl", base=(0.97, 0.96, 0.98), roughness=0.2, coat=1.0)
            nodes(pearl)[0]["Principled BSDF"].inputs["Thin Film Thickness"].default_value = 300
            st.data.materials.append(pearl)
        else:
            m = lib.material("glass", base=(0.02, 0.02, 0.06), roughness=0.05, coat=1.0)
            card.data.materials.append(m)
            for inset, col in ((5.0, (0.13, 0.9, 1.0)), (9.0, (1.0, 0.24, 0.8))):
                pts = [(-W / 2 + inset, -H / 2 + inset), (W / 2 - inset, -H / 2 + inset), (W / 2 - inset, H / 2 - inset), (-W / 2 + inset, H / 2 - inset)]
                cu = bpy.data.curves.new("tube", "CURVE")
                cu.dimensions = "3D"
                cu.bevel_depth = 0.55 if inset == 5.0 else 0.35
                sp = cu.splines.new("POLY")
                sp.points.add(3)
                for i, (px, py) in enumerate(pts):
                    sp.points[i].co = (px, py, 0.6, 1)
                sp.use_cyclic_u = True
                o = bpy.data.objects.new("tube", cu)
                bpy.context.scene.collection.objects.link(o)
                o.data.materials.append(lib.emission_material(f"tube{inset}", col, 1.6))
            gm = lib.material("grid", base=(0.03, 0.03, 0.08), roughness=0.3, emission=(0.13, 0.5, 0.7), strength=0.0)
            ns, ls = nodes(gm)
            br = ns.new("ShaderNodeTexBrick")
            br.inputs["Scale"].default_value = 2.4
            br.inputs["Mortar Size"].default_value = 0.03
            br.inputs["Color1"].default_value = (0, 0, 0, 1)
            br.inputs["Color2"].default_value = (0, 0, 0, 1)
            br.inputs["Mortar"].default_value = (1, 1, 1, 1)
            br.offset = 0
            tc = ns.new("ShaderNodeTexCoord")
            ls.new(tc.outputs["Object"], br.inputs["Vector"])
            mul = ns.new("ShaderNodeMath")
            mul.operation = "MULTIPLY"
            mul.inputs[1].default_value = 0.3
            sep = ns.new("ShaderNodeSeparateColor")
            ls.new(br.outputs["Color"], sep.inputs[0])
            ls.new(sep.outputs[0], mul.inputs[0])
            ls.new(mul.outputs[0], ns["Principled BSDF"].inputs["Emission Strength"])
            bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0.05))
            g = bpy.context.object
            g.scale = (W - 22, H - 22, 1)
            g.data.materials.append(gm)
            g.hide_render = True  # (the grid read as a cage over the card: the traces carry it instead)
            # Pink circuit traces across the glass, stepping round the bolt, each ending in a lit pad.
            for ty in (-30.0, 0.0, 30.0):
                jog = 9.0 if ty else 0.0
                pts = [(-W / 2 + 9, ty), (-16, ty), (-10, ty + jog), (10, ty + jog), (16, ty), (W / 2 - 9, ty)] if ty else [(-W / 2 + 9, 0), (-14, 0), (14, 0), (W / 2 - 9, 0)]
                cu = bpy.data.curves.new("trace", "CURVE")
                cu.dimensions = "3D"
                cu.bevel_depth = 0.32
                sp = cu.splines.new("POLY")
                sp.points.add(len(pts) - 1)
                for i, (px, py) in enumerate(pts):
                    sp.points[i].co = (px, py, 0.4, 1)
                o = bpy.data.objects.new("trace", cu)
                bpy.context.scene.collection.objects.link(o)
                o.data.materials.append(lib.emission_material("trace", (1.0, 0.24, 0.8), 1.4))
                for px, py in (pts[0], pts[-1]):
                    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=1.4, depth=0.4, location=(px, py, 0.5))
                    bpy.context.object.data.materials.append(lib.emission_material("pad", (1.0, 0.5, 0.9), 1.2))
            bolt_obj(15, 0.4, 0.8, lib.emission_material("boltlight", (1.0, 0.95, 0.85), 2.2))
        top_camera(H, z=200)
        out(f"card-back.{name}", tmp(f"back-{name}"), quality=86)


def mirror_tile(img):
    """A tile made seamless by mirroring: the render's top-left quarter, flipped into the other three (fine noise
    hides the symmetry; nothing is blended, so nothing smears when the detail is lifted)."""
    w, h = img.size
    q = img.crop((0, 0, w // 2, h // 2))
    out = Image.new(img.mode, (w, h))
    out.paste(q, (0, 0))
    out.paste(q.transpose(Image.FLIP_LEFT_RIGHT), (w // 2, 0))
    out.paste(q.transpose(Image.FLIP_TOP_BOTTOM), (0, h // 2))
    out.paste(q.transpose(Image.ROTATE_180), (w // 2, h // 2))
    return out


def seamless(img, blend=0.18):
    """Cross-fade a tile's edges into their opposite sides, so it repeats without a seam."""
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    h, w = a.shape[:2]
    for axis, n in ((1, w), (0, h)):
        k = int(n * blend)
        rolled = np.roll(a, n // 2, axis=axis)
        t = np.ones(n, np.float32)
        ramp = np.linspace(0, 1, k)
        t[:k] = ramp
        t[-k:] = ramp[::-1]
        t = t[None, :, None] if axis == 1 else t[:, None, None]
        a = a * t + rolled * (1 - t)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def surface(name, size, build, neutral_grey=False, scale=2.0, gain=1.0):
    s = lib.reset(size[0], size[1], samples=96)
    if neutral_grey:
        s.view_settings.view_transform = "Standard"
    lib.world((0.02, 0.02, 0.03), 1.0)
    key_light(500, 6)
    build()
    top_camera(scale)
    post = (lambda im: neutral(mirror_tile(im).convert("RGBA"), gain).convert("RGB")) if neutral_grey else seamless
    out(name, tmp(name), quality=82, post=post)


def fibre_plane(base, rough, bump_scale, bump_strength, wave=True):
    bpy.ops.mesh.primitive_plane_add(size=4)
    o = bpy.context.object
    m = lib.material("cloth", base=base, roughness=rough)
    ns, ls = nodes(m)
    b = ns["Principled BSDF"]
    b.inputs["Sheen Weight"].default_value = 0.8
    b.inputs["Sheen Roughness"].default_value = 0.4
    tc = ns.new("ShaderNodeTexCoord")
    n1 = ns.new("ShaderNodeTexNoise")
    n1.inputs["Scale"].default_value = bump_scale * 3
    n1.inputs["Detail"].default_value = 12
    bump = ns.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = bump_strength
    ls.new(tc.outputs["UV"], n1.inputs[0])
    if wave:
        w1 = ns.new("ShaderNodeTexWave")
        w1.wave_type = "BANDS"
        w1.bands_direction = "X"
        w1.inputs["Scale"].default_value = bump_scale
        w2 = ns.new("ShaderNodeTexWave")
        w2.wave_type = "BANDS"
        w2.bands_direction = "Y"
        w2.inputs["Scale"].default_value = bump_scale
        mx = ns.new("ShaderNodeMath")
        mx.operation = "MAXIMUM"
        add = ns.new("ShaderNodeMath")
        add.operation = "MULTIPLY_ADD"
        add.inputs[1].default_value = 0.25
        ls.new(tc.outputs["UV"], w1.inputs[0])
        ls.new(tc.outputs["UV"], w2.inputs[0])
        ls.new(w1.outputs["Fac"], mx.inputs[0])
        ls.new(w2.outputs["Fac"], mx.inputs[1])
        ls.new(n1.outputs["Fac"], add.inputs[0])
        ls.new(mx.outputs[0], add.inputs[2])
        ls.new(add.outputs[0], bump.inputs["Height"])
    else:
        ls.new(n1.outputs["Fac"], bump.inputs["Height"])
    ls.new(bump.outputs["Normal"], b.inputs["Normal"])
    o.data.materials.append(m)
    return o


def cloth():
    surface("cloth.weave", (256, 256), lambda: fibre_plane((0.5, 0.5, 0.5), 0.9, 64, 0.55), neutral_grey=True, gain=22.0)
    surface("cloth.velvet", (256, 256), lambda: fibre_plane((0.5, 0.5, 0.5), 0.75, 40, 0.35, wave=False), neutral_grey=True, gain=45.0)


def course():
    def build():
        o = fibre_plane((0.02, 0.16, 0.1), 0.85, 30, 0.6, wave=False)
        m = o.data.materials[0]
        ns, ls = nodes(m)
        # Blades: fine noise stretched along one direction (the cut grass's grain), light tips on dark roots.
        tc = ns.new("ShaderNodeTexCoord")
        mp = ns.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (90.0, 12.0, 1.0)
        mp.inputs["Rotation"].default_value = (0, 0, 0.35)
        v = ns.new("ShaderNodeTexNoise")
        v.inputs["Scale"].default_value = 1.0
        v.inputs["Detail"].default_value = 4
        ramp = ns.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.35
        ramp.color_ramp.elements[0].color = (0.01, 0.07, 0.05, 1)
        ramp.color_ramp.elements[1].position = 0.7
        ramp.color_ramp.elements[1].color = (0.08, 0.42, 0.22, 1)
        ls.new(tc.outputs["UV"], mp.inputs[0])
        ls.new(mp.outputs[0], v.inputs[0])
        ls.new(v.outputs["Fac"], ramp.inputs[0])
        ls.new(ramp.outputs[0], ns["Principled BSDF"].inputs["Base Color"])

    surface("course.turf", (256, 256), build)


def rink():
    def build():
        bpy.ops.mesh.primitive_plane_add(size=4)
        o = bpy.context.object
        o.scale = (2, 1, 1)
        m = lib.material("ice", base=(0.03, 0.09, 0.16), roughness=0.08, coat=1.0)
        ns, ls = nodes(m)
        b = ns["Principled BSDF"]
        n1 = ns.new("ShaderNodeTexNoise")
        n1.inputs["Scale"].default_value = 3
        n1.inputs["Detail"].default_value = 12
        ramp = ns.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = (0.02, 0.06, 0.12, 1)
        ramp.color_ramp.elements[1].color = (0.08, 0.2, 0.32, 1)
        ls.new(n1.outputs["Fac"], ramp.inputs[0])
        ls.new(ramp.outputs[0], b.inputs["Base Color"])
        v = ns.new("ShaderNodeTexVoronoi")
        v.feature = "DISTANCE_TO_EDGE"
        v.inputs["Scale"].default_value = 12
        mp = ns.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (0.25, 3.0, 1)
        tc = ns.new("ShaderNodeTexCoord")
        bump = ns.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.15
        ls.new(tc.outputs["Object"], mp.inputs[0])
        ls.new(mp.outputs[0], v.inputs[0])
        ls.new(v.outputs["Distance"], bump.inputs["Height"])
        ls.new(bump.outputs["Normal"], b.inputs["Normal"])
        o.data.materials.append(m)

    surface("rink.ice", (512, 256), build, scale=8.0)


groups = sys.argv[1:] or ["golf", "pool", "stones", "backs", "cloth", "course", "rink"]
for g in groups:
    globals()[g]()
print("times:", ", ".join(f"{n} {s:.1f}s {b / 1024:.1f}KB" for n, s, b in TIMES))
