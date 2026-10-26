/**
 * Intro and "?" help score texts for Eagle Eye scanRev 2, Double Take spotRev 2 and Tally countRev 3 (depth to 200,
 * 25 Oct 2026). Every figure comes from the curves in eagleEye.ts / doubleTake.ts / tally.ts and the game's maximum
 * (roundMaxFor), so the texts always state what rooms deal.
 */
import { rev3Figures } from "../puzzleBandsText";
import { roundMaxFor } from "../roundMax";
import type { StretchCurve } from "../depth200";
import type { PuzzleType } from "../types";
import { SCAN_TOPUP_CURVE as SCAN_DEPTH_CURVE } from "./eagleEye";
import { COUNT_TOPUP_CURVE as COUNT_DEPTH_CURVE } from "./tally";
import { DOUBLE_TAKE_BONUS, SPOT_DEPTH_CURVE } from "./doubleTake";

const LIMIT_S: Partial<Record<PuzzleType, number>> = { symscan: 30, spotdiff: 60, countup: 60 };

/** Seconds of play a clean finish may take and still reach the stretch's top. */
export function stretchTopSeconds(type: PuzzleType, curve: StretchCurve): number {
  return Math.round((LIMIT_S[type] ?? 60) * (1 - curve.eliteShare));
}

function helpLine(type: PuzzleType, measure: string, curve: StretchCurve, clean: string, extra = ""): string {
  const f = rev3Figures(type);
  const top = curve === SPOT_DEPTH_CURVE ? 150 + curve.stretchTop : roundMaxFor(type);
  return `Progress counts: ${measure}. Unfinished scores up to 110: about ${f.half} half done, 110 one step short. Any finish scores 120 or more: 120 as time runs out, 150 if you finish in about ${f.fastSeconds} s, then faster still climbs to ${top} in about ${stretchTopSeconds(type, curve)} s ${clean}.${extra}`;
}

export function eagleEyeDepthHelp(): string {
  return helpLine("symscan", "eagles found (wrong taps cost)", SCAN_DEPTH_CURVE, "with no tap taken back (each one you take back cuts the climb above 150)");
}
export function eagleEyeDepthIntro(): string {
  return `Eagles found: up to 110. Finish: 120+, or {max} in about ${stretchTopSeconds("symscan", SCAN_DEPTH_CURVE)} s, none taken back.`;
}

export function tallyDepthHelp(): string {
  return helpLine("countup", "trays counted right (one off still counts a little)", COUNT_DEPTH_CURVE, "(all four counts exact)");
}
export function tallyDepthIntro(): string {
  return `Trays counted: up to 110. All four right: 120+, or {max} in about ${stretchTopSeconds("countup", COUNT_DEPTH_CURVE)} s.`;
}

export function doubleTakeDepthHelp(): string {
  return helpLine(
    "spotdiff",
    "differences found (wrong taps cost)",
    SPOT_DEPTH_CURVE,
    "with no wrong taps (each wrong tap cuts the climb above 150)",
    ` One picture also hides a seventh, subtler difference, not in the count: find it before that picture's sixth and a finish adds ${DOUBLE_TAKE_BONUS}, so ${roundMaxFor("spotdiff")} needs both.`,
  );
}
export function doubleTakeDepthIntro(): string {
  return `Unfinished: up to 110. All 12: 120+, quicker for more; +${DOUBLE_TAKE_BONUS} for the hidden 7th. Top {max}.`;
}
