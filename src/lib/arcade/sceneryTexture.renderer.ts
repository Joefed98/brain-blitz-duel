/** Fixed, cached decoration; no randomness, clocks, hit targets or sim state. */
import { artCanvas, artContext, type ArtCanvas } from './cache.renderer';
const textures = new Map<string, ArtCanvas>();
export function sceneryTexture(c: CanvasRenderingContext2D, kind: 'rainbow' | 'clay'): void {
  let image = textures.get(kind);
  const w = kind === 'rainbow' ? 390 : 360, h = kind === 'rainbow' ? 620 : 400;
  if (!image) {
    const surface = artCanvas(w * 2, h * 2), ctx = surface ? artContext(surface) : null;
    if (surface && ctx) {
      ctx.scale(2, 2);
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, kind === 'rainbow' ? '#6FBFEA' : '#1D3B5C');
      sky.addColorStop(1, kind === 'rainbow' ? '#C5E8F6' : '#6F9BC0');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.13)';ctx.lineWidth = 4;ctx.lineCap = 'round';
      for (let i=0;i<7;i++) { const x=18+(i*73)%(w-90), y=52+(i*61)%240;ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+18,y-5,x+50,y+4,x+76,y-2);ctx.stroke(); }
      if (kind === 'clay') {
        const grass=ctx.createLinearGradient(0,h-42,0,h);grass.addColorStop(0,'#416236');grass.addColorStop(1,'#253F25');ctx.fillStyle=grass;ctx.fillRect(0,h-42,w,42);
        ctx.lineWidth=0.8;for(let i=0;i<140;i++){const x=(i*43)%w,y=h-2-(i*13)%35;ctx.strokeStyle=i%2?'rgba(152,181,109,0.24)':'rgba(13,40,25,0.3)';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-2,y-5);ctx.moveTo(x,y);ctx.lineTo(x+2,y-3);ctx.stroke();}
      }
      image=surface;textures.set(kind,surface);
    }
  }
  if(image)c.drawImage(image,0,0,w,h);
}
/** Transparent tile clipped into the existing foreground hill. */
export function grassTexture(c:CanvasRenderingContext2D):void {
  let image=textures.get('grass');
  if(!image){const surface=artCanvas(780,1240),ctx=surface?artContext(surface):null;if(surface&&ctx){ctx.scale(2,2);ctx.lineWidth=0.8;for(let i=0;i<550;i++){const x=(i*47)%390,y=15+(i*31)%600;ctx.strokeStyle=i%2?'rgba(230,255,175,0.14)':'rgba(30,92,40,0.18)';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-2,y-5);ctx.moveTo(x,y);ctx.lineTo(x+2,y-3);ctx.stroke();}image=surface;textures.set('grass',surface);}}
  if(image)c.drawImage(image,0,0,390,620);
}