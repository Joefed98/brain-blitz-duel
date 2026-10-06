/** Slice Kitchen art only. World transform, collision radii and state are authoritative. */
import type { CanvasSize } from './engine';
import { TICKS_PER_SECOND } from './engine';
import { sliceFrenzyOn, sliceGame, sliceObjectAt, sliceSlowOn, sliceSuppressed,
  SLICE_COMBO_TICKS, SLICE_COMBO_FLASH_TICKS, SLICE_FLASH_TICKS, SLICE_HALVES_TICKS, SLICE_HUD_H, SLICE_R,
  SLICE_SPECIAL_FRENZY, SLICE_SPECIAL_NONE, SLICE_SPECIAL_R, SLICE_SPECIAL_SLOW,
  SLICE_WORLD_H, SLICE_WORLD_W, SLICE_RAINBOW, SLICE_SILVER, type SliceState } from './slice';
import { artCanvas, artContext, type ArtCanvas } from './cache.renderer';
import { reducedMotion } from './art.renderer';
import { FX_PARTICLE_LIMIT } from '../fx/limits';

// Kitchen palette belongs to the renderer, never to the simulation's colour table.
const K = { ink:'#232721', board:'#AC784B', grain:'#855936', edge:'#70492F', tile:'#DCE9E7',
  grout:'#A5BFBA', counter:'#648985', white:'#FFF9EB', gold:'#F5C542', silver:SLICE_SILVER,
  bagel:'#F4BF61', cabbage:'#56B63B', onion:'#EAF3D8', meat:'#925237', tomato:'#F52C35', flesh:'#FFF0BE',
  cabbageLight:'#B7E47C', cabbageDark:'#287C35', onionGreen:'#76AB58', onionFace:'#F9FBEA', meatFace:'#CB8067', fat:'#F5DCC2',
  seeds:'#FFE18E', leaf:'#275C27', mustard:'#FFDC24', chilli:'#ED202F', glow:'rgba(255,38,45,0.45)' };
