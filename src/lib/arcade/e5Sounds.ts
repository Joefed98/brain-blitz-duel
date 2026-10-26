/**
 * Expansion E5 (25 Oct 2026, docs/expansions/e5.md): the sounds for the new skill features of Swish,
 * Flightpath and Slice, from the existing recorded set (no new files). Presentation only: each observer
 * reads the sim state once a frame and never writes it. playSound honours mute and the Effects slider;
 * sounds play under reduced motion and reduced effects (as the celebrations' do).
 */
import { playSound } from "@/lib/sound";
import type { BinTossState } from "./binToss";
import type { BullseyeState } from "./bullseye";
import { sliceTicketsDone, type SliceState } from "./slice";

/** Flightpath bullRev 8: a zap for every streak bull that earns streak points (louder up the streak), a spark chime for a dead-centre dart. */
export function bullseyeExtraSounds(): (state: BullseyeState) => void {
  let seen = -1;
  return (state) => {
    if (state.expand !== 1) return;
    const n = state.hits.length;
    if (seen < 0 || n < seen) {
      seen = n;
      return;
    }
    if (n === seen || state.flightTick !== 0) return;
    seen = n;
    const hit = state.hits[n - 1];
    if (hit?.skp) playSound("shared.celebrate.zap", Math.min(1, 0.5 + 0.1 * (hit.sk ?? 0)));
    if (hit?.dc) playSound("shared.celebrate.chime", 0.8);
  };
}

/** Swish binRev 7: a spark chime for a far basket. */
export function binTossExtraSounds(): (state: BinTossState) => void {
  let seen = -1;
  return (state) => {
    if (state.expand !== 1) return;
    const n = state.farIn ?? 0;
    if (seen >= 0 && n > seen) playSound("shared.celebrate.chime", 0.8);
    seen = n;
  };
}

/** Slice sliceRev 9: a chime for golden fruit, a ding for a filled ticket, a crackle for a dodge. */
export function sliceExtraSounds(): (state: SliceState) => void {
  let golds = -1;
  let tickets = -1;
  let dodges = -1;
  return (state) => {
    if (state.v9 !== 1) return;
    const g = state.golds ?? 0;
    const t = sliceTicketsDone(state);
    const d = state.dodges ?? 0;
    if (golds >= 0) {
      if (g > golds) playSound("shared.celebrate.chime", 0.8);
      if (t > tickets) playSound("complete", 0.9);
      if (d > dodges) playSound("shared.celebrate.crackle1", 0.7);
    }
    golds = g;
    tickets = t;
    dodges = d;
  };
}
