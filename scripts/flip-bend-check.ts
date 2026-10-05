import { strict as assert } from 'node:assert';
import { flipBendAt, flipGame, flipWarpAmp, flipWarpAt, FLIP_RUN_TICKS } from '@/lib/arcade/flip';

let earlyMax = 0;
let lateMax = 0;
for (const seed of [1, 17, 7919, 90210, 123456]) {
  const state = flipGame.init(seed);
  for (let tick = 0; tick <= FLIP_RUN_TICKS; tick++) {
    const bend = flipBendAt(tick);
    assert(Object.values(bend).every(Number.isInteger));
    const amp = flipWarpAmp(tick);
    assert(Number.isInteger(amp) && amp >= 0 && amp <= bend.displacement);
    if (tick <= 1200) assert.equal(amp, 0);
    if (tick >= 1500) assert.equal(amp, 145);
    if (tick <= 2700) assert.equal(bend.length, 1560);
    for (const x of [-90, 0, 100, 300]) {
      const worldX = state.x + x * 256;
      const floor = flipWarpAt(state, 0, worldX, tick);
      assert.equal(floor, flipWarpAt(state, 1, worldX, tick));
      assert(Number.isInteger(floor) && Math.abs(floor) <= amp);
      if (tick > 0) {
        const delta = Math.abs(floor - flipWarpAt(state, 0, worldX, tick - 1));
        if (tick >= 1500 && tick <= 2700) earlyMax = Math.max(earlyMax, delta);
        if (tick >= 3300) lateMax = Math.max(lateMax, delta);
        assert(delta <= 10, `phase discontinuity at ${tick}: ${delta}`);
      }
    }
  }
  const duplicate = flipGame.init(seed);
  assert.equal(state.rng, duplicate.rng);
  assert.equal(state.warpPeriod, duplicate.warpPeriod);
  assert.deepEqual(state.segs, duplicate.segs);
}
assert(earlyMax <= 3);
assert(lateMax > earlyMax);
console.log(`Flip curve checks passed: shared gap, integer offsets, continuous ramp; early max ${earlyMax}px/tick, late max ${lateMax}px/tick.`);