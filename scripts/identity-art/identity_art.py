"""
Joulz identity art, rendered in Blender (session S5, 27 Nov 2026; Joe: "the avatars should be really cool").

Step 1, the style sheet: one avatar (Captain Joulz) in its paint and three finishes, the Storm emblem with its
division pips, one enamel pin in each of the four shapes, the gold trophy and the gold podium step. Nothing in the
app reads these yet; they are for Joe's approval of the look before the full set is rendered.

Every shape comes from the approved geometry (docs/art/source/gen.py, docs/art/badges/source/badges2.py,
docs/art/avatars/source/avatars.py): the same SVG paths, read into Blender curves, extruded, bevelled and given real
materials (the metals' stops are the --jz-metal-* tokens; champagne gold #E2C07A, cyan #22E4FF). Cycles on the CPU,
a fixed seed and sample count, the OpenImageDenoise filter, a procedural studio (no image files), so a render is
reproducible from this script alone.

Usage (Blender as a Python module, outside the project):
    python -m venv <dir>/bpyvenv && <dir>/bpyvenv/bin/pip install bpy pillow
    <dir>/bpyvenv/bin/python scripts/identity-art/identity_art.py [piece ...] [--out=<dir>] [--size=512] [--samples=96]

Writes <out>/<piece>.png (RGBA, transparent background); default out docs/art/blender/style-sheet/ (kept there as
WebP at quality 90, the masters the contact sheet reads).
"""
import math
import re
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent.parent

# ---------------------------------------------------------------------------------------------------------------
# Colours (sRGB hex → linear)
# ---------------------------------------------------------------------------------------------------------------


def lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexc(h, a=1.0):
    h = h.lstrip("#")
    return (lin(int(h[0:2], 16)), lin(int(h[2:4], 16)), lin(int(h[4:6], 16)), a)


# The --jz-metal-* stops (tokens.css), light → dark: 1, 2, 3, 4.
METALS = {
    "bronze": ("#F6D2AE", "#D49461", "#9A5E30", "#E2AB76"),
    "silver": ("#FFFFFF", "#D3DCEF", "#97A4C0", "#E6ECF8"),
    "gold": ("#FBEDC4", "#E6C67E", "#D2AC5E", "#EED79C"),
    "platinum": ("#F2FCFF", "#AEEAF7", "#62B9CE", "#D6F7FF"),
    "obsidian": ("#4A5680", "#1E2640", "#0B0F1C", "#36406A"),
}
CHAMPAGNE = "#E2C07A"
CYAN = "#22E4FF"
INK = "#06080F"

# ---------------------------------------------------------------------------------------------------------------
# SVG path → bezier splines
# ---------------------------------------------------------------------------------------------------------------

_TOK = re.compile(r"[AaCcHhLlMmQqSsVvZz]|-?(?:\d+\.?\d*|\.\d+)(?:[eE]-?\d+)?")


def _arc_to_cubics(p0, rx, ry, phi, fa, fs, p1):
    """SVG arc (endpoint form) as cubic segments, the W3C implementation note's conversion."""
    x1, y1 = p0
    x2, y2 = p1
    if rx == 0 or ry == 0 or (x1 == x2 and y1 == y2):
        return [(p0, p0, p1, p1)]
    rx, ry = abs(rx), abs(ry)
    cp, sp = math.cos(math.radians(phi)), math.sin(math.radians(phi))
    dx, dy = (x1 - x2) / 2, (y1 - y2) / 2
    x1p, y1p = cp * dx + sp * dy, -sp * dx + cp * dy
    lam = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry)
    if lam > 1:
        rx, ry = rx * math.sqrt(lam), ry * math.sqrt(lam)
    num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
    den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
    co = math.sqrt(max(0.0, num / den)) * (-1 if fa == fs else 1)
    cxp, cyp = co * rx * y1p / ry, -co * ry * x1p / rx
    cx = cp * cxp - sp * cyp + (x1 + x2) / 2
    cy = sp * cxp + cp * cyp + (y1 + y2) / 2

    def ang(u, v):
        a = math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1])
        return a

    t1 = ang((1, 0), ((x1p - cxp) / rx, (y1p - cyp) / ry))
    dt = ang(((x1p - cxp) / rx, (y1p - cyp) / ry), ((-x1p - cxp) / rx, (-y1p - cyp) / ry))
    if not fs and dt > 0:
        dt -= 2 * math.pi
    elif fs and dt < 0:
        dt += 2 * math.pi
    n = max(1, int(math.ceil(abs(dt) / (math.pi / 2) - 1e-9)))
    d = dt / n
    k = 4 / 3 * math.tan(d / 4)
    out = []

    def pt(t):
        x, y = rx * math.cos(t), ry * math.sin(t)
        return (cp * x - sp * y + cx, sp * x + cp * y + cy)

    def dv(t):
        x, y = -rx * math.sin(t), ry * math.cos(t)
        return (cp * x - sp * y, sp * x + cp * y)

    for i in range(n):
        a, b = t1 + i * d, t1 + (i + 1) * d
        pa, pb, da, db = pt(a), pt(b), dv(a), dv(b)
        out.append((pa, (pa[0] + k * da[0], pa[1] + k * da[1]), (pb[0] - k * db[0], pb[1] - k * db[1]), pb))
    out[0] = (p0,) + out[0][1:]
    out[-1] = out[-1][:3] + (p1,)
    return out


