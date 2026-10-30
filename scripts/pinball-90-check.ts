/**
 * Pinball pinRev 5 (27 Oct 2026, Joe's phone notes, docs/phone-notes-oct-2026/pinball.md): pinRev 4's table
 * for 90 s instead of 60, on its own curve.
 *
 *  1. Older rounds are untouched: every older stamp keeps its game, its 60 s run and its state (no `rev5`),
 *     and pinRev 4's recorded runs (scripts/fixtures/e4-new-runs.json.gz, recorded before this change) replay
 *     to their stored scores with no desync.
 *  2. pinRev 5 plays pinRev 4 tick for tick: the same input log gives the identical state on both up to 60 s
 *     (only the `rev5` flag differs), and pinRev 5 then plays on to 90 s.
 *  3. Rooms deal pinRev 5; the round clock, the arcade run length and the help follow it.
 *  4. Recorded pinRev 5 runs (scripts/fixtures/pinball-90-runs.json.gz, `--record` rebuilds it) replay
 *     unflagged to their stored scores, past 60 s, through the server's path and the phone's replay stepper.
 *  5. The curve: rising knots from (0, 0) to 200, nothing past 200, no input scores 0.
 *
 *   bun scripts/pinball-90-check.ts [--record]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";

import { generatePuzzle } from "../src/lib/duel/generate.server";
import { decodePinballRun, encodePinballRun, replayPinballRun } from "../src/lib/duel/pinball";
import { makeStepper, replayToEnd } from "../src/lib/replay/steppers";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { puzzleRunMs, typeTimeLimitMs } from "../src/lib/duel/registry";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { bandPoints } from "../src/lib/arcade/scoreBands";
import { TICKS_PER_SECOND } from "../src/lib/arcade/engine";
import { pinballGame, pinIsExpanded, pinRunTicksFor, PIN_REV_EXPAND, PIN_REV_LONG, PIN_REV_STD, PIN_RUN_TICKS, PIN_V5_RUN_TICKS } from "../src/lib/arcade/pinball";
import { pin4Checkpoint, pinball4Game, pinball5Game, pinballGameForAny, PIN_V4_BAND_CURVE, PIN_V5_BAND_CURVE, type Pin4State } from "../src/lib/arcade/pinball4";

const RECORD = process.argv.includes("--record");
const FIXTURE = "scripts/fixtures/pinball-90-runs.json.gz";

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond && failures.length < 80) failures.push(label);
}
function section(name: string): void {
  console.log(`— ${name}`);
}
const quiet = <T>(fn: () => T): T => {
  const { error, warn } = console;
  console.error = () => {};
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.error = error;
    console.warn = warn;
  }
};

interface Run {
  rev: number;
  level: string;
  n: number;
  seed: number;
  score: number;
  raw: string;
}

/* ============================== --record ============================== */

if (RECORD) {
  const { e4Run } = await import("./e4-bands");
  const runs: Run[] = [];
  for (const level of ["average", "good", "great", "near"] as const)
    for (let n = 0; n < 2; n++) {
      const r = await e4Run("pinball", PIN_REV_LONG, level, n, "new");
      runs.push({ rev: PIN_REV_LONG, level, n, seed: r.seed, score: r.score, raw: r.raw });
    }
  writeFileSync(FIXTURE, gzipSync(JSON.stringify({ recorded: "27 Oct 2026, pinRev 5 skill-band bot runs", runs })));
  console.log(`wrote ${FIXTURE} (${runs.length} runs)`);
}

/** Every field but the scoring flag pinRev 5 adds. */
const sameState = (a: Pin4State, b: Pin4State) => {
  const { rev5: _a, ...ra } = a;
  const { rev5: _b, ...rb } = b;
  return JSON.stringify(ra) === JSON.stringify(rb);
};

/* ============================== 1. Old rounds ============================== */

