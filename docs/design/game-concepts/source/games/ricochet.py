"""Moon Climb (ricochet): a ninja leaps between two temple walls by moonlight. Brick walls left and right with moss
and blades, the full moon with a sky lantern rising across it, a pagoda below in the mist."""
import math, random
from lib import *


def moon_mat(A):
    m = bpy.data.materials.new('moon')
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    e = nt.nodes.new('ShaderNodeEmission')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    n1 = nt.nodes.new('ShaderNodeTexNoise'); n1.inputs['Scale'].default_value = 1.6; n1.inputs['Detail'].default_value = 8
    v = nt.nodes.new('ShaderNodeTexVoronoi'); v.inputs['Scale'].default_value = 4.0
    mx = nt.nodes.new('ShaderNodeMath'); mx.operation = 'MULTIPLY'
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (0.62, 0.45, 0.2, 1)
    ramp.color_ramp.elements[0].position = 0.25
    ramp.color_ramp.elements[1].color = (1.0, 0.86, 0.52, 1)
    nt.links.new(tc.outputs['Object'], n1.inputs['Vector']); nt.links.new(tc.outputs['Object'], v.inputs['Vector'])
    nt.links.new(n1.outputs['Fac'], mx.inputs[0]); nt.links.new(v.outputs['Distance'], mx.inputs[1])
    sm = nt.nodes.new('ShaderNodeMath'); sm.operation = 'POWER'; sm.inputs[1].default_value = 0.6
    nt.links.new(mx.outputs[0], sm.inputs[0]); nt.links.new(sm.outputs[0], ramp.inputs[0])
    nt.links.new(ramp.outputs['Color'], e.inputs['Color'])
    e.inputs['Strength'].default_value = 0.8 if A else 0.95
    nt.links.new(e.outputs[0], out.inputs[0])
    return m


