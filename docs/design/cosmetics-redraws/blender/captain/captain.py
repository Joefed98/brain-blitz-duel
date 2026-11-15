"""Captain Joulz in 3D (Blender, built from code): the approved look (public/art/captain-joulz-*.svg,
docs/art/source/hero2.py) as a premium character — a navy-black satin suit with gold piping, a round lacquered helmet
with a lit cyan visor (its V-notched mask) and three cyan crown lines, a polished gold chest bolt, gold gauntlets with a
bolt badge, gold gloves, gold shins and boots with knee guards, a gold belt, and a pointed gold cape.

The rig is a set of named parts placed from a pose: the pose is the approved 2D joint positions
(docs/art/source/captain-poses.json: neck, hip, shoulders, elbows, hands, hips, knees, feet, lean), so every pose the
2D art has, the 3D Captain has too; POSE_DEPTH adds the third axis per joint. Skins: every material comes from
MATERIALS (one place), so a skin is a new MATERIALS table passed to build().

    import captain
    parent = captain.build(pose="win", location=(0, 0, 0), height=1.7, materials=captain.MATERIALS)
"""
import json
import math
import os
import sys

import bpy
import bmesh  # noqa: E402 (available once bpy is loaded)
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "../../../../.."))
POSES = json.load(open(os.path.join(REPO, "docs/art/source/captain-poses.json")))

# The 2D art's units: x 0..160 (centre 80), y down, the feet at y 184; the head's centre at (80, 44), radius 21.
HEAD_C = (80.0, 41.0)
HEAD_R = 23.0
FEET_Y = 184.0
ART_HEIGHT = FEET_Y - 20.0  # the helmet's top to the soles, in art units

# Depth (towards the camera is -Y in Blender) per joint and pose, art units: hands a little forward in the win pose.
POSE_DEPTH = {
    "ready": {"el": (-3, -3), "ha": (-6, -6), "kn": (-2, -2), "ft": (-4, -4)},
    "win": {"el": (-4, -4), "ha": (-8, -8), "kn": (-2, -2), "ft": (-4, -4)},
    "run": {"el": (-2, 2), "ha": (-6, 4), "kn": (-6, 4), "ft": (-4, 6)},
}

# Every material, one place (a skin replaces this table). Colours are linear-ish sRGB triples.
MATERIALS = {
    "suit": {"base": (0.006, 0.011, 0.04), "metallic": 0.0, "roughness": 0.36, "sheen": 0.0, "coat": 0.25},
    "helmet": {"base": (0.016, 0.024, 0.06), "metallic": 0.2, "roughness": 0.18, "coat": 1.0},
    "gold": {"base": (1.0, 0.74, 0.34), "metallic": 1.0, "roughness": 0.18},
    "gold_brushed": {"base": (1.0, 0.72, 0.32), "metallic": 1.0, "roughness": 0.32},
    "cape": {"base": (0.95, 0.62, 0.2), "metallic": 0.85, "roughness": 0.3, "sheen": 0.3},
    "visor": {"base": (0.0, 0.08, 0.14), "metallic": 0.0, "roughness": 0.03, "coat": 1.0, "emission": (0.05, 0.8, 1.0), "strength": 1.6},
    "crown_line": {"base": (0.1, 0.8, 1.0), "emission": (0.13, 0.9, 1.0), "strength": 3.0},
    "badge": {"base": (0.01, 0.012, 0.02), "metallic": 0.3, "roughness": 0.2, "coat": 1.0},
}


def _material(name, spec):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*spec["base"], 1)
    b.inputs["Metallic"].default_value = spec.get("metallic", 0.0)
    b.inputs["Roughness"].default_value = spec.get("roughness", 0.4)
    b.inputs["Coat Weight"].default_value = spec.get("coat", 0.0)
    b.inputs["Sheen Weight"].default_value = spec.get("sheen", 0.0)
    if "emission" in spec:
        b.inputs["Emission Color"].default_value = (*spec["emission"], 1)
        b.inputs["Emission Strength"].default_value = spec["strength"]
    return m


