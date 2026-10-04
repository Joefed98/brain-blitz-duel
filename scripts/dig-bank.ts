/**
 * Builds the Dig bank in src/lib/duel/digBank.server.ts.
 *
 *   bun scripts/dig-bank.ts
 *
 * Answer-first, on a rock board: sand only where placed (route, trap chute,
 * stable decoy ledges), so planned digs run from the pool downward — dig a
 * lower cell first and the sand above falls in and packs. A rock basin holds the pool above a one-plug floor. The water
 * falls down a shaft onto a full-width rock shelf. Straight under the shaft the
 * shelf has a tempting sand hole — the obvious, shorter route to the drain
 * below — with lava or acid right under it. The intended route instead runs
 * along the shelf to a safe hole, down, and back along the bottom to the
 * drain. Extra acid/lava sits in the sand away from the route; some boards add
 * a side-gap decoy on the shelf.
 *
 * Hard boards add a second drain under a sand divider in the shelf, between
 * the shaft and the safe hole: dig it too early and drain 1 never fills, too
 * late and the water runs into full drain 1 and is lost.
 *
 * Accepted only when: the intended dig log completes; the safe minimum (a 0-1
 * search over sand, away from hazards) is not below the route length; the
 * geometric shortest route fails; and the minimum is at least 4.
 */
import { writeFileSync } from "node:fs";

import {
  digComplete,
  digInit,
  digReplay,
  digStep,
  digTarget,
  digWaterLeft,
  DIG_BUDGET_SLACK,
  DIG_COLS as C,
  DIG_ROWS as R,
  DIG_STEPS,
  digEncode,
  type DigAction,
  type DigBoard,
} from "../src/lib/duel/dig";

const STANDARD = 200;
const HARD = 100;
const rand = (n: number) => Math.floor(Math.random() * n);
const between = (lo: number, hi: number) => lo + rand(hi - lo + 1);
const at = (r: number, c: number) => r * C + c;
const nbrs = (i: number) => {
  const r = Math.floor(i / C);
  const c = i % C;
  const out: number[] = [];
  if (r > 0) out.push(i - C);
  if (r < R - 1) out.push(i + C);
  if (c > 0) out.push(i - 1);
  if (c < C - 1) out.push(i + 1);
  return out;
};

/** 0-1 search from `start` (a sand cell, cost 1) to any drain; returns sand cells on the path in order. */
function shortest(tiles: string[], start: number, blocked: (i: number) => boolean): number[] | null {
  const dist = new Array(C * R).fill(Infinity);
  const prev = new Array(C * R).fill(-1);
  const dq: number[] = [start];
  dist[start] = 1;
  while (dq.length) {
    const i = dq.shift()!;
    if (tiles[i] === "D" && i >= (R - 1) * C) {
      const path: number[] = [];
      for (let k = prev[i]; k >= 0; k = prev[k]) if (tiles[k] === "s") path.push(k);
      return path.reverse();
    }
    for (const n of nbrs(i)) {
      const t = tiles[n];
      if (t === "#" || t === "G" || (t === "D" && n < (R - 1) * C) || blocked(n)) continue;
      // Water never climbs back above the pool floor.
      if (Math.floor(n / C) < Math.floor(start / C)) continue;
      const w = t === "s" ? 1 : 0;
      if (dist[i] + w < dist[n]) {
        dist[n] = dist[i] + w;
        prev[n] = i;
        if (w) dq.push(n);
        else dq.unshift(n);
      }
    }
  }
  return null;
}

function logFor(cells: number[], from = 1): DigAction[] {
  // One dig per step, in order: planned routes are dug from the pool downward.
  return cells.map((cell, i) => ({ step: from + i, cell }));
}

/** Same step stamps, cells in reverse order. */
function reversed(log: DigAction[]): DigAction[] {
  const cells = log.map((x) => x.cell).reverse();
  return log.map((x, i) => ({ step: x.step, cell: cells[i]! }));
}

const RANDOM_RUNS = 1000;
const RANDOM_CAP = 250;

