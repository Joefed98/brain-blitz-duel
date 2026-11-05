/**
 * hover-standard-check (the arcade scoring standard, 29 Oct 2026; docs/arcade-standard/hover.md): Hover
 * hoverRev 10 keeps hoverRev 9's play and scores it in five fixed parts that add up to 200.
 *
 *  1. Older stamps unchanged: 54 runs recorded on main before the change (hoverRev 9 at five levels on 8 room seeds,
 *     and two on every older stamp: unstamped, 2–7; scripts/fixtures/hover-standard-legacy.json.gz, written by
 *     scripts/hover-standard-record.ts) replay to the same score, checkpoints and final-state digest.
 *  2. Wiring: rooms and practice deal hoverRev 10; LIVE_BANDS, the help, the intro, the demo gate and the world height.
 *  3. Play unchanged: hoverRev 10 builds hoverRev 9's course and steps it tick for tick (the same checkpoints, so a
 *     hoverRev 9 log's checkpoints verify on hoverRev 10), whatever is played.
 *  4. The rules: each part's straight line and cap, the centre line's credit, any played run at least 1, no input 0,
 *     nothing costs points, and the score is the sum of the parts.
 *  5. Identical runs: the same seed deals the same course and features to every player, and nothing a run does
 *     changes them.
 *  6. Perfect: every stored witness run (60 tuning and 200 fresh seeds) scores 200 through the server's replay on
 *     hoverRev 10 with every part at its maximum; the reveal and stored detail add up to the stored score.
 */
import { hasScorePart } from "../src/lib/duel/scoreList";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import {
  HOVER_CENTRE_TOL,
  HOVER_CHAINS,
  HOVER_CHECKPOINT_INTERVAL,
  HOVER_DISC_R,
  HOVER_DISC_X,
  HOVER_EXPAND_H,
  HOVER_GRAVITY,
  HOVER_REACHABLE_GATES,
  HOVER_REV_EXPAND,
  HOVER_REV_STANDARD,
  HOVER_RUN_TICKS,
  HOVER_STARS,
  HOVER_STD_CENTRE,
  HOVER_STD_CENTRE_SPAN,
  HOVER_STD_CHAINS,
  HOVER_STD_CORE,
  HOVER_STD_GOLD,
  HOVER_STD_MAX,
  HOVER_STD_TIGHT,
  HOVER_TIGHT_GATES,
  HOVER_V10_BAND_CURVE,
  hoverCentreCredit,
  hoverCentreY,
  hoverCheckpoint,
  hoverGameFor,
  hoverStandardBandParts,
  hoverStandardGame,
  hoverStandardParts,
  hoverStandardScore,
  hoverWorldHFor,
  type HoverState,
} from "../src/lib/arcade/hover";
import { bandLines, bandPoints } from "../src/lib/arcade/scoreBands";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { buildArcadeReveal } from "../src/lib/arcade/reveal";
import { encodeHoverRun, replayHoverRun } from "../src/lib/duel/hover";
import { generateHover } from "../src/lib/duel/hover.server";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { roundMaxFor, SCORE_CEILING } from "../src/lib/duel/roundMax";
import type { PuzzleData } from "../src/lib/duel/types";
import { roomSeed } from "./arcade-skill-bands/games";
import { Human } from "./arcade-skill-bands/human";
import { bot, randomBot } from "./arcade-skill-bands/bots/hover";
import { HOVER_STANDARD_LEGACY, legacyOf, type HoverStandardLegacyRun } from "./hover-standard-record";
import { WITNESS_FIXTURE, WITNESS_INDICES, type HoverWitness } from "./hover-x200-witness";
import { playRevOf } from "./scoring-targets-revs";
import { entry } from "./arcade-standard/hover";
import type { StdRun } from "./arcade-standard/entry";

/** The game's arcade-standard-check entry, read as this check always has (the first perfect run, split into parts). */
const STANDARD = {
  id: entry.type,
  stampKey: entry.field,
  stamp: entry.rev,
  parts: entry.parts,
  perfect: () => {
    const r = (entry.perfect() as StdRun[])[0]!;
    return { score: r.score, parts: r.parts! };
  },
};

