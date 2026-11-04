/**
 * The puzzle batch of 3 Nov 2026 (docs/puzzle-batch-nov-2026.md; src/lib/duel/parMoves.ts): Labyrinth `mazeRev 4`,
 * Topsy-Turvy `gravityRev 6` and Skid `slideRev 3` lose their collectibles and score a finish as 150 + up to 30 for
 * speed + up to 20 for par moves. Proves:
 *   1. new deals carry the new stamps with no stars or gems and the standard stamp's board otherwise;
 *      pinPreParMoves(true) deals the standard's stamps with their collectibles, the same seed the same board;
 *   2. older rounds grade exactly as before: every case of scripts/fixtures/puzzle-batch-nov-legacy.json.gz (recorded on
 *      main before the batch, scripts/puzzle-batch-nov-record.ts) regrades to the same score, verdict and parts;
 *   3. a flawless solve (the shortest route, finished fast) scores exactly 200 (150 + 30 speed + 20 par) on every seed;
 *   4. the par bonus is full at par, falls in a straight line, 0 at twice par; speed is 30 within the game's time;
 *   5. unfinished scoring is unchanged: an unfinished answer scores the same on the new stamp as on the standard's
 *      with the collectibles taken off;
 *   6. kit play weak → flawless, before → after: medians never fall with skill, flawless's median is 200, and guessing
 *      never pays (random play's median under the weak median, no random finish earns par points, and random play
 *      scores no more than before, median and best);
 *   7. the help and intro texts state the new rules (no stars or gems, intro lines at most 90 characters), and the
 *      standard's when the batch is pinned.
 *
 *   bun scripts/puzzle-batch-nov-check.ts [--seeds=8]
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { GRAVITY_REV_PAR, MAZE_REV_PAR, PAR_MOVES_STAMPS, SLIDE_REV_PAR, pinPreParMoves, pinPreParStrict, usesParMoves } from "../src/lib/duel/parMoves";
import { STANDARD_STAMPS, pinPreStandard } from "../src/lib/duel/standard/stamps";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { encodeMazeTrail } from "../src/lib/duel/depth/labyrinth";
import { mazeColsOf } from "../src/lib/duel/maze";
import { BATCH_LEVELS, BATCH_TYPES, dealBatch, flawlessSolve, playBatch, spamBatch, type BatchLevel, type BatchType } from "./puzzle-batch-nov/players";
import { gradeSteps, median } from "./standard-lib";
import type { MazePuzzleData, PuzzleData } from "../src/lib/duel/types";
import { verifyTopsyPuzzle } from "../src/lib/duel/topsy.server";

// This check proves the puzzle batch's stamps (mazeRev 4, gravityRev 6, slideRev 3); the stricter-par stamps above them
// (puzzle polish, 3 Nov 2026) are proved by puzzle-polish-nov-check.
pinPreParStrict(true);

let fails = 0;
let passes = 0;
function ok(cond: boolean, what: string): void {
  if (cond) passes++;
  else {
    fails++;
    console.log(`FAIL ${what}`);
  }
}

const args = process.argv.slice(2);
const SEEDS_N = Number(args.find((a) => a.startsWith("--seeds="))?.slice(8) ?? 8);
const SEEDS = Array.from({ length: SEEDS_N }, (_, i) => 9100 + i * 13);
type Of<T extends PuzzleData["type"]> = Extract<PuzzleData, { type: T }>;
const NEW_REV: Record<BatchType, number> = { maze: MAZE_REV_PAR, gravity: GRAVITY_REV_PAR, iceslide: SLIDE_REV_PAR };
const stamp = (p: PuzzleData, type: BatchType) => (p as unknown as Record<string, unknown>)[PAR_MOVES_STAMPS[type]!.key];
const collectibles = (p: PuzzleData): number =>
  p.type === "maze" ? (p.stars ?? []).length : p.type === "iceslide" ? (p.gems ?? []).length : p.type === "gravity" ? (p.boards ?? []).reduce((n, b) => n + b.stars.length, 0) : 0;
/** The standard stamp's puzzle as the new stamp deals it: the collectibles off, everything else kept. */
function stripped(p: PuzzleData, type: BatchType): unknown {
  const c = JSON.parse(JSON.stringify(p)) as Record<string, unknown>;
  delete c[PAR_MOVES_STAMPS[type]!.key];
  delete c["stars"];
  delete c["gems"];
  delete c["boardStarMins"];
  // Topsy-Turvy stores each board's shortest route without the stars (the standard's were the all-stars routes).
  if (type === "gravity") (delete c["boardSolutions"], delete c["solution"]);
  if (Array.isArray(c["boards"])) c["boards"] = (c["boards"] as { stars: number[] }[]).map((b) => ({ ...b, stars: [] }));
  return c;
}
function pinned<T>(fn: () => T): T {
  const before = pinPreParMoves(true);
  try {
    return fn();
  } finally {
    pinPreParMoves(before);
  }
}

