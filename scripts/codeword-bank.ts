/**
 * Builds src/lib/duel/codewordBank.server.ts: 1,000 Cryptogrid boards, each
 * proven to have exactly one solution against the full dictionary.
 *
 * Entry i is buildCodewordEntry(codewordEntrySeed(i, retry)) for the first
 * retry that yields a board, so the bank rebuilds byte-for-byte from the
 * scripts and the committed word lists.
 *
 *   bun scripts/codeword-bank.ts            write the bank
 *   bun scripts/codeword-bank.ts --check    rebuild in memory and compare (no write)
 *
 * Levels (D1, 21 Nov 2026; src/lib/levels/word/codeword.ts): `--levels` builds src/lib/duel/codewordLevelBank.server.ts
 * instead, each level's boards from its own template shape, letter range and starting letters, every one proven to have
 * exactly one decoding from those letters against the full dictionary (buildCodewordLevelEntry), and on Expert also
 * decoded from them alone by the person-like solver (codewordHuman.server.ts). Seeded, so `--levels --check` rebuilds it
 * byte for byte; `--level=easy|hard|expert` limits a run to one level (with --check, compares that level only).
 */
import { readFileSync, writeFileSync } from "node:fs";

import { buildCodewordEntry, buildCodewordLevelEntry, type CodewordLevelRules } from "../src/lib/duel/codeword.server";
import { solveCodewordLikeAHuman } from "../src/lib/duel/levels/codewordHuman.server";
import { CODEWORD_LEVELS, type CodewordLevelSettings } from "../src/lib/levels/word/codeword";
import { fmix32, saltOf } from "../src/lib/duel/wordSeed.server";

export const CODEWORD_BANK_SIZE = 1000;
const OUT = "src/lib/duel/codewordBank.server.ts";

/** The fixed generator seed for bank entry `index`, retry `retry`. */
export function codewordEntrySeed(index: number, retry: number): number {
  let h = fmix32(saltOf("codeword") ^ 1);
  h = fmix32(h ^ Math.imul(index + 1, 0x9e3779b1));
  return fmix32(h ^ Math.imul(retry + 1, 0x27d4eb2f));
}

export function buildEntry(index: number): string {
  for (let retry = 0; retry < 100; retry++) {
    const entry = buildCodewordEntry(codewordEntrySeed(index, retry));
    if (entry) return entry;
  }
  throw new Error(`codeword bank: entry ${index} found no board`);
}

function render(entries: readonly string[]): string {
  return `/**
 * Server-only Cryptogrid bank, built by scripts/codeword-bank.ts (do not edit).
 * Each entry: "<7 × 7 grid letters, # = black>|<letter of number 1, 2, …>|<given numbers>".
 * Every board is proven to have exactly one solution against the full dictionary.
 */
export const CODEWORD_BANK: readonly string[] = [
${entries.map((e) => `  ${JSON.stringify(e)},`).join("\n")}
];
`;
}

/* ------------------------------------------------------------------ levels */

export type CodewordBankLevel = "easy" | "hard" | "expert";
export const CODEWORD_BANK_LEVELS: readonly CodewordBankLevel[] = ["easy", "hard", "expert"];
const LEVEL_OUT = "src/lib/duel/codewordLevelBank.server.ts";

/** A level's rules for the entry builder, from its settings. */
export function codewordLevelRules(level: CodewordBankLevel): CodewordLevelRules {
  const s = CODEWORD_LEVELS.levels[level]!.settings as CodewordLevelSettings;
  return { shape: { size: s.size, ...s.shape }, letters: s.letters, givens: s.givens, human: s.human };
}

/** The fixed generator seed for level `level`'s entry `index`, retry `retry`. */
export function codewordLevelEntrySeed(level: CodewordBankLevel, index: number, retry: number): number {
  let h = fmix32(saltOf(`codeword-level:${level}`) ^ 1);
  h = fmix32(h ^ Math.imul(index + 1, 0x9e3779b1));
  return fmix32(h ^ Math.imul(retry + 1, 0x27d4eb2f));
}

/** True when the person-like solver decodes the board from its starting letters alone, to the real solution. */
export function codewordHumanCracks(cells: number[], numbers: number, givens: { n: number; letter: string }[], solution: string): boolean {
  const r = solveCodewordLikeAHuman(cells, numbers, givens);
  return r.solved && r.letters.join("") === solution;
}

