/** Rainbow Ink Bridge. Presentation only; all geometry comes from the unchanged sim. */
import type { CanvasSize } from './engine';
import { inkBridgeGame, inkBucketX, inkBudget, INK_BLOCK_H, INK_BUCKET_H, INK_BUCKET_W, INK_FAILS, INK_LEVELS, INK_WORLD_H, INK_WORLD_W, type InkState } from './inkBridge';
import { artCanvas, artContext, type ArtCanvas } from './cache.renderer';

/* Private geometry mirrors: 7px coin, 4px rim caps, 6px stroke. */
const FP = 256, BALL_R = 7, RIM_R = 4, STROKE_W = 6;
const SKY = '#89CEF2', CLOUD = '#FFFFFF', CLOUD_SHADE = '#E4F2F9';
const GRASS = '#65B94B', GRASS_BACK = '#98D674', GRASS_DARK = '#408B37';
const GOLD = '#FFD54B', GOLD_EDGE = '#986519', SHINE = '#FFF8C9';
const POT = '#181B21', POT_EDGE = '#39414B', TEXT = '#24333C';
const RED = '#E93640', RED_EDGE = '#AA202C', EMPTY = '#D2E3E9';
export const INK_RAINBOW = ['#F04448', '#F59332', '#F3D63D', '#3BAE65', '#278DE1', '#514EB5', '#AB57C7'] as const;
export const INK_ART_BG = SKY;
const sprites = new Map<string, ArtCanvas>();
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
function cloud(c: CanvasRenderingContext2D): void {
  c.fillStyle = CLOUD_SHADE; c.beginPath(); c.roundRect(0, 10, 48, 16, 8); c.fill();
  c.fillStyle = CLOUD;
  for (const [x,y,r] of [[12,13,10],[26,11,11],[38,16,9]] as const) { c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill(); }
}
function backdrop(c: CanvasRenderingContext2D): void {
  c.fillStyle = SKY; c.fillRect(0,0,INK_WORLD_W,INK_WORLD_H);
  // Hills are scenery, below the gameplay area; no raised decorative ledges.
  c.fillStyle = GRASS_BACK; c.beginPath(); c.moveTo(0,610); c.quadraticCurveTo(100,582,230,610); c.quadraticCurveTo(330,588,390,605); c.lineTo(390,620); c.lineTo(0,620); c.fill();
  c.fillStyle = GRASS; c.beginPath(); c.moveTo(0,616); c.quadraticCurveTo(210,590,390,614); c.lineTo(390,620); c.lineTo(0,620); c.fill();
  c.fillStyle = GRASS_DARK; c.fillRect(0,618,INK_WORLD_W,2);
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
    const dy=y-Math.max(block.y,Math.min(block.y+INK_BLOCK_H,y));
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
function motionTime():number {
  if(typeof window==='undefined'||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return 0;
  return performance.now()/1000;
}
export function drawInkBridgeArt(c:CanvasRenderingContext2D,state:InkState,size:CanvasSize):void {
  const lvl=state.list[Math.min(state.level,state.list.length-1)];if(!lvl)return;
  const scale=Math.min(size.width/INK_WORLD_W,size.height/INK_WORLD_H);
  c.save();c.fillStyle=SKY;c.fillRect(0,0,size.width,size.height);
  c.translate((size.width-INK_WORLD_W*scale)/2,(size.height-INK_WORLD_H*scale)/2);c.scale(scale,scale);
  stamp(c,'background',INK_WORLD_W,INK_WORLD_H,0,0,backdrop);
  const t=motionTime();
  for(const [x,y,f] of [[38,100,0.55],[278,146,0.7],[152,218,0.4]] as const) { c.save();c.globalAlpha=0.68;c.translate(x+Math.sin(t*0.08+y)*5,y);c.scale(f,f);stamp(c,'cloud',48,26,0,0,cloud);c.restore(); }
  stamp(c,'cloud',48,26,lvl.spoutX-24,19,cloud);
  for(const b of lvl.blocks) {
    // Fully fill all 4px of every hazard, never an inset silhouette.
    c.fillStyle=RED;c.fillRect(b.x0,b.y,b.x1-b.x0,INK_BLOCK_H);
    c.fillStyle=RED_EDGE;c.fillRect(b.x0,b.y+INK_BLOCK_H-1,b.x1-b.x0,1);
  }
  drawPot(c,inkBucketX(lvl,state.tick),lvl.bucketY,state.flashKind===1&&state.tick-state.flashTick<20);
  drawBridge(c,state);
  if(state.dropping) {
    const trail=state.positions.slice(-5);c.strokeStyle=GOLD;c.lineWidth=2;c.lineCap='round';
    for(let i=1;i<trail.length;i++){const a=trail[i-1],b=trail[i];if(!a||!b)continue;c.globalAlpha=i/trail.length*0.35;c.beginPath();c.moveTo(a.x/FP,a.y/FP);c.lineTo(b.x/FP,b.y/FP);c.stroke();}c.globalAlpha=1;
  }
  stamp(c,'coin',BALL_R*2,BALL_R*2,state.ball.x/FP-BALL_R,state.ball.y/FP-BALL_R,coin);
  const age=state.tick-state.flashTick;
  if(state.flashKind===2&&state.failedBall&&age<20) {
    c.globalAlpha=1-age/20;stamp(c,'coin',14,14,state.failedBall.x/FP-7,state.failedBall.y/FP-7,coin);
    if(inkFailedOnBlock(state)){c.fillStyle=RED;c.globalAlpha=(1-age/20)*0.7;c.beginPath();c.arc(state.failedBall.x/FP,state.failedBall.y/FP,7,0,Math.PI*2);c.fill();}c.globalAlpha=1;
  }
  // Left side empties first; the surviving right-hand rainbow is clipped, not rescaled.
  const remaining=Math.max(0,Math.min(1,state.ink/(inkBudget(state.level)*FP)));
  c.fillStyle=EMPTY;c.fillRect(272,12,104,12);
  c.save();c.beginPath();c.rect(274+100*(1-remaining),14,100*remaining,8);c.clip();
  const meter=sprite('meter',100,8,m=>{m.fillStyle=rainbow(m,0,0,100,0,0,100);m.fillRect(0,0,100,8);});
  if(meter)c.drawImage(meter,274,14,100,8);c.restore();
  for(let i=0;i<INK_FAILS;i++){c.fillStyle=i<state.fails?RED:EMPTY;c.beginPath();c.arc(228+i*14,18,5,0,Math.PI*2);c.fill();}
  c.fillStyle=TEXT;c.font="bold 16px 'JetBrains Mono', ui-monospace, monospace";c.textAlign='left';c.textBaseline='alphabetic';c.fillText(`Level ${Math.min(state.level+1,INK_LEVELS)} / ${INK_LEVELS}`,12,22);
  c.restore();
}
/** Fixed intro art shares the same sprites; no gameplay inputs or demo log changes. */
export function drawInkRainbowExample(c:CanvasRenderingContext2D):void {
  c.fillStyle=SKY;c.fillRect(0,0,168,130);
  c.fillStyle=GRASS;c.beginPath();c.moveTo(0,127);c.quadraticCurveTo(90,113,168,127);c.lineTo(168,130);c.lineTo(0,130);c.fill();
  c.save();c.translate(30,0);c.scale(0.75,0.75);stamp(c,'cloud',48,26,0,0,cloud);c.restore();
  stamp(c,'coin',14,14,41,16,coin);
  c.fillStyle=RED;c.fillRect(30,58,40,3);
  c.strokeStyle=rainbow(c,36,34,132,94,0,113);c.lineCap='round';c.lineWidth=3;c.beginPath();c.moveTo(36,34);c.lineTo(132,94);c.stroke();
  c.save();c.translate(134,104);c.scale(0.5,0.5);drawPot(c,0,0,false);c.restore();
}
export const inkBridgeArtGame={...inkBridgeGame,draw:drawInkBridgeArt};
