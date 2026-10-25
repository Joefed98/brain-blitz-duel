/**
 * Simulated players for the D5 remodels' tuning (Topsy-Turvy gravityRev 3, Jumbled tilesRev 3;
 * docs/depth/d5-remodels.md). Each level plays the stored round on the real rules and is graded by the server's
 * own gradeAnswer, so the table measures exactly what rooms would store.
 *
 *  - pace: seconds per action relative to a good player; err: the chance an action is a mistake (a random tilt
 *    or slide); stars (Topsy): the chance the player routes for every star on a board.
 *  - Topsy-Turvy: a good tilt is the next tilt of a shortest route from where the balls stand (the route for
 *    every star still on the board when routing for stars); a player who strays too far resets the board.
 *  - Jumbled: a good slide is the next of the stored shortest route; a mistake is a random slide, undone (a
 *    counted slide back) on the next action, as people do.
 */
import { gradeAnswer } from "../../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../../src/lib/duel/registry";
import type { GravityDir, PuzzleData } from "../../src/lib/duel/types";
import { replayTopsy, topsyStart, topsyTilt, type TopsyBoard, type TopsyState } from "../../src/lib/duel/topsy";
import { topsySearch } from "../../src/lib/duel/topsy.server";
import { JUMBLED_MOVES, encodeJumbled, jumbledSlide, jumbledSolved, type JumbledToken } from "../../src/lib/duel/jumbled";
import { jumbledSolutionMoves } from "../../src/lib/duel/jumbled.server";

export type Rng = () => number;
export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

export const BOT_LEVELS = ["novice", "average", "good", "great", "near"] as const;
export type BotLevel = (typeof BOT_LEVELS)[number];
export const BOT_LABEL: Record<BotLevel, string> = { novice: "Novice", average: "Average", good: "Solid", great: "Strong", near: "Near-perfect" };

export interface BotSkill {
  /** Seconds per action relative to a solid player. */
  pace: number;
  /** Chance an action is a mistake (a tilt off any good route; a slide that does not help, then its slide back). */
  err: number;
  /** Topsy-Turvy: the chance the player routes for every star on a board. */
  stars: number;
}
/**
 * Topsy-Turvy: six balls roll at once, so even good players misjudge a tilt often (a solid player one tilt in
 * four); a tilt off route usually costs tilts later, and the board's limit is the minimum + 5 (rounded up).
 */
export const TOPSY_SKILLS: Record<BotLevel, BotSkill> = {
  novice: { pace: 1.9, err: 0.5, stars: 0 },
  average: { pace: 1.4, err: 0.36, stars: 0.1 },
  good: { pace: 1.0, err: 0.24, stars: 0.35 },
  great: { pace: 0.72, err: 0.12, stars: 0.75 },
  near: { pace: 0.5, err: 0.04, stars: 1 },
};
/**
 * Jumbled: nobody sees a shortest route on a 5 × 5 gradient; most slides are exploration. A mistake is a slide
 * that does not help and its slide back (two counted slides), so a solid player makes about twice par's slides.
 */
export const JUMBLED_SKILLS: Record<BotLevel, BotSkill> = {
  novice: { pace: 1.8, err: 0.62, stars: 0 },
  average: { pace: 1.35, err: 0.5, stars: 0 },
  good: { pace: 1.0, err: 0.4, stars: 0 },
  great: { pace: 0.75, err: 0.22, stars: 0 },
  near: { pace: 0.55, err: 0.07, stars: 0 },
};

/** Seconds a solid player takes per tilt / slide, and to read a fresh board. */
export const TOPSY_TILT_S = 3.6;
export const TOPSY_READ_S = 6;
export const JUMBLED_SLIDE_S = 6;
export const JUMBLED_READ_S = 10;

export interface BotRun {
  answer: string;
  /** Ms left on the clock when the round went in. */
  msRemaining: number;
  score: number;
  solved: boolean;
  /** Tilts or slides made. */
  actions: number;
  stars?: number;
  home?: number;
}

function think(rng: Rng, seconds: number, pace: number): number {
  // ±35 % spread around the level's pace.
  return Math.round(seconds * pace * (0.65 + 0.7 * rng()) * 1000);
}

function finish(puzzle: PuzzleData, answer: string, usedMs: number, extra: (g: ReturnType<typeof gradeAnswer>) => Partial<BotRun>): BotRun {
  const limit = puzzleTimeLimitMs(puzzle);
  const msRemaining = Math.max(0, limit - usedMs);
  const g = gradeAnswer(puzzle, answer, msRemaining);
  return { answer, msRemaining, score: g.score, solved: g.isCorrect, actions: 0, ...extra(g) };
}

/* ------------------------------------------------------------------ Topsy-Turvy */

const DIRS: GravityDir[] = ["U", "D", "L", "R"];

function routeFrom(board: TopsyBoard, state: TopsyState, withStars: boolean): GravityDir[] | null {
  const from: TopsyBoard = { ...board, starts: state.balls };
  // Search from the current balls; stars already taken are dropped from the board searched.
  const left = board.stars.filter((_, i) => !(state.starMask & (1 << i)));
  const found = topsySearch({ ...from, stars: withStars ? left : [] }, withStars, 12, 200_000);
  return found ? found.solution : null;
}

