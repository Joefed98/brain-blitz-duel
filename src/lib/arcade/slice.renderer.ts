/** Slice Kitchen art only. World transform, collision radii and state are authoritative. */
import type { CanvasSize } from './engine';
import { TICKS_PER_SECOND } from './engine';
import { sliceFrenzyOn, sliceGame, sliceMultiplier, sliceObjectAt, sliceSlowOn, sliceSuppressed,
  SLICE_COMBO_FLASH_TICKS, SLICE_FLASH_TICKS, SLICE_HALVES_TICKS, SLICE_HUD_H, SLICE_R,
  SLICE_SPECIAL_FRENZY, SLICE_SPECIAL_NONE, SLICE_SPECIAL_R, SLICE_SPECIAL_SLOW,
  SLICE_WORLD_H, SLICE_WORLD_W, SLICE_RAINBOW, SLICE_SILVER, type SliceState } from './slice';
import { artCanvas, artContext, type ArtCanvas } from './cache.renderer';
import { reducedMotion } from './art.renderer';
import { FX_PARTICLE_LIMIT } from '../fx/limits';

// Kitchen palette belongs to the renderer, never to the simulation's colour table.
const K = { ink:'#232721', board:'#AC784B', grain:'#855936', edge:'#70492F', tile:'#DCE9E7',
  grout:'#A5BFBA', counter:'#648985', white:'#FFF9EB', gold:'#F5C542', silver:SLICE_SILVER,
  bagel:'#F4BF61', loaf:'#E8A42B', cucumber:'#087F43', tomato:'#F52C35', flesh:'#FFF0BE',
  seeds:'#FFE18E', leaf:'#275C27', mustard:'#FFDC24', chilli:'#ED202F', glow:'rgba(255,38,45,0.45)' };
export const SLICE_FOODS = ['bagel','loaf','cucumber','tomato'] as const;
type Food = typeof SLICE_FOODS[number];
const colours: Record<Food,string> = {bagel:K.bagel,loaf:K.loaf,cucumber:K.cucumber,tomato:K.tomato};
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
      circle(c,0,0,r*.80,kind==='tomato' ? '#FF7870':kind==='cucumber' ? '#BAEC74':K.flesh);
      if(kind==='tomato'||kind==='cucumber') {
        for(let i=0;i<8;i++) { const a=i*Math.PI/4;c.fillStyle=K.seeds;c.beginPath();
          c.ellipse(Math.cos(a)*r*.47,Math.sin(a)*r*.47,r*.1,r*.055,a,0,Math.PI*2);c.fill(); }
      } else if(kind==='loaf') {
        for(let i=0;i<9;i++) circle(c,Math.sin(i*2.7)*r*.55,Math.cos(i*1.8)*r*.55,r*.045,K.loaf);
      }
    } else if(kind==='loaf') {
      c.strokeStyle=K.flesh;c.lineWidth=r*.11;c.lineCap='round';
      for(const y of [-.4,0,.4]) {c.beginPath();c.moveTo(-r*.44,r*(y+.12));c.lineTo(r*.44,r*(y-.12));c.stroke();}
    } else if(kind==='cucumber') {
      c.strokeStyle='#42D46A';c.lineWidth=r*.07;
      for(const x of [-.42,0,.42]) {c.beginPath();c.moveTo(r*x,-r*.69);c.quadraticCurveTo(r*(x+.13),0,r*x,r*.69);c.stroke();}
    } else if(kind==='tomato') {
      c.fillStyle=K.leaf;c.beginPath();
      for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=r*(i%2?.12:.43);const x=Math.cos(a)*rr,y=-r*.42+Math.sin(a)*rr;if(i===0)c.moveTo(x,y);else c.lineTo(x,y);}c.closePath();c.fill();
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
        ctx.rotate(cut.angle);ctx.beginPath();ctx.rect(-r,-cut.offset-2,r*2,4);ctx.clip();ctx.rotate(-cut.angle);
        if(face)ctx.drawImage(face as CanvasImageSource,-r,-r,2*r,2*r);ctx.restore();
      }
      if(!still&&!o.bomb&&o.special===SLICE_SPECIAL_NONE)for(let p=0;p<6&&particles<FX_PARTICLE_LIMIT;p++,particles++){
        const a=p*Math.PI/3+i*.7,d=age*(1.1+p%3);circle(ctx,cx+Math.cos(a)*d,at.y/256+Math.sin(a)*d+age*age/30,kind==='loaf'||kind==='bagel'?1.3:1.8,colours[kind]);
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
  // Keep the existing gauge and HUD locations; stainless steel replaces nautical brass.
  const mult=sliceMultiplier(state.streak),gx=38,gy=SLICE_HUD_H+34;
  ctx.fillStyle=K.silver;ctx.beginPath();ctx.arc(gx,gy,24,Math.PI,0);ctx.closePath();ctx.fill();
  ctx.fillStyle=K.ink;ctx.beginPath();ctx.arc(gx,gy,20,Math.PI,0);ctx.closePath();ctx.fill();
  ctx.strokeStyle=K.white;ctx.lineWidth=3;for(let i=1;i<=3;i++){const a=Math.PI+(i-1)/2*Math.PI;ctx.beginPath();ctx.moveTo(gx+Math.cos(a)*15,gy+Math.sin(a)*15);ctx.lineTo(gx+Math.cos(a)*19,gy+Math.sin(a)*19);ctx.stroke();}
  const a=Math.PI+(mult-1)/2*Math.PI;ctx.strokeStyle=K.gold;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(gx,gy);ctx.lineTo(gx+Math.cos(a)*17,gy+Math.sin(a)*17);ctx.stroke();
  ctx.fillStyle=K.ink;ctx.font="bold 13px 'JetBrains Mono', monospace";ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText(`×${mult}`,gx,gy+3);
  if(state.comboLive){ctx.font="11px 'JetBrains Mono', monospace";ctx.fillText(`${Math.ceil(Math.max(0,state.comboUntil-state.tick)/TICKS_PER_SECOND)}s`,gx,gy+18);}
  ctx.fillStyle='rgba(220,233,231,0.88)';ctx.fillRect(20,8,SLICE_WORLD_W-70,30);
  ctx.fillStyle=K.ink;ctx.font='bold 20px ui-monospace, monospace';ctx.textBaseline='middle';ctx.textAlign='left';ctx.fillText(`Sliced ${state.slices}`,14,SLICE_HUD_H/2);ctx.textAlign='center';
  if(sliceFrenzyOn(state,state.tick))ctx.fillText('FRENZY',SLICE_WORLD_W/2,SLICE_HUD_H/2);else if(sliceSlowOn(state,state.tick))ctx.fillText('SLOW',SLICE_WORLD_W/2,SLICE_HUD_H/2);
  ctx.strokeStyle=K.edge;ctx.lineWidth=2;ctx.strokeRect(1,1,SLICE_WORLD_W-2,SLICE_WORLD_H-2);
  if(state.comboFlash>0){ctx.strokeStyle=K.gold;ctx.globalAlpha=state.comboFlash/SLICE_COMBO_FLASH_TICKS;ctx.lineWidth=6;ctx.strokeRect(3,3,SLICE_WORLD_W-6,SLICE_WORLD_H-6);}
  ctx.restore();
}
export const sliceArtGame={...sliceGame,draw:drawSliceArt};
