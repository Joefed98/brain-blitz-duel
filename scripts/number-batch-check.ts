/**
 * Number batch (12 Oct 2026): Brimful (measure), Checkout (checkout), Ballpark (numline).
 *
 *   1. Registration: all three active, category number, drawn in rooms, stamped
 *      speedPar 1 and their revision 1; answers and minimums stay private.
 *   2. Same seed → the same puzzle (direct, through generatePuzzle with the room
 *      seed, and through a whole number-only room); generation stays well under 1 s.
 *   3. Brimful: every board's stored minimum re-proved by an independent
 *      breadth-first search; bands, targets and the puzzle-4 split rules.
 *   4. Checkout: every stage re-proved by an independent ordered exhaustive
 *      search (routes and fewest darts); board rules, route floor and the
 *      biggest-dart rejection.
 *   5. Ballpark: tick distance, one value per fifth of the line, line ranges.
 *   6. Score anchors through the real server grader: perfect run, minimum
 *      finish, best unfinished, doing nothing; the cap; finishing never scores
 *      below the best unfinished result; client extras never change a score.
 *
 *   bun scripts/number-batch-check.ts [seeds]
 */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

import { AnswerReveal } from "@/components/duel/AnswerReveal";
import { buildRoomPuzzles, gradeAnswer, generatePuzzle } from "@/lib/duel/generate.server";
import { INTRO_SCORE } from "@/lib/duel/introScore";
import { ACTIVE_PUZZLE_TYPES, puzzleDef, typesInCategory } from "@/lib/duel/registry";
import { splitPuzzle } from "@/lib/duel/secrets";
import { MEASURE_LIMIT_REV } from "../src/lib/duel/moveLimits";
import {
  decodeMeasureActions,
  encodeMeasureAction,
  replayMeasure,
  MEASURE_REV,
  type MeasureAction,
} from "@/lib/duel/measure";
import { generateMeasure } from "@/lib/duel/measure.server";
import {
  checkoutDartValue,
  checkoutOptions,
  checkoutValid,
  decodeCheckoutDarts,
  encodeCheckoutDarts,
  CHECKOUT_BULL,
  CHECKOUT_REV,
  CHECKOUT_STANDARD,
  type CheckoutDart,
} from "@/lib/duel/checkout";
import {
  CHECKOUT_MIN_ROUTES,
  CHECKOUT_TARGETS,
  generateCheckout,
} from "@/lib/duel/checkout.server";
import { numlineShare, numlineValue, NUMLINE_REV, NUMLINE_SCALE } from "@/lib/duel/numline";
import { generateNumline } from "@/lib/duel/numline.server";
import type {
  CheckoutPuzzleData,
  CheckoutStageData,
  MeasureBoardData,
  MeasurePuzzleData,
  NumlinePuzzleData,
  PuzzleData,
  PuzzleType,
} from "@/lib/duel/types";

const SEEDS = Number(process.argv[2] ?? 120);
const TYPES = ["measure", "checkout", "numline"] as const;
let failures = 0;
let checks = 0;
const fail = (message: string) => {
  failures++;
  if (failures <= 60) console.log("FAIL", message);
};
const ok = (condition: boolean, message: string) => {
  checks++;
  if (!condition) fail(message);
};
const seedAt = (i: number) => (i * 2_654_435_761 + 97) >>> 0;

/* ------------------------------ 1. Registration ------------------------------ */

