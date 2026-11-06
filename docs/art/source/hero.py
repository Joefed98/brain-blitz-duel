import math, sys
sys.path.insert(0,'/home/claude/art')
src=open('/home/claude/art/gen.py').read().split('# ---- Board 1')[0]; exec(src)
SUIT='#141A2E'; EDGE='#06080F'
def limb(pts,w=11,pfx='h',outline=True):
    d="M"+" L".join(f"{x} {y}" for x,y in pts)
    o=""
    if outline: o+=f"<path d='{d}' fill='none' stroke='{EDGE}' stroke-width='{w+7}' stroke-linecap='round' stroke-linejoin='round'></path><path d='{d}' fill='none' stroke='url(#{pfx}goldA)' stroke-width='{w+4}' stroke-linecap='round' stroke-linejoin='round'></path>"
    o+=f"<path d='{d}' fill='none' stroke='{SUIT}' stroke-width='{w}' stroke-linecap='round' stroke-linejoin='round'></path>"
    return o
def stripe(pts,pfx):
    d="M"+" L".join(f"{x} {y}" for x,y in pts)
    return f"<path d='{d}' fill='none' stroke='url(#{pfx}goldA)' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'></path>"
def edge(pts,w):
    d='M'+' L'.join(f'{x} {y}' for x,y in pts)
    return f"<path d='{d}' fill='none' stroke='{EDGE}' stroke-width='{w+5}' stroke-linecap='round' stroke-linejoin='round'></path>"
def mitt(x,y,r,pfx): return f"<circle cx='{x}' cy='{y}' r='{r}' fill='url(#{pfx}goldA)' stroke='{EDGE}' stroke-width='2'></circle>"
def boot(x,y,ang,pfx): return f"<ellipse cx='{x}' cy='{y}' rx='10' ry='6.5' fill='url(#{pfx}goldA)' stroke='{EDGE}' stroke-width='2' transform='rotate({ang} {x} {y})'></ellipse>"
BOLTP="M66 34 L44 74 H58 L52 104 L78 60 H63 Z"
def bolt(cx,cy,sc,fill,pfx,stroke=True):
    return f"<path d='{BOLTP}' fill='{fill}' {'stroke=\"%s\" stroke-width=\"%.1f\"'%(EDGE,2/sc) if stroke else ''} stroke-linejoin='round' transform='translate({cx-61*sc:.1f} {cy-69*sc:.1f}) scale({sc})'></path>"

POSES={
 'stand':dict(neck=(80,64),hip=(80,114),sh=((62,72),(98,72)),el=((46,96),(114,96)),ha=((70,112),(90,112)),hp=((72,116),(88,116)),kn=((68,150),(92,150)),ft=((64,184),(96,184)),lean=0),
 'run':dict(neck=(88,64),hip=(78,114),sh=((76,72),(100,70)),el=((64,96),(110,90)),ha=((50,86),(122,72)),hp=((74,116),(84,116)),kn=((60,146),(104,138)),ft=((40,170),(110,170)),lean=12),
 'cheer':dict(neck=(80,64),hip=(80,114),sh=((62,72),(98,72)),el=((54,48),(106,48)),ha=((46,24),(114,24)),hp=((72,116),(88,116)),kn=((64,150),(96,150)),ft=((54,184),(106,184)),lean=0),
}
def capeA(p,pfx):
    if p=='stand': pts="66,70 54,74 40,160 60,150 80,166 100,150 120,160 106,74 94,70"
    elif p=='run': pts="80,70 70,72 6,118 26,124 10,146 38,140 34,160 72,118 92,68"
    else: pts="66,70 50,64 18,150 46,138 80,160 114,138 142,150 110,64 94,70"
    return f"<polygon points='{pts}' fill='url(#{pfx}goldA)' stroke='{EDGE}' stroke-width='2.5' stroke-linejoin='round'></polygon><polygon points='{pts}' fill='url(#{pfx}sheen)' opacity='0.5'></polygon>"
def torso(P,pfx,w=1):
    (sl,sr),(hl,hr)=P['sh'],P['hp']
    return f"<path d='M{sl[0]-2*w} {sl[1]} L{sr[0]+2*w} {sr[1]} L{hr[0]+2} {hr[1]} L{hl[0]-2} {hl[1]} Z' fill='{SUIT}' stroke='url(#{pfx}goldA)' stroke-width='3' stroke-linejoin='round'></path>"
