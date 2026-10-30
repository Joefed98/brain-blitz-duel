/**
 * minigolf-check (the Sports group, 30 Oct 2026; docs/arcade-standard/minigolf.md): Minigolf golfRev 1.
 *
 *  - the bank: every course's witness (scripts/fixtures/minigolf-witness.json) scores exactly 200 through the server's
 *    replay, unflagged, birdies every hole (its pars are the witness's strokes + 1, all under the stroke limit), and
 *    rooms deal only bank courses with their stored pars;
 *  - the courses: five holes per seed, each bigger than the last, tee and cup on the fairway and clear of every
 *    obstacle, shapes straight → dogleg → S-bend → split → grand; the same seed deals the same course;
 *  - the rules: water costs a stroke and puts the ball back where it was played; the sixth stroke ends a hole with
 *    closeness credit; a putt while the ball rolls does nothing; the buzzer credits the hole in play by closeness;
 *  - determinism: the same log replays to the same checksums twice; a run with no input scores 0, any putt 1+;
 *  - input repair: payloads out of range are clamped and the run is flagged, never dropped.
 *
 *   bun scripts/minigolf-check.ts
 */
import { readFileSync } from "node:fs";
import { fp, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  minigolfCheckpoint,
  minigolfCourse,
  minigolfGameFor,
  MG_AIM,
  MG_BALL_R,
  MG_INPUT_PUTT,
  MG_PAUSE,
  MG_ROLL,
  MINIGOLF_HOLES,
  MINIGOLF_RUN_TICKS,
  MINIGOLF_STROKE_LIMIT,
  type MinigolfState,
} from "../src/lib/arcade/minigolf";
import { insidePoly } from "../src/lib/arcade/sportsKit";
import { encodeMinigolfRun, replayMinigolfRun } from "../src/lib/duel/minigolf";
import { MINIGOLF_BANK } from "../src/lib/duel/minigolfBank.server";
import { generateMinigolf } from "../src/lib/duel/sports.server";

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}

const witness = JSON.parse(readFileSync(new URL("./fixtures/minigolf-witness.json", import.meta.url), "utf8")) as Record<string, string>;

/* The bank. */
ok(MINIGOLF_BANK.length >= 40, `the bank holds at least 40 courses (${MINIGOLF_BANK.length})`);
ok(new Set(MINIGOLF_BANK.map((e) => e.seed)).size === MINIGOLF_BANK.length, "bank seeds are unique");
ok(Object.keys(witness).length === MINIGOLF_BANK.length, "one witness per bank course");
let twoHundred = 0;
let birdied = 0;
let worstFinish = 0;
for (const e of MINIGOLF_BANK) {
  const run = replayMinigolfRun(e.seed, witness[String(e.seed)] ?? "", e.pars);
  if (run.score === 200 && !run.flagged) twoHundred++;
  if (run.state.taken.every((t, i) => t === e.pars[i]! - 1 && run.state.holed[i] === 1)) birdied++;
  worstFinish = Math.max(worstFinish, run.state.finishTick);
  ok(e.pars.length === MINIGOLF_HOLES && e.pars.every((p) => p >= 2 && p < MINIGOLF_STROKE_LIMIT), `course ${e.seed}: five pars from 2 to ${MINIGOLF_STROKE_LIMIT - 1}`);
}
ok(twoHundred === MINIGOLF_BANK.length, `every bank witness scores 200 through the server replay (${twoHundred} of ${MINIGOLF_BANK.length})`);
ok(birdied === MINIGOLF_BANK.length, `every witness birdies every hole: par = its best route + 1 (${birdied} of ${MINIGOLF_BANK.length})`);
for (let i = 0; i < 50; i++) {
  const p = generateMinigolf();
  const e = MINIGOLF_BANK.find((x) => x.seed === p.seed);
  ok(!!e && JSON.stringify(e.pars) === JSON.stringify(p.pars) && p.golfRev === 1, `rooms deal a bank course with its pars (seed ${p.seed})`);
}

/* The courses. */
const SHAPES = ["straight", "dogleg", "sbend", "split", "grand"];
for (const e of MINIGOLF_BANK.slice(0, 20)) {
  const course = minigolfCourse(e.seed);
  ok(JSON.stringify(course) === JSON.stringify(minigolfCourse(e.seed)), `course ${e.seed}: the same seed deals the same course`);
  ok(course.map((h) => h.shape).join() === SHAPES.join(), `course ${e.seed}: the five hole kinds in order`);
  for (let i = 1; i < course.length; i++) ok(course[i]!.box.w * course[i]!.box.h > course[i - 1]!.box.w * course[i - 1]!.box.h, `course ${e.seed}: hole ${i + 1} is bigger than hole ${i}`);
  for (const h of course) {
    for (const [name, p] of [["tee", h.tee], ["cup", h.cup]] as const) {
      ok(insidePoly(h.poly, p.x, p.y), `course ${e.seed} hole ${h.index + 1}: the ${name} is on the fairway`);
      const clear = [...h.rocks, ...h.planters, ...h.ponds].every((c) => Math.hypot(c.x - p.x, c.y - p.y) > c.r + fp(MG_BALL_R));
      ok(clear, `course ${e.seed} hole ${h.index + 1}: the ${name} is clear of every obstacle`);
    }
  }
}

