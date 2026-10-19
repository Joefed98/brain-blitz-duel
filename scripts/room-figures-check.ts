/**
 * room-figures-check (19 Oct 2026, display only): the round leaderboard and the reveal show the
 * score bands' (#115) figures, not leftover older formulas or raw progress.
 *
 *  1. Progress toward the solution (src/lib/duel/progressFigures.ts) for Chroma Lines, Shikaku,
 *     Lamplighter, Tessellate, Jumbled, Swapword and Slider: every unfinished round graded on today's
 *     stamps (puzzleScoreRev 2, random and half-solved play) shows the progress its credit counts
 *     ("18/81 cells right"), never the raw figure ("filled", "covered", "lit", "in place"), on one
 *     short line (≤ 24 characters, so the leaderboard row never cuts it); the reveal line reads the
 *     same function. The figure agrees with the score: nothing toward the solution and nothing against it
 *     scores 0; progress with nothing against it scores above 0; more progress never scores less on
 *     the same board. Rounds before puzzleScoreRev 1 keep their raw figure.
 *  2. Pull! clayRev 7 and Hats/Bonk whackRev 1–2 (the run's total goes through a curve): bird,
 *     empty-shot and penalty figures are labelled as the total's, never as points off the score;
 *     older revisions keep their lines. Letterfall wordfallRev 3: "short of 150" counts to the
 *     points that score 150, not to par.
 *
 *   bun scripts/room-figures-check.ts
 */
import { buildArcadeReveal } from "../src/lib/arcade/reveal";
import { storedCostRows } from "../src/components/duel/ArcadeReveal";
import { WORDFALL_BANDS_FULL_POINTS, WORDFALL_BANDS_MAP } from "../src/lib/arcade/wordfall";
import { bandMapTotal } from "../src/lib/arcade/scoreBands";
import { gradeAnswer, generatePuzzle } from "../src/lib/duel/generate.server";
import { nearMiss } from "../src/lib/duel/nearMiss";
import { solutionProgress } from "../src/lib/duel/progressFigures";
import { encodeFlowPaths } from "../src/lib/duel/flow";
import { encodeShikaku } from "../src/lib/duel/shikaku";
import { encodeBulbs } from "../src/lib/duel/lightUp";
import { encodePlacements } from "../src/lib/duel/blockParty";
import { encodeTileMoves, tilesLayout } from "../src/lib/duel/tiles";
import { encodeSwapword } from "../src/lib/duel/swapword";
import { puzzleScoreRevOf } from "../src/lib/duel/puzzleScoreRev";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleDef } from "../src/lib/duel/registry";
import type { PuzzleData, PuzzleType, RoundResultRow } from "../src/lib/duel/types";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else if (failures.length < 60) failures.push(message);
}

let state = 12345;
const rand = () => {
  state = (state * 1103515245 + 12345) & 0x7fffffff;
  return state / 0x80000000;
};
const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)]!;
const subset = <T>(items: readonly T[], share: number) => items.filter(() => rand() < share);

const row = (extra: Partial<RoundResultRow> = {}): RoundResultRow =>
  ({
    id: "r", duel_id: "room", player_slot: 1, round_number: 1, answer: "", is_correct: false, ms_remaining: 0,
    reaction_avg_ms: null, correct_count: null, errors: null, extra: null, score: 0, submitted_at: "2026-10-19T12:00:00Z",
    ...extra,
  }) as RoundResultRow;
const gradedRow = (puzzle: PuzzleData, answer: string): RoundResultRow => {
  const g = gradeAnswer(puzzle, answer, 0);
  return row({ answer: g.answer || null, is_correct: g.isCorrect, score: g.score, extra: g.extra as RoundResultRow["extra"] });
};
const summary = (puzzle: PuzzleData, r: RoundResultRow) => puzzleDef(puzzle.type).roundSummary(r, puzzle);

