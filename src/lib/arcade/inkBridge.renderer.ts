import { successHud, successFrame, SUCCESS_ACCENTS } from "./success.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { INKBRIDGE_FX } from "./arcadeFxGames.renderer";
/** Rainbow Ink Bridge. Presentation only; all geometry comes from the unchanged sim. */
import type { CanvasSize } from './engine';
import { inkBridgeGame, inkBridgeGameFor, inkBlockH, inkBucketX, inkBudget, inkBudgetFor, inkIsLive, INK_BLOCK_H, INK_BUCKET_H, INK_BUCKET_W, INK_FAILS, INK_LEVELS, INK_NO_DRAW_ZONE_PX, INK_LIVE_PRE_CAP, INK_STAR_R, INK_WORLD_H, INK_WORLD_W, type InkState } from './inkBridge';
import { artCanvas, artContext, type ArtCanvas } from './cache.renderer';
import { sceneBelow, sceneBlades, sceneFill, sceneSides, type ArenaSceneView } from './arenaScene.renderer';
import { artHash } from './art.renderer';
import { COUNTRY_SKY as SKY, COUNTRY_GRASS as GRASS, countryCloud as cloud, countryClock, countryStamp } from './countryside.renderer';

/* Private geometry mirrors: 7px coin, 4px rim caps, 6px stroke. */
const FP = 256, BALL_R = 7, RIM_R = 4, STROKE_W = 6;
const GOLD = '#FFD54B', GOLD_EDGE = '#986519', SHINE = '#FFF8C9';
const POT = '#181B21', POT_EDGE = '#39414B', TEXT = '#24333C';
const RED = '#E93640', RED_EDGE = '#AA202C', EMPTY = '#D2E3E9';
export const INK_RAINBOW = ['#F04448', '#F59332', '#F3D63D', '#3BAE65', '#278DE1', '#514EB5', '#AB57C7'] as const;
export const INK_ART_BG = SKY;
const sprites = new Map<string, ArtCanvas>();
const BIRD = '#FFFFFF', BIRD_EDGE = '#26313F';
/**
 * One white bird filling a 32×13 cell (drawn scaled into its share of the
 * collision box): wingtips reach both ends, body spans the full height.
 * Four cached flap frames; render only.
 */
