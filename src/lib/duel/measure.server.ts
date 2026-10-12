/**
 * Server-only Brimful generator. Every board's true minimum comes from one
 * breadth-first search over all jug states; the board is kept only when that
 * minimum falls in its band. Deterministic from the seed it is given.
 */
import {
  encodeMeasureAction,
  measureActions,
  measureApply,
  measureShortest,
  MEASURE_REV,
} from "./measure";
import { seededRng, type SeededRng } from "./seededRng";
import type { MeasureBoardData, MeasurePuzzleData } from "./types";

/** Minimum-move bands for boards 1–4. */
export const MEASURE_BANDS: readonly (readonly [number, number])[] = [
  [4, 6],
  [6, 9],
  [8, 11],
  [10, 14],
];

/** Distance from the start to every reachable state. */
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
  const pool = rng.shuffle(Array.from({ length: hi - lo + 1 }, (_, i) => lo + i));
  return pool.slice(0, count);
}

/** Tap-and-drain board: `target` litres in any jug, minimum inside the band. */
function amountBoard(
  rng: SeededRng,
  jugs: number,
  band: readonly [number, number],
): MeasureBoardData {
  for (let attempt = 0; attempt < 500; attempt++) {
    const caps = distinctCaps(rng, jugs, 3, 15);
    const board: MeasureBoardData = { caps, start: caps.map(() => 0), tap: true, goal: "amount" };
    const best = new Map<number, number>();
    for (const [id, d] of distances(board)) {
      for (const litres of id.split(",").map(Number)) {
        if ((best.get(litres) ?? Infinity) > d) best.set(litres, d);
      }
    }
    const targets = [...best.entries()]
      .filter(([litres, d]) => litres > 0 && !caps.includes(litres) && d >= band[0] && d <= band[1])
      .map(([litres]) => litres)
      .sort((a, b) => a - b);
    if (!targets.length) continue;
    return { ...board, target: rng.pick(targets) };
  }
  throw new Error("Brimful: no tap board in band");
}

/** No tap or drain: the largest jug starts full; reach a split with two jugs equal. */
function splitBoard(rng: SeededRng, band: readonly [number, number]): MeasureBoardData {
  for (let attempt = 0; attempt < 500; attempt++) {
    const a = rng.int(9, 16);
    const b = rng.int(4, a - 1);
    // A 1-litre jug makes the split a long run of single-litre pours.
    const c = rng.int(2, b - 1);
    const caps = [a, b, c];
    const board: MeasureBoardData = { caps, start: [a, 0, 0], tap: false, goal: "split" };
    const options: number[][] = [];
    for (const [id, d] of distances(board)) {
      if (d < band[0] || d > band[1]) continue;
      const s = id.split(",").map(Number);
      const equal =
        (s[0] === s[1] && s[0]! > 0) ||
        (s[1] === s[2] && s[1]! > 0) ||
        (s[0] === s[2] && s[0]! > 0);
      if (equal) options.push(s);
    }
    if (!options.length) continue;
    options.sort((x, y) => x.join(",").localeCompare(y.join(",")));
    return { ...board, split: rng.pick(options) };
  }
  throw new Error("Brimful: no split board in band");
}

export function generateMeasure(seed: number): MeasurePuzzleData {
  const rng = seededRng(seed);
  const boards = [
    amountBoard(rng, 2, MEASURE_BANDS[0]!),
    amountBoard(rng, 2, MEASURE_BANDS[1]!),
    amountBoard(rng, 3, MEASURE_BANDS[2]!),
    splitBoard(rng, MEASURE_BANDS[3]!),
  ];
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
