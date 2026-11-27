/**
 * Builds Interlock's level banks (D1, 21 Nov 2026; difficulty-spec.md "Interlock") in
 * src/lib/duel/tilegridLevelBank.server.ts, from the level settings (src/lib/levels/word/tilegrid.ts: board side, tile
 * count and the crossing words' lengths).
 *
 *   bun scripts/tilegrid-level-bank.ts           rebuild the banks
 *   bun scripts/tilegrid-level-bank.ts --check   prove the committed banks are current (writes nothing)
 *
 * Each board: the level's words (everyday 5–6 letter words, the common-words list) laid as a crossword on the level's
 * board, each new word through one letter already down, every run a real word, exactly the level's tile count. Kept only
 * when the person-like builder (scripts/tilegrid-human.ts: never sees the board, longest everyday words first, one-step
 * take-backs) finishes its tray, every tile move timed at the human limits (0.25 s to react, 0.15 s a tap: tap the tile,
 * tap its cell) and Done inside the clock; on Expert only where that line also lands inside the full-speed time (33 s)
 * with big words as long as the board's own, so it scores 200 (tilegrid-levels-proof-check grades every dealt board
 * through the server's grader to prove it). Seeded (mulberry32, one seed a level), so a rebuild is byte for byte.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { commonWords, isWord } from "../src/lib/duel/dictionary.server";
import { encodeTileGrid, tileGridRuns } from "../src/lib/duel/tileGrid";
import { tileGridValid } from "../src/lib/duel/tileGrid.server";
import { interlockBigWordPoints } from "../src/lib/duel/standard/word";
import { STD_INTERLOCK } from "../src/lib/duel/standard/word";
import { TILEGRID_LEVEL_SETTINGS } from "../src/lib/levels/word/tilegrid";
import { buildTileGridLikeAPerson } from "./tilegrid-human";
import { tilegridMoveTimes } from "./word-human-solvers";

export const TILEGRID_BANK_SIZE = 150;
const LEVEL_SEEDS = { easy: 0x7e11_e45e, hard: 0x7e11_4a2d, expert: 0x7e11_e8e7 } as const;
export type TgLevel = keyof typeof LEVEL_SEEDS;
export const TG_LEVELS: readonly TgLevel[] = ["easy", "hard", "expert"];

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POOL = [...new Set(commonWords().filter((w) => (w.length === 5 || w.length === 6) && /^[a-z]+$/.test(w) && isWord(w)))]
  .map((w) => w.toUpperCase())
  .sort();

/** Big-word points of a grid's real runs of 5+ letters, uncapped (the grader's own table). */
export function bigWordSum(cells: string[]): number {
  return tileGridRuns(cells)
    .filter((r) => r.word.length >= 5 && isWord(r.word))
    .reduce((sum, r) => sum + interlockBigWordPoints(r.word.length), 0);
}

/** One board of the level's words on its side, every run real, exactly `tiles` tiles; null after 200 tries. */
export function buildBoard(rand: () => number, size: number, lengths: readonly number[], tiles: number): string[] | null {
  const pick = <T,>(a: readonly T[]): T | undefined => (a.length ? a[Math.floor(rand() * a.length)] : undefined);
  for (let attempt = 0; attempt < 200; attempt++) {
    const cells = Array.from({ length: size * size }, () => "");
    const order = [...lengths];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    const used = new Set<string>();
    const first = pick(POOL.filter((w) => w.length === order[0]))!;
    const r0 = Math.floor(rand() * size);
    const c0 = Math.floor(rand() * (size - first.length + 1));
    for (let i = 0; i < first.length; i++) cells[r0 * size + c0 + i] = first[i]!;
    used.add(first);
    let ok = true;
    for (const len of order.slice(1)) {
      let placed = false;
      for (let t = 0; t < 300 && !placed; t++) {
        const filled = cells.map((l, i) => (l ? i : -1)).filter((i) => i >= 0);
        const cell = pick(filled)!;
        const w = pick(POOL.filter((x) => x.length === len && !used.has(x) && x.includes(cells[cell]!)));
        if (!w) continue;
        const j = pick([...w].map((l, k) => (l === cells[cell] ? k : -1)).filter((k) => k >= 0))!;
        for (const across of rand() < 0.5 ? [true, false] : [false, true]) {
          const rr = across ? Math.floor(cell / size) : Math.floor(cell / size) - j;
          const cc = across ? (cell % size) - j : cell % size;
          const dr = across ? 0 : 1;
          const dc = across ? 1 : 0;
          if (rr < 0 || cc < 0 || rr + dr * (len - 1) >= size || cc + dc * (len - 1) >= size) continue;
          const next = [...cells];
          let bad = false;
          for (let i = 0; i < len; i++) {
            const k = (rr + dr * i) * size + cc + dc * i;
            if (next[k] && next[k] !== w[i]) {
              bad = true;
              break;
            }
            next[k] = w[i]!;
          }
          if (bad || !tileGridValid(next)) continue;
          cells.splice(0, cells.length, ...next);
          used.add(w);
          placed = true;
          break;
        }
      }
      if (!placed) {
        ok = false;
        break;
      }
    }
    // Exactly the level's words: no run merged into a longer word, no extra crossing.
    const runs = tileGridRuns(cells).map((r) => r.word.length).sort().join();
    if (ok && cells.filter(Boolean).length === tiles && tileGridValid(cells) && runs === [...lengths].sort().join()) return cells;
  }
  return null;
}

