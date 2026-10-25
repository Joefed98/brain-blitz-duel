/**
 * Nucleus's depth grader (wordsmithRev 3, 25 Oct 2026; wordDepth.server.ts, scoring.ts WORDSMITH_V3_CURVE).
 *
 * gradeWordsmith already scores a rev-3 board on the new curve (word points to 180, plus the pangram bonus);
 * today's rev-2 pass clamps it to 150, so the depth grade is gradeWordsmith's own score, stored with its two
 * parts: `wordScore` (the curve) and `pangramBonus` (a word using every tile).
 */
import { WORDSMITH_REV_DEPTH, WORDSMITH_V3_PANGRAM_BONUS, wordsmithV3Words } from "../scoring";
import { DEPTH_MAX } from "../wordDepth";
import type { DepthGrader } from "../wordDepth.server";

export const wordsmithDepth: DepthGrader = {
  applies: (puzzle) => puzzle.type === "wordsmith" && (puzzle.wordsmithRev ?? 0) >= WORDSMITH_REV_DEPTH,
  grade: ({ puzzle, graded }) => {
    if (puzzle.type !== "wordsmith") return graded;
    const points = typeof graded.extra?.["points"] === "number" ? (graded.extra["points"] as number) : 0;
    const words = Array.isArray(graded.extra?.["words"]) ? (graded.extra["words"] as string[]) : [];
    const pangram = words.some((word) => word.length >= puzzle.letters.length);
    const wordScore = wordsmithV3Words(points);
    const pangramBonus = pangram ? WORDSMITH_V3_PANGRAM_BONUS : 0;
    const score = Math.max(0, Math.min(DEPTH_MAX, wordScore + pangramBonus));
    return {
      ...graded,
      score,
      extra: { ...(graded.extra ?? {}), wordScore, pangramBonus, parts: { kind: "partial", base: score } },
    };
  },
};
