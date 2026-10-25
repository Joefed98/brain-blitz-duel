/**
 * A course solver for Hover hoverRev 8 (Expansion E1), used by hover-expand-check to prove the
 * 200 is reachable and to script the review screenshots. Not a player model: it searches tap
 * logs (a tap at least MIN_GAP ticks after the last) tick by tick over every reachable
 * (height, speed, ticks since the last tap) state, keeping only states that obey the course's
 * constraints, and walks the parents back from any state that lasts the minute.
 *
 * Constraints (on the crash-free run, whose scroll is fixed by the barrier count):
 *  - never touch the floor, the ceiling or a barrier;
 *  - `features`: thread every tight gate (inside the gate on every tick the saucer overlaps that
 *    barrier) and touch every chain star at its closest approach; without it, keep out of every
 *    tight gate (the main gaps only);
 *  - `stars`: touch every gold star at its closest approach.
 * The result is only a candidate: callers replay it through the server path and read the score.
 *
 *   bun scripts/hover-expand-solver.ts [seed]
 */
import {
  HOVER_DISC_R,
  HOVER_DISC_X,
  HOVER_GRAVITY,
  HOVER_IMPULSE,
  HOVER_PILLAR_W,
  HOVER_RUN_TICKS,
  HOVER_STAR_R,
  HOVER_TERMINAL,
  hoverBottom,
  hoverGameFor,
  hoverGapTop,
  hoverScroll,
  hoverStarY,
  HOVER_REV_EXPAND,
  type HoverState,
} from "../src/lib/arcade/hover";

const MIN_GAP = 6;
const BEAM = Number(process.env.SOLVER_BEAM ?? 1600);

export interface SolveOptions {
  /** Thread every tight gate and sweep every chain (true), or keep out of the tight gates (false). */
  features: boolean;
  stars: boolean;
  /** Keep this much room (fixed-point) to every edge, so the found run is not knife-edge. */
  margin?: number;
}

