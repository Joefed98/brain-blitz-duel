"""Iron Wall (bastion): first-person turret holding a desert road. Mountains on the horizon, tanks advancing in a
wave, the cannon's barrel at the bottom, the crosshair on a tank and the SHELLS / RELOAD panel under the field."""
import math, random
from lib import *
from PIL import ImageDraw, ImageFont


def tank(name, loc, yaw, hull_m, track_m, wheel_m, weak_m=None, s=1.0):
    par = link(bpy.data.objects.new(name, None))
    par.location = loc
    par.rotation_euler = (0, 0, yaw)
    par.scale = (s, s, s)
    parts = []
    parts.append(box(name + 'hull', (0, 0, 0.95), (3.3, 6.6, 0.9), hull_m, 0.18))
    parts.append(prism(name + 'glacis', [(-1.6, 3.3), (1.6, 3.3), (1.5, 2.2), (-1.5, 2.2)], 1.38, 1.5, hull_m, 0.08))
    for sx in (-1.75, 1.75):
        parts.append(box(name + f'trk{sx}', (sx, 0, 0.55), (0.75, 7.0, 1.1), track_m, 0.3))
        for wy in range(-3, 4):
            parts.append(cyl(name + f'wh{sx}{wy}', (sx * 1.13, wy * 0.9, 0.5), 0.36, 0.12, wheel_m, verts=20, rot=(0, math.pi / 2, 0)))
    parts.append(cyl(name + 'tur', (0, -0.3, 1.75), 1.25, 0.75, hull_m, verts=32, r2=1.0, bevel=0.1))
    parts.append(box(name + 'mantlet', (0, 0.95, 1.75), (0.8, 0.5, 0.55), hull_m, 0.1))
    gun = cyl(name + 'gun', (0, 3.1, 1.78), 0.13, 4.2, track_m, verts=16, rot=(math.pi / 2, 0, 0))
    parts.append(gun)
    parts.append(cyl(name + 'brake', (0, 5.2, 1.78), 0.2, 0.4, track_m, verts=16, rot=(math.pi / 2, 0, 0)))
    parts.append(cyl(name + 'hatch', (0.4, -0.6, 2.18), 0.35, 0.12, hull_m, verts=20))
    if weak_m:
        parts.append(box(name + 'weak', (0, -3.32, 1.1), (1.4, 0.06, 0.4), weak_m, 0.02))
        parts.append(cyl(name + 'weak2', (0, -0.3, 2.14), 0.42, 0.05, weak_m, verts=24))
    for p in parts:
        p.parent = par
    return par


