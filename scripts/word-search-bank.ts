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
 *
 * wordSearchRev 2 (19 Oct 2026): no hidden word may be or contain its theme's name (wsThemeClash
 * in wordSearch.ts). Every bank grid that hides such a word gets a replacement in
 * src/lib/duel/wordSearchBankRev2.server.ts, built (seeded, REV2_SEED) from the theme's other words
 * under the same rules, the stray-word scan still covering the theme's whole list, so a clashing word
 * appears nowhere in the grid; every other grid is dealt unchanged.
 *
 * wordSearchRev 3 (25 Oct 2026, word depth d1): every grid rev 2 deals gets one hidden bonus word
 * (src/lib/duel/wordSearchBankRev3.server.ts, seeded REV3_SEED): an unlisted on-theme word (rev2Words, not
 * one of the six, neither inside another), written in a straight line over filler cells only (at most one
 * crossing, on a matching letter), so the six words keep their cells. The rev-3 grid is the rev-2 grid with
 * the bonus written in; the six words and the bonus each appear exactly once, no other theme word appears,
 * and no blocked word appears.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { WORD_SEARCH_CATEGORIES } from "../src/lib/duel/wordSearchWords";
import { PROFANITY_WORDS } from "../src/lib/duel/profanity.server";
import { isWord } from "../src/lib/duel/dictionary.server";
import { WS_SIZE as N, WS_WORDS, wsThemeClash } from "../src/lib/duel/wordSearch";

export const PER_CATEGORY = 20;
export const MIN_CATEGORIES = 70;
export const MIN_WORDS = 38;
const SEED = 0x5eed_2026;
const REV2_SEED = 0x5eed_1019;
const REV3_SEED = 0x5eed_1025;
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

