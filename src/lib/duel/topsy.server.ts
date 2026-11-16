/**
 * Server-only generation for Topsy-Turvy gravityRev 3 (topsy.ts; docs/depth/d5-remodels.md).
 *
 * Each board is drawn at random (blocks, six balls, six holes) and solved by breadth-first search over the
 * joint state (every ball's square, home = off the board), so its minimum is exact. Stars are then placed on
 * squares balls roll through near a shortest route, and a second breadth-first search over (balls, stars
 * taken) gives the fewest tilts home with every star; the board is kept only when that is at most
 * TOPSY_STAR_DETOUR more than the plain minimum and the plain shortest route misses at least one star (so
 * the stars ask for a choice). Boards are graded on their stored data alone.
 */
import { randInt, shuffled } from "./random";
import {
  TOPSY_BALLS,
  TOPSY_BOARDS,
  TOPSY_CELLS,
  TOPSY_HOME,
  TOPSY_SIZE,
  TOPSY_STARS,
  TOPSY_TIME_MS,
  GRAVITY_REV_TOPSY,
  GRAVITY_REV_TOPSY_NOTES,
  GRAVITY_REV_NOV15,
  replayTopsy,
  topsyTiltLimitV8,
  topsyLevelSettings,
  topsySpare,
  starCount,
  topsyCleared,
  topsyStart,
  topsyTilt,
  topsyTiltLimit,
  type TopsyBoard,
  type TopsyState,
} from "./topsy";
import { dealtNotesRev } from "./phoneNotes";
import type { GravityDir, GravityPuzzleData } from "./types";
import { saltSeed, seededRng } from "./seededRng";
import { TOPSY_LEVEL_BANK } from "./topsyLevelsBank.server";
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import { NORMAL, puzzleLevel, type Level } from "@/lib/levels/levels";
import type { TopsyLevelSettings } from "@/lib/levels/pattern/gravity.levels";

const DIRS: GravityDir[] = ["U", "D", "L", "R"];
/** Fewest tilts home a board may need. */
export const TOPSY_MIN_TILTS = 4;
export const TOPSY_MAX_TILTS = 7;
/** Every star home costs at most this many tilts more than the plain minimum. */
export const TOPSY_STAR_DETOUR = 2;
export const TOPSY_MIN_WALLS = 14;
export const TOPSY_MAX_WALLS = 22;
/** The search gives up (and the board is re-rolled) past this many states. */
export const TOPSY_NODE_CAP = 120_000;

function keyOf(state: TopsyState, withStars: boolean): string {
  return withStars ? `${state.balls.join(",")}|${state.starMask}` : state.balls.join(",");
}

export interface TopsySearch {
  min: number;
  solution: GravityDir[];
  /** Squares any ball rolled through in the explored graph, within depth min + detour. */
  rolled?: Set<number>;
}

/**
 * Fewest tilts to get every ball home (withStars: home with every star), plus one shortest list; null when
 * the board cannot be cleared within maxDepth or the search passes the cap.
 */
export function topsySearch(board: TopsyBoard, withStars: boolean, maxDepth: number, cap = TOPSY_NODE_CAP): TopsySearch | null {
  const walls = new Set(board.walls);
  const all = (1 << board.stars.length) - 1;
  const start = topsyStart(board);
  const done = (s: TopsyState) => topsyCleared(s) && (!withStars || s.starMask === all);
  if (done(start)) return { min: 0, solution: [] };
  const states: TopsyState[] = [start];
  const parent: number[] = [-1];
  const via: GravityDir[] = ["X"];
  const depth: number[] = [0];
  const seen = new Set<string>([keyOf(start, withStars)]);
  for (let index = 0; index < states.length; index++) {
    if (states.length > cap) return null;
    if (depth[index]! >= maxDepth) return null;
    for (const dir of DIRS) {
      const out = topsyTilt(board, walls, states[index]!, dir);
      if (!out.moved) continue;
      const key = keyOf(out.state, withStars);
      if (seen.has(key)) continue;
      seen.add(key);
      states.push(out.state);
      parent.push(index);
      via.push(dir);
      depth.push(depth[index]! + 1);
      if (done(out.state)) {
        const path: GravityDir[] = [];
        for (let walk = states.length - 1; walk > 0; walk = parent[walk]!) path.unshift(via[walk]!);
        return { min: path.length, solution: path };
      }
    }
  }
  return null;
}

