/** No-browser meteor drawing/cache checks; no simulation replay or identity proof. */
import assert from 'node:assert/strict';
import { snakeGame, SNAKE_CELL, snakeGameFor, SNAKE_REV_10, SNAKE_V9_COLS, SNAKE_V9_H, SNAKE_V9_WORLD_W, snakeBoardXOf, snakeCol, snakeRow, type SnakeState } from '../src/lib/arcade/snake';
import { roomSeed } from './arcade-skill-bands/games';
import { snakeArtGame } from '../src/lib/arcade/snake.renderer';
let allocations = 0, clock = 1000, reduced = false;
Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => clock } });
Object.defineProperty(globalThis, 'window', { configurable: true, value: { matchMedia: () => ({ get matches() { return reduced; } }) } });
function context() {
 const stats = { blur: 0, depth: 0, colours: new Set<string>(), blits: [] as number[][], rects: [] as number[][] };
 const base = { canvas: {}, getTransform: () => ({ a: 2, b: 0 }), save: () => stats.depth++, restore: () => stats.depth--,
 drawImage: (_: unknown, ...args: number[]) => stats.blits.push(args), fillRect: (...args: number[]) => stats.rects.push(args) };
 const ctx = new Proxy(base as unknown as CanvasRenderingContext2D, {get(t,k){return Reflect.get(t,k) ?? (()=>{});},set(t,k,v){if(k==='shadowBlur'&&v>0)stats.blur++;if(k==='fillStyle'||k==='shadowColor')stats.colours.add(String(v));return Reflect.set(t,k,v);}});
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
for(const s of beadSurfaces) {
 assert(!s.stats.colours.has('#4BFF7A') && !s.stats.colours.has('#1E9C45'), 'meteor/star sprites have no green');
}
assert(beadSurfaces.some(s=>s.stats.colours.has('#29282D')), 'charcoal head');
assert(beadSurfaces.some(s=>s.stats.colours.has('#77747B')), 'rock flecks');
assert(beadSurfaces.some(s=>s.stats.colours.has('#FFF4D2')), 'white-hot fire front');
assert(beadSurfaces.some(s=>s.stats.colours.has('#85818B')), 'smoke-grey tail');
// The comet (Joe's phone notes, 27 Oct 2026): a dark rock core, orange-to-amber flame, white-hot trail.
assert(beadSurfaces.some(s=>s.stats.colours.has('#5A2A12')), 'comet: dark rock core');
assert(beadSurfaces.some(s=>s.stats.colours.has('#FF7A2E')) && beadSurfaces.some(s=>s.stats.colours.has('#FFB347')), 'comet: orange-to-amber flame');
for(let dir=0;dir<4;dir++){state.dir=dir;draw();}
const directionCaches=allocations;
for(let dir=0;dir<4;dir++){state.dir=dir;draw();}
assert.equal(allocations,directionCaches,'directional head caches reused');
// Every collision cell receives a centred, full-cell stamp, including tail.
stats.blits=[];draw();const beads=stats.blits.filter(b=>b[2]===24&&b[3]===24);assert(beads.length>=301);
for(let i=0;i<300;i++){const x=15+i%15*24,y=44+Math.trunc(i/15)*24;assert(beads.some(b=>b[0]===x&&b[1]===y));}
// Eat, death and frozen end frames are immutable and remain bounded.
state.eaten++;state.pellet=150;state.tick++;draw();clock+=90;draw();
state.dead=true;state.tick++;draw();clock+=300;stats.rects=[];draw();const particleRects=stats.rects.filter(r=>(r[2]===2&&r[3]===2)||(r[2]===4&&r[3]===4));assert(particleRects.length<=34,'32 embers/smoke plus two eyes');
reduced=true;stats.rects=[];draw();assert.equal(stats.rects.filter(r=>r[2]===2&&r[3]===2).length,2,'reduced motion has only eyes, no sparks');
assert.equal(stats.rects.filter(r=>r[2]===4&&r[3]===4).length,0,'no animated smoke under reduced motion');
assert.equal(stats.depth,0);assert.equal(stats.blur,0);
// snakeRev 10: a landed 2 × 2 rock is one 48 px boulder on its block (its sprite's pixels inside the block), and a
// falling one's shadow sits inside the block too; drawing never writes the state.
{
  reduced=false;
  const v10=snakeGameFor(SNAKE_REV_10).init(roomSeed(0)) as SnakeState;
  const anchor=v10.bigRocks![0]!, other=v10.bigRocks![1]!;
  const s10={...v10,tick:900,rocks:[anchor],rockWarn:other,rockLandTick:960} as SnakeState;
  const before=JSON.stringify(s10);
  stats.blits=[];stats.rects=[];snakeArtGame.draw(ctx,s10,{width:SNAKE_V9_WORLD_W,height:SNAKE_V9_H});
  assert.equal(JSON.stringify(s10),before,'snakeRev 10 drawing leaves the state alone');
  const bx=snakeBoardXOf(s10), x=bx+snakeCol(anchor,SNAKE_V9_COLS)*SNAKE_CELL, y=44+snakeRow(anchor,SNAKE_V9_COLS)*SNAKE_CELL;
  assert(stats.blits.some(b=>b[0]===x&&b[1]===y&&b[2]===48&&b[3]===48),'a 2 × 2 rock is one 48 px boulder on its block');
  const big=surfaces.filter(s=>s.width===96&&s.height===96);
  assert(big.length===1,'one cached 2 × 2 rock sprite');
  for(const s of big)for(const [px,py,w,h] of s.stats.rects)assert(px>=0&&py>=0&&px+w<=48&&py+h<=48,'2 × 2 rock pixels inside its block');
  const ox=bx+snakeCol(other,SNAKE_V9_COLS)*SNAKE_CELL, oy=44+snakeRow(other,SNAKE_V9_COLS)*SNAKE_CELL;
  const shadow=stats.rects.filter(r=>r[0]>=ox-2&&r[1]>=oy-2&&r[0]+r[2]<=ox+50&&r[1]+r[3]<=oy+50);
  assert(shadow.some(r=>r[2]>=40&&r[3]>=40),'a falling 2 × 2 rock\'s shadow floor covers its block');
}
// No-canvas fallback remains safe.
delete (globalThis as {OffscreenCanvas?:unknown}).OffscreenCanvas;
const fallback=context();snakeArtGame.draw(fallback.ctx,state,{width:375,height:600});assert.equal(fallback.stats.depth,0);
times.sort((a,b)=>a-b);console.log(JSON.stringify({checks:'warm cache, full-cell centring, sprite bounds, immutable drawing, pellet/death events, 32 sparks, reduced motion, fallback',segments:300,frames:600,caches:warm,liveBlur:stats.blur,medianMs:times[300],p95Ms:times[570]}));
