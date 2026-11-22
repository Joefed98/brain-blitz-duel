/**
 * The Pattern and Logic games' people under the human limits (D4, the difficulty build, 22 Nov 2026;
 * docs/polish-plan-final/difficulty-spec.md "Pattern and Logic"). Script-only: floats and Math are fine; nothing here
 * is imported by the app. Every run is graded by the server's own code (scripts/standard-lib.ts gradeSteps on the dealt
 * puzzle; Minefield through the server replay).
 *
 * What it is: the repo's simulated players (scripts/puzzle-fairness/kits-pattern.ts, kits-logic.ts, kits-number.ts's
 * Trail, kits-fences.ts, kits-fillomino.ts, kits-bridges.ts), whose think time per action is the repo's agreed model of
 * a player at each skill (calibrated by their authors on today's Normal; LEVEL_THINK scales the Logic overhaul's seven
 * games by level, as the repo already does), played at five skills: the kits' average, good, great and near-perfect,
 * and the **elite** (the best human the levels are proved against: a little quicker and steadier than near-perfect, the
 * figures D1 and D2 used for the Word and Number games, pace 0.4 and a slip on 0.8 % of decisions). Minefield is an
 * arcade engine, so it plays its skill-band bot (scripts/arcade-skill-bands/bots/minesweeper.ts) at the matching levels.
 *
 * **The human limits.** Every action is held to HUMAN_LIMITS (scripts/arcade-skill-bands/human.ts: 0.25 s to react,
 * 0.15 s for each tap after it): an action lands no sooner than the one before plus 0.25 s and 0.15 s for each tap it
 * takes (`tapsFor`, game by game: a slide, swipe, tilt or colour is one; a ring, pour, piece or bridge is a pick and a
 * drop; a digit is a square and a key; a drawn line one tap for every two squares it crosses). Times only ever move
 * later. Minefield's bot plays under the same limits (Human with HUMAN_LIMITS: reactions no sooner than 0.25 s, each
 * gesture 0.15 s).
 *
 *   bun scripts/pattern-logic-human-tune.ts <game|all|pattern|logic> [--level=all] [--seeds=48] [--from=0]
 */
import { HUMAN_LIMITS, Human, type SkillLevel } from "./arcade-skill-bands/human";
import { KITS } from "./puzzle-fairness/kits";
import { LEVEL_THINK, SKILLS, hashText, makeRng, type Play, type Skill, type Step } from "./puzzle-fairness/kit";
import { asPhoneSends, gradeSteps, sentAnswer } from "./standard-lib";
import { bot as minesBot } from "./arcade-skill-bands/bots/minesweeper";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { decodeSides, rotateMask, tileOpenings } from "../src/lib/duel/logic";
import { minesCheckpoint, minesCleared, minesweeperGameFor, MINES_CHECKPOINT_INTERVAL } from "../src/lib/arcade/minesweeper";
import { encodeMinesweeperRun } from "../src/lib/duel/minesweeper";
import { encodePipesTurnAnswer, pipesAfterTurns, type PipesTurn } from "../src/lib/duel/depth4/pipesTaps";
import { usesPatternNov15 } from "../src/lib/duel/patternNov15";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";

export const LIMITS = HUMAN_LIMITS;

/** The eight Pattern games and fourteen Logic games D4 builds levels for. */
export const PATTERN_GAMES = ["unblock", "blockparty", "pipes", "flow", "iceslide", "push", "laser", "gravity"] as const;
export const LOGIC_GAMES = ["sudoku", "tower", "tubes", "safe", "nonogram", "flood", "minesweeper", "tents", "shikaku", "lightup", "trail", "fences", "fillomino", "bridges"] as const;
export const PL_GAMES = [...PATTERN_GAMES, ...LOGIC_GAMES] as const;
export type PlGame = (typeof PL_GAMES)[number];

export type PersonLevel = "average" | "good" | "great" | "near" | "elite";
export const PERSON_LEVELS: readonly PersonLevel[] = ["average", "good", "great", "near", "elite"];

