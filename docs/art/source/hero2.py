import math
exec(open('/home/claude/art/hero.py').read().split("if __name__")[0])
POSES['stand']['sh']=((62,72),(98,72))
POSES['ready']=dict(POSES['stand']); POSES['ready'].update(el=((50,98),(110,98)),ha=((46,124),(114,124)))
def L(pts,w,col):
    d="M"+" L".join(f"{x:.1f} {y:.1f}" for x,y in pts)
    return f"<path d='{d}' fill='none' stroke='{col}' stroke-width='{w}' stroke-linecap='round' stroke-linejoin='round'></path>"
def lerp(a,b,t): return (a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t)
def limb2(pts,w,pfx):
    G=f"url(#{pfx}goldA)"
    return L(pts,w+7,EDGE)+L(pts,w+4,G)+L(pts,w,SUIT)
def glove(el,ha,pfx,style):
    G=f"url(#{pfx}goldA)"; c=lerp(el,ha,0.72)
    return L([c,ha],15,EDGE)+L([c,ha],12,G)+f"<circle cx='{ha[0]:.1f}' cy='{ha[1]:.1f}' r='7.5' fill='{G}' stroke='{EDGE}' stroke-width='2'></circle>"+L([lerp(el,ha,0.71),lerp(el,ha,0.75)],12,'#9A7A3A')
def gauntlet(el,ha,pfx):
    G=f"url(#{pfx}goldA)"; dx,dy=ha[0]-el[0],ha[1]-el[1]; n=math.hypot(dx,dy); ux,uy=dx/n,dy/n; px,py=-uy,ux
    a=lerp(el,ha,0.6); b=lerp(el,ha,0.86)
    cuff=[(a[0]+px*6.5,a[1]+py*6.5),(b[0]+px*10,b[1]+py*10),(b[0]-px*10,b[1]-py*10),(a[0]-px*6.5,a[1]-py*6.5)]
    o=f"<polygon points='{' '.join(f'{x:.1f},{y:.1f}' for x,y in cuff)}' fill='{G}' stroke='{EDGE}' stroke-width='2' stroke-linejoin='round'></polygon>"
    o+=f"<path d='M{lerp(a,b,.55)[0]+px*8.3:.1f} {lerp(a,b,.55)[1]+py*8.3:.1f} L{lerp(a,b,.55)[0]-px*8.3:.1f} {lerp(a,b,.55)[1]-py*8.3:.1f}' stroke='#9A7A3A' stroke-width='1.6'></path>"
    fx,fy=ha[0]+ux*2,ha[1]+uy*2; ang=math.degrees(math.atan2(uy,ux))-90
    def finger(x0,y0,x1,y1,w=3):
        d=f"M{fx+x0:.1f} {fy+y0:.1f} L{fx+x1:.1f} {fy+y1:.1f}"
        return (f"<path d='{d}' stroke='{EDGE}' stroke-width='{w+3.4}' stroke-linecap='round'></path><path d='{d}' stroke='{G}' stroke-width='{w+1.6}' stroke-linecap='round'></path>"
                f"<path d='{d}' stroke='{SUIT}' stroke-width='{w-0.4}' stroke-linecap='round'></path>")
    o+=f"<g transform='rotate({ang:.0f} {fx:.1f} {fy:.1f})'>"
    o+=finger(-6,-1,-11,6,3.2)
    for x0,x1,y1 in ((-4.5,-6.5,11),(-1.5,-2,13),(1.5,2,13),(4.5,6.5,11)):
        o+=finger(x0,3,x1,y1,2.8)
    o+=f"<rect x='{fx-7.5:.1f}' y='{fy-6:.1f}' width='15' height='11' rx='4' fill='{SUIT}' stroke='{EDGE}' stroke-width='4.2'></rect><rect x='{fx-7.5:.1f}' y='{fy-6:.1f}' width='15' height='11' rx='4' fill='{SUIT}' stroke='{G}' stroke-width='2'></rect>"
    o+=f"<path d='M{fx-6:.1f} {fy+3:.1f} H{fx+6:.1f}' stroke='{G}' stroke-width='2.2' stroke-linecap='round'></path>"
    o+=bolt(fx,fy-1.5,0.085,G,pfx,stroke=False)+"</g>"
    return o
