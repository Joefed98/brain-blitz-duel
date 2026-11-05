/**
 * Rally on the arcade scoring standard (rallyRev 12, 29 Oct 2026; docs/arcade-standard/rally.md):
 *
 *  1. older stamps unchanged: skill-band runs recorded on unmodified main (99115b0) replay on rallyRev 11 (where they
 *     were played) and rallyRev 10 to the same score and final state (scripts/fixtures/rally-standard-legacy.json.gz);
 *  2. rooms deal rallyRev 12; it plays on rallyRev 10's 420 × 784 court from rallyRev 10's exact draws;
 *  3. the spin fix: on rallyRev 12 a swipe left on the ball sends it left and its curve then turns it rightwards (and
 *     the mirror for right); rallyRev 11 still curves it the way the paddle moved;
 *  4. rallyRev 12 runs (scripts/fixtures/rally-standard-runs.json.gz) replay through the server path (replayRallyRun)
 *     unflagged to their stored score and state, and the score is the standard's parts' sum;
 *  5. losing the blue ball ends the run, the score standing at what was earned (an idle run dies, scores 1);
 *  6. the help, the intro and the reveal state the standard's parts.
 *
 *   bun scripts/rally-standard-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import {
  rallyGameFor,
  rallyPaddleY,
  rallyStdParts,
  RALLY_BALL_R,
  RALLY_REV_BONUS,
  RALLY_REV_CURVE,
  RALLY_REV_STD,
  RALLY_RUN_TICKS,
  RALLY_STD_SPEC,
  RALLY_V10_H,
  RALLY_V10_W,
  RALLY_V12_EXP,
  rallyWorldHFor,
  rallyWorldWFor,
  type RallyState,
} from "../src/lib/arcade/rally";
import { replayRallyRun, encodeRallyRun } from "../src/lib/duel/rally";
import { stdScore, stdHelp, stdHelpLines } from "../src/lib/arcade/arcadeStandard";
import { ARCADE_INPUT_DRAG } from "../src/lib/arcade/engine";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { buildArcadeReveal } from "../src/lib/arcade/reveal";

const quiet = console.error;
console.error = () => {};
console.warn = () => {};

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
const hash = (s: unknown) => createHash("sha256").update(JSON.stringify(s)).digest("hex");

/* 1. Older stamps. */
const legacy = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/rally-standard-legacy.json.gz")).toString()) as {
  runs: { seed: number; raw: string; results: Record<string, { score: number; state: string }> }[];
};
ok(legacy.runs.length === 14, "the legacy fixture holds 14 runs");
for (const [i, run] of legacy.runs.entries())
  for (const [rev, want] of Object.entries(run.results)) {
    const r = replayRallyRun(run.seed, run.raw, Number(rev));
    ok(r.score === want.score && hash(r.state) === want.state, `legacy run ${i} on rallyRev ${rev}: ${r.score} (stored ${want.score}), state ${hash(r.state) === want.state ? "same" : "changed"}`);
  }

/* 2. Rooms deal rallyRev 12; its court and draws. */
const dealt = generatePuzzle("rally") as unknown as { rallyRev?: number };
ok(dealt.rallyRev === RALLY_REV_STD, `rooms deal rallyRev ${dealt.rallyRev}, not ${RALLY_REV_STD}`);
ok(rallyWorldWFor(RALLY_REV_STD) === RALLY_V10_W && rallyWorldHFor(RALLY_REV_STD) === RALLY_V10_H, "rallyRev 12 plays on the 420 × 784 court");
const g11 = rallyGameFor(RALLY_REV_CURVE);
const g12 = rallyGameFor(RALLY_REV_STD);
for (const seed of [1, 99, 123456, 2 ** 30 + 7]) {
  const a = g11.init(seed);
  const b = g12.init(seed);
  ok(b.exp === RALLY_V12_EXP && JSON.stringify({ ...b, exp: a.exp }) === JSON.stringify(a), `seed ${seed}: rallyRev 12 starts from rallyRev 11's exact draws`);
}
ok(rallyStdParts(g11.init(5)) === null && rallyStdParts(rallyGameFor(RALLY_REV_BONUS).init(5)) === null, "rallyRev 10/11 states have no standard parts");

