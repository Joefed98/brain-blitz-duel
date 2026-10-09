import type { ArcadeInputEvent } from "@/lib/arcade/engine";
import { SNIP_INPUT_CUT, type SnipState } from "@/lib/arcade/snip";

/** A short swipe across rope i, perpendicular to its first segment. */
export function cutFor(s: SnipState, i: number): ArcadeInputEvent {
  const r = s.ropes[i]!;
  const x = (r.x[0]! + r.x[1]!) / 512;
  const y = (r.y[0]! + r.y[1]!) / 512;
  const dx = (r.y[1]! - r.y[0]!) / 256;
  const dy = (r.x[0]! - r.x[1]!) / 256;
  const L = Math.max(1, Math.hypot(dx, dy));
  return {
    t: s.tick + 1,
    k: SNIP_INPUT_CUT,
    a: Math.round(x - (dx / L) * 15),
    b: Math.round(y - (dy / L) * 15),
    c: Math.round(x + (dx / L) * 15),
    d: Math.round(y + (dy / L) * 15),
  };
}