/* 1. Stamps and deals */
for (const type of BATCH_TYPES) {
  const std = STANDARD_STAMPS[type]!;
  for (const seed of SEEDS.slice(0, 4)) {
    const now = dealBatch(type, seed);
    const old = pinned(() => dealBatch(type, seed));
    ok(stamp(now, type) === NEW_REV[type] && usesParMoves(now), `${type} ${seed}: deals ${PAR_MOVES_STAMPS[type]!.key} ${NEW_REV[type]} (got ${stamp(now, type)})`);
    ok(collectibles(now) === 0, `${type} ${seed}: no stars or gems on the new stamp`);
    ok(stamp(old, type) === (std.dealt ?? std.rev) && !usesParMoves(old), `${type} ${seed}: pinPreParMoves deals the standard's ${std.rev}`);
    ok(collectibles(old) > 0, `${type} ${seed}: the standard's stamp keeps its collectibles (${collectibles(old)})`);
    ok(JSON.stringify(stripped(now, type)) === JSON.stringify(stripped(old, type)), `${type} ${seed}: the same board as the standard stamp, collectibles off`);
    ok(JSON.stringify(dealBatch(type, seed)) === JSON.stringify(now), `${type} ${seed}: the same seed deals the same puzzle`);
    if (type === "gravity") {
      const g = now as Of<"gravity">;
      ok(verifyTopsyPuzzle(g) === null, `gravity ${seed}: the new deal passes the generator's verifier (${verifyTopsyPuzzle(g)})`);
      ok((g.boardSolutions ?? []).every((r, i) => r.length === g.boardMins![i]) && g.solution === (g.boardSolutions ?? []).join(""), `gravity ${seed}: the stored routes are the boards' shortest, without stars`);
    }
    const before = pinPreStandard(true);
    const live = dealBatch(type, seed);
    pinPreStandard(before);
    ok(stamp(live, type) === std.live, `${type} ${seed}: pinPreStandard deals the live ${std.live}`);
  }
}

/* 2. Legacy: older rounds grade exactly as before */
{
  const fx = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/puzzle-batch-nov-legacy.json.gz")).toString()) as {
    puzzles: PuzzleData[];
    cases: { p: number; answer: string; msLeft: number; score: number; correct: boolean; parts: unknown }[];
  };
  ok(fx.puzzles.length === 18 && fx.cases.length >= 150, `legacy fixture: ${fx.puzzles.length} puzzles, ${fx.cases.length} cases`);
  for (const [i, p] of fx.puzzles.entries()) {
    const type = p.type as BatchType;
    ok(stamp(p, type) === STANDARD_STAMPS[type]!.rev && !usesParMoves(p), `legacy puzzle ${i} (${type}) is on the standard's stamp`);
  }
  let same = 0;
  for (const c of fx.cases) {
    const g = gradeAnswer(fx.puzzles[c.p]!, c.answer, c.msLeft);
    const parts = (g.extra as Record<string, unknown> | undefined)?.["parts"] ?? null;
    if (g.score === c.score && g.isCorrect === c.correct && JSON.stringify(parts) === JSON.stringify(c.parts)) same++;
    else ok(false, `legacy ${fx.puzzles[c.p]!.type} case: ${c.score}/${c.correct} on main, ${g.score}/${g.isCorrect} now`);
  }
  ok(same === fx.cases.length, `legacy: ${same} of ${fx.cases.length} cases regrade exactly as on main`);
}

/* 3. A flawless solve scores 200 */
for (const type of BATCH_TYPES) {
  let all = 0;
  let at200 = 0;
  for (let i = 0; i < 30; i++) {
    const p = dealBatch(type, 5000 + i * 17);
    const f = flawlessSolve(type, p);
    if (!f) {
      ok(false, `${type} ${5000 + i * 17}: no server route to play`);
      continue;
    }
    all++;
    const g = gradeAnswer(p, f.answer, f.msLeft);
    const parts = (g.extra as { parts?: { base?: number; speed?: number; efficiency?: number; measure?: string } } | undefined)?.parts;
    if (g.isCorrect && g.score === 200 && parts?.base === 150 && parts?.speed === 30 && parts?.efficiency === 20 && parts?.measure === "par") at200++;
    else ok(false, `${type} ${5000 + i * 17}: flawless solve scored ${g.score} (${JSON.stringify(parts)})`);
  }
  ok(all === 30 && at200 === 30, `${type}: a flawless solve scores 200 = 150 + 30 speed + 20 par on ${at200} of ${all} seeds`);
}

