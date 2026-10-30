import { successFrame, successHud } from "./success.renderer";
import { drawArtSprite } from "./sprites.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { SLICE_FX, sliceFxFor } from "./arcadeFxGames.renderer";
import type { ArcadeFxSpec } from "./arcadeFx.renderer";
/** Slice Kitchen art only. World transform, collision radii and state are authoritative. */
import type { CanvasSize } from './engine';
import { TICKS_PER_SECOND } from './engine';
import { SLICE_BLADE_V4, sliceFrenzyOn, sliceGame, sliceGameFor, sliceMayoOn, sliceMayoWeight, sliceObjectAt, sliceSlowOn, sliceSuppressed,
  SLICE_SPECIAL_MAYO,
  SLICE_COMBO_TICKS, SLICE_COMBO_FLASH_TICKS, SLICE_FLASH_TICKS, SLICE_HALVES_TICKS, SLICE_HUD_H, SLICE_R,
  SLICE_SPECIAL_FRENZY, SLICE_SPECIAL_NONE, SLICE_SPECIAL_R, SLICE_SPECIAL_SLOW,
  SLICE_WORLD_W, SLICE_RAINBOW, SLICE_SILVER, sliceWorldH, type SliceState,
  SLICE_V9_GOLD, SLICE_V9_TICKET_TICKS, sliceRadius, sliceTicketAt, sliceTicketsDone, sliceV9Bonus, sliceWorldW,
  SLICE_V11_TICKET_BREADS, sliceV11Parts } from './slice';
import { artCanvas, artContext, type ArtCanvas } from './cache.renderer';
import { reducedMotion } from './art.renderer';
import { FX_PARTICLE_LIMIT } from '../fx/limits';

// Kitchen palette belongs to the renderer, never to the simulation's colour table.
// The onion's skin is light green #CFEDE6 since Joe's phone notes (27 Oct 2026; look only, every revision).
const K = { ink:'#232721', board:'#AC784B', grain:'#855936', edge:'#70492F', tile:'#DCE9E7',
  grout:'#A5BFBA', counter:'#648985', white:'#FFF9EB', gold:'#F5C542', silver:SLICE_SILVER,
  bagel:'#F4BF61', cabbage:'#56B63B', onion:'#CFEDE6', meat:'#925237', tomato:'#F52C35', flesh:'#FFF0BE',
  cabbageLight:'#B7E47C', cabbageDark:'#287C35', onionGreen:'#76AB58', onionFace:'#F9FBEA', meatFace:'#CB8067', fat:'#F5DCC2',
  seeds:'#FFE18E', leaf:'#275C27', mustard:'#FFDC24', chilli:'#ED202F', glow:'rgba(255,38,45,0.45)',
  mayo:'#FFF6DC', mayoShade:'#E9DDB8', mayoCap:'#3F7FD8', knot:'#6E4428', groove:'#93623C' };
export const SLICE_FOODS = ['bagel','cabbage','onion','meat'] as const;
type Food = typeof SLICE_FOODS[number];
const colours: Record<Food,string> = {bagel:K.bagel,cabbage:K.cabbage,onion:K.onion,meat:K.meat};
const foodOf = (colour:number):Food => SLICE_FOODS[colour % SLICE_FOODS.length] ?? 'bagel';
const cache = new Map<string,ArtCanvas>();
export function sprite(key:string,size:number,paint:(c:CanvasRenderingContext2D,s:number)=>void):ArtCanvas|null {
  const px=Math.max(4,Math.round(size)); const id=`${key}@${px}`;
  const old=cache.get(id); if(old) return old;
  const canvas=artCanvas(px,px); const c=canvas ? artContext(canvas):null;
  if(!canvas || !c) return null;
  if(cache.size>=96) cache.clear();
  paint(c as CanvasRenderingContext2D,px);if(key!=='chilli-glow')shadeSprite(c as CanvasRenderingContext2D,px);cache.set(id,canvas);return canvas;
}
/**
 * Polish G: kitchen light on every round stamp, only over pixels already painted
 * (source-atop), so the silhouette and its extents never change: a soft lamp
 * highlight upper left, a gentle shade lower right and a small specular glint.
 */
