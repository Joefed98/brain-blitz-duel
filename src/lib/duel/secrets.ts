import type { PatternCell, PuzzleData, PuzzleType } from "./types";

/**
 * Which fields of each puzzle type are answers. These never reach a client
 * until the round's reveal phase: they live in `duel_secrets`, which no
 * player device can read.
 */
const SECRET_KEYS: Record<PuzzleType, string[]> = {
  wordsmith: ["words", "totalPoints", "par", "source"],
  wordhunt: ["words", "totalPoints", "par"],
  unblock: ["minMoves", "solution"],
  blockparty: ["solution", "solutions"],
  groups: ["groups"],
  target: ["solution"],
  numseq: ["answers"],
  ladder: ["shortestLength", "shortestPath"],
  tilegrid: ["solution"],
  // The seed draws the board the player sees; the paths are theirs to find.
  sumhunt: [],
  balance: ["solutions"],
  // Par is shown on the move counter; the intended words are not.
  wordslide: ["words"],
  equation: ["operators"],
  symscan: ["targets"],
  patcomp: ["puzzles"],
  spin: ["answers"],
  reverse: ["answerOrder"],
  spotdiff: ["differences"],
  chaincalc: ["intermediates", "answer"],
  wordmatch: ["answers"],
  pctsprint: ["answers"],
  countup: ["counts"],
  mirmatch: ["answers", "kinds"],
  // These types show the player everything they need on screen — there is
  // nothing extra to hide (the tiles, items and delays are the puzzle).
  sequence: [],
  spatial: [],
  reaction: [],
  gonogo: [],
  stroop: [],
  numhunt: [],
  numclimb: ["answerDigits"],
  stopwatch: [],
  lightsout: ["minPresses", "solution"],
  pipes: ["solution"],
  sudoku: ["solution"],
  flow: ["solution"],
  iceslide: ["minMoves", "solution"],
  push: ["minPushes", "solution"],
  laser: ["solution"],
  tower: ["solution"],
  maze: ["solution"],
  tubes: ["minMoves", "solution"],
  safe: ["combination"],
  bomb: ["sequence", "required", "constraints"],
  gravity: ["minMoves", "solution"],
  // The rule strip and nodes are public; one searched path stays private.
  chain: ["solution", "solutionCount"],
  intruder: ["answers"],
  // The clues are public; the picture they describe is not.
  nonogram: ["pattern"],
  // The dealt board is needed to render flips; nothing else is hidden.
  pairmatch: [],
  // Par is shown to the player; the route that reaches it is not.
  flood: ["solution"],
  // The figure is public; one complete route stays hidden.
  stroke: ["solution"],
  // The frame is public; the minimum and a shortest route are not.
  tiles: ["minMoves", "solution"],
  rings: ["minMoves", "solution"],
  // The seed is what draws the course, so the phone needs it to play; the run
  // itself is replayed on the server, so nothing is given away.
  hover: [],
  swerve: [],
  skyline: [],
  bintoss: [],
  bullseye: [],
  matchup: [],
  snake: [],
  cross: [],
  dual: [],
  ricochet: [],
  breaker: [],
  rally: [],
  steady: [],
  slice: [],
  bubble: [],
  beat: [],
  // The seed draws the pop schedule; the run is replayed on the server.
  whack: [],
  tents: ["solution"],
  wavefront: [],
  bastion: [],
  rooftop: [],
  sortrush: [],
  flip: [],
  parry: [],
};

type Loose = Record<string, unknown>;

const PLACEHOLDER_CELL: PatternCell = { shape: "circle", colour: "RED", count: 1, rot: 0 };

/** Blank positions become "_" so the client never receives the full word. */
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

  if (puzzle.type === "patcomp") {
    // Each bottom-right cell and its rules remain private until the reveal.
    pub["puzzles"] = puzzle.puzzles.map((item) => ({
      cells: [...item.cells.slice(0, 8), PLACEHOLDER_CELL],
      active: item.active,
      rotatable: item.rotatable,
    }));
  }

  return { pub: pub as unknown as PuzzleData, priv };
}

/** Server-side only: recombine a puzzle with its answers. */
export function mergePuzzle(pub: PuzzleData, priv: Loose | undefined): PuzzleData {
  return { ...(pub as unknown as Loose), ...(priv ?? {}) } as unknown as PuzzleData;
}
