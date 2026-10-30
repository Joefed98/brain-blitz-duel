/**
 * Joe's phone notes on five puzzles (28 Oct 2026, docs/puzzle-notes-oct-2026.md). Two change play, each on its own
 * stamp one above the scoring standard's (standard/stamps.ts); the scoring formulas are the standard's, unchanged:
 *
 * - Slider `wordSlideRev 4`: with four rows locked as words, the last row's tiles swap with each other (wordSlide.ts).
 * - Tally `countRev 6`: the second tray's question is seeded from three kinds, a colour and a shape ("How many pink
 *   circles?"), a shape alone ("How many triangles?") or a colour alone ("How many pink shapes?") (types.ts `ask`).
 *
 * The other three notes are look only (Strikeout's solved words, Integer Pyramid's gold rows, Flash's summary line).
 * A new puzzle gets these stamps only when it was dealt the standard's stamp (so a check pinning any earlier world
 * keeps what it pinned) and this batch is not pinned. Shared by phone and server, pure.
 */
import type { PuzzleData, PuzzleType } from "./types";
import { STANDARD_STAMPS, preStandardPinned } from "./standard/stamps";
import { rebuildLiveRecords } from "./roundMax";

export const SLIDER_NOTES_REV = 4;
export const TALLY_NOTES_REV = 6;

/** Each game's stamp key and the stamp it moves up to. */
export const PUZZLE_NOTES_STAMPS: Partial<Record<PuzzleType, { key: string; rev: number }>> = {
  wordslide: { key: "wordSlideRev", rev: SLIDER_NOTES_REV },
  countup: { key: "countRev", rev: TALLY_NOTES_REV },
};

let pinned = false;

/** Checks written for the standard's stamps pin new deals to them (returns the previous setting). */
export function pinPrePuzzleNotes(on: boolean): boolean {
  const prev = pinned;
  pinned = on;
  // The help texts (liveRecord) describe the stamps dealt: rebuild them for the pinned world.
  if (prev !== on) rebuildLiveRecords();
  return prev;
}

export function prePuzzleNotesPinned(): boolean {
  return pinned;
}

/** True while new Slider and Tally rounds are dealt this batch's stamps (the help texts describe them). */
export function puzzleNotesDealt(): boolean {
  return !pinned && !preStandardPinned();
}

/**
 * The stamp a new puzzle is dealt: this batch's when the puzzle carries the standard's stamp, unchanged otherwise.
 * `vary` rebuilds what the new stamp deals differently (Tally's second tray; generate.server.ts passes it).
 */
export function dealPuzzleNotes<T extends PuzzleData>(puzzle: T, vary?: (puzzle: T) => T): T {
  const notes = PUZZLE_NOTES_STAMPS[puzzle.type];
  const standard = STANDARD_STAMPS[puzzle.type];
  if (!notes || !standard || pinned) return puzzle;
  if ((puzzle as unknown as Record<string, unknown>)[notes.key] !== standard.rev) return puzzle;
  const stamped = { ...puzzle, [notes.key]: notes.rev } as T;
  return vary ? vary(stamped) : stamped;
}
