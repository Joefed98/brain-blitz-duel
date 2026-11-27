/**
 * Builds Heave's level banks (the Pattern overhaul, stage 3, 16 Nov 2026) in src/lib/duel/pushLevelBank.server.ts:
 * Easy, Hard and Expert warehouses, each level's settings read from src/lib/levels/pattern/push.levels.ts.
 *
 * The same backward "pull" search as scripts/depth4-push-bank.ts (Normal's bank): every layout is grown backwards
 * from its solved position, breadth first in pushes over (crates, the pusher's region) states, whole levels only, so
 * an entry's depth IS its exact minimum push count. Kept: no crate starting on a mark, the level's push range, every
 * crate pushed at least `perCrate` times in the stored minimum solution, the detour rule where the level asks for it,
 * the stored solution replayed. One crate is gold, chosen as on Normal (goldFor). Seeded per level (mulberry32), so
 * it rebuilds byte for byte.
 *
 *   bun scripts/push-levels-bank.ts [easy|hard|expert …] [--check]
 *
 * `--check` rebuilds and fails unless the file on disk is exactly what it would write (re-run
 * `bun scripts/push-par-data.ts` after a rebuild: the phone's par table holds every level board too).
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

import { PUSH_CELLS, PUSH_COLS as N, type SlideDir } from "../src/lib/duel/types";
import { LEVELS_PUSH, type PushLevelSettings } from "../src/lib/levels/pattern/push.levels";

export type PushLevelName = "easy" | "hard" | "expert";
export const PUSH_LEVEL_NAMES: readonly PushLevelName[] = ["easy", "hard", "expert"];
/** Boards per level. */
export const PUSH_LEVEL_BANK_SIZE: Record<PushLevelName, number> = { easy: 120, hard: 120, expert: 120 };
const SEEDS: Record<PushLevelName, number> = { easy: 0x9e_a5e1, hard: 0x9e_4a2d, expert: 0x9e_e8e7 };
/** How many backward states one layout may explore before it is abandoned (after a whole level). */
const NODE_CAP: Record<PushLevelName, number> = { easy: 200_000, hard: 1_500_000, expert: 2_500_000 };

