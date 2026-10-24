/**
 * Puzzle time-lapses (display only): for the puzzles whose stored answer is
 * already an ordered move list AND whose reveal board draws the board from the
 * answer it is given, the winner's moves are played back by handing the
 * game's own Reveal component growing prefixes of the stored list (read-only;
 * no game file is edited). Where the stored answer carries each move's time
 * (Lightbender's timestamped action log, docs/puzzle-action-log.md) the moves
 * keep their real relative timing, sped up to fit; plain move lists carry no
 * times, so their moves are spaced evenly. Every other puzzle is listed in
 * docs/replays.md and docs/demo-replay-audit.md with what it needs.
 */
import { ACTION_LOG_PREFIX, decodeActionLog, usesActionLog } from "@/lib/duel/actionLog";
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
  /** Round-clock ms of each token, when the stored answer records them (an action log). */
  times?: (tokens: string[]) => number[];
  /** Only some stored puzzles keep a list this spec can read (Lightbender: the action-log stamp). */
  applies?: (puzzle: PuzzleData) => boolean;
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
/** An action log's items in time order (every item kept: a replay shows what was sent, the Reveal applies its own rules). */
const logItems = (answer: string) =>
  decodeActionLog(String(answer ?? ""), Number.MAX_SAFE_INTEGER).actions.map(
    (x) => `${x.a}@${x.t}`,
  );
const joinLog = (tokens: string[], k: number) => ACTION_LOG_PREFIX + tokens.slice(0, k).join(",");
const logTimes = (tokens: string[]) =>
  tokens.map((t) => Number(t.slice(t.lastIndexOf("@") + 1)) || 0);

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
  // Lookout and Roundabout (23 Oct 2026): their stored lists are the words found, in order, and their
  // reveal boards draw the words found so far from a part of the list (found-so-far highlights, the
  // crossword filling in).
  wordsearch: {
    sep: ",",
    tokens: comma,
    prefix: joinComma,
    moves: same,
    min: () => null,
    unit: "word",
    minLabel: "",
  },
  letterwheel: {
    sep: ",",
    tokens: comma,
    prefix: joinComma,
    moves: same,
    min: () => null,
    unit: "word",
    minLabel: "",
  },
  // Lightbender (alogRev 1): every placement, turn, move, removal and FIRE with its round-clock time.
  laser: {
    sep: ",",
    tokens: logItems,
    prefix: joinLog,
    moves: same,
    min: () => null,
    unit: "action",
    minLabel: "",
    times: logTimes,
    applies: usesActionLog,
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
  /** Milliseconds per frame on average, so the whole time-lapse runs 5–7.5 s (results screen: within its time left). */
  frameMs: number;
  /**
   * When each frame is shown, ms from the start (frame 0 at 0). Evenly spaced (k × frameMs) for an untimed
   * list; for a timed one the real gaps between moves, all scaled by one factor so the moves never take
   * longer than the even plan would (never sped up past real time's order, never slowed past it).
   */
  atMs: number[];
  /** True when atMs follows the moves' recorded times. */
  timed: boolean;
}

export const TIMELAPSE_MIN_MS = 5_000;
export const TIMELAPSE_MAX_MS = 10_000;
/** A replay lasts at most about this long (Prompt D, 23 Oct 2026: "at most about 8 s"); the plans keep to 7.5 s. */
export const TIMELAPSE_CAP_MS = 8_000;

/** The time-lapse of a stored answer, or null when it can't be shown (needs a solved answer for some boards). */
export function planTimelapse(
  puzzle: PuzzleData,
  answer: string | null,
  isCorrect: boolean,
  /** The time it may take in all (the results screen's time left); the podium leaves it out. */
  budgetMs?: number,
): TimelapsePlan | null {
  const spec = TIMELAPSE[puzzle.type];
  if (!spec || !answer) return null;
  if (spec.needsCorrect && !isCorrect) return null;
  if (spec.applies && !spec.applies(puzzle)) return null;
  const tokens = spec.tokens(answer);
  if (tokens.length < 2) return null;
  const frames = Array.from({ length: tokens.length + 1 }, (_, k) => spec.prefix(tokens, k));
  // Evenly spaced: about 7.5 s in all, inside 5–10 s, but never slower than 0.6 s a move;
  // on the results screen never longer than the time it has left.
  const frameMs =
    budgetMs === undefined
      ? Math.max(TIMELAPSE_MIN_MS / frames.length, Math.min(600, 7_500 / frames.length))
      : Math.min(600, Math.max(0, Math.min(7_500, budgetMs)) / frames.length);
  const span = frameMs * (frames.length - 1);
  const even = frames.map((_, k) => k * frameMs);
  const times = spec.times?.(tokens) ?? null;
  let atMs = even;
  let timed = false;
  if (times && times.length === tokens.length) {
    // Real relative timing: frame k (k moves made) shows at the k-th move's time, measured from the first
    // move, scaled into the even plan's span (a long think stays long, a quick burst stays quick).
    const first = times[0]!;
    const last = times[times.length - 1]!;
    const real = Math.max(0, last - first);
    if (real > 0) {
      const scale = Math.min(1, span / real);
      // Frame 1 (the first move) shows one even step in, so the opening board is seen.
      const lead = Math.min(frameMs, span / 4);
      const k = real * scale > span - lead ? (span - lead) / real : scale;
      atMs = [0, ...times.map((t) => lead + (t - first) * k)];
      timed = true;
    }
  }
  return {
    spec,
    tokens,
    frames,
    total: spec.moves(tokens.length),
    min: spec.min(puzzle),
    frameMs,
    atMs,
    timed,
  };
}