const failures: string[] = [];
let passes = 0;
const ok = (cond: boolean, message: string) => {
  if (cond) passes++;
  else failures.push(message);
};
const section = (name: string) => console.log(`— ${name}`);
const FP = 256;
const v9 = hoverGameFor(HOVER_REV_EXPAND);
const v10 = hoverGameFor(HOVER_REV_STANDARD);

/** Plays a tap log on a game the way the phone does: the encoded answer and the final state. */
function play(game: typeof v10, seed: number, taps: Iterable<number>): { raw: string; state: HoverState } {
  const set = new Set(taps);
  let state = game.init(seed) as HoverState;
  const checkpoints = [];
  while (!game.isOver(state)) {
    state = game.step(state, set.has(state.tick + 1)) as HoverState;
    if (state.tick % HOVER_CHECKPOINT_INTERVAL === 0) checkpoints.push(hoverCheckpoint(state));
  }
  return { raw: encodeHoverRun({ seed, claimedScore: game.score(state), inputs: [...set].sort((a, b) => a - b), endTick: state.tick, checkpoints }), state };
}
/** A state without hoverRev 10's two fields (to compare with hoverRev 9's). */
const withoutStd = (s: HoverState) => {
  const { std: _std, ctrFine: _fine, ...rest } = s;
  return rest;
};

/* 1. Older stamps unchanged. */
section("older stamps unchanged");
{
  const runs = JSON.parse(gunzipSync(readFileSync(HOVER_STANDARD_LEGACY)).toString()) as HoverStandardLegacyRun[];
  ok(runs.length === 54 && runs.filter((r) => r.rev === 9).length === 40 && new Set(runs.map((r) => r.rev)).size === 8, `54 legacy runs: 40 on hoverRev 9, two on each older stamp (${runs.length})`);
  let same = 0;
  for (const r of runs) {
    const now = legacyOf(r.rev, r.level, r.seed, r.raw);
    if (JSON.stringify(now) === JSON.stringify(r)) same++;
    else failures.push(`legacy run rev ${r.rev} ${r.level} seed ${r.seed}: score ${r.score} → ${now.score}, state ${r.state} → ${now.state}`);
  }
  ok(same === runs.length, `every legacy run replays identically: score, checkpoints and final state (${same} of ${runs.length})`);
  for (const rev of [null, 2, 3, 4, 5, 6, 7, 8, 9]) {
    const s = hoverGameFor(rev).init(77) as HoverState;
    ok(s.std === undefined && s.ctrFine === undefined, `hoverRev ${rev}: no hoverRev 10 field on its states`);
  }
  ok(hoverGameFor(HOVER_REV_EXPAND) !== hoverStandardGame && hoverGameFor(11) !== hoverStandardGame, "only hoverRev 10 plays the standard's scoring");
}

/* 2. Wiring. */
section("wiring");
{
  ok(HOVER_REV_STANDARD === 10 && generateHover().hoverRev === HOVER_REV_STANDARD, "rooms deal hoverRev 10");
  const stage = readFileSync("src/puzzles/hover.tsx", "utf8");
  ok(/hoverRev: HOVER_REV_STANDARD \}\) satisfies HoverPuzzleData/.test(stage), "practice deals hoverRev 10");
  ok(LIVE_BANDS.hover.rev === HOVER_REV_STANDARD && LIVE_BANDS.hover.curve === HOVER_V10_BAND_CURVE, "LIVE_BANDS lists hoverRev 10 on its core line");
  ok(playRevOf("hover", HOVER_REV_STANDARD) === HOVER_REV_EXPAND && playRevOf("hover", HOVER_REV_EXPAND) === HOVER_REV_EXPAND, "older checks read hoverRev 10 as hoverRev 9's play");
  ok(roundMaxFor("hover") === 200 && SCORE_CEILING === 200 && HOVER_STD_MAX === 200, "Hover's round maximum and the parts' total are 200");
  ok(hoverWorldHFor(HOVER_REV_STANDARD) === HOVER_EXPAND_H, "hoverRev 10 plays in hoverRev 9's 390 × 727 world");
  ok(/demo\.puzzle\.hoverRev !== HOVER_REV_STANDARD\) return null/.test(readFileSync("src/lib/duel/introDemo.functions.ts", "utf8")), "the intro demo is stopped until one is recorded on hoverRev 10");
  const help = PUZZLE_INSTRUCTIONS.hover.score;
  // Text pass (4 Nov 2026): the help is a list, one line a part, then penalties, then the total; the intro names the
  // bonuses in one plain sentence (no internal figures).
  ok(hasScorePart(help, "Barriers", 120) && hasScorePart(help, "Star chains", 30) && hasScorePart(help, "Gold stars", 20) && hasScorePart(help, "Tight gates", 20) && hasScorePart(help, "Centre lines", 10) && help.endsWith("Total 200."), `the help states each part's maximum and the 200 total: ${help}`);
  ok(/barriers/.test(INTRO_SCORE.hover) && /star chains/.test(INTRO_SCORE.hover) && /gold stars/.test(INTRO_SCORE.hover) && /tight gates/.test(INTRO_SCORE.hover) && INTRO_SCORE.hover.endsWith("Up to 200."), `the intro names the parts (${INTRO_SCORE.hover})`);
  ok(STANDARD.stamp === HOVER_REV_STANDARD && STANDARD.parts.reduce((a, p) => a + p.max, 0) === 200, "the standard module lists parts summing to 200");
}

