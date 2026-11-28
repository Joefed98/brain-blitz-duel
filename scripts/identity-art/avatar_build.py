"""
The 32 avatars in Blender, with every finish and gem and the paint's tint layers (S5 step 2, PR A).

Each avatar is built from its own approved drawing (scripts/identity-art/avatar-sources.ts writes the drawings and their
scenes from src/design/identity/playerCardArt.data.ts), not redrawn:
  * the disc and well as in Joe's approved Captain Joulz, the avatar's own scene toned down on the well (its texture);
  * the figure scaled to about 70 % of the disc (AVATAR_FILL, capped at 1.5x and inside the well);
  * each filled shape raised on a height field: a shape standing on the disc becomes a moulded body (a dome from its
    outline), a shape on top of others a shallow detail on their surface; the drawing's ink outlines and strokes become
    tubes lying on that surface; text is raised Archivo 900;
  * fills in the main colour ("MAIN") take the variant's material; every other colour keeps its own.

Variants (one render each, public/identity/avatars/<id>/<variant>.webp):
  tint-base, tint-gloss, tint-mask   the paint, coloured in the app (base; × the player colour inside the mask; the
                                     gloss screened on top)
  neon-base, neon-gloss, neon-mask   Neon Glow, whose glow takes the player colour: the same three layers
  chrome, carbon, comic-ink, holographic, wireframe, lightning-core   the fixed-colour finishes, whole
  gem-<gem id>                       the ten gems, whole

Usage (Blender as a Python module, outside the project; see identity_art.py):
    <venv>/bin/python scripts/identity-art/avatar_build.py <sources dir> <out dir> [ids…] [--variants=a,b] [--px=160]
        [--samples=48] [--font=<Archivo 900 ttf>]
Writes <out>/<id>/<variant>.png (RGBA, px × px, the 100-unit viewBox exactly: an orthographic camera, so the art sits
where the old drawing did and every tap box is unchanged). Renders at 2x and downsamples.
"""
import json
import math
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import bpy
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import identity_art as ia  # noqa: E402

AVATAR_FILL = 68.0  # the figure's larger side, in viewBox units (Captain Joulz's approved helmet: about 66 x 70)
MAX_SCALE = 1.5
WELL_TOP = 0.09
INK = "#06080F"
WIRE = "#22E4FF"
VARIANTS = ["tint-base", "tint-gloss", "tint-mask", "neon-base", "neon-gloss", "neon-mask", "chrome", "carbon",
            "comic-ink", "holographic", "wireframe", "lightning-core"]

# ---------------------------------------------------------------------------------------------------------- geometry


def affine(t):
    """An SVG transform list as a 2x3 matrix (a, b, c, d, e, f)."""
    m = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)

    def mul(p, q):
        a, b, c, d, e, f = p
        A, B, C, D, E, F = q
        return (a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f)

    for name, raw in re.findall(r"(\w+)\(([^)]*)\)", t or ""):
        v = [float(x) for x in re.split(r"[\s,]+", raw.strip()) if x]
        if name == "translate":
            q = (1, 0, 0, 1, v[0], v[1] if len(v) > 1 else 0)
        elif name == "scale":
            q = (v[0], 0, 0, v[1] if len(v) > 1 else v[0], 0, 0)
        elif name == "rotate":
            r = math.radians(v[0])
            cx, cy = (v[1], v[2]) if len(v) > 2 else (0, 0)
            q = mul(mul((1, 0, 0, 1, cx, cy), (math.cos(r), math.sin(r), -math.sin(r), math.cos(r), 0, 0)), (1, 0, 0, 1, -cx, -cy))
        elif name == "matrix":
            q = tuple(v)
        else:
            raise ValueError(f"transform {name}")
        m = mul(m, q)
    return m


def apply(m, p):
    a, b, c, d, e, f = m
    return (a * p[0] + c * p[1] + e, b * p[0] + d * p[1] + f)


