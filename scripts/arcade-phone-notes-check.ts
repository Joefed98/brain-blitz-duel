/**
 * Joe's phone notes (27 Oct 2026, docs/arcade-phone-notes-oct-2026.md): six arcade games.
 *
 *   1. Roofbound flipRev 9 and Tilt tiltRev 9 keep flipRev 8's and tiltRev 8's play exactly: every stored rev-8
 *      run (scripts/fixtures/flip-x200-runs.json.gz, tilt-expand-runs.json.gz) and every witness / oracle run
 *      replays on the new stamp unflagged to the same final checkpoint, and scores at least what it did on rev 8;
 *      the rev-8 scores themselves are unchanged.
 *   2. The lifted curves: as many knots as before, never below the old ones, rising, the same top (140 base,
 *      50 skill), so the ceiling stays 200: every Roofbound witness and every Tilt bank run scores 200 on rev 9.
 *   3. Rooms, practice and LIVE_BANDS deal the new stamps; round maximums stay 200; the help names the new pay.
 *   4. Ball Tracker: a btRev 7 reveal, summary and final moment count 36 marbles (30 on earlier courses); the
 *      bottom readout counts the seconds to the next switch-up.
 *   5. Display numbers: Hover's gold stars drawn 1.2× within the bounds rule's 2 px; Orbit's drawn view fills
 *      the iPhone 11 home-screen box's shape and SET CHECKPOINT is laid over the play area; Tilt's camera fixed.
 *
 *   bun scripts/arcade-phone-notes-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  flipCheckpoint,
  flipGameFor,
  FLIP_REV_EXPAND,
  FLIP_REV_LIFT,
  FLIP_REV_STD,
  FLIP_REV_FLOW,
  FLIP_V11_BAND_CURVE,
  FLIP_V8_BAND_CURVE,
  FLIP_V8_SKILL_PAY,
  FLIP_V9_BAND_CURVE,
  FLIP_V9_SKILL_PAY,
  flipWorldHFor,
  FLIP_V8_WORLD_H,
} from "../src/lib/arcade/flip";
import {
  tiltCheckpoint,
  tiltGameFor,
  tiltIsExpand,
  tiltWorldHFor,
  TILT_REV_EXPAND,
  TILT_REV_LIFT,
  TILT_REV_PAR,
  TILT_REV_BIG,
  TILT_V8_BAND_CURVE,
  TILT_V9_BAND_CURVE,
  TILT_V9_SKILL_PAY,
  TILT_V11_BAND_CURVE,
  TILT_X_H,
  TILT_X_SKILL_PAY,
} from "../src/lib/arcade/tilt";
import { HOVER_STAR_R } from "../src/lib/arcade/hover";
import { BT_BALLS, BT_V7_BALLS } from "../src/lib/arcade/ballTrack";
import { buildArcadeReveal } from "../src/lib/arcade/reveal";
import { replayFlipRun } from "../src/lib/duel/flip";
import { replayTiltRun } from "../src/lib/duel/tilt";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { flipTap } from "./flip-x200-plan";
import { encodeFlipLog, FLIP_WITNESS_FIXTURE, type FlipWitness } from "./flip-x200-record";
import type { BandCurve } from "../src/lib/arcade/scoreBands";

let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond && failures.length < 60) failures.push(label);
};
const gz = <T>(path: string | URL): T => JSON.parse(gunzipSync(readFileSync(path)).toString()) as T;
const read = (path: string) => readFileSync(path, "utf8");
/** A run log with its claimed score (the second field) replaced. */
const reclaim = (raw: string, score: number) => raw.replace(/^(-?\d+)\|\d+\|/, `$1|${score}|`);

