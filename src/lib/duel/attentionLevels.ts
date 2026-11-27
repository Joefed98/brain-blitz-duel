/**
 * The Attention games' levels (the Attention overhaul, stage 3, 15 Nov 2026): what a dealt puzzle's level means to its
 * stage and grader, read from the stored puzzle only (its `level`, absent at Normal; its board; its `timeLimitMs`).
 * The levers themselves are plain data in src/lib/levels/attentionLevels.data.ts. Shared and pure.
 *
 * Every puzzle without a level reads exactly as before: each helper gives today's figure for it. D3 (22 Nov 2026): a
 * level deal carrying `levelRev: 2` reads the D3 tables; a level deal without it reads the `*_REV1` table it was dealt on.
 */
import { NORMAL, puzzleLevel, type Level } from "@/lib/levels/levels";
import {
  BOMB_LEVELS,
  BOMB_LEVELS_REV1,
  MAZE_LEVELS,
  MAZE_LEVELS_REV1,
  PAIR_LEVELS,
  PAIR_LEVELS_REV1,
  SCAN_LEVELS,
  SCAN_LEVELS_REV1,
  SPOT_LEVELS,
  SPOT_LEVELS_REV1,
  TALLY_LEVELS,
  TALLY_LEVELS_REV1,
  type BombLevel,
  type MazeLevel,
  type PairLevel,
  type ScanLevel,
  type SpotLevel,
  type TallyLevel,
} from "@/lib/levels/attentionLevels.data";
import { PAIR_CARDS, PAIR_FLIP_BACK_MS, PAIR_PAIRS, SPOT_COLS, SPOT_DIFFERENCES, SPOT_ROWS, type BombPuzzleData, type CountUpPuzzleData, type MazePuzzleData, type PairPuzzleData, type SpotPuzzleData } from "./types";

/** D3's level tables (22 Nov 2026): stamped `levelRev: 2` on every Attention level deal from D3 on. */
export const ATTENTION_LEVEL_REV = 2;

/** The level table revision a stored puzzle was dealt on (1 for every puzzle without the stamp). */
export function attentionLevelRevOf(puzzle: unknown): number {
  const v = (puzzle as { levelRev?: unknown } | null)?.levelRev;
  return typeof v === "number" && Number.isFinite(v) ? v : 1;
}

/** True when the puzzle was dealt at a level other than Normal. */
export const leveled = (puzzle: unknown): boolean => puzzleLevel(puzzle) !== NORMAL;

/** True for a level deal on D3's tables (levelRev 2). */
export const levelRev2 = (puzzle: unknown): boolean => leveled(puzzle) && attentionLevelRevOf(puzzle) >= ATTENTION_LEVEL_REV;

/** The row a puzzle was dealt on: D3's table for a levelRev 2 deal, the first table otherwise (Normal is in both). */
function rowOf<R>(puzzle: unknown, d3: Record<Level, R>, rev1: Record<Level, R>): R {
  return (attentionLevelRevOf(puzzle) >= ATTENTION_LEVEL_REV ? d3 : rev1)[puzzleLevel(puzzle)];
}

/* ------------------------------------------------------------------ Matchmaker */

/** The puzzle's Matchmaker level row (Normal's for every puzzle without a level). */
export function pairLevel(puzzle: PairPuzzleData | null | undefined): PairLevel {
  return rowOf<PairLevel>(puzzle, PAIR_LEVELS, PAIR_LEVELS_REV1);
}

/** Pairs a board needs for a finish: a level's board holds its own count; every other board needs today's fifteen. */
export function pairsOf(puzzle: PairPuzzleData | null | undefined): number {
  return puzzle && leveled(puzzle) ? Math.floor(puzzle.cards.length / 2) : PAIR_PAIRS;
}

/** Card indices a board accepts in an answer: a level's own board, else today's thirty (every older answer reads as before). */
export function pairCardsOf(puzzle: PairPuzzleData | null | undefined): number {
  return puzzle && leveled(puzzle) ? puzzle.cards.length : PAIR_CARDS;
}

/** How long a miss stays face up. */
export function pairFlipBackMs(puzzle: PairPuzzleData | null | undefined): number {
  return puzzle && leveled(puzzle) ? pairLevel(puzzle).flipBackMs : PAIR_FLIP_BACK_MS;
}

