/** Pull! art game: the polished scenery/clay/bird art (clayShootArt.renderer.ts) plus gold-clay rewards; presentation only. */
import { clayGameFor, clayView, clayWorldH, CLAY_W, CLAY_HIT, CLAY_KIND_GOLD, CLAY_MISSED, type ClayState } from './clayShoot';
import { arcadeFx, type ArcadeFxSpec } from './arcadeFx.renderer';
import type { CanvasSize } from './engine';
import { drawClayArt } from './clayShootArt.renderer';
import { successFrame, SUCCESS_ACCENTS } from './success.renderer';
export function drawClaySuccess(ctx:CanvasRenderingContext2D,state:ClayState,size:CanvasSize):void {
  drawClayArt(ctx,state,size);
  const {scaleX,scaleY}=clayView(size,clayWorldH(state));
  let latest=-1;
  for(let i=0;i<state.status.length;i++)if(state.status[i]===CLAY_HIT&&(latest<0||(state.doneTick[i]??0)>(state.doneTick[latest]??0)))latest=i;
  ctx.save();ctx.scale(scaleX,scaleY);
  successFrame(ctx,{id:'clay',tick:state.tick,count:state.goldHits,misses:state.missed+(state.birdHits??0),colour:SUCCESS_ACCENTS.gold,width:CLAY_W,height:clayWorldH(state),
    eventTick:state.doneTick[latest],point:{x:(state.x[latest]??0)/256,y:(state.y[latest]??0)/256,shape:'spark'},enabled:latest>=0&&state.schedule.kind[latest]===CLAY_KIND_GOLD});
  ctx.restore();
}
/**
 * Pull!'s miss moment (Polish batch S, 25 Oct 2026, display only): the shared arcade layer's faint red
 * edge pulse when a clay escapes (clayshoot.escape) or a shot startles a bird, with a puff where the bird
 * was hit or the clay left the sky (pulled inside the edge). An empty shot keeps the game's own smoke
 * puff and missPuff sound only. Read only from counters the sim keeps; nothing is written.
 */
function clayEscapeAt(s:ClayState,worldH:number){
  let last=-1;
  for(let i=0;i<s.status.length;i++)if(s.status[i]===CLAY_MISSED&&(last<0||(s.doneTick[i]??0)>(s.doneTick[last]??0)))last=i;
  if(last<0)return null;
  const x=Math.min(CLAY_W-14,Math.max(14,(s.x[last]??0)/256)),y=Math.min(worldH-14,Math.max(14,(s.y[last]??0)/256));
  return {x,y};
}
function clayBirdAt(s:ClayState){
  const done=s.birdDoneTick??[];let last=-1;
  for(let i=0;i<(s.birdStatus?.length??0);i++)if((done[i]??0)>0&&(last<0||(done[i]??0)>(done[last]??0)))last=i;
  return last<0?null:{x:(s.birdX?.[last]??0)/256,y:(s.birdY?.[last]??0)/256};
}
const claySpecs=new Map<number,ArcadeFxSpec<ClayState>>();
function claySpec(worldH:number):ArcadeFxSpec<ClayState>{
  let spec=claySpecs.get(worldH);
  if(!spec){spec={game:'clayshoot',world:'realworld',width:CLAY_W,height:worldH,events:[],shake:false,fit:'stretch',
    misses:[{count:(s)=>s.missed,at:(s)=>clayEscapeAt(s,worldH)},{count:(s)=>s.birdHits??0,at:clayBirdAt}]};claySpecs.set(worldH,spec)}
  return spec;
}
/** drawClaySuccess through the shared arcade layer (misses only; Pull!'s successes keep their own art). */
export function drawClayWithFx(ctx:CanvasRenderingContext2D,state:ClayState,size:CanvasSize):void {
  arcadeFx(ctx,claySpec(clayWorldH(state)),state,()=>drawClaySuccess(ctx,state,size),size);
}
const games=new Map<number,ReturnType<typeof clayGameFor>>();
export function clayArtGameFor(rev?:number|null):ReturnType<typeof clayGameFor>{
  const key=rev??0;let game=games.get(key);
  if(!game){game={...clayGameFor(rev),draw:drawClayWithFx};games.set(key,game)}
  return game;
}