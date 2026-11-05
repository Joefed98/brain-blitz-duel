/**
 * Pinball pinRev 6 (29 Oct 2026, the arcade scoring standard, docs/arcade-standard/pinball.md): pinRev 5's table and
 * 90 s play, scored as table points (no multiplier) on a straight line to 130 plus J-O-U-L-Z (10 a set, up to 2),
 * multiball started (20), jackpots (5 each, up to 3) and ramp combos (5 each, up to 3).
 *
 *  1. Older rounds are untouched: every older stamp keeps its game and state (no `rev6`), and pinRev 5's recorded
 *     runs (scripts/fixtures/pinball-90-runs.json.gz, recorded before this change) replay to their stored scores.
 *  2. pinRev 6 plays pinRev 5 tick for tick: the same input log gives the same ball, flippers, lanes, locks,
 *     multiball, jackpots and ramps on both. Only the scoring differs: the multiplier stays x1, a back-to-back ramp
 *     shot adds one flat combo award, and `combos` counts those shots; table points are never more than pinRev 5's,
 *     and equal them on a run that never raised the multiplier or made a combo. Its checkpoints fold the new fields
 *     in, so a pinRev 5 log can't pass as a pinRev 6 run.
 *  3. Rooms deal pinRev 6; the help, intro line, live band, round maximum and run length follow it.
 *  4. Recorded pinRev 6 runs (scripts/fixtures/pinball-standard-runs.json.gz, `--record` rebuilds it from the
 *     skill-band bots) replay unflagged to their stored scores through the server's path and the replay stepper;
 *     each score is its parts' sum, the reveal's lines are the parts, and real play earns every feature.
 *
 *   bun scripts/pinball-standard-check.ts [--record]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";

import { generatePuzzle } from "../src/lib/duel/generate.server";
import { decodePinballRun, encodePinballRun, replayPinballRun } from "../src/lib/duel/pinball";
import { makeStepper, replayToEnd } from "../src/lib/replay/steppers";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { stdHelp, stdHelpLines, stdSum, stdLines } from "../src/lib/arcade/arcadeStandard";
import { buildArcadeReveal } from "../src/lib/arcade/reveal";
import { pinballGame, pinIsExpanded, pinRunTicksFor, PIN_REV_EXPAND, PIN_REV_LONG, PIN_REV_STD, PIN_V5_RUN_TICKS } from "../src/lib/arcade/pinball";
import {
  pin4Checkpoint,
  pinball4Game,
  pinball5Game,
  pinball6Game,
  pinballGameForAny,
  pinballStdParts,
  PIN_STD_SPEC,
  PIN_V6_BAND_CURVE,
  PIN_V6_FULL_AT,
  P4_PTS_COMBO,
  P4_PTS_RAMP,
  type Pin4State,
} from "../src/lib/arcade/pinball4";

const RECORD = process.argv.includes("--record");
const FIXTURE = "scripts/fixtures/pinball-standard-runs.json.gz";
const LEGACY = "scripts/fixtures/pinball-90-runs.json.gz";

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
  for (const level of ["weak", "average", "good", "great", "near", "elite", "perfect"] as const)
    for (let n = 0; n < 2; n++) {
      const r = await e4Run("pinball", PIN_REV_STD, level, n, "new");
      runs.push({ rev: PIN_REV_STD, level, n, seed: r.seed, score: r.score, raw: r.raw });
    }
  writeFileSync(FIXTURE, gzipSync(JSON.stringify({ recorded: "29 Oct 2026, pinRev 6 skill-band bot runs", runs })));
  console.log(`wrote ${FIXTURE} (${runs.length} runs)`);
}

const legacy = (JSON.parse(gunzipSync(readFileSync(LEGACY)).toString()) as { runs: Run[] }).runs;
const recorded = (JSON.parse(gunzipSync(readFileSync(FIXTURE)).toString()) as { runs: Run[] }).runs;

/* ============================== 1. Old rounds ============================== */

section("Older stamps keep their game and state; recorded pinRev 5 runs replay to their scores");
{
  for (const rev of [undefined, 1, 2, 3, PIN_REV_EXPAND, PIN_REV_LONG]) {
    const s = pinballGameForAny(rev).init(5) as Partial<Pin4State>;
    ok(!("rev6" in s) && !("combos" in s), `pinRev ${rev}: no pinRev 6 state`);
    ok(pinballStdParts(s as Pin4State) === null, `pinRev ${rev}: no standard parts`);
  }
  ok(pinballGameForAny(PIN_REV_LONG) === pinball5Game && pinballGameForAny(PIN_REV_EXPAND) === pinball4Game && pinballGameForAny(undefined) === pinballGame, "older stamps keep their games");
  ok(pinballGameForAny(PIN_REV_STD) === pinball6Game, "pinRev 6 has its own game");
  ok(legacy.length === 8, `8 recorded pinRev 5 runs (${legacy.length})`);
  for (const run of legacy) {
    const r = quiet(() => replayPinballRun(run.seed, run.raw, run.rev));
    ok(run.rev === PIN_REV_LONG, `pinRev 5 ${run.level} #${run.n}: recorded on pinRev 5`);
    ok(!r.flagged && r.desyncTick === null && r.score === run.score, `pinRev 5 ${run.level} #${run.n}: replays to its stored ${run.score} (got ${r.score}, desync ${r.desyncTick})`);
  }
}

