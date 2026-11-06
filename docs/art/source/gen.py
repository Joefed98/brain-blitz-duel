import math
# Generates the rank emblem and medal/trophy boards as static dc.html files
MAT = {
 'bronze':  ['#F6D2AE','#D49461','#9A5E30','#E2AB76'],
 'silver':  ['#FFFFFF','#D3DCEF','#97A4C0','#E6ECF8'],
 'gold':    ['#FBEDC4','#E6C67E','#D2AC5E','#EED79C'],
 'plat':    ['#F2FCFF','#AEEAF7','#62B9CE','#D6F7FF'],
 'obsid':   ['#4A5680','#1E2640','#0B0F1C','#36406A'],
}
INK = {'bronze':'#2A1608','silver':'#151B2C','gold':'#1A1206','plat':'#08202A','obsid':'#E2C07A'}

def defs(pfx):
    out=[]
    for k,s in MAT.items():
        out.append(f"<linearGradient id='{pfx}{k}A' x1='0' y1='0' x2='0.35' y2='1'><stop offset='0' stop-color='{s[0]}'></stop><stop offset='0.34' stop-color='{s[1]}'></stop><stop offset='0.7' stop-color='{s[2]}'></stop><stop offset='1' stop-color='{s[3]}'></stop></linearGradient>")
        out.append(f"<linearGradient id='{pfx}{k}B' x1='0.2' y1='1' x2='0' y2='0'><stop offset='0' stop-color='{s[0]}'></stop><stop offset='0.4' stop-color='{s[1]}'></stop><stop offset='0.75' stop-color='{s[2]}'></stop><stop offset='1' stop-color='{s[3]}'></stop></linearGradient>")
    out.append(f"<linearGradient id='{pfx}sheen' x1='0' y1='0' x2='1' y2='1'><stop offset='0.3' stop-color='#FFFFFF' stop-opacity='0'></stop><stop offset='0.45' stop-color='#FFFFFF' stop-opacity='0.55'></stop><stop offset='0.55' stop-color='#FFFFFF' stop-opacity='0'></stop></linearGradient>")
    out.append(f"<radialGradient id='{pfx}cyglow' cx='0.5' cy='0.5' r='0.5'><stop offset='0' stop-color='#F3D894' stop-opacity='0.5'></stop><stop offset='1' stop-color='#F3D894' stop-opacity='0'></stop></radialGradient>")
    return "<defs>"+"".join(out)+"</defs>"

SHIELD="M60 8 L106 24 V68 C106 100 86 122 60 132 C34 122 14 100 14 68 V24 Z"
def inner(scale=0.8):
    return f"<path d='{SHIELD}' transform='translate({60*(1-scale):.1f} {70*(1-scale):.1f}) scale({scale})'"