/** Answers for one board: a ladder of growing progress toward the solution, then random play. */
function answersFor(puzzle: PuzzleData): { ladder: string[]; random: string[] } {
  const share = [0, 0.25, 0.5, 0.75];
  switch (puzzle.type) {
    case "flow": {
      const sol = puzzle.solution ?? [];
      const ladder = share.map((s) => encodeFlowPaths(sol.map((p, i) => (i < Math.floor(sol.length * s) ? [...p] : []))));
      const random = Array.from({ length: 6 }, () => encodeFlowPaths(sol.map((p) => (rand() < 0.5 ? [...p] : rand() < 0.3 ? [p[0]!, p[p.length - 1]!] : []))));
      return { ladder, random };
    }
    case "shikaku": {
      const sol = puzzle.solution ?? [];
      return {
        ladder: share.map((s) => encodeShikaku(sol.slice(0, Math.floor(sol.length * s)))),
        random: Array.from({ length: 6 }, () => encodeShikaku(subset(sol, 0.5).concat(rand() < 0.5 ? [{ r0: 0, c0: 0, r1: 1, c1: 1 }] : []))),
      };
    }
    case "lightup": {
      const sol = puzzle.solution ?? [];
      const cells = puzzle.size * puzzle.size;
      return {
        ladder: share.map((s) => encodeBulbs(sol.slice(0, Math.floor(sol.length * s)))),
        random: Array.from({ length: 6 }, () => encodeBulbs([...new Set(subset(sol, 0.5).concat(Array.from({ length: 2 }, () => Math.floor(rand() * cells))))])),
      };
    }
    case "blockparty": {
      const sol = puzzle.solution ?? [];
      return {
        ladder: share.map((s) => encodePlacements(sol.slice(0, Math.floor(sol.length * s)))),
        random: Array.from({ length: 6 }, () => encodePlacements(subset(sol, 0.5))),
      };
    }
    case "tiles": {
      const count = tilesLayout(puzzle).count;
      return { ladder: [""], random: Array.from({ length: 10 }, () => encodeTileMoves(Array.from({ length: 4 + Math.floor(rand() * 20) }, () => 1 + Math.floor(rand() * count)))) };
    }
    case "swapword": {
      const tiles = puzzle.start.length;
      const sol = puzzle.solution ?? "";
      // Greedy: each swap brings the right letter into one wrong cell.
      const board = [...puzzle.start];
      const swaps: [number, number][] = [];
      for (let t = 0; t < tiles; t++) {
        if (board[t] === sol[t]) continue;
        const from = board.findIndex((ch, u) => u > t && ch === sol[t] && board[u] !== sol[u]);
        if (from < 0) continue;
        [board[t], board[from]] = [board[from]!, board[t]!];
        swaps.push([t, from]);
      }
      const ladder = share.map((s) => encodeSwapword(swaps.slice(0, Math.floor(swaps.length * s))));
      const random = Array.from({ length: 6 }, () => encodeSwapword(Array.from({ length: 3 }, () => [Math.floor(rand() * tiles), Math.floor(rand() * tiles)] as [number, number]).filter(([a, b]) => a !== b)));
      return { ladder, random };
    }
    case "wordslide":
      return { ladder: [""], random: Array.from({ length: 10 }, () => Array.from({ length: 3 + Math.floor(rand() * 12) }, () => `${pick(["r", "c"])}${Math.floor(rand() * 5)}${pick(["+", "-"])}`).join(",")) };
    default:
      return { ladder: [], random: [] };
  }
}

const RAW = /filled|covered|\blit\b|^\d+ \/ \d+ in place|^\d+ \/ 5 rows$/;
const GAMES: PuzzleType[] = ["flow", "shikaku", "lightup", "blockparty", "tiles", "swapword", "wordslide"];
for (const type of GAMES) {
  let shown = 0;
  for (const seed of [2, 9, 17, 23]) {
    const puzzle = withSeededRandom(seed, () => generatePuzzle(type)) as PuzzleData;
    check(puzzleScoreRevOf(puzzle) >= 2, `${type}: not dealt on puzzleScoreRev 2`);
    const { ladder, random } = answersFor(puzzle);
    let lastScore = -1;
    for (const [i, answer] of [...ladder, ...random].entries()) {
      const r = gradedRow(puzzle, answer);
      if (r.is_correct) continue;
      const s = summary(puzzle, r);
      const figure = solutionProgress(puzzle, answer, r.extra);
      check(figure !== null, `${type} seed ${seed}: no progress figure for "${answer.slice(0, 40)}"`);
      if (!figure) continue;
      shown++;
      check(s.summary === figure.text, `${type}: leaderboard shows "${s.summary}", not the progress "${figure.text}"`);
      check(!RAW.test(s.summary), `${type}: raw figure on the leaderboard: "${s.summary}"`);
      check(s.summary.length <= 24, `${type}: "${s.summary}" too long for one line`);
      const [made] = figure.text.split("/").map(Number);
      if (made === 0 && figure.cost === null) check(r.score === 0, `${type}: nothing toward the solution scored ${r.score} ("${figure.text}")`);
      if (made! > 0 && figure.cost === null) check(r.score > 0, `${type}: "${figure.text}" scored 0`);
      if (i < ladder.length) {
        check(r.score >= lastScore, `${type} seed ${seed}: more progress ("${figure.text}") scored ${r.score} < ${lastScore}`);
        lastScore = r.score;
      }
    }
    // Rounds before puzzleScoreRev 1 keep their raw figure.
    const legacy = { ...puzzle } as PuzzleData & { puzzleScoreRev?: number };
    delete legacy.puzzleScoreRev;
    check(solutionProgress(legacy, ladder[1] ?? random[0] ?? "", { validRows: [] }) === null, `${type}: a pre-rev-1 round lost its raw figure`);
  }
  check(shown >= 8, `${type}: only ${shown} unfinished rounds shown`);
}

