/**
 * Builds Gridlock's level banks (the difficulty levels, 15 Nov 2026; src/lib/levels/pattern/unblock.levels.ts): Easy,
 * Hard and Expert, each from its own settings (lot size, car count, minimum moves). Normal keeps the unblock_bank table
 * (scripts/unblock-bank.ts).
 *
 * Seeded and rebuildable byte for byte: entry i of a level is the first layout built from the seed stream
 * (level, i, attempt 0, 1, …) that has the level's car count, a component of at most STATE_CAP layouts, a state whose
 * exact distance to the exit lies in the level's range, and a layout no earlier entry of that level has. The exact
 * distance of every reachable layout is found by breadth-first search outward from every solved layout (slides are
 * reversible); the hardest state at or under a seeded cap inside the range becomes the board, so the stored minimum is
 * the true minimum and the stored solution one shortest solution.
 *
 *   bun scripts/unblock-levels-bank.ts            rebuild and write src/lib/duel/unblockLevelsBank.server.ts
 *   bun scripts/unblock-levels-bank.ts --check    rebuild and compare with the file, writing nothing
 *   bun scripts/unblock-levels-bank.ts --level=hard --count=5   a quick trial (prints, writes nothing)
 *   bun scripts/unblock-levels-bank.ts --level=hard --raw=<file>  one level's whole bank into <file> (one entry a line)
 *   bun scripts/unblock-levels-bank.ts --merge=<easy>,<hard>,<expert>  the file from three such runs (in parallel)
 *
 * A Hard board takes about 15 s and an Expert one about 30 s on one core (a hill climb of component searches).
 */
import { readFileSync, writeFileSync } from "node:fs";

import { LEVELS_UNBLOCK, type UnblockLevelSettings } from "../src/lib/levels/pattern/unblock.levels";
import { saltSeed, seededRng, type SeededRng } from "../src/lib/duel/seededRng";

export const BANK_FILE = "src/lib/duel/unblockLevelsBank.server.ts";
/** The boards each level's bank holds. */
export const BANK_SIZE = 120;
export const BANK_LEVELS = ["easy", "hard", "expert"] as const;
export type BankLevel = (typeof BANK_LEVELS)[number];
const EXIT_ROW = 2;
/** Components larger than this are too open to be tight (and too slow to climb); skip them. Part of the seed stream's
 * rules: changing it changes every board. */
const STATE_CAP = 20_000;
const MAX_ATTEMPTS = 200;

interface V {
  id: number;
  row: number;
  col: number;
  len: number;
  axis: "h" | "v";
}

function settingsOf(level: BankLevel): UnblockLevelSettings {
  return LEVELS_UNBLOCK.levels[level]!.settings;
}

function cells(v: V, N: number): number[] {
  return Array.from({ length: v.len }, (_, i) => (v.axis === "h" ? v.row * N + v.col + i : (v.row + i) * N + v.col));
}

/** A random lot: the gold car on the exit row, 3–4 upright cars across its lane, then cars and lorries anywhere. */
export function randomLayout(rng: SeededRng, s: UnblockLevelSettings): V[] | null {
  const N = s.cols;
  const gold: V = { id: 0, row: EXIT_ROW, col: rng.below(2), len: 2, axis: "h" };
  const vs: V[] = [gold];
  const taken = new Set<number>(cells(gold, N));
  const lanes = rng.shuffle(Array.from({ length: N }, (_, c) => c).filter((c) => c > gold.col + 1));
  const blockers = 3 + rng.below(2);
  for (const col of lanes.slice(0, blockers)) {
    const len = rng.below(2) === 0 ? 2 : 3;
    const rows = Array.from({ length: N - len + 1 }, (_, r) => r).filter((r) => r <= EXIT_ROW && r + len - 1 >= EXIT_ROW);
    const row = rng.pick(rows);
    const candidate: V = { id: vs.length, row, col, len, axis: "v" };
    if (cells(candidate, N).some((c) => taken.has(c))) continue;
    for (const c of cells(candidate, N)) taken.add(c);
    vs.push(candidate);
  }
  const wanted = rng.int(s.cars[0], s.cars[1]);
  for (let attempt = 0; attempt < 600 && vs.length < wanted + 1; attempt++) {
    const axis = rng.below(2) === 0 ? "h" : "v";
    const len = rng.next() < 0.66 ? 2 : 3;
    const row = rng.below(axis === "v" ? N - len + 1 : N);
    const col = rng.below(axis === "h" ? N - len + 1 : N);
    if (axis === "h" && row === EXIT_ROW) continue;
    const candidate: V = { id: vs.length, row, col, len, axis };
    const spots = cells(candidate, N);
    if (spots.some((c) => taken.has(c))) continue;
    for (const c of spots) taken.add(c);
    vs.push(candidate);
  }
  const cars = vs.length - 1;
  return cars <= s.cars[1] ? vs : null;
}

