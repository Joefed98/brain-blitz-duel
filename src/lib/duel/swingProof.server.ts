/** Private bounded search: only seeds with a complete timed witness are used. */
import { swingGameFor, SWING_REV, swingMetres, type SwingState } from '@/lib/arcade/swing';
import type { ArcadeInputEvent } from '@/lib/arcade/engine';

export function proveSwingSeed(seed: number, rev = SWING_REV): ArcadeInputEvent[] | null {
  const game = swingGameFor(rev);
  type Node = { state: SwingState; log: ArcadeInputEvent[]; rank: number };
  let beam: Node[] = [{ state: game.init(seed), log: [], rank: 0 }];
  for (let tick = 0; tick < game.runTicks; tick += 12) {
    const bins = new Map<string, Node>();
    for (const node of beam) for (const action of [-1, 0, 1, 2, 3]) {
      let state = node.state;
      const log = node.log.slice();
      for (let j = 0; j < 12; j++) {
        const event = j === 0 && action !== -1 ? { t: state.tick + 1, k: action >= 2 ? 4 : 12, a: action >= 2 ? action - 2 : action, b: 0, c: 0 } : null;
        if (event) log.push(event);
        state = game.step(state, event);
        if (state.ended) break;
      }
      if (state.ended === 2) continue;
      if (swingMetres(state) >= 500) return log;
      if (state.ended) continue;
      const key = [Math.floor(state.x / 6144), Math.floor(state.y / 6144), state.rope, Math.floor(state.om / 100), Math.floor(state.len / 5120)].join(',');
      const rank = state.x / 256 + Math.min(0, state.vx / 256) * 8 - state.y / 256 * .05;
      const old = bins.get(key);
      if (!old || rank > old.rank) bins.set(key, { state, log, rank });
    }
    beam = [...bins.values()].sort((a, b) => b.rank - a.rank).slice(0, 100);
    if (!beam.length) return null;
  }
  return null;
}
