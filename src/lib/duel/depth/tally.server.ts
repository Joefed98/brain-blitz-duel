/** Depth to 200 grader (stub until this game's revision lands; applies to nothing). */
import type { DepthGrader } from "../depth200.server";

export const tallyDepth: DepthGrader = {
  applies: () => false,
  grade: ({ graded }) => graded,
};
