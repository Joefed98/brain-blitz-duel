import { successFrame, SUCCESS_ACCENTS } from "./success.renderer";
import { drawArtSprite } from "./sprites.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { snipFxFor } from "./arcadeFxGames.renderer";
/** Orchard Snip. Art only: original world, camera, rope nodes and collision geometry. */
import type { CanvasSize } from './engine';
import { snipCamera, snipGame, snipMouthAt, snipView, SNIP_CONFIG, SNIP_EATEN, SNIP_HOOK_REACH, SNIP_STUNG, SNIP_TALL_H, SNIP_W, snipWorldH, type SnipState, type SnipTemplate } from './snip';
import { artHash } from './art.renderer';
import { countryStamp, countryClock, countryCloud, COUNTRY_SKY, COUNTRY_GRASS_BACK, COUNTRY_GRASS, COUNTRY_GRASS_DARK, COUNTRY_WOOD, COUNTRY_WOOD_DARK, COUNTRY_WOOD_LIGHT, COUNTRY_STONE, COUNTRY_STONE_DARK, COUNTRY_GOLD, COUNTRY_GOLD_EDGE, COUNTRY_SHINE, COUNTRY_APPLE, COUNTRY_APPLE_EDGE } from './countryside.renderer';

export interface SnipSwipe { a: number; b: number; c: number; d: number; at: number }
function circle(c:CanvasRenderingContext2D,x:number,y:number,r:number):void { c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill(); }
/**
 * Full 24px circular silhouette; stalk and leaf are inside the collision disc. Polish A4 (25 Oct 2026,
 * display only): a shiny apple, lit from the upper left, with a curved stalk, a veined leaf and a glint.
 */
export function apple(c:CanvasRenderingContext2D):void {
  c.fillStyle=COUNTRY_APPLE_EDGE;circle(c,12,12,12);
  const body=c.createRadialGradient(8.5,9,1,12,13,11.5);
  body.addColorStop(0,'#FF7A72');body.addColorStop(0.45,COUNTRY_APPLE);body.addColorStop(1,'#A11A26');
  c.fillStyle=body;circle(c,12,12,11);
  // The dimple where the stalk meets the apple, and a warm blush low on the right.
  c.fillStyle='rgba(110,16,24,0.45)';c.beginPath();c.ellipse(12,5,3.4,1.5,0,0,Math.PI*2);c.fill();
  c.fillStyle='rgba(255,170,60,0.22)';c.beginPath();c.ellipse(16.5,16,4,3,0.5,0,Math.PI*2);c.fill();
  c.strokeStyle=COUNTRY_WOOD_DARK;c.lineWidth=1.8;c.lineCap='round';c.beginPath();c.moveTo(12,5.2);c.quadraticCurveTo(11.4,2.6,13,0.9);c.stroke();
  c.fillStyle=COUNTRY_GRASS_DARK;c.beginPath();c.ellipse(16.3,3.6,4.2,1.9,-0.45,0,Math.PI*2);c.fill();
  c.fillStyle=COUNTRY_GRASS;c.beginPath();c.ellipse(16.1,3.3,3.2,1.1,-0.45,0,Math.PI*2);c.fill();
  c.strokeStyle=COUNTRY_GRASS_DARK;c.lineWidth=0.5;c.beginPath();c.moveTo(13,4.9);c.lineTo(19.5,2.2);c.stroke();
  c.fillStyle=COUNTRY_SHINE;c.beginPath();c.ellipse(6.5,10,1.4,3.4,0.35,0,Math.PI*2);c.fill();
  c.fillStyle='rgba(255,255,255,0.9)';circle(c,7.6,6.8,1.1);
}
/**
 * Wicker basket fills the exact circular mouth; opening spans all 64px. Polish A4: an over-and-under
 * weave on its staves, shaded round the sides, a thick rolled rim and the dark inside of the basket.
 */
