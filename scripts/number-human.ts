/**
 * The Number games' person-style players under the human limits (D2, the difficulty build, 22 Nov 2026;
 * docs/polish-plan-final/difficulty-spec.md "Number"). Script-only: floats and Math are fine; nothing here is imported
 * by the app. Every run is graded by the server's own code (scripts/standard-lib.ts gradeSteps on the dealt puzzle).
 *
 * What it is, game by game: the repo's simulated players (scripts/puzzle-fairness/kits-number.ts, kits-kakuro.ts),
 * whose think time per action is the repo's agreed model of a Number player (calibrated on today's Normal by their
 * authors: a good player hangs an 8-notch weight in about 5 s, finds an Exact step in about 8 s…), played at five skills:
 * the kits' average, good, great and near-perfect, and the **elite** (the best human the levels are proved against: a
 * little quicker and steadier than near-perfect, as the arcade bands' elite is to their near-perfect; D1 used the same
 * figures for the Word games). Two things are added on top:
 *
 *  - **The human limits.** Every action is held to HUMAN_LIMITS (scripts/arcade-skill-bands/human.ts: 0.25 s to react,
 *    0.15 s for each tap after it): an action lands no sooner than the one before plus 0.25 s and 0.15 s for each tap it
 *    takes (`tapsFor`: a hang, a tile, a jug pour or a digit is a pick and a drop; an Exact step is tile, sign, tile; a
 *    dart is wedge and ring, Throw one more). Times only ever move later.
 *  - **What the kits cannot feel** (each a stated modelling assumption, measured against nothing but the kits' own
 *    Normal): the size of an Integer Pyramid's sums (`PYRAMID_DIGIT_COST`), how many jugs and whether the tap is there on
 *    a Brimful board, whether the elite plays the textbook pours a person uses (`personSolve`) rather than the proven
 *    shortest line, and how far a Ballpark guess strays between the ruler's marks. Each is in this file and named in the
 *    PR's level tables.
 *
 * The proof that a board can be reached by a person at all (never a guess) stays where it was: each level's deal keeps
 * only boards its person-like solver finishes (balanceLevels.server.ts personSolveScale, targetLevels.server.ts
 * personSolveTarget, operatorGaps.server.ts operatorPersonSearch, numberPyramidLevels.ts npPersonSolve, measureLevels.ts
 * personSolve, checkout.server.ts checkoutPersonFinds, kakuro.server.ts kakuroPersonSolve). This file times that play.
 *
 *   bun scripts/number-human-tune.ts <game|all> [--level=all] [--seeds=48] [--from=0]
 */
import { HUMAN_LIMITS } from "./arcade-skill-bands/human";
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng, type Play, type Skill, type Step } from "./puzzle-fairness/kit";
import { asPhoneSends, gradeSteps } from "./standard-lib";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { decodeSteps } from "../src/lib/duel/target";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";

export const LIMITS = HUMAN_LIMITS;

/** The eight Number games D2 builds levels for. */
export const NUMBER_GAMES = ["balance", "target", "equation", "numpyramid", "measure", "checkout", "numline", "kakuro"] as const;
export type NumberGame = (typeof NUMBER_GAMES)[number];

export type PersonLevel = "average" | "good" | "great" | "near" | "elite";
export const PERSON_LEVELS: readonly PersonLevel[] = ["average", "good", "great", "near", "elite"];

/**
 * The five players. The first four are the kits' own (kit.ts SKILLS); the elite is a little quicker and steadier than
 * near-perfect (pace 0.4 against 0.5, a slip on 0.8 % of decisions against 1.5 %), the figures D1 used for the Word games.
 */
export const NUMBER_PEOPLE: Readonly<Record<PersonLevel, Skill>> = {
  average: SKILLS.average,
  good: SKILLS.good,
  great: SKILLS.great,
  near: SKILLS.near,
  elite: { level: "near", pace: 0.4, err: 0.008, reactionMs: 250, reactionSd: 25 },
};

/** Time for one action at the limits: react once, then each tap. */
export function actionMs(taps: number, limits: { reactMs: number; moveMs: number } = LIMITS): number {
  return limits.reactMs + Math.max(0, taps) * limits.moveMs;
}

/** The tokens of an answer body (the try or hang counts after "#" left out), for counting what an action changed. */
function tokens(answer: string): string[] {
  const body = answer.split("#")[0] ?? "";
  return body.split(/[|,;]/);
}

/** How many tokens differ between two answers (a token added or taken away counts once). */
function changed(prev: string, next: string): number {
  const a = tokens(prev);
  const b = tokens(next);
  let n = 0;
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? "") !== (b[i] ?? "")) n++;
  return n;
}

/**
 * Taps the action from `prev` to `next` took. Most Number actions are a pick and a drop (a weight onto a notch, a tile
 * onto a stone or a gap, a jug onto a jug, a digit into a square, a marker onto the ruler: two taps a changed entry); an
 * Exact step is tile, sign, tile (three a step, one an undo); a Checkout dart is a wedge and a ring (two), the Throw one.
 */
export function tapsFor(type: PuzzleType, prev: string, next: string): number {
  if (type === "target") {
    const before = decodeSteps(prev).length;
    const after = decodeSteps(next).length;
    return after >= before ? 3 * (after - before) : before - after;
  }
  if (type === "checkout") return prev === next ? 2 : 3;
  return 2 * changed(prev, next);
}

/** A kit play's steps held to the human limits (times only ever move later). */
export function limitSteps(type: PuzzleType, steps: readonly Step[], limits = LIMITS): Step[] {
  const out: Step[] = [];
  let prev = "";
  let at = 0;
  for (const s of steps) {
    const taps = tapsFor(type, prev, s.answer);
    at = Math.max(s.atMs, at + (taps > 0 ? actionMs(taps, limits) : 0));
    out.push({ answer: s.answer, atMs: at });
    prev = s.answer;
  }
  return out;
}

/** A game's player: the kit unless this file has its own (players that feel a lever the kit cannot). */
export type NumberPlayer = (puzzle: PuzzleData, rng: ReturnType<typeof makeRng>, skill: Skill, limitMs: number) => Play;

const PLAYERS: Partial<Record<NumberGame, NumberPlayer>> = {};

/** Registers a game's own player (number-human-players.ts). */
export function setNumberPlayer(type: NumberGame, player: NumberPlayer): void {
  PLAYERS[type] = player;
}

export interface NumberRun {
  score: number;
  isCorrect: boolean;
  seconds: number;
}

/** One person's run on a dealt puzzle, held to the limits and graded by the server as the phone sends it. */
export function personRun(puzzle: PuzzleData, person: PersonLevel, salt: string): NumberRun {
  const type = puzzle.type as NumberGame;
  const limit = puzzleTimeLimitMs(puzzle);
  const rng = makeRng(hashText(`number-human:${type}:${salt}:${person}`));
  const skill = NUMBER_PEOPLE[person];
  const player: NumberPlayer = PLAYERS[type] ?? ((p, r, s, l) => KITS[type]!.play(p, r, s, l));
  const play = player(puzzle, rng, skill, limit);
  const steps = play.timed ? play.steps : limitSteps(type, play.steps);
  const run = gradeSteps(puzzle, asPhoneSends(puzzle, steps), play.timed);
  return { score: run.score, isCorrect: run.isCorrect, seconds: run.seconds };
}
