import { burstScoreOf } from "@/lib/arcade/burst";
import { swingGameFor, SWING_REV_V3, SWING_REV_V2, SWING_DRAGON_HALF_W, SWING_DRAGON_HALF_H, SWING_DRAGON_HALF_W_V2, SWING_DRAGON_HALF_H_V2, swingMetres, swingCheckpoint } from '@/lib/arcade/swing';
import { proveSwingSeed } from '@/lib/duel/swingProof.server';
import { encodeSwingRun, replaySwingRun } from '@/lib/duel/swing';

let failures = 0;
const check = (label: string, ok: boolean) => {
  if (!ok) {
    failures += 1;
    console.log(`FAIL ${label}`);
  }
};

// Burst: 2 per ball, −9 per life, min 0, cap 150, top-up unchanged.
check("Burst 40 popped no lives = 80", burstScoreOf(40, 0, 0, false) === 80);
check("Burst 100 popped no lives caps 150", burstScoreOf(100, 0, 0, false) === 150);
check("Burst 40 popped one life = 71", burstScoreOf(40, 1, 0, false) === 71);
check("Burst 4 popped three lives floors 0", burstScoreOf(4, 3, 0, false) === 0);
check("Burst finished four waves no lives tops up 150", burstScoreOf(30, 0, 4, true) === 150);
check("Burst finished four waves with a life does not top up", burstScoreOf(30, 1, 4, true) === 51);

console.log(`Burst examples 40/0=${burstScoreOf(40, 0, 0, false)}, 100/0=${burstScoreOf(100, 0, 0, false)}, 30/1 top-up=${burstScoreOf(30, 1, 4, true)}.`);
const count = Number(process.argv[2] ?? 10);
let verified = 0;
for (let i = 0; i < count; i++) {
  const seed = 20261009 + i * 7919;
  const game = swingGameFor(SWING_REV_V3);
  const state = game.init(seed);
  check('legacy has no dragons', swingGameFor().init(seed).dragons === undefined);
  check('seed identical', JSON.stringify(state) === JSON.stringify(game.init(seed)));
  let old = swingGameFor().init(seed);
  let fresh = state;
  for (let t = 1; t <= 120; t++) {
    old = swingGameFor().step(old, null);
    fresh = game.step(fresh, null);
    const { dragons: _dragons, ...withoutDragons } = fresh;
    check('pre-dragon physics unchanged', JSON.stringify(old) === JSON.stringify(withoutDragons));
    check('legacy score unchanged', swingGameFor().score(old) === game.score(fresh));
  }
  check('3–5 dragons (swingRev 3)', (state.dragons?.length ?? 0) >= 3 && (state.dragons?.length ?? 0) <= 5);
  check('swingRev 3 dragon box is 64×44', (state.dragons ?? []).every(d => d.hw === SWING_DRAGON_HALF_W && d.hh === SWING_DRAGON_HALF_H));
  check('last 150m only', (state.dragons ?? []).every(d => d.x >= (3000 + 350 * 40) * 256 && d.x < (3000 + 500 * 40) * 256));
  const witness = proveSwingSeed(seed, SWING_REV_V3);
  if (!witness) { console.log(`Search rejected seed ${seed}; generator will not return it`); continue; }
  const events = new Map(witness.map(e => [e.t, e]));
  let s = state;
  const checkpoints = [];
  while (!s.ended) {
    s = game.step(s, events.get(s.tick + 1) ?? null);
    if (s.tick % 300 === 0) checkpoints.push(swingCheckpoint(s));
  }
  const raw = encodeSwingRun({ seed, claimedScore: game.score(s), events: witness, endTick: s.tick, checkpoints });
  const replay = replaySwingRun(seed, raw, SWING_REV_V3);
  check('500m within 60s', swingMetres(s) >= 500 && s.ended === 1 && s.tick <= 3600);
  check('server replay identical', !replay.flagged && JSON.stringify(s) === JSON.stringify(replay.state));
  const d = state.dragons?.[0];
  if (d) {
    const hit = game.step({ ...state, x: d.x, y: d.y, rope: -1, vx: 0, vy: 0 }, null);
    check('dragon contact ends as stalactite', hit.ended === 2);
  }
  verified++;
  console.log(`Grappler seed ${seed}: ${s.tick} ticks, ${game.score(s)} points, ${state.dragons?.length} dragons`);
}
check('at least one verified course', verified > 0);
console.log(`Grappler timed witnesses and server replay ${verified}/${count} (rejected seeds never used).`);

// swingRev 2 (legacy small dragons) must replay, display and score exactly as before swingRev 3 was added.
let v2verified = 0;
for (let i = 0; i < count; i++) {
  const seed = 20261009 + i * 7919;
  const game = swingGameFor(SWING_REV_V2);
  const state = game.init(seed);
  check('swingRev 2 has 4–6 dragons', (state.dragons?.length ?? 0) >= 4 && (state.dragons?.length ?? 0) <= 6);
  check('swingRev 2 dragon box is 40×28 (unchanged)', (state.dragons ?? []).every(d => d.hw === SWING_DRAGON_HALF_W_V2 && d.hh === SWING_DRAGON_HALF_H_V2));
  let old = swingGameFor().init(seed);
  let fresh = state;
  for (let t = 1; t <= 120; t++) {
    old = swingGameFor().step(old, null);
    fresh = game.step(fresh, null);
    const { dragons: _dragons, ...withoutDragons } = fresh;
    check('swingRev 2 pre-dragon physics unchanged', JSON.stringify(old) === JSON.stringify(withoutDragons));
    check('swingRev 2 score unchanged', swingGameFor().score(old) === game.score(fresh));
  }
  const witness = proveSwingSeed(seed, SWING_REV_V2);
  if (!witness) { console.log(`swingRev 2 seed ${seed} rejected by search (unaffected by swingRev 3 work)`); continue; }
  const events = new Map(witness.map(e => [e.t, e]));
  let s = state;
  const checkpoints = [];
  while (!s.ended) {
    s = game.step(s, events.get(s.tick + 1) ?? null);
    if (s.tick % 300 === 0) checkpoints.push(swingCheckpoint(s));
  }
  const raw = encodeSwingRun({ seed, claimedScore: game.score(s), events: witness, endTick: s.tick, checkpoints });
  const replay = replaySwingRun(seed, raw, SWING_REV_V2);
  check('swingRev 2 server replay identical', !replay.flagged && JSON.stringify(s) === JSON.stringify(replay.state));
  v2verified++;
}
check('at least one swingRev 2 course verified', v2verified > 0);
console.log(`swingRev 2 legacy replay unchanged: ${v2verified}/${count} verified.`);

// Sample the beam-search proof pass rate for swingRev 3 across a larger, separate seed sample.
const sampleSize = Math.max(count, 200);
let proved = 0;
for (let i = 0; i < sampleSize; i++) {
  const seed = 90210001 + i * 104729;
  if (proveSwingSeed(seed, SWING_REV_V3)) proved++;
}
console.log(`swingRev 3 beam-search proof pass rate: ${proved}/${sampleSize} (${((proved / sampleSize) * 100).toFixed(1)}%).`);

if (failures) process.exit(1);
