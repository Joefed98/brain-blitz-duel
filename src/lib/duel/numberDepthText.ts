/**
 * Score text for the Number puzzles to 200 (depthRev 1, the feature games depthRev 2, numberDepth.ts; docs/depth/d2-number.md): the round
 * intro SCORE line and the "?" help, for the rounds rooms deal today. Every maximum is the game's own
 * (roundMaxFor), never a written number; 150 and 110 are the milestones the rev-3 part keeps.
 */
import {
  BALLPARK_HAIR,
  BALLPARK_SPEED_POINTS,
  BALLPARK_STREAK_POINTS,
  EXACT_ELEGANT_TILES,
  NUMBER_DEPTH_EXTRA,
  NUMBER_DEPTH_GAMES,
} from "./numberDepth";
import { dealtLimitMs, EFFICIENCY_WORD, fastFinishSeconds, PROGRESS_MEASURE, PROGRESS_SHORT, rev3Figures } from "./puzzleBandsText";
import { roundMaxFor } from "./roundMax";
import type { PuzzleType } from "./types";

/** Seconds of play an elite finish (the stretch's top; a feature game's full bonus) may take: the clock less its elite share. */
export function eliteFinishSeconds(type: PuzzleType): number {
  const game = NUMBER_DEPTH_GAMES[type];
  const elite = (game?.route === "feature" ? game.featureElite : game?.elite) ?? 1;
  return Math.round((dealtLimitMs(type) * (1 - elite)) / 1000);
}

/** The feature's one-line name and what earns it (the help and the intro). */
const FEATURE: Partial<Record<PuzzleType, { help: string; intro: string }>> = {
  target: {
    help: `Elegance bonus: hit the target using only ${EXACT_ELEGANT_TILES} of the 6 numbers`,
    intro: `Use only ${EXACT_ELEGANT_TILES} numbers: up to {max}`,
  },
  measure: {
    help: "Par pours: solve a puzzle in its fewest moves (the par shown on it); the bonus is shared over the four puzzles",
    intro: "Fewest moves each: up to {max}",
  },
  checkout: {
    help: "Big finish: check out on the Bull, or on a treble where the board asks for a double; the bonus is shared over the five boards",
    intro: "Bull or treble finishes: up to {max}",
  },
};

function cap(text: string): string {
  return `${text[0]!.toUpperCase()}${text.slice(1)}`;
}

/** The round intro SCORE line (at most two phone lines; `{max}` is filled by introScore.ts). */
export function depthIntro(type: PuzzleType): string {
  const short = cap(PROGRESS_SHORT[type] ?? "progress");
  if (type === "numline") return "Up to 8 per number, more if quick and close. Bullseyes in a row: up to {max}.";
  const feature = FEATURE[type];
  if (feature) return `${short}: up to 110. Finish: 120+, quicker more. ${feature.intro}.`;
  return `${short}: up to 110. Finish: 120+, 150 in about ${fastFinishSeconds(type)} s; faster, up to {max}.`;
}

/** The "?" help SCORE text. */
export function depthHelp(type: PuzzleType): string {
  const max = roundMaxFor(type);
  if (type === "numline")
    return `Up to 8 per number: full 8 within 1% of the line, falling evenly to 0 at 10% away; 25% or more away costs 1. Place all 15 for more, the quicker and the more of them within 1% the better; that total maps to the score bands (about 70 average, 100 good, 120 great, 150 for a perfect one). Bullseye streak: a number within ${BALLPARK_HAIR * 100}% of exact is a bullseye, and bullseyes in a row add up to ${BALLPARK_STREAK_POINTS} more (each adds the streak so far, up to 4). Finishing in about ${eliteFinishSeconds(type)} s with every number within 1% adds up to ${BALLPARK_SPEED_POINTS} more; ${max} is perfect.`;
  const f = rev3Figures(type);
  const eff = EFFICIENCY_WORD[type];
  const head = `Progress counts: ${PROGRESS_MEASURE[type] ?? "your progress"}. Unfinished scores up to 110: about ${f.half} half done, 110 one step short. Any finish scores 120 to 150: 120 as time runs out, 150 if you finish in about ${f.fastSeconds} s with no mistakes${eff ? ` (extra ${eff} only cut the speed points)` : ""}.`;
  const feature = FEATURE[type];
  if (feature)
    return `${head} ${feature.help}, for up to ${NUMBER_DEPTH_EXTRA} more: about ${Math.round(NUMBER_DEPTH_EXTRA * (NUMBER_DEPTH_GAMES[type]?.featureBase ?? 1))} of it when you also finish in about ${f.fastSeconds} s, all of it only in about ${eliteFinishSeconds(type)} s; ${max} is perfect.`;
  return `${head} Finishing faster than that earns up to ${NUMBER_DEPTH_EXTRA} more, rising steeply: ${max} only for a finish in about ${eliteFinishSeconds(type)} s with no mistakes.`;
}
