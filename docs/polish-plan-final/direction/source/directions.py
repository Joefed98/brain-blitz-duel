"""Four game art directions, mocked on REAL screenshots of today's games (the header, today's UI, is left untouched).
Each direction is a recipe of image operations on the game region below the 60 px header."""
import sys, numpy as np
from PIL import Image, ImageFilter
S='<scratch>/'
HEAD=126  # 2x px: today's 60 px header + the timer bar on its edge
def hexrgb(h): h=h.lstrip('#'); return np.array([int(h[i:i+2],16)/255 for i in (0,2,4)],dtype=np.float32)
def luma(a): return a[...,0]*0.2126+a[...,1]*0.7152+a[...,2]*0.0722
def chroma(a): return a.max(-1)-a.min(-1)
def grad(h,w,top,bot,power=1.0):
    t=(np.linspace(0,1,h,dtype=np.float32)**power)[:,None,None]
    return (hexrgb(top)[None,None,:]*(1-t)+hexrgb(bot)[None,None,:]*t)*np.ones((h,w,1),np.float32)
def lift(a,top,bot,strength=1.0,knee=0.30,p=1.3,power=1.0):
    """Screen the dark pixels with a colour gradient: black becomes the gradient, lights are kept."""
    h,w,_=a.shape; G=grad(h,w,top,bot,power)
    m=np.clip((knee-luma(a))/knee,0,1)**p
    return 1-(1-a)*(1-G*(m*strength)[...,None])
def vibrance(a,amt):
    l=luma(a)[...,None]; c=chroma(a)[...,None]
    return np.clip(l+(a-l)*(1+amt*(1-np.clip(c*1.6,0,1))),0,1)
def saturate(a,amt):
    l=luma(a)[...,None]; return np.clip(l+(a-l)*amt,0,1)
def gamma(a,g): return np.clip(a,0,1)**g
def bloom(a,thresh=0.55,radius=14,amt=0.7,sat_only=True):
    b=np.clip(a-thresh,0,1)/(1-thresh)
    if sat_only: b=b*np.clip(chroma(a)*2.2,0,1)[...,None]
    im=Image.fromarray((np.clip(b,0,1)*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))
    g=np.asarray(im,dtype=np.float32)/255
    return 1-(1-a)*(1-np.clip(g*amt,0,1))
def colorize_neutrals(a,tint,lo=0.35,hi=1.0,amt=0.8,cmax=0.14):
    """Grey metal (low chroma, mid to high light) takes a colour: chrome becomes coloured enamel."""
    l=luma(a); c=chroma(a)
    w=np.clip((cmax-c)/cmax*2,0,1)*np.clip((l-lo)/0.12,0,1)*np.clip((hi-l)/0.08,0,1)
    t=hexrgb(tint); tl=float(t[0]*0.2126+t[1]*0.7152+t[2]*0.0722)
    col=np.clip(t[None,None,:]*(l[...,None]/max(tl,1e-3))**0.9,0,1)
    return a+(col-a)*(w*amt)[...,None]
def invert_neutrals(a,box,cmax=0.20,warm=(1.0,0.975,0.925),floor=0.10):
    """Inside the board box, flip the lightness of near-neutral pixels: black tiles become ivory, white ink dark."""
    x0,y0,x1,y1=box; r=a[y0:y1,x0:x1].copy(); c=chroma(r)
    w=np.clip((cmax-c)/cmax*2.2,0,1)[...,None]
    inv=(1-r)*np.array(warm,np.float32)[None,None,:]
    inv=floor+inv*(1-floor)
    a=a.copy(); a[y0:y1,x0:x1]=r+(inv-r)*w
    return a
def invert_keep_hue(a,box):
    """Inside the box flip lightness for every pixel, keeping hue and chroma: a dark board becomes a light one."""
    x0,y0,x1,y1=box; r=a[y0:y1,x0:x1]
    a=a.copy(); a[y0:y1,x0:x1]=r+(1-r.max(-1)-r.min(-1))[...,None]
    return a
