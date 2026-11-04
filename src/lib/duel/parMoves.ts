/**
 * Puzzle batch, 3 Nov 2026 (docs/puzzle-batch-nov-2026.md): Labyrinth, Topsy-Turvy and Skid lose their collectibles
 * (Labyrinth's stars, Topsy-Turvy's stars, Skid's ice gems) and score a finish as 150 + up to 30 for speed + up to 20
 * for par moves (full at or under par, falling in a straight line to 0 at twice par). Unfinished scoring is the
 * standard's, unchanged (with no collectibles on the board, nothing is added for them). Each game moves up one stamp
 * above the scoring standard's (standard/stamps.ts):
 *
 * - Labyrinth `mazeRev 4` (par: the route's steps; moves: every step of the trail, backtracks included),
 * - Topsy-Turvy `gravityRev 6` (par: the fewest tilts that clear each board, added up; moves: the tilts),
 * - Skid `slideRev 3` (par: the fewest slides; moves: the slides).
 *
 * The board, play and clock are the standard stamp's; the deal only strips the collectibles from the stored puzzle,
 * so nothing random is drawn per device and older rounds replay and score exactly as before (their stamps keep the
 * standard's graders). A new puzzle gets these stamps only when it was dealt the standard's stamp (so a check pinning
 * any earlier world keeps what it pinned) and this batch is not pinned. Shared by phone and server, pure.
 */
import type { PuzzleData, PuzzleType } from "./types";
import { STANDARD_STAMPS, preStandardPinned } from "./standard/stamps";
import { rebuildLiveRecords } from "./roundMax";

export const MAZE_REV_PAR = 4;
export const GRAVITY_REV_PAR = 6;
export const SLIDE_REV_PAR = 3;

/** The finish's parts on these stamps: 150 + speed + par moves = 200. */
export const PAR_MOVES_STD = { speed: 30, par: 20 } as const;

/** Each game's stamp key and the stamp it moves up to. */
export const PAR_MOVES_STAMPS: Partial<Record<PuzzleType, { key: string; rev: number }>> = {
  maze: { key: "mazeRev", rev: MAZE_REV_PAR },
  gravity: { key: "gravityRev", rev: GRAVITY_REV_PAR },
  iceslide: { key: "slideRev", rev: SLIDE_REV_PAR },
};

let pinned = false;
let strictPinned = false;

/** Checks written for the standard's stamps pin new deals to them (returns the previous setting). */
export function pinPreParMoves(on: boolean): boolean {
  const prev = pinned;
  pinned = on;
  // The help and intro texts (liveRecord) describe the stamps dealt: rebuild them for the pinned world.
  if (prev !== on) rebuildLiveRecords();
  return prev;
}

export function preParMovesPinned(): boolean {
  return pinned;
}

/** True while new Labyrinth, Topsy-Turvy and Skid rounds are dealt this batch's stamps (the help texts describe them). */
export function parMovesDealt(): boolean {
  return !pinned && !preStandardPinned();
}

