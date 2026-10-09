import { burstScoreOf } from "@/lib/arcade/burst";
import { swingGameFor, SWING_REV, swingMetres, swingCheckpoint } from '@/lib/arcade/swing';
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
  const game = swingGameFor(SWING_REV);
  const state = game.init(seed);
  check('legacy has no dragons', swingGameFor().init(seed).dragons === undefined);
  check('seed identical', JSON.stringify(state) === JSON.stringify(game.init(seed)));
  check('4–6 dragons', (state.dragons?.length ?? 0) >= 4 && (state.dragons?.length ?? 0) <= 6);
  check('last 150m only', (state.dragons ?? []).every(d => d.x >= (3000 + 350 * 40) * 256 && d.x < (3000 + 500 * 40) * 256));
  const witness = proveSwingSeed(seed);
  if (!witness) { console.log(`Search rejected seed ${seed}; generator will not return it`); continue; }
  const events = new Map(witness.map(e => [e.t, e]));
  let s = state;
  const checkpoints = [];
  while (!s.ended) {
    s = game.step(s, events.get(s.tick + 1) ?? null);
    if (s.tick % 300 === 0) checkpoints.push(swingCheckpoint(s));
  }
  const raw = encodeSwingRun({ seed, claimedScore: game.score(s), events: witness, endTick: s.tick, checkpoints });
  const replay = replaySwingRun(seed, raw, SWING_REV);
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
if (failures) process.exit(1);