/* ============================== 2. Tick for tick ============================== */

/** Every field pinRev 6's scoring touches, left out of the play comparison. */
const play = (s: Pin4State) => {
  const { points: _p, mult: _m, rev6: _r, combos: _c, ...rest } = s;
  return JSON.stringify(rest);
};

section("pinRev 6 plays pinRev 5 tick for tick; only the scoring differs");
{
  let multRaised = 0;
  let combosSeen = 0;
  let equalRuns = 0;
  for (const run of [...legacy, ...recorded]) {
    const tag = `rev ${run.rev} ${run.level} #${run.n}`;
    const events = new Map(decodePinballRun(run.raw).events.map((e) => [e.t, e]));
    let a = pinball5Game.init(run.seed);
    let b = pinball6Game.init(run.seed);
    ok(b.rev6 === 1 && b.combos === 0 && a.rev6 === undefined, `${tag}: only pinRev 6's state carries rev6`);
    let same = true;
    let mult1 = true;
    let checksumsDiffer = true;
    let comboShots = 0;
    let rampPointsOk = true;
    let maxMult5 = 1;
    let combo5 = 0;
    while (!pinball5Game.isOver(a)) {
      const e = events.get(a.tick + 1) ?? null;
      const before = b;
      a = pinball5Game.step(a, e);
      b = pinball6Game.step(b, e);
      if (play(a) !== play(b)) same = false;
      if (b.mult !== 1) mult1 = false;
      maxMult5 = Math.max(maxMult5, a.mult);
      if (a.combo > 1) combo5++;
      if (b.ramps > before.ramps && b.combo > 1) comboShots++;
      // A ramp shot's award is flat: the ramp, plus one combo award when back to back (nothing rises with the count).
      if (b.ramps > before.ramps && b.tick === b.rampAt) {
        const want = P4_PTS_RAMP + (b.combo > 1 ? P4_PTS_COMBO : 0);
        if (b.points - before.points < want) rampPointsOk = false;
      }
      if (pin4Checkpoint(a).checksum === pin4Checkpoint(b).checksum) checksumsDiffer = false;
    }
    ok(same && pinball6Game.isOver(b), `${tag}: identical play on pinRev 5 and 6`);
    ok(mult1, `${tag}: pinRev 6's multiplier stays x1`);
    ok(b.combos === comboShots, `${tag}: combos counts the back-to-back ramp shots (${b.combos} vs ${comboShots})`);
    ok(rampPointsOk, `${tag}: a ramp shot pays its flat award`);
    ok(b.points <= a.points, `${tag}: pinRev 6's table points are never above pinRev 5's (${b.points} vs ${a.points})`);
    if (maxMult5 === 1 && b.combos === 0) {
      equalRuns++;
      ok(b.points === a.points, `${tag}: with no multiplier raised and no combo, the table points are pinRev 5's (${b.points} vs ${a.points})`);
    }
    if (maxMult5 > 1) multRaised++;
    if (b.combos > 0) combosSeen++;
    ok(checksumsDiffer, `${tag}: pinRev 6's checkpoints differ from pinRev 5's`);
  }
  ok(multRaised >= 3, `runs that raised pinRev 5's multiplier are among them (${multRaised})`);
  ok(combosSeen >= 2, `runs with ramp combos are among them (${combosSeen})`);
  ok(equalRuns >= 1, `a run with neither shows equal table points (${equalRuns})`);
}

/* ============================== 3. Dealing ============================== */

