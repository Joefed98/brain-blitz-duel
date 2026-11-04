/**
 * The "?" help SCORE text and the round intro SCORE line for the scoring standard's Pattern and Logic games, first half
 * (docs/scoring-standard.md). Written from patternRules.ts's numbers (the grader's own), with {max} for the game's
 * maximum (roundMax.ts, 200), so the texts always state what the standard's stamp deals. Shared, pure.
 */
import { BLOCK_STD, FLOW_STD, ICE_STD, LASER_STD, PATTERN_STD, PUSH_STD, TOPSY_STD, type PatternStdType } from "./patternRules";
import { puzzleScoreList, type ScoreLine } from "../scoreList";
import { fillMax } from "../roundMax";
import { PAR_MOVES_STD, PAR_STRICT_FULL_BY_S, parMovesDealt, parStrictDealt } from "../parMoves";

/** The intro line (two phone lines at most, no scoring terms). */
export const PATTERN_STD_INTRO: Record<PatternStdType, string> = {
  unblock: "Free the gold block; bonuses for speed and the fewest moves. Up to {max}.",
  blockparty: "Fill the board; bonuses for speed and pieces right first time. Up to {max}.",
  iceslide: "Reach the exit; bonuses for speed and every ice gem. Up to {max}.",
  gravity: "Clear all three boards; bonuses for speed and the stars. Up to {max}.",
  tiles: "Put every tile in place; bonuses for speed and few swaps. Up to {max}.",
  rings: "Line up every spoke; bonuses for speed and the fewest turns. Up to {max}.",
  laser: "Light all six gems; bonuses for speed, few mirrors and a first-shot solve. Up to {max}.",
  flow: "Join every pair; bonuses for speed and never redrawing a line. Up to {max}.",
  pipes: "Join every pipe to the source; bonuses for speed and the fewest taps. Up to {max}.",
  push: "Push every crate onto a mark; bonuses for speed, few pushes, the gold crate. Up to {max}.",
};

const fmt = (n: number) => String(Math.round(n * 10) / 10);

/** A par bonus line: all of it at par, nothing at twice (or one and a half times) par. */
function parLine(type: PatternStdType | "iceslide" | "gravity", label: string, fewest: string, max: number, zeroAt = "twice that"): ScoreLine {
  return { label, how: `${fewest} for all of it, less for each one over, nothing at ${zeroAt}`, max };
}

function help(type: PatternStdType, finish: string, bonuses: ScoreLine[], unfinished: string, fullByS = PATTERN_STD[type].fullByS, speed = PATTERN_STD[type].speed): string {
  return puzzleScoreList({ finish, speed: { max: speed, fullByS }, bonuses, unfinished, total: "{max}" as unknown as number });
}

const P = (t: PatternStdType) => PATTERN_STD[t].par ?? 0;

/** The "?" help SCORE text: one line a part (scoreList.ts). */
export const PATTERN_STD_HELP: Record<PatternStdType, string> = {
  unblock: help("unblock", "free the gold block", [parLine("unblock", "Moves", "solve it in the fewest moves (par)", P("unblock"))], "the share of the blocks in the gold block's way you clear, more for doing it early; wasted moves take it down"),
  blockparty: help("blockparty", "fill the board", [{ label: "First time", how: "pieces placed right first time and never moved again", max: BLOCK_STD.firstTime }], `${BLOCK_STD.perPiece} for each piece on its spot in the solution, more for placing it early`),
  iceslide: help("iceslide", "reach the exit", [{ label: "Ice gems", how: "collect the ice gems off the direct route", max: ICE_STD.gems }], "how much closer you got to the exit, plus the gems so far; wasted slides take it down"),
  gravity: help("gravity", "clear all three boards", [{ label: "Stars", how: "collect the stars", max: TOPSY_STD.stars }, parLine("gravity", "Tilts", "clear each board in the fewest tilts (par)", P("gravity"))], "the share of the balls home, more for doing it early; wasted tilts take it down"),
  tiles: help("tiles", "put every tile in place", [parLine("tiles", "Swaps", "finish in the fewest swaps (par, shown)", P("tiles"))], "the share of the tiles in place, more for doing it early"),
  rings: help("rings", "line up every spoke", [parLine("rings", "Turns", "finish in the fewest turns (par)", P("rings"))], "the share of the spokes lined up, more for doing it early; wasted turns take it down"),
  laser: help("laser", "light all six gems", [
    { label: "Mirrors", how: "use no more mirrors than the solution needs for all of it, nothing at twice that", max: LASER_STD.mirrors },
    { label: "First shot", how: "solve it with your first shot", max: LASER_STD.firstShot },
  ], `${LASER_STD.perGem} for each gem your best shot lit without a bomb, more for lighting it early`),
  flow: help("flow", "join every pair", [{ label: "Clean lines", how: `never redraw a finished line, ${fmt(FLOW_STD.perRedraw)} less for each you change`, max: FLOW_STD.clean }], "the share of the pairs joined along their own route, more for doing it early"),
  pipes: help("pipes", "join every pipe to the source", [parLine("pipes", "Taps", "finish in the fewest taps (par)", P("pipes"))], "the share of the pipes joined to the source, more for doing it early"),
  push: help("push", "push every crate onto a mark", [
    { label: "Gold crate", how: "the gold crate on the gold mark", max: PUSH_STD.gold },
    parLine("push", "Pushes", "finish in the fewest pushes (par)", P("push")),
  ], `${PUSH_STD.perCrate} for each crate on a mark, more for getting it there early, plus the gold crate; wasted pushes take it down`),
};