section("Older stamps keep their game, their 60 s run and their state");
{
  for (const rev of [undefined, 1, 2, 3, PIN_REV_EXPAND]) {
    const g = pinballGameForAny(rev);
    ok(g.runTicks === PIN_RUN_TICKS && pinRunTicksFor(rev) === PIN_RUN_TICKS, `pinRev ${rev}: a 60 s run`);
    ok(!("rev5" in (g.init(5) as object)), `pinRev ${rev}: no pinRev 5 state`);
  }
  ok(pinballGameForAny(PIN_REV_EXPAND) === pinball4Game && pinballGameForAny(undefined) === pinballGame, "pinRev 4 and unstamped rounds keep their games");
  ok(pinIsExpanded(PIN_REV_EXPAND) && pinIsExpanded(PIN_REV_LONG) && !pinIsExpanded(3) && !pinIsExpanded(undefined), "the taller table is pinRev 4 and 5 only");
  const e4 = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/e4-new-runs.json.gz")).toString()) as { runs: (Run & { type: string })[] };
  const old = e4.runs.filter((r) => r.type === "pinball");
  ok(old.length === 9, `9 recorded pinRev 4 runs (${old.length})`);
  for (const run of old) {
    const r = quiet(() => replayPinballRun(run.seed, run.raw, run.rev));
    ok(run.rev === PIN_REV_EXPAND, `pinRev 4 ${run.level} #${run.n}: recorded on pinRev 4`);
    ok(!r.flagged && r.desyncTick === null && r.score === run.score, `pinRev 4 ${run.level} #${run.n}: replays to its stored ${run.score} (got ${r.score}, desync ${r.desyncTick})`);
    ok(r.replayTick <= PIN_RUN_TICKS, `pinRev 4 ${run.level} #${run.n}: ends by 60 s`);
  }
}

/* ============================== 2. Tick for tick ============================== */

section("pinRev 5 plays pinRev 4 tick for tick for 60 s, then on to 90 s");
{
  const e4 = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/e4-new-runs.json.gz")).toString()) as { runs: (Run & { type: string })[] };
  let longer = 0;
  for (const run of e4.runs.filter((r) => r.type === "pinball")) {
    const events = new Map(decodePinballRun(run.raw).events.map((e) => [e.t, e]));
    let a = pinball4Game.init(run.seed);
    let b = pinball5Game.init(run.seed);
    ok(b.rev5 === 1 && a.rev5 === undefined, "only pinRev 5's state carries rev5");
    let same = true;
    while (!pinball4Game.isOver(a)) {
      const e = events.get(a.tick + 1) ?? null;
      a = pinball4Game.step(a, e);
      b = pinball5Game.step(b, e);
      // (At 60 s pinRev 4 stamps its end tick; pinRev 5 plays on.)
      if (a.tick < PIN_RUN_TICKS && !sameState(a, b)) same = false;
      // pinRev 5's checkpoints fold its flag in, so a pinRev 4 log can't pass as a pinRev 5 run.
      if (pin4Checkpoint(a).checksum === pin4Checkpoint(b).checksum) same = false;
    }
    ok(same, `${run.level} #${run.n}: identical states to 60 s (with pinRev 5's own checksum)`);
    if (a.lost < 3) {
      ok(!pinball5Game.isOver(b) && b.tick === PIN_RUN_TICKS, `${run.level} #${run.n}: pinRev 5 plays on past 60 s`);
      while (!pinball5Game.isOver(b)) b = pinball5Game.step(b, null);
      ok(b.tick === PIN_V5_RUN_TICKS || b.lost === 3, `${run.level} #${run.n}: pinRev 5 ends at 90 s or when the last ball drains (${b.tick})`);
      longer++;
    }
  }
  ok(longer >= 3, `at least three recorded runs still had a ball at 60 s (${longer})`);
}

/* ============================== 3. Dealing and the clock ============================== */

// Since 29 Oct 2026 rooms deal pinRev 6 (the arcade scoring standard), which plays pinRev 5's 90 s table tick for tick
// (pinball-standard-check proves it), so the clock, run length and help below are pinRev 5's as they were.
section("Rooms deal pinRev 5's 90 s play (pinRev 6 since the standard); the round clock, the run length and the help follow it");
{
  const pin = generatePuzzle("pinball") as any;
  ok(PIN_REV_LONG === 5 && pin.pinRev === PIN_REV_STD && pinRunTicksFor(pin.pinRev) === pinRunTicksFor(PIN_REV_LONG), `rooms deal pinRev 5's 90 s play: pinRev 6 (${pin.pinRev})`);
  ok(PIN_V5_RUN_TICKS === 90 * TICKS_PER_SECOND && pinRunTicksFor(PIN_REV_LONG) === PIN_V5_RUN_TICKS && pinball5Game.runTicks === PIN_V5_RUN_TICKS, "a 90 s run");
  ok(typeTimeLimitMs("pinball") === 93_000, `the round clock is 93 s (${typeTimeLimitMs("pinball")})`);
  ok(puzzleRunMs(pin) === 90_000, `the arcade header shows a 90 s run (${puzzleRunMs(pin)})`);
  ok(roundMaxFor("pinball") === 200, "the round maximum is 200");
  // pinRev 6's help reads its standard spec (pinball-standard-check); pinRev 5 keeps its own curve for its rounds.
  ok(LIVE_BANDS.pinball.rev === PIN_REV_STD && pinball5Game.score === pinballGameForAny(PIN_REV_LONG).score, "the help reads pinRev 6 (pinRev 5's rounds keep their curve)");
  const help = PUZZLE_INSTRUCTIONS.pinball.how.map((l) => `${l.action} ${l.detail}`).join(" ");
  ok(/90 seconds/.test(help) && !/one minute/.test(help), "the help says 90 seconds");
}