def parse_path(d):
    """A path's subpaths, each [segments, closed]; a segment is four points (p0, c1, c2, p1) in SVG units."""
    toks = _TOK.findall(d)
    i = 0
    subs = []
    cur = None
    pos = (0.0, 0.0)
    start = pos
    cmd = None
    last_c = None

    def num():
        nonlocal i
        v = float(toks[i])
        i += 1
        return v

    def line(p):
        nonlocal pos
        cur[0].append((pos, pos, p, p))
        pos = p

    while i < len(toks):
        t = toks[i]
        if re.match(r"[A-Za-z]", t):
            cmd = t
            i += 1
            if cmd in "Zz":
                if cur is not None:
                    if abs(pos[0] - start[0]) > 1e-6 or abs(pos[1] - start[1]) > 1e-6:
                        line(start)
                    cur[1] = True
                pos = start
                cur = None
                continue
        rel = cmd.islower()
        c = cmd.upper()
        ox, oy = pos if rel else (0.0, 0.0)
        if c == "M":
            p = (num() + ox, num() + oy)
            cur = [[], False]
            subs.append(cur)
            pos = start = p
            cmd = "l" if rel else "L"
            last_c = None
            continue
        if cur is None:
            cur = [[], False]
            subs.append(cur)
            start = pos
        if c == "L":
            line((num() + ox, num() + oy))
            last_c = None
        elif c == "H":
            line((num() + (pos[0] if rel else 0), pos[1]))
            last_c = None
        elif c == "V":
            line((pos[0], num() + (pos[1] if rel else 0)))
            last_c = None
        elif c == "C":
            c1 = (num() + ox, num() + oy)
            c2 = (num() + ox, num() + oy)
            p = (num() + ox, num() + oy)
            cur[0].append((pos, c1, c2, p))
            last_c = c2
            pos = p
        elif c == "S":
            c1 = (2 * pos[0] - last_c[0], 2 * pos[1] - last_c[1]) if last_c else pos
            c2 = (num() + ox, num() + oy)
            p = (num() + ox, num() + oy)
            cur[0].append((pos, c1, c2, p))
            last_c = c2
            pos = p
        elif c == "Q":
            q = (num() + ox, num() + oy)
            p = (num() + ox, num() + oy)
            c1 = (pos[0] + 2 / 3 * (q[0] - pos[0]), pos[1] + 2 / 3 * (q[1] - pos[1]))
            c2 = (p[0] + 2 / 3 * (q[0] - p[0]), p[1] + 2 / 3 * (q[1] - p[1]))
            cur[0].append((pos, c1, c2, p))
            last_c = None
            pos = p
        elif c == "A":
            rx, ry, phi, fa, fs = num(), num(), num(), num(), num()
            p = (num() + ox, num() + oy)
            cur[0].extend(_arc_to_cubics(pos, rx, ry, phi, int(fa), int(fs), p))
            last_c = None
            pos = p
        else:
            raise ValueError(f"path command {cmd} not handled")
    return [s for s in subs if s[0]]


# ---------------------------------------------------------------------------------------------------------------
# Scene helpers
# ---------------------------------------------------------------------------------------------------------------

VIEW = ("Standard", "Medium High Contrast", -0.9)
S = 1 / 60.0  # one SVG unit in Blender units: a 120-unit artboard spans 2


class Frame:
    """Maps an artboard's SVG units to Blender: centre (cx, cy) at the origin, y up."""

    def __init__(self, cx=60.0, cy=60.0, scale=S):
        self.cx, self.cy, self.s = cx, cy, scale

    def xy(self, p):
        return ((p[0] - self.cx) * self.s, -(p[1] - self.cy) * self.s)


def transform_path(d, tx=0.0, ty=0.0, sc=1.0, about=None):
    """A path string's subpaths with every point scaled (about a point, else the origin) then moved."""
    subs = parse_path(d)
    ax, ay = about if about else (0.0, 0.0)

    def f(p):
        return ((p[0] - ax) * sc + ax + tx, (p[1] - ay) * sc + ay + ty)

    return [[[tuple(f(q) for q in seg) for seg in segs], closed] for segs, closed in subs]


def mirror_x(subs, axis=60.0):
    return [[[tuple((2 * axis - q[0], q[1]) for q in seg) for seg in segs], closed] for segs, closed in subs]


def curve_from(name, subs, frame, z=0.0, closed_fill=True):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "2D" if closed_fill else "3D"
    cu.resolution_u = 24
    for segs, closed in subs:
        pts = [seg[0] for seg in segs]
        n = len(segs)
        cyc = closed or (abs(segs[-1][3][0] - segs[0][0][0]) < 1e-6 and abs(segs[-1][3][1] - segs[0][0][1]) < 1e-6)
        if not cyc:
            n += 1
            pts.append(segs[-1][3])
        sp = cu.splines.new("BEZIER")
        sp.bezier_points.add(n - 1)
        sp.use_cyclic_u = cyc
        for k in range(n):
            bp = sp.bezier_points[k]
            co = frame.xy(pts[k])
            bp.co = (co[0], co[1], z)
            inc = segs[k - 1] if (k > 0 or cyc) else None
            out = segs[k] if k < len(segs) else None
            hl = frame.xy(inc[2]) if inc else co
            hr = frame.xy(out[1]) if out else co
            bp.handle_left_type = bp.handle_right_type = "FREE"
            bp.handle_left = (hl[0], hl[1], z)
            bp.handle_right = (hr[0], hr[1], z)
    ob = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(ob)
    return ob


