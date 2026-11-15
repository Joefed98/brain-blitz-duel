"""Shared helpers for the cosmetics redraws' Blender renders (docs/design/cosmetics-redraws/ART-DIRECTION.md).

Every script: `python <script>.py` with bpy 5.3 (pip install bpy). Fixed seeds; Cycles on the CPU with
OpenImageDenoise. Output PNG (linear workflow, AgX view), then post (bloom, grade) and WebP via Pillow.
"""
import math
import os
import time

import bpy
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, "../../../.."))
OUT = os.path.join(REPO, "public/cosmetics/redrawn")
TMP = os.environ.get("RENDER_TMP", "/tmp")


def reset(w, h, samples=128, transparent=False):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.cycles.samples = samples
    s.cycles.use_denoising = True
    s.cycles.seed = 7
    s.render.resolution_x = w
    s.render.resolution_y = h
    s.render.resolution_percentage = 100
    s.render.film_transparent = transparent
    s.render.image_settings.file_format = "PNG"
    s.render.image_settings.color_mode = "RGBA" if transparent else "RGB"
    s.view_settings.view_transform = "AgX"
    s.view_settings.look = "AgX - Medium High Contrast"
    s.cycles.max_bounces = 8
    return s


def world(colour=(0.0, 0.0, 0.0), strength=1.0):
    w = bpy.data.worlds.new("world")
    bpy.context.scene.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (*colour, 1)
    bg.inputs[1].default_value = strength
    return w


def material(name, base=(0.8, 0.8, 0.8), metallic=0.0, roughness=0.4, emission=None, strength=0.0, transmission=0.0, ior=1.45, coat=0.0, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*base, 1)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = roughness
    b.inputs["IOR"].default_value = ior
    b.inputs["Transmission Weight"].default_value = transmission
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Alpha"].default_value = alpha
    if emission is not None:
        b.inputs["Emission Color"].default_value = (*emission, 1)
        b.inputs["Emission Strength"].default_value = strength
    return m


def emission_material(name, colour, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs[0].default_value = (*colour, 1)
    em.inputs[1].default_value = strength
    nt.links.new(em.outputs[0], out.inputs[0])
    return m


def camera(location, target, lens=50, dof_target=None, fstop=2.8, ortho_scale=None):
    cam = bpy.data.cameras.new("cam")
    obj = bpy.data.objects.new("cam", cam)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.scene.camera = obj
    obj.location = location
    look_at(obj, target)
    cam.lens = lens
    cam.clip_end = 1000
    if ortho_scale:
        cam.type = "ORTHO"
        cam.ortho_scale = ortho_scale
    if dof_target is not None:
        cam.dof.use_dof = True
        cam.dof.focus_distance = (np.array(dof_target) - np.array(location)).__pow__(2).sum() ** 0.5
        cam.dof.aperture_fstop = fstop
    return obj


def look_at(obj, target):
    from mathutils import Vector

    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def area_light(location, target, energy, size, colour=(1, 1, 1)):
    l = bpy.data.lights.new("area", "AREA")
    l.energy = energy
    l.size = size
    l.color = colour
    o = bpy.data.objects.new("area", l)
    bpy.context.scene.collection.objects.link(o)
    o.location = location
    look_at(o, target)
    return o


def render(path_png):
    s = bpy.context.scene
    s.render.filepath = path_png
    t = time.time()
    bpy.ops.render.render(write_still=True)
    return time.time() - t


def bloom(img, threshold=0.62, radius=18, amount=0.55):
    """A soft bloom from the highlights (what a lens does with emissive light)."""
    a = np.asarray(img.convert("RGB")).astype(np.float32) / 255
    lum = a.max(axis=2, keepdims=True)
    hi = np.clip((lum - threshold) / (1 - threshold), 0, 1) * a
    hi_img = Image.fromarray((hi * 255).astype(np.uint8))
    blur = np.zeros_like(a)
    for r, w in ((radius / 3, 0.5), (radius, 0.35), (radius * 2.5, 0.15)):
        blur += np.asarray(hi_img.filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255 * w
    out = 1 - (1 - a) * (1 - np.clip(blur * amount * 2, 0, 1))
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))


def save_webp(img, name, quality=88):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{name}.webp")
    img.save(path, "WEBP", quality=quality, method=6)
    return path, os.path.getsize(path)


def split_tone(img, shadow=(0.02, 0.05, 0.16), highlight=(1.0, 0.8, 0.38), amount=0.5):
    """A grade: shadows towards navy, highlights towards gold (the Joulz palette), by luminance."""
    a = np.asarray(img.convert("RGB")).astype(np.float32) / 255
    lum = (a @ np.array([0.2126, 0.7152, 0.0722], np.float32))[..., None]
    sh = np.array(shadow, np.float32)
    hi = np.array(highlight, np.float32)
    tint = sh * (1 - lum) + hi * lum
    out = a * (1 - amount) + (a * tint / np.maximum(tint.max(axis=-1, keepdims=True), 1e-3) * amount)
    out = out * (1 - 0.35 * amount * (1 - lum)) + sh * 0.25 * amount * (1 - lum)
    return Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8))
