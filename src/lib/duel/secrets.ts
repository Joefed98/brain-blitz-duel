import type { PuzzleData, PuzzleType } from "./types";

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
  target: ["solution"],
  tilegrid: ["solution"],
  balance: ["solutions"],
  // Par is shown on the move counter; the intended words are not.
  wordslide: ["words"],
  equation: ["operators"],
  symscan: ["targets"],
  spotdiff: ["differences", "bonus"],
  // The server derives each answer directly from the stored scene.
  countup: ["counts"],
  // These types show the player everything they need on screen — there is
  // nothing extra to hide (the flashes and delays are the puzzle).
  reaction: [],
  // The seed draws the stream; submitted swipes are replayed on the server.
  stroop: [],
  numhunt: [],
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
  // gravityRev 3: the boards, stars and holes are public; the minimums and shortest routes are not.
  gravity: ["minMoves", "solution", "boardMins", "boardStarMins", "boardSolutions"],
  // The rule strip and nodes are public; one searched path stays private.
  chain: [],
  // The clues are public; the picture they describe is not.
  nonogram: ["pattern"],
  // The dealt board is needed to render flips; nothing else is hidden.
  pairmatch: [],
  // Par is shown to the player; the route that reaches it is not.
  flood: ["solution"],
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
  // A fixed table; the run is replayed on the server.
  pinball: [],
  // Cards & Board (30 Oct 2026): the seed deals the board in the sim; the run is replayed on the server.
  minesweeper: [],
  mahjong: [],
  homerun: [],
  freekick: [],
  racing: [],
  // Cards & Board: the deal is the seed (a bank index, or a seeded target grid); runs are replayed on the server.
  freecell: [],
  tripeaks: [],
  pokersquares: [],
  fivehands: [],
  // Sports: the seed (and Minigolf's pars) lay out the course; every run is replayed on the server.
  minigolf: [],
  pool: [],
  curling: [],
  rally: [],
  steady: [],
  slice: [],
  bubble: [],
  beat: [],
  // The seed draws the pop schedule; the run is replayed on the server.
  whack: [],
  tendrop: [],
  // The seed draws the letter queue; the run is replayed on the server.
  wordfall: [],
  clayshoot: [],
  numpyramid: ["solutions"],
  trail: ["solution"],
  measure: ["minMoves", "solutions"],
  checkout: ["minDarts", "routes"],
  numline: ["values"],
  dig: ["route", "intended"],
  tents: ["solution"],
  shikaku: ["solution"],
  fences: ["solution"],
  fillomino: ["solution"],
  bridges: ["solution"],
  kakuro: ["solution"],
  lightup: ["solution"],
  balltrack: ["par", "playbook"],
  wordsearch: ["placements", "bonus"],
  letterwheel: ["words", "bonus"],
  // The hidden words, the letter code and the solved board; live checks replay moves server-side.
  strikeout: ["words"],
  codeword: ["solution"],
  swapword: ["solution"],
  wavefront: [],
  bastion: [],
  rooftop: [],
  flip: [],
  junction: [],
  inkbridge: [],
  burst: [],
  orbit: [],
  swing: [],
  snip: [],
  tilt: [],
  hotfloor: [],
};

type Loose = Record<string, unknown>;

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

  return { pub: pub as unknown as PuzzleData, priv };
}

/** Server-side only: recombine a puzzle with its answers. */
export function mergePuzzle(pub: PuzzleData, priv: Loose | undefined): PuzzleData {
  return { ...(pub as unknown as Loose), ...(priv ?? {}) } as unknown as PuzzleData;
}
