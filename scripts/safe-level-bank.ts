/**
 * Safe Cracker's level banks (the Logic overhaul's levels, 16 Nov 2026; src/lib/duel/safe.server.ts generateSafeLevel):
 * Expert cards (five dials of 0–20, seven clues, each needed) take about two seconds each to prove, so rooms deal them
 * from a bank built here. Card i is generateSafeLevel under seed SAFE_LEVEL_SEED.expert + i; the bank is the first N
 * distinct cards by index, built over four worker processes, so a rebuild is byte for byte the same.
 *
 *   bun scripts/safe-level-bank.ts            write src/lib/duel/safeLevelBank.server.json
 *   bun scripts/safe-level-bank.ts --check    rebuild and compare, writing nothing
 */
import { readFileSync, writeFileSync } from "node:fs";

import { generateSafeLevel } from "../src/lib/duel/safe.server";
import type { SafeLevel } from "../src/lib/duel/logicLevels";
import { withSeededRandom } from "../src/lib/duel/random";
import type { SafePuzzleData } from "../src/lib/duel/types";
import { gameLevelSettings } from "../src/lib/levels/gameLevels";

// D4 (22 Nov 2026): Hard's five dials and Expert's six, each bank under its own seed.
export const SAFE_LEVEL_SEED = { hard: 20261165, expert: 20261164 } as const;
export const SAFE_LEVEL_BANK_SIZE = { hard: 200, expert: 200 } as const;
const WORKERS = 4;
const OUT = new URL("../src/lib/duel/safeLevelBank.server.json", import.meta.url);
type BankLevel = keyof typeof SAFE_LEVEL_SEED;

const partArg = process.argv.find((a) => a.startsWith("--part="));
if (partArg) {
  const [level, k, n, cap] = partArg.slice("--part=".length).split("/") as [BankLevel, string, string, string];
  const settings = gameLevelSettings<SafeLevel>("safe", level)!;
  for (let i = Number(k); i < Number(cap); i += Number(n)) {
    // A seed whose search finds no card is passed over (D4: the six-dial cards); the bank is still the first N by index.
    let p: SafePuzzleData;
    try {
      p = withSeededRandom(SAFE_LEVEL_SEED[level] + i, () => generateSafeLevel(settings));
    } catch {
      continue;
    }
    console.log(JSON.stringify({ i, puzzle: p }));
  }
  process.exit(0);
}

async function build(level: BankLevel): Promise<SafePuzzleData[]> {
  const size = SAFE_LEVEL_BANK_SIZE[level];
  // Twenty spare seeds, sixty from D4 (22 Nov 2026: about one six-dial seed in twelve finds no card).
  const cap = size + 60;
  const outputs = await Promise.all(
    Array.from({ length: WORKERS }, async (_, k) => {
      const child = Bun.spawn(["bun", import.meta.path, `--part=${level}/${k}/${WORKERS}/${cap}`], { stdout: "pipe", stderr: "inherit" });
      const text = await new Response(child.stdout).text();
      if ((await child.exited) !== 0) throw new Error(`worker ${k} failed`);
      return text;
    }),
  );
  const kept = outputs.flatMap((t) => t.split("\n").filter(Boolean)).map((l) => JSON.parse(l) as { i: number; puzzle: SafePuzzleData }).sort((a, b) => a.i - b.i);
  const bank: SafePuzzleData[] = [];
  const seen = new Set<string>();
  for (const { puzzle } of kept) {
    const key = puzzle.clues.map((c) => c.text).join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    bank.push(puzzle);
    if (bank.length === size) break;
  }
  if (bank.length < size) throw new Error(`${level}: only ${bank.length} boards`);
  console.log(`${level}: ${bank.length} boards`);
  return bank;
}

if (import.meta.main) {
  const bank = { hard: await build("hard"), expert: await build("expert") };
  const text = JSON.stringify(bank);
  if (process.argv.includes("--check")) {
    const ok = readFileSync(OUT, "utf8") === text;
    console.log(ok ? "PASS: the bank rebuilds byte for byte" : "FAIL: the bank differs from a rebuild");
    process.exit(ok ? 0 : 1);
  }
  writeFileSync(OUT, text);
  console.log("wrote", OUT.pathname);
}