/** Squares balls roll through on tilts from states within `depth` tilts of the start (star candidates). */
function rolledSquares(board: TopsyBoard, depth: number): Map<number, number> {
  const walls = new Set(board.walls);
  let frontier: TopsyState[] = [topsyStart(board)];
  const seen = new Set<string>([keyOf(frontier[0]!, false)]);
  const counts = new Map<number, number>();
  for (let d = 0; d < depth && frontier.length; d++) {
    const next: TopsyState[] = [];
    for (const state of frontier) {
      for (const dir of DIRS) {
        const out = topsyTilt(board, walls, state, dir);
        if (!out.moved) continue;
        for (const path of out.paths) for (const cell of path.slice(1)) counts.set(cell, (counts.get(cell) ?? 0) + 1);
        const key = keyOf(out.state, false);
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(out.state);
      }
    }
    frontier = next;
  }
  return counts;
}

/** The squares the stored route's balls roll through. */
function routeSquares(board: TopsyBoard, route: GravityDir[]): Set<number> {
  const walls = new Set(board.walls);
  let state = topsyStart(board);
  const cells = new Set<number>();
  for (const dir of route) {
    const out = topsyTilt(board, walls, state, dir);
    for (const path of out.paths) for (const cell of path.slice(1)) cells.add(cell);
    state = out.state;
  }
  return cells;
}

export interface TopsyBoardMade {
  board: TopsyBoard;
  min: number;
  starMin: number;
  solution: GravityDir[];
}

/**
 * Holes are planted on a random walk: blocks and balls are drawn, a random tilt list (no holes yet) is rolled,
 * and each ball's hole goes on a square it rolls through in the walk's second half. Early drops change later
 * rolls, so the walk is only a seed: the board is then solved exactly and kept on its own merits.
 */
function attemptBoard(homeBlocks: boolean): TopsyBoardMade | null {
  const cells = shuffled(Array.from({ length: TOPSY_CELLS }, (_, cell) => cell));
  const starts = cells.slice(0, TOPSY_BALLS);
  const wallCount = randInt(TOPSY_MIN_WALLS, TOPSY_MAX_WALLS);
  const walls = cells.slice(TOPSY_BALLS, TOPSY_BALLS + wallCount).sort((a, b) => a - b);
  const wallSet = new Set(walls);
  const walkLength = randInt(TOPSY_MIN_TILTS + 1, TOPSY_MAX_TILTS);
  const open: TopsyBoard = { walls, starts, holes: starts.map(() => -2), stars: [] };
  const rule = homeBlocks ? { homeBlocks: true as const } : {};
  let state = topsyStart(open);
  const late: number[][] = starts.map(() => []);
  let last: GravityDir | null = null;
  for (let step = 0; step < walkLength; step++) {
    const options = DIRS.filter((d) => d !== last);
    let out = null;
    for (const dir of shuffled(options)) {
      const tried = topsyTilt(open, wallSet, state, dir);
      if (tried.moved) {
        out = tried;
        last = dir;
        break;
      }
    }
    if (!out) return null;
    if (step >= Math.floor(walkLength / 2)) out.paths.forEach((path, i) => late[i]!.push(...path.slice(1)));
    state = out.state;
  }
  const used = new Set([...starts, ...walls]);
  const holes: number[] = [];
  for (let i = 0; i < TOPSY_BALLS; i++) {
    const options = late[i]!.filter((c) => !used.has(c));
    if (!options.length) return null;
    const hole = options[randInt(0, options.length - 1)]!;
    holes.push(hole);
    used.add(hole);
  }
  const bare: TopsyBoard = { walls, starts, holes, stars: [], ...rule };
  // No ball may drop on the very first tilt.
  for (const dir of DIRS) if (topsyTilt(bare, wallSet, topsyStart(bare), dir).dropped.length) return null;
  const plain = topsySearch(bare, false, TOPSY_MAX_TILTS);
  if (!plain || plain.min < TOPSY_MIN_TILTS) return null;
  // Star candidates: open squares balls roll through near a shortest route, not on a start or a hole.
  const taken = new Set([...starts, ...holes, ...walls]);
  const candidates = [...rolledSquares(bare, Math.min(3, plain.min)).keys()].filter((c) => !taken.has(c));
  if (candidates.length < TOPSY_STARS) return null;
  const onRoute = routeSquares(bare, plain.solution);
  for (let tries = 0; tries < 8; tries++) {
    const stars = shuffled(candidates).slice(0, TOPSY_STARS);
    // The plain shortest route must miss a star, so collecting both is a choice.
    if (stars.every((c) => onRoute.has(c))) continue;
    const board: TopsyBoard = { walls, starts, holes, stars: stars.sort((a, b) => a - b), ...rule };
    const full = topsySearch(board, true, plain.min + TOPSY_STAR_DETOUR);
    if (!full) continue;
    return { board, min: plain.min, starMin: full.min, solution: full.solution };
  }
  return null;
}

