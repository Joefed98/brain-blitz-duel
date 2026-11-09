import math
GEMS={'Amber':('#FFD08A','#F29A2E','#B5651D'),'Rose Quartz':('#FFE0EA','#F4A6C0','#C9708F'),'Ruby':('#FF8A9A','#D7193C','#7E0A22'),
      'Jade':('#B8F2C8','#2FB36B','#146B3E'),'Amethyst':('#E1C6FF','#9B59E0','#5B2A99'),'Aquamarine':('#E2FCFF','#7FE3F0','#3AA9BC'),
      'Sapphire':('#A9C4FF','#2F5FE0','#14307E'),'Pearl':('#FFFFFF','#E9E4F2','#BFB6D6'),'Obsidian':('#4A5680','#141A2E','#06080F'),'Diamond':('#FFFFFF','#CFF3FF','#9ADCF2')}
GEM_STARS={'Amber':10,'Rose Quartz':20,'Ruby':30,'Jade':50,'Amethyst':75,'Aquamarine':100,'Sapphire':125,'Pearl':150,'Obsidian':200,'Diamond':250}
_n=[0]
def _id(): _n[0]+=1; return f"av{_n[0]}"
def _shade(h,f):
    h=h.lstrip('#'); r,g,b=[int(h[k:k+2],16) for k in (0,2,4)]
    if f>0: r,g,b=[int(c+(255-c)*f) for c in (r,g,b)]
    else: r,g,b=[int(c*(1+f)) for c in (r,g,b)]
    return '#%02X%02X%02X'%(r,g,b)
def paint(main,gem,i):
    """returns (fill, defs) for the main colour or a gem metal"""
    if not gem:
        gid=f"{i}m"
        return f"url(#{gid})",f"<linearGradient id='{gid}' x1='0' y1='0' x2='0.35' y2='1'><stop offset='0' stop-color='{_shade(main,0.38)}'></stop><stop offset='0.5' stop-color='{main}'></stop><stop offset='1' stop-color='{_shade(main,-0.28)}'></stop></linearGradient>"
    a,b,c=GEMS[gem]; gid=f"{i}g"
    extra=f"<stop offset='0.85' stop-color='#FFB3E6'></stop>" if gem=='Diamond' else ''
    return f"url(#{gid})",f"<linearGradient id='{gid}' x1='0' y1='0' x2='0.4' y2='1'><stop offset='0' stop-color='{a}'></stop><stop offset='0.45' stop-color='{b}'></stop>{extra}<stop offset='1' stop-color='{c}'></stop></linearGradient>"
