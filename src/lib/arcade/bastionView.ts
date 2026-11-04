/**
 * Iron Wall's view (3 Nov 2026, Joe's audit; display and input mapping only, every tank-shooter revision): less sky, the
 * road and the tanks larger. The sim's world is a perspective (bastionTank.ts): the ground at depth scale s sits at
 * y = HORIZON + (WALL − HORIZON)·s with lateral offsets X·s. The view draws the same perspective with the horizon 60 px
 * higher (BT_VIEW_HORIZON, 190 for 250) and every depth scale s replaced by s^P, P = (WALL − HORIZON) / (WALL −
 * BT_VIEW_HORIZON): the field keeps its wall line (y 600 and everything below it are unchanged, so the gun, the wall and
 * the panel stay put), the road's edges stay straight lines into the new vanishing point, and at each depth the warp is
 * a uniform scale, g(s) = s^(P − 1) (1 at the wall, 1.27 at the far end where tanks roll on), so every tank is drawn as
 * its own collision rectangles under the warp's affine at its centre (btViewMatrix: that scale and the shear the warp
 * has there), within 2 px of the exact warp everywhere on it (iron-wall-view-check). The sky above the horizon moves up
 * by the same 60 px.
 *
 * The stage maps the finger (view px) back to the world with the exact inverse (btWorldX / btWorldY) before it sends the
 * aim, so the crosshair the player sees is where the shell lands. Floats are fine here: the sim only ever receives the
 * integer aim the phone records.
 */
import { BT2_HORIZON_Y, BT2_VP_X, BT2_WALL_Y } from "./bastionTank";

/** The view's horizon (world px; the sim's is BT2_HORIZON_Y, 250). */
export const BT_VIEW_HORIZON = 190;
/** How far the sky moves up. */
export const BT_VIEW_SKY_SHIFT = BT2_HORIZON_Y - BT_VIEW_HORIZON;
const U = BT2_WALL_Y - BT2_HORIZON_Y;
const VU = BT2_WALL_Y - BT_VIEW_HORIZON;
/** The depth exponent: s → s^P. */
export const BT_VIEW_P = U / VU;

/** A depth scale's view scale (s^P). */
export function btViewS(s: number): number {
  return s <= 0 ? 0 : Math.pow(s, BT_VIEW_P);
}

/** The warp's local scale at world y: s^(P − 1) on the field, 1 in the sky and from the wall down. */
export function btViewScale(y: number): number {
  if (y <= BT2_HORIZON_Y || y >= BT2_WALL_Y) return 1;
  return Math.pow((y - BT2_HORIZON_Y) / U, BT_VIEW_P - 1);
}

/** World y → view y. */
export function btViewY(y: number): number {
  if (y <= BT2_HORIZON_Y) return y - BT_VIEW_SKY_SHIFT;
  if (y >= BT2_WALL_Y) return y;
  return BT_VIEW_HORIZON + VU * btViewS((y - BT2_HORIZON_Y) / U);
}

/** World point → view x. */
export function btViewX(x: number, y: number): number {
  return BT2_VP_X + (x - BT2_VP_X) * btViewScale(y);
}

/** View y → world y (the exact inverse of btViewY). */
export function btWorldY(vy: number): number {
  if (vy <= BT_VIEW_HORIZON) return vy + BT_VIEW_SKY_SHIFT;
  if (vy >= BT2_WALL_Y) return vy;
  return BT2_HORIZON_Y + U * Math.pow((vy - BT_VIEW_HORIZON) / VU, 1 / BT_VIEW_P);
}

/** View point → world x (the exact inverse of btViewX at that view y). */
export function btWorldX(vx: number, vy: number): number {
  return BT2_VP_X + (vx - BT2_VP_X) / btViewScale(btWorldY(vy));
}

/**
 * The affine map that best draws world shapes around world point (xc, yc) in the view: exact at that point, with the
 * warp's own scale and shear there (x' = g·x + c·y + e, y' = g·y + f; c = (xc − VP)·dg/dy), so a tank drawn on its
 * collision rectangles under it is within 2 px of the exact warp everywhere on it (iron-wall-view-check). As canvas
 * transform arguments [a, b, c, d, e, f].
 */
export function btViewMatrix(xc: number, yc: number): [number, number, number, number, number, number] {
  const g = btViewScale(yc);
  const dg = (btViewScale(yc + 0.5) - btViewScale(yc - 0.5)) / 1;
  const c = (xc - BT2_VP_X) * dg;
  return [g, 0, c, g, btViewX(xc, yc) - g * xc - c * yc, btViewY(yc) - g * yc];
}

/** Applies btViewMatrix(xc, yc) to the context. */
export function btViewTransform(ctx: CanvasRenderingContext2D, xc: number, yc: number): void {
  const [a, b, c, d, e, f] = btViewMatrix(xc, yc);
  ctx.transform(a, b, c, d, e, f);
}