def cuffband(top,ft):
    dx,dy=ft[0]-top[0],ft[1]-top[1]; n=math.hypot(dx,dy); px,py=-dy/n,dx/n; c=lerp(top,ft,0.1)
    return f"<path d='M{c[0]+px*8:.1f} {c[1]+py*8:.1f} L{c[0]-px*8:.1f} {c[1]-py*8:.1f}' stroke='#9A7A3A' stroke-width='3'></path>"
def footwear(kn,ft,pfx,style,flip=1):
    G=f"url(#{pfx}goldA)"; o=[]
    dx=ft[0]-kn[0]; ang=math.degrees(math.atan2(ft[1]-kn[1],dx))-90
    if style=='boots':   # tall boots with cuffs
        top=lerp(kn,ft,0.42)
        o.append(L([top,ft],17,EDGE)+L([top,ft],14,G)+cuffband(top,ft))
        o.append(f"<path d='M{ft[0]-9*flip:.1f} {ft[1]-2:.1f} Q{ft[0]+2*flip:.1f} {ft[1]-8:.1f} {ft[0]+13*flip:.1f} {ft[1]+1:.1f} L{ft[0]+13*flip:.1f} {ft[1]+5:.1f} L{ft[0]-9*flip:.1f} {ft[1]+5:.1f} Z' fill='{G}' stroke='{EDGE}' stroke-width='2' stroke-linejoin='round'></path>")
        o.append(f"<path d='M{ft[0]-9*flip:.1f} {ft[1]+5:.1f} H{ft[0]+13*flip:.1f}' stroke='{EDGE}' stroke-width='3'></path>")
    elif style=='trainers':
        o.append(f"<path d='M{ft[0]-8*flip:.1f} {ft[1]-6:.1f} Q{ft[0]+4*flip:.1f} {ft[1]-9:.1f} {ft[0]+14*flip:.1f} {ft[1]+1:.1f} Q{ft[0]+15*flip:.1f} {ft[1]+5:.1f} {ft[0]+10*flip:.1f} {ft[1]+6:.1f} L{ft[0]-8*flip:.1f} {ft[1]+6:.1f} Z' fill='#EEF2FF' stroke='{EDGE}' stroke-width='2' stroke-linejoin='round'></path>")
        o.append(f"<path d='M{ft[0]-8*flip:.1f} {ft[1]+2:.1f} H{ft[0]+14*flip:.1f}' stroke='#22E4FF' stroke-width='2.5'></path>")
        o.append(f"<path d='M{ft[0]-2*flip:.1f} {ft[1]-6:.1f} l{3*flip} 3 M{ft[0]+2*flip:.1f} {ft[1]-7:.1f} l{3*flip} 3' stroke='{EDGE}' stroke-width='1.3'></path>")
        o.append(f"<path d='M{ft[0]+1*flip:.1f} {ft[1]-1:.1f} l{5*flip} -2 l-2 4 l{5*flip} -2' fill='none' stroke='{G}' stroke-width='1.6' stroke-linejoin='round'></path>")
    else: # armour: knee guard, shin plate, chunky boot
        o.append(f"<circle cx='{kn[0]:.1f}' cy='{kn[1]:.1f}' r='8' fill='{G}' stroke='{EDGE}' stroke-width='2'></circle><path d='M{kn[0]-4:.1f} {kn[1]:.1f} L{kn[0]:.1f} {kn[1]-4:.1f} L{kn[0]+4:.1f} {kn[1]:.1f}' fill='none' stroke='{EDGE}' stroke-width='1.4'></path>")
        a=lerp(kn,ft,0.3); b=lerp(kn,ft,0.8)
        o.append(L([a,b],12,EDGE)+L([a,b],9,G)+L([lerp(a,b,.5),lerp(a,b,.5)],0.1,EDGE))
        o.append(f"<path d='M{ft[0]-10*flip:.1f} {ft[1]-6:.1f} L{ft[0]+8*flip:.1f} {ft[1]-6:.1f} L{ft[0]+15*flip:.1f} {ft[1]+2:.1f} L{ft[0]+15*flip:.1f} {ft[1]+6:.1f} L{ft[0]-10*flip:.1f} {ft[1]+6:.1f} Z' fill='{SUIT}' stroke='{EDGE}' stroke-width='2' stroke-linejoin='round'></path>")
        o.append(f"<path d='M{ft[0]+6*flip:.1f} {ft[1]-6:.1f} L{ft[0]+15*flip:.1f} {ft[1]+2:.1f} L{ft[0]+15*flip:.1f} {ft[1]+6:.1f} L{ft[0]+6*flip:.1f} {ft[1]+6:.1f} Z' fill='{G}' stroke='{EDGE}' stroke-width='1.5' stroke-linejoin='round'></path>")
        o.append(f"<path d='M{ft[0]-10*flip:.1f} {ft[1]+6:.1f} H{ft[0]+15*flip:.1f}' stroke='{EDGE}' stroke-width='3'></path>")
    return "".join(o)
