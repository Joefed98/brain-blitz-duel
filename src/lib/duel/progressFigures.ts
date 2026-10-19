/**
 * Progress toward the solution, as the graders count it (19 Oct 2026, display only; no game's
 * scoring changes).
 *
 * Since `puzzleScoreRev 1` (and so on rev 2, the score bands) an unfinished Chroma Lines, Shikaku,
 * Lamplighter, Tessellate, Jumbled, Swapword or Slider round earns credit only for progress toward
 * the solution: pairs joined along their route, cells in the solution's rectangles, bulbs where the
 * solution has them, pieces in their solution spot, tiles the player put in place, rows the player
 * made into words. The round leaderboard and the reveal still showed the raw figure (squares filled,
 * cells covered, cells lit, tiles in place counting the ones that started there), so a player could
 * read "40 / 49 squares filled" beside a score that counted none of it. The counts here are the
 * graders' own (grade.ts calls these very functions), and `solutionProgress` turns them into the
 * one-line figure shown instead. Older rounds (before puzzleScoreRev 1) keep the raw figure, which
 * was their credit then.
 *
 * Every function is shared (phone and server): the decoders and replays it uses are the graders'.
 */
import { decodePlacements, verifyPlacements } from "./blockParty";
import { decodeFlowPaths, verifyFlow } from "./flow";
import { acceptedRects, decodeShikaku } from "./shikaku";
import { decodeBulbs } from "./lightUp";
import { decodeTileMoves, replayTiles, tilesLayout } from "./tiles";
import { decodeSwapword, replaySwapword, swapwordPlaced } from "./swapword";
import { decodeSlideTokens, markedRowWord, replayWordSlide, WS_MARKED_ROWS } from "./wordSlide";
import { PUZZLE_SCORE_REV, puzzleScoreRevOf } from "./puzzleScoreRev";
import { FLOW_PAIRS, type BlockPlacement, type PuzzleData } from "./types";

type Rect = { r0: number; c0: number; r1: number; c1: number };
const cellsKey = (cells: readonly number[]) => [...cells].sort((a, b) => a - b).join(",");
const rectKey = (r: Rect) => `${r.r0},${r.c0},${r.r1},${r.c1}`;
const rectArea = (r: Rect) => (r.r1 - r.r0 + 1) * (r.c1 - r.c0 + 1);

/** Chroma Lines: pairs joined along their solution route, and all pairs joined. */
export function flowRouteCounts(
  solution: readonly (readonly number[])[] | undefined,
  paths: readonly (readonly number[] | undefined)[],
  joined: readonly boolean[],
): { onRoute: number; joined: number } {
  const onRoute = joined.filter((ok, i) => ok && solution?.[i] && cellsKey(paths[i] ?? []) === cellsKey(solution[i]!)).length;
  return { onRoute, joined: joined.filter(Boolean).length };
}

/** Shikaku: area of accepted rectangles on the solution, and of the other accepted rectangles. */
export function shikakuAreas(solution: readonly Rect[], accepted: readonly Rect[]): { right: number; wrong: number } {
  const sol = new Set(solution.map(rectKey));
  let right = 0;
  let wrong = 0;
  for (const r of accepted) {
    if (sol.has(rectKey(r))) right += rectArea(r);
    else wrong += rectArea(r);
  }
  return { right, wrong };
}

/** Lamplighter: bulbs where the solution has one, and the other bulbs. */
export function lightUpBulbCounts(solution: readonly number[], bulbs: readonly number[]): { right: number; other: number } {
  const sol = new Set(solution);
  const right = bulbs.filter((b) => sol.has(b)).length;
  return { right, other: bulbs.length - right };
}

/** Tessellate: legal pieces in their solution spot, and all legal pieces. */
export function blockPartyCounts(
  solution: readonly { cells: readonly number[] }[],
  legal: readonly BlockPlacement[],
): { inSpot: number; legal: number } {
  const spots = new Set(solution.map((p) => cellsKey(p.cells)));
  return { inSpot: legal.filter((p) => spots.has(cellsKey(p.cells))).length, legal: legal.length };
}

/** Jumbled: tiles the player put in place (less those moved out), out of the tiles that started out of place. */
export function tilesCounts(
  start: readonly number[],
  end: readonly number[],
  goal: readonly number[],
): { startIn: number; displaced: number; placed: number } {
  const startIn = start.filter((v, i) => v !== 0 && v === goal[i]).length;
  const displaced = start.filter((v, i) => v !== 0 && v === goal[i] && end[i] !== v).length;
  const placed = end.filter((v, i) => v !== 0 && v === goal[i] && start[i] !== v).length - displaced;
  return { startIn, displaced, placed };
}

