/** Capture pans, strict settled holds, minimum flight pushes and replay parity. */
import assert from 'node:assert/strict';
import { FP, ORBIT_INPUT_TAP, ORBIT_TOTAL, lapPhases, orbitPos } from '../src/lib/arcade/orbit';
import { findHopTapDelay, orbitRev3Game, ORBIT_REV3_RUN_TICKS, initRev3From, decodeRev3Planets, ORBIT_REV3_WORLD_W, type OrbitRev3State } from '../src/lib/arcade/orbitRev3';
import { ORBIT_REV3_BANK } from '../src/lib/duel/orbitRev3Bank.server';
import { orbitStarAge, orbitRewardReset, ORBIT_STAR_TICKS } from '../src/lib/arcade/orbitRewards.renderer';
import { orbitRev3ArtGame } from '../src/lib/arcade/orbit.renderer';
import { orbitCamera, orbitNextRingShare, orbitCameraResetCache, orbitCameraObserve, ORBIT_CAPTURE_PAN_TICKS, ORBIT_REDUCED_PAN_TICKS } from '../src/lib/arcade/orbitCamera';
const seeds = [1,17,42,1000,7919,90210,123456,2024,555555,8675309];
let ticks = 0, settled = 0, heldFlight = 0, pushedFlight = 0;
const minimumPush = (s: OrbitRev3State, c: {x:number;y:number}) => ({
 x: Math.max(s.x/FP-340, Math.min(s.x/FP-50,c.x)),
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
    assert(x>=50-1e-6&&x<=340+1e-6&&y>=120-1e-6&&y<=500+1e-6,`safe box seed ${seed} tick ${state.tick}: ${x},${y}`);
   const prev=previous[mode]; if(!prev) throw new Error('missing previous camera');
   if(state.flying>0) {
    const wanted=minimumPush(state,prev);
    assert.deepEqual(cam,wanted,'flight camera moves by the minimum safety displacement only');
    if(cam.x===prev.x&&cam.y===prev.y) heldFlight++; else pushedFlight++;
   } else if(state.cur===before.cur&&state.tick-captureTick>(mode?ORBIT_REDUCED_PAN_TICKS:ORBIT_CAPTURE_PAN_TICKS)) {
    assert.deepEqual(cam,prev,`settled orbit must be still: seed ${seed}, tick ${state.tick}, mode ${mode}`);settled++;
   }
    if(!state.flying) assert(orbitNextRingShare(state,cam)>=.3,`next ring >=30% seed ${seed} tick ${state.tick}`);
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
console.log(`orbit-camera-check: PASS; ${ticks} ticks, ${settled} settled holds, ${heldFlight} held flight samples, ${pushedFlight} minimum pushes; pans ${ORBIT_CAPTURE_PAN_TICKS}/60s and ${ORBIT_REDUCED_PAN_TICKS}/60s`);
let minShare=1,bankTicks=0,orbitTicks=0,captures=0,stars=0;
for(const entry of ORBIT_REV3_BANK){
 orbitCameraResetCache(); orbitRewardReset();
 let state=initRev3From(decodeRev3Planets(entry.planets),ORBIT_REV3_WORLD_W);
 orbitCameraObserve(state);
 const tapSet=new Set(entry.taps);
 let expectedStar=-Infinity;
 for(let tick=1;tick<=entry.ticks;tick++){
  const before=state;
  state=orbitRev3ArtGame.step(state,tapSet.has(tick)?{t:tick,k:ORBIT_INPUT_TAP,a:0,b:0,c:0,d:0}:null);
  if(state.captured>before.captured){captures++;if(state.captured%10===0){expectedStar=tick;stars++;}}
  assert.equal(orbitStarAge(state),Number.isFinite(expectedStar)?tick-expectedStar:Infinity,'capture-count star age, including sparse/final replay');
  for(const reducedMotion of [false,true]){
   const cam=orbitCamera(state,{reducedMotion});
   const x=state.x/FP-cam.x,y=state.y/FP-cam.y;
   assert(x>=50-1e-6&&x<=340+1e-6&&y>=120-1e-6&&y<=500+1e-6,'bank rocket safe');
   if(!state.flying){
    const share=orbitNextRingShare(state,cam);minShare=Math.min(minShare,share);orbitTicks++;
    assert(share>=.3,`bank seed ${entry.seed} planet ${state.cur} tick ${tick}: ${(share*100).toFixed(4)}%`);
   }
  }
  bankTicks++;
 }
 assert.equal(state.finished,1,`bank witness still finishes seed ${entry.seed}`);
}
assert.equal(ORBIT_STAR_TICKS,48);
console.log(`BANK PASS: ${ORBIT_REV3_BANK.length} layouts, ${bankTicks} ticks, ${orbitTicks} orbit/motion samples, minimum next-ring arc ${(minShare*100).toFixed(6)}%, ${captures} captures/${stars} shooting stars, 0 excluded`);
// Fast witnesses can skip planets: independently verify every possible orbit.
let allOrbits=0,allPoints=0,framedMin=1,visibleCentres=0;
for(const entry of ORBIT_REV3_BANK){
 const decoded=decodeRev3Planets(entry.planets);
 for(let cur=0;cur<ORBIT_TOTAL;cur++){
  const planets=decoded.map(p=>({...p}));
  const p=planets[cur];assert(p);
  const pos=orbitPos(p,0);
  const state={...initRev3From(planets,ORBIT_REV3_WORLD_W),cur,x:pos.x,y:pos.y};
  const cam=orbitCamera(state),share=orbitNextRingShare(state,cam);
  assert(share>=.3,'every possible bank orbit shows >=30% of next path');framedMin=Math.min(framedMin,share);
  for(let phase=0;phase<65536;phase+=64){
   const q=orbitPos(p,phase),x=q.x/FP-cam.x,y=q.y/FP-cam.y;
   assert(x>=50&&x<=340&&y>=120&&y<=500,'whole current orbit stays in safe box');allPoints++;
  }
  const next=planets[cur+1];assert(next);
  if(next.x/FP>=cam.x&&next.x/FP<=cam.x+390&&next.y/FP>=cam.y&&next.y/FP<=cam.y+620)visibleCentres++;
  allOrbits++;
 }
}
console.log(`ALL ORBITS PASS: ${allOrbits} orbits/${allPoints} phase points, settled minimum ${(framedMin*100).toFixed(6)}%, next centres visible ${visibleCentres}/${allOrbits}`);
