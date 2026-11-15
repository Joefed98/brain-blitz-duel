"""Attention overhaul pieces (phase 2 step 4, 15 Nov 2026): the app's own outlines made into real objects.

scripts/attention-art/outlines.tsx samples every piece the app draws (an eagle, a sweet, a sea creature, a token, a
card symbol) into polylines; here each filled shape becomes a thin extruded enamel or metal layer with a rounded edge,
stacked in drawing order, and each stroke a round tube, so the silhouette, the turns and the facing are the app's
exactly and only the material is new. The part marked with the palette sentinel takes each palette colour in turn.

Rendered with Cycles on a transparent film through an orthographic camera, with soft, even studio light (sprites.py):
satin enamel, brushed metal, no glare, no glowing edges.

Run:  ~/blenderenv/venv/bin/python docs/design/attention-overhaul/source/pieces.py [group ...]
      groups: eagle sweet reef tally pair   (needs $JZ_TMP/attention-outlines.json from outlines.tsx)
"""
import json, math
from sprites import *  # noqa: F401,F403
from jzlib import _link
import bmesh
from mathutils import Vector

OUTLINES = json.load(open(os.path.join(TMP, "attention-outlines.json")))
PIECES = OUTLINES["pieces"]
PALETTES = OUTLINES["palettes"]
SENTINEL = (254, 1, 253)


def rgb(css):
    if css is None:
        return None
    if css.startswith("#"):
        h = css.lstrip("#")
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    parts = css[css.index("(") + 1:css.index(")")].split(",")
    return tuple(int(float(p)) for p in parts[:3])


def hexs(c):
    return "#%02x%02x%02x" % c


KEY = {"at": "left"}


def look(s=None):
    """Colour-true film (the flat face of an enamel reads as its palette colour), a studio world seen only in
    reflections, and a low key from the top left so bevels and rims read."""
    s = s or bpy.context.scene
    s.view_settings.view_transform = "Standard"
    s.view_settings.look = "None"
    s.view_settings.exposure = float(os.environ.get("JZ_EXPOSURE", "-3.35"))
    world("#000000", 0.0, hdri="studio.exr", hdri_strength=0.35)
    W, H = jzlib.W, jzlib.H
    span = max(W, H)
    if KEY["at"] == "left":
        area(-span * 0.9, -span * 0.9, span * 0.9, span * 0.8, 160 * (span / 40) ** 2, "#fff6ea", target=(W / 2, H / 2, 0))
    else:  # straight above the sprite's middle, for strips that repeat (no gradient along them)
        area(W / 2, -H * 4, span * 0.6, span * 1.2, 160 * (span / 40) ** 2, "#fff6ea", target=(W / 2, H / 2, 0), sx=W * 3, sy=span)


_setup = setup


def setup(w, h, scale=3, samples=None):  # noqa: F811
    s = _setup(w, h, scale, samples)
    look(s)
    return s


# ------------------------------------------------------------------ materials (satin, no glare)
def enamel(name, color):
    """Hard enamel: a satin colour under a thin, rough coat (so it reads as a real fill, never plastic glare)."""
    m = mat(name, color, rough=0.42, coat=0.35, coat_rough=0.35, spec=0.35)
    add_bump(m, 260, 0.02, distance=0.002)
    return m


def metal_mat(name, color, rough=0.38):
    m = mat(name, color, rough, metal=1.0)
    add_bump(m, 140, 0.03, distance=0.002)
    return m


def material_for(c, fill_mat, role=None):
    if c == SENTINEL:
        return fill_mat
    r, g, b = c
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    if (r, g, b) == (245, 184, 46) or role == "beak":
        return metal_mat("gold", "#d9b56c", 0.36)
    if lum < 45:
        return enamel("ink", "#14121a")
    if min(r, g, b) > 225:
        return enamel("white", "#f2efe8")
    return enamel(f"e{hexs(c)}", hexs(c))


