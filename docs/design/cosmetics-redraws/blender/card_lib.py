"""Builders the card-art scenes share (cards_*.py): fog and cloud volumes, light channels (arcs, bolts, sparks),
height-field meshes (waves, cloth, ground), cut gems, a crown, metals and the card's own render and finish.
Everything seeded; 900 x 336 (3x the card)."""
import math
import os

import bpy
import numpy as np
from PIL import Image

import lib

GOLD = (1.0, 0.74, 0.34)
CHAMPAGNE = (0.93, 0.76, 0.48)
NAVY = (0.02, 0.035, 0.11)
INK = (0.006, 0.008, 0.02)


def card(samples):
    s = lib.reset(900, 336, samples=int(os.environ.get("SAMPLES", samples)))
    s.cycles.volume_bounces = 1
    return s


def metal(name, colour, roughness=0.2):
    return lib.material(name, base=colour, metallic=1.0, roughness=roughness)


def glass(name, colour, ior=1.5, roughness=0.0):
    return lib.material(name, base=colour, roughness=roughness, transmission=1.0, ior=ior)


def emit(name, colour, strength):
    return lib.emission_material(name, colour, strength)


def mat_of(o, m):
    o.data.materials.append(m)
    return o


def _nodes(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    return m, nt


def noise_volume(name, location, scale, density, colour, noise_scale=1.0, lo=0.45, hi=0.7, emission=None, emission_strength=0.0, anisotropy=0.2, fade=True, distortion=0.4):
    """A box of volume shaped by noise (clouds, smoke, steam); faded towards its edges so no box shows."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    o = bpy.context.object
    o.scale = scale
    m, nt = _nodes(name)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    vol.inputs["Color"].default_value = (*colour, 1)
    vol.inputs["Anisotropy"].default_value = anisotropy
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = scale
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = noise_scale
    nz.inputs["Detail"].default_value = 12
    nz.inputs["Roughness"].default_value = 0.62
    nz.inputs["Distortion"].default_value = distortion
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = lo
    ramp.color_ramp.elements[1].position = hi
    nt.links.new(tc.outputs["Object"], mp.inputs[0])
    nt.links.new(mp.outputs[0], nz.inputs["Vector"])
    nt.links.new(nz.outputs["Fac"], ramp.inputs[0])
    d = ramp.outputs[0]
    if fade:
        g = nt.nodes.new("ShaderNodeTexGradient")
        g.gradient_type = "SPHERICAL"
        m2 = nt.nodes.new("ShaderNodeMapping")
        m2.inputs["Scale"].default_value = (2.0, 2.0, 2.0)
        nt.links.new(tc.outputs["Object"], m2.inputs[0])
        nt.links.new(m2.outputs[0], g.inputs[0])
        mul = nt.nodes.new("ShaderNodeMath")
        mul.operation = "MULTIPLY"
        nt.links.new(d, mul.inputs[0])
        nt.links.new(g.outputs["Fac"], mul.inputs[1])
        d = mul.outputs[0]
    dm = nt.nodes.new("ShaderNodeMath")
    dm.operation = "MULTIPLY"
    dm.inputs[1].default_value = density
    nt.links.new(d, dm.inputs[0])
    nt.links.new(dm.outputs[0], vol.inputs["Density"])
    if emission is not None:
        vol.inputs["Emission Color"].default_value = (*emission, 1)
        em = nt.nodes.new("ShaderNodeMath")
        em.operation = "MULTIPLY"
        em.inputs[1].default_value = emission_strength
        nt.links.new(d, em.inputs[0])
        nt.links.new(em.outputs[0], vol.inputs["Emission Strength"])
    nt.links.new(vol.outputs[0], out.inputs["Volume"])
    o.data.materials.append(m)
    return o


def fog(density, colour=(0.5, 0.55, 0.7), size=(60, 60, 30), centre=(0, 10, 4)):
    """A uniform haze through the scene (light shafts, depth)."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=centre)
    o = bpy.context.object
    o.scale = size
    m, nt = _nodes("fog")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    vol = nt.nodes.new("ShaderNodeVolumeScatter")
    vol.inputs["Color"].default_value = (*colour, 1)
    vol.inputs["Density"].default_value = density
    nt.links.new(vol.outputs[0], out.inputs["Volume"])
    o.data.materials.append(m)
    return o


def path(rng, a, b, depth, rough, squash=(1, 0.35, 0.25)):
    """Midpoint displacement between two 3D points (a jagged arc or bolt)."""
    pts = [np.array(a, float), np.array(b, float)]
    for _ in range(depth):
        out = [pts[0]]
        for p, q in zip(pts, pts[1:]):
            L = np.linalg.norm(q - p)
            out += [(p + q) / 2 + rng.normal(0, rough * L, 3) * np.array(squash), q]
        pts = out
    return pts


def tube(pts, radius, mat, name="tube", taper=0.0):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 2
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (*p, 1)
        sp.points[i].radius = 1.0 - taper * i / max(1, len(pts) - 1)
    o = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(mat)
    return o


def arc(pts, radius, core, glow, strength, light_energy=0.0, name="arc"):
    """A light channel: a hot core, a coloured sheath, optionally lights along it."""
    tube(pts, radius, emit(name + "c", core, strength), name + "c", taper=0.5)
    m, nt = _nodes(name + "s")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs[0].default_value = (*glow, 1)
    em.inputs[1].default_value = strength * 0.2
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mx = nt.nodes.new("ShaderNodeMixShader")
    mx.inputs[0].default_value = 0.5
    nt.links.new(tr.outputs[0], mx.inputs[1])
    nt.links.new(em.outputs[0], mx.inputs[2])
    nt.links.new(mx.outputs[0], out.inputs[0])
    tube(pts, radius * 3.4, m, name + "s", taper=0.5)
    if light_energy:
        for p in pts[:: max(1, len(pts) // 4)]:
            point_light(p, light_energy, glow, 0.3)


def point_light(loc, energy, colour=(1, 1, 1), size=0.2):
    l = bpy.data.lights.new("pt", "POINT")
    l.energy = energy
    l.color = colour
    l.shadow_soft_size = size
    o = bpy.data.objects.new("pt", l)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    return o


def spot(loc, target, energy, colour=(1, 1, 1), angle=30, blend=0.4, size=0.3):
    l = bpy.data.lights.new("spot", "SPOT")
    l.energy = energy
    l.color = colour
    l.spot_size = math.radians(angle)
    l.spot_blend = blend
    l.shadow_soft_size = size
    o = bpy.data.objects.new("spot", l)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    lib.look_at(o, target)
    return o


def heightfield(name, nx, ny, sx, sy, height, location=(0, 0, 0), mat=None):
    """A grid mesh nx x ny over sx x sy, z = height(X, Y) (numpy arrays), smooth."""
    xs = np.linspace(-sx / 2, sx / 2, nx)
    ys = np.linspace(-sy / 2, sy / 2, ny)
    X, Y = np.meshgrid(xs, ys)
    Z = height(X, Y)
    verts = np.column_stack([X.ravel(), Y.ravel(), Z.ravel()]).tolist()
    faces = []
    for j in range(ny - 1):
        for i in range(nx - 1):
            a = j * nx + i
            faces.append((a, a + 1, a + nx + 1, a + nx))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.shade_smooth()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.location = location
    if mat:
        o.data.materials.append(mat)
    return o


def fbm2(X, Y, seed, octaves=5, freq=1.0):
    """A smooth fractal height (sums of seeded sine waves), -1..1-ish."""
    rng = np.random.default_rng(seed)
    out = np.zeros_like(X)
    amp = 1.0
    for o in range(octaves):
        kx, ky = rng.normal(0, 1, (2, 6)) * freq * 2**o
        ph = rng.uniform(0, math.tau, 6)
        out += amp * sum(np.sin(X * kx[i] + Y * ky[i] + ph[i]) for i in range(6)) / 6
        amp *= 0.5
    return out


def gem(loc, r, mat, rot=(0, 0, 0), name="gem"):
    """A brilliant cut: a crown and a pavilion in one mesh, origin at the girdle."""
    me = bpy.data.meshes.new(name)
    n = 16
    verts = [(0, 0, r * 0.45)]
    verts += [(r * 0.56 * math.cos(a), r * 0.56 * math.sin(a), r * 0.45) for a in np.linspace(0, math.tau, n, endpoint=False)]
    verts += [(r * math.cos(a + math.pi / n), r * math.sin(a + math.pi / n), 0) for a in np.linspace(0, math.tau, n, endpoint=False)]
    verts += [(0, 0, -r * 0.86)]
    faces = []
    for i in range(n):
        j = (i + 1) % n
        faces.append((0, 1 + i, 1 + j))
        faces.append((1 + i, 1 + n + i, 1 + j))
        faces.append((1 + j, 1 + n + i, 1 + n + j))
        faces.append((1 + n + i, 2 * n + 1, 1 + n + j))
    me.from_pydata(verts, [], faces)
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = rot
    o.data.materials.append(mat)
    return o


def crown(loc, scale, gold_mat, jewel_mats):
    """A coronet: a band with beaded rims, eight points each tipped with a pearl, jewels set round the band."""
    x, y, z = loc
    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=1.0 * scale, depth=0.55 * scale, location=(x, y, z + 0.27 * scale))
    band = bpy.context.object
    sol = band.modifiers.new("solid", "SOLIDIFY")
    band.data.materials.append(gold_mat)
    # Open top and bottom: the band is a ring.
    import bmesh

    bm = bmesh.new()
    bm.from_mesh(band.data)
    for f in [f for f in bm.faces if abs(f.normal.z) > 0.9]:
        bm.faces.remove(f)
    bm.to_mesh(band.data)
    bm.free()
    sol.thickness = 0.06 * scale
    bpy.ops.object.shade_smooth()
    pearl = lib.material("pearl", base=(0.95, 0.92, 0.86), roughness=0.18, coat=1.0)
    for rim_z in (0.0, 0.55):
        bpy.ops.mesh.primitive_torus_add(major_radius=1.0 * scale, minor_radius=0.055 * scale, location=(x, y, z + rim_z * scale))
        bpy.context.object.data.materials.append(gold_mat)
        bpy.ops.object.shade_smooth()
    for k in range(8):
        a = k * math.tau / 8
        cx, cy = x + math.cos(a) * 0.97 * scale, y + math.sin(a) * 0.97 * scale
        h = (0.78 if k % 2 == 0 else 0.5) * scale
        bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.2 * scale, radius2=0.035 * scale, depth=h, location=(cx, cy, z + 0.55 * scale + h / 2))
        bpy.context.object.data.materials.append(gold_mat)
        bpy.ops.object.shade_smooth()
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.09 * scale, location=(cx, cy, z + 0.55 * scale + h + 0.05 * scale))
        bpy.context.object.data.materials.append(pearl)
        bpy.ops.object.shade_smooth()
        jm = jewel_mats[k % len(jewel_mats)]
        b = a + math.tau / 16
        gem((x + math.cos(b) * 1.02 * scale, y + math.sin(b) * 1.02 * scale, z + 0.27 * scale), 0.12 * scale, jm, rot=(math.pi / 2, 0, b + math.pi / 2))