/** Cells water could ever pass with these digs: open/dug, or sand sharing a vertical run with a dug cell. */
function couldConnect(t: string[], dug: Set<number>, plug: number): boolean {
  const pass = new Array<boolean>(C * R).fill(false);
  for (let i = 0; i < t.length; i++) if (t[i] === "." || t[i] === "D" || t[i] === "a" || dug.has(i)) pass[i] = true;
  for (const d of dug) {
    for (let k = d - C; k >= 0 && t[k] === "s"; k -= C) pass[k] = true;
  }
  if (!pass[plug]) return false;
  const seen = new Set([plug]);
  const q = [plug];
  while (q.length) {
    const i = q.pop()!;
    if (t[i] === "D") return true;
    for (const n of nbrs(i)) if (pass[n] && !seen.has(n) && Math.floor(n / C) >= Math.floor(plug / C)) {
      seen.add(n);
      q.push(n);
    }
  }
  return false;
}

function completesWithin(board: DigBoard, log: DigAction[], cap: number): boolean {
  let st = digInit(board);
  let k = 0;
  while (st.step < cap && !st.completeStep && (st.step < log.length + 2 || digWaterLeft(st) > 0)) {
    const n = st.step + 1;
    const digs: number[] = [];
    while (k < log.length && log[k]!.step <= n) digs.push(log[k++]!.cell);
    st = digStep(board, st, digs);
  }
  return st.completeStep > 0;
}