BOLT="M66 34 L44 74 H58 L52 104 L78 60 H63 Z"
def emblem(pfx, tier):
    m={'spark':'bronze','charge':'silver','volt':'gold','surge':'plat','storm':'obsid','lightning':'gold'}[tier]
    ink=INK[m]; A=f"url(#{pfx}{m}A)"; B=f"url(#{pfx}{m}B)"
    g=[]
    if tier=='lightning':
        g.append(f"<circle cx='60' cy='70' r='64' fill='url(#{pfx}cyglow)'></circle>")
        for a in range(0,360,30):
            g.append(f"<path d='M54 70 L66 70 L60 -6 Z' fill='{A}' transform='rotate({a} 60 70)'></path>")
    if tier in ('surge','storm','lightning'):
        wm = 'gold' if tier!='surge' else 'plat'
        for sx in (1,-1):
            tr = '' if sx==1 else "transform='translate(120 0) scale(-1 1)'"
            g.append(f"<g {tr}><path d='M100 40 L128 30 L118 46 L132 44 L118 60 L128 62 L104 78 Z' fill='url(#{pfx}{wm}A)' stroke='#06080F' stroke-width='2' stroke-linejoin='round'></path></g>")
    if tier in ('storm','lightning'):
        for x,top,sc in ((36,2,0.34),(60,-12,0.46),(84,2,0.34)):
            g.append(f"<path d='{BOLT}' fill='url(#{pfx}goldA)' stroke='#06080F' stroke-width='{2/sc:.1f}' stroke-linejoin='round' transform='translate({x-61*sc:.1f} {top-34*sc:.1f}) scale({sc})'></path>")
    g.append(f"<path d='{SHIELD}' fill='{A}' stroke='#06080F' stroke-width='2.5' stroke-linejoin='round'></path>")
    if m=='obsid':
        g.append(f"<path d='{SHIELD}' fill='none' stroke='url(#{pfx}goldA)' stroke-width='3' transform='translate(6 7) scale(0.9)'></path>")
    g.append(inner(0.8)+f" fill='{B}'></path>")
    g.append(inner(0.8)+f" fill='url(#{pfx}sheen)' opacity='0.8'></path>")
    if tier=='spark':
        g.append(f"<path d='{BOLT}' fill='none' stroke='{ink}' stroke-width='4' stroke-linejoin='round'></path>")
    elif tier=='charge':
        g.append(f"<defs><clipPath id='{pfx}half'><rect x='30' y='72' width='60' height='40'></rect></clipPath></defs>")
        g.append(f"<path d='{BOLT}' fill='{ink}' clip-path='url(#{pfx}half)'></path>")
        g.append(f"<path d='{BOLT}' fill='none' stroke='{ink}' stroke-width='4' stroke-linejoin='round'></path>")
    else:
        bf = 'url(#'+pfx+'goldA)' if m=='obsid' else ink
        g.append(f"<path d='{BOLT}' fill='{bf}' stroke='{ '#06080F' if m=='obsid' else 'none'}' stroke-width='1.5' stroke-linejoin='round'></path>")
        if tier=='surge':
            g.append(f"<path d='M30 60 H42 M28 70 H40 M30 80 H42' stroke='{ink}' stroke-width='4' stroke-linecap='round'></path>")
    return "".join(g)

def pips(pfx,n,filled,cx,y):
    out=[]; x0=cx-(n-1)*9
    for i in range(n):
        f = f"url(#{pfx}goldA)" if i<filled else '#1E2640'
        out.append(f"<path d='M{x0+i*18} {y-6} l6 6 l-6 6 l-6 -6 z' fill='{f}'></path>")
    return "".join(out)

TIERS=[('spark','Spark','Bronze','Your first ladder'),('charge','Charge','Silver','Finding your games'),('volt','Volt','Gold','Solid all-rounder'),('surge','Surge','Platinum','Top 20% (target)'),('storm','Storm','Obsidian and gold','Top 5% (target)'),('lightning','Lightning','Electric gold','Top 500, numbered')]

HEAD="""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>TITLE</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&amp;display=swap" rel="stylesheet">
<style>body{margin:0;background:#06080F}</style>
</helmet>
"""
def tail(w,h):
    return f"""</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
  renderVals() {{
    return {{}};
  }}
}}
</script>
</body>
</html>
"""
LBL="font-weight: 600; font-size: 12px; letter-spacing: 0.01em; color: #8F9BBF"