def slab(name, d, frame, z0, depth, bevel, mat, tx=0.0, ty=0.0, sc=1.0, about=None, subs=None):
    """A filled path extruded from z0 to z0 + depth, its edges rounded by `bevel` (all in Blender units)."""
    subs = subs if subs is not None else transform_path(d, tx, ty, sc, about)
    ob = curve_from(name, subs, frame)
    cu = ob.data
    cu.fill_mode = "BOTH"
    b = min(bevel, depth / 2 - 1e-4) if depth > 0 else 0
    cu.extrude = max(0.0, depth / 2 - b)
    cu.bevel_depth = b
    cu.bevel_resolution = 6
    cu.offset = -b if b else 0.0
    ob.location.z = z0 + depth / 2
    ob.data.materials.append(mat)
    return ob


def tube(name, d, frame, z, radius, mat, tx=0.0, ty=0.0, sc=1.0, about=None, subs=None, flat=1.0):
    """A stroked path as a round tube of `radius` (Blender units) lying at height z."""
    subs = subs if subs is not None else transform_path(d, tx, ty, sc, about)
    ob = curve_from(name, subs, frame, z=0.0, closed_fill=False)
    cu = ob.data
    cu.fill_mode = "FULL"
    cu.bevel_depth = radius
    cu.bevel_resolution = 6
    cu.use_fill_caps = True
    ob.location.z = z
    ob.scale.z = flat
    ob.data.materials.append(mat)
    return ob


def lathe(name, profile, frame, mat, steps=96):
    """A body of revolution about the artboard's vertical axis through frame.cx; profile = [(radius, y)] SVG units."""
    mesh = bpy.data.meshes.new(name)
    verts = [((r) * frame.s, -(y - frame.cy) * frame.s, 0.0) for r, y in profile]
    edges = [(k, k + 1) for k in range(len(verts) - 1)]
    mesh.from_pydata(verts, edges, [])
    ob = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(ob)
    m = ob.modifiers.new("screw", "SCREW")
    m.axis = "Y"
    m.steps = steps
    m.render_steps = steps
    m.use_merge_vertices = True
    m.use_smooth_shade = True
    ob.modifiers.new("sub", "SUBSURF").levels = 1
    ob.data.materials.append(mat)
    for p in mesh.polygons:
        p.use_smooth = True
    return ob


def outline_points(subs, frame, step=0.4):
    """Every subpath sampled densely (SVG units step), as Blender-unit (x, y) arrays: the shape's edge."""
    import numpy as np

    pts = []
    for segs, _closed in subs:
        for p0, c1, c2, p1 in segs:
            n = max(2, int(math.dist(p0, p1) / step) + 2)
            for k in range(n):
                t = k / n
                u = 1 - t
                x = u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0]
                y = u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1]
                pts.append(frame.xy((x, y)))
    return np.array(pts)


class Dome:
    """A height field over a filled outline: 0 at the edge, rising as a rounded pillow to `height` (Blender units),
    `round` the share of the inradius over which it rounds (1: a full dome; less: a flat top with rounded edges)."""

    def __init__(self, subs, frame, height, round_=1.0, base=None):
        import numpy as np

        self.np = np
        self.edge = outline_points(subs, frame)
        self.height = height
        self.base = base
        # The inradius: the largest edge distance over a grid inside the outline.
        xs = np.linspace(self.edge[:, 0].min(), self.edge[:, 0].max(), 60)
        ys = np.linspace(self.edge[:, 1].min(), self.edge[:, 1].max(), 60)
        gx, gy = np.meshgrid(xs, ys)
        self.rmax = float(self.dist(np.stack([gx.ravel(), gy.ravel()], 1)).max())
        self.r = self.rmax * round_

    def dist(self, xy):
        np = self.np
        out = np.empty(len(xy))
        for i in range(0, len(xy), 4096):
            d = xy[i : i + 4096, None, :] - self.edge[None, :, :]
            out[i : i + 4096] = np.sqrt((d * d).sum(-1)).min(1)
        return out

    def z(self, xy):
        np = self.np
        t = np.clip(self.dist(xy) / self.r, 0, 1)
        h = self.height * np.sqrt(1 - (1 - t) ** 2)
        if self.base is not None:
            h = h + self.base.z(xy)
        return h


