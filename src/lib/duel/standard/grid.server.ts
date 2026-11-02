/**
 * The scoring standard's grid puzzles born on it (1 Nov 2026): Fences, Fillomino, Bridges (Logic) and Kakuro (Number),
 * each on its own stamp 1. Server only; imported by name from games.server.ts (never for side effects).
 *
 * A finish (the game's own rules-and-solution verdict) is 150 + speed + a clean bonus (10, 2.5 less for each distinct
 * wrong item the board ever held, read from the draft timeline; no timeline, no clean bonus). Unfinished is up to 120
 * by (items on the solution − items off it) ÷ the solution's items, plus up to 10 for how early those items were placed.
 */
import type { PuzzleData, PuzzleType } from "../types";
import { fencesProgress, fencesWrongKeys } from "../fences";
import { fillominoProgress, fillominoWrongKeys } from "../fillomino";
import { bridgesProgress, bridgesWrongKeys } from "../bridges";
import { kakuroProgress, kakuroWrongKeys } from "../kakuro";
import { cleanPoints, speedPoints } from "./shape";
import type { StandardGame, StandardInput } from "./grade.server";
import { GRID_EARLY_POINTS, GRID_SHARE_POINTS, GRID_STANDARD, gridNetPlaced, type GridStandardType } from "./gridRules";

interface GridProgress {
  right: number;
  wrong: number;
  total: number;
}

interface GridGame {
  progress(puzzle: PuzzleData, answer: string): GridProgress;
  wrongKeys(puzzle: PuzzleData, answer: string): string[];
}

const GAMES: Record<GridStandardType, GridGame> = {
  fences: {
    progress: (p, a) => (p.type === "fences" ? fencesProgress(p, a) : EMPTY),
    wrongKeys: (p, a) => (p.type === "fences" ? fencesWrongKeys(p, a) : []),
  },
  fillomino: {
    progress: (p, a) => (p.type === "fillomino" ? fillominoProgress(p, a) : EMPTY),
    wrongKeys: (p, a) => (p.type === "fillomino" ? fillominoWrongKeys(p, a) : []),
  },
  bridges: {
    progress: (p, a) => (p.type === "bridges" ? bridgesProgress(p, a) : EMPTY),
    wrongKeys: (p, a) => (p.type === "bridges" ? bridgesWrongKeys(p, a) : []),
  },
  kakuro: {
    progress: (p, a) => (p.type === "kakuro" ? kakuroProgress(p, a) : EMPTY),
    wrongKeys: (p, a) => (p.type === "kakuro" ? kakuroWrongKeys(p, a) : []),
  },
};

const EMPTY: GridProgress = { right: 0, wrong: 0, total: 0 };

/** Distinct wrong items across every draft of the timeline (null without one: history unknown). */
function everWrong(game: GridGame, input: StandardInput): number | null {
  if (!input.drafts) return null;
  const seen = new Set<string>();
  for (const d of input.drafts) for (const k of game.wrongKeys(input.puzzle, d.draft)) seen.add(k);
  return seen.size;
}

function gridGame(type: GridStandardType): StandardGame {
  const game = GAMES[type];
  const rule = GRID_STANDARD[type];
  return {
    parts: (p, a) => {
      const g = game.progress(p, a);
      return gridNetPlaced(g.right, g.wrong);
    },
    grade(input, ctx) {
      if (input.graded.isCorrect) {
        const mistakes = everWrong(game, input);
        const speed = speedPoints(rule.speed, input.msLeft, input.limitMs, rule.fullByS * 1000);
        const bonus = mistakes === null ? 0 : cleanPoints(rule.bonus, rule.per, mistakes);
        return { finished: true, speed, bonus, measure: "clean", facts: { mistakes } };
      }
      const g = game.progress(input.puzzle, input.answer);
      if (!(g.total > 0)) return { finished: false, credit: 0, facts: { right: g.right, wrong: g.wrong } };
      const net = gridNetPlaced(g.right, g.wrong);
      const parts = Math.min(g.total, net);
      const credit = (GRID_SHARE_POINTS * net) / g.total + ctx.early(GRID_EARLY_POINTS / g.total, parts);
      return { finished: false, credit, facts: { right: g.right, wrong: g.wrong, total: g.total } };
    },
  };
}

/** The four games, read by the grader (games.server.ts). */
export const GRID_STANDARD_GAMES: Partial<Record<PuzzleType, StandardGame>> = {
  fences: gridGame("fences"),
  fillomino: gridGame("fillomino"),
  bridges: gridGame("bridges"),
  kakuro: gridGame("kakuro"),
};
