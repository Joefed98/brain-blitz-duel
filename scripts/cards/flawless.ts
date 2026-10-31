/**
 * Cards & Board's flawless runs (checks and fixtures): each bank deal's proved line, Poker Squares' target grid or Five
 * Hands' witness, played through the sim at a steady pace and encoded as the phone sends it, so the server's replay
 * scores it.
 */
import { recordInput, inputAt, type ArcadeInputEvent } from "../../src/lib/arcade/engine";
import { FC_CHECKPOINT_INTERVAL, FC_INPUT_MOVE, fcCheckpoint, freecellGameFor, type FcState } from "../../src/lib/arcade/cards/freecell";
import { TP_CHECKPOINT_INTERVAL, TP_INPUT_TAP, tpCheckpoint, tripeaksGame, type TpState } from "../../src/lib/arcade/cards/tripeaks";
import { PS_CHECKPOINT_INTERVAL, PS_INPUT_PLACE, psCheckpoint, psTargetGrid, pokerSquaresGameFor, type PsState } from "../../src/lib/arcade/cards/pokerSquares";
import { FH_CHECKPOINT_INTERVAL, FH_INPUT_PLACE, fhCheckpoint, fhDeal, fiveHandsGame, type FhState } from "../../src/lib/arcade/cards/fiveHands";
import { encodeFiveHandsRun, encodeFreecellRun, encodePokerSquaresRun, encodeTripeaksRun } from "../../src/lib/duel/cards";
import { freecellSolution, tripeaksSolution } from "./solutions";

type Ev = Omit<ArcadeInputEvent, "t">;

/** Plays a list of inputs, one every `gap` ticks from tick `gap`, to the run's end; returns the encoded answer. */
function play<S extends { tick: number }>(
  game: { init: (seed: number) => S; step: (s: S, i: ArcadeInputEvent | null) => S; isOver: (s: S) => boolean; score: (s: S) => number; runTicks: number; inputRanges?: readonly import("../../src/lib/arcade/engine").InputRange[] },
  seed: number,
  inputs: readonly Ev[],
  gap: number,
  checkpoint: (s: S) => unknown,
  interval: number,
  encode: (run: { seed: number; claimedScore: number; events: ArcadeInputEvent[]; endTick: number; checkpoints: never[] }) => string,
): { raw: string; state: S } {
  let state = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: unknown[] = [];
  let k = 0;
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    if (k < inputs.length && t >= gap * (k + 1)) recordInput(events, { ...inputs[k++]!, t }, game.inputRanges ?? []);
    state = game.step(state, inputAt(events, t));
    if (state.tick % interval === 0) checkpoints.push(checkpoint(state));
  }
  return { raw: encode({ seed, claimedScore: game.score(state), events, endTick: state.tick, checkpoints: checkpoints as never[] }), state };
}

/** FreeCell bank deal `seed`: its par line, a move every `gap` ticks, on freecellRev `rev` (1 unless named). */
export function freecellFlawless(seed: number, gap = 20, rev = 1): { raw: string; state: FcState } {
  const game = freecellGameFor(rev);
  const deal = game.init(seed).deal;
  const moves = freecellSolution(deal).map((m) => ({ k: FC_INPUT_MOVE, a: m[0], b: m[1], c: m[2], d: 0 }));
  return play(game, seed, moves, gap, fcCheckpoint, FC_CHECKPOINT_INTERVAL, encodeFreecellRun);
}

/** TriPeaks bank deal `seed`: its clearing line (a run of ten), a tap every `gap` ticks. */
export function tripeaksFlawless(seed: number, gap = 15): { raw: string; state: TpState } {
  const deal = tripeaksGame.init(seed).deal;
  const taps = tripeaksSolution(deal).map((a) => ({ k: TP_INPUT_TAP, a, b: 0, c: 0, d: 0 }));
  return play(tripeaksGame, seed, taps, gap, tpCheckpoint, TP_CHECKPOINT_INTERVAL, encodeTripeaksRun);
}

/** Poker Squares seed: every card placed on its target-grid square, one every `gap` ticks, on pokerSquaresRev `rev`. */
export function pokerSquaresFlawless(seed: number, gap = 20, rev = 1): { raw: string; state: PsState } {
  const game = pokerSquaresGameFor(rev);
  const grid = psTargetGrid(seed, rev).grid;
  const order = game.init(seed).order;
  const places = order.map((card) => ({ k: PS_INPUT_PLACE, a: grid.indexOf(card), b: 0, c: 0, d: 0 }));
  return play(game, seed, places, gap, psCheckpoint, PS_CHECKPOINT_INTERVAL, encodePokerSquaresRun);
}

/** Five Hands seed: each turn's card tapped onto its witness row, one every `gap` ticks. */
export function fiveHandsFlawless(seed: number, gap = 20): { raw: string; state: FhState } {
  const taps = fhDeal(seed).witnessTaps.map((row) => ({ k: FH_INPUT_PLACE, a: row, b: 0, c: 0, d: 0 }));
  return play(fiveHandsGame, seed, taps, gap, fhCheckpoint, FH_CHECKPOINT_INTERVAL, encodeFiveHandsRun);
}
