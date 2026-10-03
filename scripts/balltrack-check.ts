/**
 * Ball Track proofs: every bank playbook scores 15/15 through the server path,
 * and 200 self-replay runs (random play over bank courses) match the server.
 *   bun scripts/balltrack-check.ts
 */
import { BALL_TRACK_BANK } from "../src/lib/duel/ballTrackBank.server";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { decodeInputEvents, inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { btCheckpoint, makeBallTrackGame, BT_CHECKPOINT_INTERVAL, BT_K_FLIP, BT_K_RELEASE, BT_K_ROTATE, BT_K_SLIDE, BT_K_WHEEL, type BtCheckpoint } from "../src/lib/arcade/ballTrack";
import { encodeBallTrackRun, replayBallTrackRun } from "../src/lib/duel/ballTrack";
import { dependsOnSlide } from "./ball-track-bank";

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
  if (!dependsOnSlide(makeBallTrackGame(entry.course), decodeInputEvents(entry.playbook))) fail(`course ${i}: slides not required by playbook`);
  const events = new Map(decodeInputEvents(entry.playbook).map((e) => [e.t, e]));
  const { state, score } = play(i, (t) => events.get(t) ?? null);
  if (state.home === 15 && state.wrong === 0 && state.lost === 0 && score >= 120 && state.actions === entry.par) solved++;
  else fail(`course ${i}: playbook did not route all 15 (${state.home}, score ${score})`);
});

let same = 0;
for (let run = 0; run < 200; run++) {
  let r = 0x9e3779b9 ^ run;
  const rnd = (n: number) => { r = (Math.imul(r ^ (r >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0; return r % n; };
  const course = BALL_TRACK_BANK[run]!.course;
  const before = fails;
  play(run, () => {
    const roll = rnd(100);
    if (roll < 3) return { k: BT_K_RELEASE, a: 0, b: 0, c: 0, d: 0 };
    if (roll < 6 && course.pipes.length) return { k: BT_K_ROTATE, a: course.pipes[rnd(course.pipes.length)]!.cell, b: 0, c: 0, d: 0 };
    if (roll < 9 && course.flippers.length) return { k: BT_K_FLIP, a: course.flippers[rnd(course.flippers.length)]!.cell, b: 0, c: 0, d: 0 };
    if (roll < 11 && course.sliders.length) return { k: BT_K_SLIDE, a: rnd(course.sliders.length), b: rnd(3), c: 0, d: 0 };
    if (roll < 13 && course.wheels.length) return { k: BT_K_WHEEL, a: rnd(course.wheels.length), b: rnd(2), c: 0, d: 0 };
    return null;
  });
  if (fails === before) same++;
}
console.log(`ball track: ${solved}/${BALL_TRACK_BANK.length} playbooks route all 15 home · self-replay identity ${same}/200`);
if (fails) throw Error(`${fails} failures`);
