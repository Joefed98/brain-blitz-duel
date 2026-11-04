/**
 * Records tilt-rev12-check's fixtures (docs/arcade-standard/tilt.md "tiltRev 12").
 *
 *   bun scripts/tilt-rev12-record.ts --legacy   # on the tree before tiltRev 12: scripts/fixtures/tilt-rev12-legacy.json.gz
 *   bun scripts/tilt-rev12-record.ts --new      # on this tree: scripts/fixtures/tilt-rev12-runs.json.gz
 *
 * --legacy: runs on the older Tilt stamps, above all tiltRev 11 (the stamp rooms dealt before the change) at every
 * skill level, plus random drags and bot runs on tiltRev 10, 9, 8 and two pre-expansion stamps; each with its server
 * score, flag, final-state digest and checkpoints digest, so the check proves each still replays exactly as before.
 * It imports only what every tree has (tiltGameFor, the replay and tilt-rev11-record's helpers).
 *
 * --new: tiltRev 12's runs: the oracle (scripts/tilt-oracle.ts --rev=12) on four deal seeds, each a 200 through the
 * server replay, then weak, average, good and elite bot runs and random drags on three more.
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { TILT_BANK } from "../src/lib/duel/tiltBank.server";
import { botLog, encode, randomLog, row, type Row } from "./tilt-rev11-record";
import type { SkillLevel } from "./arcade-skill-bands/human";

function recordLegacy(): void {
  const runs: Row[] = [];
  const all: SkillLevel[] = ["weak", "average", "good", "great", "near", "elite", "perfect"];
  // tiltRev 11: three seeds, random drags and every skill level.
  for (let k = 0; k < 3; k++) {
    const seed = TILT_BANK[200 + k * 17]!;
    runs.push(row(11, seed, `random ${k}`, encode(11, seed, randomLog(11, seed, k + 21))));
    for (const level of all) runs.push(row(11, seed, level, encode(11, seed, botLog(11, seed, level))));
  }
  // The stamps before it: a random run and a bot run each.
  ([[10, 260], [9, 270], [8, 280], [4, 0], [null, 0]] as [number | null, number][]).forEach(([rev, at], i) => {
    const seed = rev !== null && rev >= 8 ? TILT_BANK[at]! : 3000 + i * 131;
    runs.push(row(rev, seed, "random", encode(rev, seed, randomLog(rev, seed, i + 40))));
    runs.push(row(rev, seed, i % 2 ? "weak" : "elite", encode(rev, seed, botLog(rev, seed, i % 2 ? "weak" : "elite"))));
  });
  const commit = process.env.LEGACY_COMMIT ?? "";
  writeFileSync("scripts/fixtures/tilt-rev12-legacy.json.gz", gzipSync(JSON.stringify({ recordedOn: `the tree before tiltRev 12 ${commit}`.trim(), runs })));
  console.log(`wrote ${runs.length} runs`);
}

async function recordNew(): Promise<void> {
  const { oracleRun } = await import("./tilt-oracle");
  const { TILT_DEAL_V12 } = await import("../src/lib/duel/tiltDealV12.server");
  const rev = 12;
  const runs: Row[] = [];
  for (let k = 0; k < 4; k++) {
    const seed = TILT_DEAL_V12[k * 5]!;
    runs.push(row(rev, seed, "oracle", oracleRun(seed, rev).raw));
  }
  for (let k = 0; k < 3; k++) {
    const seed = TILT_DEAL_V12[30 + k]!;
    runs.push(row(rev, seed, `random ${k}`, encode(rev, seed, randomLog(rev, seed, k))));
    for (const level of ["weak", "average", "good", "elite"] as const) runs.push(row(rev, seed, level, encode(rev, seed, botLog(rev, seed, level))));
  }
  writeFileSync("scripts/fixtures/tilt-rev12-runs.json.gz", gzipSync(JSON.stringify({ runs })));
  console.log(`wrote ${runs.length} runs`);
}

if (import.meta.main) {
  if (process.argv.includes("--new")) await recordNew();
  else if (process.argv.includes("--legacy")) recordLegacy();
  else console.log("usage: bun scripts/tilt-rev12-record.ts --legacy | --new");
}