/** Whether the builder's line keeps the board: Done inside the clock; on Expert a 200 (full speed, full big words). */
export function keeps(level: TgLevel, cells: string[]): { keep: boolean; doneMs: number; solved: boolean } {
  const s = TILEGRID_LEVEL_SETTINGS[level];
  const tray = cells.filter(Boolean).sort();
  const result = buildTileGridLikeAPerson(tray, s.size);
  const { doneMs } = tilegridMoveTimes(result);
  if (!result.solved || doneMs > s.timeLimitMs) return { keep: false, doneMs, solved: result.solved };
  if (level !== "expert") return { keep: true, doneMs, solved: true };
  const fullSpeed = doneMs <= STD_INTERLOCK.fullByS * 1000;
  return { keep: fullSpeed && bigWordSum(result.cells) >= bigWordSum(cells), doneMs, solved: true };
}

export function buildBank(level: TgLevel): { bank: string[]; tries: number } {
  const s = TILEGRID_LEVEL_SETTINGS[level];
  const rand = mulberry32(LEVEL_SEEDS[level]);
  const bank: string[] = [];
  const seen = new Set<string>();
  let tries = 0;
  while (bank.length < TILEGRID_BANK_SIZE && tries < TILEGRID_BANK_SIZE * 20) {
    tries++;
    const cells = buildBoard(rand, s.size, s.lengths, s.tiles);
    if (!cells) continue;
    const key = encodeTileGrid(cells, s.size);
    const rack = cells.filter(Boolean).sort().join("");
    if (seen.has(rack) || !keeps(level, cells).keep) continue;
    seen.add(rack);
    bank.push(key);
  }
  return { bank, tries };
}

const TARGET = new URL("../src/lib/duel/tilegridLevelBank.server.ts", import.meta.url).pathname;

function render(banks: Record<TgLevel, string[]>): string {
  const body = TG_LEVELS.map((l) => `  ${l}: [\n${banks[l].map((e) => `    "${e}",`).join("\n")}\n  ],`).join("\n");
  return `/**
 * Interlock's level banks (D1, 21 Nov 2026; src/lib/levels/word/tilegrid.ts) — generated by
 * scripts/tilegrid-level-bank.ts. Do not edit by hand. Server-only. Each entry is a board's solution, its level's side
 * squared cells row by row ("." empty); the tray is its letters, shuffled by the deal.
 */
export const TILEGRID_LEVEL_BANK: Readonly<Record<"easy" | "hard" | "expert", readonly string[]>> = {
${body}
};
`;
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  const banks = {} as Record<TgLevel, string[]>;
  for (const level of TG_LEVELS) {
    const t0 = Date.now();
    const { bank, tries } = buildBank(level);
    banks[level] = bank;
    console.log(`interlock ${level}: ${bank.length} boards from ${tries} built (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  const text = render(banks);
  if (check) {
    const ok = readFileSync(TARGET, "utf8") === text;
    console.log(ok ? `ok: ${TARGET} rebuilds byte for byte` : `FAIL: ${TARGET} differs from a rebuild`);
    process.exit(ok ? 0 : 1);
  }
  writeFileSync(TARGET, text);
  console.log(`wrote ${TARGET}`);
}
