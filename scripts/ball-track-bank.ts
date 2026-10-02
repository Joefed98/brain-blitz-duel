/**
 * Builds the Ball Track bank in src/lib/duel/ballTrackBank.server.ts.
 *
 *   bun scripts/ball-track-bank.ts
 *
 * Answer-first: a ball path is laid from the start (top row) to the exit
 * (bottom row) out of falls and ramp rolls; the ramps it needs are fixed
 * tiles (or gold ramp blockers that must be LEFT in place). 3–7 path cells get
 * removable blockers, decoy blockers go elsewhere (8–12 in total), and other
 * cells are walls or stray ramps. A full search over (ball cell, removed set),
 * with GO allowed between any removals, then proves the exit is reachable,
 * that the fewest removals equals the path blocker count, and that exactly one
 * set of that size works.
 */
import { writeFileSync } from "node:fs";

import { BT_COLS as C, BT_ROWS as R, btRun, btExitCell, btIsBlockerTile, type BtBoard } from "../src/lib/duel/ballTrack";

const BANK = 400;
const rand = (n: number) => Math.floor(Math.random() * n);
const shuffle = <T,>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; } return a; };

function layPath() {
  const start = 1 + rand(C - 2);
  const path = [start];
  const ramps = new Map<number, string>();
  const used = new Set([start]);
  let r = 0, c = start, lastFall = true, rolls = 0;
  while (r < R - 1) {
    let rolled = false;
    if (lastFall && r <= R - 3 && Math.random() < 0.5) {
      const d = Math.random() < 0.5 ? -1 : 1;
      const L = 1 + rand(3);
      const cells: number[] = [], under: number[] = [];
      let ok = true;
      for (let i = 1; i <= L && ok; i++) { const cc = c + d * i; if (cc < 0 || cc >= C || used.has(r * C + cc)) ok = false; else cells.push(r * C + cc); }
      for (let i = 0; i < L && ok; i++) { const cell = (r + 1) * C + c + d * i; if (used.has(cell)) ok = false; else under.push(cell); }
      const land = (r + 1) * C + c + d * L;
      if (ok && !used.has(land)) {
        for (const u of under) { ramps.set(u, d < 0 ? "<" : ">"); used.add(u); }
        for (const x of cells) { path.push(x); used.add(x); }
        c += d * L; rolled = true; rolls++;
      }
    }
    if (rolled) { lastFall = false; continue; }
    const below = (r + 1) * C + c;
    if (used.has(below)) return null;
    path.push(below); used.add(below); r++; lastFall = true;
  }
  if (rolls < 2) return null;
  return { start, exit: c, path, ramps };
}

/** Every exit-reaching removal set from a full search; returns the minimal ones. */
function solve(board: BtBoard, blockers: number[]) {
  const idx = new Map(blockers.map((b, i) => [b, i]));
  const exitCell = btExitCell(board);
  const seen = new Set<number>();
  const key = (pos: number, mask: number) => mask * 128 + pos;
  const stack: [number, number][] = [[board.start, 0]];
  seen.add(key(board.start, 0));
  let best = Infinity;
  const bestMasks = new Set<number>();
  const pop = (m: number) => { let n = 0; while (m) { n += m & 1; m >>= 1; } return n; };
  while (stack.length) {
    const [pos, mask] = stack.pop()!;
    if (pos === exitCell) {
      const k = pop(mask);
      if (k < best) { best = k; bestMasks.clear(); }
      if (k === best) bestMasks.add(mask);
      continue;
    }
    if (pop(mask) > best) continue;
    const removed = new Set(blockers.filter((_, i) => mask & (1 << i)));
    const go = btRun(board, removed, pos).path.at(-1)!;
    const next: [number, number][] = [[go, mask]];
    for (const [b, i] of idx) if (!(mask & (1 << i))) next.push([pos, mask | (1 << i)]);
    for (const [p, m] of next) { const k = key(p, m); if (!seen.has(k)) { seen.add(k); stack.push([p, m]); } }
  }
  return { best, masks: [...bestMasks] };
}