function stampOf(puzzle: unknown, key: string): number | null {
  const v = (puzzle as Record<string, unknown> | null)?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** True for a stored puzzle on this batch's stamp (or later): no collectibles, the par-moves finish. */
export function usesParMoves(puzzle: PuzzleData | null | undefined): boolean {
  if (!puzzle) return false;
  const st = PAR_MOVES_STAMPS[puzzle.type];
  if (!st) return false;
  const v = stampOf(puzzle, st.key);
  return v !== null && v >= st.rev;
}

/** The puzzle with its collectibles taken off (the board, walls, holes and route are untouched). */
function strip<T extends PuzzleData>(puzzle: T): T {
  if (puzzle.type === "maze") {
    const { stars: _stars, ...rest } = puzzle;
    return rest as T;
  }
  if (puzzle.type === "iceslide") {
    const { gems: _gems, ...rest } = puzzle;
    return rest as T;
  }
  if (puzzle.type === "gravity") {
    const { boardStarMins: _starMins, ...rest } = puzzle as typeof puzzle & { boardStarMins?: unknown };
    return { ...rest, ...(puzzle.boards ? { boards: puzzle.boards.map((b) => ({ ...b, stars: [] })) } : {}) } as T;
  }
  return puzzle;
}

/**
 * The stamp a new puzzle is dealt: this batch's when the puzzle carries the standard's stamp, unchanged otherwise.
 * `vary` rebuilds what the new stamp stores differently (Topsy-Turvy's shortest routes without the stars, which need
 * the server's search; generate.server.ts passes it).
 */
export function dealParMoves<T extends PuzzleData>(puzzle: T, vary?: (puzzle: T) => T): T {
  const batch = PAR_MOVES_STAMPS[puzzle.type];
  const standard = STANDARD_STAMPS[puzzle.type];
  if (!batch || !standard || pinned) return puzzle;
  if (stampOf(puzzle, batch.key) !== (standard.dealt ?? standard.rev)) return puzzle;
  const stamped = strip({ ...puzzle, [batch.key]: batch.rev } as T);
  const varied = vary ? vary(stamped) : stamped;
  // Puzzle polish (3 Nov 2026): one stamp further, the par stored and shown, speed and par stricter.
  return strictPinned ? varied : dealParStrict(varied);
}

/* ------------------------------------------------------------------ Stricter par (puzzle polish, 3 Nov 2026) */

/**
 * Puzzle polish, 3 Nov 2026 (docs/puzzle-polish-nov-2026.md): the top of these three games was bunched (near-perfect
 * and flawless both 200), so each moves up one more stamp: Labyrinth `mazeRev 5`, Topsy-Turvy `gravityRev 7`, Skid
 * `slideRev 4`. The board and play are the previous stamp's; the puzzle stores its par (`par`, public: shown during
 * play as "Moves n · Par p"), speed is full a little earlier and the par points fall to 0 at 1.5× par instead of 2×.
 */
export const MAZE_REV_STRICT = 5;
export const GRAVITY_REV_STRICT = 7;
export const SLIDE_REV_STRICT = 4;

export const PAR_STRICT_STAMPS: Partial<Record<PuzzleType, { key: string; rev: number }>> = {
  maze: { key: "mazeRev", rev: MAZE_REV_STRICT },
  gravity: { key: "gravityRev", rev: GRAVITY_REV_STRICT },
  iceslide: { key: "slideRev", rev: SLIDE_REV_STRICT },
};

/** True for a stored puzzle on the stricter-par stamp (or later). */
export function usesParStrict(puzzle: PuzzleData | null | undefined): boolean {
  if (!puzzle) return false;
  const st = PAR_STRICT_STAMPS[puzzle.type];
  if (!st) return false;
  const v = stampOf(puzzle, st.key);
  return v !== null && v >= st.rev;
}

/** The par shown during play (stricter-par stamps only; null on every older stamp, whose par stays server-side). */
export function shownPar(puzzle: PuzzleData | null | undefined): number | null {
  if (!usesParStrict(puzzle)) return null;
  const v = (puzzle as { par?: unknown }).par;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

/** Checks written for the puzzle batch's stamps (mazeRev 4, gravityRev 6, slideRev 3) pin new deals to them. */
export function pinPreParStrict(on: boolean): boolean {
  const prev = strictPinned;
  strictPinned = on;
  if (prev !== on) rebuildLiveRecords();
  return prev;
}

/** True while new Labyrinth, Topsy-Turvy and Skid rounds are dealt the stricter-par stamps (the help texts describe them). */
export function parStrictDealt(): boolean {
  return parMovesDealt() && !strictPinned;
}

/** The stricter "full by" times (s), set from the bots' finish times so near-perfect play (median 35–37 s) no longer ties flawless (18–31 s); the puzzle batch had 40 / 80 / 60. */
export const PAR_STRICT_FULL_BY_S: Record<"maze" | "gravity" | "iceslide", number> = { maze: 32, gravity: 32, iceslide: 30 };
/** Par points fall to 0 at this multiple of par (the puzzle batch: 2). */
export const PAR_STRICT_ZERO_AT = 1.5;

/** The par a puzzle on the puzzle batch's stamp is graded against (Labyrinth's route steps, the fewest slides or tilts). */
export function parOfParMoves(puzzle: PuzzleData): number {
  if (puzzle.type === "maze") return Math.max(2, (puzzle.solution ?? []).length) - 1;
  if (puzzle.type === "iceslide") return puzzle.minMoves ?? 0;
  if (puzzle.type === "gravity") return (puzzle.boardMins ?? []).reduce((n, m) => n + m, 0);
  return 0;
}

/** The stricter-par stamp on a puzzle-batch deal: the same puzzle, one stamp up, its par stored. */
function dealParStrict<T extends PuzzleData>(puzzle: T): T {
  const st = PAR_STRICT_STAMPS[puzzle.type];
  if (!st) return puzzle;
  return { ...puzzle, [st.key]: st.rev, par: parOfParMoves(puzzle) } as T;
}
