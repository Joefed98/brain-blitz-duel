/**
 * Topsy-Turvy, gravityRev 3 (25 Oct 2026, the remodel; docs/depth/d5-remodels.md). Shared rules: the same
 * code animates a tilt on the phone and replays the tilt list on the server.
 *
 * A round is TOPSY_BOARDS boards played one after another. Each board is TOPSY_SIZE × TOPSY_SIZE with
 * blocks, TOPSY_BALLS coloured balls and one hole per ball, in the ball's colour, plus a few stars. One tilt
 * rolls every ball still on the board until it meets the edge, a block or another ball. A ball that rolls
 * over (or stops on) its own hole drops in at once: it is home, leaves the board and no longer blocks. A
 * ball rolls over other colours' holes. Any ball that rolls through a star collects it. A board is cleared
 * when every ball is home; the next tilt goes to the next board.
 *
 * Stored rounds (gravityRev absent, 1 or 2) keep the old four-ball, locking-target rules (gravity.ts).
 */
import { eliteStretchPoints } from "./d5Remodels";
import type { GravityDir, GravityPuzzleData } from "./types";

/** The remodel's stamp. */
export const GRAVITY_REV_TOPSY = 3;
export const TOPSY_SIZE = 10;
export const TOPSY_CELLS = TOPSY_SIZE * TOPSY_SIZE;
export const TOPSY_BALLS = 6;
export const TOPSY_BOARDS = 3;
export const TOPSY_STARS = 2;
export const TOPSY_TIME_MS = 120_000;
/** A ball that is home (off the board). */
export const TOPSY_HOME = -1;

export interface TopsyBoard {
  /** Blocks, ascending. */
  walls: number[];
  /** Start square per ball, in colour order. */
  starts: number[];
  /** Each ball's hole, same order. */
  holes: number[];
  /** Star squares. */
  stars: number[];
}

/** Ball squares (TOPSY_HOME once home) and the stars still on the board. */
export interface TopsyState {
  balls: number[];
  /** Bit i set: star i collected. */
  starMask: number;
}

export function isTopsy(puzzle: { type: string; gravityRev?: number } | null | undefined): puzzle is GravityPuzzleData & { boards: TopsyBoard[] } {
  return Boolean(puzzle && puzzle.type === "gravity" && (puzzle.gravityRev ?? 0) >= GRAVITY_REV_TOPSY && Array.isArray((puzzle as GravityPuzzleData).boards));
}

export function topsyStart(board: TopsyBoard): TopsyState {
  return { balls: [...board.starts], starMask: 0 };
}

export function topsyHomeCount(state: TopsyState): number {
  return state.balls.filter((cell) => cell === TOPSY_HOME).length;
}

export function topsyCleared(state: TopsyState): boolean {
  return state.balls.every((cell) => cell === TOPSY_HOME);
}

export function starCount(mask: number): number {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
}

function stepOf(cell: number, dir: GravityDir): number | null {
  const row = Math.floor(cell / TOPSY_SIZE);
  const col = cell % TOPSY_SIZE;
  if (dir === "U") return row > 0 ? cell - TOPSY_SIZE : null;
  if (dir === "D") return row < TOPSY_SIZE - 1 ? cell + TOPSY_SIZE : null;
  if (dir === "L") return col > 0 ? cell - 1 : null;
  if (dir === "R") return col < TOPSY_SIZE - 1 ? cell + 1 : null;
  return null;
}

/** How far forward a square is in the tilt's direction (the leading ball moves first). */
function lead(cell: number, dir: GravityDir): number {
  const row = Math.floor(cell / TOPSY_SIZE);
  const col = cell % TOPSY_SIZE;
  return dir === "U" ? -row : dir === "D" ? row : dir === "L" ? -col : col;
}

export interface TopsyTilt {
  state: TopsyState;
  /** Each ball's squares in order, from where it stood (the last is where it stopped or dropped). */
  paths: number[][];
  /** Balls that dropped home on this tilt. */
  dropped: number[];
  /** Stars collected on this tilt (indices). */
  starsTaken: number[];
  moved: boolean;
}

/** One tilt. `walls` is the board's block set. */
export function topsyTilt(board: TopsyBoard, walls: Set<number>, state: TopsyState, dir: GravityDir): TopsyTilt {
  const balls = [...state.balls];
  const paths = balls.map((cell) => (cell === TOPSY_HOME ? [] : [cell]));
  const dropped: number[] = [];
  let mask = state.starMask;
  const starsTaken: number[] = [];
  const order = balls
    .map((cell, index) => ({ cell, index }))
    .filter((b) => b.cell !== TOPSY_HOME)
    .sort((a, b) => lead(b.cell, dir) - lead(a.cell, dir) || a.index - b.index)
    .map((b) => b.index);
  // Leading balls roll first; a ball behind stops against one ahead or follows it if that one dropped.
  for (let guard = 0; guard < TOPSY_CELLS * 2; guard++) {
    let any = false;
    for (const i of order) {
      const at = balls[i]!;
      if (at === TOPSY_HOME) continue;
      const next = stepOf(at, dir);
      if (next === null || walls.has(next) || balls.includes(next)) continue;
      balls[i] = next;
      paths[i]!.push(next);
      any = true;
      const star = board.stars.indexOf(next);
      if (star >= 0 && !(mask & (1 << star))) {
        mask |= 1 << star;
        starsTaken.push(star);
      }
      if (next === board.holes[i]) {
        balls[i] = TOPSY_HOME;
        dropped.push(i);
      }
    }
    if (!any) break;
  }
  const moved = paths.some((p) => p.length > 1);
  return { state: { balls, starMask: mask }, paths, dropped, starsTaken, moved };
}

