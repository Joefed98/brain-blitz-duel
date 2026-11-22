/**
 * Topsy-Turvy's Normal speed line (D4, 22 Nov 2026; Joe's option A): `gravityRev 9` is gravityRev 8 exactly (the same
 * boards, tilt limits, play, par and parts) with Normal's "full speed by" time 40 s instead of the stricter-par 32 s.
 * Measured under the human limits (scripts/pattern-logic-human-tune.ts), the elite reached 200 on about one Normal
 * board in ten at 32 s, so Hard and Expert could not sit below Normal while Expert stayed at a fifth or more; at 40 s
 * Normal is about 60 %, and the levels step down from it (docs/design/difficulty/pattern-logic.md).
 *
 * Only Normal deals move up: a level deal (a stored `level`) keeps gravityRev 8 and grades on its own level line.
 * Rounds dealt before keep gravityRev 8 and grade exactly as before (topsy-line-check against
 * scripts/fixtures/topsy-line-legacy.json.gz). Checks written for gravityRev 8 pin it with `pinPreTopsyLine(true)`.
 * Shared by phone and server, pure.
 */
import { puzzleLevel } from "@/lib/levels/levels";

import { dealPinned, setDealPin } from "./dealEra";

/** The stamp gravityRev 9 moves up from. */
export const TOPSY_LINE_FROM = 8;
/** Topsy-Turvy's Normal scoring stamp (D4). */
export const TOPSY_LINE_REV = 9;
/** Normal's full-speed time on gravityRev 9, in seconds (the stricter-par stamps' 32 s before it). */
export const TOPSY_NORMAL_FULL_BY_S = 40;

/** Checks written for gravityRev 8 deal it; returns the previous setting. */
export function pinPreTopsyLine(on: boolean): boolean {
  return setDealPin("preTopsyLine", on);
}

/** True while new Normal Topsy-Turvy rounds are dealt gravityRev 9 (the help and the challenge describe it). */
export function topsyLineDealt(): boolean {
  return !dealPinned("preTopsyLine");
}

/** A stored Topsy-Turvy puzzle on gravityRev 9 or later. */
export function usesTopsyLine(puzzle: unknown): boolean {
  const p = puzzle as { type?: string; gravityRev?: unknown } | null;
  return p?.type === "gravity" && typeof p.gravityRev === "number" && p.gravityRev >= TOPSY_LINE_REV;
}

/** The deal layer: a Normal gravityRev 8 deal moves up to gravityRev 9; anything else (or with the pin) unchanged. */
export function dealTopsyLine<T extends { type: string }>(puzzle: T): T {
  if (dealPinned("preTopsyLine") || puzzle.type !== "gravity") return puzzle;
  if ((puzzle as { gravityRev?: unknown }).gravityRev !== TOPSY_LINE_FROM || puzzleLevel(puzzle) !== "normal") return puzzle;
  return { ...puzzle, gravityRev: TOPSY_LINE_REV };
}
