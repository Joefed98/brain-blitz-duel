/**
 * Heave's forward optimal solver for the levels check (the Pattern overhaul, stage 3, 16 Nov 2026): A* over
 * (crates, the pusher's region) states in pushes, with an admissible and consistent lower bound (each crate's fewest
 * pushes to its nearest mark on the empty warehouse; one push moves one crate one square, so the bound drops by at most
 * one a push) and the dead squares (pushStuck.ts) pruned. Its answer is the board's exact minimum push count, found
 * from the start position independently of the bank's backward search.
 */
import { PUSH_DIRS, pushStep } from "../src/lib/duel/push";
import { pushDeadSquares } from "../src/lib/duel/pushStuck";
import { PUSH_CELLS, type SlideDir } from "../src/lib/duel/types";

const OPPOSITE = { U: "D", D: "U", L: "R", R: "L" } as Record<SlideDir, SlideDir>;

/** For every floor square, the fewest pushes a lone crate on it needs to reach any mark (Infinity when it can't). */
export function pushDistances(walls: readonly number[], targets: readonly number[]): number[] {
  const wall = new Set(walls);
  const dist = new Array<number>(PUSH_CELLS).fill(Infinity);
  let frontier = targets.filter((t) => !wall.has(t));
  for (const t of frontier) dist[t] = 0;
  for (let d = 1; frontier.length; d++) {
    const next: number[] = [];
    for (const cell of frontier) {
      for (const dir of PUSH_DIRS) {
        const from = pushStep(cell, OPPOSITE[dir]);
        const stand = from === null ? null : pushStep(from, OPPOSITE[dir]);
        if (from === null || stand === null || wall.has(from) || wall.has(stand) || dist[from] !== Infinity) continue;
        dist[from] = d;
        next.push(from);
      }
    }
    frontier = next;
  }
  return dist;
}

function region(wall: Uint8Array, crates: readonly number[], from: number, out: Uint8Array): number {
  out.fill(0);
  const blocked = new Uint8Array(PUSH_CELLS);
  for (const c of crates) blocked[c] = 1;
  out[from] = 1;
  let low = from;
  const stack = [from];
  while (stack.length) {
    const cell = stack.pop()!;
    for (const dir of PUSH_DIRS) {
      const next = pushStep(cell, dir);
      if (next === null || wall[next] || blocked[next] || out[next]) continue;
      out[next] = 1;
      if (next < low) low = next;
      stack.push(next);
    }
  }
  return low;
}

/** A binary heap of [f, g, key]. */
class Heap {
  private items: { f: number; g: number; key: string; crates: number[]; pusher: number }[] = [];
  get size() {
    return this.items.length;
  }
  push(item: { f: number; g: number; key: string; crates: number[]; pusher: number }) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (better(a[p]!, a[i]!)) break;
      [a[p], a[i]] = [a[i]!, a[p]!];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && better(a[l]!, a[m]!)) m = l;
        if (r < a.length && better(a[r]!, a[m]!)) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        i = m;
      }
    }
    return top;
  }
}
const better = (x: { f: number; g: number }, y: { f: number; g: number }) => x.f < y.f || (x.f === y.f && x.g > y.g);

/** The fewest pushes that home every crate from the start, or null past `cap` expansions. */
export function pushMinimum(
  layout: { walls: readonly number[]; targets: readonly number[]; crates: readonly number[]; pusher: number },
  cap = 3_000_000,
): { pushes: number; expanded: number } | null {
  const wall = new Uint8Array(PUSH_CELLS);
  for (const w of layout.walls) wall[w] = 1;
  const dist = pushDistances(layout.walls, layout.targets);
  const dead = pushDeadSquares(layout.walls, layout.targets);
  const goal = new Set(layout.targets);
  const h = (crates: readonly number[]) => crates.reduce((sum, c) => sum + dist[c]!, 0);
  const reach = new Uint8Array(PUSH_CELLS);
  const tmp = new Uint8Array(PUSH_CELLS);
  const keyOf = (crates: readonly number[], low: number) => `${[...crates].sort((a, b) => a - b).join(",")}|${low}`;
  const best = new Map<string, number>();
  const heap = new Heap();
  const start = [...layout.crates];
  const low0 = region(wall, start, layout.pusher, tmp);
  const k0 = keyOf(start, low0);
  best.set(k0, 0);
  heap.push({ f: h(start), g: 0, key: k0, crates: start, pusher: low0 });
  let expanded = 0;
  while (heap.size) {
    const node = heap.pop();
    if ((best.get(node.key) ?? Infinity) < node.g) continue;
    if (node.crates.every((c) => goal.has(c))) return { pushes: node.g, expanded };
    if (++expanded > cap) return null;
    region(wall, node.crates, node.pusher, reach);
    for (let i = 0; i < node.crates.length; i++) {
      const crate = node.crates[i]!;
      for (const dir of PUSH_DIRS) {
        const stand = pushStep(crate, OPPOSITE[dir]);
        const to = pushStep(crate, dir);
        if (stand === null || to === null || !reach[stand] || wall[to] || dead.has(to) || node.crates.includes(to)) continue;
        const crates = [...node.crates];
        crates[i] = to;
        const low = region(wall, crates, crate, tmp);
        const key = keyOf(crates, low);
        const g = node.g + 1;
        if ((best.get(key) ?? Infinity) <= g) continue;
        best.set(key, g);
        heap.push({ f: g + h(crates), g, key, crates, pusher: low });
      }
    }
  }
  return null;
}
