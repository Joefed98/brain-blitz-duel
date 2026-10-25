/**
 * Depth batch 4: the intro SCORE line and the "?" help text for the eight games (docs/depth/d4-pattern.md).
 * Written with {max} (roundMax.ts fills in the game's maximum, 200 for these games) and with the numbers the
 * scoring uses (score.ts, grade.server.ts's par steps, rev 3's fast share), so the texts always state what
 * the new stamp deals. Shared, pure.
 */
import { PROGRESS_MEASURE, dealtLimitMs } from "../puzzleBandsText";
import { rev3FastFinishSeconds, rev3UnfinishedScore } from "../puzzleScoreRev3";
import { fillMax } from "../roundMax";
import { d4Game } from "./score";
import type { D4Type } from "./stamps";

/** What earns the feature, as the intro says it (no scoring terms: no "par", no "speed bonus"). */
const INTRO_FEATURE: Record<D4Type, string> = {
  unblock: "Fewest possible moves, fast",
  rings: "Fewest turns, very fast",
  pipes: "Fewest taps, very fast",
  laser: "Fewer mirrors, very fast",
  blockparty: "A very fast fill",
  flow: "A very fast finish",
  iceslide: "Every ice gem, fast",
  push: "Gold crate on its mark, fast",
};

/** The feature, as the help explains it, with the share lost per step over its par where it has one. */
const HELP_FEATURE: Partial<Record<D4Type, string>> = {
  unblock: "Par is the fewest moves the lot can be solved in: finishing at or under par earns more (each move over par costs a third of it)",
  rings: "Par is the fewest turns that line the rings up: finish at or under par for up to 25 more (each turn over par costs a third of it)",
  pipes: "Par is the fewest taps that turn the board into its solution: finish at or under par for up to 25 more (each tap over par costs a tenth of it)",
  laser: "An elegant beam lights every gem with no more mirrors than the solution needs (there are two spare): up to 25 more (each extra mirror costs half of it)",
  iceslide: "Ice gems sit off the shortest route; slide over them on your way; each gem collected earns a share",
  push: "One crate is gold: finishing with it on the gold mark earns more",
};

/** Seconds a finish must take at most to reach the top of the stretch. */
export function d4EliteSeconds(type: D4Type): number {
  return Math.round((dealtLimitMs(type) * (1 - d4Game(type).elite)) / 1000);
}

export function d4IntroTemplate(type: D4Type): string {
  return `Progress up to 110, finish 120+. ${INTRO_FEATURE[type]}: up to {max}.`;
}

export function d4Intro(type: D4Type): string {
  return fillMax(d4IntroTemplate(type), type);
}

export function d4Help(type: D4Type): string {
  const g = d4Game(type);
  const fast = rev3FastFinishSeconds(type, dealtLimitMs(type));
  const half = rev3UnfinishedScore(type, 0.5);
  const feature = HELP_FEATURE[type];
  const parts = [
    `Progress counts: ${PROGRESS_MEASURE[type] ?? "your progress"}. Unfinished scores up to 110: about ${half} half done, 110 one step short.`,
    `Any finish scores 120 to 150 as before: 120 as time runs out, 150 if you finish in about ${fast} s with nothing wasted.`,
  ];
  if (g.stretch > 0)
    parts.push(`Finishing faster still adds up to ${g.stretch} more, all of it for a finish in about ${d4EliteSeconds(type)} s with nothing wasted.`);
  if (feature && g.featureBase !== undefined)
    parts.push(`${feature}. It pays up to ${g.featureBase} at that 150 pace (less when slower), and up to ${g.feature} for a finish in about ${d4EliteSeconds(type)} s.`);
  else if (feature)
    parts.push(`${feature}; the full amount at that 150 pace, less when slower.`);
  parts.push(`{max} needs ${g.stretch > 0 && feature ? "both" : "it all"}.`);
  return fillMax(parts.join(" "), type);
}
