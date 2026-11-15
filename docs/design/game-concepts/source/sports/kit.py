"""Shared pieces for the Sports concepts (balls, panels, simple stylised figures)."""
import os, sys, math
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from lib import *


def ball_tex(num, color, stripe=False, base=(250, 246, 236), tag="real"):
    """An equirectangular ball texture: the number disc sits at u=0.25, v=0.5 (faces +Y after the sphere's
    default UVs; ball() turns it to face up)."""
    Image, ImageDraw, ImageFont, _ = pil()
    path = os.path.join(TEX, f"pool-ball-{tag}-{num}.png")
    if os.path.exists(path):
        return path
    w, h = 1024, 512
    im = Image.new("RGB", (w, h), base if stripe else color)
    d = ImageDraw.Draw(im)
    if stripe:
        d.rectangle([0, h * 0.30, w, h * 0.70], fill=color)
    if num is not None:
        # disc at u=0.25 (x=256), v=0.5; scale x by 1/cos(lat) is ~1 at the equator
        for cx in (256, 768):
            r = 46
            d.ellipse([cx - r * 1.0, h / 2 - r, cx + r * 1.0, h / 2 + r], fill=base)
            f = font(800, 52)
            d.text((cx, h / 2 + 2), str(num), font=f, fill=(20, 18, 16), anchor="mm")
    im.save(path)
    return path


def ball(name, x, y, r_px, tex_path, rough=0.08, coat=1.0, z=None, spin=0.0, tilt=0.0):
    m = bpy.data.materials.get("m-" + os.path.basename(tex_path))
    if m is None:
        m = textured("m-" + os.path.basename(tex_path), tex_path, rough=rough, coat=coat, coat_rough=0.02)
        m.node_tree.nodes["Image Texture"].extension = "REPEAT"
    o = sphere(name, u(r_px), m, loc=P(x, y, u(r_px) if z is None else z), seg=64)
    # the disc at u=0.25 faces -Y on Blender's UV sphere; turn it up to the camera, then spin a little
    o.rotation_euler = (math.radians(90 + tilt), 0, math.radians(spin))
    return o


def plain_ball(name, x, y, r_px, color, rough=0.08, coat=1.0, z=None):
    return sphere(name, u(r_px), mat(name + "m", color, rough=rough, coat=coat), loc=P(x, y, u(r_px) if z is None else z))


def figure(name, base, height, body_mat, skin_mat=None, head_mat=None, shorts_mat=None, sock_mat=None,
           pose="stand", num_tex=None, face_dir=(0, -1), glove_mat=None):
    """A stylised faceless athlete standing at base (Vector, ground z), height in units, facing face_dir.
    Built from rounded capsules (no face, no features)."""
    import bmesh as _b
    parts = []
    hgt = height
    sk = skin_mat or mat("skin-" + name, (178, 128, 96), rough=0.55, sss=0.2)
    hd = head_mat or sk
    sh = shorts_mat or body_mat
    so = sock_mat or body_mat

    def cap(nm, p0, p1, r, m):
        p0, p1 = Vector(p0), Vector(p1)
        mid = (p0 + p1) / 2
        ln = (p1 - p0).length
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=max(ln, 1e-4), vertices=24, location=mid)
        o = bpy.context.object
        o.name = nm
        o.rotation_euler = (p1 - p0).to_track_quat("Z", "Y").to_euler()
        bv = o.modifiers.new("b", "BEVEL")
        bv.width = r * 0.95
        bv.segments = 5
        bv.limit_method = "NONE"
        o.data.materials.append(m)
        bpy.ops.object.shade_smooth()
        parts.append(o)
        return o

    fx, fy = face_dir
    side = Vector((-fy, fx, 0)).normalized()
    up = Vector((0, 0, 1))
    b = Vector(base)
    leg = hgt * 0.47
    hip = b + up * leg
    sw = hgt * 0.07
    for s in (-1, 1):
        spread = 1.9 if pose == "bat" else 0.9
        foot = b + side * s * sw * spread
        knee = b + side * s * sw * (spread * 0.85) + up * leg * 0.48
        cap(name + "shin", foot + up * 0.01 * hgt, knee, hgt * 0.04, so)
        cap(name + "thigh", knee, hip + side * s * sw * 0.7, hgt * 0.055, sh)
    chest = hip + up * hgt * 0.30
    # torso: a tapered, front-to-back flattened trunk (hips narrower than shoulders)
    bpy.ops.mesh.primitive_cone_add(radius1=hgt * 0.105, radius2=hgt * 0.15, depth=hgt * 0.30, vertices=32,
                                    location=hip + up * hgt * 0.17)
    t = bpy.context.object
    t.name = name + "torso"
    t.rotation_euler = (0, 0, math.atan2(fy, fx) + math.pi / 2)
    t.scale = (1.0, 0.62, 1.0)
    bvt = t.modifiers.new("b", "BEVEL"); bvt.width = hgt * 0.05; bvt.segments = 5; bvt.limit_method = "NONE"
    t.modifiers.new("s", "SUBSURF").levels = 2
    t.data.materials.append(body_mat)
    bpy.ops.object.shade_smooth()
    parts.append(t)
    cap(name + "pelvis", hip - up * hgt * 0.02, hip + up * hgt * 0.06, hgt * 0.10, sh)
    sh_l = chest + up * hgt * 0.01
    for s in (-1, 1):
        shoulder = sh_l + side * s * hgt * 0.15
        if pose == "wall":  # hands crossed low in front
            hand = hip + side * s * hgt * 0.03 + Vector((fx, fy, 0)) * hgt * 0.10 + up * hgt * 0.03
            elbow = (shoulder + hand) / 2 + Vector((fx, fy, 0)) * hgt * 0.04 + side * s * hgt * 0.06
        elif pose == "bat":  # both hands together by the back shoulder, elbows out
            grip = sh_l + up * hgt * 0.02 - Vector((fx, fy, 0)) * hgt * 0.10 + side * hgt * 0.02
            hand = grip + side * s * hgt * 0.015
            elbow = shoulder + side * s * hgt * 0.10 - up * hgt * 0.10 - Vector((fx, fy, 0)) * hgt * 0.02
        elif pose == "keeper":
            hand = shoulder + side * s * hgt * 0.30 + up * hgt * 0.10
            elbow = shoulder + side * s * hgt * 0.16 + up * hgt * 0.02
        else:
            hand = shoulder + side * s * hgt * 0.04 - up * hgt * 0.32
            elbow = shoulder + side * s * hgt * 0.04 - up * hgt * 0.16
        cap(name + "uarm", shoulder, elbow, hgt * 0.04, body_mat)
        cap(name + "farm", elbow, hand, hgt * 0.035, sk)
    neck = chest + up * hgt * 0.06
    cap(name + "neck", chest, neck, hgt * 0.04, sk)
    head = sphere(name + "head", hgt * 0.075, hd, loc=neck + up * hgt * 0.07)
    head.scale = (1, 1, 1.12)
    parts.append(head)
    return parts