/** One board; unlimited tries unless capped. `homeBlocks`: gravityRev 4's rule (a ball home blocks). */
export function generateTopsyBoard(maxTries = Number.POSITIVE_INFINITY, homeBlocks = false): TopsyBoardMade {
  for (let tries = 1; tries <= maxTries; tries++) {
    const made = attemptBoard(homeBlocks);
    if (made) return made;
    if (tries % 5000 === 0) console.warn(`[topsy] ${tries} boards rejected so far`);
  }
  throw new Error(`Topsy-Turvy generator found no board in ${maxTries} tries`);
}

/**
 * A gravityRev 3 round: three boards, the minimums and routes kept server-side. gravityRev 4 (Joe's phone notes,
 * 27 Oct 2026): boards generated and solved with a ball home blocking, and 2× the tilts.
 */
export function generateTopsy(maxTries = Number.POSITIVE_INFINITY, level?: Level, bankSeed?: number): GravityPuzzleData {
  const rev = dealtNotesRev(GRAVITY_REV_TOPSY_NOTES, GRAVITY_REV_TOPSY);
  // The difficulty levels (16 Nov 2026): a level beyond Normal deals from its proved bank; Normal is today's deal.
  if (level && level !== NORMAL) {
    const leveled = generateTopsyLevel(level, rev, bankSeed);
    if (leveled) return leveled;
  }
  const homeBlocks = rev >= GRAVITY_REV_TOPSY_NOTES;
  const made = Array.from({ length: TOPSY_BOARDS }, () => generateTopsyBoard(maxTries, homeBlocks));
  const first = made[0]!.board;
  return {
    type: "gravity",
    gravityRev: rev,
    timeLimitMs: TOPSY_TIME_MS,
    walls: [...first.walls],
    starts: [...first.starts],
    targets: [...first.holes],
    boards: made.map((m) => m.board),
    minMoves: made.reduce((n, m) => n + m.min, 0),
    solution: made.map((m) => m.solution.join("")).join(""),
    tiltLimits: made.map((m) => topsyTiltLimit(m.starMin, rev)),
    boardMins: made.map((m) => m.min),
    boardStarMins: made.map((m) => m.starMin),
    boardSolutions: made.map((m) => m.solution.join("")),
  };
}

/** One bank line ("blocks|starts|cups|fewest|route", scripts/topsy-levels-bank.ts) as a board, its fewest and route. */
export function parseTopsyBankEntry(line: string): { board: TopsyBoard; min: number; route: string } {
  const [walls, starts, holes, min, route] = line.split("|");
  const cells = (s: string | undefined) => (s ? s.split(".").map(Number) : []);
  return { board: { walls: cells(walls), starts: cells(starts), holes: cells(holes), stars: [], homeBlocks: true }, min: Number(min), route: route ?? "" };
}