function birdFrame(c: CanvasRenderingContext2D, f: number): void {
  const lift = [1, 4.5, 9, 4.5][f] ?? 1; // wingtip height from the top
  c.lineJoin = 'round';
  c.fillStyle = BIRD; c.strokeStyle = BIRD_EDGE; c.lineWidth = 1.6;
  // Wings.
  c.beginPath();
  c.moveTo(0.5, lift); c.quadraticCurveTo(8, lift + 1, 13, 6); c.lineTo(19, 6); c.quadraticCurveTo(24, lift + 1, 31.5, lift);
  c.quadraticCurveTo(24, lift + 4, 19, 9); c.lineTo(13, 9); c.quadraticCurveTo(8, lift + 4, 0.5, lift); c.closePath();
  c.fill(); c.stroke();
  // Body and head (full height of the cell).
  c.beginPath(); c.ellipse(16, 6.5, 5, 6, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = '#F5B82E'; c.beginPath(); c.moveTo(19.5, 5); c.lineTo(23, 6.5); c.lineTo(19.5, 8); c.fill();
  c.fillStyle = '#1C2430'; c.fillRect(17.5, 4, 1.4, 1.4);
}
/** A flock filling the obstacle box exactly, flapping in place. */
function drawBirds(c: CanvasRenderingContext2D, b: { x0: number; x1: number; y: number }, h: number, tick: number): void {
  const len = b.x1 - b.x0, n = Math.max(1, Math.round(len / 18)), w = len / n;
  for (let i = 0; i < n; i++) {
    const f = Math.floor((tick + i * 5) / 7) % 4;
    const img = sprite(`bird${f}`, 64, 26, (m) => { m.scale(2, 2); birdFrame(m, f); });
    if (img) c.drawImage(img, b.x0 + i * w, b.y, w, h);
  }
}
function sprite(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void): ArtCanvas | null {
  const cached = sprites.get(key); if (cached) return cached;
  const surface = artCanvas(w * 2, h * 2); if (!surface) return null;
  const native = artContext(surface); if (!native) return null;
  const c = native as CanvasRenderingContext2D; c.scale(2, 2); draw(c);
  sprites.set(key, surface); return surface;
}
function stamp(c: CanvasRenderingContext2D, key: string, w: number, h: number, x: number, y: number, draw: (c: CanvasRenderingContext2D) => void): void {
  const image = sprite(key, w, h, draw);
  if (image) c.drawImage(image, x, y, w, h);
  else { c.save(); c.translate(x, y); draw(c); c.restore(); }
}
function leprechaun(c:CanvasRenderingContext2D):void {
 c.fillStyle='#183F36';c.fillRect(6,14,10,10);c.fillRect(5,27,6,3);c.fillRect(13,27,6,3);
 c.fillStyle='#557F48';c.fillRect(7,22,3,5);c.fillRect(13,22,3,5);
 c.fillStyle='#DDB17B';c.beginPath();c.ellipse(11,10,5,6,0,0,Math.PI*2);c.fill();
 c.fillStyle='#B06434';c.beginPath();c.moveTo(6,12);c.lineTo(11,19);c.lineTo(16,12);c.closePath();c.fill();
 c.fillStyle='#225C4B';c.fillRect(6,2,10,6);c.fillRect(3,7,16,2);c.fillStyle='#C5AC6D';c.fillRect(6,5,10,1);
 c.fillStyle='#24333C';c.fillRect(8,10,1,1);c.fillRect(13,10,1,1);
}
function coin(c: CanvasRenderingContext2D): void {
  c.fillStyle = GOLD_EDGE; c.beginPath(); c.arc(7,7,BALL_R,0,Math.PI*2); c.fill();
  c.fillStyle = GOLD; c.beginPath(); c.arc(7,7,6,0,Math.PI*2); c.fill();
  c.strokeStyle = GOLD_EDGE; c.lineWidth = 0.7; c.beginPath(); c.arc(7,7,4.4,0,Math.PI*2); c.stroke();
  c.fillStyle = SHINE; c.beginPath(); c.ellipse(4.7,4,1.1,2.5,0.7,0,Math.PI*2); c.fill();
  c.strokeStyle = GOLD_EDGE; c.lineWidth = 1; c.beginPath(); c.moveTo(7,4); c.lineTo(7,10); c.stroke();
}
function pot(c: CanvasRenderingContext2D): void {
  // Exact body rectangle and opening width; only the authoritative rim caps protrude.
  c.fillStyle = POT; c.beginPath(); c.moveTo(0,0); c.lineTo(64,0); c.lineTo(64,19); c.quadraticCurveTo(64,36,48,36); c.lineTo(16,36); c.quadraticCurveTo(0,36,0,19); c.closePath(); c.fill();
  c.fillStyle = POT_EDGE; c.fillRect(2,8,2,16); c.fillRect(60,8,2,16);
  c.fillStyle = GOLD_EDGE; c.fillRect(4,2,56,6);
  for (let i=0;i<9;i++) { c.fillStyle = i%2 ? GOLD : SHINE; c.beginPath(); c.ellipse(7+i*6.2,4,3,2,0.2*(i%3),0,Math.PI*2); c.fill(); }
  c.fillStyle = POT_EDGE; c.fillRect(0,0,64,2);
}
function drawPot(c: CanvasRenderingContext2D, x: number, y: number, flash: boolean): void {
  stamp(c,'pot',INK_BUCKET_W,INK_BUCKET_H,x-INK_BUCKET_W/2,y,pot);
  c.fillStyle = POT;
  for (const rx of [x-INK_BUCKET_W/2,x+INK_BUCKET_W/2]) { c.beginPath(); c.arc(rx,y,RIM_R,0,Math.PI*2); c.fill(); }
  if (flash) { c.fillStyle = SHINE; c.globalAlpha=0.6; c.fillRect(x-28,y+2,56,5); c.globalAlpha=1; }
}
/** Failure classification reads the recorded failed position, never changes physics. */
export function inkFailedOnBlock(state: InkState): boolean {
  const b = state.failedBall, lvl = state.list[Math.min(state.level,state.list.length-1)];
  if (state.flashKind !== 2 || !b || !lvl) return false;
  const x=b.x/FP,y=b.y/FP;
  return lvl.blocks.some(block => {
    const dx=x-Math.max(block.x0,Math.min(block.x1,x));
    const dy=y-Math.max(block.y,Math.min(block.y+inkBlockH(block),y));
    return dx*dx+dy*dy<=BALL_R*BALL_R;
  });
}
function rainbow(c: CanvasRenderingContext2D, x0:number,y0:number,x1:number,y1:number,offset:number,len:number): CanvasGradient {
  const gradient=c.createLinearGradient(x0,y0,x1,y1);
  const colour=(d:number)=>INK_RAINBOW[((Math.floor(d/3)%7)+7)%7] ?? INK_RAINBOW[0];
  gradient.addColorStop(0,colour(offset));
  for(let d=(Math.floor(offset/3)+1)*3;d<offset+len;d+=3) gradient.addColorStop((d-offset)/len,colour(d));
  gradient.addColorStop(1,colour(offset+len)); return gradient;
}
function paintBridge(c: CanvasRenderingContext2D,state:InkState):void {
  c.lineWidth=STROKE_W;c.lineCap='round';let distance=0;
  for(let i=0;i<state.segs.length;i++) {
    const s=state.segs[i];if(!s)continue;
    if(state.strokeStarts.includes(i))distance=0;
    const len=Math.hypot(s.x1-s.x0,s.y1-s.y0);if(!len)continue;
    c.strokeStyle=rainbow(c,s.x0,s.y0,s.x1,s.y1,distance,len);
    c.beginPath();c.moveTo(s.x0,s.y0);c.lineTo(s.x1,s.y1);c.stroke();distance+=len;
  }
}
type BridgeCache={surface:ArtCanvas|null;segs:InkState['segs'];starts:InkState['strokeStarts']};
const bridges=new WeakMap<CanvasRenderingContext2D,BridgeCache>();
function drawBridge(c:CanvasRenderingContext2D,state:InkState):void {
  let cache=bridges.get(c);
  const same=cache && cache.segs.length===state.segs.length && cache.segs.every((s,i)=>s===state.segs[i]) && cache.starts.length===state.strokeStarts.length && cache.starts.every((s,i)=>s===state.strokeStarts[i]);
  if(!same) {
    const surface=cache?.surface ?? artCanvas(INK_WORLD_W*2,INK_WORLD_H*2);
    const native=surface?artContext(surface):null;
    if(native) { const ctx=native as CanvasRenderingContext2D;ctx.clearRect(0,0,INK_WORLD_W*2,INK_WORLD_H*2);ctx.save();ctx.scale(2,2);paintBridge(ctx,state);ctx.restore(); }
    cache={surface,segs:state.segs,starts:state.strokeStarts};bridges.set(c,cache);
  }
  if(cache?.surface)c.drawImage(cache.surface,0,0,INK_WORLD_W,INK_WORLD_H);else paintBridge(c,state);
}
/** Rev 4 gold star: five points filling the star's draw circle (radius INK_STAR_R). */
function goldStar(m: CanvasRenderingContext2D): void {
  const r = INK_STAR_R;
  m.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const k = i % 2 === 0 ? r - 0.5 : r * 0.45;
    m.lineTo(r + Math.cos(a) * k, r + Math.sin(a) * k);
  }
  m.closePath();
  m.fillStyle = GOLD;
  m.fill();
  m.strokeStyle = GOLD_EDGE;
  m.lineWidth = 1;
  m.stroke();
  m.fillStyle = SHINE;
  m.beginPath();
  m.arc(r - 2, r - 2, 1.6, 0, Math.PI * 2);
  m.fill();
}

