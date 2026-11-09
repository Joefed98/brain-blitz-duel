import math
E='#06080F'
METALS={'Common':('#F6CFA8','#C98A5A','#7A4A26'),'Rare':('#FFFFFF','#C9D3E6','#6E7892'),
        'Epic':('#FFF1C2','#E2C07A','#8C6A22'),'Elite':('#4A4268','#1A1626','#07060D'),'Legendary':('#F2FDFF','#8FE3F5','#4E7BD6')}
_b=[0]
def _bid(): _b[0]+=1; return f"bd{_b[0]}"
def shape(group):
    if group=='comp': return "M60 6 104 20v34c0 30-18 50-44 60C34 104 16 84 16 54V20z"
    if group=='mastery':
        pts=[]
        for k in range(16):
            r=54 if k%2==0 else 46; a=math.radians(k*22.5-90); pts.append(f"{60+r*math.cos(a):.1f} {60+r*math.sin(a):.1f}")
        return "M"+" L".join(pts)+"Z"
    if group=='daily':
        pts=[]
        for k in range(48):
            r=54 if k%2==0 else 50.5; a=math.radians(k*7.5); pts.append(f"{60+r*math.cos(a):.1f} {60+r*math.sin(a):.1f}")
        return "M"+" L".join(pts)+"Z"
    if group=='chal':
        return "M"+" L".join(f"{60+54*math.cos(math.radians(60*k-90)):.1f} {60+54*math.sin(math.radians(60*k-90)):.1f}" for k in range(6))+"Z"
    if group=='fun': return "M60 6 Q66 6 72 12 L108 48 Q114 54 114 60 Q114 66 108 72 L72 108 Q66 114 60 114 Q54 114 48 108 L12 72 Q6 66 6 60 Q6 54 12 48 L48 12 Q54 6 60 6Z"
    if group=='social': return "M60 6 C90 6 110 26 110 56 C110 84 88 104 60 108 C32 104 10 84 10 56 C10 26 30 6 60 6Z"
def T(txt,size=26,col='#FFFFFF',y=None):
    y=y if y is not None else 60+size*0.36
    return f"<text x='60' y='{y:.0f}' text-anchor='middle' font-family='Archivo, sans-serif' font-weight='900' font-stretch='112%' font-size='{size}' fill='{col}'>{txt}</text>"
