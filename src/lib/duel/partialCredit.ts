/**
 * Partial-credit fixes, 7 Nov 2026 (docs/partial-credit-nov-2026.md, from the scoring audit
 * docs/audit-nov-2026/scoring.md issues 1, 3 and 4). Seven puzzles move up one stamp above the one rooms dealt:
 *
 * - Blackout, Hanoi and Polypotions `depthRev 3`, Gridlock `unblockRev 3`, Turntable `ringsRev 4`: unfinished credit is
 *   130 × the solver-distance share (how much closer the best board the player stood on is to solved, as the stored
 *   minimum counts it, net of wasted moves; puzzleProgress.ts / solverProgress.server.ts, the measure the stamp before
 *   the scoring standard used). The standard's rough counts (rings home, flasks corked, lights off, blocks cleared,
 *   segments placed) could fall while following the optimal line; the share only rises along it.
 * - Exact `depthRev 4`: unfinished credit is also 130 × the share of the solution built (each step that merges two
 *   numbers a solution needs brings the numbers still needed one closer to one), or the closeness curve, whichever is
 *   more: a player part-way down a solution chain no longer scores 0 because the numbers made so far are far from the
 *   target.
 * - Gradient `tilesRev 7`: a swap limit (one and a half times par, rounded up, stored as `swapLimit`, shown during
 *   play); swaps past it don't happen. Random swapping finished every deal (a median of 182, above good players);
 *   within the limit it almost never does. Unfinished credit is 130 × the swap-minimum share closed, net of half a
 *   swap for each wasted one, so random swapping earns about 0.
 *
 * The board, play and finish scoring are otherwise the previous stamp's. A new puzzle gets these stamps only when it
 * was dealt the stamp before (so a check pinning an earlier world keeps what it pinned) and this batch is not pinned
 * (`pinPrePartialCredit`). Older rounds replay and score exactly as before. Shared by phone and server, pure.
 */
import { dealPinned, setDealPin } from "./dealEra";
import type { PuzzleData, PuzzleType } from "./types";
import { STANDARD_STAMPS, preStandardPinned } from "./standard/stamps";
import { TILES_REV_LIMIT, gradientLimitFor } from "./jumbled";

export { TILES_REV_LIMIT, gradientLimitFor, gradientSwapLimit, GRADIENT_LIMIT_PER_PAR } from "./jumbled";

export const LOGIC_REV_PARTIAL = 3;
export const UNBLOCK_REV_PARTIAL = 3;
export const RINGS_REV_PARTIAL = 4;
export const EXACT_REV_PARTIAL = 4;

/** Each game's stamp key and the stamp it moves up to. */
export const PARTIAL_CREDIT_STAMPS: Partial<Record<PuzzleType, { key: string; rev: number }>> = {
  lightsout: { key: "depthRev", rev: LOGIC_REV_PARTIAL },
  tower: { key: "depthRev", rev: LOGIC_REV_PARTIAL },
  tubes: { key: "depthRev", rev: LOGIC_REV_PARTIAL },
  unblock: { key: "unblockRev", rev: UNBLOCK_REV_PARTIAL },
  rings: { key: "ringsRev", rev: RINGS_REV_PARTIAL },
  target: { key: "depthRev", rev: EXACT_REV_PARTIAL },
  tiles: { key: "tilesRev", rev: TILES_REV_LIMIT },
};

/** Unfinished credit on these stamps: up to this many points by the share (no "how early" extras). */
export const PARTIAL_SHARE_POINTS = 130;

/** Gradient, unfinished: each swap that brought the board no closer cancels this much of one that did. */
export const GRADIENT_WASTE_WEIGHT = 0.5;

/** Checks written for the stamps before this batch pin new deals to them (returns the previous setting). */
export function pinPrePartialCredit(on: boolean): boolean {
  // The help and intro texts (liveRecord) follow it: setDealPin rebuilds them (dealEra.ts).
  return setDealPin("prePartialCredit", on);
}

/** True while new rounds of the seven games are dealt this batch's stamps (the help texts describe them). */
export function partialCreditDealt(): boolean {
  return !dealPinned("prePartialCredit") && !preStandardPinned();
}

function stampOf(puzzle: unknown, key: string): number | null {
  const v = (puzzle as Record<string, unknown> | null)?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** True for a stored puzzle on this batch's stamp (or later). */
export function usesPartialCredit(puzzle: PuzzleData | null | undefined): boolean {
  if (!puzzle) return false;
  const st = PARTIAL_CREDIT_STAMPS[puzzle.type];
  if (!st) return false;
  const v = stampOf(puzzle, st.key);
  return v !== null && v >= st.rev;
}

/** The stamp a new puzzle is dealt: this batch's when the puzzle carries the stamp before it, unchanged otherwise. */
export function dealPartialCredit<T extends PuzzleData>(puzzle: T): T {
  const batch = PARTIAL_CREDIT_STAMPS[puzzle.type];
  const standard = STANDARD_STAMPS[puzzle.type];
  if (!batch || !standard || dealPinned("prePartialCredit")) return puzzle;
  if (stampOf(puzzle, batch.key) !== (standard.dealt ?? standard.rev)) return puzzle;
  if (puzzle.type === "tiles") return { ...puzzle, [batch.key]: batch.rev, swapLimit: gradientLimitFor(puzzle.par ?? 0) } as T;
  return { ...puzzle, [batch.key]: batch.rev } as T;
}

/**
 * The answer reveal's note beside an unfinished round's score on these stamps (display only), from the facts the server
 * stored: "45 % of the way", or Exact's "50 % of a solution built" / "closest 12 away" (whichever paid).
 */
export function partialProgressNote(puzzle: PuzzleData | null | undefined, extra: Record<string, unknown> | null | undefined): string | null {
  if (!usesPartialCredit(puzzle) || !extra) return null;
  const num = (k: string) => (typeof extra[k] === "number" && Number.isFinite(extra[k]) ? (extra[k] as number) : null);
  if (puzzle!.type === "target") {
    const built = num("built");
    const d = num("bestDistance");
    if (extra["paidBy"] === "built" && built !== null && built > 0) return `${built} % of a solution built`;
    if (extra["paidBy"] === "close" && d !== null) return `closest ${d} away`;
    return null;
  }
  const progress = num("progress");
  return progress !== null ? `${progress} % of the way` : null;
}