def finish(name, png, bloom=(0.62, 16, 0.5), tone=None, quality=86):
    img = Image.open(png)
    if bloom:
        img = lib.bloom(img, *bloom)
    if tone:
        img = lib.split_tone(img, **tone)
    q = quality
    while True:
        path_, size = lib.save_webp(img, name, quality=q)
        if size <= 78 * 1024 or q <= 60:
            return path_, size
        q -= 6


def run(name, build, cam, samples=160, bloom=(0.62, 16, 0.5), tone=None):
    """Build the scene, render the card, finish it and print the time and size."""
    card(samples)
    build()
    lib.camera(**cam)
    png = os.path.join(lib.TMP, f"{name}.png")
    secs = lib.render(png)
    _, size = finish(name, png, bloom, tone)
    print(f"{name}: {secs:.1f} s, {size / 1024:.1f} KB")


def glints(img, threshold=0.93, count=40, length=10, strength=0.9, min_gap=10):
    """Star glints on the brightest specular points (what a lens does with a gem's fire): a thin four-point star on
    each local peak above `threshold`, brightest first, at most `count`, `min_gap` px apart."""
    from scipy.ndimage import maximum_filter

    a = np.asarray(img.convert("RGB")).astype(np.float32) / 255
    lum = a.max(axis=2)
    peaks = (lum == maximum_filter(lum, size=min_gap)) & (lum >= threshold)
    ys, xs = np.nonzero(peaks)
    order = np.argsort(-lum[ys, xs])[:count]
    h, w = lum.shape
    add = np.zeros((h, w), np.float32)
    for i in order:
        y, x = ys[i], xs[i]
        k = lum[y, x]
        L = int(length * (0.5 + k))
        for d in range(-L, L + 1):
            f = (1 - abs(d) / (L + 1)) ** 2.2 * strength * k
            if 0 <= x + d < w:
                add[y, x + d] = max(add[y, x + d], f)
            if 0 <= y + d < h:
                add[y + d, x] = max(add[y + d, x], f)
        for d in range(-L // 2, L // 2 + 1):
            f = (1 - abs(d) / (L // 2 + 1)) ** 2.4 * strength * k * 0.45
            for yy, xx in ((y + d, x + d), (y + d, x - d)):
                if 0 <= yy < h and 0 <= xx < w:
                    add[yy, xx] = max(add[yy, xx], f)
    out = 1 - (1 - a) * (1 - np.clip(add, 0, 1)[..., None] * np.array([1.0, 0.98, 0.95], np.float32))
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))