def ic(name,c):
    S=f"fill='none' stroke='{c}' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'"
    F=f"fill='{c}'"
    D={
    'check':f"<path d='M42 60l12 12 24-26' {S}></path>",
    'target':f"<circle cx='60' cy='60' r='20' {S}></circle><circle cx='60' cy='60' r='9' {S}></circle><circle cx='60' cy='60' r='2.5' {F}></circle>",
    'flame':f"<path d='M60 36c4 10 16 14 16 28a16 16 0 0 1-32 0c0-8 4-12 8-16 0 6 3 9 6 9-2-8-2-14 2-21z' {F}></path>",
    'flame2':f"<path d='M52 40c3 8 12 11 12 22a12 12 0 0 1-24 0c0-6 3-9 6-12 0 4 2 7 5 7-2-6-2-11 1-17z' {F}></path><path d='M70 40c3 8 12 11 12 22a12 12 0 0 1-24 0c0-6 3-9 6-12 0 4 2 7 5 7-2-6-2-11 1-17z' {F} opacity='0.8'></path>",
    'comeback':f"<path d='M40 74c0-18 14-30 32-28' {S}></path><path d='M64 38l10 8-8 10' {S}></path>",
    'sweep':T('5–0',24,c),
    'podium':f"<rect x='38' y='58' width='14' height='18' {F}></rect><rect x='53' y='46' width='14' height='30' {F}></rect><rect x='68' y='64' width='14' height='12' {F}></rect>",
    'sword':f"<path d='M48 74 76 46' {S}></path><path d='M70 40l10 10M44 66l10 10M42 80l6-6' {S}></path>",
    'storm':f"<path d='M42 56a10 10 0 0 1 4-19 14 14 0 0 1 27 2 9 9 0 0 1 2 17z' {F}></path><path d='M62 58 54 72h7l-3 10 10-15h-7z' fill='#FFE600' stroke='{E}' stroke-width='1.5'></path>",
    'bolt':f"<path d='M66 34 48 64h11l-4 22 19-31H62z' {F}></path>",
    'crown':f"<path d='M40 70 36 44l14 12 10-18 10 18 14-12-4 26z' {F}></path><rect x='40' y='72' width='40' height='6' rx='2' {F}></rect>",
    'star':f"<path d='M60 36l7 15 16 2-12 11 3 16-14-8-14 8 3-16-12-11 16-2z' {F}></path>",
    'stars':"".join(f"<path d='M{60+20*math.cos(math.radians(a))} {60+20*math.sin(math.radians(a))-6}l2.5 5 5.5.8-4 3.8 1 5.4-5-2.6-5 2.6 1-5.4-4-3.8 5.5-.8z' {F}></path>" for a in range(-90,270,72)),
    'bulb':f"<path d='M60 36a16 16 0 0 0-9 29v7h18v-7a16 16 0 0 0-9-29z' {F}></path><rect x='52' y='75' width='16' height='5' rx='2' {F}></rect>",
    'word':T('Aa',28,c),'number':T('123',22,c),
    'pattern':"".join(f"<circle cx='{x}' cy='{y}' r='4.5' {F}></circle>" for x in (46,60,74) for y in (46,60,74)),
    'shape':f"<path d='M44 74l12-22 12 22z' {F}></path><rect x='60' y='44' width='18' height='18' rx='2' {F} opacity='0.85'></rect>",
    'eye':f"<path d='M36 60c8-12 40-12 48 0-8 12-40 12-48 0z' {S}></path><circle cx='60' cy='60' r='6' {F}></circle>",
    'action':f"<path d='M64 34 44 62h12l-4 24 22-32H62z' {F}></path><path d='M36 50h6M34 60h6M36 70h6' {S}></path>",
    'retro':f"<path d='M44 48h4v-4h4v4h16v-4h4v4h4v8h4v12h-4v-4h-4v8h-8v-4h-12v4h-8v-8h-4v4h-4V56h4z' {F}></path><rect x='50' y='54' width='4' height='4' fill='{E}'></rect><rect x='66' y='54' width='4' height='4' fill='{E}'></rect>",
    'sports':f"<circle cx='60' cy='60' r='19' {S}></circle><path d='M41 60h38M60 41c-8 10-8 28 0 38M60 41c8 10 8 28 0 38' fill='none' stroke='{c}' stroke-width='3'></path>",
    'cards':f"<rect x='44' y='40' width='22' height='32' rx='3' {F} opacity='0.6' transform='rotate(-12 55 56)'></rect><rect x='52' y='44' width='24' height='34' rx='3' {F}></rect><path d='M64 52c-4 4-8 6-8 10a4 4 0 0 0 7 2l-2 4h6l-2-4a4 4 0 0 0 7-2c0-4-4-6-8-10z' fill='{E}'></path>",
    'strategy':f"<path d='M46 80h28v-6h-4l-2-18h4v-12h-6v6h-4v-6h-4v6h-4v-6h-6v12h4l-2 18h-4z' {F}></path>",
    'ticket':f"<path d='M38 48h44v8a4 4 0 0 0 0 8v8H38v-8a4 4 0 0 0 0-8z' {F}></path><path d='M64 50v20' stroke='{E}' stroke-width='2' stroke-dasharray='3 3'></path>",
    'trophy':f"<path d='M48 40h24v10a12 12 0 0 1-24 0z' {F}></path><path d='M48 44h-6v4a6 6 0 0 0 6 6M72 44h6v4a6 6 0 0 1-6 6' {S}></path><rect x='57' y='62' width='6' height='8' {F}></rect><rect x='48' y='70' width='24' height='6' rx='2' {F}></rect>",
    'stopwatch':f"<circle cx='60' cy='62' r='18' {S}></circle><path d='M60 62V52M55 38h10M60 38v6' {S}></path>",
    'bracket':f"<path d='M38 42h12v12h-12M38 66h12v12H38M50 48h8v24h-8M58 60h20' {S}></path>",
    'grid':"".join(f"<rect x='{x}' y='{y}' width='10' height='10' rx='2' {F}></rect>" for x in (42,55,68) for y in (42,55,68)),
    'gridcheck':"".join(f"<rect x='{x}' y='{y}' width='10' height='10' rx='2' {F} opacity='0.45'></rect>" for x in (42,55,68) for y in (42,55,68))+f"<path d='M44 60l10 10 22-22' fill='none' stroke='{c}' stroke-width='6' stroke-linecap='round' stroke-linejoin='round'></path>",
    'swap':f"<path d='M40 50h36l-8-8M80 70H44l8 8' {S}></path>",
    'flag':f"<path d='M46 80V40' {S}></path><path d='M46 40h30l-6 9 6 9H46z' {F}></path><rect x='54' y='42' width='5' height='5' fill='{E}'></rect><rect x='64' y='42' width='5' height='5' fill='{E}'></rect><rect x='59' y='47' width='5' height='5' fill='{E}'></rect><rect x='54' y='52' width='5' height='5' fill='{E}'></rect><rect x='64' y='52' width='5' height='5' fill='{E}'></rect>",
    'buzzer':f"<circle cx='60' cy='62' r='18' {S}></circle><path d='M60 62l9-9' {S}></path><path d='M55 38h10' {S}></path>"+T('0.9',11,c,y=78),
    'speed':f"<path d='M58 34 42 62h10l-3 22 19-30H58z' {F}></path><path d='M70 46h12M72 56h12M70 66h10' {S}></path>",
    'friends':f"<circle cx='50' cy='50' r='8' {F}></circle><circle cx='72' cy='52' r='7' {F} opacity='0.8'></circle><path d='M36 78c0-10 6-16 14-16s14 6 14 16z' {F}></path><path d='M62 78c1-8 5-13 10-13s10 5 10 13z' {F} opacity='0.8'></path>",
    'party':f"<path d='M40 80l12-34 22 22z' {F}></path><path d='M60 44l4-8M70 50l8-4M66 40l2-2' {S}></path><circle cx='78' cy='38' r='3' {F}></circle>",
    'gem':f"<path d='M44 52l8-12h16l8 12-16 26z' {F}></path><path d='M44 52h32M52 40l4 12 4 26 4-26 4-12' fill='none' stroke='{E}' stroke-width='1.5' opacity='0.5'></path>",
    'founding':f"<path d='M64 32 46 62h11l-4 24 19-31H60z' {F}></path>",
    }
    return D[name]