E='#06080F'
def art(kind,main,accent,i,gem=None):
    F,dfs=paint(main,gem,i)
    if kind=='helmet':
        g=(f"<path d='M28 54c0-15 9-26 22-26s22 11 22 26c0 11-8 18-22 21-14-3-22-10-22-21z' fill='{F}' stroke='{E}' stroke-width='3'></path>"
           f"<path d='M34 47h32l-3 9-8-3-5 6-5-6-8 3z' fill='{accent}' stroke='{E}' stroke-width='2' stroke-linejoin='round'></path>"
           f"<path d='M44 33v8M50 30v10M56 33v8' stroke='{accent}' stroke-opacity='0.5' stroke-width='2' stroke-linecap='round'></path>")
    elif kind=='gem':
        g=(f"<path d='M30 40l10-12h20l10 12-20 34z' fill='{F}' stroke='{E}' stroke-width='3' stroke-linejoin='round'></path>"
           f"<path d='M30 40h40M40 28l4 12 6 34M60 28l-4 12-6 34M44 40l6-12 6 12' fill='none' stroke='{E}' stroke-opacity='0.45' stroke-width='1.6' stroke-linejoin='round'></path>"
           f"<path d='M66 22l2 4 4 2-4 2-2 4-2-4-4-2 4-2z' fill='{accent}'></path>")
    elif kind=='car':
        g=(f"<path d='M26 34h48' stroke='{E}' stroke-width='5' stroke-linecap='round'></path><path d='M26 34h48' stroke='{accent}' stroke-width='2.5' stroke-linecap='round'></path><path d='M34 35v8M66 35v8' stroke='{E}' stroke-width='2.5'></path>"
           f"<rect x='14' y='62' width='13' height='14' rx='3' fill='{E}'></rect><rect x='73' y='62' width='13' height='14' rx='3' fill='{E}'></rect>"
           f"<path d='M36 42h28l6 12H30z' fill='{F}' stroke='{E}' stroke-width='2.5' stroke-linejoin='round'></path><path d='M38.5 45h23l3.5 8H35z' fill='{accent}'></path>"
           f"<path d='M16 64c0-6 4-10 10-10h48c6 0 10 4 10 10v6H16z' fill='{F}' stroke='{E}' stroke-width='3' stroke-linejoin='round'></path>"
           f"<path d='M21 60l9 2M79 60l-9 2' stroke='#FFF6C2' stroke-width='3' stroke-linecap='round'></path>"
           f"<path d='M40 60h20l-2 6H42z' fill='{E}'></path><path d='M43 62h14' stroke='{accent}' stroke-opacity='0.6' stroke-width='1.2'></path>"
           f"<path d='M14 71h72' stroke='{E}' stroke-width='3' stroke-linecap='round'></path><path d='M28 54l-6-3M72 54l6-3' stroke='{E}' stroke-width='2.5' stroke-linecap='round'></path>")
    elif kind=='eightball':
        g=(f"<circle cx='50' cy='52' r='24' fill='{F}' stroke='{E}' stroke-width='3'></circle><circle cx='43' cy='44' r='10' fill='{accent}' stroke='{E}' stroke-width='1.5'></circle>"
           f"<text x='43' y='49' text-anchor='middle' font-family='Archivo, sans-serif' font-weight='900' font-size='13' fill='{E}'>8</text><path d='M60 38a14 14 0 0 1 6 8' stroke='#FFFFFF' stroke-opacity='0.5' stroke-width='3' stroke-linecap='round' fill='none'></path>")
    elif kind=='orbit':
        back=f"<path d='M20 54a30 9 0 0 1 60 0' fill='none' stroke='{accent}' stroke-width='2.5' transform='rotate(-18 50 54)'></path>"
        front=f"<path d='M80 54a30 9 0 0 1-60 0' fill='none' stroke='{accent}' stroke-width='2.5' transform='rotate(-18 50 54)'></path>"
        g=(back+f"<circle cx='50' cy='54' r='17' fill='{F}' stroke='{E}' stroke-width='3'></circle><path d='M38 50q8 4 22-2M40 60q8 3 18-1' stroke='{E}' stroke-opacity='0.35' stroke-width='2' fill='none'></path>"+front+
           f"<g transform='translate(74 30) rotate(35)'><path d='M0-9c3 2 4 6 4 10v6h-8V1c0-4 1-8 4-10z' fill='#EEF2FF' stroke='{E}' stroke-width='1.5'></path><path d='M-4 5l-3 4h3zM4 5l3 4H4z' fill='{accent}'></path><path d='M-2 8l2 5 2-5z' fill='#FF8A3D'></path></g>")
    elif kind=='leprechaun':
        g="<g transform='translate(7.5 6) scale(0.85)'>"+(f"<path d='M30 98V80c0-8 9-13 20-13s20 5 20 13v18z' fill='{F}' stroke='{E}' stroke-width='2.5' stroke-linejoin='round'></path>"
           f"<path d='M30 84l-8 8M70 84l8 8' stroke='{F}' stroke-width='7' stroke-linecap='round'></path><circle cx='21' cy='93' r='4' fill='#F6C9A4' stroke='{E}' stroke-width='1.5'></circle><circle cx='79' cy='93' r='4' fill='#F6C9A4' stroke='{E}' stroke-width='1.5'></circle>"
           f"<rect x='30' y='84' width='40' height='5' fill='{E}'></rect><rect x='46' y='83' width='8' height='7' rx='1' fill='#E2C07A' stroke='{E}' stroke-width='1'></rect>"
           f"<path d='M50 68l-6 10h12z' fill='#FFFFFF' stroke='{E}' stroke-width='1.5' stroke-linejoin='round'></path>"
           f"<circle cx='50' cy='47' r='13' fill='#F6C9A4' stroke='{E}' stroke-width='2.5'></circle>"
           f"<path d='M37 50c0 11 6 17 13 17s13-6 13-17c-3 3-8 4-13 4s-10-1-13-4z' fill='{accent}' stroke='{E}' stroke-width='2.5' stroke-linejoin='round'></path>"
           f"<path d='M33 36h34v4H33z' fill='{F}' stroke='{E}' stroke-width='2.5'></path><path d='M39 36l2-17h18l2 17z' fill='{F}' stroke='{E}' stroke-width='2.5' stroke-linejoin='round'></path>"
           f"<rect x='40' y='29' width='20' height='4' fill='{E}'></rect><rect x='47' y='28.5' width='6' height='5' fill='#E2C07A' stroke='{E}' stroke-width='1'></rect>"
           f"<circle cx='45' cy='46' r='1.6' fill='{E}'></circle><circle cx='55' cy='46' r='1.6' fill='{E}'></circle>")+"</g>"
    return dfs,g