/** The board's columns at a level (null: the board keeps today's layout). */
export function pairLevelCols(puzzle: PairPuzzleData | null | undefined): number | null {
  return puzzle && leveled(puzzle) ? pairLevel(puzzle).cols : null;
}

export type { Level };

/**
 * The share of a finish's extras a level keeps for `misses` (1 on Easy, Normal and older boards). On levelRev 2's Hard
 * and Expert `misses` are the memory misses (pairMemoryMisses); on levelRev 1 every mismatched try.
 */
export function pairExtrasShare(puzzle: PairPuzzleData | null | undefined, misses: number): number {
  if (!puzzle || !leveled(puzzle)) return 1;
  const { extrasFullAt: full, extrasZeroAt: zero } = pairLevel(puzzle);
  if (full === null || zero === null || zero <= full) return 1;
  return Math.max(0, Math.min(1, (zero - misses) / (zero - full)));
}

/** True when a level's extras count memory misses only (levelRev 2's Hard and Expert). */
export function pairCountsMemoryMisses(puzzle: PairPuzzleData | null | undefined): boolean {
  return !!puzzle && levelRev2(puzzle) && pairLevel(puzzle).memoryMisses === true;
}

/** The gold pair's window in ms: a level's own (levelRev 2's Expert), else null (the standard's). */
export function pairGoldWindowMs(puzzle: PairPuzzleData | null | undefined): number | null {
  return puzzle && levelRev2(puzzle) ? (pairLevel(puzzle).goldWindowMs ?? null) : null;
}

/**
 * Memory misses in a flip list: a mismatched try (two cards flipped that don't match) whose first card's partner had
 * already been seen face up and was still on the board, so the player could have matched it. A first look (the first
 * card's partner never seen) never counts. The flips are read exactly as replayPairs reads them (a matched card and a
 * second tap on the first card are skipped).
 */
export function pairMemoryMisses(cards: readonly { shape: string; colour: string }[], flips: readonly number[]): number {
  const same = (a: number, b: number) => !!cards[a] && !!cards[b] && cards[a]!.shape === cards[b]!.shape && cards[a]!.colour === cards[b]!.colour;
  const seen = new Set<number>();
  const matched = new Set<number>();
  let misses = 0;
  let first: number | null = null;
  for (const card of flips) {
    if (matched.has(card)) continue;
    if (first === null) {
      first = card;
      continue;
    }
    if (card === first) continue;
    const a = first;
    first = null;
    if (same(a, card)) {
      matched.add(a).add(card);
      continue;
    }
    if ([...seen].some((k) => k !== a && !matched.has(k) && same(k, a))) misses++;
    seen.add(a).add(card);
  }
  return misses;
}

/* ------------------------------------------------------------------ Labyrinth */

/** The puzzle's Labyrinth level row (Normal's for every puzzle without a level). */
export function mazeLevel(puzzle: MazePuzzleData | null | undefined): MazeLevel {
  return rowOf<MazeLevel>(puzzle, MAZE_LEVELS, MAZE_LEVELS_REV1);
}

/** Expert (levelRev 1): the exit stays hidden until the trail's head is this close (cells, along rows and columns); null: always shown. */
export function mazeExitRevealCells(puzzle: MazePuzzleData | null | undefined): number | null {
  if (!puzzle || !leveled(puzzle)) return null;
  const row = mazeLevel(puzzle);
  return row.exitHidden ? row.exitRevealCells : null;
}

/** Whether the exit is drawn with the trail's head at `head` (always, but on levelRev 1's Expert until it is within reach). */
export function mazeExitShown(puzzle: MazePuzzleData, head: number, cols: number): boolean {
  const reach = mazeExitRevealCells(puzzle);
  if (reach === null) return true;
  const d = Math.abs((head % cols) - (puzzle.exit % cols)) + Math.abs(Math.floor(head / cols) - Math.floor(puzzle.exit / cols));
  return d <= reach;
}

/* ------------------------------------------------------------------ Double Take */

export function spotLevel(puzzle: SpotPuzzleData | null | undefined): SpotLevel {
  return rowOf<SpotLevel>(puzzle, SPOT_LEVELS, SPOT_LEVELS_REV1);
}

/** A picture's grid: a level's own, else today's 8 × 6. */
export function spotGridOf(puzzle: SpotPuzzleData | null | undefined): { cols: number; rows: number } {
  if (!puzzle || !leveled(puzzle)) return { cols: SPOT_COLS, rows: SPOT_ROWS };
  const row = spotLevel(puzzle);
  return { cols: row.cols, rows: row.rows };
}