def build(look):
    rnd = random.Random(21)
    A = look == 'A'
    reset(world=(0.004, 0.006, 0.02))
    world_gradient((0.02, 0.03, 0.09), (0.004, 0.006, 0.02), 1.0)
    brick = random_tint('brick', (0.035, 0.038, 0.05), (0.09, 0.095, 0.11), rough=0.82, bump=(18.0, 0.8, 8))
    mortar = mat('mortar', (0.02, 0.022, 0.03), rough=0.95, bump=(30.0, 0.5, 4))
    moss = random_tint('moss', (0.06, 0.22, 0.04), (0.18, 0.45, 0.08), rough=0.9, bump=(40.0, 1.0, 6))
    steel = brushed('steel', (0.85, 0.87, 0.9), 0.12)
    guard = mat('guard', (1.0, 0.74, 0.3), metal=1, rough=0.25)
    wrap = mat('wrap', (0.05, 0.04, 0.05), rough=0.7, bump=(200.0, 0.5, 2))
    paper = mat('paper', (0.9, 0.3, 0.02), rough=0.6, emit=(1.0, 0.36, 0.02), estr=0.8 if A else 1.1, sss=0.0)
    wood = mat('lanwood', (0.12, 0.05, 0.02), rough=0.5)
    pag = mat('pagoda', (0.012, 0.014, 0.03), rough=0.7)
    pagwin = emission('pagwin', (1.0, 0.6, 0.25), 3)
    body, acc, vis = mat('suit', (0.03, 0.03, 0.04), rough=0.35, coat=0.6), mat('gold', (1.0, 0.72, 0.32), metal=1, rough=0.22), emission('visor', (1.0, 0.7, 0.35), 6)
    sash = mat('sash', (0.55, 0.05, 0.05), rough=0.5)

    # sky: stars, the moon (with a soft halo), drifting cloud bands for B
    zs = -9.0
    k = depth_scale(zs)
    for i in range(110):
        sphere(f'st{i}', (rnd.uniform(-1.4, 1.4) * k, rnd.uniform(-4, 4) * k, zs), rnd.uniform(0.004, 0.009) * k,
               emission('star', (0.8, 0.85, 1.0), rnd.choice((1, 2, 5))), seg=6, ring=4)
    mz = -4.0
    mk = depth_scale(mz)
    mc = P(195, 290)
    sphere('moon', (mc.x * mk, mc.y * mk, mz), (0.56 if A else 0.62) * mk, moon_mat(A), seg=64, ring=32)
    point('moonglow', (mc.x * mk, mc.y * mk, mz + 1.2), 300 if A else 700, (1.0, 0.85, 0.6), 0.6)
    if not A:
        # far sky lanterns rising in the mist
        for i in range(16):
            z = rnd.uniform(-6.5, -2.5)
            kk = depth_scale(z)
            c = Vector((rnd.uniform(-1.3, 1.3) * kk, rnd.uniform(-2.5, 3.8) * kk, z))
            cyl(f'flan{i}', c, 0.05, 0.12, emission('flan', (1.0, 0.42, 0.1), 5), verts=12, r2=0.06)
        fog(0.045, (0.55, 0.62, 0.95), z0=-8.5, z1=-0.5)
    else:
        fog(0.03, (0.6, 0.65, 0.9), z0=-8.5, z1=-0.5)

    # pagoda in the mist, bottom centre
    pz = -2.0
    pk = depth_scale(pz)
    px = P(195, 0).x * pk
    y = P(0, 790).y * pk
    for tier in range(5):
        w = (0.5 - tier * 0.07) * pk
        box(f'ptier{tier}', (px, y + 0.17 * pk, pz), (w * 0.6, 0.3 * pk, 0.3), pag, 0.01)
        roof = prism(f'proof{tier}', [(px - w, y + 0.32 * pk), (px + w, y + 0.32 * pk), (px + w * 0.45, y + 0.42 * pk), (px - w * 0.45, y + 0.42 * pk)], pz - 0.2, pz + 0.2, pag, 0.01)
        for wx in (-0.06, 0.06):
            box(f'pw{tier}{wx}', (px + wx * pk, y + 0.18 * pk, pz + 0.16), (0.03 * pk, 0.06 * pk, 0.01), pagwin, 0)
        y += 0.42 * pk
    cyl('spire', (px, y + 0.25 * pk, pz), 0.012 * pk, 0.5 * pk, pag, verts=8)

    # the walls: running-bond bricks (left 0-66 px, right 324-390 px) on a mortar core
    def wall(x0, x1, side):
        box(f'core{side}', (P((x0 + x1) / 2, 0).x, 0, -0.3), ((x1 - x0) / 100, 9.0, 0.5), mortar, 0.0)
        bw, bh = 40, 27
        row = 0
        y = 30
        while y < 870:
            off = (row % 2) * bw / 2
            x = x0 - off
            while x < x1:
                a, b = max(x, x0) + 1.2, min(x + bw, x1) - 1.2
                if b - a > 4:
                    c = P((a + b) / 2, y + bh / 2, -0.02)
                    box(f'br{side}{row}{x}', c, ((b - a) / 100, (bh - 2.4) / 100, 0.1 + rnd.uniform(0, 0.03)), brick, 0.012)
                x += bw
            y += bh
            row += 1
        # inner edge trim catching the moonlight
        ex = x1 if side == 'L' else x0
        box(f'trim{side}', P(ex, 422, 0.06), (0.04, 9.0, 0.06), mat('trim', (0.2, 0.21, 0.24), rough=0.5), 0.01)
    wall(0, 66, 'L')
    wall(324, 390, 'R')
    # moss patches near the top of each wall
    for side, xr, yr in (('L', (50, 66), (60, 120)), ('R', (324, 342), (175, 260))):
        for i in range(70 if A else 110):
            x = rnd.uniform(*xr); y = rnd.uniform(*yr)
            sphere(f'moss{side}{i}', P(x, y, 0.1), rnd.uniform(0.02, 0.045), moss, seg=8, ring=6, scale=(1, 1, 0.5))

    # blades sticking out of the walls (live frame: left 160, 420; right 185, 445, 690)
    def blade(x, y, side):
        d = 1 if side == 'L' else -1
        root = P(x, y, 0.1)
        L = 0.5
        prism(f'bl{side}{y}', [(root.x + d * 0.08, root.y - 0.03), (root.x + d * L, root.y - 0.022), (root.x + d * (L + 0.07), root.y + 0.024), (root.x + d * 0.08, root.y + 0.03)], 0.1, 0.13, steel, 0.006)
        box(f'hilt{side}{y}', root + Vector((d * 0.04, 0, 0.115)), (0.07, 0.036, 0.03), wrap, 0.008)
        box(f'gd{side}{y}', root + Vector((d * 0.08, 0, 0.12)), (0.022, 0.09, 0.05), guard, 0.006)
    for x, y, sd in ((66, 160, 'L'), (66, 420, 'L'), (324, 185, 'R'), (324, 445, 'R'), (324, 690, 'R')):
        blade(x, y, sd)

    # the sky lantern across the moon, a shuriken above it
    lc = P(195, 312, 0.5)
    cyl('lantern', lc, 0.1, 0.26, paper, verts=32, r2=0.12)
    for r in range(6):
        a = r * math.pi / 3
        tube(f'rib{r}', [lc + Vector((0.1 * math.cos(a), -0.13, 0.1 * math.sin(a))), lc + Vector((0.12 * math.cos(a), 0.13, 0.12 * math.sin(a)))], 0.004, wood)
    for dy in (-0.13, 0.13):
        cyl(f'lanrim{dy}', lc + Vector((0, dy, 0)), 0.122 if dy > 0 else 0.102, 0.014, wood, verts=24, rot=(math.pi / 2, 0, 0))
    lp = lc.copy(); lp.z += 0.3
    point('lanlight', lp, 6 if A else 14, (1.0, 0.5, 0.15), 0.08)
    sh = P(212, 258, 0.45)
    for i in range(4):
        a = i * math.pi / 2 + 0.4
        prism(f'shu{i}', [(sh.x, sh.y), (sh.x + 0.05 * math.cos(a + 0.5), sh.y + 0.05 * math.sin(a + 0.5)), (sh.x + 0.11 * math.cos(a), sh.y + 0.11 * math.sin(a))], sh.z, sh.z + 0.012, steel, 0)
    cyl('shuc', sh, 0.018, 0.02, steel, verts=16)

    # the ninja mid-leap, sash and visor
    hero('ninja', P(190, 505, 0.4), 1.35, body, acc, vis, pose='leap', rot=-0.15, cape_m=sash)
    point('ninjarim', P(150, 470, 1.0), 5, (0.8, 0.85, 1.0), 0.2)

    # moonlight: a cool key from the moon's side, soft fill
    area('moonkey', (0.2, 4.5, 9), 1600 if A else 2200, 3, (1.0, 0.92, 0.78), target=(0, -1, 0))
    area('fill', (-6, -4, 10), 260, 8, (0.35, 0.42, 0.9))
    return dict(name='Moon Climb', hud=[('left', 0, 'HEIGHT', '153 m'), ('right', 0, 'FLOW', '×12')], bloom=0.5, view='Standard')
