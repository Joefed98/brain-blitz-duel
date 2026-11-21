# Spotlight (the recommended direction) on more families, from real screenshots. Uses directions.py's recipes.
import sys, numpy as np
from PIL import Image
import directions as D
S = D.S
MORE = {  # id: (name, family colour, stage top, stage bottom, treatment, boxes at 2x)
 'numhunt':  ('Ascend',        '#FF8A3D', '#8A3E12', '#2A1206', 'spot', [(20,350,764,1644)]),
 'strikeout':('Strikeout',     '#4D8CFF', '#1B3A9C', '#0B163F', 'hue', [(16,590,764,890),(16,1300,764,1532),(16,1532,612,1660)], []),
 'target':   ('Exact',         '#3DDC84', '#11703F', '#072A1A', 'spot', [(30,1070,524,1212),(30,1212,756,1500)], [(192,338,588,504)]),
 'hover':    ('Hover',         '#36E2F5', '#0F4F8C', '#060B2E', 'neon', []),
 'flow':     ('Chroma Lines',  '#B26BFF', '#4A2A9E', '#170C3D', 'flood', []),
 'gravity':  ('Topsy-Turvy',   '#B26BFF', '#4A2A9E', '#170C3D', 'spot', [(28,600,756,1324)]),
 'numline':  ('Ballpark',      '#3DDC84', '#11703F', '#072A1A', 'spot', [(56,940,734,1160),(216,286,564,394)]),
 'symscan':  ('Eagle Eye',     '#FF6BD6', '#8E2A7A', '#2A0C26', 'spot', []),
 'bastion':  ('Iron Wall',     '#FF4D4D', '#8A2020', '#2A0A0A', 'flood', []),
 'balance':  ('Counterweight', '#3DDC84', '#11703F', '#072A1A', 'floodbox', [(28,228,756,1340),(32,1440,750,1616)]),
 'tubes':    ('Polypotions',   '#2ED3B7', '#0E6E66', '#07282E', 'flood', []),
}
def run(g):
    n, cat, dt, db, how, boxes = MORE[g][:6]; keep = MORE[g][6] if len(MORE[g]) > 6 else []
    a = np.asarray(Image.open(S + f'shots/games/{g}-390x844-play-now.png').convert('RGB'), dtype=np.float32) / 255
    D.GAMES[g] = (n, cat, dt, db, dt, db, None, [])
    if how == 'neon': o = D.neon(g, a)
    elif how == 'flood': o = D.floodlit(g, a)
    elif how == 'floodbox':
        o = D.floodlit(g, a)
        for (x0, y0, x1, y1) in boxes:
            r = o[y0:y1, x0:x1]; o[y0:y1, x0:x1] = np.clip(r, 0, 1) ** 0.62 * np.array([1.0, 0.97, 0.9], np.float32)
    else:
        o = D.lift(a, dt, db, strength=0.9, knee=0.26, p=1.2)
        for box in boxes:
            b = D.invert_keep_hue(o, box) if how == 'hue' else D.invert_neutrals(o, box)
            o = D.soft_edge_box(o, b, box, feather=6)
        o = D.vibrance(o, 0.5)
    out = o.copy(); out[:D.HEAD] = a[:D.HEAD]
    for (x0, y0, x1, y1) in keep:
        if x0 < a.shape[1]: out[y0:y1, x0:x1] = a[y0:y1, x0:x1]
    Image.fromarray((np.clip(out, 0, 1) * 255).astype(np.uint8)).save(S + f'dir/{g}-spotlight.png')
    Image.fromarray((a * 255).astype(np.uint8)).save(S + f'dir/{g}-now.png')
    print('ok', g)
if __name__ == '__main__':
    for g in (sys.argv[1:] or ['numhunt','strikeout','target','hover','flow']): run(g)
