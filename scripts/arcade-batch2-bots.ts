/**
 * Shared bots for the batch-2 checks: real input logs played on the real sims,
 * so their scores can be replayed through the server path.
 *
 *  - Coral Pop: before each shot, try a fan of aims on a copy of the sim and fire
 *    the one that removes the most field bubbles (tie: the lowest field).
 *  - Gemstone: a swap picker scoring each legal swap by its one-step gain, playing
 *    at a fixed think time between swaps.
 */
import { inputAt, recordInput, type ArcadeGame, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { bubCheckpoint, bubRemaining, BUB_INPUT_SHOT, BUB_MAX_ROWS, BUB_COLS, type BubState } from "../src/lib/arcade/bubble";

type BubGame = ArcadeGame<BubState, ArcadeInputEvent | null>;

/** Fan of aims (vx, vy) at full launch length, 10°…170°. */
const AIMS: [number, number][] = Array.from({ length: 57 }, (_, i) => {
  const angle = ((10 + i * (160 / 56)) * Math.PI) / 180;
  return [Math.round(-Math.cos(angle) * 4000), Math.round(-Math.sin(angle) * 4000)];
});

function lowestRow(state: BubState): number {
  for (let row = BUB_MAX_ROWS - 1; row >= 0; row--) {
    for (let col = 0; col < BUB_COLS; col++) if (state.grid[row * BUB_COLS + col]) return row;
  }
  return -1;
}

/** Plays one shot from `state` on a copy and returns the state after it lands. */
function tryShot(game: BubGame, state: BubState, aim: [number, number]): BubState {
  let s = game.step(state, { t: state.tick + 1, k: BUB_INPUT_SHOT, a: aim[0], b: aim[1], c: 0, d: 0 });
  while (s.flightColour !== 0 && !game.isOver(s)) s = game.step(s, null);
  return s;
}

export function playBubble(game: BubGame, seed: number, thinkTicks = 0) {
  let state = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: ReturnType<typeof bubCheckpoint>[] = [];
  let readyAt = 0;
  while (!game.isOver(state)) {
    const t = state.tick + 1;
    if (state.flightColour === 0 && state.tick >= readyAt) {
      let best: { aim: [number, number]; value: number } | null = null;
      for (const aim of AIMS) {
        const after = tryShot(game, state, aim);
        const value =
          (after.cleared ? 1e6 - after.tick : 0) +
          (after.dead ? -1e6 : 0) +
          (bubRemaining(state) - bubRemaining(after)) * 100 -
          lowestRow(after) * 3;
        if (!best || value > best.value) best = { aim, value };
      }
      recordInput(events, { t, k: BUB_INPUT_SHOT, a: best!.aim[0], b: best!.aim[1], c: 0, d: 0 }, game.inputRanges);
    }
    const before = state.flightColour;
    state = game.step(state, inputAt(events, t));
    if (before !== 0 && state.flightColour === 0) readyAt = state.tick + thinkTicks;
    if (state.tick % 300 === 0) checkpoints.push(bubCheckpoint(state));
  }
  return { state, events, checkpoints, score: game.score(state) };
}

/* ================================ Gemstone ================================ */

import {
  matchupAnimationDuration,
  matchupCheckpoint,
  matchupPending,
  MATCHUP_INPUT_SWAP,
  MATCHUP_ROWS,
  MATCHUP_SIZE,
  type MatchupState,
} from "../src/lib/arcade/matchup";

type GemGame = ArcadeGame<MatchupState, ArcadeInputEvent | null>;

/** Raw gain of one swap, letting a matchupRev 2 board settle (no further swaps). */
function swapGain(game: GemGame, state: MatchupState, a: number, b: number, c: number, d: number): number {
  let s = game.step(state, { t: state.tick + 1, k: MATCHUP_INPUT_SWAP, a, b, c, d });
  if (s.swaps === state.swaps) return -1;
  for (let guard = 0; guard < 400 && matchupPending(s) && !game.isOver(s); guard++) s = game.step(s, null);
  return s.raw - state.raw;
}

/**
 * Plays Gemstone: every decision tries all 97 neighbour swaps and makes the one
 * with the biggest gain. `thinkTicks` passes between a decision and the next;
 * on the original rules the bot also waits for the swap's whole cascade
 * animation (the phone ignores taps until it ends), as a player must.
 */
export function playMatchup(game: GemGame, seed: number, thinkTicks: number) {
  let state = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: ReturnType<typeof matchupCheckpoint>[] = [];
  let readyAt = thinkTicks;
  while (!game.isOver(state)) {
    const t = state.tick + 1;
    if (state.tick >= readyAt) {
      let best: { move: [number, number, number, number]; gain: number } | null = null;
      for (let row = 0; row < MATCHUP_ROWS; row++) {
        for (let col = 0; col < MATCHUP_SIZE; col++) {
          const moves: [number, number, number, number][] = [];
          if (col + 1 < MATCHUP_SIZE) moves.push([row, col, row, col + 1]);
          if (row + 1 < MATCHUP_ROWS) moves.push([row, col, row + 1, col]);
          for (const move of moves) {
            const gain = swapGain(game, state, ...move);
            if (gain > (best?.gain ?? 0)) best = { move, gain };
          }
        }
      }
      if (best) {
        const [a, b, c, d] = best.move;
        recordInput(events, { t, k: MATCHUP_INPUT_SWAP, a, b, c, d }, game.inputRanges);
      }
      readyAt = state.tick + thinkTicks;
    }
    const before = state;
    state = game.step(state, inputAt(events, t));
    if (state.swaps > before.swaps && !state.rev) {
      // The original phone blocks input for the swap tween and the cascade animation.
      readyAt = state.tick + Math.ceil(((150 + matchupAnimationDuration(state.lastAnimation)) * 60) / 1000) + thinkTicks;
    }
    if (state.tick % 300 === 0) checkpoints.push(matchupCheckpoint(state));
  }
  return { state, events, checkpoints, score: game.score(state) };
}
