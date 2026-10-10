/** Distance-scaled capture pans (incl. skipped planets), settled holds, bounded flight pushes, on-screen rocket and replay parity. */
import assert from 'node:assert/strict';
import { FP, ORBIT_INPUT_TAP, ORBIT_TOTAL, lapPhases, orbitPos } from '../src/lib/arcade/orbit';
import { findHopTapDelay, orbitRev3Game, ORBIT_REV3_RUN_TICKS, initRev3From, decodeRev3Planets, ORBIT_REV3_WORLD_W, type OrbitRev3State } from '../src/lib/arcade/orbitRev3';
import { ORBIT_REV3_BANK } from '../src/lib/duel/orbitRev3Bank.server';
import { orbitStarAge, orbitRewardReset, ORBIT_STAR_TICKS } from '../src/lib/arcade/orbitRewards.renderer';
import { orbitRev3ArtGame } from '../src/lib/arcade/orbit.renderer';
import {
  orbitCamera, orbitNextRingShare, orbitCameraResetCache, orbitCameraObserve, orbitCameraPanning, orbitPanTicks,
  ORBIT_CAPTURE_PAN_TICKS, ORBIT_REDUCED_PAN_TICKS, ORBIT_CAPTURE_PAN_MAX_TICKS, ORBIT_REDUCED_PAN_MAX_TICKS,
  ORBIT_ROCKET_ON_SCREEN as M, ORBIT_FLIGHT_CATCH,
} from '../src/lib/arcade/orbitCamera';

type Cam = { x: number; y: number };
const onScreen = (x: number, y: number) => x >= M - 1e-6 && x <= 390 - M + 1e-6 && y >= M - 1e-6 && y <= 620 - M + 1e-6;
const inSafe = (x: number, y: number) => x >= 50 - 1e-6 && x <= 340 + 1e-6 && y >= 120 - 1e-6 && y <= 500 + 1e-6;
/** Peak per-tick speed of the smoothstep pan is 1.5 × distance ÷ duration; anything above this is a jump. */
const NO_JUMP = 24;
/** 0.7^n × 24 < 0.2 within 14 ticks: the glide is over by then. */
const ORBIT_GLIDE_TICKS = 14;
/** Change in per-tick camera velocity: pans ease in (smoothstep), so a snap shows up here. */
const MAX_ACCEL = 12;
let maxAccel = 0;

// Pan duration scales monotonically with distance: base for a normal hop, at most double.
for (const rm of [false, true]) {
  let last = 0;
  for (let d = 0; d <= 800; d += 5) {
    const t = orbitPanTicks(d, rm);
    assert(t >= last, 'pan ticks monotone in distance');
    last = t;
  }
  assert.equal(orbitPanTicks(100, rm), rm ? ORBIT_REDUCED_PAN_TICKS : ORBIT_CAPTURE_PAN_TICKS);
  assert.equal(orbitPanTicks(2000, rm), rm ? ORBIT_REDUCED_PAN_MAX_TICKS : ORBIT_CAPTURE_PAN_MAX_TICKS);
}