def build(look):
    rnd = random.Random(31)
    A = look == 'A'
    s = reset(world=(0.2, 0.22, 0.26))
    world_gradient((0.05, 0.09, 0.2) if A else (0.35, 0.12, 0.05), (0.32, 0.3, 0.3) if A else (0.9, 0.42, 0.12), 1.0, axis='Z')
    cam = s.camera
    cam.data.lens = 26.0
    cam.data.sensor_fit = 'VERTICAL'
    cam.data.sensor_height = 24.0
    cam.data.clip_end = 3000
    cam.location = (0, -6, 12.0)
    cam.rotation_euler = (math.radians(90 - 9.0), 0, 0)
    sand = mat('sand', (0.42, 0.33, 0.22), rough=0.92, bump=(1.2, 0.5, 10), color_noise=(0.05, (0.3, 0.22, 0.14), 0.6))
    road = mat('road', (0.27, 0.23, 0.18), rough=0.85, bump=(3.0, 0.35, 10), color_noise=(0.2, (0.2, 0.17, 0.13), 0.6))
    paint = mat('paint', (0.85, 0.82, 0.72), rough=0.6)
    hull = random_tint('hull', (0.1, 0.11, 0.07), (0.17, 0.17, 0.11), rough=0.6, bump=(4.0, 0.15, 4)) if A else random_tint('hull', (0.06, 0.06, 0.055), (0.11, 0.1, 0.09), rough=0.55, bump=(4.0, 0.15, 4))
    track = mat('track', (0.04, 0.04, 0.04), metal=0.6, rough=0.55, bump=(20.0, 0.5, 4))
    wheel = mat('wheel', (0.08, 0.08, 0.07), metal=0.4, rough=0.5)
    weak = mat('weak', (1.0, 0.5, 0.1), rough=0.3, emit=(1.0, 0.45, 0.08), estr=6.0)
    mount = mat('mountain', (0.03, 0.035, 0.045) if A else (0.05, 0.02, 0.02), rough=0.9, bump=(0.05, 0.8, 10))
    gunm = mat('barrel', (0.13, 0.14, 0.15), metal=1.0, rough=0.35, bump=(30.0, 0.05, 4))
    scorch = mat('scorch', (0.06, 0.05, 0.04), rough=0.95)

    plane('ground', (0, 900, 0), 2400, 2000, sand)
    plane('road', (0, 900, 0.01), 5.2, 2000, road)
    for x in (-2.5, 2.5):
        plane(f'edge{x}', (x, 900, 0.02), 0.12, 2000, paint)
    for i in range(60):
        plane(f'dash{i}', (0, 4 + i * 7, 0.02), 0.12, 2.6, paint)
    # verge rocks and scrub
    for i in range(260):
        y = rnd.uniform(5, 500)
        x = rnd.choice((-1, 1)) * rnd.uniform(4, 20 + y * 0.4)
        sphere(f'rock{i}', (x, y, 0), rnd.uniform(0.15, 0.6), mount if i % 3 else wheel, seg=8, ring=6, scale=(1.3, 1, 0.5))
    for i in range(14):
        y = rnd.uniform(15, 160)
        x = rnd.uniform(-20, 20)
        cyl(f'sc{i}', (x, y + 20, 0.03), rnd.uniform(0.5, 1.2), 0.02, scorch, verts=24)
    # mountain range on the horizon
    pts = [(-1600, 0)]
    x = -1600
    while x < 1600:
        x += rnd.uniform(40, 140)
        pts.append((x, rnd.uniform(40, 160)))
    pts.append((1600, 0))
    # a vertical prism standing at y = 1400 (x, z profile)
    verts = [(px, 1400, pz * 0.8) for px, pz in pts] + [(px, 1460, pz * 0.8) for px, pz in pts]
    n = len(pts)
    faces = [tuple(range(n)), tuple(reversed(range(n, 2 * n)))] + [(i, i + 1, n + i + 1, n + i) for i in range(n - 1)]
    mo = mesh_obj('mtns', verts, faces)
    mo.data.materials.append(mount)

    # the wave: tanks at varied distances (some showing a weak spot)
    spots = [(-1.0, 52, 0.15, True), (6.5, 58, -0.3, False), (-8.5, 66, 0.35, False), (9, 86, -0.25, True), (0.8, 100, 0.05, False),
             (-5, 118, 0.2, False), (14, 125, -0.3, False), (-15, 96, 0.4, False), (4, 150, 0.0, False), (-2, 190, 0.1, False), (11, 175, -0.2, False)]
    for i, (x, y, yaw, wk) in enumerate(spots):
        tank(f'tk{i}', (x, y, 0), math.pi + yaw, hull, track, wheel, weak if wk else None, s=0.55)
        cyl(f'tsh{i}', (x, y, 0.02), 2.4, 0.01, scorch, verts=24)
    # dust trails behind tanks
    dust = mat('dust', (0.6, 0.5, 0.38), rough=1.0)
    # the cannon barrel coming up from the bottom of the frame
    ga, gbp = Vector((0.0, -2.5, 9.6)), Vector((0.0, 2.2, 9.05))
    gb = cyl('gunbarrel', (ga + gbp) / 2, 0.15, (gbp - ga).length, gunm, verts=48, r2=0.12, bevel=0.01)
    gb.rotation_euler = (gbp - ga).to_track_quat('Z', 'Y').to_euler()
    mz = cyl('muzzle', gbp, 0.17, 0.45, gunm, verts=48, bevel=0.02)
    mz.rotation_euler = gb.rotation_euler
    # light: low sun from the left, sky dome
    sun = bpy.data.lights.new('sun', 'SUN')
    sun.energy = 4.0 if A else 5.0
    sun.angle = math.radians(1.5)
    sun.color = (1.0, 0.86, 0.68) if A else (1.0, 0.6, 0.3)
    so = link(bpy.data.objects.new('sun', sun))
    so.rotation_euler = (math.radians(70 if A else 80), math.radians(-25), math.radians(-40))
    # haze
    fm = bpy.data.materials.new('haze')
    fm.use_nodes = True
    nt = fm.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    v = nt.nodes.new('ShaderNodeVolumePrincipled')
    v.inputs['Density'].default_value = 0.0005 if A else 0.004
    v.inputs['Color'].default_value = (0.85, 0.75, 0.62, 1) if A else (1.0, 0.6, 0.35, 1)
    nt.links.new(v.outputs[0], nt.nodes['Material Output'].inputs['Volume'])
    box('hazebox', (0, 400, 15), (3000, 820, 30), fm, 0)
    if not A:
        smoke = mat('smoke', (0.03, 0.03, 0.03), rough=1)
        smoke_volume('plume', (9, 86, 0.3), 5.0, 26, density=2.5, color=(0.04, 0.035, 0.03), scale=0.35)
        smoke_volume('plume2', (-12, 120, 0.3), 4.0, 18, density=1.5, color=(0.05, 0.04, 0.035), scale=0.4)
        sphere('fire', (9, 86, 0.8), 0.9, emission('fire', (1.0, 0.4, 0.08), 20), seg=16, ring=10)
        point('firel', (9, 84, 2), 6000, (1.0, 0.45, 0.12), 2)

    def overlay(img, sc, look):
        d = ImageDraw.Draw(img, 'RGBA')
        w = img.width
        # crosshair on the near tank
        cx, cy = 175 * sc, 372 * sc
        r = 17 * sc
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 255, 255, 230), width=max(2, int(2 * sc)))
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            d.line([cx + dx * r * 0.55, cy + dy * r * 0.55, cx + dx * r * 1.55, cy + dy * r * 1.55], fill=(255, 255, 255, 230), width=max(2, int(2 * sc)))
        d.ellipse([cx - 4 * sc, cy - 4 * sc, cx + 4 * sc, cy + 4 * sc], fill=(255, 150, 40, 255))
        # bottom panel
        top = 700 * sc
        d.rectangle([0, top, w, img.height], fill=(16, 18, 22, 245))
        d.line([0, top, w, top], fill=(255, 255, 255, 30), width=1)
        f = ImageFont.truetype('/home/user/brain-blitz-duel/public/fonts/archivo-var-latin.woff2', int(10 * sc))
        f.set_variation_by_name(b'Bold')
        d.text((16 * sc, top + 28 * sc), 'SHELLS', font=f, fill=(200, 202, 210), anchor='lm')
        d.text((16 * sc, top + 56 * sc), 'RELOAD', font=f, fill=(200, 202, 210), anchor='lm')
        for i in range(5):
            x0 = (88 + i * 57) * sc
            col = (255, 178, 48, 255) if i < 2 else (52, 55, 62, 255)
            d.rounded_rectangle([x0, top + 19 * sc, x0 + 50 * sc, top + 37 * sc], radius=4 * sc, fill=col)
            if i < 2:
                d.rounded_rectangle([x0 + 2 * sc, top + 20 * sc, x0 + 48 * sc, top + 25 * sc], radius=2 * sc, fill=(255, 225, 150, 160))
        d.rounded_rectangle([88 * sc, top + 52 * sc, 373 * sc, top + 60 * sc], radius=4 * sc, fill=(52, 55, 62, 255))
        d.rounded_rectangle([88 * sc, top + 52 * sc, 373 * sc, top + 60 * sc], radius=4 * sc, fill=(110, 214, 120, 255))
    return dict(name='Iron Wall', hud=[('left', 0, 'WAVE', '4 / 5'), ('left', 1, 'DRONES', '2 / 3'), ('right', 0, 'BASE', '3 / 3')],
                bloom=0.45, overlay=overlay)
