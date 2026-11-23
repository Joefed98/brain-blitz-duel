/**
 * swing-ladder-check (~2–3 min): Grappler swingRev 19, the ladder (D5, 23 Nov 2026; Joe's approved plan of 23 Nov 2026;
 * docs/arcade-standard/swing.md "swingRev 19: the ladder"): the pterodactyl's chase is the levels' lever, the par lines
 * move by level (Normal's a little later, so 200 is reachable for the best humans on every dealt course), Easy's aids,
 * and every level dealt only on courses the proof player held to Joe's human limits takes to exactly 200.
 *
 *  1. swingRev 18 is untouched: the runs recorded on it at every level before swingRev 19
 *     (scripts/fixtures/swing-ladder-legacy.json.gz, scripts/swing-ladder-legacy-record.ts: weak, average, great, elite and
 *     the proof player on five deals a level; one a deal at default depth, all with CHECKS_FULL=1) and the 13 runs the
 *     last quarter's pterodactyl catches (swing-ladder-legacy-catch.json.gz) regrade through gradeAnswer on their stored
 *     puzzles to the same score and flag, step to the same checkpoints, restarts and catches, and build the same courses; with the era pin
 *     swingPreLadder on, the deal is exactly the recorded swingRev 18 puzzle.
 *  2. The stamp and the pin: Normal and every level deal swingRev 19 from the level's own list; a Normal deal is byte for
 *     byte the deal with no level asked for (no `level` field); swingPreLadder is a DEAL_PINS entry added at the end;
 *     LIVE_BANDS carries 19; the state carries the `ladder` marker (in its checksum, last) and its level.
 *  3. The level rules as dealt: the pterodactyl none on Easy, Normal's over the last quarter at swingRev 18's pace, Hard's
 *     and Expert's from the first vine and faster each level up (it is on screen from the first tick); each stretch's par
 *     moved by its level's parLater (swingAssaultPar and the HUD's clock agree); the course part's and the gates part's
 *     full lines; on Easy a miss keeps the streak, elsewhere it ends it; the registry's display rows mirror the sim's
 *     tables (SWING_V19_LEVELS and SWING_LEVELS); the parts still sum to 200.
 *  4. The deals: each level's list is exactly its stored witnesses in candidate order, and each witness (the proof
 *     player's log) scores exactly 200 through the server's grade on the puzzle the level deals (a sample a level; all
 *     with CHECKS_FULL=1), and the proof player plays an Expert course again to exactly its stored witness (every dealt
 *     course at every level with CHECKS_FULL=1).
 *  5. The ladder (Joe's test, scripts/d5-ladder-lib.ts): the recorded table (scripts/fixtures/d5-ladder-swing.json.gz,
 *     `bun scripts/d5-ladder-record.ts swing --deals=96`) passes ladderFixtureVerdicts, and a sample of it re-plays today
 *     exactly as recorded (replaySample).
 *  6. King of the swingers (Expert's challenge, "Get 70 % of the way on Expert") is met on every sampled Expert witness;
 *     the lever picture draws every level from the registry's rows with design tokens only.
 *
 *   bun scripts/swing-ladder-check.ts [--verbose]   (CHECKS_FULL=1: every witness graded and played again)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SWING_CHECKPOINT_INTERVAL, SWING_INPUT_HOLD, SWING_LEVELS, SWING_REV_BIG, SWING_REV_LADDER, SWING_V14_CHASE_PACE, SWING_V14_RESPAWN, SWING_V15_PAR_FULL,
  SWING_V17_CORE, SWING_V17_FULL, SWING_V17_GATES, SWING_V17_GATE_POINTS, SWING_V17_PAR_POINTS, SWING_V17_STREAK_MAX, SWING_V19_LEVELS,
  swingAssaultClock, swingAssaultPar, swingCheckpoint, swingGameFor, swingLadderGame, swingSlideParts, type SwingLadderLevel, type SwingState,
} from "../src/lib/arcade/swing";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import { pinSwingPreLadder } from "../src/lib/duel/arcade.server";
import { DEAL_PINS } from "../src/lib/duel/dealEra";
import { SWING_LADDER_DEAL } from "../src/lib/duel/swingLadderDeal.server";
import { challengesFor, goalMet } from "../src/lib/duel/practiceChallenges";
import type { PuzzleData } from "../src/lib/duel/types";
import { gameLevelSettings } from "../src/lib/levels/gameLevels";
import { puzzleLevel, type Level } from "../src/lib/levels/levels";
import { SwingPicture, swingWords } from "../src/lib/levels/pictures/retro-action/swing";
import { ladderFixtureVerdicts, replaySample } from "./d5-ladder-lib";
import { dealAt } from "./level-tune";
import { SWING_LADDER_LEGACY, stepLog, unpackEvents, type LegacyDeal } from "./swing-ladder-legacy-record";
import { SWING_LADDER_LEGACY_CATCH, type CatchRun } from "./swing-ladder-legacy-catch-record";
import { ladderGrade, ladderProof, readLadderWitnesses, SWING_LADDER_DEAL_SIZE, SWING_LADDER_LEVELS } from "./swing-ladder-deal";
import { swingSlideSubmission } from "./swing-slide-deal";

console.error = () => {};
let checks = 0;
const failures: string[] = [];
const VERBOSE = process.argv.includes("--verbose");
function ok(cond: boolean, label: string): void {
  checks++;
  if (VERBOSE) console.log(`${cond ? "ok  " : "FAIL"} ${label}`);
  if (!cond) failures.push(label);
}
const FULL = process.env.CHECKS_FULL === "1";
const t0 = Date.now();
const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 24);
const json = (v: unknown) => JSON.stringify(v);
const loose = (p: unknown) => p as Record<string, any>;
const hold = (t: number, a: number) => ({ t, k: SWING_INPUT_HOLD, a, b: 0, c: 0, d: 0 });

/* 1. swingRev 18 is untouched. */
{
  const fixture = JSON.parse(gunzipSync(readFileSync(SWING_LADDER_LEGACY)).toString()) as { deals: LegacyDeal[] };
  let runs = 0;
  let same = 0;
  let courses = 0;
  let pinned = 0;
  let caughtRuns = 0;
  let checked = 0;
  for (const d of fixture.deals) {
    const p = d.puzzle as any;
    const game = swingGameFor(p.swingRev, p.level);
    if (p.swingRev === SWING_REV_BIG && digest(game.init(p.seed)) === d.course) courses++;
    const prev = pinSwingPreLadder(true);
    try {
      if (json(dealAt("swing", d.level, d.n)) === json(d.puzzle)) pinned++;
    } finally {
      pinSwingPreLadder(prev);
    }
    for (const [i, r] of d.runs.entries()) {
      runs++;
      if (r.caught > 0) caughtRuns++;
      // (Default depth: one of the five players a deal, in turn; CHECKS_FULL=1: all five.)
      if (!FULL && (i + d.n + SWING_LADDER_LEVELS.indexOf(d.level as SwingLadderLevel)) % 5 !== 0) continue;
      checked++;
      const events = unpackEvents(r.events);
      const graded = gradeAnswer(d.puzzle, swingSlideSubmission(p.seed, events as never, p.swingRev, p.level ?? null), 0);
      const { sums, state } = stepLog(game, p.seed, events);
      if (graded.score === r.score && Boolean((graded.extra as any)?.flagged) === r.flagged && json(sums) === json(r.sums) && (state.restarts ?? 0) === r.restarts && (state.caught ?? 0) === r.caught) same++;
    }
  }
  ok(fixture.deals.length === 20 && runs === 100, `1a: the legacy fixture holds 20 swingRev 18 deals (5 a level) and 100 runs (${fixture.deals.length}, ${runs})`);
  ok(same === checked && checked >= (FULL ? 100 : 20), `1b: ${same} of ${checked} swingRev 18 runs at every level (of ${runs}) regrade to the same score and flag, checkpoints, restarts and catches`);
  // The pterodactyl's catches on swingRev 18 (no player above meets it: it flies only over the last quarter).
  const catches = (JSON.parse(gunzipSync(readFileSync(SWING_LADDER_LEGACY_CATCH)).toString()) as { runs: CatchRun[] }).runs;
  const catchSame = catches.filter((r) => {
    const p = r.puzzle as any;
    const events = unpackEvents(r.events);
    const graded = gradeAnswer(r.puzzle as unknown as PuzzleData, swingSlideSubmission(p.seed, events as never, p.swingRev, p.level ?? null), 0);
    const { sums, state } = stepLog(swingGameFor(p.swingRev, p.level), p.seed, events);
    return graded.score === r.score && !(graded.extra as any)?.flagged && json(sums) === json(r.sums) && (state.caught ?? 0) === r.caught && r.caught > 0;
  }).length;
  ok(catches.length >= 12 && catchSame === catches.length && caughtRuns === 0, `1c: ${catchSame} of ${catches.length} swingRev 18 runs the pterodactyl catches (Normal, Hard, Expert; scripts/fixtures/swing-ladder-legacy-catch.json.gz) regrade to the same score, catches and checkpoints`);
  ok(courses === fixture.deals.length, `1d: ${courses} of ${fixture.deals.length} swingRev 18 courses build as recorded`);
  ok(pinned === fixture.deals.length, `1e: with swingPreLadder pinned, ${pinned} of ${fixture.deals.length} deals are the recorded swingRev 18 puzzles byte for byte`);
}