# ---- Board 1: rank emblems
cells=[]
for key,name,mat,note in TIERS:
    divs = '' if key=='lightning' else pips('e',3,2,60,0)
    cells.append(f"""<div style="background: #0F1424; border-radius: 8px; padding: 20px 12px 18px 12px; display: flex; flex-direction: column; align-items: center; gap: 10px">
<svg width="150" height="175" viewBox="-10 -14 140 164" aria-label="{name} emblem" role="img">{defs('e'+key)}{emblem('e'+key,key)}</svg>
<div style="font-stretch: 112%; font-weight: 800; font-size: 22px">{name}</div>
{('<svg width="60" height="14" viewBox="0 -7 120 14" aria-label="Division II">'+defs('p'+key)+pips('p'+key,3,2,60,0)+'</svg>') if key!='lightning' else '<div style="font-weight: 800; font-size: 14px; color: #22E4FF; font-variant-numeric: tabular-nums">#37</div>'}
<div style="{LBL}">{mat} · {note}</div>
</div>""")
strip=[]
for key,name,score,nm,col in (('lightning','Lightning #37','1,842','Sam','#4D8CFF'),('storm','Storm I','1,611','TheInventor','#FF6BD6'),('volt','Volt III','1,204','Priya','#3DDC84')):
    strip.append(f"""<div style="display: flex; align-items: center; gap: 12px; height: 56px; padding: 0 14px; background: #0F1424; border-radius: 8px">
<span style="width: 34px; height: 34px; border-radius: 17px; background: {col}; color: #06080F; font-weight: 900; font-size: 15px; display: flex; align-items: center; justify-content: center">{nm[0]}</span>
<span style="flex-grow: 1; font-weight: 700; font-size: 16px">{nm}</span>
<svg width="28" height="32" viewBox="-10 -14 140 164" aria-hidden="true">{defs('s'+key)}{emblem('s'+key,key)}</svg>
<span style="width: 110px; {LBL}; font-size: 13px">{name}</span>
<span style="font-stretch: 105%; font-weight: 800; font-size: 20px; font-variant-numeric: tabular-nums">{score}</span></div>""")
b1 = HEAD.replace('TITLE','Joulz rank emblems') + f"""<div style="width: 880px; height: 1120px; box-sizing: border-box; padding: 40px; background: #06080F; color: #EEF2FF; font-family: 'Archivo', system-ui, sans-serif; display: flex; flex-direction: column; gap: 24px">
<div style="display: flex; flex-direction: column; gap: 8px">
<span style="font-weight: 600; font-size: 13px; color: #22E4FF">Ranked · six tiers</span>
<h1 style="margin: 0; font-stretch: 115%; font-weight: 800; font-size: 36px; line-height: 1.05">Rank emblems</h1>
<p style="margin: 0; font-size: 15px; color: #B5C6DD; max-width: 640px; line-height: 1.45">Each tier is a step up in material and shape: bronze to silver to gold, then platinum wings, an obsidian storm crown, and electric gold for the top 500. The diamonds show the division (III, II, I).</p>
</div>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px">{''.join(cells)}</div>
<div style="display: flex; flex-direction: column; gap: 8px">
<span style="{LBL}">At standings size (28 px), beside a nameplate</span>
{''.join(strip)}
</div>
</div>
""" + tail(880,1120)
open('/mnt/user-data/outputs/artifacts/501ec2cd-97a4-4b75-be90-a8b00b790e44/project/ART-Emblems.dc.html','w').write(b1)
print(len(b1))

# ---- Board 2: medals, trophies, badges
import math
def medal(pfx, m, num):
    A=f"url(#{pfx}{m}A)"; B=f"url(#{pfx}{m}B)"; ink=INK[m]
    return (f"<path d='M38 4 H54 L66 46 H50 Z' fill='#112A3A' stroke='#06080F' stroke-width='2'></path><path d='M82 4 H66 L54 46 H70 Z' fill='#1E2640' stroke='#06080F' stroke-width='2'></path>"
            f"<path d='M44 4 L56 46' stroke='#22E4FF' stroke-width='3'></path><path d='M76 4 L64 46' stroke='{A}' stroke-width='3'></path>"
            f"<circle cx='60' cy='86' r='40' fill='{A}' stroke='#06080F' stroke-width='2.5'></circle>"
            f"<circle cx='60' cy='86' r='31' fill='{B}'></circle><circle cx='60' cy='86' r='31' fill='url(#{pfx}sheen)' opacity='0.8'></circle>"
            + f"<circle cx='60' cy='86' r='26' fill='none' stroke='{ink}' stroke-opacity='0.4' stroke-width='1.2'></circle>"
            + "".join(f"<ellipse cx='{60+22*math.cos(math.radians(a)):.1f}' cy='{86+22*math.sin(math.radians(a)):.1f}' rx='2.6' ry='6' fill='{ink}' fill-opacity='0.5' transform='rotate({a+90+ (30 if a>90 and a<270 else -30)} {60+22*math.cos(math.radians(a)):.1f} {86+22*math.sin(math.radians(a)):.1f})'></ellipse>" for a in list(range(116,250,26))+list(range(-64,65,26)))
            + f"<circle cx='60' cy='86' r='15' fill='{A}' stroke='{ink}' stroke-opacity='0.5' stroke-width='1.2'></circle>"
            + f"<path d='M63 72 L53 90 H59 L56 101 L67 82 H61 Z' fill='{ink}'></path>")
