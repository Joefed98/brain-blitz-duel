import assert from "node:assert/strict";
import { orbitGame, orbitBeltRadius, orbitBeltOffset, orbitBeltStart, orbitFlightHitsBelt, orbitCourseCheck, orbitCheckpoint, ORBIT_BELT_CLEARANCE, ORBIT_ROCKET_DIAMETER, ORBIT_BELT_PERIOD_TICKS, ORBIT_BELT_SPAN, ORBIT_CHECKPOINT_INTERVAL, type OrbitState } from "../src/lib/arcade/orbit";
import { encodeOrbitRun, replayOrbitRun } from "../src/lib/duel/orbit";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";

let belts = 0, minRadius = Infinity, finished = 0, maxWait = 0;
function flight(state: OrbitState) {
  let probe = orbitGame.step(state, { t: state.tick + 1, k: 0, a: 0, b: 0, c: 0, d: 0 });
  while (probe.flying > 0 && !orbitGame.isOver(probe)) probe = orbitGame.step(probe, null);
  return probe;
}
for (let sample = 0; sample < 200; sample++) {
  const seed = sample * 7919 + 1;
  const initial = orbitGame.init(seed);
  const check = orbitCourseCheck(seed);
  assert.equal(check.safe, check.hops, `seed ${seed}: every generated hop`);
  for (const [index, p] of initial.planets.entries()) {
    if (p.hazard < 0) continue;
    assert(index >= 31 && index <= 39);
    belts++;
    minRadius = Math.min(minRadius, orbitBeltRadius(p));
    assert.equal(orbitBeltRadius(p) - p.ring, ORBIT_BELT_CLEARANCE);
    assert.equal(orbitBeltStart(p, 0), orbitBeltStart(p, ORBIT_BELT_PERIOD_TICKS));
    const o = orbitBeltOffset(p, (p.hazard + ORBIT_BELT_SPAN / 2) & 65535);
    assert(orbitFlightHitsBelt(p, p.x + o.u, p.y + o.v, p.x + o.u, p.y + o.v, 0));
    const gap = orbitBeltOffset(p, (p.hazard + ORBIT_BELT_SPAN + 32768) & 65535);
    assert(!orbitFlightHitsBelt(p, p.x + gap.u, p.y + gap.v, p.x + gap.u, p.y + gap.v, 0));
    // Holding any belt planet is safe over two whole belt revolutions.
    let hold: OrbitState = { ...initial, cur: index, tick: 0, best: index };
    for (let t = 0; t < ORBIT_BELT_PERIOD_TICKS * 2; t++) {
      hold = orbitGame.step(hold, null);
      assert.equal(hold.ended, 0);
      assert.equal(hold.flying, 0);
    }
  }
  // Real tick-driven successful arrival/departure logs, not only early random crashes.
  let state = initial, wait = 0;
  const events: ArcadeInputEvent[] = [];
  const checkpoints: ReturnType<typeof orbitCheckpoint>[] = [];
  while (!orbitGame.isOver(state)) {
    let event: ArcadeInputEvent | null = null;
    if (state.flying === 0) {
      const probe = flight(state);
      if (probe.cur > state.cur && probe.ended !== 2) {
        event = { t: state.tick + 1, k: 0, a: 0, b: 0, c: 0, d: 0 };
        events.push(event);
        maxWait = Math.max(maxWait, wait); wait = 0;
      } else wait++;
    }
    state = orbitGame.step(state, event);
    if (state.tick % ORBIT_CHECKPOINT_INTERVAL === 0) checkpoints.push(orbitCheckpoint(state));
  }
  assert.equal(state.finished, 1, `seed ${seed}: full course timed hops before timeout; best ${state.best}`);
  const result = replayOrbitRun(seed, encodeOrbitRun({ seed, events, checkpoints, endTick: state.tick, claimedScore: orbitGame.score(state) }));
  assert.equal(result.flagged, false);
  assert.equal(result.desyncTick, null);
  assert.deepEqual(result.state, state);
  assert.equal(result.score, orbitGame.score(state));
  finished++;
}
// 270-degree opening. Endpoint chord is the conservative narrowest straight opening.
const diameter = ORBIT_ROCKET_DIAMETER / 256;
const radius = minRadius / 256;
console.log(`PASS 200 courses / 8000 verified hops / ${belts} belts; ${finished} full-sun identity logs; max wait ${maxWait} ticks.`);
console.log(`Clearance ${ORBIT_BELT_CLEARANCE} fixed-point = ${ORBIT_BELT_CLEARANCE / 256}px = 2.5 enclosing rocket diameters (${diameter}px).`);
console.log(`Minimum radius ${radius}px; opening 270 degrees; open arc ${(radius * Math.PI * 1.5 / diameter).toFixed(3)} rocket widths; endpoint chord ${(radius * Math.SQRT2 / diameter).toFixed(3)} widths (${((radius * Math.SQRT2 - 25) / diameter).toFixed(3)} after both collision pads).`);