class Builder:
    def __init__(self, pose, materials, scale):
        self.p = POSES[pose]
        self.d = POSE_DEPTH.get(pose, {})
        self.s = scale
        self.mats = {k: _material(f"cap.{k}", v) for k, v in materials.items()}
        self.parts = []

    # Art (x, y) and a depth → Blender (x, depth, up), before the parent's transform.
    def v(self, xy, depth=0.0):
        x, y = xy
        return Vector(((x - 80.0) * self.s, depth * self.s, (FEET_Y - y) * self.s))

    def joint(self, key, side=None):
        val = self.p[key] if side is None else self.p[key][side]
        dep = 0.0
        if side is not None and key in self.d:
            dep = self.d[key][side]
        return self.v(val, dep)

    def keep(self, o, name, mat):
        o.name = f"captain.{name}"
        if o.data and hasattr(o.data, "materials"):
            o.data.materials.clear()
            o.data.materials.append(self.mats[mat])
        self.parts.append(o)
        return o

    # ---------------------------------------------------------------- shapes
    def capsule(self, a, b, r0, r1, name, mat, segs=24):
        """A tapered capsule from a to b (radii r0 at a, r1 at b): a smooth limb."""
        a, b = Vector(a), Vector(b)
        axis = b - a
        L = axis.length
        bm = bmesh.new()
        rings = 12
        verts = []
        # Hemisphere at a, tube, hemisphere at b.
        profile = []
        for i in range(rings + 1):
            t = math.pi / 2 * i / rings
            profile.append((-r0 * math.cos(t), r0 * math.sin(t)))  # z (along axis), radius
        for i in range(rings + 1):
            t = math.pi / 2 * i / rings
            profile.append((L + r1 * math.sin(t), r1 * math.cos(t)))
        profile[0] = (-r0, 0.0)
        for (z, rad) in profile:
            ring = []
            for j in range(segs):
                ang = 2 * math.pi * j / segs
                ring.append(bm.verts.new((rad * math.cos(ang), rad * math.sin(ang), z)))
            verts.append(ring)
        for i in range(len(verts) - 1):
            for j in range(segs):
                bm.faces.new((verts[i][j], verts[i][(j + 1) % segs], verts[i + 1][(j + 1) % segs], verts[i + 1][j]))
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        for f in me.polygons:
            f.use_smooth = True
        o = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(o)
        rot = Vector((0, 0, 1)).rotation_difference(axis.normalized()).to_matrix().to_4x4()
        o.matrix_world = Matrix.Translation(a) @ rot
        return self.keep(o, name, mat)

    def ellipsoid(self, c, rx, ry, rz, name, mat, rot=(0, 0, 0)):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=1.0, location=c)
        o = bpy.context.object
        o.scale = (rx, ry, rz)
        o.rotation_euler = rot
        bpy.ops.object.shade_smooth()
        return self.keep(o, name, mat)

    def tube(self, pts, radius, name, mat):
        cu = bpy.data.curves.new(name, "CURVE")
        cu.dimensions = "3D"
        cu.bevel_depth = radius
        cu.bevel_resolution = 3
        sp = cu.splines.new("POLY")
        sp.points.add(len(pts) - 1)
        for i, p in enumerate(pts):
            sp.points[i].co = (*p, 1)
        o = bpy.data.objects.new(name, cu)
        bpy.context.scene.collection.objects.link(o)
        return self.keep(o, name, mat)

    def bolt(self, centre, height, depth, name, mat, facing=-1):
        """The Joulz bolt (the art's polygon), extruded and bevelled, facing the camera (-Y)."""
        poly = [(-0.075, 1.0), (0.425, 1.0), (0.075, 0.2), (0.425, 0.2), (-0.325, -1.0), (-0.075, -0.1), (-0.425, -0.1)]
        bm = bmesh.new()
        h = height / 2
        vs = [bm.verts.new((centre[0] + px * h, centre[1], centre[2] + py * h)) for px, py in poly]
        f = bm.faces.new(vs)
        ext = bmesh.ops.extrude_face_region(bm, geom=[f])
        for vv in [e for e in ext["geom"] if isinstance(e, bmesh.types.BMVert)]:
            vv.co.y += facing * depth
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=depth * 0.35, segments=3, affect="EDGES")
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        o = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(o)
        return self.keep(o, name, mat)

    # ---------------------------------------------------------------- the body
    def build(self):
        s = self.s
        neck = self.joint("neck")
        hip = self.joint("hip")
        sh = [self.joint("sh", i) for i in (0, 1)]
        el = [self.joint("el", i) for i in (0, 1)]
        ha = [self.joint("ha", i) for i in (0, 1)]
        hp = [self.joint("hp", i) for i in (0, 1)]
        kn = [self.joint("kn", i) for i in (0, 1)]
        ft = [self.joint("ft", i) for i in (0, 1)]
        up = (neck - hip).normalized()

        # Torso: a chest, a waist and a pelvis, blended by their overlap (satin hides the joins).
        chest_c = hip.lerp(neck, 0.68)
        self.torso(hip, neck)
        for i in (0, 1):
            self.ellipsoid(sh[i], 6.6 * s, 6.6 * s, 6.6 * s, f"shoulder{i}", "suit")
        self.capsule(neck - up * 4 * s, neck + up * 8 * s, 6 * s, 6 * s, "neck", "suit")

        # Arms: the upper arm suit, the forearm suit then a gold gauntlet, a gold glove.
        for i in (0, 1):
            self.capsule(sh[i], el[i], 7.0 * s, 6.2 * s, f"upperarm{i}", "suit")
            self.capsule(el[i], el[i].lerp(ha[i], 0.55), 6.0 * s, 5.8 * s, f"forearm{i}", "suit")
            g0 = el[i].lerp(ha[i], 0.5)
            g1 = el[i].lerp(ha[i], 0.92)
            self.capsule(g0, g1, 7.4 * s, 7.0 * s, f"gauntlet{i}", "gold_brushed")
            # The gauntlet's bolt badge: a black lacquer disc with a gold bolt, on its outer face.
            mid = g0.lerp(g1, 0.5)
            out = Vector((-1 if i == 0 else 1, -1.2, 0)).normalized()
            badge_c = mid + out * 7.2 * s
            bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=3.4 * s, depth=1.0 * s, location=badge_c)
            bd = bpy.context.object
            bd.rotation_euler = Vector((0, 0, 1)).rotation_difference(out).to_euler()
            self.keep(bd, f"badge{i}", "badge")
            self.bolt(badge_c + out * 0.6 * s, 4.6 * s, 0.6 * s, f"badgebolt{i}", "gold")
            self.glove(i, el[i], ha[i])
        # Legs: suit thighs, gold knee guards, gold shins and boots.
        for i in (0, 1):
            self.capsule(hp[i], kn[i], 9.6 * s, 7.6 * s, f"thigh{i}", "suit")
            self.capsule(kn[i], kn[i].lerp(ft[i], 0.45), 7.4 * s, 7.0 * s, f"knee{i}", "suit")
            self.capsule(kn[i].lerp(ft[i], 0.38), ft[i] + Vector((0, 0, 3 * s)), 8.0 * s, 7.4 * s, f"boot{i}", "gold_brushed")
            self.ellipsoid(kn[i] + Vector((0, -6.6 * s, 0.5 * s)), 6.0 * s, 2.8 * s, 6.6 * s, f"kneeguard{i}", "gold")
            # The foot, pointing forward.
            self.ellipsoid(ft[i] + Vector((0, -4.5 * s, 2.6 * s)), 6.4 * s, 10 * s, 3.8 * s, f"foot{i}", "gold")
            self.tube([kn[i].lerp(ft[i], 0.38) + Vector((0, -7.2 * s, 0)) + Vector((dx * s, 0, 0)) for dx in (-6, -3, 0, 3, 6)], 0.9 * s, f"bootband{i}", "gold")
        # Belt with its buckle.
        belt_c = hip + up * 5 * s
        bpy.ops.mesh.primitive_torus_add(major_radius=1.0, minor_radius=0.12, location=belt_c, major_segments=64, minor_segments=12)
        bt = bpy.context.object
        bt.scale = (15.2 * s, 10.6 * s, 15 * s)
        bpy.ops.object.shade_smooth()
        self.keep(bt, "belt", "gold")
        bpy.ops.mesh.primitive_cube_add(size=1, location=belt_c + Vector((0, -10.6 * s, 0)))
        bk = bpy.context.object
        bk.scale = (6 * s, 1.6 * s, 4.4 * s)
        mod = bk.modifiers.new("b", "BEVEL")
        mod.width, mod.segments = 0.6 * s, 3
        self.keep(bk, "buckle", "gold")
        # Gold piping: the V from each shoulder to the belt, the collar.
        front = Vector((0, -1, 0))
        for i in (0, 1):
            a = sh[i] + front * 6 * s + Vector((0, 0, 1 * s))
            m = chest_c + front * 12.2 * s + Vector(((-6 if i == 0 else 6) * s, 0, -4 * s))
            b = belt_c + front * 10.4 * s + Vector(((-2 if i == 0 else 2) * s, 0, 1 * s))
            self.tube([a, a.lerp(m, 0.5) + front * 1.5 * s, m, b], 0.9 * s, f"piping{i}", "gold")
        self.bolt(chest_c + front * 12.6 * s + Vector((0, 0, 1 * s)), 15 * s, 2.2 * s, "chestbolt", "gold")
        self.helmet(self.v(HEAD_C))
        self.cape(sh, hip)
        return self.parts

    def torso(self, hip, neck):
        """One lofted torso (pelvis, waist, chest, shoulders, neck base): superelliptic sections, subdivided smooth."""
        s = self.s
        L = (neck - hip).length
        # (height share from the hip, half-width, half-depth) in art units: an athletic V.
        secs = [(-0.16, 11.0, 8.0), (-0.06, 13.5, 9.5), (0.08, 13.8, 9.6), (0.3, 12.2, 9.0), (0.5, 14.5, 10.2),
                (0.7, 17.8, 11.2), (0.86, 18.6, 10.6), (0.96, 15.0, 9.0), (1.04, 8.0, 6.5), (1.1, 5.8, 5.6)]
        n = 32
        bm = bmesh.new()
        rings = []
        for (t, hw, hd) in secs:
            ring = []
            for j in range(n):
                a = 2 * math.pi * j / n
                c, sn = math.cos(a), math.sin(a)
                # A superellipse (exponent 2.6): squarer shoulders and chest than an ellipse.
                ex = 2 / 2.6
                x = hw * s * math.copysign(abs(c) ** ex, c)
                y = hd * s * math.copysign(abs(sn) ** ex, sn)
                p = hip.lerp(neck, t) if 0 <= t <= 1 else hip + (neck - hip).normalized() * L * t
                ring.append(bm.verts.new((p.x + x, p.y + y, p.z)))
            rings.append(ring)
        for i in range(len(rings) - 1):
            for j in range(n):
                bm.faces.new((rings[i][j], rings[i][(j + 1) % n], rings[i + 1][(j + 1) % n], rings[i + 1][j]))
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
        me = bpy.data.meshes.new("torso")
        bm.to_mesh(me)
        for f in me.polygons:
            f.use_smooth = True
        o = bpy.data.objects.new("torso", me)
        bpy.context.scene.collection.objects.link(o)
        sub = o.modifiers.new("s", "SUBSURF")
        sub.levels = 2
        sub.render_levels = 2
        return self.keep(o, "torso", "suit")

    def glove(self, i, el, ha):
        s = self.s
        d = (ha - el).normalized()
        side = Vector((-d.z, 0, d.x)) * (1 if i == 0 else -1)
        palm = ha + d * 1.5 * s
        self.ellipsoid(palm, 6.0 * s, 4.2 * s, 6.2 * s, f"palm{i}", "gold", rot=Vector((0, 0, 1)).rotation_difference(d).to_euler())
        # Four fingers fanned along the hand's line, a thumb out to the side.
        for k in range(4):
            spread = (k - 1.5) * 0.16
            fd = (d + side * spread + Vector((0, -0.12, 0))).normalized()
            base = palm + d * 3.6 * s + side * (k - 1.5) * 2.7 * s
            self.capsule(base, base + fd * (6.6 - abs(k - 1.5) * 0.9) * s, 1.75 * s, 1.5 * s, f"finger{i}{k}", "gold", segs=14)
        tb = palm - side * 4.2 * s
        self.capsule(tb, tb + (d - side * 0.8).normalized() * 4.4 * s, 2.0 * s, 1.7 * s, f"thumb{i}", "gold", segs=14)

    def helmet(self, c):
        s = self.s
        r = HEAD_R * s
        self.ellipsoid(c, r * 0.97, r * 0.99, r, "helmet", "helmet")
        # The neck ring.
        bpy.ops.mesh.primitive_torus_add(major_radius=r * 0.62, minor_radius=1.1 * s, location=c - Vector((0, 0, r * 0.82)))
        bpy.ops.object.shade_smooth()
        self.keep(bpy.context.object, "neckring", "gold")
        # The visor: a band of the helmet's front, its lower edge rising to a point in the middle (the mask).
        bm = bmesh.new()
        cols, rows = 48, 8
        grid = []
        rv = r * 1.012
        for ci in range(cols + 1):
            a = math.radians(-74 + 148 * ci / cols)
            top = math.radians(12)
            notch = max(0.0, 1 - abs(a) / math.radians(26))
            bottom = math.radians(-20 + 12 * notch)
            col = []
            for ri in range(rows + 1):
                e = bottom + (top - bottom) * ri / rows
                x = rv * math.sin(a) * math.cos(e) * 0.97
                y = -rv * math.cos(a) * math.cos(e) * 0.99
                z = rv * math.sin(e)
                col.append(bm.verts.new((c.x + x, c.y + y, c.z + z)))
            grid.append(col)
        for ci in range(cols):
            for ri in range(rows):
                bm.faces.new((grid[ci][ri], grid[ci + 1][ri], grid[ci + 1][ri + 1], grid[ci][ri + 1]))
        me = bpy.data.meshes.new("visor")
        bm.to_mesh(me)
        for f in me.polygons:
            f.use_smooth = True
        o = bpy.data.objects.new("visor", me)
        bpy.context.scene.collection.objects.link(o)
        sol = o.modifiers.new("t", "SOLIDIFY")
        sol.thickness = 0.8 * s
        self.keep(o, "visor", "visor")
        # A gold rim round the visor.
        for edge in ("top", "bottom"):
            pts = []
            for ci in range(cols + 1):
                a = math.radians(-74 + 148 * ci / cols)
                notch = max(0.0, 1 - abs(a) / math.radians(26))
                e = math.radians(12) if edge == "top" else math.radians(-20 + 12 * notch)
                rr = r * 1.03
                pts.append(Vector((c.x + rr * math.sin(a) * math.cos(e) * 0.97, c.y - rr * math.cos(a) * math.cos(e) * 0.99, c.z + rr * math.sin(e))))
            self.tube(pts, 0.75 * s, f"visorrim{edge}", "gold")
        # Three cyan lines over the crown, front to back.
        for k, az in enumerate((-16, 0, 16)):
            pts = []
            for j in range(16):
                e = math.radians(22 + 60 * j / 15)
                a = math.radians(az) * (1 - j / 20)
                rr = r * 1.006
                pts.append(Vector((c.x + rr * math.sin(a) * math.cos(e), c.y - rr * math.cos(a) * math.cos(e), c.z + rr * math.sin(e))))
            self.tube(pts, 0.55 * s, f"crownline{k}", "crown_line")

    def cape(self, sh, hip):
        """A gold cape from the shoulders to below the knees, flaring, with the art's pointed hem; cloth folds."""
        s = self.s
        top_z = sh[0].z - 2 * s
        hem_z = self.v((0, 168)).z
        win = self.p["ha"][0][1] < 60
        w0 = abs(sh[1].x - sh[0].x) / 2 + 4 * s
        w1 = (44 if win else 34) * s
        bm = bmesh.new()
        U, V = 40, 28
        grid = []
        for vi in range(V + 1):
            v = vi / V
            row = []
            for ui in range(U + 1):
                u = -1 + 2 * ui / U
                x = u * (w0 + (w1 - w0) * v ** 0.8)
                hem = (hem_z + (top_z - hem_z) * 0.0)
                # The pointed hem: three points (centre and both sides), shallow notches between.
                pt = 0.5 * (1 - abs(math.sin(u * math.pi * 1.0))) * 10 * s
                z = top_z + (hem - top_z) * v - (pt * v ** 6)
                fold = 1.6 * s * math.sin(u * 7.5 + 0.6) * v ** 1.2
                y = (10 * s + 6 * s * v + 3 * s * (1 - abs(u))) + fold
                row.append(bm.verts.new((x, y + hip.y, z)))
            grid.append(row)
        for vi in range(V):
            for ui in range(U):
                bm.faces.new((grid[vi][ui], grid[vi][ui + 1], grid[vi + 1][ui + 1], grid[vi + 1][ui]))
        me = bpy.data.meshes.new("cape")
        bm.to_mesh(me)
        for f in me.polygons:
            f.use_smooth = True
        o = bpy.data.objects.new("cape", me)
        bpy.context.scene.collection.objects.link(o)
        sol = o.modifiers.new("t", "SOLIDIFY")
        sol.thickness = 0.9 * s
        sub = o.modifiers.new("s", "SUBSURF")
        sub.levels = 1
        sub.render_levels = 2
        self.keep(o, "cape", "cape")


def build(pose="win", location=(0, 0, 0), height=1.7, rotation_z=0.0, materials=None):
    """Builds the Captain in a pose, his soles at `location`, `height` tall (helmet top to soles); returns the parent."""
    scale = height / ART_HEIGHT
    b = Builder(pose, materials or MATERIALS, scale)
    parts = b.build()
    parent = bpy.data.objects.new("captain", None)
    bpy.context.scene.collection.objects.link(parent)
    for o in parts:
        o.parent = parent
    parent.location = location
    parent.rotation_euler = (0, 0, rotation_z)
    return parent