CAPES={
 'long':{'stand':[(62,70),(96,70),(124,168),(112,160),(104,172),(92,160),(80,174),(68,160),(56,172),(48,160),(36,168)],
         'run':[(76,70),(98,66),(48,118),(52,132),(30,130),(30,146),(10,138),(6,152),(-8,140)],
         'cheer':[(62,70),(98,70),(142,162),(124,154),(112,170),(96,156),(80,172),(64,156),(48,170),(36,154),(18,162)]},
 'capelet':{'stand':[(58,70),(102,70),(126,118)],'run':[(72,70),(102,66),(48,116)],'cheer':[(58,70),(102,70),(132,112)]},
 'twin':{'stand':[[(64,72),(76,74),(58,176),(44,180)],[(84,74),(96,72),(116,180),(102,176)]],
         'run':[[(78,72),(90,70),(12,124),(4,114)],[(86,72),(98,68),(22,148),(14,140)]],
         'cheer':[[(64,72),(76,74),(42,176),(26,170)],[(84,74),(96,72),(134,170),(118,176)]]},
}
CAPES['long']['ready']=CAPES['long']['stand']
def cape(style,p,pfx):
    G=f"url(#{pfx}goldA)"; o=[]
    if style in ('long','long82'):
        pts=CAPES['long'][p]
        if style=='long82':
            tx=(pts[0][0]+pts[1][0])/2; ty=(pts[0][1]+pts[1][1])/2
            pts=pts[:2]+[(tx+(x-tx)*0.82, ty+(y-ty)*0.82) for x,y in pts[2:]]
        poly=" ".join(f"{x},{y}" for x,y in pts)
        o.append(f"<polygon points='{poly}' fill='{G}' stroke='{EDGE}' stroke-width='2.5' stroke-linejoin='round'></polygon><polygon points='{poly}' fill='url(#{pfx}sheen)' opacity='0.45'></polygon>")
        o.append(f"<polygon points='{poly}' fill='none' stroke='#1A1206' stroke-opacity='0.35' stroke-width='1' transform='translate(4 4) scale(0.95)'></polygon>")
    elif style=='capelet':
        (a,b,c)=CAPES['capelet'][p]
        if p=='run':
            d=f"M{a[0]} {a[1]} L{b[0]} {b[1]} Q{c[0]+30} {c[1]-10} {c[0]} {c[1]} Q{c[0]-6} {c[1]-14} {c[0]-2} {c[1]-24} Q{c[0]-8} {c[1]-30} {a[0]} {a[1]} Z"
        else:
            sc=[(a[0]-6,c[1]-4),(c[0]-(c[0]-a[0])*0.0,c[1])]
            x0=2*80-c[0]; x1=c[0]; y=c[1]; n=5; step=(x1-x0)/n
            d=f"M{a[0]} {a[1]} L{b[0]} {b[1]} L{x1} {y} "+"".join(f"Q{x1-step*(i+0.5):.1f} {y+12:.1f} {x1-step*(i+1):.1f} {y:.1f} " for i in range(n))+"Z"
        o.append(f"<path d='{d}' fill='{G}' stroke='{EDGE}' stroke-width='2.5' stroke-linejoin='round'></path><path d='{d}' fill='url(#{pfx}sheen)' opacity='0.45'></path>")
    else:
        for t in CAPES['twin'][p]:
            poly=" ".join(f"{x},{y}" for x,y in t)
            o.append(f"<polygon points='{poly}' fill='{G}' stroke='{EDGE}' stroke-width='2.5' stroke-linejoin='round'></polygon><polygon points='{poly}' fill='url(#{pfx}sheen)' opacity='0.45'></polygon>")
            tip=t[2]; o.append(f"<path d='M{tip[0]} {tip[1]} l{(t[3][0]-tip[0])/2:.1f} {(t[3][1]-tip[1])/2+6:.1f}' stroke='{EDGE}' stroke-width='1.5'></path>")
    return "".join(o)
