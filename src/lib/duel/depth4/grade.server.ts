/**
 * Depth batch 4: the grade on the new stamps (docs/depth/d4-pattern.md). generate.server.ts's gradeAnswer
 * hands every rev-3 grade of a stamped puzzle here; rounds without the stamp never reach it. A finish gains
 * the stretch and feature points (score.ts) from the facts grade.ts stored for the reveal (moves, turns,
 * gems, the gold crate, mirrors); an unfinished round keeps rev 3's score, except Tessellate's bigger board,
 * whose progress counts its own pieces.
 */
import type { Graded } from "../grade";
import { rev3Unfinished } from "../puzzleScoreRev3";
import { storedScoreParts } from "../puzzleScoreRev";
import type { PuzzleData } from "../types";
import { d4Finish, d4Game, parShare } from "./score";
import { d4RevOf, isDepth4, isD4Type, type D4Type } from "./stamps";

/** Each move over par costs this share of the par bonus. */
export const D4_PAR_STEP: Record<"unblock" | "rings" | "pipes" | "laser", number> = {
  unblock: 1 / 8,
  rings: 1 / 3,
  pipes: 0.1,
  laser: 0.5,
};

function num(extra: Record<string, unknown> | null | undefined, key: string): number | null {
  const v = extra?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** The feature's share (0–1) from the grade's stored facts. */
export function d4FeatureShare(type: D4Type, puzzle: PuzzleData, extra: Record<string, unknown> | null | undefined): number {
  const step = (t: keyof typeof D4_PAR_STEP) => d4Game(t, d4RevOf(puzzle)).parStep ?? D4_PAR_STEP[t];
  switch (type) {
    case "unblock":
      return parShare(num(extra, "moves") ?? Infinity, num(extra, "par") ?? 0, step("unblock"));
    case "rings":
      return parShare(num(extra, "moves") ?? Infinity, num(extra, "par") ?? 0, step("rings"));
    case "pipes":
      return parShare(num(extra, "turns") ?? Infinity, num(extra, "par") ?? 0, step("pipes"));
    case "laser":
      return parShare(num(extra, "solveMirrors") ?? Infinity, num(extra, "par") ?? 0, step("laser"));
    case "iceslide": {
      const total = num(extra, "gems") ?? 0;
      return total > 0 ? (num(extra, "gemsCollected") ?? 0) / total : 0;
    }
    case "push":
      return extra?.["goldHome"] === true ? 1 : 0;
    default:
      void puzzle;
      return 0;
  }
}

/** The depth grade for a stamped puzzle: `graded` is its rev-3 grade. */
export function withDepth4(puzzle: PuzzleData, graded: Graded): Graded {
  if (!isDepth4(puzzle) || !isD4Type(puzzle.type)) return graded;
  const type = puzzle.type;
  const extra = graded.extra ?? {};
  if (!graded.isCorrect) {
    // Tessellate's board has more pieces than rev 1's credit counts: progress is its own pieces in place.
    const share = num(extra, "d4Progress");
    if (share === null) return graded;
    const r = rev3Unfinished(type, share);
    return { ...graded, score: r.score, extra: { ...extra, parts: r.parts, progressShare: r.progress } };
  }
  const parts = storedScoreParts(extra);
  const left = num(extra, "time") ?? 0;
  const efficiency = num(extra, "efficiency") ?? 1;
  const share = d4FeatureShare(type, puzzle, extra);
  const r = d4Finish(type, graded.score, parts?.speed ?? 0, left, efficiency, share, d4RevOf(puzzle));
  return {
    ...graded,
    score: r.score,
    extra: { ...extra, parts: r.parts, rev3Score: graded.score, d4: { stretch: r.stretch, feature: r.feature, share: Math.round(share * 1000) / 1000 } },
  };
}
