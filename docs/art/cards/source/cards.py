import math,random
def card_bg(kind,w=320,h=120,uid='c'):
    R=lambda c: f"<rect width='{w}' height='{h}' fill='{c}'></rect>"
    if kind=='navy': return R('#141A2E')
    if kind=='bolts': return R('#141A2E')+"".join(f"<path d='M{x} -10 l-40 {h+20}' stroke='{c}' stroke-width='10' opacity='0.35'></path>" for x,c in ((60,'#22E4FF'),(140,'#E2C07A'),(220,'#22E4FF'),(300,'#E2C07A'),(380,'#22E4FF')))
    if kind=='grid': return R('#10162A')+"".join(f"<path d='M{x} 0v{h}' stroke='#22304F' stroke-width='1'></path>" for x in range(0,w,16))+"".join(f"<path d='M0 {y}h{w}' stroke='#22304F' stroke-width='1'></path>" for y in range(0,h,16))
    if kind=='waves': return R('#0F2238')+"".join(f"<path d='M0 {y} q40 -14 80 0 t80 0 t80 0 t80 0 t80 0' fill='none' stroke='#2A6FA8' stroke-width='2.5' opacity='0.32'></path>" for y in range(14,h,18))
    if kind=='hex':
        g=R('#161328')
        for row in range(5):
            for col in range(12):
                cx=col*30+(15 if row%2 else 0); cy=row*26
                g+="<path d='M"+" L".join(f"{cx+14*math.cos(math.radians(60*k)):.1f} {cy+14*math.sin(math.radians(60*k)):.1f}" for k in range(6))+"Z' fill='none' stroke='#3A2F6A' stroke-width='1.2' opacity='0.6'></path>"
        return g
    if kind=='circuit':
        random.seed(2); g=R('#0E1A16')
        for _ in range(14):
            x=random.randint(0,w); y=random.randint(0,h); dx=random.choice((40,60,80))
            g+=f"<path d='M{x} {y}h{dx}v{random.choice((-20,20))}' fill='none' stroke='#2EB36B' stroke-width='2' opacity='0.3'></path><circle cx='{x}' cy='{y}' r='3' fill='#3DDC84' opacity='0.4'></circle>"
        return g
    if kind=='dots': return R('#1A1426')+"".join(f"<circle cx='{x}' cy='{y}' r='2' fill='#FF6BD6' opacity='0.35'></circle>" for x in range(8,w,16) for y in range(8,h,16))
    if kind=='sunburst': return R('#2A1A0A')+"".join(f"<path d='M{w/2} {h} L{w/2+400*math.cos(math.radians(a))} {h-400*math.sin(math.radians(a))} L{w/2+400*math.cos(math.radians(a+6))} {h-400*math.sin(math.radians(a+6))}Z' fill='#E2C07A' opacity='0.18'></path>" for a in range(0,180,12))
    # full colour arts
    if kind=='crimson':   # crimson with embossed chevrons and a sheen
        g=f"<defs><linearGradient id='{uid}g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#FF3B5C'></stop><stop offset='0.5' stop-color='#B5122E'></stop><stop offset='1' stop-color='#3A0612'></stop></linearGradient></defs><rect width='{w}' height='{h}' fill='url(#{uid}g)'></rect>"
        g+="".join(f"<path d='M{x} 0 l30 {h/2} l-30 {h/2}' fill='none' stroke='#FF8A9A' stroke-width='6' opacity='0.18'></path>" for x in range(-20,w+40,34))
        return g+f"<path d='M{w*0.45} 0 L{w*0.65} 0 L{w*0.35} {h} L{w*0.15} {h}Z' fill='#FFFFFF' opacity='0.12'></path>"
    if kind=='royal':     # royal blue with gold filigree and a crown watermark
        g=f"<defs><radialGradient id='{uid}g' cx='0.75' cy='0.4' r='0.9'><stop offset='0' stop-color='#4D7BFF'></stop><stop offset='0.6' stop-color='#14307E'></stop><stop offset='1' stop-color='#081440'></stop></radialGradient></defs><rect width='{w}' height='{h}' fill='url(#{uid}g)'></rect>"
        g+="".join(f"<path d='M0 {y} C60 {y-16} 120 {y+16} 180 {y} S300 {y-16} 360 {y}' fill='none' stroke='#E2C07A' stroke-width='1.5' opacity='0.45'></path>" for y in (16,h-16))
        g+="".join(f"<circle cx='{x}' cy='{y}' r='2' fill='#E2C07A' opacity='0.6'></circle>" for x in range(20,w,40) for y in (16,h-16))
        return g+f"<path d='M{w-120} 86 {w-128} 40l24 18 18-32 18 32 24-18-8 46z' fill='#E2C07A' opacity='0.22'></path>"
    if kind=='emerald':   # emerald with faceted shards
        g=f"<defs><linearGradient id='{uid}g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#5BF0A0'></stop><stop offset='0.5' stop-color='#14945A'></stop><stop offset='1' stop-color='#043A22'></stop></linearGradient></defs><rect width='{w}' height='{h}' fill='url(#{uid}g)'></rect>"
        pts=[(w-140,0),(w-60,0),(w,40),(w,h),(w-100,h),(w-170,60)]
        g+="".join(f"<path d='M{w-110} 56 L{a} {b} L{c} {d}Z' fill='{('#FFFFFF','#0A5A34','#9AF5C6')[k%3]}' opacity='{0.22 if k%3==0 else 0.3}'></path>" for k,((a,b),(c,d)) in enumerate(zip(pts,pts[1:]+pts[:1])))
        return g
    if kind=='sunset':    # synthwave sun over a horizon with palms
        g=(f"<defs><linearGradient id='{uid}g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#2A0F4A'></stop><stop offset='0.6' stop-color='#FF4D8D'></stop><stop offset='1' stop-color='#FF8A3D'></stop></linearGradient>"
           f"<linearGradient id='{uid}s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#FFE600'></stop><stop offset='1' stop-color='#FF4D8D'></stop></linearGradient></defs><rect width='{w}' height='{h}' fill='url(#{uid}g)'></rect>")
        g+=f"<circle cx='{w-90}' cy='{h-30}' r='46' fill='url(#{uid}s)'></circle>"+"".join(f"<rect x='{w-140}' y='{h-30+k*9}' width='100' height='{2+k}' fill='#2A0F4A'></rect>" for k in range(-2,4))
        g+=f"<rect y='{h-22}' width='{w}' height='22' fill='#1A0830'></rect>"+"".join(f"<path d='M{w/2} {h-22} L{x} {h}' stroke='#FF6BD6' stroke-width='1' opacity='0.6'></path>" for x in range(-200,w+201,40))
        g+=f"<path d='M{w-200} {h-22} v-40 M{w-200} {h-62} c-14 -2 -22 4 -26 10 M{w-200} {h-62} c12 -6 22 -2 28 6 M{w-200} {h-62} c-6 -12 -16 -14 -24 -10' stroke='#1A0830' stroke-width='3' fill='none'></path>"
        return g
    if kind=='neoncity':
        random.seed(8); g=f"<defs><linearGradient id='{uid}g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#2A0F4A'></stop><stop offset='1' stop-color='#FF6BD6'></stop></linearGradient></defs><rect width='{w}' height='{h}' fill='url(#{uid}g)'></rect>"
        x=0
        while x<w:
            bw=random.randint(18,40); bh=random.randint(30,90); g+=f"<rect x='{x}' y='{h-bh}' width='{bw}' height='{bh}' fill='#120A24'></rect>"
            g+="".join(f"<rect x='{x+3+j*7}' y='{h-bh+5+k*9}' width='3' height='4' fill='#22E4FF' opacity='{0.9 if random.random()<0.4 else 0.15}'></rect>" for j in range(int((bw-4)/7)) for k in range(int((bh-8)/9)))
            x+=bw+2
        return g
    if kind=='galaxy':
        random.seed(5); return (f"<defs><radialGradient id='{uid}g' cx='0.6' cy='0.5' r='0.7'><stop offset='0' stop-color='#B26BFF'></stop><stop offset='0.4' stop-color='#3A1A7A'></stop><stop offset='1' stop-color='#080622'></stop></radialGradient></defs><rect width='{w}' height='{h}' fill='url(#{uid}g)'></rect>"
                +"".join(f"<circle cx='{random.randint(0,w)}' cy='{random.randint(0,h)}' r='{random.choice((0.8,1.2,1.8))}' fill='#FFFFFF'></circle>" for _ in range(60)))
    if kind=='lava':
        return (f"<defs><linearGradient id='{uid}g' x1='0' y1='1' x2='0' y2='0'><stop offset='0' stop-color='#FF8A3D'></stop><stop offset='0.4' stop-color='#B5321E'></stop><stop offset='1' stop-color='#1A0806'></stop></linearGradient></defs><rect width='{w}' height='{h}' fill='url(#{uid}g)'></rect>"
                +"".join(f"<path d='M{x} {h} q10 -30 0 -60' stroke='#FFE07A' stroke-width='3' fill='none' opacity='0.5'></path>" for x in range(30,w,70)))
    if kind=='aurora':
        return (f"<rect width='{w}' height='{h}' fill='#061226'></rect>"+"".join(f"<path d='M0 {y} q80 -40 160 0 t160 0' stroke='{c}' stroke-width='18' fill='none' opacity='0.35'></path>" for y,c in ((50,'#3DDC84'),(70,'#22E4FF'),(90,'#B26BFF')))
                +"".join(f"<circle cx='{x}' cy='{y}' r='1' fill='#FFFFFF'></circle>" for x,y in ((20,12),(80,24),(150,8),(210,18),(290,10),(260,30))))
    if kind=='goldcircuit':
        random.seed(9); g=R('#1A1206')
        for _ in range(16):
            x=random.randint(0,w); y=random.randint(0,h); g+=f"<path d='M{x} {y}h{random.choice((40,60))}v{random.choice((-24,24))}h30' fill='none' stroke='#E2C07A' stroke-width='2' opacity='0.7'></path><circle cx='{x}' cy='{y}' r='3' fill='#FFF1C2'></circle>"
        return g
    if kind=='diamondplate':
        g=f"<defs><linearGradient id='{uid}g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#8FE3F5'></stop><stop offset='0.5' stop-color='#4E7BD6'></stop><stop offset='1' stop-color='#1A2A6A'></stop></linearGradient></defs><rect width='{w}' height='{h}' fill='url(#{uid}g)'></rect>"
        for k in range(0,w+120,40):
            g+=f"<path d='M{k} 0 L{k-60} {h} L{k-20} {h} Z' fill='{('#FFFFFF','#B98CFF','#22E4FF')[(k//40)%3]}' opacity='0.14'></path>"
        return g
    if kind=='neoncircuit':  # Season 1 pass
        g=f"<rect width='{w}' height='{h}' fill='#0A0820'></rect>"
        for y,c in ((30,'#22E4FF'),(60,'#FF6BD6'),(90,'#FFE600')):
            g+=f"<path d='M0 {y}h70l20 -14h80l20 14h130' fill='none' stroke='{c}' stroke-width='3' opacity='0.8'></path>"
        return g+f"<path d='M250 10 236 40h10l-4 20 18-30h-10z' fill='#FFE600' opacity='0.85'></path>"
    if kind.startswith('tier-'):
        t=kind[5:]
        order=['spark','charge','volt','surge','storm','lightning','top500']; L=order.index(t)
        col={'spark':'#FF8A3D','charge':'#3DDC84','volt':'#22E4FF','surge':'#6E8BFF','storm':'#B26BFF','lightning':'#FFE600','top500':'#E2C07A'}[t]
        op=0.35+L*0.08
        g=(f"<defs><linearGradient id='{uid}g' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#0B0F1C'></stop><stop offset='1' stop-color='{col}' stop-opacity='{op:.2f}'></stop></linearGradient>"
           f"<radialGradient id='{uid}r' cx='0.8' cy='0.5' r='0.6'><stop offset='0' stop-color='{col}' stop-opacity='{0.1+L*0.07:.2f}'></stop><stop offset='1' stop-color='{col}' stop-opacity='0'></stop></radialGradient>"
           f"<linearGradient id='{uid}i' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#22E4FF'></stop><stop offset='0.4' stop-color='#B98CFF'></stop><stop offset='0.7' stop-color='#FF8FD6'></stop><stop offset='1' stop-color='#E2C07A'></stop></linearGradient></defs>"
           f"<rect width='{w}' height='{h}' fill='url(#{uid}g)'></rect><rect width='{w}' height='{h}' fill='url(#{uid}r)'></rect>")
        if L>=2: g+="".join(f"<path d='M{w-70} {h/2} L{w-70+300*math.cos(math.radians(a))} {h/2+300*math.sin(math.radians(a))} L{w-70+300*math.cos(math.radians(a+5))} {h/2+300*math.sin(math.radians(a+5))}Z' fill='{col}' opacity='{0.05+L*0.02:.2f}'></path>" for a in range(0,360,20))
        if L>=4: g+="".join(f"<ellipse cx='{x}' cy='{y}' rx='40' ry='14' fill='#FFFFFF' opacity='0.07'></ellipse>" for x,y in ((w-60,18),(w-150,24),(w-30,h-14)))
        bolt=lambda x,y,s,o: f"<path d='M{x} {y} {x-30*s} {y+56*s}h{22*s}l{-8*s} {46*s} {38*s} {-62*s}h{-24*s}z' fill='{col}' opacity='{o}'></path>"
        g+=bolt(w-90,8,1,0.45+L*0.08)
        if L>=3: g+=bolt(w-160,30,0.6,0.3+L*0.06)
        if L>=5: g+=bolt(w-30,40,0.5,0.6)+"".join(f"<circle cx='{x}' cy='{y}' r='2' fill='#FFFFFF'></circle>" for x,y in ((w-120,14),(w-60,96),(w-200,70),(w-20,20)))
        if L==6:
            g+=f"<rect width='{w}' height='{h}' fill='url(#{uid}i)' opacity='0.22'></rect>"+f"<path d='M{w-150} 96 {w-158} 52l24 18 18-32 18 32 24-18-8 44z' fill='#FFF1C2' opacity='0.5'></path>"
        return g
    return R('#1E2640')
FRAME_STYLE={
 'Plain':('#2A3352',2,None),'Bronze':('#C98A5A',3,None),'Silver':('#C9D3E6',3,None),'Gold':('#E2C07A',3,None),
 'Obsidian':('#9B6BFF',3,'#9B6BFF'),'Diamond':('url',4,'#9FE8FF'),'Founding':('#E2C07A',4,'#FFE600'),'Top 500':('#E2C07A',4,'#22E4FF')}