def chest(style,P,pfx):
    G=f"url(#{pfx}goldA)"; (sl,sr),(pl,pr)=P['sh'],P['hp']; mx=(sl[0]+sr[0])/2; my=(sl[1]+pl[1])/2
    if style=='big':
        return bolt(mx,my-1,0.5,G,pfx)
    if style=='badge':
        return f"<circle cx='{mx-6:.1f}' cy='{my-8:.1f}' r='9' fill='{SUIT}' stroke='{G}' stroke-width='2.5'></circle>"+bolt(mx-6,my-8,0.2,G,pfx,stroke=False)
    # sash with buckle bolt + shoulder bolt
    return (f"<path d='M{sl[0]+2} {sl[1]+2} L{sl[0]+9} {sl[1]-1} L{pr[0]+2} {pr[1]-6} L{pr[0]-6} {pr[1]-2} Z' fill='{G}' stroke='{EDGE}' stroke-width='1.5' stroke-linejoin='round'></path>"
            +f"<rect x='{(pl[0]+pr[0])/2-8:.1f}' y='{pl[1]-11:.1f}' width='16' height='12' rx='2' fill='{SUIT}' stroke='{G}' stroke-width='2'></rect>"+bolt((pl[0]+pr[0])/2,pl[1]-5,0.14,G,pfx,stroke=False))
def torso2(P,pfx,style):
    G=f"url(#{pfx}goldA)"; (sl,sr),(pl,pr)=P['sh'],P['hp']; mx=(sl[0]+sr[0])/2
    o=[f"<path d='M{sl[0]-3} {sl[1]-1} L{sr[0]+3} {sr[1]-1} L{pr[0]+3} {pr[1]} L{pl[0]-3} {pl[1]} Z' fill='{SUIT}' stroke='{EDGE}' stroke-width='2.5' stroke-linejoin='round'></path>"]
    # seams
    o.append(f"<path d='M{sl[0]+4} {sl[1]+4} Q{mx} {sl[1]+18} {sr[0]-4} {sr[1]+4}' fill='none' stroke='{G}' stroke-width='1.6'></path>")
    o.append(f"<path d='M{sl[0]+2} {sl[1]+10} L{pl[0]+3} {pl[1]-12} M{sr[0]-2} {sr[1]+10} L{pr[0]-3} {pr[1]-12}' stroke='{G}' stroke-width='1.2' opacity='0.8'></path>")
    if style!='sash':
        o.append(f"<rect x='{pl[0]-4}' y='{pl[1]-9}' width='{pr[0]-pl[0]+8}' height='8' rx='2' fill='{G}' stroke='{EDGE}' stroke-width='1.5'></rect>")
        o.append(f"<rect x='{(pl[0]+pr[0])/2-5}' y='{pl[1]-11}' width='10' height='12' rx='2' fill='{SUIT}' stroke='{G}' stroke-width='1.8'></rect>")
    else:
        o.append(f"<rect x='{pl[0]-4}' y='{pl[1]-8}' width='{pr[0]-pl[0]+8}' height='6' rx='2' fill='{SUIT}' stroke='{G}' stroke-width='1.5'></rect>")
    return "".join(o)