const seeds = [1, 17, 42, 1000, 7919, 90210, 123456, 2024, 555555, 8675309];
let ticks = 0, settled = 0, heldFlight = 0, pushedFlight = 0, flightOutsideSafe = 0;
const minimumPush = (s: OrbitRev3State, c: Cam) => ({
  x: Math.max(s.x / FP - 340, Math.min(s.x / FP - 50, c.x)),
  y: Math.max(s.y / FP - 500, Math.min(s.y / FP - 120, c.y)),
});
for (const seed of seeds) {
  orbitCameraResetCache();
  let state = orbitRev3ArtGame.init(seed);
  const initial = state;
  const events = new Map<number, { t: number; k: number; a: number; b: number; c: number; d: number }>();
  const expected = new Map<number, [Cam, Cam]>();
  let captureTick = -Infinity;
  let previous: [Cam, Cam] = [orbitCamera(state), orbitCamera(state, { reducedMotion: true })];
  const prevVel: Cam[] = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
  const flightStart = [0, 0];
  const advance = (input: { t: number; k: number; a: number; b: number; c: number; d: number } | null = null) => {
    const before = state;
    state = orbitRev3ArtGame.step(state, input);
    if (input) events.set(input.t, input);
    if (state.cur !== before.cur || state.captured !== before.captured || state.respawnTick !== before.respawnTick) captureTick = state.tick;
    const cameras: [Cam, Cam] = [orbitCamera(state), orbitCamera(state, { reducedMotion: true })];
    cameras.forEach((cam, mode) => {
      const x = state.x / FP - cam.x, y = state.y / FP - cam.y;
      const panning = orbitCameraPanning(state, { reducedMotion: mode === 1 });
      if (state.flying && !before.flying) flightStart[mode] = state.tick;
      assert(onScreen(x, y), `rocket on screen seed ${seed} tick ${state.tick}: ${x},${y}`);
      if (!panning && !state.flying) assert(inSafe(x, y), `settled safe box seed ${seed} tick ${state.tick}: ${x},${y}`);
      const prev = previous[mode];
      if (!prev) throw new Error('missing previous camera');
      const moved = Math.hypot(cam.x - prev.x, cam.y - prev.y);
      assert(moved <= NO_JUMP, `no camera jump seed ${seed} tick ${state.tick}: ${moved}`);
      const pv = prevVel[mode]!, accel = Math.hypot(cam.x - prev.x - pv.x, cam.y - prev.y - pv.y);
      assert(accel <= MAX_ACCEL, `no camera snap seed ${seed} tick ${state.tick}: accel ${accel} flying ${state.flying} before ${before.flying} cur ${before.cur}->${state.cur} pan ${panning} v ${JSON.stringify(pv)} mode ${mode}`);
      maxAccel = Math.max(maxAccel, accel);
      prevVel[mode] = { x: cam.x - prev.x, y: cam.y - prev.y };
      if (state.flying > 0 && state.tick - flightStart[mode]! < ORBIT_GLIDE_TICKS) {
        // An interrupted pan glides to a stop (decaying) — on screen and snap-free are asserted above.
        if (!inSafe(x, y)) flightOutsideSafe++;
        pushedFlight++;
      } else if (state.flying > 0) {
        const wanted = minimumPush(state, prev);
        const need = Math.hypot(wanted.x - prev.x, wanted.y - prev.y);
        assert(moved <= need + 1e-6, `flight camera never moves further than the minimum safety push seed ${seed} tick ${state.tick} moved ${moved} need ${need} since ${state.tick - flightStart[mode]!} mode ${mode}`);
        const wouldLeave = !onScreen(state.x / FP - prev.x, state.y / FP - prev.y);
        assert(moved <= ORBIT_FLIGHT_CATCH + 1e-6 || wouldLeave, 'flight catch-up is rate-limited unless the rocket would leave the screen');
        if (need === 0) assert.deepEqual(cam, prev, 'flight holds still when no push is needed');
        if (!inSafe(x, y)) flightOutsideSafe++;
        if (cam.x === prev.x && cam.y === prev.y) heldFlight++; else pushedFlight++;
      } else if (!panning && state.cur === before.cur && state.tick - captureTick > (mode ? ORBIT_REDUCED_PAN_MAX_TICKS : ORBIT_CAPTURE_PAN_MAX_TICKS)) {
        assert.deepEqual(cam, prev, `settled orbit must be still: seed ${seed}, tick ${state.tick}, mode ${mode}`);
        settled++;
      }
      if (!state.flying && !panning) assert(orbitNextRingShare(state, cam) >= .3, `settled next ring >=30% seed ${seed} tick ${state.tick}`);
    });
    expected.set(state.tick, cameras);
    previous = cameras;
    ticks++;
  };
  while (state.cur < ORBIT_TOTAL && !state.ended && state.tick < ORBIT_REV3_RUN_TICKS) {
    if (!state.flying) {
      const here = state.planets[state.cur];
      if (!here) throw new Error('missing planet');
      // Validate whole-path holds on an isolated visual branch once settled, without
      // delaying the timed hop witness (belt windows are tied to absolute sim ticks).
      if (!orbitCameraPanning(state)) {
        let branch: OrbitRev3State = { ...state, planets: state.planets.map(p => ({ ...p })) };
        const held = orbitCamera(branch);
        for (let k = 0; k < lapPhases(here).length * 2; k++) {
          branch = orbitRev3ArtGame.step(branch, null);
          if (branch.cur !== state.cur || branch.ended) break;
          assert.deepEqual(orbitCamera(branch), held, `whole orbit holds seed ${seed} planet ${state.cur}`);
        }
      }
      const delay = findHopTapDelay(state, state.worldW, lapPhases(here).length);
      assert(delay !== null, `seed ${seed}: missing release window`);
      for (let k = 0; k < delay; k++) advance();
      advance({ t: state.tick + 1, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 });
    } else advance();
  }
  assert(state.finished === 1, `seed ${seed} bot must finish`);
  orbitCameraResetCache();
  let replay = initial;
  orbitCameraObserve(replay);
  let pure = initial;
  for (let tick = 1; tick <= state.tick; tick++) {
    replay = orbitRev3ArtGame.step(replay, events.get(tick) ?? null);
    pure = orbitRev3Game.step(pure, events.get(tick) ?? null);
    // Draw sparsely: observation still runs at every pure sim tick.
    if (tick % 17 === 0 || tick === state.tick) {
      const wanted = expected.get(tick);
      assert(wanted);
      assert.deepEqual([orbitCamera(replay), orbitCamera(replay, { reducedMotion: true })], wanted, 'sparse/reveal replay parity');
    }
  }
  assert.deepEqual(replay, state, 'art wrapper must leave simulation bytes unchanged');
  assert.deepEqual(replay, pure, 'original pure simulation and camera-observing art wrapper must agree');
  console.log(`seed ${seed}: PASS ${state.tick} ticks, dense/sparse and reduced-motion parity`);
}
console.log(`orbit-camera-check: PASS; ${ticks} ticks, ${settled} settled holds, ${heldFlight} held flight samples, ${pushedFlight} bounded pushes (${flightOutsideSafe} flight samples outside the safe box, all on screen); pans ${ORBIT_CAPTURE_PAN_TICKS}–${ORBIT_CAPTURE_PAN_MAX_TICKS}/60s, reduced ${ORBIT_REDUCED_PAN_TICKS}–${ORBIT_REDUCED_PAN_MAX_TICKS}/60s`);

