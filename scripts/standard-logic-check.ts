/**
 * The scoring standard, Pattern and Logic second half (docs/scoring-standard.md, "Pattern and Logic (second half)
 * decisions"): Blackout, Box Six, Hanoi, Polypotions, Safe Cracker, Bomb Defusal, Mosaic, Colour Flood, Tents and
 * Trees, Shikaku and Lamplighter on `depthRev` one above their live stamps (src/lib/duel/standard/logic.server.ts).
 *
 *   1. New deals carry the standard's stamp; pinPreStandard(true) deals the live one. Colour Flood's standard deal
 *      stores a move limit of par + 10 (par + 2 pinned), and the server ignores moves past the stored limit.
 *   2. Worked examples through the real gradeAnswer with phone-style answers (the draft timeline the stage records):
 *      finished fast, finished slow (with a mistake where the game has a bonus for none), half done; blank = 0.
 *   3. History-based clean bonuses: a wrong item entered and taken back costs the bonus; no timeline earns none.
 *   4. Kit play (8 room seeds): medians nothing ≤ spam (≤ 10) < average < good < great < near (equal only at 200);
 *      every finish ≥ 150 beats every unfinished score (≤ 130).
 *
 *   bun scripts/standard-logic-check.ts [--print]
 */
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { pinPreStandard, STANDARD_STAMPS, usesStandard } from "../src/lib/duel/standard/stamps";
import { FLOOD_STANDARD_SPARE_MOVES, LOGIC_STANDARD_TYPES, type LogicStandardType } from "../src/lib/duel/standard/logicRules";
import { decodeSudoku as decodeSudokuGrid, encodePresses, encodeSudoku } from "../src/lib/duel/logic";
import { decodeTowerMoves, encodeTowerMoves } from "../src/lib/duel/tower";
import { canPour, decodeTubeMoves, encodeTubeLog, type TubeToken } from "../src/lib/duel/tubes";
import { encodeSafeDraft, encodeSafeTries } from "../src/lib/duel/safe";
import { canonicalBombOrder, decodeBombActions, decodeBombConstraints, encodeBombActions } from "../src/lib/duel/bomb";
import { encodeNonoCells, type NonoMarks } from "../src/lib/duel/nonogram";
import { encodeFloodMoves, floodApply, floodSolved, regionSize } from "../src/lib/duel/flood";
import { encodeTents } from "../src/lib/duel/tents";
import { encodeShikaku, rectValid, type ShikakuRect } from "../src/lib/duel/shikaku";
import { encodeBulbs } from "../src/lib/duel/lightUp";
import { FLOOD_COLOURS, type PuzzleData } from "../src/lib/duel/types";
import { floodMoveLimit } from "../src/lib/duel/moveLimits";
import { kitBands, median, sentAnswer } from "./standard-lib";
import { TIMELINE_MARK } from "../src/lib/duel/standard/timeline";
import { roomPuzzle } from "./puzzle-fairness/run";

const PRINT = process.argv.includes("--print");
const started = performance.now();
const failures: string[] = [];
let checks = 0;
const fail = (msg: string) => {
  failures.push(msg);
  console.error(`FAIL ${msg}`);
};
const expect = (label: string, got: unknown, want: unknown) => {
  checks++;
  if (got !== want) fail(`${label}: got ${String(got)}, want ${String(want)}`);
};

type Of<T extends PuzzleData["type"]> = Extract<PuzzleData, { type: T }>;
type Draft = { answer: string; atMs: number };

/** The deal every worked example uses (a room deal on seed 6100). */
const SEED = 6100;
const deal = <T extends LogicStandardType>(type: T) => roomPuzzle(type, SEED) as Of<T>;

/* ------------------------------------------------------------------ 1. Stamps and Colour Flood's limit */