def shoulders(P,pfx,on):
    if not on: return ""
    G=f"url(#{pfx}goldA)"; (sl,sr)=P['sh']
    return "".join(f"<ellipse cx='{x}' cy='{y+1}' rx='10' ry='7' fill='{G}' stroke='{EDGE}' stroke-width='2'></ellipse><path d='M{x-6} {y+1} H{x+6}' stroke='{EDGE}' stroke-width='1' opacity='0.6'></path>" for x,y in (sl,sr))
def head(P,pfx,style):
    G=f"url(#{pfx}goldA)"; nx,ny=P['neck']; hx,hy=nx+P['lean']*0.4, ny-17; o=[]; back=[]; front=[]
    if style=='crown':
        back.append(f"<ellipse cx='{hx}' cy='{hy-24}' rx='26' ry='12' fill='url(#{pfx}cyglow)'></ellipse>")
        ring=f"<ellipse cx='{hx}' cy='{hy-24}' rx='22' ry='6' fill='none' stroke='{EDGE}' stroke-width='6'></ellipse><ellipse cx='{hx}' cy='{hy-24}' rx='22' ry='6' fill='none' stroke='{G}' stroke-width='3.5'></ellipse>"
        spikes="".join(bolt(hx+dx,hy-31-h,sc,G,pfx) for dx,h,sc in ((-15,1,0.17),(0,7,0.26),(15,1,0.17)))
        front.append(spikes+ring)
    elif style=='sun':
        cy=hy-12
        back.append(f"<circle cx='{hx}' cy='{cy}' r='36' fill='url(#{pfx}cyglow)'></circle>")
        back.append("".join(f"<path d='M{hx-3} {cy} L{hx+3} {cy} L{hx} {cy-38} Z' fill='{G}' transform='rotate({a} {hx} {cy})'></path>" for a in range(-90,91,30)))
        back.append(f"<circle cx='{hx}' cy='{cy}' r='27' fill='none' stroke='{EDGE}' stroke-width='6'></circle><circle cx='{hx}' cy='{cy}' r='27' fill='none' stroke='{G}' stroke-width='3.5'></circle><circle cx='{hx}' cy='{cy}' r='21' fill='none' stroke='{G}' stroke-width='1' stroke-dasharray='2 3'></circle>")
    elif style=='none':
        pass
    else:  # orbit ring around the head
        back.append(f"<path d='M{hx-30} {hy-2} A30 9 -12 0 1 {hx+30} {hy-14}' fill='none' stroke='{EDGE}' stroke-width='6'></path><path d='M{hx-30} {hy-2} A30 9 -12 0 1 {hx+30} {hy-14}' fill='none' stroke='{G}' stroke-width='3.5'></path>")
        front.append(f"<path d='M{hx+30} {hy-14} A30 9 -12 0 1 {hx-30} {hy-2}' fill='none' stroke='{EDGE}' stroke-width='6'></path><path d='M{hx+30} {hy-14} A30 9 -12 0 1 {hx-30} {hy-2}' fill='none' stroke='{G}' stroke-width='3.5'></path>")
        front.append(f"<circle cx='{hx+30}' cy='{hy-14}' r='3' fill='#22E4FF' stroke='{EDGE}' stroke-width='1'></circle>")
    o+=back
    # helmet
    o.append(f"<path d='M{hx-20} {hy+4} Q{hx-21} {hy-21} {hx} {hy-22} Q{hx+21} {hy-21} {hx+20} {hy+4} Q{hx+17} {hy+18} {hx} {hy+20} Q{hx-17} {hy+18} {hx-20} {hy+4} Z' fill='{SUIT}' stroke='{EDGE}' stroke-width='2.5'></path>")
    if style!='none': o.append(f"<path d='M{hx} {hy-22} L{hx} {hy-8}' stroke='{G}' stroke-width='3'></path>")
    if style=='none':
        for x0,y0,x1 in ((hx-9,hy-17,hx-7),(hx,hy-21,hx),(hx+9,hy-17,hx+7)):
            o.append(f"<path d='M{x0} {y0} L{x1} {hy-8}' stroke='#22E4FF' stroke-opacity='0.32' stroke-width='1.3' stroke-linecap='round'></path>")
    if style=='orbit':
        o.append(f"<path d='M{hx-3} {hy-22} L{hx+2} {hy-36} L{hx+3} {hy-24} Z' fill='{G}' stroke='{EDGE}' stroke-width='1.5' stroke-linejoin='round'></path>")
    o.append(f"<path d='M{hx-17} {hy+6} Q{hx-12} {hy+18} {hx-3} {hy+19}' fill='none' stroke='{G}' stroke-width='3'></path><path d='M{hx+17} {hy+6} Q{hx+12} {hy+18} {hx+3} {hy+19}' fill='none' stroke='{G}' stroke-width='3'></path>")
    vx=hx+P['lean']*0.25
    o.append(f"<path d='M{vx-15} {hy-6} L{vx+15} {hy-6} L{vx+12} {hy+5} L{vx+3} {hy+2} L{vx} {hy+6} L{vx-3} {hy+2} L{vx-12} {hy+5} Z' fill='#22E4FF' stroke='{EDGE}' stroke-width='1.5' stroke-linejoin='round'></path><path d='M{vx-13} {hy-4} L{vx+13} {hy-4} L{vx+12} {hy-1} L{vx-12} {hy-1} Z' fill='#FFFFFF' opacity='0.55'></path>")
    o+=front
    return "".join(o)