def trophy(pfx, m, big=False, level=None):
    # level 0 bronze cup, 1 silver, 2 gold, 3 championship
    if level is None: level = 3 if big else 0
    A=f"url(#{pfx}{m}A)"; B=f"url(#{pfx}{m}B)"; ink=INK[m]; G=f"url(#{pfx}goldA)"
    g=[]
    if level==3:
        g.append(f"<circle cx='60' cy='56' r='86' fill='url(#{pfx}cyglow)'></circle>")
        for a in range(-80,81,20):
            g.append(f"<path d='M55 60 L65 60 L60 -38 Z' fill='{A}' opacity='0.55' transform='rotate({a} 60 60)'></path>")
    hw = 6 + (2 if level>=2 else 0)
    for d in ("M32 30 C8 30 8 66 40 70","M88 30 C112 30 112 66 80 70"):
        g.append(f"<path d='{d}' fill='none' stroke='#06080F' stroke-width='{hw+5}' stroke-linecap='round'></path><path d='{d}' fill='none' stroke='{A}' stroke-width='{hw}' stroke-linecap='round'></path>")
    if level==3:
        for sx in (1,-1):
            tr='' if sx==1 else "transform='translate(120 0) scale(-1 1)'"
            g.append(f"<g {tr}><path d='M104 30 L132 18 L124 32 L140 30 L124 44 L136 46 L110 60 Z' fill='{A}' stroke='#06080F' stroke-width='2' stroke-linejoin='round'></path></g>")
    if level>=2:
        g.append(f"<path d='M30 18 C30 2 90 2 90 18 Z' fill='{A}' stroke='#06080F' stroke-width='2.5'></path>")
        if level==2:
            g.append(f"<path d='M63 -16 L52 4 H59 L56 16 L69 -6 H62 Z' fill='{A}' stroke='#06080F' stroke-width='2' stroke-linejoin='round'></path>")
        else:
            for x,bot,sc in ((38,12,0.42),(60,8,0.6),(82,12,0.42)):
                g.append(f"<path d='M66 34 L44 74 H58 L52 104 L78 60 H63 Z' fill='{A}' stroke='#06080F' stroke-width='{2/sc:.1f}' stroke-linejoin='round' transform='translate({x-61*sc:.1f} {bot-104*sc:.1f}) scale({sc})'></path>")
    g.append(f"<path d='M28 18 H92 V40 C92 66 78 80 60 82 C42 80 28 66 28 40 Z' fill='{A}' stroke='#06080F' stroke-width='2.5' stroke-linejoin='round'></path>")
    g.append(f"<path d='M34 22 H86 V40 C86 62 74 74 60 76 C46 74 34 62 34 40 Z' fill='{B}'></path><path d='M34 22 H86 V40 C86 62 74 74 60 76 C46 74 34 62 34 40 Z' fill='url(#{pfx}sheen)' opacity='0.85'></path>")
    if level>=1:
        g.append(f"<path d='M34 30 H86' stroke='{ink}' stroke-opacity='0.35' stroke-width='1.5'></path>")
    if level>=2:
        for sx in (1,-1):
            for i in range(4):
                y=40+i*8; x=60+sx*(18-i*1.5)
                g.append(f"<ellipse cx='{x:.1f}' cy='{y}' rx='2.4' ry='5' fill='{ink}' fill-opacity='0.45' transform='rotate({sx*35} {x:.1f} {y})'></ellipse>")
    g.append(f"<path d='M63 30 L52 50 H59 L56 66 L69 44 H62 Z' fill='{ink}'></path>")
    g.append(f"<rect x='54' y='82' width='12' height='16' fill='{A}' stroke='#06080F' stroke-width='2'></rect><ellipse cx='60' cy='90' rx='10' ry='4' fill='{A}' stroke='#06080F' stroke-width='2'></ellipse>")
    g.append(f"<path d='M40 98 H80 L86 112 H34 Z' fill='{A}' stroke='#06080F' stroke-width='2.5' stroke-linejoin='round'></path>")
    if level==0:
        g.append(f"<rect x='28' y='112' width='64' height='24' rx='3' fill='#1E2640' stroke='#06080F' stroke-width='2.5'></rect><rect x='42' y='119' width='36' height='10' rx='1.5' fill='{A}'></rect>")
    elif level<3:
        g.append(f"<rect x='26' y='112' width='68' height='22' rx='3' fill='#1E2640' stroke='#06080F' stroke-width='2.5'></rect><rect x='40' y='118' width='40' height='10' rx='1.5' fill='{A}'></rect>")
        g.append(f"<rect x='20' y='134' width='80' height='10' rx='3' fill='{A}' stroke='#06080F' stroke-width='2.5'></rect>")
    else:
        g.append(f"<rect x='22' y='112' width='76' height='26' rx='3' fill='#1E2640' stroke='#06080F' stroke-width='2.5'></rect><rect x='34' y='118' width='52' height='14' rx='1.5' fill='{A}'></rect>")
        g.append(f"<text x='60' y='128.5' text-anchor='middle' font-family='Archivo, sans-serif' font-weight='800' font-size='8' letter-spacing='0.6' fill='#1A1206'>CHAMPION</text>")
        g.append(f"<rect x='14' y='138' width='92' height='10' rx='3' fill='{A}' stroke='#06080F' stroke-width='2.5'></rect><rect x='6' y='148' width='108' height='12' rx='3' fill='#1E2640' stroke='#06080F' stroke-width='2.5'></rect>")
    return "".join(g)
