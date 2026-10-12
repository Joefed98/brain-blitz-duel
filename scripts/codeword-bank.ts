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
 */
import { readFileSync, writeFileSync } from "node:fs";

import { buildCodewordEntry } from "../src/lib/duel/codeword.server";
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

if (import.meta.main) {
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
