import random
def _stars(seed,n=36,col='#FFFFFF'):
    random.seed(seed); return "".join(f"<circle cx='{random.randint(2,98)}' cy='{random.randint(2,98)}' r='{random.choice((0.7,1,1.4))}' fill='{col}'></circle>" for _ in range(n))
def scene(kind):
    R=lambda c: f"<rect width='100' height='100' fill='{c}'></rect>"
    if kind=='helmet':
        return R('#121A3A')+"".join(f"<path d='M{x} -10 l-30 120' stroke='{c}' stroke-width='6' opacity='0.8'></path>" for x,c in ((20,'#22E4FF'),(46,'#E2C07A'),(72,'#22E4FF'),(98,'#E2C07A')))+"<path d='M60 10 44 40h10l-6 24 20-34H58z' fill='#FFE600'></path>"
    if kind=='brilliant':
        cols=['#FF3B5C','#22E4FF','#3DDC84','#FFE600','#B26BFF','#FF8A3D']; random.seed(7)
        return R('#1B1440')+"".join(f"<rect x='{x*20+2}' y='{y*20+2}' width='16' height='16' rx='4' fill='{random.choice(cols)}'></rect>" for x in range(5) for y in range(5))
    if kind=='hover':
        return (R('#2A0F4A')+"<rect width='100' height='55' fill='#5A1E7A'></rect><circle cx='50' cy='52' r='22' fill='#FF6BD6'></circle>"
                "<rect y='55' width='100' height='45' fill='#1A0830'></rect>"+"".join(f"<path d='M50 55 L{x} 100' stroke='#FF6BD6' stroke-width='1.5'></path>" for x in range(-40,141,20))
                +"".join(f"<path d='M0 {y}h100' stroke='#FF6BD6' stroke-width='1.5'></path>" for y in (60,67,77,92)))
    if kind=='pinball':
        return (R('#2A1450')+"<circle cx='26' cy='26' r='9' fill='#FF6BD6'></circle><circle cx='74' cy='22' r='8' fill='#22E4FF'></circle><circle cx='50' cy='14' r='6' fill='#FFE600'></circle>"
                "<path d='M10 78 34 92M90 78 66 92' stroke='#E2C07A' stroke-width='7' stroke-linecap='round'></path><path d='M8 0v100M92 0v100' stroke='#B26BFF' stroke-width='3'></path><path d='M20 50l6-6 6 6M68 50l6-6 6 6' fill='none' stroke='#22E4FF' stroke-width='2.5'></path>")
    if kind=='golf':
        return (R('#7FD3FF')+"<rect y='45' width='100' height='55' fill='#2EB36B'></rect><path d='M0 45c20-8 40 6 60 0s30-6 40-2v10H0z' fill='#3DDC84'></path>"
                "<rect x='12' y='22' width='14' height='26' fill='#E5243F'></rect><path d='M10 22l9-8 9 8z' fill='#FFE07A'></path><path d='M19 30l-10-10M19 30l10-10M19 30l-10 10M19 30l10 10' stroke='#FFFFFF' stroke-width='2.5'></path>"
                "<rect x='60' y='70' width='30' height='6' fill='#9A6A3E'></rect>")
    if kind=='tank':
        return (R('#C7A46B')+"<rect width='100' height='42' fill='#8FB9D6'></rect><path d='M0 42c15-5 30 4 50 0s35-4 50 1v6H0z' fill='#B8935A'></path>"
                +"".join(f"<ellipse cx='{x}' cy='78' rx='8' ry='5' fill='#7A6440' stroke='#5A4A2E' stroke-width='1.5'></ellipse>" for x in (10,26,42,58,74,90))
                +"".join(f"<ellipse cx='{x}' cy='70' rx='8' ry='5' fill='#8A7448' stroke='#5A4A2E' stroke-width='1.5'></ellipse>" for x in (18,34,50,66,82)))
    if kind=='fighter':
        return R('#0C0B2A')+"<circle cx='30' cy='30' r='30' fill='#5B2A99' opacity='0.6'></circle><circle cx='78' cy='70' r='26' fill='#14307E' opacity='0.7'></circle>"+_stars(11)+"".join(f"<path d='M{x} 14l5 6h-10z' fill='#FF3B5C'></path>" for x in (20,40,60,80))
    if kind=='bricks':
        cols=['#FF3B5C','#FF8A3D','#FFE600','#3DDC84','#22E4FF']
        return R('#101634')+"".join(f"<rect x='{(x*20)-(10 if y%2 else 0)+1}' y='{y*11+2}' width='18' height='9' rx='1.5' fill='{cols[y%5]}'></rect>" for y in range(9) for x in range(6))
    if kind=='atom':
        random.seed(3); dots="".join(f"<circle cx='{random.randint(4,96)}' cy='{random.randint(4,96)}' r='{random.choice((1.5,2.5,3.5))}' fill='{random.choice(('#22E4FF','#FF6BD6','#FFE600'))}'></circle>" for _ in range(22))
        return R('#06202A')+"".join(f"<path d='M{x} 0v100' stroke='#1F5A6A' stroke-width='1'></path><path d='M0 {x}h100' stroke='#1F5A6A' stroke-width='1'></path>" for x in range(10,100,15))+dots
    if kind=='note':
        return (R('#160A2E')+"<path d='M30 100 46 0M70 100 54 0' stroke='#B26BFF' stroke-width='2'></path><path d='M10 100 40 0M90 100 60 0' stroke='#B26BFF' stroke-width='1.5' opacity='0.6'></path>"
                +"".join(f"<rect x='{x}' y='{y}' width='10' height='5' rx='2' fill='{c}'></rect>" for x,y,c in ((34,30,'#22E4FF'),(56,48,'#FF6BD6'),(24,66,'#FFE600'),(66,80,'#3DDC84')))
                +"<path d='M0 0 30 40 0 40z' fill='#FFE07A' opacity='0.25'></path><path d='M100 0 70 40 100 40z' fill='#FFE07A' opacity='0.25'></path>")
    if kind=='nucleus':
        random.seed(5); L="ABCDEFGHIKLMNOPRSTUW"
        return R('#2A2140')+"".join(f"<rect x='{x*20+2}' y='{y*20+2}' width='16' height='16' rx='3' fill='#F3E1B4'></rect><text x='{x*20+10}' y='{y*20+15}' text-anchor='middle' font-family='Archivo, sans-serif' font-weight='900' font-size='10' fill='#2A2140'>{random.choice(L)}</text>" for x in range(5) for y in range(5))
    if kind=='bulb':
        random.seed(9)
        return R('#05070F')+"".join(f"<circle cx='{x*20+10}' cy='{y*20+10}' r='6' fill='{'#FFE600' if random.random()<0.4 else '#2A3044'}'></circle>" for x in range(5) for y in range(5))
    if kind=='hanoi':
        return R('#6B4626')+"".join(f"<path d='M0 {y}h100' stroke='#8A5A30' stroke-width='3'></path>" for y in range(8,100,14))+"".join(f"<rect x='{x}' y='20' width='5' height='70' fill='#E2C07A'></rect>" for x in (18,48,78))+"<rect x='4' y='88' width='92' height='6' fill='#3A2412'></rect>"
    if kind=='flask':
        return (R('#2A2238')+"".join(f"<path d='M0 {y}h100' stroke='#3A3150' stroke-width='2'></path>" for y in range(10,100,12))
                +"<rect x='4' y='60' width='92' height='4' fill='#6B4626'></rect>"
                +"".join(f"<path d='M{x} 58v-10l-4-8h12l-4 8v10z' fill='{c}'></path>" for x,c in ((12,'#3DDC84'),(34,'#FF3B5C'),(66,'#22E4FF'),(88,'#FFE600'))))
    if kind=='safe':
        return R('#3A4458')+"".join(f"<rect x='{x}' y='{y}' width='30' height='30' fill='none' stroke='#5A6680' stroke-width='2'></rect><circle cx='{x+4}' cy='{y+4}' r='1.5' fill='#8F9BBF'></circle><circle cx='{x+26}' cy='{y+26}' r='1.5' fill='#8F9BBF'></circle>" for x in (2,35,68) for y in (2,35,68))
    if kind=='puffer':
        return (R('#0E5A8A')+"<rect y='60' width='100' height='40' fill='#C9A46B'></rect>"
                "<path d='M10 100v-20c0-6 6-6 6 0v-10c0-6 6-6 6 0v30z' fill='#FF6BD6'></path><path d='M76 100v-28c0-6 7-6 7 0v8c0-5 6-5 6 0v20z' fill='#FF8A3D'></path>"
                "<path d='M40 100c-4-12 8-14 4-26' stroke='#3DDC84' stroke-width='4' fill='none'></path>"
                +"".join(f"<circle cx='{x}' cy='{y}' r='{r}' fill='none' stroke='#BFE9FF' stroke-width='1.5'></circle>" for x,y,r in ((20,20,3),(26,10,2),(80,28,3),(86,16,2))))
    if kind=='basketball':
        return ("<rect width='100' height='100' fill='#FFB27A'></rect><rect y='0' width='100' height='50' fill='#FF8FA3'></rect><circle cx='72' cy='38' r='12' fill='#FFE07A'></circle>"
                "<rect y='48' width='100' height='20' fill='#2A8FD6'></rect><path d='M0 56c10-3 20 3 30 0s20 3 30 0 20 3 30 0' stroke='#BFE9FF' stroke-width='2' fill='none'></path>"
                "<rect y='68' width='100' height='32' fill='#9A6A3E'></rect>" + "".join(f"<path d='M{x} 68v32' stroke='#6B4626' stroke-width='2'></path>" for x in range(6,100,12)))
    if kind=='dart':
        return (R('#3A2414')+"".join(f"<circle cx='50' cy='50' r='{r}' fill='{c}'></circle>" for r,c in ((46,'#141414'),(40,'#F3E1B4'),(34,'#E5243F'),(28,'#F3E1B4'),(22,'#2EB36B'),(10,'#E5243F'),(4,'#2EB36B')))
                +"".join(f"<path d='M50 50 L{50+46*__import__('math').cos(__import__('math').radians(a)):.1f} {50+46*__import__('math').sin(__import__('math').radians(a)):.1f}' stroke='#141414' stroke-width='1'></path>" for a in range(0,360,18)))
    if kind=='baseball':
        return (R('#0B1A3A')+"<rect y='40' width='100' height='60' fill='#2E8B3E'></rect>"+"".join(f"<path d='M0 {y}h100' stroke='#3DA34F' stroke-width='5'></path>" for y in (48,62,76,90))
                +"<path d='M50 96 20 70 50 46 80 70z' fill='#B8865A'></path><path d='M50 90 30 72 50 56 70 72z' fill='#2E8B3E'></path>"
                +"".join(f"<circle cx='{x}' cy='10' r='3' fill='#FFF6C2'></circle>" for x in (14,22,30,70,78,86)))
    if kind=='eightball':
        return (R('#5A3A1E')+"<rect x='8' y='8' width='84' height='84' rx='6' fill='#1E7A4A'></rect>"
                +"".join(f"<circle cx='{x}' cy='{y}' r='6' fill='#06080F'></circle>" for x,y in ((10,10),(90,10),(10,90),(90,90),(10,50),(90,50)))
                +"<circle cx='30' cy='60' r='4' fill='#F4F1E8'></circle><circle cx='66' cy='34' r='4' fill='#FFE600'></circle><circle cx='72' cy='40' r='4' fill='#E5243F'></circle>")
    if kind=='stack':
        return R('#0C1024')+"".join(f"<path d='M{x} 0v100' stroke='#1E2640' stroke-width='1'></path><path d='M0 {x}h100' stroke='#1E2640' stroke-width='1'></path>" for x in range(0,101,10))+"".join(f"<rect x='{x}' y='{y}' width='10' height='10' fill='{c}' opacity='0.8'></rect>" for x,y,c in ((0,90,'#3DDC84'),(10,90,'#3DDC84'),(70,90,'#FF8A3D'),(80,90,'#FF8A3D'),(90,90,'#FF8A3D'),(90,80,'#FF8A3D'),(0,80,'#22E4FF')))
    if kind=='astronaut':
        return R('#0B1033')+_stars(4,40)+"<circle cx='86' cy='88' r='34' fill='#3A5FD6'></circle><circle cx='86' cy='88' r='34' fill='none' stroke='#9FD0FF' stroke-width='2'></circle><path d='M0 30h100M0 62h100' stroke='#22E4FF' stroke-width='1.5' stroke-dasharray='6 6' opacity='0.8'></path>"
    if kind=='meteor':
        return R('#2A0F14')+_stars(8,24)+"<circle cx='20' cy='92' r='40' fill='#B5481E'></circle><circle cx='20' cy='92' r='40' fill='none' stroke='#FF8A3D' stroke-width='2'></circle>"+"".join(f"<circle cx='{x}' cy='{y}' r='{r}' fill='#6B4A3A'></circle>" for x,y,r in ((70,20,5),(84,40,3),(60,40,2.5)))
    if kind=='ninja':
        return (R('#0E1638')+_stars(6,20)+"<circle cx='70' cy='30' r='18' fill='#F3E1B4'></circle><circle cx='64' cy='26' r='3' fill='#D8C28A'></circle>"
                "<path d='M0 100V72h14v-8h12v14h14V60h16v18h12V66h14v12h18v22z' fill='#06080F'></path>")
    if kind=='curling':
        return R('#E6F2FA')+"".join(f"<circle cx='50' cy='50' r='{r}' fill='{c}'></circle>" for r,c in ((44,'#2F5FE0'),(32,'#E6F2FA'),(22,'#E5243F'),(10,'#E6F2FA')))+"<path d='M0 50h100M50 0v100' stroke='#9ADCF2' stroke-width='1.5'></path>"
    if kind=='topbins':
        return R('#2E8B3E')+"".join(f"<rect x='{x}' y='0' width='12.5' height='100' fill='#3DA34F'></rect>" for x in range(0,100,25))+"<path d='M0 76h100' stroke='#FFFFFF' stroke-width='2'></path><path d='M30 100a20 20 0 0 1 40 0' fill='none' stroke='#FFFFFF' stroke-width='2'></path>"
    if kind=='prism':
        return (R('#08081A')+"<path d='M0 20 40 50 0 80' fill='none' stroke='#FF3B5C' stroke-width='2' opacity='0.8'></path><path d='M100 10 60 50 100 90' fill='none' stroke='#22E4FF' stroke-width='2' opacity='0.8'></path>"
                +"".join(f"<rect x='{x}' y='{y}' width='10' height='3' fill='#B5C6DD' transform='rotate(45 {x+5} {y+1.5})'></rect>" for x,y in ((14,14),(76,76),(80,16),(12,80))))
    if kind=='key':
        random.seed(12)
        return R('#F4F1E8')+"".join(f"<rect x='{x*12.5}' y='{y*12.5}' width='12.5' height='12.5' fill='{'#141414' if random.random()<0.3 else '#F4F1E8'}' stroke='#8F9BBF' stroke-width='0.6'></rect>" for x in range(8) for y in range(8))
    if kind=='tower':
        random.seed(15)
        sky="<rect width='100' height='100' fill='#2A1450'></rect><rect y='50' width='100' height='50' fill='#FF8A3D' opacity='0.5'></rect>"
        bl="".join(f"<rect x='{x}' y='{100-h}' width='{w}' height='{h}' fill='#120A24'></rect>"+"".join(f"<rect x='{x+2+j*5}' y='{100-h+4+k*7}' width='2.5' height='3' fill='#FFE07A' opacity='{0.9 if random.random()<0.5 else 0.15}'></rect>" for j in range(int((w-2)/5)) for k in range(int((h-6)/7))) for x,w,h in ((0,16,40),(16,14,62),(30,18,48),(48,12,70),(60,18,52),(78,22,44)))
        return sky+bl
    if kind=='leprechaun':
        return (R('#7FD3FF')+"".join(f"<path d='M-10 70a60 60 0 0 1 120 0' fill='none' stroke='{c}' stroke-width='6' transform='translate(0 {i*6})'></path>" for i,c in enumerate(('#FF3B5C','#FF8A3D','#FFE600','#3DDC84','#22E4FF','#B26BFF')))
                +"<path d='M0 80c20-12 40 4 60-4s30-6 40 0v24H0z' fill='#2EB36B'></path><ellipse cx='20' cy='20' rx='12' ry='5' fill='#FFFFFF'></ellipse>")
    if kind=='orbit':
        return R('#080C24')+_stars(21,36)+"<circle cx='78' cy='76' r='20' fill='#D96B3A'></circle><ellipse cx='50' cy='50' rx='46' ry='18' fill='none' stroke='#E2C07A' stroke-width='1.5' stroke-dasharray='4 5' transform='rotate(-20 50 50)'></ellipse>"
    if kind=='car':
        return ("<rect width='100' height='100' fill='#2E7D3A'></rect><path d='M-10 70 L60 -10 L110 -10 L40 110 Z' fill='#3A3F4F'></path><path d='M25 50 60 6' stroke='#FFFFFF' stroke-width='3' stroke-dasharray='8 7'></path>"
                + "".join(f"<path d='M{-6+i*7} {66-i*8} l7 -8' stroke='{'#E5243F' if i%2 else '#FFFFFF'}' stroke-width='5'></path>" for i in range(10)))
    return R('#1E2640')
def with_scene(svg,kind):
    sc=f"<g opacity='0.42'>{scene(kind)}</g><rect width='100' height='100' fill='#06080F' opacity='0.35'></rect><circle cx='50' cy='52' r='38' fill='#06080F' opacity='0.25'></circle>"
    k=svg.index("<g clip-path="); j=svg.index(">",k)+1
    return svg[:j]+sc+svg[j:]