def hexpath(cx,cy,r):
    pts=[(cx+r*math.cos(math.radians(60*i+30)), cy+r*math.sin(math.radians(60*i+30))) for i in range(6)]
    return "M"+" L".join(f"{x:.1f} {y:.1f}" for x,y in pts)+" Z"
def laurel(pfx,cx,cy,r,m='gold'):
    out=[]
    for side in (1,-1):
        for i in range(6):
            a=math.radians(110+i*22) if side==1 else math.radians(70-i*22)
            x=cx+r*math.cos(a); y=cy+r*math.sin(a)
            rot=math.degrees(a)+(90 if side==1 else -90)+ (25*side)
            out.append(f"<ellipse cx='{x:.1f}' cy='{y:.1f}' rx='4' ry='9' fill='url(#{pfx}{m}A)' stroke='#06080F' stroke-width='1' transform='rotate({rot:.0f} {x:.1f} {y:.1f})'></ellipse>")
    return "".join(out)
def wreath(pfx,cx,cy,r):
    out=[]
    for side in (1,-1):
        a0,a1=(100,236) if side==1 else (80,-56)
        pts=[]
        n=7
        for i in range(n):
            a=a0+(a1-a0)*i/(n-1); ar=math.radians(a)
            pts.append((cx+r*math.cos(ar), cy+r*math.sin(ar)))
        d="M"+" L".join(f"{x:.1f} {y:.1f}" for x,y in pts)
        out.append(f"<path d='{d}' fill='none' stroke='url(#{pfx}goldA)' stroke-width='2'></path>")
        for i in range(1,n):
            a=a0+(a1-a0)*i/(n-1); ar=math.radians(a)
            for k,off in ((0,4),(1,-4)):
                x=cx+(r+off)*math.cos(ar); y=cy+(r+off)*math.sin(ar)
                rot=a+(25 if side==1 else -25)*(1 if k==0 else -1)
                out.append(f"<ellipse cx='{x:.1f}' cy='{y:.1f}' rx='3' ry='7' fill='url(#{pfx}goldA)' stroke='#06080F' stroke-width='0.8' transform='rotate({rot:.0f} {x:.1f} {y:.1f})'></ellipse>")
    return "".join(out)
