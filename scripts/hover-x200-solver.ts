/**
 * A course solver for Hover hoverRev 9 (the 200 expansion), used by hover-x200-check to prove the
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
 *   bun scripts/hover-x200-solver.ts [seed]
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
  hoverCentreY,
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
  /** hoverRev 9, with `features`: keep the saucer's centre within this far (fixed-point) of every tight gate's centre line across the barrier's columns. */
  centre?: number;
  /** The beam's width (states kept a tick; default SOLVER_BEAM or 1600). */
  beam?: number;
}

export function solveHover(seed: number, opts: SolveOptions, rev = HOVER_REV_EXPAND): number[] | null {
  const game = hoverGameFor(rev);
  const init = game.init(seed) as HoverState;
  const margin = opts.margin ?? 0;
  const beam = opts.beam ?? BEAM;
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
  // Per tick: the allowed height ranges for the disc centre (null = anywhere above the floor). Required touches are
  // items in course order, each to be touched on some tick of its window (where the disc can reach it at all).
  const allowed: ([number, number][] | null)[] = new Array(HOVER_RUN_TICKS + 1).fill(null);
  interface Item { x0: number; y: (t: number) => number; r: number; from: number; to: number }
  const items: Item[] = [];
  const addItem = (x0: number, y: (t: number) => number, r: number) => {
    const reach = HOVER_DISC_R + r;
    let from = -1;
    let to = -1;
    for (let t = 1; t <= HOVER_RUN_TICKS; t++) {
      const dx = x0 - dist[t]! - HOVER_DISC_X;
      if (Math.abs(dx) <= reach) {
        if (from < 0) from = t;
        to = t;
      }
    }
    if (from > 0) items.push({ x0, y, r, from, to });
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
      // The centre line: the saucer's centre within the barrier's columns stays within `centre` of the gate's middle.
      if (opts.features && opts.centre !== undefined && p.tightTop !== undefined && left <= HOVER_DISC_X && HOVER_DISC_X <= left + HOVER_PILLAR_W) {
        const c = hoverCentreY(p);
        allowed[t] = [[c - opts.centre, c + opts.centre]];
      }
    }
  }
  if (opts.stars)
    for (const p of init.pillars) {
      if (p.starDy === undefined) continue;
      const cx = p.x0 + (HOVER_PILLAR_W >> 1);
      if (cx - HOVER_DISC_X > dist[HOVER_RUN_TICKS]!) continue;
      addItem(cx, (t) => hoverStarY(p, t)!, HOVER_STAR_R);
    }
  if (opts.features) for (const chain of init.chains ?? []) for (const star of chain.stars) addItem(star.x0, () => star.y, HOVER_STAR_R);
  items.sort((a, b) => a.x0 - b.x0);
  const touches = (it: Item, t: number, y: number) => {
    const dx = it.x0 - dist[t]! - HOVER_DISC_X;
    const dy = it.y(t) - y;
    const reach = HOVER_DISC_R + it.r;
    return dx * dx + dy * dy <= reach * reach;
  };

  // Beam search over (y, vy, since).
  let ys = new Int32Array([init.y]);
  let vys = new Int32Array([init.vy]);
  let sinces = new Int32Array([MIN_GAP]);
  let dones = new Int32Array([0]);
  const parents: Int32Array[] = [];
  const taps: Uint8Array[] = [];
  for (let t = 1; t <= HOVER_RUN_TICKS; t++) {
    const seen = new Map<number, number>();
    const ny: number[] = [];
    const nvy: number[] = [];
    const ns: number[] = [];
    const par: number[] = [];
    const tp: number[] = [];
    const nd: number[] = [];
    const ranges = allowed[t];
    for (let i = 0; i < ys.length; i++) {
      for (const tap of [false, true]) {
        if (tap && sinces[i]! < MIN_GAP) continue;
        const v = Math.max(-HOVER_TERMINAL, Math.min(HOVER_TERMINAL, tap ? HOVER_IMPULSE : vys[i]! + HOVER_GRAVITY));
        const y = ys[i]! + v;
        if (y - HOVER_DISC_R <= margin || y + HOVER_DISC_R >= bottom - margin) continue;
        if (ranges && !ranges.some(([lo, hi]) => y >= lo && y <= hi)) continue;
        let done = dones[i]!;
        while (done < items.length && items[done]!.from <= t && touches(items[done]!, t, y)) done++;
        if (done < items.length && items[done]!.to <= t) continue;
        const since = tap ? 1 : Math.min(MIN_GAP, sinces[i]! + 1);
        const key = ((y >> 7) * 4096 + ((v + 4096) >> 4) * 8 + since) * 128 + done;
        if (seen.has(key)) continue;
        seen.set(key, ny.length);
        ny.push(y);
        nvy.push(v);
        ns.push(since);
        par.push(i);
        tp.push(tap ? 1 : 0);
        nd.push(done);
      }
    }
    if (process.env.SOLVER_TRACE && Math.abs(t - Number(process.env.SOLVER_TRACE)) <= 30 && t % 3 === 0) {
      const sorted = [...ny].sort((a, b) => a - b);
      console.error(`t ${t}: ${ny.length} states, y ${sorted[0]! / 256}..${sorted[sorted.length - 1]! / 256}, ranges ${JSON.stringify(ranges?.map(([a, b]) => [a / 256, b / 256]))}`);
    }
    if (!ny.length) {
      if (process.env.SOLVER_DBG) console.error(`dead at tick ${t}: ${ys.length} states before, y ${Math.min(...ys) / 256}..${Math.max(...ys) / 256} vy ${Math.min(...vys)}..${Math.max(...vys)} prev ${JSON.stringify(allowed[t - 1]?.map(([a, b]) => [a / 256, b / 256]))}, ranges ${JSON.stringify(ranges?.map(([a, b]) => [a / 256, b / 256]))}, items done ${Math.max(...dones)} of ${items.length}`);
      return null;
    }
    // Thin an oversized layer: the same few states (spread over speed) in every 2 px band of height.
    let keep = ny.map((_, i) => i);
    if (keep.length > beam) {
      const bands = new Map<number, number[]>();
      for (const i of keep) bands.set(ny[i]! >> 9, [...(bands.get(ny[i]! >> 9) ?? []), i]);
      const cap = Math.max(1, Math.floor(beam / bands.size));
      keep = [];
      for (const band of [...bands.keys()].sort((a, b) => a - b)) {
        const list = bands.get(band)!.sort((a, b) => nd[b]! - nd[a]! || nvy[a]! - nvy[b]! || ns[a]! - ns[b]!);
        if (list.length <= cap) keep.push(...list);
        else for (let k = 0; k < cap; k++) keep.push(list[cap > 1 ? Math.round((k * (list.length - 1)) / (cap - 1)) : 0]!);
      }
    }
    ys = Int32Array.from(keep.map((i) => ny[i]!));
    vys = Int32Array.from(keep.map((i) => nvy[i]!));
    sinces = Int32Array.from(keep.map((i) => ns[i]!));
    dones = Int32Array.from(keep.map((i) => nd[i]!));
    parents.push(Int32Array.from(keep.map((i) => par[i]!)));
    taps.push(Uint8Array.from(keep.map((i) => tp[i]!)));
  }
  // Walk back from a middle survivor that touched every item.
  const out: number[] = [];
  const full = [...dones.keys()].filter((k) => dones[k] === items.length);
  if (!full.length) return null;
  let i = full[full.length >> 1]!;
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
  for (const opts of [{ features: true, stars: true, centre: 1_280 }, { features: true, stars: true }, { features: false, stars: true }]) {
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
    console.log(seed, JSON.stringify(opts), "score", r.score, "flagged", r.flagged, "gates", r.gates, "stars", r.stars, "tight", r.state.tight, "chains", r.state.chainsDone, "centre", r.state.ctrPts, `${((performance.now() - t0) / 1000).toFixed(1)} s`);
  }
}