/* 1. Play identity: rev-8 logs replay on rev 9 to the same state, never scoring less. */
{
  const runs = gz<{ rev: number; level: string; seed: number; raw: string; score: number }[]>("scripts/fixtures/flip-x200-runs.json.gz");
  ok(runs.length === 12, `12 stored flipRev 8 runs (got ${runs.length})`);
  let lifted = 0;
  for (const run of runs) {
    const old = replayFlipRun(run.seed, run.raw, FLIP_REV_EXPAND);
    const now = replayFlipRun(run.seed, run.raw, FLIP_REV_LIFT);
    const tag = `Roofbound ${run.level} (seed ${run.seed})`;
    ok(old.score === run.score, `${tag}: flipRev 8 still scores its stored ${run.score} (got ${old.score})`);
    // The log claims its flipRev 8 score; claimed at the flipRev 9 score, it replays unflagged.
    const again = replayFlipRun(run.seed, reclaim(run.raw, now.score), FLIP_REV_LIFT);
    ok(now.desyncTick === null && !again.flagged && again.score === now.score, `${tag}: replays on flipRev 9 with no desync, unflagged at its own score`);
    ok(JSON.stringify(flipCheckpoint(now.state)) === JSON.stringify(flipCheckpoint(old.state)) && now.state.tick === old.state.tick, `${tag}: the same final state on flipRev 9`);
    ok(now.score >= old.score, `${tag}: flipRev 9 never scores less (${old.score} → ${now.score})`);
    if (now.score > old.score) lifted++;
    // flipRev 10 (29 Oct 2026, the arcade scoring standard) keeps the same play: the same final state again.
    const std = replayFlipRun(run.seed, run.raw, FLIP_REV_STD);
    ok(std.desyncTick === null && JSON.stringify(flipCheckpoint(std.state)) === JSON.stringify(flipCheckpoint(old.state)) && std.state.tick === old.state.tick, `${tag}: the same final state on flipRev 10`);
  }
  ok(lifted >= runs.length / 2, `most Roofbound runs score more on flipRev 9 (${lifted} of ${runs.length})`);
}
{
  const runs = gz<{ runs: { level: string; seed: number; raw: string; score: number }[] }>("scripts/fixtures/tilt-expand-runs.json.gz").runs;
  ok(runs.length === 32, `32 stored tiltRev 8 runs (got ${runs.length})`);
  let lifted = 0;
  for (const run of runs) {
    const old = replayTiltRun(run.seed, run.raw, TILT_REV_EXPAND);
    const now = replayTiltRun(run.seed, run.raw, TILT_REV_LIFT);
    const tag = `Tilt ${run.level} (seed ${run.seed})`;
    ok(old.score === run.score, `${tag}: tiltRev 8 still scores its stored ${run.score} (got ${old.score})`);
    const again = replayTiltRun(run.seed, reclaim(run.raw, now.score), TILT_REV_LIFT);
    ok(now.desyncTick === null && !again.flagged && again.score === now.score, `${tag}: replays on tiltRev 9 with no desync, unflagged at its own score`);
    ok(JSON.stringify(tiltCheckpoint(now.state)) === JSON.stringify(tiltCheckpoint(old.state)) && now.state.tick === old.state.tick, `${tag}: the same final state on tiltRev 9`);
    ok(now.score >= old.score, `${tag}: tiltRev 9 never scores less (${old.score} → ${now.score})`);
    if (now.score > old.score) lifted++;
  }
  ok(lifted >= runs.length / 2, `most Tilt runs score more on tiltRev 9 (${lifted} of ${runs.length})`);
}