def badge2(group,rarity,icon,px=96,num=None,label=''):
    i=_bid(); a,b,c=METALS[rarity]; p=shape(group)
    glow=''; spark=''
    if rarity=='Elite':
        glow=f"<path d='{p}' fill='none' stroke='#9B6BFF' stroke-width='6' opacity='0.45' filter='url(#{i}f)'></path>"
    if rarity=='Legendary':
        glow=f"<path d='{p}' fill='none' stroke='#9FD0FF' stroke-width='8' opacity='0.55' filter='url(#{i}f)'></path>"
        sp=lambda x,y,r: f"<path d='M{x} {y-r}L{x+r*0.3} {y-r*0.3}L{x+r} {y}L{x+r*0.3} {y+r*0.3}L{x} {y+r}L{x-r*0.3} {y+r*0.3}L{x-r} {y}L{x-r*0.3} {y-r*0.3}Z' fill='#FFFFFF'></path>"
        spark=sp(104,14,7)+sp(14,98,5)
    ink={'Common':'#3A2210','Rare':'#2A3248','Epic':'#3A2A08','Elite':'#B98CFF','Legendary':'#0E2A4A'}[rarity]
    icon_svg=ic(icon,ink) if icon else ''
    numtxt=T(num,30 if len(num)<=2 else 24,ink) if num else ''
    inner=(f"<linearGradient id='{i}n' x1='0' y1='1' x2='0.5' y2='0'><stop offset='0' stop-color='{a if rarity!='Elite' else '#2A2440'}'></stop><stop offset='0.6' stop-color='{b}'></stop><stop offset='1' stop-color='{c}'></stop></linearGradient>"
           f"<g transform='translate(60 60) scale(0.8) translate(-60 -60)'><path d='{p}' fill='url(#{i}n)' stroke='{c}' stroke-width='2.5'></path></g>")
    plate=''
    if rarity=='Legendary':
        import math as _m
        fac=''.join(f"<path d='M60 60 L{60+80*_m.cos(_m.radians(a)):.1f} {60+80*_m.sin(_m.radians(a)):.1f} L{60+80*_m.cos(_m.radians(a+30)):.1f} {60+80*_m.sin(_m.radians(a+30)):.1f}Z' fill='{('#FFFFFF' if k%3==0 else '#B98CFF' if k%3==1 else '#22E4FF')}' opacity='{0.28 if k%3==0 else 0.16}'></path>" for k,a in enumerate(range(0,360,30)))
        plate=(f"<clipPath id='{i}c'><path d='{p}'></path></clipPath>"
               f"<linearGradient id='{i}rb' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#22E4FF'></stop><stop offset='0.35' stop-color='#B98CFF'></stop><stop offset='0.65' stop-color='#FF8FD6'></stop><stop offset='1' stop-color='#9FE8FF'></stop></linearGradient>")
        plate_fx=f"<g clip-path='url(#{i}c)'>{fac}</g><path d='{p}' fill='none' stroke='url(#{i}rb)' stroke-width='3.5'></path>"
    else: plate_fx=''
    return (f"<svg width='{px}' height='{px}' viewBox='-8 -8 136 136' role='img' aria-label='{label}' style='overflow: visible'><defs>"
            f"<linearGradient id='{i}m' x1='0' y1='0' x2='0.5' y2='1'><stop offset='0' stop-color='{a}'></stop><stop offset='0.5' stop-color='{b}'></stop><stop offset='1' stop-color='{c}'></stop></linearGradient>"
            f"<filter id='{i}f' x='-30%' y='-30%' width='160%' height='160%'><feGaussianBlur stdDeviation='4'></feGaussianBlur></filter>{plate}</defs>"
            f"{glow}<path d='{p}' fill='url(#{i}m)' stroke='{('#9B6BFF' if rarity=='Elite' else E)}' stroke-width='3' stroke-linejoin='round'></path>{inner}{plate_fx}"
            + (f"<path d='{p}' fill='none' stroke='#C7A6FF' stroke-opacity='0.5' stroke-width='1' transform='translate(60 60) scale(0.8) translate(-60 -60)'></path><path d='M26 58 L66 18' fill='none' stroke='#C7A6FF' stroke-opacity='0.22' stroke-width='12' stroke-linecap='round'></path>" if rarity=='Elite' else '')
            + f"<path d='M30 30 L52 18' stroke='#FFFFFF' stroke-width='5' stroke-linecap='round' opacity='0.35'></path>"
            + f"{icon_svg if not num else numtxt}{spark}</svg>")