export const SLICE_FOODS = ['bagel','cabbage','onion','meat'] as const;
type Food = typeof SLICE_FOODS[number];
const colours: Record<Food,string> = {bagel:K.bagel,cabbage:K.cabbage,onion:K.onion,meat:K.meat};
const foodOf = (colour:number):Food => SLICE_FOODS[colour % SLICE_FOODS.length] ?? 'bagel';
const cache = new Map<string,ArtCanvas>();
function sprite(key:string,size:number,paint:(c:CanvasRenderingContext2D,s:number)=>void):ArtCanvas|null {
  const px=Math.max(4,Math.round(size)); const id=`${key}@${px}`;
  const old=cache.get(id); if(old) return old;
  const canvas=artCanvas(px,px); const c=canvas ? artContext(canvas):null;
  if(!canvas || !c) return null;
  if(cache.size>=96) cache.clear();
  paint(c as CanvasRenderingContext2D,px);cache.set(id,canvas);return canvas;
}
function circle(c:CanvasRenderingContext2D,x:number,y:number,r:number,fill:string) {
  c.fillStyle=fill;c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();
}
/** Food outer circle is the exact collision envelope; inner details convey the ingredient. */
function paintFood(kind:Food,cut=false) {
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
/** Chilli's red circular outer skin preserves the entire hazardous collision body. */
function paintChilli(c:CanvasRenderingContext2D,size:number) {
  const r=size/2;c.translate(r,r);circle(c,0,0,r,K.ink);circle(c,0,0,r*.94,K.chilli);
  c.fillStyle='#A10A22';c.beginPath();c.moveTo(-r*.72,-r*.4);c.bezierCurveTo(-r*.83,r*.48,r*.17,r*.94,r*.7,r*.48);
  c.bezierCurveTo(r*.05,r*.6,-r*.46,r*.06,-r*.72,-r*.4);c.fill();
  c.strokeStyle=K.white;c.lineWidth=r*.09;c.lineCap='round';c.beginPath();c.moveTo(r*.5,-r*.4);c.quadraticCurveTo(r*.72,0,r*.45,r*.3);c.stroke();
  c.strokeStyle=K.leaf;c.lineWidth=r*.17;c.beginPath();c.moveTo(0,-r*.68);c.quadraticCurveTo(r*.24,-r*.5,r*.3,-r*.84);c.stroke();
}
function paintGlow(c:CanvasRenderingContext2D,size:number) {
  const r=size/2,g=c.createRadialGradient(r,r,r*.72,r,r,r);g.addColorStop(0,'rgba(255,38,45,0)');g.addColorStop(.84,K.glow);g.addColorStop(1,'rgba(255,38,45,0)');c.fillStyle=g;c.fillRect(0,0,size,size);
}
function paintBackground(c:CanvasRenderingContext2D) {
  const W=SLICE_WORLD_W,H=SLICE_WORLD_H;
  c.fillStyle=K.board;c.fillRect(0,0,W,H);
  c.strokeStyle=K.grain;c.lineWidth=.7;
  for(let i=0;i<60;i++){const y=SLICE_HUD_H+10+i*10;c.beginPath();c.moveTo(0,y);c.bezierCurveTo(W*.3,y+Math.sin(i)*4,W*.7,y-3,W,y+2);c.stroke();}
  // Tiles and kitchen objects live behind the existing HUD, not in a newly reserved arena.
  c.fillStyle=K.tile;c.fillRect(0,0,W,SLICE_HUD_H);
  c.strokeStyle=K.grout;c.lineWidth=1;for(let x=0;x<W;x+=48)c.strokeRect(x,0,48,SLICE_HUD_H);
  c.fillStyle=K.counter;c.fillRect(0,H-4,W,4);c.fillStyle=K.edge;c.fillRect(0,SLICE_HUD_H,W,2);
  // Small cropped towel on outer margin, knife block and utensils in background header.
  c.fillStyle=K.white;c.fillRect(W-7,SLICE_HUD_H+6,7,50);c.strokeStyle=K.counter;c.lineWidth=1;
  for(let y=SLICE_HUD_H+10;y<SLICE_HUD_H+56;y+=7){c.beginPath();c.moveTo(W-7,y);c.lineTo(W,y);c.stroke();}
  c.fillStyle=K.edge;c.fillRect(W-45,8,31,28);c.strokeStyle=K.silver;c.lineWidth=3;
  for(let x=W-39;x<W-15;x+=9){c.beginPath();c.moveTo(x,8);c.lineTo(x-3,0);c.stroke();}
  c.strokeStyle=K.ink;c.lineWidth=2;c.beginPath();c.moveTo(10,5);c.lineTo(10,32);c.stroke();circle(c,10,5,4,K.silver);
  const light=c.createLinearGradient(0,0,W,H);light.addColorStop(0,'rgba(255,249,220,0.14)');light.addColorStop(1,'rgba(255,249,220,0)');c.fillStyle=light;c.fillRect(0,SLICE_HUD_H,W,H-SLICE_HUD_H);
}
function background():ArtCanvas|null {
  const key='kitchen-background';const old=cache.get(key);if(old)return old;
  const canvas=artCanvas(SLICE_WORLD_W,SLICE_WORLD_H),c=canvas?artContext(canvas):null;
  if(!canvas||!c)return null;paintBackground(c as CanvasRenderingContext2D);cache.set(key,canvas);return canvas;
}
interface Cut {angle:number;offset:number}
interface Memo {tick:number;trail:{seg:readonly[number,number,number,number];at:number}[];cuts:Map<number,Cut>}
const memos=new WeakMap<object,Memo>();
export function drawSliceArt(ctx:CanvasRenderingContext2D,state:SliceState,size:CanvasSize):void {
  const sx=size.width/SLICE_WORLD_W,sy=size.height/SLICE_WORLD_H;
  const tr=typeof ctx.getTransform==='function'?ctx.getTransform():null;
  const dpr=tr?Math.max(1,Math.min(2,Math.hypot(tr.a,tr.b))):1;
  const px=SLICE_R*2*Math.max(sx,sy)*dpr,now=typeof performance==='undefined'?0:performance.now(),still=reducedMotion();
  let memo=memos.get(ctx);if(!memo||state.tick<memo.tick){memo={tick:state.tick,trail:[],cuts:new Map()};memos.set(ctx,memo);}
  if(state.swipe&&state.tick!==memo.tick){memo.trail.push({seg:state.swipe,at:now});
    const [x1,y1,x2,y2]=state.swipe,angle=Math.atan2(y2-y1,x2-x1);
    state.slicedAt.forEach((t,i)=>{if(t>memo.tick&&!memo.cuts.has(i)){
      const object=state.objects[i],at=object?sliceObjectAt(object,t,state.slowFrom):null;
      const r=object?.special?SLICE_SPECIAL_R:SLICE_R;
      const offset=at?Math.max(-r+1,Math.min(r-1,((at.x/256-x1)*-Math.sin(angle)+(at.y/256-y1)*Math.cos(angle)))):0;
      memo.cuts.set(i,{angle,offset});
    }});
  }
  memo.tick=state.tick;memo.trail=memo.trail.filter(e=>now-e.at<110).slice(-6);
  ctx.save();ctx.scale(sx,sy);const bg=background();if(bg)ctx.drawImage(bg as CanvasImageSource,0,0,SLICE_WORLD_W,SLICE_WORLD_H);else paintBackground(ctx);
  let particles=0;
  for(let i=0;i<state.objects.length;i++) {
    const o=state.objects[i];if(!o||sliceSuppressed(state,o))continue;
    const slicedAt=state.slicedAt[i]??0,r=o.special?SLICE_SPECIAL_R:SLICE_R,kind=foodOf(o.colour);
    const stamp=sprite(o.bomb?'chilli':o.special===SLICE_SPECIAL_FRENZY?'ketchup':o.special===SLICE_SPECIAL_SLOW?'mustard':kind,px*r/SLICE_R,
      o.bomb?paintChilli:o.special?paintBottle(o.special===SLICE_SPECIAL_SLOW):paintFood(kind));
    if(!stamp)continue;
    if(slicedAt){const age=state.tick-slicedAt;if(age>SLICE_HALVES_TICKS)continue;
      const at=sliceObjectAt(o,slicedAt,state.slowFrom);if(!at)continue;
      const cx=at.x/256,cy=at.y/256+(still?0:age*age/20),spread=still?3:3+age;
      const cut=memo.cuts.get(i)??{angle:0,offset:0};
      const face=!o.bomb&&!o.special?sprite(`${kind}-face`,px,paintFood(kind,true)):stamp;
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
        const a=p*Math.PI/3+i*.7,d=age*(1.1+p%3);circle(ctx,cx+Math.cos(a)*d,at.y/256+Math.sin(a)*d+age*age/30,kind==='bagel'?1.3:1.8,colours[kind]);
      }
      ctx.globalAlpha=1;continue;
    }
    const at=sliceObjectAt(o,state.tick,state.slowFrom);if(!at)continue;const cx=at.x/256,cy=at.y/256;
    ctx.drawImage(stamp as CanvasImageSource,cx-r,cy-r,2*r,2*r);
    if(o.special){const tint=o.special===SLICE_SPECIAL_SLOW?K.silver:SLICE_RAINBOW[Math.floor((still?0:now/110))%SLICE_RAINBOW.length]??K.tomato;
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
  ctx.globalAlpha=1;if(state.swipe){const[x1,y1,x2,y2]=state.swipe;ctx.strokeStyle=K.silver;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.strokeStyle=K.white;ctx.lineWidth=.8;ctx.stroke();}
  if(state.flash>0){ctx.fillStyle=`rgba(224,80,60,${state.flash/SLICE_FLASH_TICKS*.45})`;ctx.fillRect(0,0,SLICE_WORLD_W,SLICE_WORLD_H);}
  drawSliceComboMeter(ctx,state);
  ctx.fillStyle='rgba(220,233,231,0.88)';ctx.fillRect(20,8,SLICE_WORLD_W-70,30);
  ctx.fillStyle=K.ink;ctx.font='bold 20px ui-monospace, monospace';ctx.textBaseline='middle';ctx.textAlign='left';ctx.fillText(`Sliced ${state.slices}`,14,SLICE_HUD_H/2);ctx.textAlign='center';
  if(sliceFrenzyOn(state,state.tick))ctx.fillText('FRENZY',SLICE_WORLD_W/2,SLICE_HUD_H/2);else if(sliceSlowOn(state,state.tick))ctx.fillText('SLOW',SLICE_WORLD_W/2,SLICE_HUD_H/2);
  ctx.strokeStyle=K.edge;ctx.lineWidth=2;ctx.strokeRect(1,1,SLICE_WORLD_W-2,SLICE_WORLD_H-2);
  if(state.comboFlash>0){ctx.strokeStyle=K.gold;ctx.globalAlpha=state.comboFlash/SLICE_COMBO_FLASH_TICKS;ctx.lineWidth=6;ctx.strokeRect(3,3,SLICE_WORLD_W-6,SLICE_WORLD_H-6);}
  ctx.restore();
}
export const sliceArtGame={...sliceGame,draw:drawSliceArt};

/** Qualifying-combo progress only: labels do not replace the sim's scoring multiplier. */
export function drawSliceComboMeter(ctx:CanvasRenderingContext2D,state:SliceState):void {
  const left=Math.max(0,state.comboUntil-state.tick);
  const filled=state.comboLive&&left>0?Math.max(0,Math.min(3,state.streak)):0;
  const shown=Math.min(3,filled+1),remaining=Math.min(1,left/SLICE_COMBO_TICKS);
  const x0=14,y=SLICE_HUD_H+14,w=30,h=14,gap=4;
  ctx.save();ctx.lineWidth=1.5;ctx.strokeStyle=K.gold;
  ctx.font="bold 13px 'JetBrains Mono', monospace";ctx.textAlign='center';ctx.textBaseline='top';
  for(let i=0;i<shown;i++){
    const x=x0+i*(w+gap),amount=Math.max(0,Math.min(1,filled*remaining-i));
    if(amount>0){ctx.fillStyle=K.gold;ctx.fillRect(x+1,y+1,(w-2)*amount,h-2);}
    ctx.strokeRect(x,y,w,h);ctx.fillStyle=K.ink;ctx.fillText(`x${i+1}`,x+w/2,y+h+4);
  }
  if(filled>0){ctx.font="11px 'JetBrains Mono', monospace";ctx.fillText(`${Math.ceil(left/TICKS_PER_SECOND)}s`,x0+(shown*(w+gap)-gap)/2,y+h+21);}
  ctx.restore();
}

/** Fixed worked example uses the same cached food painters; never creates gameplay state. */
export function drawSliceKitchenExample(ctx:CanvasRenderingContext2D):void {
  ctx.save();ctx.fillStyle=K.board;ctx.fillRect(0,0,168,120);
  ctx.strokeStyle=K.grain;ctx.lineWidth=.5;
  for(let y=8;y<120;y+=12){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(168,y+2);ctx.stroke();}
  for(const [kind,x,y] of [['bagel',44,70],['cabbage',84,50],['meat',124,72]] as const){
    const s=sprite(kind,26,paintFood(kind));if(s)ctx.drawImage(s as CanvasImageSource,x-13,y-13,26,26);
  }
  ctx.strokeStyle=K.silver;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(24,92);ctx.lineTo(146,40);ctx.stroke();ctx.restore();
}