def heroA(p,pfx):
    P=POSES[p]; g=[capeA(p,pfx)]
    (sl,sr),(el,er),(hl,hr)=P['sh'],P['el'],P['ha']; (pl,pr),(kl,kr),(fl,fr)=P['hp'],P['kn'],P['ft']
    g.append(limb([sl,el,hl],pfx=pfx)); g.append(limb([pl,kl,fl],w=12,pfx=pfx))
    g.append(torso(P,pfx))
    nx,ny=P['neck']; cx,cy=(nx+P['lean']*0.4, ny-6)
    g.append(f"<rect x='{(pl[0]+pr[0])/2-13}' y='{pl[1]-9}' width='26' height='8' rx='3' fill='url(#{pfx}goldA)' stroke='{EDGE}' stroke-width='1.5'></rect>")
    g.append(bolt((sl[0]+sr[0])/2,(sl[1]+pl[1])/2-10,0.28,f"url(#{pfx}goldA)",pfx))
    g.append(limb([pr,kr,fr],w=12,pfx=pfx)); g.append(limb([sr,er,hr],pfx=pfx))
    g.append(boot(fl[0],fl[1],-10 if p!='run' else -30,pfx)+boot(fr[0],fr[1],10 if p!='run' else 15,pfx))
    g.append(mitt(*hl,7,pfx)+mitt(*hr,7,pfx))
    hx,hy=nx+P['lean']*0.4, ny-15
    g.append(f"<circle cx='{hx}' cy='{hy}' r='19' fill='{SUIT}' stroke='url(#{pfx}goldA)' stroke-width='3'></circle><circle cx='{hx}' cy='{hy}' r='21.5' fill='none' stroke='{EDGE}' stroke-width='1.5'></circle>")
    g.append(f"<rect x='{hx-13+P['lean']*0.25}' y='{hy-5}' width='26' height='9' rx='4.5' fill='#22E4FF'></rect><rect x='{hx-13+P['lean']*0.25}' y='{hy-5}' width='26' height='4' rx='2' fill='#FFFFFF' opacity='0.45'></rect>")
    g.append(bolt(hx+15,hy-20,0.24,f"url(#{pfx}goldA)",pfx))
    return "".join(g)
def heroB(p,pfx):
    # Spark: a round energy mascot
    g=[]; cx,cy=80,96; jump = -14 if p=='cheer' else 0; cy+=jump
    if p=='stand': arms=(((48,104),(40,124)),((112,104),(120,124))); legs=(((70,130),(66,170)),((90,130),(94,170)))
    elif p=='run': arms=(((50,98),(30,90)),((110,98),(128,80))); legs=(((70,130),(48,160)),((90,130),(112,152)))
    else: arms=(((50,90),(34,52)),((110,90),(126,52))); legs=(((70,116),(58,150)),((90,116),(102,150)))
    for (a,b) in arms: g.append(limb([a,b],w=9,pfx=pfx))
    for (a,b) in legs: g.append(limb([a,b],w=10,pfx=pfx))
    for (a,b) in legs: g.append(boot(b[0],b[1]+4,0,pfx))
    for (a,b) in arms: g.append(mitt(b[0],b[1],7,pfx))
    if p=='run': g.append("".join(f"<path d='M{4+i*6} {80+i*16} H{30+i*4}' stroke='#22E4FF' stroke-width='3' stroke-linecap='round' opacity='{0.8-i*0.2}'></path>" for i in range(3)))
    g.append(f"<circle cx='{cx}' cy='{cy}' r='42' fill='url(#{pfx}cyglow)'></circle>")
    g.append(bolt(cx+2,cy-46,0.5,f"url(#{pfx}goldA)",pfx))
    g.append(f"<circle cx='{cx}' cy='{cy}' r='34' fill='url(#{pfx}goldA)' stroke='{EDGE}' stroke-width='2.5'></circle><circle cx='{cx}' cy='{cy}' r='34' fill='url(#{pfx}sheen)' opacity='0.7'></circle>")
    g.append(f"<path d='M{cx-22} {cy-8} Q{cx} {cy-22} {cx+22} {cy-8} L{cx+24} {cy+6} Q{cx} {cy-4} {cx-24} {cy+6} Z' fill='{SUIT}'></path>")
    ey=cy-4
    if p=='cheer':
        g.append(f"<path d='M{cx-15} {ey+2} q5 -7 10 0 M{cx+5} {ey+2} q5 -7 10 0' fill='none' stroke='#22E4FF' stroke-width='3.5' stroke-linecap='round'></path>")
    else:
        g.append(f"<rect x='{cx-15}' y='{ey-5}' width='9' height='11' rx='4' fill='#22E4FF'></rect><rect x='{cx+6}' y='{ey-5}' width='9' height='11' rx='4' fill='#22E4FF'></rect>")
    g.append(f"<path d='M{cx-8} {cy+16} Q{cx} {cy+(22 if p=='cheer' else 20)} {cx+8} {cy+16}' fill='none' stroke='{SUIT}' stroke-width='3' stroke-linecap='round'></path>")
    return "".join(g)