const PRIVATE: Record<(typeof TYPES)[number], string[]> = {
  measure: ["minMoves", "solutions"],
  checkout: ["minDarts", "routes"],
  numline: ["values"],
};
const REV_KEY = { measure: "measureRev", checkout: "checkoutRev", numline: "numlineRev" } as const;
const LIMIT = { measure: 120_000, checkout: 90_000, numline: 75_000 } as const;
// The Oct 2026 puzzle score shape (puzzleScoreRev 1) lines; stored rounds keep their old scoring (anchors below).
const SCORE_LINES = {
  measure: "30, 35, 45 for puzzles 1-3, moves limited; all four for 120, more for few moves and speed",
  checkout: "22-32 per board; all five for 120, more for fewest darts and speed",
  numline: "Up to 8 per number for accuracy (120 for all 15), more if quick; far-off ones lose 1",
};
/** The same puzzle as a stored round from before the new shape (no puzzleScoreRev stamp). */
const storedCopy = <T extends object>(puzzle: T): T => {
  const { puzzleScoreRev: _rev, ...rest } = puzzle as T & { puzzleScoreRev?: number };
  return rest as T;
};
for (const type of TYPES) {
  const def = puzzleDef(type);
  ok(ACTIVE_PUZZLE_TYPES.includes(type), `${type}: not active`);
  ok(def.category === "number", `${type}: category ${def.category}`);
  ok(typesInCategory("number").includes(type), `${type}: not in the number room draw`);
  ok(def.timeLimitMs === LIMIT[type], `${type}: time limit ${def.timeLimitMs}`);
  ok(
    INTRO_SCORE[type] === SCORE_LINES[type] && SCORE_LINES[type].length <= 90,
    `${type}: intro SCORE line`,
  );
  ok(Boolean(def.instructions?.score), `${type}: no "?" help`);
  const made = generatePuzzle(type, { bankSeed: 12345 }) as unknown as Record<string, unknown>;
  ok(made["speedPar"] === 1, `${type}: speedPar stamp`);
  // Brimful's marker is 2 on new puzzles since the 13 Oct 2026 move limit (moveLimits.ts MEASURE_LIMIT_REV).
  const wantRev = type === "measure" ? MEASURE_LIMIT_REV : 1;
  ok(made[REV_KEY[type]] === wantRev, `${type}: ${REV_KEY[type]} stamp ${String(made[REV_KEY[type]])}, want ${wantRev}`);
  const { pub, priv } = splitPuzzle(made as unknown as PuzzleData);
  for (const key of PRIVATE[type]) {
    ok(!(key in (pub as unknown as Record<string, unknown>)), `${type}: ${key} reaches the phone`);
    ok(key in priv, `${type}: ${key} missing from secrets`);
  }
}
ok(MEASURE_REV === 1 && CHECKOUT_REV === 1 && NUMLINE_REV === 1, "revisions start at 1");

/* ------------------------ 2. Determinism and timing ------------------------ */

const worst: Record<string, number> = { measure: 0, checkout: 0, numline: 0 };
const generated: {
  measure: MeasurePuzzleData[];
  checkout: CheckoutPuzzleData[];
  numline: NumlinePuzzleData[];
} = { measure: [], checkout: [], numline: [] };
for (let i = 0; i < SEEDS; i++) {
  const seed = seedAt(i);
  for (const type of TYPES) {
    const t0 = performance.now();
    const a = generatePuzzle(type, { bankSeed: seed });
    worst[type] = Math.max(worst[type]!, performance.now() - t0);
    const b = generatePuzzle(type, { bankSeed: seed });
    ok(
      JSON.stringify(a) === JSON.stringify(b),
      `${type} seed ${seed}: same seed, different puzzle`,
    );
    (generated[type] as PuzzleData[]).push(a);
  }
}
for (const type of TYPES) {
  const distinct = new Set((generated[type] as PuzzleData[]).map((p) => JSON.stringify(p))).size;
  ok(
    distinct >= Math.floor(SEEDS * 0.95),
    `${type}: only ${distinct} distinct puzzles from ${SEEDS} seeds`,
  );
  ok(
    worst[type]! < 1_000,
    `${type}: slowest generation ${worst[type]!.toFixed(0)} ms (limit 1,000)`,
  );
}
ok(
  JSON.stringify(generateMeasure(77)) === JSON.stringify(generateMeasure(77)),
  "measure: direct seed repeat",
);
ok(
  JSON.stringify(generateCheckout(77)) === JSON.stringify(generateCheckout(77)),
  "checkout: direct seed repeat",
);
ok(
  JSON.stringify(generateNumline(77)) === JSON.stringify(generateNumline(77)),
  "numline: direct seed repeat",
);
// A number-only room built twice from one seed: same order, and these three games' puzzles
// identical. (Other games generate once at room start and are stored; only these three
// are rebuilt from the seed, so only they are compared.)
let roomsWithNew = 0;
for (let i = 0; i < 40; i++) {
  const seed = seedAt(i + 999);
  const one = buildRoomPuzzles({ categories: ["number"], seed });
  const two = buildRoomPuzzles({ categories: ["number"], seed });
  ok(
    one.roundOrder.join() === two.roundOrder.join(),
    `number room seed ${seed}: different round order`,
  );
  one.puzzles.forEach((puzzle, k) => {
    if (!(TYPES as readonly string[]).includes(puzzle.type)) return;
    roomsWithNew++;
    ok(
      JSON.stringify(puzzle) === JSON.stringify(two.puzzles[k]),
      `number room seed ${seed}: ${puzzle.type} differs`,
    );
  });
}
ok(roomsWithNew > 0, "no number room drew Brimful, Checkout or Ballpark");

