"""Helpers shared by the Strategy concept scripts (gems, marbles, painted backdrops, HUD chips at any height)."""
import os, sys, math
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from lib import *
import bmesh


def backdrop(name, img, z=-0.5, emit=1.0, w=W, h=H, cx=W / 2, cy=H / 2):
    """A painted background (PIL image or path) on an emissive plane behind the scene, exactly screen sized."""
    if not isinstance(img, str):
        p = os.path.join(TEX, f"{name}.png")
        img.save(p)
        img = p
    m, nt, b = node_mat("bd-" + name)
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(n)
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(img, check_existing=True)
    tex.extension = "EXTEND"
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs[1].default_value = emit
    nt.links.new(tex.outputs[0], e.inputs[0])
    nt.links.new(e.outputs[0], nt.nodes["Material Output"].inputs[0])
    o = plate(name, u(w), u(h), u(0.1), 0, mat_=m, loc=P(cx, cy, z))
    uv_top(o)
    o.visible_shadow = False
    return o


def gem_mesh(name, outline, h_crown, d_pav, table=0.55, mid=None, culet=0.0):
    """A faceted stone from a plan outline (list of (x, y) in units, girdle at z=0): an optional crown step ring
    (mid=(scale, z_frac)), a table (scale, at h_crown) and a pavilion down to a point (or a small culet ring)."""
    bm = bmesh.new()
    n = len(outline)
    gird = [bm.verts.new((x, y, 0)) for x, y in outline]
    rings = [gird]
    if mid:
        s, zf = mid
        rings.append([bm.verts.new((x * s, y * s, h_crown * zf)) for x, y in outline])
    tab = [bm.verts.new((x * table, y * table, h_crown)) for x, y in outline]
    rings.append(tab)
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(tab)
    if culet > 0:
        cr = [bm.verts.new((x * culet, y * culet, -d_pav)) for x, y in outline]
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((gird[j], gird[i], cr[i], cr[j]))
        bm.faces.new(list(reversed(cr)))
    else:
        tip = bm.verts.new((0, 0, -d_pav))
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((gird[j], gird[i], tip))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = link(bpy.data.objects.new(name, me))
    for p in me.polygons:
        p.use_smooth = False
    return o


def poly_outline(kind, r):
    """Plan outlines of Gemstone's six stones plus the treasure coin."""
    pts = []
    if kind == "Y":  # round brilliant
        for i in range(16):
            a = i / 16 * 2 * math.pi
            pts.append((r * math.cos(a), r * math.sin(a)))
    elif kind == "R":  # cushion / emerald cut square
        c = 0.28
        for (x, y) in ((1, 1 - c), (1 - c, 1), (-1 + c, 1), (-1, 1 - c), (-1, -1 + c), (-1 + c, -1), (1 - c, -1),
                       (1, -1 + c)):
            pts.append((x * r * 0.86, y * r * 0.86))
        pts = list(reversed(pts))
    elif kind == "G":  # rhombus
        for (x, y) in ((0, 1), (-0.78, 0), (0, -1), (0.78, 0)):
            pts.append((x * r * 1.05, y * r * 1.05))
    elif kind == "B":  # trillion
        for i in range(3):
            a = math.pi / 2 + i / 3 * 2 * math.pi
            pts.append((r * 1.12 * math.cos(a), r * 1.12 * math.sin(a) - r * 0.18))
        # soften corners into a 9-gon so the triangle has small cut tips
        out = []
        for i in range(3):
            p0, p1 = pts[i], pts[(i + 1) % 3]
            for t in (0.06, 0.94):
                out.append((p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t))
        pts = out
    elif kind == "P":  # five-point star
        for i in range(10):
            a = math.pi / 2 + i / 10 * 2 * math.pi
            rr = r * 1.08 if i % 2 == 0 else r * 0.5
            pts.append((rr * math.cos(a), rr * math.sin(a)))
    elif kind == "K":  # hexagon
        for i in range(6):
            a = math.pi / 2 + i / 6 * 2 * math.pi
            pts.append((r * 0.98 * math.cos(a), r * 0.98 * math.sin(a)))
    elif kind == "T":  # treasure coin (octagon)
        for i in range(8):
            a = math.pi / 8 + i / 8 * 2 * math.pi
            pts.append((r * math.cos(a), r * math.sin(a)))
    return pts


GEM_COLOURS = {  # today's colours (Gemstone's sprites)
    "Y": (255, 204, 40),
    "R": (232, 48, 66),
    "G": (36, 196, 112),
    "B": (52, 116, 236),
    "P": (150, 82, 226),
    "K": (236, 86, 182),
}


