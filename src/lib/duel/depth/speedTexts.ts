/**
 * Depth to 200 (25 Oct 2026): the "?" help SCORE texts and intro SCORE lines for Flash, Bang On and Ascend on
 * tapRev 5, built from their own rules (depth/flash.ts, bangOn.ts, ascend.ts), so a changed constant changes the
 * text. "{max}" is the game's round maximum (roundMax.ts); the figures below it are the curves' own.
 */
import { FLASH_DECOY_FREE_SHARE_PCT } from "../tapLog";
import { scoreList } from "../scoreList";
import { STOPWATCH_REV4_CURVE } from "../scoring";
import { fastFinishSeconds, rev3Figures } from "../puzzleBandsText";
import { FLASH_REV6_CURVE, FLASH_STEADY_LOOSE_MS, FLASH_STEADY_LOOSE_POINTS, FLASH_STEADY_TIGHT_MS, FLASH_STEADY_TIGHT_POINTS } from "./flash";
import { BANGON_TOPUP_CENTRE_POINTS, BANGON_TOPUP_STREAK_TOP } from "./bangOn";
import { ASCEND_FLOW_GAP_MS, ASCEND_FLOW_MAX, ASCEND_FLOW_STEP, ASCEND_FLOW_TOP } from "./ascend";

const grouped = (n: number) => n.toLocaleString("en-GB");

export function flashDepthHelp(): string {
  const [topMs, topPts] = FLASH_REV6_CURVE[0];
  return scoreList([
    { label: "Reactions", how: `the faster your average reaction, the more; ${topMs} ms or faster for all of it (a miss counts as ${grouped(1200)} ms)`, max: topPts },
    { label: "Steady hand", how: `hit every flash with no false start and every reaction within ${FLASH_STEADY_TIGHT_MS} ms of the others (${FLASH_STEADY_LOOSE_POINTS} within ${FLASH_STEADY_LOOSE_MS} ms)`, max: FLASH_STEADY_TIGHT_POINTS },
  ], {
    penalties: [
      "Each false start costs 8, then 11 after the second",
      `Tapping more than ${FLASH_DECOY_FREE_SHARE_PCT} % of the decoys slows every reaction; tapping them all scores nothing`,
    ],
    total: "{max}" as unknown as number,
  });
}

export const FLASH_DEPTH_INTRO = "React fast to every flash; a bonus for a steady hand. Up to {max}.";

export function bangOnDepthHelp(): string {
  return scoreList([
    { label: "Closeness", how: "the closer your average stop, the more (a miss counts as 500 ms)", max: 150 },
    { label: "Dead centre", how: `${BANGON_TOPUP_CENTRE_POINTS} for each stop on the bright centre line` },
    { label: "Zone streak", how: `watches in a row stopped in the gold zone: 2 for the second, 3 for the third, 4, then ${BANGON_TOPUP_STREAK_TOP} each` },
  ], { penalties: ["Dead centre and the zone streak add up to 50 at most"], total: "{max}" as unknown as number });
}

export const BANGON_DEPTH_INTRO = "Stop each watch close to the mark; bonuses for dead centre and zone streaks. Up to {max}.";

export function ascendDepthHelp(): string {
  const f = rev3Figures("numhunt");
  return `Progress counts: numbers reached in order (wrong taps cost). Unfinished scores up to 110: about ${f.half} half done. A finish scores 120 to 150: 120 as time runs out, 150 if you finish in about ${f.fastSeconds} s with no wrong taps. Flow: right taps under ${ASCEND_FLOW_GAP_MS / 1000} s apart build a multiplier, ×2 from the ${ASCEND_FLOW_STEP}th in a row, ×3 from the ${2 * ASCEND_FLOW_STEP}th, ×${ASCEND_FLOW_TOP} from the ${3 * ASCEND_FLOW_STEP}th; each right tap earns its multiplier less one, up to +${ASCEND_FLOW_MAX}. A wrong tap or a longer pause starts it again. {max} needs a fast, clean finish in one unbroken flow.`;
}

export const ASCEND_DEPTH_INTRO = `Finish fast for up to 150. Quick taps in a row build a flow bonus: up to {max}.`;

/** For the record: Ascend's clean finish time for 150 (seconds). */
export const ascendFastSeconds = (): number => fastFinishSeconds("numhunt");
