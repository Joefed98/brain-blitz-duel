/**
 * Builds Topsy-Turvy's level banks (the difficulty levels, 16 Nov 2026; src/lib/levels/pattern/gravity.levels.ts):
 * Easy, Hard and Expert boards, each from its level's settings (balls, the fewest tilts, blocks). Normal keeps its
 * live generator (topsy.server.ts generateTopsy).
 *
 * Seeded and rebuildable byte for byte: entry i of a level is the first board built from the seed stream
 * (level, i, attempt 0, 1, …) that (1) drops no ball on the very first tilt, (2) has its fewest tilts to get every ball
 * home inside the level's range, found by breadth-first search over every ball's square (topsy.server.ts
 * `topsySearch`, a ball home blocking, as gravityRev 4+ plays) within SEARCH_CAP states, and (3) is not an earlier
 * entry's board, and (4) on Expert (`personSolvable`) the person-like solver (scripts/topsy-human.ts) clears it within
 * its tilt limit. The board is drawn as the live generator draws one (balls and blocks on random squares, a random
 * walk of tilts, each ball's cup on a square it rolled through in the walk's second half), then solved exactly: the
 * stored minimum is the true fewest and the stored route one shortest route.
 *
 *   bun scripts/topsy-levels-bank.ts            rebuild and write src/lib/duel/topsyLevelsBank.server.ts
 *   bun scripts/topsy-levels-bank.ts --check    rebuild and compare with the file, writing nothing
 *   bun scripts/topsy-levels-bank.ts --level=expert --count=5   a quick trial (prints, writes nothing)
 *
 * About 30 s on one core for all three levels.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { LEVELS_GRAVITY, type TopsyLevelSettings } from "../src/lib/levels/pattern/gravity.levels";
import { saltSeed, seededRng, type SeededRng } from "../src/lib/duel/seededRng";
import { TOPSY_CELLS, topsyStart, topsyTilt, type TopsyBoard } from "../src/lib/duel/topsy";
import { topsySearch } from "../src/lib/duel/topsy.server";
import type { GravityDir } from "../src/lib/duel/types";
import { humanBoard } from "./topsy-human";

export const BANK_FILE = "src/lib/duel/topsyLevelsBank.server.ts";
/** The boards each level's bank holds (a round draws two or three). */
export const BANK_SIZE = 240;
export const BANK_LEVELS = ["easy", "hard", "expert"] as const;
export type BankLevel = (typeof BANK_LEVELS)[number];
/** The search's state cap. Part of the seed stream's rules: changing it can change boards. */
export const SEARCH_CAP = 400_000;
const MAX_ATTEMPTS = 100_000;
const DIRS: GravityDir[] = ["U", "D", "L", "R"];

export function settingsOf(level: BankLevel): TopsyLevelSettings {
  return LEVELS_GRAVITY.levels[level]!.settings;
}

export interface BankBoard {
  board: TopsyBoard;
  min: number;
  route: string;
}

/** One attempt from the stream, or null (rejected). */
function attempt(rng: SeededRng, s: TopsyLevelSettings): BankBoard | null {
  const [lo, hi] = s.minTilts;
  const cells = rng.shuffle(Array.from({ length: TOPSY_CELLS }, (_, c) => c));
  const starts = cells.slice(0, s.balls);
  const wallCount = rng.int(s.walls[0], s.walls[1]);
  const walls = cells.slice(s.balls, s.balls + wallCount).sort((a, b) => a - b);
  const wallSet = new Set(walls);
  const walkLength = rng.int(lo + 1, hi);
  const open: TopsyBoard = { walls, starts, holes: starts.map(() => -2), stars: [], homeBlocks: true };
  let state = topsyStart(open);
  const late: number[][] = starts.map(() => []);
  let last: GravityDir | null = null;
  for (let step = 0; step < walkLength; step++) {
    let out = null;
    for (const dir of rng.shuffle(DIRS.filter((d) => d !== last))) {
      const tried = topsyTilt(open, wallSet, state, dir);
      if (tried.moved) {
        out = tried;
        last = dir;
        break;
      }
    }
    if (!out) return null;
    if (step >= Math.floor(walkLength / 2)) out.paths.forEach((path, i) => late[i]!.push(...path.slice(1)));
    state = out.state;
  }
  const used = new Set([...starts, ...walls]);
  const holes: number[] = [];
  for (let i = 0; i < s.balls; i++) {
    const options = late[i]!.filter((c) => !used.has(c));
    if (!options.length) return null;
    const hole = rng.pick(options);
    holes.push(hole);
    used.add(hole);
  }
  const board: TopsyBoard = { walls, starts, holes, stars: [], homeBlocks: true };
  for (const dir of DIRS) if (topsyTilt(board, wallSet, topsyStart(board), dir).dropped.length) return null;
  const found = topsySearch(board, false, hi, SEARCH_CAP);
  if (!found || found.min < lo) return null;
  // Expert (settings.personSolvable): kept only when the person-like solver (scripts/topsy-human.ts: each ball's own
  // line, three tilts imagined ahead, no search) clears it within its tilt limit.
  if (s.personSolvable && !humanBoard(board, found.min + s.spare).cleared) return null;
  return { board, min: found.min, route: found.solution.join("") };
}

