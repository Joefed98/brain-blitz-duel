"""
Joulz identity art, rendered in Blender (session S5, 27 Nov 2026; Joe: "the avatars should be really cool").

Step 1, the style sheets (Joe's approval of the look before the full set). Sheet 2 (28 Nov 2026): all seven tier
emblems climbing from matte to brushed to polished to a live current; Captain Joulz's avatar with the helmet at 70 % of
the disc, its finishes, three player colours and the three tint passes the app colours; an enamel pin in each shape
(both collection stars); the gold trophy; two podium options. Nothing in the app reads these yet.

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
# Top 500's platinum-white: --jz-metal-silver's light stops lifted toward white (stops 1-4, light to dark).
METALS["pearl"] = ("#FFFFFF", "#F1F5FC", "#C9D3EA", "#FAFCFF")
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


def enamel(name, colour, rough=0.05, guilloche=False):
    """Hard glossy enamel: the colour under a clear coat. guilloche: fine engraved rings under translucent enamel
    (the jeweller's finish: the pattern catches the light through the colour, so the enamel reads deep)."""
    m, nt, p = _principled(name)
    p.inputs["Base Color"].default_value = hexc(colour)
    p.inputs["Roughness"].default_value = 0.4
    p.inputs["Specular IOR Level"].default_value = 0.25
    p.inputs["Coat Weight"].default_value = 0.3
    p.inputs["Coat Roughness"].default_value = rough
    if guilloche:
        p.inputs["Coat Weight"].default_value = 0.55
        p.inputs["Coat Roughness"].default_value = 0.012
        p.inputs["Coat IOR"].default_value = 1.6
        tc = nt.nodes.new("ShaderNodeTexCoord")
        wv = nt.nodes.new("ShaderNodeTexWave")
        wv.wave_type = "RINGS"
        wv.rings_direction = "SPHERICAL"
        wv.inputs["Scale"].default_value = 9.0
        wv.inputs["Distortion"].default_value = 0.0
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].color = hexc(colour)
        r, g, bl, _ = hexc(colour)
        ramp.color_ramp.elements[1].color = (min(1, r * 1.7 + 0.002), min(1, g * 1.7 + 0.002), min(1, bl * 1.7 + 0.004), 1)
        nt.links.new(tc.outputs["Object"], wv.inputs["Vector"])
        nt.links.new(wv.outputs["Fac"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"])
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
    """Holographic foil: a metal whose colour runs through the spectrum with the viewing angle and a drifting noise,
    under a thin film (the rainbow holds even at 36 px)."""
    m, nt, p = _principled(name)
    p.inputs["Metallic"].default_value = 1.0
    p.inputs["Roughness"].default_value = 0.16
    p.inputs["Thin Film IOR"].default_value = 1.8
    p.inputs["Thin Film Thickness"].default_value = 380.0
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = 2.6
    nz.inputs["Detail"].default_value = 2.0
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.6
    add = nt.nodes.new("ShaderNodeMath")
    add.operation = "MULTIPLY_ADD"
    add.inputs[1].default_value = 1.4
    hsv = nt.nodes.new("ShaderNodeCombineColor")
    hsv.mode = "HSV"
    hsv.inputs[1].default_value = 0.5
    hsv.inputs[2].default_value = 1.0
    fr = nt.nodes.new("ShaderNodeMath")
    fr.operation = "FRACT"
    nt.links.new(tc.outputs["Object"], nz.inputs["Vector"])
    nt.links.new(lw.outputs["Facing"], add.inputs[0])
    nt.links.new(nz.outputs["Fac"], add.inputs[2])
    nt.links.new(add.outputs[0], fr.inputs[0])
    nt.links.new(fr.outputs[0], hsv.inputs[0])
    nt.links.new(hsv.outputs[0], p.inputs["Base Color"])
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

    def lobe(direction, power, colour, gain, key=None):
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
        if key:
            LOBES[key] = (mul, colour)
        return mul.outputs[0]

    terms = [
        lobe((-0.55, 0.55, 0.62), 10, "#FFFFFF", 9.0),  # key softbox, up-left, warm
        lobe((0.75, -0.15, 0.55), 18, "#DDEBFF", 5.0),  # strip, right, cool
        lobe((-0.18, 0.22, 1.0), 6, "#FFFFFF", 3.2, "overhead"),  # a big overhead softbox (the flat fronts)
        lobe((0.0, 0.0, 1.0), 1.5, "#9AA8C8", 0.6),  # the ceiling round it
        lobe((0.0, -1.0, 0.05), 3.0, "#F4F0EA", 0.7, "floor"),  # floor bounce, below
        lobe((-0.9, -0.2, 0.2), 6, "#8FDDFF", 1.4, "kicker"),  # a cyan kicker, left
        lobe((-0.45, -0.85, -0.1), 5, "#FFFFFF", 0.0, "front"),  # a front softbox (off unless a piece asks)
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


LOBES = {}


def world_gain(key, gain):
    """Set one named studio lobe's brightness for this piece (floor: the bounce below; front: a softbox facing the
    piece's front, off by default)."""
    mul, colour = LOBES[key]
    mul.inputs[0].default_value = tuple(c * gain for c in hexc(colour)[:3])


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
    if rim:
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
    "star5": "M" + " L".join(f"{60 + (56 if k % 2 == 0 else 30) * math.cos(math.radians(k * 36 - 90)):.2f} {63 + (56 if k % 2 == 0 else 30) * math.sin(math.radians(k * 36 - 90)):.2f}" for k in range(10)) + "Z",
}

# Icons from badges2.py `ic`: (kind, path) where kind is "fill" (a raised slab) or "stroke" (a raised tube).
ICONS = {
    "bulb": [("fill", "M60 36a16 16 0 0 0-9 29v7h18v-7a16 16 0 0 0-9-29z"), ("fill", "M54 75h12a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H54a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2z")],
    "flame": [("fill", "M60 36c4 10 16 14 16 28a16 16 0 0 1-32 0c0-8 4-12 8-16 0 6 3 9 6 9-2-8-2-14 2-21z")],
    # The sword drawn heavier than badges2.py's 5-unit stroke (Joe, 27 Nov 2026: it must hold at 36 px).
    "sword": [("stroke-heavy", "M50 72 76 46"), ("stroke-heavy", "M42 64l14 14"), ("stroke-heavy", "M41 81l5-5")],
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


# Tier ladder (tiers.ts: Spark, Charge, Volt, Surge, Storm, Lightning, then Top 500). Each tier keeps today's metal
# and adds to the silhouette, so a tier reads at 36 px by shape and finish, not colour alone:
#   Spark      bronze, matte      plain shield, bolt in outline
#   Charge     silver, brushed    + shoulder fins, bolt half filled
#   Volt       gold, brushed      + swept fins, solid bolt
#   Surge      platinum, polished + full wings, speed lines
#   Storm      obsidian and gold, polished  + gold wings, crown of three bolts
#   Lightning  electric gold, polished, live current  + rays and the current's arcs
#   Top 500    Lightning's emblem on a numbered plate (the number is the app's: the plate is left blank)
TIERS = {
    "spark": dict(metal="bronze", finish="matte", fins=0, bolt="outline"),
    "charge": dict(metal="silver", finish="brushed", fins=1, bolt="half"),
    "volt": dict(metal="gold", finish="brushed", fins=2, bolt="solid"),
    "surge": dict(metal="platinum", finish="polished", fins=3, bolt="solid", speed=True),
    "storm": dict(metal="obsidian", finish="polished", fins=4, bolt="gold", crown=True),
    "lightning": dict(metal="gold", finish="polished", fins=4, bolt="ink", crown=True, rays=True, current="strong"),
    # Top 500 (Joe, 28 Nov 2026: it must read as the top of the ladder at 36 px, not as a second Lightning): its own
    # platinum-white body under gold wings, rays and a larger crown of five bolts, on the numbered plate.
    "top500": dict(metal="pearl", finish="polished", fins=4, bolt="inkgold", crown="grand", rays=True, current=True, plate=True),
}
FIN = "M104 26 L120 18 L114 34 L104 42 Z"
INK_ON = {"bronze": "#2A1608", "silver": "#151B2C", "gold": "#1A1206", "platinum": "#08202A", "pearl": "#151B2C"}


def glow_disc(name, frame, cx, cy, r, colour, z, strength=1.6, alpha=0.75):
    """A soft halo behind a piece: emission fading to clear at its rim (it keeps its alpha on the transparent film)."""
    bpy.ops.mesh.primitive_circle_add(vertices=96, radius=r * frame.s, fill_type="NGON")
    ob = bpy.context.active_object
    ob.name = name
    x, y = frame.xy((cx, cy))
    ob.location = (x, y, z)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    out = nt.nodes["Material Output"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    gr = nt.nodes.new("ShaderNodeTexGradient")
    gr.gradient_type = "SPHERICAL"
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1 / (r * frame.s),) * 3
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = hexc(colour)
    em.inputs["Strength"].default_value = strength
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    pw = nt.nodes.new("ShaderNodeMath")
    pw.operation = "POWER"
    pw.inputs[1].default_value = 2.2
    mu = nt.nodes.new("ShaderNodeMath")
    mu.operation = "MULTIPLY"
    mu.inputs[1].default_value = alpha
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], gr.inputs["Vector"])
    nt.links.new(gr.outputs["Fac"], pw.inputs[0])
    nt.links.new(pw.outputs[0], mu.inputs[0])
    nt.links.new(mu.outputs[0], mix.inputs["Fac"])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    ob.data.materials.append(m)
    return ob


def current_arcs(frame, seed, cx, cy, rx, ry, z, n=5, strong=False):
    """The live current: jagged cyan arcs crackling round a piece (a still frame of the app's animated current), from
    a seeded generator, so the same every render."""
    import random

    rnd = random.Random(seed)
    core = glow("arc", "#E6FDFF", 40.0 if strong else 14.0)
    halo = glow("arc-halo", CYAN, 16.0 if strong else 5.0)
    rc, rh = (0.024, 0.06) if strong else (0.011, 0.026)
    for k in range(n):
        a0 = rnd.uniform(0, 2 * math.pi)
        sweep = rnd.uniform(0.5, 0.9)
        pts = []
        steps = 9
        for i in range(steps + 1):
            a = a0 + sweep * i / steps
            j = rnd.uniform(-4.5, 4.5) if 0 < i < steps else 0
            pts.append((cx + (rx + j) * math.cos(a), cy + (ry + j) * math.sin(a)))
        d = "M" + " L".join(f"{x:.2f} {y:.2f}" for x, y in pts)
        tube("arc", d, frame, z, rc, core)
        tube("archalo", d, frame, z - 0.01, rh, halo, flat=0.3)


def build_emblem(tier):
    t = TIERS[tier]
    f = Frame(60, 72)
    obs_body = t["metal"] == "obsidian"
    gold = metal("gold", METALS["gold"], "polished")
    body = obsidian("obsidian") if obs_body else metal(t["metal"], METALS[t["metal"]], t["finish"])
    face_m = obsidian("face") if obs_body else metal(t["metal"] + "-face", METALS[t["metal"]], t["finish"])
    if obs_body:
        face_m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = hexc("#121933")
    else:
        # The face a shade deeper than the rim (the approved art's gradient B), so the rim reads as a raised edge.
        face_m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = hexc(METALS[t["metal"]][2])
    wing_m = metal("platinum-w", METALS["platinum"], "polished") if t["metal"] == "platinum" else (gold if t["fins"] >= 4 else body)
    ink = enamel("ink", INK_ON.get(t["metal"], INK), 0.08)

    if t.get("rays"):
        glow_disc("glow", f, 60, 70, 78, "#F3D894", -0.3, strength=1.4, alpha=0.6)
        if t.get("current") == "strong":
            glow_disc("cyanglow", f, 60, 72, 92, CYAN, -0.25, strength=5.0, alpha=0.9)
        for ang in range(0, 360, 30):
            ob = slab("ray", "M53 70 L67 70 L60 -8 Z", f, -0.12, 0.05, 0.015, gold)
            ob.data.transform(__import__("mathutils").Matrix.Rotation(math.radians(-ang), 4, "Z"))
            ob.location.x, ob.location.y = 0.0, f.xy((60, 70))[1]
            ob.data.transform(__import__("mathutils").Matrix.Translation((0, -f.xy((60, 70))[1], 0)))
    # Fins and wings behind the shield, growing tier by tier.
    if t["fins"] == 1:
        for sub in (transform_path(FIN), mirror_x(transform_path(FIN))):
            slab("fin", None, f, 0.0, 0.1, 0.03, wing_m, subs=sub)
    elif t["fins"] == 2:
        for sub in (transform_path(WING, sc=0.72, about=(104, 58)), mirror_x(transform_path(WING, sc=0.72, about=(104, 58)))):
            slab("fin", None, f, 0.0, 0.1, 0.03, wing_m, subs=sub)
    elif t["fins"] >= 3:
        big = 1.12 if t.get("rays") else 1.0
        for sub in (transform_path(WING, sc=big, about=(104, 58)), mirror_x(transform_path(WING, sc=big, about=(104, 58)))):
            slab("wing", None, f, 0.0, 0.12, 0.035, wing_m, subs=sub)
            tube("wingrim", None, f, 0.12, 0.012, wing_m, subs=sub, flat=0.6)
    if t.get("crown"):
        crown = ((36, 2, 0.36), (60, -13, 0.5), (84, 2, 0.36))
        if t["crown"] == "grand":
            crown = ((22, -2, 0.34), (41, -16, 0.44), (60, -30, 0.6), (79, -16, 0.44), (98, -2, 0.34))
        for x, top, sc in crown:
            slab("crown", BOLT, f, 0.02, 0.11, 0.03, gold, tx=x - 61 * sc, ty=top - 34 * sc, sc=sc)
    # The shield: a thick body, a raised rim, a deeper inner face, then the bolt.
    slab("shield", SHIELD, f, 0.0, 0.2, 0.06, body)
    if obs_body:
        tube("edge", SHIELD, f, 0.2, 0.03, gold, tx=6, ty=7, sc=0.9, flat=0.8)
    slab("face", SHIELD, f, 0.15, 0.08, 0.03, face_m, tx=60 * 0.2, ty=70 * 0.2, sc=0.8)
    bolt_top = 0.23
    if t["bolt"] == "outline":
        tube("bolt", BOLT, f, bolt_top + 0.02, 0.04, ink, flat=0.7)
    elif t["bolt"] == "half":
        tube("bolt", BOLT, f, bolt_top + 0.02, 0.04, ink, flat=0.7)
        half = slab("bolthalf", BOLT, f, bolt_top - 0.02, 0.05, 0.012, ink)
        box = slab("halfclip", "M30 72 H90 V112 H30 Z", f, 0.0, 0.5, 0.0, ink)
        for o in (half, box):
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.select_all(action="DESELECT")
            o.select_set(True)
            bpy.ops.object.convert(target="MESH")
        mod = half.modifiers.new("half", "BOOLEAN")
        mod.operation = "INTERSECT"
        mod.solver = "EXACT"
        mod.object = box
        box.hide_render = box.hide_viewport = True
    elif t["bolt"] == "inkgold":
        slab("bolt", BOLT, f, bolt_top - 0.02, 0.09, 0.03, ink, sc=1.08, about=(61, 69))
        tube("boltrim", BOLT, f, bolt_top + 0.07, 0.018, gold, sc=1.08, about=(61, 69), flat=0.7)
    elif t["bolt"] == "gold":
        slab("bolt", BOLT, f, bolt_top - 0.02, 0.1, 0.035, gold, sc=1.08, about=(61, 69))
    else:
        slab("bolt", BOLT, f, bolt_top - 0.02, 0.09, 0.03, ink, sc=1.08, about=(61, 69))
    if t.get("speed"):
        for d in ("M28 60 H42", "M26 70 H40", "M28 80 H42"):
            tube("speed", d, f, bolt_top + 0.01, 0.03, ink, flat=0.7)
    if t.get("plate"):
        # Top 500's numbered plate: an obsidian bar with a gold rim under the shield; the app sets the number on it.
        plate = "M26 132 H94 L100 140 L94 158 H26 L20 150 Z"
        slab("plate", plate, f, 0.06, 0.12, 0.03, obsidian("plate"))
        tube("platerim", plate, f, 0.18, 0.016, gold, sc=0.94, about=(60, 145), flat=0.7)
    else:
        # Division pips (II shown: two of three earned): faceted gold diamonds; the third an empty socket.
        for k in range(3):
            x0 = 60 + (k - 1) * 20
            d = f"M{x0} 140 l8 8 l-8 8 l-8 -8 z"
            if k < 2:
                slab("pip", d, f, 0.0, 0.1, 0.045, gold)
            else:
                slab("pipsocket", d, f, 0.0, 0.04, 0.012, enamel("socket", "#0B0F1C", 0.1))
                tube("piprim", d, f, 0.045, 0.014, gold)
    if t.get("current"):
        current_arcs(f, 11 if tier == "lightning" else 23, 60, 70, 50, 62, 0.3, n=11 if t["current"] == "strong" else 6,
                     strong=t["current"] == "strong")
    studio_lights()
    camera(3.5, tilt=4, target=(0, -0.05, 0))


def build_pin(shape, icon, rarity):
    f = Frame(60, 60)
    mname, mfin, enam = RARITY[rarity]
    base = obsidian("blacknickel") if mname == "obsidian" else metal(mname, METALS[mname], mfin)
    raised = obsidian("blacknickel2") if mname == "obsidian" else metal(mname + "-hi", METALS[mname], "polished")
    if mname == "obsidian":
        raised.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = hexc("#B4BCDD")
        raised.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 1.0
        raised.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.08
    fill = enamel("enamel", enam, guilloche=True)
    d = PIN_SHAPES[shape]
    about = (60, 58) if shape == "shield" else (60, 60)
    slab("plate", d, f, 0.0, 0.12, 0.04, base)
    tube("rim", d, f, 0.125, 0.055, raised, sc=0.93, about=about, flat=0.7)
    slab("enamel", d, f, 0.1, 0.05, 0.012, fill, sc=0.86, about=about)
    icon_sc, icon_about = (0.62, (60, 60)) if shape == "star5" else (1.0, (60, 60))
    for kind, p in ICONS[icon]:
        if kind == "fill":
            slab("icon", p, f, 0.14, 0.08, 0.025, raised, sc=icon_sc, about=icon_about)
        else:
            tube("icon", p, f, 0.17, kind_r(kind), raised, sc=icon_sc, about=icon_about, flat=0.8)
    studio_lights()
    camera(2.3, tilt=3)


def kind_r(kind):
    return 0.08 if kind == "stroke-heavy" else 0.045


AVATAR_SCALE = 1.5  # Joe, 27 Nov 2026: the helmet fills about 70 % of the disc (the approved art's is about 45 %)


def build_avatar(finish, colour="#FF6BD6", scene="toned", layer=None):
    """Captain Joulz's avatar: a medallion (toned-down stripes, or a plain dark disc), the helmet a moulded vinyl-toy
    dome raised from its approved outline at 1.5x, the visor cyan glass and the ridges sitting on it.

    layer (the tint passes, for paint the app colours): "base" the whole avatar with the helmet in white paint and no
    gloss; "gloss" only the helmet's clear coat (everything else black); "mask" the helmet's coverage (white on black).
    The app shows base, multiplies the player colour inside the mask, then screens the gloss on top."""
    f = Frame(50, 50)
    rim = metal("rim", METALS["obsidian"], "polished")
    rim.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = hexc("#2A3354")
    well = enamel("well", "#0B1026", 0.25)
    slab("disc", circle(48, 50, 50), f, 0.0, 0.08, 0.03, rim)
    slab("well", circle(44.5, 50, 50), f, 0.05, 0.04, 0.008, well)
    if scene == "toned":
        # The scene's four diagonal bands, inlaid barely above the well's colour (toned right down).
        stripe_c = enamel("stripe-c", "#0E2340", 0.2)
        stripe_g = enamel("stripe-g", "#1F1F2E", 0.2)
        for k, x in enumerate((20, 46, 72, 98)):
            d = f"M{x - 3} -10 L{x + 3} -10 L{x - 27} 110 L{x - 33} 110 Z"
            st = slab("stripe", d, f, 0.084, 0.012, 0.0, stripe_c if k % 2 == 0 else stripe_g)
            cut = slab("clip", circle(44, 50, 50), f, 0.0, 0.2, 0.0, well)
            for o in (st, cut):
                bpy.context.view_layer.objects.active = o
                bpy.ops.object.select_all(action="DESELECT")
                o.select_set(True)
                bpy.ops.object.convert(target="MESH")
            mod = st.modifiers.new("clip", "BOOLEAN")
            mod.operation = "INTERSECT"
            mod.solver = "EXACT"
            mod.object = cut
            cut.hide_render = cut.hide_viewport = True
    if layer == "base":
        mat = paint("main", "#FFFFFF")
        pr = mat.node_tree.nodes["Principled BSDF"]
        pr.inputs["Coat Weight"].default_value = 0.0
        pr.inputs["Specular IOR Level"].default_value = 0.0
    elif layer == "gloss":
        mat = paint("main", "#000000")
        mat.node_tree.nodes["Principled BSDF"].inputs["Subsurface Weight"].default_value = 0.0
    elif layer == "mask":
        mat = bpy.data.materials.new("mask")
        mat.use_nodes = True
        mn = mat.node_tree.nodes
        mn.remove(mn["Principled BSDF"])
        me = mn.new("ShaderNodeEmission")
        me.inputs["Color"].default_value = (1, 1, 1, 1)
        me.inputs["Strength"].default_value = 4.0
        mat.node_tree.links.new(me.outputs[0], mn["Material Output"].inputs["Surface"])
    else:
        mat = {
            "paint": lambda: paint("main", colour),
            "chrome": lambda: chrome("chrome"),
            "holographic": lambda: holographic("holo"),
            "lightning-core": lambda: lightning_core("core"),
        }[finish]()
    about = (50, 51.5)
    helmet = transform_path(HELMET, sc=AVATAR_SCALE, about=about)
    dome = Dome(helmet, f, 0.34 * AVATAR_SCALE, round_=1.0)
    hel = inflate("helmet", helmet, f, 0.09, dome, mat)
    visor_glass = glow("visor", CYAN, 2.4, glass="#0B6B80")
    ink = enamel("ink", INK, 0.1)
    gasket = transform_path(VISOR, sc=1.1 * AVATAR_SCALE, about=(50, 51.5))
    inflate("gasket", gasket, f, 0.09, Dome(gasket, f, 0.02, 0.3, base=dome), ink)
    visor = transform_path(VISOR, sc=AVATAR_SCALE, about=about)
    inflate("visor", visor, f, 0.09, Dome(visor, f, 0.05, 0.5, base=dome), visor_glass)
    ridge = glow("ridge", CYAN, 1.6, glass="#0B6B80")
    import numpy as np

    for d in ("M44 33v6", "M50 30v8", "M56 33v6"):
        sub = transform_path(d, sc=AVATAR_SCALE, about=about)
        ob = tube("ridge", None, f, 0.0, 0.022, ridge, subs=sub, flat=0.7)
        (p0, _c1, _c2, p1) = sub[0][0][0]
        xy = np.array([f.xy(((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2))])
        ob.location.z = 0.09 + float(dome.z(xy)[0]) - 0.006
    if finish == "lightning-core" and layer is None:
        ring = glow("ring", CYAN, 6.0)
        tube("corering", circle(47.2, 50, 50), f, 0.085, 0.012, ring)
    if layer in ("gloss", "mask"):
        black = bpy.data.materials.new("black")
        black.use_nodes = True
        bn = black.node_tree.nodes
        bn.remove(bn["Principled BSDF"])
        em = bn.new("ShaderNodeEmission")
        em.inputs["Color"].default_value = (0, 0, 0, 1)
        black.node_tree.links.new(em.outputs[0], bn["Material Output"].inputs["Surface"])
        for ob in bpy.data.objects:
            if ob.type in ("MESH", "CURVE") and ob is not hel and not ob.hide_render:
                ob.data.materials.clear()
                ob.data.materials.append(black)
        if layer == "mask":
            bpy.context.scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.0
    world_gain("floor", 0.0)  # the bounce below mirrored as a white "tooth" on chrome's chin
    studio_lights(rim=0)
    camera(1.85, tilt=4)


def build_trophy_gold():
    f = Frame(60, 78)
    gold = metal("gold", METALS["gold"], "polished")
    navy = enamel("plinth", "#1E2640", 0.15)
    cup = [(0, 81.5), (8, 80), (19, 74), (27, 62), (31, 48), (32, 34), (32.5, 22), (34, 18.5), (33.5, 16.6), (31, 17.2), (30.5, 16)]
    lid = [(30.5, 16), (29, 11), (24, 6.5), (14, 3.6), (0, 2.8)]
    lathe("cup", cup + lid[1:], f, gold)
    stem = [(0, 81), (6.5, 82), (6, 88), (10.5, 89), (10.5, 91), (6, 92), (6, 97), (19, 98.5), (21, 100), (26, 110.5), (26.5, 112), (0, 112)]
    lathe("stem", stem, f, gold)
    for d in ("M32 30 C8 30 8 66 40 70", "M88 30 C112 30 112 66 80 70"):
        tube("handle", d, f, 0.0, 0.07, gold)
    slab("finial", "M63 -16 L52 4 H59 L56 16 L69 -6 H62 Z", f, -0.05, 0.1, 0.03, gold)
    ink = metal("engrave", ("#B08A44", "#8C6A22", "#6E521A", "#A88440"), "matte")
    slab("engraved", "M63 30 L52 50 H59 L56 66 L69 44 H62 Z", f, 0.56, 0.04, 0.012, ink)
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


def _cut_block(x0, x1, yl, yr, bottom, cut=14):
    """A step's front face: top edge from (x0, yl) to (x1, yr), cut 14 units on its top-left and bottom-right corners."""
    slope = (yr - yl) / (x1 - x0)
    return (f"M{x0} {yl + cut} L{x0 + cut} {yl + slope * cut} L{x1} {yr} L{x1} {bottom - cut} "
            f"L{x1 - cut} {bottom} L{x0} {bottom} Z")


def _podium_light():
    # The flat gold faces mirrored the overhead softbox and the floor whole (the white wash): both dimmed here.
    world_gain("floor", 0.05)
    world_gain("overhead", 1.3)
    world_gain("front", 0.35)
    studio_lights(rim=0)


def build_podium_bolt():
    """Option (a): the three steps together make a bolt. 2nd, 1st, 3rd, each top falling to the right and each step
    jumping back up or down at the next: the row's top edge is a lightning zigzag. Each front is clear for a name and
    a total."""
    f = Frame(98, 60)
    gold = metal("gold", METALS["gold"], "polished")
    for x0, x1, yl, yr in ((0, 64, 34, 54), (67, 131, 2, 30), (134, 198, 46, 70)):
        slab("step", _cut_block(x0, x1, yl, yr, 104), f, -0.6, 0.6, 0.03, gold)
    _podium_light()
    camera(4.0, tilt=16, target=(0.0, 0.0, -0.3))


def build_podium_block():
    """Option (b): the wide block, improved: brushed gold, a recessed panel for the name and total, the bolt engraved
    at the right end, the signature cuts."""
    f = Frame(80, 60)
    gold = metal("gold", METALS["gold"], "polished")
    deep = metal("gold-deep", ("#EED79C", "#C29B50", "#A07C38", "#E6C67E"), "matte")
    ink = metal("engrave", ("#B08A44", "#8C6A22", "#6E521A", "#A88440"), "matte")
    slab("block", "M14 30 H160 V76 L146 90 H0 V44 Z", f, -0.7, 0.7, 0.03, gold)
    slab("panel", "M18 42 H126 V78 H12 V48 Z", f, 0.0, 0.015, 0.006, deep)
    slab("bolt", BOLT, f, 0.0, 0.02, 0.006, ink, sc=0.5, about=(61, 69), tx=83, ty=-9)
    _podium_light()
    camera(3.0, tilt=14, target=(0.0, 0.0, -0.3))


PIECES = {
    **{f"emblem-{t}": (lambda t=t: build_emblem(t)) for t in TIERS},
    "avatar-captain-paint": lambda: build_avatar("paint"),
    "avatar-captain-paint-plain": lambda: build_avatar("paint", scene="plain"),
    "avatar-captain-chrome": lambda: build_avatar("chrome"),
    "avatar-captain-holographic": lambda: build_avatar("holographic"),
    "avatar-captain-lightning-core": lambda: build_avatar("lightning-core"),
    # Player colours: three pre-rendered for comparison, and the three tint passes the app would colour.
    "avatar-captain-player-12": lambda: build_avatar("paint", colour="#8F7F00"),
    "avatar-captain-player-4": lambda: build_avatar("paint", colour="#8A65F0"),
    "avatar-captain-player-17": lambda: build_avatar("paint", colour="#F7DFB7"),
    "avatar-captain-tint-base": lambda: build_avatar("paint", layer="base"),
    "avatar-captain-tint-gloss": lambda: build_avatar("paint", layer="gloss"),
    "avatar-captain-tint-mask": lambda: build_avatar("paint", layer="mask"),
    "pin-round-logic-master": lambda: build_pin("round", "bulb", "Epic"),
    "pin-hexagon-hot-streak": lambda: build_pin("hexagon", "flame", "Rare"),
    "pin-shield-giant-slayer": lambda: build_pin("shield", "sword", "Elite"),
    "pin-star-first-star": lambda: build_pin("star", "star", "Common"),
    "pin-star5-first-star": lambda: build_pin("star5", "star", "Common"),
    "trophy-gold": build_trophy_gold,
    "podium-bolt": build_podium_bolt,
    "podium-block": build_podium_block,
}


def main():
    args = sys.argv[1:]
    if "--" in args:
        args = args[args.index("--") + 1 :]
    opts = {a.split("=")[0][2:]: a.split("=", 1)[1] for a in args if a.startswith("--") and "=" in a}
    names = [a for a in args if not a.startswith("--")] or list(PIECES)
    out = Path(opts.get("out", ROOT / "docs/art/blender/style-sheet-2"))
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