/* 3. Play unchanged. */
section("play unchanged");
{
  let same = 0;
  let courses = 0;
  const N = 24;
  for (let n = 0; n < N; n++) {
    const seed = roomSeed(n);
    const a = v9.init(seed) as HoverState;
    const b = v10.init(seed) as HoverState;
    if (JSON.stringify(withoutStd(b)) === JSON.stringify(a) && b.std === 1 && b.ctrFine === 0) courses++;
    const level = (["weak", "average", "good", "great", "near", "elite"] as const)[n % 6]!;
    const taps = n % 7 === 6 ? (randomBot({ game: v9, seed, rev: HOVER_REV_EXPAND, human: new Human("hover", seed, "weak") }).taps ?? []) : (bot({ game: v9, seed, rev: HOVER_REV_EXPAND, human: new Human("hover", seed, level) }).taps ?? []);
    const old = play(v9, seed, taps);
    const neu = play(v10, seed, taps);
    // A hoverRev 9 answer's checkpoints verify on hoverRev 10: no desync, and only the claimed score differs.
    const cross = replayHoverRun(seed, old.raw, HOVER_REV_STANDARD);
    const r10 = replayHoverRun(seed, neu.raw, HOVER_REV_STANDARD);
    if (JSON.stringify(withoutStd(neu.state)) === JSON.stringify(old.state) && cross.desyncTick === null && JSON.stringify(cross.checkpoints) === JSON.stringify(replayHoverRun(seed, old.raw, HOVER_REV_EXPAND).checkpoints) && !r10.flagged && r10.score === v10.score(neu.state)) same++;
    else failures.push(`seed index ${n} (${level}): hoverRev 10 play differs from hoverRev 9`);
  }
  ok(courses === N, `${N} seeds: hoverRev 10 deals hoverRev 9's course, features and start exactly (${courses})`);
  ok(same === N, `${N} bot and random logs: hoverRev 10 steps exactly as hoverRev 9 (same state, same checkpoints), unflagged on its own replay (${same})`);
}