export const TOPSY_UNDO: GravityDir = "X";
export const TOPSY_RESET: GravityDir = "Y";

export interface TopsyBoardResult {
  state: TopsyState;
  /** Tilts that moved a ball on this board (Undo and Reset give none back). */
  tilts: number;
  cleared: boolean;
  /** The board's tilt limit was used up before every ball was home (play moved on to the next board). */
  outOfTilts: boolean;
}

export interface TopsyReplay {
  /** One entry per board reached (the last may be unfinished). */
  boards: TopsyBoardResult[];
  /** Index of the board in play (TOPSY_BOARDS when every board is done). */
  current: number;
  cleared: number;
  /** Every board cleared. */
  solved: boolean;
  /** Every board done, cleared or out of tilts: the round is over. */
  over: boolean;
  home: number;
  stars: number;
  /** Stars on the boards cleared. */
  clearedStars: number;
  tilts: number;
}

/** Spare tilts over a board's minimum before its limit (rounded up to a multiple of 5, so it never shows the minimum). */
export const TOPSY_SPARE_TILTS = 8;
export function topsyTiltLimit(min: number): number {
  return Math.ceil((min + TOPSY_SPARE_TILTS) / 5) * 5;
}

/**
 * The one place a tilt list becomes an outcome (phone and server). The list runs across the boards: once a
 * board is cleared, or its tilt limit is used up, the next tilt goes to the next board. X = undo (within the
 * board), Y = reset the board; neither gives a tilt back. A tilt that moves nothing does not count.
 */
export function replayTopsy(boards: TopsyBoard[], tilts: GravityDir[], limits?: readonly number[], onBoard?: (board: number, state: TopsyState) => void): TopsyReplay {
  const results: TopsyBoardResult[] = [];
  let index = 0;
  let walls = new Set(boards[0]?.walls ?? []);
  let history: TopsyState[] = boards[0] ? [topsyStart(boards[0])] : [];
  let count = 0;
  const finishBoard = (cleared: boolean, outOfTilts: boolean) => {
    results.push({ state: history[history.length - 1]!, tilts: count, cleared, outOfTilts });
  };
  for (const dir of tilts) {
    const board = boards[index];
    if (!board) break;
    if (dir === "X") {
      if (history.length > 1) history.pop();
      onBoard?.(index, history[history.length - 1]!);
      continue;
    }
    if (dir === "Y") {
      history = [history[0]!];
      onBoard?.(index, history[0]!);
      continue;
    }
    const out = topsyTilt(board, walls, history[history.length - 1]!, dir);
    if (!out.moved) continue;
    count++;
    history.push(out.state);
    onBoard?.(index, out.state);
    const cleared = topsyCleared(out.state);
    const limit = limits?.[index];
    if (cleared || (limit !== undefined && count >= limit)) {
      finishBoard(cleared, !cleared);
      index++;
      count = 0;
      const nextBoard = boards[index];
      if (nextBoard) {
        walls = new Set(nextBoard.walls);
        history = [topsyStart(nextBoard)];
      } else history = [];
    }
  }
  if (index < boards.length) finishBoard(false, false);
  const cleared = results.filter((r) => r.cleared).length;
  return {
    boards: results,
    current: index,
    cleared,
    solved: cleared === boards.length && boards.length > 0,
    over: index >= boards.length,
    home: results.reduce((n, r) => n + topsyHomeCount(r.state), 0),
    stars: results.reduce((n, r) => n + starCount(r.state.starMask), 0),
    clearedStars: results.reduce((n, r) => n + (r.cleared ? starCount(r.state.starMask) : 0), 0),
    tilts: results.reduce((n, r) => n + r.tilts, 0),
  };
}

/** A stored round's replay (its boards and tilt limits). */
export function replayTopsyPuzzle(puzzle: GravityPuzzleData & { boards: TopsyBoard[] }, tilts: GravityDir[], onBoard?: (board: number, state: TopsyState) => void): TopsyReplay {
  return replayTopsy(puzzle.boards, tilts, puzzle.tiltLimits, onBoard);
}

/* ------------------------------------------------------------------ scoring (gravityRev 3, to 200) */

