/** Pull! art game: the polished scenery/clay/bird art (clayShootArt.renderer.ts) plus gold-clay rewards; presentation only. */
import { clayGameFor, clayView, clayWorldH, CLAY_W, CLAY_HIT, CLAY_KIND_GOLD, type ClayState } from './clayShoot';
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
const games=new Map<number,ReturnType<typeof clayGameFor>>();
export function clayArtGameFor(rev?:number|null):ReturnType<typeof clayGameFor>{
  const key=rev??0;let game=games.get(key);
  if(!game){game={...clayGameFor(rev),draw:drawClaySuccess};games.set(key,game)}
  return game;
}