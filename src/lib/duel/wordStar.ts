/**
 * The open word finds' points lines refitted (D1, 21 Nov 2026; plan section 8.2 I4 and decision 21, Joe's answer of
 * 20 Nov: "change the scoring so a real top player can reach 200", built on Normal too). Three games move up one stamp
 * each; every older stamp deals, plays and grades exactly as before (word-star-check replays scripts/fixtures/
 * word-star-legacy.json.gz, recorded on main before the refit):
 *
 * - Nucleus `wordsmithRev 6` (WORDSMITH_REV_STAR): the word points part reaches its 180 at 45 word points (the
 *   near-perfect person's median under the human limits, scripts/word-human.ts) instead of 140; the curve is rev 5's
 *   to 18 points (90), so an average or good haul scores what it did. The every-tile word still adds 20.
 * - Forage `wordHuntRev 5` (WORDHUNT_REV_STAR): base points full (150) at 44 instead of 60, feature extras full (50) at
 *   70 instead of 120; both curves are rev 4's to 27 points.
 * - Roundabout `wheelRev 6` (WHEEL_REV_STAR): speed full by 55 s instead of 40 s, and the bonus jar's 30 points full at
 *   four fifths of the jar.
 *
 * The board, the deal and every rule a player sees are the previous stamp's; only the points line moves. New deals get
 * these stamps only on top of the stamp dealt before, so a check pinning any earlier world keeps it. Checks written for
 * the stamps before pin them with `pinPreWordStar(true)`. Shared by phone and server, pure.
 */
import { dealPinned, setDealPin } from "./dealEra";
import type { PuzzleData, PuzzleType } from "./types";

export const WORDSMITH_REV_STAR = 6;
export const WORDHUNT_REV_STAR = 5;
export const WHEEL_REV_STAR = 6;

/** Each game's stamp key, the stamp a new deal must carry to move up (`from`) and the refit's stamp (`rev`). */
export const WORD_STAR_STAMPS: Partial<Record<PuzzleType, { key: string; from: number; rev: number }>> = {
  wordsmith: { key: "wordsmithRev", from: 5, rev: WORDSMITH_REV_STAR },
  wordhunt: { key: "wordHuntRev", from: 4, rev: WORDHUNT_REV_STAR },
  letterwheel: { key: "wheelRev", from: 5, rev: WHEEL_REV_STAR },
};

/** Checks written for the stamps before the refit pin new deals to them (returns the previous setting). */
export function pinPreWordStar(on: boolean): boolean {
  return setDealPin("preWordStar", on);
}

export function preWordStarPinned(): boolean {
  return dealPinned("preWordStar");
}

function stampOf(puzzle: unknown, key: string): number | null {
  const v = (puzzle as Record<string, unknown> | null)?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** True for a stored puzzle of `type` on the refit's stamp (or later). */
export function usesWordStar(puzzle: unknown, type?: PuzzleType): boolean {
  const p = puzzle as { type?: PuzzleType } | null;
  if (!p?.type || (type && p.type !== type)) return false;
  const st = WORD_STAR_STAMPS[p.type];
  if (!st) return false;
  const v = stampOf(p, st.key);
  return v !== null && v >= st.rev;
}

/** The deal layer (generate.server.ts DEAL_LAYERS, last): the refit's stamp on a puzzle carrying the one before. */
export function dealWordStar<T extends PuzzleData>(puzzle: T): T {
  const st = WORD_STAR_STAMPS[puzzle.type];
  if (!st || dealPinned("preWordStar")) return puzzle;
  if (stampOf(puzzle, st.key) !== st.from) return puzzle;
  return { ...puzzle, [st.key]: st.rev } as T;
}

/* ------------------------------------------------------------------------------------- Roundabout (rev 6) */

/** Roundabout wheelRev 6: speed full by this many seconds of play (wheelRev 4–5: STD_ROUNDABOUT.fullByS, 40). */
export const ROUNDABOUT_STAR_FULL_BY_S = 55;
/** wheelRev 6: the jar's points are full at this share of the jar's drops (4 / 5). */
export const ROUNDABOUT_STAR_JAR_FULL = { num: 4, den: 5 } as const;

/** wheelRev 6: the drops that count as a full jar, for a jar of `size` drops (at least 1). */
export function roundaboutStarJarFull(size: number): number {
  return Math.max(1, Math.ceil((Math.max(1, size) * ROUNDABOUT_STAR_JAR_FULL.num) / ROUNDABOUT_STAR_JAR_FULL.den));
}