/* 2. The stamp and the pin. */
{
  const keys = Object.keys(DEAL_PINS);
  ok(keys.indexOf("swingPreLadder") > keys.indexOf("racingPreCircuits") && keys.indexOf("racingPreCircuits") >= 0 && DEAL_PINS.swingPreLadder.texts === false, "2a: swingPreLadder is a DEAL_PINS entry added at the end (after racingPreCircuits; no text rebuild)");
  ok(LIVE_BANDS.swing.rev === SWING_REV_LADDER && SWING_REV_LADDER === 19, "2b: LIVE_BANDS deals swingRev 19");
  for (const level of SWING_LADDER_LEVELS) {
    let good = 0;
    for (let n = 0; n < 4; n++) {
      const p = loose(dealAt("swing", level as Level, n));
      const levelOk = level === "normal" ? !("level" in p) : p.level === level;
      if (p.swingRev === SWING_REV_LADDER && levelOk && SWING_LADDER_DEAL[level].includes(p.seed)) good++;
    }
    ok(good === 4, `2c ${level}: deals swingRev 19${level === "normal" ? " with no level field" : ` stamped "${level}"`} from the level's own list (${good} of 4)`);
  }
  ok([0, 1, 2].every((n) => json(dealAt("swing", "normal", n)) === json(dealAt("swing", undefined as never, n))), "2d: a Normal deal is byte for byte the deal with no level asked for");
  const prev = pinSwingPreLadder(true);
  try {
    ok(loose(dealAt("swing", "hard", 0)).swingRev === SWING_REV_BIG && loose(dealAt("swing", "normal", 0)).swingRev === SWING_REV_BIG, "2e: with swingPreLadder pinned the deal is swingRev 18");
  } finally {
    pinSwingPreLadder(prev);
  }
  ok(loose(dealAt("swing", "normal", 0)).swingRev === SWING_REV_LADDER, "2f: the pin restores: the live deal is swingRev 19");
  for (const level of SWING_LADDER_LEVELS) {
    const seed = SWING_LADDER_DEAL[level][0]!;
    const s = swingGameFor(SWING_REV_LADDER, level === "normal" ? undefined : level).init(seed) as SwingState;
    ok(s.ladder === 1 && (level === "normal" ? !("lvl" in s) : s.lvl === level) && swingGameFor(SWING_REV_LADDER, level) === swingLadderGame(level), `2g ${level}: the state carries the ladder marker and ${level === "normal" ? "no level" : `level "${level}"`}`);
    const without = { ...s, ladder: undefined } as SwingState;
    ok(swingCheckpoint(s).checksum !== swingCheckpoint(without).checksum, `2h ${level}: the marker is in the checkpoint checksum`);
  }
  ok(swingGameFor(SWING_REV_LADDER, "junk") === swingLadderGame("normal"), "2i: a junk level on swingRev 19 is Normal");
}

