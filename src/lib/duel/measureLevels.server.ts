/**
 * Server-only: Brimful's level boards (measureLevels.ts). Normal, Easy and Expert deal their boards here from the
 * game's seed; Hard (and every older era a check pins) deals today's `generateMeasure` exactly. Each board's minimum is
 * proven by breadth-first search over every jug state (kept only inside its band), and each board is kept only when the
 * person-like solver (`personSolve`) finishes it within its move limit. Deterministic from the seed.
 */
import { encodeMeasureAction, measureActions, measureApply, measureShortest, MEASURE_REV } from "./measure";
import { gameLevelSettings } from "@/lib/levels/gameLevels";
import type { Level } from "@/lib/levels/levels";
import { activeDealPins, dealPinned } from "./dealEra";
import { MEASURE_REV_BOARD_OUT } from "./gameReviewNov15";
import { generateMeasure } from "./measure.server";
import { MEASURE_NORMAL, MEASURE_REV_LEVELS, measureLevelLimit, personSolve, type MeasureBoardSpec, type MeasureLevelSettings } from "./measureLevels";
import { seededRng, type SeededRng } from "./seededRng";
import type { MeasureBoardData, MeasurePuzzleData, PuzzleData } from "./types";

/** Distance from the start to every reachable state (breadth-first). */
function distances(board: MeasureBoardData): Map<string, number> {
  const actions = measureActions(board);
  const dist = new Map<string, number>([[board.start.join(","), 0]]);
  let frontier = [board.start];
  let depth = 0;
  while (frontier.length) {
    depth += 1;
    const next: number[][] = [];
    for (const amounts of frontier) {
      for (const action of actions) {
        const after = measureApply(board, amounts, action);
        if (!after) continue;
        const id = after.join(",");
        if (dist.has(id)) continue;
        dist.set(id, depth);
        next.push(after);
      }
    }
    frontier = next;
  }
  return dist;
}

function distinctCaps(rng: SeededRng, count: number, lo: number, hi: number): number[] {
  return rng.shuffle(Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)).slice(0, count);
}

/** The board's candidate goals with their BFS minimum inside the band. */
function amountTargets(board: MeasureBoardData, band: readonly [number, number]): number[] {
  const best = new Map<number, number>();
  for (const [id, d] of distances(board)) {
    for (const litres of id.split(",").map(Number)) if ((best.get(litres) ?? Infinity) > d) best.set(litres, d);
  }
  return [...best.entries()]
    .filter(([litres, d]) => litres > 0 && !board.caps.includes(litres) && d >= band[0] && d <= band[1])
    .map(([litres]) => litres)
    .sort((a, b) => a - b);
}

function splitTargets(board: MeasureBoardData, band: readonly [number, number]): number[][] {
  const options: number[][] = [];
  for (const [id, d] of distances(board)) {
    if (d < band[0] || d > band[1]) continue;
    const s = id.split(",").map(Number);
    const equal = (s[0] === s[1] && s[0]! > 0) || (s[1] === s[2] && s[1]! > 0) || (s[0] === s[2] && s[0]! > 0);
    if (equal) options.push(s);
  }
  return options.sort((x, y) => x.join(",").localeCompare(y.join(",")));
}

/** The jugs for a board: a tap board's from 3–15 litres, empty; a no-tap board's largest (9–16) full. */
function jugsFor(rng: SeededRng, spec: MeasureBoardSpec): Pick<MeasureBoardData, "caps" | "start"> {
  if (spec.tap) {
    const caps = distinctCaps(rng, spec.jugs, 3, 15);
    return { caps, start: caps.map(() => 0) };
  }
  const a = rng.int(9, 16);
  const b = rng.int(4, a - 1);
  const c = rng.int(2, b - 1);
  return { caps: [a, b, c], start: [a, 0, 0] };
}