const serialise = (vs: readonly V[]) => vs.map((v) => `${v.id}${v.axis}${v.len}${v.row}${v.col}`).join(",");

/** A component of the lot's layouts: every layout's key (base 8, one digit a car) and its exact distance to solved. */
export interface Component {
  count: number;
  keys: Float64Array;
  dist: Int16Array;
  /** The index of a layout key, or -1. */
  indexOf(key: number): number;
  /** Calls `visit(key, car, to)` for every layout one slide from `key`. */
  neighbours(key: number, visit: (next: number, car: number, to: number) => void): void;
  /** The greatest distance in the component. */
  max: number;
}

export const keyOf = (vs: readonly V[]) => vs.reduce((k, v) => k * 8 + (v.axis === "h" ? v.col : v.row), 0);

/**
 * Explores the whole component of `meta`'s layout (a slide moves one car any distance; slides are reversible), then
 * breadth-first search outward from every solved layout gives each layout its exact fewest moves. Null when the
 * component is larger than `cap` or holds no solved layout.
 */
export function component(meta: readonly V[], N: number, cap = STATE_CAP): Component | null {
  const V = meta.length;
  const horiz = meta.map((v) => v.axis === "h");
  const lens = meta.map((v) => v.len);
  const line = meta.map((v) => (v.axis === "h" ? v.row : v.col));
  const place = new Array<number>(V);
  for (let i = 0, p = 1; i < V; i++) (place[V - 1 - i] = p), (p *= 8);
  const goalPos = N - lens[0]!;
  const cell = (i: number, p: number) => (horiz[i] ? line[i]! * N + p : p * N + line[i]!);
  let keys = new Float64Array(4096);
  let count = 0;
  let slots = new Int32Array(1 << 14).fill(-1);
  let mask = slots.length - 1;
  const hash = (k: number) => {
    let h = Math.imul((k % 4294967296) ^ Math.imul(Math.floor(k / 4294967296), 0x85ebca6b), 0x9e3779b1);
    h ^= h >>> 15;
    h = Math.imul(h, 0x2c1b3c6d);
    return (h ^ (h >>> 13)) & mask;
  };
  const find = (k: number): number => {
    for (let h = hash(k); ; h = (h + 1) & mask) {
      const j = slots[h]!;
      if (j === -1 || keys[j] === k) return h;
    }
  };
  const add = (k: number): void => {
    const h = find(k);
    if (slots[h] !== -1) return;
    if (count >= keys.length) {
      const grown = new Float64Array(keys.length * 2);
      grown.set(keys);
      keys = grown;
    }
    keys[count] = k;
    slots[h] = count++;
    if (count * 2 > slots.length) {
      slots = new Int32Array(slots.length * 2).fill(-1);
      mask = slots.length - 1;
      for (let i = 0; i < count; i++) slots[find(keys[i]!)] = i;
    }
  };
  const indexOf = (k: number) => slots[find(k)]!;
  const pos = new Uint8Array(V);
  const occ = new Uint8Array(N * N);
  const neighbours = (key: number, visit: (next: number, car: number, to: number) => void) => {
    let k = key;
    for (let i = V - 1; i >= 0; i--) {
      pos[i] = k % 8;
      k = Math.floor(k / 8);
    }
    occ.fill(0);
    for (let i = 0; i < V; i++) for (let c = 0; c < lens[i]!; c++) occ[cell(i, pos[i]! + c)] = 1;
    for (let i = 0; i < V; i++) {
      const p = pos[i]!;
      const base = key - p * place[i]!;
      for (let t = p - 1; t >= 0 && !occ[cell(i, t)]; t--) visit(base + t * place[i]!, i, t);
      for (let t = p + 1; t + lens[i]! - 1 <= N - 1 && !occ[cell(i, t + lens[i]! - 1)]; t++) visit(base + t * place[i]!, i, t);
    }
  };
  add(keyOf(meta));
  for (let s = 0; s < count; s++) {
    neighbours(keys[s]!, add);
    if (count > cap) return null;
  }
  const dist = new Int16Array(count).fill(-1);
  const goldPlace = place[0]!;
  let frontier: number[] = [];
  for (let j = 0; j < count; j++) {
    if (Math.floor(keys[j]! / goldPlace) % 8 === goalPos) {
      dist[j] = 0;
      frontier.push(j);
    }
  }
  if (!frontier.length) return null;
  let max = 0;
  for (let d = 1; frontier.length; d++) {
    const next: number[] = [];
    for (const j of frontier) {
      neighbours(keys[j]!, (nk) => {
        const i = indexOf(nk);
        if (dist[i] === -1) {
          dist[i] = d;
          next.push(i);
        }
      });
    }
    if (next.length) max = d;
    frontier = next;
  }
  return { count, keys: keys.subarray(0, count), dist, indexOf, neighbours, max };
}

