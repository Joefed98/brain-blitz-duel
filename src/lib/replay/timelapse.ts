/**
 * Puzzle time-lapses (display only): for the puzzles whose stored answer is
 * already an ordered move list AND whose reveal board draws the board from the
 * answer it is given, the winner's moves are played back by handing the
 * game's own Reveal component growing prefixes of the stored list (read-only;
 * no game file is edited). Stored lists carry no times, so moves are spaced
 * evenly. Every other puzzle is listed in docs/replays.md with what it needs;
 * the timestamped puzzle action log (docs/puzzle-action-log.md, Room rules and
 * trust) is the format the rest get wired to in a follow-up.
 */
import type { PuzzleData } from "@/lib/duel/types";

export interface TimelapseSpec {
  /** "," for comma lists; "" for one letter per move (Topsy-Turvy, Heave). */
  sep: "," | "";
  /** Stored tokens that are moves (empty tokens dropped). */
  tokens: (answer: string) => string[];
  /** The answer holding the first k moves. */
  prefix: (tokens: string[], k: number) => string;
  /** How many moves k tokens make (Labyrinth: a path of k cells is k − 1 steps). */
  moves: (k: number) => number;
  /** The minimum (or par) shown against the counter, when the puzzle stores one. */
  min: (puzzle: PuzzleData) => number | null;
  /** Word for the counter. */
  unit: string;
  minLabel: string;
  /** The Reveal draws the player's board only when told the answer was right (Gridlock, Heave). */
  needsCorrect?: boolean;
}

const num = (p: PuzzleData, key: string): number | null => {
  const v = (p as unknown as Record<string, unknown>)[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};
const comma = (answer: string) =>
  String(answer ?? "")
    .split(",")
    .filter((t) => t.trim().length > 0);
const letters = (allowed: RegExp) => (answer: string) =>
  String(answer ?? "")
    .toUpperCase()
    .split("")
    .filter((c) => allowed.test(c));
const joinComma = (tokens: string[], k: number) => tokens.slice(0, k).join(",");
const joinLetters = (tokens: string[], k: number) => tokens.slice(0, k).join("");
const same = (k: number) => k;

export const TIMELAPSE: Record<string, TimelapseSpec> = {
  unblock: {
    sep: ",",
    tokens: comma,
    prefix: joinComma,
    moves: same,
    min: (p) => num(p, "minMoves"),
    unit: "move",
    minLabel: "minimum",
    needsCorrect: true,
  },
  wordslide: {
    sep: ",",
    tokens: comma,
    prefix: joinComma,
    moves: same,
    min: (p) => num(p, "par"),
    unit: "move",
    minLabel: "par",
  },
  tower: {
    sep: ",",
    tokens: comma,
    prefix: joinComma,
    moves: same,
    min: (p) => num(p, "minMoves"),
    unit: "move",
    minLabel: "minimum",
  },
  maze: {
    sep: ",",
    tokens: comma,
    prefix: joinComma,
    moves: (k) => Math.max(0, k - 1),
    min: () => null,
    unit: "step",
    minLabel: "",
  },
  tubes: {
    sep: ",",
    tokens: comma,
    prefix: joinComma,
    moves: same,
    min: (p) => num(p, "minMoves"),
    unit: "pour",
    minLabel: "minimum",
  },
  gravity: {
    sep: "",
    tokens: letters(/^[UDLRXY]$/),
    prefix: joinLetters,
    moves: same,
    min: (p) => num(p, "minMoves"),
    unit: "tilt",
    minLabel: "minimum",
  },
  flood: {
    sep: ",",
    tokens: comma,
    prefix: joinComma,
    moves: same,
    min: (p) => num(p, "par"),
    unit: "move",
    minLabel: "par",
  },
  rings: {
    sep: ",",
    tokens: comma,
    prefix: joinComma,
    moves: same,
    min: (p) => num(p, "minMoves"),
    unit: "turn",
    minLabel: "minimum",
  },
  strikeout: {
    sep: ",",
    tokens: comma,
    prefix: joinComma,
    moves: same,
    min: () => null,
    unit: "guess",
    minLabel: "",
  },
  push: {
    sep: "",
    tokens: letters(/^[UDLR]$/),
    prefix: joinLetters,
    moves: same,
    min: (p) => num(p, "minPushes"),
    unit: "step",
    minLabel: "fewest pushes",
    needsCorrect: true,
  },
};

export function canTimelapse(type: string): boolean {
  return type in TIMELAPSE;
}

export interface TimelapsePlan {
  spec: TimelapseSpec;
  tokens: string[];
  /** Answers for each frame: 0 moves, 1 move, … all moves. */
  frames: string[];
  total: number;
  min: number | null;
  /** Milliseconds per frame, so the whole time-lapse runs 5–10 s. */
  frameMs: number;
}

export const TIMELAPSE_MIN_MS = 5_000;
export const TIMELAPSE_MAX_MS = 10_000;

/** The time-lapse of a stored answer, or null when it can't be shown (needs a solved answer for some boards). */
export function planTimelapse(
  puzzle: PuzzleData,
  answer: string | null,
  isCorrect: boolean,
): TimelapsePlan | null {
  const spec = TIMELAPSE[puzzle.type];
  if (!spec || !answer) return null;
  if (spec.needsCorrect && !isCorrect) return null;
  const tokens = spec.tokens(answer);
  if (tokens.length < 2) return null;
  const frames = Array.from({ length: tokens.length + 1 }, (_, k) => spec.prefix(tokens, k));
  // Evenly spaced: about 7.5 s in all, inside 5–10 s, but never slower than 0.6 s a move.
  const frameMs = Math.max(TIMELAPSE_MIN_MS / frames.length, Math.min(600, 7_500 / frames.length));
  return { spec, tokens, frames, total: spec.moves(tokens.length), min: spec.min(puzzle), frameMs };
}