/* ============================== 4. Recorded runs ============================== */

section("Recorded pinRev 5 runs replay to their scores, past 60 s");
{
  const fixture = JSON.parse(gunzipSync(readFileSync(FIXTURE)).toString()) as { runs: Run[] };
  ok(fixture.runs.length === 8, `8 recorded runs (${fixture.runs.length})`);
  let past = 0;
  for (const run of fixture.runs) {
    const tag = `pinRev 5 ${run.level} #${run.n}`;
    const r = quiet(() => replayPinballRun(run.seed, run.raw, run.rev));
    ok(run.rev === PIN_REV_LONG, `${tag}: recorded on pinRev 5`);
    ok(!r.flagged && r.desyncTick === null, `${tag}: replays unflagged (${r.reason ?? ""})`);
    ok(r.score === run.score && r.score > 0 && r.score <= 200, `${tag}: replays to its stored ${run.score} (got ${r.score})`);
    if (r.replayTick > PIN_RUN_TICKS) past++;
    ok(r.checkpoints.length <= PIN_V5_RUN_TICKS / 300, `${tag}: at most 18 checkpoints`);
    const stepper = makeStepper({ type: "pinball", seed: run.seed, pinRev: run.rev } as any, run.raw);
    const end = stepper ? replayToEnd(stepper) : null;
    ok(end !== null && JSON.stringify(end.state) === JSON.stringify(r.state), `${tag}: the replay stepper reaches the server's final state`);
    // The same log on pinRev 4 replays as a 60 s run: the stamp, not the log, sets the length.
    const as4 = quiet(() => replayPinballRun(run.seed, run.raw, PIN_REV_EXPAND));
    ok(as4.replayTick <= PIN_RUN_TICKS, `${tag}: the same log on pinRev 4 stops at 60 s`);
  }
  ok(past >= 4, `at least four recorded runs play past 60 s (${past})`);
  // A run that ends early at the phone (all balls drained) still replays with its end tick.
  const enc = encodePinballRun({ seed: 3, claimedScore: 0, events: [], endTick: 0, checkpoints: [] });
  ok(quiet(() => replayPinballRun(3, enc, PIN_REV_LONG)).score === 0, "no input scores 0 through the server path");
}

/* ============================== 5. The curve ============================== */

section("pinRev 5's curve");
{
  const c = PIN_V5_BAND_CURVE;
  ok(c.points.at(-1) === 200 && c.units[0] === 0 && c.points[0] === 0, "the curve runs from (0, 0) to 200");
  for (let i = 1; i < c.units.length; i++) ok(c.units[i]! > c.units[i - 1]! && c.points[i]! > c.points[i - 1]!, "the knots rise");
  ok(bandPoints(c, 10_000_000) === 200, "nothing scores past 200");
  ok(c !== PIN_V4_BAND_CURVE && c.units.at(-1)! > PIN_V4_BAND_CURVE.units.at(-1)!, "a longer run needs more table points for the top");
  let s = pinball5Game.init(99);
  while (!pinball5Game.isOver(s)) s = pinball5Game.step(s, null);
  ok(pinball5Game.score(s) === 0, "a run with no input scores 0");
}

if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  console.log(`FAIL pinball-90-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS pinball-90-check: ${checks} checks — older Pinball rounds keep their 60 s game; pinRev 5 plays pinRev 4 tick for tick and on to 90 s; rooms deal it on a 93 s clock; recorded runs replay; the curve tops out at 200`);
