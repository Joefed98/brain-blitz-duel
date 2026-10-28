/**
 * The scoring standard's stamps (27 Oct 2026, docs/scoring-standard.md). Each of the 46 games moves its own live
 * stamp up by one; a puzzle carrying that stamp (or later) is graded by the standard (grade.server.ts), every older
 * puzzle exactly as before. generatePuzzle deals the new stamp (`dealStandard`) unless a check pins the world
 * before it (`pinPreStandard`). Shared by phone and server, pure.
 */
import type { PuzzleData, PuzzleType } from "../types";
import { rebuildLiveRecords } from "../roundMax";
import { FLOOD_REV_TIGHT, floodSpareMoves } from "./logicRules";
import { TILES_REV_FAST } from "./patternRules";

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
  /**
   * The stamp new deals carry when the game's standard numbers were retuned after the standard (28 Oct 2026: Gradient
   * tilesRev 6, Colour Flood depthRev 4); `rev` when absent. Every stamp from `rev` up is graded by the standard.
   */
  dealt?: number;
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

  // Number (number.server.ts). The eight puzzles share `depthRev` (numberDepth.ts), each one above its own live value;
  // Exact is one part (no timeline). Tenfall scores in its sim (tenDrop.ts, tenRev 5): no StandardGame entry.
  target: s("depthRev", 2, false),
  equation: s("depthRev", 1),
  balance: s("depthRev", 1),
  numpyramid: s("depthRev", 1),
  trail: s("depthRev", 1),
  measure: s("depthRev", 2),
  checkout: s("depthRev", 2),
  numline: s("depthRev", 1),
  tendrop: s("tenRev", 4, false),

  // Speed and Attention (attention.server.ts; Mixed Signals scores in its sim, colourClash.ts clashRev 10). Ascend's and
  // the Chain's answers carry their own tap times and Mixed Signals is an engine game, so they need no draft timeline.
  numhunt: s("tapRev", 5, false),
  chain: s("chainDepthRev", 2, false),
  stroop: s("clashRev", 9, false),
  symscan: s("scanRev", 3),
  spotdiff: s("spotRev", 2),
  countup: s("countRev", 4),
  maze: s("mazeRev", 2),
  pairmatch: s("pairRev", 2),

  // Pattern and Logic: Gridlock, Tessellate, Skid, Topsy-Turvy, Gradient, Turntable, Lightbender, Chroma Lines, Pipeline, Heave (pattern.server.ts)
  unblock: s("unblockRev", 1),
  blockparty: s("blockRev", 2),
  iceslide: s("slideRev", 1),
  gravity: s("gravityRev", 4),
  // Gradient: full speed within 30 s from tilesRev 6 (28 Oct 2026); tilesRev 5 keeps 80 s.
  tiles: { ...s("tilesRev", 4), dealt: TILES_REV_FAST },
  rings: s("ringsRev", 2),
  // Lightbender times its gems from its own action log (the shots' times), so it needs no draft timeline.
  laser: s("laserRev", 2, false),
  flow: s("flowRev", 1),
  pipes: s("pipesRev", 2),
  push: s("pushRev", 2),

  // Pattern and Logic: Blackout, Box Six, Hanoi, Polypotions, Safe Cracker, Bomb Defusal, Mosaic, Colour Flood, Tents and Trees, Shikaku, Lamplighter (logic.server.ts)
  lightsout: s("depthRev", 1),
  sudoku: s("depthRev", 2),
  tower: s("depthRev", 1),
  tubes: s("depthRev", 1),
  safe: s("depthRev", 2),
  bomb: s("depthRev", 1),
  nonogram: s("depthRev", 1),
  // Colour Flood: the move limit is par + 6 from depthRev 4 (28 Oct 2026), par + 10 on depthRev 3; the par bonus
  // reaches 0 there.
  flood: {
    ...s("depthRev", 2, true, (p) => (p.type === "flood" ? { ...p, moveLimit: Math.max(1, p.par) + floodSpareMoves(p) } : p)),
    dealt: FLOOD_REV_TIGHT,
  },
  tents: s("depthRev", 1),
  shikaku: s("depthRev", 2),
  lightup: s("depthRev", 1),

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
  const stamped = { ...puzzle, [st.key]: st.dealt ?? st.rev } as T;
  return st.deal ? (st.deal(stamped) as T) : stamped;
}
