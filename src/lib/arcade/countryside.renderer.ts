/** Shared daylight countryside art. No simulation, input or replay state. */
import { artCanvas, artContext, type ArtCanvas } from './cache.renderer';

export const COUNTRY_SKY = '#89CEF2', COUNTRY_CLOUD = '#FFFFFF', COUNTRY_CLOUD_SHADE = '#E4F2F9';
export const COUNTRY_GRASS = '#65B94B', COUNTRY_GRASS_BACK = '#98D674', COUNTRY_GRASS_DARK = '#408B37';
export const COUNTRY_WOOD = '#B98B52', COUNTRY_WOOD_DARK = '#72502D', COUNTRY_WOOD_LIGHT = '#E1BB7F';
export const COUNTRY_STONE = '#909B99', COUNTRY_STONE_DARK = '#596763';
export const COUNTRY_GOLD = '#FFD54B', COUNTRY_GOLD_EDGE = '#986519', COUNTRY_SHINE = '#FFF8C9';
export const COUNTRY_APPLE = '#E93640', COUNTRY_APPLE_EDGE = '#AA202C';
const sprites = new Map<string, ArtCanvas>();

/** Lazy DPR-2 raster, shared by both games; fixed dimensions keep caches bounded. */
export function countryStamp(c: CanvasRenderingContext2D, key: string, w: number, h: number, x: number, y: number, paint: (c: CanvasRenderingContext2D) => void): void {
  const id = `${key}:${w}:${h}`;
  let image = sprites.get(id);
  if (!image) {
    const surface = artCanvas(w * 2, h * 2), native = surface ? artContext(surface) : null;
    if (surface && native) {
      const ctx = native as CanvasRenderingContext2D; ctx.scale(2, 2); paint(ctx);
      image = surface; sprites.set(id, surface);
    }
  }
  if (image) c.drawImage(image, x, y, w, h);
  else { c.save(); c.translate(x, y); paint(c); c.restore(); }
}

/** These paths and colours are the original Ink Bridge background, verbatim. */
export function countryCloud(c: CanvasRenderingContext2D): void {
  c.fillStyle = COUNTRY_CLOUD_SHADE; c.beginPath(); c.roundRect(0, 10, 48, 16, 8); c.fill();
  c.fillStyle = COUNTRY_CLOUD;
  for (const [x,y,r] of [[12,13,10],[26,11,11],[38,16,9]] as const) { c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill(); }
}
export function countryBackdrop(c: CanvasRenderingContext2D): void {
  c.fillStyle = COUNTRY_SKY; c.fillRect(0,0,390,620);
  c.fillStyle = COUNTRY_GRASS_BACK; c.beginPath(); c.moveTo(0,610); c.quadraticCurveTo(100,582,230,610); c.quadraticCurveTo(330,588,390,605); c.lineTo(390,620); c.lineTo(0,620); c.fill();
  c.fillStyle = COUNTRY_GRASS; c.beginPath(); c.moveTo(0,616); c.quadraticCurveTo(210,590,390,614); c.lineTo(390,620); c.lineTo(0,620); c.fill();
  c.fillStyle = COUNTRY_GRASS_DARK; c.fillRect(0,618,390,2);
}
export function countryClock(): number {
  if(typeof window==='undefined'||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return 0;
  return performance.now()/1000;
}
/** Supporting foreground hill; its flat crest meets the unmoved pot's base. */
export function drawCountryGround(c: CanvasRenderingContext2D, base: number, x: number): void {
  c.fillStyle = COUNTRY_GRASS;
  c.beginPath(); c.moveTo(0,base+12);
  c.quadraticCurveTo(Math.max(0,x-80),base+12,x-32,base);
  c.lineTo(x+32,base);
  c.quadraticCurveTo(Math.min(390,x+80),base+12,390,base+12);
  c.lineTo(390,620);c.lineTo(0,620);c.closePath();c.fill();
}
/** In a 390×620 reference frame; camera parallax is opt-in, Ink Bridge is unchanged. */
export function drawCountryside(c: CanvasRenderingContext2D, camera = 0): void {
  countryStamp(c,'background',390,620,0,0,countryBackdrop);
  const t=countryClock();
  for(const [x,y,f] of [[38,100,0.55],[278,146,0.7],[152,218,0.4]] as const) {
    c.save();c.globalAlpha=0.68;c.translate(x+Math.sin(t*0.08+y)*5-camera*0.08,y);c.scale(f,f);
    countryStamp(c,'cloud',48,26,0,0,countryCloud);c.restore();
  }
}