def soft_edge_box(a,b,box,feather=10):
    """Blend b into a inside box with a feathered edge."""
    h,w,_=a.shape; x0,y0,x1,y1=box
    m=np.zeros((h,w),np.float32); m[y0:y1,x0:x1]=1
    m=np.asarray(Image.fromarray((m*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(feather)),dtype=np.float32)/255
    return a+(b-a)*m[...,None]
def toplight(a,amt=0.10):
    h,w,_=a.shape; t=np.linspace(1,0,h,dtype=np.float32)[:,None,None]**2
    return np.clip(a+amt*t*(1-a),0,1)
def scan_grid(a,color,step=56,alpha=0.10,knee=0.12):
    """A faint neon floor grid, drawn only where the picture is near-black."""
    h,w,_=a.shape; g=np.zeros((h,w),np.float32); g[::step,:]=1; g[:,::step]=1
    g=np.asarray(Image.fromarray((g*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)),dtype=np.float32)/255
    m=np.clip((knee-luma(a))/knee,0,1)
    return np.clip(a+hexrgb(color)[None,None,:]*(g*m*alpha*4)[...,None],0,1)

GAMES={  # id: (name, category colour, deep stage top/bottom, duotone top/bottom, board box at 2x or None, ui boxes kept as today)
 'wordhunt':('Forage','#4D8CFF','#1B3A9C','#0B163F','#3F6BFF','#7A2BD6',(14,676,766,1448),[(16,1508,764,1626)]),
 'sudoku':('Box Six','#2ED3B7','#0E6E66','#07282E','#12B8A6','#2456D8',(22,646,758,1384),[]),
 'pipes':('Pipeline','#B26BFF','#4A2A9E','#170C3D','#9B4DFF','#E0409A',(12,812,768,1572),[]),
 'matchup':('Gemstone','#8E80FF','#3B2FA8','#140F45','#5B4BFF','#C83CC0',(12,318,768,1380),[]),
 'breaker':('Breaker','#36E2F5','#0F4F8C','#060B2E','#1466C8','#5A1FA8',None,[]),
 'freekick':('Top Bins','#4CC24A','#1E7A2A','#0A2A14','#3BB14A','#145A22',None,[]),
 'tripeaks':('Summit','#FF5C93','#8E2456','#2A0C22','#D43C8C','#5B2BD0',None,[]),
}
def load(g):
    im=Image.open(S+f'shots/games/{g}-390x844-play-now.png').convert('RGB')
    return np.asarray(im,dtype=np.float32)/255
def finish(orig,a,g=None):
    out=a.copy(); out[:HEAD]=orig[:HEAD]
    for (x0,y0,x1,y1) in (GAMES[g][7] if g else []): out[y0:y1,x0:x1]=orig[y0:y1,x0:x1]
    return Image.fromarray((np.clip(out,0,1)*255).astype(np.uint8))

def floodlit(g,a):
    n,cat,dt,db,bt,bb,box,ui=GAMES[g]
    o=colorize_neutrals(a,'#D9C2FF',lo=0.40,amt=0.75) if g=='pipes' else a
    o=lift(o,dt,db,strength=0.95,knee=0.26,p=1.2)
    o=vibrance(o,0.5); o=toplight(o,0.07); return gamma(o,0.93)
def neon(g,a):
    n,cat,dt,db,bt,bb,box,ui=GAMES[g]
    o=colorize_neutrals(a,cat,lo=0.42,amt=0.85) if g in('pipes',) else a
    o=saturate(o,1.5); o=scan_grid(o,cat,alpha=0.07)
    o=bloom(o,thresh=0.42,radius=18,amt=0.95); o=bloom(o,thresh=0.6,radius=5,amt=0.5)
    return o
def colourfield(g,a):
    n,cat,dt,db,bt,bb,box,ui=GAMES[g]
    k=0.55 if g=='breaker' else 0.92
    o=lift(a,bt,bb,strength=k,knee=0.34,p=0.9,power=0.9)
    if box is not None:
        inner=lift(a,bt,bb,strength=0.42,knee=0.30,p=1.2,power=0.9)
        o=soft_edge_box(o,inner,box,feather=8)
    o=vibrance(o,0.65); o=toplight(o,0.08); return gamma(o,0.93)
def spotlight(g,a):
    n,cat,dt,db,bt,bb,box,ui=GAMES[g]
    if box is None: return floodlit(g,a)
    o=lift(a,dt,db,strength=0.9,knee=0.26,p=1.2)
    if box is not None:
        if g=='sudoku': b=invert_keep_hue(o,box)
        elif g=='matchup': b=invert_neutrals(o,box,warm=(0.95,0.94,1.0))
        else: b=invert_neutrals(o,box)
        if g=='pipes': b=colorize_neutrals(b,cat,lo=0.0,hi=0.55,amt=0.9,cmax=0.16)
        o=soft_edge_box(o,b,box,feather=6)
    elif g=='tripeaks':
        o=lift(a,'#2F6BE0','#16337E',strength=0.9,knee=0.30,p=1.0); o=gamma(o,0.92)
    else:
        o=gamma(o,0.88)
    return vibrance(o,0.5)
DIRS={'floodlit':floodlit,'neon':neon,'colourfield':colourfield,'spotlight':spotlight}
if __name__=='__main__':
    games=sys.argv[1:] or list(GAMES)
    for g in games:
        a=load(g)
        for d,f in DIRS.items():
            finish(a,f(g,a),g).save(S+f'dir/{g}-{d}.png')
        Image.fromarray((a*255).astype(np.uint8)).save(S+f'dir/{g}-now.png')
        print('ok',g)
