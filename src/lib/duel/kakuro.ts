/**
 * Kakuro rules (1 Nov 2026), shared by the phone, the server and the reveal. Fill the white cells with 1–9 so each run
 * adds to its clue, with no digit repeated in a run. A run is a line of white cells across or down, started by the
 * black clue cell before it.
 *
 * The answer is one character per cell, row by row: "1"…"9", or "0" for a blank (black cells always read 0). Pure;
 * integers only.
 */
import type { KakuroPuzzleData } from "./types";

export interface KakuroRun {
  /** The clue cell that starts it. */
  clue: number;
  across: boolean;
  sum: number;
  cells: number[];
}

/** Every run on the board, across runs first (in clue order), then down runs. */
export function kakuroRuns(puzzle: Pick<KakuroPuzzleData, "size" | "white" | "clues">): KakuroRun[] {
  const { size } = puzzle;
  const white = new Set(puzzle.white);
  const across: KakuroRun[] = [];
  const down: KakuroRun[] = [];
  for (const clue of puzzle.clues) {
    const r = Math.floor(clue.cell / size);
    const c = clue.cell % size;
    if (clue.right > 0) {
      const cells: number[] = [];
      for (let cc = c + 1; cc < size && white.has(r * size + cc); cc++) cells.push(r * size + cc);
      across.push({ clue: clue.cell, across: true, sum: clue.right, cells });
    }
    if (clue.down > 0) {
      const cells: number[] = [];
      for (let rr = r + 1; rr < size && white.has(rr * size + c); rr++) cells.push(rr * size + c);
      down.push({ clue: clue.cell, across: false, sum: clue.down, cells });
    }
  }
  return [...across, ...down];
}

/** Every cell's digit (0 = blank; black cells 0). */
export function decodeKakuro(answer: string, puzzle: Pick<KakuroPuzzleData, "size" | "white">): number[] {
  const n = puzzle.size * puzzle.size;
  const raw = String(answer ?? "");
  const out = new Array<number>(n).fill(0);
  for (const cell of puzzle.white) {
    const v = raw.charCodeAt(cell) - 48;
    out[cell] = v >= 1 && v <= 9 ? v : 0;
  }
  return out;
}

export function encodeKakuro(values: readonly number[]): string {
  return values.map((v) => (v >= 1 && v <= 9 ? String(v) : "0")).join("");
}

/** A run's state on the phone: full and right, over its sum or repeating a digit, or neither yet. */
export function kakuroRunState(run: KakuroRun, values: readonly number[]): "done" | "bad" | "open" {
  const digits = run.cells.map((c) => values[c] ?? 0);
  const filled = digits.filter(Boolean);
  if (new Set(filled).size !== filled.length) return "bad";
  const sum = filled.reduce((a, b) => a + b, 0);
  if (sum > run.sum) return "bad";
  if (filled.length === digits.length) return sum === run.sum ? "done" : "bad";
  return "open";
}

/** Solved by the rules alone (the board's solution is unique, so this is the solution). */
export function kakuroSolvedGrid(puzzle: Pick<KakuroPuzzleData, "size" | "white" | "clues">, values: readonly number[]): boolean {
  if (puzzle.white.some((c) => !values[c])) return false;
  return kakuroRuns(puzzle).every((run) => kakuroRunState(run, values) === "done");
}

export function kakuroSolved(puzzle: Pick<KakuroPuzzleData, "size" | "white" | "clues">, answer: string): boolean {
  return kakuroSolvedGrid(puzzle, decodeKakuro(answer, puzzle));
}

/** Progress toward the solution over the white cells: right digits, wrong digits, white cells. */
export function kakuroProgress(puzzle: KakuroPuzzleData, answer: string): { right: number; wrong: number; total: number } {
  const values = decodeKakuro(answer, puzzle);
  const sol = puzzle.solution ?? [];
  let right = 0;
  let wrong = 0;
  for (const c of puzzle.white) {
    if (!values[c]) continue;
    if (values[c] === sol[c]) right++;
    else wrong++;
  }
  return { right, wrong, total: puzzle.white.length };
}

/** The wrong digits an answer holds, as stable keys ("cell:digit") for the clean bonus. */
export function kakuroWrongKeys(puzzle: KakuroPuzzleData, answer: string): string[] {
  const values = decodeKakuro(answer, puzzle);
  const sol = puzzle.solution ?? [];
  return puzzle.white.filter((c) => values[c] && values[c] !== sol[c]).map((c) => `${c}:${values[c]}`);
}

/**
 * True when a run breaks a rule as it stands (kakuroRev 2, the Number overhaul): a repeated digit, its digits already
 * past its clue, a full run off its clue, or blanks that can no longer reach the clue with digits it hasn't used.
 */
export function kakuroRunBroken(run: KakuroRun, values: readonly number[]): boolean {
  const digits = run.cells.map((c) => values[c] ?? 0);
  const filled = digits.filter(Boolean);
  if (new Set(filled).size !== filled.length) return true;
  const sum = filled.reduce((a, b) => a + b, 0);
  const blanks = digits.length - filled.length;
  if (blanks === 0) return sum !== run.sum;
  const unused = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => !filled.includes(d));
  if (unused.length < blanks) return true;
  const least = unused.slice(0, blanks).reduce((a, b) => a + b, 0);
  const most = unused.slice(-blanks).reduce((a, b) => a + b, 0);
  return sum + least > run.sum || sum + most < run.sum;
}

/**
 * kakuroRev 2: the mistakes a run of drafts holds, as stable keys ("cell:digit"): each digit set in a square that, the
 * moment it went in, left one of that square's runs breaking a rule (kakuroRunBroken). A digit merely different from the
 * stored solution is never a mistake on its own. `drafts` are the answers in order (the timeline's drafts).
 */
export function kakuroRuleMistakeKeys(puzzle: Pick<KakuroPuzzleData, "size" | "white" | "clues">, drafts: readonly string[]): string[] {
  const runs = kakuroRuns(puzzle);
  const runsOf = new Map<number, KakuroRun[]>();
  for (const run of runs) for (const c of run.cells) runsOf.set(c, [...(runsOf.get(c) ?? []), run]);
  const seen = new Set<string>();
  let prev = new Array<number>(puzzle.size * puzzle.size).fill(0);
  for (const draft of drafts) {
    const values = decodeKakuro(draft, puzzle);
    for (const c of puzzle.white) {
      const d = values[c] ?? 0;
      if (!d || d === prev[c]) continue;
      if ((runsOf.get(c) ?? []).some((run) => kakuroRunBroken(run, values))) seen.add(`${c}:${d}`);
    }
    prev = values;
  }
  return [...seen];
}

/**
 * After a digit goes in `cell`: the next empty square of its across run (after it, then wrapping to the run's start),
 * else of its down run; null when both runs are full.
 */
export function kakuroNextEmpty(puzzle: Pick<KakuroPuzzleData, "size" | "white" | "clues">, values: readonly number[], cell: number): number | null {
  const runs = kakuroRuns(puzzle).filter((run) => run.cells.includes(cell));
  const ordered = [...runs.filter((r) => r.across), ...runs.filter((r) => !r.across)];
  for (const run of ordered) {
    const at = run.cells.indexOf(cell);
    const order = [...run.cells.slice(at + 1), ...run.cells.slice(0, at)];
    const next = order.find((c) => !values[c]);
    if (next !== undefined) return next;
  }
  return null;
}
