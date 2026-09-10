import type { PatternCell, PuzzleData, PuzzleType } from "./types";

/**
 * Which fields of each puzzle type are answers. These never reach a client
 * until the round's reveal phase: they live in `duel_secrets`, which no
 * player device can read.
 */
const SECRET_KEYS: Record<PuzzleType, string[]> = {
  anagram: ["word"],
  oddword: ["odd", "theme"],
  arithmetic: ["answer"],
  numseq: ["answer", "rule"],
  missing: ["word"],
  equation: ["operators"],
  symscan: ["targets"],
  patcomp: ["correctIndex", "rule"],
  rotmatch: ["correctIndex", "rotationDeg"],
  reverse: ["answerOrder"],
  oddshape: ["oddIndex", "differenceLabel"],
  chaincalc: ["intermediates", "answer"],
  // These types show the player everything they need on screen — there is
  // nothing extra to hide (the tiles, items and delays are the puzzle).
  sequence: [],
  spatial: [],
  reaction: [],
  gonogo: [],
  stroop: [],
  numhunt: [],
};

type Loose = Record<string, unknown>;

const PLACEHOLDER_CELL: PatternCell = { shape: "circle", colour: "RED", count: 1 };

/** Blank positions become "_" so the client never receives the full word. */
function maskWord(word: string, blanks: number[]): string {
  return word
    .split("")
    .map((letter, index) => (blanks.includes(index) ? "_" : letter))
    .join("");
}

export interface SplitPuzzle {
  /** Everything the player needs to render and play the round. */
  pub: PuzzleData;
  /** The answer half, stored server-side only. */
  priv: Loose;
}

export function splitPuzzle(puzzle: PuzzleData): SplitPuzzle {
  const full = puzzle as unknown as Loose;
  const secrets = SECRET_KEYS[puzzle.type];
  const pub: Loose = {};
  const priv: Loose = { type: puzzle.type };

  for (const [key, value] of Object.entries(full)) {
    if (secrets.includes(key)) priv[key] = value;
    else pub[key] = value;
  }

  if (puzzle.type === "missing") {
    pub["word"] = maskWord(puzzle.word, puzzle.blanks);
  }

  if (puzzle.type === "patcomp") {
    // The bottom-right cell is the answer; it is drawn as "?" during play.
    priv["cells"] = puzzle.cells;
    pub["cells"] = [...puzzle.cells.slice(0, 8), PLACEHOLDER_CELL];
  }

  return { pub: pub as unknown as PuzzleData, priv };
}

/** Server-side only: recombine a puzzle with its answers. */
export function mergePuzzle(pub: PuzzleData, priv: Loose | undefined): PuzzleData {
  return { ...(pub as unknown as Loose), ...(priv ?? {}) } as unknown as PuzzleData;
}