let seedState = 0;
function rand(): number {
  seedState = (seedState + 0x6d2b79f5) >>> 0;
  let t = seedState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const DIRS: SlideDir[] = ["U", "D", "L", "R"];
const OPPOSITE = { U: "D", D: "U", L: "R", R: "L" } as Record<SlideDir, SlideDir>;

export interface PushLevelEntry {
  walls: number[];
  targets: number[];
  crates: number[];
  pusher: number;
  gold: { crate: number; target: number };
  minPushes: number;
  minMoves: number;
  detour: boolean;
  solution: string;
}

const row = (cell: number) => Math.floor(cell / N);
const col = (cell: number) => cell % N;
function step(cell: number, dir: SlideDir): number | null {
  if (dir === "U") return row(cell) > 0 ? cell - N : null;
  if (dir === "D") return row(cell) < N - 1 ? cell + N : null;
  if (dir === "L") return col(cell) > 0 ? cell - 1 : null;
  return col(cell) < N - 1 ? cell + 1 : null;
}
function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Every cell the pusher can walk to (crates block), as a bit array, plus its lowest cell. */
function region(walls: Uint8Array, crates: readonly number[], from: number, out: Uint8Array): number {
  out.fill(0);
  const blocked = new Uint8Array(PUSH_CELLS);
  for (const c of crates) blocked[c] = 1;
  out[from] = 1;
  let low = from;
  const stack = [from];
  while (stack.length) {
    const cell = stack.pop()!;
    for (const dir of DIRS) {
      const next = step(cell, dir);
      if (next === null || walls[next] || blocked[next] || out[next]) continue;
      out[next] = 1;
      if (next < low) low = next;
      stack.push(next);
    }
  }
  return low;
}

function walkDistance(walls: Uint8Array, crates: readonly number[], from: number, to: number): number | null {
  if (from === to) return 0;
  const blocked = new Set(crates);
  const seen = new Set<number>([from]);
  let frontier = [from];
  for (let depth = 1; depth <= PUSH_CELLS; depth++) {
    const next: number[] = [];
    for (const cell of frontier) {
      for (const dir of DIRS) {
        const ahead = step(cell, dir);
        if (ahead === null || walls[ahead] || blocked.has(ahead) || seen.has(ahead)) continue;
        if (ahead === to) return depth;
        seen.add(ahead);
        next.push(ahead);
      }
    }
    if (!next.length) return null;
    frontier = next;
  }
  return null;
}

interface Node {
  crates: number[];
  pusher: number;
  depth: number;
  push?: { cell: number; dir: SlideDir };
  parent?: string;
}

const keyOf = (crates: readonly number[], low: number) => `${[...crates].sort((a, b) => a - b).join(",")}|${low}`;

function backwardSearch(walls: Uint8Array, targets: number[], maxDepth: number, cap: number): Map<string, Node> {
  const nodes = new Map<string, Node>();
  const reach = new Uint8Array(PUSH_CELLS);
  const tmp = new Uint8Array(PUSH_CELLS);
  let frontier: string[] = [];
  for (let cell = 0; cell < PUSH_CELLS; cell++) {
    if (walls[cell] || targets.includes(cell)) continue;
    const low = region(walls, targets, cell, tmp);
    const id = keyOf(targets, low);
    if (nodes.has(id)) continue;
    nodes.set(id, { crates: [...targets], pusher: low, depth: 0 });
    frontier.push(id);
  }
  for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
    const next: string[] = [];
    for (const id of frontier) {
      const node = nodes.get(id)!;
      region(walls, node.crates, node.pusher, reach);
      for (let index = 0; index < node.crates.length; index++) {
        const crate = node.crates[index]!;
        for (const dir of DIRS) {
          const back = step(crate, OPPOSITE[dir]);
          if (back === null || walls[back] || node.crates.includes(back) || !reach[back]) continue;
          const pusherCell = step(back, OPPOSITE[dir]);
          if (pusherCell === null || walls[pusherCell]) continue;
          const crates = [...node.crates];
          crates[index] = back;
          if (crates.includes(pusherCell)) continue;
          const low = region(walls, crates, pusherCell, tmp);
          const preId = keyOf(crates, low);
          if (nodes.has(preId)) continue;
          nodes.set(preId, { crates, pusher: low, depth, push: { cell: back, dir }, parent: id });
          next.push(preId);
        }
      }
    }
    if (nodes.size > cap) return nodes;
    frontier = next;
  }
  return nodes;
}

function replaySolution(walls: Uint8Array, targets: number[], startCrates: number[], startPusher: number, solution: { cell: number; dir: SlideDir }[]) {
  let crates = [...startCrates];
  let pusher = startPusher;
  let moves = 0;
  for (const move of solution) {
    const index = crates.indexOf(move.cell);
    if (index === -1) return { ok: false, moves };
    const from = step(move.cell, OPPOSITE[move.dir]);
    const to = step(move.cell, move.dir);
    if (from === null || to === null || walls[from] || walls[to] || crates.includes(to)) return { ok: false, moves };
    const walk = walkDistance(walls, crates, pusher, from);
    if (walk === null) return { ok: false, moves };
    moves += walk + 1;
    crates = [...crates];
    crates[index] = to;
    pusher = move.cell;
  }
  return { ok: crates.length === targets.length && crates.every((cell) => targets.includes(cell)), moves };
}

const distance = (a: number, b: number) => Math.abs(row(a) - row(b)) + Math.abs(col(a) - col(b));

function finalsOf(crates: number[], solution: { cell: number; dir: SlideDir }[]) {
  const finals = [...crates];
  const counts = new Array<number>(crates.length).fill(0);
  for (const move of solution) {
    const index = finals.indexOf(move.cell);
    if (index === -1) return null;
    finals[index] = step(move.cell, move.dir)!;
    counts[index] = (counts[index] ?? 0) + 1;
  }
  return { finals, counts };
}

function hasDetour(crates: number[], solution: { cell: number; dir: SlideDir }[], finals: number[]): boolean {
  const now = [...crates];
  for (const move of solution) {
    const index = now.indexOf(move.cell);
    const to = step(move.cell, move.dir)!;
    if (distance(to, finals[index]!) > distance(move.cell, finals[index]!)) return true;
    now[index] = to;
  }
  return false;
}