/* ------------------------------ 3. Brimful BFS ------------------------------ */

/** Independent search: states as strings, moves applied from first principles. */
function bfsMinimum(board: MeasureBoardData, goal: (a: number[]) => boolean): number {
  const caps = board.caps;
  const seen = new Set([board.start.join(",")]);
  let frontier = [board.start.slice()];
  if (goal(frontier[0]!)) return 0;
  for (let depth = 1; frontier.length; depth++) {
    const next: number[][] = [];
    for (const s of frontier) {
      const out: number[][] = [];
      for (let i = 0; i < caps.length; i++) {
        if (board.tap) {
          out.push(s.map((v, k) => (k === i ? caps[i]! : v)));
          out.push(s.map((v, k) => (k === i ? 0 : v)));
        }
        for (let j = 0; j < caps.length; j++) {
          if (i === j) continue;
          const m = Math.min(s[i]!, caps[j]! - s[j]!);
          out.push(s.map((v, k) => (k === i ? v - m : k === j ? v + m : v)));
        }
      }
      for (const t of out) {
        const id = t.join(",");
        if (seen.has(id)) continue;
        seen.add(id);
        if (goal(t)) return depth;
        next.push(t);
      }
    }
    frontier = next;
  }
  return -1;
}
const BANDS = [
  [4, 6],
  [6, 9],
  [8, 11],
  [10, 14],
] as const;
let boardsProved = 0;
for (const p of generated.measure) {
  ok(
    p.boards.length === 4 && (p.minMoves ?? []).length === 4 && (p.solutions ?? []).length === 4,
    "measure: four boards with minimums and routes",
  );
  p.boards.forEach((board, i) => {
    const goal =
      board.goal === "split"
        ? (a: number[]) => a.every((v, k) => v === board.split![k])
        : (a: number[]) => a.includes(board.target!);
    const min = bfsMinimum(board, goal);
    boardsProved++;
    ok(
      min === p.minMoves![i],
      `measure board ${i + 1}: stored minimum ${p.minMoves![i]}, BFS ${min}`,
    );
    ok(
      min >= BANDS[i]![0] && min <= BANDS[i]![1],
      `measure board ${i + 1}: minimum ${min} outside ${BANDS[i]!.join("-")}`,
    );
    ok(min > 2, `measure board ${i + 1}: reachable in two moves`);
    const route = replayMeasure(board, decodeMeasureActions(p.solutions![i]!, board.caps.length));
    ok(
      route.solved && route.moves === min,
      `measure board ${i + 1}: stored route does not solve in ${min}`,
    );
    if (i < 3) {
      ok(
        board.tap && board.goal === "amount" && board.caps.length === (i < 2 ? 2 : 3),
        `measure board ${i + 1}: shape`,
      );
      ok(
        board.caps.every((c) => c >= 3 && c <= 15) &&
          new Set(board.caps).size === board.caps.length,
        `measure board ${i + 1}: capacities ${board.caps}`,
      );
      ok(
        !board.caps.includes(board.target!) &&
          board.target! > 0 &&
          board.target! <= Math.max(...board.caps),
        `measure board ${i + 1}: target ${board.target} vs ${board.caps}`,
      );
      ok(
        board.start.every((v) => v === 0),
        `measure board ${i + 1}: starts empty`,
      );
    } else {
      const largest = Math.max(...board.caps);
      ok(
        !board.tap && board.goal === "split" && board.caps.length === 3,
        "measure board 4: no tap, three jugs, a split",
      );
      ok(
        board.start.join(",") === board.caps.map((c) => (c === largest ? c : 0)).join(","),
        "measure board 4: largest jug full",
      );
      const s = board.split!;
      ok(
        s.reduce((a, b) => a + b, 0) === largest &&
          s.every((v, k) => v >= 0 && v <= board.caps[k]!),
        "measure board 4: split keeps the water",
      );
      ok(
        (s[0] === s[1] && s[0]! > 0) ||
          (s[1] === s[2] && s[1]! > 0) ||
          (s[0] === s[2] && s[0]! > 0),
        `measure board 4: no two equal jugs in ${s}`,
      );
    }
  });
}