/* ===================== Tuning D: sky and grass (art only) ===================== */
/**
 * Deep-to-pale daylight sky, a sun haze and hazy far hills; baked once. No
 * rainbow in the sky: rainbow lines are what the player draws.
 */
function inkSky(m: CanvasRenderingContext2D): void {
  const W = INK_WORLD_W, H = INK_WORLD_H;
  const sky = m.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#3E9EE0'); sky.addColorStop(0.45, '#7CC6EF'); sky.addColorStop(0.85, '#C9EAF7'); sky.addColorStop(1, '#E4F5FA');
  m.fillStyle = sky; m.fillRect(0, 0, W, H);
  // Sun haze in the top right, behind the HUD's ink meter.
  const sun = m.createRadialGradient(330, 86, 0, 330, 86, 150);
  sun.addColorStop(0, 'rgba(255,252,228,0.9)'); sun.addColorStop(0.12, 'rgba(255,246,205,0.55)'); sun.addColorStop(1, 'rgba(255,246,205,0)');
  m.fillStyle = sun; m.fillRect(180, 0, W - 180, 240);
  // High wisps.
  m.strokeStyle = 'rgba(255,255,255,0.22)'; m.lineWidth = 3; m.lineCap = 'round';
  for (let i = 0; i < 6; i++) { const x = 14 + (i * 83) % (W - 90), y = 70 + (i * 67) % 260; m.beginPath(); m.moveTo(x, y); m.bezierCurveTo(x + 20, y - 5, x + 52, y + 4, x + 80, y - 2); m.stroke(); }
  // Far hills: a hazy blue ridge, then a softer green one with tiny trees.
  m.fillStyle = 'rgba(132,186,196,0.55)';
  m.beginPath(); m.moveTo(0, 548); m.quadraticCurveTo(70, 508, 150, 540); m.quadraticCurveTo(250, 500, 330, 534); m.quadraticCurveTo(370, 520, W, 528); m.lineTo(W, H); m.lineTo(0, H); m.closePath(); m.fill();
  m.fillStyle = 'rgba(146,206,128,0.8)';
  m.beginPath(); m.moveTo(0, 578); m.quadraticCurveTo(110, 548, 220, 574); m.quadraticCurveTo(310, 556, W, 570); m.lineTo(W, H); m.lineTo(0, H); m.closePath(); m.fill();
  for (const [x, y, r] of [[40, 566, 5], [52, 568, 4], [262, 566, 5], [336, 563, 4], [350, 565, 5]] as const) {
    m.fillStyle = '#6B9F63'; m.fillRect(x - 0.6, y, 1.2, 5);
    m.fillStyle = '#5E9A5A'; m.beginPath(); m.arc(x, y - r * 0.6, r, 0, Math.PI * 2); m.fill();
  }
}
/** Blades in two tones, clover clumps and a scatter of small flowers; clipped into the hill. */
function inkGrass(m: CanvasRenderingContext2D): void {
  const W = INK_WORLD_W, H = INK_WORLD_H;
  for (let i = 0; i < 70; i++) {
    const x = (i * 97) % W, y = 30 + (i * 53) % (H - 30);
    m.fillStyle = i % 2 ? 'rgba(40,110,45,0.16)' : 'rgba(170,230,120,0.14)';
    m.beginPath(); m.ellipse(x, y, 10 + (i % 4) * 3, 3 + (i % 3), 0, 0, Math.PI * 2); m.fill();
  }
  m.lineWidth = 0.9; m.lineCap = 'round';
  for (let i = 0; i < 1100; i++) {
    const x = (i * 47 + (i >> 4) * 13) % W, y = 10 + (i * 31) % (H - 10), lean = ((i * 7) % 5) - 2;
    m.strokeStyle = i % 3 === 0 ? 'rgba(220,255,170,0.22)' : i % 3 === 1 ? 'rgba(28,90,38,0.24)' : 'rgba(70,150,60,0.22)';
    m.beginPath(); m.moveTo(x, y); m.lineTo(x + lean, y - 5 - (i % 3)); m.stroke();
  }
  const petals = ['#FFFFFF', '#FFE45C', '#FF9EC4', '#C9B6FF'];
  for (let i = 0; i < 46; i++) {
    const x = 6 + (i * 151) % (W - 12), y = 24 + (i * 89) % (H - 30), r = 1.3 + (i % 3) * 0.3;
    m.fillStyle = petals[i % petals.length]!;
    for (let k = 0; k < 4; k++) { m.beginPath(); m.arc(x + Math.cos(k * Math.PI / 2) * r, y + Math.sin(k * Math.PI / 2) * r, r * 0.8, 0, Math.PI * 2); m.fill(); }
    m.fillStyle = '#F3B33D'; m.beginPath(); m.arc(x, y, r * 0.6, 0, Math.PI * 2); m.fill();
  }
}
/** Same ground outline as the shared countryside hill: its flat crest meets the pot's base. */
function inkGroundPath(c: CanvasRenderingContext2D, base: number, x: number): void {
  c.beginPath(); c.moveTo(0,base+12);
  c.quadraticCurveTo(Math.max(0,x-80),base+12,x-32,base);
  c.lineTo(x+32,base);
  c.quadraticCurveTo(Math.min(INK_WORLD_W,x+80),base+12,INK_WORLD_W,base+12);
  c.lineTo(INK_WORLD_W,INK_WORLD_H);c.lineTo(0,INK_WORLD_H);c.closePath();
}
function drawInkBackdrop(c: CanvasRenderingContext2D): void {
  stamp(c,'inksky',INK_WORLD_W,INK_WORLD_H,0,0,inkSky);
  const t=countryClock();
  for(const [x,y,f,a] of [[38,100,0.55,0.75],[278,146,0.7,0.8],[152,218,0.4,0.6],[300,300,0.35,0.5],[70,350,0.3,0.45]] as const) {
    c.save();c.globalAlpha=a;c.translate(x+Math.sin(t*0.08+y)*5,y);c.scale(f,f);
    countryStamp(c,'cloud',48,26,0,0,cloud);c.restore();
  }
}
function drawInkGround(c: CanvasRenderingContext2D, base: number, x: number): void {
  const fill=c.createLinearGradient(0,base,0,INK_WORLD_H);
  fill.addColorStop(0,'#78C957');fill.addColorStop(0.35,GRASS);fill.addColorStop(1,'#3C8A36');
  c.save();inkGroundPath(c,base,x);c.fillStyle=fill;c.fill();c.clip();
  stamp(c,'inkgrass',INK_WORLD_W,INK_WORLD_H,0,0,inkGrass);
  // A sunlit crest line along the top of the hill (inside the ground). Only the crest: the
  // outline's sides and bottom are the world's edges, which meet the arena scene unlined.
  c.beginPath();c.moveTo(0,base+12);
  c.quadraticCurveTo(Math.max(0,x-80),base+12,x-32,base);
  c.lineTo(x+32,base);
  c.quadraticCurveTo(Math.min(INK_WORLD_W,x+80),base+12,INK_WORLD_W,base+12);
  c.strokeStyle='#B4E88A';c.lineWidth=3;c.stroke();
  c.restore();
}

