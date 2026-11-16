/**
 * Operator's gaps builder (puzzle polish, 3 Nov 2026; rules in operatorGaps.ts). Server-only: the room seed's random
 * stream (withSeededRandom) picks every number, sign, gap and decoy, so every player gets the same four equations.
 *
 * Each equation starts from an answer (numbers and signs that work out left to right in whole steps), then gaps are cut
 * into it and the tray filled with the cut numbers plus decoys. Every fill is then searched (at most 4^3 × 5·4·3 = 3,840
 * per equation) so the stored puzzle is known to have between one and `maxAnswers` true fills; equation 1 keeps the
 * old rule (exactly one set of signs).
 */
import { randInt, shuffled } from "./random";
import { evaluateLeftToRight } from "./stagedRounds";
import { OPERATOR_GAPS_REV, gapSlots, joinGapSegment, operatorGapsDealt } from "./operatorGaps";
import type { EquationPuzzleData, EquationStage, Operator, PuzzleData } from "./types";
import { STANDARD_STAMPS } from "./standard/stamps";

const SIGNS: readonly Operator[] = ["+", "-", "×", "÷"];

/** One equation's recipe. */
interface Recipe {
  count: number;
  lo: number;
  hi: number;
  /** Number gaps (0 = signs only) and tray decoys. */
  numberGaps: number;
  decoys: number;
  /** Sign gaps (the rest of the signs are given). */
  signGaps: number;
  /** The answer's signs must pass this. */
  allowed: (ops: Operator[]) => boolean;
  /** The most true fills the stored equation may have. */
  maxAnswers: number;
}

/** Equation 1 signs only; 2 numbers only (tray 3 + 2 decoys); 3 mixed, no ÷; 4 the harder mix with × and ÷. */
export const OPERATOR_GAP_RECIPES: readonly Recipe[] = [
  { count: 3, lo: 2, hi: 12, numberGaps: 0, decoys: 0, signGaps: 2, allowed: () => true, maxAnswers: 1 },
  { count: 4, lo: 2, hi: 15, numberGaps: 3, decoys: 2, signGaps: 0, allowed: (ops) => new Set(ops).size >= 2, maxAnswers: 3 },
  { count: 5, lo: 2, hi: 15, numberGaps: 2, decoys: 2, signGaps: 2, allowed: (ops) => !ops.includes("÷") && new Set(ops).size >= 2, maxAnswers: 3 },
  { count: 5, lo: 2, hi: 20, numberGaps: 2, decoys: 2, signGaps: 3, allowed: (ops) => ops.includes("÷") && ops.includes("×") && new Set(ops).size >= 3, maxAnswers: 3 },
];

const MAX_TARGET = 400;

/** Every true fill of a stage (stops counting past `cap`). */
export function countGapAnswers(stage: EquationStage, cap = Infinity): number {
  const slots = gapSlots(stage);
  const signSlots = slots.filter((s) => s.kind === "sign");
  const numSlots = slots.filter((s) => s.kind === "number");
  const tray = stage.tray ?? [];
  let found = 0;
  const numbers = [...stage.numbers];
  const ops: Operator[] = stage.signs ? stage.signs.map((o) => o ?? "+") : Array(stage.numbers.length - 1).fill("+");
  const used = tray.map(() => false);
  const placeNumbers = (k: number): boolean => {
    if (k === numSlots.length) {
      if (evaluateLeftToRight(numbers, ops) === stage.target) found++;
      return found > cap;
    }
    const seen = new Set<number>();
    for (let t = 0; t < tray.length; t++) {
      if (used[t] || seen.has(tray[t]!)) continue;
      seen.add(tray[t]!);
      used[t] = true;
      numbers[numSlots[k]!.index] = tray[t]!;
      const stop = placeNumbers(k + 1);
      used[t] = false;
      if (stop) return true;
    }
    return false;
  };
  const placeSigns = (k: number): boolean => {
    if (k === signSlots.length) return placeNumbers(0);
    for (const op of SIGNS) {
      ops[signSlots[k]!.index] = op;
      if (placeSigns(k + 1)) return true;
    }
    return false;
  };
  placeSigns(0);
  return found;
}

function pickPositions(total: number, k: number): number[] {
  return shuffled(Array.from({ length: total }, (_, i) => i)).slice(0, k).sort((a, b) => a - b);
}

