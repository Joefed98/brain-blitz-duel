/**
 * Builds Lookout's level banks (the Word overhaul, stage 3, 15 Nov 2026) in src/lib/duel/wordSearchLevelBank.server.ts
 * from the same editable themes as Normal's bank (src/lib/duel/wordSearchWords.ts), on the same rules (every hidden
 * word exactly once in all eight directions, no other word of the theme anywhere, no blocked word, no word that is or
 * holds its theme's name, an unlisted on-theme bonus word over filler cells), sized by the level
 * (src/lib/levels/word/wordsearch.ts: grid width and height, word count, the directions words may run, and Expert's
 * decoys: a hidden word's start, one letter short, written elsewhere in the grid).
 *
 *   bun scripts/word-search-level-bank.ts           rebuild the banks
 *   bun scripts/word-search-level-bank.ts --check   prove the committed banks are current (writes nothing)
 *
 * Seeded (mulberry32, one seed a level), so a rebuild is byte for byte. Normal's bank is untouched.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { WORD_SEARCH_CATEGORIES } from "../src/lib/duel/wordSearchWords";
import { PROFANITY_WORDS } from "../src/lib/duel/profanity.server";
import { wsThemeClash } from "../src/lib/duel/wordSearch";
import { WORDSEARCH_LEVEL_SETTINGS, WS_ALL_DIRS, type WordSearchLevelSettings } from "../src/lib/levels/word/wordsearch";

export const LEVEL_PER_CATEGORY = 4;
const LEVEL_SEEDS = { easy: 0x5eed_e451, hard: 0x5eed_4a2d, expert: 0x5eed_e8e7 } as const;
export type WsLevel = keyof typeof LEVEL_SEEDS;
export const WS_LEVELS: readonly WsLevel[] = ["easy", "hard", "expert"];

const FREQ =
  "E12.7 T9.1 A8.2 O7.5 I7.0 N6.7 S6.3 H6.1 R6.0 D4.3 L4.0 C2.8 U2.8 M2.4 W2.4 F2.2 G2.0 Y2.0 P1.9 B1.5 V1.0 K0.8 J0.2 X0.2 Q0.1 Z0.1"
    .split(" ")
    .map((p) => [p[0]!, Number(p.slice(1))] as const);
const FREQ_TOTAL = FREQ.reduce((n, [, w]) => n + w, 0);
const BLOCKED = PROFANITY_WORDS.map((w) => w.toUpperCase()).filter((w) => /^[A-Z]{3,}$/.test(w));

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
let random = mulberry32(1);
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

/** Times `word` appears in a cols × rows grid, all eight directions (the check reuses it). */
export function countInGridRect(grid: readonly string[], word: string, cols: number, rows: number): number {
  let n = 0;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      for (const [dr, dc] of WS_ALL_DIRS) {
        let ok = true;
        for (let i = 0; i < word.length && ok; i++) {
          const rr = r + dr * i,
            cc = c + dc * i;
          ok = rr >= 0 && rr < rows && cc >= 0 && cc < cols && grid[rr * cols + cc] === word[i];
        }
        if (ok) n++;
      }
  return n;
}

/** The theme's words a level board may hide (no word that is or holds its theme's name, as Normal's rev 2). */
export function levelWords(category: string): string[] {
  return (WORD_SEARCH_CATEGORIES[category] ?? []).filter((w) => !wsThemeClash(category, w));
}

export type LevelEntry = {
  grid: string;
  category: string;
  placements: { word: string; cells: number[] }[];
  bonus: { word: string; cells: number[] };
};

const rev = (w: string) => [...w].reverse().join("");
const nests = (a: string, b: string) => a !== b && (b.includes(a) || b.includes(rev(a)) || a.includes(b) || a.includes(rev(b)));

function pickWords(words: string[], count: number, maxLen: number): string[] | null {
  const fit = words.filter((w) => w.length <= maxLen);
  for (let t = 0; t < 80; t++) {
    const pick = shuffle([...fit]).slice(0, count);
    if (pick.length < count) return null;
    const short = pick.filter((w) => w.length <= 5).length;
    const long = pick.filter((w) => w.length >= 7).length;
    if (short >= 2 && long >= 2 && !pick.some((a) => pick.some((b) => nests(a, b)))) return pick;
  }
  return null;
}

