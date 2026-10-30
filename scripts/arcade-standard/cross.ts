/**
 * Jaywalk on the arcade scoring standard (crossRev 10, docs/arcade-standard/cross.md). Perfect runs are the
 * perfect-play oracle's (scripts/cross-ceiling.ts) on crossRev 10: every coin, a full streak, ten close calls or more
 * and the core past its full figure, replayed through the server. Played: one sideways step (no row) scores 1.
 */
import { crossCheckpoint, crossGameFor, CROSS_INPUT_MOVE, CROSS_REV_EXPAND, CROSS_REV_STD, CROSS_STD, type CrossState } from "../../src/lib/arcade/cross";
import type { ArcadeInputEvent } from "../../src/lib/arcade/engine";
import { encodeCrossRun, replayCrossRun } from "../../src/lib/duel/cross";
import { crossCeilingRun } from "../cross-ceiling";
import { roomSeed } from "../arcade-skill-bands/games";
import type { StdEntry, StdRun } from "./entry";

/** A log played through the phone's sim and then the server replay (the server's score). */
function serverScore(seed: number, events: ArcadeInputEvent[]): number {
  const game = crossGameFor(CROSS_REV_STD);
  const byTick = new Map(events.map((e) => [e.t, e]));
  let state = game.init(seed) as CrossState;
  const checkpoints = [];
  while (!game.isOver(state)) {
    state = game.step(state, byTick.get(state.tick + 1) ?? null);
    if (state.tick % 300 === 0) checkpoints.push(crossCheckpoint(state));
  }
  const raw = encodeCrossRun({ seed, claimedScore: game.score(state), events, endTick: state.tick, checkpoints });
  return replayCrossRun(seed, raw, CROSS_REV_STD).score;
}

export const entry: StdEntry = {
  type: "cross",
  field: "crossRev",
  rev: CROSS_REV_STD,
  before: CROSS_REV_EXPAND,
  parts: CROSS_STD.parts,
  spec: CROSS_STD,
  perfect: (): StdRun[] =>
    [0, 7, 61].map((n) => {
      const r = crossCeilingRun(roomSeed(n), 1, CROSS_REV_STD);
      return { label: `oracle seed ${r.seed} (${r.crossings} crossings, coins ${r.coins}/20, streak ${r.streakPts}, close calls ${r.closeCalls})`, score: r.flagged ? -1 : r.score };
    }),
  played: (): StdRun[] =>
    [3, 40].map((n) => ({ label: `seed index ${n}: one sideways step`, score: serverScore(roomSeed(n), [{ t: 5, k: CROSS_INPUT_MOVE, a: 2, b: 0, c: 0, d: 0 }]) })),
  idle: (): StdRun[] => [3, 40].map((n) => ({ label: `seed index ${n}: no input`, score: serverScore(roomSeed(n), []) })),
  help: { terms: ["Rows and crossings", "150 at", "Crossing streak", "Close calls"] },
};