function buildGapStage(r: Recipe): { stage: EquationStage; answer: string } | null {
  for (let attempt = 0; attempt < 2000; attempt++) {
    const numbers = Array.from({ length: r.count }, () => randInt(r.lo, r.hi));
    const ops = Array.from({ length: r.count - 1 }, () => SIGNS[randInt(0, SIGNS.length - 1)]!);
    if (!r.allowed(ops)) continue;
    const target = evaluateLeftToRight(numbers, ops);
    if (target === null || target > MAX_TARGET) continue;
    const signGaps = new Set(pickPositions(r.count - 1, r.signGaps));
    const numberGaps = new Set(pickPositions(r.count, r.numberGaps));
    const decoys = Array.from({ length: r.decoys }, () => randInt(r.lo, r.hi));
    const cut = [...numberGaps].map((i) => numbers[i]!);
    const stage: EquationStage = {
      numbers: numbers.map((n, i) => (numberGaps.has(i) ? 0 : n)),
      target,
      signs: ops.map((o, i) => (signGaps.has(i) ? null : o)),
      ...(r.numberGaps > 0 ? { tray: shuffled([...cut, ...decoys]) } : {}),
    };
    const answers = countGapAnswers(stage, r.maxAnswers);
    if (answers < 1 || answers > r.maxAnswers) continue;
    // The answer's fills in reading order.
    const fills = gapSlots(stage).map((s) => (s.kind === "number" ? String(numbers[s.index]) : ops[s.index]!));
    return { stage, answer: joinGapSegment(fills) };
  }
  return null;
}

/** Fixed fallbacks (never reached in practice; each has one answer by construction). */
const FALLBACKS: readonly { stage: EquationStage; answer: string }[] = [
  { stage: { numbers: [7, 3, 2], target: 20, signs: [null, null] }, answer: "+,×" },
  { stage: { numbers: [0, 0, 5, 0], target: 17, signs: ["÷", "×", "-"], tray: [8, 2, 3, 11, 13] }, answer: "8,2,3" },
  { stage: { numbers: [9, 0, 4, 0, 5], target: 31, signs: [null, "×", null, "+"], tray: [3, 2, 14, 6] }, answer: "-,3,+,2" },
  { stage: { numbers: [12, 0, 7, 0, 5], target: 55, signs: [null, null, "÷", null], tray: [3, 2, 9, 17] }, answer: "+,3,+,2,×" },
];

/** The four gap equations (the room seed's stream must be set by the caller). */
export function buildOperatorGaps(): Pick<EquationPuzzleData, "stages" | "gapAnswers" | "gapsRev"> {
  const built = OPERATOR_GAP_RECIPES.map((r, i) => buildGapStage(r) ?? FALLBACKS[i]!);
  return { stages: built.map((b) => b.stage), gapAnswers: built.map((b) => b.answer), gapsRev: OPERATOR_GAPS_REV };
}

/**
 * The gaps stamp on a new Operator puzzle: when it was dealt the scoring standard's stamp (so a check pinning any
 * earlier world keeps what it pinned) and the gaps are not pinned, its equations are rebuilt with gaps from the same
 * random stream (after the old build's draws, so the deal stays the room seed's alone).
 */
export function dealOperatorGaps<T extends PuzzleData>(puzzle: T): T {
  if (!operatorGapsDealt() || puzzle.type !== "equation") return puzzle;
  // A level's deal (generateOperatorLevel) comes with its gaps already built: leave them.
  if ((puzzle as EquationPuzzleData).gapsRev !== undefined) return puzzle;
  const std = STANDARD_STAMPS.equation;
  if (!std || (puzzle as EquationPuzzleData).depthRev !== (std.dealt ?? std.rev)) return puzzle;
  const { operators: _ops, ...rest } = puzzle as EquationPuzzleData;
  return { ...rest, ...buildOperatorGaps() } as T;
}

/* ------------------------------------------------------------------ levels (stage 3, 15 Nov 2026) */

/** One equation of a level, as plain data in the level registry (src/lib/levels/gameLevels.ts). */
export interface OperatorLevelLine {
  count: number;
  lo: number;
  hi: number;
  numberGaps: number;
  signGaps: number;
  decoys: number;
  /** The signs the answer may use ("+-×÷" order) and the ones it must use. */
  signs: string;
  need?: string;
  /** The fewest different signs in the answer. */
  distinct?: number;
  maxAnswers: number;
}

export interface OperatorLevelSettings {
  /** Full fills allowed per equation (stamped as the puzzle's tryLimit, graded from it). */
  tries: number;
  lines: readonly OperatorLevelLine[];
}