/** As Normal's bank: a crate whose final mark isn't its nearest, else the crate pushed most; ties to the lowest index. */
function goldFor(crates: number[], targets: number[], finals: number[], counts: number[]) {
  const nearest = (c: number) => Math.min(...targets.map((t) => distance(c, t)));
  const tricky = crates.map((_c, i) => i).filter((i) => distance(crates[i]!, finals[i]!) > nearest(crates[i]!));
  const pool = tricky.length ? tricky : crates.map((_c, i) => i);
  const crate = pool.reduce((best, i) => (counts[i]! > counts[best]! ? i : best), pool[0]!);
  return { crate, target: finals[crate]! };
}

function randomLayout(s: PushLevelSettings) {
  const floor: number[] = [];
  for (let r = 1; r < N - 1; r++) for (let c = 1; c < N - 1; c++) floor.push(r * N + c);
  const wallCount = s.innerWalls.min + Math.floor(rand() * (s.innerWalls.max - s.innerWalls.min + 1));
  const walls = new Uint8Array(PUSH_CELLS);
  for (let cell = 0; cell < PUSH_CELLS; cell++) {
    if (row(cell) === 0 || col(cell) === 0 || row(cell) === N - 1 || col(cell) === N - 1) walls[cell] = 1;
  }
  for (const cell of shuffle(floor).slice(0, wallCount)) walls[cell] = 1;
  const open = floor.filter((cell) => !walls[cell]);
  const targets = shuffle(open).slice(0, s.crates);
  if (targets.length < s.crates) return null;
  return { walls, targets };
}

/**
 * Levels built in parallel streams (D4, 22 Nov 2026: Expert's seven crates take about 100 s a board): stream k of n is
 * seeded SEEDS[level] + k and builds its share; the bank is the streams' boards in stream order, duplicates dropped,
 * cut to the bank's size. Deterministic: --check rebuilds every stream the same way.
 */
export const PUSH_LEVEL_STREAMS: Partial<Record<PushLevelName, number>> = { expert: 4 };

/**
 * With PUSH_JOURNAL_DIR set (D4, 22 Nov 2026: a machine restart lost an hour of Expert boards), a build saves its whole
 * state (the generator's seed state, the layouts tried and the boards kept) at the start of every layout after a board
 * is kept, and at least every 10 layouts, and a restarted build carries on from it: the same boards in the same order as
 * one uninterrupted run (--check rebuilds without a journal).
 */
function journalOf(level: PushLevelName, stream: { k: number; n: number } | null): string | null {
  const dir = process.env["PUSH_JOURNAL_DIR"];
  return dir ? `${dir}/push-${level}${stream ? `-${stream.k}-of-${stream.n}` : ""}.json` : null;
}

