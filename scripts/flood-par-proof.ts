/** Full Colour Flood par proof on every bank board. Slow — run only after rebuilding the bank (flood-bank.ts runs it). */
import { readFileSync } from "node:fs";
import type { FloodPuzzleData } from "../src/lib/duel/types";
import { floodParProof, quickFloodChecks } from "./flood-checks";

export function proveFloodBank(bank: FloodPuzzleData[]): number {
  let failures = 0;
  const check = (label: string, ok: boolean) => { if (!ok) { failures++; console.error(label); } };
  quickFloodChecks(bank, check);
  floodParProof(bank, check);
  console.log(`Colour Flood full par proof: ${bank.length} boards · ${failures} failures`);
  return failures;
}

if (import.meta.main) {
  // `--rev3` proves the floodRev 3 bank (floodBankV3.server.json) instead.
  const file = process.argv.includes("--rev3") ? "floodBankV3.server.json" : "floodBank.server.json";
  const bank = JSON.parse(readFileSync(new URL(`../src/lib/duel/${file}`, import.meta.url), "utf8")) as FloodPuzzleData[];
  if (proveFloodBank(bank)) process.exit(1);
}