/**
 * A round at a level beyond Normal (the difficulty levels, 16 Nov 2026; src/lib/levels/pattern/gravity.levels.ts): the
 * level's number of boards, distinct entries of its proved bank (topsyLevelsBank.server.ts), picked by the deal's bank
 * seed (rooms: the room seed, so every player gets the same boards; practice: a fresh one) or, with none, the deal's
 * own draw. Stored as today's rounds are (the boards, each one's fewest tilts and one shortest route), plus `level`, so
 * the deal's later layers (the par, gravityRev 8's limits at the level's spare) read it. Null for a level with no bank.
 */
export function generateTopsyLevel(level: Level, rev: number, bankSeed?: number): GravityPuzzleData | null {
  const settings = gameLevelSettings<TopsyLevelSettings>("gravity", level);
  const bank = TOPSY_LEVEL_BANK[level as keyof typeof TOPSY_LEVEL_BANK];
  if (!settings || !bank) return null;
  const rng = bankSeed === undefined ? null : seededRng(saltSeed(bankSeed, `gravity:${level}`));
  const picked: number[] = [];
  while (picked.length < Math.min(settings.boards, bank.length)) {
    const i = rng ? rng.below(bank.length) : randInt(0, bank.length - 1);
    if (!picked.includes(i)) picked.push(i);
  }
  const made = picked.map((i) => parseTopsyBankEntry(bank[i]!));
  const first = made[0]!.board;
  return {
    type: "gravity",
    gravityRev: rev,
    timeLimitMs: settings.timeLimitMs,
    walls: [...first.walls],
    starts: [...first.starts],
    targets: [...first.holes],
    boards: made.map((m) => m.board),
    minMoves: made.reduce((n, m) => n + m.min, 0),
    solution: made.map((m) => m.route).join(""),
    tiltLimits: made.map((m) => topsyTiltLimit(m.min, rev)),
    boardMins: made.map((m) => m.min),
    boardStarMins: made.map((m) => m.min),
    boardSolutions: made.map((m) => m.route),
    level,
  } as GravityPuzzleData;
}

/**
 * Re-checks a stored gravityRev 3 round as the generator accepts one: three boards of distinct in-range
 * squares, no drop on the first tilt, exact minimums in the band (fresh searches agree with the stored
 * figures), every star reachable within the detour, and the stored all-stars routes clearing every board
 * with every star.
 */