export function buildPushLevel(level: PushLevelName, log = false, stream: { k: number; n: number } | null = null): PushLevelEntry[] {
  const s = LEVELS_PUSH.levels[level]!.settings;
  const size = stream ? Math.ceil(PUSH_LEVEL_BANK_SIZE[level] / stream.n) + 2 : PUSH_LEVEL_BANK_SIZE[level];
  seedState = (SEEDS[level] + (stream?.k ?? 0)) >>> 0;
  const bank: PushLevelEntry[] = [];
  const seen = new Set<string>();
  const perWalls = new Map<string, number>();
  const startedAt = Date.now();
  let guard = 0;
  const journal = journalOf(level, stream);
  if (journal && existsSync(journal)) {
    const saved = JSON.parse(readFileSync(journal, "utf8")) as { seedState: number; guard: number; bank: PushLevelEntry[] };
    seedState = saved.seedState >>> 0;
    guard = saved.guard;
    for (const e of saved.bank) {
      bank.push(e);
      const wallKey = e.walls.join(".");
      seen.add(`${wallKey}/${e.targets.join(".")}/${e.crates.join(".")}/${e.pusher}`);
      perWalls.set(wallKey, (perWalls.get(wallKey) ?? 0) + 1);
    }
    if (log) console.log(`  ${level}: resuming at ${guard} layouts, ${bank.length} boards (${journal})`);
  }
  let savedLen = bank.length;
  let savedGuard = guard;
  while (bank.length < size && guard < 200_000) {
    if (journal && (bank.length !== savedLen || guard - savedGuard >= 10)) {
      writeFileSync(`${journal}.tmp`, JSON.stringify({ seedState, guard, bank }));
      renameSync(`${journal}.tmp`, journal);
      savedLen = bank.length;
      savedGuard = guard;
    }
    guard += 1;
    const layout = randomLayout(s);
    if (!layout) continue;
    if (log && guard % 25 === 0) console.log(`  ${level} … ${guard} layouts, ${bank.length} boards (${Math.round((Date.now() - startedAt) / 1000)}s)`);
    const { walls, targets } = layout;
    const nodes = backwardSearch(walls, targets, s.pushes.max, NODE_CAP[level]);
    const candidates = shuffle([...nodes.entries()].filter(([, n]) => n.depth >= s.pushes.min && n.depth <= s.pushes.max)).slice(0, 40);
    for (const [id, node] of candidates) {
      if (bank.length >= size) break;
      if (node.crates.some((cell) => targets.includes(cell)) || node.crates.includes(node.pusher)) continue;
      const solution: { cell: number; dir: SlideDir }[] = [];
      let cursor: string | undefined = id;
      while (cursor) {
        const current: Node | undefined = nodes.get(cursor);
        if (!current?.push) break;
        solution.push(current.push);
        cursor = current.parent;
      }
      if (solution.length !== node.depth) continue;
      const crates = [...node.crates].sort((a, b) => a - b);
      const fc = finalsOf(crates, solution);
      if (!fc || fc.counts.some((n) => n < s.perCrate)) continue;
      if (s.detour && !hasDetour(crates, solution, fc.finals)) continue;
      const replay = replaySolution(walls, targets, crates, node.pusher, solution);
      if (!replay.ok) continue;
      const wallList: number[] = [];
      walls.forEach((w, cell) => w && wallList.push(cell));
      const wallKey = wallList.join(".");
      const fingerprint = `${wallKey}/${[...targets].sort((a, b) => a - b).join(".")}/${crates.join(".")}/${node.pusher}`;
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      bank.push({
        walls: wallList,
        targets: [...targets].sort((a, b) => a - b),
        crates,
        pusher: node.pusher,
        gold: goldFor(crates, targets, fc.finals, fc.counts),
        minPushes: node.depth,
        minMoves: replay.moves,
        detour: hasDetour(crates, solution, fc.finals),
        solution: solution.map((m) => `${m.cell}:${m.dir}`).join(","),
      });
      if (log && bank.length % 10 === 0) console.log(`  ${level} ${bank.length} / ${size}  (${Math.round((Date.now() - startedAt) / 1000)}s, ${guard} layouts)`);
      // Two entries per layout at most, so the bank stays varied.
      const used = (perWalls.get(wallKey) ?? 0) + 1;
      perWalls.set(wallKey, used);
      if (used >= 2) break;
    }
  }
  if (bank.length < size) throw new Error(`push ${level}: only ${bank.length} of ${size} layouts`);
  return bank;
}

export function pushLevelBankSource(banks: Record<PushLevelName, PushLevelEntry[]>): string {
  const entry = (e: PushLevelEntry) =>
    `    { walls: [${e.walls.join(",")}], targets: [${e.targets.join(",")}], crates: [${e.crates.join(",")}], pusher: ${e.pusher}, gold: { crate: ${e.gold.crate}, target: ${e.gold.target} }, minPushes: ${e.minPushes}, minMoves: ${e.minMoves}, detour: ${e.detour}, solution: "${e.solution}" },`;
  const block = (level: PushLevelName) => `  ${level}: [\n${banks[level].map(entry).join("\n")}\n  ],`;
  return `/**
 * Heave's level banks (the Pattern overhaul, stage 3; src/lib/levels/pattern/push.levels.ts). Generated by
 * scripts/push-levels-bank.ts (seeded): every entry was grown backwards from its solved position, so its depth is the
 * exact minimum push count (\`minPushes\`); one crate is gold (\`gold.crate\` indexes \`crates\`), its mark where the
 * stored minimum solution leaves it. Do not edit by hand.
 */
export interface PushLevelEntry {
  walls: number[];
  targets: number[];
  crates: number[];
  pusher: number;
  gold: { crate: number; target: number };
  minPushes: number;
  minMoves: number;
  detour: boolean;
  solution: string;
}

export const PUSH_LEVEL_BANK: Record<"easy" | "hard" | "expert", PushLevelEntry[]> = {
${PUSH_LEVEL_NAMES.map(block).join("\n")}
};
`;
}