function placeAt(meta: readonly V[], key: number): V[] {
  const out = meta.map((v) => ({ ...v }));
  let k = key;
  for (let i = out.length - 1; i >= 0; i--) {
    const p = k % 8;
    k = Math.floor(k / 8);
    if (out[i]!.axis === "h") out[i]!.col = p;
    else out[i]!.row = p;
  }
  return out;
}

/** A random car or lorry in a free spot (never sideways on the exit row), or null. */
function randomCar(rng: SeededRng, vs: readonly V[], N: number): V | null {
  const taken = new Set(vs.flatMap((v) => cells(v, N)));
  for (let t = 0; t < 60; t++) {
    const axis = rng.below(2) === 0 ? "h" : "v";
    const len = rng.next() < 0.66 ? 2 : 3;
    const row = rng.below(axis === "v" ? N - len + 1 : N);
    const col = rng.below(axis === "h" ? N - len + 1 : N);
    if (axis === "h" && row === EXIT_ROW) continue;
    const car: V = { id: vs.length, row, col, len, axis };
    if (cells(car, N).some((c) => taken.has(c))) continue;
    return car;
  }
  return null;
}

const renumber = (vs: readonly V[]) => vs.map((v, id) => ({ ...v, id }));

/** One mutation of a lot: a car added, removed or moved, keeping the car count inside the level's range. */
function mutate(rng: SeededRng, vs: readonly V[], s: UnblockLevelSettings): V[] | null {
  const cars = vs.length - 1;
  const op = rng.below(3);
  if (op === 0 && cars < s.cars[1]) {
    const car = randomCar(rng, vs, s.cols);
    return car ? [...vs, car] : null;
  }
  if (op === 1 && cars > s.cars[0]) {
    const drop = 1 + rng.below(cars);
    return renumber(vs.filter((_, i) => i !== drop));
  }
  const drop = 1 + rng.below(cars);
  const rest = renumber(vs.filter((_, i) => i !== drop));
  const car = randomCar(rng, rest, s.cols);
  return car ? [...rest, car] : null;
}

/** Steps one climb may take before the attempt gives up (the next attempt starts from a fresh lot). */
const CLIMB_STEPS = 1_500;

/**
 * One attempt: a hill climb from a random lot, each step a car added, removed or moved and kept when the lot's
 * hardest layout is at least as hard, until it reaches a seeded target inside the level's range; the board is then the
 * first layout (in exploration order) exactly that many moves from solved. An entry "layout|minimum|solution", or null
 * if the climb ran out of steps.
 */
function attempt(rng: SeededRng, s: UnblockLevelSettings): string | null {
  const N = s.cols;
  const target = rng.int(s.minMoves[0], s.minMoves[1]);
  let lot = randomLayout(rng, s);
  if (!lot) return null;
  let comp = component(lot, N);
  let score = comp ? comp.max : -1;
  for (let step = 0; step < CLIMB_STEPS && (score < target || lot.length - 1 < s.cars[0]); step++) {
    const next = mutate(rng, lot, s);
    if (!next) continue;
    const c = component(next, N);
    const sc = c ? c.max : -1;
    if (sc < score) continue;
    lot = next;
    comp = c;
    score = sc;
    if (c) {
      // Climb on from the lot's hardest layout.
      let at = 0;
      for (let i = 0; i < c.count; i++) if (c.dist[i]! > c.dist[at]!) at = i;
      lot = placeAt(lot, c.keys[at]!);
    }
  }
  if (!comp || score < target || lot.length - 1 < s.cars[0]) return null;
  let at = -1;
  for (let i = 0; i < comp.count; i++) {
    if (comp.dist[i] === target) {
      at = i;
      break;
    }
  }
  const start = placeAt(lot, comp.keys[at]!);
  const moves: string[] = [];
  let key = comp.keys[at]!;
  for (let d = target; d > 0; d--) {
    let chosen: { next: number; car: number; to: number } | null = null;
    comp.neighbours(key, (next, car, to) => {
      if (!chosen && comp!.dist[comp!.indexOf(next)] === d - 1) chosen = { next, car, to };
    });
    const c = chosen as { next: number; car: number; to: number } | null;
    if (!c) throw new Error("no step down the distance gradient");
    moves.push(`${c.car}:${c.to}`);
    key = c.next;
  }
  return `${serialise(start)}|${target}|${moves.join(";")}`;
}

