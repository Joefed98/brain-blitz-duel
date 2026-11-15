"""Render game key art with Blender (bpy). From the repo root:
    <python with bpy> docs/design/game-art/blender/render.py pool tubes ricochet [--samples=96] [--only=tile|hero]
Each game's scene is a function in scenes/<category>.py (arcade games by group). Writes
docs/design/game-art/tile/<id>.webp (320 × 320, from a 640 render) and hero/<id>.webp (960 × 600, from 1440 × 900).
"""
import sys, os, time, importlib, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import jz
from PIL import Image

OUT = os.path.abspath(os.path.join(jz.HERE, '..'))
GAMES = json.load(open(os.path.join(jz.HERE, 'games.json')))
args = [a for a in sys.argv[1:] if not a.startswith('--')]
opts = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
TMP = opts.get('tmp', os.path.join(os.environ.get('TMPDIR', '/tmp'), 'joulz-keyart'))
os.makedirs(TMP, exist_ok=True)
want = [g for g in GAMES if not args or g['id'] in args or (g.get('group') or g['cat']) in args]
for g in want:
    mod = importlib.import_module('scenes.' + (g.get('group') or g['cat']))
    fn = mod.SCENES.get(g['id'])
    if not fn: print('no scene', g['id']); continue
    t0 = time.time(); jz.reset(); cams = fn()
    if 'only' in opts: cams = {k: v for k, v in cams.items() if k == opts['only']}
    base = os.path.join(TMP, g['id'])
    jz.render(base, cams, int(opts.get('samples', 96)))
    for kind, size in (('tile', (320, 320)), ('hero', (960, 600))):
        if kind not in cams: continue
        os.makedirs(os.path.join(OUT, kind), exist_ok=True)
        im = Image.open(f'{base}-{kind}.png').convert('RGB').resize(size, Image.LANCZOS)
        im.save(os.path.join(OUT, kind, g['id'] + '.webp'), quality=84, method=6)
    print(g['id'], f'{time.time() - t0:.0f} s', flush=True)