VAR={
 '1':dict(name='Crown Captain',halo='crown',feet='boots',logo='big',cape='long',pads=True),
 '2':dict(name='Halo Captain',halo='sun',feet='trainers',logo='badge',cape='capelet',pads=False),
 '4':dict(name='Captain Joulz',halo='none',feet='boots',logo='big',cape='long82',pads=False,hands='gauntlet'),
 '3':dict(name='Orbit Captain',halo='orbit',feet='armour',logo='sash',cape='twin',pads=True),
}
def captain(v,p,pfx):
    V=VAR[v]; P=POSES[p]; g=[]
    (sl,sr),(el,er),(hl,hr)=P['sh'],P['el'],P['ha']; (pl,pr),(kl,kr),(fl,fr)=P['hp'],P['kn'],P['ft']
    g.append(cape(V['cape'],p,pfx))
    hand=(lambda e,h: gauntlet(e,h,pfx)) if V.get('hands')=='gauntlet' else (lambda e,h: glove(e,h,pfx,0))
    g.append(limb2([sl,el,hl],11,pfx)+hand(el,hl))
    g.append(limb2([pl,kl,fl],12,pfx)+footwear(kl,fl,pfx,V['feet'],-1 if p=='run' else -1))
    g.append(torso2(P,pfx,V['logo']))
    g.append(chest(V['logo'],P,pfx))
    g.append(limb2([pr,kr,fr],12,pfx)+footwear(kr,fr,pfx,V['feet'],1))
    g.append(limb2([sr,er,hr],11,pfx)+hand(er,hr))
    g.append(shoulders(P,pfx,V['pads']))
    if V['cape']=='capelet':
        g.append("".join(f"<circle cx='{x}' cy='{y}' r='4' fill='url(#{pfx}goldA)' stroke='{EDGE}' stroke-width='1.5'></circle>" for x,y in P['sh']))
    g.append(head(P,pfx,V['halo']))
    return "".join(g)
def fig(v,p,h=250):
    pfx=f'c{v}{p}'
    return f"<svg width='{h*0.75:.0f}' height='{h}' viewBox='-10 -40 180 240' role='img' aria-label='{VAR[v]['name']}, {p}'>{defs(pfx)}<ellipse cx='80' cy='192' rx='50' ry='5' fill='#000' opacity='0.35'></ellipse>{captain(v,p,pfx)}</svg>"
if __name__=='__main__':
    row=""
    for i,v in enumerate('123'):
        for j,p in enumerate(('stand','run','cheer')):
            pfx=f'c{v}{p}'
            row+=f"<g transform='translate({j*190+10} {i*250+40})'>{defs(pfx)}{captain(v,p,pfx)}</g>"
    svg=f"<svg xmlns='http://www.w3.org/2000/svg' width='580' height='760' viewBox='0 0 580 760'><rect width='580' height='760' fill='#0F1424'/>{row}</svg>"
    import cairosvg; cairosvg.svg2png(bytestring=svg.encode(),write_to='/home/claude/art/cap.png',output_width=1160)