export function basket(c:CanvasRenderingContext2D):void {
  c.save();c.beginPath();c.arc(32,32,32,0,Math.PI*2);c.clip();
  c.fillStyle=COUNTRY_WOOD_DARK;c.fillRect(0,0,64,64);
  c.fillStyle=COUNTRY_WOOD;c.fillRect(1,1,62,62);
  // The weave: rows of short strands, each row offset by half a strand, every strand with a lit top;
  // above the rim it is the basket's inside back wall, in shadow.
  for(let row=0,y=1;y<64;row++,y+=5){
    for(let x=(row%2)*4-4;x<64;x+=8){
      c.fillStyle=COUNTRY_WOOD_LIGHT;c.beginPath();c.roundRect(x+0.5,y,7,4,2);c.fill();
      c.fillStyle='rgba(255,240,200,0.45)';c.fillRect(x+1.5,y+0.6,5,1);
      c.fillStyle='rgba(80,50,20,0.35)';c.fillRect(x+1,y+3.2,6,0.8);
    }
  }
  // Upright staves between the strands.
  c.strokeStyle='rgba(95,62,30,0.55)';c.lineWidth=1;c.beginPath();for(let x=4;x<64;x+=8){c.moveTo(x,0);c.lineTo(x,64);}c.stroke();
  const back=c.createLinearGradient(0,0,0,32);back.addColorStop(0,'rgba(50,28,10,0.35)');back.addColorStop(1,'rgba(50,28,10,0.7)');
  c.fillStyle=back;c.fillRect(0,0,64,32);
  // Round shading: dark at the sides and bottom.
  const round=c.createRadialGradient(26,40,6,32,40,36);round.addColorStop(0,'rgba(0,0,0,0)');round.addColorStop(0.7,'rgba(40,22,8,0.15)');round.addColorStop(1,'rgba(40,22,8,0.55)');
  c.fillStyle=round;c.fillRect(0,32,64,32);
  // The opening: the dark inside, shadowed under the far rim.
  const inside=c.createLinearGradient(0,22,0,42);inside.addColorStop(0,'#3A2412');inside.addColorStop(1,'#5C3B1E');
  c.fillStyle=inside;c.beginPath();c.ellipse(32,32,32,10,0,0,Math.PI*2);c.fill();
  c.fillStyle='rgba(20,10,4,0.4)';c.beginPath();c.ellipse(32,29,28,6,0,0,Math.PI*2);c.fill();
  // The thick rolled rim, lit along its top.
  c.strokeStyle=COUNTRY_WOOD_DARK;c.lineWidth=4;c.beginPath();c.ellipse(32,32,30,9,0,0,Math.PI*2);c.stroke();
  c.strokeStyle=COUNTRY_WOOD_LIGHT;c.lineWidth=2.4;c.beginPath();c.ellipse(32,32,30,9,0,0,Math.PI*2);c.stroke();
  c.strokeStyle='rgba(255,244,214,0.7)';c.lineWidth=1;c.beginPath();c.ellipse(32,31.4,30,9,0,Math.PI*0.05,Math.PI*0.95);c.stroke();
  c.strokeStyle='rgba(95,62,30,0.6)';c.lineWidth=0.8;c.setLineDash([2,3]);c.beginPath();c.ellipse(32,32,30,9,0,0,Math.PI*2);c.stroke();c.setLineDash([]);
  c.restore();
}
/** Golden leaf's tips reach the exact 24px pickup radius; no extra halo. */
function leaf(c:CanvasRenderingContext2D):void {
  c.save();c.translate(24,24);c.rotate(-0.55);
  c.fillStyle=COUNTRY_GOLD_EDGE;c.beginPath();c.moveTo(0,-24);c.bezierCurveTo(30,-14,30,14,0,24);c.bezierCurveTo(-30,14,-30,-14,0,-24);c.fill();
  c.fillStyle=COUNTRY_GOLD;c.beginPath();c.moveTo(0,-22);c.bezierCurveTo(27,-13,27,13,0,22);c.bezierCurveTo(-27,13,-27,-13,0,-22);c.fill();
  c.strokeStyle=COUNTRY_GOLD_EDGE;c.lineWidth=1.3;c.beginPath();c.moveTo(0,-21);c.lineTo(0,23);
  for(const y of [-12,-3,6,15]){c.moveTo(0,y);c.lineTo(12,y-6);c.moveTo(0,y);c.lineTo(-12,y-6);}c.stroke();c.restore();
}
function rail(c:CanvasRenderingContext2D,w:number,h:number):void {
  // The solid full AABB remains visible, including corners; no inset obstacle.
  c.fillStyle=COUNTRY_WOOD_DARK;c.fillRect(0,0,w,h);
  c.fillStyle=COUNTRY_WOOD;c.fillRect(1,1,w-2,h-2);
  c.fillStyle=COUNTRY_WOOD_LIGHT;c.fillRect(1,2,w-2,2);
  c.fillStyle=COUNTRY_WOOD_DARK;for(let x=12;x<w-6;x+=32)c.fillRect(x,h/2,2,2);
}
/** Stone side wall, stamped once at the tallest height and clipped to each world's. */
function wall(c:CanvasRenderingContext2D):void {
  c.fillStyle=COUNTRY_STONE_DARK;c.fillRect(0,0,3,SNIP_TALL_H);
  c.fillStyle=COUNTRY_STONE;for(let y=1;y<SNIP_TALL_H;y+=14)c.fillRect(0,y,3,12);
}
/**
 * The hedge along the top: a soil strip with a scalloped edge, the hedge's leafy clumps hanging from it
 * in four greens, and a few lit leaves. Polish A4; the entire canopy still lives at y 0..28.
 */
