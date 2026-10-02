/**
 * Builds the Letter Wheel bank in src/lib/duel/letterWheelBank.server.ts.
 *
 *   bun scripts/letter-wheel-bank.ts
 *
 * Seed: an everyday 6–7 letter word. Valid words: every SCOWL British word of
 * 3+ letters spellable from the seed's letters, plurals removed with the shared
 * heuristic. Crossword: 6–9 of the most common valid words (ranked by the
 * scripts/data/word-frequency.txt list), interlocked in at most 8 × 8 with every
 * crossing consistent and no letters touching except at crossings. Seeds with
 * fewer than 8 valid words or no layout are rejected. Every entry is
 * re-checked before the file is written.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { commonWords, isWord, wordsFrom } from "../src/lib/duel/dictionary.server";
import { isPluralForm } from "../src/lib/duel/wordsmith.server";
import { lwGrade, lwSlotCells, scoreLetterWheel } from "../src/lib/duel/letterWheel";
import type { LetterWheelSlot } from "../src/lib/duel/types";

const BANK = 300;
const MAX = 8;
const freqRank = new Map<string, number>();
readFileSync(new URL("./data/word-frequency.txt", import.meta.url), "utf8")
  .split(/\s+/)
  .forEach((w, i) => w && !freqRank.has(w) && freqRank.set(w, i));
const rank = (w: string) => freqRank.get(w.toLowerCase()) ?? 1e9;

let seedState = 20261002;
const rnd = () => {
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = seedState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

interface Placed { word: string; r: number; c: number; across: boolean }
type Grid = Map<string, string>;
const key = (r: number, c: number) => `${r},${c}`;

function cellsOf(p: Placed): [number, number][] {
  return [...p.word].map((_, i) => (p.across ? [p.r, p.c + i] : [p.r + i, p.c]));
}

/** Crossings made, or -1 if the placement breaks a rule. */
type Dirs = Map<string, { a: boolean; d: boolean }>;
function fit(grid: Grid, dirs: Dirs, p: Placed, box: number[]): number {
  const [dr, dc] = p.across ? [0, 1] : [1, 0];
  const before = key(p.r - dr, p.c - dc);
  const after = key(p.r + dr * p.word.length, p.c + dc * p.word.length);
  if (grid.has(before) || grid.has(after)) return -1;
  let crosses = 0;
  let [r0, c0, r1, c1] = box as [number, number, number, number];
  for (const [i, [r, c]] of cellsOf(p).entries()) {
    r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c);
    const k = key(r, c);
    const have = grid.get(k);
    if (have) {
      const f = dirs.get(k)!;
      if (have !== p.word[i] || (p.across ? f.a : f.d)) return -1;
      crosses++;
    } else {
      // Side neighbours must be empty, or they would form a new word.
      const sides = p.across ? [key(r - 1, c), key(r + 1, c)] : [key(r, c - 1), key(r, c + 1)];
      if (sides.some((s) => grid.has(s))) return -1;
    }
  }
  if (r1 - r0 + 1 > MAX || c1 - c0 + 1 > MAX) return -1;
  return crosses;
}

function layout(pool: string[]): Placed[] | null {
  const grid: Grid = new Map();
  const dirOf: Dirs = new Map();
  const placed: Placed[] = [];
  const box = [0, 0, 0, 0];
  const put = (p: Placed) => {
    for (const [i, [r, c]] of cellsOf(p).entries()) {
      const k = key(r, c);
      const f = dirOf.get(k) ?? { a: false, d: false };
      if (p.across) f.a = true; else f.d = true;
      dirOf.set(k, f);
      grid.set(k, p.word[i]!);
      box[0] = Math.min(box[0]!, r); box[2] = Math.max(box[2]!, r);
      box[1] = Math.min(box[1]!, c); box[3] = Math.max(box[3]!, c);
    }
    placed.push(p);
  };
  const first = pool[0]!;
  put({ word: first, r: 0, c: 0, across: true });
  box[3] = first.length - 1;
  const rest = pool.slice(1);
  let progress = true;
  while (placed.length < 9 && progress) {
    progress = false;
    for (const word of rest) {
      if (placed.some((p) => p.word === word)) continue;
      let best: { p: Placed; score: number } | null = null;
      for (const [k, letter] of grid) {
        const [r, c] = k.split(",").map(Number) as [number, number];
        for (let i = 0; i < word.length; i++) {
          if (word[i] !== letter) continue;
          for (const across of [true, false]) {
            const f = dirOf.get(k)!;
            if (across ? f.a : f.d) continue;
            const p: Placed = across ? { word, r, c: c - i, across } : { word, r: r - i, c, across };
            // `fit` treats a crossing as legal only where the existing word runs the other way.
            const crosses = fit(grid, dirOf, p, box);
            if (crosses < 1) continue;
            const score = crosses * 10 + rnd();
            if (!best || score > best.score) best = { p, score };
          }
        }
      }
      if (best) {
        put(best.p);
        progress = true;
        if (placed.length >= 9) break;
      }
    }
  }
  return placed.length >= 6 ? placed : null;
}

// ---- Seeds ----
const seeds = shuffle(
  commonWords().filter((w) => (w.length === 6 || w.length === 7) && rank(w) < 15000 && !isPluralForm(w) && isWord(w)),
);

interface Entry { cols: number; rows: number; letters: string; slots: LetterWheelSlot[]; words: string[]; bonus: string[] }
const bank: Entry[] = [];
const usedSets = new Set<string>();
let rejectedFew = 0;
let rejectedLayout = 0;

