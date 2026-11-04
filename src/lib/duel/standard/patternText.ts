/**
 * The "?" help SCORE text and the round intro SCORE line for the scoring standard's Pattern and Logic games, first half
 * (docs/scoring-standard.md). Written from patternRules.ts's numbers (the grader's own), with {max} for the game's
 * maximum (roundMax.ts, 200), so the texts always state what the standard's stamp deals. Shared, pure.
 */
import { BLOCK_STD, FLOW_STD, ICE_STD, LASER_STD, PATTERN_STD, PUSH_STD, SHARE_CREDIT, SHARE_EARLY, TOPSY_STD, type PatternStdType } from "./patternRules";
import { STANDARD_FINISH, STANDARD_UNFINISHED_CAP } from "./shape";
import { fillMax } from "../roundMax";
import { PAR_MOVES_STD, PAR_STRICT_FULL_BY_S, parMovesDealt, parStrictDealt } from "../parMoves";

/** The intro line (two phone lines at most, no scoring terms). */
export const PATTERN_STD_INTRO: Record<PatternStdType, string> = {
  unblock: "Points for clearing the way. Finish fast in the fewest moves for up to {max}.",
  blockparty: "Points per piece in place. Fill it fast, pieces right first time, for up to {max}.",
  iceslide: "Points for getting closer. Reach the exit fast with every ice gem for up to {max}.",
  gravity: "Points for balls home and stars. Clear all three boards fast for up to {max}.",
  tiles: "Points for tiles in place. Finish in few swaps, and fast, for up to {max}.",
  rings: "Points for spokes lined up. Finish fast in the fewest turns for up to {max}.",
  laser: "Points per gem lit. Light all six fast, first shot, few mirrors, for up to {max}.",
  flow: "Points per pair joined. Finish fast without redrawing a line for up to {max}.",
  pipes: "Points for pipes joined up. Finish fast in the fewest taps for up to {max}.",
  push: "Points per crate placed. Finish fast in few pushes, gold crate home, for up to {max}.",
};

const fmt = (n: number) => String(Math.round(n * 10) / 10);

function finish(type: PatternStdType, bonus: string): string {
  const r = PATTERN_STD[type];
  return `Finish: ${STANDARD_FINISH}, + up to ${r.speed} for speed (all of it if you finish within ${r.fullByS} s, less as the clock runs down, none at the buzzer), ${bonus}.`;
}

function parBonus(type: PatternStdType, what: string, parIs: string): string {
  return `+ up to ${PATTERN_STD[type].par} for ${what}: all of it at par (${parIs}), less for each one over, none at twice par`;
}

function byShare(what: string, more = ""): string {
  return `Unfinished: up to ${SHARE_CREDIT} for ${what}, + up to ${SHARE_EARLY} for doing it early${more}; at most ${STANDARD_UNFINISHED_CAP}, so finishing always scores more.`;
}

/** The move games' waste factor, as the help says it. */
const waste = (what: string) => `, less for wasted ${what} (none left at four times the fewest)`;

