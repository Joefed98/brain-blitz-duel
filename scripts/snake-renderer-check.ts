/** No-browser comet drawing/cache checks; no simulation replay or identity proof. */
import assert from 'node:assert/strict';
import { snakeGame, SNAKE_CELL } from '../src/lib/arcade/snake';
import { snakeArtGame } from '../src/lib/arcade/snake.renderer';
let allocations = 0, clock = 1000, reduced = false;
Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => clock } });
Object.defineProperty(globalThis, 'window', { configurable: true, value: { matchMedia: () => ({ get matches() { return reduced; } }) } });
function context() {
 const stats = { blur: 0, depth: 0, blits: [] as number[][], rects: [] as number[][] };
 const base = { canvas: {}, getTransform: () => ({ a: 2, b: 0 }), save: () => stats.depth++, restore: () => stats.depth--,
 drawImage: (_: unknown, ...args: number[]) => stats.blits.push(args), fillRect: (...args: number[]) => stats.rects.push(args) };
 const ctx = new Proxy(base as unknown as CanvasRenderingContext2D, {get(t,k){return Reflect.get(t,k) ?? (()=>{});},set(t,k,v){if(k==='shadowBlur'&&v>0)stats.blur++;return Reflect.set(t,k,v);}});
 return {ctx,stats};
}
const surfaces: { width: number; height: number; stats: ReturnType<typeof context>['stats'] }[] = [];
class FakeCanvas {width:number;height:number; c= context();constructor(w:number,h:number){this.width=w;this.height=h;allocations++;surfaces.push({width:w,height:h,stats:this.c.stats});}getContext(){return this.c.ctx;}}
Object.defineProperty(globalThis,'OffscreenCanvas',{configurable:true,value:FakeCanvas});
const state=snakeGame.init(21); state.body=Array.from({length:300},(_,i)=>i); state.tick=600;
const {ctx,stats}=context();
const draw=()=>snakeArtGame.draw(ctx,state,{width:390,height:640});
const baseline=JSON.stringify(state); draw(); const warm=allocations;
const times:number[]=[];
for(let i=0;i<600;i++){const start=Bun.nanoseconds();draw();times.push((Bun.nanoseconds()-start)/1e6);stats.rects=[];stats.blits=[];}
assert.equal(allocations,warm,'no warm allocations');assert.equal(stats.blur,0,'zero live blur');assert.equal(stats.depth,0);assert.equal(JSON.stringify(state),baseline);
const beadSurfaces=surfaces.filter(s=>s.width===48&&s.height===48);
assert(beadSurfaces.length>=6);
for(const s of beadSurfaces)for(const [x,y,w,h] of s.stats.rects)assert(x>=0&&y>=0&&x+w<=24&&y+h<=24,'pixel art inside cell');
// Every collision cell receives a centred, full-cell stamp, including tail.
stats.blits=[];draw();const beads=stats.blits.filter(b=>b[2]===24&&b[3]===24);assert(beads.length>=301);
for(let i=0;i<300;i++){const x=15+i%15*24,y=44+Math.trunc(i/15)*24;assert(beads.some(b=>b[0]===x&&b[1]===y));}
// Eat, death and frozen end frames are immutable and remain bounded.
state.eaten++;state.pellet=150;state.tick++;draw();clock+=90;draw();
state.dead=true;state.tick++;draw();clock+=300;stats.rects=[];draw();const particleRects=stats.rects.filter(r=>r[2]===2&&r[3]===2);assert(particleRects.length<=34,'32 sparks plus two eyes');
reduced=true;stats.rects=[];draw();assert.equal(stats.rects.filter(r=>r[2]===2&&r[3]===2).length,2,'reduced motion has only eyes, no sparks');
assert.equal(stats.depth,0);assert.equal(stats.blur,0);
// No-canvas fallback remains safe.
delete (globalThis as {OffscreenCanvas?:unknown}).OffscreenCanvas;
const fallback=context();snakeArtGame.draw(fallback.ctx,state,{width:375,height:600});assert.equal(fallback.stats.depth,0);
times.sort((a,b)=>a-b);console.log(JSON.stringify({checks:'warm cache, full-cell centring, sprite bounds, immutable drawing, pellet/death events, 32 sparks, reduced motion, fallback',segments:300,frames:600,caches:warm,liveBlur:stats.blur,medianMs:times[300],p95Ms:times[570]}));
