/**
 * Depth batch 4's simulated players (docs/depth/d4-pattern.md): the fairness audit's kits
 * (scripts/puzzle-fairness/) at five skill levels, the audit's four plus an elite player, playing seeded
 * room puzzles before (the old stamps) and after (the new). Every answer is graded by the server's own
 * gradeAnswer. Script-only: floats and Math.random-free (every choice comes from the kit's seeded rng).
 *
 * Where a feature is a choice the kits cannot see (Heave's gold crate, Skid's gems), each level goes for it
 * with a fixed chance (FEATURE_TRY); where it is a best plan the kits are handed (par moves and turns,
 * Lightbender's fewest mirrors), each level finds it with a fixed chance (PAR_FIND) and otherwise lands a few
 * steps over (PAR_MISS). Assumptions Joe's beta data can tune.
 */
import { gradeAnswer } from "../../src/lib/duel/generate.server";
import { puzzleTimeLimitMs } from "../../src/lib/duel/registry";
import type { PuzzleData, PuzzleType } from "../../src/lib/duel/types";
import { BLOCK_GEOMETRY_D4, absoluteCells, encodePlacements, fitsOn, orientationsFor } from "../../src/lib/duel/blockParty";
import { rotateMask, tileOpenings } from "../../src/lib/duel/logic";
import { encodePipesTapAnswer } from "../../src/lib/duel/depth4/pipesTaps";
import { gemRoute } from "../../src/lib/duel/depth4/gems.server";
import { d4Finish, parShare } from "../../src/lib/duel/depth4/score";
import { D4_PAR_STEP } from "../../src/lib/duel/depth4/grade.server";
import type { D4Type } from "../../src/lib/duel/depth4/stamps";
import { KITS } from "../puzzle-fairness/kits";
import { SKILLS, hashText, makeRng, thinkMs, type Play, type PuzzleKit, type Rng, type Skill, type Step } from "../puzzle-fairness/kit";

export const D4_LEVELS = ["average", "good", "great", "near", "elite"] as const;
export type D4Level = (typeof D4_LEVELS)[number];

/** The elite player: clearly faster than today's near-perfect kit and almost never wrong. */
export const ELITE: Skill = { level: "near", pace: 0.32, err: 0.004, reactionMs: 140, reactionSd: 15 };

export function skillOf(level: D4Level): Skill {
  return level === "elite" ? ELITE : SKILLS[level];
}

/** The chance a level goes for a feature the kit cannot see. */
export const FEATURE_TRY: Record<D4Level, number> = { average: 0.25, good: 0.45, great: 0.65, near: 0.85, elite: 1 };

/**
 * The chance a level finds a fewest-moves plan at all (the kits replay the stored minimum, which no player is
 * handed): otherwise its finish runs PAR_MISS[type] moves over par, picked evenly.
 */
export const PAR_FIND: Record<D4Level, number> = { average: 0.02, good: 0.08, great: 0.15, near: 0.25, elite: 0.85 };
export const PAR_MISS: Partial<Record<PuzzleType, [number, number]>> = { unblock: [2, 6], rings: [1, 4], pipes: [2, 12], laser: [1, 2] };

export interface Run {
  score: number;
  solved: boolean;
  share?: number;
}

/** The fairness audit's runPlay, for any skill: the answer is graded the moment it solves, else at the buzzer. */
export function playAndGrade(kit: PuzzleKit, puzzle: PuzzleData, rng: Rng, skill: Skill): { graded: ReturnType<typeof gradeAnswer>; ms: number } {
  const limit = puzzleTimeLimitMs(puzzle);
  const play = kit.play(puzzle, rng, skill, limit);
  const inTime = play.steps.filter((s) => s.atMs <= limit);
  if (!inTime.length) return { graded: gradeAnswer(puzzle, kit.nothing(puzzle), 0), ms: 0 };
  if (play.timed) {
    const last = inTime[inTime.length - 1]!;
    const done = gradeAnswer(puzzle, last.answer, Math.max(0, limit - last.atMs));
    return { graded: done.isCorrect ? done : gradeAnswer(puzzle, last.answer, 0), ms: limit - last.atMs };
  }
  for (const step of inTime) {
    const g = gradeAnswer(puzzle, step.answer, Math.max(0, limit - step.atMs));
    if (g.isCorrect) return { graded: g, ms: limit - step.atMs };
  }
  return { graded: gradeAnswer(puzzle, inTime[inTime.length - 1]!.answer, 0), ms: 0 };
}

/* ---------------------------------------------------------------- new-stamp kits */

/** Pipeline on pipesRev 1: the audit's player, its side-sets turned into the tap log the phone now sends. */
function pipesTapKit(base: PuzzleKit): PuzzleKit {
  return {
    ...base,
    nothing: (p) => encodePipesTapAnswer((p as Extract<PuzzleData, { type: "pipes" }>).tiles, []),
    play: (p, rng, skill, limit) => {
      const q = p as Extract<PuzzleData, { type: "pipes" }>;
      const play = base.play(p, rng, skill, limit);
      let prev = q.tiles.map(tileOpenings);
      const taps: number[] = [];
      const steps: Step[] = play.steps.map((step) => {
        const sides = [...step.answer].map((ch) => Number.parseInt(ch, 16));
        sides.forEach((v, cell) => {
          for (let t = 0; t < 4; t++) if (rotateMask(prev[cell]!, t) === v) {
            for (let k = 0; k < t; k++) taps.push(cell);
            break;
          }
        });
        prev = sides;
        return { answer: encodePipesTapAnswer(sides.map((s) => ({ sides: s })), taps), atMs: step.atMs };
      });
      return { steps };
    },
  };
}