export function solveHover(seed: number, opts: SolveOptions, rev = HOVER_REV_EXPAND): number[] | null {
  const game = hoverGameFor(rev);
  const init = game.init(seed) as HoverState;
  const margin = opts.margin ?? 0;
  const bottom = hoverBottom(init);
  // The crash-free run's distance after each tick.
  const dist: number[] = [0];
  {
    let s = init;
    let gates = 0;
    let d = 0;
    for (let t = 1; t <= HOVER_RUN_TICKS; t++) {
      d += hoverScroll(gates);
      while (gates < s.pillars.length && d > s.pillars[gates]!.x0 + HOVER_PILLAR_W - (HOVER_DISC_X - HOVER_DISC_R)) gates += 1;
      dist.push(d);
    }
    s = init;
  }
  // Per tick: the allowed height ranges for the disc centre (null = anywhere above the floor) and required touches.
  const allowed: ([number, number][] | null)[] = new Array(HOVER_RUN_TICKS + 1).fill(null);
  const touch: { x0: number; y: number; r: number }[][] = Array.from({ length: HOVER_RUN_TICKS + 1 }, () => []);
  const closest = (x0: number) => {
    let best = 1;
    for (let t = 1; t <= HOVER_RUN_TICKS; t++) if (Math.abs(x0 - dist[t]! - HOVER_DISC_X) < Math.abs(x0 - dist[best]! - HOVER_DISC_X)) best = t;
    return best;
  };
  for (let t = 1; t <= HOVER_RUN_TICKS; t++) {
    const d = dist[t]!;
    for (const p of init.pillars) {
      const left = p.x0 - d;
      if (!(left + HOVER_PILLAR_W > HOVER_DISC_X - HOVER_DISC_R && left < HOVER_DISC_X + HOVER_DISC_R)) continue;
      const gaps: [number, number][] = [];
      if (opts.features && p.tightTop !== undefined) gaps.push([p.tightTop, p.tightH ?? 0]);
      else {
        gaps.push([hoverGapTop(p, t), p.gapH]);
        if (p.gap2Top !== undefined) gaps.push([p.gap2Top, p.gap2H ?? 0]);
      }
      allowed[t] = gaps.map(([top, h]) => [top + HOVER_DISC_R + margin, top + h - HOVER_DISC_R - margin]);
    }
  }
  if (opts.stars)
    for (const p of init.pillars) {
      if (p.starDy === undefined) continue;
      const cx = p.x0 + (HOVER_PILLAR_W >> 1);
      const t = closest(cx);
      if (dist[t]! > dist[HOVER_RUN_TICKS]! - 1) continue;
      touch[t]!.push({ x0: cx, y: hoverStarY(p, t)!, r: HOVER_STAR_R });
    }
  if (opts.features)
    for (const chain of init.chains ?? [])
      for (const star of chain.stars) {
        const t = closest(star.x0);
        touch[t]!.push({ x0: star.x0, y: star.y, r: HOVER_STAR_R });
      }

  // Beam search over (y, vy, since).
  let ys = new Int32Array([init.y]);
  let vys = new Int32Array([init.vy]);
  let sinces = new Int32Array([MIN_GAP]);
  const parents: Int32Array[] = [];
  const taps: Uint8Array[] = [];
  for (let t = 1; t <= HOVER_RUN_TICKS; t++) {
    const seen = new Map<number, number>();
    const ny: number[] = [];
    const nvy: number[] = [];
    const ns: number[] = [];
    const par: number[] = [];
    const tp: number[] = [];
    const ranges = allowed[t];
    const needs = touch[t]!;
    for (let i = 0; i < ys.length; i++) {
      for (const tap of [false, true]) {
        if (tap && sinces[i]! < MIN_GAP) continue;
        const v = Math.max(-HOVER_TERMINAL, Math.min(HOVER_TERMINAL, tap ? HOVER_IMPULSE : vys[i]! + HOVER_GRAVITY));
        const y = ys[i]! + v;
        if (y - HOVER_DISC_R <= margin || y + HOVER_DISC_R >= bottom - margin) continue;
        if (ranges && !ranges.some(([lo, hi]) => y >= lo && y <= hi)) continue;
        let ok = true;
        for (const n of needs) {
          const dx = n.x0 - dist[t]! - HOVER_DISC_X;
          const dy = n.y - y;
          const reach = HOVER_DISC_R + n.r;
          if (dx * dx + dy * dy > reach * reach) ok = false;
        }
        if (!ok) continue;
        const since = tap ? 1 : Math.min(MIN_GAP, sinces[i]! + 1);
        const key = (y >> 7) * 4096 + ((v + 4096) >> 4) * 8 + since;
        if (seen.has(key)) continue;
        seen.set(key, ny.length);
        ny.push(y);
        nvy.push(v);
        ns.push(since);
        par.push(i);
        tp.push(tap ? 1 : 0);
      }
    }
    if (!ny.length) {
      if (process.env.SOLVER_DBG) console.error(`dead at tick ${t}: ${ys.length} states before, y ${Math.min(...ys) / 256}..${Math.max(...ys) / 256} vy ${Math.min(...vys)}..${Math.max(...vys)} prev ${JSON.stringify(allowed[t - 1]?.map(([a, b]) => [a / 256, b / 256]))}, ranges ${JSON.stringify(ranges?.map(([a, b]) => [a / 256, b / 256]))}, needs ${needs.length}`);
      return null;
    }
    // Thin an oversized layer: the same few states (spread over speed) in every 2 px band of height.
    let keep = ny.map((_, i) => i);
    if (keep.length > BEAM) {
      const bands = new Map<number, number[]>();
      for (const i of keep) bands.set(ny[i]! >> 9, [...(bands.get(ny[i]! >> 9) ?? []), i]);
      const cap = Math.max(1, Math.floor(BEAM / bands.size));
      keep = [];
      for (const band of [...bands.keys()].sort((a, b) => a - b)) {
        const list = bands.get(band)!.sort((a, b) => nvy[a]! - nvy[b]! || ns[a]! - ns[b]!);
        if (list.length <= cap) keep.push(...list);
        else for (let k = 0; k < cap; k++) keep.push(list[cap > 1 ? Math.round((k * (list.length - 1)) / (cap - 1)) : 0]!);
      }
    }
    ys = Int32Array.from(keep.map((i) => ny[i]!));
    vys = Int32Array.from(keep.map((i) => nvy[i]!));
    sinces = Int32Array.from(keep.map((i) => ns[i]!));
    parents.push(Int32Array.from(keep.map((i) => par[i]!)));
    taps.push(Uint8Array.from(keep.map((i) => tp[i]!)));
  }
  // Walk back from a middle survivor.
  const out: number[] = [];
  let i = ys.length >> 1;
  for (let t = HOVER_RUN_TICKS; t >= 1; t--) {
    if (taps[t - 1]![i]) out.push(t);
    i = parents[t - 1]![i]!;
  }
  return out.reverse();
}

if (import.meta.main) {
  const { encodeHoverRun, replayHoverRun } = await import("../src/lib/duel/hover");
  const { hoverCheckpoint, HOVER_CHECKPOINT_INTERVAL } = await import("../src/lib/arcade/hover");
  const seed = Number(process.argv[2] ?? 12345);
  for (const opts of [{ features: true, stars: true }, { features: false, stars: true }]) {
    const t0 = performance.now();
    const taps = solveHover(seed, opts);
    if (!taps) {
      console.log(seed, JSON.stringify(opts), "no run found", `${((performance.now() - t0) / 1000).toFixed(1)} s`);
      continue;
    }
    const game = hoverGameFor(HOVER_REV_EXPAND);
    let s = game.init(seed);
    const set = new Set(taps);
    const cps = [];
    while (!game.isOver(s)) {
      s = game.step(s, set.has(s.tick + 1));
      if (s.tick % HOVER_CHECKPOINT_INTERVAL === 0) cps.push(hoverCheckpoint(s));
    }
    const raw = encodeHoverRun({ seed, claimedScore: game.score(s), inputs: taps, endTick: s.tick, checkpoints: cps });
    const r = replayHoverRun(seed, raw, HOVER_REV_EXPAND);
    console.log(seed, JSON.stringify(opts), "score", r.score, "flagged", r.flagged, "gates", r.gates, "stars", r.stars, "tight", r.state.tight, "chains", r.state.chainsDone, `${((performance.now() - t0) / 1000).toFixed(1)} s`);
  }
}