function build() {
  const lay = layPath();
  if (!lay) return null;
  const { start, exit, path, ramps } = lay;
  const tiles: string[] = new Array(R * C).fill(".");
  const onPath = new Set(path);
  for (const [cell, t] of ramps) tiles[cell] = t;
  // Walls and stray fixed ramps off the path.
  for (let cell = 0; cell < R * C; cell++) {
    if (onPath.has(cell) || ramps.has(cell)) continue;
    const x = Math.random();
    if (x < 0.3) tiles[cell] = "#";
    else if (x < 0.38) tiles[cell] = Math.random() < 0.5 ? "<" : ">";
  }
  const k = 3 + rand(5);
  const total = Math.max(8, k + 4) + rand(Math.min(12, 13 - Math.max(8, k + 4)) + 0);
  const pathBlock = shuffle(path.slice(1)).slice(0, k);
  for (const cell of pathBlock) tiles[cell] = "b";
  // Decoys: some of the path's own ramps become gold ramp blockers (removing one
  // drops the ball into a trap), the rest sit beside the path.
  const decoys: number[] = [];
  for (const cell of shuffle([...ramps.keys()])) {
    if (decoys.length >= 2 || decoys.length + k >= total) break;
    if (Math.random() < 0.6) { tiles[cell] = tiles[cell] === "<" ? "l" : "r"; decoys.push(cell); }
  }
  const near = shuffle([...Array(R * C).keys()].filter((cell) => {
    if (onPath.has(cell) || ramps.has(cell) || cell < C) return false;
    const r = Math.floor(cell / C), c = cell % C;
    return [cell - 1, cell + 1, cell - C, cell + C].some((n) => n >= 0 && n < R * C && onPath.has(n) && Math.abs((n % C) - c) + Math.abs(Math.floor(n / C) - r) === 1);
  }));
  for (const cell of near) {
    if (decoys.length + k >= total) break;
    tiles[cell] = Math.random() < 0.75 ? "b" : Math.random() < 0.5 ? "l" : "r";
    decoys.push(cell);
  }
  const blockers = tiles.flatMap((t, i) => (btIsBlockerTile(t) ? [i] : []));
  if (blockers.length < 8 || blockers.length > 12) return null;
  const board: BtBoard = { cols: C, rows: R, tiles: tiles.join(""), start, exit };
  const { best, masks } = solve(board, blockers);
  if (best !== k || masks.length !== 1) return null;
  const solution = blockers.filter((_, i) => masks[0]! & (1 << i)).sort((a, b) => a - b);
  // Independent check: remove the solution up front, one GO must exit.
  if (!btRun(board, new Set(solution), start).exited) return null;
  return { tiles: board.tiles, start, exit, min: k, solution };
}

const bank: NonNullable<ReturnType<typeof build>>[] = [];
let attempts = 0;
const t0 = performance.now();
while (bank.length < BANK) {
  attempts++;
  const p = build();
  if (p && !bank.some((b) => b.tiles === p.tiles)) bank.push(p);
}
const mins = [3, 4, 5, 6, 7].map((m) => `${m}:${bank.filter((b) => b.min === m).length}`).join(" ");
const blockerCounts = bank.map((b) => [...b.tiles].filter(btIsBlockerTile).length);
const out = `/**
 * Ball Track bank — generated by scripts/ball-track-bank.ts. Each entry was
 * proven by a full search: the exit is reachable, \`min\` is the fewest
 * removals, and \`solution\` is the only removal set of that size.
 * Do not edit by hand.
 */

export interface BallTrackBankEntry {
  tiles: string;
  start: number;
  exit: number;
  min: number;
  solution: number[];
}

export const BALL_TRACK_BANK: BallTrackBankEntry[] = ${JSON.stringify(bank)};
`;
writeFileSync(new URL("../src/lib/duel/ballTrackBank.server.ts", import.meta.url), out);
console.log(`ball track bank: ${bank.length} from ${attempts} attempts in ${((performance.now() - t0) / 1000).toFixed(1)}s · minimum ${mins} · blockers ${Math.min(...blockerCounts)}-${Math.max(...blockerCounts)}`);