def flat(o):
    """Flat-shade a slab: lib.plate() smooth-shades its n-gon top, which shades a big face across its triangles."""
    for p in o.data.polygons:
        p.use_smooth = False
    return o


def crowd(name, rows, cols, origin, row_step, col_step, seat_h, palette, seed=1, gap=0.1, person=(0.42, 0.3, 0.5),
          heads=True, skin=None, arc=None):
    """A stylised crowd in one mesh: per seat a rounded torso block and a head, coloured from the palette.
    origin is the first seat's floor position; rows go back along row_step (dy, dz), seats along col_step (dx).
    arc=(cx, cy) bends the rows round a centre (for stands round a ballpark)."""
    import bmesh as _b
    rnd = random.Random(seed)
    me = bpy.data.meshes.new(name)
    bm = _b.new()
    mats = [mat(f"{name}-c{i}", c, rough=0.75) for i, c in enumerate(palette)]
    skins = [mat(f"{name}-s{i}", c, rough=0.6) for i, c in enumerate(skin or [(224, 182, 150), (176, 124, 92), (110, 74, 52)])]
    allm = mats + skins
    ox, oy, oz = origin
    for r in range(rows):
        for c in range(cols):
            if rnd.random() < gap:
                continue
            x = ox + c * col_step + rnd.uniform(-0.05, 0.05) * col_step
            y = oy + r * row_step[0]
            z = oz + r * row_step[1]
            if arc:
                cx, cy = arc
                ang = (x - cx) / max(1e-6, (y - cy))
                rr = y - cy
                x, y = cx + math.sin(ang) * rr, cy + math.cos(ang) * rr
            w, d, h = person
            h *= rnd.uniform(0.85, 1.1)
            res = _b.ops.create_cube(bm, size=1.0)
            mi = rnd.randrange(len(mats))
            for v in res["verts"]:
                v.co.x = v.co.x * w + x
                v.co.y = v.co.y * d + y
                v.co.z = v.co.z * h + z + h / 2
            for f in {f for v in res["verts"] for f in v.link_faces}:
                f.material_index = mi
            if heads:
                res2 = _b.ops.create_icosphere(bm, subdivisions=1, radius=w * 0.32)
                si = len(mats) + rnd.randrange(len(skins))
                for v in res2["verts"]:
                    v.co.x += x
                    v.co.y += y
                    v.co.z += z + h + w * 0.3
                for f in {f for v in res2["verts"] for f in v.link_faces}:
                    f.material_index = si
    bm.to_mesh(me)
    bm.free()
    o = link(bpy.data.objects.new(name, me))
    for m in allm:
        o.data.materials.append(m)
    bv = o.modifiers.new("b", "BEVEL")
    bv.width = person[0] * 0.18
    bv.segments = 2
    return o