function shadeSprite(c:CanvasRenderingContext2D,size:number):void {
  const r=size/2;
  c.save();c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='source-atop';
  const g=c.createRadialGradient(r*.62,r*.55,r*.05,r,r,r*1.05);
  g.addColorStop(0,'rgba(255,250,235,0.26)');g.addColorStop(.55,'rgba(255,250,235,0)');g.addColorStop(1,'rgba(40,20,8,0.28)');
  c.fillStyle=g;c.fillRect(0,0,size,size);
  // Polish A3: a glossy shine (soft sheen, bright glint, second small glint) and a warm rim light lower right.
  const sheen=c.createRadialGradient(r*.62,r*.5,0,r*.62,r*.5,r*.45);sheen.addColorStop(0,'rgba(255,255,255,0.32)');sheen.addColorStop(1,'rgba(255,255,255,0)');
  c.fillStyle=sheen;c.fillRect(0,0,size,size);
  c.fillStyle='rgba(255,255,255,0.75)';c.beginPath();c.ellipse(r*.6,r*.48,r*.17,r*.085,-.6,0,Math.PI*2);c.fill();
  c.fillStyle='rgba(255,255,255,0.5)';c.beginPath();c.arc(r*.86,r*.36,r*.045,0,Math.PI*2);c.fill();
  c.strokeStyle='rgba(255,214,150,0.35)';c.lineWidth=r*.07;c.beginPath();c.arc(r,r,r*.86,.15,1.35);c.stroke();
  c.restore();
}
function circle(c:CanvasRenderingContext2D,x:number,y:number,r:number,fill:string) {
  c.fillStyle=fill;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
}
/** Food outer circle is the exact collision envelope; inner details convey the ingredient. */
export function paintFood(kind:Food,cut=false) {
  return (c:CanvasRenderingContext2D,size:number)=>{
    const r=size/2;c.translate(r,r);
    circle(c,0,0,r,K.ink);circle(c,0,0,r*.94,colours[kind]);
    if(cut) {
      circle(c,0,0,r*.80,kind==='meat'?K.meatFace:kind==='cabbage'?K.cabbageLight:kind==='onion'?K.onionFace:K.flesh);
      if(kind==='onion') {
        c.strokeStyle=K.onionGreen;c.lineWidth=r*.045;
        for(const rr of [.22,.43,.64,.79]) {c.beginPath();c.arc(0,0,r*rr,0,Math.PI*2);c.stroke();}
      } else if(kind==='cabbage') {
        c.strokeStyle=K.cabbageDark;c.lineWidth=r*.055;
        for(let i=0;i<7;i++){const a=i*Math.PI*2/7;c.save();c.rotate(a);c.beginPath();c.moveTo(0,r*.72);c.bezierCurveTo(-r*.65,r*.35,r*.55,-r*.2,0,-r*.72);c.stroke();c.restore();}
        circle(c,0,r*.55,r*.16,K.flesh);
      } else if(kind==='meat') {
        c.strokeStyle=K.fat;c.lineWidth=r*.07;c.lineCap='round';
        for(const y of [-.38,.05,.42]){c.beginPath();c.moveTo(-r*.63,r*y);c.bezierCurveTo(-r*.2,r*(y-.18),r*.2,r*(y+.23),r*.62,r*y);c.stroke();}
        circle(c,r*.22,-r*.12,r*.19,K.fat);circle(c,r*.22,-r*.12,r*.08,K.meatFace);
      }
    } else if(kind==='cabbage') {
      c.strokeStyle=K.cabbageDark;c.lineWidth=r*.09;
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5;c.save();c.rotate(a);c.beginPath();c.ellipse(0,-r*.22,r*.38,r*.61,.3,0,Math.PI*2);c.stroke();c.restore();}
      c.strokeStyle=K.cabbageLight;c.lineWidth=r*.06;c.beginPath();c.moveTo(0,r*.75);c.quadraticCurveTo(-r*.22,0,r*.1,-r*.65);c.stroke();
    } else if(kind==='onion') {
      c.strokeStyle=K.onionGreen;c.lineWidth=r*.075;
      for(const x of [-.5,-.22,.22,.5]) {c.beginPath();c.moveTo(0,-r*.8);c.quadraticCurveTo(r*x*1.7,0,0,r*.8);c.stroke();}
      c.fillStyle=K.onionGreen;c.beginPath();c.moveTo(-r*.14,-r*.7);c.lineTo(0,-r*.91);c.lineTo(r*.14,-r*.7);c.closePath();c.fill();
    } else if(kind==='meat') {
      c.strokeStyle=K.fat;c.lineWidth=r*.12;c.beginPath();c.arc(0,0,r*.76,-.8,2.8);c.stroke();
      c.strokeStyle=K.ink;c.lineWidth=r*.075;c.lineCap='round';
      for(const y of [-.4,0,.4]) {c.beginPath();c.moveTo(-r*.43,r*(y+.12));c.lineTo(r*.43,r*(y-.12));c.stroke();}
    }
    if(kind==='bagel') {
      // Transparent hole reads as a ring on the chopping board and on the cut face.
      c.globalCompositeOperation='destination-out';circle(c,0,0,r*.29,K.white);c.globalCompositeOperation='source-over';
      c.strokeStyle=K.ink;c.lineWidth=r*.055;c.beginPath();c.arc(0,0,r*.30,0,Math.PI*2);c.stroke();
      if(!cut) for(let i=0;i<12;i++){const a=i*2.4;circle(c,Math.cos(a)*r*.64,Math.sin(a)*r*.64,r*.035,K.white);}
    }
  };
}
/** Matching rounded bottles, filling the full diameter rather than disguising a smaller target. */
function paintBottle(mustard:boolean) {
  return (c:CanvasRenderingContext2D,size:number)=>{
    const r=size/2;c.translate(r,r);
    circle(c,0,0,r,K.ink);circle(c,0,0,r*.94,mustard?K.mustard:K.tomato);
    c.fillStyle=K.white;c.beginPath();c.roundRect(-r*.32,-r*.90,r*.64,r*.38,r*.08);c.fill();
    c.fillStyle=K.white;c.beginPath();c.roundRect(-r*.62,-r*.13,r*1.24,r*.72,r*.12);c.fill();
    circle(c,0,r*.2,r*.20,mustard?K.mustard:K.tomato);
    c.strokeStyle=K.ink;c.lineWidth=r*.06;c.beginPath();c.moveTo(-r*.25,r*.48);c.lineTo(r*.25,r*.48);c.stroke();
  };
}
/**
 * Mayonnaise ("Squeeze"): cream, never red or yellow, and its own silhouette — a
 * tall ribbed squeeze bottle with a blue cap and star nozzle, not the ketchup and
 * mustard bottles' wide labelled shape. The outer circle is the collision envelope.
 */
function paintMayo(c:CanvasRenderingContext2D,size:number) {
  const r=size/2;c.translate(r,r);
  circle(c,0,0,r,K.ink);circle(c,0,0,r*.94,K.mayoShade);
  // Tall bottle body.
  c.fillStyle=K.mayo;c.beginPath();c.roundRect(-r*.42,-r*.42,r*.84,r*1.22,r*.3);c.fill();
  c.strokeStyle=K.ink;c.lineWidth=r*.06;c.stroke();
  // Squeeze ribs.
  c.strokeStyle=K.mayoShade;c.lineWidth=r*.07;
  for(const y of [-.12,.12,.36]){c.beginPath();c.moveTo(-r*.3,r*y);c.lineTo(r*.3,r*y);c.stroke();}
  // Blue cap and star nozzle.
  c.fillStyle=K.mayoCap;c.beginPath();c.roundRect(-r*.3,-r*.66,r*.6,r*.28,r*.06);c.fill();
  c.fillStyle=K.white;c.beginPath();
  for(let k=0;k<10;k++){const a=-Math.PI/2+k*Math.PI/5,d=k%2?r*.08:r*.18;const x=Math.cos(a)*d,y=-r*.78+Math.sin(a)*d;if(k)c.lineTo(x,y);else c.moveTo(x,y);}
  c.closePath();c.fill();
}
/** Chilli's red circular outer skin preserves the entire hazardous collision body. */
function paintChilli(c:CanvasRenderingContext2D,size:number) {
  const r=size/2;c.translate(r,r);circle(c,0,0,r,K.ink);circle(c,0,0,r*.94,K.chilli);
  c.fillStyle='#A10A22';c.beginPath();c.moveTo(-r*.72,-r*.4);c.bezierCurveTo(-r*.83,r*.48,r*.17,r*.94,r*.7,r*.48);
  c.bezierCurveTo(r*.05,r*.6,-r*.46,r*.06,-r*.72,-r*.4);c.fill();
  c.strokeStyle=K.white;c.lineWidth=r*.09;c.lineCap='round';c.beginPath();c.moveTo(r*.5,-r*.4);c.quadraticCurveTo(r*.72,0,r*.45,r*.3);c.stroke();
  c.strokeStyle=K.leaf;c.lineWidth=r*.17;c.beginPath();c.moveTo(0,-r*.68);c.quadraticCurveTo(r*.24,-r*.5,r*.3,-r*.84);c.stroke();
}
/**
 * A soft oval cast shadow (painted once per size, on its own wide surface, never a square stamp: it is
 * scenery, not a collision silhouette; drawn under a whole food, offset toward the board's lower right).
 */
