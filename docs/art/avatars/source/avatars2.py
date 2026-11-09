# 26 more game avatars, same style as avatars.py (100x100, outline #06080F, main F, accent A)
E='#06080F'
def more(kind,F,A):
    if kind=='hover':   # hover ship
        return (f"<ellipse cx='50' cy='62' rx='30' ry='7' fill='{A}' opacity='0.35'></ellipse>"
                f"<path d='M20 52c4-10 16-16 30-16s26 6 30 16l-6 6H26z' fill='{F}' stroke='{E}' stroke-width='3' stroke-linejoin='round'></path>"
                f"<path d='M38 40c2-6 7-9 12-9s10 3 12 9z' fill='{A}' stroke='{E}' stroke-width='2.5'></path>"
                f"<path d='M28 58h44' stroke='{E}' stroke-width='2.5'></path><circle cx='34' cy='52' r='2.5' fill='#FFF6C2'></circle><circle cx='50' cy='52' r='2.5' fill='#FFF6C2'></circle><circle cx='66' cy='52' r='2.5' fill='#FFF6C2'></circle>"
                f"<path d='M36 66l-4 8M50 66v9M64 66l4 8' stroke='{A}' stroke-width='3' stroke-linecap='round'></path>")
    if kind=='pinball':
        return (f"<circle cx='50' cy='50' r='24' fill='{F}' stroke='{E}' stroke-width='3'></circle>"
                f"<circle cx='42' cy='42' r='7' fill='#FFFFFF' opacity='0.55'></circle>"
                f"<path d='M54 36 46 52h6l-3 12 9-17h-6z' fill='{A}' stroke='{E}' stroke-width='1.6' stroke-linejoin='round'></path>")
    if kind=='golf':
        return (f"<path d='M62 22v44' stroke='{E}' stroke-width='3'></path><path d='M62 22l18 6-18 6z' fill='{A}' stroke='{E}' stroke-width='2' stroke-linejoin='round'></path>"
                f"<ellipse cx='50' cy='76' rx='26' ry='6' fill='#2EB36B' stroke='{E}' stroke-width='2.5'></ellipse><ellipse cx='62' cy='75' rx='5' ry='2' fill='{E}'></ellipse>"
                f"<circle cx='38' cy='60' r='12' fill='{F}' stroke='{E}' stroke-width='3'></circle><circle cx='34' cy='57' r='1.3' fill='{E}' opacity='0.4'></circle><circle cx='40' cy='56' r='1.3' fill='{E}' opacity='0.4'></circle><circle cx='37' cy='62' r='1.3' fill='{E}' opacity='0.4'></circle><circle cx='43' cy='61' r='1.3' fill='{E}' opacity='0.4'></circle>")
    if kind=='tank':
        return (f"<rect x='20' y='56' width='60' height='16' rx='8' fill='{E}'></rect>"
                + "".join(f"<circle cx='{x}' cy='64' r='4.5' fill='#8F9BBF'></circle>" for x in (28,40,52,64,72))
                + f"<path d='M24 56l6-12h40l6 12z' fill='{F}' stroke='{E}' stroke-width='3' stroke-linejoin='round'></path>"
                f"<rect x='38' y='32' width='24' height='14' rx='5' fill='{F}' stroke='{E}' stroke-width='3'></rect><path d='M60 38h22' stroke='{E}' stroke-width='6' stroke-linecap='round'></path><path d='M60 38h22' stroke='{A}' stroke-width='2.5' stroke-linecap='round'></path>")
    if kind=='fighter':  # wavefront hero ship
        return (f"<path d='M50 18 60 46 78 62 60 60 56 74H44l-4-14-18 2 18-16z' fill='{F}' stroke='{E}' stroke-width='3' stroke-linejoin='round'></path>"
                f"<path d='M50 30 55 46H45z' fill='{A}' stroke='{E}' stroke-width='2' stroke-linejoin='round'></path>"
                f"<path d='M45 76l5 10 5-10z' fill='#FF8A3D' stroke='{E}' stroke-width='1.5'></path>")
    if kind=='breaker':
        return ("".join(f"<rect x='{x}' y='{y}' width='18' height='9' rx='2' fill='{c}' stroke='{E}' stroke-width='2'></rect>" for x,y,c in ((22,24,F),(42,24,A),(62,24,F),(32,35,A),(52,35,F)))
                + f"<path d='M58 46l-6 2 4 4z' fill='#FFFFFF'></path><circle cx='46' cy='58' r='7' fill='#FFFFFF' stroke='{E}' stroke-width='2.5'></circle><path d='M53 52l6-6' stroke='{A}' stroke-width='2' stroke-linecap='round' opacity='0.7'></path>"
                f"<rect x='30' y='72' width='40' height='7' rx='3.5' fill='{F}' stroke='{E}' stroke-width='2.5'></rect>")
    if kind=='atom':
        orb="".join(f"<ellipse cx='50' cy='50' rx='28' ry='10' fill='none' stroke='{F}' stroke-width='3.5' transform='rotate({a} 50 50)'></ellipse>" for a in (0,60,120))
        return (orb+f"<circle cx='50' cy='50' r='8' fill='{A}' stroke='{E}' stroke-width='2.5'></circle>"
                f"<circle cx='78' cy='50' r='3.5' fill='{A}' stroke='{E}' stroke-width='1.5'></circle><circle cx='36' cy='26' r='3.5' fill='{A}' stroke='{E}' stroke-width='1.5'></circle>")
    if kind=='note':
        return (f"<path d='M44 66V28l26-6v36' fill='none' stroke='{E}' stroke-width='7' stroke-linejoin='round'></path><path d='M44 66V28l26-6v36' fill='none' stroke='{F}' stroke-width='3.5' stroke-linejoin='round'></path>"
                f"<path d='M44 28l26-6v8l-26 6z' fill='{F}' stroke='{E}' stroke-width='2'></path>"
                f"<ellipse cx='37' cy='67' rx='9' ry='7' fill='{F}' stroke='{E}' stroke-width='3' transform='rotate(-20 37 67)'></ellipse><ellipse cx='63' cy='59' rx='9' ry='7' fill='{F}' stroke='{E}' stroke-width='3' transform='rotate(-20 63 59)'></ellipse>"
                f"<path d='M74 30l3 5 5 1-4 3 1 5-5-3-4 3 1-5-4-3 5-1z' fill='{A}'></path>")
    if kind=='orb':
        return (f"<circle cx='50' cy='50' r='26' fill='{F}' stroke='{E}' stroke-width='3'></circle><circle cx='50' cy='50' r='19' fill='none' stroke='{A}' stroke-width='2' opacity='0.6'></circle>"
                f"<text x='50' y='60' text-anchor='middle' font-family='Archivo, sans-serif' font-weight='900' font-size='28' fill='{E}'>J</text><circle cx='41' cy='38' r='5' fill='#FFFFFF' opacity='0.5'></circle>")
    if kind=='bulb':
        return (f"<path d='M50 18c-14 0-23 10-23 22 0 9 6 14 9 20 2 4 2 8 2 10h24c0-2 0-6 2-10 3-6 9-11 9-20 0-12-9-22-23-22z' fill='{F}' stroke='{E}' stroke-width='3' stroke-linejoin='round'></path>"
                f"<path d='M54 30 44 46h7l-3 12 10-17h-7z' fill='{A}' stroke='{E}' stroke-width='1.6' stroke-linejoin='round'></path>"
                f"<rect x='38' y='70' width='24' height='8' rx='2' fill='#8F9BBF' stroke='{E}' stroke-width='2.5'></rect><rect x='41' y='78' width='18' height='6' rx='3' fill='#4A5680' stroke='{E}' stroke-width='2'></rect>")
    if kind=='hanoi':
        return (f"<rect x='48' y='22' width='4' height='52' fill='{E}'></rect>"
                + "".join(f"<rect x='{50-w/2}' y='{y}' width='{w}' height='10' rx='5' fill='{c}' stroke='{E}' stroke-width='2.5'></rect>" for w,y,c in ((52,66,F),(40,55,A),(28,44,F),(18,33,A)))
                + f"<rect x='18' y='76' width='64' height='5' rx='2' fill='{E}'></rect>")
    if kind=='flask':
        return (f"<path d='M42 22h16v16l14 26c3 6-1 12-7 12H35c-6 0-10-6-7-12l14-26z' fill='#EEF2FF' fill-opacity='0.15' stroke='{E}' stroke-width='3' stroke-linejoin='round'></path>"
                f"<path d='M33 58h34l5 9c2 4-1 9-6 9H34c-5 0-8-5-6-9z' fill='{F}'></path><path d='M30 63h40' stroke='{A}' stroke-width='3' opacity='0.8'></path>"
                f"<rect x='40' y='16' width='20' height='8' rx='2' fill='#8F5A2E' stroke='{E}' stroke-width='2.5'></rect><circle cx='46' cy='50' r='2.5' fill='{A}'></circle><circle cx='54' cy='44' r='2' fill='{A}'></circle>")
    if kind=='safe':
        ticks="".join(f"<path d='M50 {26} v5' stroke='{E}' stroke-width='2' transform='rotate({a} 50 50)'></path>" for a in range(0,360,30))
        return (f"<circle cx='50' cy='50' r='26' fill='#8F9BBF' stroke='{E}' stroke-width='3'></circle><circle cx='50' cy='50' r='19' fill='{F}' stroke='{E}' stroke-width='2.5'></circle>"
                +ticks+f"<circle cx='50' cy='50' r='7' fill='{A}' stroke='{E}' stroke-width='2'></circle><path d='M50 31v12' stroke='{E}' stroke-width='3' stroke-linecap='round'></path>")
    if kind=='puffer':
        spikes="".join(f"<path d='M{50+22*__import__('math').cos(__import__('math').radians(a)):.1f} {52+22*__import__('math').sin(__import__('math').radians(a)):.1f} l{6*__import__('math').cos(__import__('math').radians(a)):.1f} {6*__import__('math').sin(__import__('math').radians(a)):.1f}' stroke='{E}' stroke-width='2.5' stroke-linecap='round'></path>" for a in range(200,520,40))
        return (spikes+f"<circle cx='50' cy='52' r='22' fill='{F}' stroke='{E}' stroke-width='3'></circle><path d='M30 58c8 10 32 10 40 0' fill='#FFF3D6' stroke='{E}' stroke-width='2'></path>"
                f"<circle cx='58' cy='46' r='5' fill='#FFFFFF' stroke='{E}' stroke-width='2'></circle><circle cx='59' cy='46' r='2' fill='{E}'></circle><path d='M70 52c4-2 6 0 6 2s-2 4-6 2' fill='{A}' stroke='{E}' stroke-width='2'></path><path d='M28 48l-8-6v14z' fill='{A}' stroke='{E}' stroke-width='2' stroke-linejoin='round'></path>")
    if kind=='basketball':
        return (f"<circle cx='50' cy='50' r='25' fill='{F}' stroke='{E}' stroke-width='3'></circle>"
                f"<path d='M25 50h50M50 25v50M32 32c8 10 8 26 0 36M68 32c-8 10-8 26 0 36' fill='none' stroke='{E}' stroke-width='2.5'></path>")
    if kind=='dart':
        return (f"<g transform='rotate(-40 50 50)'><path d='M50 14 53 34h-6z' fill='#B5C6DD' stroke='{E}' stroke-width='2' stroke-linejoin='round'></path>"
                f"<rect x='45' y='34' width='10' height='24' rx='3' fill='{F}' stroke='{E}' stroke-width='2.5'></rect><path d='M45 42h10M45 48h10' stroke='{E}' stroke-width='1.5' opacity='0.4'></path>"
                f"<path d='M50 58v8' stroke='{E}' stroke-width='3'></path><path d='M50 64l-12 14h10l2-6 2 6h10z' fill='{A}' stroke='{E}' stroke-width='2.5' stroke-linejoin='round'></path></g>")
    if kind=='baseball':
        return (f"<circle cx='50' cy='50' r='25' fill='#F4F1E8' stroke='{E}' stroke-width='3'></circle>"
                f"<path d='M34 32c6 10 6 26 0 36M66 32c-6 10-6 26 0 36' fill='none' stroke='{F}' stroke-width='2.5'></path>"
                + "".join(f"<path d='M{x-3} {y}h6' stroke='{F}' stroke-width='2'></path>" for x,y in ((36,38),(38,46),(38,54),(36,62),(64,38),(62,46),(62,54),(64,62))))
    if kind=='block':
        cells=[(0,0),(1,0),(2,0),(1,1)]
        return "".join(f"<rect x='{26+cx*16}' y='{36+cy*16}' width='16' height='16' rx='2' fill='{F if (cx+cy)%2==0 else A}' stroke='{E}' stroke-width='2.5'></rect><path d='M{29+cx*16} {39+cy*16}h6' stroke='#FFFFFF' stroke-width='2' opacity='0.5'></path>" for cx,cy in cells)
    if kind=='astronaut':
        return (f"<path d='M30 98V78c0-8 9-12 20-12s20 4 20 12v20z' fill='#EEF2FF' stroke='{E}' stroke-width='2.5'></path><rect x='44' y='74' width='12' height='8' rx='2' fill='{A}' stroke='{E}' stroke-width='1.5'></rect>"
                f"<circle cx='50' cy='46' r='22' fill='#EEF2FF' stroke='{E}' stroke-width='3'></circle><rect x='34' y='36' width='32' height='22' rx='11' fill='{F}' stroke='{E}' stroke-width='2.5'></rect>"
                f"<path d='M40 42c4-3 10-3 13 0' stroke='#FFFFFF' stroke-width='2.5' stroke-linecap='round' opacity='0.7'></path>")
    if kind=='meteor':
        return (f"<path d='M20 24l28 18M28 18l24 20M18 34l26 12' stroke='{A}' stroke-width='5' stroke-linecap='round' opacity='0.8'></path>"
                f"<circle cx='58' cy='58' r='18' fill='{F}' stroke='{E}' stroke-width='3'></circle><circle cx='52' cy='54' r='4' fill='{E}' opacity='0.3'></circle><circle cx='64' cy='62' r='3' fill='{E}' opacity='0.3'></circle><circle cx='60' cy='50' r='2' fill='{E}' opacity='0.3'></circle>")
    if kind=='ninja':
        return (f"<circle cx='50' cy='50' r='24' fill='{F}' stroke='{E}' stroke-width='3'></circle>"
                f"<rect x='28' y='42' width='44' height='12' rx='6' fill='#F6C9A4' stroke='{E}' stroke-width='2'></rect>"
                f"<path d='M37 48l7-1M56 47l7 1' stroke='{E}' stroke-width='3' stroke-linecap='round'></path>"
                f"<path d='M26 38h48' stroke='{A}' stroke-width='4'></path><path d='M73 38l9-5M73 38l8 4' stroke='{A}' stroke-width='3' stroke-linecap='round'></path>")
    if kind=='curling':
        return (f"<ellipse cx='50' cy='62' rx='28' ry='12' fill='#8F9BBF' stroke='{E}' stroke-width='3'></ellipse><path d='M22 58c0-8 12-14 28-14s28 6 28 14' fill='#B5C6DD' stroke='{E}' stroke-width='3'></path>"
                f"<ellipse cx='50' cy='52' rx='22' ry='8' fill='{F}' stroke='{E}' stroke-width='2.5'></ellipse>"
                f"<path d='M44 50v-12h16v6' fill='none' stroke='{E}' stroke-width='6' stroke-linejoin='round' stroke-linecap='round'></path><path d='M44 50v-12h16v6' fill='none' stroke='{A}' stroke-width='3' stroke-linejoin='round' stroke-linecap='round'></path>")
    if kind=='football':
        import math
        pent=lambda cx,cy,r: "M"+" L".join(f"{cx+r*math.cos(math.radians(72*i-90)):.1f} {cy+r*math.sin(math.radians(72*i-90)):.1f}" for i in range(5))+"Z"
        return (f"<circle cx='50' cy='50' r='25' fill='#F4F6FB' stroke='{E}' stroke-width='3'></circle><path d='{pent(50,50,8)}' fill='{F}'></path>"
                + "".join(f"<path d='{pent(50+17*math.cos(math.radians(72*i-90)),50+17*math.sin(math.radians(72*i-90)),5)}' fill='{F}'></path>" for i in range(5))
                + f"<circle cx='50' cy='50' r='25' fill='none' stroke='{E}' stroke-width='3'></circle>")
    if kind=='prism':
        return (f"<path d='M14 54l26-4' stroke='#FFFFFF' stroke-width='3' stroke-linecap='round'></path>"
                f"<path d='M50 24 72 66H28z' fill='{F}' fill-opacity='0.85' stroke='{E}' stroke-width='3' stroke-linejoin='round'></path><path d='M50 24 60 66' stroke='#FFFFFF' stroke-opacity='0.4' stroke-width='2'></path>"
                + "".join(f"<path d='M64 {50+i*3}l22 {i*5-6}' stroke='{c}' stroke-width='3' stroke-linecap='round'></path>" for i,c in enumerate(('#FF3B5C','#FF8A3D','#FFE600','#3DDC84','#22E4FF','#B26BFF'))))
    if kind=='key':
        return (f"<circle cx='34' cy='44' r='14' fill='none' stroke='{E}' stroke-width='9'></circle><circle cx='34' cy='44' r='14' fill='none' stroke='{F}' stroke-width='5'></circle>"
                f"<circle cx='34' cy='44' r='4' fill='{A}'></circle>"
                f"<path d='M47 50l28 16M66 60l-4 7M72 64l-3 6' stroke='{E}' stroke-width='9' stroke-linecap='round'></path><path d='M47 50l28 16M66 60l-4 7M72 64l-3 6' stroke='{F}' stroke-width='5' stroke-linecap='round'></path>")
    if kind=='crane':
        return (f"<path d='M30 82V24' stroke='{E}' stroke-width='7'></path><path d='M30 82V24' stroke='{F}' stroke-width='4'></path>"
                f"<path d='M22 28h56' stroke='{E}' stroke-width='7'></path><path d='M22 28h56' stroke='{F}' stroke-width='4'></path>"
                f"<path d='M30 28 22 20M30 28l8-8' stroke='{E}' stroke-width='2'></path><path d='M66 28v20' stroke='{E}' stroke-width='2'></path>"
                f"<rect x='56' y='48' width='20' height='16' rx='2' fill='{A}' stroke='{E}' stroke-width='2.5'></rect><path d='M60 54h12M60 59h12' stroke='{E}' stroke-width='1.5' opacity='0.4'></path><rect x='22' y='80' width='18' height='6' fill='{E}'></rect>")
    return ''


