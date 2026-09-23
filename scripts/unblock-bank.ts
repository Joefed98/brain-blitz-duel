/**
 * Builds the Unblock layout bank on a 7x7 board. Each random arrangement's
 * whole reachable state space is explored once; every state's exact distance
 * to the exit is found by breadth-first search outward from all solved states
 * (slides are reversible), and the hardest state within 15-22 moves becomes a
 * puzzle. The stored minimum is therefore the true minimum and the stored
 * solution one shortest solution. Run with:
 *   bun run scripts/unblock-bank.ts
 * Writes /tmp/unblock-bank.sql (INSERTs for the bank table) and, for the
 * offline fallback, src/lib/duel/unblockBank.server.ts.
 */

import { writeFileSync } from "node:fs";

const N = 7;
const EXIT_ROW = 2;
const MIN_MOVES = 15;
const MAX_MOVES = 22;
const WANTED = Number(process.env["UNBLOCK_WANT"] ?? 400);
const RAW_OUT = process.env["UNBLOCK_OUT"];
/** Components larger than this are too open to be tight; skip them. */
const STATE_CAP = Number(process.env["UNBLOCK_CAP"] ?? 150_000);

interface V {
  id: number;
  row: number;
  col: number;
  len: number;
  axis: "h" | "v";
}

function cells(v: V): number[] {
  return Array.from({ length: v.len }, (_, i) =>
    v.axis === "h" ? v.row * N + v.col + i : (v.row + i) * N + v.col,
  );
}

function randomLayout(): V[] | null {
  const gold: V = { id: 0, row: EXIT_ROW, col: Math.floor(Math.random() * 2), len: 2, axis: "h" };
  const vs: V[] = [gold];
  const taken = new Set<number>(cells(gold));
  const lanes = Array.from({ length: N }, (_, c) => c).filter((c) => c > gold.col + 1);
  const blockers = 3 + Math.floor(Math.random() * 2);
  for (const col of lanes.sort(() => Math.random() - 0.5).slice(0, blockers)) {
    const len = Math.random() < 0.5 ? 2 : 3;
    const rows = Array.from({ length: N - len + 1 }, (_, r) => r).filter(
      (r) => r <= EXIT_ROW && r + len - 1 >= EXIT_ROW,
    );
    const row = rows[Math.floor(Math.random() * rows.length)]!;
    const candidate: V = { id: vs.length, row, col, len, axis: "v" };
    if (cells(candidate).some((c) => taken.has(c))) continue;
    for (const c of cells(candidate)) taken.add(c);
    vs.push(candidate);
  }
  const wanted = 10 + Math.floor(Math.random() * 4);
  for (let attempt = 0; attempt < 600 && vs.length < wanted + 1; attempt++) {
    const axis = Math.random() < 0.5 ? "h" : "v";
    const len = Math.random() < 0.66 ? 2 : 3;
    const row = Math.floor(Math.random() * (axis === "v" ? N - len + 1 : N));
    const col = Math.floor(Math.random() * (axis === "h" ? N - len + 1 : N));
    if (axis === "h" && row === EXIT_ROW) continue;
    const candidate: V = { id: vs.length, row, col, len, axis };
    const spots = cells(candidate);
    if (spots.some((c) => taken.has(c))) continue;
    for (const c of spots) taken.add(c);
    vs.push(candidate);
  }
  return vs.length >= 10 ? vs : null;
}