for (const type of LOGIC_STANDARD_TYPES) {
  const st = STANDARD_STAMPS[type]!;
  for (const seed of [11, 12, 13]) {
    const fresh = withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed })) as unknown as Record<string, unknown>;
    expect(`${type} seed ${seed}: new deal ${st.key}`, fresh[st.key], st.rev);
    expect(`${type} seed ${seed}: graded by the standard`, usesStandard(fresh as unknown as PuzzleData), true);
    const before = pinPreStandard(true);
    const old = withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed })) as unknown as Record<string, unknown>;
    pinPreStandard(before);
    expect(`${type} seed ${seed}: pinned deal ${st.key}`, old[st.key], st.live);
    if (type === "flood") {
      expect(`flood seed ${seed}: standard move limit`, fresh["moveLimit"], (fresh["par"] as number) + FLOOD_STANDARD_SPARE_MOVES);
      expect(`flood seed ${seed}: pinned move limit (par + 2)`, old["moveLimit"], (old["par"] as number) + 2);
    }
  }
}

/* ------------------------------------------------------------------ 2. Worked examples */

/** Drafts one per step, `gapMs` apart, the first at `fromMs`. */
const timed = (answers: string[], fromMs: number, gapMs: number): Draft[] => answers.map((answer, i) => ({ answer, atMs: fromMs + i * gapMs }));
/** Drafts spread evenly so the last lands at `endMs`. */
const endingAt = (answers: string[], endMs: number): Draft[] => {
  const gap = answers.length > 1 ? Math.floor(endMs / answers.length) : endMs;
  return answers.map((answer, i) => ({ answer, atMs: i === answers.length - 1 ? endMs : (i + 1) * gap }));
};
const prefixes = <T>(items: readonly T[], encode: (items: T[]) => string) => items.map((_, i) => encode(items.slice(0, i + 1)));

/** Grades drafts as the phone sends them: a finish when the last draft solves it, else at the buzzer. */
function play(p: PuzzleData, drafts: Draft[], finish: boolean) {
  const limit = puzzleTimeLimitMs(p);
  const last = drafts[drafts.length - 1]!;
  return gradeAnswer(p, sentAnswer(p, drafts), finish ? limit - last.atMs : 0);
}

interface Example {
  /** The clean solution as successive drafts. */
  solve: string[];
  /** The slow example's drafts (a mistake made and taken back where the game has a bonus for none). */
  slow: string[];
  /** Half the parts done. */
  half: string[];
}

function lightsEx(p: Of<"lightsout">): Example {
  const sol = p.solution ?? [];
  // Slow: the first cell pressed twice first (two presses over par, the board back where it started).
  const slow = [sol[0]!, sol[0]!, ...sol];
  return { solve: prefixes(sol, encodePresses), slow: prefixes(slow, encodePresses), half: prefixes(sol.slice(0, Math.floor(sol.length / 2)), encodePresses) };
}

function sudokuEx(p: Of<"sudoku">): Example {
  const sol = p.solution ?? [];
  const blanks = p.givens.map((g, c) => (g ? -1 : c)).filter((c) => c >= 0);
  const grid = [...p.givens];
  const solve: string[] = [];
  for (const c of blanks) {
    grid[c] = sol[c]!;
    solve.push(encodeSudoku(grid));
  }
  // Slow: a wrong digit in the first blank, then the right one over it.
  const wrongGrid = [...p.givens];
  wrongGrid[blanks[0]!] = (sol[blanks[0]!]! % 6) + 1;
  const half: string[] = solve.slice(0, Math.floor(blanks.length / 2));
  return { solve, slow: [encodeSudoku(wrongGrid), ...solve], half };
}

function towerEx(p: Of<"tower">): Example {
  const moves = decodeTowerMoves(p.solution ?? "");
  const first = moves[0]!;
  // Slow: the first move made and moved straight back (two moves over par), then the solution.
  const slow = [first, { from: first.to, to: first.from }, ...moves];
  return { solve: prefixes(moves, encodeTowerMoves), slow: prefixes(slow, encodeTowerMoves), half: prefixes(moves.slice(0, Math.ceil(moves.length / 2)), encodeTowerMoves) };
}

