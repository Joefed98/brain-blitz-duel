/**
 * The scoring standard's stamps (27 Oct 2026, docs/scoring-standard.md). Each of the 46 games moves its own live
 * stamp up by one; a puzzle carrying that stamp (or later) is graded by the standard (grade.server.ts), every older
 * puzzle exactly as before. generatePuzzle deals the new stamp (`dealStandard`) unless a check pins the world
 * before it (`pinPreStandard`). Shared by phone and server, pure.
 */
import type { PuzzleData, PuzzleType } from "../types";
import { rebuildLiveRecords } from "../roundMax";

export interface StandardStamp {
  /** The stamp's key on the stored puzzle. */
  key: string;
  /** The live stamp before the standard (what generatePuzzle deals with the standard pinned off). */
  live: number;
  /** The standard's stamp, one above `live`. */
  rev: number;
  /** The game's "how early" extras need part times: the phone appends a draft timeline (timeline.ts). */
  timed?: boolean;
  /** A rule the standard's stamp deals with it (Colour Flood's move limit), applied to the newly stamped puzzle. */
  deal?: (puzzle: PuzzleData) => PuzzleData;
}

export const s = (key: string, live: number, timed = true, deal?: StandardStamp["deal"]): StandardStamp => ({ key, live, rev: live + 1, timed, ...(deal ? { deal } : {}) });

/** Every game on the standard, by category. */
export const STANDARD_STAMPS: Partial<Record<PuzzleType, StandardStamp>> = {
  // Word (word.server.ts; numbers and texts in word.ts)
  tilegrid: s("tileGridRev", 2),
  wordslide: s("wordSlideRev", 2),
  wordsearch: s("wordSearchRev", 3),
  letterwheel: s("wheelRev", 3),
  strikeout: s("strikeoutRev", 6),
  codeword: s("codewordRev", 4),
  swapword: s("swapwordRev", 6),

  // Number (number.server.ts)

  // Speed and Attention (attention.server.ts)

  // Pattern and Logic: Gridlock, Tessellate, Skid, Topsy-Turvy, Gradient, Turntable, Lightbender, Chroma Lines, Pipeline, Heave (pattern.server.ts)

  // Pattern and Logic: Blackout, Box Six, Hanoi, Polypotions, Safe Cracker, Bomb Defusal, Mosaic, Colour Flood, Tents and Trees, Shikaku, Lamplighter (logic.server.ts)

};

let pinned = false;

/** Checks written for the stamps before the standard pin new deals to them (returns the previous setting). */
export function pinPreStandard(on: boolean): boolean {
  const prev = pinned;
  pinned = on;
  // The help and intro texts (liveRecord) describe the stamps dealt: rebuild them for the pinned world.
  if (prev !== on) rebuildLiveRecords();
  return prev;
}

export function preStandardPinned(): boolean {
  return pinned;
}

function stampOf(puzzle: unknown, key: string): number | null {
  const v = (puzzle as Record<string, unknown> | null)?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** True for a stored puzzle on its game's standard stamp. */
export function usesStandard(puzzle: PuzzleData | null | undefined): boolean {
  if (!puzzle) return false;
  const st = STANDARD_STAMPS[puzzle.type];
  if (!st) return false;
  const v = stampOf(puzzle, st.key);
  return v !== null && v >= st.rev;
}

/** True when the phone should append a draft timeline to this puzzle's answers. */
export function standardTimesParts(puzzle: PuzzleData | null | undefined): boolean {
  return usesStandard(puzzle) && STANDARD_STAMPS[puzzle!.type]?.timed === true;
}

/**
 * The stamp a new puzzle is dealt: the standard's when the game's own rules dealt its live stamp (so a check pinning an
 * earlier batch keeps what it pinned), unchanged otherwise or while the standard is pinned off.
 */
export function dealStandard<T extends PuzzleData>(puzzle: T): T {
  const st = STANDARD_STAMPS[puzzle.type];
  if (!st || pinned) return puzzle;
  if (stampOf(puzzle, st.key) !== st.live) return puzzle;
  const stamped = { ...puzzle, [st.key]: st.rev } as T;
  return st.deal ? (st.deal(stamped) as T) : stamped;
}