/** A straight run of `len` cells from a random start in direction `d`, inside the grid, or null. */
function randomLine(len: number, d: readonly [number, number], cols: number, rows: number): number[] | null {
  const [dr, dc] = d;
  const r0 = rand(rows),
    c0 = rand(cols);
  const r1 = r0 + dr * (len - 1),
    c1 = c0 + dc * (len - 1);
  if (r1 < 0 || r1 >= rows || c1 < 0 || c1 >= cols) return null;
  return Array.from({ length: len }, (_, k) => (r0 + dr * k) * cols + (c0 + dc * k));
}

/** Every rule a level board keeps; null when it holds, else the reason (the check reuses it). */
export function levelEntryProblem(e: LevelEntry, s: WordSearchLevelSettings): string | null {
  const { cols, rows } = s;
  const g = e.grid.split("");
  if (g.length !== cols * rows) return `grid is ${g.length} cells, not ${cols} × ${rows}`;
  if (!/^[A-Z]+$/.test(e.grid)) return "a cell is not a letter";
  if (e.placements.length !== s.words) return `${e.placements.length} words, not ${s.words}`;
  const all = WORD_SEARCH_CATEGORIES[e.category] ?? [];
  const allowed = levelWords(e.category);
  const listed = e.placements.map((p) => p.word);
  const dirOk = (cells: number[]) => {
    const dr = Math.sign(Math.floor(cells[1]! / cols) - Math.floor(cells[0]! / cols));
    const dc = Math.sign((cells[1]! % cols) - (cells[0]! % cols));
    return s.dirs.some(([a, b]) => a === dr && b === dc);
  };
  for (const p of [...e.placements, e.bonus]) {
    if (!allowed.includes(p.word)) return `${p.word} is not a ${e.category} word a board may hide`;
    if (p.cells.map((c) => g[c]).join("") !== p.word) return `${p.word} is not where it says`;
    if (!dirOk(p.cells)) return `${p.word} runs in a direction this level doesn't use`;
    if (countInGridRect(g, p.word, cols, rows) !== 1) return `${p.word} appears ${countInGridRect(g, p.word, cols, rows)} times`;
  }
  if (listed.includes(e.bonus.word)) return `${e.bonus.word} is listed`;
  if (listed.some((w) => nests(w, e.bonus.word))) return `${e.bonus.word} nests with a listed word`;
  if (listed.some((a) => listed.some((b) => nests(a, b)))) return "two listed words nest";
  for (const other of all)
    if (other !== e.bonus.word && !listed.includes(other) && countInGridRect(g, other, cols, rows) > 0) return `stray ${other}`;
  for (const bad of BLOCKED) if (countInGridRect(g, bad, cols, rows) > 0) return `blocked ${bad}`;
  if (s.decoys > 0) {
    const decoys = listed.filter((w) => countInGridRect(g, w.slice(0, -1), cols, rows) >= 2).length;
    if (decoys < s.decoys) return `${decoys} decoys, not ${s.decoys}`;
  }
  return null;
}

