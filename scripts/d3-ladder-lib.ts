/**
 * D3's ladder players (the polish plan's difficulty session D3, 22 Nov 2026; docs/polish-plan-final/difficulty-spec.md
 * "Speed and Attention"): the two players Joe judges the Speed and Attention ladders by, on real deals at every level,
 * graded by the server's own code. A script library, not a check (d3-ladder-check.ts pins what it measures).
 *
 *  - average: the puzzle-fairness kits' average player (SKILLS.average); Ascend and the Chain play through
 *    speed-levels-tune's level-aware players at that skill.
 *  - elite: a realistic elite held to Joe's human limits (about 0.25 s to react, 0.15 s to move; HUMAN_LIMITS):
 *      Speed: speed-levels-tune's human-limits players (Flash's lure taps, Ascend's search, the Chain's reading), and
 *        the engine kits (Bonk, Tenfall, Pull!) at HUMAN_LIMITS, exactly as speed-levels-tune plays them;
 *      Attention: each game's kit at near-perfect thinking (pace 0.5, 1.5 % slips) with 250 ms reactions, every action
 *        held at least 0.4 s after the one before (react and move), so no tap is faster than a person's.
 *    Both slip, so a run is not a typed-out perfect run; the share of runs at 200 is what Joe's ladder test reads.
 *
 * Every random choice is seeded per (game, level, deal, player), so a measurement reproduces exactly.
 */
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng, type Play, type Rng, type Skill, type Step } from "./puzzle-fairness/kit";
import { dealAt } from "./level-tune";
import { asPhoneSends, gradeSteps } from "./standard-lib";
import { HUMAN_LIMITS, playAscend, playChain, playFlashHuman } from "./speed-levels-tune";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import type { Level } from "../src/lib/levels/levels";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { ATTENTION_PLAYERS } from "./d3-attention-players";
import { SPEED_PLAYERS } from "./d3-speed-players";

export const SPEED_GAMES = ["reaction", "numhunt", "chain", "whack", "tendrop", "clayshoot"] as const satisfies readonly PuzzleType[];
export const ATTENTION_GAMES = ["symscan", "spotdiff", "countup", "maze", "bomb", "pairmatch"] as const satisfies readonly PuzzleType[];
export const D3_GAMES = [...SPEED_GAMES, ...ATTENTION_GAMES] as const;
export type D3Game = (typeof D3_GAMES)[number];
export const ALL_LEVELS = ["easy", "normal", "hard", "expert"] as const satisfies readonly Level[];

export type D3Bot = "average" | "elite";
/** A game's own players, by bot (d3-speed-players.ts, d3-attention-players.ts): each gets the deal, a seeded rng and the clock. */
export type D3Player = (puzzle: PuzzleData, rng: Rng, limitMs: number) => Play;
export type D3Players = Partial<Record<string, Partial<Record<D3Bot, D3Player>>>>;

/** The Attention elite: near-perfect thinking and slips, 250 ms reactions. */
export const ATTENTION_ELITE: Skill = { level: "near", pace: 0.5, err: 0.015, reactionMs: HUMAN_LIMITS.reactionMs, reactionSd: HUMAN_LIMITS.reactionSd };
/** The shortest gap between two of a person's actions on a static board: 0.25 s to react, 0.15 s to move. */
export const LIMIT_GAP_MS = 400;

/** A play's actions held at least LIMIT_GAP_MS apart (the first one too, from the round's start). */
export function heldToLimits(play: Play): Play {
  const steps: Step[] = [];
  let last = 0;
  for (const s of play.steps) {
    const at = Math.max(s.atMs, last + LIMIT_GAP_MS);
    steps.push({ ...s, atMs: at });
    last = at;
  }
  return { ...play, steps };
}

/** One player's play of a dealt puzzle. */
export function playAs(bot: D3Bot, puzzle: PuzzleData, seedKey: string): Play {
  const rng = makeRng(hashText(seedKey));
  const limit = puzzleTimeLimitMs(puzzle);
  const skill = bot === "average" ? SKILLS.average : HUMAN_LIMITS;
  // A level-aware player a game's own file supplies (a level's new mechanic the shared kits can't play) comes first.
  const own = (SPEED_PLAYERS as D3Players)[puzzle.type]?.[bot] ?? (ATTENTION_PLAYERS as D3Players)[puzzle.type]?.[bot];
  if (own) return own(puzzle, rng, limit);
  if (puzzle.type === "reaction" && bot === "elite") return playFlashHuman(puzzle, rng, skill, limit);
  if (puzzle.type === "numhunt") return playAscend(puzzle, rng, skill, limit);
  if (puzzle.type === "chain") return playChain(puzzle, rng, skill);
  const kit = KITS[puzzle.type]!;
  if ((ATTENTION_GAMES as readonly string[]).includes(puzzle.type)) {
    return bot === "average" ? kit.play(puzzle, rng, SKILLS.average, limit) : heldToLimits(kit.play(puzzle, rng, ATTENTION_ELITE, limit));
  }
  return kit.play(puzzle, rng, skill, limit);
}

export interface LadderRow {
  game: D3Game;
  level: Level;
  bot: D3Bot;
  runs: number;
  average: number;
  median: number;
  /** The best tenth's lowest score. */
  top10: number;
  /** Share (0–1) of runs that scored 200. */
  at200: number;
  finishRate: number;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** One player on `deals` deals of a game at a level (deals `from` … `from + deals − 1`, level-tune's room seeds). */
export function measure(game: D3Game, level: Level, bot: D3Bot, deals = 100, from = 0): LadderRow {
  const scores: number[] = [];
  let finished = 0;
  for (let n = from; n < from + deals; n++) {
    const puzzle = dealAt(game, level, n);
    const play = playAs(bot, puzzle, `d3-ladder:${game}:${level}:${n}:${bot}`);
    const run = gradeSteps(puzzle, asPhoneSends(puzzle, play.steps), play.timed);
    scores.push(run.score);
    if (run.isCorrect) finished++;
  }
  const sorted = [...scores].sort((a, b) => a - b);
  return {
    game,
    level,
    bot,
    runs: scores.length,
    average: round1(scores.reduce((a, b) => a + b, 0) / scores.length),
    median: sorted[Math.floor((sorted.length - 1) / 2)]!,
    top10: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))]!,
    at200: scores.filter((s) => s >= 200).length / scores.length,
    finishRate: finished / scores.length,
  };
}