for (const seed of seeds) {
  if (bank.length >= BANK) break;
  const sorted = [...seed].sort().join("");
  if (usedSets.has(sorted)) continue;
  const valid = [...new Set(wordsFrom(seed, 3, true).filter((w) => !isPluralForm(w)))].map((w) => w.toUpperCase());
  if (valid.length < 8) { rejectedFew++; continue; }
  // Crossword candidates: common words only, most frequent first; the seed leads.
  const common = valid.filter((w) => rank(w) < 20000).sort((a, b) => rank(a) - rank(b)).slice(0, 18);
  const S = seed.toUpperCase();
  let result: Placed[] | null = null;
  for (let attempt = 0; attempt < 40 && !result; attempt++) {
    const rest = common.filter((w) => w !== S);
    // Keep frequency order but jitter it a little between attempts.
    const jittered = rest.map((w, i) => ({ w, k: i + rnd() * 6 })).sort((a, b) => a.k - b.k).map((x) => x.w);
    const lay = layout([S, ...jittered]);
    if (lay && new Set(lay.map((p) => p.word.length)).size >= 2) result = lay;
  }
  if (!result) { rejectedLayout++; continue; }
  const minR = Math.min(...result.flatMap((p) => cellsOf(p).map(([r]) => r)));
  const minC = Math.min(...result.flatMap((p) => cellsOf(p).map(([, c]) => c)));
  const slots = result.map((p) => ({ row: p.r - minR, col: p.c - minC, across: p.across, len: p.word.length }));
  const rows = Math.max(...slots.map((s) => s.row + (s.across ? 1 : s.len)));
  const cols = Math.max(...slots.map((s) => s.col + (s.across ? s.len : 1)));
  const words = result.map((p) => p.word);
  const bonus = valid.filter((w) => !words.includes(w)).sort();
  let letters = S;
  for (let i = 0; i < 20 && (letters === S || valid.includes(letters)); i++) letters = shuffle([...S]).join("");
  usedSets.add(sorted);
  bank.push({ cols, rows, letters, slots, words, bonus });
}

// ---- Re-check every entry ----
const problems: string[] = [];
for (const [n, e] of bank.entries()) {
  if (e.cols > MAX || e.rows > MAX) problems.push(`#${n} too big`);
  if (e.words.length < 6 || e.words.length > 9) problems.push(`#${n} ${e.words.length} words`);
  const grid: (string | null)[] = Array(e.cols * e.rows).fill(null);
  for (const [i, s] of e.slots.entries()) {
    for (const [j, cell] of lwSlotCells(s, e.cols).entries()) {
      const ch = e.words[i]![j]!;
      if (grid[cell] && grid[cell] !== ch) problems.push(`#${n} clash`);
      grid[cell] = ch;
    }
  }
  // Every maximal run of 2+ letters in either direction must be exactly one slot.
  const runs = new Set(e.slots.map((s) => `${s.row},${s.col},${s.across}`));
  let runCount = 0;
  for (const across of [true, false]) {
    for (let a = 0; a < (across ? e.rows : e.cols); a++) {
      let start = -1;
      for (let b = 0; b <= (across ? e.cols : e.rows); b++) {
        const r = across ? a : b, c = across ? b : a;
        const on = b < (across ? e.cols : e.rows) && grid[r * e.cols + c] !== null;
        if (on && start < 0) start = b;
        if (!on && start >= 0) {
          if (b - start >= 2) {
            runCount++;
            const k = across ? `${a},${start},true` : `${start},${a},false`;
            if (!runs.has(k)) problems.push(`#${n} accidental word`);
          }
          start = -1;
        }
      }
    }
  }
  if (runCount !== e.slots.length) problems.push(`#${n} run count ${runCount}/${e.slots.length}`);
  const all = lwGrade(e.words, e.bonus, e.slots, e.cols, [...e.words, ...e.bonus.slice(0, 2)]);
  if (all.cells !== all.totalCells) problems.push(`#${n} not complete`);
  if (scoreLetterWheel(all.cells, all.totalCells, 0, 60_000, 120_000) !== 125) problems.push(`#${n} score`);
  if (e.bonus.some((w) => isPluralForm(w) || !isWord(w))) problems.push(`#${n} bad bonus`);
}
if (problems.length || bank.length < BANK) {
  console.error(problems.slice(0, 30).join("\n"), `\nbuilt ${bank.length}`);
  process.exit(1);
}

const hist = new Map<number, number>();
for (const e of bank) hist.set(e.words.length, (hist.get(e.words.length) ?? 0) + 1);
console.log(`bank ${bank.length}; words per board`, Object.fromEntries([...hist].sort()),
  `; rejected: ${rejectedFew} under 8 words, ${rejectedLayout} no layout`,
  `; bonus min/max ${Math.min(...bank.map((e) => e.bonus.length))}/${Math.max(...bank.map((e) => e.bonus.length))}`,
  `; size max ${Math.max(...bank.map((e) => e.cols))}×${Math.max(...bank.map((e) => e.rows))}`);

writeFileSync(
  new URL("../src/lib/duel/letterWheelBank.server.ts", import.meta.url),
  `/**
 * Letter Wheel bank — generated by scripts/letter-wheel-bank.ts. Do not edit by hand.
 */
import type { LetterWheelSlot } from "./types";

export interface LetterWheelBankEntry {
  cols: number;
  rows: number;
  letters: string;
  slots: LetterWheelSlot[];
  words: string[];
  bonus: string[];
}

export const LETTER_WHEEL_BANK: LetterWheelBankEntry[] = ${JSON.stringify(bank)};
`,
);