/* 3. The level rules as dealt. */
{
  const c = SWING_V19_LEVELS;
  ok(c.easy.chasePace === 0 && !c.normal.chaseFirst && c.normal.chasePace === SWING_V14_CHASE_PACE && c.hard.chaseFirst && c.expert.chaseFirst && c.hard.chasePace > c.normal.chasePace && c.expert.chasePace > c.hard.chasePace, "3a: the lever: no pterodactyl on Easy, Normal's over the last quarter at swingRev 18's pace, Hard's and Expert's from the first vine, faster each level up");
  ok(c.easy.parLater > c.normal.parLater && c.normal.parLater > 0 && c.normal.parLater <= 20 && c.hard.parLater < c.normal.parLater && c.expert.parLater < c.hard.parLater && c.expert.parLater === 0, `3b: the par lines: Easy's eased, Normal's a few ticks later, Hard's tighter, Expert's swingRev 18's exact par (${c.easy.parLater} / ${c.normal.parLater} / ${c.hard.parLater} / ${c.expert.parLater} ticks)`);
  ok(c.easy.full < SWING_V17_FULL && c.normal.full === SWING_V17_FULL && c.hard.full === SWING_V17_FULL && c.expert.full === SWING_V17_FULL && c.easy.missKeepsStreak && !c.normal.missKeepsStreak && !c.hard.missKeepsStreak && !c.expert.missKeepsStreak, "3c: Easy's aids: the course part full sooner and a miss keeps the streak; Normal, Hard and Expert as before");
  ok(c.normal.gatesFull === SWING_V17_GATES && c.easy.gatesFull <= SWING_V17_GATES && c.normal.streakFull === SWING_V17_STREAK_MAX / 2 && c.easy.streakFull <= c.normal.streakFull && c.normal.parCap === SWING_V15_PAR_FULL && c.normal.parFull === 45 * SWING_V15_PAR_FULL && c.easy.parFull <= c.normal.parFull, "3d: Normal's gates, streak and pars parts full where swingRev 18's are (all five gates, twenty runs of eight, half a second under par on 45 stretches); Easy's no later");
  for (const level of SWING_LADDER_LEVELS) {
    const seed = SWING_LADDER_DEAL[level][1]!;
    const game = swingGameFor(SWING_REV_LADDER, level);
    const s0 = game.init(seed) as SwingState;
    const total = s0.sections!.length;
    const want = level === "easy" ? total : c[level].chaseFirst ? 0 : s0.chaseFrom!;
    const quarter = Math.trunc((3 * total) / 4);
    ok(s0.chaseFrom === want && (level !== "normal" || (s0.chaseFrom! >= quarter - 3 && s0.chaseFrom! < total)), `3e ${level}: the pterodactyl ${level === "easy" ? "never appears" : c[level].chaseFirst ? "chases from the first vine" : "comes in over the last quarter"} (stretch ${s0.chaseFrom} of ${total})`);
    let s = s0;
    for (let t = 0; t < 30; t++) s = game.step(s, null) as SwingState;
    const flying = (s.chaseX ?? 0) !== 0;
    ok(c[level].chaseFirst ? flying : !flying, `3f ${level}: ${c[level].chaseFirst ? "the pterodactyl is on its way after half a second" : "no pterodactyl in the first half second"}`);
    if (c[level].chaseFirst) {
      const a = s.chaseX!;
      const s2 = game.step(s, null) as SwingState;
      ok(s2.chaseX! - a === c[level].chasePace || (s2.caught ?? 0) > (s.caught ?? 0), `3g ${level}: it flies ${c[level].chasePace / 256} px a tick`);
    }
    // The par: moved by the level's parLater, in the score and the HUD's clock alike.
    const done = { ...s0, acted: 1, sec: 1, secTicks: [100, ...s0.secTicks!.slice(1)], secStart: 100, tick: 100 } as SwingState;
    const q = swingAssaultPar(done, 0);
    const base = s0.sections![0]!.par;
    const clock = swingAssaultClock({ ...s0, tick: 10 } as SwingState);
    ok(q.par === base + c[level].parLater && clock?.par === base + c[level].parLater, `3h ${level}: each stretch's par moved by ${c[level].parLater} ticks (the score's and the HUD's)`);
    // The full lines: the course part at the level's share, the gates part at its count.
    const len = s0.sections![total - 1]!.x1! - s0.sections![0]!.x0!;
    const k = s0.sections!.findIndex((sec) => 1000 * (sec.x1! - s0.sections![0]!.x0!) >= c[level].full * len) + 1;
    const at = { ...s0, acted: 1, sec: k, secReach: s0.sections![k]?.x0 } as SwingState;
    const before = { ...s0, acted: 1, sec: Math.max(0, k - 3), secReach: s0.sections![Math.max(0, k - 3)]?.x0 } as SwingState;
    ok(swingSlideParts(at).core === SWING_V17_CORE && swingSlideParts(before).core < SWING_V17_CORE, `3i ${level}: the course part full at ${c[level].full / 10} % of the way`);
    const gatesAt = (n: number) => swingSlideParts({ ...s0, acted: 1, bankGates: (1 << n) - 1 } as SwingState).gates;
    ok(gatesAt(c[level].gatesFull) === SWING_V17_GATE_POINTS * SWING_V17_GATES && gatesAt(c[level].gatesFull - 1) < SWING_V17_GATE_POINTS * SWING_V17_GATES, `3j ${level}: the gates part full at ${c[level].gatesFull} gates`);
    const streakAt = (n: number) => swingSlideParts({ ...s0, acted: 1, streakPaid: n } as SwingState).streak;
    ok(streakAt(c[level].streakFull) === SWING_V17_STREAK_MAX && streakAt(c[level].streakFull - 1) < SWING_V17_STREAK_MAX, `3j' ${level}: the streak part full at ${c[level].streakFull} runs of eight clean grabs`);
    // A full run's state: every part at its maximum, 200 in all.
    const full = { ...s0, acted: 1, sec: total, secTicks: s0.sections!.reduce((ts: number[], sec, j) => [...ts, (ts[j - 1] ?? 0) + Math.max(1, sec.par + c[level].parLater - c[level].parCap)], []), bankGates: (1 << SWING_V17_GATES) - 1, streakPaid: c[level].streakFull } as SwingState;
    const fp = swingSlideParts(full);
    ok(fp.core === SWING_V17_CORE && fp.par === SWING_V17_PAR_POINTS && fp.gates === 10 && fp.streak === SWING_V17_STREAK_MAX && game.score(full) === 200, `3k ${level}: the parts still sum to 200 (110 + 40 + 10 + 40)`);
    // The registry mirrors the sim (the rev-19 rows and swingRev 18's levers it builds and plays with).
    if (level !== "normal") {
      const reg = gameLevelSettings<any>("swing", level)!;
      const l18 = SWING_LEVELS[level];
      const chase = c[level].chasePace === 0 ? "none" : c[level].chaseFirst ? "first vine" : "last quarter";
      ok(reg.chase === chase && reg.chasePx === Math.round(c[level].chasePace / 25.6) / 10 && reg.parLaterTicks === c[level].parLater && reg.courseFullPct * 10 === c[level].full && reg.gatesFull === c[level].gatesFull && reg.streakFull === c[level].streakFull && reg.parCapTicks === c[level].parCap && reg.parFullTicks === c[level].parFull && reg.missKeepsStreak === c[level].missKeepsStreak, `3l ${level}: the registry's ladder rows are the sim's`);
      ok(reg.reachPx * 256 === l18.reach && reg.stallTicks === l18.stall && reg.vineSwing === l18.swing && reg.slidingVines === l18.sliders.reduce((a, b) => a + b, 0) && reg.darkRuns === (l18.dark ? l18.runs.length : 0) && reg.pterodactyl === c[level].chasePace > 0, `3m ${level}: and its swingRev 18 levers (reach, stall, swing, sliding vines, dark runs) are the ones swingRev 19 builds and plays with`);
    }
  }
  // The streak on a miss: kept on Easy, ended elsewhere (a careless run's first miss).
  for (const level of ["easy", "normal"] as SwingLadderLevel[]) {
    const game = swingGameFor(SWING_REV_LADDER, level);
    let s = game.init(SWING_LADDER_DEAL[level][0]!) as SwingState;
    s = { ...s, streak: 5, streakAt: 0, bestHook: 99 };
    let missedAt = -1;
    for (let t = 1; t < 2000 && missedAt < 0; t++) {
      const before = s.restarts ?? 0;
      s = game.step(s, t % 50 === 0 ? hold(t, (t / 50) % 2) : null) as SwingState;
      if ((s.restarts ?? 0) > before) missedAt = t;
    }
    ok(missedAt > 0 && (level === "easy" ? s.streak === 5 : s.streak === 0) && s.streakAt === missedAt + SWING_V14_RESPAWN, `3n ${level}: a miss ${level === "easy" ? "keeps" : "ends"} the clean-swing streak (the stall counts from after the hold)`);
  }
  void SWING_CHECKPOINT_INTERVAL;
}