def avatar_svg(kind,main,accent,px,bg='#1E2640',gem=None,label=None,ring=None):
    i=_id(); dfs,g=art(kind,main,accent,i,gem)
    rg=f"<circle cx='50' cy='50' r='47' fill='none' stroke='{ring}' stroke-width='4'></circle>" if ring else ''
    glow=''; over=''; vb='0 0 100 100'; bgfill=bg
    if gem:
        a,gc,c=GEMS[gem]
        vb='-7 -7 114 114'
        dfs+=(f"<radialGradient id='{i}h' cx='0.5' cy='0.5' r='0.5'><stop offset='0.35' stop-color='{gc}' stop-opacity='0.55'></stop><stop offset='1' stop-color='{gc}' stop-opacity='0'></stop></radialGradient>"
              f"<radialGradient id='{i}b' cx='0.5' cy='0.4' r='0.65'><stop offset='0' stop-color='{_shade(c,-0.25)}'></stop><stop offset='1' stop-color='#0B0F1C'></stop></radialGradient>"
              f"<linearGradient id='{i}r' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='{a}'></stop><stop offset='0.5' stop-color='{gc}'></stop><stop offset='1' stop-color='{c}'></stop></linearGradient>"
              f"<filter id='{i}bl' x='-40%' y='-40%' width='180%' height='180%'><feGaussianBlur stdDeviation='3.5'></feGaussianBlur></filter>"
              f"<linearGradient id='{i}s' x1='0' y1='0' x2='1' y2='1'><stop offset='0.38' stop-color='#FFFFFF' stop-opacity='0'></stop><stop offset='0.48' stop-color='#FFFFFF' stop-opacity='0.35'></stop><stop offset='0.56' stop-color='#FFFFFF' stop-opacity='0'></stop></linearGradient>")
        bgfill=f"url(#{i}b)"
        glow=f"<circle cx='50' cy='52' r='44' fill='url(#{i}h)'></circle>"
        over=f"<rect x='0' y='0' width='100' height='100' fill='url(#{i}s)'></rect>"
        spark=lambda x,y,r,col: f"<path d='M{x} {y-r} L{x+r*0.28} {y-r*0.28} L{x+r} {y} L{x+r*0.28} {y+r*0.28} L{x} {y+r} L{x-r*0.28} {y+r*0.28} L{x-r} {y} L{x-r*0.28} {y-r*0.28}Z' fill='{col}'></path>"
        rg+=(f"<circle cx='50' cy='50' r='49' fill='none' stroke='{gc}' stroke-width='7' opacity='0.7' filter='url(#{i}bl)'></circle>"
             f"<circle cx='50' cy='50' r='48' fill='none' stroke='url(#{i}r)' stroke-width='4.5'></circle>"
             f"<circle cx='50' cy='50' r='45.5' fill='none' stroke='#FFFFFF' stroke-opacity='0.35' stroke-width='1'></circle>"
             + spark(84,16,7,'#FFFFFF') + spark(14,80,5,a) + spark(90,70,4,'#FFFFFF'))
    return f"<svg width='{px}' height='{px}' viewBox='{vb}' role='img' aria-label='{label or kind}' style='overflow: visible'><defs><clipPath id='{i}c'><circle cx='50' cy='50' r='48'></circle></clipPath>{dfs}</defs><circle cx='50' cy='50' r='48' fill='{bgfill}'></circle><g clip-path='url(#{i}c)'>{glow}{g}{over}</g>{rg}</svg>"
def gem_swatch(name,px=34,locked=False):
    i=_id(); _,d=paint('#000',name,i)
    lock=(f"<circle cx='50' cy='50' r='46' fill='#06080F' fill-opacity='0.55'></circle><rect x='40' y='48' width='20' height='16' rx='3' fill='none' stroke='#EEF2FF' stroke-width='4'></rect><path d='M44 48v-5a6 6 0 0 1 12 0v5' fill='none' stroke='#EEF2FF' stroke-width='4'></path>") if locked else "<path d='M30 32a26 26 0 0 1 22-10' stroke='#FFFFFF' stroke-opacity='0.6' stroke-width='5' stroke-linecap='round' fill='none'></path>"
    gc=GEMS[name][1]
    halo='' if locked else f"<circle cx='50' cy='50' r='49' fill='none' stroke='{gc}' stroke-opacity='0.35' stroke-width='6'></circle><circle cx='50' cy='50' r='44' fill='none' stroke='{gc}' stroke-opacity='0.5' stroke-width='2' filter='url(#{i}f)'></circle>"
    flt=f"<filter id='{i}f' x='-30%' y='-30%' width='160%' height='160%'><feGaussianBlur stdDeviation='3'></feGaussianBlur></filter>"
    return f"<svg width='{px}' height='{px}' viewBox='-6 -6 112 112' role='img' aria-label='{name}{', locked' if locked else ''}' style='overflow: visible'><defs>{d}{flt}</defs>{halo}<circle cx='50' cy='50' r='42' fill='url(#{i}g)' stroke='#06080F' stroke-width='4'></circle>{lock}</svg>"
