/**
 * Minigolf's putt search (script only; floats are fine here, the result is an input log the sim replays):
 *
 *  - `rollShot`: one putt rolled through the sim's own mgRollTick, to holed, water or rest;
 *  - `pathField`: the walking distance to the cup over a 4 px grid (round the rails, logs, rocks, planters and ponds),
 *    the planner's sense of "closer";
 *  - `holingPutts`: the putts that hole from a spot (a sweep round the straight line and the banks);
 *  - `bestRoute`: the fewest putts that hole a hole from its tee (1, 2 or 3; the par proof: par = this + 1), with the
 *    putts themselves (the witness).
 *
 * Used by scripts/minigolf-bank.ts (the bank of proven courses), the skill-band bot and minigolf-check.
 */
import { fp } from "../src/lib/arcade/engine";
import {
  mgPuttVelocity,
  mgRollTick,
  mgRollTickV2,
  MG_BALL_R,
  MG_MILL_PERIOD,
  MG_TUNNEL_R,
  MG_END_HOLED,
  MG_END_NONE,
  MG_END_WATER,
  MG_POWER_MAX,
  MINIGOLF_H,
  MINIGOLF_W,
  type MgHole,
} from "../src/lib/arcade/minigolf";
import { insidePoly } from "../src/lib/arcade/sportsKit";

export interface Putt {
  a: number;
  b: number;
  c: number;
  /** golfRev 2: ticks to wait after the ball comes to rest before putting (the windmill's timing); 0 when absent. */
  w?: number;
}

export interface ShotEnd {
  holed: boolean;
  wet: boolean;
  x: number;
  y: number;
  ticks: number;
  /** golfRev 2: the ball touched a windmill's sail (a different moment might roll differently). */
  sail?: boolean;
}

/** golfRev 2: the waits tried when a putt meets a windmill's sails (every eighth of the sails' repeat). */
export const MILL_WAITS = Array.from({ length: 7 }, (_, i) => ((i + 1) * MG_MILL_PERIOD) / 8);

/**
 * Rolls one putt from (x, y) to its end, exactly as the sim does. golfRev 2's holes roll on the sim's clock: `tick` is
 * the first tick the putt could be played (the tick after the ball came to rest), the putt goes `p.w` ticks later.
 */
export function rollShot(h: MgHole, x: number, y: number, p: Putt, tick = 1): ShotEnd {
  if (h.rev === 2) {
    const v2 = mgPuttVelocity(p.a, p.b, p.c, 2);
    const ball = { x, y, vx: v2.vx, vy: v2.vy };
    const strike = tick + (p.w ?? 0);
    let sail = false;
    for (let t = 1; ; t++) {
      const r = mgRollTickV2(h, ball, t, strike + t);
      if (r.sail) sail = true;
      if (r.end === MG_END_NONE) continue;
      if (r.end === MG_END_HOLED) return { holed: true, wet: false, x: h.cup.x, y: h.cup.y, ticks: t, sail };
      if (r.end === MG_END_WATER) return { holed: false, wet: true, x, y, ticks: t, sail };
      return { holed: false, wet: false, x: ball.x, y: ball.y, ticks: t, sail };
    }
  }
  const v = mgPuttVelocity(p.a, p.b, p.c);
  const b = { x, y, vx: v.vx, vy: v.vy };
  for (let t = 1; ; t++) {
    const r = mgRollTick(h, b, t);
    if (r.end === MG_END_NONE) continue;
    if (r.end === MG_END_HOLED) return { holed: true, wet: false, x: h.cup.x, y: h.cup.y, ticks: t };
    if (r.end === MG_END_WATER) return { holed: false, wet: true, x, y, ticks: t };
    return { holed: false, wet: false, x: b.x, y: b.y, ticks: t };
  }
}

/** An aim direction for an angle in degrees (a, b on a 4000 radius). */
export function dirOf(deg: number): { a: number; b: number } {
  const r = (deg * Math.PI) / 180;
  return { a: Math.round(Math.cos(r) * 4000), b: Math.round(Math.sin(r) * 4000) };
}

