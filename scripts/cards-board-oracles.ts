/**
 * Cards & Board oracles (30 Oct 2026): perfect play for any seed, from the deal's own proof, as the input log a phone
 * would send. Minesweeper: the logic solver's order (minesSolve) — each step's first square tapped, one a tick, so no
 * mine is ever hit and the board clears in well under the Speed part's full-by time. Mahjong Solitaire: the backwards
 * build's order (mahjongBuild), two taps a pair. Used by arcade-standard-check's entries, minesweeper-check and
 * mahjong-check to prove every dealt seed reaches 200 through the server's replay.
 */
import { inputAt, type ArcadeInputEvent, type ArcadeGame } from "../src/lib/arcade/engine";
import { minesBoard, minesCheckpoint, minesSolve, minesweeperGame, MINES_CHECKPOINT_INTERVAL, MINES_INPUT_TAP, MINES_MODE_REVEAL } from "../src/lib/arcade/minesweeper";
import { mahjongBuild, mahjongCheckpoint, mahjongGame, MAHJONG_CHECKPOINT_INTERVAL, MAHJONG_INPUT_TAP } from "../src/lib/arcade/mahjong";
import { encodeMinesweeperRun } from "../src/lib/duel/minesweeper";
import { encodeMahjongRun } from "../src/lib/duel/mahjong";

const ev = (t: number, k: number, a: number, b = 0): ArcadeInputEvent => ({ t, k, a, b, c: 0, d: 0 });

/** Minesweeper's perfect run: the solver's steps after the opening, one tap a tick from tick `from`. */
export function minesOracle(seed: number, from = 1, every = 1): ArcadeInputEvent[] {
  const board = minesBoard(seed);
  const proof = minesSolve(board.mines, board.start);
  return proof.steps.slice(1).map((step, i) => ev(from + i * every, MINES_INPUT_TAP, step[0]!, MINES_MODE_REVEAL));
}

/** Mahjong Solitaire's perfect run: the build order, two taps a pair, one tap every `every` ticks. */
export function mahjongOracle(seed: number, from = 1, every = 1): ArcadeInputEvent[] {
  const out: ArcadeInputEvent[] = [];
  let t = from;
  for (const [a, b] of mahjongBuild(seed).order) {
    out.push(ev(t, MAHJONG_INPUT_TAP, a));
    t += every;
    out.push(ev(t, MAHJONG_INPUT_TAP, b));
    t += every;
  }
  return out;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Plays a log as the phone does (one event a tick, checkpoints on the interval) and encodes it as the phone sends it. */
function phoneRun(game: ArcadeGame<any, ArcadeInputEvent | null>, seed: number, events: readonly ArcadeInputEvent[], interval: number, checkpoint: (s: any) => any, encode: (run: any) => string): string {
  let s = game.init(seed);
  const log: ArcadeInputEvent[] = [];
  const checkpoints: unknown[] = [];
  const byTick = new Map(events.map((e) => [e.t, e]));
  while (!game.isOver(s)) {
    const t = s.tick + 1;
    const e = byTick.get(t);
    if (e) log.push(e);
    s = game.step(s, inputAt(log, t));
    if (s.tick % interval === 0) checkpoints.push(checkpoint(s));
  }
  return encode({ seed, claimedScore: game.score(s), events: log, endTick: s.tick, checkpoints });
}

/** An encoded run for the replay functions, as the phone would send it (claimed score and checkpoints included). */
export function encodeOracle(seed: number, events: readonly ArcadeInputEvent[], type: "minesweeper" | "mahjong"): string {
  return type === "minesweeper"
    ? phoneRun(minesweeperGame, seed, events, MINES_CHECKPOINT_INTERVAL, minesCheckpoint, encodeMinesweeperRun)
    : phoneRun(mahjongGame, seed, events, MAHJONG_CHECKPOINT_INTERVAL, mahjongCheckpoint, encodeMahjongRun);
}