/* --------------------------- 4. Checkout search ---------------------------- */

/** Independent ordered search: fewest darts and how many ordered routes exist. */
function orderedSearch(stage: CheckoutStageData): { min: number | null; ordered: number } {
  const darts: CheckoutDart[] = [];
  const rings = stage.quad ? 4 : 3;
  for (let w = 0; w < 20; w++) for (let r = 1; r <= rings; r++) darts.push({ wedge: w, ring: r });
  darts.push({ wedge: CHECKOUT_BULL, ring: 1 }, { wedge: CHECKOUT_BULL, ring: 2 });
  const value = (d: CheckoutDart) =>
    (d.wedge === CHECKOUT_BULL ? 25 : stage.wedges[d.wedge]!) * d.ring;
  let min: number | null = null;
  let ordered = 0;
  const walk = (left: number, used: number) => {
    if (
      used > 0 &&
      left === 0 &&
      last?.ring === stage.finish &&
      (!stage.exactDarts || used === stage.maxDarts)
    ) {
      ordered++;
      if (min === null || used < min) min = used;
    }
    if (used === stage.maxDarts) return;
    for (const d of darts) {
      const prev = last;
      last = d;
      walk(left - value(d), used + 1);
      last = prev;
    }
  };
  let last: CheckoutDart | null = null;
  walk(stage.target, 0);
  return { min, ordered };
}
const greedyIndependent = (stage: CheckoutStageData): boolean => {
  const values = checkoutOptions(stage).map((d) => checkoutDartValue(stage, d));
  let left = stage.target;
  for (let n = 1; n <= stage.maxDarts; n++) {
    const best = Math.max(...values.filter((v) => v <= left));
    if (!Number.isFinite(best)) return false;
    left -= best;
    if (left === 0) {
      const finishes = checkoutOptions(stage).some(
        (d) => d.ring === stage.finish && checkoutDartValue(stage, d) === best,
      );
      return finishes && (!stage.exactDarts || n === stage.maxDarts);
    }
  }
  return false;
};
// Ordered search on stage 5 (four darts) is ~14M sequences: prove a sample of puzzles in full, the rest by the stored route.
const FULL_PROOFS = Math.min(generated.checkout.length, 12);
let stagesProved = 0;
generated.checkout.forEach((p, n) => {
  ok(
    p.stages.length === 5 && (p.minDarts ?? []).length === 5 && (p.routes ?? []).length === 5,
    "checkout: five stages with minimums and routes",
  );
  p.stages.forEach((stage, i) => {
    const [lo, hi] = CHECKOUT_TARGETS[i]!;
    ok(stage.target >= lo && stage.target <= hi, `checkout stage ${i + 1}: target ${stage.target}`);
    ok(stage.wedges.length === 20, `checkout stage ${i + 1}: 20 wedges`);
    const route = decodeCheckoutDarts(p.routes![i]!, stage.maxDarts);
    ok(
      checkoutValid(stage, route) && route.length === p.minDarts![i],
      `checkout stage ${i + 1}: stored route invalid or not the stored minimum`,
    );
    if (i === 0)
      ok(
        stage.wedges.join() === CHECKOUT_STANDARD.join() &&
          stage.finish === 2 &&
          stage.maxDarts === 3,
        "checkout stage 1: standard board, double, 3 darts",
      );
    if (i === 1)
      ok(
        [...stage.wedges].sort((a, b) => a - b).join() ===
          Array.from({ length: 20 }, (_, k) => k + 1).join() && stage.finish === 2,
        "checkout stage 2: 1-20 shuffled",
      );
    if (i === 2 || i === 3) {
      ok(
        new Set(stage.wedges).size === 20 && stage.wedges.every((v) => v >= 5 && v <= 60),
        `checkout stage ${i + 1}: 20 distinct values 5-60`,
      );
      ok(
        i === 2 ? stage.finish === 2 && !stage.quad : stage.finish === 3 && stage.quad === true,
        `checkout stage ${i + 1}: finish and x4 ring`,
      );
    }
    if (i === 4) {
      ok(
        stage.wedges.filter((v) => v < 0).length === 2 &&
          stage.exactDarts === true &&
          stage.maxDarts === 4 &&
          stage.finish === 2,
        "checkout stage 5: two negatives, exactly 4 darts, double",
      );
      ok(p.minDarts![i] === 4, "checkout stage 5: minimum is 4 by definition");
    }
    if (i >= 2)
      ok(
        !greedyIndependent(stage),
        `checkout stage ${i + 1}: biggest-dart-first finishes ${stage.target}`,
      );
    if (n < FULL_PROOFS || i < 4) {
      const search = orderedSearch(stage);
      stagesProved++;
      ok(
        search.min === p.minDarts![i],
        `checkout stage ${i + 1}: stored fewest ${p.minDarts![i]}, exhaustive ${search.min}`,
      );
      if (i <= 1)
        ok(
          search.ordered >= CHECKOUT_MIN_ROUTES,
          `checkout stage ${i + 1}: only ${search.ordered} routes`,
        );
    }
  });
});