/* 4. The deals. */
const witnesses = Object.fromEntries(SWING_LADDER_LEVELS.map((l) => [l, readLadderWitnesses(l)])) as Record<SwingLadderLevel, ReturnType<typeof readLadderWitnesses>>;
for (const level of SWING_LADDER_LEVELS) {
  const file = witnesses[level];
  ok(file.witnesses.length === SWING_LADDER_DEAL_SIZE[level] && json(file.witnesses.map((w) => w.seed)) === json(SWING_LADDER_DEAL[level]), `4a ${level}: the deal is exactly its ${SWING_LADDER_DEAL_SIZE[level]} witnessed courses in candidate order (${file.dropped} of the first ${file.tried} candidates dropped)`);
  const sample = FULL ? file.witnesses : file.witnesses.filter((_, i) => i % Math.max(1, Math.trunc(file.witnesses.length / 4)) === 0).slice(0, 4);
  const bad = sample.filter((w) => ((g) => g.score !== 200 || g.flagged)(ladderGrade(w.seed, level, w.events)));
  ok(bad.length === 0 && sample.length >= 4, `4b ${level}: ${sample.length} dealt courses' proof-player logs each score exactly 200 through the server's grade${bad.length ? ` (not: ${bad.map((w) => w.seed).join(", ")})` : ""}`);
  // (Default depth: one Expert course, the hardest level's; CHECKS_FULL=1: every dealt course at every level.)
  const live = FULL ? file.witnesses : level === "expert" ? [file.witnesses[Math.trunc(file.witnesses.length / 2)]!] : [];
  let same = 0;
  for (const w of live) {
    const p = await ladderProof(w.seed, level);
    if (p && json(p.events) === json(w.events) && p.score === 200) same++;
  }
  if (live.length) ok(same === live.length, `4c ${level}: the proof player, held to the human limits, plays ${live.length === 1 ? "a dealt course" : `all ${live.length} dealt courses`} again to exactly its stored witness (${same} of ${live.length})`);
}

