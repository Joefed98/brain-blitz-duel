/**
 * Puzzle score bands (puzzleScoreRev 2, 19 Oct 2026; docs/scoring-targets.md): fits each puzzle's
 * knots from the simulated players and reports before → after.
 *
 * The puzzle-fairness kits (scripts/puzzle-fairness/) play seeded room puzzles at four levels; each run
 * is graded by the server's own gradeAnswer under the rev-1 shape, and its result (0–200,
 * src/lib/duel/puzzleScoreRev2.ts rev2ResultOf) is read from that grade. A game's knots run from
 * (0, 0) through the level medians (average 70, good 100, great 120, near-perfect 140) to 150 at
 * the best near-perfect run, with guard rails (below). Then a second, separate set of seeds is graded
 * under the real rev-2 stamp for the table.
 *
 *   bun scripts/puzzle-bands-fit.ts                       # fit every rev-2 game, print the knots + table
 *   bun scripts/puzzle-bands-fit.ts --write               # also rewrite src/lib/duel/puzzleBands.data.ts
 *   bun scripts/puzzle-bands-fit.ts --report-only --md=out.md --json=out.json [games…]
 *
 * Guard rails on a fit: the knots rise strictly; at most 1.6 points per result step below the
 * average median (so a sliver of random progress stays low: careless-play-check, puzzle-fairness
 * rule b); half progress (result 49.5) at least 30 points; 150 only at or past the best
 * near-perfect run. Script-only: floats are fine.
 */
import { writeFileSync } from "node:fs";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { rev2KnotsKey, rev2ResultOf, REV2_FINISH_GAMES, REV2_OPEN_GAMES, PUZZLE_SCORE_REV_BANDS, type Rev2Knots } from "../src/lib/duel/puzzleScoreRev2";
import { storedScoreParts } from "../src/lib/duel/puzzleScoreRev";
import { LEVELS, SKILLS, hashText, makeRng, type Level } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle } from "./puzzle-fairness/run";
import { KNOWN_SPAM } from "./puzzle-fairness";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const FIT_SEEDS = Number(opt("seeds") ?? 40);
const TEST_SEEDS = Number(opt("test-seeds") ?? 30);
const WRITE = args.includes("--write");
const REPORT_ONLY = args.includes("--report-only");
const MD = opt("md");
const JSON_PATH = opt("json");
const ONLY = args.filter((a) => !a.startsWith("--"));

export const TARGET: Record<Level, number> = { average: 70, good: 100, great: 120, near: 140 };
/** Most points per result step below the average median (10 % progress at most 50 points). */
export const MAX_LOW_SLOPE = 5;
/** Random or spam input (its 90th percentile result) scores at most this (puzzle-fairness rule b, careless-play-check). */
export const SPAM_CAP = 10;

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
};
const pct = (xs: number[], p: number) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
};
const r1 = (x: number) => Math.round(x * 10) / 10;

function withRev(puzzle: PuzzleData, rev: number): PuzzleData {
  return { ...(puzzle as object), puzzleScoreRev: rev } as unknown as PuzzleData;
}

interface Run { score: number; result: number; finished: boolean }

/** One graded answer: the score under the puzzle's stamp and its rev-2 result read from the rev-1 grade. */
function gradeBoth(puzzle: PuzzleData, answer: string, ms: number): Run {
  const g = gradeAnswer(puzzle, answer, ms);
  // Rev-2 puzzles store their result; a rev-1 grade (the "before" table) works it out from its breakdown.
  const stored = g.extra?.["result"];
  const result = typeof stored === "number" ? stored
    : rev2ResultOf(puzzle.type, g.score, storedScoreParts(g.extra), g.isCorrect ? g.storedMs : 0, puzzleTimeLimitMs(puzzle)).result;
  return { score: g.score, result, finished: g.isCorrect };
}

/** The kit's play at one level: the answer that counts and the time it was sent, as scripts/puzzle-fairness/run.ts grades it. */
function playAt(type: PuzzleType, puzzle: PuzzleData, seed: number, level: Level): { answer: string; ms: number } {
  const kit = KITS[type]!;
  const limit = puzzleTimeLimitMs(puzzle);
  const rng = makeRng(hashText(`${kit.type}:play:${seed}:${level}`));
  const play = kit.play(puzzle, rng, SKILLS[level], limit);
  const inTime = play.steps.filter((s) => s.atMs <= limit);
  if (!inTime.length) return { answer: kit.nothing(puzzle), ms: 0 };
  if (play.timed) {
    const last = inTime[inTime.length - 1]!;
    const ms = Math.max(0, limit - last.atMs);
    return gradeAnswer(puzzle, last.answer, ms).isCorrect ? { answer: last.answer, ms } : { answer: last.answer, ms: 0 };
  }
  for (const step of inTime) {
    const ms = Math.max(0, limit - step.atMs);
    if (gradeAnswer(puzzle, step.answer, ms).isCorrect) return { answer: step.answer, ms };
  }
  return { answer: inTime[inTime.length - 1]!.answer, ms: 0 };
}

