/**
 * Operator's gaps (puzzle polish, 3 Nov 2026, docs/puzzle-polish-nov-2026.md; `gapsRev 1`): shared by phone and server,
 * pure.
 *
 * - Equation 1 is a sign equation: every sign is a gap (as before).
 * - Equation 2 is a number equation: the signs are given and three numbers are gaps, filled from a tray of five (the
 *   three that make it true and two decoys), each tray number used at most once.
 * - Equations 3 and 4 mix both: some gaps take a sign, some a number. Equation 4 keeps its harder mix with × and ÷.
 *
 * Working stays left to right and every step must stay a whole number, never negative (`evaluateLeftToRight`). Any
 * fill that makes the equation true counts: it is worked out, never matched to one stored answer. Every equation is
 * generated with at least one answer (the server's builder starts from one, operatorGaps.server.ts).
 *
 * A gaps stage stores `numbers` with 0 at a number gap (no equation uses 0), `signs` with null at a sign gap, and the
 * `tray`. The answer segment for a stage is its gaps' fills in reading order (left to right over numbers and signs),
 * comma separated, an empty entry for an empty gap: "7,×,4". Stages, the "|" between them and the try-count suffix are
 * as before (stagedRounds.ts, moveLimits.ts).
 */
import { evaluateLeftToRight, parseOperators } from "./stagedRounds";
import { rebuildLiveRecords } from "./roundMax";
import { preStandardPinned } from "./standard/stamps";
import type { EquationPuzzleData, EquationStage, Operator, PuzzleData } from "./types";

export const OPERATOR_GAPS_REV = 1;

let pinned = false;

/** Checks written for Operator's standard stamp (signs only) pin new deals to it (returns the previous setting). */
export function pinPreOperatorGaps(on: boolean): boolean {
  const prev = pinned;
  pinned = on;
  // The help and intro texts (liveRecord) describe the stamp dealt: rebuild them for the pinned world.
  if (prev !== on) rebuildLiveRecords();
  return prev;
}

/** True while new Operator rounds are dealt the gaps stamp (the help and intro describe it). */
export function operatorGapsDealt(): boolean {
  return !pinned && !preStandardPinned();
}

const SIGNS: readonly Operator[] = ["+", "-", "×", "÷"];

/** True for a stored Operator puzzle on the gaps stamp. */
export function usesOperatorGaps(puzzle: PuzzleData | null | undefined): boolean {
  return !!puzzle && puzzle.type === "equation" && (puzzle.gapsRev ?? 0) >= OPERATOR_GAPS_REV;
}

export type GapKind = "number" | "sign";

/** One gap: its kind and its index into the stage's `numbers` or `signs`. */
export interface GapSlot {
  kind: GapKind;
  index: number;
}

/** The stage's gaps in reading order (number 0, sign 0, number 1, …). A stage with no `signs` is all sign gaps. */
export function gapSlots(stage: EquationStage): GapSlot[] {
  const out: GapSlot[] = [];
  const n = stage.numbers.length;
  for (let i = 0; i < n; i++) {
    if (stage.tray && stage.numbers[i] === 0) out.push({ kind: "number", index: i });
    if (i < n - 1 && (!stage.signs || stage.signs[i] === null || stage.signs[i] === undefined)) out.push({ kind: "sign", index: i });
  }
  return out;
}

/** A segment's entries, one per gap ("" for an empty one). */
export function splitGapSegment(segment: string | null | undefined, gaps: number): string[] {
  const parts = (segment ?? "").split(",");
  return Array.from({ length: gaps }, (_, i) => (parts[i] ?? "").trim());
}

/** The segment for a stage's fills (null or "" for an empty gap). */
export function joinGapSegment(fills: ReadonlyArray<string | null>): string {
  // An all-empty stage is "" (as an untouched old stage), so a blank draft reads the same either way.
  return fills.every((f) => !f) ? "" : fills.map((f) => f ?? "").join(",");
}

/** How many times each tray number may be used. */
function trayCounts(tray: readonly number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const v of tray) counts.set(v, (counts.get(v) ?? 0) + 1);
  return counts;
}

/**
 * The stage's numbers and signs with the fills in, or null when a gap is empty, a sign gap holds no sign, a number
 * gap a number not in the tray, or a tray number is used more often than the tray holds it.
 */
export function fillGapStage(stage: EquationStage, segment: string | null | undefined): { numbers: number[]; ops: Operator[] } | null {
  const slots = gapSlots(stage);
  const fills = splitGapSegment(segment, slots.length);
  const numbers = [...stage.numbers];
  const ops: (Operator | null)[] = Array.from({ length: Math.max(0, stage.numbers.length - 1) }, (_, i) => stage.signs?.[i] ?? null);
  const left = trayCounts(stage.tray ?? []);
  for (const [k, slot] of slots.entries()) {
    const fill = fills[k]!;
    if (!fill) return null;
    if (slot.kind === "sign") {
      if (!(SIGNS as readonly string[]).includes(fill)) return null;
      ops[slot.index] = fill as Operator;
    } else {
      if (!/^\d{1,3}$/.test(fill)) return null;
      const v = Number(fill);
      const n = left.get(v) ?? 0;
      if (n <= 0) return null;
      left.set(v, n - 1);
      numbers[slot.index] = v;
    }
  }
  if (ops.some((o) => o === null)) return null;
  return { numbers, ops: ops as Operator[] };
}

/** The value a stage's fills work out to left to right (null when incomplete, invalid, or a step isn't whole). */
export function gapStageValue(stage: EquationStage, segment: string | null | undefined): number | null {
  const filled = fillGapStage(stage, segment);
  return filled ? evaluateLeftToRight(filled.numbers, filled.ops) : null;
}

/** True when the fills make the equation true (any fill that does counts). */
export function gapStageCorrect(stage: EquationStage, segment: string | null | undefined): boolean {
  return gapStageValue(stage, segment) === stage.target;
}

/** True when every gap of the stage holds something (a full fill is a try). */
export function gapStageFull(stage: EquationStage, segment: string | null | undefined): boolean {
  const slots = gapSlots(stage);
  return slots.length > 0 && splitGapSegment(segment, slots.length).every((f) => f.length > 0);
}

/** One equation's verdict on either stamp: the gaps rule on gapsRev, the operators-only rule before. */
export function equationVerdict(puzzle: EquationPuzzleData, stageIndex: number, segment: string | null | undefined): boolean {
  const stage = puzzle.stages[stageIndex];
  if (!stage) return false;
  if (usesOperatorGaps(puzzle)) return gapStageCorrect(stage, segment);
  return evaluateLeftToRight(stage.numbers, parseOperators(segment ?? "")) === stage.target;
}

/** A gaps stage drawn as text with its fills (empty gaps as "□" for a number, "○" for a sign). */
export function gapStageText(stage: EquationStage, segment: string | null | undefined): string {
  const slots = gapSlots(stage);
  const fills = splitGapSegment(segment, slots.length);
  const numberFill = new Map<number, string>();
  const signFill = new Map<number, string>();
  slots.forEach((s, k) => (s.kind === "number" ? numberFill : signFill).set(s.index, fills[k] ?? ""));
  const shown = (op: string) => (op === "-" ? "−" : op);
  const parts: string[] = [];
  stage.numbers.forEach((n, i) => {
    parts.push(numberFill.has(i) ? numberFill.get(i) || "□" : String(n));
    if (i < stage.numbers.length - 1) parts.push(signFill.has(i) ? shown(signFill.get(i) || "○") : shown(stage.signs?.[i] ?? "○"));
  });
  return `${parts.join(" ")} = ${stage.target}`;
}
