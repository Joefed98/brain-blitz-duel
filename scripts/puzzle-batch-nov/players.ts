/**
 * The puzzle batch of 3 Nov 2026 (docs/puzzle-batch-nov-2026.md): players for Labyrinth, Topsy-Turvy and Skid, weak to
 * flawless, plus random play (guessing), shared by puzzle-batch-nov-check, its legacy recorder and the bands report.
 * Labyrinth and Skid play the fairness kits (scripts/puzzle-fairness) at six skills; Topsy-Turvy plays the d5 bot
 * (scripts/d5-remodels/bots.ts TOPSY_SKILLS, as standard-pattern-check records it). Script-only; imports nothing that
 * main before the batch lacks, so the legacy recorder runs on a main checkout.
 */
import { generatePuzzle } from "../../src/lib/duel/generate.server";
import { withSeededRandom } from "../../src/lib/duel/random";
import { puzzleTimeLimitMs } from "../../src/lib/duel/registry";
import { topsyStart, topsyTilt, replayTopsyPuzzle, type TopsyBoard, type TopsyState } from "../../src/lib/duel/topsy";
import { topsySearch } from "../../src/lib/duel/topsy.server";
import { encodeMazeTrail } from "../../src/lib/duel/depth/labyrinth";
import { mazeColsOf } from "../../src/lib/duel/maze";
import type { GravityDir, MazePuzzleData, PuzzleData } from "../../src/lib/duel/types";
import { KITS } from "../puzzle-fairness/kits";
import { SKILLS, hashText, makeRng, type Skill, type Step } from "../puzzle-fairness/kit";
import { TOPSY_READ_S, TOPSY_SKILLS, TOPSY_TILT_S } from "../d5-remodels/bots";

export type BatchType = "maze" | "gravity" | "iceslide";
export const BATCH_TYPES: readonly BatchType[] = ["maze", "gravity", "iceslide"];
export const BATCH_LEVELS = ["weak", "average", "good", "great", "near", "flawless"] as const;
export type BatchLevel = (typeof BATCH_LEVELS)[number];

type Of<T extends PuzzleData["type"]> = Extract<PuzzleData, { type: T }>;

/** A room deal of `type` from `seed` (the bank seed too, as rooms draw Skid). */
export function dealBatch(type: BatchType, seed: number): PuzzleData {
  return withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed }));
}

/** Kit skills: the kit's four, a weak player (slower, a mistake in three decisions) and a flawless one (fast, none). */
const KIT_SKILLS: Record<BatchLevel, Skill> = {
  weak: { level: "average", pace: 2.4, err: 0.33, reactionMs: 340, reactionSd: 60 },
  average: SKILLS.average,
  good: SKILLS.good,
  great: SKILLS.great,
  near: SKILLS.near,
  flawless: { level: "near", pace: 0.35, err: 0, reactionMs: 150, reactionSd: 10 },
};

/** Topsy-Turvy bot skills: d5's novice to elite, and flawless (faster, no wasted tilt, no star chasing). */
const TOPSY_BATCH: Record<BatchLevel, { pace: number; err: number; stars: number }> = {
  weak: TOPSY_SKILLS.novice,
  average: TOPSY_SKILLS.average,
  good: TOPSY_SKILLS.good,
  great: TOPSY_SKILLS.great,
  near: TOPSY_SKILLS.near,
  flawless: { pace: 0.25, err: 0, stars: 0 },
};

const DIRS: GravityDir[] = ["U", "D", "L", "R"];
function topsyRoute(board: TopsyBoard, state: TopsyState, withStars: boolean): GravityDir[] | null {
  const left = board.stars.filter((_, i) => !(state.starMask & (1 << i)));
  const found = topsySearch({ ...board, starts: state.balls, stars: withStars ? left : [] }, withStars, 12, 200_000);
  return found ? found.solution : null;
}

