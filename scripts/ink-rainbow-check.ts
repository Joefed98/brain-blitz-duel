/** Artwork-only native-canvas checks: no browser, replay or identity proof. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { performance as timer } from 'node:perf_hooks';
import { createCanvas } from '@napi-rs/canvas';
import { drawInkBridgeArt, drawInkRainbowExample, inkFailedOnBlock } from '../src/lib/arcade/inkBridge.renderer';
import { inkBridgeGame, inkBudget, inkBucketX, INK_BLOCK_H, type InkState } from '../src/lib/arcade/inkBridge';
let reduced=false, allocations=0;
Object.defineProperty(globalThis,'window',{configurable:true,value:{matchMedia:()=>({matches:reduced})}});
const surfaces:ReturnType<typeof createCanvas>[]=[];
class Surface { constructor(w:number,h:number){allocations++;const c=createCanvas(w,h);surfaces.push(c);return c;} }
Object.defineProperty(globalThis,'OffscreenCanvas',{configurable:true,value:Surface});
const initial=inkBridgeGame.init(21), level=initial.list[9];assert(level);
const segments=Array.from({length:200},(_,i)=>({x0:30+(i%50)*6,y0:270+Math.floor(i/50)*42,x1:36+(i%50)*6,y1:271+Math.floor(i/50)*42,len:6}));
const state:InkState={...initial,level:9,levels:9,tick:400,ink:inkBudget(9)*256-1200*256,segs:segments,strokeStarts:[0,50,100,150],dropping:1,ball:{...initial.ball,x:200*256,y:260*256},positions:Array.from({length:5},(_,i)=>({x:(197+i)*256,y:(249+i*2)*256}))};
const results=[];
for(const [width,height] of [[382,454],[367,421]] as const)for(const still of [false,true]){
 reduced=still;
 const c=createCanvas(width*2,height*2),native=c.getContext('2d');native.scale(2,2);
 const rects:number[][]=[],blits:number[][]=[],arcs:number[][]=[];
 const ctx=new Proxy(native,{get(target,key){const v=Reflect.get(target,key,target);if(key==='fillRect')return(...args:number[])=>{rects.push(args);return target.fillRect(...args as [number,number,number,number]);};if(key==='drawImage')return(image:unknown,...args:number[])=>{blits.push(args);return target.drawImage(image as never,...args as [number,number,number,number]);};if(key==='arc')return(...args:number[])=>{arcs.push(args);return target.arc(...args as [number,number,number,number,number]);};return typeof v==='function'?v.bind(target):v;},set(target,key,value){return Reflect.set(target,key,value,target);}}) as unknown as CanvasRenderingContext2D;
 const before=JSON.stringify(state);drawInkBridgeArt(ctx,state,{width:390,height:620});assert.equal(JSON.stringify(state),before);
 for(const b of level.blocks)assert(rects.some(r=>r[0]===b.x0&&r[1]===b.y&&r[2]===b.x1-b.x0&&r[3]===INK_BLOCK_H),'full hazard rectangle');
 assert(blits.some(b=>b[0]===193&&b[1]===253&&b[2]===14&&b[3]===14),'exact 14px coin stamp');
 const bx=inkBucketX(level,state.tick);assert(blits.some(b=>b[0]===bx-32&&b[1]===level.bucketY&&b[2]===64&&b[3]===36),'exact pot body');
 assert(arcs.some(a=>a[0]===bx-32&&a[1]===level.bucketY&&a[2]===4));assert(arcs.some(a=>a[0]===bx+32&&a[1]===level.bucketY&&a[2]===4));
 const left=274+100*(1-state.ink/(inkBudget(9)*256));assert(left>274,'meter empties on left');
 const warm=allocations,ms=[];
 // Match the unchanged stage's non-uniform world transform and DPR cap.
 for(let i=0;i<360;i++){native.save();native.scale(width/390,height/620);const start=timer.now();drawInkBridgeArt(ctx,{...state,tick:400+i},{width:390,height:620});ms.push(timer.now()-start);native.restore();}
 assert.equal(allocations,warm,'no warm-frame surface allocations');assert.equal(JSON.stringify(state),before);
 ms.sort((a,b)=>a-b);results.push({arena:`${width}x${height}`,reduced:still,level:10,segments:200,drawMedian:ms[180],drawP95:ms[342],drawMean:ms.reduce((a,b)=>a+b,0)/ms.length});
 native.save();native.scale(width/390,height/620);drawInkBridgeArt(ctx,state,{width:390,height:620});native.restore();
 writeFileSync(`/tmp/ink-rainbow/level10-${width}-${still}.png`,c.toBuffer('image/png'));
 // Verify undo / reset rebuild cached paths without altering state.
 drawInkBridgeArt(ctx,{...state,segs:segments.slice(0,50),strokeStarts:[0]}, {width:390,height:620});
 drawInkBridgeArt(ctx,{...state,segs:[],strokeStarts:[]}, {width:390,height:620});assert.equal(allocations,warm);
}
const block=level.blocks[0];assert(block);
const failed={...state,flashKind:2,flashTick:400,failedBall:{x:block.x0*256,y:block.y*256}};assert(inkFailedOnBlock(failed));assert(!inkFailedOnBlock({...failed,failedBall:{x:200*256,y:630*256}}));assert(!inkFailedOnBlock({...failed,flashKind:1}));
const coin=surfaces.find(s=>s.width===28&&s.height===28);assert(coin);
const {data}=coin.getContext('2d').getImageData(0,0,28,28);let minX=28,minY=28,maxX=0,maxY=0;
for(let y=0;y<28;y++)for(let x=0;x<28;x++)if(data[(y*28+x)*4+3]>20){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
assert(minX<=2&&minY<=2&&maxX>=25&&maxY>=25);
const preview=createCanvas(336,260);preview.getContext('2d').scale(2,2);drawInkRainbowExample(preview.getContext('2d') as unknown as CanvasRenderingContext2D);writeFileSync('/tmp/ink-rainbow/example.png',preview.toBuffer('image/png'));
const sounds=readFileSync('src/lib/fx/gameSounds.ts','utf8').split('export function inkBridgeSounds()')[1]?.split('/* ============================== High Seas')[0]??'';
for(const id of ['arc_fair_bell','arc_thud'])assert(sounds.includes(`"${id}"`));for(const id of ['arc_marble','arc_splash','arc_sea','stage_complete'])assert(!sounds.includes(id));
const feedback=readFileSync('src/lib/fx/arcade.ts','utf8');assert(feedback.includes('fx.onComplete()'));
const hook=readFileSync('src/components/puzzles/useArcadeFrameTiming.ts','utf8');assert(hook.includes('devDiagnosticsOn()'));assert(hook.includes('Draw ${mean("draw")'));assert(hook.includes('p95'));
const baseline=JSON.parse(readFileSync('/tmp/ink-rainbow/baseline.json','utf8'));const {createHash}=await import('node:crypto');const allowed=['src/lib/arcade/inkBridge.renderer.ts','src/puzzles/inkBridge.tsx','src/lib/fx/gameSounds.ts','src/lib/fx/manifest.ts','src/lib/arcade/AGENTS.md'];
for(const [path,hash] of Object.entries(baseline))if(!allowed.includes(path))assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),hash,`protected file changed: ${path}`);
writeFileSync('/tmp/ink-rainbow/results.json',JSON.stringify({results,cachedSprites:5,perCanvasBridgeRaster:1,allocations,protectedFiles:Object.keys(baseline).length-allowed.length,browserTests:0,identityProofs:0},null,2));console.log(readFileSync('/tmp/ink-rainbow/results.json','utf8'));
