/**
 * Builds the Unblock layout bank. Every layout is solved by breadth-first
 * search, so the stored minimum move count is the true minimum and the stored
 * solution is one shortest solution. Run with:
 *   bun run scripts/unblock-bank.ts
 * It rewrites src/lib/duel/unblockBank.server.ts.
 */

import { writeFileSync } from "node:fs";

const N = 7;
const EXIT_ROW = 2;
const MIN_MOVES = 15;
const MAX_MOVES = 22;
const WANTED = Number(process.env["UNBLOCK_WANT"] ?? 120);
/** Set by the parallel driver: write raw lines here instead of the bank file. */
const RAW_OUT = process.env["UNBLOCK_OUT"];
/** Abandon a layout whose search grows past this — it is too open to be tight. */
const NODE_CAP = 200_000;

interface V {
  id: number;
  row: number;
  col: number;
  len: number;
  axis: "h" | "v";
}

interface Move {
  id: number;
  to: number;
}

function cells(v: V): number[] {
  return Array.from({ length: v.len }, (_, i) =>
    v.axis === "h" ? v.row * N + v.col + i : (v.row + i) * N + v.col,
  );
}

function occupied(vs: V[], skip?: number): Set<number> {
  const out = new Set<number>();
  for (const v of vs) {
    if (v.id === skip) continue;
    for (const c of cells(v)) out.add(c);
  }
  return out;
}

function pos(v: V): number {
  return v.axis === "h" ? v.col : v.row;
}

/**
 * Fewest moves to free the gold car plus one such solution, or null.
 * States are position arrays; parents are kept so the path is rebuilt at the
 * end rather than copied into every queue entry.
 */
function solve(meta: V[], startPos: number[]): { min: number; moves: Move[] } | null {
  const N_V = meta.length;
  const goldLen = meta[0]!.len;
  const goalCol = N - goldLen;
  // Each position is 0..6, so three bits per vehicle packs the whole state.
  const encode = (p: number[]) => {
    let k = 0;
    for (let i = 0; i < N_V; i++) k = k * 8 + p[i]!;
    return k;
  };
  const isDone = (p: number[]) => p[0] === goalCol;
  if (isDone(startPos)) return { min: 0, moves: [] };

  interface Node {
    pos: number[];
    parent: number;
    move: Move | null;
    depth: number;
  }
  const nodes: Node[] = [{ pos: startPos, parent: -1, move: null, depth: 0 }];
  const seen = new Set<number>([encode(startPos)]);
  let head = 0;

  const rebuild = (index: number): Move[] => {
    const out: Move[] = [];
    let at = index;
    while (at > 0) {
      const node = nodes[at]!;
      if (node.move) out.push(node.move);
      at = node.parent;
    }
    return out.reverse();
  };

  while (head < nodes.length) {
    if (nodes.length > NODE_CAP) return null;
    const node = nodes[head]!;
    head += 1;
    if (node.depth >= MAX_MOVES) continue;

    // Cells taken by everything in this state.
    const taken = new Uint8Array(N * N);
    for (let i = 0; i < N_V; i++) {
      const m = meta[i]!;
      const at = node.pos[i]!;
      for (let k = 0; k < m.len; k++) {
        taken[m.axis === "h" ? m.row * N + at + k : (at + k) * N + m.col] = 1;
      }
    }

    for (let i = 0; i < N_V; i++) {
      const m = meta[i]!;
      const at = node.pos[i]!;
      for (const step of [-1, 1] as const) {
        let to = at;
        for (;;) {
          const next = to + step;
          if (next < 0 || next + m.len > N) break;
          const cell =
            step === -1
              ? m.axis === "h"
                ? m.row * N + next
                : next * N + m.col
              : m.axis === "h"
                ? m.row * N + next + m.len - 1
                : (next + m.len - 1) * N + m.col;
          if (taken[cell]) break;
          to = next;
          const pos = node.pos.slice();
          pos[i] = to;
          const k = encode(pos);
          if (seen.has(k)) continue;
          seen.add(k);
          const index = nodes.length;
          nodes.push({ pos, parent: head - 1, move: { id: m.id, to }, depth: node.depth + 1 });
          if (isDone(pos)) return { min: node.depth + 1, moves: rebuild(index) };
        }
      }
    }
  }
  return null;
}