/** One board for its spec: in band, and finished by the person-like solver within the board's limit. */
function levelBoard(rng: SeededRng, spec: MeasureBoardSpec, limitFactor: number): MeasureBoardData {
  for (let attempt = 0; attempt < 2000; attempt++) {
    const board: MeasureBoardData = { ...jugsFor(rng, spec), tap: spec.tap, goal: spec.goal };
    const candidates: MeasureBoardData[] =
      spec.goal === "split"
        ? splitTargets(board, spec.band).map((split) => ({ ...board, split }))
        : amountTargets(board, spec.band).filter((t) => t !== board.start[0]).map((target) => ({ ...board, target }));
    const fair = candidates.filter((c) => {
      const min = measureShortest(c)?.minMoves ?? 0;
      return min > 0 && personSolve(c, measureLevelLimit(min, limitFactor)) !== null;
    });
    if (fair.length) return rng.pick(fair);
  }
  throw new Error(`Brimful: no level board for ${JSON.stringify(spec)}`);
}

/** A level's boards dealt from the seed (Normal when `settings` is null). Never called for Hard (`today`). */
export function generateMeasureLevel(seed: number, settings: MeasureLevelSettings | null): MeasurePuzzleData {
  const level = settings ?? MEASURE_NORMAL;
  if ("today" in level) throw new Error("Brimful: today's game is dealt by generateMeasure");
  const rng = seededRng(seed);
  const boards = level.boards.map((spec) => levelBoard(rng, spec, level.limitFactor));
  const minMoves: number[] = [];
  const solutions: string[] = [];
  for (const board of boards) {
    const shortest = measureShortest(board);
    if (!shortest) throw new Error("Brimful: unsolvable board");
    minMoves.push(shortest.minMoves);
    solutions.push(shortest.solution.map(encodeMeasureAction).join(","));
  }
  return { type: "measure", measureRev: MEASURE_REV, boards, minMoves, solutions };
}

/* ---------------------------------------------------------------- the deal (generate.server.ts) */

/**
 * Whether this deal is a level-board deal: not Hard (today's game), and the live deal. Every older era a check pins
 * (`preMeasureLevels`, or any other pin or pinned score revision: each is from before this change) deals today's game
 * at Normal, as rooms did before levels.
 */
export function dealsMeasureLevelBoards(level: Level | undefined): boolean {
  if (level === "hard") return false;
  return !dealPinned("preMeasureLevels") && activeDealPins().length === 0;
}

/** The level's settings (Normal's when the level is Normal or not given). */
export function measureLevelSettings(level: Level | undefined): MeasureLevelSettings {
  const own = level ? gameLevelSettings<MeasureLevelSettings>("measure", level) : null;
  return own ?? MEASURE_NORMAL;
}

/** Brimful's boards for the deal: today's at Hard (and under any pinned era), else the level's. */
export function dealMeasure(seed: number, level: Level | undefined): MeasurePuzzleData {
  if (!dealsMeasureLevelBoards(level)) return generateMeasure(seed);
  return generateMeasureLevel(seed, measureLevelSettings(level));
}

/**
 * After the deal's layers (today's measureRev 4 on a level-board deal): the level stamp, measureRev 5, and each board's
 * move limit for its level. Anything else (Hard, an older era) is returned unchanged.
 */
export function stampMeasureLevel(puzzle: PuzzleData, level: Level | undefined): PuzzleData {
  if (puzzle.type !== "measure" || !dealsMeasureLevelBoards(level)) return puzzle;
  if (puzzle.measureRev !== MEASURE_REV_BOARD_OUT) return puzzle;
  const settings = measureLevelSettings(level);
  if ("today" in settings) return puzzle;
  const mins = puzzle.minMoves ?? [];
  const moveLimits = mins.map((m) => measureLevelLimit(m, settings.limitFactor));
  // D2 (22 Nov 2026): a level's par from the textbook way, and its own "full by" time (both stored on the puzzle).
  const par = settings.personPar ? puzzle.boards.map((b, i) => personSolve(b, moveLimits[i] ?? 0)?.length ?? mins[i]!) : null;
  return {
    ...puzzle,
    measureRev: MEASURE_REV_LEVELS,
    moveLimits,
    ...(par ? { par } : {}),
    ...(settings.fullByS ? { speedFullByS: settings.fullByS } : {}),
  };
}