/* ------------------------------ 5. Ballpark rules ------------------------------ */

for (const p of generated.numline) {
  ok(
    p.stages.length === 3 && p.stages.every((s) => s.items.length === 5),
    "numline: three lines of five",
  );
  ok(
    p.stages[0]!.lo === 0 &&
      p.stages[0]!.hi === 1 &&
      p.stages[1]!.lo === 0 &&
      p.stages[1]!.hi === 100,
    "numline: lines 1-2 ranges",
  );
  const third = `${p.stages[2]!.lo},${p.stages[2]!.hi}`;
  ok(third === "-50,50" || third === "0,1000", `numline: line 3 range ${third}`);
  p.stages.forEach((stage, s) => {
    const values = p.values![s]!;
    const ticks = [0, 1, ...(stage.lo < 0 && stage.hi > 0 ? [numlineShare(stage, 0)] : [])];
    const bins = new Set<number>();
    values.forEach((v, i) => {
      ok(
        Number.isInteger(v.num) &&
          Number.isInteger(v.den) &&
          v.den > 0 &&
          Number.isInteger(v.root) &&
          Number.isInteger(v.rootCoef),
        `numline ${stage.items[i]}: value not stored exactly`,
      );
      if (v.rootCoef)
        ok(
          !Number.isInteger(Math.sqrt(v.root)),
          `numline ${stage.items[i]}: square root of a square`,
        );
      const share = numlineShare(stage, numlineValue(v));
      ok(
        ticks.every((t) => Math.abs(t - share) >= 0.03 - 1e-12),
        `numline ${stage.items[i]}: within 3% of a tick (${share.toFixed(4)})`,
      );
      bins.add(Math.min(4, Math.floor(share * 5)));
      if (s === 0 && /\//.test(stage.items[i]!))
        ok(
          Number(stage.items[i]!.split("/")[1]) <= 12,
          `numline ${stage.items[i]}: denominator over 12`,
        );
    });
    ok(bins.size === 5, `numline line ${s + 1}: values not spread one per fifth (${[...bins]})`);
    ok(new Set(stage.items).size === 5, `numline line ${s + 1}: repeated item`);
  });
}

/* ------------------------------ 6. Score anchors ------------------------------ */

const grade = (puzzle: PuzzleData, answer: string, ms: number, extra = {}) =>
  gradeAnswer(puzzle, answer, ms, extra).score;
const anchors: string[] = [];

// Brimful: perfect 150, minimum finish 100, best unfinished 90, nothing 0.
{
  const p = generatePuzzle("measure", { bankSeed: 4242 }) as MeasurePuzzleData;
  const perfect = p.solutions!.join("|");
  /** A route of at least twice the minimum: two wasted moves per minimum move, then the best route. */
  const slow = p.boards.map((board, i) => {
    const waste: MeasureAction[] = [];
    const filler: MeasureAction[] = board.tap
      ? [
          { kind: "fill", jug: 0 },
          { kind: "empty", jug: 0 },
        ]
      : [
          { kind: "pour", from: 0, to: 1 },
          { kind: "pour", from: 1, to: 0 },
        ];
    for (let k = 0; k < p.minMoves![i]!; k++) waste.push(...filler);
    // The fillers must not solve the board on the way.
    const route = [
      ...waste,
      { kind: "reset" } as MeasureAction,
      ...decodeMeasureActions(p.solutions![i]!, board.caps.length),
    ];
    return route.map(encodeMeasureAction).join(",");
  });
  const unfinished = [...p.solutions!.slice(0, 3), ""].join("|");
  const scores = {
    perfect: grade(p, perfect, LIMIT.measure),
    minimumFinish: grade(p, slow.join("|"), 0),
    bestUnfinished: grade(p, unfinished, LIMIT.measure),
    nothing: grade(p, "", LIMIT.measure),
  };
  ok(scores.perfect === 150, `measure perfect ${scores.perfect}`);
  ok(scores.minimumFinish === 120, `measure minimum finish ${scores.minimumFinish}`);
  ok(scores.bestUnfinished === 110, `measure best unfinished ${scores.bestUnfinished}`);
  // Stored rounds (no score stamp) keep 25 per puzzle + move points + 30 speed.
  const stored = storedCopy(p);
  ok(grade(stored, slow.join("|"), 0) === 100, `measure stored minimum finish ${grade(stored, slow.join("|"), 0)}`);
  ok(grade(stored, unfinished, LIMIT.measure) === 90, `measure stored best unfinished ${grade(stored, unfinished, LIMIT.measure)}`);
  ok(scores.nothing === 0, `measure nothing ${scores.nothing}`);
  ok(
    scores.minimumFinish > scores.bestUnfinished,
    "measure: finishing can score below not finishing",
  );
  ok(
    grade(p, perfect, LIMIT.measure, { correctCount: 99, errors: 0, reactionAvgMs: 1 }) === 150 &&
      grade(p, "", 0, { correctCount: 99 }) === 0,
    "measure: client extras change the score",
  );
  anchors.push(
    `Brimful perfect ${scores.perfect}, minimum finish ${scores.minimumFinish}, best unfinished ${scores.bestUnfinished}, nothing ${scores.nothing}`,
  );
}

// Checkout: perfect 150, minimum finish ≥ 110, best unfinished 100, nothing 0.
{
  const p = generatePuzzle("checkout", { bankSeed: 4242 }) as CheckoutPuzzleData;
  const perfect = p.routes!.join("|");
  /** The longest valid route per stage (fewest-dart bonus lost wherever a longer route exists). */
  const longest = p.stages.map((stage) => {
    const options = checkoutOptions(stage);
    for (let len = stage.maxDarts; len >= 1; len--) {
      const pick = (left: number, k: number, out: CheckoutDart[]): CheckoutDart[] | null => {
        if (k === 1) {
          const last = options.find(
            (d) => d.ring === stage.finish && checkoutDartValue(stage, d) === left,
          );
          return last ? [...out, last] : null;
        }
        for (const d of options) {
          const found = pick(left - checkoutDartValue(stage, d), k - 1, [...out, d]);
          if (found) return found;
        }
        return null;
      };
      const route = pick(stage.target, len, []);
      if (route && checkoutValid(stage, route)) return encodeCheckoutDarts(route);
    }
    return "";
  });
  const unfinished = ["", ...p.routes!.slice(1)].join("|");
  const scores = {
    perfect: grade(p, perfect, LIMIT.checkout),
    minimumFinish: grade(p, longest.join("|"), 0),
    bestUnfinished: grade(p, unfinished, LIMIT.checkout),
    nothing: grade(p, "", LIMIT.checkout),
  };
  ok(scores.perfect === 150, `checkout perfect ${scores.perfect}`);
  ok(
    scores.minimumFinish >= 120 && scores.minimumFinish <= 135,
    `checkout minimum finish ${scores.minimumFinish}`,
  );
  ok(scores.bestUnfinished === 110, `checkout best unfinished ${scores.bestUnfinished}`);
  // Stored rounds keep 18-26 per board + 2 for fewest darts + 30 speed.
  const storedMin = grade(storedCopy(p), longest.join("|"), 0);
  ok(storedMin >= 110 && storedMin <= 120, `checkout stored minimum finish ${storedMin}`);
  ok(grade(storedCopy(p), unfinished, LIMIT.checkout) === 100, "checkout stored best unfinished");
  ok(scores.nothing === 0, `checkout nothing ${scores.nothing}`);
  ok(
    scores.minimumFinish > scores.bestUnfinished,
    "checkout: finishing can score below not finishing",
  );
  // A wrong ring, a dart too many, or a wrong total never counts.
  const s1 = p.stages[0]!;
  const bad = decodeCheckoutDarts(p.routes![0]!, s1.maxDarts).map((d, k, all) =>
    k === all.length - 1 ? { ...d, ring: d.wedge === CHECKOUT_BULL ? 1 : 1 } : d,
  );
  ok(!checkoutValid(s1, bad), "checkout: a single cannot finish a double-out");
  ok(
    grade(p, perfect, LIMIT.checkout, { correctCount: 0 }) === 150,
    "checkout: client extras change the score",
  );
  anchors.push(
    `Checkout perfect ${scores.perfect}, minimum finish ${scores.minimumFinish}, best unfinished ${scores.bestUnfinished}, nothing ${scores.nothing}`,
  );
}

// Ballpark: perfect 150, best unfinished 112, nothing 0; placing another item never lowers the score.
{
  const p = generatePuzzle("numline", { bankSeed: 4242 }) as NumlinePuzzleData;
  const truths = p.stages.flatMap((stage, s) =>
    p.values![s]!.map((v) => Math.round(numlineShare(stage, numlineValue(v)) * NUMLINE_SCALE)),
  );
  const scores = {
    perfect: grade(p, truths.join(","), LIMIT.numline),
    bestUnfinished: grade(p, truths.slice(0, 14).join(","), LIMIT.numline),
    nothing: grade(p, "", LIMIT.numline),
    carelessFinish: grade(p, truths.map((t) => (t > 5000 ? 0 : 10_000)).join(","), LIMIT.numline),
  };
  ok(scores.perfect === 150, `numline perfect ${scores.perfect}`);
  ok(scores.bestUnfinished === 110, `numline best unfinished ${scores.bestUnfinished}`);
  ok(grade(storedCopy(p), truths.slice(0, 14).join(","), LIMIT.numline) === 112, "numline stored best unfinished 112");
  ok(scores.nothing === 0, `numline nothing ${scores.nothing}`);
  ok(scores.carelessFinish <= 3, `numline careless fast finish earns ${scores.carelessFinish}`);
  let rng = 7;
  const next = () => (rng = (rng * 1_103_515_245 + 12_345) >>> 0) / 2 ** 32;
  for (let run = 0; run < 400; run++) {
    const spread = [0.005, 0.03, 0.1, 0.4][run % 4]!;
    const placements = truths.map((t) =>
      Math.max(
        0,
        Math.min(NUMLINE_SCALE, Math.round(t + (next() * 2 - 1) * spread * NUMLINE_SCALE)),
      ),
    );
    const ms = Math.floor(next() * LIMIT.numline);
    // Stored rounds: placing another item never lowers the score. New rounds: only a wild placement
    // (25 % or more off the line) can, by its 1-point cost.
    let previous = -1;
    let previousStored = -1;
    for (let k = 0; k <= 15; k++) {
      const score = grade(p, placements.slice(0, k).join(","), ms);
      const storedScore = grade(storedCopy(p), placements.slice(0, k).join(","), ms);
      const wild = k > 0 && Math.abs(placements[k - 1]! - truths[k - 1]!) >= 0.25 * NUMLINE_SCALE;
      ok(score >= previous - (wild ? 1 : 0), `numline: placing item ${k} lowered the score ${previous} → ${score}`);
      ok(storedScore >= previousStored, `numline stored: placing item ${k} lowered the score ${previousStored} → ${storedScore}`);
      ok(score >= 0 && score <= 150, `numline: score ${score} outside 0-150`);
      previous = score;
      previousStored = storedScore;
    }
  }
  ok(
    grade(p, truths.join(","), LIMIT.numline, { correctCount: 0, errors: 99 }) === 150,
    "numline: client extras change the score",
  );
  anchors.push(
    `Ballpark perfect ${scores.perfect}, best unfinished ${scores.bestUnfinished} (finishing only adds), careless fast finish ${scores.carelessFinish}, nothing ${scores.nothing}`,
  );
}

// Fuzz: arbitrary answers stay within 0-150 for all three.
{
  let rng = 99;
  const next = () => (rng = (rng * 1_103_515_245 + 12_345) >>> 0) / 2 ** 32;
  const tokens = [
    "F0",
    "F1",
    "F2",
    "E0",
    "E1",
    "E2",
    "P0-1",
    "P1-0",
    "P0-2",
    "P2-1",
    "R",
    "x",
    "0:3",
    "20:2",
    "5:2",
    "19:4",
    "7:1",
    "|",
    ",",
    "5000",
    "10000",
    "-3",
  ];
  for (const type of TYPES) {
    for (let i = 0; i < 60; i++) {
      const p = generated[type][i % generated[type].length]! as PuzzleData;
      const answer = Array.from(
        { length: Math.floor(next() * 80) },
        () => tokens[Math.floor(next() * tokens.length)],
      ).join(next() < 0.5 ? "," : "");
      const score = grade(p, answer, Math.floor(next() * LIMIT[type]));
      ok(Number.isInteger(score) && score >= 0 && score <= 150, `${type}: fuzz score ${score}`);
    }
  }
}

// The reveal shows the stored score for real graded answers.
for (const type of TYPES) {
  const p = generatePuzzle(type, { bankSeed: 31337 });
  const answers =
    type === "measure"
      ? [
          (p as MeasurePuzzleData).solutions!.join("|"),
          (p as MeasurePuzzleData).solutions!.slice(0, 2).join("|"),
        ]
      : type === "checkout"
        ? [
            (p as CheckoutPuzzleData).routes!.join("|"),
            ["", ...(p as CheckoutPuzzleData).routes!.slice(1, 3)].join("|"),
          ]
        : ["5000,5000,5000", "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15"];
  for (const answer of answers) {
    const row = gradeAnswer(p, answer, 20_000, {});
    const html = renderToStaticMarkup(
      createElement(AnswerReveal, {
        round: 1,
        puzzle: p,
        answersReady: true,
        myAnswer: answer,
        myCorrect: row.isCorrect,
        myReactionAvgMs: null,
        myMsRemaining: row.storedMs,
        myScore: row.score,
        myExtra: row.extra,
        startedAt: 0,
        now: 0,
      }),
    );
    const shown = [...html.matchAll(/data-reveal-score="([^"]*)"/g)].map((m) => m[1]);
    ok(
      shown.length === 1 && shown[0] === String(row.score),
      `${type}: reveal shows ${shown.join(",")} for stored ${row.score}`,
    );
  }
}

/* ---------------------------- 7. Layout markers ---------------------------- */

for (const type of TYPES as readonly PuzzleType[]) {
  const def = puzzleDef(type);
  const pub = splitPuzzle(generatePuzzle(type, { bankSeed: 5 })).pub;
  const html = renderToStaticMarkup(
    createElement(def.Stage, {
      puzzle: pub,
      phaseStartedAt: 0,
      now: 0,
      locked: false,
      onSubmit: () => {},
      stateKey: `number-batch-${type}`,
    }),
  );
  ok(
    /user-select:none/.test(html) && /-webkit-touch-callout:none/.test(html),
    `${type}: game root lacks user-select / touch-callout none`,
  );
  ok(
    /data-game-arena/.test(html) && /data-game-controls/.test(html),
    `${type}: arena and controls markers`,
  );
  if (type === "numline")
    ok(
      /touch-action:none/.test(html) && /overscroll-behavior:none/.test(html),
      "numline: drag arena lacks touch-action / overscroll none",
    );
  ok(
    renderToStaticMarkup(createElement(def.IntroExample)).length > 0,
    `${type}: intro example renders`,
  );
}

console.log(
  `Generation (worst of ${SEEDS} seeds): Brimful ${worst["measure"]!.toFixed(1)} ms, Checkout ${worst["checkout"]!.toFixed(1)} ms, Ballpark ${worst["numline"]!.toFixed(1)} ms`,
);
console.log(`Brimful: ${boardsProved} board minimums re-proved by independent BFS`);
console.log(
  `Checkout: ${stagesProved} stages re-proved by ordered exhaustive search (stage 5 in full on ${FULL_PROOFS} puzzles)`,
);
for (const line of anchors) console.log(line);
if (failures) {
  console.log(`FAIL: ${failures} of ${checks} number-batch checks`);
  process.exit(1);
}
console.log(`PASS: ${checks} number-batch checks (Brimful, Checkout, Ballpark)`);