/* 2. The curves, and the ceiling through the server's replay. */
const lifts = (name: string, old: BandCurve, now: BandCurve) => {
  ok(JSON.stringify(old.units) === JSON.stringify(now.units), `${name}: the same knots`);
  ok(now.points.every((p, i) => p >= old.points[i]!), `${name}: every knot at least the old one`);
  ok(now.points.every((p, i) => i === 0 || p >= now.points[i - 1]!), `${name}: rising`);
  ok(now.points.at(-1) === old.points.at(-1), `${name}: the same top (${now.points.at(-1)})`);
};
lifts("Roofbound base", FLIP_V8_BAND_CURVE, FLIP_V9_BAND_CURVE);
lifts("Roofbound skill pay", FLIP_V8_SKILL_PAY, FLIP_V9_SKILL_PAY);
lifts("Tilt base", TILT_V8_BAND_CURVE, TILT_V9_BAND_CURVE);
lifts("Tilt skill pay", TILT_X_SKILL_PAY, TILT_V9_SKILL_PAY);
{
  const witnesses = gz<FlipWitness[]>(FLIP_WITNESS_FIXTURE);
  let lowest = 200;
  for (const w of witnesses) {
    const { raw } = encodeFlipLog(FLIP_REV_LIFT, w.seed, w.taps.map(flipTap));
    const r = replayFlipRun(w.seed, raw, FLIP_REV_LIFT);
    if (r.flagged) ok(false, `Roofbound witness ${w.seed}: replays unflagged on flipRev 9`);
    lowest = Math.min(lowest, r.score);
  }
  ok(witnesses.length === 260 && lowest === 200, `every Roofbound witness (${witnesses.length}) scores 200 on flipRev 9 (lowest ${lowest})`);
}
{
  const proofs = gz<{ runs: { seed: number; raw: string }[] }>("scripts/fixtures/tilt-bank-runs.json.gz").runs;
  let lowest = 200;
  for (const p of proofs.slice(0, 120)) {
    const r = replayTiltRun(p.seed, reclaim(p.raw, 200), TILT_REV_LIFT);
    if (r.flagged) ok(false, `Tilt bank run ${p.seed}: replays unflagged on tiltRev 9`);
    lowest = Math.min(lowest, r.score);
  }
  ok(lowest === 200, `120 Tilt bank oracle runs score 200 on tiltRev 9 (lowest ${lowest})`);
}
{
  // No input scores 0 on both (bandTotal); one flip / one drag scores above 0 on Roofbound (the first hazard comes after 3 s).
  const f = flipGameFor(FLIP_REV_LIFT);
  let s = f.init(4242);
  while (!f.isOver(s)) s = f.step(s, null);
  ok(f.score(s) === 0, "Roofbound flipRev 9: no input scores 0");
  const t = tiltGameFor(TILT_REV_LIFT);
  let u = t.init(4242);
  while (!t.isOver(u)) u = t.step(u, null);
  ok(t.score(u) === 0, "Tilt tiltRev 9: no input scores 0");
}