# ------------------------------------------------------------------ geometry
def mirror_of(transform):
    """True when a transform flips the drawing (the face winding must be reversed to keep it facing up)."""
    (ax, ay), (bx, by), (cx, cy) = transform(0, 0), transform(1, 0), transform(0, 1)
    return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax) < 0


def curve_from(subs, closed, name, transform):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "2D"
    for pts in subs:
        pts = list(pts)
        if mirror_of(transform):
            pts.reverse()
        if closed and len(pts) > 3 and math.dist(pts[0], pts[-1]) < 0.3:
            pts = pts[:-1]
        sp = cu.splines.new("POLY")
        sp.points.add(len(pts) - 1)
        for i, (x, y) in enumerate(pts):
            tx, ty = transform(x, y)
            v = V(tx, ty)
            sp.points[i].co = (v.x, v.y, 0, 1)
        sp.use_cyclic_u = closed
    return cu


def inside(pt, poly):
    x, y = pt
    c = False
    for i in range(len(poly)):
        (x1, y1), (x2, y2) = poly[i], poly[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            c = not c
    return c


def islands(subs):
    """Groups subpaths into islands: an outline and the holes inside it (a doughnut's middle), each filled alone,
    so two overlapping outlines (a near and a far wing) never cut each other out."""
    out = []
    for i, sub in enumerate(subs):
        owner = next((j for j, other in enumerate(subs) if j != i and inside(sub[len(sub) // 2], other) and not inside(other[len(other) // 2], sub)), None)
        if owner is None:
            out.append([sub] + [h for k, h in enumerate(subs) if k != i and inside(h[len(h) // 2], sub) and not inside(sub[len(sub) // 2], h)])
    return out or [subs]


def fill_layer(subs, m, z, depth, bevel, transform, name="fill", outset=0.0):
    groups = islands(subs)
    if len(groups) > 1:
        return [fill_layer(g, m, z - 0.3 * k, depth, bevel, transform, f"{name}{k}", outset) for k, g in enumerate(groups)][0]
    cu = curve_from(subs, True, name, transform)
    cu.fill_mode = "BOTH"
    cu.extrude = depth * P / 2
    cu.bevel_depth = bevel * P
    cu.bevel_resolution = 3
    cu.offset = (outset - bevel * 0.9) * P  # keep the outline where the app draws it (a rim stands proud of it)
    ob = bpy.data.objects.new(name, cu)
    ob.location.z = (z + depth / 2 + bevel) * P
    _link(ob)
    ob.data.materials.append(m)
    return ob


def stroke_tube(subs, closed, m, z, width, transform, name="stroke"):
    cu = curve_from(subs, closed, name, transform)
    cu.dimensions = "3D"
    cu.bevel_depth = max(0.08, width / 2) * P
    cu.bevel_resolution = 3
    cu.use_fill_caps = True
    ob = bpy.data.objects.new(name, cu)
    ob.location.z = (z + width / 2) * P
    _link(ob)
    ob.data.materials.append(m)
    return ob


def build(piece, fill_mat, transform=lambda x, y: (x, y), layer=0.55, base_depth=1.6, rim=None, roles=None):
    """Builds a piece from its outline items. `rim`: a metal edge round the base silhouette (an enamel pin's)."""
    items = PIECES[piece]["items"]
    z = 0.0
    for idx, it in enumerate(items):
        role = it.get("role")
        if roles is not None and role in roles:
            continue
        fill = rgb(it["fill"])
        stroke = rgb(it["stroke"])
        stroke_only = fill == (0, 0, 0) and stroke is not None
        depth = base_depth if idx == 0 else 0.5
        if fill is not None and not stroke_only:
            m = material_for(fill, fill_mat, role)
            if idx == 0 and rim is not None:
                fill_layer(it["subs"], rim, z, depth * 0.55, 0.35, transform, "rim", outset=0.9)
                z += 0.2
            fill_layer(it["subs"], m, z, depth, 0.32 if idx == 0 else 0.18, transform)
            z += depth if idx == 0 else layer
        if stroke is not None and it["sw"] > 0.12:
            sm = material_for(stroke, fill_mat)
            stroke_tube(it["subs"], it["closed"], sm, z, it["sw"], transform)
            z += 0.15
    return z


# ------------------------------------------------------------------ Eagle Eye
EAGLE_ANGLES = {"N": 0, "NE": 45, "E": 90, "SE": 135, "S": 180, "SW": 225, "W": 270, "NW": 315}


def eagle_transform(dir):
    """eagleEyeArt.tsx eagleTransform: drop 3.4, mirror for the west half, rotate about the centre."""
    a = EAGLE_ANGLES[dir]
    rot, mirror = (a - 90, False) if a <= 180 else (a - 270, True)
    t = math.radians(rot)

    def f(x, y):
        y = y + 3.4
        if mirror:
            x = 32 - x
        dx, dy = x - 16, y - 16
        return 16 + dx * math.cos(t) - dy * math.sin(t), 16 + dx * math.sin(t) + dy * math.cos(t)
    return f


def eagle_mask_material(name, body_color, body_metal, tf):
    """The body's metal with the white head and tail laid on by a mask drawn from the app's head and tail outlines."""
    from PIL import Image, ImageDraw
    size = 512
    im = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(im)
    for it in PIECES["eagle"]["items"]:
        if it.get("role") in ("head", "tail"):
            for sub in it["subs"]:
                d.polygon([(tf(x, y)[0] / 32 * size, tf(x, y)[1] / 32 * size) for x, y in sub], fill=255)
    path = os.path.join(TMP, f"{name}-mask.png")
    im.save(path)
    m = bpy.data.materials.new(name); m.use_nodes = True
    n, l = jzlib._nodes(m)
    out = n["Material Output"]
    metal_b = n["Principled BSDF"]
    metal_b.inputs["Base Color"].default_value = hexc(body_color)
    metal_b.inputs["Metallic"].default_value = body_metal
    metal_b.inputs["Roughness"].default_value = 0.4
    white = n.new("ShaderNodeBsdfPrincipled")
    white.inputs["Base Color"].default_value = hexc("#f4f1ea")
    white.inputs["Roughness"].default_value = 0.45
    white.inputs["Coat Weight"].default_value = 0.3
    white.inputs["Coat Roughness"].default_value = 0.35
    tc = n.new("ShaderNodeTexCoord")
    sep = n.new("ShaderNodeSeparateXYZ")
    l.new(tc.outputs["Object"], sep.inputs[0])
    # object coords: x in [-16P, 16P] -> u, y in [16P,-16P] -> v (image rows from the top)
    mu = n.new("ShaderNodeMath"); mu.operation = "MULTIPLY_ADD"; mu.inputs[1].default_value = 1 / (32 * P); mu.inputs[2].default_value = 0.5
    mv = n.new("ShaderNodeMath"); mv.operation = "MULTIPLY_ADD"; mv.inputs[1].default_value = 1 / (32 * P); mv.inputs[2].default_value = 0.5
    l.new(sep.outputs[0], mu.inputs[0]); l.new(sep.outputs[1], mv.inputs[0])
    comb = n.new("ShaderNodeCombineXYZ")
    l.new(mu.outputs[0], comb.inputs[0]); l.new(mv.outputs[0], comb.inputs[1])
    tex = n.new("ShaderNodeTexImage"); tex.image = bpy.data.images.load(path); tex.extension = "CLIP"
    tex.image.colorspace_settings.name = "Non-Color"
    l.new(comb.outputs[0], tex.inputs[0])
    mix = n.new("ShaderNodeMixShader")
    l.new(tex.outputs["Color"], mix.inputs[0])
    l.new(metal_b.outputs[0], mix.inputs[1]); l.new(white.outputs[0], mix.inputs[2])
    l.new(mix.outputs[0], out.inputs[0])
    return m


def eagles():
    for state, colour, metalness in (("plain", "#cfd3da", 0.85), ("gold", "#d9b56c", 1.0)):
        for d in EAGLE_ANGLES:
            setup(32, 32, scale=5)
            tf = eagle_transform(d)
            body_mat = eagle_mask_material(f"eagle-{state}-{d}", colour, metalness, lambda x, y: (x, 32 - y) if False else tf(x, y))
            items = PIECES["eagle"]["items"]
            body = next(i for i in items if i.get("role") == "body")
            fill_layer(body["subs"], body_mat, 0, 1.8, 0.4, tf, "body")
            beak = next(i for i in items if i.get("role") == "beak")
            fill_layer(beak["subs"], metal_mat("beak", "#e0b25a", 0.34), 1.6, 0.9, 0.25, tf, "beak")
            eye = next(i for i in items if i.get("role") == "eye")
            fill_layer(eye["subs"], enamel("eye", "#0f1418"), 2.0, 0.6, 0.15, tf, "eye")
            write("symscan", f"eagle-{state}-{d}")


# ------------------------------------------------------------------ Double Take, Tally, Matchmaker
def coloured(group, piece_names, palette, box, scale, rim=lambda: metal_mat("rim", "#d9b56c", 0.4), out_prefix=None):
    for piece in piece_names:
        for cid, colour in palette.items():
            setup(box, box, scale=scale)
            fm = enamel(f"fill-{cid}", colour)
            build(piece, fm, rim=rim() if rim else None)
            write(group, f"{(out_prefix or piece)}-{cid.lower()}")


SPOT_KINDS = ["circle", "square", "triangle", "star", "hexagon", "arrow"]


def sweets():
    coloured("spotdiff", [f"sweet-{k}" for k in SPOT_KINDS], PALETTES["spot"], 40, 3)


def reef():
    coloured("spotdiff", [f"reef-{k}" for k in SPOT_KINDS], PALETTES["spot"], 40, 3)


def tally():
    for shape in ["circle", "square", "triangle", "star", "hexagon"]:
        for cid, colour in PALETTES["tally"].items():
            setup(24, 24, scale=5)
            build(f"tally-{shape}", enamel(f"t-{cid}", colour), base_depth=2.2, rim=metal_mat("trim", "#2a2630", 0.5))
            write("countup", f"token-{shape}-{cid.lower()}")


def pair():
    for shape in ["circle", "square", "triangle", "star", "hexagon", "diamond"]:
        for cid, colour in PALETTES["pair"].items():
            setup(24, 24, scale=5)
            build(f"pair-{shape}", enamel(f"p-{cid}", colour), base_depth=1.4, rim=metal_mat("foil", "#d9b56c", 0.4))
            write("pairmatch", f"symbol-{shape}-{cid.lower()}")


# ------------------------------------------------------------------ surfaces and props
def stone(name, c1, c2, scale=18, rough=0.82, bump=0.18):
    """Honed stone (slate, flagstone): two tones of fine noise, a little grain in the bump, never shiny."""
    m = mat(name, c1, rough)
    n, l = jzlib._nodes(m); b = jzlib._bsdf(m)
    tc = n.new("ShaderNodeTexCoord")
    nz = n.new("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = scale; nz.inputs["Detail"].default_value = 9
    l.new(tc.outputs["Object"], nz.inputs[0])
    cr = n.new("ShaderNodeValToRGB")
    cr.color_ramp.elements[0].color = hexc(c2); cr.color_ramp.elements[1].color = hexc(c1)
    cr.color_ramp.elements[0].position = 0.38; cr.color_ramp.elements[1].position = 0.66
    l.new(nz.outputs["Fac"], cr.inputs[0]); l.new(cr.outputs[0], b.inputs["Base Color"])
    bp = n.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = bump; bp.inputs["Distance"].default_value = 0.003
    l.new(nz.outputs["Fac"], bp.inputs["Height"]); l.new(bp.outputs[0], b.inputs["Normal"])
    return m


def slate_tiles():
    """Eagle Eye: a plain honed slate tile (no glowing edge) and the marked tile, the same slate warmed with gold."""
    for name, c1, c2 in (("tile", "#2b2d34", "#202228"), ("tile-marked", "#4a3f26", "#3a311d")):
        setup(48, 48, scale=3)
        box(1.5, 1.5, 45, 45, 4, stone(name, c1, c2, 14), r=4)
        write("symscan", name)


def shelves():
    """Double Take's sweet shop: oak shelves, one under each row of the 8 x 6 picture, on a dark walnut back."""
    setup(384, 288, scale=2)
    back = wood("walnut", "#3a2a22", "#2a1d17", rough=0.7, coat=0.0, scale=2.2, stretch=(1, 10, 1))
    box(0, 0, 384, 288, 2, back, r=0)
    oak = wood("oak", "#a8784a", "#7a5232", rough=0.62, coat=0.05, scale=1.4, stretch=(1, 12, 1))
    for row in range(6):
        box(0, row * 48 + 39, 384, 7, 6, oak, r=1.5, z=2)
    write("spotdiff", "shelves", max_kb=60)


def rockpool():
    """Double Take's rock pool: deep water over rippled sand, the ledges a darker rock."""
    setup(384, 288, scale=2)
    sand = stone("sand", "#7d6a48", "#5f5036", scale=6, bump=0.3)
    box(0, 0, 384, 288, 2, sand, r=0)
    water = mat("water", "#103140", 0.9, alpha=0.82)
    box(0, 0, 384, 288, 1, water, r=0, z=6)
    rock = stone("ledge", "#2c3438", "#1d2326", scale=10, bump=0.4)
    for row in range(6):
        box(0, row * 48 + 40, 384, 6, 3, rock, r=2, z=2)
    write("spotdiff", "rockpool", max_kb=60)


def felt_tray():
    """Tally's tray: a dark plum baize, seamless (it tiles)."""
    setup(360, 300, scale=2)
    plane(0, 0, 360, 300, felt("baize", "#2a1b2b", 220), z=0)
    write("countup", "felt")


def maze_floor():
    """Labyrinth's floor: dark flagstone, seamless, one square of the maze a tile."""
    setup(360, 360, scale=2)
    plane(0, 0, 360, 360, stone("flag", "#2a272c", "#1d1b20", scale=2.5, bump=0.25), z=0)
    write("maze", "floor")


def bomb_parts():
    setup(360, 420, scale=2)
    steel = mat("steel", "#8d9097", 0.5, metal=1.0)
    add_bump(steel, 60, 0.05, stretch=(1, 80, 1), distance=0.002)
    plane(0, 0, 360, 420, steel)
    write("bomb", "casing")
    # Braided wires: insulated cable with a woven sleeve, seamless along x (an integer number of weaves).
    KEY["at"] = "top"
    for cid, colour in (("red", "#d63a3a"), ("blue", "#2f6fd8"), ("green", "#2fa85c"), ("yellow", "#f2cf2a"), ("white", "#ecebe6"), ("black", "#1a1a20")):
        setup(96, 12, scale=4)
        m = mat(f"wire-{cid}", colour, 0.5, coat=0.2, coat_rough=0.4)
        n, l = jzlib._nodes(m); b = jzlib._bsdf(m)
        tc = n.new("ShaderNodeTexCoord"); sep = n.new("ShaderNodeSeparateXYZ"); l.new(tc.outputs["Object"], sep.inputs[0])
        a = n.new("ShaderNodeMath"); a.operation = "MULTIPLY"; a.inputs[1].default_value = 2 * math.pi * 12 / (96 * P)
        l.new(sep.outputs[0], a.inputs[0])
        zz = n.new("ShaderNodeMath"); zz.operation = "MULTIPLY"; zz.inputs[1].default_value = 2 * math.pi / (12 * P) * 1.2
        l.new(sep.outputs[2], zz.inputs[0])
        s1 = n.new("ShaderNodeMath"); s1.operation = "ADD"; l.new(a.outputs[0], s1.inputs[0]); l.new(zz.outputs[0], s1.inputs[1])
        s2 = n.new("ShaderNodeMath"); s2.operation = "SUBTRACT"; l.new(a.outputs[0], s2.inputs[0]); l.new(zz.outputs[0], s2.inputs[1])
        c1 = n.new("ShaderNodeMath"); c1.operation = "SINE"; l.new(s1.outputs[0], c1.inputs[0])
        c2 = n.new("ShaderNodeMath"); c2.operation = "SINE"; l.new(s2.outputs[0], c2.inputs[0])
        mx = n.new("ShaderNodeMath"); mx.operation = "MAXIMUM"; l.new(c1.outputs[0], mx.inputs[0]); l.new(c2.outputs[0], mx.inputs[1])
        bp = n.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.5; bp.inputs["Distance"].default_value = 0.004
        l.new(mx.outputs[0], bp.inputs["Height"]); l.new(bp.outputs[0], b.inputs["Normal"])
        xcyl(-2, 6, 100, 4.6, m)
        write("bomb", f"wire-{cid}")
    KEY["at"] = "left"
    # Brass terminal post and the domed caps.
    setup(14, 18, scale=4)
    brass = brushed("brass", "#c9a35a", rough=0.36, aniso=0.3)
    box(1, 1, 12, 16, 4, brass, r=2)
    cyl(7, 9, 3.6, 6, brushed("brass2", "#d8b46a", rough=0.32), z=4)
    write("bomb", "terminal")
    for cid, colour in (("red", "#d63a3a"), ("blue", "#2f6fd8"), ("green", "#2fa85c"), ("yellow", "#f2cf2a"), ("white", "#ecebe6"), ("black", "#24242b")):
        setup(48, 48, scale=3)
        cyl(24, 24, 22, 4, brushed("bezel", "#6f7279", rough=0.4))
        ellipsoid(24, 24, 18, 18, 9, mat(f"cap-{cid}", colour, 0.55, coat=0.1, coat_rough=0.5), z=3)
        write("bomb", f"cap-{cid}")
    setup(12, 12, scale=4)
    cyl(6, 6, 5.4, 2, brushed("screwhead", "#9a9da4", rough=0.4))
    cbox(6, 6, 7, 1.4, 1.2, mat("slot", "#2a2b30", 0.6), r=0.4, z=2)
    write("bomb", "screw")


def cards():
    """Matchmaker: the card back (navy lacquer, a champagne-gold foil lattice, a plain border) and the card face."""
    setup(60, 80, scale=3)
    box(1, 1, 58, 78, 2, mat("cardplum", "#5a1f4f", 0.5, coat=0.2, coat_rough=0.35), r=5)
    foil = brushed("foil", "#d9b56c", rough=0.38)
    box(5, 5, 50, 70, 0.6, foil, r=3.5, z=2)
    box(6.4, 6.4, 47.2, 67.2, 0.8, mat("cardplum2", "#6a2860", 0.5, coat=0.2, coat_rough=0.35), r=2.8, z=2.1)
    for i in range(5):
        for j in range(7):
            cx, cy = 13 + i * 8.5, 13 + j * 9
            cbox(cx, cy, 3.4, 3.4, 0.6, foil, r=0.4, z=2.9, rot=math.pi / 4)
    write("pairmatch", "back")
    setup(60, 80, scale=3)
    box(1, 1, 58, 78, 2, mat("cardface", "#1c2038", 0.6, coat=0.1, coat_rough=0.5), r=5)
    box(4, 4, 52, 72, 0.4, brushed("faceline", "#b89a5c", rough=0.45), r=3.5, z=2)
    box(4.8, 4.8, 50.4, 70.4, 0.6, mat("cardface2", "#20253f", 0.6), r=3, z=2.1)
    write("pairmatch", "face")


if __name__ == "__main__":
    run({"eagle": eagles, "tiles": slate_tiles, "sweet": sweets, "reef": reef, "shelves": shelves, "rockpool": rockpool,
         "tally": tally, "felt": felt_tray, "pair": pair, "cards": cards, "maze": maze_floor, "bomb": bomb_parts})