/** The "?" help SCORE text. */
export const PATTERN_STD_HELP: Record<PatternStdType, string> = {
  unblock: [
    finish("unblock", parBonus("unblock", "moves", "the fewest moves the lot can be solved in")),
    byShare(`the share of the blocks in the gold block's way you clear (the blocks in its row ahead, and the blocks in their way out)${waste("moves")}`),
    "{max} needs both.",
  ].join(" "),
  blockparty: [
    finish("blockparty", `+ up to ${BLOCK_STD.firstTime} for pieces placed right first time (never moved again), shared across the pieces`),
    `Unfinished: ${BLOCK_STD.perPiece} for each piece on its spot in the solution (a piece placed elsewhere takes one off), + up to ${fmt(BLOCK_STD.earlyPerPiece)} each for placing it early, + the right-first-time share of the pieces standing there; at most ${STANDARD_UNFINISHED_CAP}, so finishing always scores more.`,
    "{max} needs both.",
  ].join(" "),
  iceslide: [
    finish("iceslide", `+ up to ${ICE_STD.gems} for the ice gems off the direct route, shared across the gems you collect`),
    byShare(`the share of the route you close (the fewest slides left from the closest you got)${waste("slides")}`, `, + the gems collected so far`),
    "{max} needs every gem.",
  ].join(" "),
  gravity: [
    finish("gravity", `+ up to ${TOPSY_STD.stars} for the stars (shared across all of them) and ${parBonus("gravity", "tilts", "the fewest tilts that clear each board, added up").slice(2)}`),
    byShare(`the share of the balls home${waste("tilts")}`, ", + the stars on boards you cleared"),
    "{max} needs every star, fast and in few tilts.",
  ].join(" "),
  tiles: [
    finish("tiles", parBonus("tiles", "swaps", "shown with your swaps")),
    byShare("the share of the tiles you put in place"),
    "{max} needs both.",
  ].join(" "),
  rings: [
    finish("rings", parBonus("rings", "turns", "the fewest turns that line the rings up")),
    byShare(`the share of the spokes lined up, counted segment by segment (each ring's segment showing its spoke's finished colour)${waste("turns")}`),
    "{max} needs both.",
  ].join(" "),
  laser: [
    finish("laser", `+ up to ${LASER_STD.mirrors} for an elegant beam (all of it with no more mirrors than the solution needs, none at twice that) and ${LASER_STD.firstShot} for solving it with your first shot`),
    `Unfinished: ${LASER_STD.perGem} for each gem your best shot lit without a bomb (the board as it stands at the buzzer counts as a shot if you have one left), + up to ${fmt(LASER_STD.earlyPerGem)} each for lighting it early; at most ${STANDARD_UNFINISHED_CAP}, so finishing always scores more.`,
    "{max} needs it all.",
  ].join(" "),
  flow: [
    finish("flow", `+ ${FLOW_STD.clean} for never redrawing a finished line, ${fmt(FLOW_STD.perRedraw)} less for each line you change or clear after joining it`),
    byShare("the share of the pairs joined along their own route (a pair joined another way takes one off)"),
    "{max} needs both.",
  ].join(" "),
  pipes: [
    finish("pipes", parBonus("pipes", "taps", "the fewest taps that turn the board into its solution")),
    byShare("the share of the pipes you join to the source"),
    "{max} needs both.",
  ].join(" "),
  push: [
    finish("push", `+ ${PUSH_STD.gold} for the gold crate on the gold mark and ${parBonus("push", "pushes", "the fewest pushes").slice(2)}`),
    `Unfinished: ${PUSH_STD.perCrate} for each crate you push onto a mark, + up to ${PUSH_STD.earlyPerCrate} each for getting it there early${waste("pushes")}, + ${PUSH_STD.gold} for the gold crate on its mark; at most ${STANDARD_UNFINISHED_CAP}, so finishing always scores more.`,
    "{max} needs it all.",
  ].join(" "),
};

/**
 * Skid and Topsy-Turvy on the puzzle batch's stamps (3 Nov 2026, parMoves.ts: slideRev 3, gravityRev 6): no gems or
 * stars; a finish is 150 + up to 30 for speed + up to 20 for par moves. The intro line (at most 90 characters).
 */
export const PAR_MOVES_PATTERN_INTRO: Record<"iceslide" | "gravity", string> = {
  iceslide: "Points for getting closer. Reach the exit fast in the fewest slides for up to {max}.",
  gravity: "Points for balls home. Clear all three boards fast in the fewest tilts for up to {max}.",
};

function parMovesFinish(type: "iceslide" | "gravity", what: string, parIs: string, strict: boolean): string {
  // slideRev 4 / gravityRev 7 (puzzle polish, 3 Nov 2026): par shown on screen, speed full earlier, par gone at 1.5×.
  const fullBy = strict ? PAR_STRICT_FULL_BY_S[type] : PATTERN_STD[type].fullByS;
  return `Finish: ${STANDARD_FINISH}, + up to ${PAR_MOVES_STD.speed} for speed (all of it if you finish within ${fullBy} s, less as the clock runs down, none at the buzzer), + up to ${PAR_MOVES_STD.par} for ${what}: all of it at par (${parIs}${strict ? ", shown on screen" : ""}) or under, less for each one over, none at ${strict ? "one and a half times" : "twice"} par.`;
}

function parMovesHelp(strict: boolean): Record<"iceslide" | "gravity", string> {
  return {
    iceslide: [
      parMovesFinish("iceslide", "slides", "the fewest slides the exit can be reached in", strict),
      byShare(`the share of the route you close (the fewest slides left from the closest you got)${waste("slides")}`),
      "{max} needs both.",
    ].join(" "),
    gravity: [
      parMovesFinish("gravity", "tilts", "the fewest tilts that clear each board, added up", strict),
      byShare(`the share of the balls home${waste("tilts")}`),
      "{max} needs both.",
    ].join(" "),
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
