/**
 * Ringer's swipe (alleyRollRev 2; phone side, never imported by the sim): one swipe up the lane makes one roll.
 * Where the swipe starts along the bottom sets the release point, its angle the direction and its speed the power.
 * The same swipe always makes the same input, and the skill-band bots go through this same mapping, so their errors
 * are a finger's errors. Rev 1's rounds keep their own ranges (`ringerSwipeInput(…, 1)`).
 */
import {
  AR2_VMAX, AR2_VMIN, AR_INPUT_ROLL, AR_MAX_ANGLE_DEN, AR_MAX_ANGLE_NUM, AR_RELEASE_MAX, AR_VMAX, AR_VMIN, ALLEYROLL_REV_RINGER,
} from "./alleyroll";

/** The world's width and centre line, and the lane's scale at the release line (world px a lane unit). */
export const AR_SWIPE_WORLD_W = 414;
export const AR_SWIPE_CX = AR_SWIPE_WORLD_W / 2;
export const AR_NEAR_SCALE = 1.55;
/** Swipe speed (world px a ms over the swipe's last 140 ms) for the weakest and the strongest roll. */
export const AR_SWIPE_SLOW = 0.35;
export const AR_SWIPE_FAST = 2.4;
/** A screen slope (across ÷ up) is this much of a slope on the lane: rev 2 a steadier hand's share, rev 1 as it was. */
export const AR_SLOPE_SCALE_V2 = 0.2;
export const AR_SLOPE_SCALE_V1 = 0.6;
/** The swipe must climb this far (world px) before it counts. */
export const AR_SWIPE_MIN_UP = 8;

export interface ArSwipeInput {
  k: number;
  a: number;
  b: number;
  c: number;
}

const speedRange = (rev: number): readonly [number, number] => (rev >= ALLEYROLL_REV_RINGER ? [AR2_VMIN, AR2_VMAX] : [AR_VMIN, AR_VMAX]);
const slopeScale = (rev: number) => (rev >= ALLEYROLL_REV_RINGER ? AR_SLOPE_SCALE_V2 : AR_SLOPE_SCALE_V1);

/** The release point (lane units) for a screen x on the release line. */
export function arReleaseAt(screenX: number): number {
  return Math.max(-AR_RELEASE_MAX, Math.min(AR_RELEASE_MAX, Math.round((screenX - AR_SWIPE_CX) / AR_NEAR_SCALE)));
}

/** The screen x of a release point. */
export function arReleaseScreenX(release: number): number {
  return AR_SWIPE_CX + release * AR_NEAR_SCALE;
}

/** The roll a swipe makes: started at `startX`, moved (dx, dy) world px in `ms` (dy < 0 is up the screen). */
export function ringerSwipeInput(startX: number, dx: number, dy: number, ms: number, rev: number = ALLEYROLL_REV_RINGER): ArSwipeInput | null {
  if (dy >= -AR_SWIPE_MIN_UP) return null;
  const [lo, hi] = speedRange(rev);
  const speed = Math.hypot(dx, dy) / Math.max(1, ms);
  const power = Math.max(0, Math.min(1, (speed - AR_SWIPE_SLOW) / (AR_SWIPE_FAST - AR_SWIPE_SLOW)));
  const c = Math.round(lo + power * (hi - lo));
  const most = Math.floor((c * AR_MAX_ANGLE_NUM) / AR_MAX_ANGLE_DEN);
  const b = Math.max(-most, Math.min(most, Math.round(c * (dx / -dy) * slopeScale(rev))));
  return { k: AR_INPUT_ROLL, a: arReleaseAt(startX), b, c };
}

/** The swipe (speed in px a ms, screen slope) that would make the input (b, c): the inverse the bots aim with. */
export function ringerSwipeFor(b: number, c: number, rev: number = ALLEYROLL_REV_RINGER): { speed: number; slope: number } {
  const [lo, hi] = speedRange(rev);
  const power = (c - lo) / (hi - lo);
  return { speed: AR_SWIPE_SLOW + power * (AR_SWIPE_FAST - AR_SWIPE_SLOW), slope: b / c / slopeScale(rev) };
}