export const boardKey = (b: TopsyBoard) => `${b.walls.join(".")}|${b.starts.join(".")}|${b.holes.join(".")}`;

/** Entry i of a level, given the keys of the entries before it. */
export function buildEntry(level: BankLevel, i: number, taken: ReadonlySet<string> = new Set()): BankBoard {
  const s = settingsOf(level);
  for (let a = 0; a < MAX_ATTEMPTS; a++) {
    const made = attempt(seededRng(saltSeed(i * MAX_ATTEMPTS + a, `topsy-levels:${level}`)), s);
    if (made && !taken.has(boardKey(made.board))) return made;
  }
  throw new Error(`${level} ${i}: no board in ${MAX_ATTEMPTS} attempts`);
}

/** The stored line: "blocks|starts|cups|fewest tilts|one shortest route" (squares 0–99, row by row). */
export function encodeEntry(e: BankBoard): string {
  return `${boardKey(e.board)}|${e.min}|${e.route}`;
}

export function buildLevel(level: BankLevel, count = BANK_SIZE): string[] {
  const taken = new Set<string>();
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const e = buildEntry(level, i, taken);
    taken.add(boardKey(e.board));
    out.push(encodeEntry(e));
  }
  return out;
}

function describe(level: BankLevel): string {
  const s = settingsOf(level);
  return `${level}: ${s.balls} balls, ${s.minTilts[0]}–${s.minTilts[1]} tilts at the fewest, ${s.walls[0]}–${s.walls[1]} blocks.`;
}

export function bankSource(banks: Record<BankLevel, string[]>): string {
  const lines = [
    "/**",
    " * Topsy-Turvy's level banks (the difficulty levels, 16 Nov 2026) — generated by scripts/topsy-levels-bank.ts from the",
    " * settings in src/lib/levels/pattern/gravity.levels.ts; rebuilt byte for byte with `--check`. Each entry is",
    ' * "blocks|starts|cups|fewest tilts|one shortest route" (squares 0–99 row by row, balls in colour order), the fewest',
    " * tilts proved by breadth-first search over every ball's square. Normal deals from the live generator as before.",
    " */",
    "",
    'export const TOPSY_LEVEL_BANK: Record<"easy" | "hard" | "expert", readonly string[]> = {',
  ];
  for (const level of BANK_LEVELS) {
    lines.push(`  // ${describe(level)}`);
    lines.push(`  ${level}: [`);
    for (const e of banks[level]) lines.push(`    ${JSON.stringify(e)},`);
    lines.push("  ],");
  }
  lines.push("};", "");
  return lines.join("\n");
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const arg = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
  const only = arg("level") as BankLevel | undefined;
  const count = arg("count");
  if (only && count) {
    const t0 = performance.now();
    for (const line of buildLevel(only, Number(count))) console.log(line);
    console.log(`${((performance.now() - t0) / 1000).toFixed(1)} s`);
  } else {
    const t0 = performance.now();
    const banks = Object.fromEntries(BANK_LEVELS.map((l) => [l, buildLevel(l)])) as Record<BankLevel, string[]>;
    const source = bankSource(banks);
    if (args.includes("--check")) {
      const ok = readFileSync(BANK_FILE, "utf8") === source;
      console.log(ok ? `${BANK_FILE}: rebuilt byte for byte (${((performance.now() - t0) / 1000).toFixed(1)} s)` : `${BANK_FILE}: FAIL, the rebuild differs`);
      if (!ok) process.exit(1);
    } else {
      writeFileSync(BANK_FILE, source);
      console.log(`wrote ${BANK_FILE} (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
    }
  }
}