function tubesEx(p: Of<"tubes">): Example {
  const moves = decodeTubeMoves(p.solution ?? "");
  // Slow: a wrong pour, then Undo (one pour over par: Undo never gives a pour back).
  let wrong = { from: -1, to: -1 };
  for (let f = 0; f < p.tubes.length && wrong.from < 0; f++) for (let t = 0; t < p.tubes.length; t++) {
    if (f !== t && canPour(p.tubes, f, t) && (f !== moves[0]!.from || t !== moves[0]!.to)) { wrong = { from: f, to: t }; break; }
  }
  const slow: TubeToken[] = [wrong, "undo", ...moves];
  return { solve: prefixes(moves as TubeToken[], encodeTubeLog), slow: prefixes(slow, encodeTubeLog), half: prefixes(moves.slice(0, Math.floor(moves.length / 2)) as TubeToken[], encodeTubeLog) };
}

function safeEx(p: Of<"safe">): Example {
  const combo = p.combination ?? [];
  const setDials = (tries: number[][], goal: number[]) => {
    const dials = [0, 0, 0, 0];
    return goal.map((d, i) => {
      dials[i] = d;
      return encodeSafeDraft(tries, dials);
    });
  };
  const wrong = [(combo[0]! + 1) % 10, ...combo.slice(1)];
  const solve = [...setDials([], combo), encodeSafeTries([combo])];
  // Slow: opened on the second try (the first one dial out).
  const slow = [...setDials([], wrong), encodeSafeTries([wrong]), ...setDials([wrong], combo), encodeSafeTries([wrong, combo])];
  // Half: the first two dials set right, no try made.
  return { solve, slow, half: setDials([], combo).slice(0, 2) };
}

function bombEx(p: Of<"bomb">): Example {
  const required = decodeBombActions(p.required ?? p.sequence ?? "");
  const order = canonicalBombOrder(required, decodeBombConstraints(p.constraints ?? "")) ?? required;
  const solve = prefixes(order, encodeBombActions);
  return { solve, slow: solve, half: solve.slice(0, order.length / 2) };
}

function nonoEx(p: Of<"nonogram">): Example {
  const n = p.rows.length ** 2;
  const pattern = p.pattern ?? [];
  const cells = [...Array(n).keys()].filter((c) => pattern[c]);
  const enc = (filled: number[]) => {
    const marks = new Array(n).fill(0) as NonoMarks;
    for (const c of filled) marks[c] = 1;
    return encodeNonoCells(marks);
  };
  const wrongCell = [...Array(n).keys()].find((c) => !pattern[c])!;
  const solve = prefixes(cells, enc);
  // Slow: a wrong cell filled and cleared first.
  return { solve, slow: [enc([wrongCell]), enc([]), ...solve], half: solve.slice(0, Math.floor(cells.length / 2)) };
}

function floodEx(p: Of<"flood">): Example {
  const sol = p.solution ?? [];
  // Slow: par moves, slowly (Colour Flood's bonus is par: a move over is the separate over-par example).
  return { solve: prefixes(sol, encodeFloodMoves), slow: prefixes(sol, encodeFloodMoves), half: prefixes(sol.slice(0, Math.floor(sol.length / 2)), encodeFloodMoves) };
}

function tentsEx(p: Of<"tents">): Example {
  const sol = p.solution ?? [];
  const trees = new Set(p.trees);
  const solSet = new Set(sol);
  const wrongCell = [...Array(p.size * (p.height ?? p.size)).keys()].find((c) => !trees.has(c) && !solSet.has(c))!;
  const solve = prefixes(sol, encodeTents);
  return { solve, slow: [encodeTents([wrongCell]), encodeTents([]), ...solve], half: solve.slice(0, Math.floor(sol.length / 2)) };
}