def inflate(name, subs, frame, z0, dome, mat, voxel=0.012, under=0.02):
    """A filled outline raised into `dome`'s height field (its back flat at z0 - under): a moulded, toy-like body.
    Built as a thin slab, remeshed into an even grid, then each top vertex lifted by the field."""
    import numpy as np

    ob = curve_from(name, subs, frame)
    ob.data.fill_mode = "BOTH"
    ob.data.extrude = under
    ob.location.z = z0
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.ops.object.convert(target="MESH")
    rm = ob.modifiers.new("rm", "REMESH")
    rm.mode = "SHARP"
    rm.octree_depth = 8
    rm.use_remove_disconnected = False
    bpy.ops.object.modifier_apply(modifier="rm")
    me = ob.data
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    top = co[:, 2] > 0
    lift = dome.z(co[top, :2])
    co[top, 2] = co[top, 2] + lift
    me.vertices.foreach_set("co", co.ravel())
    me.update()
    for poly in me.polygons:
        poly.use_smooth = True
    ob.modifiers.new("sub", "SUBSURF").levels = 1
    ob.data.materials.append(mat)
    return ob


# ---------------------------------------------------------------------------------------------------------------
# Materials
# ---------------------------------------------------------------------------------------------------------------


def _principled(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    return m, nt, p


def _grain(nt, p, scale=(180, 6, 6), strength=0.05):
    """A brushed or sandblasted micro-surface: noise into the normal."""
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = scale
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 4.0
    nz.inputs["Detail"].default_value = 8.0
    bm = nt.nodes.new("ShaderNodeBump")
    bm.inputs["Strength"].default_value = strength
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], nz.inputs["Vector"])
    nt.links.new(nz.outputs["Fac"], bm.inputs["Height"])
    nt.links.new(bm.outputs["Normal"], p.inputs["Normal"])


def metal(name, stops, finish="polished"):
    """A metal from its four token stops: base the second stop, edges tinted the first. finish: matte, brushed,
    polished (the tier ladder's three)."""
    m, nt, p = _principled(name)
    p.inputs["Base Color"].default_value = hexc(stops[1])
    p.inputs["Metallic"].default_value = 1.0
    p.inputs["Specular Tint"].default_value = hexc(stops[0])
    rough = {"matte": 0.42, "brushed": 0.26, "polished": 0.12}[finish]
    p.inputs["Roughness"].default_value = rough
    if finish == "brushed":
        p.inputs["Anisotropic"].default_value = 0.7
        _grain(nt, p, (220, 4, 4), 0.04)
    elif finish == "matte":
        _grain(nt, p, (60, 60, 60), 0.03)
    return m


def obsidian(name):
    m, nt, p = _principled(name)
    p.inputs["Base Color"].default_value = hexc("#0B0F1C")
    p.inputs["Metallic"].default_value = 0.4
    p.inputs["Roughness"].default_value = 0.22
    p.inputs["Coat Weight"].default_value = 0.35
    p.inputs["Coat Roughness"].default_value = 0.03
    return m


def enamel(name, colour, rough=0.05):
    """Hard glossy enamel: the colour under a clear coat."""
    m, nt, p = _principled(name)
    p.inputs["Base Color"].default_value = hexc(colour)
    p.inputs["Roughness"].default_value = 0.4
    p.inputs["Specular IOR Level"].default_value = 0.25
    p.inputs["Coat Weight"].default_value = 0.3
    p.inputs["Coat Roughness"].default_value = rough
    return m


def paint(name, colour):
    """Vinyl-toy paint: a soft colour under a deep clear coat (the avatar's main colour)."""
    m, nt, p = _principled(name)
    p.inputs["Base Color"].default_value = hexc(colour)
    p.inputs["Roughness"].default_value = 0.38
    p.inputs["Subsurface Weight"].default_value = 0.08
    p.inputs["Subsurface Radius"].default_value = (0.4, 0.2, 0.2)
    p.inputs["Coat Weight"].default_value = 1.0
    p.inputs["Coat Roughness"].default_value = 0.04
    return m


def glow(name, colour, strength=4.0, glass=None):
    """Emissive glass (visors, live cores): a glossy face lit from inside."""
    m, nt, p = _principled(name)
    p.inputs["Base Color"].default_value = hexc(glass or colour)
    p.inputs["Roughness"].default_value = 0.08
    p.inputs["Coat Weight"].default_value = 1.0
    p.inputs["Emission Color"].default_value = hexc(colour)
    p.inputs["Emission Strength"].default_value = strength
    return m


def chrome(name):
    m, nt, p = _principled(name)
    p.inputs["Base Color"].default_value = hexc("#E9EEF8")
    p.inputs["Metallic"].default_value = 1.0
    p.inputs["Roughness"].default_value = 0.035
    return m


def holographic(name):
    """Holographic foil: silver under a thin film whose thickness drifts across the surface (rainbow)."""
    m, nt, p = _principled(name)
    p.inputs["Base Color"].default_value = hexc("#B9C2D6")
    p.inputs["Metallic"].default_value = 1.0
    p.inputs["Roughness"].default_value = 0.14
    p.inputs["Thin Film IOR"].default_value = 1.9
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 3.5
    nz.inputs["Detail"].default_value = 3.0
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["To Min"].default_value = 180.0
    mr.inputs["To Max"].default_value = 1100.0
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    nt.links.new(nz.outputs["Fac"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], p.inputs["Thin Film Thickness"])
    return m


