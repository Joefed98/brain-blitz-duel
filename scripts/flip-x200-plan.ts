/**
 * A route planner for Roofbound flipRev 8 (checks and screenshots only): an exact search on the sim itself,
 * tick by tick from any state, keeping per reachable runner situation the state with the most gold stars,
 * then trail stars, then combo points. Routes never crash (a checkpoint's save counts as a crash).
 */
import { FLIP_INPUT_TAP, FLIP_RUN_TICKS, FLIP_V8_COMBO_CAP, flipStarsTaken, flipTrailStars, type FlipState } from "../src/lib/arcade/flip";
import type { ArcadeGame, ArcadeInputEvent } from "../src/lib/arcade/engine";

export const flipTap = (t: number): ArcadeInputEvent => ({ t, k: FLIP_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 });

/** What makes two states the same for the rest of the run (the crack only while its tile can still break). */
function keyOf(s: FlipState): string {
  const c = s.cracks ?? [];
  const live = c.length && s.tick - c[c.length - 1]! < 60 ? `${c[c.length - 2]}:${c[c.length - 1]}` : "";
  return `${s.side}:${s.flipT}:${s.arcN}:${Math.min(9, s.land ?? 99)}:${Math.min(3, s.chain ?? 0)}:${live}`;
}

function value(s: FlipState): number {
  const t = flipTrailStars(s);
  return flipStarsTaken(s) * 1e7 + t.full * 1e6 + t.stars * 1e4 + Math.min(FLIP_V8_COMBO_CAP, s.comboPts ?? 0) * 10 + Math.min(3, s.chain ?? 0);
}

export interface FlipRoute {
  state: FlipState;
  /** Tap ticks after the start state's tick. */
  taps: number[];
}

/** The best route from `start` to `until` (the run's end by default), or null if every route crashes. */
export function planFlipRoute(game: ArcadeGame<FlipState, ArcadeInputEvent | null>, start: FlipState, until = FLIP_RUN_TICKS, cap = 1500): FlipRoute | null {
  type Node = { s: FlipState; taps: number[] };
  let layer: Node[] = [{ s: start, taps: [] }];
  const saves = start.saves ?? 0;
  for (let t = start.tick + 1; t <= until && layer.length; t++) {
    const best = new Map<string, Node>();
    for (const node of layer) {
      if (node.s.ended === 1) {
        best.set("end", node);
        continue;
      }
      for (const tap of [false, true]) {
        if (tap && node.s.flipT > 0) continue;
        const ns = game.step(node.s, tap ? flipTap(t) : null);
        if (ns.ended === 2 || (ns.saves ?? 0) > saves) continue;
        const k = ns.ended === 1 ? "end" : keyOf(ns);
        const held = best.get(k);
        if (!held || value(ns) > value(held.s)) best.set(k, { s: ns, taps: tap ? [...node.taps, t] : node.taps });
      }
    }
    layer = [...best.values()];
    if (layer.length > cap) layer = layer.sort((a, b) => value(b.s) - value(a.s)).slice(0, cap);
  }
  if (!layer.length) return null;
  const top = layer.reduce((a, b) => (value(b.s) > value(a.s) ? b : a));
  return { state: top.s, taps: top.taps };
}