/**
 * The five people. The first four are the kits' own (kit.ts SKILLS); the elite is a little quicker and steadier than
 * near-perfect (pace 0.4 against 0.5, a slip on 0.8 % of decisions against 1.5 %), the figures D1 and D2 used.
 */
export const PL_PEOPLE: Readonly<Record<PersonLevel, Skill>> = {
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

const listOf = (answer: string, sep: string | RegExp): string[] => (answer === "" ? [] : answer.split(sep));
/** Tokens added or taken away between two lists (a prefix kept is free). */
function listDelta(prev: string[], next: string[]): number {
  let k = 0;
  while (k < prev.length && k < next.length && prev[k] === next[k]) k++;
  return prev.length - k + (next.length - k);
}
/** Members in one set and not the other. */
function setDelta(prev: string[], next: string[]): number {
  const a = new Set(prev);
  const b = new Set(next);
  let n = 0;
  for (const x of a) if (!b.has(x)) n++;
  for (const x of b) if (!a.has(x)) n++;
  return n;
}
/** Characters that differ between two equal-length board strings. */
function charDelta(prev: string, next: string): number {
  let n = 0;
  for (let i = 0; i < Math.max(prev.length, next.length); i++) if ((prev[i] ?? "") !== (next[i] ?? "")) n++;
  return n;
}
/** A drawn line crossing `cells` squares: one tap for every two (the finger's own speed), at least one. */
const drawTaps = (cells: number) => Math.max(1, Math.ceil(cells / 2));

/**
 * Taps the action from `prev` to `next` took. Only ever an estimate of the gesture (the kits already spend the
 * thinking); it sets the fastest the action can land.
 */
export function tapsFor(type: PuzzleType, puzzle: PuzzleData, prev: string, next: string): number {
  switch (type) {
    // One slide, swipe, tilt or colour button per move.
    case "unblock":
    case "flood":
      return listDelta(listOf(prev, ","), listOf(next, ","));
    case "iceslide":
    case "gravity":
    case "push":
      return listDelta([...prev], [...next]);
    // A pick and a drop.
    case "tower":
    case "tubes":
      return 2 * listDelta(listOf(prev, ","), listOf(next, ","));
    case "blockparty":
      return 2 * listDelta(listOf(prev, ";"), listOf(next, ";"));
    case "shikaku":
      return 2 * setDelta(listOf(prev, ","), listOf(next, ","));
    case "bridges":
      return 2 * charDelta(prev, next);
    // A square and a key.
    case "sudoku":
      return 2 * charDelta(prev, next);
    // One tap a square.
    case "tents":
    case "lightup":
      return setDelta(listOf(prev, ","), listOf(next, ","));
    case "fences":
      return charDelta(prev, next);
    // Drawn lines: a row of Mosaic squares, a Trail run, a Regions stroke, a Chroma Lines path.
    case "nonogram":
      return drawTaps(setDelta(listOf(prev, ","), listOf(next, ",")));
    case "trail":
      return drawTaps(listDelta(listOf(prev, "."), listOf(next, ".")));
    case "fillomino":
      return drawTaps(charDelta(prev, next)) + 1;
    case "flow": {
      const a = prev.split("|");
      const b = next.split("|");
      let taps = 0;
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if ((a[i] ?? "") === (b[i] ?? "")) continue;
        taps += drawTaps(listOf(b[i] ?? "", ",").length);
      }
      return taps;
    }
    case "pipes": {
      // Taps to turn every changed tile from its old sides to its new ones (a quarter turn a tap).
      const tiles = (puzzle as unknown as { tiles: number[] }).tiles;
      const was = decodeSides(tiles, prev).map(tileOpenings);
      const now = decodeSides(tiles, next).map(tileOpenings);
      const twoWay = usesPatternNov15(puzzle, "pipes");
      let taps = 0;
      now.forEach((want, cell) => {
        for (let t = 0; t < 4; t++) if (rotateMask(was[cell]!, t) === want) {
          taps += twoWay ? Math.min(t, 4 - t) : t;
          break;
        }
      });
      return taps;
    }
    case "safe":
      // A dial click a changed digit, and the try button when a try is added.
      return charDelta(prev.replace(/^.*;/, ""), next.replace(/^.*;/, "")) + (prev.split(";").length !== next.split(";").length ? 1 : 0);
    default:
      return prev === next ? 0 : 1;
  }
}

