/**
 * Ball Track proofs: every bank playbook routes all balls through the server path,
 * and 200 self-replay runs (random taps over bank courses) match the server.
 *   bun scripts/balltrack-check.ts
 */
import { BALL_TRACK_BANK } from "../src/lib/duel/ballTrackBank.server";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { decodeInputEvents, inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { btCheckpoint, makeBallTrackGame, BT_BALLS, BT_CHECKPOINT_INTERVAL, BT_COLS, BT_KIND, BT_K_ROTATE, type BtCheckpoint } from "../src/lib/arcade/ballTrack";
import { encodeBallTrackRun, replayBallTrackRun } from "../src/lib/duel/ballTrack";

let fails = 0;
const fail = (m: string) => { fails++; if (fails < 10) console.error(m); };

function play(index: number, choose: (tick: number) => Omit<ArcadeInputEvent, "t"> | null) {
  const entry = BALL_TRACK_BANK[index]!;
  const game = makeBallTrackGame(entry.course);
  let state = game.init(index + 1);
  const log: ArcadeInputEvent[] = [];
  const cps: BtCheckpoint[] = [];
  while (!game.isOver(state)) {
    const e = choose(state.tick + 1);
    if (e) recordInput(log, { ...e, t: state.tick + 1 }, game.inputRanges);
    state = game.step(state, inputAt(log, state.tick + 1));
    if (state.tick % BT_CHECKPOINT_INTERVAL === 0) cps.push(btCheckpoint(state));
  }
  const score = game.score(state);
  const raw = appendClientCounters(encodeBallTrackRun(entry.course, { seed: index + 1, claimedScore: score, events: log, endTick: state.tick, checkpoints: cps }), arcadeCounters("balltrack", state, score));
  const res = replayBallTrackRun(entry.course, index + 1, raw);
  if (JSON.stringify(res.state) !== JSON.stringify(state) || res.score !== score || res.flagged || res.inputDiag.clamped || res.inputDiag.dropped) fail(`course ${index}: replay mismatch`);
  return { state, score };
}

let solved = 0;
BALL_TRACK_BANK.forEach((entry, i) => {
  const c = entry.course;
  const extra = c.fixed.length;
  if (extra < 3 || extra > 5 || c.fixed.some((x) => x >= 42 || x % BT_COLS === 3 || BT_KIND[x] !== 1)) fail(`course ${i}: fixed set`);
  if (c.trays.filter((t) => t >= 0).length !== 5 || c.balls.length !== BT_BALLS) fail(`course ${i}: trays/balls`);
  for (let colour = 0; colour < 5; colour++) if (c.balls.filter((b) => b === colour).length !== 2) fail(`course ${i}: colour balance`);
  if (c.balls.some((b, j) => j >= 2 && b === c.balls[j - 1] && b === c.balls[j - 2])) fail(`course ${i}: three consecutive colours`);
  const events = new Map(decodeInputEvents(entry.playbook).map((e) => [e.t, e]));
  const { state, score } = play(i, (t) => events.get(t) ?? null);
  if (state.home === BT_BALLS && state.wrong === 0 && state.lost === 0 && score === 150 && state.actions === entry.par) solved++;
  else fail(`course ${i}: playbook did not route all ${BT_BALLS} (${state.home}, score ${score})`);
});

let same = 0;
for (let run = 0; run < 200; run++) {
  let r = 0x9e3779b9 ^ run;
  const rnd = (n: number) => { r = (Math.imul(r ^ (r >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0; return r % n; };
  const before = fails;
  play(run, () => (rnd(100) < 4 ? { k: BT_K_ROTATE, a: rnd(49), b: 0, c: 0, d: 0 } : null));
  if (fails === before) same++;
}
console.log(`ball track: ${solved}/${BALL_TRACK_BANK.length} playbooks route all ${BT_BALLS} home · self-replay identity ${same}/200`);
if (fails) throw Error(`${fails} failures`);