/* The rules. */
const e0 = MINIGOLF_BANK[0]!;
const game = minigolfGameFor(e0.pars);
const putt = (s: MinigolfState, a: number, b: number, c: number) => game.step(s, { t: s.tick + 1, k: MG_INPUT_PUTT, a, b, c, d: 0 });
const settle = (s: MinigolfState) => {
  let x = s;
  while (x.phase === MG_ROLL && !x.over) x = game.step(x, null);
  return x;
};
{
  // Water: find a putt on the split hole (a pond in the middle) that goes in.
  let s = game.init(e0.seed);
  const course = s.course;
  const split = course.findIndex((h) => h.ponds.length > 0);
  s = { ...s, hole: split, x: course[split]!.tee.x, y: course[split]!.tee.y, fromX: course[split]!.tee.x, fromY: course[split]!.tee.y, strokes: 0 };
  const pond = course[split]!.ponds[0]!;
  const after = settle(putt(s, pond.x - s.x, pond.y - s.y, 700));
  ok(after.waters === 1 && after.strokes === 2 && after.x === s.x && after.y === s.y && after.phase === MG_AIM, `water: one stroke added and the ball back where it was played (strokes ${after.strokes}, waters ${after.waters})`);
  // Stroke limit: six soft putts away from the cup end the hole with closeness credit.
  let t = { ...s, hole: 0, x: course[0]!.tee.x, y: course[0]!.tee.y, strokes: 0 };
  for (let i = 0; i < MINIGOLF_STROKE_LIMIT; i++) t = settle(putt(t, 0, 4000, 30));
  ok(t.phase === MG_PAUSE && t.holed[0] === 0 && t.taken[0] === MINIGOLF_STROKE_LIMIT && t.close[0]! >= 0 && t.close[0]! <= 20, `the sixth stroke ends the hole with closeness credit (${t.close[0]})`);
  // A putt while the ball rolls does nothing.
  const rolling = putt(game.init(e0.seed), 0, -4000, 600);
  const again = putt(rolling, 4000, 0, 1000);
  ok(again.strokes === 1 && again.vx === game.step(rolling, null).vx, "a putt while the ball rolls is ignored");
}
{
  // The buzzer credits the hole in play by closeness.
  let s = game.init(e0.seed);
  s = settle(putt(s, s.course[0]!.cup.x - s.x, s.course[0]!.cup.y - s.y, 350));
  while (!s.over) s = game.step(s, null);
  ok(s.tick === MINIGOLF_RUN_TICKS && (s.holed[0] === 1 || s.close[0]! > 0), "the buzzer ends the run and credits the hole in play");
  ok(game.score(s) >= 1, `any putt scores at least 1 (${game.score(s)})`);
  let idle = game.init(e0.seed);
  while (!idle.over) idle = game.step(idle, null);
  ok(game.score(idle) === 0, "no input scores 0");
}

/* Determinism and input repair. */
{
  const raw = witness[String(e0.seed)]!;
  const a = replayMinigolfRun(e0.seed, raw, e0.pars);
  const b = replayMinigolfRun(e0.seed, raw, e0.pars);
  ok(JSON.stringify(a.checkpoints) === JSON.stringify(b.checkpoints) && a.score === b.score, "the same log replays to the same checkpoints twice");
  ok(JSON.stringify(minigolfCheckpoint(a.state)) === JSON.stringify(minigolfCheckpoint(b.state)), "the same final state twice");
  const wild: ArcadeInputEvent[] = [{ t: 5, k: MG_INPUT_PUTT, a: 99999, b: -99999, c: 5000, d: 7 }];
  const r = replayMinigolfRun(e0.seed, encodeMinigolfRun({ seed: e0.seed, claimedScore: 0, events: wild, endTick: 0, checkpoints: [] }), e0.pars);
  ok(r.inputDiag.clamped === 1 && r.inputDiag.dropped === 0 && r.flagged && r.state.acted === 1, "an out-of-range putt is clamped, replayed and flagged");
}

console.log(`minigolf-check: ${MINIGOLF_BANK.length} bank courses, witnesses finish within ${(worstFinish / 60).toFixed(1)} s`);
if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`FAIL: ${f}`);
  console.log(`FAIL: ${failures.length} of ${checks} minigolf checks`);
  process.exit(1);
}
console.log(`PASS: ${checks} minigolf checks`);