/** Entry `index` of a level's bank: the first retry that yields a board whose grid isn't already in `seen` (the bank so far). */
export function buildLevelEntry(level: CodewordBankLevel, index: number, seen: ReadonlySet<string> = new Set()): string {
  const rules = codewordLevelRules(level);
  for (let retry = 0; retry < 400; retry++) {
    const entry = buildCodewordLevelEntry(codewordLevelEntrySeed(level, index, retry), rules, codewordHumanCracks);
    if (entry && !seen.has(entry.split("|")[0]!)) return entry;
  }
  throw new Error(`codeword ${level} bank: entry ${index} found no board`);
}

function renderLevels(banks: Readonly<Record<CodewordBankLevel, readonly string[]>>): string {
  const block = (level: CodewordBankLevel) => `  ${level}: [\n${banks[level].map((e) => `    ${JSON.stringify(e)},`).join("\n")}\n  ],`;
  return `/**
 * Server-only Cryptogrid level banks (D1, 21 Nov 2026), built by scripts/codeword-bank.ts --levels (do not edit).
 * Each entry: "<size × size grid letters, # = black>|<letter of number 1, 2, …>|<the numbers that start decoded>", the
 * size and letters by src/lib/levels/word/codeword.ts. Every board is proven to have exactly one decoding from its
 * starting letters against the full dictionary; every Expert board is decoded from them by the person-like solver.
 */
export const CODEWORD_LEVEL_BANK: Readonly<Record<"easy" | "hard" | "expert", readonly string[]>> = {
${CODEWORD_BANK_LEVELS.map(block).join("\n")}
};
`;
}

function mainLevels(): void {
  const only = process.argv.find((a) => a.startsWith("--level="))?.slice(8) as CodewordBankLevel | undefined;
  const levels = only ? [only] : CODEWORD_BANK_LEVELS;
  const banks: Record<CodewordBankLevel, string[]> = { easy: [], hard: [], expert: [] };
  for (const level of CODEWORD_BANK_LEVELS) {
    if (!levels.includes(level)) continue;
    const started = performance.now();
    const size = (CODEWORD_LEVELS.levels[level]!.settings as CodewordLevelSettings).bank;
    const seen = new Set<string>();
    for (let i = 0; i < size; i++) {
      const entry = buildLevelEntry(level, i, seen);
      seen.add(entry.split("|")[0]!);
      banks[level].push(entry);
    }
    console.log(`${level}: ${size} boards in ${((performance.now() - started) / 1000).toFixed(0)} s`);
  }
  if (process.argv.includes("--check")) {
    const file = readFileSync(LEVEL_OUT, "utf8");
    for (const level of levels) {
      const want = renderLevels({ ...banks, [level]: banks[level] }).split(`  ${level}: [`)[1]!.split("\n  ],")[0];
      const have = file.split(`  ${level}: [`)[1]?.split("\n  ],")[0];
      if (want !== have) {
        console.log(`FAIL: ${LEVEL_OUT} ${level} differs from a rebuild`);
        process.exit(1);
      }
    }
    console.log(`PASS: ${LEVEL_OUT} rebuilds byte for byte (${levels.join(", ")})`);
    return;
  }
  if (only) throw new Error("--level= needs --check (the file holds every level)");
  writeFileSync(LEVEL_OUT, renderLevels(banks));
  console.log(`wrote ${LEVEL_OUT}`);
}

if (import.meta.main && process.argv.includes("--levels")) {
  mainLevels();
} else if (import.meta.main) {
  const started = performance.now();
  const entries: string[] = [];
  for (let i = 0; i < CODEWORD_BANK_SIZE; i++) {
    entries.push(buildEntry(i));
    if ((i + 1) % 100 === 0) console.log(`${i + 1} / ${CODEWORD_BANK_SIZE} (${((performance.now() - started) / 1000).toFixed(0)} s)`);
  }
  const text = render(entries);
  if (process.argv.includes("--check")) {
    if (readFileSync(OUT, "utf8") !== text) {
      console.log(`FAIL: ${OUT} differs from a rebuild`);
      process.exit(1);
    }
    console.log(`PASS: ${OUT} rebuilds byte-for-byte (${entries.length} boards)`);
  } else {
    writeFileSync(OUT, text);
    console.log(`wrote ${OUT}: ${entries.length} boards in ${((performance.now() - started) / 1000).toFixed(0)} s`);
  }
}