/* 5. The ladder. */
{
  for (const [cond, label] of await ladderFixtureVerdicts("swing")) ok(cond, `5a: ${label}`);
  for (const [cond, label] of await replaySample("swing", 2)) ok(cond, `5b: ${label}`);
}

/* 6. King of the swingers; the lever picture. */
{
  const king = challengesFor("swing").find((c) => c.name === "King of the swingers")!;
  const sample = FULL ? witnesses.expert.witnesses : witnesses.expert.witnesses.slice(0, 4);
  const missed = sample.filter((w) => {
    const raw = swingSlideSubmission(w.seed, unpackEvents(w.events) as never, SWING_REV_LADDER, "expert");
    const g = gradeAnswer({ type: "swing", seed: w.seed, swingRev: SWING_REV_LADDER, level: "expert" } as unknown as PuzzleData, raw, 0);
    return !goalMet(king.goal, { score: g.score, extra: g.extra as never });
  });
  ok(king?.level === "expert" && missed.length === 0, `6a: King of the swingers' goal is met on every sampled Expert witness (${sample.length})`);
  const words = new Set<string>();
  for (const level of ["easy", "normal", "hard", "expert"] as Level[]) {
    for (const size of ["l", "s"] as const) {
      const svg = renderToStaticMarkup(createElement(SwingPicture, { level, size }));
      const ptero = /data-swing-pterodactyl/.test(svg);
      ok(svg.startsWith("<svg") && svg.includes(`data-swing-picture="${level}"`) && !/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/.test(svg) && /var\(--jz-/.test(svg) && (level === "easy" ? !ptero : ptero), `6b ${level} ${size}: the lever picture draws the level from its settings, in design tokens only (${level === "easy" ? "no pterodactyl" : "the pterodactyl"})`);
    }
    words.add(swingWords(level));
  }
  ok(words.size === 4, `6c: the lever's words differ at every level (${[...words].join(" / ")})`);
  void puzzleLevel;
}

const secs = ((Date.now() - t0) / 1000).toFixed(0);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL swing-ladder-check: ${failures.length} of ${checks} checks failed (${secs} s)`);
  process.exit(1);
}
console.log(`PASS swing-ladder-check: ${checks} checks (${secs} s${FULL ? ", full depth" : ""})`);
