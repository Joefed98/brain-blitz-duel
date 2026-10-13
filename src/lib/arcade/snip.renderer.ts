import { successFrame, SUCCESS_ACCENTS } from "./success.renderer";
import { drawArtSprite } from "./sprites.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { snipFxFor } from "./arcadeFxGames.renderer";
/** Orchard Snip. Art only: original world, camera, rope nodes and collision geometry. */
import type { CanvasSize } from './engine';
import { snipCamera, snipGame, snipMouthAt, snipView, SNIP_CONFIG, SNIP_EATEN, SNIP_HOOK_REACH, SNIP_STUNG, SNIP_TALL_H, SNIP_W, snipWorldH, type SnipState, type SnipTemplate } from './snip';
import { countryStamp, drawCountryside, COUNTRY_SKY, COUNTRY_GRASS, COUNTRY_GRASS_DARK, COUNTRY_WOOD, COUNTRY_WOOD_DARK, COUNTRY_WOOD_LIGHT, COUNTRY_STONE, COUNTRY_STONE_DARK, COUNTRY_GOLD, COUNTRY_GOLD_EDGE, COUNTRY_SHINE, COUNTRY_APPLE, COUNTRY_APPLE_EDGE } from './countryside.renderer';

export interface SnipSwipe { a: number; b: number; c: number; d: number; at: number }
function circle(c:CanvasRenderingContext2D,x:number,y:number,r:number):void { c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill(); }
/** Full 24px circular silhouette; stalk and leaf are inside the collision disc. */
function apple(c:CanvasRenderingContext2D):void {
  c.fillStyle=COUNTRY_APPLE_EDGE;circle(c,12,12,12);
  c.fillStyle=COUNTRY_APPLE;circle(c,12,12,11);
  c.fillStyle=COUNTRY_WOOD_DARK;c.fillRect(11,1,2,6);
  c.fillStyle=COUNTRY_GRASS_DARK;c.beginPath();c.ellipse(16,4,4,1.8,-0.45,0,Math.PI*2);c.fill();
  c.fillStyle=COUNTRY_SHINE;c.beginPath();c.ellipse(6.5,10,1.2,3.1,0.35,0,Math.PI*2);c.fill();
}
/** Wicker basket fills the exact circular mouth; opening spans all 64px. */
function basket(c:CanvasRenderingContext2D):void {
  c.save();c.beginPath();c.arc(32,32,32,0,Math.PI*2);c.clip();
  c.fillStyle=COUNTRY_WOOD_DARK;c.fillRect(0,0,64,64);
  c.fillStyle=COUNTRY_WOOD;c.fillRect(1,1,62,62);
  c.strokeStyle=COUNTRY_WOOD_LIGHT;c.lineWidth=2;
  c.beginPath();for(let y=36;y<64;y+=5){c.moveTo(0,y);c.lineTo(64,y);}for(let x=4;x<64;x+=7){c.moveTo(x,33);c.lineTo(x-6,64);}c.stroke();
  c.fillStyle=COUNTRY_WOOD_DARK;c.beginPath();c.ellipse(32,32,32,10,0,0,Math.PI*2);c.fill();
  c.strokeStyle=COUNTRY_WOOD_LIGHT;c.lineWidth=2;c.beginPath();c.ellipse(32,32,31,9,0,0,Math.PI*2);c.stroke();c.restore();
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
function canopy(c:CanvasRenderingContext2D):void {
  // Entire canopy lives at y 0..28; faint branch connections behind ropes are art only.
  c.fillStyle=COUNTRY_GRASS_DARK;
  for(let x=0;x<SNIP_W;x+=52){c.beginPath();c.ellipse(x,0,42,22,0,0,Math.PI*2);c.fill();}
  c.strokeStyle=COUNTRY_WOOD_DARK;c.lineWidth=7;c.lineCap='round';c.beginPath();c.moveTo(0,9);c.lineTo(SNIP_W,9);c.stroke();
}
function twine(c:CanvasRenderingContext2D,points:readonly (readonly [number,number])[],alpha:number):void {
  const first=points[0];if(!first)return;
  c.save();c.globalAlpha=alpha;c.lineCap='round';c.lineJoin='round';
  c.beginPath();c.moveTo(first[0],first[1]);for(const [x,y] of points)c.lineTo(x,y);
  c.strokeStyle=COUNTRY_WOOD_DARK;c.lineWidth=3.5;c.stroke();
  c.strokeStyle=COUNTRY_WOOD_LIGHT;c.lineWidth=1.4;c.setLineDash([3,2]);c.stroke();c.restore();
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
/** snipRev 3 wasp nest: a papery striped nest filling the collision disc, with wasps circling just outside it. */
function nestArt(c: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, angry: boolean): void {
  c.save();
  c.fillStyle = '#B7A27E'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#8A7553'; c.lineWidth = 2;
  for (let k = -2; k <= 2; k++) { c.beginPath(); c.ellipse(x, y + k * r * 0.32, r * Math.sqrt(1 - (k * 0.32) ** 2) * 0.98, 2.2, 0, 0, Math.PI * 2); c.stroke(); }
  c.fillStyle = '#3A2C1A'; c.beginPath(); c.arc(x, y + r * 0.55, r * 0.18, 0, Math.PI * 2); c.fill();
  for (let k = 0; k < 3; k++) {
    const a = t * (angry ? 9 : 3.2) + k * 2.1, d = r + 5 + (k % 2) * 3;
    const wx = x + Math.cos(a) * d, wy = y + Math.sin(a) * d * 0.7;
    c.fillStyle = '#F5C518'; c.beginPath(); c.ellipse(wx, wy, 3.2, 2.2, a, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#20170C'; c.fillRect(wx - 0.6, wy - 2, 1.2, 4);
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

/** The game's drawing through the shared success layer (presentation only). */
export function drawSnipArt(c: CanvasRenderingContext2D, state: SnipState, size: CanvasSize, trail?: readonly (readonly [number, number])[], cameraX = snipCamera(state, state.sx / 256 - SNIP_CONFIG.viewW / 2, 1), swipes: readonly SnipSwipe[] = []): void {
  arcadeFx(c, snipFxFor(state), state, () => drawSnipArtWorld(c, state, size, trail, cameraX, swipes), size);
}

function drawSnipArtWorld(c:CanvasRenderingContext2D,state:SnipState,size:CanvasSize,trail?:readonly (readonly [number,number])[],cameraX=snipCamera(state,state.sx/256-SNIP_CONFIG.viewW/2,1),swipes:readonly SnipSwipe[]=[]):void {
  const tpl=SNIP_CONFIG.templates[state.template];if(!tpl)return;
  const H=snipWorldH(state);
  const {scaleX,scaleY}=snipView(size,H);
  c.save();c.fillStyle=COUNTRY_SKY;c.fillRect(0,0,size.width,size.height);c.beginPath();c.rect(0,0,size.width,size.height);c.clip();
  // Tall (Tuning E) levels scale the countryside uniformly, anchored to the bottom edge (no stretch); older rounds keep their draw.
  if(state.worldH){const k=Math.max(size.width/390,size.height/620);c.save();c.translate(0,size.height-620*k);c.scale(k,k);drawCountryside(c,cameraX);c.restore();}
  else{c.save();c.scale(size.width/390,size.height/620);drawCountryside(c,cameraX);c.restore();}
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
  c.save();c.scale(160/390,140/620);drawCountryside(c);c.restore();
  const cut=t>=25,fall=cut?Math.min(1,((t-25)/22)**2):0;
  c.save();c.scale(160/SNIP_W,1);countryStamp(c,'orchard-canopy',SNIP_W,28,0,0,canopy);c.restore();
  twine(c,cut?[[80,10],[79,18],[80,24]]:[[80,10],[80,45]],cut?0.5:1);
  c.save();c.translate(68,108);c.scale(24/64,24/64);countryStamp(c,'orchard-basket',64,64,0,0,basket);c.restore();
  if(t<47){c.save();c.translate(73,38+fall*70);c.scale(14/24,14/24);countryStamp(c,'orchard-apple',24,24,0,0,apple);c.restore();}
  const swipe=t>=15&&t<30?(t-15)/10:-1;if(swipe>=0&&swipe<=1){c.strokeStyle=COUNTRY_SHINE;c.lineWidth=2;c.beginPath();c.moveTo(55,22);c.lineTo(55+50*Math.min(1,swipe),30);c.stroke();}
}
export const snipArtGame={...snipGame,draw:(c:CanvasRenderingContext2D,s:SnipState,size:CanvasSize)=>drawSnipArt(c,s,size)};
