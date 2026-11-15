/**
 * Records the Thirteen runs arcade-review-fixes-check replays (15 Nov 2026): pyramidRev 1 and 2 runs played on the code
 * before pyramidRev 3 (the stuck rule), so the check proves older stamps still replay and score exactly as they did.
 * Witness clears plus random taps that run into dead ends (the old rule ends those at once).
 *   bun scripts/arcade-review-fixes-record.ts   (writes scripts/fixtures/arcade-review-fixes-pyramid-legacy.json)
 * Run only on a tree whose pyramidRev 1 and 2 play is unchanged; never re-record over the stored file without cause.
 */
import { writeFileSync } from "node:fs";
import { recordInput, inputAt, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { PY_CHECKPOINT_INTERVAL, PY_INPUT_TAP, PY_INPUT_UNDO, PY_STOCK_PILE, PY_WASTE_PILE, pyCheckpoint, pyFree, pyramidGameFor, type PyState } from "../src/lib/arcade/cards/pyramid";
import { encodePyramidRun, replayPyramidRun } from "../src/lib/duel/cards";
import { pyramidFlawless } from "./cards/flawless";

export interface PyLegacyRun { seed: number; rev: number; kind: string; raw: string; score: number; ended: number; removed: number; replayTick: number }

/** A seeded random player: taps a free card, the waste or the stock; `undo` sometimes undoes. */
export function pyRandomRun(seed: number, rev: number, salt: number, undoEvery = 0, stopWhen?: (s: PyState) => boolean): { raw: string; state: PyState } {
  const game = pyramidGameFor(rev);
  let state = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: ReturnType<typeof pyCheckpoint>[] = [];
  let rng = (seed * 7919 + salt * 104729 + 1) >>> 0;
  const next = () => ((rng = (Math.imul(rng, 1103515245) + 12345) >>> 0), rng >>> 8);
  let n = 0;
  while (!game.isOver(state) && state.tick < game.runTicks && !stopWhen?.(state)) {
    const t = state.tick + 1;
    if (t % 12 === 0) {
      n++;
      let a: number;
      const r = next() % 10;
      if (undoEvery && n % undoEvery === 0) {
        recordInput(events, { k: PY_INPUT_UNDO, a: 0, b: 0, c: 0, d: 0, t }, game.inputRanges ?? []);
      } else {
        if (r < 2) a = PY_STOCK_PILE;
        else if (r < 4) a = PY_WASTE_PILE;
        else {
          const free: number[] = [];
          for (let i = 0; i < 28; i++) if (pyFree(state, i)) free.push(i);
          a = free.length ? free[next() % free.length]! : PY_STOCK_PILE;
        }
        recordInput(events, { k: PY_INPUT_TAP, a, b: 0, c: 0, d: 0, t }, game.inputRanges ?? []);
      }
    }
    state = game.step(state, inputAt(events, t));
    if (state.tick % PY_CHECKPOINT_INTERVAL === 0) checkpoints.push(pyCheckpoint(state));
  }
  return { raw: encodePyramidRun({ seed, claimedScore: game.score(state), events, endTick: state.tick, checkpoints: checkpoints as never[] }), state };
}

if (import.meta.main) {
  const runs: PyLegacyRun[] = [];
  for (const rev of [1, 2]) {
    for (let i = 0; i < 12; i++) {
      const seed = 4000 + i * 37;
      const plays: [string, string][] = [
        ["witness", pyramidFlawless(seed, 15, rev).raw],
        ["random", pyRandomRun(seed, rev, 1).raw],
        ["random-undo", pyRandomRun(seed, rev, 2, 9).raw],
      ];
      for (const [kind, raw] of plays) {
        const r = replayPyramidRun(seed, raw, rev);
        runs.push({ seed, rev, kind, raw, score: r.score, ended: r.state.ended, removed: r.removed, replayTick: r.replayTick });
      }
    }
  }
  writeFileSync("scripts/fixtures/arcade-review-fixes-pyramid-legacy.json", JSON.stringify(runs) + "\n");
  console.log(`wrote ${runs.length} runs; stuck ends: ${runs.filter((r) => r.ended === 3).length}`);
}