def shape_path(el):
    tag = el.tag.split("}")[-1]
    g = lambda k, d=0.0: float(el.get(k, d))  # noqa: E731
    if tag == "path":
        return el.get("d")
    if tag == "circle":
        return ia.circle(g("r"), g("cx"), g("cy"))
    if tag == "ellipse":
        cx, cy, rx, ry = g("cx"), g("cy"), g("rx"), g("ry")
        return f"M{cx - rx} {cy} a{rx} {ry} 0 1 0 {2 * rx} 0 a{rx} {ry} 0 1 0 {-2 * rx} 0z"
    if tag == "rect":
        x, y, w, h = g("x"), g("y"), g("width"), g("height")
        rx = min(float(el.get("rx", el.get("ry", 0))), w / 2, h / 2)
        if not rx:
            return f"M{x} {y}H{x + w}V{y + h}H{x}Z"
        return (f"M{x + rx} {y}H{x + w - rx}A{rx} {rx} 0 0 1 {x + w} {y + rx}V{y + h - rx}A{rx} {rx} 0 0 1 {x + w - rx} {y + h}"
                f"H{x + rx}A{rx} {rx} 0 0 1 {x} {y + h - rx}V{y + rx}A{rx} {rx} 0 0 1 {x + rx} {y}Z")
    if tag == "line":
        return f"M{g('x1')} {g('y1')}L{g('x2')} {g('y2')}"
    return None


def subs_of(d, m):
    return [[[tuple(apply(m, q) for q in seg) for seg in segs], closed] for segs, closed in ia.parse_path(d)]


def poly(subs, frame, step=0.5):
    """Each subpath sampled to Blender (x, y) points."""
    return [ia.outline_points([sp], frame, step) for sp in subs]


def inside(xy, polys):
    """Even-odd point-in-polygon for many points against a shape's rings."""
    res = np.zeros(len(xy), bool)
    for P in polys:
        if len(P) < 3:
            continue
        x0, y0 = P[:, 0], P[:, 1]
        x1, y1 = np.roll(x0, -1), np.roll(y0, -1)
        px, py = xy[:, 0:1], xy[:, 1:2]
        cond = ((y0 > py) != (y1 > py)) & (px < (x1 - x0) * (py - y0) / (y1 - y0 + 1e-12) + x0)
        res ^= (cond.sum(1) % 2).astype(bool)
    return res


def inradius(rings, dome):
    """The largest distance from the shape's edge to a point inside it (ia.Dome's own figure counts points outside)."""
    allp = np.concatenate(rings)
    lo, hi = allp.min(0), allp.max(0)
    gx, gy = np.meshgrid(np.linspace(lo[0], hi[0], 48), np.linspace(lo[1], hi[1], 48))
    g = np.stack([gx.ravel(), gy.ravel()], 1)
    g = g[inside(g, rings)]
    return float(dome.dist(g).max()) if len(g) else 0.01


class Field:
    """The figure's height so far: the highest raised shape under each point (0 on the bare well)."""

    def __init__(self):
        self.layers = []

    def snapshot(self):
        f = Field()
        f.layers = list(self.layers)
        return f

    def z(self, xy):
        xy = np.asarray(xy, float).reshape(-1, 2)
        out = np.zeros(len(xy))
        for polys, dome in self.layers:
            m = inside(xy, polys)
            if m.any():
                out[m] = np.maximum(out[m], dome.z(xy[m]))
        return out


# --------------------------------------------------------------------------------------------------------- materials

_MATS = {}


def black():
    m = bpy.data.materials.new("black")
    m.use_nodes = True
    n = m.node_tree.nodes
    n.remove(n["Principled BSDF"])
    e = n.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (0, 0, 0, 1)
    m.node_tree.links.new(e.outputs[0], n["Material Output"].inputs["Surface"])
    return m


