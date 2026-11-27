/**
 * Box Six's level banks (the Logic overhaul's levels, 16 Nov 2026; src/lib/duel/logic.server.ts generateSudokuLevel):
 * Hard and Expert boards (needing one / two advanced steps) take up to seconds each to find, so rooms deal them from a
 * bank built here. Board i of a level is generateSudokuLevel under seed SUDOKU_LEVEL_SEED[level] + i; the bank is the
 * first N distinct boards by index, built over four worker processes, so a rebuild is byte for byte the same.
 *
 *   bun scripts/sudoku-level-bank.ts            write src/lib/duel/sudokuLevelBank.server.json
 *   bun scripts/sudoku-level-bank.ts --check    rebuild and compare, writing nothing
 */
import { readFileSync, writeFileSync } from "node:fs";

import { generateSudokuLevel } from "../src/lib/duel/logic.server";
import type { SudokuLevel } from "../src/lib/duel/logicLevels";
import { withSeededRandom } from "../src/lib/duel/random";
import type { SudokuPuzzleData } from "../src/lib/duel/types";
import { gameLevelSettings } from "../src/lib/levels/gameLevels";

export const SUDOKU_LEVEL_SEED = { hard: 20261161, expert: 20261162 } as const;
export const SUDOKU_LEVEL_BANK_SIZE = { hard: 200, expert: 200 } as const;
const WORKERS = 4;
const OUT = new URL("../src/lib/duel/sudokuLevelBank.server.json", import.meta.url);
type BankLevel = keyof typeof SUDOKU_LEVEL_SEED;

const partArg = process.argv.find((a) => a.startsWith("--part="));
if (partArg) {
  const [level, k, n, cap] = partArg.slice("--part=".length).split("/") as [BankLevel, string, string, string];
  const settings = gameLevelSettings<SudokuLevel>("sudoku", level)!;
  for (let i = Number(k); i < Number(cap); i += Number(n)) {
    // A seed whose search finds no board of the level's grade is passed over (D4, 22 Nov 2026: Expert's eight or nine
    // numbers and three advanced steps leave a few seeds without one); the bank is still the first N by index.
    let p: SudokuPuzzleData;
    try {
      p = withSeededRandom(SUDOKU_LEVEL_SEED[level] + i, () => generateSudokuLevel(settings));
    } catch {
      continue;
    }
    // The bank keeps the board; the level's clock and rules are added at the deal.
    console.log(JSON.stringify({ i, puzzle: { type: "sudoku", givens: p.givens, solution: p.solution } }));
  }
  process.exit(0);
}

async function build(level: BankLevel): Promise<SudokuPuzzleData[]> {
  const size = SUDOKU_LEVEL_BANK_SIZE[level];
  const cap = size + 20;
  const outputs = await Promise.all(
    Array.from({ length: WORKERS }, async (_, k) => {
      const child = Bun.spawn(["bun", import.meta.path, `--part=${level}/${k}/${WORKERS}/${cap}`], { stdout: "pipe", stderr: "inherit" });
      const text = await new Response(child.stdout).text();
      if ((await child.exited) !== 0) throw new Error(`worker ${k} failed`);
      return text;
    }),
  );
  const kept = outputs.flatMap((t) => t.split("\n").filter(Boolean)).map((l) => JSON.parse(l) as { i: number; puzzle: SudokuPuzzleData }).sort((a, b) => a.i - b.i);
  const bank: SudokuPuzzleData[] = [];
  const seen = new Set<string>();
  for (const { puzzle } of kept) {
    const key = puzzle.givens.join("");
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
