/**
 * Builds the Word Search bank in src/lib/duel/wordSearchBank.server.ts from the
 * editable categories in src/lib/duel/wordSearchWords.ts.
 *
 *   bun scripts/word-search-bank.ts           rebuild the bank
 *   bun scripts/word-search-bank.ts --check   prove the committed bank is current (writes nothing)
 *
 * Each puzzle: one category, six words of mixed length, placed in any of eight
 * directions (crossings only on matching letters), the rest filled with
 * letters weighted to English frequency. Every target word must appear in the
 * finished grid exactly once (all eight directions scanned), no other word of the
 * same category may appear anywhere (so a player never drags a real category word
 * that does not count), and no blocked word may appear at all.
 *
 * Since 14 Oct 2026 (wordSearchRev 1): seeded (mulberry32), so a rebuild is byte-for-byte;
 * categories are dealt round-robin, PER_CATEGORY grids each, so every theme is equally likely.
 * Stored rounds keep their own grid and placements and never read the bank.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { WORD_SEARCH_CATEGORIES } from "../src/lib/duel/wordSearchWords";
import { PROFANITY_WORDS } from "../src/lib/duel/profanity.server";
import { isWord } from "../src/lib/duel/dictionary.server";
import { WS_SIZE as N, WS_WORDS } from "../src/lib/duel/wordSearch";

export const PER_CATEGORY = 20;
export const MIN_CATEGORIES = 70;
export const MIN_WORDS = 38;
const SEED = 0x5eed_2026;
const PROPER_NOUN_CATEGORIES = new Set(["Countries", "Cities"]);
const DIRS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [-1, 1],
  [0, -1],
  [-1, 0],
  [-1, -1],
  [1, -1],
] as const;
const FREQ =
  "E12.7 T9.1 A8.2 O7.5 I7.0 N6.7 S6.3 H6.1 R6.0 D4.3 L4.0 C2.8 U2.8 M2.4 W2.4 F2.2 G2.0 Y2.0 P1.9 B1.5 V1.0 K0.8 J0.2 X0.2 Q0.1 Z0.1"
    .split(" ")
    .map((p) => [p[0]!, Number(p.slice(1))] as const);
const FREQ_TOTAL = FREQ.reduce((n, [, w]) => n + w, 0);
const BLOCKED = PROFANITY_WORDS.map((w) => w.toUpperCase()).filter((w) => /^[A-Z]{3,}$/.test(w));

// ---- Validate the editable word lists ----
const cats = Object.entries(WORD_SEARCH_CATEGORIES);
export function validateCategories(): string[] {
  const problems: string[] = [];
  if (cats.length < MIN_CATEGORIES)
    problems.push(`only ${cats.length} categories (need ${MIN_CATEGORIES})`);
  const owner = new Map<string, string>();
  for (const [cat, words] of cats) {
    if (words.length < MIN_WORDS)
      problems.push(`${cat}: only ${words.length} words (need ${MIN_WORDS})`);
    const short = words.filter((w) => w.length <= 5).length;
    const long = words.filter((w) => w.length >= 7).length;
    if (short < 4 || long < 4)
      problems.push(`${cat}: needs 4+ short and 4+ long words (has ${short} / ${long})`);
    for (const w of words) {
      if (!/^[A-Z]{4,8}$/.test(w)) problems.push(`${cat}: bad word ${w}`);
      if (w === [...w].reverse().join("")) problems.push(`${cat}: palindrome ${w}`);
      if (!PROPER_NOUN_CATEGORIES.has(cat) && !isWord(w))
        problems.push(`${cat}: ${w} is not in the dictionary`);
      const bad = BLOCKED.find((b) => w.includes(b));
      if (bad) problems.push(`${cat}: ${w} contains a blocked word`);
      const prev = owner.get(w);
      if (prev) problems.push(`${w} in both ${prev} and ${cat}`);
      owner.set(w, cat);
    }
  }
  for (const [w, cat] of owner) {
    for (const plural of [`${w}S`, `${w}ES`]) {
      const other = owner.get(plural);
      if (other) problems.push(`${plural} (${other}) is ${w} (${cat}) plus S/ES`);
    }
  }
  return problems;
}

// ---- Seeded build ----
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
let random = mulberry32(SEED);
const rand = (n: number) => Math.floor(random() * n);
function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
function freqLetter(): string {
  let x = random() * FREQ_TOTAL;
  for (const [l, w] of FREQ) if ((x -= w) <= 0) return l;
  return "E";
}
export function countInGrid(grid: readonly string[], word: string, size = N): number {
  let n = 0;
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      for (const [dr, dc] of DIRS) {
        let ok = true;
        for (let i = 0; i < word.length && ok; i++) {
          const rr = r + dr * i,
            cc = c + dc * i;
          ok = rr >= 0 && rr < size && cc >= 0 && cc < size && grid[rr * size + cc] === word[i];
        }
        if (ok) n++;
      }
  return n;
}

function pickWords(words: string[]): string[] | null {
  // Mixed length: at least two short (4–5), at least two long (7–8).
  for (let t = 0; t < 50; t++) {
    const pick = shuffle([...words]).slice(0, WS_WORDS);
    const short = pick.filter((w) => w.length <= 5).length;
    const long = pick.filter((w) => w.length >= 7).length;
    // No word inside another (it would show up twice).
    const nested = pick.some((a) =>
      pick.some((b) => a !== b && (b.includes(a) || b.includes([...a].reverse().join("")))),
    );
    if (short >= 2 && long >= 2 && !nested) return pick;
  }
  return null;
}

type Entry = { grid: string; category: string; placements: { word: string; cells: number[] }[] };

function build(category: string, words: string[]): Entry | null {
  const chosen = pickWords(words);
  if (!chosen) return null;
  const grid: string[] = new Array(N * N).fill("");
  const placements: { word: string; cells: number[] }[] = [];
  const dirsUsed = new Set<number>();
  for (const word of [...chosen].sort((a, b) => b.length - a.length)) {
    let placed = false;
    for (let t = 0; t < 300 && !placed; t++) {
      // Prefer directions not used yet so grids mix all eight.
      const free = [...DIRS.keys()].filter((d) => !dirsUsed.has(d));
      const di = t < 100 && free.length ? free[rand(free.length)]! : rand(8);
      const [dr, dc] = DIRS[di]!;
      const r0 = rand(N),
        c0 = rand(N);
      const cells: number[] = [];
      let ok = true;
      for (let i = 0; i < word.length && ok; i++) {
        const r = r0 + dr * i,
          c = c0 + dc * i;
        if (r < 0 || r >= N || c < 0 || c >= N) ok = false;
        else {
          const cell = r * N + c;
          if (grid[cell] && grid[cell] !== word[i]) ok = false;
          cells.push(cell);
        }
      }
      if (!ok) continue;
      // At most one shared cell with earlier words.
      const shared = cells.filter((cell) => grid[cell]).length;
      if (shared > 1) continue;
      cells.forEach((cell, i) => (grid[cell] = word[i]!));
      placements.push({ word, cells });
      dirsUsed.add(di);
      placed = true;
    }
    if (!placed) return null;
  }
  for (let i = 0; i < grid.length; i++) if (!grid[i]) grid[i] = freqLetter();
  for (const p of placements) if (countInGrid(grid, p.word) !== 1) return null;
  for (const other of words)
    if (!chosen.includes(other) && countInGrid(grid, other) > 0) return null;
  for (const bad of BLOCKED) if (countInGrid(grid, bad) > 0) return null;
  // Keep placements in a stable order (the order words were chosen).
  placements.sort((a, b) => chosen.indexOf(a.word) - chosen.indexOf(b.word));
  return { grid: grid.join(""), category, placements };
}

export function buildBank(): { bank: Entry[]; attempts: number } {
  random = mulberry32(SEED);
  const bank: Entry[] = [];
  let attempts = 0;
  for (let round = 0; round < PER_CATEGORY; round++) {
    for (const [category, words] of cats) {
      for (;;) {
        attempts++;
        const p = build(category, words);
        if (p) {
          bank.push(p);
          break;
        }
      }
    }
  }
  // Independent re-check of the whole bank.
  for (const p of bank) {
    const g = p.grid.split("");
    for (const pl of p.placements) {
      if (countInGrid(g, pl.word) !== 1) throw new Error(`duplicate ${pl.word}`);
      if (pl.cells.map((c) => g[c]).join("") !== pl.word) throw new Error(`mismatch ${pl.word}`);
    }
  }
  return { bank, attempts };
}

export function bankSource(bank: Entry[]): string {
  return `/**
 * Word Search bank — generated by scripts/word-search-bank.ts from
 * wordSearchWords.ts (seeded; \`bun scripts/word-search-bank.ts --check\` proves it current).
 * Every target word appears in its grid exactly once and no other word of the
 * category appears. Do not edit by hand; edit the word lists and re-run the script.
 * Stored rounds keep their own grids: nothing grades by bank index.
 */

export interface WordSearchBankEntry {
  grid: string;
  category: string;
  placements: { word: string; cells: number[] }[];
}

export const WORD_SEARCH_BANK: WordSearchBankEntry[] = [
${bank.map((e) => JSON.stringify(e)).join(",\n")},
];
`;
}

if (import.meta.main) {
  const problems = validateCategories();
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  const { bank, attempts } = buildBank();
  const out = bankSource(bank);
  const target = new URL("../src/lib/duel/wordSearchBank.server.ts", import.meta.url);
  const words = cats.reduce((n, [, w]) => n + w.length, 0);
  if (process.argv.includes("--check")) {
    const same = readFileSync(target, "utf8") === out;
    console.log(
      `word search bank ${same ? "is current" : "is STALE"}: ${bank.length} puzzles · ${cats.length} categories · ${words} words`,
    );
    process.exit(same ? 0 : 1);
  }
  writeFileSync(target, out);
  console.log(
    `word search bank: ${bank.length} puzzles from ${attempts} attempts · ${cats.length} categories · ${words} words`,
  );
}
