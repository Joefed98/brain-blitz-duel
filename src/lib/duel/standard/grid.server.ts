/**
 * The scoring standard's grid puzzles born on it (1 Nov 2026): Fences, Fillomino, Bridges (Logic) and Kakuro (Number),
 * each on its own stamp 1. Server only; imported by name from games.server.ts (never for side effects).
 *
 * A finish (the game's own rules-and-solution verdict) is 150 + speed + a clean bonus (10, 2.5 less for each distinct
 * wrong item the board ever held, read from the draft timeline; no timeline, no clean bonus). Unfinished is up to 120
 * by (items on the solution − items off it) ÷ the solution's items, plus up to 10 for how early those items were placed.
 */
import type { PuzzleData, PuzzleType } from "../types";
import { FENCES_CROSS, FENCES_LINE, decodeFences, fencesProgress, fencesWrongKeys } from "../fences";
import { fillominoProgress, fillominoWrongKeys } from "../fillomino";
import { fillominoStrokes } from "../logicOverhaul2";
import { bridgePairs, bridgesProgress, bridgesWrongKeys, decodeBridges } from "../bridges";
import { leftWrongKeys, usesNotesFree } from "../notesFree";
import { kakuroProgress, kakuroRuleMistakeKeys, kakuroWrongKeys } from "../kakuro";
import { kakuroRuleMistakes } from "../numberOverhaul";
import { cleanPoints, speedPoints } from "./shape";
import { storedFullByS } from "./levelSpeed";
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
  /**
   * notesRev 1 (notesFree.ts): true when `next` is `cur` with the item behind wrong key `key` moved one step on its tap
   * cycle (Loopline's line to ✕, Island Link's double to none) and nothing else changed.
   */
  cycledOn?(puzzle: PuzzleData, cur: string, next: string, key: string): boolean;
  /**
   * Distinct mistakes read from the drafts in order, in place of wrongKeys, where the game's stamp says so (Kakuro
   * kakuroRev 2: only a digit that breaks a rule as it goes in); null to use wrongKeys.
   */
  mistakesFrom?(puzzle: PuzzleData, drafts: readonly string[]): number | null;
}

const GAMES: Record<GridStandardType, GridGame> = {
  fences: {
    progress: (p, a) => (p.type === "fences" ? fencesProgress(p, a) : EMPTY),
    wrongKeys: (p, a) => (p.type === "fences" ? fencesWrongKeys(p, a) : []),
    cycledOn: (p, cur, next, key) => {
      if (p.type !== "fences") return false;
      const a = decodeFences(cur, p.size);
      const b = decodeFences(next, p.size);
      const e = Number(key);
      return a[e] === FENCES_LINE && b[e] === FENCES_CROSS && a.every((s, i) => i === e || s === b[i]);
    },
  },
  fillomino: {
    progress: (p, a) => (p.type === "fillomino" ? fillominoProgress(p, a) : EMPTY),
    wrongKeys: (p, a) => (p.type === "fillomino" ? fillominoWrongKeys(p, a) : []),
  },
  bridges: {
    progress: (p, a) => (p.type === "bridges" ? bridgesProgress(p, a) : EMPTY),
    wrongKeys: (p, a) => (p.type === "bridges" ? bridgesWrongKeys(p, a) : []),
    cycledOn: (p, cur, next, key) => {
      if (p.type !== "bridges") return false;
      const n = bridgePairs(p.islands, p.size).length;
      const a = decodeBridges(cur, n);
      const b = decodeBridges(next, n);
      const pair = Number(key.split(":")[0]);
      return a[pair] === 2 && b[pair] === 0 && a.every((v, i) => i === pair || v === b[i]);
    },
  },
  kakuro: {
    progress: (p, a) => (p.type === "kakuro" ? kakuroProgress(p, a) : EMPTY),
    wrongKeys: (p, a) => (p.type === "kakuro" ? kakuroWrongKeys(p, a) : []),
    mistakesFrom: (p, drafts) => (p.type === "kakuro" && kakuroRuleMistakes(p) ? kakuroRuleMistakeKeys(p, drafts).length : null),
  },
};

const EMPTY: GridProgress = { right: 0, wrong: 0, total: 0 };

/** Distinct wrong items across every draft of the timeline (null without one: history unknown). */
function everWrong(game: GridGame, input: StandardInput): number | null {
  if (!input.drafts) return null;
  const ruled = game.mistakesFrom?.(input.puzzle, input.drafts.map((d) => d.draft));
  if (ruled !== undefined && ruled !== null) return ruled;
  if (game.cycledOn && usesNotesFree(input.puzzle)) {
    const cycledOn = game.cycledOn;
    return leftWrongKeys(input.drafts, (d) => game.wrongKeys(input.puzzle, d), (cur, next, key) => cycledOn(input.puzzle, cur, next, key));
  }
  const seen = new Set<string>();
  for (const d of input.drafts) for (const k of game.wrongKeys(input.puzzle, d.draft)) seen.add(k);
  return seen.size;
}

/**
 * Regions fillominoRev 2 (the Logic overhaul, 15 Nov 2026): the drafts that brought in a wrong item not seen before.
 * The stage reports one draft a stroke (or tap), so a stroke over several wrong squares is one mistake.
 */
function wrongChanges(game: GridGame, input: StandardInput): number | null {
  if (!input.drafts) return null;
  const seen = new Set<string>();
  let changes = 0;
  for (const d of input.drafts) {
    let fresh = false;
    for (const k of game.wrongKeys(input.puzzle, d.draft)) {
      if (!seen.has(k)) {
        seen.add(k);
        fresh = true;
      }
    }
    if (fresh) changes++;
  }
  return changes;
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
        const mistakes = fillominoStrokes(input.puzzle) ? wrongChanges(game, input) : everWrong(game, input);
        // Kakuro's level deals may carry their own "full by" time (D2, 22 Nov 2026); none on Normal or any other game.
        const own = type === "kakuro" ? storedFullByS(input.puzzle) : undefined;
        const speed = speedPoints(rule.speed, input.msLeft, input.limitMs, (own ?? rule.fullByS) * 1000);
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
