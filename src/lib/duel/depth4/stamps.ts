/**
 * Depth batch 4 (Pattern / Logic to 200, 25 Oct 2026; docs/depth/d4-pattern.md): the version stamps.
 *
 * Eight games raise their maximum to 200 (roundMax.ts) under a new stamp each. A puzzle carrying its game's
 * stamp at 1 scores on the depth formula (score.ts) and plays with that game's new rules (par, gems, the
 * gold crate, spare mirrors, the bigger Tessellate board, Heave's bigger warehouse, Turntable's two-rule
 * patterns). A puzzle without it (every round dealt before this change) plays and scores exactly as
 * before. Shared, pure and the same on every phone and the server.
 */
import type { PuzzleData, PuzzleType } from "../types";

/** The stamp field each game carries. */
export const D4_STAMP_FIELD = {
  unblock: "unblockRev",
  blockparty: "blockRev",
  pipes: "pipesRev",
  flow: "flowRev",
  iceslide: "slideRev",
  push: "pushRev",
  laser: "laserRev",
  rings: "ringsRev",
} as const satisfies Partial<Record<PuzzleType, string>>;

export type D4Type = keyof typeof D4_STAMP_FIELD;

/** The revision dealt today. */
export const D4_REV = 1;

export const D4_TYPES = Object.keys(D4_STAMP_FIELD) as D4Type[];

export function isD4Type(type: string | null | undefined): type is D4Type {
  return !!type && type in D4_STAMP_FIELD;
}

/** The puzzle's depth stamp (0 for a round dealt before it). */
export function d4RevOf(puzzle: unknown): number {
  const p = puzzle as { type?: string } | null;
  if (!p || !isD4Type(p.type)) return 0;
  const value = (p as Record<string, unknown>)[D4_STAMP_FIELD[p.type]];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** True when the puzzle plays and scores under the depth batch's rules. */
export function isDepth4(puzzle: PuzzleData | null | undefined): boolean {
  return d4RevOf(puzzle) >= D4_REV;
}