def emit(name, colour, strength=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    n = m.node_tree.nodes
    n.remove(n["Principled BSDF"])
    e = n.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = ia.hexc(colour)
    e.inputs["Strength"].default_value = strength
    m.node_tree.links.new(e.outputs[0], n["Material Output"].inputs["Surface"])
    return m


def soft_glow(name, colour, strength):
    """A halo: emission strongest where the tube faces the camera, fading to clear at its sides."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes["Principled BSDF"])
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.5
    inv = nt.nodes.new("ShaderNodeMath")
    inv.operation = "SUBTRACT"
    inv.inputs[0].default_value = 1.0
    nt.links.new(lw.outputs["Facing"], inv.inputs[1])
    pw = nt.nodes.new("ShaderNodeMath")
    pw.operation = "POWER"
    pw.inputs[1].default_value = 3.0
    nt.links.new(inv.outputs[0], pw.inputs[0])
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = ia.hexc(colour)
    e.inputs["Strength"].default_value = strength
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(pw.outputs[0], mix.inputs["Fac"])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(e.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], nt.nodes["Material Output"].inputs["Surface"])
    return m


def colour_mat(colour, role="fill"):
    """A non-main colour's material: the drawing's own colours as real materials."""
    key = (colour.upper(), role)
    if key in _MATS:
        return _MATS[key]
    c = colour.upper()
    if c == INK:
        m = ia.enamel("ink", INK, 0.12) if role == "fill" else ia.enamel("inkline", "#0B0F1C", 0.3)
    elif c == "#22E4FF":
        m = ia.glow("cyan", ia.CYAN, 2.2, glass="#0B6B80")
    elif c in ("#FFF6C2", "#FFE600", "#FFF1A8"):
        m = ia.glow("lamp", c, 3.0)
    elif c in ("#FFFFFF", "#EEF2FF", "#F4F6FB"):
        m = ia.paint("white", "#F4F6FB")
    elif c in ("#E2C07A", "#E6C67E"):
        m = ia.metal("gold", ia.METALS["gold"], "polished")
    elif c in ("#8F9BBF", "#B5C6DD"):
        m = ia.metal("steel", ("#E6ECF8", "#8F9BBF", "#5F6A88", "#B5C6DD"), "brushed")
    else:
        m = ia.paint("p" + c, c)
    _MATS[key] = m
    return m


def carbon(name):
    """Carbon fibre: a fine diagonal weave under a deep clear coat."""
    m, nt, p = ia._principled(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Rotation"].default_value = (0, 0, math.radians(45))
    mp.inputs["Scale"].default_value = (34, 34, 34)
    ck = nt.nodes.new("ShaderNodeTexChecker")
    ck.inputs["Color1"].default_value = ia.hexc("#14171E")
    ck.inputs["Color2"].default_value = ia.hexc("#2E333F")
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], ck.inputs["Vector"])
    nt.links.new(ck.outputs["Color"], p.inputs["Base Color"])
    p.inputs["Metallic"].default_value = 0.35
    p.inputs["Roughness"].default_value = 0.32
    p.inputs["Anisotropic"].default_value = 0.6
    p.inputs["Coat Weight"].default_value = 1.0
    p.inputs["Coat Roughness"].default_value = 0.03
    return m


def comic(name):
    """Comic Ink: flat printed yellow with red halftone dots (the approved finish's paint and dots)."""
    m, nt, p = ia._principled(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    vo = nt.nodes.new("ShaderNodeTexVoronoi")
    vo.inputs["Scale"].default_value = 26.0
    vo.inputs["Randomness"].default_value = 0.0
    lt = nt.nodes.new("ShaderNodeMath")
    lt.operation = "LESS_THAN"
    lt.inputs[1].default_value = 0.22
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs[6].default_value = ia.hexc("#FFD23D")
    mix.inputs[7].default_value = ia.hexc("#E5243F")
    nt.links.new(tc.outputs["Object"], vo.inputs["Vector"])
    nt.links.new(vo.outputs["Distance"], lt.inputs[0])
    nt.links.new(lt.outputs[0], mix.inputs["Factor"])
    nt.links.new(mix.outputs[2], p.inputs["Base Color"])
    p.inputs["Roughness"].default_value = 0.65
    p.inputs["Specular IOR Level"].default_value = 0.2
    return m


def wire(name):
    """Wireframe: a dark body drawn in glowing cyan mesh lines (the moulded body's own even grid)."""
    m, nt, p = ia._principled(name)
    p.inputs["Base Color"].default_value = ia.hexc("#06080F")
    p.inputs["Roughness"].default_value = 0.2
    wf = nt.nodes.new("ShaderNodeWireframe")
    wf.use_pixel_size = False
    wf.inputs["Size"].default_value = 0.006
    p.inputs["Emission Color"].default_value = ia.hexc(WIRE)
    mu = nt.nodes.new("ShaderNodeMath")
    mu.operation = "MULTIPLY"
    mu.inputs[1].default_value = 2.5
    nt.links.new(wf.outputs[0], mu.inputs[0])
    nt.links.new(mu.outputs[0], p.inputs["Emission Strength"])
    return m


def gem(name, stops):
    """A gem colour: a polished jewel in the gem's three stops (light at the rim, the colour, deep in the body)."""
    m, nt, p = ia._principled(name)
    p.inputs["Base Color"].default_value = ia.hexc(stops[1])
    p.inputs["Roughness"].default_value = 0.04
    p.inputs["IOR"].default_value = 1.76
    p.inputs["Subsurface Weight"].default_value = 0.35
    p.inputs["Subsurface Radius"].default_value = (0.3, 0.3, 0.3)
    p.inputs["Specular Tint"].default_value = ia.hexc(stops[0])
    p.inputs["Coat Weight"].default_value = 1.0
    p.inputs["Coat Roughness"].default_value = 0.0
    p.inputs["Coat Tint"].default_value = ia.hexc(stops[0])
    lw = nt.nodes.new("ShaderNodeLayerWeight")
    lw.inputs["Blend"].default_value = 0.45
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = ia.hexc(stops[1])
    ramp.color_ramp.elements[1].color = ia.hexc(stops[2])
    nt.links.new(lw.outputs["Facing"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], p.inputs["Base Color"])
    p.inputs["Thin Film Thickness"].default_value = 140.0
    return m


# -------------------------------------------------------------------------------------------------------------- build


def poly_tube(name, pts, radius, mat, cyclic=False):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for k, (x, y, z) in enumerate(pts):
        sp.points[k].co = (x, y, z, 1)
    sp.use_cyclic_u = cyclic
    cu.bevel_depth = radius
    cu.bevel_resolution = 4
    cu.use_fill_caps = True
    ob = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(ob)
    ob.data.materials.append(mat)
    return ob


def surface_tube(name, ring, field, radius, mat, closed, lift=0.0, dash=None):
    """A tube lying on the field along a sampled ring of points."""
    if len(ring) < 2:
        return []
    z = field.z(ring) + WELL_TOP + radius * 0.75 + lift
    pts = [(float(x), float(y), float(h)) for (x, y), h in zip(ring, z)]
    if not dash:
        return [poly_tube(name, pts + ([pts[0]] if closed else []), radius, mat)]
    on, off = dash
    out, cur, acc, state = [], [pts[0]], 0.0, True
    for a, b in zip(pts, pts[1:] + ([pts[0]] if closed else [])):
        acc += math.dist(a[:2], b[:2])
        if state:
            cur.append(b)
        if acc >= (on if state else off):
            if state and len(cur) > 1:
                out.append(poly_tube(name, cur, radius, mat))
            state, acc, cur = not state, 0.0, [b]
    if state and len(cur) > 1:
        out.append(poly_tube(name, cur, radius, mat))
    return out


class Built:
    def __init__(self):
        self.main = []  # objects in the main colour
        self.outlines = []  # (rings, base field snapshot, is main) of every filled shape: for finish extras
        self.ink = []  # ink tubes
        self.rest = []  # every other figure object
        self.disc = []
        self.extras = []


def build_avatar(src, rec, font):
    f = ia.Frame(50, 50)
    b = Built()
    rim = ia.metal("rim", ia.METALS["obsidian"], "polished")
    rim.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = ia.hexc("#2A3354")
    well = ia.enamel("well", "#0B1026", 0.25)
    # The scene as the well's texture: the 100-unit viewBox over the image, the well's object space in Blender units.
    nt = well.node_tree
    p = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Location"].default_value = (0.5, 0.5, 0)
    mp.inputs["Scale"].default_value = (1 / (100 * ia.S), 1 / (100 * ia.S), 1)
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(str(Path(src) / f"scene-{rec['id']}.png"))
    tex.extension = "EXTEND"
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], tex.inputs["Vector"])
    nt.links.new(tex.outputs["Color"], p.inputs["Base Color"])
    b.disc.append(ia.slab("disc", ia.circle(48, 50, 50), f, 0.0, 0.08, 0.03, rim))
    b.disc.append(ia.slab("well", ia.circle(44.5, 50, 50), f, 0.05, 0.04, 0.008, well))

    root = ET.fromstring(f"<g>{rec['figure']}</g>")
    items = []

    def walk(el, m, op):
        for ch in el:
            tag = ch.tag.split("}")[-1]
            mm = (lambda p, q: (p[0] * q[0] + p[2] * q[1], p[1] * q[0] + p[3] * q[1], p[0] * q[2] + p[2] * q[3],
                                p[1] * q[2] + p[3] * q[3], p[0] * q[4] + p[2] * q[5] + p[4], p[1] * q[4] + p[3] * q[5] + p[5]))(m, affine(ch.get("transform")))
            o = op * float(ch.get("opacity", 1))
            if tag == "g":
                walk(ch, mm, o)
            else:
                items.append((ch, mm, o))

    walk(root, (1, 0, 0, 1, 0, 0), 1.0)
    # The figure's fill of the disc: its larger side to AVATAR_FILL, at most 1.5x, inside the well.
    pts = []
    for el, m, o in items:
        d = shape_path(el)
        if d:
            for segs, _c in subs_of(d, m):
                for seg in segs:
                    pts += [seg[0], seg[3]]
        elif el.tag.endswith("text"):
            pts.append(apply(m, (float(el.get("x", 0)), float(el.get("y", 0)))))
    P = np.array(pts)
    w, h = P.max(0) - P.min(0)
    far = float(np.sqrt(((P - 50) ** 2).sum(1)).max())
    sc = min(MAX_SCALE, AVATAR_FILL / max(w, h), 42.0 / max(far, 1e-6))
    grow = (sc, 0, 0, sc, 50 * (1 - sc), 50 * (1 - sc))

    field = Field()
    for i, (el, m, o) in enumerate(items):
        if o < 0.45:
            continue
        m = (lambda p, q: (p[0] * q[0] + p[2] * q[1], p[1] * q[0] + p[3] * q[1], p[0] * q[2] + p[2] * q[3],
                           p[1] * q[2] + p[3] * q[3], p[0] * q[4] + p[2] * q[5] + p[4], p[1] * q[4] + p[3] * q[5] + p[5]))(grow, m)
        lin_scale = math.sqrt(abs(m[0] * m[3] - m[1] * m[2]))
        fill = el.get("fill", "#000000" if el.tag.endswith(("path", "circle", "ellipse", "rect")) else "none")
        stroke = el.get("stroke")
        sw = float(el.get("stroke-width", 1)) * lin_scale
        eps = 0.0015 * i
        if el.tag.endswith("text"):
            if float(el.get("fill-opacity", 1)) < 0.45:
                continue
            x, y = apply(m, (float(el.get("x", 0)), float(el.get("y", 0))))
            cu = bpy.data.curves.new("text", "FONT")
            cu.body = (el.text or "").strip()
            cu.font = font
            cu.size = float(el.get("font-size", 10)) * lin_scale * ia.S * 0.98
            cu.align_x = "CENTER"
            cu.align_y = "BOTTOM_BASELINE"
            cu.extrude = 0.008
            cu.bevel_depth = 0.003
            ob = bpy.data.objects.new("text", cu)
            bx, by = f.xy((x, y))
            ob.location = (bx, by, WELL_TOP + float(field.z([[bx, by + cu.size * 0.35]])[0]) + 0.01 + eps)
            bpy.context.collection.objects.link(ob)
            mat = None if fill == "MAIN" else colour_mat(fill)
            ob.data.materials.append(mat or ia.paint("main", rec["defaultMain"]))
            (b.main if fill == "MAIN" else b.rest).append(ob)
            continue
        d = shape_path(el)
        if not d:
            continue
        subs = subs_of(d, m)
        rings = poly(subs, f)
        filled = fill not in ("none", None) and float(el.get("fill-opacity", 1)) >= 0.45
        if filled:
            for sp in subs:
                sp[1] = True
            all_pts = np.concatenate(rings)
            centre = all_pts.mean(0, keepdims=True)
            under = field.snapshot()
            on_top = bool(field.layers) and float(under.z(centre)[0]) > 0
            dome = ia.Dome(subs, f, 0.0, round_=1.0, base=under if on_top else None)
            rmax = dome.rmax = inradius(rings, dome)
            dome.height = min(0.05, max(0.012, 0.35 * rmax)) if on_top else min(0.5, max(0.05, 0.9 * rmax))
            dome.r = dome.rmax * (0.5 if on_top else 1.0)
            mat = colour_mat(fill) if fill != "MAIN" else ia.paint("main", rec["defaultMain"])
            ob = ia.inflate(f"shape{i}", subs, f, WELL_TOP + eps, dome, mat)
            (b.main if fill == "MAIN" else b.rest).append(ob)
            b.outlines.append((rings, under, fill == "MAIN", [sp[1] for sp in subs]))
            field.layers.append((rings, dome))
            if stroke and stroke != "none" and float(el.get("stroke-opacity", 1)) >= 0.45:
                # The drawing's outline: a tube round the shape where it meets what it stands on.
                r = sw / 2 * ia.S * 0.85
                smat = colour_mat(stroke, "line") if stroke != "MAIN" else ia.paint("main", rec["defaultMain"])
                for ring in rings:
                    obs = surface_tube(f"outline{i}", ring, under, r, smat, True, lift=eps)
                    (b.ink if stroke.upper() == INK else b.main if stroke == "MAIN" else b.rest).extend(obs)
        elif stroke and stroke != "none" and float(el.get("stroke-opacity", 1)) >= 0.45:
            r = sw / 2 * ia.S * 0.9
            dash = None
            if el.get("stroke-dasharray"):
                on, off = [float(x) * lin_scale * ia.S for x in re.split(r"[\s,]+", el.get("stroke-dasharray").strip())[:2]]
                dash = (on, off)
            smat = colour_mat(stroke, "line") if stroke != "MAIN" else ia.paint("main", rec["defaultMain"])
            for ring, (segs, closed) in zip(rings, subs):
                obs = surface_tube(f"stroke{i}", ring, field, r, smat, closed, lift=eps, dash=dash)
                (b.ink if stroke.upper() == INK else b.main if stroke == "MAIN" else b.rest).extend(obs)
    b.field = field
    return b


# ------------------------------------------------------------------------------------------------------------ variants


def set_mat(obs, mat):
    for ob in obs:
        ob.data.materials.clear()
        ob.data.materials.append(mat)


def remember(b):
    return {ob.name: list(ob.data.materials) for ob in b.main + b.rest + b.ink + b.disc}


def restore(b, saved):
    for ob in b.main + b.rest + b.ink + b.disc:
        ob.data.materials.clear()
        for m in saved[ob.name]:
            ob.data.materials.append(m)
    for ob in b.extras:
        bpy.data.objects.remove(ob, do_unlink=True)
    b.extras = []
    bpy.context.scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0


def main_outline_tubes(b, radius, mat, lift=0.004, field_top=True):
    out = []
    for rings, under, is_main, _closed in b.outlines:
        if not is_main:
            continue
        for ring in rings:
            out += surface_tube("fx", ring, b.field if field_top else under, radius, mat, True, lift=lift)
    return out


def apply_variant(b, v, gems):
    others = b.rest + b.ink + b.disc
    if v == "paint":
        return  # the drawing's own default colour (previews and contact sheets only)
    if v == "tint-base":
        m = ia.paint("main-w", "#FFFFFF")
        m.node_tree.nodes["Principled BSDF"].inputs["Coat Weight"].default_value = 0.0
        m.node_tree.nodes["Principled BSDF"].inputs["Specular IOR Level"].default_value = 0.0
        set_mat(b.main, m)
    elif v in ("tint-gloss", "neon-gloss"):
        m = ia.paint("main-k", "#000000")
        m.node_tree.nodes["Principled BSDF"].inputs["Subsurface Weight"].default_value = 0.0
        set_mat(b.main, m)
        set_mat(others, black())
    elif v in ("tint-mask", "neon-mask"):
        set_mat(b.main, emit("mask", "#FFFFFF", 4.0))
        set_mat(others, black())
        bpy.context.scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.0
    if v.startswith("neon-"):
        # Neon Glow: the paint (tinted) under a thin white neon line, a halo in the player's colour round the body.
        if v == "neon-base":
            m = ia.paint("main-w", "#FFFFFF")
            m.node_tree.nodes["Principled BSDF"].inputs["Coat Weight"].default_value = 0.0
            m.node_tree.nodes["Principled BSDF"].inputs["Specular IOR Level"].default_value = 0.0
            set_mat(b.main, m)
        line = emit("neon", "#FFFFFF", 3.0) if v == "neon-base" else black()
        halo = soft_glow("halo", "#FFFFFF", 4.0 if v == "neon-mask" else 1.6) if v != "neon-gloss" else black()
        b.extras += main_outline_tubes(b, 0.65 * ia.S, line, lift=0.006)
        b.extras += main_outline_tubes(b, 4.0 * ia.S, halo, lift=-0.02, field_top=False)
    elif v == "chrome":
        set_mat(b.main, ia.chrome("chrome"))
    elif v == "holographic":
        set_mat(b.main, ia.holographic("holo"))
    elif v == "carbon":
        set_mat(b.main, carbon("carbon"))
    elif v == "lightning-core":
        set_mat(b.main, ia.lightning_core("core"))
        b.extras += ia.current_ring(ia.Frame(50, 50)) if hasattr(ia, "current_ring") else [
            ia.tube("corering", ia.circle(47.2, 50, 50), ia.Frame(50, 50), 0.085, 0.012, ia.glow("ring", ia.CYAN, 6.0))]
    elif v == "comic-ink":
        set_mat(b.main, comic("comic"))
        b.extras += main_outline_tubes(b, 2.25 * ia.S, colour_mat(INK, "line"), lift=0.002, field_top=False)
    elif v == "wireframe":
        set_mat(b.main, wire("wire"))
        dark = ia.enamel("wire-dark", INK, 0.15)
        set_mat(b.rest, dark)
        cyan = ia.glow("wire-line", WIRE, 3.0)
        set_mat(b.ink, cyan)
        for rings, under, _is_main, _closed in b.outlines:
            for ring in rings:
                b.extras += surface_tube("fx", ring, under, 0.9 * ia.S, cyan, True, lift=0.003)
    elif v.startswith("gem-"):
        g = gems[v[4:]]
        set_mat(b.main, gem(v, g["stops"]))
        rim = ia.metal("jewel-rim", (g["stops"][0], g["stops"][0], g["stops"][1], g["stops"][0]), "polished")
        b.extras += main_outline_tubes(b, 0.9 * ia.S, rim, lift=0.002, field_top=False)


def camera_ortho():
    cd = bpy.data.cameras.new("cam")
    cd.type = "ORTHO"
    cd.ortho_scale = 100 * ia.S
    ob = bpy.data.objects.new("cam", cd)
    ob.location = (0, 0, 8)
    bpy.context.collection.objects.link(ob)
    bpy.context.scene.camera = ob


def main():
    args = sys.argv[1:]
    opts = {a.split("=")[0][2:]: a.split("=", 1)[1] for a in args if a.startswith("--") and "=" in a}
    pos = [a for a in args if not a.startswith("--")]
    src, out = Path(pos[0]), Path(pos[1])
    recs = json.loads((src / "avatars.json").read_text())
    gems = {g["id"]: g for g in json.loads((src / "gems.json").read_text())}
    ids = pos[2:] or [r["id"] for r in recs]
    variants = opts["variants"].split(",") if "variants" in opts else VARIANTS + [f"gem-{g}" for g in gems]
    px = int(opts.get("px", 160))
    samples = int(opts.get("samples", 48))
    for rec in [r for r in recs if r["id"] in ids]:
        ia.reset(px * 2, samples)
        _MATS.clear()
        font = bpy.data.fonts.load(opts.get("font", str(src / "archivo-900.ttf")))
        b = build_avatar(src, rec, font)
        ia.world_gain("floor", 0.0)
        # Straight down (the orthographic camera), the flat well mirrors the overhead softbox whole: dimmed for avatars.
        ia.world_gain("overhead", 0.7)
        ia.studio_lights(rim=0)
        camera_ortho()
        saved = remember(b)
        (out / rec["id"]).mkdir(parents=True, exist_ok=True)
        for v in variants:
            apply_variant(b, v, gems)
            tmp = out / rec["id"] / f"{v}.full.png"
            ia.render(tmp)
            Image.open(tmp).resize((px, px), Image.LANCZOS).save(out / rec["id"] / f"{v}.png")
            tmp.unlink()
            restore(b, saved)
            print("rendered", rec["id"], v, flush=True)


if __name__ == "__main__":
    main()