function randomLayout(): V[] | null {
  const gold: V = { id: 0, row: EXIT_ROW, col: Math.floor(Math.random() * 2), len: 2, axis: "h" };
  const vs: V[] = [gold];
  const taken = new Set<number>(cells(gold));

  // Three or four upright cars block the gold car's lane, so it can never
  // simply drive out: each blocker must be shifted first.
  const lanes = Array.from({ length: N }, (_, c) => c).filter((c) => c > gold.col + 1);
  const blockers = 3 + Math.floor(Math.random() * 2);
  for (const col of lanes.sort(() => Math.random() - 0.5).slice(0, blockers)) {
    const len = Math.random() < 0.5 ? 2 : 3;
    const rows = Array.from({ length: N - len + 1 }, (_, r) => r).filter(
      (r) => r <= EXIT_ROW && r + len - 1 >= EXIT_ROW,
    );
    if (rows.length === 0) continue;
    const row = rows[Math.floor(Math.random() * rows.length)]!;
    const candidate: V = { id: vs.length, row, col, len, axis: "v" };
    if (cells(candidate).some((c) => taken.has(c))) continue;
    for (const c of cells(candidate)) taken.add(c);
    vs.push(candidate);
  }
  if (vs.length < blockers) return null;

  const wanted = 9 + Math.floor(Math.random() * 4); // 9-12 other vehicles in total
  for (let attempt = 0; attempt < 600 && vs.length < wanted + 1; attempt++) {
    const axis = Math.random() < 0.5 ? "h" : "v";
    const len = Math.random() < 0.66 ? 2 : 3;
    const row = Math.floor(Math.random() * (axis === "v" ? N - len + 1 : N));
    const col = Math.floor(Math.random() * (axis === "h" ? N - len + 1 : N));
    if (axis === "h" && row === EXIT_ROW) continue; // nothing else lies on the exit row
    const candidate: V = { id: vs.length, row, col, len, axis };
    const spots = cells(candidate);
    if (spots.some((c) => taken.has(c))) continue;
    for (const c of spots) taken.add(c);
    vs.push(candidate);
  }
  return vs.length >= 9 ? vs : null;
}

const serialise = (vs: V[]) => vs.map((v) => `${v.id}${v.axis}${v.len}${v.row}${v.col}`).join(",");
const encode = (moves: Move[]) => moves.map((m) => `${m.id}:${m.to}`).join(";");

const out: string[] = [];
const seen = new Set<string>();
let tried = 0;
while (out.length < WANTED && tried < 2_000_000) {
  tried += 1;
  const layout = randomLayout();
  if (!layout) continue;
  const line = serialise(layout);
  if (seen.has(line)) continue;
  seen.add(line);
  const result = solve(
    layout,
    layout.map((v) => pos(v)),
  );
  if (tried % 2000 === 0) console.log(`tried ${tried}, kept ${out.length}`);
  if (!result) continue;
  if (result.min < MIN_MOVES || result.min > MAX_MOVES) continue;
  out.push(`${line}|${result.min}|${encode(result.moves)}`);
  if (out.length % 5 === 0) console.log(`${out.length} layouts after ${tried} tries`);
}

if (RAW_OUT) {
  writeFileSync(RAW_OUT, out.join("\n"));
  console.log(`wrote ${out.length} layouts after ${tried} tries`);
  process.exit(0);
}

const body = `/**
 * Unblock layout bank — generated by scripts/unblock-bank.ts on a ${N}x${N} board.
 * Each entry is "layout|minimum moves|one shortest solution". Never edit by hand.
 */

/** ${MIN_MOVES}-${MAX_MOVES} moves, verified by breadth-first search. */
export const UNBLOCK_BANK: string[] = [
${out.map((l) => `  "${l}",`).join("\n")}
];
`;

writeFileSync("src/lib/duel/unblockBank.server.ts", body);
console.log(`wrote ${out.length} layouts after ${tried} tries`);
