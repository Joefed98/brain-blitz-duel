"""Counterweight (balance) pieces: concept A's materials, without numbers (the app draws them in Archivo).

  wall        the dark walnut wall the scale hangs in front of (stretched to the arena)
  bench       the wooden bench the scale stands on
  beam        the brushed brass beam (stretched to the notch count)
  tag         a brass notch tag (the app writes the notch's distance on it)
  column      the iron column, brass collar at the top
  foot        the brass foot plate on its walnut plinth
  pivot       the brass boss at the pivot
  bell-mine   an iron kettlebell with a brass handle and a champagne face (a weight you hang)
  bell-fixed  an iron kettlebell with an iron handle and a steel face (a weight bolted on)
  tray        the brass-lipped walnut tray the weights wait on

Run:  /opt/blender/venv/bin/python docs/design/number-overhaul/source/balance.py [sprite ...]
"""
import os, sys
import bpy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sprites import *  # noqa: F401,F403

G = "balance"


def studio(w, h, scale=3, key=1.0):
    setup(w, h, scale)
    for ob in bpy.data.objects:
        if ob.type == "LIGHT":
            ob.data.energy *= key
    # Metals see a soft studio around them (reflections only; the film stays transparent).
    world("#06080f", 0.0, hdri="studio.exr", hdri_strength=0.55)


def brass(name="brass"):
    m = mat(name, "#c9a25a", 0.4, metal=1.0)
    return add_bump(m, 60, 0.04, stretch=(1, 30, 1), distance=0.002)


def iron(name="iron"):
    m = mat(name, "#2a2d31", 0.5, metal=1.0)
    return add_bump(m, 90, 0.06, distance=0.003)


def walnut(name="walnut", c1="#4a2e18", c2="#22140a", scale=1.4):
    return wood(name, c1, c2, rough=0.62, coat=0.0, scale=scale)


def wall():
    studio(390, 600, scale=2, key=0.45)
    planks = walnut("wallwood", "#2a1709", "#0f0703", 0.45)
    for i in range(6):
        box(i * 65 + 0.6, -2, 63.8, 604, 6, planks, r=1.2)
    # a dark seam behind the planks
    box(0, 0, 390, 600, 1, mat("seam", "#0b0703", 0.9), r=0)
    write(G, "wall", max_kb=90)


def bench():
    studio(390, 64, scale=2, key=0.6)
    top = walnut("benchtop", "#6b3a16", "#2e1606", 1.2)
    box(-4, 6, 398, 16, 12, top, r=3)          # the top's front edge
    box(-4, 20, 398, 44, 6, walnut("benchfront", "#4a240c", "#1e0e04", 1.2), r=2)
    write(G, "bench")


def beam():
    studio(480, 24, scale=3)
    b = brass("beam")
    xcyl(4, 12, 472, 8.5, b, bevel=2)
    for x in (4, 472):
        cyl(x + 2, 12, 9.5, 4, b, z=4, bevel=1.5)
    write(G, "beam")


def tag():
    studio(40, 34, scale=4)
    face = mat("tagface", "#d8b46c", 0.45, metal=1.0)
    add_bump(face, 80, 0.03, stretch=(1, 20, 1), distance=0.0015)
    box(2, 2, 36, 30, 6, face, r=4)
    write(G, "tag")


def column():
    studio(36, 280, scale=3)
    col = iron("col")
    ycyl(18, 18, 258, 11, col, bevel=2)
    b = brass("collar")
    ycyl(18, 8, 16, 14, b, bevel=2)
    write(G, "column")


def foot():
    studio(160, 34, scale=3)
    box(6, 14, 148, 18, 10, walnut("plinth", "#5a3012", "#241105", 1.2), r=3)
    box(28, 4, 104, 12, 10, brass("footbrass"), r=3, z=6)
    write(G, "foot")


def pivot():
    studio(36, 36, scale=4)
    b = brass("boss")
    cyl(18, 18, 14, 10, b, bevel=3)
    cyl(18, 18, 6, 14, mat("bossdark", "#5a4320", 0.5, metal=1.0), bevel=1.5)
    write(G, "pivot")


def bell(name, handle_mat, face_mat):
    studio(60, 72, scale=4)
    handle_mat, face_mat = handle_mat(), face_mat()
    body = iron("bellbody")
    torus(30, 20, 13, 4.6, handle_mat)          # the handle loop
    ellipsoid(30, 46, 23, 22, 14, body)         # the cast body
    cyl(30, 47, 13.5, 8, face_mat, z=22, bevel=2.2)  # the face plate the number sits on, proud of the body
    write(G, name)


def bell_mine():
    bell("bell-mine", lambda: brass("handle"), lambda: add_bump(mat("faceg", "#e2c07a", 0.5, metal=1.0), 70, 0.025, distance=0.0012))


def bell_fixed():
    bell("bell-fixed", lambda: iron("handleiron"), lambda: add_bump(mat("faces", "#b8bec4", 0.5, metal=1.0), 70, 0.025, distance=0.0012))


def tray():
    studio(380, 100, scale=2)
    box(2, 6, 376, 92, 8, brass("lip"), r=10)
    box(10, 14, 360, 76, 10, walnut("trayin", "#3e200b", "#170a03", 1.0), r=7, z=2)
    write(G, "tray")


if __name__ == "__main__":
    run({"wall": wall, "bench": bench, "beam": beam, "tag": tag, "column": column, "foot": foot,
         "pivot": pivot, "bell-mine": bell_mine, "bell-fixed": bell_fixed, "tray": tray})