export function angleTo(x: number, y: number, tx: number, ty: number): number {
  return (Math.atan2(ty - y, tx - x) * 180) / Math.PI;
}

/* ============================== The path field ============================== */

const CELL = 4;
const GW = Math.ceil(MINIGOLF_W / CELL);
const GH = Math.ceil(MINIGOLF_H / CELL);

export interface PathField {
  dist: Float64Array;
  at(x: number, y: number): number;
}

/** A cell is open when a ball centre there sits on the fairway and clear of every solid thing and pond. */
function openCell(h: MgHole, cx: number, cy: number): boolean {
  const x = fp(cx * CELL + CELL / 2);
  const y = fp(cy * CELL + CELL / 2);
  if (!insidePoly(h.poly, x, y)) return false;
  const br = fp(MG_BALL_R);
  for (const s of h.segs) {
    const dx = s.bx - s.ax;
    const dy = s.by - s.ay;
    const l2 = dx * dx + dy * dy || 1;
    let t = ((x - s.ax) * dx + (y - s.ay) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const ex = s.ax + dx * t - x;
    const ey = s.ay + dy * t - y;
    if (Math.hypot(ex, ey) < br + s.r) return false;
  }
  for (const c of [...h.rocks, ...h.planters]) if (Math.hypot(c.x - x, c.y - y) < c.r + br) return false;
  for (const c of h.ponds) if (Math.hypot(c.x - x, c.y - y) < c.r + br) return false;
  return true;
}

/** golfRev 2: a cell in a bunker costs three times as much to cross. */
function sandCell(h: MgHole, cx: number, cy: number): boolean {
  const x = fp(cx * CELL + CELL / 2);
  const y = fp(cy * CELL + CELL / 2);
  return (h.sands ?? []).some((c) => Math.hypot(c.x - x, c.y - y) < c.r);
}

const fieldCache = new WeakMap<MgHole, PathField>();

/** The walking distance (px) from every cell to the cup; Infinity off the fairway. */
export function pathField(h: MgHole): PathField {
  const cached = fieldCache.get(h);
  if (cached) return cached;
  const open = new Uint8Array(GW * GH);
  for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) open[cy * GW + cx] = openCell(h, cx, cy) ? (sandCell(h, cx, cy) ? 3 : 1) : 0;
  // golfRev 2's tunnels: an exit's cell leads back to its entrance's cells (the walk from the entrance is the exit's).
  const cellOf = (x: number, y: number) => Math.max(0, Math.min(GH - 1, Math.floor(y / 256 / CELL))) * GW + Math.max(0, Math.min(GW - 1, Math.floor(x / 256 / CELL)));
  const viaTunnel = new Map<number, number[]>();
  for (const t of h.tunnels ?? []) {
    const exit = cellOf(t.ox, t.oy);
    const list = viaTunnel.get(exit) ?? [];
    const r = Math.ceil(MG_TUNNEL_R / CELL);
    const ex = Math.floor(t.x / 256 / CELL);
    const ey = Math.floor(t.y / 256 / CELL);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.hypot(dx, dy) * CELL <= MG_TUNNEL_R) list.push((ey + dy) * GW + ex + dx);
    viaTunnel.set(exit, list);
  }
  const dist = new Float64Array(GW * GH).fill(Infinity);
  const sx = Math.floor(h.cup.x / 256 / CELL);
  const sy = Math.floor(h.cup.y / 256 / CELL);
  // Dijkstra on 8 neighbours (a small binary heap).
  const heap: [number, number][] = [];
  const push = (d: number, i: number) => {
    heap.push([d, i]);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p]![0] <= heap[k]![0]) break;
      [heap[p], heap[k]] = [heap[k]!, heap[p]!];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = k * 2 + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l;
        if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k]!, heap[m]!];
        k = m;
      }
    }
    return top;
  };
  const start = sy * GW + sx;
  dist[start] = 0;
  push(0, start);
  while (heap.length) {
    const [d, i] = pop();
    if (d > dist[i]!) continue;
    const cx = i % GW;
    const cy = (i - cx) / GW;
    for (const j of viaTunnel.get(i) ?? []) {
      if (j >= 0 && j < GW * GH && d + CELL < dist[j]!) {
        dist[j] = d + CELL;
        push(d + CELL, j);
      }
    }
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const j = ny * GW + nx;
        if (!open[j]) continue;
        const nd = d + (dx && dy ? Math.SQRT2 : 1) * CELL * open[j]!;
        if (nd < dist[j]!) {
          dist[j] = nd;
          push(nd, j);
        }
      }
  }
  const field: PathField = {
    dist,
    at(x: number, y: number) {
      const cx = Math.max(0, Math.min(GW - 1, Math.floor(x / 256 / CELL)));
      const cy = Math.max(0, Math.min(GH - 1, Math.floor(y / 256 / CELL)));
      let best = dist[cy * GW + cx]!;
      if (!Number.isFinite(best)) {
        // A ball resting against a rail sits in a closed cell: the nearest open neighbour's distance.
        for (let r = 1; r <= 3 && !Number.isFinite(best); r++)
          for (let dy = -r; dy <= r; dy++)
            for (let dx = -r; dx <= r; dx++) {
              const nx = cx + dx;
              const ny = cy + dy;
              if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
              best = Math.min(best, dist[ny * GW + nx]! + Math.hypot(dx, dy) * CELL);
            }
      }
      return best;
    },
  };
  fieldCache.set(h, field);
  return field;
}