/** Points for each star collected (a modest fixed amount: 6 stars, 18). */
export const TOPSY_STAR_POINTS = 3;
/** A cleared round's base. */
export const TOPSY_FINISH_BASE = 120;
/** Speed points on a cleared round, 32 × √(share left ÷ TOPSY_FAST_SHARE), all of them from TOPSY_FAST_SHARE left. */
export const TOPSY_SPEED_POINTS = 32;
export const TOPSY_FAST_SHARE = 0.5;
/** The elite stretch: nothing at TOPSY_ELITE_FROM (a near-perfect pace), all of it at TOPSY_ELITE_SHARE of the clock left with no waste. */
export const TOPSY_ELITE_POINTS = 30;
export const TOPSY_ELITE_FROM = 0.64;
export const TOPSY_ELITE_SHARE = 0.76;
/** Unfinished: up to this many points for balls home (all but one ball home ≈ 94). */
export const TOPSY_HOME_POINTS = 100;
/** An unfinished round never reaches a cleared one's base. */
export const TOPSY_UNFINISHED_CAP = 119;

export interface TopsyScore {
  score: number;
  /** finish: 120 + stars + speed (the linear part and the elite stretch); partial: balls home + stars. */
  parts: { kind: "finish" | "partial"; base: number; efficiency?: number; speed?: number; measure?: string };
  home: number;
  stars: number;
  /** Finish only: the elite stretch's share of the speed points. */
  elite?: number;
}

/**
 * gravityRev 3's score (max 200, ROUND_MAX.gravity):
 *   cleared every board: 120 + 3 a star (6 stars, 18) + up to 32 for speed (32 × √(share left ÷ ½), all 32 with half the
 *   clock left) + up to 30 elite (eliteStretchPoints: nothing at 64 % left, about a near-perfect pace, all 30 at 76 %
 *   left with no wasted tilts; efficiency = the boards' all-stars minimums ÷ the tilts made);
 *   unfinished: 100 × balls home ÷ all balls + 3 a star on the boards cleared, at most 119.
 */
export function scoreTopsy(
  replay: Pick<TopsyReplay, "solved" | "home" | "stars"> & { clearedStars?: number; tilts?: number },
  msRemaining: number,
  limitMs: number,
  totalBalls = TOPSY_BALLS * TOPSY_BOARDS,
  /** The boards' all-stars minimums summed (server-side); without it the elite stretch counts no waste. */
  minTilts?: number,
): TopsyScore {
  const stars = replay.stars * TOPSY_STAR_POINTS;
  if (replay.solved) {
    const left = limitMs > 0 ? Math.max(0, Math.min(limitMs, msRemaining)) / limitMs : 0;
    // Concave: a steady clear earns most of it; all 32 from half the clock left.
    const linear = Math.round(TOPSY_SPEED_POINTS * Math.sqrt(Math.min(1, left / TOPSY_FAST_SHARE)));
    const efficiency = minTilts && replay.tilts ? Math.min(1, minTilts / replay.tilts) : 1;
    const elite = eliteStretchPoints(left, TOPSY_ELITE_FROM, TOPSY_ELITE_SHARE, efficiency, TOPSY_ELITE_POINTS);
    return {
      score: TOPSY_FINISH_BASE + stars + linear + elite,
      parts: { kind: "finish", base: TOPSY_FINISH_BASE, efficiency: stars, measure: "stars", speed: linear + elite },
      home: replay.home,
      stars: replay.stars,
      elite,
    };
  }
  // Unfinished: stars count only on boards that were cleared (random tilting collects stars too).
  const kept = (replay.clearedStars ?? replay.stars) * TOPSY_STAR_POINTS;
  const base = Math.min(TOPSY_UNFINISHED_CAP, Math.round((TOPSY_HOME_POINTS * replay.home) / Math.max(1, totalBalls)) + kept);
  return { score: base, parts: { kind: "partial", base }, home: replay.home, stars: replay.stars };
}

/** Seconds of play that still earn every linear speed point, on the stored clock. */
export function topsyFastSeconds(limitMs = TOPSY_TIME_MS): number {
  return Math.round((limitMs * (1 - TOPSY_FAST_SHARE)) / 1000);
}

/** Seconds an elite clear takes for the full 200. */
export function topsyEliteSeconds(limitMs = TOPSY_TIME_MS): number {
  return Math.round((limitMs * (1 - TOPSY_ELITE_SHARE)) / 1000);
}

/* ------------------------------------------------------------------ texts ({max} = ROUND_MAX.gravity) */

/** The "?" help SCORE text. */
export function topsyHelpScore(): string {
  return `Clear all ${TOPSY_BOARDS} boards: ${TOPSY_FINISH_BASE}, + ${TOPSY_STAR_POINTS} a star (${TOPSY_BOARDS * TOPSY_STARS} stars), + up to ${TOPSY_SPEED_POINTS} for speed (all of it if you clear them in about ${topsyFastSeconds()} s). Faster still, with no wasted tilts, earns up to ${TOPSY_ELITE_POINTS} more: {max} needs every star in about ${topsyEliteSeconds()} s. Unfinished: up to ${TOPSY_HOME_POINTS} for balls home, + ${TOPSY_STAR_POINTS} a star on boards you cleared.`;
}

/** The round intro SCORE line (two phone lines, no scoring terms). */
export const TOPSY_INTRO_SCORE = "Points for balls home and stars. Clear all three boards fast for up to {max}.";