/** Topsy-Turvy's bot (standard-pattern-check's topsySteps at a batch level). */
function topsySteps(p: Of<"gravity">, level: BatchLevel, rngSeed: number): Step[] {
  const skill = TOPSY_BATCH[level];
  const rng = makeRng(rngSeed);
  const boards = p.boards!;
  const limits = p.tiltLimits ?? [];
  const limit = puzzleTimeLimitMs(p);
  const tokens: GravityDir[] = [];
  const steps: Step[] = [];
  const think = (s: number) => Math.round(s * skill.pace * (0.65 + 0.7 * rng.next()) * 1000);
  let at = 0;
  outer: for (const [b, board] of boards.entries()) {
    const walls = new Set(board.walls);
    at += think(TOPSY_READ_S);
    const wantStars = board.stars.length > 0 && rng.next() < skill.stars;
    let state = topsyStart(board);
    let used = 0;
    while (used < limits[b]!) {
      if (at >= limit) break outer;
      if (state.balls.every((ball) => ball === -1)) break;
      let dir: GravityDir | null = null;
      if (rng.next() >= skill.err) {
        const route = (wantStars ? topsyRoute(board, state, true) : null) ?? topsyRoute(board, state, false);
        if (route && route.length) dir = route[0]!;
      }
      if (!dir) {
        const options = DIRS.filter((d) => topsyTilt(board, walls, state, d).moved);
        dir = options[rng.below(options.length)]!;
      }
      at += think(TOPSY_TILT_S);
      tokens.push(dir);
      steps.push({ answer: tokens.join(""), atMs: at });
      state = topsyTilt(board, walls, state, dir).state;
      used++;
    }
  }
  return steps;
}

/** One play at a level: its steps (as the phone sends drafts) and whether the answer carries its own times. */
export function playBatch(type: BatchType, p: PuzzleData, level: BatchLevel, seed: number): { steps: Step[]; timed?: boolean } {
  const rngSeed = hashText(`batch-nov:${type}:${seed}:${level}`);
  if (type === "gravity") return { steps: topsySteps(p as Of<"gravity">, level, rngSeed) };
  return KITS[type]!.play(p, makeRng(rngSeed), KIT_SKILLS[level], puzzleTimeLimitMs(p));
}

/** Random play (guessing): the kit's spam answers, or random tilts every 0.4 s on Topsy-Turvy. Each at the buzzer. */
export function spamBatch(type: BatchType, p: PuzzleData, seed: number): { label: string; answer: string; msLeft: number }[] {
  const limit = puzzleTimeLimitMs(p);
  if (type === "gravity") {
    const out: { label: string; answer: string; msLeft: number }[] = [];
    for (const k of [0, 1, 2]) {
      const rng = makeRng(hashText(`batch-nov:gravity:spam:${seed}:${k}`));
      const tokens: GravityDir[] = [];
      let at = 400;
      for (; at < limit; at += 400) {
        tokens.push(DIRS[rng.below(4)]!);
        if (replayTopsyPuzzle(p as never, tokens).over) break;
      }
      const solved = replayTopsyPuzzle(p as never, tokens).solved;
      out.push({ label: `random-tilts-${k}`, answer: tokens.join(""), msLeft: solved ? Math.max(0, limit - at) : 0 });
    }
    return out;
  }
  return KITS[type]!.spam(p, makeRng(hashText(`batch-nov:${type}:spam:${seed}`)), limit).map((s) => ({ label: s.label, answer: s.answer, msLeft: 0 }));
}

/**
 * The flawless solve: the shortest route (Labyrinth's route cell by cell, Skid's fewest slides, Topsy-Turvy's fewest
 * tilts on each board), finished `atS` seconds into the round. Null when the stored puzzle has no server route.
 */
export function flawlessSolve(type: BatchType, p: PuzzleData, atS = 15): { answer: string; msLeft: number } | null {
  const msLeft = Math.max(0, puzzleTimeLimitMs(p) - atS * 1000);
  if (type === "maze") {
    const m = p as MazePuzzleData;
    if (!m.solution?.length) return null;
    return { answer: encodeMazeTrail(m.solution, mazeColsOf(m)), msLeft };
  }
  if (type === "iceslide") {
    const s = p as Of<"iceslide">;
    return s.solution ? { answer: s.solution, msLeft } : null;
  }
  const g = p as Of<"gravity">;
  const routes = g.boardSolutions;
  return routes?.length ? { answer: routes.join(""), msLeft } : null;
}