export function playTopsy(puzzle: PuzzleData, level: BotLevel, rng: Rng): BotRun {
  const skill = TOPSY_SKILLS[level];
  const { boards, tiltLimits } = puzzle as { boards: TopsyBoard[]; tiltLimits: number[] };
  const limit = puzzleTimeLimitMs(puzzle);
  const tokens: GravityDir[] = [];
  let at = 0;
  boards: for (const [b, board] of boards.entries()) {
    const walls = new Set(board.walls);
    at += think(rng, TOPSY_READ_S, skill.pace);
    const wantStars = rng() < skill.stars;
    let state = topsyStart(board);
    let used = 0;
    while (used < tiltLimits[b]!) {
      if (at >= limit) break boards;
      if (state.balls.every((ball) => ball === -1)) break;
      let dir: GravityDir | null = null;
      if (rng() >= skill.err) {
        const route = (wantStars ? routeFrom(board, state, true) : null) ?? routeFrom(board, state, false);
        if (route && route.length) dir = route[0]!;
      }
      if (!dir) {
        const options = DIRS.filter((d) => topsyTilt(board, walls, state, d).moved);
        dir = options[Math.floor(rng() * options.length)]!;
      }
      at += think(rng, TOPSY_TILT_S, skill.pace);
      if (at > limit) break boards;
      tokens.push(dir);
      state = topsyTilt(board, walls, state, dir).state;
      used++;
    }
  }
  const replay = replayTopsy(boards, tokens, tiltLimits);
  return finish(puzzle, tokens.join(""), Math.min(at, limit), () => ({ actions: replay.tilts, stars: replay.stars, home: replay.home }));
}

/** Random tilts as fast as a thumb can go (one every 0.4 s) until the buzzer. */
export function spamTopsy(puzzle: PuzzleData, rng: Rng): BotRun {
  const limit = puzzleTimeLimitMs(puzzle);
  const tokens: GravityDir[] = [];
  for (let at = 400; at < limit; at += 400) tokens.push(DIRS[Math.floor(rng() * 4)]!);
  // The round goes in when the last board clears or at the buzzer.
  const { boards, tiltLimits } = puzzle as { boards: TopsyBoard[]; tiltLimits: number[] };
  let used = limit;
  for (let n = 1; n <= tokens.length; n++) {
    if (replayTopsy(boards, tokens.slice(0, n), tiltLimits).over) {
      used = n * 400;
      tokens.length = n;
      break;
    }
  }
  const replay = replayTopsy(boards, tokens, tiltLimits);
  return finish(puzzle, tokens.join(""), used, () => ({ actions: replay.tilts, stars: replay.stars, home: replay.home }));
}

/* ------------------------------------------------------------------ Jumbled */

export function playJumbled(puzzle: PuzzleData, level: BotLevel, rng: Rng): BotRun {
  const skill = JUMBLED_SKILLS[level];
  const p = puzzle as { frame: number[]; solution?: number[] };
  const limit = puzzleTimeLimitMs(puzzle);
  const plan = jumbledSolutionMoves(p.solution ?? []);
  const tokens: JumbledToken[] = [];
  let frame = [...p.frame];
  let at = think(rng, JUMBLED_READ_S, skill.pace);
  let moves = 0;
  // Mistakes cost more the further into the board (people explore before they see the route).
  for (let i = 0; i < plan.length && at < limit; ) {
    if (rng() < skill.err) {
      const wrong = JUMBLED_MOVES[Math.floor(rng() * JUMBLED_MOVES.length)]!;
      at += think(rng, JUMBLED_SLIDE_S, skill.pace);
      if (at > limit) break;
      tokens.push(wrong);
      frame = jumbledSlide(frame, wrong);
      moves++;
      // The slide back.
      const len = wrong.kind === "R" ? (wrong.index === 0 || wrong.index === 4 ? 3 : 5) : wrong.index === 0 || wrong.index === 4 ? 3 : 5;
      const back = { ...wrong, shift: len - wrong.shift };
      at += think(rng, JUMBLED_SLIDE_S * 0.6, skill.pace);
      if (at > limit) break;
      tokens.push(back);
      frame = jumbledSlide(frame, back);
      moves++;
      continue;
    }
    at += think(rng, JUMBLED_SLIDE_S, skill.pace);
    if (at > limit) break;
    tokens.push(plan[i]!);
    frame = jumbledSlide(frame, plan[i]!);
    moves++;
    i++;
  }
  return finish(puzzle, encodeJumbled(tokens), Math.min(at, limit), () => ({ actions: moves, solved: jumbledSolved(frame) }));
}

/** Random slides, one every 0.5 s, until the buzzer. */
export function spamJumbled(puzzle: PuzzleData, rng: Rng): BotRun {
  const limit = puzzleTimeLimitMs(puzzle);
  const tokens: JumbledToken[] = [];
  for (let at = 500; at < limit; at += 500) tokens.push(JUMBLED_MOVES[Math.floor(rng() * JUMBLED_MOVES.length)]!);
  return finish(puzzle, encodeJumbled(tokens), limit, () => ({ actions: tokens.length }));
}