function recipeOf(line: OperatorLevelLine): Recipe {
  const signs = [...line.signs] as Operator[];
  const need = [...(line.need ?? "")] as Operator[];
  return {
    count: line.count,
    lo: line.lo,
    hi: line.hi,
    numberGaps: line.numberGaps,
    decoys: line.decoys,
    signGaps: line.signGaps,
    allowed: (ops) => ops.every((o) => signs.includes(o)) && need.every((o) => ops.includes(o)) && new Set(ops).size >= (line.distinct ?? 1),
    maxAnswers: line.maxAnswers,
  };
}

/**
 * The person-like search (Joe's rule for Expert, 15 Nov 2026): a person works an equation left to right, trying a sign
 * (+ − × ÷) or a tray number in each gap in turn and dropping any line whose running total stops being a whole number
 * of 0 or more. Returns the partial lines tried before the first true fill (Infinity when there is none within `budget`).
 */
export function operatorPersonSearch(stage: EquationStage, budget = 100_000): number {
  const slots = gapSlots(stage);
  const tray = stage.tray ?? [];
  const used = tray.map(() => false);
  const numbers = [...stage.numbers];
  const ops: (Operator | null)[] = stage.signs ? [...stage.signs] : Array(stage.numbers.length - 1).fill(null);
  const isNumberGap = new Set(slots.filter((s) => s.kind === "number").map((s) => s.index));
  const isSignGap = new Set(slots.filter((s) => s.kind === "sign").map((s) => s.index));
  let nodes = 0;
  // Position p: the number at p (and, for p > 0, the sign before it), running total `value` after it.
  const step = (value: number, op: Operator, next: number): number | null => {
    if (op === "+") return value + next;
    if (op === "-") return value - next >= 0 ? value - next : null;
    if (op === "×") return value * next;
    if (next === 0 || value % next !== 0) return null;
    return value / next;
  };
  const numberChoices = (p: number): number[] => {
    if (!isNumberGap.has(p)) return [numbers[p]!];
    const seen = new Set<number>();
    const out: number[] = [];
    tray.forEach((t, i) => { if (!used[i] && !seen.has(t)) { seen.add(t); out.push(t); } });
    return out;
  };
  const useTile = (value: number): number => {
    const i = tray.findIndex((t, k) => !used[k] && t === value);
    if (i >= 0) used[i] = true;
    return i;
  };
  const walk = (p: number, value: number): boolean => {
    if (nodes > budget) return false;
    if (p === numbers.length) return value === stage.target;
    const signChoices: Operator[] = isSignGap.has(p - 1) ? SIGNS.slice() : [ops[p - 1]!];
    for (const n of numberChoices(p)) {
      const tile = isNumberGap.has(p) ? useTile(n) : -1;
      for (const op of signChoices) {
        nodes++;
        const v = step(value, op, n);
        if (v !== null && walk(p + 1, v)) { if (tile >= 0) used[tile] = false; return true; }
      }
      if (tile >= 0) used[tile] = false;
    }
    return false;
  };
  for (const n of numberChoices(0)) {
    const tile = isNumberGap.has(0) ? useTile(n) : -1;
    nodes++;
    if (walk(1, n)) return nodes;
    if (tile >= 0) used[tile] = false;
  }
  return Infinity;
}

/** The most partial lines the person-like search may need on a level's line: today's Normal deals lines up to about 780 (the hardest in 150 room seeds needed 776), so no level line asks more search than Normal already does. */
export const OPERATOR_PERSON_BUDGET = 800;

/**
 * Operator at a level (Easy, Hard, Expert): four equations from the level's lines on the room seed's stream, each with
 * between one and `maxAnswers` true fills and found by the person-like search within OPERATOR_PERSON_BUDGET; the level's
 * tries stamped as the puzzle's tryLimit (stampMoveLimits keeps it). Normal never comes here.
 */
export function generateOperatorLevel(settings: OperatorLevelSettings): EquationPuzzleData {
  const built = settings.lines.map((line, i) => {
    const recipe = recipeOf(line);
    for (let attempt = 0; attempt < 50; attempt++) {
      const b = buildGapStage(recipe);
      if (b && operatorPersonSearch(b.stage, OPERATOR_PERSON_BUDGET) <= OPERATOR_PERSON_BUDGET) return b;
    }
    return FALLBACKS[Math.min(i, FALLBACKS.length - 1)]!;
  });
  return {
    type: "equation",
    stages: built.map((b) => b.stage),
    gapAnswers: built.map((b) => b.answer),
    gapsRev: OPERATOR_GAPS_REV,
    tryLimit: settings.tries,
  } as EquationPuzzleData;
}
