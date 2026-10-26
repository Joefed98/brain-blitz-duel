/**
 * Server-only: the depth revision's grade (logicDepth.ts) on top of puzzleScoreRev 3's. An unfinished round keeps
 * rev 3's progress score; a finish is rescored to 120 + speed + the game's top (stretch, par or clean crack). The
 * stored breakdown adds up to the score: the par bonus and the clean crack are stored as the efficiency term with
 * their own label ("120 + 45 par + 30 speed"); the stretch rides in the speed term ("120 + 64 speed").
 */
import type { Graded } from "./grade";
import { depthFinish, depthRevOf, usesDepth, type DepthFinishInput } from "./logicDepth";
import { puzzleTimeLimitMs } from "./registry";
import type { PuzzleData } from "./types";

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** The moves and par the par games and Colour Flood are judged on. */
export function depthMovesAndPar(puzzle: PuzzleData, extra: Record<string, unknown> | null | undefined): { moves?: number | undefined; par?: number | undefined } {
  const e = extra ?? {};
  switch (puzzle.type) {
    case "lightsout":
      return { moves: num(e["presses"]), par: puzzle.minPresses ?? undefined };
    case "tower":
      return { moves: num(e["moves"]), par: puzzle.minMoves };
    case "tubes":
      return { moves: num(e["moves"]), par: puzzle.minMoves ?? undefined };
    case "flood":
      return { moves: num(e["moves"]), par: puzzle.par };
    default:
      return {};
  }
}

/** A rev-3 grade turned into the depth revision's (unchanged when the puzzle is not on it or unfinished). */
export function withLogicDepth(puzzle: PuzzleData, graded: Graded): Graded {
  if (!usesDepth(puzzle) || !graded.isCorrect) return graded;
  const limit = puzzleTimeLimitMs(puzzle);
  const extra = graded.extra ?? {};
  const left = limit > 0 ? Math.max(0, Math.min(limit, graded.storedMs)) / limit : 0;
  const input: DepthFinishInput = {
    left,
    efficiency: num(extra["efficiency"]) ?? 1,
    ...depthMovesAndPar(puzzle, extra),
    ...(puzzle.type === "safe" ? { openedOn: num(extra["openedOn"]) ?? 3 } : {}),
  };
  const r = depthFinish(puzzle.type, input, depthRevOf(puzzle));
  const labelled = r.topLabel !== "";
  const parts = labelled
    ? { kind: "finish" as const, base: 120, efficiency: r.top, measure: r.topLabel, speed: r.speed }
    : { kind: "finish" as const, base: 120, speed: r.speed + r.top };
  return {
    ...graded,
    score: r.score,
    extra: {
      ...extra,
      parts,
      rev3Score: graded.score,
      depth: { top: r.top, speed: r.speed, ...(r.atPar !== undefined ? { atPar: r.atPar } : {}), ...(input.par !== undefined ? { par: input.par } : {}) },
    },
  };
}