function build(hard: boolean) {
  const t: string[] = new Array(C * R).fill("#");
  const w: number[] = new Array(C * R).fill(0);

  // Pool, open to the sky, on a rock floor with one sand plug.
  const depth = between(2, 4);
  const width = between(3, 6);
  const a = between(2, C - 2 - width);
  const b = a + width - 1;
  const floor = depth + 1;
  for (let c = 1; c < C - 1; c++) t[at(0, c)] = ".";
  for (let r = 1; r <= depth; r++)
    for (let c = a; c <= b; c++) {
      t[at(r, c)] = ".";
      w[at(r, c)] = 4;
    }
  const col = between(a, b);
  const s = hard ? between(Math.max(floor + 3, 9), 10) : between(floor + 3, 11);
  const dir = col <= 3 ? 1 : col >= C - 4 ? -1 : rand(2) ? 1 : -1;
  const dist = hard ? between(3, 8) : between(2, 8);
  const hole = col + dir * dist;
  if (hole < 1 || hole > C - 2) return null;

  // Intended route, in dig order: plug and shaft (a sand column), along the shelf, down the hole.
  const route: number[] = [];
  for (let r = floor; r < s; r++) route.push(at(r, col));
  for (let c = col + dir; c !== hole + dir; c += dir) route.push(at(s - 1, c));
  for (let r = s; r <= R - 2; r++) route.push(at(r, hole));
  const drainCol = hard ? hole : col + dir;
  for (let c = hole - dir; c !== drainCol - dir; c -= dir) route.push(at(R - 2, c));
  for (const i of route) t[i] = "s";
  t[at(R - 1, drainCol)] = "D";

  // Trap: the obvious hole straight under the shaft, a hazard, and a sand chute on to the drain.
  t[at(s, col)] = "s";
  const hazards: number[] = [at(s + 1, col)];
  let lava = 0;
  let acid = 0;
  if (rand(2)) {
    t[at(s + 1, col)] = "L";
    lava++;
  } else {
    t[at(s + 1, col)] = "a";
    acid++;
  }
  for (let r = s + 2; r <= R - 2; r++) t[at(r, col)] = "s";
  if (hard) for (let c = col + dir; c !== hole; c += dir) t[at(R - 2, c)] = "s";

  // Hard: a divider in the shelf over drain 2.
  let divider = -1;
  let lowerCell = -1;
  if (hard) {
    const v = col + dir * between(2, Math.max(2, dist - 2));
    divider = at(s, v);
    lowerCell = at(s + 1, v);
    t[divider] = "s";
    t[lowerCell] = "s";
    t[at(s + 2, v)] = "D";
    if (t[at(s + 3, v)] === "s") return null;
  }

  // Side-gap decoy along the shelf the other way.
  if (rand(2)) {
    const edge = dir > 0 ? 0 : C - 1;
    for (let c = col - dir; c !== edge; c -= dir) if (t[at(s - 1, c)] === "#") t[at(s - 1, c)] = "s";
    t[at(s - 1, edge)] = "G";
  }

  // Decoy sand on rock ledges: stable stacks, never resting on a dug cell.
  const keep = new Set([...route, at(s, col), divider, lowerCell]);
  const restsOnDig = (i: number) => {
    for (let k = i + C; k < C * R; k += C) {
      if (keep.has(k)) return true;
      if (t[k] !== "s") return false;
    }
    return false;
  };
  const decoy: number[] = [];
  for (let r = R - 2; r > floor; r--)
    for (let c = 1; c < C - 1; c++) {
      const i = at(r, c);
      if (t[i] !== "#" || r === s || Math.random() > 0.45) continue;
      if (restsOnDig(i)) continue;
      const below = t[i + C];
      if (below !== "#" && below !== "s") continue;
      t[i] = "s";
      decoy.push(i);
    }

  // Extra hazards in decoy sand, away from the route.
  const near = (i: number) => keep.has(i) || nbrs(i).some((n) => keep.has(n) || t[n] === "D" || t[n] === "L" || t[n] === "a" || t[n] === "G");
  const wantAcid = between(1, 3);
  const wantLava = between(lava, 2);
  for (let tries = 0; tries < 200 && (acid < wantAcid || lava < wantLava); tries++) {
    const i = decoy[rand(decoy.length)];
    if (i === undefined || t[i] !== "s" || near(i)) continue;
    if (t[i - C] === "s") continue; // nothing rests on a hazard that could later fall
    if (lava < wantLava) {
      t[i] = "L";
      lava++;
    } else {
      t[i] = "a";
      acid++;
    }
    hazards.push(i);
  }
  if (acid < 1) return null;
  const all = hard ? [...route] : route;
  const planned = all.length + (hard ? 2 : 0);
  if (planned < 4) return null;

  const pool = w.reduce((x, y) => x + y, 0);
  const total = hard ? Math.floor((pool * 60 + 50) / 100) : digTarget(pool);
  const split = hard ? (rand(2) ? 60 : 70) : 100;
  const t1 = hard ? total - Math.round((total * split) / 100) : total;
  const targets = hard ? [total - t1, t1] : [total];
  const board: DigBoard = { cols: C, rows: R, tiles: t.join(""), water: w.join(""), budget: planned + DIG_BUDGET_SLACK, minDigs: planned, targets };

  let intended = logFor(all);
  if (hard) {
    let st = digInit(board);
    let k = 0;
    let fillStep = 0;
    while (st.step < DIG_STEPS) {
      const sNow = st.step + 1;
      const digs: number[] = [];
      while (k < intended.length && intended[k]!.step <= sNow) digs.push(intended[k++]!.cell);
      st = digStep(board, st, digs);
      if (st.drained[1]! >= st.targets[1]!) {
        fillStep = st.step;
        break;
      }
    }
    if (!fillStep) return null;
    intended = [...intended, { step: fillStep + 1, cell: divider }, { step: fillStep + 2, cell: lowerCell }];
    // (e) Divider dug at the start fails.
    const early = [{ step: 1, cell: divider }, { step: 2, cell: lowerCell }, ...logFor(all, 3)];
    if (digComplete(digReplay(board, early).state)) return null;
  }
  // (a) Planned completes.
  const good = digReplay(board, intended).state;
  if (!good.completeStep || good.dug !== planned) return null;
  // (b) Planned in reverse fails.
  if (digComplete(digReplay(board, reversed(intended)).state)) return null;

  // Safe minimum: no route clear of hazards needs fewer digs.
  const danger = new Set<number>();
  for (let i = 0; i < t.length; i++)
    if (t[i] === "L" || t[i] === "a" || t[i] === "G") {
      danger.add(i);
      for (const n of nbrs(i)) danger.add(n);
    }
  const plug = at(floor, col);
  const safe = shortest(t, plug, (i) => danger.has(i));
  if (!safe || safe.length < all.length) return null;
  // (d) Geometric shortest (through the hazard) fails.
  const geo = shortest(t, plug, () => false);
  if (!geo || geo.length >= all.length) return null;
  if (digComplete(digReplay(board, logFor(geo)).state)) return null;

  // (c) Random sequences within budget, on sand reachable from the pool: under 3% complete.
  const reach: number[] = [];
  {
    const seen = new Set([plug]);
    const q = [plug];
    while (q.length) {
      const i = q.pop()!;
      if (t[i] === "s") reach.push(i);
      for (const n of nbrs(i))
        if (!seen.has(n) && (t[n] === "s" || t[n] === "." ) && Math.floor(n / C) > 0) {
          seen.add(n);
          q.push(n);
        }
    }
  }
  let wins = 0;
  const limit = Math.floor(RANDOM_RUNS * 0.03);
  for (let run = 0; run < RANDOM_RUNS; run++) {
    const pick = reach.slice();
    for (let k = pick.length - 1; k > 0; k--) {
      const j = rand(k + 1);
      [pick[k], pick[j]] = [pick[j]!, pick[k]!];
    }
    const cells = pick.slice(0, board.budget);
    if (!couldConnect(t, new Set(cells), plug)) continue;
    if (completesWithin(board, logFor(cells), RANDOM_CAP)) wins++;
    if (wins >= limit) return null;
  }

  return {
    tiles: board.tiles,
    water: board.water,
    budget: board.budget,
    minDigs: planned,
    targets,
    pool,
    hazards: hazards.sort((x, y) => x - y),
    tier: hard ? ("hard" as const) : ("standard" as const),
    route: hard ? [...all, divider, lowerCell] : all,
    intended: digEncode(intended),
    completeStep: good.completeStep,
    randomWins: wins,
  };
}