/** The game's drawing through the shared success layer (presentation only). */
export function drawInkBridgeArt(c: CanvasRenderingContext2D, state: InkState, size: CanvasSize): void {
  arcadeFx(c, INKBRIDGE_FX, state, () => drawInkBridgeArtWorld(c, state, size), size);
}

function drawInkBridgeArtWorld(c:CanvasRenderingContext2D,state:InkState,size:CanvasSize):void {
  const lvl=state.list[Math.min(state.level,state.list.length-1)];if(!lvl)return;
  const scale=Math.min(size.width/INK_WORLD_W,size.height/INK_WORLD_H);
  c.save();c.fillStyle=SKY;c.fillRect(0,0,size.width,size.height);
  c.translate((size.width-INK_WORLD_W*scale)/2,(size.height-INK_WORLD_H*scale)/2);c.scale(scale,scale);
  drawInkBackdrop(c);
  // Background only, below the pot opening and every level block; touchable art paints above it.
  const bx=inkBucketX(lvl,state.tick), base=lvl.bucketY+INK_BUCKET_H;
  drawInkGround(c,base,bx);
  stamp(c,"leprechaun",22,30,Math.min(INK_WORLD_W-24,Math.max(2,bx+40)),base-27,leprechaun);
  countryStamp(c,'cloud',48,26,lvl.spoutX-24,19,cloud);
  for(const b of lvl.blocks) {
    if(b.h){drawBirds(c,b,inkBlockH(b),state.tick);continue;}
    // Fully fill all 4px of every hazard, never an inset silhouette.
    c.fillStyle=RED;c.fillRect(b.x0,b.y,b.x1-b.x0,INK_BLOCK_H);
    c.fillStyle=RED_EDGE;c.fillRect(b.x0,b.y+INK_BLOCK_H-1,b.x1-b.x0,1);
  }
  drawPot(c,inkBucketX(lvl,state.tick),lvl.bucketY,state.flashKind===1&&state.tick-state.flashTick<20);
  // Rev 4: this level's gold star, until the coin in flight touches it (then it rides as a glow).
  if(lvl.star){ if(!state.starGot) stamp(c,'star',INK_STAR_R*2,INK_STAR_R*2,lvl.star.x-INK_STAR_R,lvl.star.y-INK_STAR_R,goldStar); else { c.save();c.globalAlpha=0.5;c.strokeStyle=GOLD;c.lineWidth=2;c.beginPath();c.arc(state.ball.x/FP,state.ball.y/FP,BALL_R+4,0,Math.PI*2);c.stroke();c.restore(); } }
  drawBridge(c,state);
  if(state.dropping) {
    const trail=state.positions.slice(-5);c.strokeStyle=GOLD;c.lineWidth=2;c.lineCap='round';
    for(let i=1;i<trail.length;i++){const a=trail[i-1],b=trail[i];if(!a||!b)continue;c.globalAlpha=i/trail.length*0.35;c.beginPath();c.moveTo(a.x/FP,a.y/FP);c.lineTo(b.x/FP,b.y/FP);c.stroke();}c.globalAlpha=1;
  }
  stamp(c,'coin',BALL_R*2,BALL_R*2,state.ball.x/FP-BALL_R,state.ball.y/FP-BALL_R,coin);
  // Live levels while dropping: faded, non-solid draft strokes (clipped off any birds) and a
  // no-draw ring where the next draft point would be rejected.
  if (inkIsLive(state.level,state.rev)&&state.dropping) {
    c.save();c.beginPath();c.rect(0,0,INK_WORLD_W,INK_WORLD_H);
    for(const b of lvl.blocks) if(b.h) c.rect(b.x0,b.y,b.x1-b.x0,inkBlockH(b));
    c.clip('evenodd');
    c.strokeStyle=GOLD;c.lineCap='round';c.setLineDash([6,6]);c.globalAlpha=0.35;c.lineWidth=4;
    for(const seg of state.draftSegs){c.beginPath();c.moveTo(seg.x0,seg.y0);c.lineTo(seg.x1,seg.y1);c.stroke();}
    c.setLineDash([]);c.globalAlpha=1;c.restore();
    c.save();c.strokeStyle='rgba(255,255,255,0.55)';c.setLineDash([3,4]);c.lineWidth=1.5;
    c.beginPath();c.arc(state.ball.x/FP,state.ball.y/FP,INK_NO_DRAW_ZONE_PX,0,Math.PI*2);c.stroke();
    c.setLineDash([]);c.restore();
  }
  const caughtLevel=state.list[Math.max(0,state.level-1)]??lvl;
  successFrame(c,{id:'inkbridge',tick:state.tick,count:state.levels,misses:state.fails,eventTick:state.flashKind===1?state.flashTick:0,colour:GOLD,width:INK_WORLD_W,height:INK_WORLD_H,point:{x:inkBucketX(caughtLevel,state.flashTick),y:caughtLevel.bucketY,shape:'spark'}});
  const age=state.tick-state.flashTick;
  if(state.flashKind===2&&state.failedBall&&age<20) {
    c.globalAlpha=1-age/20;stamp(c,'coin',14,14,state.failedBall.x/FP-7,state.failedBall.y/FP-7,coin);
    if(inkFailedOnBlock(state)){c.fillStyle=RED;c.globalAlpha=(1-age/20)*0.7;c.beginPath();c.arc(state.failedBall.x/FP,state.failedBall.y/FP,7,0,Math.PI*2);c.fill();}c.globalAlpha=1;
  }
  // Left side empties first; the surviving right-hand rainbow is clipped, not rescaled.
  const remaining=Math.max(0,Math.min(1,state.ink/(inkBudgetFor(state.level,state.rev)*FP)));
  c.fillStyle=EMPTY;c.fillRect(272,12,104,12);
  c.save();c.beginPath();c.rect(274+100*(1-remaining),14,100*remaining,8);c.clip();
  const meter=sprite('meter',100,8,m=>{m.fillStyle=rainbow(m,0,0,100,0,0,100);m.fillRect(0,0,100,8);});
  if(meter)c.drawImage(meter,274,14,100,8);c.restore();
  // Live levels before release: mark how far the capped first line can drain the meter,
  // and flash the meter plus the pen end once that cap is reached (render only).
  if(inkIsLive(state.level,state.rev)&&!state.dropping) {
    const budget=inkBudgetFor(state.level,state.rev);
    const mx=274+100*Math.min(1,INK_LIVE_PRE_CAP/budget);
    c.fillStyle=TEXT;c.fillRect(mx-1,10,2,16);
    const atCap=state.preInkUsed>=(INK_LIVE_PRE_CAP-2)*FP;
    if(atCap) {
      const pulse=0.55+0.45*Math.sin(state.tick/3);
      c.save();c.globalAlpha=pulse;c.strokeStyle=RED;c.lineWidth=2;c.strokeRect(271,11,106,14);
      const last=state.segs[state.segs.length-1];
      if(last){c.beginPath();c.arc(last.x1,last.y1,7,0,Math.PI*2);c.stroke();}
      c.fillStyle=RED;c.font="bold 11px 'JetBrains Mono', ui-monospace, monospace";c.textAlign='right';c.textBaseline='top';c.fillText('LINE LIMIT',376,28);
      c.restore();
    }
  }
  for(let i=0;i<INK_FAILS;i++){c.fillStyle=i<state.fails?RED:EMPTY;c.beginPath();c.arc(228+i*14,18,5,0,Math.PI*2);c.fill();}
  c.fillStyle=TEXT;c.font="bold 16px 'JetBrains Mono', ui-monospace, monospace";c.textAlign='left';c.textBaseline='alphabetic';successHud(c,'inkbridge',state.tick,12,22,()=>c.fillText(`Level ${Math.min(state.level+1,INK_LEVELS)} / ${INK_LEVELS}`,12,22));
  c.restore();
}
/** Fixed intro art shares the same sprites; no gameplay inputs or demo log changes. */
export function drawInkRainbowExample(c:CanvasRenderingContext2D):void {
  c.fillStyle=SKY;c.fillRect(0,0,168,130);
  c.fillStyle=GRASS;c.beginPath();c.moveTo(0,130);c.quadraticCurveTo(90,130,118,122);c.lineTo(150,122);c.lineTo(168,127);c.lineTo(168,130);c.lineTo(0,130);c.fill();
  c.save();c.translate(30,0);c.scale(0.75,0.75);countryStamp(c,'cloud',48,26,0,0,cloud);c.restore();
  stamp(c,'coin',14,14,41,16,coin);
  drawBirds(c,{x0:30,x1:70,y:56},5,0);
  c.strokeStyle=rainbow(c,36,34,132,94,0,113);c.lineCap='round';c.lineWidth=3;c.beginPath();c.moveTo(36,34);c.lineTo(132,94);c.stroke();
  c.save();c.translate(134,104);c.scale(0.5,0.5);drawPot(c,0,0,false);c.restore();
}
export const inkBridgeArtGame={...inkBridgeGame,draw:drawInkBridgeArt};
export const inkBridgeArtGameFor=(rev?:number|null)=>({...inkBridgeGameFor(rev),draw:drawInkBridgeArt});