function shikakuEx(p: Of<"shikaku">): Example {
  const sol = p.solution ?? [];
  const key = (r: ShikakuRect) => `${r.r0},${r.c0},${r.r1},${r.c1}`;
  const solKeys = new Set(sol.map(key));
  // A rectangle the board accepts (one clue, its area) that is not the solution's.
  let wrong: ShikakuRect | null = null;
  const rows = p.height ?? p.size;
  for (const clue of p.clues) {
    const r = Math.floor(clue.cell / p.size);
    const c = clue.cell % p.size;
    for (let h = 1; h <= clue.n && !wrong; h++) {
      if (clue.n % h) continue;
      const w = clue.n / h;
      for (let r0 = r - h + 1; r0 <= r && !wrong; r0++) for (let c0 = c - w + 1; c0 <= c && !wrong; c0++) {
        const rect = { r0, c0, r1: r0 + h - 1, c1: c0 + w - 1 };
        if (r0 < 0 || c0 < 0 || rect.r1 >= rows || rect.c1 >= p.size) continue;
        if (rectValid(rect, p.clues, p.size) && !solKeys.has(key(rect))) wrong = rect;
      }
    }
    if (wrong) break;
  }
  const solve = prefixes(sol, encodeShikaku);
  return { solve, slow: [encodeShikaku([wrong!]), encodeShikaku([]), ...solve], half: solve.slice(0, Math.floor(sol.length / 2)) };
}

function lightupEx(p: Of<"lightup">): Example {
  const sol = p.solution ?? [];
  const walls = new Set(p.walls);
  const solSet = new Set(sol);
  const wrongCell = [...Array(p.size * (p.height ?? p.size)).keys()].find((c) => !walls.has(c) && !solSet.has(c))!;
  const solve = prefixes(sol, encodeBulbs);
  return { solve, slow: [encodeBulbs([wrongCell]), encodeBulbs([]), ...solve], half: solve.slice(0, Math.floor(sol.length / 2)) };
}

const EXAMPLES: Record<LogicStandardType, (p: PuzzleData) => Example> = {
  lightsout: (p) => lightsEx(p as Of<"lightsout">),
  sudoku: (p) => sudokuEx(p as Of<"sudoku">),
  tower: (p) => towerEx(p as Of<"tower">),
  tubes: (p) => tubesEx(p as Of<"tubes">),
  safe: (p) => safeEx(p as Of<"safe">),
  bomb: (p) => bombEx(p as Of<"bomb">),
  nonogram: (p) => nonoEx(p as Of<"nonogram">),
  flood: (p) => floodEx(p as Of<"flood">),
  tents: (p) => tentsEx(p as Of<"tents">),
  shikaku: (p) => shikakuEx(p as Of<"shikaku">),
  lightup: (p) => lightupEx(p as Of<"lightup">),
};

/**
 * Expected scores on seed 6100's deals. Fast: every step 400 ms apart from 1 s (well inside each game's "full by"
 * time). Slow: the last step at the middle of the speed window (fullBy + (clock − fullBy) ÷ 2), so speed is half its
 * points. Half: half the parts, a step a second from 1 s, graded at the buzzer.
 */
