/**
 * Offline builder: rejected or duplicate candidates never enter the bank.
 *
 * `--rev3` builds the floodRev 3 bank (floodBankV3.server.json, 19 Oct 2026) instead: candidate i
 * is one random grid drawn under seed FLOOD_V3_SEED + i, kept only when its par is proven in the
 * band and no blind colour cycle floods it within par + 2 (floodRev3Candidate). Candidates are
 * shared over four worker processes; the bank is the first 400 distinct kept candidates by index,
 * so a rebuild is byte for byte the same.
 */
import { writeFileSync } from "node:fs";
import { generateProvenFlood, floodRev3Candidate, FLOOD_BANK_SIZE } from "../src/lib/duel/flood.server";
import { FLOOD_REV2_SPARE_MOVES } from "../src/lib/duel/moveLimits";
import { withSeededRandom } from "../src/lib/duel/random";
import type { FloodPuzzleData } from "../src/lib/duel/types";
import { proveFloodBank } from "./flood-par-proof";

const FLOOD_V3_SEED = 20261019;
const FLOOD_V3_CANDIDATES = 3000;
const WORKERS = 4;

const partArg = process.argv.find((a) => a.startsWith("--rev3-part="));
if (partArg) {
  // Worker: candidates i ≡ k (mod n); one JSON line per kept board.
  const [k, n] = partArg.slice("--rev3-part=".length).split("/").map(Number) as [number, number];
  for (let i = k; i < FLOOD_V3_CANDIDATES; i += n) {
    const puzzle = withSeededRandom(FLOOD_V3_SEED + i, () => floodRev3Candidate(FLOOD_REV2_SPARE_MOVES));
    if (puzzle) console.log(JSON.stringify({ i, puzzle }));
  }
  process.exit(0);
}

if (process.argv.includes("--rev3")) {
  const outputs = await Promise.all(
    Array.from({ length: WORKERS }, async (_, k) => {
      const child = Bun.spawn(["bun", import.meta.path, `--rev3-part=${k}/${WORKERS}`], { stdout: "pipe", stderr: "inherit" });
      const text = await new Response(child.stdout).text();
      if ((await child.exited) !== 0) throw new Error(`worker ${k} failed`);
      return text;
    }),
  );
  const kept = outputs
    .flatMap((text) => text.split("\n").filter(Boolean))
    .map((line) => JSON.parse(line) as { i: number; puzzle: FloodPuzzleData })
    .sort((a, b) => a.i - b.i);
  const bank: FloodPuzzleData[] = [];
  const seen = new Set<string>();
  for (const { puzzle } of kept) {
    const key = puzzle.grid.join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    bank.push(puzzle);
    if (bank.length === FLOOD_BANK_SIZE) break;
  }
  if (bank.length < FLOOD_BANK_SIZE) {
    console.error(`Only ${bank.length} floodRev 3 boards from ${FLOOD_V3_CANDIDATES} candidates; raise FLOOD_V3_CANDIDATES`);
    process.exit(1);
  }
  writeFileSync(new URL("../src/lib/duel/floodBankV3.server.json", import.meta.url), JSON.stringify(bank));
  console.log(`floodRev 3 bank: ${bank.length} boards (${kept.length} kept of ${FLOOD_V3_CANDIDATES} candidates); par ${Math.min(...bank.map((p) => p.par))}–${Math.max(...bank.map((p) => p.par))}`);
  if (proveFloodBank(bank)) process.exit(1);
  process.exit(0);
}

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
// Every rebuild ends with the full 400-board par proof.
if (proveFloodBank(bank)) process.exit(1);