/* ================================ Searches ================================ */

/** Putts that hole from (x, y): a fine sweep round the line to the cup, then (if `wide`) every direction coarser. */
export function holingPutts(h: MgHole, x: number, y: number, opts: { wide?: boolean; max?: number; tick?: number } = {}): Putt[] {
  if (h.rev === 2) return holingPuttsV2(h, x, y, opts.tick ?? 1, opts);
  const out: Putt[] = [];
  const max = opts.max ?? 1;
  const base = angleTo(x, y, h.cup.x, h.cup.y);
  const d = Math.hypot(h.cup.x - x, h.cup.y - y) / 256;
  // The straight line first: angles ±6° in 0.25° steps, powers over the band that reaches the cup.
  for (let da = 0; da <= 6; da += 0.25) {
    for (const sign of da === 0 ? [1] : [1, -1]) {
      const { a, b } = dirOf(base + sign * da);
      for (let c = 10; c <= MG_POWER_MAX; c += 10) {
        const end = rollShot(h, x, y, { a, b, c });
        if (end.holed) {
          out.push({ a, b, c });
          if (out.length >= max) return out;
          break;
        }
        // Past the cup at this power: more power only goes further.
        if (!end.wet && Math.hypot(end.x - x, end.y - y) / 256 > d + 40) break;
      }
    }
  }
  if (!opts.wide) return out;
  for (let deg = 0; deg < 360; deg += 1) {
    const { a, b } = dirOf(deg);
    for (let c = 20; c <= MG_POWER_MAX; c += 20) {
      if (rollShot(h, x, y, { a, b, c }).holed) {
        out.push({ a, b, c });
        if (out.length >= max) return out;
      }
    }
  }
  return out;
}

export interface Leave {
  putt: Putt;
  x: number;
  y: number;
  dist: number;
  /** golfRev 2: the first tick the next putt could be played (the tick after this one comes to rest). */
  next?: number;
}

