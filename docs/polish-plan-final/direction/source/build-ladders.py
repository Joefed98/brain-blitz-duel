# Writes ladders.html (the level ladders of twelve games, one per family plus the five new mechanics)
# from docs/polish-plan-final/difficulty/*.json. Render: node render.mjs "ladders:ladders.html:1440x<h>".
import json, glob, html, os, re, sys
ROOT = '/home/user/brain-blitz-duel/docs/polish-plan-final'
G = {}
for f in sorted(glob.glob(f'{ROOT}/difficulty/*.json')):
    for g in json.load(open(f, encoding='utf8')): G[g['id']] = g
PICK = [('wordhunt','word'),('target','number'),('numhunt','speed'),('spotdiff','attention'),('maze','pattern'),('sudoku','logic'),
        ('breaker','retro'),('beat','retro'),('bastion','action'),('matchup','strategy'),('freekick','sports'),('mahjong','cards')]
def short(t, n=118):
    t = re.sub(r'^(As today|Today)[:,]?\s*', '', t.strip()); t = re.sub(r'^[a-z]+Rev \d+:\s*', '', t)
    if len(t) <= n: return t
    cut = t[:n]; cut = cut[:cut.rfind(' ')]; return cut.rstrip(',;:') + '…'
def ev(g, l):
    e = (g.get('evidence') or {}).get(l, '')
    k = e.split(':')[0].strip().lower() if e else 'not measured'
    return {'measured':'m','documented':'d'}.get(k,'n')
rows = ''
for gid, fam in PICK:
    g = G[gid]
    new = f'<span class="new">New mechanic</span>' if g.get('newMechanic') else ''
    v = (g.get('verdict') or 'unproven').split(':')[0].strip().lower()
    vt = {'holds':'Checked: holds','adjusted':'Checked: changed','unproven':'Still to prove'}.get(v,'Still to prove')
    new += f'<span class="vd {v}">{vt}</span>'
    cells = ''
    for i, l in enumerate(('easy','normal','hard','expert')):
        if l == 'normal': txt = short(g['today'].get('normal',''), 104); tag = '<span class="e d">today, unchanged</span>'
        else:
            txt = short(g['glance'][l]); k = ev(g, l); tag = f'<span class="e {k}">' + {'m':'measured','d':'documented','n':'not yet measured'}[k] + '</span>'
        cells += f'<div class="c l{i+1}"><div class="row g6"><span class="lvl l{i+1}"><i></i><i></i><i></i><i></i></span><b>{l.title()}</b>{tag}</div><p>{html.escape(txt)}</p></div>'
    tile = f'pub/tiles/{gid}.webp'
    rows += f'<div class="r"><div class="g"><div class="tile" style="--c:var(--{fam})"><img src="{tile}"></div><div><div class="nm">{html.escape(g["name"])}</div><div class="lev">{html.escape(g["lever"])}</div>{new}</div></div>{cells}</div>'
page = f'''<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="kit.css"><style>
body {{ background: var(--bg); }} .board {{ width: 1440px; padding: 34px 40px 36px; }}
.t1 {{ font: 900 42px/1 "Archivo"; font-stretch: 112%; }} .t5 {{ font: 600 15px/1.35 "Archivo"; color: var(--text2); }}
.r {{ display: grid; grid-template-columns: 270px repeat(4, 1fr); gap: 8px; margin-top: 8px; }}
.g {{ display: flex; gap: 12px; align-items: center; padding: 8px 10px; border-radius: 12px; background: var(--raised); box-shadow: inset 0 0 0 1px var(--line); }} .g .tile {{ width: 62px; flex: none; border-radius: 10px; }}
.nm {{ font: 800 17px/1.05 "Archivo"; }} .lev {{ font: 700 12.5px/1.2 "Archivo"; color: var(--gold); margin-top: 5px; }} .new {{ display: inline-block; margin-top: 6px; font: 800 9.5px/1 "Archivo"; letter-spacing: .1em; text-transform: uppercase; color: #06080F; background: var(--gold); padding: 3px 6px; border-radius: 3px; }}
.c {{ padding: 9px 12px 10px; border-radius: 12px; background: color-mix(in srgb, var(--lc) 9%, var(--raised)); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--lc) 38%, var(--line)); }} .c b {{ font: 800 12px/1 "Archivo"; letter-spacing: .08em; text-transform: uppercase; }}
.c p {{ font: 700 14px/1.28 "Archivo"; margin-top: 7px; color: var(--text); }} .c.l2 p {{ color: var(--text2); font-weight: 600; }}
.vd {{ display: inline-block; margin: 6px 0 0 0; font: 800 9.5px/1 "Archivo"; letter-spacing: .08em; text-transform: uppercase; padding: 3px 6px; border-radius: 3px; box-shadow: inset 0 0 0 1px currentColor; color: var(--hard); }} .vd.holds {{ color: var(--win); }} .vd.adjusted {{ color: var(--normal); }} .new + .vd {{ margin-left: 5px; }}
.e {{ margin-left: auto; font: 700 9.5px/1 "Archivo"; letter-spacing: .06em; text-transform: uppercase; color: var(--text3); }} .e.m {{ color: var(--win); }} .e.n {{ color: var(--hard); }}
</style></head><body><div class="board">
<div class="row"><div class="grow"><div class="cap" style="color:var(--gold)">Joulz · difficulty · one lever a game, seen in the first seconds</div><div class="t1 mt10">What each step up looks like</div></div><div class="t5" style="max-width:440px;text-align:right">Twelve of the 83 ladders: one a family, and the five new mechanics. The gold line is the game's one lever. Normal is today's game and never changes. Each level says whether its numbers were measured; each game says whether the fact-check held.</div></div>
<div style="margin-top:14px">{rows}</div></div></body></html>'''
open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ladders.html'), 'w', encoding='utf8').write(page)
print('ladders.html', len(page))