def banner(pfx,y,text,w=84,fill=None,ink='#1A1206'):
    x0=60-w/2; x1=60+w/2; f=fill or f"url(#{pfx}goldA)"
    return (f"<path d='M{x0-8} {y+3} H{x0+6} V{y+15} H{x0-8} L{x0-3} {y+9} Z' fill='#9A7A3A' stroke='#06080F' stroke-width='1.5' stroke-linejoin='round'></path>"
            f"<path d='M{x1+8} {y+3} H{x1-6} V{y+15} H{x1+8} L{x1+3} {y+9} Z' fill='#9A7A3A' stroke='#06080F' stroke-width='1.5' stroke-linejoin='round'></path>"
            f"<rect x='{x0}' y='{y}' width='{w}' height='15' fill='{f}' stroke='#06080F' stroke-width='1.8'></rect>"
            f"<text x='60' y='{y+11}' text-anchor='middle' font-family='Archivo, sans-serif' font-weight='900' font-size='9.5' letter-spacing='1.2' fill='{ink}'>{text}</text>")
GLYPH2="M3 0 H22 L19 14 L8 28 H19 L17 36 H0 L2 28 L13 14 L14 8 H2 Z"
GLYPH0="M7 0 H24 L22 12 L25 14 L20 36 H3 L5 24 L2 22 Z M11 7 L9 29 H15 L17 7 Z"
def badge(pfx,kind):
    g=[]; G=f"url(#{pfx}goldA)"; GB=f"url(#{pfx}goldB)"
    if kind=='winner':
        g.append(wreath(pfx,60,58,44))
        g.append(f"<path d='{hexpath(60,56,32)}' fill='{G}' stroke='#06080F' stroke-width='2.5' stroke-linejoin='round'></path><path d='{hexpath(60,56,26)}' fill='#0F1424'></path><path d='{hexpath(60,56,26)}' fill='none' stroke='{G}' stroke-width='1' stroke-opacity='0.6' transform='translate(4.4 4.1) scale(0.92)'></path>")
        g.append(f"<g transform='translate(43 37) scale(0.29)'>{trophy(pfx,'gold',level=2)}</g>")
        g.append(f"<path d='M60 4 l2.4 5 5.4 .6 -4 3.7 1.1 5.3 -4.9 -2.7 -4.9 2.7 1.1 -5.3 -4 -3.7 5.4 -.6 z' fill='{G}' stroke='#06080F' stroke-width='1'></path>")
        g.append(banner(pfx,86,'WINNER'))
    elif kind=='founder':
        g.append(f"<circle cx='60' cy='56' r='44' fill='{G}' stroke='#06080F' stroke-width='2.5'></circle><circle cx='60' cy='56' r='38' fill='#0F1424'></circle><circle cx='60' cy='56' r='34' fill='none' stroke='{G}' stroke-width='1' stroke-dasharray='1 4' stroke-linecap='round'></circle>")
        g.append(f"<path d='M64 24 L52 44 H59 L56 56 L69 36 H61 Z' fill='{G}' stroke='#06080F' stroke-width='1.5' stroke-linejoin='round'></path>")
        g.append(banner(pfx,57,'FOUNDER',w=88))
        g.append(f"<text x='60' y='88' text-anchor='middle' font-family='Archivo, sans-serif' font-stretch='110%' font-weight='900' font-size='12' fill='#E2C07A'>#0042</text>")
    elif kind=='club':
        for a in range(0,360,30):
            g.append(f"<path d='M57 56 L63 56 L60 4 Z' fill='{G}' opacity='0.6' transform='rotate({a} 60 56)'></path>")
        g.append(f"<circle cx='60' cy='56' r='40' fill='{G}' stroke='#06080F' stroke-width='2.5'></circle><circle cx='60' cy='56' r='33' fill='#0F1424'></circle>")
        for i,(gl,x) in enumerate(((GLYPH2,27),(GLYPH0,45),(GLYPH0,64))):
            g.append(f"<path d='{gl}' fill-rule='evenodd' fill='{G}' stroke='#06080F' stroke-width='1.5' stroke-linejoin='round' transform='translate({x+4} 40) skewX(-8) scale(0.85)'></path>")
        g.append(f"<path d='M44 77 L50 74 L54 78 L60 74 L66 78 L70 74 L76 77' fill='none' stroke='{G}' stroke-width='1.6' stroke-linejoin='round'></path>")
        g.append(banner(pfx,90,'CLUB',w=52))
    elif kind=='arena':
        for a in range(0,360,45):
            g.append(f"<path d='M57 58 L63 58 L60 8 Z' fill='#22E4FF' opacity='0.35' transform='rotate({a+22} 60 58)'></path>")
        g.append(f"<path d='{hexpath(60,58,40)}' fill='{G}' stroke='#06080F' stroke-width='2.5' stroke-linejoin='round'></path><path d='{hexpath(60,58,34)}' fill='#112A3A'></path>")
        g.append(f"<path d='M50 30 L38 58 H48 L42 86 L62 50 H52 Z' fill='#22E4FF' stroke='#06080F' stroke-width='1.5' stroke-linejoin='round'></path><path d='M76 30 L64 58 H74 L68 86 L88 50 H78 Z' fill='{G}' stroke='#06080F' stroke-width='1.5' stroke-linejoin='round' transform='translate(-6 0)'></path>")
        g.append(banner(pfx,88,'ARENA',w=60))
    return "".join(g)