/* 3. The spin: a swipe on the ball at the paddle's centre, then the flight's x-velocity tick by tick. */
function swipe(rev: number, dir: -1 | 1): number[] {
  const game = rallyGameFor(rev);
  const s0 = game.init(777) as RallyState;
  const py = rallyPaddleY(s0);
  const from = 210 - 40 * dir;
  const to = 210;
  // The paddle has been moving 40 px a tick towards `to`; the ball falls straight onto its centre.
  let s: RallyState = { ...s0, tick: 100, acted: 1, paddleX: from, aimX: from, pv: 40 * 256 * dir, x: to * 256, y: (py - RALLY_BALL_R - 2) * 256, vx: 0, vy: 1024, golds: [] } as RallyState;
  s = game.step(s, { t: s.tick + 1, k: ARCADE_INPUT_DRAG, a: to, b: 0, c: 0, d: 0 });
  const vxs = [s.vx];
  for (let i = 0; i < 70 && !game.isOver(s) && s.vy < 0; i++) {
    s = game.step(s, null);
    vxs.push(s.vx);
  }
  ok(s0.hits === 0 && s.hits === 1, `rallyRev ${rev} swipe ${dir < 0 ? "left" : "right"}: the ball was returned`);
  return vxs;
}
for (const dir of [-1, 1] as const) {
  const side = dir < 0 ? "left" : "right";
  const v12 = swipe(RALLY_REV_STD, dir);
  ok(Math.sign(v12[0]!) === dir, `rallyRev 12 swipe ${side}: the ball leaves to the ${side} (vx ${v12[0]})`);
  ok(v12.some((v) => Math.sign(v) === -dir), `rallyRev 12 swipe ${side}: its x-velocity then turns the other way (vx ${v12.at(-1)})`);
  let turning = true;
  for (let i = 1; i < 20; i++) if ((v12[i]! - v12[i - 1]!) * dir > 0) turning = false;
  ok(turning, `rallyRev 12 swipe ${side}: the curve bends it back from the first tick`);
  const v11 = swipe(RALLY_REV_CURVE, dir);
  ok(Math.abs(v11[0]!) < 40 && Math.sign(v11[20]!) === dir && Math.abs(v11[20]!) > 100, `rallyRev 11 swipe ${side} (unchanged): leaves straight and curves the way the paddle moved (vx ${v11[0]} → ${v11[20]})`);
}

/* 4. rallyRev 12 runs through the server path. */
const std = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/rally-standard-runs.json.gz")).toString()) as {
  runs: { level: string; seed: number; raw: string; score: number; state: string }[];
};
ok(std.runs.length === 7, "the rallyRev 12 fixture holds 7 runs");
for (const run of std.runs) {
  const r = replayRallyRun(run.seed, run.raw, RALLY_REV_STD);
  ok(!r.flagged, `rallyRev 12 ${run.level} run replays unflagged`);
  ok(r.score === run.score && hash(r.state) === run.state, `rallyRev 12 ${run.level} run: ${r.score} (stored ${run.score})`);
  ok(r.score === stdScore(rallyStdParts(r.state)!, Boolean(r.state.acted)), `rallyRev 12 ${run.level} run scores its parts' sum`);
}

/* 5. Losing the blue ball ends the run. */
{
  const game = g12;
  let s = game.init(31337);
  // One drag to the far left, then nothing: the blue ball is lost early.
  s = game.step(s, { t: 1, k: ARCADE_INPUT_DRAG, a: 0, b: 0, c: 0, d: 0 });
  while (!game.isOver(s)) s = game.step(s, null);
  ok(s.dead && s.endedTick < RALLY_RUN_TICKS && game.score(s) === 1, `losing the blue ball ends the run (at tick ${s.endedTick}), a run that earned nothing scores 1`);
  const raw = encodeRallyRun({ seed: 31337, claimedScore: 1, events: [{ t: 1, k: ARCADE_INPUT_DRAG, a: 0, b: 0, c: 0, d: 0 }], endTick: s.tick, checkpoints: [] });
  const r = replayRallyRun(31337, raw, RALLY_REV_STD);
  ok(r.score === 1 && !r.survived && r.replayTick === s.endedTick, "the server replay ends where the blue ball was lost");
}

/* 6. Texts. */
const help = PUZZLE_INSTRUCTIONS.rally;
const score = help.score;
ok(score.includes(stdHelpLines(RALLY_STD_SPEC)), `the help states the standard's parts: ${score}`);
ok(help.how.some((h) => /curves back round the other way/.test(h.detail)), "the help says a swipe goes its way, then curves back");
ok(!help.how.some((h) => /swerves the way it moved/.test(h.detail)), "the help no longer says the ball swerves the way the paddle moved");
const best = std.runs.find((r) => r.level === "near")!;
const run = replayRallyRun(best.seed, best.raw, RALLY_REV_STD);
const reveal = buildArcadeReveal("rally", { ...run, rallyRev: RALLY_REV_STD }, run.score);
ok(!!reveal && reveal.lines.some((l) => l.startsWith("Gold-ball hits:")) && reveal.lines.some((l) => l.startsWith("Pink pads:")) && reveal.lines.some((l) => l.startsWith("Gold targets:")), `the reveal lists the parts: ${reveal?.lines.join(" | ")}`);

console.error = quiet;
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL: ${failures.length} of ${checks} Rally standard checks`);
  process.exit(1);
}
console.log(`PASS: ${checks} Rally standard checks (legacy rallyRev 10/11 identity, rallyRev 12 deal, spin direction, server replays, the blue ball, texts)`);
