/**
 * Builds the Word Search bank in src/lib/duel/wordSearchBank.server.ts from the
 * editable categories in src/lib/duel/wordSearchWords.ts.
 *
 *   bun scripts/word-search-bank.ts
 *
 * Each puzzle: one category, six words of mixed length, placed in any of eight
 * directions (crossings only on matching letters), the rest filled with
 * letters weighted to English frequency. Every target word must appear in the
 * finished grid exactly once (all eight directions scanned), and no blocked
 * word may appear at all.
 */
import { writeFileSync } from "node:fs";

import { WORD_SEARCH_CATEGORIES } from "../src/lib/duel/wordSearchWords";
import { PROFANITY_WORDS } from "../src/lib/duel/profanity.server";
import { WS_SIZE as N, WS_WORDS } from "../src/lib/duel/wordSearch";

const BANK = 500;
const DIRS = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]] as const;
const FREQ = "E12.7 T9.1 A8.2 O7.5 I7.0 N6.7 S6.3 H6.1 R6.0 D4.3 L4.0 C2.8 U2.8 M2.4 W2.4 F2.2 G2.0 Y2.0 P1.9 B1.5 V1.0 K0.8 J0.2 X0.2 Q0.1 Z0.1"
  .split(" ").map((p) => [p[0]!, Number(p.slice(1))] as const);
const FREQ_TOTAL = FREQ.reduce((n, [, w]) => n + w, 0);

// ---- Validate the editable word lists ----
const cats = Object.entries(WORD_SEARCH_CATEGORIES);
const problems: string[] = [];
if (cats.length < 25) problems.push(`only ${cats.length} categories`);
const owner = new Map<string, string>();
for (const [cat, words] of cats) {
  if (words.length < 30) problems.push(`${cat}: only ${words.length} words`);
  for (const w of words) {
    if (!/^[A-Z]{4,8}$/.test(w)) problems.push(`${cat}: bad word ${w}`);
    if (w === [...w].reverse().join("")) problems.push(`${cat}: palindrome ${w}`);
    const prev = owner.get(w);
    if (prev) problems.push(`${w} in both ${prev} and ${cat}`);
    owner.set(w, cat);
  }
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}

const rand = (n: number) => Math.floor(Math.random() * n);
function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
function freqLetter(): string {
  let x = Math.random() * FREQ_TOTAL;
  for (const [l, w] of FREQ) if ((x -= w) <= 0) return l;
  return "E";
}
function count(grid: string[], word: string): number {
  let n = 0;
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      for (const [dr, dc] of DIRS) {
        let ok = true;
        for (let i = 0; i < word.length && ok; i++) {
          const rr = r + dr * i, cc = c + dc * i;
          ok = rr >= 0 && rr < N && cc >= 0 && cc < N && grid[rr * N + cc] === word[i];
        }
        if (ok) n++;
      }
  return n;
}
const BLOCKED = PROFANITY_WORDS.map((w) => w.toUpperCase()).filter((w) => /^[A-Z]{3,}$/.test(w));

function pickWords(words: string[]): string[] | null {
  // Mixed length: at least two short (4–5), at least two long (7–8).
  for (let t = 0; t < 50; t++) {
    const pick = shuffle([...words]).slice(0, WS_WORDS);
    const short = pick.filter((w) => w.length <= 5).length;
    const long = pick.filter((w) => w.length >= 7).length;
    // No word inside another (it would show up twice).
    const nested = pick.some((a) => pick.some((b) => a !== b && (b.includes(a) || b.includes([...a].reverse().join("")))));
    if (short >= 2 && long >= 2 && !nested) return pick;
  }
  return null;
}

function build(): { grid: string; category: string; placements: { word: string; cells: number[] }[] } | null {
  const [category, words] = cats[rand(cats.length)]!;
  const chosen = pickWords(words);
  if (!chosen) return null;
  const grid: string[] = new Array(N * N).fill("");
  const placements: { word: string; cells: number[] }[] = [];
  const dirsUsed = new Set<number>();
  for (const word of [...chosen].sort((a, b) => b.length - a.length)) {
    let placed = false;
    for (let t = 0; t < 300 && !placed; t++) {
      // Prefer directions not used yet so grids mix all eight.
      const di = t < 100 ? (() => { const free = [...DIRS.keys()].filter((d) => !dirsUsed.has(d)); return free.length ? free[rand(free.length)]! : rand(8); })() : rand(8);
      const [dr, dc] = DIRS[di]!;
      const r0 = rand(N), c0 = rand(N);
      const cells: number[] = [];
      let ok = true;
      for (let i = 0; i < word.length && ok; i++) {
        const r = r0 + dr * i, c = c0 + dc * i;
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
  for (const p of placements) if (count(grid, p.word) !== 1) return null;
  for (const bad of BLOCKED) if (count(grid, bad) > 0) return null;
  // Keep placements in a stable order (the order words were chosen).
  placements.sort((a, b) => chosen.indexOf(a.word) - chosen.indexOf(b.word));
  return { grid: grid.join(""), category, placements };
}

const bank: ReturnType<typeof build>[] = [];
let attempts = 0;
while (bank.length < BANK) {
  attempts++;
  const p = build();
  if (p) bank.push(p);
}
// Independent re-check of the whole bank.
for (const p of bank) {
  const g = p!.grid.split("");
  for (const pl of p!.placements) {
    if (count(g, pl.word) !== 1) throw new Error(`duplicate ${pl.word}`);
    if (pl.cells.map((c) => g[c]).join("") !== pl.word) throw new Error(`mismatch ${pl.word}`);
  }
}
const out = `/**
 * Word Search bank — generated by scripts/word-search-bank.ts from
 * wordSearchWords.ts. Every target word appears in its grid exactly once.
 * Do not edit by hand; edit the word lists and re-run the script.
 */

export interface WordSearchBankEntry {
  grid: string;
  category: string;
  placements: { word: string; cells: number[] }[];
}

export const WORD_SEARCH_BANK: WordSearchBankEntry[] = ${JSON.stringify(bank)};
`;
writeFileSync(new URL("../src/lib/duel/wordSearchBank.server.ts", import.meta.url), out);
const cats2 = new Set(bank.map((p) => p!.category));
console.log(`word search bank: ${bank.length} puzzles from ${attempts} attempts · ${cats.length} categories (${cats2.size} used) · ${owner.size} words`);