function build(category: string, s: WordSearchLevelSettings): LevelEntry | null {
  const { cols, rows } = s;
  const words = levelWords(category);
  const chosen = pickWords(words, s.words, Math.max(cols, rows));
  if (!chosen) return null;
  const grid: string[] = new Array(cols * rows).fill("");
  const placements: { word: string; cells: number[] }[] = [];
  const dirsUsed = new Set<number>();
  const place = (word: string, maxShared: number): number[] | null => {
    for (let t = 0; t < 400; t++) {
      const free = s.dirs.map((_, i) => i).filter((i) => !dirsUsed.has(i));
      const di = t < 120 && free.length ? free[rand(free.length)]! : rand(s.dirs.length);
      const cells = randomLine(word.length, s.dirs[di]!, cols, rows);
      if (!cells) continue;
      if (cells.some((c, i) => grid[c] && grid[c] !== word[i])) continue;
      if (cells.filter((c) => grid[c]).length > maxShared) continue;
      cells.forEach((c, i) => (grid[c] = word[i]!));
      dirsUsed.add(di);
      return cells;
    }
    return null;
  };
  for (const word of [...chosen].sort((a, b) => b.length - a.length)) {
    const cells = place(word, 1);
    if (!cells) return null;
    placements.push({ word, cells });
  }
  // The bonus: an unlisted theme word, over filler cells (at most one crossing on a matching letter).
  const bonusWord = shuffle(words.filter((w) => !chosen.includes(w) && w.length <= Math.max(cols, rows) && !chosen.some((c) => nests(c, w))))[0];
  if (!bonusWord) return null;
  const bonusCells = place(bonusWord, 1);
  if (!bonusCells) return null;
  // Expert's decoys: a hidden word's start, one letter short, written in filler cells in any direction.
  const owned = new Set([...placements.flatMap((p) => p.cells), ...bonusCells]);
  for (const word of shuffle([...chosen]).slice(0, s.decoys)) {
    const stem = word.slice(0, -1);
    let done = false;
    for (let t = 0; t < 400 && !done; t++) {
      const cells = randomLine(stem.length, WS_ALL_DIRS[rand(WS_ALL_DIRS.length)]!, cols, rows);
      if (!cells || cells.some((c) => owned.has(c) || grid[c])) continue;
      cells.forEach((c, i) => {
        grid[c] = stem[i]!;
        owned.add(c);
      });
      done = true;
    }
    if (!done) return null;
  }
  for (let i = 0; i < grid.length; i++) if (!grid[i]) grid[i] = freqLetter();
  placements.sort((a, b) => chosen.indexOf(a.word) - chosen.indexOf(b.word));
  const entry: LevelEntry = { grid: grid.join(""), category, placements, bonus: { word: bonusWord, cells: bonusCells } };
  return levelEntryProblem(entry, s) === null ? entry : null;
}

export function buildLevelBank(level: WsLevel): { bank: LevelEntry[]; attempts: number } {
  const s = WORDSEARCH_LEVEL_SETTINGS[level];
  random = mulberry32(LEVEL_SEEDS[level]);
  const bank: LevelEntry[] = [];
  let attempts = 0;
  const cats = Object.keys(WORD_SEARCH_CATEGORIES);
  for (let round = 0; round < LEVEL_PER_CATEGORY; round++) {
    for (const category of cats) {
      for (let t = 0; ; t++) {
        if (t > 20_000) throw new Error(`${level} ${category}: no board`);
        attempts++;
        const e = build(category, s);
        if (e) {
          bank.push(e);
          break;
        }
      }
    }
  }
  return { bank, attempts };
}

export function levelBankSource(banks: Record<WsLevel, LevelEntry[]>): string {
  const body = WS_LEVELS.map((l) => `  ${l}: [\n${banks[l].map((e) => `    ${JSON.stringify(e)}`).join(",\n")},\n  ],`).join("\n");
  return `/**
 * Lookout's level banks (the Word overhaul, stage 3, 15 Nov 2026) — generated by scripts/word-search-level-bank.ts
 * (seeded; \`bun scripts/word-search-level-bank.ts --check\` proves them current). Each board: the level's grid
 * (src/lib/levels/word/wordsearch.ts), its listed words and its bonus word, each appearing exactly once, no other
 * theme word and no blocked word anywhere. Server-only (the placements are the answers). Do not edit by hand.
 */

export interface WordSearchLevelEntry {
  grid: string;
  category: string;
  placements: { word: string; cells: number[] }[];
  bonus: { word: string; cells: number[] };
}

export const WORD_SEARCH_LEVEL_BANK: Record<"easy" | "hard" | "expert", WordSearchLevelEntry[]> = {
${body}
};
`;
}

if (import.meta.main) {
  const banks = {} as Record<WsLevel, LevelEntry[]>;
  const notes: string[] = [];
  for (const level of WS_LEVELS) {
    const { bank, attempts } = buildLevelBank(level);
    banks[level] = bank;
    notes.push(`${level} ${bank.length} boards from ${attempts} attempts`);
  }
  const out = levelBankSource(banks);
  const target = new URL("../src/lib/duel/wordSearchLevelBank.server.ts", import.meta.url);
  if (process.argv.includes("--check")) {
    let same = false;
    try {
      same = readFileSync(target, "utf8") === out;
    } catch {
      same = false;
    }
    console.log(`lookout level banks ${same ? "are current" : "are STALE"}: ${notes.join(", ")}`);
    process.exit(same ? 0 : 1);
  }
  writeFileSync(target, out);
  console.log(`lookout level banks: ${notes.join(", ")}`);
}
