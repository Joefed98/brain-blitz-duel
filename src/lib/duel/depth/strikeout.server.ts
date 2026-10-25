/** strikeout's depth grader (wordDepth.server.ts). Placeholder until the game's depth stamp lands: never applies. */
import type { DepthGrader } from "../wordDepth.server";

export const strikeoutDepth: DepthGrader = {
  applies: () => false,
  grade: (ctx) => ctx.today,
};