def disc(name, r, m, loc, z=0.0, verts=96):
    """A flat filled disc (n-gon) at height z, flat shaded."""
    bpy.ops.mesh.primitive_circle_add(radius=r, vertices=verts, fill_type="NGON", location=(loc[0], loc[1], z))
    o = bpy.context.object
    o.name = name
    o.data.materials.append(m)
    return o


def stripes(name, a, b, band=1.0, axis="Y", fibre=900.0, rough=0.85, sheen=0.4, angle=0.0):
    """Mown stripes: bands `band` units wide across `axis` (optionally turned by angle rad), with a fibre noise."""
    m, nt, bs = node_mat(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Rotation"].default_value = (0, 0, angle)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(mp.outputs[0], sep.inputs[0])
    mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; mul.inputs[1].default_value = math.pi / band
    nt.links.new(sep.outputs[axis], mul.inputs[0])
    sn = nt.nodes.new("ShaderNodeMath"); sn.operation = "SINE"
    nt.links.new(mul.outputs[0], sn.inputs[0])
    gt = nt.nodes.new("ShaderNodeMath"); gt.operation = "GREATER_THAN"; gt.inputs[1].default_value = 0.0
    nt.links.new(sn.outputs[0], gt.inputs[0])
    nz = nt.nodes.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = fibre; nz.inputs["Detail"].default_value = 6
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    mix = nt.nodes.new("ShaderNodeMixRGB"); mix.inputs[1].default_value = lin(a); mix.inputs[2].default_value = lin(b)
    nt.links.new(gt.outputs[0], mix.inputs[0])
    ov = nt.nodes.new("ShaderNodeMixRGB"); ov.blend_type = "OVERLAY"; ov.inputs[0].default_value = 0.25
    nt.links.new(mix.outputs[0], ov.inputs[1]); nt.links.new(nz.outputs["Fac"], ov.inputs[2])
    nt.links.new(ov.outputs[0], bs.inputs["Base Color"])
    bs.inputs["Roughness"].default_value = rough
    bs.inputs["Sheen Weight"].default_value = sheen
    return m


def world_gradient(stops, strength=1.0):
    """A sky from a colour ramp over the view direction's height: stops = [(z 0..1, rgb), ...] (0 = horizon)."""
    nt = bpy.context.scene.world.node_tree
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(tc.outputs["Generated"], sep.inputs[0])
    cr = nt.nodes.new("ShaderNodeValToRGB")
    el = cr.color_ramp.elements
    el[0].position, el[0].color = stops[0][0], lin(stops[0][1])
    el[1].position, el[1].color = stops[-1][0], lin(stops[-1][1])
    for p, c in stops[1:-1]:
        e = el.new(p)
        e.color = lin(c)
    nt.links.new(sep.outputs["Z"], cr.inputs["Fac"])
    bg = nt.nodes["Background"]
    nt.links.new(cr.outputs[0], bg.inputs[0])
    bg.inputs[1].default_value = strength


def sun_disc(loc, r, color=(255, 236, 190), strength=30.0, glow=True):
    """A visible sun: a bright disc facing the origin and a few soft glow rings."""
    o = sphere("sundisc", r, emission("sundisc", color, strength), loc=loc, seg=32)
    if glow:
        # a camera-facing plane with a soft radial falloff (no hard rings)
        bpy.ops.mesh.primitive_plane_add(size=r * 16, location=loc)
        g = bpy.context.object
        g.rotation_euler = (math.radians(90), 0, 0)
        m = bpy.data.materials.new("sunglow")
        m.use_nodes = True
        nt = m.node_tree
        for n in list(nt.nodes):
            if n.type != "OUTPUT_MATERIAL":
                nt.nodes.remove(n)
        tc = nt.nodes.new("ShaderNodeTexCoord")
        mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (2.0, 2.0, 2.0)
        gr = nt.nodes.new("ShaderNodeTexGradient"); gr.gradient_type = "SPHERICAL"
        nt.links.new(tc.outputs["Object"], mp.inputs[0]); nt.links.new(mp.outputs[0], gr.inputs[0])
        pw = nt.nodes.new("ShaderNodeMath"); pw.operation = "POWER"; pw.inputs[1].default_value = 2.6
        nt.links.new(gr.outputs["Fac"], pw.inputs[0])
        em = nt.nodes.new("ShaderNodeEmission"); em.inputs[0].default_value = lin((255, 196, 130)); em.inputs[1].default_value = 4.0
        tr = nt.nodes.new("ShaderNodeBsdfTransparent")
        mx = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(pw.outputs[0], mx.inputs[0]); nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2])
        nt.links.new(mx.outputs[0], nt.nodes["Material Output"].inputs[0])
        g.data.materials.append(m)
    return o