function canopy(c:CanvasRenderingContext2D):void {
  // Soil strip with a scalloped lower edge and a few stones.
  c.fillStyle='#5B3A1E';c.fillRect(0,0,SNIP_W,8);
  c.beginPath();for(let x=0;x<=SNIP_W;x+=12){c.moveTo(x+12,8);c.arc(x+6,8,6,0,Math.PI);}c.fill();
  for(let k=0;k<SNIP_W/6;k++){const h=artHash(k,523);c.fillStyle=h%3?'rgba(30,16,6,0.35)':'rgba(190,150,110,0.35)';c.fillRect(h%SNIP_W,(h>>>9)%10,1.5,1.2);}
  // The hedge: clumps of leaves hanging from the soil, darkest at the back.
  for(const [tone,dy,r] of [[COUNTRY_GRASS_DARK,12,13],['#4FA341',14,10],[COUNTRY_GRASS,15,8]] as const){
    c.fillStyle=tone;
    for(let x=-6;x<SNIP_W+20;x+=18){const h=artHash(x,dy);c.beginPath();c.arc(x+(h%6),dy+(h>>>5)%3,r-(h>>>8)%3,0,Math.PI*2);c.fill();}
  }
  // Individual leaves for texture, a few catching the light.
  for(let k=0;k<SNIP_W/4;k++){
    const h=artHash(k,907);const x=h%SNIP_W,y=6+(h>>>10)%19;
    c.fillStyle=h%5===0?'#A6DE7E':h%2?'#3E8A33':'#58AE45';
    c.beginPath();c.ellipse(x,y,2.6,1.3,((h>>>4)%7)*0.45,0,Math.PI*2);c.fill();
  }
  // A dark scalloped shadow line under the hedge, inside the band.
  c.fillStyle='rgba(30,70,24,0.35)';
  for(let x=0;x<SNIP_W;x+=18){c.beginPath();c.ellipse(x+9,26,8,2,0,0,Math.PI*2);c.fill();}
}
/** A twisted twine rope: a dark outline, the tan cord and slanted lit strands along its length (Polish A4). */
function twine(c:CanvasRenderingContext2D,points:readonly (readonly [number,number])[],alpha:number):void {
  const first=points[0];if(!first)return;
  c.save();c.globalAlpha=alpha;c.lineCap='round';c.lineJoin='round';
  c.beginPath();c.moveTo(first[0],first[1]);for(const [x,y] of points)c.lineTo(x,y);
  c.strokeStyle=COUNTRY_WOOD_DARK;c.lineWidth=3.8;c.stroke();
  c.strokeStyle='#C9A167';c.lineWidth=2.4;c.stroke();
  // The twist: a short slanted strand every 3 px along the rope, lit on one side, shaded on the other.
  c.lineWidth=0.9;
  let carry=0;
  for(let i=1;i<points.length;i++){
    const a=points[i-1]!,b=points[i]!;const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);if(len<0.01)continue;
    const ux=dx/len,uy=dy/len,nx=-uy,ny=ux;
    for(let d=carry;d<len;d+=3){
      const x=a[0]+ux*d,y=a[1]+uy*d;
      c.strokeStyle=COUNTRY_WOOD_LIGHT;c.beginPath();c.moveTo(x-nx*1.1-ux*1.1,y-ny*1.1-uy*1.1);c.lineTo(x+nx*1.1+ux*1.1,y+ny*1.1+uy*1.1);c.stroke();
      c.strokeStyle='rgba(90,60,30,0.6)';c.beginPath();c.moveTo(x-nx*1.1+ux*0.4,y-ny*1.1+uy*0.4);c.lineTo(x+nx*1.1+ux*2.6,y+ny*1.1+uy*2.6);c.stroke();
    }
    carry=((carry-len)%3+3)%3;
  }
  c.restore();
}
type Seg = readonly [number, number, number, number];
/** Unit "down" side normal of a segment (the side the surface body hangs on) and its length. */
function segFrame(s: Seg): { ux: number; uy: number; nx: number; ny: number; len: number } {
  const dx = s[2] - s[0], dy = s[3] - s[1];
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len, ny = dx / len;
  if (ny < 0) { nx = -nx; ny = -ny; }
  return { ux: dx / len, uy: dy / len, nx, ny, len };
}
/** snipRev 3 plank: its top face is the collision line; the board hangs below it. */
function plankArt(c: CanvasRenderingContext2D, s: Seg): void {
  const f = segFrame(s), t = 9;
  c.save();
  c.translate(s[0], s[1]);
  c.rotate(Math.atan2(f.uy, f.ux));
  const down = f.ny * Math.cos(Math.atan2(f.uy, f.ux)) - f.nx * Math.sin(Math.atan2(f.uy, f.ux)) >= 0 ? 1 : -1;
  c.fillStyle = COUNTRY_WOOD_DARK; c.fillRect(0, 0, f.len, t * down);
  c.fillStyle = COUNTRY_WOOD; c.fillRect(1, down, f.len - 2, (t - 2) * down);
  c.fillStyle = COUNTRY_WOOD_LIGHT; c.fillRect(1, down, f.len - 2, 2 * down);
  c.fillStyle = COUNTRY_WOOD_DARK; for (let x = 10; x < f.len - 6; x += 28) c.fillRect(x, 5 * down, 2, 2 * down);
  c.restore();
}
/** snipRev 3 gutter: a tin trough whose inner floor is the collision line, lips rising behind and in front. */
function gutterArt(c: CanvasRenderingContext2D, s: Seg): void {
  const f = segFrame(s);
  c.save();
  c.translate(s[0], s[1]);
  const a = Math.atan2(f.uy, f.ux);
  c.rotate(a);
  const down = f.ny * Math.cos(a) - f.nx * Math.sin(a) >= 0 ? 1 : -1;
  c.fillStyle = COUNTRY_STONE_DARK; c.fillRect(0, 0, f.len, 7 * down);
  c.fillStyle = COUNTRY_STONE; c.fillRect(0, down, f.len, 5 * down);
  // Rolled lips at both ends and along the back, behind the apple.
  c.fillStyle = COUNTRY_STONE_DARK; c.fillRect(-3, -9 * down, 3, 16 * down); c.fillRect(f.len, -9 * down, 3, 16 * down);
  c.globalAlpha = 0.55; c.fillStyle = COUNTRY_STONE; c.fillRect(0, -10 * down, f.len, 3 * down); c.globalAlpha = 1;
  c.restore();
}
/** snipRev 3 springy branch: a green-barked bough whose top is the collision line, with a coil under its middle. */
function springArt(c: CanvasRenderingContext2D, s: Seg, flex: number): void {
  const f = segFrame(s);
  c.save();
  c.translate(s[0], s[1]);
  const a = Math.atan2(f.uy, f.ux);
  c.rotate(a);
  const down = f.ny * Math.cos(a) - f.nx * Math.sin(a) >= 0 ? 1 : -1;
  const bend = flex * 4 * down;
  c.strokeStyle = COUNTRY_WOOD_DARK; c.lineWidth = 2;
  c.beginPath(); for (let k = 0; k <= 6; k++) { const x = f.len / 2 - 8 + (k % 2) * 16; c.lineTo(x, (6 + k * 2.5) * down); } c.stroke();
  c.fillStyle = COUNTRY_GRASS_DARK;
  c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(f.len / 2, bend, f.len, 0); c.lineTo(f.len, 6 * down); c.quadraticCurveTo(f.len / 2, 6 * down + bend, 0, 6 * down); c.closePath(); c.fill();
  c.fillStyle = COUNTRY_GRASS; c.fillRect(2, down, f.len - 4, 2 * down);
  c.fillStyle = COUNTRY_GRASS_DARK; for (const x of [6, f.len - 10]) { c.beginPath(); c.ellipse(x, 9 * down, 5, 3, 0.4, 0, Math.PI * 2); c.fill(); }
  c.restore();
}
/**
 * snipRev 3 wasp nest: a papery striped nest filling the collision disc, with wasps circling just outside it.
 * Polish A4: the hive is shaded round (lit upper left), its rings raised, and the bees have stripes and little wings.
 */
