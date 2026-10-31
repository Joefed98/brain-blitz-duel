/**
 * minigolf-check (the Sports group, 30 Oct 2026; docs/arcade-standard/minigolf.md): Minigolf golfRev 1 and golfRev 2
 * (crazy golf, 31 Oct 2026: windmills, tunnels, sand, hills, banked curves and castle gates; the putt 20 % harder).
 *
 *  - the bank: every course's witness (scripts/fixtures/minigolf-witness.json) scores exactly 200 through the server's
 *    replay, unflagged, birdies every hole (its pars are the witness's strokes + 1, all under the stroke limit), and
 *    rooms deal only bank courses with their stored pars;
 *  - the courses: five holes per seed, each bigger than the last, tee and cup on the fairway and clear of every
 *    obstacle, shapes straight → dogleg → S-bend → split → grand; the same seed deals the same course;
 *  - the rules: water costs a stroke and puts the ball back where it was played; the sixth stroke ends a hole with
 *    closeness credit; a putt while the ball rolls does nothing; the buzzer credits the hole in play by closeness;
 *  - determinism: the same log replays to the same checksums twice; a run with no input scores 0, any putt 1+;
 *  - input repair: payloads out of range are clamped and the run is flagged, never dropped;
 *  - golfRev 1 unchanged: its courses and its witnesses' (and cut-down runs') replays digest as on main 9dc6e56;
 *  - golfRev 2: rooms deal it from its own bank, every witness (scripts/fixtures/minigolf-witness-v2.json) scores 200
 *    and birdies every hole, plays hole 1 through the windmill's doorway, times the sails (waits) and finishes by the
 *    speed full-by; the courses (kinds, sizes, obstacles 1 on the first hole and more later, two tunnels on a hole, tee,
 *    cup, tunnel exits and the windmill's aprons clear); the rules (9.6 px putt, the sails' period, a doorway open at
 *    some moments and blocked at others, tunnels, sand, hills, the apron).
 *
 *   bun scripts/minigolf-check.ts
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fp, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  minigolfCheckpoint,
  mgApron,
  mgPuttVelocity,
  mgRollTickV2,
  mgSails,
  minigolfCourse,
  minigolfCourseV2,
  minigolfGameFor,
  MG_AIM,
  MG_APRON,
  MG_BALL_R,
  MG_END_NONE,
  MG_MAX_V,
  MG_MAX_V_V2,
  MG_MILL_PERIOD,
  MG_POWER_MAX,
  MG_TUNNEL_R,
  MINIGOLF_FULL_BY_S,
  MG_INPUT_PUTT,
  MG_PAUSE,
  MG_ROLL,
  MINIGOLF_HOLES,
  MINIGOLF_RUN_TICKS,
  MINIGOLF_STROKE_LIMIT,
  type MgHole,
  type MinigolfState,
} from "../src/lib/arcade/minigolf";
import { decodeSportsRun, insidePoly, NORM_ONE, replaySportsRun } from "../src/lib/arcade/sportsKit";
import { encodeMinigolfRun, replayMinigolfRun } from "../src/lib/duel/minigolf";
import { MINIGOLF_BANK } from "../src/lib/duel/minigolfBank.server";
import { MINIGOLF_BANK_V2 } from "../src/lib/duel/minigolfBankV2.server";
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
// Rooms deal golfRev 2 (crazy golf, 31 Oct 2026) from its own bank; golfRev 1's courses stay replayable (above).
for (let i = 0; i < 50; i++) {
  const p = generateMinigolf();
  const e = MINIGOLF_BANK_V2.find((x) => x.seed === p.seed);
  ok(!!e && JSON.stringify(e.pars) === JSON.stringify(p.pars) && p.golfRev === 2, `rooms deal a golfRev 2 bank course with its pars (seed ${p.seed})`);
}
ok(MINIGOLF_BANK.every((e) => !MINIGOLF_BANK_V2.some((x) => x.seed === e.seed)), "no seed is in both banks");
// golfRev 1 exactly as dealt and replayed before golfRev 2 (digests recorded on main 9dc6e56).
{
  const h = createHash("sha256");
  for (const e of MINIGOLF_BANK) h.update(JSON.stringify(minigolfCourse(e.seed)));
  ok(h.digest("hex") === "862ba72a20bdf31d03a5364a029ddecaf5514d9d34ef4a12ebf5a01b8a8178b9", "golfRev 1's courses are dealt byte for byte as before");
  const r = createHash("sha256");
  // The cut-down runs carry no checkpoints, so the replay logs a desync for each: quiet here.
  const quiet = console.error;
  console.error = () => {};
  for (const e of MINIGOLF_BANK) {
    const full = witness[String(e.seed)]!;
    const parts = full.split("|");
    const cut = [parts[0], "0", parts[2]!.split(",").slice(0, 3).join(","), "0", ""].join("|");
    for (const raw of [full, cut]) {
      const run = replaySportsRun("minigolf-check", minigolfGameFor(e.pars), minigolfCheckpoint, e.seed, raw);
      r.update(JSON.stringify([run.score, run.checkpoints, minigolfCheckpoint(run.state)]));
    }
  }
  console.error = quiet;
  ok(r.digest("hex") === "7a86b59d12774974145b125d44ec816133d72568ca9b2b8b4e7783aeef9553f6", "golfRev 1's witnesses and cut-down runs replay to the same scores and checkpoints as before");
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
  const pond = course[split]!.ponds[0]!;
  // A clear spot on the fairway 20 px off the pond's edge (the tee's straight line may cross a timber wall).
  const h = course[split]!;
  const clearAt = (x: number, y: number) =>
    insidePoly(h.poly, x, y) &&
    [...h.rocks, ...h.planters, ...h.ponds].every((c) => Math.hypot(c.x - x, c.y - y) > c.r + fp(MG_BALL_R + 2)) &&
    h.segs.every((g) => {
      const dx = g.bx - g.ax, dy = g.by - g.ay;
      const t = Math.max(0, Math.min(1, ((x - g.ax) * dx + (y - g.ay) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(g.ax + dx * t - x, g.ay + dy * t - y) > g.r + fp(MG_BALL_R + 2);
    });
  let from = { x: h.tee.x, y: h.tee.y };
  for (let k = 0; k < 16; k++) {
    const a = (k * Math.PI) / 8;
    const x = Math.round(pond.x + Math.cos(a) * (pond.r + fp(20)));
    const y = Math.round(pond.y + Math.sin(a) * (pond.r + fp(20)));
    if (clearAt(x, y)) {
      from = { x, y };
      break;
    }
  }
  s = { ...s, hole: split, x: from.x, y: from.y, fromX: from.x, fromY: from.y, strokes: 0 };
  // The first power on the straight line to the pond's centre that puts the ball in (a rock may stop a soft one).
  let after = s;
  for (let c = 200; c <= 1000 && after.waters === 0; c += 50) after = settle(putt(s, Math.round((pond.x - s.x) / 64), Math.round((pond.y - s.y) / 64), c));
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

/* ============================ golfRev 2: crazy golf ============================ */
const witnessV2 = JSON.parse(readFileSync(new URL("./fixtures/minigolf-witness-v2.json", import.meta.url), "utf8")) as Record<string, string>;
let worstFinishV2 = 0;
{
  /* The bank: every witness 200 through the server replay on golfRev 2, a birdie on every hole. */
  ok(MINIGOLF_BANK_V2.length >= 40, `golfRev 2: the bank holds at least 40 courses (${MINIGOLF_BANK_V2.length})`);
  ok(new Set(MINIGOLF_BANK_V2.map((e) => e.seed)).size === MINIGOLF_BANK_V2.length, "golfRev 2: bank seeds are unique");
  ok(Object.keys(witnessV2).length === MINIGOLF_BANK_V2.length, "golfRev 2: one witness per bank course");
  let two = 0;
  let bird = 0;
  let waited = 0;
  let tunnelled = 0;
  let throughMill = 0;
  for (const e of MINIGOLF_BANK_V2) {
    const raw = witnessV2[String(e.seed)] ?? "";
    const run = replayMinigolfRun(e.seed, raw, e.pars, 2);
    if (run.score === 200 && !run.flagged && run.state.rev === 2) two++;
    if (run.state.taken.every((t, i) => t === e.pars[i]! - 1 && run.state.holed[i] === 1)) bird++;
    worstFinishV2 = Math.max(worstFinishV2, run.state.finishTick);
    ok(e.pars.length === MINIGOLF_HOLES && e.pars.every((p) => p >= 2 && p < MINIGOLF_STROKE_LIMIT), `golfRev 2 course ${e.seed}: five pars from 2 to ${MINIGOLF_STROKE_LIMIT - 1}`);
    // Step the witness: the waits it takes (a putt later than the first tick it could go), tunnels ridden, and the
    // ball crossing hole 1's windmill doorway.
    const g = minigolfGameFor(e.pars, 2);
    const events = new Map(decodeSportsRun(raw, MINIGOLF_RUN_TICKS).events.map((v) => [v.t, v]));
    let s = g.init(e.seed);
    let aimSince = -1;
    let anyWait = false;
    let crossed = false;
    const mill = s.course[0]!.windmills![0]!;
    const side0 = Math.sign(s.course[0]!.tee.y - mill.y);
    while (!s.over) {
      if (s.phase === MG_AIM && aimSince < 0) aimSince = s.tick;
      if (s.phase !== MG_AIM) aimSince = -1;
      const ev = events.get(s.tick + 1) ?? null;
      if (ev && s.phase === MG_AIM && s.tick + 1 > aimSince + 1) anyWait = true;
      s = g.step(s, ev);
      if (s.hole === 0 && Math.sign(s.y - mill.y) === -side0) crossed = true;
    }
    if (anyWait) waited++;
    if (s.tunnels > 0) tunnelled++;
    if (crossed) throughMill++;
  }
  ok(two === MINIGOLF_BANK_V2.length, `golfRev 2: every bank witness scores 200 through the server replay (${two} of ${MINIGOLF_BANK_V2.length})`);
  ok(bird === MINIGOLF_BANK_V2.length, `golfRev 2: every witness birdies every hole: par = its best route + 1 (${bird} of ${MINIGOLF_BANK_V2.length})`);
  ok(throughMill === MINIGOLF_BANK_V2.length, `golfRev 2: every witness plays hole 1 through the windmill's doorway (${throughMill})`);
  ok(waited >= MINIGOLF_BANK_V2.length / 2, `golfRev 2: the witnesses time the sails: at least half wait before a putt (${waited})`);
  ok(tunnelled > 0, `golfRev 2: some witnesses ride a tunnel (${tunnelled})`);
  ok(worstFinishV2 <= MINIGOLF_FULL_BY_S * 60, `golfRev 2: every witness finishes by the speed full-by (${(worstFinishV2 / 60).toFixed(1)} s)`);
  const a = replayMinigolfRun(MINIGOLF_BANK_V2[0]!.seed, witnessV2[String(MINIGOLF_BANK_V2[0]!.seed)]!, MINIGOLF_BANK_V2[0]!.pars, 2);
  const b = replayMinigolfRun(MINIGOLF_BANK_V2[0]!.seed, witnessV2[String(MINIGOLF_BANK_V2[0]!.seed)]!, MINIGOLF_BANK_V2[0]!.pars, 2);
  ok(JSON.stringify(a.checkpoints) === JSON.stringify(b.checkpoints) && a.score === b.score, "golfRev 2: the same log replays to the same checkpoints twice");
  // The same log on golfRev 1 is a different game (the stamp gates the course and physics).
  ok(replayMinigolfRun(MINIGOLF_BANK_V2[0]!.seed, witnessV2[String(MINIGOLF_BANK_V2[0]!.seed)]!, MINIGOLF_BANK_V2[0]!.pars).state.rev === 1, "an unstamped puzzle replays as golfRev 1");
}
{
  /* The courses: the five kinds, each bigger, obstacles 1 on the first hole and more later, tee and cup clear. */
  const kinds = (h: MgHole) => (h.gates?.length ?? 0) + (h.tunnels?.length ?? 0) + (h.sands?.length ?? 0) + (h.hills?.length ?? 0) + (h.curves?.length ?? 0);
  for (const e of MINIGOLF_BANK_V2.slice(0, 20)) {
    const course = minigolfCourseV2(e.seed);
    ok(JSON.stringify(course) === JSON.stringify(minigolfCourseV2(e.seed)), `golfRev 2 course ${e.seed}: the same seed deals the same course`);
    ok(course.map((h) => h.shape).join() === SHAPES.join(), `golfRev 2 course ${e.seed}: the five hole kinds in order`);
    for (let i = 1; i < course.length; i++) ok(course[i]!.box.w * course[i]!.box.h > course[i - 1]!.box.w * course[i - 1]!.box.h, `golfRev 2 course ${e.seed}: hole ${i + 1} is bigger than hole ${i}`);
    const counts = course.map(kinds);
    ok(counts[0] === 1 && course[0]!.windmills!.length === 1, `golfRev 2 course ${e.seed}: hole 1 has one obstacle, a windmill (${counts.join(" ")})`);
    ok(counts.every((c, i) => i === 0 || c >= counts[i - 1]!) && counts[4]! >= 4, `golfRev 2 course ${e.seed}: more obstacles on later holes, several on the last (${counts.join(" ")})`);
    ok(course[4]!.windmills!.length === 1 && course[4]!.gates!.some((g) => g.kind === "castle"), `golfRev 2 course ${e.seed}: the finale has a windmill and a castle gate`);
    ok(course.some((h) => (h.tunnels?.length ?? 0) >= 2), `golfRev 2 course ${e.seed}: a hole offers two tunnels`);
    for (const h of course) {
      const solid = (x: number, y: number, extra: number, mills = true) =>
        [...h.rocks, ...h.planters, ...h.ponds, ...(h.sands ?? []), ...(h.hills ?? [])].some((c) => Math.hypot(c.x - x, c.y - y) <= c.r + fp(MG_BALL_R + extra)) ||
        (mills && (h.windmills ?? []).some((m) => Math.hypot(m.x - x, m.y - y) < fp(MG_APRON))) ||
        (h.tunnels ?? []).some((t) => Math.hypot(t.x - x, t.y - y) <= fp(MG_TUNNEL_R + MG_BALL_R + extra)) ||
        h.segs.some((g) => {
          const dx = g.bx - g.ax, dy = g.by - g.ay;
          const t = Math.max(0, Math.min(1, ((x - g.ax) * dx + (y - g.ay) * dy) / (dx * dx + dy * dy || 1)));
          return Math.hypot(g.ax + dx * t - x, g.ay + dy * t - y) <= g.r + fp(MG_BALL_R + extra);
        });
      for (const [name, p] of [["tee", h.tee], ["cup", h.cup]] as const) {
        ok(insidePoly(h.poly, p.x, p.y), `golfRev 2 course ${e.seed} hole ${h.index + 1}: the ${name} is on the fairway`);
        ok(!solid(p.x, p.y, 0), `golfRev 2 course ${e.seed} hole ${h.index + 1}: the ${name} is clear of every obstacle`);
      }
      for (const t of h.tunnels ?? []) {
        ok(insidePoly(h.poly, t.x, t.y) && insidePoly(h.poly, t.ox, t.oy), `golfRev 2 course ${e.seed} hole ${h.index + 1}: both ends of a tunnel are on the fairway`);
        ok(!solid(t.ox, t.oy, 1), `golfRev 2 course ${e.seed} hole ${h.index + 1}: a tunnel's exit is clear (no wall, rock, pond or entrance)`);
      }
      for (const m of h.windmills ?? []) {
        for (const side of [-1, 1]) {
          const ax = m.across ? m.x : m.x + side * fp(MG_APRON);
          const ay = m.across ? m.y + side * fp(MG_APRON) : m.y;
          ok(insidePoly(h.poly, ax, ay) && !solid(ax, ay, 0, false), `golfRev 2 course ${e.seed} hole ${h.index + 1}: the windmill's apron spots are open fairway`);
        }
      }
    }
  }
}
{
  /* The rules: the putt 20 % harder, the sails, the tunnels, sand, hills and the apron. */
  ok(mgPuttVelocity(0, -4000, MG_POWER_MAX, 2).vy === -MG_MAX_V_V2 && mgPuttVelocity(0, -4000, MG_POWER_MAX).vy === -MG_MAX_V && MG_MAX_V_V2 === fp(9.6) && MG_MAX_V === fp(8), "golfRev 2's hardest putt is 9.6 px a tick, golfRev 1's still 8");
  const e = MINIGOLF_BANK_V2[0]!;
  const course = minigolfCourseV2(e.seed);
  const h1 = course[0]!;
  const mill = h1.windmills![0]!;
  const key = (t: number) => mgSails(mill, t).map((f) => `${f.seg.ax},${f.seg.ay},${f.seg.bx},${f.seg.by}`).sort().join(";");
  ok([0, 17, 1234].every((t) => key(t) === key(t + MG_MILL_PERIOD)) && key(0) !== key(MG_MILL_PERIOD / 2), `the sails' pattern repeats every ${MG_MILL_PERIOD} ticks and turns in between`);
  // A full-power putt straight up the first hole's middle: some moments pass the doorway, others meet a sail.
  let passed = 0;
  let blocked = 0;
  for (let t0 = 1; t0 <= MG_MILL_PERIOD; t0++) {
    const v = mgPuttVelocity(mill.x - h1.tee.x, mill.y - h1.tee.y + fp(1), MG_POWER_MAX, 2);
    const off = fp(20) * (h1.tee.x <= mill.x ? 1 : -1);
    const ball = { x: mill.x + off, y: h1.tee.y, vx: 0, vy: v.vy };
    let sail = false;
    for (let k = 1; k < 900; k++) {
      const r = mgRollTickV2(h1, ball, k, t0 + k);
      if (r.sail) sail = true;
      if (r.end !== MG_END_NONE) break;
    }
    if (ball.y < mill.y) passed++;
    else if (sail) blocked++;
  }
  ok(passed > 0 && blocked > 0, `the windmill: a putt through the doorway passes at some moments (${passed}) and meets a sail at others (${blocked})`);
  // Tunnels: a ball rolling into an entrance comes out of the exit heading the exit's way, keeping 7/8 of its speed.
  const withTunnel = course.find((h) => (h.tunnels?.length ?? 0) > 0)!;
  const tun = withTunnel.tunnels![0]!;
  const ball = { x: tun.x + fp(MG_TUNNEL_R + 2), y: tun.y, vx: -fp(3), vy: 0 };
  const r = mgRollTickV2(withTunnel, ball, 1, 1);
  const sp = Math.hypot(ball.vx, ball.vy);
  ok(r.tunnel && Math.hypot(ball.x - tun.ox, ball.y - tun.oy) <= fp(4) && (ball.vx * tun.dx + ball.vy * tun.dy) / (sp * NORM_ONE) > 0.99, "a tunnel: in at the entrance, out of the exit heading its way");
  ok(sp <= (fp(3) * 7) / 8 && sp > fp(2), `a tunnel keeps 7/8 of the speed, less the roll (${(sp / 256).toFixed(2)} px a tick)`);
  // Sand: the same putt stops far shorter in a bunker than on the turf.
  const withSand = course.find((h) => (h.sands?.length ?? 0) > 0)!;
  const sand = withSand.sands![0]!;
  const rollFrom = (x: number, y: number) => {
    const b2 = { x, y, vx: fp(4), vy: 0 };
    let k = 1;
    while (mgRollTickV2({ ...withSand, segs: [], rocks: [], planters: [], ponds: [], slopes: [], hills: [], tunnels: [], windmills: [] }, b2, k, k).end === MG_END_NONE) k++;
    return b2.x - x;
  };
  const inSand = rollFrom(sand.x - sand.r + fp(6), sand.y);
  const onTurf = rollFrom(sand.x + sand.r + fp(400), sand.y);
  ok(inSand < onTurf / 3, `sand slows the ball strongly (${(inSand / 256).toFixed(0)} px in the bunker, ${(onTurf / 256).toFixed(0)} px on turf)`);
  // A hill pushes a resting ball off its top, away from the top.
  const withHill = course.find((h) => (h.hills?.length ?? 0) > 0)!;
  const hill = withHill.hills![0]!;
  const hb = { x: hill.x + (hill.r * 6) / 10, y: hill.y, vx: 0, vy: 0 };
  mgRollTickV2({ ...withHill, segs: [], rocks: [], planters: [], ponds: [], slopes: [], sands: [], tunnels: [], windmills: [] }, hb, 1, 1);
  const hb2 = { x: hill.x + (hill.r * 6) / 10, y: hill.y, vx: -fp(2), vy: 0 };
  mgRollTickV2({ ...withHill, segs: [], rocks: [], planters: [], ponds: [], slopes: [], sands: [], tunnels: [], windmills: [] }, hb2, 1, 1);
  const hb3 = { x: hill.x + (hill.r * 6) / 10, y: hill.y, vx: -fp(2), vy: 0 };
  const flat = { ...withHill, segs: [], rocks: [], planters: [], ponds: [], slopes: [], sands: [], tunnels: [], windmills: [], hills: [] };
  mgRollTickV2(flat, hb3, 1, 1);
  ok(hb2.vx > hb3.vx, "a hill slows a ball climbing towards its top");
  // The apron: a ball resting under the sails is set down clear of them on its own side.
  const ap = { x: mill.x + fp(4), y: mill.y + fp(4) };
  mgApron(h1, ap);
  ok(Math.abs(ap.y - mill.y) === fp(MG_APRON) && ap.y > mill.y && ap.x === mill.x + fp(4), "a ball resting in the doorway, where the sails sweep, is set down clear of it on its side");
  // The sim counts tunnels and starts golfRev 2 states on the new stamp; golfRev 1 states never ride one.
  ok(minigolfGameFor(e.pars, 2).init(e.seed).rev === 2 && minigolfGameFor(e.pars).init(e.seed).rev === 1, "the game's stamp: golfRev 2 when asked, golfRev 1 unstamped");
}

console.log(`minigolf-check: ${MINIGOLF_BANK.length} golfRev 1 bank courses (witnesses within ${(worstFinish / 60).toFixed(1)} s), ${MINIGOLF_BANK_V2.length} golfRev 2 (within ${(worstFinishV2 / 60).toFixed(1)} s)`);
if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`FAIL: ${f}`);
  console.log(`FAIL: ${failures.length} of ${checks} minigolf checks`);
  process.exit(1);
}
console.log(`PASS: ${checks} minigolf checks`);