let minShare = 1, bankTicks = 0, orbitTicks = 0, captures = 0, stars = 0, skipCaps = 0;
const maxStep = [0, 0], maxSkipStep = [0, 0];
const panLen = [{ normal: [] as number[], skip: [] as number[] }, { normal: [] as number[], skip: [] as number[] }];
for (const entry of ORBIT_REV3_BANK) {
  orbitCameraResetCache();
  orbitRewardReset();
  let state = initRev3From(decodeRev3Planets(entry.planets), ORBIT_REV3_WORLD_W);
  orbitCameraObserve(state);
  const tapSet = new Set(entry.taps);
  let expectedStar = -Infinity;
  const prevCam: Cam[] = [orbitCamera(state), orbitCamera(state, { reducedMotion: true })];
  const open: ({ start: number; skip: boolean } | null)[] = [null, null];
  const bankVel: Cam[] = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
  for (let tick = 1; tick <= entry.ticks; tick++) {
    const before = state;
    state = orbitRev3ArtGame.step(state, tapSet.has(tick) ? { t: tick, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 } : null);
    if (state.captured > before.captured) {
      captures++;
      if (state.captured % 10 === 0) { expectedStar = tick; stars++; }
    }
    const captured = state.cur !== before.cur && !state.flying;
    const skipped = captured && state.cur - before.cur > 1;
    if (skipped) skipCaps++;
    assert.equal(orbitStarAge(state), Number.isFinite(expectedStar) ? tick - expectedStar : Infinity, 'capture-count star age, including sparse/final replay');
    for (const reducedMotion of [false, true]) {
      const mode = reducedMotion ? 1 : 0;
      const cam = orbitCamera(state, { reducedMotion });
      const x = state.x / FP - cam.x, y = state.y / FP - cam.y;
      const panning = orbitCameraPanning(state, { reducedMotion });
      assert(onScreen(x, y), `bank rocket on screen seed ${entry.seed} tick ${tick}`);
      if (!panning && !state.flying) assert(inSafe(x, y), 'bank settled rocket in safe box');
      const pc = prevCam[mode]!, step = Math.hypot(cam.x - pc.x, cam.y - pc.y);
      // No snap or correction step: the capture tick included, the camera eases in and out.
      assert(step <= NO_JUMP, `no camera jump seed ${entry.seed} tick ${tick}: ${step.toFixed(2)}`);
      const pv = bankVel[mode]!, accel = Math.hypot(cam.x - pc.x - pv.x, cam.y - pc.y - pv.y);
      assert(accel <= MAX_ACCEL, `no camera snap seed ${entry.seed} tick ${tick}: accel ${accel.toFixed(2)}`);
      maxAccel = Math.max(maxAccel, accel);
      bankVel[mode] = { x: cam.x - pc.x, y: cam.y - pc.y };
      maxStep[mode] = Math.max(maxStep[mode]!, step);
      if (captured) open[mode] = { start: tick, skip: skipped };
      const o = open[mode];
      if (o) {
        if (o.skip) {
          maxSkipStep[mode] = Math.max(maxSkipStep[mode]!, step);
          // The newly captured planet's orbit stays on screen throughout the pan.
          const p = state.planets[state.cur]!;
          const ring = Math.max(p.ring ?? 0, p.r ?? 0) / FP;
          const px = p.x / FP - cam.x, py = p.y / FP - cam.y;
          assert(px >= -ring && px <= 390 + ring && py >= -ring && py <= 620 + ring, 'skipped-capture planet stays on screen');
        }
        if (!panning || state.flying) {
          (o.skip ? panLen[mode]!.skip : panLen[mode]!.normal).push(tick - o.start);
          open[mode] = null;
        }
      }
      prevCam[mode] = cam;
      if (!state.flying && !panning) {
        const share = orbitNextRingShare(state, cam);
        minShare = Math.min(minShare, share);
        orbitTicks++;
        assert(share >= .3, `bank seed ${entry.seed} planet ${state.cur} tick ${tick}: ${(share * 100).toFixed(4)}%`);
      }
    }
    bankTicks++;
  }
  assert.equal(state.finished, 1, `bank witness still finishes seed ${entry.seed}`);
}
assert.equal(ORBIT_STAR_TICKS, 48);
assert(skipCaps > 0, 'bank witnesses exercise skipped-planet captures');
const stat = (a: number[]) => {
  const v = [...a].sort((x, y) => x - y);
  return v.length ? `median ${v[v.length >> 1]} / max ${v[v.length - 1]} ticks` : 'none';
};
console.log(`BANK PASS: ${ORBIT_REV3_BANK.length} layouts, ${bankTicks} ticks, ${orbitTicks} settled orbit samples, minimum settled next-ring arc ${(minShare * 100).toFixed(6)}%, ${captures} captures (${skipCaps} skipped-planet) / ${stars} shooting stars, 0 excluded`);
console.log(`PAN PASS: max velocity change ${maxAccel.toFixed(2)} units/tick²; max camera step ${maxStep[0]!.toFixed(2)} (reduced ${maxStep[1]!.toFixed(2)}) units/tick; skipped-capture max ${maxSkipStep[0]!.toFixed(2)}; normal pans ${stat(panLen[0]!.normal)}, skip pans ${stat(panLen[0]!.skip)}; reduced normal ${stat(panLen[1]!.normal)}, reduced skip ${stat(panLen[1]!.skip)}`);