/** A kit play's steps held to the human limits (times only ever move later). */
export function limitSteps(type: PuzzleType, puzzle: PuzzleData, steps: readonly Step[], limits = LIMITS): Step[] {
  const out: Step[] = [];
  let prev = "";
  let at = 0;
  for (const s of steps) {
    const taps = tapsFor(type, puzzle, prev, s.answer);
    at = Math.max(s.atMs, at + (taps > 0 ? actionMs(taps, limits) : 0));
    out.push({ answer: s.answer, atMs: at });
    prev = s.answer;
  }
  return out;
}

/**
 * Pipeline's two-way turning (pipesRev 5: a tap turns a tile clockwise, a long press or swipe anticlockwise, and par
 * counts the fewest turns either way): the phone's log as a person sends it, each tile turned the shorter way. The
 * shared helper (standard-lib asPhoneSends) turns clockwise only, which costs every pipesRev 5 run its par bonus.
 */
function pipesTwoWaySends(puzzle: PuzzleData, steps: readonly Step[]): Step[] {
  const p = puzzle as unknown as { tiles: { sides: number }[] };
  let prev = p.tiles.map(tileOpenings);
  const turns: PipesTurn[] = [];
  return steps.map((s) => {
    const sides = decodeSides(p.tiles as never, s.answer).map(tileOpenings);
    sides.forEach((want, cell) => {
      for (let t = 0; t < 4; t++) if (rotateMask(prev[cell]!, t) === want) {
        if (t === 3) turns.push({ cell, turn: 3 });
        else for (let k = 0; k < t; k++) turns.push({ cell, turn: 1 });
        break;
      }
    });
    prev = sides;
    return { answer: encodePipesTurnAnswer(pipesAfterTurns(p.tiles as never, turns), turns), atMs: s.atMs };
  });
}

/** A game's player: the kit unless one is registered here (a player that feels a lever the kit cannot). */
export type PlPlayer = (puzzle: PuzzleData, rng: ReturnType<typeof makeRng>, skill: Skill, limitMs: number) => Play;
const PLAYERS: Partial<Record<PlGame, PlPlayer>> = {};
export function setPlPlayer(type: PlGame, player: PlPlayer): void {
  PLAYERS[type] = player;
}

export interface PlRun {
  score: number;
  isCorrect: boolean;
  /** Seconds to the finish (the clock when unfinished). */
  seconds: number;
  /**
   * A finish's score had it come with the whole clock left (the same answer and timeline, speed in full): 200 means
   * the run lost only speed, so it reaches 200 under any speed line it finished inside (how each level's line is set).
   */
  ceiling: number | null;
  /**
   * With PL_SCAN=1, on a level round whose finish lost only speed: the smallest whole-second speed line at which the
   * same answer at the same time grades 200 (the real grader, the line stamped on a copy of the puzzle), so a row's
   * share at 200 under any line is the share of runs whose `need` is at most that line. Null otherwise.
   */
  need?: number | null;
}

