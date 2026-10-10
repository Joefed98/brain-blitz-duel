import { successFrame, SUCCESS_ACCENTS } from "./success.renderer";
/** Orchard Snip. Art only: original world, camera, rope nodes and collision geometry. */
import type { CanvasSize } from './engine';
import { snipCamera, snipGame, snipView, SNIP_CONFIG, SNIP_H, SNIP_W, type SnipState } from './snip';
import { countryStamp, drawCountryside, COUNTRY_SKY, COUNTRY_GRASS_DARK, COUNTRY_WOOD, COUNTRY_WOOD_DARK, COUNTRY_WOOD_LIGHT, COUNTRY_STONE, COUNTRY_STONE_DARK, COUNTRY_GOLD, COUNTRY_GOLD_EDGE, COUNTRY_SHINE, COUNTRY_APPLE, COUNTRY_APPLE_EDGE } from './countryside.renderer';

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
function wall(c:CanvasRenderingContext2D):void {
  c.fillStyle=COUNTRY_STONE_DARK;c.fillRect(0,0,3,SNIP_H);
  c.fillStyle=COUNTRY_STONE;for(let y=1;y<SNIP_H;y+=14)c.fillRect(0,y,3,12);
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
export function drawSnipArt(c:CanvasRenderingContext2D,state:SnipState,size:CanvasSize,trail?:readonly (readonly [number,number])[],cameraX=snipCamera(state,state.sx/256-SNIP_CONFIG.viewW/2,1),swipes:readonly SnipSwipe[]=[]):void {
  const tpl=SNIP_CONFIG.templates[state.template];if(!tpl)return;
  const {scaleX,scaleY}=snipView(size);
  c.save();c.fillStyle=COUNTRY_SKY;c.fillRect(0,0,size.width,size.height);c.beginPath();c.rect(0,0,size.width,size.height);c.clip();
  c.save();c.scale(size.width/390,size.height/620);drawCountryside(c,cameraX);c.restore();
  c.scale(scaleX,scaleY);c.translate(-cameraX,0);
  countryStamp(c,'orchard-canopy',SNIP_W,28,0,0,canopy);
  // Connections to actual pins, including lower anchors, stay faint and behind gameplay.
  c.save();c.globalAlpha=0.18;c.strokeStyle=COUNTRY_WOOD_DARK;c.lineWidth=5;
  for(const rope of state.ropes){const px=rope.x[0],py=rope.y[0];if(px===undefined||py===undefined)continue;c.beginPath();c.moveTo(px/256-28,10);c.bezierCurveTo(px/256-18,py/512,px/256+18,py/512,px/256,py/256);c.stroke();}c.restore();
  countryStamp(c,'orchard-wall',3,SNIP_H,0,0,wall);countryStamp(c,'orchard-wall',3,SNIP_H,SNIP_W-3,0,wall);
  for(const [x0,y0,x1,y1] of tpl.platforms)countryStamp(c,'orchard-rail',x1-x0,y1-y0,x0,y0,ctx=>rail(ctx,x1-x0,y1-y0));
  countryStamp(c,'orchard-basket',64,64,tpl.mouth[0]-32,tpl.mouth[1]-32,basket);
  state.starX.forEach((x,i)=>{const y=state.starY[i];if(state.starGot[i]||y===undefined)return;countryStamp(c,'orchard-leaf',48,48,x/256-24,y/256-24,leaf);});
  for(const rope of state.ropes){const pts:[number,number][]=[];for(let i=0;i<rope.x.length;i++){const x=rope.x[i],y=rope.y[i];if(x!==undefined&&y!==undefined)pts.push([x/256,y/256]);}if(rope.alive)pts.push([state.sx/256,state.sy/256]);twine(c,pts,rope.alive?1:0.6);}
  countryStamp(c,'orchard-apple',24,24,state.sx/256-12,state.sy/256-12,apple);
  if(trail&&trail.length>1){const first=trail[0];if(first){c.strokeStyle=COUNTRY_SHINE;c.lineWidth=2;c.beginPath();c.moveTo(first[0],first[1]);for(const [x,y] of trail)c.lineTo(x,y);c.stroke();}}
  const now=typeof performance==='undefined'?0:performance.now();
  c.strokeStyle=COUNTRY_SHINE;c.lineWidth=2;c.lineCap='round';
  for(const sw of swipes){const k=1-(now-sw.at)/200;if(k<=0)continue;c.globalAlpha=k*0.8;c.beginPath();c.moveTo(sw.a,sw.b);c.lineTo(sw.c,sw.d);c.stroke();}
  c.globalAlpha=1;
  const completed=SNIP_CONFIG.templates[state.order[Math.max(0,state.level-1)]??state.template];
  if(completed)successFrame(c,{id:'snip',tick:state.tick,count:state.eaten,eventTick:state.lastOutcome===1?state.endTick:0,colour:COUNTRY_GOLD,width:SNIP_W,height:SNIP_H,point:{x:completed.mouth[0],y:completed.mouth[1],shape:'spark'}});
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
