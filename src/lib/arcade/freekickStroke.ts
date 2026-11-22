/**
 * Top Bins' strike type from the stroke's shape (freekickRev 5, 15 Nov 2026; display and input mapping only: the phone
 * reads the shape and sends the type as the SHOT's d; the sim never sees the stroke). Pure, shared by the stage, the
 * live preview and the checks.
 *
 *   - a flick at the end (the stroke's last FLICK_SHARE turning at least FLICK_TURN_DEG off the stroke's own direction
 *     where the tail starts, over at least FLICK_MIN_PX) is a dipping strike;
 *   - otherwise a stroke bent less than DRIVE_CURL (the curl it reads as) is a driven strike;
 *   - anything bent more is a curler.
 */
export const FLICK_SHARE = 0.2;
/**
 * The polish plan's C4.6 (Joe, 20 Nov 2026: "most shots dip when they should curl"): the tail is compared with the
 * stroke's tangent where the tail starts (the direction over the TANGENT_SHARE before it), not with the chord from the
 * stroke's start, and must turn at least 50° (was 35° against the chord, which read every real curler, a smooth arc
 * turning about 106° in all, as a flick). Input mapping on the phone only: the sim reads the SHOT's d, so no stamp.
 */
export const FLICK_TURN_DEG = 50;
export const TANGENT_SHARE = 0.1;
export const FLICK_MIN_PX = 14;
export const DRIVE_CURL = 22;

export const STRIKE_CURL = 0;
export const STRIKE_DRIVE = 1;
export const STRIKE_DIP = 2;

export interface StrokePt {
  x: number;
  y: number;
}

/** Whether a stroke ends in a flick (a sharp turn over its last part). */
export function strokeFlicks(pts: readonly StrokePt[]): boolean {
  if (pts.length < 4) return false;
  let total = 0;
  const run: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
    run.push(total);
  }
  if (total < 40) return false;
  const cut = total * (1 - FLICK_SHARE);
  let j = run.findIndex((r) => r >= cut);
  if (j <= 0) j = pts.length - 2;
  const m = pts[j]!;
  const e = pts[pts.length - 1]!;
  const tail = Math.hypot(e.x - m.x, e.y - m.y);
  if (tail < FLICK_MIN_PX) return false;
  // The stroke's own direction where the tail starts: over the stretch just before m.
  let k = run.findIndex((r) => r >= cut - total * TANGENT_SHARE);
  if (k < 0 || k >= j) k = j - 1;
  const s = pts[k]!;
  const a1 = Math.atan2(m.y - s.y, m.x - s.x);
  const a2 = Math.atan2(e.y - m.y, e.x - m.x);
  let d = Math.abs(a2 - a1);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return (d * 180) / Math.PI >= FLICK_TURN_DEG;
}

/** The strike type a drawn stroke reads as, given the curl it reads as. */
export function strikeFromStroke(pts: readonly StrokePt[], curl: number): number {
  if (strokeFlicks(pts)) return STRIKE_DIP;
  return Math.abs(curl) < DRIVE_CURL ? STRIKE_DRIVE : STRIKE_CURL;
}

export const STRIKE_LABEL = ["Curler", "Driven", "Dipping"] as const;