CAT=[
('comp','First Win','Common','check',None),('comp','Placed','Common','target',None),('comp','Hot Streak','Rare','flame',None),('comp','Comeback Kid','Rare','comeback',None),
('comp','Clean Sweep','Epic','sweep',None),('comp','Podium Regular','Epic','podium',None),('comp','Unstoppable','Elite','flame2',None),('comp','Giant Slayer','Elite','sword',None),
('comp','Storm Chaser','Elite','storm',None),('comp','Lightning Strikes','Legendary','bolt',None),('comp','Top 500','Legendary',None,'500'),
('mastery','First Star','Common','star',None),('mastery','Flawless','Rare',None,'200'),('mastery','All-Rounder','Rare','stars',None),('mastery','Logic Master','Epic','bulb',None),
('mastery','Word Master','Epic','word',None),('mastery','Number Master','Epic','number',None),('mastery','Pattern Master','Epic','pattern',None),('mastery','Speed Master','Epic','stopwatch',None),
('mastery','Attention Master','Epic','eye',None),('mastery','Action Master','Epic','action',None),('mastery','Retro Master','Epic','retro',None),('mastery','Sports Master','Epic','sports',None),
('mastery','Cards Master','Epic','cards',None),('mastery','Strategy Master','Epic','strategy',None),('mastery','Perfectionist','Elite',None,'25'),('mastery','Grand Master','Legendary','crown',None),
('daily','Daily Habit','Common',None,'7'),('daily','Dedicated','Rare',None,'30'),('daily','Daily Top 100','Rare','podium',None),('daily','Century','Elite',None,'100'),('daily','Daily Champion','Legendary','crown',None),
('daily','Entrant','Common','ticket',None),('daily','Trophy Hunter','Rare','trophy',None),('daily','Arena Ace','Epic','flame',None),('daily','Champion','Epic','trophy',None),
('daily','Arena Champion','Elite','sword',None),('daily','Score Attack Champion','Elite','stopwatch',None),('daily','Swiss Champion','Elite','grid',None),('daily','Knockout Champion','Legendary','bracket',None),('daily','Serial Winner','Legendary',None,'10'),
('chal','Challenger','Common',None,'10'),('chal','Challenge Seeker','Rare',None,'50'),('chal','Challenge Expert','Epic',None,'100'),('chal','Category Clear','Elite','gridcheck',None),('chal','Completionist','Legendary','check',None),
('fun','Revenge','Common','swap',None),('fun','Photo Finish','Rare','flag',None),('fun','Buzzer Beater','Rare','buzzer',None),('fun','Speed Demon','Epic','speed',None),
('social','Friendly','Common','friends',None),('social','Party Host','Rare','party',None),('social','Gem Hunter','Rare','gem',None),('social','Founding Player','Legendary','founding',None)]
