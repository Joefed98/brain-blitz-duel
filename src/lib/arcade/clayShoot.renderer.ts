/** Wrap the unchanged clay renderer: gold-clay rewards are presentation only. */
import { clayGameFor, clayView, CLAY_H, CLAY_W, CLAY_HIT, CLAY_KIND_GOLD, type ClayState } from './clayShoot';
import type { CanvasSize } from './engine';
import { successFrame, SUCCESS_ACCENTS } from './success.renderer';
export function drawClaySuccess(ctx:CanvasRenderingContext2D,state:ClayState,size:CanvasSize):void {
  clayGameFor(state.rev).draw(ctx,state,size);
  const {scaleX,scaleY}=clayView(size);
  let latest=-1;
  for(let i=0;i<state.status.length;i++)if(state.status[i]===CLAY_HIT&&(latest<0||(state.doneTick[i]??0)>(state.doneTick[latest]??0)))latest=i;
  ctx.save();ctx.scale(scaleX,scaleY);
  successFrame(ctx,{id:'clay',tick:state.tick,count:state.goldHits,misses:state.missed+(state.birdHits??0),colour:SUCCESS_ACCENTS.gold,width:CLAY_W,height:CLAY_H,
    eventTick:state.doneTick[latest],point:{x:(state.x[latest]??0)/256,y:(state.y[latest]??0)/256,shape:'spark'},enabled:latest>=0&&state.schedule.kind[latest]===CLAY_KIND_GOLD});
  ctx.restore();
}
const games=new Map<number,ReturnType<typeof clayGameFor>>();
export function clayArtGameFor(rev?:number|null):ReturnType<typeof clayGameFor>{
  const key=rev??0;let game=games.get(key);
  if(!game){game={...clayGameFor(rev),draw:drawClaySuccess};games.set(key,game)}
  return game;
}