const EXPECTED: Record<LogicStandardType, { fast: number; slow: number; half: number }> = {
  // Blackout (75 s, full by 20 s, par 9): fast 150 + 30 + 20. Slow: 11 presses (the first cell twice), par bonus
  // 20 × (18 − 11) ÷ 9 = 15.6 → 16, speed 30 × 27.5 ÷ 55 = 15 → 181. Half: 4 of the 9 presses leave 10 of 21 lights on,
  // 11 off: 120 × 11 ÷ 21 = 62.9, early 11 × (10 ÷ 21) × (1 − about 3 s ÷ 75) ≈ 5.0 → 68.
  lightsout: { fast: 200, slow: 181, half: 68 },
  // Box Six (90 s, full by 45 s, 22 blanks): fast 150 + 40 + 10. Slow: one wrong digit entered then corrected, clean
  // 10 − 2.5 = 7.5 → 8, speed 40 × 22.5 ÷ 45 = 20 → 178. Half: 11 cells at 1…11 s: 120 × 11 ÷ 22 = 60, early
  // (10 ÷ 22) × (11 − 66 ÷ 90) = 4.7 → 65.
  sudoku: { fast: 200, slow: 178, half: 65 },
  // Hanoi (90 s, full by 45 s, 9 rings, par 39): fast 150 + 40 + 10. Slow: 41 moves (one made and moved back), par
  // 10 × (78 − 41) ÷ 39 = 9.5 → 9, speed 20 → 179. Half: 20 of 39 moves get ring 4 home (3 were home at the start):
  // 120 × 1 ÷ 6 = 20, early (10 ÷ 6) × (1 − about 15 s ÷ 90) ≈ 1.4 → 22.
  tower: { fast: 200, slow: 179, half: 22 },
  // Polypotions (90 s, full by 45 s, par 24, 8 colours): fast 150 + 35 + 15. Slow: a wrong pour then Undo (25 pours),
  // par 15 × (48 − 25) ÷ 24 = 14.4 → 14, speed 35 ÷ 2 = 17.5 → 18 → 182. Half: 12 of 24 pours cork 1 flask of 8:
  // 120 ÷ 8 = 15, early (10 ÷ 8) × (1 − about 10 s ÷ 90) ≈ 1.1 → 16.
  tubes: { fast: 200, slow: 182, half: 16 },
  // Safe Cracker (75 s, full by 30 s): fast 150 + 40 + 10 (first try). Slow: opened on the second try at 52.5 s,
  // speed 40 × 22.5 ÷ 45 × 8 ÷ 15 = 10.7 → 11, clean 10 − 2.5 = 7.5 → 8 → 169. Half: two dials set right (no try):
  // 120 × (2 − 1) ÷ 3 = 40 (one dial is a guess), early (10 ÷ 3) × (1 − 2 ÷ 75) = 3.2 → 43.
  safe: { fast: 200, slow: 169, half: 43 },
  // Bomb Defusal (90 s, full by 30 s, 6 steps): fast 150 + 50. Slow (no bonus): defused at 60 s, speed 25 → 175.
  // Half: 3 steps at 1, 2, 3 s: 120 × 3 ÷ 6 = 60, early (10 ÷ 6) × (3 − 6 ÷ 90) = 4.9 → 65.
  bomb: { fast: 200, slow: 175, half: 65 },
  // Mosaic (120 s, full by 60 s, 34 cells): fast 150 + 40 + 10. Slow: a wrong cell filled and cleared, clean 7.5 → 8,
  // speed 20 → 178. Half: 17 cells at 1…17 s: 60 + (10 ÷ 34) × (17 − 153 ÷ 120) = 4.6 → 65.
  nonogram: { fast: 200, slow: 178, half: 65 },
  // Colour Flood (60 s, full by 30 s, par 10): fast 150 + 10 + 40. Slow: par at 45 s, speed 10 × 15 ÷ 30 = 5 → 195.
  // Half: 5 of the 10 moves flood 67 of the 194 cells outside the start region: 120 × 67 ÷ 194 = 41.4, early
  // 67 × (10 ÷ 194) × (1 − about 4 s ÷ 60) ≈ 3.3 → 45.
  flood: { fast: 200, slow: 195, half: 45 },
  // Tents and Trees (90 s, full by 45 s, 12 trees): fast 150 + 40 + 10. Slow: a wrong tent pitched and removed, 178.
  // Half: 6 tents at 1…6 s: 60 + (10 ÷ 12) × (6 − 21 ÷ 90) = 4.8 → 65.
  tents: { fast: 200, slow: 178, half: 65 },
  // Shikaku (90 s, full by 45 s, 10 × 11): fast 150 + 40 + 10. Slow: a wrong rectangle drawn and removed, 178.
  // Half: 9 of 18 rectangles cover 72 of 110 cells: 120 × 72 ÷ 110 = 78.5, early ≈ 72 × (10 ÷ 110) × (1 − about 5 s
  // ÷ 90) ≈ 6.2 → 85.
  shikaku: { fast: 200, slow: 178, half: 85 },
  // Lamplighter (90 s, full by 45 s, 19 bulbs): fast 150 + 40 + 10. Slow: a wrong bulb placed and removed, 178.
  // Half: 9 bulbs at 1…9 s: 120 × 9 ÷ 19 = 56.8, early (10 ÷ 19) × (9 − 45 ÷ 90) = 4.5 → 61.
  lightup: { fast: 200, slow: 178, half: 61 },
};

