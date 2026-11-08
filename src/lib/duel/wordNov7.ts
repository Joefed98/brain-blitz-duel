/**
 * The Word scoring fix (7 Nov 2026, docs/word-scoring-nov-2026.md; Code audit 5, docs/audit-nov-2026/scoring.md
 * issues 10 and 17). Three Word games on the puzzle scoring standard move up one stamp each; the board, play and clock
 * are the previous stamp's, only the grade changes (standard/word.server.ts):
 *
 * - Interlock `tileGridRev 4`: the big-word bonus is scaled to the deal's own maximum (the dealt solution's words), so
 *   the dealt solution reaches the full 30; unfinished credit counts each tile in a real word or matching the solution
 *   (the solution's grid moved anywhere on the board, or turned on its side), less the tiles placed off it, so a
 *   correct tile that runs into an unfinished word never lowers the score and scattering tiles earns nothing.
 * - Slider `wordSlideRev 5`: unfinished credit is the larger of the rows made into words (as before) and the share of
 *   tiles moved into the solution's place since the start, so the middle moves of a par line (which break rows on the
 *   way) never drop the score to 0.
 * - Lookout `wordSearchRev 5`: the miss penalty is taken after the bonus word is added (max(0, words + bonus − penalty)),
 *   so random drags that stumble on the bonus word no longer keep it.
 *
 * A new puzzle gets these stamps only when it was dealt the stamp before (the standard's for Interlock and Lookout,
 * Joe's puzzle notes' for Slider), so a check pinning any earlier world keeps what it pinned, and this batch is not
 * pinned. Shared by phone and server, pure.
 */
import type { PuzzleData, PuzzleType } from "./types";
import { preStandardPinned } from "./standard/stamps";
import { puzzleNotesDealt } from "./puzzleNotes";
import { rebuildLiveRecords } from "./roundMax";

export const INTERLOCK_REV_FAIR = 4;
export const SLIDER_REV_FAIR = 5;
export const LOOKOUT_REV_FAIR = 5;

/** Each game's stamp key, the stamp a new deal must carry to move up (`from`) and the stamp it moves up to. */
export const WORD_NOV7_STAMPS: Partial<Record<PuzzleType, { key: string; from: number; rev: number }>> = {
  tilegrid: { key: "tileGridRev", from: 3, rev: INTERLOCK_REV_FAIR },
  wordslide: { key: "wordSlideRev", from: 4, rev: SLIDER_REV_FAIR },
  wordsearch: { key: "wordSearchRev", from: 4, rev: LOOKOUT_REV_FAIR },
};

let pinned = false;

/** Checks written for the stamps before this fix pin new deals to them (returns the previous setting). */
export function pinPreWordNov7(on: boolean): boolean {
  const prev = pinned;
  pinned = on;
  // The help and intro texts (liveRecord) describe the stamps dealt: rebuild them for the pinned world.
  if (prev !== on) rebuildLiveRecords();
  return prev;
}

export function preWordNov7Pinned(): boolean {
  return pinned;
}

/** True while new rounds of `type` are dealt this fix's stamp (the help and intro texts describe it). */
export function wordNov7Dealt(type: "tilegrid" | "wordslide" | "wordsearch"): boolean {
  if (pinned || preStandardPinned()) return false;
  return type === "wordslide" ? puzzleNotesDealt() : true;
}

function stampOf(puzzle: unknown, key: string): number | null {
  const v = (puzzle as Record<string, unknown> | null)?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** True for a stored puzzle on this fix's stamp (or later). */
export function usesWordNov7(puzzle: PuzzleData | null | undefined): boolean {
  if (!puzzle) return false;
  const st = WORD_NOV7_STAMPS[puzzle.type];
  if (!st) return false;
  const v = stampOf(puzzle, st.key);
  return v !== null && v >= st.rev;
}

/** The stamp a new puzzle is dealt: this fix's when the puzzle carries the stamp before it, unchanged otherwise. */
export function dealWordNov7<T extends PuzzleData>(puzzle: T): T {
  const st = WORD_NOV7_STAMPS[puzzle.type];
  if (!st || pinned) return puzzle;
  if (stampOf(puzzle, st.key) !== st.from) return puzzle;
  return { ...puzzle, [st.key]: st.rev } as T;
}
