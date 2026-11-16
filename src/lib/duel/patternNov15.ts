/**
 * The Pattern overhaul (15 Nov 2026, phase 2 step 4; docs/design/game-reviews/pattern.md, Joe's agreed changes).
 *
 * Every Pattern game whose play or grading changes moves up one stamp above what it is dealt today. The board, its
 * clock and every scoring number are the previous stamp's unless the game's entry says otherwise; each entry names the
 * one rule its stamp changes. Older stamps deal, grade, replay and read exactly as before.
 *
 * The table holds one entry per game, each between its own comment lines (so per-game work never touches another
 * game's lines). An entry moves a puzzle up only when it carries exactly `from` (today's live stamp), so checks that
 * pin any earlier era keep what they pinned. Checks written for the stamps before pin new deals to them with
 * `pinPrePatternNov15(true)`. Shared by phone and server, pure.
 */
import { dealPinned, setDealPin } from "./dealEra";
import type { PuzzleType } from "./types";

export interface PatternNov15Stamp {
  /** The stored puzzle's stamp key. */
  key: string;
  /** Today's live stamp, the one this layer moves up from. */
  from: number;
  /** The new stamp. */
  to: number;
}

export const PATTERN_NOV15_STAMPS: Partial<Record<PuzzleType, PatternNov15Stamp>> = {
  // ---- Gridlock (unblock): Undo gives the move back (undo markers are no longer moves).
  unblock: { key: "unblockRev", from: 3, to: 4 },
  // ---- Tessellate (blockparty): moving a placed piece keeps "right first time"; only illegal drops count.
  blockparty: { key: "blockRev", from: 3, to: 4 },
  // ---- Pipeline (pipes): turns both ways (tap clockwise, long press or swipe anticlockwise).
  pipes: { key: "pipesRev", from: 4, to: 5 },
  // ---- Chroma Lines (flow): drawing over another colour cuts that line back.
  flow: { key: "flowRev", from: 2, to: 3 },
  // ---- Skid (iceslide): Undo gives the slide back.
  iceslide: { key: "slideRev", from: 4, to: 5 },
  // ---- Heave (push): no stamp (Undo already gives the push back; Pushes / Par shown is display only).
  // ---- Lightbender (laser): Undo undoes turns and moves too.
  laser: { key: "laserRev", from: 3, to: 4 },
  // ---- Topsy-Turvy (gravity): tilt limits from the real minimum (par + 8); the counter is the current board's.
  gravity: { key: "gravityRev", from: 7, to: 8 },
  // ---- end of table
};

/** Checks written for the stamps before the Pattern overhaul deal them; returns the previous setting. */
export function pinPrePatternNov15(on: boolean): boolean {
  return setDealPin("prePatternNov15", on);
}

export function prePatternNov15Pinned(): boolean {
  return dealPinned("prePatternNov15");
}

function stampOf(puzzle: unknown, key: string): number | null {
  const v = (puzzle as Record<string, unknown> | null)?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** The new stamp over today's live one (any other stamp, or with the pin, unchanged). */
export function dealPatternNov15<T extends { type: string }>(puzzle: T, vary?: (puzzle: T) => T): T {
  if (dealPinned("prePatternNov15")) return puzzle;
  const st = PATTERN_NOV15_STAMPS[puzzle.type as PuzzleType];
  if (!st || stampOf(puzzle, st.key) !== st.from) return puzzle;
  const stamped = { ...puzzle, [st.key]: st.to } as T;
  return vary ? vary(stamped) : stamped;
}

/** True for a stored puzzle of `type` on its Pattern overhaul stamp (or later). */
export function usesPatternNov15(puzzle: unknown, type: PuzzleType): boolean {
  const p = puzzle as { type?: string } | null;
  const st = PATTERN_NOV15_STAMPS[type];
  if (!p || p.type !== type || !st) return false;
  const v = stampOf(p, st.key);
  return v !== null && v >= st.to;
}