export interface GameRuns {
  levels: Record<Level, Run[]>;
  spam: Record<string, Run[]>;
  nothing: Run[];
}

export function gameRuns(type: PuzzleType, seeds: number[], stampRev: number): GameRuns {
  const kit = KITS[type]!;
  const out: GameRuns = { levels: { average: [], good: [], great: [], near: [] }, spam: {}, nothing: [] };
  for (const seed of seeds) {
    const puzzle = withRev(roomPuzzle(type, seed), stampRev);
    const limit = puzzleTimeLimitMs(puzzle);
    out.nothing.push(gradeBoth(puzzle, kit.nothing(puzzle), 0), gradeBoth(puzzle, kit.nothing(puzzle), limit));
    const rng = makeRng(hashText(`${kit.type}:spam:${seed}`));
    for (const s of kit.spam(puzzle, rng, limit)) (out.spam[s.label] ??= []).push(gradeBoth(puzzle, s.answer, 0));
    for (const level of LEVELS) {
      const { answer, ms } = playAt(type, puzzle, seed, level);
      out.levels[level].push(gradeBoth(puzzle, answer, ms));
    }
  }
  return out;
}

/** Knots through the level medians, with the guard rails above. */
export function fitKnots(runs: GameRuns, open: boolean, known?: Record<string, string>): Rev2Knots {
  const top = open ? 150 : 200;
  const meds = LEVELS.map((l) => ({ l, x: median(runs.levels[l].map((r) => r.result)), y: TARGET[l] }));
  const knots: [number, number][] = [[0, 0]];
  for (const m of meds) {
    if (!Number.isFinite(m.x) || m.x <= 0) continue;
    const prev = knots[knots.length - 1]!;
    // Too close to the previous median to tell the levels apart: keep the lower knot, skip this one.
    if (m.x <= prev[0] + 0.5) continue;
    let y = m.y;
    // Low slope guard below (and at) the average median.
    if (prev[0] === 0) y = Math.min(y, MAX_LOW_SLOPE * m.x);
    if (y <= prev[1]) continue;
    knots.push([r1(m.x), y]);
  }
  // 150 at or past the best near-perfect run (never before the last knot), else at the top.
  const nearBest = Math.max(...runs.levels.near.map((r) => r.result), 0);
  const last = knots[knots.length - 1]!;
  let x150 = Math.min(top, Math.max(nearBest, last[0] + 2));
  if (last[1] >= 150) knots.pop();
  if (x150 <= knots[knots.length - 1]![0]) x150 = Math.min(top, knots[knots.length - 1]![0] + 2);
  knots.push([r1(x150), 150]);
  // Half progress at least 30 (finish games: result 49.5 is half the unfinished range).
  if (!open) {
    const half = 49.5;
    const at = interp(knots, half);
    if (at < 30) {
      const i = knots.findIndex(([x]) => x > half);
      knots.splice(i, 0, [half, Math.min(30, knots[i]![1] - 1)]);
    }
  }
  // Spam guard: the 90th percentile of every spam strategy's results (and doing nothing) scores at most SPAM_CAP.
  const spamResults = [...Object.entries(runs.spam).filter(([label]) => !known?.[label]?.includes("weak but real")).flatMap(([, rs]) => rs), ...runs.nothing].map((r) => r.result);
  const spamP90 = pct(spamResults, 0.9);
  if (spamP90 > 0 && interp(knots, spamP90) > SPAM_CAP) {
    // Random input reaches past knots: those knots are dropped (the level is reported low), the spam point pinned.
    const keep = knots.filter(([x, y], i) => i === 0 || (x > spamP90 && y > SPAM_CAP));
    knots.length = 0;
    knots.push(keep[0]!, [r1(spamP90), SPAM_CAP], ...keep.slice(1));
  }
  return knots;
}