/* 4. The par bonus's line and the speed part */
{
  const expectPar = (used: number, par: number) => Math.round(20 * Math.max(0, Math.min(1, used <= par ? 1 : (2 * par - used) / par)));
  // Labyrinth: back and forth on the route's first step adds two steps each time.
  const m = dealBatch("maze", 9001) as MazePuzzleData;
  const route = m.solution!;
  const par = route.length - 1;
  const limit = puzzleTimeLimitMs(m);
  for (const extra of [0, 2, 10, Math.floor(par / 2) * 2, par + 1, par + 7]) {
    const reps = Math.ceil(extra / 2);
    const trail = [route[0]!, ...Array.from({ length: reps }, () => [route[1]!, route[0]!]).flat(), ...route.slice(1)];
    const g = gradeAnswer(m, encodeMazeTrail(trail, mazeColsOf(m)), limit - 10_000);
    const walked = trail.length - 1;
    ok(g.isCorrect && g.score === 150 + 30 + expectPar(walked, par), `Labyrinth: ${walked} steps for par ${par} scores ${g.score}, want ${150 + 30 + expectPar(walked, par)}`);
  }
  // Skid: an extra slide undone still counts as a slide (Undo gives none back).
  const s = dealBatch("iceslide", 9002) as Of<"iceslide">;
  const sol = s.solution!;
  const sLimit = puzzleTimeLimitMs(s);
  const first = sol[0]!;
  const other = (["U", "D", "L", "R"] as const).filter((d) => d !== first);
  for (const k of [0, 1, 2, 3, s.minMoves!, s.minMoves! + 2]) {
    // k wasted slides: each a slide then an undo (X); a slide that cannot move counts nothing, so only moving ones count.
    let answer = "";
    for (let i = 0; i < k; i++) answer += other[i % other.length]! + "X";
    answer += sol;
    const g = gradeAnswer(s, answer, sLimit - 10_000);
    const slides = Number((g.extra as Record<string, unknown>)?.["slides"] ?? -1);
    ok(g.isCorrect && slides >= s.minMoves! && g.score === 150 + 30 + expectPar(slides, s.minMoves!), `Skid: ${slides} slides for par ${s.minMoves} scores ${g.score}`);
  }
  // Topsy-Turvy: tilts beyond the boards' fewest, through undone tilts.
  const t = dealBatch("gravity", 9003) as Of<"gravity">;
  const tPar = (t.boardMins ?? []).reduce((a, b) => a + b, 0);
  const tLimit = puzzleTimeLimitMs(t);
  const flaw = flawlessSolve("gravity", t)!;
  const g0 = gradeAnswer(t, flaw.answer, tLimit - 20_000);
  ok(g0.score === 200, `Topsy-Turvy: the fewest tilts at 20 s scores 200 (${g0.score})`);
  const slow = gradeAnswer(t, flaw.answer, 0);
  ok(slow.isCorrect && slow.score === 170, `Topsy-Turvy: the fewest tilts at the buzzer scores 150 + 0 speed + 20 par (${slow.score})`);
  ok(tPar > 0, `Topsy-Turvy: par ${tPar}`);
  // Speed: full within the game's time, half way down at the clock's middle of its window.
  const fullBy = { maze: 40, gravity: 80, iceslide: 60 } as const;
  for (const type of BATCH_TYPES) {
    const p = dealBatch(type, 9004);
    const f = flawlessSolve(type, p)!;
    const lim = puzzleTimeLimitMs(p);
    const window = lim - fullBy[type] * 1000;
    const half = gradeAnswer(p, f.answer, Math.round(window / 2));
    ok(half.score === 150 + 15 + 20, `${type}: a flawless solve half way through the speed window scores 185 (${half.score})`);
    ok(gradeAnswer(p, f.answer, lim - fullBy[type] * 1000).score === 200, `${type}: full speed at ${fullBy[type]} s`);
  }
}

/* 5. Unfinished scoring unchanged */
for (const type of BATCH_TYPES) {
  let same = 0;
  let all = 0;
  for (const seed of SEEDS) {
    const now = dealBatch(type, seed);
    // The standard stamp's grader on the same board with the collectibles off: nothing for collectibles either way.
    const std = STANDARD_STAMPS[type]!;
    const asStd = { ...(now as object), [std.key]: std.dealt ?? std.rev } as unknown as PuzzleData;
    const limit = puzzleTimeLimitMs(now);
    for (const level of BATCH_LEVELS) {
      const play = playBatch(type, now, level, seed);
      const inTime = play.steps.filter((s) => s.atMs <= limit);
      for (const cut of [0.25, 0.5, 0.8]) {
        const upTo = inTime.slice(0, Math.max(1, Math.floor(inTime.length * cut)));
        if (!upTo.length) continue;
        const answer = upTo[upTo.length - 1]!.answer;
        const a = gradeAnswer(now, answer, 0);
        if (a.isCorrect) continue;
        all++;
        const b = gradeAnswer(asStd, answer, 0);
        if (a.score === b.score) same++;
        else ok(false, `${type} ${seed} ${level} ${cut}: unfinished ${a.score} now, ${b.score} on the standard's grader`);
      }
    }
    for (const sp of spamBatch(type, now, seed)) {
      const a = gradeAnswer(now, sp.answer, 0);
      if (a.isCorrect) continue;
      all++;
      if (a.score === gradeAnswer(asStd, sp.answer, 0).score) same++;
      else ok(false, `${type} ${seed} ${sp.label}: unfinished random play differs from the standard's grader`);
    }
  }
  ok(all > 20 && same === all, `${type}: ${same} of ${all} unfinished answers score as the standard scores them`);
}