def lightning_core(name):
    """Lightning Core: smoked glass with a cyan-white core burning inside, brightest where the surface faces you."""
    m, nt, p = _principled(name)
    p.inputs["Base Color"].default_value = hexc("#0A2440")
    p.inputs["Roughness"].default_value = 0.06
    p.inputs["Coat Weight"].default_value = 1.0
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.55
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.elements[0].position = 0.0
    cr.elements[0].color = hexc("#EFFFFF")
    cr.elements[1].position = 0.62
    cr.elements[1].color = hexc("#0B3A66")
    e = cr.elements.new(0.3)
    e.color = hexc(CYAN)
    nt.links.new(lw.outputs["Facing"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], p.inputs["Emission Color"])
    p.inputs["Emission Strength"].default_value = 3.2
    return m


# ---------------------------------------------------------------------------------------------------------------
# Studio
# ---------------------------------------------------------------------------------------------------------------


def reset(size, samples):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    sc.cycles.seed = 7
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = "OPENIMAGEDENOISE"
    sc.cycles.max_bounces = 8
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = size
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.color_depth = "8"
    sc.view_settings.view_transform = VIEW[0]
    sc.view_settings.look = VIEW[1]
    sc.view_settings.exposure = VIEW[2]
    sc.render.threads_mode = "FIXED"
    sc.render.threads = 4
    _world(sc)
    return sc