const SHADOW_SQUASH=.7;
function shadowSprite(size:number):ArtCanvas|null {
  const w=Math.max(4,Math.round(size)),h=Math.max(3,Math.round(w*SHADOW_SQUASH)),id=`food-shadow@${w}x${h}`;
  const old=cache.get(id); if(old) return old;
  const canvas=artCanvas(w,h); const c=canvas ? artContext(canvas):null;
  if(!canvas || !c) return null;
  if(cache.size>=96) cache.clear();
  const r=w/2;c.save();c.scale(1,h/w);const g=c.createRadialGradient(r,r,r*.35,r,r,r);g.addColorStop(0,'rgba(40,18,4,0.34)');g.addColorStop(.65,'rgba(40,18,4,0.16)');g.addColorStop(1,'rgba(40,18,4,0)');
  c.fillStyle=g;c.fillRect(0,0,w,w);c.restore();cache.set(id,canvas);return canvas;
}
function paintGlow(c:CanvasRenderingContext2D,size:number) {
  const r=size/2,g=c.createRadialGradient(r,r,r*.72,r,r,r);g.addColorStop(0,'rgba(255,38,45,0)');g.addColorStop(.84,K.glow);g.addColorStop(1,'rgba(255,38,45,0)');c.fillStyle=g;c.fillRect(0,0,size,size);
}
/** A fixed hash for the board's scattered details (art only, never a sim's PRNG). */
const bh=(i:number,salt:number)=>{let h=(i*374761393+salt*668265263)>>>0;h=Math.imul(h^(h>>>13),1274126177)>>>0;return ((h^(h>>>16))>>>0)/4294967296;};
/** Polish A3: three oiled planks, each with its own tone and flowing grain. */
const PLANKS=['#A87448','#B88554','#A06B42'] as const;
function paintBackground(c:CanvasRenderingContext2D,H:number,W:number=SLICE_WORLD_W) {
  const T=SLICE_HUD_H,PW=W/3;
  c.fillStyle=K.board;c.fillRect(0,0,W,H);
  for(let p=0;p<3;p++){
    const x0=p*PW;c.save();c.beginPath();c.rect(x0,T,PW,H-T);c.clip();
    // Plank base: its own tone, a little lighter along its middle (a slightly crowned face).
    const base=c.createLinearGradient(x0,0,x0+PW,0);base.addColorStop(0,'rgba(60,30,10,0.10)');base.addColorStop(.45,'rgba(255,230,190,0.05)');base.addColorStop(1,'rgba(60,30,10,0.12)');
    c.fillStyle=PLANKS[p]!;c.fillRect(x0,T,PW,H-T);c.fillStyle=base;c.fillRect(x0,T,PW,H-T);
    // Long grain: wavy lines running the plank's length, closer and darker in bands.
    const lines=34;
    for(let i=0;i<lines;i++){
      const gx=x0+4+(i+bh(i,p+1)*.8)*(PW-8)/lines,amp=2+bh(i,p+11)*5,ph=bh(i,p+21)*6.28,dark=bh(i,p+31);
      c.strokeStyle=dark>.6?'rgba(98,58,30,0.42)':dark>.25?'rgba(120,74,40,0.26)':'rgba(255,228,186,0.12)';
      c.lineWidth=dark>.8?1.1:.6;c.beginPath();c.moveTo(gx,T);
      for(let y=T;y<=H+40;y+=40)c.quadraticCurveTo(gx+Math.sin(ph+y/90)*amp*1.6,y+20,gx+Math.sin(ph+(y+40)/90)*amp,y+40);
      c.stroke();
    }
    // Tone streaks along the grain.
    for(let i=0;i<14;i++){const y=T+bh(i,p+41)*(H-T),x=x0+bh(i,p+51)*PW,l=80+bh(i,p+61)*180;
      c.fillStyle=i%3?'rgba(70,36,14,0.08)':'rgba(255,226,180,0.07)';c.fillRect(x-1.5,y-l/2,3+(i%3),l);}
    c.restore();
  }
  // Plank seams: a dark glue line with a lit lip on its right.
  for(let p=1;p<3;p++){const x=p*PW;c.fillStyle='rgba(48,24,8,0.55)';c.fillRect(x-1,T,2,H-T);c.fillStyle='rgba(255,232,196,0.2)';c.fillRect(x+1,T,1,H-T);}
  // Knots: a dark heart, rings, and the grain bending round them.
  for(const [x,y,rr] of [[W*.22,T+150,9],[W*.74,T+330,7],[W*.48,H-90,6],[W*.86,T+70,5],[W*.14,T+470,6]] as const){
    if(y>H-30)continue;
    for(const k of [3.6,2.8,2.1,1.5]){c.strokeStyle=`rgba(96,58,30,${0.18+0.12*(3.6-k)})`;c.lineWidth=.9;c.beginPath();c.ellipse(x,y,rr*k*.62,rr*k,0,0,Math.PI*2);c.stroke();}
    const g=c.createRadialGradient(x-rr*.2,y-rr*.3,1,x,y,rr);g.addColorStop(0,'#3E2312');g.addColorStop(.7,K.knot);g.addColorStop(1,'rgba(110,68,40,0.6)');
    c.fillStyle=g;c.beginPath();c.ellipse(x,y,rr*.62,rr,0,0,Math.PI*2);c.fill();
    c.fillStyle='rgba(30,14,4,0.55)';c.beginPath();c.ellipse(x+rr*.08,y+rr*.15,rr*.18,rr*.32,0,0,Math.PI*2);c.fill();
  }
  // Knife scratches: pale scores, each with a dark lower lip (light from above).
  c.lineCap='round';
  for(let i=0;i<44;i++){
    const x=14+bh(i,71)*(W-28),y=T+30+bh(i,72)*(H-T-70),a=(bh(i,73)*70-35)*Math.PI/180+(i%4===0?Math.PI/2:0),l=10+bh(i,74)*30;
    const dx=Math.cos(a)*l,dy=Math.sin(a)*l;
    c.strokeStyle='rgba(60,30,12,0.24)';c.lineWidth=1;c.beginPath();c.moveTo(x+.6,y+.8);c.lineTo(x+dx+.6,y+dy+.8);c.stroke();
    c.strokeStyle=i%5===0?'rgba(255,238,210,0.34)':'rgba(255,236,205,0.2)';c.lineWidth=.7;c.beginPath();c.moveTo(x,y);c.lineTo(x+dx,y+dy);c.stroke();
  }
  // End-grain flecks.
  c.fillStyle='rgba(60,32,14,0.22)';for(let i=0;i<160;i++){c.fillRect(bh(i,81)*W,T+bh(i,82)*(H-T),1.4,.8);}
  // Juice groove round the board's edge, and a hanging hole at the bottom.
  c.strokeStyle='rgba(90,54,28,0.75)';c.lineWidth=3;c.beginPath();c.roundRect(9,T+9,W-18,H-T-18,14);c.stroke();
  c.strokeStyle='rgba(255,236,205,0.22)';c.lineWidth=1;c.beginPath();c.roundRect(10.5,T+10.5,W-21,H-T-21,13);c.stroke();
  const hole=c.createRadialGradient(W/2,H-23,1,W/2,H-22,14);hole.addColorStop(0,'#3A2212');hole.addColorStop(1,K.edge);
  c.fillStyle=hole;c.beginPath();c.ellipse(W/2,H-22,14,5,0,0,Math.PI*2);c.fill();
  c.strokeStyle='rgba(255,232,196,0.25)';c.lineWidth=.8;c.beginPath();c.ellipse(W/2,H-21.4,14,5,0,.2,Math.PI-.2);c.stroke();
  // Warm overhead light: a lamp above the board's upper middle, falling off to the corners.
  const lamp=c.createRadialGradient(W*.5,T+H*.22,10,W*.5,T+H*.3,Math.max(W,H)*.7);
  lamp.addColorStop(0,'rgba(255,214,150,0.22)');lamp.addColorStop(.45,'rgba(255,200,130,0.08)');lamp.addColorStop(1,'rgba(255,200,130,0)');
  c.fillStyle=lamp;c.fillRect(0,T,W,H-T);
  const vig=c.createRadialGradient(W/2,(H+T)/2,Math.min(W,H)*.35,W/2,(H+T)/2,Math.max(W,H)*.7);
  vig.addColorStop(0,'rgba(40,20,6,0)');vig.addColorStop(1,'rgba(40,20,6,0.3)');c.fillStyle=vig;c.fillRect(0,T,W,H-T);
  // Bevelled edge: lit top and left faces, shaded right and bottom (soft ramps, no hard rule).
  const bev=(x0:number,y0:number,x1:number,y1:number,col:string,rx:number,ry:number,rw:number,rh:number)=>{const g=c.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,col);g.addColorStop(1,col.replace(/[\d.]+\)$/,'0)'));c.fillStyle=g;c.fillRect(rx,ry,rw,rh);};
  bev(0,T+2,0,T+12,'rgba(255,236,200,0.30)',0,T+2,W,10);
  bev(0,0,8,0,'rgba(255,236,200,0.24)',0,T,8,H-T);
  bev(W,0,W-9,0,'rgba(36,18,6,0.34)',W-9,T,9,H-T);
  bev(0,H-4,0,H-16,'rgba(36,18,6,0.30)',0,H-16,W,12);
  // The kitchen wall behind the HUD: glazed subway tiles in a running bond.
  const TH=T/2,TW=39;
  c.fillStyle=K.grout;c.fillRect(0,0,W,T);
  for(let row=0;row<2;row++)for(let x=row?-TW/2:0;x<W;x+=TW){
    const y=row*TH,g=c.createLinearGradient(0,y,0,y+TH);g.addColorStop(0,'#EEF6F4');g.addColorStop(.5,K.tile);g.addColorStop(1,'#C4D6D2');
    c.fillStyle=g;c.beginPath();c.roundRect(x+1,y+1,TW-2,TH-2,3);c.fill();
    c.fillStyle='rgba(255,255,255,0.55)';c.fillRect(x+4,y+2.5,TW-12,1.5);
  }
  // Warm lamp glow on the wall too.
  const wl=c.createRadialGradient(W*.5,-10,4,W*.5,-10,W*.6);wl.addColorStop(0,'rgba(255,214,150,0.25)');wl.addColorStop(1,'rgba(255,214,150,0)');c.fillStyle=wl;c.fillRect(0,0,W,T);
  c.fillStyle=K.counter;c.fillRect(0,H-4,W,4);c.fillStyle=K.edge;c.fillRect(0,T,W,2);
  // Small cropped towel on outer margin, knife block and utensils in background header.
  c.fillStyle=K.white;c.fillRect(W-7,T+6,7,50);c.strokeStyle=K.counter;c.lineWidth=1;
  for(let y=T+10;y<T+56;y+=7){c.beginPath();c.moveTo(W-7,y);c.lineTo(W,y);c.stroke();}
  const kb=c.createLinearGradient(W-45,0,W-14,0);kb.addColorStop(0,'#8A5A36');kb.addColorStop(1,K.edge);
  c.fillStyle=kb;c.fillRect(W-45,8,31,28);c.strokeStyle=K.silver;c.lineWidth=3;
  for(let x=W-39;x<W-15;x+=9){c.beginPath();c.moveTo(x,8);c.lineTo(x-3,0);c.stroke();}
  c.strokeStyle=K.ink;c.lineWidth=2;c.beginPath();c.moveTo(10,5);c.lineTo(10,32);c.stroke();circle(c,10,5,4,K.silver);
}
function background(H:number,W:number=SLICE_WORLD_W):ArtCanvas|null {
  // sliceRev 6: one board per world height (the taller board's plank lines run its whole height); sliceRev 9: and width.
  const key=W===SLICE_WORLD_W?`kitchen-background:${H}`:`kitchen-background:${W}x${H}`;const old=cache.get(key);if(old)return old;
  const canvas=artCanvas(W,H),c=canvas?artContext(canvas):null;
  if(!canvas||!c)return null;paintBackground(c as CanvasRenderingContext2D,H,W);cache.set(key,canvas);return canvas;
}
interface Cut {angle:number;offset:number}
interface Memo {tick:number;trail:{seg:readonly[number,number,number,number];at:number}[];cuts:Map<number,Cut>}
const memos=new WeakMap<object,Memo>();
/** The game's drawing through the shared success layer (presentation only). */
export function drawSliceArt(ctx: CanvasRenderingContext2D, state: SliceState, size: CanvasSize): void {
  arcadeFx(ctx, state.v9 ? v9Fx(sliceWorldW(state), sliceWorldH(state)) : sliceFxFor(state), state, () => drawSliceArtWorld(ctx, state, size), size);
}