/** Differences in each picture: a level's own count, else today's six. */
export function spotPerPicture(puzzle: SpotPuzzleData | null | undefined): number {
  return puzzle && leveled(puzzle) ? spotLevel(puzzle).differences : SPOT_DIFFERENCES;
}

/** Wrong taps a picture may hold and still finish: levelRev 2's own, else null (today's limit). */
export function spotMissLimit(puzzle: SpotPuzzleData | null | undefined): number | null {
  return puzzle && levelRev2(puzzle) ? (spotLevel(puzzle).missLimit ?? null) : null;
}

/** True when the lower panel of each picture is drawn mirrored left to right (the stored flag; levelRev 2's Expert). */
export function spotMirrored(puzzle: SpotPuzzleData | null | undefined): boolean {
  return !!puzzle && (puzzle as { mirror?: unknown }).mirror === 1;
}

/* ------------------------------------------------------------------ Eagle Eye */

export function scanLevel(puzzle: unknown): ScanLevel {
  return rowOf<ScanLevel>(puzzle, SCAN_LEVELS, SCAN_LEVELS_REV1);
}

/* ------------------------------------------------------------------ Tally */

export function tallyLevel(puzzle: CountUpPuzzleData | null | undefined): TallyLevel {
  return rowOf<TallyLevel>(puzzle, TALLY_LEVELS, TALLY_LEVELS_REV1);
}

/** Trays a finish needs: a level's own count (Easy three), else today's four. */
export function tallyTrays(puzzle: CountUpPuzzleData | null | undefined): number {
  return puzzle && leveled(puzzle) ? puzzle.stages.length : 4;
}

/** Whether shapes can be tapped to mark them as counted (off on Expert; on for every other round that has marks). */
export function tallyMarks(puzzle: CountUpPuzzleData | null | undefined): boolean {
  return !puzzle || !leveled(puzzle) || tallyLevel(puzzle).marks;
}

/* ------------------------------------------------------------------ Bomb Defusal */

export function bombLevel(puzzle: BombPuzzleData | null | undefined): BombLevel {
  return rowOf<BombLevel>(puzzle, BOMB_LEVELS, BOMB_LEVELS_REV1);
}

/* ------------------------------------------------------------------ The levels in the help */

const secs = (ms: number) => `${Math.round(ms / 1000)} s`;
const grids = (g: readonly number[]) => g.map((n) => `${n}×${n}`).join(", ");

/**
 * Each game's levels in one plain help line, from the level data itself (so the help can never drift from the deal).
 * Normal is today's game; Rated play and the Daily are always Normal. Built from the first tables: the help's "Levels:"
 * lines change only with the game page's new level text (P2, the polish plan); D3's lines are ATTENTION_LEVEL_HELP_D3.
 */
export const ATTENTION_LEVEL_HELP: Readonly<Record<"symscan" | "spotdiff" | "countup" | "maze" | "bomb" | "pairmatch", string>> = {
  symscan: `Easy ${grids(SCAN_LEVELS_REV1.easy.grids)}, fewer look-alikes; Hard ${grids(SCAN_LEVELS_REV1.hard.grids)}, two targets from grid 2; Expert three ${SCAN_LEVELS_REV1.expert.grids[0]}×${SCAN_LEVELS_REV1.expert.grids[0]} grids, two targets on every grid. Every level 60 s.`,
  spotdiff: `Easy ${SPOT_LEVELS_REV1.easy.cols}×${SPOT_LEVELS_REV1.easy.rows}, ${SPOT_LEVELS_REV1.easy.differences} colour or shape changes a picture; Hard ${SPOT_LEVELS_REV1.hard.differences} a picture, subtler colours; Expert ${SPOT_LEVELS_REV1.expert.cols}×${SPOT_LEVELS_REV1.expert.rows}, ${SPOT_LEVELS_REV1.expert.differences} a picture, more turns, ${secs(SPOT_LEVELS_REV1.expert.timeLimitMs)}.`,
  countup: `Easy three smaller trays; Hard three near-miss groups and a closer comparison; Expert bigger trays, two-colour questions, no marks, ${secs(TALLY_LEVELS_REV1.expert.timeLimitMs)}.`,
  maze: `Easy ${MAZE_LEVELS_REV1.easy.cols}×${MAZE_LEVELS_REV1.easy.rows}; Hard ${MAZE_LEVELS_REV1.hard.cols}×${MAZE_LEVELS_REV1.hard.rows}, a longer route, ${secs(MAZE_LEVELS_REV1.hard.timeLimitMs)}; Expert the same size, the exit hidden until you’re near, ${secs(MAZE_LEVELS_REV1.expert.timeLimitMs)}.`,
  bomb: `Easy ${BOMB_LEVELS_REV1.easy.wires} wires, ${BOMB_LEVELS_REV1.easy.steps} steps; Hard ${BOMB_LEVELS_REV1.hard.wires} wires, ${BOMB_LEVELS_REV1.hard.steps} steps; Expert ${BOMB_LEVELS_REV1.expert.wires} wires, ${BOMB_LEVELS_REV1.expert.steps} steps, ${secs(BOMB_LEVELS_REV1.expert.timeLimitMs)}, and a wrong step sets it off at once (no Reset).`,
  pairmatch: `Easy ${PAIR_LEVELS_REV1.easy.pairs} pairs; Hard ${PAIR_LEVELS_REV1.hard.pairs} pairs, quicker flip-back, more shared shapes; Expert ${PAIR_LEVELS_REV1.expert.pairs} pairs, ${secs(PAIR_LEVELS_REV1.expert.timeLimitMs)}. Fewer misses keep more of the bonuses on Hard and Expert.`,
};