const FULL_BY_S: Record<LogicStandardType, number> = { lightsout: 20, sudoku: 45, tower: 45, tubes: 45, safe: 30, bomb: 30, nonogram: 60, flood: 30, tents: 45, shikaku: 45, lightup: 45 };

for (const type of LOGIC_STANDARD_TYPES) {
  const p = deal(type);
  const limit = puzzleTimeLimitMs(p);
  const ex = EXAMPLES[type](p);
  const slowEnd = Math.round(FULL_BY_S[type] * 1000 + (limit - FULL_BY_S[type] * 1000) / 2);
  const fast = play(p, timed(ex.solve, 1000, 400), true);
  const slow = play(p, endingAt(ex.slow, slowEnd), true);
  const half = play(p, timed(ex.half, 1000, 1000), false);
  const blank = gradeAnswer(p, "", 0);
  if (PRINT) {
    const facts = (g: ReturnType<typeof gradeAnswer>) => JSON.stringify({ parts: g.extra?.["parts"], ...Object.fromEntries(Object.entries(g.extra ?? {}).filter(([k]) => !["parts", "standard"].includes(k))) });
    console.log(`${type} (clock ${limit / 1000} s, ${ex.solve.length} steps, half ${ex.half.length}, slow end ${slowEnd} ms)`);
    console.log(`  fast ${fast.score} ${facts(fast)}`);
    console.log(`  slow ${slow.score} ${facts(slow)}`);
    console.log(`  half ${half.score} ${facts(half)}`);
  }
  expect(`${type} finished fast`, fast.score, EXPECTED[type].fast);
  expect(`${type} finished slow`, slow.score, EXPECTED[type].slow);
  expect(`${type} half done`, half.score, EXPECTED[type].half);
  expect(`${type} blank`, blank.score, 0);
  expect(`${type} fast is a finish`, fast.isCorrect, true);
  expect(`${type} half is unfinished`, half.isCorrect, false);
}

/* ------------------------------------------------------------------ 3. History-based clean bonuses */