function nestArt(c: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, angry: boolean): void {
  c.save();
  const body = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  body.addColorStop(0, '#E2CFA4'); body.addColorStop(0.6, '#B7A27E'); body.addColorStop(1, '#7E6844');
  c.fillStyle = body; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.save(); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip();
  for (let k = -2; k <= 2; k++) {
    const ry = y + k * r * 0.32, rx = r * Math.sqrt(1 - (k * 0.32) ** 2) * 0.98;
    c.strokeStyle = 'rgba(70,52,28,0.7)'; c.lineWidth = 2.2; c.beginPath(); c.ellipse(x, ry + 0.8, rx, 2.2, 0, 0, Math.PI); c.stroke();
    c.strokeStyle = 'rgba(255,238,200,0.55)'; c.lineWidth = 1; c.beginPath(); c.ellipse(x, ry - 0.6, rx, 2.2, 0, Math.PI, Math.PI * 2); c.stroke();
  }
  c.restore();
  // The entrance: a dark hole with a lit lower lip.
  c.fillStyle = '#2A1E10'; c.beginPath(); c.arc(x, y + r * 0.55, r * 0.18, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(255,230,180,0.5)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y + r * 0.55, r * 0.2, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
  for (let k = 0; k < 3; k++) {
    const a = t * (angry ? 9 : 3.2) + k * 2.1, d = r + 5 + (k % 2) * 3;
    const wx = x + Math.cos(a) * d, wy = y + Math.sin(a) * d * 0.7;
    // Little wings, beating.
    const beat = 0.6 + 0.4 * Math.abs(Math.sin(t * 40 + k));
    c.fillStyle = 'rgba(235,248,255,0.8)';
    c.beginPath(); c.ellipse(wx - 1.2, wy - 2.2, 1.6, 2.4 * beat, -0.5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(wx + 1.2, wy - 2.2, 1.6, 2.4 * beat, 0.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#F5C518'; c.beginPath(); c.ellipse(wx, wy, 3.2, 2.2, a, 0, Math.PI * 2); c.fill();
    c.save(); c.translate(wx, wy); c.rotate(a);
    c.fillStyle = '#20170C'; c.fillRect(-0.9, -2, 1.1, 4); c.fillRect(1.1, -1.7, 0.9, 3.4); c.fillRect(2.6, -0.6, 0.7, 1.2);
    c.restore();
  }
  c.restore();
}
/**
 * Tuning E picker's crook: a wooden pole nailed to a branch stub with an open
 * iron hook curling up at its foot (the hook tip at the catch point), and a
 * bud of fresh vine coiled on it while unused. It catches only from above, so
 * the open mouth of the hook faces up. A dashed arc marks its catch width.
 * Once used, the hook hangs empty and the vine runs from it.
 */
function crookArt(c: CanvasRenderingContext2D, x: number, y: number, used: boolean, glow: number): void {
  c.save();
  // Branch stub and pole above the hook.
  c.strokeStyle = COUNTRY_WOOD_DARK; c.lineWidth = 5; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - 14, y - 40); c.lineTo(x, y - 34); c.stroke();
  c.strokeStyle = COUNTRY_WOOD; c.lineWidth = 3;
  c.beginPath(); c.moveTo(x, y - 34); c.lineTo(x, y - 6); c.stroke();
  // The iron hook: a J curling up, open at the top, its tip at (x + 8, y - 6).
  c.strokeStyle = '#3E4048'; c.lineWidth = 3;
  c.beginPath(); c.moveTo(x, y - 8); c.quadraticCurveTo(x, y + 3, x + 5, y + 2); c.quadraticCurveTo(x + 9, y, x + 8, y - 6); c.stroke();
  c.fillStyle = COUNTRY_GOLD_EDGE; c.beginPath(); c.arc(x, y - 34, 2, 0, Math.PI * 2); c.fill();
  if (!used) {
    // A coiled green vine waiting on the pole.
    c.strokeStyle = COUNTRY_GRASS_DARK; c.lineWidth = 2;
    c.beginPath(); for (let k = 0; k <= 12; k++) { const a = k * 1.05; c.lineTo(x + Math.cos(a) * 4, y - 28 + k * 1.6); } c.stroke();
    c.fillStyle = COUNTRY_GRASS; c.beginPath(); c.ellipse(x + 5, y - 30, 4, 2, -0.6, 0, Math.PI * 2); c.fill();
    // Catch width: a faint dashed bowl above the hook (it only snags a falling apple).
    c.globalAlpha = 0.35 + 0.4 * glow; c.strokeStyle = COUNTRY_SHINE; c.lineWidth = 1.5; c.setLineDash([3, 4]);
    c.beginPath(); c.arc(x, y - 4, SNIP_HOOK_REACH, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); c.setLineDash([]);
  }
  c.restore();
}
/** A crook's vine: green and leafy, so it reads apart from the twine ropes. */
function vine(c:CanvasRenderingContext2D,points:readonly (readonly [number,number])[],alpha:number):void {
  const first=points[0];if(!first)return;
  c.save();c.globalAlpha=alpha;c.lineCap='round';c.lineJoin='round';
  c.beginPath();c.moveTo(first[0],first[1]);for(const [x,y] of points)c.lineTo(x,y);
  c.strokeStyle=COUNTRY_GRASS_DARK;c.lineWidth=3.5;c.stroke();
  c.strokeStyle=COUNTRY_GRASS;c.lineWidth=1.4;c.stroke();
  c.fillStyle=COUNTRY_GRASS;
  for(let i=1;i<points.length-1;i+=2){const p=points[i]!,q=points[i+1]!;const a=Math.atan2(q[1]-p[1],q[0]-p[0]);c.beginPath();c.ellipse(p[0]+Math.cos(a+1.6)*3,p[1]+Math.sin(a+1.6)*3,3.2,1.6,a+0.6,0,Math.PI*2);c.fill();}
  c.restore();
}
function drawOrchardElements(c: CanvasRenderingContext2D, tpl: SnipTemplate, state: SnipState): void {
  const now = typeof performance === 'undefined' ? 0 : performance.now() / 1000;
  for (const s of tpl.planks ?? []) plankArt(c, s);
  for (const s of tpl.gutters ?? []) gutterArt(c, s);
  const flex = state.springTick !== undefined && state.tick - state.springTick < 12 ? Math.sin(((state.tick - state.springTick) / 12) * Math.PI) : 0;
  for (const s of tpl.springs ?? []) springArt(c, s, flex);
  const angry = state.lastOutcome === SNIP_STUNG && state.tick - state.endTick < 40;
  for (const [x, y, r] of tpl.nests ?? []) nestArt(c, x, y, r, now, false);
  const free = !state.ropes.some((rope) => rope.alive);
  (tpl.hooks ?? []).forEach(([x, y], k) => crookArt(c, x, y, Boolean((state.hooked ?? 0) & (1 << k)), free ? 1 : 0));
  if (angry) {
    const prev = SNIP_CONFIG.templates[state.order[Math.max(0, state.level - 1)] ?? state.template];
    if (prev && prev !== tpl) for (const [x, y, r] of prev.nests ?? []) { c.globalAlpha = 1 - (state.tick - state.endTick) / 40; nestArt(c, x, y, r, now, true); c.globalAlpha = 1; }
  }
}

/**
 * Polish A4 (25 Oct 2026, display only): Scrumper's own sky in the countryside's 390 × 620 frame: a
 * gradient from deep blue to a pale horizon, the sun's glow high on the right, the back and front hills
 * as before, and grass blades with small flowers along the bottom (cached once).
 */
const ORCHARD_SKY_TOP = '#5EAFE6';
function orchardBackdrop(c: CanvasRenderingContext2D): void {
  const sky = c.createLinearGradient(0, 0, 0, 620);
  sky.addColorStop(0, ORCHARD_SKY_TOP); sky.addColorStop(0.55, COUNTRY_SKY); sky.addColorStop(1, '#D4EEF8');
  c.fillStyle = sky; c.fillRect(0, 0, 390, 620);
  const sun = c.createRadialGradient(318, 84, 6, 318, 84, 170);
  sun.addColorStop(0, 'rgba(255,250,215,0.95)'); sun.addColorStop(0.12, 'rgba(255,240,180,0.6)'); sun.addColorStop(0.4, 'rgba(255,230,160,0.18)'); sun.addColorStop(1, 'rgba(255,230,160,0)');
  c.fillStyle = sun; c.fillRect(0, 0, 390, 300);
  c.fillStyle = '#FFFBE6'; c.beginPath(); c.arc(318, 84, 14, 0, Math.PI * 2); c.fill();
  c.fillStyle = COUNTRY_GRASS_BACK; c.beginPath(); c.moveTo(0, 610); c.quadraticCurveTo(100, 582, 230, 610); c.quadraticCurveTo(330, 588, 390, 605); c.lineTo(390, 620); c.lineTo(0, 620); c.fill();
  c.fillStyle = COUNTRY_GRASS; c.beginPath(); c.moveTo(0, 616); c.quadraticCurveTo(210, 590, 390, 614); c.lineTo(390, 620); c.lineTo(0, 620); c.fill();
  c.fillStyle = COUNTRY_GRASS_DARK; c.fillRect(0, 618, 390, 2);
  // Grass blades and flowers along the front hill.
  for (let k = 0; k < 120; k++) {
    const h = artHash(k, 1301);
    const x = (h % 3900) / 10;
    const base = 616 - Math.sin((x / 390) * Math.PI) * 18 + 4;
    const tall = 4 + (h >>> 12) % 6;
    c.strokeStyle = h % 3 ? COUNTRY_GRASS_DARK : '#7CC95C'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, base); c.quadraticCurveTo(x + 1, base - tall * 0.6, x + ((h >>> 4) % 5) - 2, base - tall); c.stroke();
  }
  for (let k = 0; k < 16; k++) {
    const h = artHash(k, 1409);
    const x = 10 + (h % 370);
    const y = 616 - Math.sin((x / 390) * Math.PI) * 18 - 2 + (h >>> 9) % 5;
    const petal = ['#FFFFFF', '#FFD54B', '#FF8FB3', '#C9A2FF'][(h >>> 5) % 4]!;
    c.strokeStyle = COUNTRY_GRASS_DARK; c.lineWidth = 0.8; c.beginPath(); c.moveTo(x, y + 6); c.lineTo(x, y); c.stroke();
    c.fillStyle = petal;
    for (let p = 0; p < 5; p++) { const a = (p * Math.PI * 2) / 5; c.beginPath(); c.arc(x + Math.cos(a) * 1.7, y + Math.sin(a) * 1.7, 1.3, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#F0A020'; c.beginPath(); c.arc(x, y, 0.9, 0, Math.PI * 2); c.fill();
  }
}
/** A soft cloud: the countryside's shapes with a shaded underside and a lit top. */
function orchardCloud(c: CanvasRenderingContext2D): void {
  c.save(); c.translate(4, 4);
  c.fillStyle = 'rgba(160,190,215,0.35)'; c.beginPath(); c.ellipse(26, 26, 25, 5, 0, 0, Math.PI * 2); c.fill();
  countryCloud(c);
  c.fillStyle = 'rgba(255,255,255,0.75)';
  for (const [x, y, r] of [[12, 10, 7], [26, 8, 8], [37, 13, 6]] as const) { c.beginPath(); c.arc(x - 1, y - 1, r, 0, Math.PI * 2); c.fill(); }
  c.restore();
}
function drawOrchardSky(c: CanvasRenderingContext2D, camera: number): void {
  countryStamp(c, 'orchard-backdrop-a4', 390, 620, 0, 0, orchardBackdrop);
  const t = countryClock();
  for (const [x, y, f] of [[38, 100, 0.7], [278, 146, 0.85], [152, 218, 0.55], [330, 250, 0.45], [90, 300, 0.4]] as const) {
    c.save(); c.globalAlpha = 0.85; c.translate(x + Math.sin(t * 0.08 + y) * 5 - camera * 0.08, y); c.scale(f, f);
    countryStamp(c, 'orchard-cloud-a4', 56, 34, 0, 0, orchardCloud); c.restore();
  }
}

/** The game's drawing through the shared success layer (presentation only). */
export function drawSnipArt(c: CanvasRenderingContext2D, state: SnipState, size: CanvasSize, trail?: readonly (readonly [number, number])[], cameraX = snipCamera(state, state.sx / 256 - SNIP_CONFIG.viewW / 2, 1), swipes: readonly SnipSwipe[] = []): void {
  arcadeFx(c, snipFxFor(state), state, () => drawSnipArtWorld(c, state, size, trail, cameraX, swipes), size);
}

function drawSnipArtWorld(c:CanvasRenderingContext2D,state:SnipState,size:CanvasSize,trail?:readonly (readonly [number,number])[],cameraX=snipCamera(state,state.sx/256-SNIP_CONFIG.viewW/2,1),swipes:readonly SnipSwipe[]=[]):void {
  const tpl=SNIP_CONFIG.templates[state.template];if(!tpl)return;
  const H=snipWorldH(state);
  const {scaleX,scaleY}=snipView(size,H);
  c.save();c.fillStyle=ORCHARD_SKY_TOP;c.fillRect(0,0,size.width,size.height);c.beginPath();c.rect(0,0,size.width,size.height);c.clip();
  // Tall (Tuning E) levels scale the countryside uniformly, anchored to the bottom edge (no stretch); older rounds keep their draw.
  if(state.worldH){const k=Math.max(size.width/390,size.height/620);c.save();c.translate(0,size.height-620*k);c.scale(k,k);drawOrchardSky(c,cameraX);c.restore();}
  else{c.save();c.scale(size.width/390,size.height/620);drawOrchardSky(c,cameraX);c.restore();}
  c.scale(scaleX,scaleY);c.translate(-cameraX,0);
  countryStamp(c,'orchard-canopy',SNIP_W,28,0,0,canopy);
  // Connections to actual pins, including lower anchors, stay faint and behind gameplay.
  c.save();c.globalAlpha=0.18;c.strokeStyle=COUNTRY_WOOD_DARK;c.lineWidth=5;
  for(const rope of state.ropes){const px=rope.x[0],py=rope.y[0];if(px===undefined||py===undefined)continue;c.beginPath();c.moveTo(px/256-28,10);c.bezierCurveTo(px/256-18,py/512,px/256+18,py/512,px/256,py/256);c.stroke();}c.restore();
  c.save();c.beginPath();c.rect(0,0,SNIP_W,H);c.clip();countryStamp(c,'orchard-wall',3,SNIP_TALL_H,0,0,wall);countryStamp(c,'orchard-wall',3,SNIP_TALL_H,SNIP_W-3,0,wall);c.restore();
  for(const [x0,y0,x1,y1] of tpl.platforms)countryStamp(c,'orchard-rail',x1-x0,y1-y0,x0,y0,ctx=>rail(ctx,x1-x0,y1-y0));
  drawOrchardElements(c,tpl,state);
  // snipRev 3 baskets can slide; others sit at their fixed mouth.
  const mouth=snipMouthAt(tpl,state.levelTick);
  if(tpl.slide){c.save();c.strokeStyle=COUNTRY_WOOD_DARK;c.globalAlpha=0.35;c.lineWidth=3;c.beginPath();c.moveTo(tpl.mouth[0]-tpl.slide[0]-32,tpl.mouth[1]+34);c.lineTo(tpl.mouth[0]+tpl.slide[0]+32,tpl.mouth[1]+34);c.stroke();c.restore();}
  // Polish A4: a soft shadow under the basket (light, not a body).
  c.save();c.fillStyle='rgba(30,50,30,0.18)';c.beginPath();c.ellipse(mouth.x/256+3,mouth.y/256+34,26,5,0,0,Math.PI*2);c.fill();c.restore();
  countryStamp(c,'orchard-basket',64,64,mouth.x/256-32,mouth.y/256-32,basket);
  state.starX.forEach((x,i)=>{const y=state.starY[i];if(state.starGot[i]||y===undefined)return;// Art pilot (Orchard): golden-leaf sprite fills the 48 px pickup disc's square; code art when absent.
    if(!drawArtSprite(c,'orchard','leaf',x/256-24,y/256-24,48,48))countryStamp(c,'orchard-leaf',48,48,x/256-24,y/256-24,leaf);});
  state.ropes.forEach((rope,index)=>{const pts:[number,number][]=[];for(let i=0;i<rope.x.length;i++){const x=rope.x[i],y=rope.y[i];if(x!==undefined&&y!==undefined)pts.push([x/256,y/256]);}if(rope.alive)pts.push([state.sx/256,state.sy/256]);(index>=tpl.pins.length?vine:twine)(c,pts,rope.alive?1:0.6);});
  countryStamp(c,'orchard-apple',24,24,state.sx/256-12,state.sy/256-12,apple);
  if(trail&&trail.length>1){const first=trail[0];if(first){c.strokeStyle=COUNTRY_SHINE;c.lineWidth=2;c.beginPath();c.moveTo(first[0],first[1]);for(const [x,y] of trail)c.lineTo(x,y);c.stroke();}}
  const now=typeof performance==='undefined'?0:performance.now();
  c.strokeStyle=COUNTRY_SHINE;c.lineWidth=2;c.lineCap='round';
  for(const sw of swipes){const k=1-(now-sw.at)/200;if(k<=0)continue;c.globalAlpha=k*0.8;c.beginPath();c.moveTo(sw.a,sw.b);c.lineTo(sw.c,sw.d);c.stroke();}
  c.globalAlpha=1;
  const completed=SNIP_CONFIG.templates[state.order[Math.max(0,state.level-1)]??state.template];
  if(completed)successFrame(c,{id:'snip',tick:state.tick,count:state.eaten,eventTick:state.lastOutcome===SNIP_EATEN?state.endTick:0,colour:COUNTRY_GOLD,width:SNIP_W,height:H,point:{x:completed.mouth[0],y:completed.mouth[1],shape:'spark'}});
  c.restore();
}
/** Fixed illustration uses the same cached apple and basket, never changes demo inputs. */
export function drawSnipOrchardExample(c:CanvasRenderingContext2D,t:number):void {
  c.save();c.scale(160/390,140/620);drawOrchardSky(c,0);c.restore();
  const cut=t>=25,fall=cut?Math.min(1,((t-25)/22)**2):0;
  c.save();c.scale(160/SNIP_W,1);countryStamp(c,'orchard-canopy',SNIP_W,28,0,0,canopy);c.restore();
  twine(c,cut?[[80,10],[79,18],[80,24]]:[[80,10],[80,45]],cut?0.5:1);
  c.save();c.translate(68,108);c.scale(24/64,24/64);countryStamp(c,'orchard-basket',64,64,0,0,basket);c.restore();
  if(t<47){c.save();c.translate(73,38+fall*70);c.scale(14/24,14/24);countryStamp(c,'orchard-apple',24,24,0,0,apple);c.restore();}
  const swipe=t>=15&&t<30?(t-15)/10:-1;if(swipe>=0&&swipe<=1){c.strokeStyle=COUNTRY_SHINE;c.lineWidth=2;c.beginPath();c.moveTo(55,22);c.lineTo(55+50*Math.min(1,swipe),30);c.stroke();}
}
export const snipArtGame={...snipGame,draw:(c:CanvasRenderingContext2D,s:SnipState,size:CanvasSize)=>drawSnipArt(c,s,size)};