def _world(sc):
    """A procedural photo studio: a dark navy room, a big warm softbox up-left, a cool strip right, a bright floor
    bounce ring at the horizon (it rims every bevel). Seen only in reflections (the film is transparent)."""
    w = bpy.data.worlds.new("studio")
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes["Background"]
    tc = nt.nodes.new("ShaderNodeTexCoord")

    def lobe(direction, power, colour, gain):
        dot = nt.nodes.new("ShaderNodeVectorMath")
        dot.operation = "DOT_PRODUCT"
        v = Vector(direction).normalized()
        dot.inputs[1].default_value = v
        nt.links.new(tc.outputs["Generated"], dot.inputs[0])
        clamp = nt.nodes.new("ShaderNodeMath")
        clamp.operation = "MAXIMUM"
        clamp.inputs[1].default_value = 0.0
        nt.links.new(dot.outputs["Value"], clamp.inputs[0])
        pw = nt.nodes.new("ShaderNodeMath")
        pw.operation = "POWER"
        pw.inputs[1].default_value = power
        nt.links.new(clamp.outputs[0], pw.inputs[0])
        mul = nt.nodes.new("ShaderNodeVectorMath")
        mul.operation = "SCALE"
        mul.inputs[0].default_value = tuple(c * gain for c in hexc(colour)[:3])
        nt.links.new(pw.outputs[0], mul.inputs["Scale"])
        return mul.outputs[0]

    terms = [
        lobe((-0.55, 0.55, 0.62), 10, "#FFFFFF", 9.0),  # key softbox, up-left, warm
        lobe((0.75, -0.15, 0.55), 18, "#DDEBFF", 5.0),  # strip, right, cool
        lobe((-0.18, 0.22, 1.0), 6, "#FFFFFF", 3.2),  # a big overhead softbox (the flat fronts)
        lobe((0.0, 0.0, 1.0), 1.5, "#9AA8C8", 0.6),  # the ceiling round it
        lobe((0.0, -1.0, 0.05), 3.0, "#F4F0EA", 0.7),  # floor bounce, below
        lobe((-0.9, -0.2, 0.2), 6, "#8FDDFF", 1.4),  # a cyan kicker, left
    ]
    acc = terms[0]
    for t in terms[1:]:
        add = nt.nodes.new("ShaderNodeVectorMath")
        add.operation = "ADD"
        nt.links.new(acc, add.inputs[0])
        nt.links.new(t, add.inputs[1])
        acc = add.outputs[0]
    base = nt.nodes.new("ShaderNodeVectorMath")
    base.operation = "ADD"
    base.inputs[1].default_value = tuple(c * 0.08 for c in hexc("#1E2640")[:3])
    nt.links.new(acc, base.inputs[0])
    nt.links.new(base.outputs[0], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 1.0


def light(name, loc, rot, size, energy, colour="#FFFFFF"):
    ld = bpy.data.lights.new(name, "AREA")
    ld.size = size
    ld.energy = energy
    ld.color = hexc(colour)[:3]
    ob = bpy.data.objects.new(name, ld)
    ob.location = loc
    ob.rotation_euler = [math.radians(a) for a in rot]
    bpy.context.collection.objects.link(ob)
    return ob


def camera(frame_w, tilt=0.0, lens=85.0, target=(0, 0, 0)):
    """A long lens on the piece's front, `tilt` degrees from above, framed to `frame_w` Blender units."""
    cd = bpy.data.cameras.new("cam")
    cd.lens = lens
    cd.sensor_width = 36.0
    dist = frame_w * lens / 36.0
    ob = bpy.data.objects.new("cam", cd)
    t = math.radians(tilt)
    ob.location = (target[0], target[1] - dist * math.sin(t), target[2] + dist * math.cos(t))
    ob.rotation_euler = (t, 0, 0)
    bpy.context.collection.objects.link(ob)
    bpy.context.scene.camera = ob
    return ob


def studio_lights(rim=220):
    light("key", (-3.2, 3.0, 6.0), (-30, -28, 0), 4.0, 380, "#FFFFFF")
    light("fill", (4.0, -1.0, 4.0), (10, 40, 0), 3.0, 110, "#D8E6FF")
    light("rim", (0.0, -4.5, 1.2), (75, 0, 0), 3.0, rim, "#FFF4E6")


def render(path):
    sc = bpy.context.scene
    sc.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


# ---------------------------------------------------------------------------------------------------------------
# The approved geometry
# ---------------------------------------------------------------------------------------------------------------

SHIELD = "M60 8 L106 24 V68 C106 100 86 122 60 132 C34 122 14 100 14 68 V24 Z"
BOLT = "M66 34 L44 74 H58 L52 104 L78 60 H63 Z"
WING = "M100 40 L128 30 L118 46 L132 44 L118 60 L128 62 L104 78 Z"
HELMET = "M28 54c0-15 9-26 22-26s22 11 22 26c0 11-8 18-22 21-14-3-22-10-22-21z"
VISOR = "M34 47h32l-3 9-8-3-5 6-5-6-8 3z"


def star16():
    pts = []
    for k in range(16):
        r = 54 if k % 2 == 0 else 46
        a = math.radians(k * 22.5 - 90)
        pts.append(f"{60 + r * math.cos(a):.2f} {60 + r * math.sin(a):.2f}")
    return "M" + " L".join(pts) + "Z"


def hexagon(r=54):
    return "M" + " L".join(f"{60 + r * math.cos(math.radians(60 * k - 90)):.2f} {60 + r * math.sin(math.radians(60 * k - 90)):.2f}" for k in range(6)) + "Z"


def circle(r=54, cx=60, cy=60):
    return f"M{cx - r} {cy} a{r} {r} 0 1 0 {2 * r} 0 a{r} {r} 0 1 0 {-2 * r} 0z"


# Joe's four enamel-pin shapes (27 Nov 2026): round = skill, hexagon = streaks, shield = competition, star = collection.
PIN_SHAPES = {
    "round": circle(54),
    "hexagon": hexagon(56),
    "shield": "M60 6 104 20v34c0 30-18 50-44 60C34 104 16 84 16 54V20z",
    "star": star16(),
}

# Icons from badges2.py `ic`: (kind, path) where kind is "fill" (a raised slab) or "stroke" (a raised tube).
ICONS = {
    "bulb": [("fill", "M60 36a16 16 0 0 0-9 29v7h18v-7a16 16 0 0 0-9-29z"), ("fill", "M54 75h12a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H54a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2z")],
    "flame": [("fill", "M60 36c4 10 16 14 16 28a16 16 0 0 1-32 0c0-8 4-12 8-16 0 6 3 9 6 9-2-8-2-14 2-21z")],
    "sword": [("stroke", "M48 74 76 46"), ("stroke", "M70 40l10 10"), ("stroke", "M44 66l10 10"), ("stroke", "M42 80l6-6")],
    "star": [("fill", "M60 36l7 15 16 2-12 11 3 16-14-8-14 8 3-16-12-11 16-2z")],
}

# Rarity → the pin's metal and enamel (the five-tier ladder: Common bronze, Rare silver, Epic gold, Elite obsidian,
# Legendary diamond-plated).
RARITY = {
    "Common": ("bronze", "matte", "#101733"),
    "Rare": ("silver", "brushed", "#101733"),
    "Epic": ("gold", "polished", "#101733"),
    "Elite": ("obsidian", "polished", "#3A2470"),
    "Legendary": ("platinum", "polished", "#0E3358"),
}

# ---------------------------------------------------------------------------------------------------------------
# Pieces
# ---------------------------------------------------------------------------------------------------------------


def build_emblem_storm():
    f = Frame(60, 74)
    gold = metal("gold", METALS["gold"], "polished")
    obs = obsidian("obsidian")
    face = obsidian("face")
    face.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = hexc("#141B33")
    pit = enamel("socket", "#0B0F1C", 0.2)
    # Wings behind the shield.
    for sub in (transform_path(WING), mirror_x(transform_path(WING))):
        slab("wing", None, f, 0.0, 0.09, 0.03, gold, subs=sub)
    # Crown of three bolts.
    for x, top, sc in ((36, 2, 0.34), (60, -12, 0.46), (84, 2, 0.34)):
        slab("crown", BOLT, f, 0.02, 0.08, 0.02, gold, tx=x - 61 * sc, ty=top - 34 * sc, sc=sc)
    # The shield: an obsidian body, a polished gold inner edge, a softly domed inner face, the gold bolt.
    slab("shield", SHIELD, f, 0.0, 0.16, 0.05, obs)
    tube("edge", SHIELD, f, 0.16, 0.028, gold, tx=6, ty=7, sc=0.9, flat=0.8)
    slab("face", SHIELD, f, 0.12, 0.08, 0.035, face, tx=60 * 0.2, ty=70 * 0.2, sc=0.8)
    slab("bolt", BOLT, f, 0.18, 0.08, 0.03, gold)
    # Division pips (two of three earned): gold diamonds, the third an empty socket rimmed in gold.
    for k in range(3):
        x0 = 60 + (k - 1) * 18
        d = f"M{x0} 140 l6 6 l-6 6 l-6 -6 z"
        if k < 2:
            slab("pip", d, f, 0.0, 0.07, 0.025, gold)
        else:
            slab("pipsocket", d, f, 0.0, 0.03, 0.01, pit)
            tube("piprim", d, f, 0.03, 0.012, gold)
    studio_lights()
    camera(2.95, tilt=4, target=(0, 0.02, 0))


def build_pin(shape, icon, rarity):
    f = Frame(60, 60)
    mname, mfin, enam = RARITY[rarity]
    base = obsidian("blacknickel") if mname == "obsidian" else metal(mname, METALS[mname], mfin)
    raised = obsidian("blacknickel2") if mname == "obsidian" else metal(mname + "-hi", METALS[mname], "polished")
    if mname == "obsidian":
        raised.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = hexc("#9AA3C8")
        raised.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 1.0
        raised.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.1
    fill = enamel("enamel", enam)
    d = PIN_SHAPES[shape]
    # Die-struck back plate, the raised polished rim, the enamel well, the struck icon on top.
    slab("plate", d, f, 0.0, 0.12, 0.04, base)
    tube("rim", d, f, 0.125, 0.055, raised, sc=0.93, about=(60, 60) if shape != "shield" else (60, 58), flat=0.7)
    slab("enamel", d, f, 0.1, 0.05, 0.012, fill, sc=0.86, about=(60, 60) if shape != "shield" else (60, 58))
    for kind, p in ICONS[icon]:
        if kind == "fill":
            slab("icon", p, f, 0.14, 0.07, 0.022, raised)
        else:
            tube("icon", p, f, 0.165, 0.045, raised, flat=0.8)
    studio_lights()
    camera(2.3, tilt=3)


def build_avatar(finish):
    """Captain Joulz's avatar (docs/art/avatars helmet): a medallion with the scene's stripes inlaid, the helmet a
    moulded vinyl-toy dome raised from its approved outline, the visor cyan glass and the ridges sitting on it."""
    f = Frame(50, 50)
    rim = metal("rim", METALS["obsidian"], "polished")
    rim.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = hexc("#2A3354")
    well = enamel("well", "#0E1430", 0.25)
    stripe_c = enamel("stripe-c", "#0F4B63", 0.2)
    stripe_g = enamel("stripe-g", "#5A4A2A", 0.2)
    slab("disc", circle(48, 50, 50), f, 0.0, 0.08, 0.03, rim)
    slab("well", circle(44.5, 50, 50), f, 0.05, 0.04, 0.008, well)
    # The scene's four diagonal bands, inlaid in the well: each band clipped to the well's circle in 2D.
    for k, x in enumerate((20, 46, 72, 98)):
        d = f"M{x - 3} -10 L{x + 3} -10 L{x - 27} 110 L{x - 33} 110 Z"
        s = slab("stripe", d, f, 0.084, 0.012, 0.0, stripe_c if k % 2 == 0 else stripe_g)
        cut = slab("clip", circle(44, 50, 50), f, 0.0, 0.2, 0.0, well)
        for o in (s, cut):
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.select_all(action="DESELECT")
            o.select_set(True)
            bpy.ops.object.convert(target="MESH")
        mod = s.modifiers.new("clip", "BOOLEAN")
        mod.operation = "INTERSECT"
        mod.solver = "EXACT"
        mod.object = cut
        cut.hide_render = True
        cut.hide_viewport = True
    mat = {
        "paint": lambda: paint("main", "#FF6BD6"),
        "chrome": lambda: chrome("chrome"),
        "holographic": lambda: holographic("holo"),
        "lightning-core": lambda: lightning_core("core"),
    }[finish]()
    helmet = transform_path(HELMET)
    dome = Dome(helmet, f, 0.34, round_=1.0)
    inflate("helmet", helmet, f, 0.09, dome, mat)
    # The visor: a dark gasket then the glass, both moulded on the dome's surface.
    visor_glass = glow("visor", CYAN, 2.4, glass="#0B6B80")
    ink = enamel("ink", INK, 0.1)
    gasket = transform_path(VISOR, sc=1.12, about=(50, 51.5))
    inflate("gasket", gasket, f, 0.09, Dome(gasket, f, 0.015, 0.3, base=dome), ink)
    visor = transform_path(VISOR)
    inflate("visor", visor, f, 0.09, Dome(visor, f, 0.035, 0.5, base=dome), visor_glass)
    ridge = glow("ridge", CYAN, 1.6, glass="#0B6B80")
    for d in ("M44 33v6", "M50 30v8", "M56 33v6"):
        sub = transform_path(d)
        ob = tube("ridge", None, f, 0.0, 0.016, ridge, subs=sub, flat=0.7)
        mid = sub[0][0][0][0], sub[0][0][-1][3] if False else sub[0][0][0][3]
        import numpy as np

        xy = np.array([f.xy(((sub[0][0][0][0][0] + sub[0][0][0][3][0]) / 2, (sub[0][0][0][0][1] + sub[0][0][0][3][1]) / 2))])
        ob.location.z = 0.09 + float(dome.z(xy)[0]) - 0.004
    if finish == "lightning-core":
        ring = glow("ring", CYAN, 6.0)
        tube("corering", circle(47.2, 50, 50), f, 0.085, 0.012, ring)
    studio_lights(rim=40)
    camera(1.85, tilt=4)


def build_trophy_gold():
    f = Frame(60, 78)
    gold = metal("gold", METALS["gold"], "polished")
    navy = enamel("plinth", "#1E2640", 0.15)
    # The cup, lid, stem knot and foot as one turned body.
    cup = [(0, 81.5), (8, 80), (19, 74), (27, 62), (31, 48), (32, 34), (32.5, 22), (34, 18.5), (33.5, 16.6), (31, 17.2), (30.5, 16)]
    lid = [(30.5, 16), (29, 11), (24, 6.5), (14, 3.6), (0, 2.8)]
    lathe("cup", cup + lid[1:], f, gold)
    stem = [(0, 81), (6.5, 82), (6, 88), (10.5, 89), (10.5, 91), (6, 92), (6, 97), (19, 98.5), (21, 100), (26, 110.5), (26.5, 112), (0, 112)]
    lathe("stem", stem, f, gold)
    # Handles: the approved curves as gold tubes.
    for d in ("M32 30 C8 30 8 66 40 70", "M88 30 C112 30 112 66 80 70"):
        tube("handle", d, f, 0.0, 0.07, gold)
    # The lid's bolt finial and the engraved bolt on the cup's front.
    fin = slab("finial", "M63 -16 L52 4 H59 L56 16 L69 -6 H62 Z", f, -0.05, 0.1, 0.03, gold)
    ink = metal("engrave", ("#B08A44", "#8C6A22", "#6E521A", "#A88440"), "matte")
    eb = slab("engraved", "M63 30 L52 50 H59 L56 66 L69 44 H62 Z", f, 0.56, 0.04, 0.012, ink)
    # The plinth: navy with a gold plate, on a gold slab.
    box = bpy.data.meshes.new("plinth")
    bpy.ops.mesh.primitive_cube_add(size=1)
    pl = bpy.context.active_object
    pl.scale = (68 * S, 22 * S, 48 * S)
    pl.location = (0, -(123 - 78) * S, 0)
    pl.modifiers.new("b", "BEVEL").width = 0.03
    pl.data.materials.append(navy)
    bpy.ops.mesh.primitive_cube_add(size=1)
    pt = bpy.context.active_object
    pt.scale = (40 * S, 10 * S, 0.04)
    pt.location = (0, -(123 - 78) * S, 24 * S + 0.01)
    pt.modifiers.new("b", "BEVEL").width = 0.012
    pt.data.materials.append(gold)
    bpy.ops.mesh.primitive_cube_add(size=1)
    sl = bpy.context.active_object
    sl.scale = (80 * S, 10 * S, 56 * S)
    sl.location = (0, -(139 - 78) * S, 0)
    sl.modifiers.new("b", "BEVEL").width = 0.03
    sl.data.materials.append(gold)
    for o in (pl, pt, sl):
        for m in o.modifiers:
            m.segments = 4
    studio_lights()
    camera(3.0, tilt=12, target=(0, -0.05, 0))


def build_podium_gold():
    """The first-place step: a wide gold block, its front face cut on two corners (the signature 14-unit cut), the
    bolt engraved at its right end (the left part stays clear for the winner's name and total)."""
    f = Frame(80, 60)
    gold = metal("gold", METALS["gold"], "brushed")
    ink = metal("engrave", ("#B08A44", "#8C6A22", "#6E521A", "#A88440"), "matte")
    face = "M14 30 H160 V76 L146 90 H0 V44 Z"
    slab("block", face, f, -0.7, 0.7, 0.03, gold)
    slab("bolt", BOLT, f, -0.01, 0.03, 0.008, ink, sc=0.5, about=(61, 69), tx=76, ty=-9)
    studio_lights()
    camera(3.0, tilt=14, target=(0.0, 0.0, -0.3))


PIECES = {
    "avatar-captain-paint": lambda: build_avatar("paint"),
    "avatar-captain-chrome": lambda: build_avatar("chrome"),
    "avatar-captain-holographic": lambda: build_avatar("holographic"),
    "avatar-captain-lightning-core": lambda: build_avatar("lightning-core"),
    "emblem-storm": build_emblem_storm,
    "pin-round-logic-master": lambda: build_pin("round", "bulb", "Epic"),
    "pin-hexagon-hot-streak": lambda: build_pin("hexagon", "flame", "Rare"),
    "pin-shield-giant-slayer": lambda: build_pin("shield", "sword", "Elite"),
    "pin-star-first-star": lambda: build_pin("star", "star", "Common"),
    "trophy-gold": build_trophy_gold,
    "podium-gold": build_podium_gold,
}


def main():
    args = sys.argv[1:]
    if "--" in args:
        args = args[args.index("--") + 1 :]
    opts = {a.split("=")[0][2:]: a.split("=", 1)[1] for a in args if a.startswith("--") and "=" in a}
    names = [a for a in args if not a.startswith("--")] or list(PIECES)
    out = Path(opts.get("out", ROOT / "docs/art/blender/style-sheet"))
    out.mkdir(parents=True, exist_ok=True)
    size = int(opts.get("size", 512))
    samples = int(opts.get("samples", 96))
    for n in names:
        reset(size, samples)
        PIECES[n]()
        render(out / f"{n}.png")
        print("rendered", n)


if __name__ == "__main__":
    main()