/** The smallest whole-second `levelFullByS` at which `answer`, sent `msLeft` before the buzzer, grades 200. */
function lineNeeded(puzzle: PuzzleData, answer: string, msLeft: number, limit: number): number | null {
  const at = (line: number) => gradeAnswer({ ...(puzzle as object), levelFullByS: line } as unknown as PuzzleData, answer, msLeft).score >= 200;
  let lo = 1;
  let hi = Math.floor(limit / 1000);
  if (!at(hi)) return null;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (at(mid)) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** The skill-band level a person plays Minefield's bot at. */
const MINES_LEVEL: Record<PersonLevel, SkillLevel> = { average: "average", good: "good", great: "great", near: "near", elite: "elite" };

/** One Minefield run: the skill-band bot under the human limits, graded through the server replay. */
function minesRun(puzzle: PuzzleData, person: PersonLevel): PlRun {
  const p = puzzle as unknown as { seed: number; minesRev: number };
  const game = minesweeperGameFor(p.minesRev);
  const out = minesBot({ game, seed: p.seed, rev: p.minesRev, human: new Human("minesweeper", p.seed, MINES_LEVEL[person], LIMITS), fixes: true });
  const events = (out.events ?? []).filter((e) => e.t <= game.runTicks);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(p.seed);
  const checkpoints = [];
  while (!game.isOver(s)) {
    s = game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % MINES_CHECKPOINT_INTERVAL === 0) checkpoints.push(minesCheckpoint(s));
  }
  const raw = encodeMinesweeperRun({ seed: p.seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
  const graded = gradeAnswer(puzzle, raw, 0);
  // A clear with no mine hit loses only speed (core and clean in full), so its ceiling is 200.
  const cleared = minesCleared(s);
  const clearedS = cleared && s.clearedTick > 0 ? s.clearedTick / 60 : s.tick / 60;
  return { score: graded.score, isCorrect: cleared, seconds: clearedS, ceiling: cleared && s.hits === 0 ? 200 : cleared ? graded.score : null };
}

/** One person's run on a dealt puzzle, held to the limits and graded by the server as the phone sends it. */
export function personRun(puzzle: PuzzleData, person: PersonLevel, salt: string): PlRun {
  const type = puzzle.type as PlGame;
  if (type === "minesweeper") return minesRun(puzzle, person);
  const limit = puzzleTimeLimitMs(puzzle);
  const rng = makeRng(hashText(`pattern-logic-human:${type}:${salt}:${person}`));
  const skill = PL_PEOPLE[person];
  const player: PlPlayer = PLAYERS[type] ?? ((p, r, s, l) => KITS[type]!.play(p, r, s, l));
  const play = player(puzzle, rng, skill, limit);
  // Answers that carry their own tap times (Lightbender's action log) are timed by the kit itself.
  const steps = play.timed ? play.steps : limitSteps(type, puzzle, play.steps);
  const sends = type === "pipes" && usesPatternNov15(puzzle, "pipes") ? pipesTwoWaySends(puzzle, steps) : asPhoneSends(puzzle, steps);
  const run = gradeSteps(puzzle, sends, play.timed);
  let ceiling: number | null = null;
  if (run.isCorrect) {
    const upTo = sends.filter((s) => s.atMs <= run.seconds * 1000 + 0.5);
    const answer = play.timed ? upTo[upTo.length - 1]!.answer : sentAnswer(puzzle, upTo);
    ceiling = gradeAnswer(puzzle, answer, limit).score;
    if (process.env["PL_SCAN"] === "1" && ceiling === 200 && (puzzle as { level?: string }).level) {
      return { score: run.score, isCorrect: true, seconds: run.seconds, ceiling, need: lineNeeded(puzzle, answer, Math.max(0, limit - run.seconds * 1000), limit) };
    }
  }
  return { score: run.score, isCorrect: run.isCorrect, seconds: run.seconds, ceiling };
}

/**
 * Trail (D4): its kit scales thinking by LEVEL_THINK_GAME's Trail factors (2.6 and 2.7, set on 16 Nov 2026 when every
 * level was the same 6 × 6 board and "its harder boards are harder moves"). D4's levels grow the board instead (5 × 5,
 * 7 × 7), so the extra moves carry the difficulty, and Trail plays on the shared LEVEL_THINK like the other Logic
 * games (Hard 1.9, Expert 2.35). A stated modelling choice, proposed to Joe for the kit itself.
 */
setPlPlayer("trail", (puzzle, rng, skill, limitMs) => {
  const level = (puzzle as { level?: string }).level;
  const factor = level ? (LEVEL_THINK[level] ?? 1) : 1;
  const plain = { ...(puzzle as object), level: undefined } as unknown as PuzzleData;
  return KITS.trail!.play(plain, rng, { ...skill, pace: skill.pace * factor }, limitMs);
});