/** Skid on slideRev 1: a player who goes for the gems plays the gem route as the audit plays the shortest one. */
function slideGemKit(base: PuzzleKit, level: D4Level): PuzzleKit {
  return {
    ...base,
    play: (p, rng, skill, limit) => {
      const q = p as Extract<PuzzleData, { type: "iceslide" }>;
      if (!(q.gems ?? []).length || !rng.chance(FEATURE_TRY[level])) return base.play(p, rng, skill, limit);
      const route = gemRoute(q);
      return base.play(route ? { ...q, solution: route.join("") } : q, rng, skill, limit);
    },
  };
}

/** Tessellate's 7×7 board: the audit's piece-by-piece player on the bigger board. */
function block7Kit(base: PuzzleKit): PuzzleKit {
  const geo = BLOCK_GEOMETRY_D4;
  const legal = (piece: number, taken: Set<number>) => {
    const out: number[][] = [];
    for (const offsets of orientationsFor(geo)[piece]!)
      for (let r = 0; r < geo.cols; r++) for (let c = 0; c < geo.cols; c++) {
        const cells = absoluteCells(offsets, r, c, geo.cols);
        if (cells && fitsOn(cells, taken, geo.cells)) out.push(cells);
      }
    return out;
  };
  const BASE = 5.5;
  return {
    ...base,
    play: (p, rng, skill): Play => {
      const q = p as Extract<PuzzleData, { type: "blockparty" }>;
      const solution = q.solution ?? [];
      const target = new Map(solution.map((s) => [s.piece, s.cells]));
      let placed: { piece: number; cells: number[] }[] = [];
      const todo = solution.map((s) => s.piece);
      const wrong = new Set<number>();
      const steps: Step[] = [];
      let at = 0;
      const taken = (skip?: number) => {
        const t = new Set(q.blockers);
        for (const e of placed) if (e.piece !== skip) for (const c of e.cells) t.add(c);
        return t;
      };
      const put = (piece: number, cells: number[]) => (placed = [...placed.filter((e) => e.piece !== piece), { piece, cells }]);
      for (let guard = 0; guard < 240 && (todo.length || wrong.size); guard++) {
        const next = todo[0];
        const block = next !== undefined ? placed.find((e) => wrong.has(e.piece) && e.cells.some((c) => target.get(next)!.includes(c))) : undefined;
        if (wrong.size && (next === undefined || block || rng.chance(0.4))) {
          const w = block?.piece ?? [...wrong][0]!;
          at += thinkMs(rng, BASE * 0.6, skill);
          const goal = target.get(w)!;
          const other = placed.find((e) => e.piece !== w && wrong.has(e.piece) && e.cells.some((c) => goal.includes(c)));
          if (other) {
            placed = placed.filter((e) => e.piece !== other.piece);
            wrong.delete(other.piece);
            todo.push(other.piece);
          } else {
            put(w, goal);
            wrong.delete(w);
          }
          steps.push({ answer: encodePlacements(placed), atMs: at });
          continue;
        }
        todo.shift();
        at += thinkMs(rng, BASE, skill);
        const goal = target.get(next!)!;
        if (rng.chance(skill.err)) {
          const options = legal(next!, taken(next)).filter((c) => [...c].sort().join() !== [...goal].sort().join());
          if (options.length) {
            put(next!, rng.pick(options));
            wrong.add(next!);
            steps.push({ answer: encodePlacements(placed), atMs: at });
            continue;
          }
        }
        put(next!, goal);
        steps.push({ answer: encodePlacements(placed), atMs: at });
      }
      return { steps };
    },
  };
}

export function kitFor(type: PuzzleType, puzzle: PuzzleData, level: D4Level): PuzzleKit {
  const base = KITS[type]!;
  const p = puzzle as Record<string, unknown>;
  if (type === "pipes" && p["pipesRev"]) return pipesTapKit(base);
  if (type === "iceslide" && p["slideRev"]) return slideGemKit(base, level);
  if (type === "blockparty" && p["blockRev"]) return block7Kit(base);
  return base;
}

/**
 * One player's score on one puzzle. On the new stamps, a level that misses a feature the kit would have earned
 * keeps the kit's play and loses that feature: the gold crate on another mark (FEATURE_TRY), or a finish a few
 * moves, turns, taps or mirrors over par (PAR_FIND, PAR_MISS).
 */
export function runLevel(type: PuzzleType, puzzle: PuzzleData, seed: number, level: D4Level): Run {
  const rng = makeRng(hashText(`${type}:d4:${seed}:${level}`));
  const kit = kitFor(type, puzzle, level);
  const { graded } = playAndGrade(kit, puzzle, rng, skillOf(level));
  const extra = graded.extra ?? {};
  const d4 = extra["d4"] as { share: number } | undefined;
  let score = graded.score;
  const refinish = (share: number): Run => {
    const rev3 = extra["rev3Score"] as number;
    score = d4Finish(type as D4Type, rev3, rev3 - 120, (extra["time"] as number) ?? 0, (extra["efficiency"] as number) ?? 1, share).score;
    return { score, solved: true, share };
  };
  if (d4 && graded.isCorrect && type === "push" && !rng.chance(FEATURE_TRY[level])) return refinish(0);
  const miss = PAR_MISS[type];
  if (d4 && graded.isCorrect && miss && d4.share >= 1 && !rng.chance(PAR_FIND[level])) {
    const over = rng.int(miss[0], miss[1]);
    return refinish(parShare(1 + over, 1, D4_PAR_STEP[type as "unblock"]));
  }
  return { score, solved: graded.isCorrect, ...(d4 ? { share: d4.share } : {}) };
}