export function verifyTopsyPuzzle(puzzle: GravityPuzzleData): string | null {
  const rev = puzzle.gravityRev ?? 0;
  // gravityRev 5 (the scoring standard, standard/stamps.ts) deals gravityRev 4's boards and rules.
  // gravityRev 6 (the puzzle batch of 3 Nov 2026, parMoves.ts): gravityRev 5's boards with the stars taken off and the
  // shortest routes without them.
  const noStars = rev >= GRAVITY_REV_TOPSY_NOTES + 2;
  // gravityRev 7 (puzzle polish, 3 Nov 2026, parMoves.ts): gravityRev 6's boards and routes, the par stored.
  // gravityRev 8 (the Pattern overhaul, 15 Nov 2026): gravityRev 7's boards, each tilt limit its fewest tilts + 8.
  if (puzzle.type !== "gravity" || rev < GRAVITY_REV_TOPSY || rev > GRAVITY_REV_NOV15 || !puzzle.boards) return "not gravityRev 3 to 8";
  // The difficulty levels (16 Nov 2026): a level's round has its own boards, balls and band of fewest tilts.
  const level = topsyLevelSettings(puzzle);
  const boardCount = level?.boards ?? TOPSY_BOARDS;
  const balls = level?.balls ?? TOPSY_BALLS;
  const [minTilts, maxTilts] = level?.minTilts ?? [TOPSY_MIN_TILTS, TOPSY_MAX_TILTS];
  if (rev >= GRAVITY_REV_NOV15 && (puzzle.tiltLimits?.length !== boardCount || puzzle.tiltLimits.some((l, i) => l !== topsyTiltLimitV8(puzzle.boardMins?.[i] ?? -99, topsySpare(puzzle))))) return "gravityRev 8 tilt limits";
  if (rev >= GRAVITY_REV_TOPSY_NOTES + 3 && puzzle.par !== (puzzle.boardMins ?? []).reduce((n, m) => n + m, 0)) return "stored par";
  if (puzzle.boards.length !== boardCount) return "board count";
  for (const [i, board] of puzzle.boards.entries()) {
    if (Boolean(board.homeBlocks) !== (rev >= GRAVITY_REV_TOPSY_NOTES)) return `board ${i}: home-blocks rule does not match gravityRev ${rev}`;
    if (board.starts.length !== balls || board.holes.length !== balls || board.stars.length !== (noStars ? 0 : TOPSY_STARS)) return `board ${i}: counts`;
    const all = [...board.walls, ...board.starts, ...board.holes, ...board.stars];
    if (new Set(all).size !== all.length || all.some((c) => !Number.isInteger(c) || c < 0 || c >= TOPSY_CELLS)) return `board ${i}: squares`;
    const walls = new Set(board.walls);
    for (const dir of DIRS) if (topsyTilt(board, walls, topsyStart(board), dir).dropped.length) return `board ${i}: drops on the first tilt`;
    const plain = topsySearch(board, false, maxTilts, level ? 400_000 : undefined);
    if (!plain || plain.min < minTilts) return `board ${i}: minimum outside the band`;
    if (plain.min !== puzzle.boardMins?.[i]) return `board ${i}: stored minimum`;
    if (noStars) {
      if ((puzzle.boardSolutions?.[i] ?? "").length !== plain.min) return `board ${i}: stored route is not a shortest one`;
      continue;
    }
    const full = topsySearch(board, true, plain.min + TOPSY_STAR_DETOUR);
    if (!full || full.min !== puzzle.boardStarMins?.[i]) return `board ${i}: stored star minimum`;
  }
  const route = (puzzle.boardSolutions ?? []).join("").split("") as GravityDir[];
  if (noStars) {
    // The tilt limits are gravityRev 5's (from the star minimums, which the deal no longer stores): at least the fewest.
    if (puzzle.tiltLimits?.length !== boardCount || puzzle.tiltLimits.some((l, i) => l < puzzle.boardMins![i]!)) return "tilt limits";
    return replayTopsy(puzzle.boards, route, puzzle.tiltLimits).solved ? null : "stored routes do not clear every board";
  }
  if (puzzle.tiltLimits?.length !== boardCount || puzzle.tiltLimits.some((l, i) => l !== topsyTiltLimit(puzzle.boardStarMins![i]!, rev))) return "tilt limits";
  const replay = replayTopsy(puzzle.boards, route, puzzle.tiltLimits);
  if (!replay.solved || replay.stars !== boardCount * TOPSY_STARS) return "stored routes do not clear every board with every star";
  return null;
}

/**
 * gravityRev 6 (the puzzle batch of 3 Nov 2026, parMoves.ts): the boards carry no stars, so the stored routes are each
 * board's shortest without them (the reveal shows them; their lengths are the stored minimums, the par).
 */
export function topsyPlainRoutes(puzzle: GravityPuzzleData): GravityPuzzleData {
  if (!puzzle.boards) return puzzle;
  // A level's boards (the difficulty levels) carry no stars from the start: their bank routes are already each
  // board's shortest (proved by the same search), so they are kept as dealt.
  if (puzzleLevel(puzzle) !== NORMAL) return puzzle;
  const routes = puzzle.boards.map((board, i) => {
    const found = topsySearch({ ...board, stars: [] }, false, Math.max(TOPSY_MAX_TILTS, puzzle.boardMins?.[i] ?? 0));
    return found ? found.solution.join("") : (puzzle.boardSolutions?.[i] ?? "");
  });
  return { ...puzzle, boardSolutions: routes, solution: routes.join("") };
}

export { TOPSY_HOME, TOPSY_SIZE, starCount };