/* 3. Deals, bands, maximums, help. */
// Since 29 Oct 2026 rooms deal flipRev 10, flipRev 9's play (flipRev 8's) on the arcade scoring standard (arcade-standard-check);
// since 3 Nov 2026 flipRev 11 (no star pickups, the flow streak; flip-rev11-check). flipRev 9 and 10 stay proved here.
// And later on 3 Nov 2026 flipRev 12 (flipRev 11's game, dealt from its proved courses; flip-deal-check).
ok((generatePuzzle("flip") as { flipRev?: number }).flipRev === FLIP_REV_FLOW + 1, "rooms deal flipRev 12, flipRev 11's game (flipRev 10 before 3 Nov 2026, flipRev 9's play)");
// Tilt moved on again on 29 Oct 2026 (tiltRev 10, the arcade scoring standard; tilt-standard-check); tiltRev 9 replays here as before.
// And on 3 Nov 2026 (tiltRev 11: no gold stars, par times and a clean run; tilt-rev11-check).
// And on 3 Nov 2026 again (tiltRev 12: tiltRev 11 with bigger marbles and keys; tilt-rev12-check).
ok((generatePuzzle("tilt") as { tiltRev?: number }).tiltRev === TILT_REV_BIG, "rooms deal tiltRev 12 (tiltRev 11's successor)");
ok(LIVE_BANDS.flip.rev === FLIP_REV_FLOW + 1 && LIVE_BANDS.flip.curve === FLIP_V11_BAND_CURVE, "LIVE_BANDS: Roofbound on flipRev 11's curve, dealt as flipRev 12 (flipRev 10's before 3 Nov 2026)");
ok(LIVE_BANDS.tilt.rev === TILT_REV_BIG && LIVE_BANDS.tilt.curve === TILT_V11_BAND_CURVE, "LIVE_BANDS: Tilt tiltRev 12 on tiltRev 11's core line");
ok(roundMaxFor("flip") === 200 && roundMaxFor("tilt") === 200, "both round maximums stay 200");
ok(flipWorldHFor(FLIP_REV_LIFT) === FLIP_V8_WORLD_H && tiltWorldHFor(TILT_REV_LIFT) === TILT_X_H && tiltIsExpand(TILT_REV_LIFT), "the new stamps play in the expansions' worlds");
ok(flipGameFor(FLIP_REV_LIFT).init(7).lift === 1 && !flipGameFor(FLIP_REV_EXPAND).init(7).lift, "flipRev 9 states carry lift; flipRev 8's do not");
ok(flipGameFor(FLIP_REV_STD).init(7).std === 1 && !flipGameFor(FLIP_REV_STD).init(7).lift && !flipGameFor(FLIP_REV_LIFT).init(7).std && flipWorldHFor(FLIP_REV_STD) === FLIP_V8_WORLD_H, "flipRev 10 states carry std (not lift) in flipRev 8's world; flipRev 9's do not");
ok(tiltGameFor(TILT_REV_LIFT).init(7).lift === 1 && !tiltGameFor(TILT_REV_EXPAND).init(7).lift, "tiltRev 9 states carry lift; tiltRev 8's do not");
{
  const help = read("src/lib/duel/instructions.ts");
  // Roofbound's (flipRev 10; flipRev 11 since 3 Nov 2026) and Tilt's (tiltRev 10; tiltRev 11 since 3 Nov 2026, par and a clean run
  // in place of the gold stars) dealt stamps state the standard's parts since 29 Oct 2026 (no skill pay).
  // The text pass (F2, 4 Nov 2026) lists each part on its own line: Roofbound's from FLIP_V11's spec (listFromSpec), Tilt's four
  // parts each with its maximum, ending "Total 200." (scoreList).
  ok(
    /listFromSpec\(FLIP_V11,/.test(help) &&
      ["TILT_P_CORE_MAX", "TILT_P_PAR_MAX", "TILT_P_CLEAN_POINTS", "TILT_P_SPEED_POINTS"].every((max) => new RegExp(`max: ${max} \\}`).test(help)) &&
      /max: TILT_P_SPEED_POINTS \},\n\s*\], \{ total: 200 \}\)/.test(help),
    "the help states the dealt parts (Roofbound's and Tilt's standard parts)",
  );
  const demos = read("src/lib/duel/introDemo.functions.ts");
  ok(/flipRev !== FLIP_REV_FLOW && demo\.puzzle\.flipRev !== FLIP_REV_DEAL\) return null/.test(demos) && /tiltRev !== TILT_REV_BIG\) return null/.test(demos), "intro demos play only when recorded on the dealt stamps (Roofbound flipRev 11, Tilt tiltRev 12, since 3 Nov 2026)");
}