/** Every resting spot a sweep of putts from (x, y) leaves (no water), nearest the cup by walking distance first. */
export function leaves(h: MgHole, x: number, y: number, angleStep = 2, powerStep = 25, tick = 1): Leave[] {
  if (h.rev === 2) return leavesV2(h, x, y, angleStep, powerStep, tick);
  const field = pathField(h);
  const out: Leave[] = [];
  const seen = new Set<string>();
  for (let deg = 0; deg < 360; deg += angleStep) {
    const { a, b } = dirOf(deg);
    for (let c = powerStep; c <= MG_POWER_MAX; c += powerStep) {
      const end = rollShot(h, x, y, { a, b, c });
      if (end.wet) continue;
      if (end.holed) {
        out.push({ putt: { a, b, c }, x: end.x, y: end.y, dist: -1 });
        continue;
      }
      const key = `${Math.round(end.x / 256 / 6)},${Math.round(end.y / 256 / 6)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ putt: { a, b, c }, x: end.x, y: end.y, dist: field.at(end.x, end.y) });
    }
  }
  out.sort((p, q) => p.dist - q.dist);
  return out;
}

export interface Route {
  strokes: number;
  putts: Putt[];
  /** golfRev 2: the tick the ball dropped (the route played from its start tick, each putt after its wait). */
  holedTick?: number;
}

/**
 * The fewest putts that hole h from its tee, searched to `maxDepth` putts by a beam: each level keeps the `beam`
 * resting spots nearest the cup by walking distance (one per 6 px cell) and tries a holing putt from each (the straight
 * line), so a route of n putts is n − 1 lay-ups and a holing putt. Aces come from the first sweep. Null when none.
 */
export function bestRoute(h: MgHole, maxDepth = 4, beam = 14, startTick = 1): Route | null {
  if (h.rev === 2) return bestRouteV2(h, maxDepth, beam, startTick);
  type Node = { x: number; y: number; dist: number; putts: Putt[] };
  const t = h.tee;
  let frontier: Node[] = [{ x: t.x, y: t.y, dist: pathField(h).at(t.x, t.y), putts: [] }];
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next: Node[] = [];
    const seen = new Set<string>();
    for (const n of frontier) {
      // A holing putt from here finishes the route at this depth.
      if (n.putts.length > 0) {
        const hole = holingPutts(h, n.x, n.y);
        if (hole.length) return { strokes: depth, putts: [...n.putts, hole[0]!] };
      }
      if (depth === maxDepth) continue;
      const opts = leaves(h, n.x, n.y, depth === 1 ? 2 : 4, depth === 1 ? 25 : 50);
      const ace = opts.find((l) => l.dist < 0);
      if (ace) return { strokes: depth, putts: [...n.putts, ace.putt] };
      for (const l of opts) {
        if (!Number.isFinite(l.dist) || l.dist >= n.dist) continue;
        const key = `${Math.round(l.x / 256 / 6)},${Math.round(l.y / 256 / 6)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ x: l.x, y: l.y, dist: l.dist, putts: [...n.putts, l.putt] });
      }
    }
    if (depth === 1 && frontier.length === 1 && frontier[0]!.putts.length === 0) {
      // From the tee: no holing check above (an ace is the sweep's), so fall through to the lay-ups.
    }
    next.sort((a, b) => a.dist - b.dist);
    frontier = next.slice(0, beam);
    if (!frontier.length) return null;
  }
  return null;
}

/* ========================= golfRev 2: on the sim's clock ========================= */

/**
 * golfRev 2's holing putts from (x, y), the putt playable from `tick`: the straight-line sweep as golfRev 1's, and a
 * putt that meets a windmill's sails is tried again after each of MILL_WAITS (the moment the sails leave the way).
 */
function holingPuttsV2(h: MgHole, x: number, y: number, tick: number, opts: { wide?: boolean; max?: number }): Putt[] {
  const out: Putt[] = [];
  const max = opts.max ?? 1;
  const base = angleTo(x, y, h.cup.x, h.cup.y);
  const d = Math.hypot(h.cup.x - x, h.cup.y - y) / 256;
  let last: ShotEnd | null = null;
  const tryPutt = (p: Putt): boolean => {
    const end = rollShot(h, x, y, p, tick);
    last = end;
    if (end.holed) {
      out.push(p);
      return true;
    }
    if (end.sail) {
      for (const w of MILL_WAITS) {
        if (rollShot(h, x, y, { ...p, w }, tick).holed) {
          out.push({ ...p, w });
          return true;
        }
      }
    }
    return false;
  };
  for (let da = 0; da <= 6; da += 0.25) {
    for (const sign of da === 0 ? [1] : [1, -1]) {
      const { a, b } = dirOf(base + sign * da);
      for (let c = 10; c <= MG_POWER_MAX; c += 10) {
        if (tryPutt({ a, b, c })) {
          if (out.length >= max) return out;
          break;
        }
        const end = last as ShotEnd | null;
        if (end && !end.wet && !end.sail && Math.hypot(end.x - x, end.y - y) / 256 > d + 40) break;
      }
    }
  }
  if (!opts.wide) return out;
  for (let deg = 0; deg < 360; deg += 1) {
    const { a, b } = dirOf(deg);
    for (let c = 20; c <= MG_POWER_MAX; c += 20) {
      if (tryPutt({ a, b, c }) && out.length >= max) return out;
    }
  }
  return out;
}

