/**
 * Roofbound's deal (flipRev 12, 3 Nov 2026; docs/arcade-standard/flip.md "flipRev 12"): writes
 * src/lib/duel/flipDeal.server.ts, the course seeds rooms deal: every stored witness route
 * (scripts/fixtures/flip-x200-witness.json.gz, one per tuning and fresh room seed) that takes every part's maximum on
 * flipRev 12 (the minute with no crash saved, all eight sweet spots, eight double flips, a flow streak of 50) and scores
 * exactly 200 through the server replay. The rest are left out of the deal.
 *
 *   bun scripts/flip-deal.ts [--check]     (--check rebuilds in memory and fails unless the file is identical)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { FLIP_REV_DEAL } from "../src/lib/arcade/flip";
import { replayFlipRun } from "../src/lib/duel/flip";
import { flipTakesAll } from "./arcade-standard/flip";
import { encodeFlipLog, FLIP_WITNESS_FIXTURE, type FlipWitness } from "./flip-x200-record";
import { flipTap } from "./flip-x200-plan";

export const FLIP_DEAL_FILE = "src/lib/duel/flipDeal.server.ts";

/** The seeds kept and those left out (with why), in the witness file's order. */
export function buildFlipDeal(): { kept: number[]; dropped: string[]; total: number } {
  const witnesses = JSON.parse(gunzipSync(readFileSync(FLIP_WITNESS_FIXTURE)).toString()) as FlipWitness[];
  const kept: number[] = [];
  const dropped: string[] = [];
  for (const w of witnesses) {
    const { raw, state } = encodeFlipLog(FLIP_REV_DEAL, w.seed, w.taps.map(flipTap));
    const r = replayFlipRun(w.seed, raw, FLIP_REV_DEAL);
    if (flipTakesAll(state) && !r.flagged && r.score === 200) kept.push(w.seed);
    else dropped.push(`${w.seed} (${r.flagged ? "flagged" : r.score}; sweet spots ${r.sweets}/${r.sweetsTotal})`);
  }
  return { kept, dropped, total: witnesses.length };
}

export function flipDealSource(kept: readonly number[], total: number): string {
  return `/**
 * Roofbound's deal (flipRev 12; built by \`bun scripts/flip-deal.ts\`, do not edit): ${kept.length} course seeds, each
 * one whose stored witness route (scripts/fixtures/flip-x200-witness.json.gz) takes every part's maximum on flipRev 12
 * and scores exactly 200 through the server replay. ${total - kept.length} of the ${total} witnesses' courses are left out.
 */
export const FLIP_DEAL: readonly number[] = [${kept.join(",")}];

/** The course a room seed deals on flipRev 12. */
export function flipDealSeed(roomSeed: number): number {
  const n = FLIP_DEAL.length;
  return FLIP_DEAL[((Math.trunc(roomSeed) % n) + n) % n]!;
}
`;
}

if (import.meta.main) {
  const { kept, dropped, total } = buildFlipDeal();
  const src = flipDealSource(kept, total);
  console.log(`${kept.length} of ${total} courses kept; left out: ${dropped.join(", ")}`);
  if (process.argv.includes("--check")) {
    const same = readFileSync(FLIP_DEAL_FILE, "utf8") === src;
    console.log(same ? `${FLIP_DEAL_FILE} is up to date` : `FAIL ${FLIP_DEAL_FILE} differs from a rebuild`);
    process.exit(same ? 0 : 1);
  }
  writeFileSync(FLIP_DEAL_FILE, src);
  console.log(`wrote ${FLIP_DEAL_FILE}`);
}
