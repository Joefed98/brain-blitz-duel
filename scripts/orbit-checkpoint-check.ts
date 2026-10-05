import { strict as assert } from 'node:assert';
import { inputAt, recordInput, type ArcadeInputEvent } from '@/lib/arcade/engine';
import { orbitCanSetCheckpoint, orbitCheckpoint, orbitExtra, orbitGame, ORBIT_CHECKPOINT_INTERVAL, ORBIT_INPUT_CHECKPOINT, ORBIT_INPUT_TAP, type OrbitCheckpoint, type OrbitState } from '@/lib/arcade/orbit';
import { encodeOrbitRun, replayOrbitRun } from '@/lib/duel/orbit';
import { buildArcadeReveal } from '@/lib/arcade/reveal';

const event = (t: number, k: number): ArcadeInputEvent => ({ t, k, a: 0, b: 0, c: 0, d: 0 });
function flightOutcome(state: OrbitState) {
  let probe = orbitGame.step(state, event(state.tick + 1, ORBIT_INPUT_TAP));
  while (probe.flying > 0 && !orbitGame.isOver(probe)) probe = orbitGame.step(probe, null);
  return probe;
}

let proofs = 0;
for (const seed of [1, 17, 7919, 90210, 123456]) {
  for (const mode of ['early', 'late', 'never'] as const) {
    let state = orbitGame.init(seed);
    const events: ArcadeInputEvent[] = [];
    const checkpoints: OrbitCheckpoint[] = [];
    const advance = (kind?: number) => {
      const tick = state.tick + 1;
      if (kind !== undefined) recordInput(events, event(tick, kind), orbitGame.inputRanges);
      state = orbitGame.step(state, inputAt(events, tick));
      if (state.tick % ORBIT_CHECKPOINT_INTERVAL === 0) checkpoints.push(orbitCheckpoint(state));
    };
    // First make a real safe hop, so selection and respawn aren't only tested on planet zero.
    while (state.cur === 0 && state.tick < 400) {
      if (state.flying === 0 && flightOutcome(state).cur > state.cur && flightOutcome(state).ended === 0) advance(ORBIT_INPUT_TAP);
      else advance();
    }
    assert(state.cur > 0 && state.ended === 0, 'safe first hop');
    const selectedPlanet = state.cur;
    if (mode !== 'early') while (state.tick < 2400) advance();
    assert.equal(state.checkpoint, -1, 'no automatic checkpoint at 30 seconds');
    if (mode !== 'never') {
      assert(orbitCanSetCheckpoint(state));
      advance(ORBIT_INPUT_CHECKPOINT);
      assert.equal(state.checkpoint, selectedPlanet);
      assert.equal(state.flying, 0, 'set does not release ship');
      assert(!orbitCanSetCheckpoint(state));
      advance(ORBIT_INPUT_CHECKPOINT);
      assert.equal(state.checkpoint, selectedPlanet, 'selection immutable');
    }
    // Find a naturally fatal release; preview without checkpoint to select a genuine miss.
    while (!orbitGame.isOver(state)) {
      if (state.flying === 0) {
        const probe = flightOutcome({ ...state, checkpoint: -1 });
        if (probe.ended === 2) {
          const previousRespawns = state.respawns;
          advance(ORBIT_INPUT_TAP);
          // Setting during flight must be recorded but ignored.
          if (state.flying > 0) {
            const before = state.checkpoint;
            advance(ORBIT_INPUT_CHECKPOINT);
            assert.equal(state.checkpoint, before);
          }
          while (state.flying > 0 && !orbitGame.isOver(state)) advance();
          if (mode !== 'never' && previousRespawns === 1) {
            assert.equal(state.cur, selectedPlanet);
            assert.equal(state.respawns, 0);
            assert.equal(state.flying, 0);
            assert(!orbitCanSetCheckpoint(state));
            advance(ORBIT_INPUT_CHECKPOINT);
            assert.equal(state.checkpoint, selectedPlanet);
          }
        } else advance();
      } else advance();
      assert(state.tick < 5400, 'fatal release found before timeout');
    }
    assert.equal(state.ended, 2);
    assert.equal(state.respawns, mode === 'never' ? 1 : 0);
    assert.equal(orbitGame.score(state), 3 * state.best);
    const result = replayOrbitRun(seed, encodeOrbitRun({ seed, events, checkpoints, endTick: state.tick, claimedScore: orbitGame.score(state) }));
    assert.deepEqual(result.state, state);
    assert.deepEqual(result.checkpoints, checkpoints);
    assert.equal(result.score, orbitGame.score(state));
    assert.equal(result.desyncTick, null);
    assert.equal(result.flagged, false);
    assert.equal(result.inputDiag.clamped, 0);
    assert.equal(result.inputDiag.dropped, 0);
    const tile = buildArcadeReveal('orbit', orbitExtra(state), result.score)?.tiles.find(t => t.label === 'Checkpoint planet');
    assert.equal(tile?.value, mode === 'never' ? 'none' : String(selectedPlanet));
    proofs++;
  }
}
const initial = orbitGame.init(17);
assert.equal(buildArcadeReveal('orbit', orbitExtra(initial), 0)?.tiles[0]?.value, 'none');
console.log(`Orbit checkpoint proofs passed ${proofs}/${proofs}: early, late and never; flight inputs ignored, one respawn, immutable selection, unchanged score and stored reveal tile.`);