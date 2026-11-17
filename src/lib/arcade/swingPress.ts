/**
 * Grappler's "out of reach" moment (the Action overhaul, stage 2, 15 Nov 2026; display and sound only): a press that
 * grabbed nothing. The sim records no such press (it simply finds no target), so the live stage notes each press here
 * (noteSwingPress, from its pointer and Space handlers) and observeSwingPress, called once a frame with the live state
 * by the sound observer, decides a few ticks later whether it grabbed: no grab since the press, still in the air, no
 * restart hold, means the nearest vine ahead was just out of reach. The renderer reads swingOutOfReach (that vine, the
 * tick it was missed) to tint it red for a beat. Replays, demos and reveals never note a press, so never show it.
 * Nothing here reads or writes the sim's state beyond looking at it.
 */
import { swingAnchorAt, swingHookLit, swingReworkRange, type SwingState } from "./swing";

/** How long (ticks) the vine stays tinted red (half a second). */
export const SWING_OUT_OF_REACH_TICKS = 30;
/** Ticks after the press before it is judged (the press applies on the next tick). */
const JUDGE_AFTER = 3;

let notes = 0;
let seen = 0;
let pressTick = -1;
let pressAnchors: unknown = null;
let miss: { anchors: unknown; tick: number; hook: number } | null = null;

/** The stage: a press was sent (the finger down, or Space). */
export function noteSwingPress(): void {
  notes += 1;
}

/** The nearest hook ahead of the hero that is drawn (lit), or -1. */
function nearestAhead(s: SwingState): number {
  const k = Math.min(s.sec ?? 0, (s.sections?.length ?? 1) - 1);
  if (!s.sections || k < 0) return -1;
  const [lo, hi] = swingReworkRange(s, k);
  let best = -1;
  let bestD = Infinity;
  for (let i = lo; i < hi && i < s.anchors.length; i++) {
    if (s.dark && !swingHookLit(s, i)) continue;
    const a = s.slide ? swingAnchorAt(s, i, s.tick) : s.anchors[i]!;
    if (a.x < s.x) continue;
    const d = Math.hypot(a.x - s.x, a.y - s.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Once a frame with the live state: true on the frame a press is found to have grabbed nothing. */
export function observeSwingPress(s: SwingState): boolean {
  if (!s.slide) return false;
  if (notes !== seen) {
    seen = notes;
    pressTick = s.tick;
    pressAnchors = s.ceil;
    return false;
  }
  if (pressTick < 0 || pressAnchors !== s.ceil || s.tick < pressTick + JUDGE_AFTER) return false;
  const at = pressTick;
  pressTick = -1;
  const grabbed = s.grabTick > at || s.rope >= 0;
  if (grabbed || s.ended !== 0 || (s.ledgeOn ?? -1) >= 0 || (s.respawn ?? 0) > 0) return false;
  const hook = nearestAhead(s);
  if (hook < 0) return false;
  miss = { anchors: s.ceil, tick: s.tick, hook };
  return true;
}

/** The vine just missed and how far through its red beat (0 just missed … 1 gone), or null. */
export function swingOutOfReach(s: SwingState): { hook: number; age: number } | null {
  if (!miss || miss.anchors !== s.ceil) return null;
  const age = s.tick - miss.tick;
  if (age < 0 || age >= SWING_OUT_OF_REACH_TICKS) return null;
  return { hook: miss.hook, age: age / SWING_OUT_OF_REACH_TICKS };
}