function interp(knots: Rev2Knots, x: number): number {
  for (let i = 1; i < knots.length; i++) {
    const [x1, y1] = knots[i]!;
    if (x > x1) continue;
    const [x0, y0] = knots[i - 1]!;
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return knots[knots.length - 1]![1];
}

export const REV2_GAMES: PuzzleType[] = [...REV2_FINISH_GAMES, ...REV2_OPEN_GAMES];

export interface GameReport {
  type: PuzzleType;
  name: string;
  before: Record<Level, number>;
  after: Record<Level, number>;
  solved: Record<Level, number>;
  spamMedian: number;
  spamMax: number;
  nothingMax: number;
  knots: Rev2Knots;
}

if (import.meta.main) {
  const games = REV2_GAMES.filter((t) => KITS[t] && (ONLY.length === 0 || ONLY.includes(t)));
  const fitted: Record<string, Rev2Knots> = {};
  if (!REPORT_ONLY) {
    const fitSeeds = Array.from({ length: FIT_SEEDS }, (_, i) => 5001 + i);
    for (const type of games) {
      const runs = gameRuns(type, fitSeeds, PUZZLE_SCORE_REV_BANDS);
      // A game with a stamped progress measure (Topsy-Turvy gravityRev 2, Polypotions tubesRev 2) fits its own row.
      const key = rev2KnotsKey(roomPuzzle(type, fitSeeds[0]!));
      fitted[key] = fitKnots(runs, REV2_OPEN_GAMES.has(type), KNOWN_SPAM[type]);
      const sp = [...Object.values(runs.spam).flat(), ...runs.nothing].map((r) => r.result);
      const meds = LEVELS.map((l) => `${l} ${r1(median(runs.levels[l].map((r) => r.result)))}`).join(", ") + ` | spam p90 ${r1(pct(sp, 0.9))} max ${r1(Math.max(0, ...sp))}`;
      console.error(`${key}: results ${meds} → ${JSON.stringify(fitted[key])}`);
    }
    if (WRITE) {
      const { PUZZLE_REV2_KNOTS: old } = await import("../src/lib/duel/puzzleBands.data");
      const merged = { ...old, ...fitted };
      const body = Object.keys(merged).sort().map((k) => `  ${/^[a-z]+$/.test(k) ? k : JSON.stringify(k)}: ${JSON.stringify(merged[k])},`).join("\n");
      writeFileSync(
        new URL("../src/lib/duel/puzzleBands.data.ts", import.meta.url),
        `/**\n * puzzleScoreRev 2 knots per game: [result, points] (src/lib/duel/puzzleScoreRev2.ts).\n * Generated by \`bun scripts/puzzle-bands-fit.ts --write\` from the puzzle-fairness kits; do not edit by hand.\n */\nexport const PUZZLE_REV2_KNOTS: Record<string, readonly (readonly [number, number])[]> = {\n${body}\n};\n`,
      );
      console.error("wrote src/lib/duel/puzzleBands.data.ts (re-run with --report-only for the table on the written knots)");
      process.exit(0);
    }
  }
  // Report: separate seeds, before = rev 1, after = the real rev-2 stamp.
  const testSeeds = Array.from({ length: TEST_SEEDS }, (_, i) => 7001 + i);
  const reports: GameReport[] = [];
  const { rev2KnotsFor } = await import("../src/lib/duel/puzzleScoreRev2");
  for (const type of games) {
    const before = gameRuns(type, testSeeds, 1);
    const after = gameRuns(type, testSeeds, PUZZLE_SCORE_REV_BANDS);
    const spamScores = Object.values(after.spam).flat().map((r) => r.score);
    const rep: GameReport = {
      type, name: gameDisplayName(type),
      before: Object.fromEntries(LEVELS.map((l) => [l, median(before.levels[l].map((r) => r.score))])) as Record<Level, number>,
      after: Object.fromEntries(LEVELS.map((l) => [l, median(after.levels[l].map((r) => r.score))])) as Record<Level, number>,
      solved: Object.fromEntries(LEVELS.map((l) => [l, after.levels[l].filter((r) => r.finished).length])) as Record<Level, number>,
      spamMedian: median(spamScores), spamMax: Math.max(0, ...spamScores),
      nothingMax: Math.max(0, ...after.nothing.map((r) => r.score)),
      knots: rev2KnotsFor(type),
    };
    reports.push(rep);
    console.log(`${rep.name.padEnd(22)} ${LEVELS.map((l) => `${rep.before[l]}→${rep.after[l]}`.padEnd(9)).join(" ")} solved ${LEVELS.map((l) => rep.solved[l]).join("/")}/${TEST_SEEDS}  spam med ${rep.spamMedian} max ${rep.spamMax}  nothing ${rep.nothingMax}`);
  }
  if (MD) {
    const head = "| Game | Average before → after | Good | Great | Near-perfect | Finished (of " + TEST_SEEDS + ") | Spam median / max |\n|---|---|---|---|---|---|---|";
    const rows = reports.map((r) => `| ${r.name} | ${LEVELS.map((l) => `${r.before[l]} → ${r.after[l]}`).join(" | ")} | ${LEVELS.map((l) => r.solved[l]).join(" / ")} | ${r.spamMedian} / ${r.spamMax} |`);
    writeFileSync(MD, [head, ...rows].join("\n") + "\n");
  }
  if (JSON_PATH) writeFileSync(JSON_PATH, JSON.stringify(reports, null, 1));
}