def tile(svg,label,sub,w='100%'):
    return f"""<div style="background: #0F1424; border-radius: 8px; padding: 16px 10px; display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center">{svg}<div style="font-weight: 700; font-size: 15px">{label}</div><div style="{LBL}">{sub}</div></div>"""

medals=[tile(f"<svg width='96' height='112' viewBox='0 0 120 140' role='img' aria-label='{n} medal'>{defs('m'+m)}{medal('m'+m,m,k)}</svg>",n,s) for m,k,n,s in (('gold','1','Gold','1st place'),('silver','2','Silver','2nd place'),('bronze','3','Bronze','3rd place'))]
sizes=f"""<div style="background: #0F1424; border-radius: 8px; padding: 16px; display: flex; align-items: flex-end; justify-content: center; gap: 22px">
<svg width='22' height='26' viewBox='0 0 120 140' aria-hidden='true'>{defs('z1')}{medal('z1','gold','1')}</svg>
<svg width='36' height='42' viewBox='0 0 120 140' aria-hidden='true'>{defs('z2')}{medal('z2','gold','1')}</svg>
<svg width='64' height='75' viewBox='0 0 120 140' aria-hidden='true'>{defs('z3')}{medal('z3','gold','1')}</svg></div>"""
trophies=[]
for m,lvl,n,sub,w,h,vb in (('bronze',0,'Bronze cup','3rd',80,96,'0 -4 120 144'),('silver',1,'Silver cup','2nd',94,118,'0 -4 120 152'),('gold',2,'Gold cup','1st in a cup or Arena',112,150,'0 -22 120 170'),('gold',3,'Championship','Monthly final winner',176,226,'-26 -44 172 210')):
    trophies.append(f"""<div style="background: #0F1424; border-radius: 8px; padding: 16px 10px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: 8px; text-align: center"><svg width='{w}' height='{h}' viewBox='{vb}' role='img' aria-label='{n}'>{defs('t'+str(lvl))}{trophy('t'+str(lvl),m,level=lvl)}</svg><div style="font-weight: 700; font-size: 15px">{n}</div><div style="{LBL}">{sub}</div></div>""")
