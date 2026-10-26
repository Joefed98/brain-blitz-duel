/**
 * Depth to 200 (25 Oct 2026): the "?" help SCORE texts and intro SCORE lines for Flash, Bang On and Ascend on
 * tapRev 5, built from their own rules (depth/flash.ts, bangOn.ts, ascend.ts), so a changed constant changes the
 * text. "{max}" is the game's round maximum (roundMax.ts); the figures below it are the curves' own.
 */
import { FLASH_DECOY_FREE_SHARE_PCT } from "../tapLog";
import { STOPWATCH_REV4_CURVE } from "../scoring";
import { fastFinishSeconds, rev3Figures } from "../puzzleBandsText";
import { FLASH_PARTIAL_HIT_MS, FLASH_PARTIAL_PER_HIT, FLASH_REV6_CURVE, FLASH_STEADY_LOOSE_MS, FLASH_STEADY_LOOSE_POINTS, FLASH_STEADY_TIGHT_MS, FLASH_STEADY_TIGHT_POINTS } from "./flash";
import { BANGON_PARTIAL_MS, BANGON_PARTIAL_POINTS, BANGON_TOPUP_CENTRE_POINTS, BANGON_TOPUP_STREAK_TOP } from "./bangOn";
import { ASCEND_FLOW_GAP_MS, ASCEND_FLOW_MAX, ASCEND_FLOW_STEP, ASCEND_FLOW_TOP } from "./ascend";

const grouped = (n: number) => n.toLocaleString("en-GB");

export function flashDepthHelp(): string {
  const knots = FLASH_REV6_CURVE.slice(0, 6).reverse().map(([ms, pts]) => `${ms} ms ≈ ${pts}`).join(", ");
  return `Faster average reactions score more: ${knots} (${FLASH_REV6_CURVE[0][0]} ms or faster). Steady hand: every flash hit with no false start and all your reactions within ${FLASH_STEADY_TIGHT_MS} ms of each other +${FLASH_STEADY_TIGHT_POINTS}, within ${FLASH_STEADY_LOOSE_MS} ms +${FLASH_STEADY_LOOSE_POINTS}; {max} needs ${FLASH_REV6_CURVE[0][0]} ms and a steady hand. Misses count ${grouped(1200)} ms; false starts −8 each for the first two, −11 each after that. Tap more than ${FLASH_DECOY_FREE_SHARE_PCT} % of the decoys and every reaction counts slower; tap them all and none counts. Every flash hit within ${FLASH_PARTIAL_HIT_MS} ms keeps at least ${FLASH_PARTIAL_PER_HIT}.`;
}

export const FLASH_DEPTH_INTRO = `Tap fast and steady: ${FLASH_REV6_CURVE[0][0]} ms on average, all close together, scores {max}.`;

export function bangOnDepthHelp(): string {
  const curve = [...STOPWATCH_REV4_CURVE].reverse().filter(([, pts]) => pts > 0).map(([ms, pts]) => `${ms} ms off ≈ ${pts}`).join(", ");
  return `Closer average stops score up to 150: ${curve}; misses count 500 ms. Dead centre: each stop on the bright centre line +${BANGON_TOPUP_CENTRE_POINTS}. Zone streak: watches in a row stopped in the gold zone, the 2nd +2, the 3rd +3, the 4th +4, every later one +${BANGON_TOPUP_STREAK_TOP}; the two add up to 50 at most. {max} needs a close average and a long run on the line. Every watch stopped within ${BANGON_PARTIAL_MS} ms keeps at least ${BANGON_PARTIAL_POINTS}.`;
}

export const BANGON_DEPTH_INTRO = `Close stops score more. Hit the bright line, and the zone again and again: up to {max}.`;

export function ascendDepthHelp(): string {
  const f = rev3Figures("numhunt");
  return `Progress counts: numbers reached in order (wrong taps cost). Unfinished scores up to 110: about ${f.half} half done. A finish scores 120 to 150: 120 as time runs out, 150 if you finish in about ${f.fastSeconds} s with no wrong taps. Flow: right taps under ${ASCEND_FLOW_GAP_MS / 1000} s apart build a multiplier, ×2 from the ${ASCEND_FLOW_STEP}th in a row, ×3 from the ${2 * ASCEND_FLOW_STEP}th, ×${ASCEND_FLOW_TOP} from the ${3 * ASCEND_FLOW_STEP}th; each right tap earns its multiplier less one, up to +${ASCEND_FLOW_MAX}. A wrong tap or a longer pause starts it again. {max} needs a fast, clean finish in one unbroken flow.`;
}

export const ASCEND_DEPTH_INTRO = `Finish fast for up to 150. Quick taps in a row build a flow bonus: up to {max}.`;

/** For the record: Ascend's clean finish time for 150 (seconds). */
export const ascendFastSeconds = (): number => fastFinishSeconds("numhunt");