/** Swapword: tiles to place, tiles placed and tiles that started right but were moved out. */
export function swapwordCounts(
  start: string,
  board: string,
  solution: string,
): { toPlace: number; placed: number; displaced: number } {
  return {
    toPlace: [...start].filter((ch, t) => ch !== solution[t]).length,
    placed: swapwordPlaced(start, board, solution),
    displaced: [...start].filter((ch, t) => ch === solution[t] && board[t] !== solution[t]).length,
  };
}

/** Slider: the marked rows the player changed into words (validRows: the grader's stored word rows). */
export function wordSlideMadeRows(startGrid: string[], endGrid: string[], validRows: readonly number[]): number {
  return WS_MARKED_ROWS.filter((r) => validRows.includes(r) && markedRowWord(endGrid, r) !== markedRowWord(startGrid, r)).length;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export interface ProgressFigure {
  /** The figure (e.g. "18/81 cells right"), short enough for one line on the leaderboard. */
  text: string;
  /** What counts against it, when anything does (e.g. "6 cells in other rectangles"). */
  cost: string | null;
}

/**
 * An unfinished round's progress toward the solution, as its credit counts it; null when the game
 * has no such figure or the round predates puzzleScoreRev 1 (show the raw figure then).
 */
export function solutionProgress(puzzle: PuzzleData, answer: string, extra?: Record<string, unknown> | null): ProgressFigure | null {
  if (puzzleScoreRevOf(puzzle) < PUZZLE_SCORE_REV) return null;
  switch (puzzle.type) {
    case "flow": {
      if (!puzzle.solution?.length) return null;
      const paths = decodeFlowPaths(answer, puzzle.pairs.length || FLOW_PAIRS);
      const verdict = verifyFlow(puzzle.pairs, paths, puzzle.walls ?? []);
      const { onRoute, joined } = flowRouteCounts(puzzle.solution, paths, verdict.joined);
      const off = joined - onRoute;
      return { text: `${onRoute}/${puzzle.pairs.length} pairs on route`, cost: off > 0 ? `${plural(off, "pair")} joined off route` : null };
    }
    case "shikaku": {
      if (!puzzle.solution?.length) return null;
      const accepted = acceptedRects(decodeShikaku(answer, puzzle.size), puzzle.clues, puzzle.size);
      const { right, wrong } = shikakuAreas(puzzle.solution, accepted);
      return { text: `${right}/${puzzle.size * puzzle.size} cells right`, cost: wrong > 0 ? `${plural(wrong, "cell")} in other rectangles` : null };
    }
    case "lightup": {
      if (!puzzle.solution?.length) return null;
      const { right, other } = lightUpBulbCounts(puzzle.solution, decodeBulbs(answer, puzzle));
      return { text: `${right}/${puzzle.solution.length} bulbs right`, cost: other > 0 ? `${plural(other, "other bulb")}` : null };
    }
    case "blockparty": {
      if (!puzzle.solution?.length) return null;
      const legal = verifyPlacements(puzzle.blockers, decodePlacements(answer)).legal;
      const { inSpot, legal: placed } = blockPartyCounts(puzzle.solution, legal);
      const off = placed - inSpot;
      return { text: `${inSpot}/${puzzle.solution.length} pieces in place`, cost: off > 0 ? `${plural(off, "piece")} elsewhere` : null };
    }
    case "tiles": {
      const layout = tilesLayout(puzzle);
      const end = replayTiles(puzzle.frame, decodeTileMoves(answer, layout.count), layout).frame;
      const { startIn, displaced, placed } = tilesCounts(puzzle.frame, end, layout.goal);
      return { text: `${Math.max(0, placed)}/${layout.count - startIn} tiles placed`, cost: displaced > 0 ? `${displaced} moved out of place` : null };
    }
    case "swapword": {
      const solution = puzzle.solution ?? "";
      if (!solution) return null;
      const run = replaySwapword(puzzle.start, decodeSwapword(answer), puzzle.maxSwaps, solution);
      const { toPlace, placed, displaced } = swapwordCounts(puzzle.start, run.board, solution);
      return { text: `${Math.max(0, placed - displaced)}/${toPlace} tiles placed`, cost: displaced > 0 ? `${displaced} moved out of place` : null };
    }
    case "wordslide": {
      const validRows = extra?.["validRows"];
      if (!Array.isArray(validRows)) return null;
      const end = replayWordSlide(puzzle.grid, decodeSlideTokens(answer)).grid;
      const made = wordSlideMadeRows(puzzle.grid, end, validRows as number[]);
      return { text: `${made}/${WS_MARKED_ROWS.length} rows made`, cost: null };
    }
    default:
      return null;
  }
}