/** sliceRev 9: the shared success layer mapped onto the larger board (one spec per board size). */
const v9Specs=new Map<string,ArcadeFxSpec<SliceState>>();
function v9Fx(W:number,H:number):ArcadeFxSpec<SliceState> {
  const key=`${W}x${H}`;let spec=v9Specs.get(key);
  if(!spec)v9Specs.set(key,(spec={...SLICE_FX,width:W,height:H}));
  return spec;
}

function drawSliceArtWorld(ctx:CanvasRenderingContext2D,state:SliceState,size:CanvasSize):void {
  // sliceRev 6: the taller board (the original 620 otherwise); sliceRev 9: the larger board.
  const SLICE_WORLD_H=sliceWorldH(state);
  const SLICE_WORLD_W=sliceWorldW(state);
  const sx=size.width/SLICE_WORLD_W,sy=size.height/SLICE_WORLD_H;
  const tr=typeof ctx.getTransform==='function'?ctx.getTransform():null;
  const dpr=tr?Math.max(1,Math.min(2,Math.hypot(tr.a,tr.b))):1;
  const px=SLICE_R*2*Math.max(sx,sy)*dpr,now=typeof performance==='undefined'?0:performance.now(),still=reducedMotion();
  let memo=memos.get(ctx);if(!memo||state.tick<memo.tick){memo={tick:state.tick,trail:[],cuts:new Map()};memos.set(ctx,memo);}
  if(state.swipe&&state.tick!==memo.tick){memo.trail.push({seg:state.swipe,at:now});
    const [x1,y1,x2,y2]=state.swipe,angle=Math.atan2(y2-y1,x2-x1);
    state.slicedAt.forEach((t,i)=>{if(t>memo.tick&&!memo.cuts.has(i)){
      const object=state.objects[i],at=object?sliceObjectAt(object,t,state.slowFrom,state.mayo):null;
      const r=object?sliceRadius(object):SLICE_R;
      const offset=at?Math.max(-r+1,Math.min(r-1,((at.x/256-x1)*-Math.sin(angle)+(at.y/256-y1)*Math.cos(angle)))):0;
      memo.cuts.set(i,{angle,offset});
    }});
  }
  memo.tick=state.tick;memo.trail=memo.trail.filter(e=>now-e.at<110).slice(-6);
  ctx.save();ctx.scale(sx,sy);const bg=background(SLICE_WORLD_H,SLICE_WORLD_W);if(bg)ctx.drawImage(bg as CanvasImageSource,0,0,SLICE_WORLD_W,SLICE_WORLD_H);else paintBackground(ctx,SLICE_WORLD_H,SLICE_WORLD_W);
  const latest=state.slicedAt.reduce((best,t,i)=>t>(state.slicedAt[best]??0)?i:best,0),object=state.objects[latest];
  const cutAt=object?sliceObjectAt(object,state.slicedAt[latest]??state.tick,state.slowFrom,state.mayo):null;
  drawSqueeze(ctx,state,still);
  successFrame(ctx,{id:'slice',tick:state.tick,count:state.slices,eventTick:state.slicedAt[latest],colour:object?colours[foodOf(object.colour)]:K.tomato,width:SLICE_WORLD_W,height:SLICE_WORLD_H,point:{x:cutAt?cutAt.x/256:195,y:cutAt?cutAt.y/256:SLICE_WORLD_H/2,shape:'splat'},hud:{x:20,y:14,text:`Sliced ${state.slices}`}});
  let particles=0;
  for(let i=0;i<state.objects.length;i++) {
    const o=state.objects[i];if(!o||sliceSuppressed(state,o))continue;
    const slicedAt=state.slicedAt[i]??0,r=sliceRadius(o),kind=foodOf(o.colour);
    const mayo=o.special===SLICE_SPECIAL_MAYO;
    // sliceRev 9: golden fruit (a tiny gilded apple); every food's stamp is its own sim diameter.
    const gold=!!state.v9&&!o.special&&!o.bomb&&o.colour===SLICE_V9_GOLD;
    const stamp=sprite(o.bomb?'chilli':mayo?'mayo':o.special===SLICE_SPECIAL_FRENZY?'ketchup':o.special===SLICE_SPECIAL_SLOW?'mustard':gold?'golden':kind,px*r/SLICE_R,
      o.bomb?paintChilli:mayo?paintMayo:o.special?paintBottle(o.special===SLICE_SPECIAL_SLOW):gold?paintGolden(false):paintFood(kind));
    if(!stamp)continue;
    if(slicedAt){const age=state.tick-slicedAt;if(age>SLICE_HALVES_TICKS)continue;
      const at=sliceObjectAt(o,slicedAt,state.slowFrom,state.mayo);if(!at)continue;
      const cx=at.x/256,cy=at.y/256+(still?0:age*age/20),spread=still?3:3+age;
      const cut=memo.cuts.get(i)??{angle:0,offset:0};
      const face=!o.bomb&&!o.special?(gold?sprite('golden-face',px*r/SLICE_R,paintGolden(true)):sprite(`${kind}-face`,px*r/SLICE_R,paintFood(kind,true))):stamp;
      ctx.globalAlpha=Math.max(0,1-age/SLICE_HALVES_TICKS);
      for(const side of [-1,1]) {
        ctx.save();ctx.translate(cx-Math.sin(cut.angle)*spread*side,cy+Math.cos(cut.angle)*spread*side);ctx.rotate(cut.angle);
        ctx.beginPath();ctx.rect(-r,side<0?-r:-cut.offset,r*2,side<0?r-cut.offset:r+cut.offset);ctx.clip();
        ctx.rotate(-cut.angle);ctx.drawImage(stamp as CanvasImageSource,-r,-r,2*r,2*r);
        // Exposed clean face follows the actual cut chord, with seeded-free render memo fallback.
        ctx.rotate(cut.angle);ctx.beginPath();ctx.rect(-r,-cut.offset-5,r*2,10);ctx.clip();ctx.rotate(-cut.angle);
        if(face)ctx.drawImage(face as CanvasImageSource,-r,-r,2*r,2*r);ctx.restore();
      }
      if(!still&&!o.bomb&&o.special===SLICE_SPECIAL_NONE)for(let p=0;p<6&&particles<FX_PARTICLE_LIMIT;p++,particles++){
        const a=p*Math.PI/3+i*.7,d=age*(1.1+p%3);circle(ctx,cx+Math.cos(a)*d,at.y/256+Math.sin(a)*d+age*age/30,kind==='bagel'?1.3:1.8,gold?K.gold:colours[kind]);
      }
      ctx.globalAlpha=1;continue;
    }
    const at=sliceObjectAt(o,state.tick,state.slowFrom,state.mayo);if(!at)continue;const cx=at.x/256,cy=at.y/256;
    const shade=shadowSprite(px*1.3);if(shade)ctx.drawImage(shade as CanvasImageSource,cx-r*1.15+3,cy-r*1.15*SHADOW_SQUASH+6,2.3*r,2.3*r*SHADOW_SQUASH);
    // Art pilot (Kitchen): food sprites fill the collision circle's square; code art when absent or for chillies.
    if(o.bomb||gold||!drawArtSprite(ctx,'kitchen',kind,cx-r,cy-r,2*r,2*r))ctx.drawImage(stamp as CanvasImageSource,cx-r,cy-r,2*r,2*r);
    // sliceRev 9: a soft gold glint round golden fruit (inside its circle) so the tiny target reads.
    if(gold){ctx.save();ctx.globalAlpha=still?.5:.4+.25*Math.sin(now/120+i);ctx.strokeStyle='#FFF4C2';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(cx,cy,r-1,0,Math.PI*2);ctx.stroke();ctx.restore();}
    if(o.special){const tint=mayo?K.white:o.special===SLICE_SPECIAL_SLOW?K.silver:SLICE_RAINBOW[Math.floor((still?0:now/110))%SLICE_RAINBOW.length]??K.tomato;
      ctx.globalAlpha=still?.28:.25+.16*Math.sin(now/140);ctx.strokeStyle=tint;ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,r-1,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
    }
    if(o.bomb){const glow=sprite('chilli-glow',px,paintGlow);if(glow)ctx.drawImage(glow as CanvasImageSource,cx-r,cy-r,2*r,2*r);
      // Fuse, spark and glow clipped to the hazard envelope; no inner warning icon or shrunken body.
      ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();
      ctx.strokeStyle=K.white;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(cx+r*.3,cy-r*.78);ctx.lineTo(cx+r*.23,cy-r*.91);ctx.stroke();
      circle(ctx,cx+r*.23,cy-r*.91,1.5,K.gold);
      if(!still)for(let p=0;p<3&&particles<FX_PARTICLE_LIMIT;p++,particles++){
        const t=(now/100+p*.33)%1;circle(ctx,cx+r*.23+Math.sin(p*2.4)*t*4,cy-r*.91+t*3,.7,K.white);
      }ctx.restore();
    }
  }
  ctx.lineCap='round';for(const e of memo.trail){const [x1,y1,x2,y2]=e.seg;ctx.globalAlpha=.65*(1-(now-e.at)/110);ctx.strokeStyle=K.silver;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
  ctx.globalAlpha=1;if(state.swipe){const[x1,y1,x2,y2]=state.swipe;ctx.strokeStyle=K.silver;ctx.lineWidth=state.tunec?2*SLICE_BLADE_V4:3;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.strokeStyle=K.white;ctx.lineWidth=.8;ctx.stroke();}
  if(state.flash>0){ctx.fillStyle=`rgba(224,80,60,${state.flash/SLICE_FLASH_TICKS*.45})`;ctx.fillRect(0,0,SLICE_WORLD_W,SLICE_WORLD_H);}
  drawSliceComboMeter(ctx,state);
  if(state.v9)drawSliceV9Hud(ctx,state,SLICE_WORLD_W,still,now);
  // Polish A3: the tiled wall shows through a light veil; the words sit on dark plates.
  ctx.fillStyle='rgba(18,12,8,0.3)';ctx.fillRect(0,0,SLICE_WORLD_W,SLICE_HUD_H);
  ctx.font='bold 20px ui-monospace, monospace';ctx.textBaseline='middle';
  const plate=(x:number,w:number)=>{ctx.fillStyle='rgba(22,14,9,0.72)';ctx.beginPath();ctx.roundRect(x,7,w,SLICE_HUD_H-14,8);ctx.fill();ctx.fillStyle='rgba(255,236,205,0.10)';ctx.fillRect(x+6,8,w-12,1);};
  const label=sliceFrenzyOn(state,state.tick)?'SAUCY':sliceSlowOn(state,state.tick)?'SIMMER':sliceMayoOn(state,state.tick)?'SQUEEZE':'';
  plate(10,ctx.measureText(`Sliced ${state.slices}`).width+20);
  if(label){const w=ctx.measureText(label).width+24;plate(SLICE_WORLD_W/2-w/2,w);}
  ctx.fillStyle='#F6EEE2';ctx.textAlign='left';successHud(ctx,'slice',state.tick,20,SLICE_HUD_H/2,()=>ctx.fillText(`Sliced ${state.slices}`,20,SLICE_HUD_H/2));ctx.textAlign='center';
  if(sliceFrenzyOn(state,state.tick))ctx.fillText('SAUCY',SLICE_WORLD_W/2,SLICE_HUD_H/2);else if(sliceSlowOn(state,state.tick))ctx.fillText('SIMMER',SLICE_WORLD_W/2,SLICE_HUD_H/2);
  else if(sliceMayoOn(state,state.tick))ctx.fillText('SQUEEZE',SLICE_WORLD_W/2,SLICE_HUD_H/2);
  if(!still&&state.comboFlash>0){ctx.strokeStyle=K.gold;ctx.globalAlpha=state.comboFlash/SLICE_COMBO_FLASH_TICKS;ctx.lineWidth=6;ctx.strokeRect(3,3,SLICE_WORLD_W-6,SLICE_WORLD_H-6);}
  ctx.restore();
}
export const sliceArtGame={...sliceGame,draw:drawSliceArt};
/** The art game for a stored puzzle.sliceRev (play, demos and reveals). */
const sliceArtGames=new Map<number,typeof sliceArtGame>();
/** One cached object per revision (stages reset the run when `game` changes identity). */
export function sliceArtGameFor(rev?:number|null):typeof sliceArtGame{
  const key=rev??0;let game=sliceArtGames.get(key);
  if(!game)sliceArtGames.set(key,(game={...sliceGameFor(rev),draw:drawSliceArt}));
  return game;
}

/** Rev 2 squeeze: a creamy swirl at the pull point while foods gather (presentation only). */
function drawSqueeze(ctx:CanvasRenderingContext2D,state:SliceState,still:boolean):void {
  const mayo=state.mayo??[];
  for(let k=0;k+2<mayo.length;k+=3){
    const since=state.tick-mayo[k]!;const w=sliceMayoWeight(since);if(w===0)continue;
    const x=mayo[k+1]!,y=mayo[k+2]!,a=w/1000,turn=still?0:since/9;
    ctx.save();ctx.globalAlpha=.5*a;
    const g=ctx.createRadialGradient(x,y,4,x,y,60);g.addColorStop(0,'rgba(255,246,220,0.9)');g.addColorStop(1,'rgba(255,246,220,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,60,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=.75*a;ctx.strokeStyle=K.mayo;ctx.lineWidth=4;ctx.lineCap='round';
    for(let arm=0;arm<3;arm++){ctx.beginPath();for(let t=0;t<=1.001;t+=.1){const rr=8+t*40,ang=turn+arm*2.094+t*2.4;const px=x+Math.cos(ang)*rr,py=y+Math.sin(ang)*rr;if(t)ctx.lineTo(px,py);else ctx.moveTo(px,py);}ctx.stroke();}
    ctx.restore();
  }
}

/** Qualifying-combo progress only: labels do not replace the sim's scoring multiplier. */
export function drawSliceComboMeter(ctx:CanvasRenderingContext2D,state:SliceState):void {
  if(state.v11){drawSliceComboMeterV11(ctx,state);return;}
  const left=Math.max(0,state.comboUntil-state.tick);
  const filled=state.comboLive&&left>0?Math.max(0,Math.min(3,state.streak)):0;
  const shown=Math.min(3,filled+1),remaining=Math.min(1,left/SLICE_COMBO_TICKS);
  const x0=14,y=SLICE_HUD_H+14,w=30,h=14,gap=4;
  ctx.save();drawComboTag(ctx,x0-6,y-6,3*(w+gap)-gap+12,h+44);ctx.lineWidth=1.5;ctx.strokeStyle=K.gold;
  ctx.font="bold 14px 'JetBrains Mono', monospace";ctx.textAlign='center';ctx.textBaseline='top';
  for(let i=0;i<shown;i++){
    const x=x0+i*(w+gap),amount=Math.max(0,Math.min(1,filled*remaining-i));
    if(amount>0){ctx.fillStyle=K.gold;ctx.fillRect(x+1,y+1,(w-2)*amount,h-2);}
    ctx.strokeRect(x,y,w,h);ctx.fillStyle='#F6EEE2';ctx.fillText(`x${i+1}`,x+w/2,y+h+4);
  }
  if(filled>0){ctx.save();ctx.fillStyle=K.chilli;ctx.beginPath();ctx.moveTo(x0+98,y+18);ctx.quadraticCurveTo(x0+85,y+8,x0+96,y-3);ctx.quadraticCurveTo(x0+96,y+6,x0+104,y+10);ctx.quadraticCurveTo(x0+111,y+18,x0+98,y+18);ctx.fill();ctx.fillStyle=K.mustard;circle(ctx,x0+99,y+12,3,K.mustard);ctx.restore();}
  if(filled>0){ctx.font="14px 'JetBrains Mono', monospace";ctx.fillText(`${Math.ceil(left/TICKS_PER_SECOND)}s`,x0+(shown*(w+gap)-gap)/2,y+h+21);}
  ctx.restore();
}

/**
 * sliceRev 11: no multiplier, so the meter is one bar (the same box): it fills while a combo is live and drains
 * over its 10 s, "COMBO" under it and the seconds left.
 */
function drawSliceComboMeterV11(ctx:CanvasRenderingContext2D,state:SliceState):void {
  const left=Math.max(0,state.comboUntil-state.tick),live=state.comboLive&&left>0;
  const x0=14,y=SLICE_HUD_H+14,w=30,h=14,gap=4,bw=3*(w+gap)-gap;
  ctx.save();drawComboTag(ctx,x0-6,y-6,bw+12,h+44);ctx.lineWidth=1.5;ctx.strokeStyle=K.gold;
  if(live){ctx.fillStyle=K.gold;ctx.fillRect(x0+1,y+1,(bw-2)*Math.min(1,left/SLICE_COMBO_TICKS),h-2);}
  ctx.strokeRect(x0,y,bw,h);
  ctx.font="bold 14px 'JetBrains Mono', monospace";ctx.textAlign='center';ctx.textBaseline='top';ctx.fillStyle='#F6EEE2';
  ctx.fillText(live?`COMBO ${Math.ceil(left/TICKS_PER_SECOND)}s`:'COMBO',x0+bw/2,y+h+4);
  ctx.restore();
}

/** Polish A3: the combo meter's dark walnut tag (grain, a lit top edge, two brass pins); same box as before. */
function drawComboTag(ctx:CanvasRenderingContext2D,x:number,y:number,w:number,h:number):void {
  ctx.save();ctx.beginPath();ctx.roundRect(x,y,w,h,8);
  const g=ctx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,'#4E301B');g.addColorStop(1,'#2A170B');ctx.fillStyle=g;ctx.fill();
  ctx.clip();ctx.lineWidth=.7;
  for(let i=0;i<7;i++){const gy=y+5+i*h/7;ctx.strokeStyle=i%2?'rgba(20,10,4,0.45)':'rgba(140,90,50,0.22)';ctx.beginPath();ctx.moveTo(x,gy);ctx.bezierCurveTo(x+w*.3,gy+(i%3)-1,x+w*.6,gy+2,x+w,gy-1);ctx.stroke();}
  ctx.fillStyle='rgba(255,226,180,0.16)';ctx.fillRect(x,y,w,1.5);ctx.fillStyle='rgba(0,0,0,0.3)';ctx.fillRect(x,y+h-2,w,2);
  ctx.restore();
  ctx.strokeStyle='rgba(0,0,0,0.45)';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(x+.5,y+.5,w-1,h-1,8);ctx.stroke();
  for(const px of [x+4,x+w-4]){circle(ctx,px,y+4,1.8,'#C9A04A');circle(ctx,px-.5,y+3.5,.7,'#FFF0C0');}
}

/** Fixed worked example uses the same cached food painters; never creates gameplay state. */
export function drawSliceKitchenExample(ctx:CanvasRenderingContext2D):void {
  ctx.save();ctx.fillStyle=K.board;ctx.fillRect(0,0,168,120);
  ctx.strokeStyle=K.grain;ctx.lineWidth=.5;
  for(let y=8;y<120;y+=12){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(168,y+2);ctx.stroke();}
  for(const [kind,x,y] of [['bagel',44,70],['cabbage',84,50],['meat',124,72]] as const){
    const s=sprite(kind,26,paintFood(kind));if(s)ctx.drawImage(s as CanvasImageSource,x-13,y-13,26,26);
  }
  const m=sprite('mayo',22,paintMayo);if(m)ctx.drawImage(m as CanvasImageSource,138,86,22,22);
  ctx.strokeStyle=K.silver;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(24,92);ctx.lineTo(146,40);ctx.stroke();ctx.restore();
}

/**
 * sliceRev 9: golden fruit, a tiny gilded apple. The outer circle is the exact collision envelope (as every
 * food's); the cut face is pale gold flesh with dark pips.
 */
function paintGolden(cut:boolean) {
  return (c:CanvasRenderingContext2D,size:number)=>{
    const r=size/2;c.translate(r,r);
    circle(c,0,0,r,'#6E4A10');
    const g=c.createRadialGradient(-r*.35,-r*.4,r*.05,0,0,r*.94);
    g.addColorStop(0,'#FFF6C8');g.addColorStop(.45,K.gold);g.addColorStop(1,'#B9811A');
    c.fillStyle=g;c.beginPath();c.arc(0,0,r*.94,0,Math.PI*2);c.fill();
    if(cut){circle(c,0,0,r*.72,'#FFF1B8');for(const a of [0,2.1,4.2])circle(c,Math.cos(a)*r*.28,Math.sin(a)*r*.28,r*.1,'#5A3A10');return;}
    // A short stalk and a leaf, inside the circle.
    c.strokeStyle='#5A3A10';c.lineWidth=r*.14;c.lineCap='round';c.beginPath();c.moveTo(0,-r*.5);c.lineTo(r*.08,-r*.82);c.stroke();
    c.fillStyle=K.leaf;c.beginPath();c.ellipse(r*.3,-r*.66,r*.24,r*.11,-.5,0,Math.PI*2);c.fill();
  };
}

const goldPops=new WeakMap<object,{pts:number;at:number;x:number;y:number;gain:number;tickets:number;ticketAt:number;dodges:number;dodgeAt:number}>();
/**
 * sliceRev 9's readouts (presentation only): the order ticket at the board's top right (the food it asks
 * for, how many in a row, the count so far and the time left on it), the bonus and dodge streak under the
 * combo tag, and a "+n" at a golden fruit cut.
 */
function drawSliceV9Hud(ctx:CanvasRenderingContext2D,state:SliceState,W:number,still:boolean,now:number):void {
  let memo=goldPops.get(ctx);
  const tickets=sliceTicketsDone(state);
  // sliceRev 11: the golden-fruit points are the standard's gold part (each fruit counts, combo or not).
  const v11=state.v11?sliceV11Parts(state):null;
  const goldPts=v11?v11.gold:(state.goldPts??0);
  if(!memo||memo.pts>goldPts||state.tick<5){memo={pts:goldPts,at:-Infinity,x:0,y:0,gain:0,tickets,ticketAt:-Infinity,dodges:state.dodges??0,dodgeAt:-Infinity};goldPops.set(ctx,memo);}
  if(goldPts>memo.pts){
    memo.gain=goldPts-memo.pts;memo.pts=goldPts;memo.at=now;
    // Where the last golden fruit was cut.
    let best=-1;state.slicedAt.forEach((t,i)=>{const o=state.objects[i];if(t&&o&&o.colour===SLICE_V9_GOLD&&!o.special&&(best<0||t>(state.slicedAt[best]??0)))best=i;});
    const o=best>=0?state.objects[best]:undefined,at=o?sliceObjectAt(o,state.slicedAt[best]!,state.slowFrom,state.mayo):null;
    memo.x=at?at.x/256:W/2;memo.y=at?at.y/256:SLICE_HUD_H+120;
  }
  if(tickets>memo.tickets){memo.tickets=tickets;memo.ticketAt=now;}
  if((state.dodges??0)>memo.dodges){memo.dodges=state.dodges??0;memo.dodgeAt=now;}
  ctx.save();
  // sliceRev 11: the bread ticket (three breads in a row, none missed) in the order ticket's place.
  if(state.v11){
    const got=Math.min(SLICE_V11_TICKET_BREADS,state.breadRun??0),done=state.breadTickets??0;
    const x=W-118,y=SLICE_HUD_H+8,w=108,h=58;
    ctx.fillStyle='#FFF9EB';ctx.beginPath();ctx.roundRect(x,y,w,h,6);ctx.fill();
    ctx.fillStyle='rgba(60,40,20,0.12)';ctx.fillRect(x,y+18,w,1);
    ctx.fillStyle='#232721';ctx.font="800 11px 'JetBrains Mono', monospace";ctx.textAlign='left';ctx.textBaseline='middle';
    ctx.fillText('TICKETS',x+7,y+10);
    ctx.textAlign='right';ctx.fillText(`${done}`,x+w-7,y+10);
    const icon=sprite('bagel',26,paintFood('bagel'));
    if(icon)ctx.drawImage(icon as CanvasImageSource,x+7,y+21,22,22);
    ctx.textAlign='left';ctx.font="800 14px 'JetBrains Mono', monospace";ctx.fillText(`×${SLICE_V11_TICKET_BREADS}`,x+33,y+32);ctx.font="700 9px 'JetBrains Mono', monospace";ctx.fillText('IN A ROW',x+60,y+33);
    for(let p=0;p<SLICE_V11_TICKET_BREADS;p++){ctx.fillStyle=p<got?K.gold:'rgba(60,40,20,0.25)';ctx.beginPath();ctx.arc(x+10+p*12,y+h-5,3.5,0,Math.PI*2);ctx.fill();}
    if(!still&&now-memo.ticketAt<600){ctx.globalAlpha=1-(now-memo.ticketAt)/600;ctx.strokeStyle=K.gold;ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(x-2,y-2,w+4,h+4,8);ctx.stroke();ctx.globalAlpha=1;}
  }
  // The order ticket.
  const k=state.v11?-1:sliceTicketAt(state,state.tick);
  if(k>=0){
    const t=state.tickets![k]!,got=Math.min(t.count,state.ticketCuts?.[k]??0),done=got>=t.count;
    const x=W-118,y=SLICE_HUD_H+8,w=108,h=58;
    ctx.fillStyle='#FFF9EB';ctx.beginPath();ctx.roundRect(x,y,w,h,6);ctx.fill();
    ctx.fillStyle='rgba(60,40,20,0.12)';ctx.fillRect(x,y+18,w,1);
    ctx.strokeStyle='rgba(60,40,20,0.35)';ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(x+4,y+h-12);ctx.lineTo(x+w-4,y+h-12);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#232721';ctx.font="800 11px 'JetBrains Mono', monospace";ctx.textAlign='left';ctx.textBaseline='middle';
    ctx.fillText(done?'ORDER UP!':'ORDER',x+7,y+10);
    ctx.textAlign='right';ctx.fillText(`#${k+1}`,x+w-7,y+10);
    const kind=SLICE_FOODS[t.kind%SLICE_FOODS.length]!,icon=sprite(kind,26,paintFood(kind));
    if(icon)ctx.drawImage(icon as CanvasImageSource,x+7,y+21,22,22);
    ctx.textAlign='left';ctx.font="800 14px 'JetBrains Mono', monospace";ctx.fillText(`×${t.count}`,x+33,y+32);ctx.font="700 9px 'JetBrains Mono', monospace";ctx.fillText('IN A ROW',x+60,y+33);
    // Count so far: one pip per food, gold when cut.
    for(let p=0;p<t.count;p++){ctx.fillStyle=p<got?K.gold:'rgba(60,40,20,0.25)';ctx.beginPath();ctx.arc(x+10+p*12,y+h-5,3.5,0,Math.PI*2);ctx.fill();}
    // Time left on the ticket.
    const left=Math.max(0,Math.min(1,(t.until-state.tick)/SLICE_V9_TICKET_TICKS));
    ctx.fillStyle=done?'#3DDC84':left<.25?K.chilli:'#8A5A36';ctx.fillRect(x+w-50,y+h-7,44*left,3);
    if(done&&!still&&now-memo.ticketAt<600){ctx.globalAlpha=1-(now-memo.ticketAt)/600;ctx.strokeStyle=K.gold;ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(x-2,y-2,w+4,h+4,8);ctx.stroke();ctx.globalAlpha=1;}
  }
  // Bonus and dodge streak, on a dark plate under the combo tag.
  // sliceRev 11: the bonus is the combo, golden fruit, tickets and dodges parts; there is no dodge streak.
  const bonus=v11?v11.combo+v11.gold+v11.tickets+v11.dodges:sliceV9Bonus(state),streak=v11?0:state.dodgeStreak??0;
  const by=SLICE_HUD_H+72;
  ctx.font="800 13px 'JetBrains Mono', monospace";ctx.textAlign='left';ctx.textBaseline='middle';
  const line=`BONUS +${bonus}${streak>0?`  DODGE ×${streak}`:''}`;
  const lw=ctx.measureText(line).width+16;
  ctx.fillStyle='rgba(22,14,9,0.72)';ctx.beginPath();ctx.roundRect(8,by,lw,22,7);ctx.fill();
  ctx.fillStyle=bonus>0?K.gold:'#F6EEE2';ctx.fillText(line,16,by+11.5);
  if(!still&&now-memo.dodgeAt<500){ctx.globalAlpha=1-(now-memo.dodgeAt)/500;ctx.strokeStyle='#3DDC84';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(7,by-1,lw+2,24,8);ctx.stroke();ctx.globalAlpha=1;}
  // "+n" over a golden fruit cut (still, in place, under reduced motion).
  const age=now-memo.at;
  if(age<700&&memo.gain>0){
    ctx.globalAlpha=Math.max(0,1-age/700);ctx.font="800 16px 'JetBrains Mono', monospace";ctx.textAlign='center';
    ctx.strokeStyle='rgba(22,14,9,0.8)';ctx.lineWidth=3;ctx.lineJoin='round';
    const yy=memo.y-16-(still?0:age/30);
    ctx.strokeText(`+${memo.gain} GOLD`,memo.x,yy);ctx.fillStyle=K.gold;ctx.fillText(`+${memo.gain} GOLD`,memo.x,yy);ctx.globalAlpha=1;
  }
  ctx.restore();
}