/** golfRev 2's resting spots from (x, y), the putt playable from `tick` (sail-touching putts also after each wait). */
function leavesV2(h: MgHole, x: number, y: number, angleStep: number, powerStep: number, tick: number): Leave[] {
  const field = pathField(h);
  const out: Leave[] = [];
  const seen = new Set<string>();
  const add = (p: Putt, end: ShotEnd) => {
    if (end.wet) return;
    const next = tick + (p.w ?? 0) + end.ticks + 1;
    if (end.holed) {
      out.push({ putt: p, x: end.x, y: end.y, dist: -1, next });
      return;
    }
    const key = `${Math.round(end.x / 256 / 6)},${Math.round(end.y / 256 / 6)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ putt: p, x: end.x, y: end.y, dist: field.at(end.x, end.y), next });
  };
  for (let deg = 0; deg < 360; deg += angleStep) {
    const { a, b } = dirOf(deg);
    for (let c = powerStep; c <= MG_POWER_MAX; c += powerStep) {
      const end = rollShot(h, x, y, { a, b, c }, tick);
      add({ a, b, c }, end);
      if (end.sail) for (const w of MILL_WAITS) add({ a, b, c, w }, rollShot(h, x, y, { a, b, c, w }, tick));
    }
  }
  out.sort((p, q) => p.dist - q.dist || (p.next ?? 0) - (q.next ?? 0));
  return out;
}

/** golfRev 2's best route from the tee, the first putt playable from `startTick` (every putt rolled on the clock). */
function bestRouteV2(h: MgHole, maxDepth: number, beam: number, startTick: number): Route | null {
  type Node = { x: number; y: number; dist: number; putts: Putt[]; tick: number };
  const t = h.tee;
  const done = (n: Node, p: Putt): Route => {
    const end = rollShot(h, n.x, n.y, p, n.tick);
    return { strokes: n.putts.length + 1, putts: [...n.putts, p], holedTick: n.tick + (p.w ?? 0) + end.ticks };
  };
  let frontier: Node[] = [{ x: t.x, y: t.y, dist: pathField(h).at(t.x, t.y), putts: [], tick: startTick }];
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next: Node[] = [];
    const seen = new Set<string>();
    for (const n of frontier) {
      if (n.putts.length > 0) {
        const hole = holingPuttsV2(h, n.x, n.y, n.tick, {});
        if (hole.length) return done(n, hole[0]!);
      }
      if (depth === maxDepth) continue;
      const opts = leavesV2(h, n.x, n.y, depth === 1 ? 2 : 4, depth === 1 ? 25 : 50, n.tick);
      const ace = opts.find((l) => l.dist < 0);
      if (ace) return done(n, ace.putt);
      for (const l of opts) {
        if (!Number.isFinite(l.dist) || l.dist >= n.dist) continue;
        const key = `${Math.round(l.x / 256 / 6)},${Math.round(l.y / 256 / 6)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ x: l.x, y: l.y, dist: l.dist, putts: [...n.putts, l.putt], tick: l.next! });
      }
    }
    next.sort((a, b) => a.dist - b.dist);
    frontier = next.slice(0, beam);
    if (!frontier.length) return null;
  }
  return null;
}