/**
 * Arena scene (15 Oct 2026, display only; arenaScene.renderer.ts): more grass and hillside
 * below the ground, out to the arena box's edges (and, beside the world on a narrower
 * phone, the same sky, far hills and ground at this level's ground line, `groundY`). Grass,
 * clover and a few flowers only: no pot, coin, birds, blocks or rainbow, and nothing moves.
 */
export function inkArenaScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView, groundY: number): void {
  const H = INK_WORLD_H;
  for (const side of sceneSides(view)) {
    const left = side.x < 0;
    sceneFill(ctx, side, 0, H, [[0, '#3E9EE0'], [0.45, '#7CC6EF'], [0.85, '#C9EAF7'], [1, '#E4F5FA']]);
    ctx.fillStyle = 'rgba(132,186,196,0.55)';
    ctx.fillRect(side.x, left ? 548 : 528, side.w, H);
    ctx.fillStyle = 'rgba(146,206,128,0.8)';
    ctx.fillRect(side.x, left ? 578 : 570, side.w, H);
    const ground = { x: side.x, y: groundY, w: side.w, h: H - groundY };
    if (ground.h > 0) {
      sceneFill(ctx, ground, groundY - 12, H, [[0, '#78C957'], [0.35, GRASS], [1, '#3C8A36']]);
      ctx.fillStyle = '#B4E88A';
      ctx.fillRect(side.x, groundY - 1.5, side.w, 3);
    }
  }
  const below = sceneBelow(view);
  if (!below) return;
  sceneFill(ctx, below, H, view.bottom, [[0, '#3C8A36'], [Math.min(1, 150 / below.h), '#347C30'], [1, '#2B6A2A']]);
  // Hillside: soft rolling folds in the turf, lighter on their upper edge.
  ctx.save();
  for (let k = 0, y = H + 34; y < view.bottom - 10; k++, y += 46 + (k % 3) * 10) {
    const lift = 10 + (k % 2) * 6;
    ctx.fillStyle = k % 2 ? 'rgba(20,70,25,0.16)' : 'rgba(170,230,120,0.08)';
    ctx.beginPath();
    ctx.moveTo(below.x, y + lift);
    ctx.quadraticCurveTo(below.x + below.w * (0.3 + (k % 3) * 0.15), y - lift, below.x + below.w, y + lift * 0.4);
    ctx.lineTo(below.x + below.w, y + 40);
    ctx.lineTo(below.x, y + 40);
    ctx.closePath();
    ctx.fill();
  }
  // Clover clumps, then blades in the world's two tones.
  const clumps = Math.round((below.w * below.h) / 2200);
  for (let i = 0; i < clumps; i++) {
    const h = artHash(i, 517);
    const x = below.x + (h % 10007) / 10007 * below.w, y = below.y + 6 + ((h >>> 14) % 9973) / 9973 * Math.max(0, below.h - 8);
    ctx.fillStyle = i % 2 ? 'rgba(40,110,45,0.16)' : 'rgba(170,230,120,0.12)';
    ctx.beginPath(); ctx.ellipse(x, y, 10 + (i % 4) * 3, 3 + (i % 3), 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  sceneBlades(ctx, below, 0x1b1d, ['rgba(220,255,170,0.2)', 'rgba(28,90,38,0.26)', 'rgba(70,150,60,0.22)'], 45, 6);
  const petals = ['#FFFFFF', '#FFE45C', '#FF9EC4', '#C9B6FF'];
  const flowers = Math.round((below.w * below.h) / 3600);
  for (let i = 0; i < flowers; i++) {
    const h = artHash(i, 523);
    const x = below.x + 6 + (h % 10007) / 10007 * (below.w - 12), y = below.y + 10 + ((h >>> 14) % 9973) / 9973 * Math.max(0, below.h - 16), r = 1.3 + (i % 3) * 0.3;
    ctx.fillStyle = petals[i % petals.length]!;
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x + Math.cos(k * Math.PI / 2) * r, y + Math.sin(k * Math.PI / 2) * r, r * 0.8, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#F3B33D'; ctx.beginPath(); ctx.arc(x, y, r * 0.6, 0, Math.PI * 2); ctx.fill();
  }
}

/** The world's ground line at its left and right edges for the current level (the scene meets it). */
export function inkSceneGround(state: InkState): number {
  const lvl = state.list[Math.min(state.level, state.list.length - 1)];
  return lvl ? lvl.bucketY + INK_BUCKET_H + 12 : INK_WORLD_H;
}
