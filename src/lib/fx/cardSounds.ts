/**
 * Cards & Board sound observers (FreeCell, TriPeaks, Poker Squares): they read sim state after each frame and play
 * the shared library's sounds on transitions (a card placed or moved, a card home, a run building, a refused tap);
 * they never feed anything back to the sim.
 */
import { playSlotOr } from "@/lib/sound";
import type { SoundId } from "@/lib/fx/manifest";
import type { GameSounds } from "@/lib/fx/gameSounds";
import { fcHomeCount, type FcState } from "@/lib/arcade/cards/freecell";
import type { TpState } from "@/lib/arcade/cards/tripeaks";
import { psTotals, type PsState } from "@/lib/arcade/cards/pokerSquares";

const play = (id: SoundId, volume = 1, rate = 1) => playSlotOr(id, id, volume, rate, true);

export function freecellSounds(): GameSounds<FcState> {
  let prev: FcState | null = null;
  return {
    frame(state) {
      if (prev && state.tick > prev.tick) {
        if (state.moves > prev.moves) play("place", 0.8);
        if (fcHomeCount(state) > fcHomeCount(prev)) play("correct", 0.55, 1 + Math.min(0.5, fcHomeCount(state) / 104));
        if (state.rejects > prev.rejects) play("wrong", 0.5);
        if (state.ended === 1 && prev.ended === 0) play("complete");
      }
      prev = state;
    },
    stop: () => {},
  };
}

export function tripeaksSounds(): GameSounds<TpState> {
  let prev: TpState | null = null;
  return {
    frame(state) {
      if (prev && state.tick > prev.tick) {
        if (state.plays > prev.plays) play(state.run >= 3 ? "combo" : "place", 0.8, 1 + Math.min(0.6, state.run * 0.05));
        if (state.turns > prev.turns) play("move", 0.8);
        if (state.peaks > prev.peaks) play("correct", 0.7);
        if (state.rejects > prev.rejects) play("wrong", 0.5);
        if (state.ended === 1 && prev.ended === 0) play("complete");
      }
      prev = state;
    },
    stop: () => {},
  };
}

export function pokerSquaresSounds(): GameSounds<PsState> {
  let prev: PsState | null = null;
  return {
    frame(state) {
      if (prev && state.tick > prev.tick) {
        if (state.next > prev.next) {
          const before = psTotals(prev.grid);
          const after = psTotals(state.grid);
          play(after.made > before.made ? "correct" : after.total > before.total ? "combo" : "place", 0.8);
        }
        if (state.rejects > prev.rejects) play("wrong", 0.5);
      }
      prev = state;
    },
    stop: () => {},
  };
}