/* 4. Ball Tracker's counts. */
{
  const reveal = (r7: boolean, home: number) => buildArcadeReveal("balltrack", { home, wrong: 0, lost: 0, state: r7 ? { r7: 1 } : {} }, 120);
  const v7 = reveal(true, 32);
  ok(!!v7 && v7.axis.max === BT_V7_BALLS && v7.lines[0]!.startsWith(`32 / ${BT_V7_BALLS} home`) && v7.tiles[0]!.value === `32 / ${BT_V7_BALLS}`, "btRev 7 reveal: 32 / 36 home (was 32 / 30)");
  const v4 = reveal(false, 28);
  ok(!!v4 && v4.axis.max === BT_BALLS && v4.lines[0]!.startsWith(`28 / ${BT_BALLS} home`), "earlier courses: 28 / 30 home");
  const summaries = read("src/lib/duel/roundSummaries.ts");
  ok(/const all = \(puzzle\.type === "balltrack" && puzzle\.course\.balls\.length\) \|\| BT_BALLS;/.test(summaries), "the round leaderboard counts the course's own marbles");
  const fx = read("src/lib/arcade/arcadeFxGames.renderer.ts");
  ok(/s\.home >= \(s\.r7 \? BT_V7_BALLS : BT_BALLS\)/.test(fx) && !/ALL 30 HOME!/.test(fx), "the final moment fires at 36 home on btRev 7");
  const stage = read("src/puzzles/ballTrack.tsx");
  // 3 Nov 2026 polish (display only): the readout moved from the line under the board into the HUD pills (btDrawHud).
  const hudArt = read("src/lib/arcade/ballTrackArt.renderer.ts");
  ok(/"Switch up"/.test(hudArt) && /btSwitchUpIn\(course, s\.tick\)/.test(stage) && !/to drop</.test(stage) && !/to drop"/.test(hudArt), "the HUD's readout says \"Switch up Ns\", not \"N to drop\"");
}

/* 5. Display numbers. */
{
  const hover = read("src/lib/arcade/hover.renderer.ts");
  const scale = Number(/const STAR_DRAW_SCALE = ([\d.]+);/.exec(hover)?.[1]);
  const r = HOVER_STAR_R / 256;
  ok(scale === 1.2 && r * scale - r <= 2, `Hover's gold stars drawn 1.2× (${(r * scale).toFixed(1)} px on a ${r} px pickup, inside the 2 px rule)`);
  ok(!/cityRow|WINDOW_TONES/.test(hover), "Hover: no city in the background");
  const orbit = read("src/lib/arcade/orbit.renderer.ts");
  const drawH = 782 + Number(/export const ORBIT_XP_AHEAD = (\d+);/.exec(orbit)?.[1]);
  ok(drawH === 782 + 80 && /export const ORBIT_XP_DRAW_H = 782 \+ ORBIT_XP_AHEAD;/.test(orbit), `Orbit's drawn view (450 × ${drawH}): the camera's 782 frame and 80 rows above it, so the frame reaches the box's bottom`);
  ok(!/ctx\.arc\(x, y, ORBIT_MOON_ASSIST \/ FP, 0, Math\.PI \* 2\);\s*ctx\.stroke\(\)/.test(orbit) && !/"#91877A"/.test(orbit), "Orbit: no dashed ring round a moon, no belt track line");
  const stage = read("src/puzzles/orbit.tsx");
  ok(/overlay=\{xp \? \(send\) => \(/.test(stage) && /footer=\{xp \? undefined :/.test(stage), "Orbit orbitRev 12: SET CHECKPOINT in the world's reserved corner, no row under it (play-control-clearance-check proves the corner)");
  ok(/worldH=\{orbitDrawHFor\(data\?\.orbitRev\)\}/.test(stage), "Orbit's stage sizes its world from the drawn height");
  const tilt = read("src/lib/arcade/tiltArt.renderer.ts");
  ok(!/function cameraX/.test(tilt) && /const cam = \{ x: 0, y: 0 \};/.test(tilt), "Tilt: the camera stays on the disc's centre");
  const flip = read("src/lib/arcade/flipArt.renderer.ts");
  ok(!/drawFarCity/.test(flip) && /function drawCaveDepths/.test(flip), "Roofbound: no city, the cave's depths instead");
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL arcade-phone-notes-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS arcade-phone-notes-check: ${checks} checks — flipRev 9 and tiltRev 9 replay rev 8 exactly and never score less, ceilings 200, deals, Ball Tracker's counts, display numbers`);