export const PUSH_LEVEL_BANK_PATH = new URL("../src/lib/duel/pushLevelBank.server.ts", import.meta.url);

/** A level built as PUSH_LEVEL_STREAMS streams, each in its own process (`--stream=level/k/n`), merged in order. */
async function buildStreamed(level: PushLevelName, n: number): Promise<PushLevelEntry[]> {
  const outputs = await Promise.all(
    Array.from({ length: n }, async (_, k) => {
      const child = Bun.spawn(["bun", import.meta.path, `--stream=${level}/${k}/${n}`], { stdout: "pipe", stderr: "inherit" });
      const text = await new Response(child.stdout).text();
      if ((await child.exited) !== 0) throw new Error(`push ${level} stream ${k} failed`);
      return JSON.parse(text) as PushLevelEntry[];
    }),
  );
  const seen = new Set<string>();
  const bank: PushLevelEntry[] = [];
  for (const list of outputs)
    for (const e of list) {
      const key = `${e.walls.join(".")}/${e.targets.join(".")}/${e.crates.join(".")}/${e.pusher}`;
      if (seen.has(key)) continue;
      seen.add(key);
      bank.push(e);
    }
  if (bank.length < PUSH_LEVEL_BANK_SIZE[level]) throw new Error(`push ${level}: only ${bank.length} boards from ${n} streams`);
  return bank.slice(0, PUSH_LEVEL_BANK_SIZE[level]);
}

const streamArg = process.argv.find((a) => a.startsWith("--stream="));
if (import.meta.main && streamArg) {
  const [level, k, n] = streamArg.slice("--stream=".length).split("/") as [PushLevelName, string, string];
  process.stdout.write(JSON.stringify(buildPushLevel(level, false, { k: Number(k), n: Number(n) })));
  process.exit(0);
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  const asked = process.argv.slice(2).filter((a) => (PUSH_LEVEL_NAMES as readonly string[]).includes(a)) as PushLevelName[];
  const only = asked.length ? asked : PUSH_LEVEL_NAMES;
  let current: Record<PushLevelName, PushLevelEntry[]> | null = null;
  try {
    current = (await import("../src/lib/duel/pushLevelBank.server")).PUSH_LEVEL_BANK;
  } catch {
    current = null;
  }
  const banks = { easy: [], hard: [], expert: [], ...(current ?? {}) } as Record<PushLevelName, PushLevelEntry[]>;
  for (const level of only) {
    const t = Date.now();
    const streams = PUSH_LEVEL_STREAMS[level];
    banks[level] = streams ? await buildStreamed(level, streams) : buildPushLevel(level, !check);
    const mins = banks[level].map((e) => e.minPushes);
    console.log(`push ${level}: ${banks[level].length} boards, minimum pushes ${Math.min(...mins)}–${Math.max(...mins)} (${Math.round((Date.now() - t) / 1000)} s)`);
    // Each finished level is written at once (D4: a restart while a later level builds keeps it).
    if (!check) writeFileSync(PUSH_LEVEL_BANK_PATH, pushLevelBankSource(banks));
  }
  const text = pushLevelBankSource(banks);
  if (check) {
    const ok = readFileSync(PUSH_LEVEL_BANK_PATH, "utf8") === text;
    console.log(ok ? "push-levels-bank: rebuilt byte for byte" : "push-levels-bank: FAIL, the rebuilt bank differs");
    process.exit(ok ? 0 : 1);
  }
  writeFileSync(PUSH_LEVEL_BANK_PATH, text);
}