// Fast witnesses can skip planets: independently verify every possible settled orbit.
let allOrbits = 0, allPoints = 0, framedMin = 1, visibleCentres = 0;
for (const entry of ORBIT_REV3_BANK) {
  const decoded = decodeRev3Planets(entry.planets);
  for (let cur = 0; cur < ORBIT_TOTAL; cur++) {
    const planets = decoded.map(p => ({ ...p }));
    const p = planets[cur];
    assert(p);
    const pos = orbitPos(p, 0);
    const state = { ...initRev3From(planets, ORBIT_REV3_WORLD_W), cur, x: pos.x, y: pos.y };
    const cam = orbitCamera(state), share = orbitNextRingShare(state, cam);
    assert(share >= .3, 'every possible bank orbit shows >=30% of next path');
    framedMin = Math.min(framedMin, share);
    for (let phase = 0; phase < 65536; phase += 64) {
      const q = orbitPos(p, phase), x = q.x / FP - cam.x, y = q.y / FP - cam.y;
      assert(x >= 50 && x <= 340 && y >= 120 && y <= 500, 'whole current orbit stays in safe box');
      allPoints++;
    }
    const next = planets[cur + 1];
    assert(next);
    if (next.x / FP >= cam.x && next.x / FP <= cam.x + 390 && next.y / FP >= cam.y && next.y / FP <= cam.y + 620) visibleCentres++;
    allOrbits++;
  }
}
console.log(`ALL ORBITS PASS: ${allOrbits} orbits/${allPoints} phase points, settled minimum ${(framedMin * 100).toFixed(6)}%, next centres visible ${visibleCentres}/${allOrbits}`);