/** `stray`: every word that must not appear in the grid unless chosen (the theme's whole list). */
function build(category: string, words: string[], stray: readonly string[] = words): Entry | null {
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
  for (const other of stray)
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

/** The theme's words a rev-2 grid may hide (wsThemeClash removed). */
export function rev2Words(category: string): string[] {
  return (WORD_SEARCH_CATEGORIES[category] ?? []).filter((w) => !wsThemeClash(category, w));
}

/**
 * Rev 2 replacements, by bank index: each grid whose placements include a word that clashes with
 * its theme is rebuilt from rev2Words (seeded; indices in bank order).
 */
export function buildRev2Replacements(bank: readonly Entry[]): { replacements: Map<number, Entry>; attempts: number } {
  random = mulberry32(REV2_SEED);
  const replacements = new Map<number, Entry>();
  let attempts = 0;
  bank.forEach((e, i) => {
    if (!e.placements.some((p) => wsThemeClash(e.category, p.word))) return;
    const all = WORD_SEARCH_CATEGORIES[e.category]!;
    const words = rev2Words(e.category);
    for (let t = 0; ; t++) {
      if (t > 10_000) throw new Error(`${e.category}: no rev-2 grid from ${words.length} words`);
      attempts++;
      const p = build(e.category, words, all);
      if (p) {
        replacements.set(i, p);
        return;
      }
    }
  });
  return { replacements, attempts };
}

/** A rev-3 bonus: the word and its cells (the rev-3 grid is the rev-2 grid with the word written in). */
export type Rev3Bonus = { word: string; cells: number[] };

/** The rev-3 grid of a rev-2 entry and its bonus. */
export function rev3Grid(entry: Entry, bonus: Rev3Bonus): string {
  const g = entry.grid.split("");
  bonus.cells.forEach((cell, i) => (g[cell] = bonus.word[i]!));
  return g.join("");
}

/** Every rule a rev-3 board keeps (the check reuses it); null when it holds, else the reason. */
export function rev3Problem(entry: Entry, bonus: Rev3Bonus): string | null {
  const all = WORD_SEARCH_CATEGORIES[entry.category] ?? [];
  const chosen = entry.placements.map((p) => p.word);
  if (!rev2Words(entry.category).includes(bonus.word)) return `${bonus.word} is not a rev-2 word of ${entry.category}`;
  if (chosen.includes(bonus.word)) return `${bonus.word} is one of the six`;
  const rev = (w: string) => [...w].reverse().join("");
  if (chosen.some((c) => c.includes(bonus.word) || bonus.word.includes(c) || rev(c).includes(bonus.word) || bonus.word.includes(rev(c))))
    return `${bonus.word} nests with a listed word`;
  const g = rev3Grid(entry, bonus).split("");
  const owned = new Set(entry.placements.flatMap((p) => p.cells));
  const shared = bonus.cells.filter((c) => owned.has(c));
  if (shared.length > 1) return `${bonus.word} crosses ${shared.length} listed cells`;
  if (shared.some((c) => entry.grid[c] !== g[c])) return `${bonus.word} changes a listed word's letter`;
  if (bonus.cells.map((c) => g[c]).join("") !== bonus.word) return `${bonus.word} mismatch`;
  for (const p of entry.placements) if (countInGrid(g, p.word) !== 1) return `${p.word} appears ${countInGrid(g, p.word)} times`;
  if (countInGrid(g, bonus.word) !== 1) return `${bonus.word} appears ${countInGrid(g, bonus.word)} times`;
  for (const other of all) if (other !== bonus.word && !chosen.includes(other) && countInGrid(g, other) > 0) return `stray ${other}`;
  for (const bad of BLOCKED) if (countInGrid(g, bad) > 0) return `blocked ${bad}`;
  return null;
}

/**
 * Rev-3 bonus words, by bank index, for the grid rev 2 deals at that index (`rev2Entry`): seeded, indices in bank
 * order. A word is tried in up to 400 random lines; words are tried in a seeded shuffle until one fits.
 */
export function buildRev3Bonus(count: number, rev2Entry: (index: number) => Entry): { bonus: Rev3Bonus[]; attempts: number } {
  random = mulberry32(REV3_SEED);
  const bonus: Rev3Bonus[] = [];
  let attempts = 0;
  for (let i = 0; i < count; i++) {
    const e = rev2Entry(i);
    const chosen = e.placements.map((p) => p.word);
    const candidates = shuffle(rev2Words(e.category).filter((w) => !chosen.includes(w)));
    let made: Rev3Bonus | null = null;
    for (const word of candidates) {
      for (let t = 0; t < 400 && !made; t++) {
        attempts++;
        const [dr, dc] = DIRS[rand(8)]!;
        const r0 = rand(N), c0 = rand(N);
        const r1 = r0 + dr * (word.length - 1), c1 = c0 + dc * (word.length - 1);
        if (r1 < 0 || r1 >= N || c1 < 0 || c1 >= N) continue;
        const cells = Array.from({ length: word.length }, (_, k) => (r0 + dr * k) * N + (c0 + dc * k));
        const candidate = { word, cells };
        if (rev3Problem(e, candidate) === null) made = candidate;
      }
      if (made) break;
    }
    if (!made) throw new Error(`${e.category} #${i}: no bonus word fits`);
    bonus.push(made);
  }
  return { bonus, attempts };
}

export function rev3Source(bonus: readonly Rev3Bonus[]): string {
  return `/**
 * Lookout wordSearchRev 3 bonus words (25 Oct 2026, word depth d1) — generated by scripts/word-search-bank.ts
 * (seeded; \`bun scripts/word-search-bank.ts --check\` proves it current).
 * Indexed like WORD_SEARCH_BANK: the hidden, unlisted on-theme word of the grid rev 2 deals at that index. The
 * rev-3 grid is that rev-2 grid with the word written into its cells (filler cells only, at most one crossing on
 * a matching letter). Server-only until the reveal. Do not edit by hand.
 */

export const WORD_SEARCH_REV3_BONUS: readonly { word: string; cells: number[] }[] = [
${bonus.map((b) => JSON.stringify(b)).join(",\n")},
];
`;
}

export function rev2Source(replacements: ReadonlyMap<number, Entry>): string {
  return `/**
 * Lookout wordSearchRev 2 replacement grids — generated by scripts/word-search-bank.ts
 * (seeded; \`bun scripts/word-search-bank.ts --check\` proves it current).
 * Keyed by WORD_SEARCH_BANK index: the grids whose hidden words include one that is or contains its
 * theme's name (wsThemeClash), rebuilt from the theme's other words. Rev 2 deals the replacement where
 * there is one and the bank grid otherwise. Do not edit by hand.
 */

import type { WordSearchBankEntry } from "./wordSearchBank.server";

export const WORD_SEARCH_REV2_REPLACEMENTS: Record<number, WordSearchBankEntry> = {
${[...replacements].map(([i, e]) => `${i}: ${JSON.stringify(e)}`).join(",\n")},
};
`;
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
  const { replacements, attempts: rev2Attempts } = buildRev2Replacements(bank);
  const out2 = rev2Source(replacements);
  const target2 = new URL("../src/lib/duel/wordSearchBankRev2.server.ts", import.meta.url);
  const { bonus, attempts: rev3Attempts } = buildRev3Bonus(bank.length, (i) => replacements.get(i) ?? bank[i]!);
  const out3 = rev3Source(bonus);
  const target3 = new URL("../src/lib/duel/wordSearchBankRev3.server.ts", import.meta.url);
  const words = cats.reduce((n, [, w]) => n + w.length, 0);
  if (process.argv.includes("--check")) {
    const same = readFileSync(target, "utf8") === out;
    const same2 = readFileSync(target2, "utf8") === out2;
    const same3 = readFileSync(target3, "utf8") === out3;
    console.log(
      `word search bank ${same ? "is current" : "is STALE"}: ${bank.length} puzzles · ${cats.length} categories · ${words} words; rev-2 replacements ${same2 ? "are current" : "are STALE"}: ${replacements.size}; rev-3 bonus words ${same3 ? "are current" : "are STALE"}: ${bonus.length}`,
    );
    process.exit(same && same2 && same3 ? 0 : 1);
  }
  writeFileSync(target, out);
  writeFileSync(target2, out2);
  writeFileSync(target3, out3);
  console.log(`rev 3: ${bonus.length} bonus words from ${rev3Attempts} attempts`);
  console.log(
    `word search bank: ${bank.length} puzzles from ${attempts} attempts · ${cats.length} categories · ${words} words; rev 2: ${replacements.size} replacement grids from ${rev2Attempts} attempts`,
  );
}
