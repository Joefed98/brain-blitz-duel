/** Offline builder: rejected or duplicate candidates never enter the bank. */
import { writeFileSync } from "node:fs";
import { generateProvenFlood, FLOOD_BANK_SIZE } from "../src/lib/duel/flood.server";
import type { FloodPuzzleData } from "../src/lib/duel/types";
const bank: FloodPuzzleData[] = [];
const seen = new Set<string>();
while (bank.length < FLOOD_BANK_SIZE) {
  const puzzle = generateProvenFlood();
  const key = puzzle.grid.join(",");
  if (seen.has(key)) continue;
  seen.add(key);
  bank.push(puzzle);
  if (bank.length % 10 === 0) console.log(`Proven Colour Flood boards: ${bank.length}/${FLOOD_BANK_SIZE}`);
}
writeFileSync(new URL("../src/lib/duel/floodBank.server.json", import.meta.url), JSON.stringify(bank));
console.log(`Final bank: ${bank.length} distinct boards; par ${Math.min(...bank.map(p => p.par))}–${Math.max(...bank.map(p => p.par))}; no fallbacks.`);
