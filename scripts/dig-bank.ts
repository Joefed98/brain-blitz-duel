/**
 * Builds the Dig bank in src/lib/duel/digBank.server.ts.
 *
 *   bun scripts/dig-bank.ts
 *
 * Answer-first. A rock basin holds the pool above a one-plug floor. The water
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
  DIG_BUDGET_SLACK,
  DIG_COLS as C,
  DIG_MAX_PER_STEP,
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
      if (t === "#" || t === "G" || blocked(n)) continue;
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
  return cells.map((cell, i) => ({ step: from + Math.floor(i / DIG_MAX_PER_STEP), cell }));
}

function build(hard: boolean) {
  const t: string[] = new Array(C * R).fill("s");
  const w: number[] = new Array(C * R).fill(0);
  for (let r = 0; r < R; r++) {
    t[at(r, 0)] = "#";
    t[at(r, C - 1)] = "#";
  }
  for (let c = 0; c < C; c++) t[at(R - 1, c)] = "#";

  // Pool.
  const depth = between(2, 3);
  const width = between(4, 6);
  const a = between(2, C - 2 - width);
  const b = a + width - 1;
  const floor = depth + 1;
  for (let c = 1; c < C - 1; c++) t[at(0, c)] = ".";
  for (let r = 1; r <= floor; r++) for (let c = 1; c < C - 1; c++) t[at(r, c)] = "#";
  for (let r = 1; r <= depth; r++)
    for (let c = a; c <= b; c++) {
      t[at(r, c)] = ".";
      w[at(r, c)] = 4;
    }
  const col = between(a, b);
  t[at(floor, col)] = "s";
  const route: number[] = [at(floor, col)];

  // Shelf.
  const s = between(floor + 3, hard ? 10 : 11);
  for (let c = 1; c < C - 1; c++) t[at(s, c)] = "#";
  for (let r = floor + 1; r < s; r++) route.push(at(r, col));
  const dir = col <= 3 ? 1 : col >= C - 4 ? -1 : rand(2) ? 1 : -1;
  const dist = hard ? 3 : between(2, 3);
  const hole = col + dir * dist;
  if (hole < 1 || hole > C - 2) return null;
  for (let c = col + dir; c !== hole + dir; c += dir) route.push(at(s - 1, c));
  t[at(s, hole)] = "s";
  route.push(at(s, hole));
  for (let r = s + 1; r <= R - 2; r++) route.push(at(r, hole));
  // Standard: back along the bottom to a drain beside the shaft's column. Hard: drain 1 under the hole.
  const drainCol = hard ? hole : col + dir;
  for (let c = hole - dir; c !== drainCol - dir; c -= dir) route.push(at(R - 2, c));
  t[at(R - 1, drainCol)] = "D";

  // The obvious hole straight under the shaft, with a hazard beneath it.
  t[at(s, col)] = "s";
  const hazards: number[] = [];
  let lava = 0;
  let acid = 0;
  if (rand(2)) {
    t[at(s + 1, col)] = "L";
    lava++;
  } else {
    t[at(s + 1, col)] = "a";
    acid++;
  }
  hazards.push(at(s + 1, col));

  // Hard: a divider in the shelf between the shaft and the safe hole, over drain 2.
  let divider = -1;
  const lower: number[] = [];
  if (hard) {
    const v = col + dir * 2;
    divider = at(s, v);
    t[divider] = "s";
    lower.push(at(s + 1, v));
    t[at(s + 2, v)] = "D";
  }

  // Side-gap decoy on the shelf, on the far side.
  if (rand(2)) t[at(s - 1, dir > 0 ? 0 : C - 1)] = "G";

  // Extra hazards in the sand, away from the route.
  const onRoute = new Set([...route, ...lower, divider, at(s, col)]);
  const near = (i: number) => onRoute.has(i) || nbrs(i).some((n) => onRoute.has(n) || t[n] === "D" || t[n] === "L" || t[n] === "a" || t[n] === "G");
  const wantAcid = between(1, 3);
  const wantLava = between(lava, 2);
  for (let tries = 0; tries < 200 && (acid < wantAcid || lava < wantLava); tries++) {
    const i = at(between(floor + 1, R - 2), between(1, C - 2));
    if (t[i] !== "s" || near(i)) continue;
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
  const all = [...route, ...lower];
  if (all.some((cell) => t[cell] !== "s")) return null;
  const minDigs = all.length + (hard ? 1 : 0);
  if (minDigs < 4) return null;

  const pool = w.reduce((x, y) => x + y, 0);
  const total = hard ? Math.floor((pool * 55 + 50) / 100) : digTarget(pool);
  const split = hard ? (rand(2) ? 60 : 70) : 100;
  // Drain 1 (filled first) takes the smaller share, so plenty is left for drain 2.
  const t1 = hard ? total - Math.round((total * split) / 100) : total;
  // Drains in tile order: drain 2 (mid-grid) comes before drain 1 (bottom row) for hard boards.
  const targets = hard ? [total - t1, t1] : [total];
  const board: DigBoard = { cols: C, rows: R, tiles: t.join(""), water: w.join(""), budget: minDigs + DIG_BUDGET_SLACK, minDigs, targets };

  // Intended: dig from the pool downward at once.
  let intended = logFor(all);
  if (hard) {
    // Play forward to find the step drain 1 (the bottom one) fills, then dig the divider.
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
    intended = [...intended, { step: fillStep + 1, cell: divider }];
    // Window: the divider dug at the start must fail.
    const early = digReplay(board, [...logFor(all), { step: 1, cell: divider }].sort((x, y) => x.step - y.step)).state;
    if (digComplete(early)) return null;
  }
  const good = digReplay(board, intended).state;
  if (!good.completeStep) return null;

  // Safe minimum: no hazards, nothing beside one, no gap.
  const danger = new Set<number>();
  for (let i = 0; i < t.length; i++)
    if (t[i] === "L" || t[i] === "a" || t[i] === "G") {
      danger.add(i);
      for (const n of nbrs(i)) danger.add(n);
    }
  const plug = at(floor, col);
  const safe = shortest(t, plug, (i) => danger.has(i));
  if (!safe || safe.length < all.length - lower.length) return null;
  // Geometric shortest (hazards allowed) must fail.
  const geo = shortest(t, plug, () => false);
  if (!geo) return null;
  const geoCells = geo;
  if (geoCells.length >= all.length) return null;
  if (digComplete(digReplay(board, logFor(geoCells)).state)) return null;

  return {
    tiles: board.tiles,
    water: board.water,
    budget: board.budget,
    minDigs,
    targets,
    pool,
    hazards: hazards.sort((x, y) => x - y),
    tier: hard ? ("hard" as const) : ("standard" as const),
    route: hard ? [...all, divider] : all,
    intended: digEncode(intended),
    completeStep: good.completeStep,
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

export const DIG_BANK: DigBankEntry[] = ${JSON.stringify(bank.map(({ completeStep: _c, ...rest }) => rest))};
`;
writeFileSync(new URL("../src/lib/duel/digBank.server.ts", import.meta.url), out);
const cs = bank.map((b) => b.completeStep);
console.log(
  `dig bank: ${bank.length} (${bank.filter((b) => b.tier === "standard").length} standard, ${bank.filter((b) => b.tier === "hard").length} hard) · tries ${tries.standard}/${tries.hard} · ` +
    `${((performance.now() - t0) / 1000).toFixed(1)}s · intended completes at step ${Math.min(...cs)}–${Math.max(...cs)}`,
);
