/**
 * wavefront-deal-check (the Retro overhaul, stage 3, 16 Nov 2026; ~1 min, no browser): Wavefront's wavRev 15 deal.
 *
 *  1. Every stored witness (scripts/fixtures/wavefront-big-deal-witness.json.gz) scores exactly 200 through the server
 *     replay, unflagged, at every level (Normal, Easy, Hard, Expert), and src/lib/duel/wavefrontDeal.server.ts is exactly
 *     what scripts/wavefront-big-deal.ts builds from them (so every dealt seed has a witness at every level).
 *  2. Rooms and practice deal wavRev 15 only on those seeds: 2,000 seeded deals, at Normal and at each level, every one in
 *     WAV_DEAL; the deal spreads over the list (every seed reachable from the room seed).
 *  3. With the preRetro pin the deal is wavRev 13 on the room seed itself, as before stage 3.
 */
import { readFileSync } from "node:fs";

import { generatePuzzle } from "../src/lib/duel/generate.server";
import { pinPreRetro, pinWavPreWide } from "../src/lib/duel/arcade.server"; // Changed with Joe's approval, 23 Nov 2026 (D5's wavRev 16)
import { withSeededRandom } from "../src/lib/duel/random";
import { WAV_DEAL, wavDealSeed } from "../src/lib/duel/wavefrontDeal.server";
import { WAV_REV_BIG, WAV_REV_KEEP } from "../src/lib/arcade/wavefront";
import { checkWitnesses, WAV_DEAL_FILE, WAV_DEAL_LEVELS, wavDealSource } from "./wavefront-big-deal";

let checks = 0;
const failures: string[] = [];
function ok(cond: unknown, label: string): void {
  checks += 1;
  if (!cond) failures.push(`  ✗ ${label}`);
}

/* 1 */
{
  const { seeds, tried, bad } = checkWitnesses();
  ok(seeds.length >= 60, `at least 60 seeds dealt (${seeds.length} of ${tried} candidates)`);
  ok(bad.length === 0, `every witness scores 200 through the server replay at ${WAV_DEAL_LEVELS.join(", ")} (${bad.slice(0, 5).join("; ")})`);
  ok(new Set(seeds).size === seeds.length, "no seed twice");
  ok(readFileSync(WAV_DEAL_FILE, "utf8") === wavDealSource(seeds, tried), "wavefrontDeal.server.ts is exactly the witnessed seeds");
  ok(WAV_DEAL.join() === seeds.join(), "WAV_DEAL lists the witnessed seeds in order");
}

/* 2 */
{
  // Changed with Joe's approval, 23 Nov 2026 (routine consequence of D5's wavRev 16, the wider formation): rooms deal wavRev 16
  // from its own deal (wavefront-wide-check); the wavRev 15 deal proved here is dealt with the wavPreWide pin.
  pinWavPreWide(true);
  const dealt = new Set(WAV_DEAL);
  let outside = 0;
  let wrongRev = 0;
  for (const level of ["normal", ...WAV_DEAL_LEVELS.filter((l) => l !== "normal")] as const) {
    for (let i = 0; i < 500; i++) {
      const p = withSeededRandom(0x5eed + i * 7919, () => generatePuzzle("wavefront", level === "normal" ? {} : { level })) as unknown as Record<string, number>;
      if (!dealt.has(p["seed"]!)) outside += 1;
      if (p["wavRev"] !== WAV_REV_BIG) wrongRev += 1;
    }
  }
  ok(outside === 0, `2,000 deals across the levels all on a witnessed seed (${outside} outside)`);
  ok(wrongRev === 0, `every deal is wavRev 15 (${wrongRev} not)`);
  pinWavPreWide(false); // Changed with Joe's approval, 23 Nov 2026 (D5's wavRev 16)
  const reach = new Set(Array.from({ length: WAV_DEAL.length * 3 }, (_, k) => wavDealSeed(k * 104729 + 17)));
  ok(reach.size === WAV_DEAL.length, `every dealt seed reachable from a room seed (${reach.size} of ${WAV_DEAL.length})`);
}

/* 3 */
{
  pinPreRetro(true);
  const p = withSeededRandom(0x5eed, () => generatePuzzle("wavefront")) as unknown as Record<string, number>;
  pinPreRetro(false);
  ok(p["wavRev"] === WAV_REV_KEEP, `preRetro deals wavRev 13 (${p["wavRev"]})`);
}

if (failures.length) {
  console.log(failures.join("\n"));
  console.log(`FAIL wavefront-deal-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS wavefront-deal-check: ${checks} checks — every dealt wavRev 15 seed has a witness at 200 through the server replay at every level, and rooms deal only those seeds`);
