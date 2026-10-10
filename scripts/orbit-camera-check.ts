/** Capture pans, strict settled holds, minimum flight pushes and replay parity. */
import assert from 'node:assert/strict';
import { FP, ORBIT_INPUT_TAP, ORBIT_TOTAL, lapPhases } from '../src/lib/arcade/orbit';
import { findHopTapDelay, orbitRev3Game, ORBIT_REV3_RUN_TICKS, type OrbitRev3State } from '../src/lib/arcade/orbitRev3';
import { orbitRev3ArtGame } from '../src/lib/arcade/orbit.renderer';
import { orbitCamera, orbitCameraArrow, orbitCameraResetCache, orbitCameraObserve, ORBIT_CAPTURE_PAN_TICKS, ORBIT_REDUCED_PAN_TICKS } from '../src/lib/arcade/orbitCamera';
const seeds = [1,17,42,1000,7919,90210,123456,2024,555555,8675309];
let ticks = 0, settled = 0, heldFlight = 0, pushedFlight = 0, arrows = 0;
const minimumPush = (s: OrbitRev3State, c: {x:number;y:number}) => ({
 x: Math.max(s.x/FP-320, Math.min(s.x/FP-70,c.x)),
 y: Math.max(s.y/FP-500, Math.min(s.y/FP-120,c.y)),
});
for (const seed of seeds) {
 orbitCameraResetCache();
 let state = orbitRev3ArtGame.init(seed);
 const initial = state;
 const events = new Map<number, {t:number;k:number;a:number;b:number;c:number;d:number}>();
 const expected = new Map<number, [{x:number;y:number},{x:number;y:number}]>();
 let captureTick = -Infinity;
 let previous = [orbitCamera(state), orbitCamera(state,{reducedMotion:true})];
 const advance = (input: {t:number;k:number;a:number;b:number;c:number;d:number}|null = null) => {
  const before = state;
  state = orbitRev3ArtGame.step(state,input);
  if (input) events.set(input.t,input);
  if (state.cur !== before.cur || state.captured !== before.captured || state.respawnTick !== before.respawnTick) captureTick=state.tick;
  const cameras: [{x:number;y:number},{x:number;y:number}] = [orbitCamera(state),orbitCamera(state,{reducedMotion:true})];
  cameras.forEach((cam,mode)=>{
   const x=state.x/FP-cam.x,y=state.y/FP-cam.y;
   assert(x>=70-1e-6&&x<=320+1e-6&&y>=120-1e-6&&y<=500+1e-6,`safe box seed ${seed} tick ${state.tick}: ${x},${y}`);
   const prev=previous[mode]; if(!prev) throw new Error('missing previous camera');
   if(state.flying>0) {
    const wanted=minimumPush(state,prev);
    assert.deepEqual(cam,wanted,'flight camera moves by the minimum safety displacement only');
    if(cam.x===prev.x&&cam.y===prev.y) heldFlight++; else pushedFlight++;
   } else if(state.cur===before.cur&&state.tick-captureTick>(mode?ORBIT_REDUCED_PAN_TICKS:ORBIT_CAPTURE_PAN_TICKS)) {
    assert.deepEqual(cam,prev,`settled orbit must be still: seed ${seed}, tick ${state.tick}, mode ${mode}`);settled++;
   }
   const next=state.planets[Math.min(state.cur+1,state.planets.length-1)];
   const arrow=orbitCameraArrow(state,cam);
   if(next){const r=next.ring/FP;const px=next.x/FP-cam.x,py=next.y/FP-cam.y;
    assert(arrow!==null||(px+r>=0&&px-r<=390&&py+r>=0&&py-r<=620),'next planet visible or arrowed');}
   if(arrow)arrows++;
  });
  expected.set(state.tick,cameras);previous=cameras;ticks++;
 };
 while(state.cur<ORBIT_TOTAL&&!state.ended&&state.tick<ORBIT_REV3_RUN_TICKS){
  if(!state.flying){
   const here=state.planets[state.cur];if(!here)throw new Error('missing planet');
   // Validate whole-path holds on an isolated visual branch, without delaying
   // the timed hop witness (belt windows are tied to absolute sim ticks).
   let branch: OrbitRev3State = { ...state, planets: state.planets.map(p=>({...p})) };
   const held = orbitCamera(branch);
   for(let k=0;k<lapPhases(here).length*2;k++) {
    branch=orbitRev3ArtGame.step(branch,null);
    if(branch.cur!==state.cur||branch.ended)break;
    assert.deepEqual(orbitCamera(branch),held,`whole orbit holds seed ${seed} planet ${state.cur}`);
   }
   const delay=findHopTapDelay(state,state.worldW,lapPhases(here).length);
   assert(delay!==null,`seed ${seed}: missing release window`);
   for(let k=0;k<delay;k++)advance();
   advance({t:state.tick+1,k:ORBIT_INPUT_TAP,a:0,b:0,c:0,d:0});
  }else advance();
 }
 assert(state.finished===1,`seed ${seed} bot must finish`);
 orbitCameraResetCache();
 let replay=initial;orbitCameraObserve(replay);
 let pure=initial;
 for(let tick=1;tick<=state.tick;tick++){
  replay=orbitRev3ArtGame.step(replay,events.get(tick)??null);
  pure=orbitRev3Game.step(pure,events.get(tick)??null);
  // Draw sparsely: observation still runs at every pure sim tick.
  if(tick%17===0||tick===state.tick){
   const wanted=expected.get(tick);assert(wanted);
   assert.deepEqual([orbitCamera(replay),orbitCamera(replay,{reducedMotion:true})],wanted,'sparse/reveal replay parity');
  }
 }
 assert.deepEqual(replay,state,'art wrapper must leave simulation bytes unchanged');
 assert.deepEqual(replay,pure,'original pure simulation and camera-observing art wrapper must agree');
 console.log(`seed ${seed}: PASS ${state.tick} ticks, dense/sparse and reduced-motion parity`);
}
console.log(`orbit-camera-check: PASS; ${ticks} ticks, ${settled} settled holds, ${heldFlight} held flight samples, ${pushedFlight} minimum pushes, ${arrows} arrows; pans ${ORBIT_CAPTURE_PAN_TICKS}/60s and ${ORBIT_REDUCED_PAN_TICKS}/60s`);
