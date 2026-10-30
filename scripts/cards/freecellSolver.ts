/**
 * FreeCell's bank solver (scripts/freecell-bank.ts, the checks and the bots): weighted A* over the sim's own rules
 * (fcLegal / fcApply in src/lib/arcade/cards/freecell.ts), so every move it returns replays through the sim.
 * A move is [from, index, to]; auto moves home are the sim's and are not moves.
 */
import { FC_COLS, FC_CELLS, FC_PILE_CELL, FC_PILE_HOME, fcApply, fcHomeCount, fcRunStart, type FcState } from "../../src/lib/arcade/cards/freecell";
import { NO_CARD, rankOf } from "../../src/lib/arcade/cards/cards";

export type FcMove = readonly [number, number, number];

export function fcKey(s: FcState): string {
  const cols = s.cols.map((c) => c.join(".")).sort().join("|");
  const cells = s.cells.filter((c) => c !== NO_CARD).sort((a, b) => a - b).join(".");
  return `${s.home.join(".")}/${cells}/${cols}`;
}

/** Every legal move from a state (one free cell stands for all; one empty column for all). */
export function fcMoves(s: FcState): FcMove[] {
  const out: FcMove[] = [];
  let firstCell = -1;
  for (let i = 0; i < FC_CELLS; i++) if (s.cells[i] === NO_CARD) { firstCell = FC_PILE_CELL + i; break; }
  const sources: [number, number][] = [];
  for (let c = 0; c < FC_COLS; c++) {
    const col = s.cols[c]!;
    for (let i = fcRunStart(col); i < col.length; i++) sources.push([c, i]);
  }
  for (let i = 0; i < FC_CELLS; i++) if (s.cells[i] !== NO_CARD) sources.push([FC_PILE_CELL + i, 0]);
  for (const [from, index] of sources) {
    const top = from < FC_COLS ? index === s.cols[from]!.length - 1 : true;
    if (top) out.push([from, index, FC_PILE_HOME]);
    let emptyDone = false;
    for (let c = 0; c < FC_COLS; c++) {
      if (c === from) continue;
      if (s.cols[c]!.length === 0) {
        if (emptyDone) continue;
        emptyDone = true;
      }
      out.push([from, index, c]);
    }
    if (from < FC_COLS && top && firstCell >= 0) out.push([from, index, firstCell]);
  }
  return out;
}

function h(s: FcState): number {
  let out = 52 - fcHomeCount(s);
  for (const col of s.cols) {
    let minSeen = 99;
    for (const card of col) {
      const r = rankOf(card);
      if (r > minSeen) out += 1;
      if (r < minSeen) minSeen = r;
    }
  }
  for (const c of s.cells) if (c !== NO_CARD) out += 0.5;
  return out;
}

interface Node { s: FcState; g: number; f: number; parent: Node | null; move: FcMove | null }

class Heap {
  items: Node[] = [];
  push(n: Node) {
    const a = this.items;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p]!.f <= a[i]!.f) break;
      [a[p], a[i]] = [a[i]!, a[p]!];
      i = p;
    }
  }
  pop(): Node | undefined {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l]!.f < a[m]!.f) m = l;
        if (r < a.length && a[r]!.f < a[m]!.f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        i = m;
      }
    }
    return top;
  }
  get size() { return this.items.length; }
}

/** Weighted A*: a solution (moves) or null within the node limit. */
export function fcSolve(start: FcState, weight: number, limit: number): FcMove[] | null {
  const heap = new Heap();
  const seen = new Map<string, number>();
  heap.push({ s: start, g: 0, f: weight * h(start), parent: null, move: null });
  seen.set(fcKey(start), 0);
  let expanded = 0;
  while (heap.size > 0 && expanded < limit) {
    const node = heap.pop()!;
    expanded++;
    if (fcHomeCount(node.s) === 52) {
      const moves: FcMove[] = [];
      for (let n: Node | null = node; n && n.move; n = n.parent) moves.push(n.move);
      return moves.reverse();
    }
    for (const m of fcMoves(node.s)) {
      const next = fcApply(node.s, m[0], m[1], m[2]);
      if (!next) continue;
      const key = fcKey(next);
      const g = node.g + 1;
      const old = seen.get(key);
      if (old !== undefined && old <= g) continue;
      seen.set(key, g);
      heap.push({ s: next, g, f: g + weight * h(next), parent: node, move: m });
    }
  }
  return null;
}

/** The shortest solution over a few weights (each within the limit). */
export function fcBestSolution(start: FcState, limit = 150_000): FcMove[] | null {
  let best: FcMove[] | null = null;
  for (const w of [4, 2.5, 1.8, 1.4, 1.2, 1.1, 1]) {
    const sol = fcSolve(start, w, limit);
    if (sol && (!best || sol.length < best.length)) best = sol;
  }
  return best;
}