/** One component: every state, its neighbours, and which are solved. */
function explore(meta: V[]): { states: Uint8Array[]; adj: number[][]; goal: boolean[] } | null {
  const n = meta.length;
  const goalCol = N - meta[0]!.len;
  const key = (p: Uint8Array) => {
    let k = 0;
    for (let i = 0; i < n; i++) k = k * 8 + p[i]!;
    return k;
  };
  const start = Uint8Array.from(meta.map((v) => (v.axis === "h" ? v.col : v.row)));
  const index = new Map<number, number>([[key(start), 0]]);
  const states: Uint8Array[] = [start];
  const adj: number[][] = [];
  const taken = new Uint8Array(N * N);
  for (let head = 0; head < states.length; head++) {
    if (states.length > STATE_CAP) return null;
    const pos = states[head]!;
    taken.fill(0);
    for (let i = 0; i < n; i++) {
      const m = meta[i]!;
      for (let k = 0; k < m.len; k++) {
        taken[m.axis === "h" ? m.row * N + pos[i]! + k : (pos[i]! + k) * N + m.col] = 1;
      }
    }
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      const m = meta[i]!;
      for (const step of [-1, 1]) {
        let to = pos[i]!;
        for (;;) {
          const next = to + step;
          if (next < 0 || next + m.len > N) break;
          const edge = step === -1 ? next : next + m.len - 1;
          const cell = m.axis === "h" ? m.row * N + edge : edge * N + m.col;
          if (taken[cell]) break;
          to = next;
          const moved = pos.slice();
          moved[i] = to;
          const k = key(moved);
          let at = index.get(k);
          if (at === undefined) {
            at = states.length;
            index.set(k, at);
            states.push(moved);
          }
          out.push(at);
        }
      }
    }
    adj.push(out);
  }
  return { states, adj, goal: states.map((p) => p[0] === goalCol) };
}

function buildOne(): string | null {
  const layout = randomLayout();
  if (!layout) return null;
  const comp = explore(layout);
  if (!comp || !comp.goal.some(Boolean)) return null;
  // Distance to the nearest solved state, for every state.
  const dist = new Int32Array(comp.states.length).fill(-1);
  const queue: number[] = [];
  comp.goal.forEach((g, i) => {
    if (g) {
      dist[i] = 0;
      queue.push(i);
    }
  });
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head]!;
    for (const nb of comp.adj[at]!) {
      if (dist[nb] === -1) {
        dist[nb] = dist[at]! + 1;
        queue.push(nb);
      }
    }
  }
  let best = -1;
  for (let i = 0; i < dist.length; i++) {
    const d = dist[i]!;
    if (d >= MIN_MOVES && d <= MAX_MOVES && (best === -1 || d > dist[best]!)) best = i;
  }
  if (best === -1) return null;
  // Walk down the distance gradient for one shortest solution.
  const moves: string[] = [];
  let at = best;
  while (dist[at]! > 0) {
    const next = comp.adj[at]!.find((nb) => dist[nb] === dist[at]! - 1)!;
    const from = comp.states[at]!;
    const to = comp.states[next]!;
    const id = from.findIndex((p, i) => p !== to[i]);
    moves.push(`${id}:${to[id]}`);
    at = next;
  }
  const start = comp.states[best]!;
  const placed = layout.map((v, i) =>
    v.axis === "h" ? { ...v, col: start[i]! } : { ...v, row: start[i]! },
  );
  const line = placed.map((v) => `${v.id}${v.axis}${v.len}${v.row}${v.col}`).join(",");
  return `${line}|${dist[best]}|${moves.join(";")}`;
}

const began = Date.now();
const out: string[] = [];
const seen = new Set<string>();
let tried = 0;
while (out.length < WANTED && tried < 1_000_000) {
  tried += 1;
  const entry = buildOne();
  if (!entry) continue;
  const layout = entry.split("|")[0]!;
  if (seen.has(layout)) continue;
  seen.add(layout);
  out.push(entry);
  if (out.length % 10 === 0) console.log(`${out.length} layouts after ${tried} tries`);
}
const seconds = ((Date.now() - began) / 1000).toFixed(1);

if (RAW_OUT) {
  writeFileSync(RAW_OUT, out.join("\n"));
  console.log(`wrote ${out.length} layouts after ${tried} tries in ${seconds}s`);
  process.exit(0);
}

writeFileSync(
  "src/lib/duel/unblockBank.server.ts",
  `/**
 * Unblock fallback bank — generated by scripts/unblock-bank.ts on a ${N}x${N} board.
 * The live bank is the unblock_bank table; this list is only used if it cannot
 * be reached. Each entry is "layout|minimum moves|one shortest solution".
 */

/** ${MIN_MOVES}-${MAX_MOVES} moves, verified by breadth-first search. */
export const UNBLOCK_BANK: string[] = [
${out.map((l) => `  "${l}",`).join("\n")}
];
`,
);
console.log(`wrote ${out.length} layouts after ${tried} tries in ${seconds}s`);