/* 4. The rules. */
section("the rules");
{
  // Core: one straight line, 120 × barriers ÷ 42, steps of 2 or 3.
  let line = true;
  for (let g = 0; g <= HOVER_REACHABLE_GATES; g++) {
    const want = Math.floor((HOVER_STD_CORE * g) / HOVER_REACHABLE_GATES);
    if (bandPoints(HOVER_V10_BAND_CURVE, g) !== want) line = false;
    if (g > 0 && want - Math.floor((HOVER_STD_CORE * (g - 1)) / HOVER_REACHABLE_GATES) > 3) line = false;
  }
  ok(line && HOVER_V10_BAND_CURVE.units.length === 2 && bandPoints(HOVER_V10_BAND_CURVE, HOVER_REACHABLE_GATES) === 120, "core: barriers on one straight line, 0 → 0 and 42 → 120, each barrier 2 or 3 points");
  const s0 = v10.init(roomSeed(3)) as HoverState;
  ok(s0.totalGates === HOVER_REACHABLE_GATES && s0.totalStars === HOVER_STARS && (s0.chains ?? []).length === HOVER_CHAINS && s0.pillars.filter((p) => p.tightTop !== undefined).length === HOVER_TIGHT_GATES, "the course holds 42 barriers, 10 gold stars, 5 chains and 5 tight gates (hover-x200-check proves it on 1,760 courses)");
  const at = (patch: Partial<HoverState>) => hoverStandardParts({ ...s0, acted: 1, ...patch });
  // Each part on its own.
  for (let g = 0; g <= 42; g += 7) ok(at({ gates: g }).core === Math.floor((120 * g) / 42) && at({ gates: g }).sum === at({ gates: g }).core, `core alone: ${g} barriers → ${Math.floor((120 * g) / 42)}`);
  for (let k = 0; k <= 10; k++) ok(at({ stars: k }).gold === 2 * k, `gold stars: ${k} → ${2 * k}`);
  for (let k = 0; k <= 5; k++) ok(at({ tight: k }).tight === 4 * k, `tight gates: ${k} → ${4 * k}`);
  // Chains: 4 by share of the chain's stars, 2 for the whole chain, 6 a chain.
  const chains = s0.chains!;
  const hitsOf = (counts: number[]) => counts.flatMap((m, c) => Array.from({ length: m }, (_, j) => c * 8 + j));
  const full = chains.map((c) => c.stars.length);
  ok(at({ chainHits: hitsOf(full) }).chains === HOVER_STD_CHAINS, "every star of every chain: 30");
  ok(at({ chainHits: hitsOf([full[0]!, 0, 0, 0, 0]) }).chains === 6, "one whole chain: 6");
  {
    const n0 = full[0]!;
    const half = at({ chainHits: hitsOf([n0 - 1, 0, 0, 0, 0]) }).chains;
    ok(half === Math.floor((4 * (n0 - 1)) / n0), `a chain one star short: 4 × ${n0 - 1}/${n0}, no whole-chain 2 (${half})`);
    const shares = hitsOf(full.map((m) => m - 1));
    const want = Math.floor(full.reduce((a, m) => a + (4 * (m - 1)) / m, 0) + 1e-9);
    ok(at({ chainHits: shares }).chains === want, `every chain one short: the shares summed, then floored (${at({ chainHits: shares }).chains} = ${want})`);
  }
  // The centre line: credit 2304 within 6 px, falling evenly to 0 at 15 px; 2 a gate at full credit.
  ok(hoverCentreCredit(0) === HOVER_STD_CENTRE_SPAN && hoverCentreCredit(6 * FP) === HOVER_STD_CENTRE_SPAN && hoverCentreCredit(15 * FP) === 0 && hoverCentreCredit(20 * FP) === 0 && hoverCentreCredit(10.5 * FP) === HOVER_STD_CENTRE_SPAN >> 1 && HOVER_CENTRE_TOL[0] === 6 * FP && HOVER_CENTRE_TOL[2] === 15 * FP, "centre credit: full within 6 px, half at 10.5 px, none from 15 px, straight between");
  ok(at({ ctrFine: 5 * HOVER_STD_CENTRE_SPAN }).centre === HOVER_STD_CENTRE && at({ ctrFine: HOVER_STD_CENTRE_SPAN }).centre === 2 && at({ ctrFine: 9 * HOVER_STD_CENTRE_SPAN }).centre === HOVER_STD_CENTRE, "centre line: 2 a gate dead centre, 10 for all five, never more");
  {
    // Fly level through a real tight gate at a fixed stray from its line (the sim's own step each tick).
    const i = s0.pillars.findIndex((p) => p.tightTop !== undefined);
    const p = s0.pillars[i]!;
    const c = hoverCentreY(p);
    const fly = (off: number) => {
      let st: HoverState = { ...s0, acted: 1, gates: i, distance: p.x0 - (HOVER_DISC_X + HOVER_DISC_R) - 4 * FP, y: c + off, vy: 0 };
      for (let k = 1; k < 60 && st.gates === i && !st.crashed; k++) st = v10.step({ ...st, y: c + off, vy: 0 }, false) as HoverState;
      return st;
    };
    // Held level, the saucer still sinks one tick of gravity (90/256 px) before each check, so its furthest stray is the
    // offset plus that.
    const rows: [number, number, number][] = [[0, 2, 1], [5, 2, 1], [8, 1, 1], [10, 1, 1], [12, 0, 1], [16, 0, 1]];
    for (const [off, pts, tight] of rows) {
      const st = fly(off * FP);
      const parts = hoverStandardParts(st);
      const credit = hoverCentreCredit(off * FP + HOVER_GRAVITY);
      ok(st.tight === tight && st.gates === i + 1 && st.ctrFine === credit && parts.centre === Math.floor((10 * credit) / (HOVER_STD_CENTRE_SPAN * 5)) && parts.centre === pts && parts.tight === 4, `${off} px off the line: a tight gate (4) and the barrier, credit ${credit}, centre ${parts.centre} (want ${pts})`);
    }
    // Earning a feature never costs core: the tight gate's barrier counts like any other.
    const through = fly(0);
    ok(hoverStandardParts(through).core === Math.floor((120 * (i + 1)) / 42), "a barrier passed through its tight gate counts for the core too");
  }
  // At least 1 for any played run, 0 for none; the score is the sum of the parts; nothing below 0 or above 200.
  ok(hoverStandardScore({ ...s0, acted: 1 }) === 1 && hoverStandardScore({ ...s0, acted: 0 }) === 0, "a played run with nothing earned scores 1, no input 0");
  {
    const noInput = play(v10, roomSeed(3), []);
    ok(v10.score(noInput.state) === 0, "no input at all scores 0");
    const twoTaps = play(v10, roomSeed(5), [14, 48]);
    ok(twoTaps.state.crashed && v10.score(twoTaps.state) >= 1, `two taps then a crash: at least 1 (${v10.score(twoTaps.state)})`);
  }
  let sums = true;
  let maxSeen = 0;
  let minPlayed = 200;
  let rand = 99;
  const next = () => ((rand = (Math.imul(rand, 1103515245) + 12345) >>> 0) >>> 8) / 0x1000000;
  for (let n = 0; n < 60; n++) {
    const seed = 1 + Math.floor(next() * 2e9);
    const taps: number[] = [];
    for (let t = 2 + (n % 9); t <= HOVER_RUN_TICKS; t += 8 + Math.floor(next() * 18)) taps.push(t);
    const { state } = play(v10, seed, taps);
    const p = hoverStandardParts(state);
    const score = v10.score(state);
    maxSeen = Math.max(maxSeen, score);
    minPlayed = Math.min(minPlayed, score);
    if (score !== Math.max(1, p.core + p.chains + p.gold + p.tight + p.centre) || p.core > 120 || p.chains > 30 || p.gold > 20 || p.tight > 20 || p.centre > 10 || p.core < 0) sums = false;
    if (p.gold !== 2 * (state.stars ?? 0) || p.tight !== 4 * (state.tight ?? 0) || p.core !== Math.floor((120 * state.gates) / 42)) sums = false;
  }
  ok(sums && maxSeen <= 200 && minPlayed >= 1, `60 random runs: the score is the sum of the parts, each within its maximum, at least 1 (min ${minPlayed}, max ${maxSeen})`);
  ok(hoverStandardScore({ ...s0, acted: 1, crashed: true, gates: 20 }) === hoverStandardScore({ ...s0, acted: 1, gates: 20 }), "a crash costs nothing beyond the run ending; lasting the minute adds nothing");
  {
    const st: HoverState = { ...s0, acted: 1, gates: 30, stars: 4, tight: 2 };
    const bp = hoverStandardBandParts(st);
    const lines = bandLines(bp, hoverStandardScore(st));
    ok(bp.points + bp.bonus === hoverStandardScore(st) && lines[0] === "30 / 42 barriers → 85" && /^Star chains 0 · gold stars 8 · tight gates 8 · centre line 0 \+16$/.test(lines[1]!), `the reveal's breakdown: ${lines.join(" | ")}`);
  }
}