/* 6. Bands, before → after */
type Row = Record<BatchLevel | "random", number[]>;
const emptyRow = (): Row => ({ random: [], weak: [], average: [], good: [], great: [], near: [], flawless: [] });
const report: string[] = [];
for (const type of BATCH_TYPES) {
  const before = emptyRow();
  const after = emptyRow();
  for (const seed of SEEDS) {
    for (const [row, deal] of [
      [before, () => pinned(() => dealBatch(type, seed))],
      [after, () => dealBatch(type, seed)],
    ] as const) {
      const p = deal();
      for (const level of BATCH_LEVELS) {
        const play = playBatch(type, p, level, seed);
        row[level].push(gradeSteps(p, play.steps, play.timed).score);
      }
      for (const sp of spamBatch(type, p, seed)) {
        const g = gradeAnswer(p, sp.answer, sp.msLeft);
        row.random.push(g.score);
        const parts = (g.extra as { parts?: { kind?: string; efficiency?: number } } | undefined)?.parts;
        // The blind depth-first walk is not guessing: in a perfect maze it is a systematic search, and a lucky one
        // walks under twice the route; it still scores no more than before (below).
        if (row === after && g.isCorrect && !sp.label.startsWith("blind-dfs")) ok((parts?.efficiency ?? 0) === 0, `${type} ${seed} ${sp.label}: a random finish earns no par points (${parts?.efficiency})`);
      }
    }
  }
  const cols: (BatchLevel | "random")[] = ["random", ...BATCH_LEVELS];
  report.push(`${type.padEnd(9)} ${cols.map((c) => c.padStart(8)).join("")}`);
  report.push(`  before  ${cols.map((c) => String(median(before[c])).padStart(8)).join("")}`);
  report.push(`  after   ${cols.map((c) => String(median(after[c])).padStart(8)).join("")}`);
  for (let i = 1; i < BATCH_LEVELS.length; i++) {
    ok(median(after[BATCH_LEVELS[i]!]) >= median(after[BATCH_LEVELS[i - 1]!]), `${type}: the ${BATCH_LEVELS[i]} median is no lower than ${BATCH_LEVELS[i - 1]}'s after the batch`);
  }
  ok(median(after.flawless) === 200, `${type}: flawless kit play's median is 200 after the batch (${median(after.flawless)})`);
  const weak = median(after.weak);
  ok(median(after.random) < weak, `${type}: random play's median ${median(after.random)} is under the weak median ${weak}`);
  ok(median(after.random) <= median(before.random) && Math.max(...after.random) <= Math.max(...before.random), `${type}: random play scores no more than before (median ${median(before.random)} → ${median(after.random)}, max ${Math.max(...before.random)} → ${Math.max(...after.random)})`);
}
console.log("Medians weak → flawless (random play = guessing), before → after:");
for (const line of report) console.log(line);

/* 7. Texts */
{
  const texts = (type: BatchType) => `${PUZZLE_INSTRUCTIONS[type].score} ${PUZZLE_INSTRUCTIONS[type].how.map((h) => `${h.action} ${h.detail}`).join(" ")}`;
  for (const type of BATCH_TYPES) {
    const t = texts(type);
    ok(!/\bstars?\b|\bgems?\b/i.test(t), `${type}: the help names no stars or gems`);
    ok(/par/i.test(t), `${type}: the help states the par bonus`);
    const intro = INTRO_SCORE[type];
    ok(intro.length <= 90 && !/\bstars?\b|\bgems?\b/i.test(intro), `${type}: intro line "${intro}" (${intro.length} characters)`);
  }
  pinned(() => {
    ok(/star/i.test(texts("maze")) && /gem/i.test(texts("iceslide")) && /star/i.test(texts("gravity")), "pinned: the help states the standard stamps' collectibles");
  });
}

console.log(`${passes} passed, ${fails} failed`);
if (fails) {
  console.log("FAIL puzzle-batch-nov-check");
  process.exit(1);
}
console.log("PASS puzzle-batch-nov-check");