{
  const finishMs = (p: PuzzleData) => puzzleTimeLimitMs(p) - 10_000; // 10 s used: full speed everywhere
  // Without a timeline the history is unknown: a clean game's finish earns no clean bonus (150 + 40 + 0).
  for (const type of ["sudoku", "nonogram", "tents", "shikaku", "lightup"] as const) {
    const p = deal(type);
    const ex = EXAMPLES[type](p);
    const final = ex.solve[ex.solve.length - 1]!;
    expect(`${type} finish without a timeline (no clean bonus)`, gradeAnswer(p, final, finishMs(p)).score, 190);
    // A timeline that does not rebuild the answer it came with is ignored, the same.
    const other = sentAnswer(p, timed(ex.solve.slice(0, -1), 1000, 400));
    const forged = final + other.slice(other.indexOf(TIMELINE_MARK));
    expect(`${type} finish with a timeline that does not rebuild it`, gradeAnswer(p, forged, finishMs(p)).score, 190);
  }
  // Safe Cracker's tries are in the answer itself: the clean crack needs no timeline.
  {
    const p = deal("safe");
    expect("safe first-try finish without a timeline", gradeAnswer(p, encodeSafeTries([p.combination ?? []]), finishMs(p)).score, 200);
  }
  // Box Six: two different wrong digits ever entered cost 2 × 2.5 (bonus 5 → 195); the same wrong digit entered twice
  // in one cell is one mistake (7.5 → 8, 198).
  {
    const p = deal("sudoku");
    const ex = EXAMPLES.sudoku(p);
    const sol = p.solution ?? [];
    const blanks = p.givens.map((g, c) => (g ? -1 : c)).filter((c) => c >= 0);
    const withDigit = (cell: number, digit: number) => {
      const g = [...p.givens];
      g[cell] = digit;
      return encodeSudoku(g);
    };
    const w0 = withDigit(blanks[0]!, (sol[blanks[0]!]! % 6) + 1);
    const w1 = withDigit(blanks[1]!, (sol[blanks[1]!]! % 6) + 1);
    const empty = encodeSudoku(p.givens);
    expect("sudoku two wrong digits ever", play(p, timed([w0, empty, w1, empty, ...ex.solve], 1000, 400), true).score, 195);
    expect("sudoku one wrong digit entered twice", play(p, timed([w0, empty, w0, empty, ...ex.solve], 1000, 400), true).score, 198);
  }
  // Today's unfinished points off stay: one wrong item left on a half-done board.
  const halfWith = (p: PuzzleData, half: string[], wrong: string) => play(p, [...timed(half, 1000, 1000), { answer: wrong, atMs: 1000 + half.length * 1000 }], false).score;
  {
    // Box Six: 65 − 5.
    const p = deal("sudoku");
    const ex = EXAMPLES.sudoku(p);
    const sol = p.solution ?? [];
    const grid = decodeSudokuGrid(ex.half[ex.half.length - 1]!);
    const cell = p.givens.map((g, c) => (g || grid[c] ? -1 : c)).filter((c) => c >= 0)[0]!;
    grid[cell] = (sol[cell]! % 6) + 1;
    expect("sudoku half done with a wrong digit left", halfWith(p, ex.half, encodeSudoku(grid)), 60);
  }
  {
    // Tents and Trees: 65 − 10.
    const p = deal("tents");
    const ex = EXAMPLES.tents(p);
    const sol = new Set(p.solution ?? []);
    const trees = new Set(p.trees);
    const placed = (p.solution ?? []).slice(0, ex.half.length);
    const wrong = [...Array(p.size * (p.height ?? p.size)).keys()].find((c) => !trees.has(c) && !sol.has(c))!;
    expect("tents half done with a wrong tent left", halfWith(p, ex.half, encodeTents([...placed, wrong])), 55);
  }
  {
    // Lamplighter: 61 − 5.
    const p = deal("lightup");
    const ex = EXAMPLES.lightup(p);
    const sol = new Set(p.solution ?? []);
    const walls = new Set(p.walls);
    const placed = (p.solution ?? []).slice(0, ex.half.length);
    const wrong = [...Array(p.size * (p.height ?? p.size)).keys()].find((c) => !walls.has(c) && !sol.has(c))!;
    expect("lightup half done with a wrong bulb left", halfWith(p, ex.half, encodeBulbs([...placed, wrong])), 56);
  }
}

/* ------------------------------------------------------------------ 4. Colour Flood: over par and the limit */

/** Seed 6100: par 10; a wrong first colour, then greedy, floods in 12 moves by 7.6 s: 150 + 10 + (40 − 4 × 2 = 32) = 192. */
const OVER_MOVES = 12;
const OVER_SCORE = 192;