/** Entry i of a level, given the layouts of the entries before it. Returns the entry and the attempt that made it. */
export function buildEntry(level: BankLevel, i: number, earlier: ReadonlySet<string>): { entry: string; attempts: number } {
  const s = settingsOf(level);
  for (let a = 0; a < MAX_ATTEMPTS; a++) {
    const rng = seededRng(saltSeed(saltSeed(i, `unblock-levels:${level}`), String(a)));
    const entry = attempt(rng, s);
    if (!entry) continue;
    if (earlier.has(entry.split("|")[0]!)) continue;
    return { entry, attempts: a + 1 };
  }
  throw new Error(`unblock ${level} entry ${i}: nothing after ${MAX_ATTEMPTS} attempts`);
}

export function buildLevel(level: BankLevel, count: number, log = false, from = 0): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const began = Date.now();
  for (let i = from; i < count; i++) {
    const { entry, attempts } = buildEntry(level, i, seen);
    seen.add(entry.split("|")[0]!);
    out.push(entry);
    if (log && (i + 1) % 10 === 0) console.log(`${level}: ${i + 1} boards (${((Date.now() - began) / 1000).toFixed(1)} s, last took ${attempts} attempts)`);
  }
  return out;
}

export function bankSource(banks: Record<BankLevel, string[]>): string {
  const block = (level: BankLevel) => {
    const s = settingsOf(level);
    return `  // ${level}: ${s.cols}×${s.cols}, ${s.minMoves[0]}–${s.minMoves[1]} moves at the minimum, ${s.cars[0]}–${s.cars[1]} cars besides the gold one.\n  ${level}: [\n${banks[level].map((l) => `    "${l}",`).join("\n")}\n  ],`;
  };
  return `/**
 * Gridlock's level banks (the difficulty levels, 15 Nov 2026) — generated by scripts/unblock-levels-bank.ts from the
 * settings in src/lib/levels/pattern/unblock.levels.ts; rebuilt byte for byte with \`--check\`. Each entry is
 * "layout|minimum moves|one shortest solution", the minimum proved by breadth-first search over the whole lot.
 * Normal deals from the unblock_bank table as before.
 */

export const UNBLOCK_LEVEL_BANK: Record<"easy" | "hard" | "expert", readonly string[]> = {
${BANK_LEVELS.map(block).join("\n")}
};
`;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const only = args.find((a) => a.startsWith("--level="))?.slice(8) as BankLevel | undefined;
  const count = Number(args.find((a) => a.startsWith("--count="))?.slice(8) ?? BANK_SIZE);
  const merge = args.find((a) => a.startsWith("--merge="))?.slice(8);
  if (merge) {
    const files = merge.split(",");
    // Each level's file may be parts joined with "+" (in order).
    const banks = Object.fromEntries(
      BANK_LEVELS.map((l, k) => [l, files[k]!.split("+").flatMap((f) => readFileSync(f, "utf8").trim().split("\n"))]),
    ) as Record<BankLevel, string[]>;
    for (const l of BANK_LEVELS) {
      if (banks[l].length !== BANK_SIZE) throw new Error(`${l}: ${banks[l].length} entries, not ${BANK_SIZE}`);
      if (new Set(banks[l].map((e) => e.split("|")[0])).size !== BANK_SIZE) throw new Error(`${l}: parts share a layout (rebuild in order)`);
    }
    writeFileSync(BANK_FILE, bankSource(banks));
    console.log(`wrote ${BANK_FILE}`);
    process.exit(0);
  }
  if (only) {
    const t = Date.now();
    const raw = args.find((a) => a.startsWith("--raw="))?.slice(6);
    // --from=a with --count=b builds entries a…b-1 alone (a part run in parallel; its layouts are checked against the
    // other parts' when merged, and --check rebuilds the whole level in order).
    const from = Number(args.find((a) => a.startsWith("--from="))?.slice(7) ?? 0);
    const entries = buildLevel(only, raw && !args.some((a) => a.startsWith("--count=")) ? BANK_SIZE : count, true, from);
    if (raw) writeFileSync(raw, `${entries.join("\n")}\n`);
    const mins = entries.map((e) => Number(e.split("|")[1]));
    const cars = entries.map((e) => e.split("|")[0]!.split(",").length - 1);
    console.log(`${only}: ${entries.length} in ${((Date.now() - t) / 1000).toFixed(1)} s; minimums ${mins.join(" ")}; cars ${cars.join(" ")}`);
    process.exit(0);
  }
  const banks = Object.fromEntries(BANK_LEVELS.map((l) => [l, buildLevel(l, BANK_SIZE, true)])) as Record<BankLevel, string[]>;
  const source = bankSource(banks);
  if (args.includes("--check")) {
    const ok = readFileSync(BANK_FILE, "utf8") === source;
    console.log(ok ? "unblock level banks rebuild byte for byte" : "FAIL: unblock level banks differ from the file");
    process.exit(ok ? 0 : 1);
  }
  writeFileSync(BANK_FILE, source);
  console.log(`wrote ${BANK_FILE}`);
}
