/**
 * Colour Flood's level banks (the Logic overhaul's levels, 15 Nov 2026; src/lib/duel/floodLevels.server.ts): Hard and
 * Expert boards take seconds each to prove, so rooms deal them from a bank built here. Candidate i of a level is one
 * painting under seed FLOOD_LEVEL_SEED[level] + i (floodLevelCandidate); the bank is the first N distinct kept
 * candidates by index, built over four worker processes, so a rebuild is byte for byte the same.
 *
 *   bun scripts/flood-level-bank.ts            write src/lib/duel/floodLevelBank.server.json
 *   bun scripts/flood-level-bank.ts --check    rebuild and compare, writing nothing
 */
import { readFileSync, writeFileSync } from "node:fs";

import { floodLevelCandidate } from "../src/lib/duel/floodLevels.server";
import { withSeededRandom } from "../src/lib/duel/random";
import type { FloodPuzzleData } from "../src/lib/duel/types";
import { gameLevelSettings } from "../src/lib/levels/gameLevels";
import type { FloodLevel } from "../src/lib/duel/logicLevels";

export const FLOOD_LEVEL_SEED = { hard: 20261115, expert: 20261116 } as const;
export const FLOOD_LEVEL_BANK_SIZE = { hard: 120, expert: 48 } as const;
const WORKERS = 4;
const OUT = new URL("../src/lib/duel/floodLevelBank.server.json", import.meta.url);
type BankLevel = keyof typeof FLOOD_LEVEL_SEED;

const partArg = process.argv.find((a) => a.startsWith("--part="));
if (partArg) {
  // Worker: candidates i ≡ k (mod n) of one level, until the coordinator's cap; one JSON line per kept board.
  const [level, k, n, cap] = partArg.slice("--part=".length).split("/") as [BankLevel, string, string, string];
  const settings = gameLevelSettings<FloodLevel>("flood", level)!;
  for (let i = Number(k); i < Number(cap); i += Number(n)) {
    const puzzle = withSeededRandom(FLOOD_LEVEL_SEED[level] + i, () => floodLevelCandidate(settings));
    if (puzzle) console.log(JSON.stringify({ i, puzzle }));
  }
  process.exit(0);
}

async function build(level: BankLevel): Promise<FloodPuzzleData[]> {
  const size = FLOOD_LEVEL_BANK_SIZE[level];
  // Kept rates (measured): Hard about 1 in 3, Expert about 1 in 2; the cap leaves room.
  const cap = size * 6;
  const outputs = await Promise.all(
    Array.from({ length: WORKERS }, async (_, k) => {
      const child = Bun.spawn(["bun", import.meta.path, `--part=${level}/${k}/${WORKERS}/${cap}`], { stdout: "pipe", stderr: "inherit" });
      const text = await new Response(child.stdout).text();
      if ((await child.exited) !== 0) throw new Error(`worker ${k} failed`);
      return text;
    }),
  );
  const kept = outputs
    .flatMap((t) => t.split("\n").filter(Boolean))
    .map((line) => JSON.parse(line) as { i: number; puzzle: FloodPuzzleData })
    .sort((a, b) => a.i - b.i);
  const bank: FloodPuzzleData[] = [];
  const seen = new Set<string>();
  for (const { puzzle } of kept) {
    const key = puzzle.grid.join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    bank.push(puzzle);
    if (bank.length === size) break;
  }
  if (bank.length < size) throw new Error(`${level}: only ${bank.length} boards from ${cap} candidates`);
  console.log(`${level}: ${bank.length} boards (${kept.length} kept of ${cap}); par ${Math.min(...bank.map((p) => p.par))}–${Math.max(...bank.map((p) => p.par))}`);
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