/* ------------------------------------------------------------ 2. curves: Pull!, Hats/Bonk, Letterfall */
{
  const clay = (clayRev: number) => summary({ type: "clayshoot", seed: 1, clayRev } as unknown as PuzzleData, row({ score: 122, extra: { hits: 25, total: 25, birdHits: 1, birdTotal: 14, shots: 30, emptyShots: 4, emptyShotCost: 4 } })).detail[0] ?? "";
  check(/hit \(−10 from the total\)/.test(clay(7)) && /\(−4 from the total\)/.test(clay(7)), `clayRev 7 shows raw costs as points: "${clay(7)}"`);
  check(/hit \(−10\)/.test(clay(6)) && /\(−4\)/.test(clay(6)), `clayRev 6 lost its lines: "${clay(6)}"`);
  const rows7 = storedCostRows("clayshoot", { emptyShots: 4, emptyShotCost: 4 }, 7);
  const rows6 = storedCostRows("clayshoot", { emptyShots: 4, emptyShotCost: 4 }, 6);
  check(rows7.some((t) => t.label === "Empty-shot cost (total)") && rows6.some((t) => t.label === "Empty-shot cost"), "Pull!'s reveal cost row is not labelled by revision");

  const clayRun = (sb?: number) => ({ hits: 25, total: 25, birdHits: 1, birdTotal: 14, goldHits: 5, orangeHits: 20, shots: 30, state: sb ? { sb } : {} });
  const line7 = buildArcadeReveal("clayshoot", clayRun(1), 122)?.lines.join(" | ") ?? "";
  const line6 = buildArcadeReveal("clayshoot", clayRun(), 140)?.lines.join(" | ") ?? "";
  check(/−10 from the total/.test(line7), `clayRev 7 reveal: "${line7}"`);
  check(/hit · −10$/.test(line6.split(" | ")[1] ?? ""), `clayRev 6 reveal changed: "${line6}"`);

  const whackRun = (state: Record<string, number>) => ({ hits: 40, totalTargets: 45, wrong: 2, bombs: 1, empty: 3, state });
  for (const [label, st] of [["whackRev 1", { tgt: 1 }], ["whackRev 2", { sb: 1 }]] as const) {
    const lines = buildArcadeReveal("whack", whackRun(st), 110)?.lines ?? [];
    check(/^Total −6 wrong/.test(lines[1] ?? ""), `${label} reveal shows total costs as points: "${lines[1]}"`);
  }
  const legacy = buildArcadeReveal("whack", whackRun({}), 110)?.lines ?? [];
  check(/^−6 wrong/.test(legacy[1] ?? ""), `whack legacy reveal changed: "${legacy[1]}"`);
  check(summary({ type: "whack", seed: 1, whackRev: 2 } as unknown as PuzzleData, row({ score: 110, extra: { hits: 40, totalTargets: 45 } })).detail.length === 0, "whackRev 2 prints the old formula");

  const near = (points: number, wordfallRev?: number) => nearMiss("wordfall", { points, par: 30, ...(wordfallRev ? { wordfallRev } : {}) });
  check(bandMapTotal(WORDFALL_BANDS_MAP, WORDFALL_BANDS_FULL_POINTS) === 150, "setup: the full points do not score 150");
  check(/16 word points short of 150/.test(near(30, 3) ?? ""), `wordfallRev 3 at par: "${near(30, 3)}"`);
  check(near(WORDFALL_BANDS_FULL_POINTS, 3) === null, "wordfallRev 3 at 150 still short");
  check(/2 word points short of 150/.test(near(28, 2) ?? ""), `wordfallRev 2 changed: "${near(28, 2)}"`);
}

if (failures.length) {
  console.log(failures.map((f) => `FAIL ${f}`).join("\n"));
  console.log(`room-figures-check: FAIL (${failures.length} failed, ${passes} passed)`);
  process.exit(1);
}
console.log(`room-figures-check: PASS (${passes} checks)`);
