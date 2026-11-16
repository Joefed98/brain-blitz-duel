/**
 * Checkout's dart flight (the Number overhaul, stage 2, 15 Nov 2026; display only: nothing here reads or changes a
 * grade, a clock or a hit area). The dart is thrown from below the board's bottom edge and flies in an arc to the
 * exact spot it lands on, growing smaller as it goes in; the board's thud, count-down and bust follow its landing.
 * Pure, so the checks prove the arc ends where the dart is drawn.
 */

/** The flight's length (a physical action: well under the 900 ms limit; the next input is never held for it). */
export const CHECKOUT_FLIGHT_MS = 420;
/** Where every dart is thrown from, in the board's 200-unit viewBox: below the middle of its bottom edge. */
export const CHECKOUT_THROW_FROM = { x: 100, y: 236 } as const;
/** How far the arc rises above the straight line from the throw to the landing (viewBox units). */
const ARC_RISE = 34;

export interface FlightFrame {
  /** Where the dart is, relative to its landing spot (viewBox units: the dart's own group is drawn at the spot). */
  dx: number;
  dy: number;
  scale: number;
  offset: number;
}

/**
 * The flight's keyframes for a dart landing at `spot`: a quadratic arc from the throw point, its apex ARC_RISE above
 * the midpoint, sampled at seven points; the last frame is (0, 0) at scale 1, the dart exactly on its spot.
 */
export function checkoutDartFlight(spot: { x: number; y: number }): FlightFrame[] {
  const from = { x: CHECKOUT_THROW_FROM.x - spot.x, y: CHECKOUT_THROW_FROM.y - spot.y };
  const control = { x: from.x / 2, y: from.y / 2 - ARC_RISE };
  const out: FlightFrame[] = [];
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    // Quadratic Bézier from `from` through `control` to (0, 0).
    const dx = u * u * from.x + 2 * u * t * control.x;
    const dy = u * u * from.y + 2 * u * t * control.y;
    out.push({ dx: Math.round(dx * 100) / 100, dy: Math.round(dy * 100) / 100, scale: Math.round((1.9 - 0.9 * t) * 1000) / 1000, offset: t });
  }
  return out;
}

/** The flight as Web Animations keyframes (transform only; px are the SVG's user units on an SVG group). */
export function checkoutFlightKeyframes(spot: { x: number; y: number }): Keyframe[] {
  return checkoutDartFlight(spot).map((f) => ({ transform: `translate(${f.dx}px, ${f.dy}px) scale(${f.scale})`, offset: f.offset }));
}