/** D3's "Levels:" help lines, from D3's tables: for the help once the game page's level text lands (P2). Unused until then. */
export const ATTENTION_LEVEL_HELP_D3: Readonly<Record<"symscan" | "spotdiff" | "countup" | "maze" | "bomb" | "pairmatch", string>> = {
  symscan: `Easy ${grids(SCAN_LEVELS.easy.grids)}, no look-alikes; Hard ${grids(SCAN_LEVELS.hard.grids)}, two targets from grid 2; Expert three ${SCAN_LEVELS.expert.grids[0]}×${SCAN_LEVELS.expert.grids[0]} grids, two targets on every grid. Every level 60 s.`,
  spotdiff: `Easy ${SPOT_LEVELS.easy.cols}×${SPOT_LEVELS.easy.rows}, ${SPOT_LEVELS.easy.differences} colour or shape changes a picture; Hard ${SPOT_LEVELS.hard.cols}×${SPOT_LEVELS.hard.rows}, ${SPOT_LEVELS.hard.differences} a picture, ${SPOT_LEVELS.hard.missLimit} misses; Expert ${SPOT_LEVELS.expert.differences} a picture, the lower picture mirrored, ${SPOT_LEVELS.expert.missLimit} misses, ${secs(SPOT_LEVELS.expert.timeLimitMs)}.`,
  countup: `Easy three small trays, one colour or one shape; Hard trays of ${TALLY_LEVELS.hard.trays[0]} or more, counts into the twenties; Expert four trays of ${TALLY_LEVELS.expert.trays[0]}, two colours, no marks, ${secs(TALLY_LEVELS.expert.timeLimitMs)}.`,
  maze: `Easy ${MAZE_LEVELS.easy.cols}×${MAZE_LEVELS.easy.rows}; Hard ${MAZE_LEVELS.hard.cols}×${MAZE_LEVELS.hard.rows} with ${MAZE_LEVELS.hard.keys} gold keys to fetch before the exit opens, ${secs(MAZE_LEVELS.hard.timeLimitMs)}; Expert ${MAZE_LEVELS.expert.keys} keys, one in each corner, ${secs(MAZE_LEVELS.expert.timeLimitMs)}.`,
  bomb: `Easy ${BOMB_LEVELS.easy.wires} wires, ${BOMB_LEVELS.easy.steps} steps; Hard ${BOMB_LEVELS.hard.clues[0]} clues to work out in ${secs(BOMB_LEVELS.hard.timeLimitMs)}; Expert the same in ${secs(BOMB_LEVELS.expert.timeLimitMs)}, and a wrong step sets it off at once (no Reset).`,
  pairmatch: `Easy ${PAIR_LEVELS.easy.pairs} pairs; Hard ${PAIR_LEVELS.hard.pairs} pairs; Expert ${PAIR_LEVELS.expert.pairs} pairs. On Hard and Expert, forgetting a card you have seen costs the bonuses.`,
};
