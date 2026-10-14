/**
 * Builds the Roundabout (Letter Wheel) banks.
 *
 *   bun scripts/letter-wheel-bank.ts            # wheelRev 1 bank → src/lib/duel/letterWheelBankRev1.server.ts
 *   bun scripts/letter-wheel-bank.ts --legacy   # the original bank → src/lib/duel/letterWheelBank.server.ts
 *   … --check                                   # rebuild in memory and compare with the committed file
 *   … --out=<path>                              # write somewhere else
 *
 * Both are seeded and rebuild byte for byte. The legacy bank (unstamped rounds) is
 * kept exactly as it was; its rules are unchanged below.
 *
 * Valid words: every SCOWL British word of 3+ letters spellable from the seed's
 * letters, plurals removed with the shared heuristic. Crossword candidates: the most
 * common valid words (ranked by the scripts/data/word-frequency.txt list), the seed
 * first. Words interlock with every crossing consistent and no letters touching
 * except at crossings (every maximal run of 2+ letters is exactly one slot). Every
 * entry is re-checked before the file is written.
 *
 * Legacy: an everyday 6–7 letter seed; exactly 8 or 9 words, at least three of 4+
 * letters and no more than three 3-letter words, in at most 8 × 8.
 *
 * wheelRev 1 (14 Oct 2026): an everyday 7-letter seed; 11 to 14 words, at least seven
 * of 4+ letters and no more than five 3-letter words, in at most 11 columns × 9 rows
 * (the board's wide, short space above the wheel at 375 × 667). The layout with the
 * most words (then the smallest box) over 60 jittered attempts is kept. Candidates must
 * also be on the everyday list (commonWords), which drops abbreviations such as SEPT.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { commonWords, isWord, wordsFrom } from "../src/lib/duel/dictionary.server";
import { isPluralForm } from "../src/lib/duel/wordsmith.server";
import { lwGrade, lwSlotCells, LW_REV1_LIMITS } from "../src/lib/duel/letterWheel";
import type { LetterWheelSlot } from "../src/lib/duel/types";

const args = process.argv.slice(2);
const LEGACY = args.includes("--legacy");
const CHECK = args.includes("--check");
const OUT = args.find((a) => a.startsWith("--out="))?.slice(6);

interface Config {
  bank: number;
  seed: number;
  seedLengths: number[];
  maxCols: number;
  maxRows: number;
  minWords: number;
  maxWords: number;
  minLong: number;
  maxShort: number;
  candidates: number;
  attempts: number;
  /** Legacy: the first layout that passes; rev 1: the best of every attempt. */
  best: boolean;
}

const CFG: Config = LEGACY
  ? { bank: 300, seed: 20261002, seedLengths: [6, 7], maxCols: 8, maxRows: 8, minWords: 8, maxWords: 9, minLong: 3, maxShort: 3, candidates: 18, attempts: 40, best: false }
  : { bank: 300, seed: 20261014, seedLengths: [7], ...LW_REV1_LIMITS, candidates: 24, attempts: 60, best: true };

const freqRank = new Map<string, number>();
readFileSync(new URL("./data/word-frequency.txt", import.meta.url), "utf8")
  .split(/\s+/)
  .forEach((w, i) => w && !freqRank.has(w) && freqRank.set(w, i));
const rank = (w: string) => freqRank.get(w.toLowerCase()) ?? 1e9;

let seedState = CFG.seed;
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
  if (r1 - r0 + 1 > CFG.maxRows || c1 - c0 + 1 > CFG.maxCols) return -1;
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
  while (placed.length < CFG.maxWords && progress) {
    progress = false;
    for (const word of rest) {
      if (placed.some((p) => p.word === word)) continue;
      // Rev 1: no more 3-letter words once the limit is reached.
      if (CFG.best && word.length === 3 && placed.filter((p) => p.word.length === 3).length >= CFG.maxShort) continue;
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
        if (placed.length >= CFG.maxWords) break;
      }
    }
  }
  if (placed.length < CFG.minWords) return null;
  const long = placed.filter((p) => p.word.length >= 4).length;
  const short = placed.filter((p) => p.word.length === 3).length;
  return long >= CFG.minLong && short <= CFG.maxShort ? placed : null;
}

function boxOf(lay: Placed[]): { rows: number; cols: number } {
  const cells = lay.flatMap(cellsOf);
  const rows = Math.max(...cells.map(([r]) => r)) - Math.min(...cells.map(([r]) => r)) + 1;
  const cols = Math.max(...cells.map(([, c]) => c)) - Math.min(...cells.map(([, c]) => c)) + 1;
  return { rows, cols };
}

const everyday = new Set(commonWords());

// ---- Seeds ----
const seeds = shuffle(
  commonWords().filter((w) => CFG.seedLengths.includes(w.length) && rank(w) < 15000 && !isPluralForm(w) && isWord(w)),
);

interface Entry { cols: number; rows: number; letters: string; slots: LetterWheelSlot[]; words: string[] }
const bank: Entry[] = [];
const usedSets = new Set<string>();
let rejectedFew = 0;
let rejectedLayout = 0;

