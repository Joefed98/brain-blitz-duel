/** wordsearch's depth grader (wordDepth.server.ts). Placeholder until the game's depth stamp lands: never applies. */
import type { DepthGrader } from "../wordDepth.server";

export const wordsearchDepth: DepthGrader = {
  applies: () => false,
  grade: (ctx) => ctx.today,
};