const bank: NonNullable<ReturnType<typeof build>>[] = [];
const seen = new Set<string>();
const t0 = performance.now();
const tries = { standard: 0, hard: 0 };
for (const [hard, want] of [[false, STANDARD], [true, HARD]] as const) {
  let got = 0;
  while (got < want && tries[hard ? "hard" : "standard"] < 400_000) {
    tries[hard ? "hard" : "standard"]++;
    const p = build(hard);
    if (!p || seen.has(p.tiles)) continue;
    seen.add(p.tiles);
    bank.push(p);
    got++;
  }
}
const out = `/**
 * Dig bank — generated by scripts/dig-bank.ts. Every board's intended dig log
 * completes in the shared sim, the geometric shortest route fails, and no safe
 * route needs fewer digs. Do not edit by hand.
 */

export interface DigBankEntry {
  tiles: string;
  water: string;
  budget: number;
  minDigs: number;
  targets: number[];
  pool: number;
  hazards: number[];
  tier: "standard" | "hard";
  /** Intended dig cells. */
  route: number[];
  /** Intended dig log ("step:cell,…"). */
  intended: string;
}

export const DIG_BANK: DigBankEntry[] = ${JSON.stringify(bank.map(({ completeStep: _c, randomWins: _w, ...rest }) => rest))};
`;
writeFileSync(new URL("../src/lib/duel/digBank.server.ts", import.meta.url), out);
const cs = bank.map((b) => b.completeStep);
console.log(
  `dig bank: ${bank.length} (${bank.filter((b) => b.tier === "standard").length} standard, ${bank.filter((b) => b.tier === "hard").length} hard) · tries ${tries.standard}/${tries.hard} · ` +
    `${((performance.now() - t0) / 1000).toFixed(1)}s · intended completes at step ${Math.min(...cs)}–${Math.max(...cs)} · random wins max ${Math.max(...bank.map((b) => b.randomWins))}/1000`,
);