for (const seed of seeds) {
  if (bank.length >= CFG.bank) break;
  const sorted = [...seed].sort().join("");
  if (usedSets.has(sorted)) continue;
  const valid = [...new Set(wordsFrom(seed, 3, true).filter((w) => !isPluralForm(w)))].map((w) => w.toUpperCase());
  if (valid.length < CFG.minWords) { rejectedFew++; continue; }
  // Crossword candidates: common words only, most frequent first; the seed leads.
  // Rev 1 also requires the everyday list (drops abbreviations such as SEPT).
  const common = valid.filter((w) => rank(w) < 20000 && (!CFG.best || everyday.has(w.toLowerCase()))).sort((a, b) => rank(a) - rank(b)).slice(0, CFG.candidates);
  const S = seed.toUpperCase();
  let result: Placed[] | null = null;
  let resultKey = -Infinity;
  for (let attempt = 0; attempt < CFG.attempts && (CFG.best || !result); attempt++) {
    const rest = common.filter((w) => w !== S);
    // Keep frequency order but jitter it a little between attempts.
    const jittered = rest.map((w, i) => ({ w, k: i + rnd() * 6 })).sort((a, b) => a.k - b.k).map((x) => x.w);
    const lay = layout([S, ...jittered]);
    if (!lay || new Set(lay.map((p) => p.word.length)).size < 2) continue;
    if (!CFG.best) { result = lay; break; }
    const { rows, cols } = boxOf(lay);
    const k = lay.length * 1000 - rows * cols;
    if (k > resultKey) { result = lay; resultKey = k; }
  }
  if (!result) { rejectedLayout++; continue; }
  const minR = Math.min(...result.flatMap((p) => cellsOf(p).map(([r]) => r)));
  const minC = Math.min(...result.flatMap((p) => cellsOf(p).map(([, c]) => c)));
  const slots = result.map((p) => ({ row: p.r - minR, col: p.c - minC, across: p.across, len: p.word.length }));
  const rows = Math.max(...slots.map((s) => s.row + (s.across ? 1 : s.len)));
  const cols = Math.max(...slots.map((s) => s.col + (s.across ? s.len : 1)));
  const words = result.map((p) => p.word);
  let letters = S;
  for (let i = 0; i < 20 && (letters === S || valid.includes(letters)); i++) letters = shuffle([...S]).join("");
  usedSets.add(sorted);
  bank.push({ cols, rows, letters, slots, words });
}

// ---- Re-check every entry ----
const problems: string[] = [];
for (const [n, e] of bank.entries()) {
  if (e.cols > CFG.maxCols || e.rows > CFG.maxRows) problems.push(`#${n} too big`);
  if (e.words.length < CFG.minWords || e.words.length > CFG.maxWords) problems.push(`#${n} ${e.words.length} words`);
  if (e.words.filter((w) => w.length >= 4).length < CFG.minLong) problems.push(`#${n} too few 4+ letter words`);
  if (e.words.filter((w) => w.length === 3).length > CFG.maxShort) problems.push(`#${n} too many 3-letter words`);
  if (new Set(e.words).size !== e.words.length) problems.push(`#${n} repeated word`);
  const pool = [...e.letters].sort().join("");
  for (const w of e.words) {
    const left = [...pool];
    for (const ch of w) {
      const at = left.indexOf(ch);
      if (at < 0) problems.push(`#${n} ${w} not spellable`);
      else left.splice(at, 1);
    }
    if (!isWord(w)) problems.push(`#${n} ${w} not a word`);
  }
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
  const all = lwGrade(e.words, e.slots, e.cols, e.words);
  if (all.cells !== all.totalCells || all.slots.length !== e.words.length) problems.push(`#${n} not complete`);
}
if (problems.length || bank.length < CFG.bank) {
  console.error(problems.slice(0, 30).join("\n"), `\nbuilt ${bank.length}`);
  process.exit(1);
}

const hist = new Map<number, number>();
for (const e of bank) hist.set(e.words.length, (hist.get(e.words.length) ?? 0) + 1);
console.log(`${LEGACY ? "legacy" : "wheelRev 1"} bank ${bank.length}; words per board`, Object.fromEntries([...hist].sort()),
  `; rejected: ${rejectedFew} under ${CFG.minWords} words, ${rejectedLayout} no layout`,
  `; size max ${Math.max(...bank.map((e) => e.cols))}×${Math.max(...bank.map((e) => e.rows))}`);

const text = LEGACY
  ? `/**
 * Letter Wheel bank — generated by scripts/letter-wheel-bank.ts. Do not edit by hand.
 */
import type { LetterWheelSlot } from "./types";

export interface LetterWheelBankEntry {
  cols: number;
  rows: number;
  letters: string;
  slots: LetterWheelSlot[];
  words: string[];
}

export const LETTER_WHEEL_BANK: LetterWheelBankEntry[] = ${JSON.stringify(bank)};
`
  : `/**
 * Roundabout wheelRev 1 bank (11–14 words, at most 11 × 9) — generated by
 * scripts/letter-wheel-bank.ts. Do not edit by hand. Server-only.
 */
import type { LetterWheelBankEntry } from "./letterWheelBank.server";

export const LETTER_WHEEL_BANK_REV1: LetterWheelBankEntry[] = ${JSON.stringify(bank)};
`;
const target = OUT ?? new URL(`../src/lib/duel/${LEGACY ? "letterWheelBank" : "letterWheelBankRev1"}.server.ts`, import.meta.url).pathname;
if (CHECK) {
  const have = readFileSync(target, "utf8");
  if (have !== text) {
    console.error(`FAIL: ${target} differs from a fresh build`);
    process.exit(1);
  }
  console.log(`ok: ${target} rebuilds byte for byte`);
} else writeFileSync(target, text);