def gem_material(kind, look="A"):
    """Real stone: transmission with the colour in the glass, a high IOR for fire, a touch of the colour in a
    faint inner glow so a stone never reads black against a dark cell."""
    key = f"gem-{kind}-{look}"
    m = bpy.data.materials.get(key)
    if m:
        return m
    c = GEM_COLOURS[kind]
    ior = {"Y": 1.9, "R": 1.77, "G": 1.6, "B": 1.77, "P": 1.55, "K": 1.6}[kind]
    m, nt, b = node_mat(key)
    b.inputs["Base Color"].default_value = lin(c)
    b.inputs["Transmission Weight"].default_value = 1.0
    b.inputs["Roughness"].default_value = 0.0
    b.inputs["IOR"].default_value = ior + (0.3 if look != "A" else 0)
    b.inputs["Emission Color"].default_value = lin(c)
    b.inputs["Emission Strength"].default_value = 0.35 if look == "A" else 0.22
    # depth colour: a volume absorption deepens thick parts like real stones
    va = nt.nodes.new("ShaderNodeVolumeAbsorption")
    va.inputs["Color"].default_value = lin(c)
    va.inputs["Density"].default_value = {"Y": 1.2, "P": 2.5, "K": 2.5}.get(kind, 3.5)
    nt.links.new(va.outputs[0], nt.nodes["Material Output"].inputs["Volume"])
    return m


def gem(kind, x, y, size, look="A", z=0.0, rot=0.0):
    r = u(size / 2)
    if kind == "T":
        o = gem_mesh("coin", poly_outline("T", r), r * 0.32, r * 0.2, table=0.78, mid=(0.92, 0.55), culet=0.8)
        o.data.materials.append(bpy.data.materials.get("bronze") or
                                mat("bronze", (196, 120, 62), rough=0.2, metal=1.0, coat=0.3))
    else:
        mid = {"Y": (0.82, 0.55), "R": (0.8, 0.5), "G": (0.75, 0.55), "B": (0.75, 0.5), "P": (0.8, 0.5),
               "K": (0.8, 0.5)}[kind]
        tab = {"Y": 0.52, "R": 0.58, "G": 0.45, "B": 0.45, "P": 0.5, "K": 0.55}[kind]
        o = gem_mesh("gem", poly_outline(kind, r), r * 0.42, r * 0.85, table=tab, mid=mid)
        o.data.materials.append(gem_material(kind, look))
    o.location = P(x, y, z + r * 0.85)
    o.rotation_euler = (0, 0, math.radians(rot))
    return o


def marble(name, x, y, r_px, color, z=0.0, swirl=True):
    """A glass marble: clear glass with a coloured core and a ribbon swirl, sitting on the surface."""
    r = u(r_px)
    shell = sphere(name, r, glass(name + "-glass", (250, 252, 255), rough=0.0, ior=1.5), loc=P(x, y, z + r))
    core_m = mat(name + "-core", color, rough=0.15, coat=0.5, sss=0.2)
    sphere(name + "-core", r * 0.82, core_m, loc=P(x, y, z + r))
    return shell


def pills_at(im, pills, y, right=False, style="dark", gap=8, x0=12):
    """HUD chips at any screen height; right=True right-aligns them to x = 390 - x0."""
    from PIL import ImageDraw
    k = im.size[1] / H
    if right:
        d = ImageDraw.Draw(im)
        fl, fv = font(600, int(10 * k)), font(800, int(13 * k))
        tot = sum(d.textlength(l.upper(), font=fl) + d.textlength(str(v), font=fv) + 26 * k for l, v, _ in pills)
        tot += gap * k * (len(pills) - 1)
        x0 = (im.size[0] - tot) / k - x0
    return hud_pills(im, pills, y=y, style=style, gap=gap, x0=x0)


def stars_image(w, h, top, bottom, n=180, seed=3, glow=None):
    """A vertical gradient sky with soft stars (and optional nebula blobs: list of (x, y, r, rgb, alpha))."""
    import random
    from PIL import Image, ImageDraw, ImageFilter
    import numpy as np
    t = np.linspace(0, 1, h)[:, None, None]
    a = np.array(top)[None, None, :] * (1 - t) + np.array(bottom)[None, None, :] * t
    im = Image.fromarray(np.repeat(a, w, axis=1).astype("uint8"))
    if glow:
        lay = Image.new("RGB", (w, h), (0, 0, 0))
        d = ImageDraw.Draw(lay)
        for (x, y, r, c, al) in glow:
            d.ellipse([x - r, y - r, x + r, y + r], fill=tuple(int(v * al) for v in c))
        lay = lay.filter(ImageFilter.GaussianBlur(w / 8))
        im = Image.fromarray(np.clip(np.asarray(im).astype(int) + np.asarray(lay).astype(int), 0, 255).astype("uint8"))
    rng = random.Random(seed)
    st = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(st)
    for _ in range(n):
        x, y = rng.random() * w, rng.random() * h
        s = rng.choice([0.6, 0.8, 1.0, 1.0, 1.4, 2.2]) * w / 390
        al = rng.randint(90, 230)
        d.ellipse([x - s, y - s, x + s, y + s], fill=(255, 246, 255, al))
    st2 = st.filter(ImageFilter.GaussianBlur(w / 390 * 1.2))
    im = im.convert("RGBA")
    im.alpha_composite(st2)
    im.alpha_composite(st)
    return im.convert("RGB")
