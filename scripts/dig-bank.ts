/**
 * Builds the Dig bank in src/lib/duel/digBank.server.ts.
 *
 *   bun scripts/dig-bank.ts
 *
 * Answer-first. A rock-walled pool sits near the top over a rock floor with
 * one sand plug. Below it, one or two full-width rock shelves each have a
 * single sand hole; the intended route is plug → shaft → along the shelf to
 * its hole → (next shelf) → shaft → drain. Everything else inside is sand.
 * Decoys: some boards have a side gap on a shelf, on the side away from the
 * hole; others have rock-lined pockets under a sand hole in the shelf, also on
 * the wrong side. Accepted only when digging the route (bottom-up, one cell a
 * step) collects ≥ 90% of the pool, and digging every sand cell at once
 * collects less than the 80% target.
 */
import { writeFileSync } from "node:fs";

import {
  digInit,
  digReplay,
  DIG_COLS as C,
  DIG_ROWS as R,
  type DigAction,
  type DigBoard,
} from "../src/lib/duel/dig";

const BANK = 300;
const rand = (n: number) => Math.floor(Math.random() * n);
const between = (lo: number, hi: number) => lo + rand(hi - lo + 1);

function build() {
  const t: string[] = new Array(C * R).fill("s");
  const w: number[] = new Array(C * R).fill(0);
  const at = (r: number, c: number) => r * C + c;
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
  const plug = between(a, b);
  const route: number[] = [at(floor, plug)];
  t[at(floor, plug)] = "s";

  // Shelves.
  const shelves = rand(3) === 0 ? 2 : 1;
  const shelfRows =
    shelves === 1 ? [between(floor + 3, 11)] : [between(floor + 3, 8), 0];
  if (shelves === 2) shelfRows[1] = between(shelfRows[0]! + 3, 12);
  if (shelfRows.some((r) => r > 13)) return null;

  let col = plug;
  let row = floor + 1;
  const decoyKind = rand(10) < 7 ? "gap" : "pocket";
  const gapShelf = rand(shelves);
  const decoyCells: number[] = [];
  for (let k = 0; k < shelves; k++) {
    const s = shelfRows[k]!;
    for (let c = 1; c < C - 1; c++) t[at(s, c)] = "#";
    // Shaft down to the shelf.
    for (let r = row; r < s; r++) route.push(at(r, col));
    // Travel along the shelf to its hole (2–5 cells away).
    const dir = col <= 2 ? 1 : col >= C - 3 ? -1 : rand(2) ? 1 : -1;
    const dist = between(2, 5);
    const hole = col + dir * dist;
    if (hole < 1 || hole > C - 2) return null;
    for (let c = col + dir; c !== hole + dir; c += dir) route.push(at(s - 1, c));
    t[at(s, hole)] = "s";
    route.push(at(s, hole));
    // The decoy on the other side.
    if (decoyKind === "gap" && k === gapShelf) {
      const edge = dir > 0 ? 0 : C - 1;
      t[at(s - 1, edge)] = "G";
      for (let c = col - dir; c !== edge; c -= dir) decoyCells.push(at(s - 1, c));
    } else {
      const d = col - dir * between(2, 3);
      if (d >= 2 && d <= C - 3 && s + 3 < R - 1) {
        t[at(s, d)] = "s";
        for (let r = s + 1; r <= s + 2; r++) for (let c = d - 1; c <= d + 1; c++) t[at(r, c)] = ".";
        for (let c = d - 2; c <= d + 2; c++) t[at(s + 3, c)] = "#";
        for (let r = s + 1; r <= s + 3; r++) {
          t[at(r, d - 2)] = "#";
          t[at(r, d + 2)] = "#";
        }
        decoyCells.push(at(s, d));
      }
    }
    col = hole;
    row = s + 1;
  }
  for (let r = row; r < R - 1; r++) route.push(at(r, col));
  t[at(R - 1, col)] = "D";
  // Route cells must still be sand (pockets may have cut through them).
  if (route.some((cell) => t[cell] !== "s")) return null;
  if (!decoyCells.length) return null;

  const board: DigBoard = { cols: C, rows: R, tiles: t.join(""), water: w.join("") };
  const pool = digInit(board).pool;

  // Intended: dig the route bottom-up, one cell per step.
  const intended: DigAction[] = [...route].reverse().map((cell, i) => ({ step: i + 1, cell }));
  const good = digReplay(board, intended).state;
  if (good.collected < good.full) return null;
  // Everything at once (8 per step is the cap, so spread across steps).
  const sand = [...board.tiles].map((ch, i) => (ch === "s" ? i : -1)).filter((i) => i >= 0);
  const all: DigAction[] = sand.map((cell, i) => ({ step: 1 + Math.floor(i / 8), cell }));
  const greedy = digReplay(board, all).state;
  if (greedy.collected >= greedy.target) return null;
  return { board, route, pool, collected: good.collected, allCollected: greedy.collected, decoyKind, shelves };
}

const bank: NonNullable<ReturnType<typeof build>>[] = [];
const seen = new Set<string>();
let attempts = 0;
const t0 = performance.now();
while (bank.length < BANK && attempts < 200_000) {
  attempts++;
  const p = build();
  if (!p || seen.has(p.board.tiles)) continue;
  seen.add(p.board.tiles);
  bank.push(p);
}
const pct = (x: number, y: number) => Math.round((100 * x) / y);
const goodPct = bank.map((b) => pct(b.collected, b.pool));
const allPct = bank.map((b) => pct(b.allCollected, b.pool));
const out = `/**
 * Dig bank — generated by scripts/dig-bank.ts. Each board was simulated: the
 * intended \`route\` (dug bottom-up) collects ≥ 90% of the pool, and digging
 * every sand cell collects less than the 80% target.
 * Do not edit by hand.
 */

export interface DigBankEntry {
  tiles: string;
  water: string;
  /** Intended dig route, top to bottom. */
  route: number[];
}

export const DIG_BANK: DigBankEntry[] = ${JSON.stringify(bank.map((b) => ({ tiles: b.board.tiles, water: b.board.water, route: b.route })))};
`;
writeFileSync(new URL("../src/lib/duel/digBank.server.ts", import.meta.url), out);
console.log(
  `dig bank: ${bank.length} from ${attempts} attempts in ${((performance.now() - t0) / 1000).toFixed(1)}s · ` +
    `route collects ${Math.min(...goodPct)}–${Math.max(...goodPct)}% · dig-all ${Math.min(...allPct)}–${Math.max(...allPct)}% · ` +
    `gap ${bank.filter((b) => b.decoyKind === "gap").length} pocket ${bank.filter((b) => b.decoyKind === "pocket").length} · two shelves ${bank.filter((b) => b.shelves === 2).length}`,
);