def more_v2(kind,F,A):
    W="#FFFFFF"
    if kind=='tower':   # High Rise: a tower of offset blocks with a gold block dropping in
        rows=[(28,70,44),(31,58,38),(29,46,40),(33,34,32)]
        g=""
        for x,y,w in rows:
            g+=f"<rect x='{x}' y='{y}' width='{w}' height='12' rx='2' fill='{F}' stroke='{E}' stroke-width='2.5'></rect>"
            g+="".join(f"<rect x='{x+5+j*8}' y='{y+4}' width='4' height='4' rx='1' fill='#FFF6C2' opacity='0.9'></rect>" for j in range(int((w-6)/8)))
        g+=f"<rect x='36' y='14' width='28' height='11' rx='2' fill='{A}' stroke='{E}' stroke-width='2.5'></rect><path d='M40 16h20' stroke='{W}' stroke-width='2' opacity='0.6'></path>"
        g+=f"<path d='M38 28v4M50 28v5M62 28v4' stroke='{A}' stroke-width='2' stroke-linecap='round' opacity='0.7'></path>"
        g+=f"<path d='M22 82h56' stroke='{E}' stroke-width='3' stroke-linecap='round'></path><path d='M70 18l2-5 2 5 5 2-5 2-2 5-2-5-5-2z' fill='#FFF6C2'></path>"
        return g
    if kind=='safe':    # Safe Cracker: the front of a safe
        ticks="".join(f"<path d='M50 39v3' stroke='{E}' stroke-width='1.6' transform='rotate({t} 50 50)'></path>" for t in range(0,360,30))
        return (f"<rect x='22' y='24' width='56' height='52' rx='7' fill='{F}' stroke='{E}' stroke-width='3'></rect>"
                f"<rect x='28' y='30' width='44' height='40' rx='4' fill='{E}' fill-opacity='0.25' stroke='{E}' stroke-width='2'></rect>"
                f"<circle cx='50' cy='50' r='12' fill='#D3DCEF' stroke='{E}' stroke-width='2.5'></circle>{ticks}<circle cx='50' cy='50' r='4' fill='{A}' stroke='{E}' stroke-width='1.5'></circle><path d='M50 41v6' stroke='{E}' stroke-width='2.5' stroke-linecap='round'></path>"
                f"<rect x='66' y='44' width='4' height='14' rx='2' fill='#D3DCEF' stroke='{E}' stroke-width='1.5'></rect>"
                f"<rect x='22' y='34' width='3' height='8' fill='{E}'></rect><rect x='22' y='58' width='3' height='8' fill='{E}'></rect>"
                f"<rect x='28' y='76' width='8' height='5' rx='1' fill='{E}'></rect><rect x='64' y='76' width='8' height='5' rx='1' fill='{E}'></rect>"
                f"<path d='M28 30l10 10' stroke='{W}' stroke-width='3' opacity='0.3' stroke-linecap='round'></path>")
    if kind=='brilliant':  # Gemstone: a brilliant-cut gem with facets and sparkle
        outline="M26 40 L38 24 H62 L74 40 L50 78 Z"
        return (f"<path d='{outline}' fill='{F}' stroke='{E}' stroke-width='3' stroke-linejoin='round'></path>"
                f"<path d='M38 24 L44 40 L56 40 L62 24 Z' fill='{W}' opacity='0.35'></path>"
                f"<path d='M26 40 L38 24 L44 40 Z' fill='{W}' opacity='0.18'></path><path d='M74 40 L62 24 L56 40 Z' fill='{E}' opacity='0.18'></path>"
                f"<path d='M26 40 L44 40 L50 78 Z' fill='{W}' opacity='0.12'></path><path d='M56 40 L74 40 L50 78 Z' fill='{E}' opacity='0.22'></path>"
                f"<path d='M44 40 L56 40 L50 78 Z' fill='{W}' opacity='0.25'></path>"
                f"<path d='M26 40h48M44 40l6 38M56 40l-6 38M38 24l6 16M62 24l-6 16' fill='none' stroke='{E}' stroke-opacity='0.45' stroke-width='1.4'></path>"
                f"<path d='M72 18l2.5 5.5 5.5 2.5-5.5 2.5-2.5 5.5-2.5-5.5-5.5-2.5 5.5-2.5z' fill='{A}'></path><path d='M22 58l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5z' fill='{A}' opacity='0.8'></path>")
    if kind=='topbins':   # Top Bins: a ball flying into the top corner of the goal
        import math
        net="".join(f"<path d='M{x} 22v56' stroke='#B5C6DD' stroke-width='1' opacity='0.5'></path>" for x in range(30,82,8))+"".join(f"<path d='M22 {y}h58' stroke='#B5C6DD' stroke-width='1' opacity='0.5'></path>" for y in range(30,82,8))
        pent=lambda cx,cy,r: "M"+" L".join(f"{cx+r*math.cos(math.radians(72*k-90)):.1f} {cy+r*math.sin(math.radians(72*k-90)):.1f}" for k in range(5))+"Z"
        ball=f"<circle cx='62' cy='38' r='14' fill='#F4F6FB' stroke='{E}' stroke-width='2.5'></circle><path d='{pent(62,38,5)}' fill='{F}'></path>"+"".join(f"<path d='{pent(62+10*math.cos(math.radians(72*k-90)),38+10*math.sin(math.radians(72*k-90)),3)}' fill='{F}'></path>" for k in range(5))+f"<circle cx='62' cy='38' r='14' fill='none' stroke='{E}' stroke-width='2.5'></circle>"
        return (net+f"<path d='M20 82V20h62' fill='none' stroke='{W}' stroke-width='5' stroke-linejoin='round'></path><path d='M20 82V20h62' fill='none' stroke='{E}' stroke-width='1.5' opacity='0.4'></path>"
                f"<path d='M22 70l22-18M26 78l20-16M30 64l16-12' stroke='{A}' stroke-width='3' stroke-linecap='round' opacity='0.7'></path>"+ball)
    if kind=='bricks':   # Breaker: the ball cracking a brick apart
        return (f"<rect x='18' y='24' width='19' height='10' rx='2' fill='{F}' stroke='{E}' stroke-width='2.5'></rect><rect x='63' y='24' width='19' height='10' rx='2' fill='{F}' stroke='{E}' stroke-width='2.5'></rect>"
                f"<rect x='40.5' y='24' width='19' height='10' rx='2' fill='{F}' stroke='{E}' stroke-width='2.5'></rect><path d='M50 24l-2 4 3 2-2 4' fill='none' stroke='{E}' stroke-width='2'></path>"
                f"<rect x='42' y='38' width='5' height='4' rx='1' fill='{F}' stroke='{E}' stroke-width='1.3' transform='rotate(-25 44 40)'></rect><rect x='54' y='37' width='5' height='4' rx='1' fill='{F}' stroke='{E}' stroke-width='1.3' transform='rotate(30 56 39)'></rect>"
                f"<path d='M36 72 48 52' stroke='{A}' stroke-width='5' stroke-linecap='round' opacity='0.35'></path>"
                f"<circle cx='50' cy='48' r='11' fill='{A}' opacity='0.22'></circle><circle cx='50' cy='48' r='6.5' fill='{W}' stroke='{E}' stroke-width='2.5'></circle>"
                f"<rect x='24' y='74' width='30' height='7' rx='3.5' fill='{A}' stroke='{E}' stroke-width='2.5'></rect>")
    if kind=='nucleus':  # Nucleus: a glowing core with letter tiles in orbit
        tiles=[(50,18,'W'),(82,50,'O'),(50,82,'R'),(18,50,'D')]
        t="".join(f"<rect x='{x-7}' y='{y-7}' width='14' height='14' rx='3' fill='#F3E1B4' stroke='{E}' stroke-width='2'></rect><text x='{x}' y='{y+4}' text-anchor='middle' font-family='Archivo, sans-serif' font-weight='900' font-size='10' fill='{E}'>{c}</text>" for x,y,c in tiles)
        return (f"<circle cx='50' cy='50' r='32' fill='none' stroke='{A}' stroke-width='2' stroke-dasharray='3 4' opacity='0.7'></circle>"
                f"<circle cx='50' cy='50' r='20' fill='{A}' opacity='0.18'></circle><circle cx='50' cy='50' r='15' fill='{F}' stroke='{E}' stroke-width='3'></circle>"
                f"<text x='50' y='57' text-anchor='middle' font-family='Archivo, sans-serif' font-weight='900' font-size='19' fill='{E}'>J</text><circle cx='45' cy='44' r='3.5' fill='{W}' opacity='0.6'></circle>"+t)
    if kind=='stack':   # Blockzone: a bevelled stack with a T-piece dropping into the gap
        def cube(x,y,c):
            return (f"<rect x='{x}' y='{y}' width='14' height='14' rx='2' fill='{c}' stroke='{E}' stroke-width='2'></rect>"
                    f"<path d='M{x+2} {y+2}h10' stroke='{W}' stroke-width='2' opacity='0.55'></path><path d='M{x+2} {y+12}h10' stroke='{E}' stroke-width='2' opacity='0.3'></path>")
        g="".join(cube(x,70,F) for x in (22,36,50,64))
        g+="".join(cube(x,56,c) for x,c in ((22,A),(64,A)))
        g+=f"<rect x='36' y='56' width='28' height='14' fill='{A}' opacity='0.15'></rect>"
        g+=cube(36,30,A)+cube(50,30,A)+cube(64,30,A)+cube(50,44,A)
        g+=f"<path d='M43 26v-6M57 26v-8M71 26v-6' stroke='{A}' stroke-width='2' stroke-linecap='round' opacity='0.6'></path>"
        return g
    return None
