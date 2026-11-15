"""Galaxy card art (card-art.galaxy): a glowing spiral galaxy seen at an angle, nebula clouds lit from within, thousands
of stars at many depths, depth of field. 900 x 336 (3x the card).

The galaxy's light is a procedural emission map (log-spiral arms, dust lanes, star-forming knots, a warm core) on a
tilted disc; the nebula is a volume; the stars are emissive spheres in three depth layers (the near ones out of focus).
"""
import math
import os
import sys

import bpy
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib  # noqa: E402

RNG = np.random.default_rng(20261115)


def fbm(n, octaves=6, seed=1):
    rng = np.random.default_rng(seed)
    out = np.zeros((n, n), np.float32)
    amp, total = 1.0, 0.0
    for o in range(octaves):
        cells = 4 * 2**o
        g = rng.random((cells, cells)).astype(np.float32)
        img = Image.fromarray((g * 255).astype(np.uint8)).resize((n, n), Image.BICUBIC)
        out += np.asarray(img, np.float32) / 255 * amp
        total += amp
        amp *= 0.55
    return out / total


def splat(xs, ys, n, weights=None):
    """Accumulate particles (coordinates in -1..1) into an n x n map."""
    h, _, _ = np.histogram2d(ys, xs, bins=n, range=[[-1, 1], [-1, 1]], weights=weights)
    return h.astype(np.float32)


def blur(a, radius):
    from scipy.ndimage import gaussian_filter

    return gaussian_filter(a, radius)


def galaxy_map(n=1536):
    """The galaxy's light from about 300,000 star particles: young blue stars along two log-spiral arms (with spurs),
    old yellow stars in the disc and bulge, pink star-forming clusters on the arms, dark dust on the arms' inner edge."""
    pitch = math.tan(math.radians(21))

    def arm_points(count, scatter, inner_shift=0.0):
        r = 0.05 + np.minimum(RNG.exponential(0.38, count), 0.98)
        arm = RNG.integers(0, 2, count)
        ang = arm * math.pi + np.log(r) / pitch + inner_shift + RNG.normal(0, 0.16, count)
        perp = RNG.normal(0, scatter * (0.4 + r), count)
        x = r * np.cos(ang) + perp * -np.sin(ang)
        y = r * np.sin(ang) + perp * np.cos(ang)
        return x, y, r

    yx, yy, yr = arm_points(200000, 0.085)
    young = blur(splat(yx, yy, n), 1.2) * 0.35 + blur(splat(yx, yy, n), 5) * 0.9 + blur(splat(yx, yy, n), 16) * 1.6
    # Spurs: short feathers off the arms.
    sx, sy, _ = arm_points(30000, 0.11, 0.35)
    young += blur(splat(sx, sy, n), 2.5) * 0.6
    # Old stars: an exponential disc and a bulge.
    rr = RNG.exponential(0.34, 140000)
    aa = RNG.random(140000) * math.tau
    old = blur(splat(rr * np.cos(aa), rr * np.sin(aa), n), 10) * 1.0
    br = np.abs(RNG.normal(0, 0.07, 40000))
    ba = RNG.random(40000) * math.tau
    old += blur(splat(br * np.cos(ba), br * np.sin(ba), n), 4) * 2.2
    # Star-forming clusters: tight knots placed on the arms.
    cx, cy, cr = arm_points(420, 0.03)
    kw = np.repeat(RNG.exponential(1.0, 420), 40)
    kx = np.repeat(cx, 40) + RNG.normal(0, 0.004, 420 * 40)
    ky = np.repeat(cy, 40) + RNG.normal(0, 0.004, 420 * 40)
    knots = blur(splat(kx, ky, n, kw), 1.2) * 0.8 + blur(splat(kx, ky, n, kw), 4) * 0.5
    # Dust: on the arms' inner edge.
    dx, dy, _ = arm_points(110000, 0.035, -0.2)
    dust = blur(splat(dx, dy, n), 3.5)
    dust = np.clip(dust / (np.percentile(dust, 99.5) + 1e-6), 0, 1)
    norm = lambda a: np.clip(a / (np.percentile(a, 99.8) + 1e-6), 0, 3) ** 0.6  # compressed, so the outer arms show
    young, old, knots = norm(young), norm(old), norm(knots)
    blue = np.array([0.36, 0.56, 1.0], np.float32)
    gold = np.array([1.0, 0.8, 0.55], np.float32)
    pink = np.array([1.0, 0.38, 0.7], np.float32)
    rgb = blue * young[..., None] * 1.0 + gold * old[..., None] * 1.25 + pink * knots[..., None] * 0.9
    rgb *= (1 - 0.8 * dust)[..., None]
    yy_, xx_ = np.mgrid[-1:1:n * 1j, -1:1:n * 1j]
    rgb *= np.clip((0.98 - np.sqrt(xx_**2 + yy_**2)) / 0.25, 0, 1)[..., None].astype(np.float32)  # no square edge
    # A few bright foreground-of-the-disc stars.
    sp = RNG.random((n, n)).astype(np.float32)
    rgb += (sp > 0.9985)[..., None] * (young * 4 + 0.1)[..., None] * np.array([0.9, 0.95, 1.0], np.float32)
    alpha = np.clip(rgb.max(axis=2) * 2.2, 0, 1)
    rgba = np.concatenate([rgb, alpha[..., None]], axis=2)
    img = bpy.data.images.new("galaxy", n, n, alpha=True, float_buffer=True)
    img.pixels.foreach_set(rgba[::-1].reshape(-1))  # Blender's rows start at the bottom
    return img