section("Rooms deal pinRev 6; the help, intro line, band, maximum and run length follow it");
{
  const pin = generatePuzzle("pinball") as any;
  ok(pin.pinRev === PIN_REV_STD && PIN_REV_STD === 6, `rooms deal pinRev 6 (${pin.pinRev})`);
  ok(pinIsExpanded(PIN_REV_STD) && pinRunTicksFor(PIN_REV_STD) === PIN_V5_RUN_TICKS && pinball6Game.runTicks === PIN_V5_RUN_TICKS, "pinRev 6 plays the taller table for 90 s");
  ok(roundMaxFor("pinball") === 200, "the round maximum is 200");
  const live: any = LIVE_BANDS.pinball;
  ok(live.rev === PIN_REV_STD && live.std === PIN_STD_SPEC && live.curve === PIN_V6_BAND_CURVE, "LIVE_BANDS lists pinRev 6 and its spec");
  ok(PIN_V6_BAND_CURVE.units.join() === `0,${PIN_V6_FULL_AT}` && PIN_V6_BAND_CURVE.points.join() === "0,130", "the core's straight line to 130");
  const help = PUZZLE_INSTRUCTIONS.pinball;
  ok(help.score.includes(stdHelpLines(PIN_STD_SPEC)), `the help states the parts: ${help.score}`);
  const how = help.how.map((l) => `${l.action} ${l.detail}`).join(" ");
  ok(!/multiplier/i.test(how) && /90 seconds/.test(how), "the help's how lines don't promise a multiplier and say 90 seconds");
  const intro = INTRO_SCORE.pinball ?? "";
  ok(/J-O-U-L-Z/.test(intro) && /multiball/i.test(intro) && /jackpot/i.test(intro) && /combo/i.test(intro), `the intro line names the features: ${intro}`);
}

/* ============================== 4. Recorded runs ============================== */

section("Recorded pinRev 6 runs replay to their scores; the parts add up; real play earns every feature");
{
  ok(recorded.length === 14, `14 recorded runs (${recorded.length})`);
  const earned = { joulz: 0, multiball: 0, jackpots: 0, combos: 0, core: 0 };
  for (const run of recorded) {
    const tag = `pinRev 6 ${run.level} #${run.n}`;
    const r = quiet(() => replayPinballRun(run.seed, run.raw, run.rev));
    ok(run.rev === PIN_REV_STD, `${tag}: recorded on pinRev 6`);
    ok(!r.flagged && r.desyncTick === null, `${tag}: replays unflagged (${r.reason ?? ""})`);
    ok(r.score === run.score && r.score >= 1 && r.score <= 200, `${tag}: replays to its stored ${run.score} (got ${r.score})`);
    const parts = pinballStdParts(r.state as Pin4State)!;
    ok(parts !== null && Math.min(200, Math.max(1, stdSum(parts))) === r.score, `${tag}: the score is its parts' sum`);
    for (const p of parts) if (p.points > 0) earned[p.key as keyof typeof earned]++;
    ok(r.combos === (r.state as Pin4State).combos && r.mult === 1, `${tag}: the result carries the combos and a x1 multiplier`);
    const reveal = buildArcadeReveal("pinball", r, r.score);
    ok(reveal !== null && JSON.stringify(reveal.lines) === JSON.stringify(stdLines(parts, r.score)), `${tag}: the reveal's lines are the parts`);
    ok(reveal !== null && !reveal.tiles.some((t) => t.label === "Multiplier"), `${tag}: no multiplier tile`);
    const stepper = makeStepper({ type: "pinball", seed: run.seed, pinRev: run.rev } as any, run.raw);
    const end = stepper ? replayToEnd(stepper) : null;
    ok(end !== null && JSON.stringify(end.state) === JSON.stringify(r.state), `${tag}: the replay stepper reaches the server's final state`);
    // The same log stamped pinRev 5 plays the same table but fails the checkpoints (its own checksum).
    const as5 = quiet(() => replayPinballRun(run.seed, run.raw, PIN_REV_LONG));
    ok(as5.desyncTick !== null || as5.checkpoints.length === 0, `${tag}: the log desyncs as a pinRev 5 run`);
  }
  for (const [key, count] of Object.entries(earned)) ok(count >= 1, `real play earns ${key} (${count} runs)`);
  const none = encodePinballRun({ seed: 3, claimedScore: 0, events: [], endTick: 0, checkpoints: [] });
  ok(quiet(() => replayPinballRun(3, none, PIN_REV_STD)).score === 0, "no input scores 0 through the server path");
  let s = pinball6Game.init(4);
  s = pinball6Game.step(s, { t: 1, k: 11, a: 1, b: 0, c: 0, d: 0 });
  while (!pinball6Game.isOver(s)) s = pinball6Game.step(s, null);
  ok(pinball6Game.score(s) >= 1, `one press scores at least 1 (${pinball6Game.score(s)})`);
}

if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  console.log(`FAIL pinball-standard-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(
  `PASS pinball-standard-check: ${checks} checks — older Pinball rounds keep their games and scores; pinRev 6 plays pinRev 5 tick for tick with no multiplier and flat combos; rooms deal it; recorded runs replay to their parts' sum and earn every feature`,
);