{
  const p = deal("flood");
  expect("flood stored limit (the stage and the server read it)", floodMoveLimit(p), p.par + FLOOD_STANDARD_SPARE_MOVES);
  // Over par: a wrong first colour, then the greedy colour (most cells) until flooded.
  let grid = p.grid;
  const moves: number[] = [];
  const first = [...Array(FLOOD_COLOURS).keys()].find((c) => c !== grid[0] && c !== (p.solution ?? [])[0])!;
  grid = floodApply(grid, first);
  moves.push(first);
  while (!floodSolved(grid) && moves.length < 40) {
    let best = -1;
    let bestRegion = -1;
    for (let c = 0; c < FLOOD_COLOURS; c++) {
      if (c === grid[0]) continue;
      const r = regionSize(floodApply(grid, c));
      if (r > bestRegion) {
        best = c;
        bestRegion = r;
      }
    }
    grid = floodApply(grid, best);
    moves.push(best);
  }
  // Flooded over par well inside 30 s: 150 + 10 speed + 40 less 4 a move over par.
  expect("flood over-par moves", moves.length, OVER_MOVES);
  expect("flood over par", play(p, timed(prefixes(moves, encodeFloodMoves), 1000, 600), true).score, OVER_SCORE);
  // Moves past the stored limit never count: two alternating colours never flood this board; 30 taps keep 20.
  const [a, b] = [...Array(FLOOD_COLOURS).keys()].filter((c) => c !== p.grid[0]).slice(0, 2) as [number, number];
  const taps = Array.from({ length: 30 }, (_, i) => (i % 2 ? b : a));
  const g = gradeAnswer(p, encodeFloodMoves(taps), 0);
  expect("flood moves counted to the limit", g.extra?.["moves"], p.par + FLOOD_STANDARD_SPARE_MOVES);
  expect("flood out of moves", g.extra?.["outOfMoves"], true);
  expect("flood out of moves scores 0", g.score, 0);
}

/* ------------------------------------------------------------------ 5. Kit play */

const SEEDS = Array.from({ length: 8 }, (_, i) => 6100 + i * 7);
for (const type of LOGIC_STANDARD_TYPES) {
  const bands = kitBands(type, SEEDS);
  const med = Object.fromEntries(bands.map((b) => [b.level, median(b.scores)])) as Record<string, number>;
  if (PRINT) console.log(`${type} medians ${JSON.stringify(med)}`);
  for (const b of bands) {
    for (const sc of b.scores) {
      checks++;
      if (sc > 130 && sc < 150) fail(`${type} ${b.level}: ${sc} sits between the unfinished cap and a finish`);
    }
  }
  expect(`${type} nothing ≤ spam`, med["nothing"]! <= med["spam"]!, true);
  if (type === "flood") {
    // Colour Flood: blind colour cycling floods every banked board within par + 6 (measured on all 400), so with the
    // standard's par + 10 limit the kit's cycling spam finishes (flagged for Joe in the docs). The spam that does not
    // finish stays near 0.
    const spam = bands.find((b) => b.level === "spam")!.scores;
    const unfinished = spam.filter((sc) => sc < 150);
    console.log(`NOTE flood: ${spam.length - unfinished.length} of ${spam.length} spam plays finish (blind colour cycling within par + ${FLOOD_STANDARD_SPARE_MOVES}); unfinished spam median ${median(unfinished)}`);
    expect("flood unfinished spam median ≤ 10", median(unfinished) <= 10, true);
  } else expect(`${type} spam median ≤ 10 (${med["spam"]})`, med["spam"]! <= 10, true);
  expect(`${type} spam < average (${med["spam"]} < ${med["average"]})`, med["spam"]! < med["average"]!, true);
  for (const [lo, hi] of [["average", "good"], ["good", "great"], ["great", "near"]] as const) {
    const ok = med[lo]! < med[hi]! || (med[lo] === 200 && med[hi] === 200);
    expect(`${type} ${lo} < ${hi} (${med[lo]} < ${med[hi]})`, ok, true);
  }
}

console.log(`${checks} checks in ${((performance.now() - started) / 1000).toFixed(1)} s`);
if (failures.length) {
  console.log(`FAIL: ${failures.length} standard-logic check(s)`);
  process.exit(1);
}
console.log("PASS standard-logic-check");
