/** Private bounded search: only seeds with a complete timed witness are used. */
import { swingGameFor, SWING_GATES, SWING_GEMS, SWING_REV, SWING_REV_EXPAND, SWING_SECTIONS, SWING_SECTION_LEDGES, SWING_STARS, swingMetres, type SwingState } from '@/lib/arcade/swing';
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
        const event = j === 0 && action !== -1 ? { t: state.tick + 1, k: action >= 2 ? 4 : 12, a: action >= 2 ? action - 2 : action, b: 0, c: 0, d: 0 } : null;
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

/**
 * swingRev 4: the same bounded search, ranked by stars taken first, then distance,
 * returning the finishing witness with the most stars (null if nothing finishes).
 * Used by the bank build (a banked course must be finishable) and the batch-3
 * check (a banked course with a 10-star finish proves 150).
 */
export function proveSwingSeedV4(seed: number, opts: { beam?: number; starWeight?: number; rev?: number } = {}): { log: ArcadeInputEvent[]; stars: number; ticks: number } | null {
  // swingRev 6 (touch stars) runs the same search on its own game.
  const game = swingGameFor(opts.rev ?? SWING_REV);
  const width = opts.beam ?? 120;
  const starWeight = opts.starWeight ?? 600;
  type Node = { state: SwingState; log: ArcadeInputEvent[]; rank: number };
  let beam: Node[] = [{ state: game.init(seed), log: [], rank: 0 }];
  let best: { log: ArcadeInputEvent[]; stars: number; ticks: number } | null = null;
  for (let tick = 0; tick < game.runTicks && beam.length; tick += 12) {
    const bins = new Map<string, Node>();
    for (const node of beam) for (const action of [-1, 0, 1, 2, 3]) {
      let state = node.state;
      const log = node.log.slice();
      for (let j = 0; j < 12; j++) {
        const event = j === 0 && action !== -1 ? { t: state.tick + 1, k: action >= 2 ? 4 : 12, a: action >= 2 ? action - 2 : action, b: 0, c: 0, d: 0 } : null;
        if (event) log.push(event);
        state = game.step(state, event);
        if (state.ended) break;
      }
      if (state.ended === 2) continue;
      if (swingMetres(state) >= 500) {
        const stars = state.stars ?? 0;
        if (!best || stars > best.stars) best = { log, stars, ticks: state.tick };
        continue;
      }
      if (state.ended) continue;
      const key = [state.stars ?? 0, Math.floor(state.x / 6144), Math.floor(state.y / 6144), state.rope, Math.floor(state.om / 100), Math.floor(state.len / 5120)].join(',');
      const rank = (state.stars ?? 0) * starWeight + state.x / 256 + Math.min(0, state.vx / 256) * 8 - state.y / 256 * .05;
      const old = bins.get(key);
      if (!old || rank > old.rank) bins.set(key, { state, log, rank });
    }
    beam = [...bins.values()].sort((a, b) => b.rank - a.rank).slice(0, width);
    const found = best as { stars: number } | null;
    if (found && found.stars >= SWING_STARS) break;
  }
  return best;
}

/** swingRev 12: true when a course's start state carries every expansion feature (the rev-12 bank's first test). */
export function swingExpandComplete(seed: number): boolean {
  const s = swingGameFor(SWING_REV_EXPAND).init(seed);
  return (s.starSpots ?? []).length === SWING_STARS && (s.gems ?? []).length === SWING_GEMS && (s.gates ?? []).length === SWING_GATES &&
    (s.ledges ?? []).length >= (SWING_SECTIONS - 1) * SWING_SECTION_LEDGES;
}