badges=[tile(f"<svg width='104' height='104' viewBox='0 0 120 120' role='img' aria-label='{n} badge'>{defs('b'+k)}{badge('b'+k,k)}</svg>",n,s) for k,n,s in (('winner','Tournament Winner','Earned only'),('arena','Arena Champion','Earned only'),('club','200 Club','A perfect 200'),('founder','Founding Player','Beta players, numbered'))]
b2 = HEAD.replace('TITLE','Joulz medals, trophies and badges') + f"""<div style="width: 880px; height: 1260px; box-sizing: border-box; padding: 40px; background: #06080F; color: #EEF2FF; font-family: 'Archivo', system-ui, sans-serif; display: flex; flex-direction: column; gap: 24px">
<div style="display: flex; flex-direction: column; gap: 8px">
<span style="font-weight: 600; font-size: 13px; color: #22E4FF">Rewards · one metal family</span>
<h1 style="margin: 0; font-stretch: 115%; font-weight: 800; font-size: 36px; line-height: 1.05">Medals, trophies and badges</h1>
<p style="margin: 0; font-size: 15px; color: #B5C6DD; max-width: 660px; line-height: 1.45">The same ring-gold, silver and bronze metals as the rank emblems, a black outline for crisp edges on dark screens, and the bolt as the maker's mark. Earned-only items never appear in the shop.</p>
</div>
<span style="{LBL}">Medals (podium, standings, profile)</span>
<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px">{''.join(medals)}{tile(sizes.replace('<div style="background: #0F1424; border-radius: 8px; padding: 16px; ','<div style="padding: 8px 0; '),'Sizes','22, 36 and 64 px')}</div>
<span style="{LBL}">Trophies (profile cabinet, tournament results)</span>
<div style="display: grid; grid-template-columns: minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1fr) minmax(0, 1.5fr); gap: 16px; align-items: stretch">{''.join(trophies)}</div>
<span style="{LBL}">Player card badges</span>
<div style="display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px">{''.join(badges)}</div>
</div>
""" + tail(880,1260)
open('/mnt/user-data/outputs/artifacts/501ec2cd-97a4-4b75-be90-a8b00b790e44/project/ART-Rewards.dc.html','w').write(b2)
# preview
prev=f"<svg xmlns='http://www.w3.org/2000/svg' width='1000' height='420' viewBox='0 -30 1000 420'><rect y='-30' width='1000' height='420' fill='#0F1424'/>"
for i,(m,k) in enumerate((('gold','1'),('silver','2'),('bronze','3'))): prev+=f"<g transform='translate({i*130} 0)'>{defs('q'+m)}{medal('q'+m,m,k)}</g>"
prev+=f"<g transform='translate(400 0)'>{defs('qt')}{trophy('qt','gold',True)}</g><g transform='translate(530 0)'>{defs('qs')}{trophy('qs','silver')}</g>"
for i,k in enumerate(('winner','arena','club','founder')): prev+=f"<g transform='translate({i*130} 220)'>{defs('qb'+k)}{badge('qb'+k,k)}</g>"
prev+="</svg>"
import cairosvg; cairosvg.svg2png(bytestring=prev.encode(),write_to='/home/claude/art/rewards.png',output_width=1500)
print('done')