def galaxy_disc(img):
    bpy.ops.mesh.primitive_plane_add(size=4.3, location=(2.05, 0.6, 0.08))
    o = bpy.context.object
    o.rotation_euler = (math.radians(70), math.radians(-10), math.radians(32))
    m = bpy.data.materials.new("galaxy")
    m.use_nodes = True
    nt = m.node_tree
    for nd in list(nt.nodes):
        nt.nodes.remove(nd)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.interpolation = "Cubic"
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs[1].default_value = 1.3
    tr = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    add = nt.nodes.new("ShaderNodeAddShader")
    nt.links.new(tex.outputs["Color"], em.inputs[0])
    nt.links.new(tex.outputs["Alpha"], mix.inputs[0])
    nt.links.new(tr.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0])
    m.blend_method = "BLEND" if hasattr(m, "blend_method") else None
    o.data.materials.append(m)


def nebula():
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-0.6, 3.5, 0.0))
    o = bpy.context.object
    o.scale = (11, 2.5, 4.2)
    m = bpy.data.materials.new("nebula")
    m.use_nodes = True
    nt = m.node_tree
    for nd in list(nt.nodes):
        nt.nodes.remove(nd)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    vol = nt.nodes.new("ShaderNodeVolumePrincipled")
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 2.2
    noise.inputs["Detail"].default_value = 14
    noise.inputs["Roughness"].default_value = 0.66
    noise.inputs["Distortion"].default_value = 2.2
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.47
    ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    ramp.color_ramp.elements[1].position = 0.86
    ramp.color_ramp.elements[1].color = (1, 1, 1, 1)
    hue = nt.nodes.new("ShaderNodeTexNoise")
    hue.inputs["Scale"].default_value = 1.1
    cramp = nt.nodes.new("ShaderNodeValToRGB")
    cramp.color_ramp.elements[0].color = (0.95, 0.16, 0.5, 1)
    cramp.color_ramp.elements[1].color = (0.05, 0.62, 0.85, 1)
    cramp.color_ramp.elements.new(0.5).color = (0.36, 0.1, 0.8, 1)
    dens = nt.nodes.new("ShaderNodeMath")
    dens.operation = "MULTIPLY"
    dens.inputs[1].default_value = 1.4
    em = nt.nodes.new("ShaderNodeMath")
    em.operation = "MULTIPLY"
    em.inputs[1].default_value = 1.6
    # Fade to nothing well inside the box, so its edges never show.
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (2.0, 2.0, 2.0)
    grad = nt.nodes.new("ShaderNodeTexGradient")
    grad.gradient_type = "SPHERICAL"
    fall = nt.nodes.new("ShaderNodeMath")
    fall.operation = "MULTIPLY"
    nt.links.new(tc.outputs["Object"], mp.inputs[0])
    nt.links.new(mp.outputs[0], grad.inputs[0])
    nt.links.new(noise.outputs["Fac"], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], fall.inputs[0])
    nt.links.new(grad.outputs["Fac"], fall.inputs[1])
    nt.links.new(fall.outputs[0], dens.inputs[0])
    nt.links.new(dens.outputs[0], vol.inputs["Density"])
    nt.links.new(hue.outputs["Fac"], cramp.inputs[0])
    nt.links.new(cramp.outputs[0], vol.inputs["Color"])
    nt.links.new(cramp.outputs[0], vol.inputs["Emission Color"])
    nt.links.new(fall.outputs[0], em.inputs[0])
    nt.links.new(em.outputs[0], vol.inputs["Emission Strength"])
    nt.links.new(vol.outputs[0], out.inputs["Volume"])
    o.data.materials.append(m)


def stars(count, depth_y, spread, radius, colours, strength, name):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=radius)
    proto = bpy.context.object
    proto.name = name + "-proto"
    mats = [lib.emission_material(f"{name}{i}", c, strength) for i, c in enumerate(colours)]
    for i, mat in enumerate(mats):
        pts = np.column_stack(
            [RNG.uniform(-spread[0], spread[0], count), RNG.uniform(depth_y[0], depth_y[1], count), RNG.uniform(-spread[1], spread[1], count)]
        )
        me = bpy.data.meshes.new(f"{name}{i}pts")
        me.from_pydata(pts.tolist(), [], [])
        holder = bpy.data.objects.new(f"{name}{i}", me)
        bpy.context.scene.collection.objects.link(holder)
        holder.instance_type = "VERTS"
        child = proto.copy()
        child.data = proto.data.copy()
        child.data.materials.append(mat)
        bpy.context.scene.collection.objects.link(child)
        child.parent = holder
    bpy.data.objects.remove(proto)


s = lib.reset(900, 336, samples=int(os.environ.get("SAMPLES", 192)))
lib.world((0.003, 0.004, 0.012), 1.0)
galaxy_disc(galaxy_map())
nebula()
WHITE, BLUE, GOLDISH, PINK = (1, 1, 1), (0.62, 0.78, 1.0), (1.0, 0.85, 0.6), (1.0, 0.6, 0.85)
for k, (count, strength) in enumerate(((1800, 2.5), (500, 7), (110, 22))):
    stars(count, (6, 14), (13, 5), 0.0035, [WHITE, BLUE, GOLDISH], strength, f"far{k}")
stars(40, (-1, 4), (6, 2.4), 0.005, [WHITE, BLUE, PINK], 40, "mid")
stars(14, (-6.5, -4.5), (3.6, 1.3), 0.012, [WHITE, BLUE], 60, "near")
lib.camera((0, -12, 0), (0, 0, 0), lens=50, dof_target=(1.95, 0.6, 0), fstop=1.2)
png = os.path.join(lib.TMP, "galaxy.png")
secs = lib.render(png)
img = lib.bloom(Image.open(png), threshold=0.5, radius=16, amount=0.6)
path, size = lib.save_webp(img, "card-art.galaxy")
print(f"galaxy: {secs:.1f} s render, {size / 1024:.1f} KB -> {path}")
