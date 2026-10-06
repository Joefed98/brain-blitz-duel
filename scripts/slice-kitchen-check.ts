/** Non-browser drawing/geometry checks only; no replay or identity proof. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import { drawSliceArt, drawSliceKitchenExample, SLICE_FOODS } from '../src/lib/arcade/slice.renderer';
import { sliceGame, SLICE_R, SLICE_SPECIAL_R, SLICE_WORLD_W, SLICE_WORLD_H, SLICE_COLOURS } from '../src/lib/arcade/slice';
let allocations=0,reduced=false,clock=12000;
Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>clock}});
Object.defineProperty(globalThis,'window',{configurable:true,value:{matchMedia:()=>({matches:reduced})}});
const surfaces:ReturnType<typeof createCanvas>[]=[];
class Surface {constructor(w:number,h:number){allocations++;const c=createCanvas(w,h);surfaces.push(c);return c;}}
Object.defineProperty(globalThis,'OffscreenCanvas',{configurable:true,value:Surface});
const initial=sliceGame.init(21);
assert.equal(SLICE_FOODS.length,SLICE_COLOURS.length);
const objects=Array.from({length:7},(_,i)=>({...initial.objects[0],launchTick:60,x:(35+i*50)*256,vx:0,vy:-1024,lastTick:500,bomb:i===6,special:i===4?1:i===5?2:0,colour:i%4,payload:[]}));
const state: typeof initial={...initial,objects,slicedAt:objects.map(()=>0),tick:100,slowFrom:[],frenzyFrom:[]};
let checks=0;
for(const [width,height] of [[382,510],[367,477]])for(const still of [false,true]) {
 reduced=still;const c=createCanvas(width*2,height*2),native=c.getContext('2d');native.scale(2,2);
 const blits:number[][]=[];
 const ctx=new Proxy(native,{get(target,key){if(key==='drawImage')return (image:unknown,...args:number[])=>{blits.push(args);return target.drawImage(image as never,...args as [number,number,number,number]);};const v=Reflect.get(target,key,target);return typeof v==='function'?v.bind(target):v;},set(target,key,value){return Reflect.set(target,key,value,target);}}) as unknown as CanvasRenderingContext2D;
 const before=JSON.stringify(state);drawSliceArt(ctx,state,{width,height});assert.equal(JSON.stringify(state),before);assert.equal(blits.length,9);
 for(let i=0;i<7;i++){const o=objects[i],r=o.special?SLICE_SPECIAL_R:SLICE_R;assert(blits.some(b=>b[0]===o.x/256-r&&b[2]===2*r&&b[3]===2*r),'exact sim diameter and x centre');}
 const warm=allocations;for(let frame=0;frame<30;frame++){clock+=16;drawSliceArt(ctx,state,{width,height});}assert.equal(allocations,warm,'cached warm-frame art');
 writeFileSync(`/tmp/slice-kitchen/live-${width}-${still}.png`,c.toBuffer('image/png'));
 state.slicedAt=objects.map((_,i)=>i<4?100:0);state.tick=101;state.swipe=[0,560,390,480];
 const cutBefore=JSON.stringify(state);drawSliceArt(ctx,state,{width,height});assert.equal(JSON.stringify(state),cutBefore);
 writeFileSync(`/tmp/slice-kitchen/cut-${width}-${still}.png`,c.toBuffer('image/png'));
 state.slicedAt=objects.map(()=>0);state.tick=100;state.swipe=null;checks++;
}
// Every circle-stamped sprite preserves full diameter and never paints outside its raster envelope.
for(const c of surfaces.filter(c=>c.width===c.height)){
 const {data}=c.getContext('2d').getImageData(0,0,c.width,c.height);let minX=c.width,minY=c.height,maxX=-1,maxY=-1;
 for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>20){minX=Math.min(x,minX);minY=Math.min(y,minY);maxX=Math.max(x,maxX);maxY=Math.max(y,maxY);}
 assert(minX<=2&&minY<=2&&maxX>=c.width-3&&maxY>=c.height-3,'collision silhouette reaches all four extents within 2px');
}
const preview=createCanvas(168,120);drawSliceKitchenExample(preview.getContext('2d') as unknown as CanvasRenderingContext2D);writeFileSync('/tmp/slice-kitchen/example.png',preview.toBuffer('image/png'));
const sounds=readFileSync('src/lib/fx/gameSounds.ts','utf8').split('export function sliceSounds()')[1]??'';
for(const id of ['arc_swoosh','arc_crash','arc_pickup'])assert(sounds.includes(`"${id}"`));assert(!sounds.includes('arc_sea_'));
const art=readFileSync('src/lib/arcade/slice.renderer.ts','utf8');assert(art.includes('particles<FX_PARTICLE_LIMIT'));assert(art.includes("./cache.renderer"));assert(!art.includes('shadowBlur'));assert(!art.includes('seas.renderer'));
console.log(JSON.stringify({checks,mapping:SLICE_FOODS,cachedSurfaces:allocations,phoneSizes:['390x700','375x667'],bounds:'exact 40px food/hazard and 32px special stamps; raster extents within 2px',motion:'normal and reduced',browserTests:0,identityProofs:0}));