/**
 * Skid and Topsy-Turvy on the puzzle batch's stamps (3 Nov 2026, parMoves.ts: slideRev 3, gravityRev 6): no gems or
 * stars; a finish is 150 + up to 30 for speed + up to 20 for par moves. The intro line (at most 90 characters).
 */
export const PAR_MOVES_PATTERN_INTRO: Record<"iceslide" | "gravity", string> = {
  iceslide: "Reach the exit; bonuses for speed and the fewest slides. Up to {max}.",
  gravity: "Clear all three boards; bonuses for speed and the fewest tilts. Up to {max}.",
};

function parMovesHelp(strict: boolean): Record<"iceslide" | "gravity", string> {
  // slideRev 4 / gravityRev 7 (puzzle polish, 3 Nov 2026): par shown on screen, speed full earlier, par gone at 1.5×.
  const zero = strict ? "one and a half times par" : "twice par";
  const fullBy = (t: "iceslide" | "gravity") => (strict ? PAR_STRICT_FULL_BY_S[t] : PATTERN_STD[t].fullByS);
  const one = (t: "iceslide" | "gravity", finish: string, label: string, fewest: string, unfinished: string) =>
    puzzleScoreList({
      finish,
      speed: { max: PAR_MOVES_STD.speed, fullByS: fullBy(t) },
      bonuses: [parLine(t, label, `${fewest}${strict ? " (par, shown)" : " (par)"}`, PAR_MOVES_STD.par, zero)],
      unfinished,
      total: "{max}" as unknown as number,
    });
  return {
    iceslide: one("iceslide", "reach the exit", "Slides", "reach it in the fewest slides", "how much closer you got to the exit, more for doing it early; wasted slides take it down"),
    gravity: one("gravity", "clear all three boards", "Tilts", "clear each board in the fewest tilts", "the share of the balls home, more for doing it early; wasted tilts take it down"),
  };
}

/** The "?" help SCORE text on the puzzle batch's stamps. */
export const PAR_MOVES_PATTERN_HELP: Record<"iceslide" | "gravity", string> = parMovesHelp(false);
/** The "?" help SCORE text on the stricter-par stamps (puzzle polish, 3 Nov 2026). */
export const PAR_STRICT_PATTERN_HELP: Record<"iceslide" | "gravity", string> = parMovesHelp(true);
/** The help for the stamps dealt now. */
export const parMovesPatternHelp = (type: "iceslide" | "gravity"): string => (parStrictDealt() ? PAR_STRICT_PATTERN_HELP : PAR_MOVES_PATTERN_HELP)[type];

/** The help as shown ({max} filled in: the game's maximum, 200). */
export function patternStdHelp(type: PatternStdType): string {
  // Skid and Topsy-Turvy state the puzzle batch's stamps while rooms deal them (parMoves.ts).
  if ((type === "iceslide" || type === "gravity") && parMovesDealt()) return fillMax(parMovesPatternHelp(type), type);
  return fillMax(PATTERN_STD_HELP[type], type);
}

/** The intro line as shown ({max} filled in). */
export function patternStdIntro(type: PatternStdType): string {
  if ((type === "iceslide" || type === "gravity") && parMovesDealt()) return fillMax(PAR_MOVES_PATTERN_INTRO[type], type);
  return fillMax(PATTERN_STD_INTRO[type], type);
}