/* 5. Identical runs for every player. */
section("identical runs");
{
  let same = 0;
  for (let n = 0; n < 12; n++) {
    const seed = roomSeed(100 + n);
    const a = JSON.stringify(v10.init(seed));
    const b = JSON.stringify(v10.init(seed));
    // Whatever a player does, the course and its features stay as dealt.
    const course = (s: HoverState) => JSON.stringify([s.pillars, s.chains, s.pickups, s.totalGates, s.totalStars]);
    const runs = [[], [10, 40, 70], bot({ game: v10, seed, rev: HOVER_REV_STANDARD, human: new Human("hover", seed, n % 2 ? "good" : "great") }).taps ?? [], randomBot({ game: v10, seed, rev: HOVER_REV_STANDARD, human: new Human("hover", seed, "weak") }).taps ?? []].map((t) => course(play(v10, seed, t).state));
    if (a === b && runs.every((c) => c === course(JSON.parse(a) as HoverState))) same++;
  }
  ok(same === 12, `12 seeds: the same seed deals the same course and features, unchanged by idle, scripted, good / great and random play (${same})`);
}

/* 6. Perfect runs. */
section("perfect runs");
{
  const witnesses = JSON.parse(gunzipSync(readFileSync(WITNESS_FIXTURE)).toString()) as HoverWitness[];
  let perfect = 0;
  for (const idx of WITNESS_INDICES) {
    const w = witnesses.find((x) => x.n === idx);
    if (!w) {
      failures.push(`seed index ${idx}: no witness`);
      continue;
    }
    const { raw, state } = play(v10, w.seed, w.taps);
    const r = replayHoverRun(w.seed, raw, HOVER_REV_STANDARD);
    const p = hoverStandardParts(r.state);
    if (!r.flagged && r.score === 200 && p.core === 120 && p.chains === 30 && p.gold === 20 && p.tight === 20 && p.centre === 10 && v10.score(state) === 200) perfect++;
    else failures.push(`seed index ${idx}: witness on hoverRev 10 scores ${r.score} (${JSON.stringify(p)})`);
  }
  ok(perfect === WITNESS_INDICES.length, `${perfect} of ${WITNESS_INDICES.length} witness runs score 200 through the server replay on hoverRev 10, every part at its maximum`);
  const pf = STANDARD.perfect();
  ok(pf.score === 200 && STANDARD.parts.every((part) => pf.parts[part.key] === part.max), `STANDARD.perfect(): ${pf.score} ${JSON.stringify(pf.parts)}`);
  // Through the real grading path, with the stored detail and the reveal.
  const w = witnesses.find((x) => x.n === 7)!;
  const { raw } = play(v10, w.seed, w.taps);
  const puzzle = { type: "hover", seed: w.seed, hoverRev: HOVER_REV_STANDARD } as PuzzleData;
  const g = gradeAnswer(puzzle, raw, 0);
  const e = g.extra ?? {};
  ok(g.score === 200 && e["corePts"] === 120 && e["chainPts"] === 30 && e["goldPts"] === 20 && e["tightPts"] === 20 && e["centreLinePts"] === 10 && e["skill"] === 80, `gradeAnswer: 200 with every part stored (${g.score}, ${JSON.stringify([e["corePts"], e["chainPts"], e["goldPts"], e["tightPts"], e["centreLinePts"]])})`);
  const reveal = buildArcadeReveal("hover", replayHoverRun(w.seed, raw, HOVER_REV_STANDARD), g.score);
  ok(!!reveal && reveal.lines[0] === "42 / 42 barriers → 120" && reveal.lines[1] === "Star chains 30 · gold stars 20 · tight gates 20 · centre line 10 +80" && reveal.lines[2] === "Total → 200", `the reveal: ${reveal?.lines.join(" | ")}`);
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  ✗ ${f}`);
  console.log(`FAIL hover-standard-check: ${failures.length} of ${passes + failures.length} checks failed`);
  process.exit(1);
}
console.log(`PASS hover-standard-check: ${passes} checks — hoverRev 10 (hoverRev 9's play; barriers 120, chains 30, gold stars 20, tight gates 20, centre lines 10 = 200; every witness 200); older stamps unchanged`);