def heroC(p,pfx):
    # Volt runner: sleek athlete, no cape, gold stripes, helmet fin
    P=POSES[p]; g=[]
    (sl,sr),(el,er),(hl,hr)=P['sh'],P['el'],P['ha']; (pl,pr),(kl,kr),(fl,fr)=P['hp'],P['kn'],P['ft']
    if p=='run':
        g.append("".join(f"<path d='M{6+i*8} {92+i*22} H{40+i*6}' stroke='#E2C07A' stroke-width='3' stroke-linecap='round' opacity='{0.85-i*0.2}'></path>" for i in range(4)))
    for pts,w in (([sl,el,hl],12),([pl,kl,fl],13)):
        g.append(edge(pts,w)); g.append(limb(pts,w=w,pfx=pfx,outline=False)); g.append(stripe(pts,pfx))
    g.append(f"<path d='M{sl[0]-3} {sl[1]} L{sr[0]+3} {sr[1]} L{pr[0]+1} {pr[1]} L{pl[0]-1} {pl[1]} Z' fill='{SUIT}' stroke='{EDGE}' stroke-width='2' stroke-linejoin='round'></path>")
    mx=(sl[0]+sr[0])/2; g.append(f"<path d='M{sl[0]-1} {sl[1]+2} L{mx} {sl[1]+16} L{sr[0]+1} {sr[1]+2}' fill='none' stroke='url(#{pfx}goldA)' stroke-width='3'></path>")
    g.append(bolt(mx,(sl[1]+pl[1])/2+6,0.26,f"url(#{pfx}goldA)",pfx))
    for pts,w in (([pr,kr,fr],13),([sr,er,hr],12)):
        g.append(edge(pts,w)); g.append(limb(pts,w=w,pfx=pfx,outline=False)); g.append(stripe(pts,pfx))
    g.append(boot(fl[0],fl[1],-10 if p!='run' else -30,pfx)+boot(fr[0],fr[1],10 if p!='run' else 15,pfx))
    g.append(mitt(*hl,6,pfx)+mitt(*hr,6,pfx))
    nx,ny=P['neck']; hx,hy=nx+P['lean']*0.4, ny-15
    g.append(f"<path d='M{hx-6} {hy-14} L{hx+4} {hy-30} L{hx+2} {hy-16} L{hx+12} {hy-18} L{hx+4} {hy-6} Z' fill='url(#{pfx}goldA)' stroke='{EDGE}' stroke-width='1.5' stroke-linejoin='round'></path>")
    g.append(f"<ellipse cx='{hx}' cy='{hy}' rx='16' ry='17' fill='{SUIT}' stroke='{EDGE}' stroke-width='2.5'></ellipse>")
    g.append(f"<path d='M{hx-12} {hy-5} L{hx+12} {hy-5} L{hx+9} {hy+4} L{hx} {hy+1} L{hx-9} {hy+4} Z' fill='#22E4FF' stroke='{EDGE}' stroke-width='1' stroke-linejoin='round'></path>")
    g.append(f"<path d='M{hx-15} {hy+5} Q{hx} {hy+19} {hx+15} {hy+5}' fill='none' stroke='url(#{pfx}goldA)' stroke-width='2.5'></path>")
    return "".join(g)
FN={'A':heroA,'B':heroB,'C':heroC}
def figure(k,p,size=200):
    pfx=f'h{k}{p}'
    return f"<svg width='{size*0.8:.0f}' height='{size:.0f}' viewBox='0 0 160 200' role='img' aria-label='Hero {k} {p}'>{defs(pfx)}<ellipse cx='80' cy='192' rx='46' ry='5' fill='#000' opacity='0.35'></ellipse>{FN[k](p,pfx)}</svg>"
if __name__=='__main__':
    row="".join(f"<g transform='translate({j*170} {i*210})'>"+figure(k,p).replace("<svg width='160' height='200' viewBox='0 0 160 200' role='img' aria-label='Hero %s %s'>"%(k,p),"<g>").replace('</svg>','</g>')+"</g>" for i,k in enumerate('ABC') for j,p in enumerate(('stand','run','cheer')))
    svg=f"<svg xmlns='http://www.w3.org/2000/svg' width='520' height='640' viewBox='0 0 520 640'><rect width='520' height='640' fill='#0F1424'/>{row}</svg>"
    import cairosvg; cairosvg.svg2png(bytestring=svg.encode(),write_to='/home/claude/art/hero.png',output_width=1040)
