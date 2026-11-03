/**
 * Records racingRev 1 runs on the unmodified sim (main b154694, before racingRev 2) for racing-check's legacy
 * identity proof: 6 deal seeds × the oracle, weak, average, good and near-perfect bots and a random player, each as the
 * phone's submission with the server's stored score and the final state's checksum.
 *
 * `--rev=2` (3 Nov 2026, before racingRev 3) records racingRev 2 runs the same way on racingRev 2's deal
 * (scripts/fixtures/racing-v2-legacy.json.gz, recorded on main 6326101).
 *
 *   bun scripts/racing-legacy-record.ts [--rev=2]   (writes the fixture; run only on main's sim)
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { racingChecksum, racingGameFor } from "../src/lib/arcade/racing";
import { replayRacingRun } from "../src/lib/duel/racing";
import { RACING_DEAL } from "../src/lib/duel/racingDeal.server";
import { RACING_DEAL_V2 } from "../src/lib/duel/racingDealV2.server";
import { Human } from "./arcade-skill-bands/human";
import { bot, randomBot } from "./arcade-skill-bands/bots/racing";
import { oracleRun } from "./racing-oracle";
import { racingSubmission } from "./racing-deal";

const REV = process.argv.includes("--rev=2") ? 2 : 1;
const DEAL = REV === 2 ? RACING_DEAL_V2 : RACING_DEAL;
const runs: { seed: number; who: string; raw: string; score: number; checksum: number; tick: number }[] = [];
for (const k of [0, 37, 81, 150, 222, 299]) {
  const seed = DEAL[k]!;
  const logs: [string, ReturnType<typeof oracleRun>][] = [["oracle", oracleRun(seed, REV)]];
  for (const level of ["weak", "average", "good", "near"] as const) {
    logs.push([level, bot({ game: racingGameFor(REV), seed, rev: REV, human: new Human("racing", seed, level) }).events ?? []]);
  }
  logs.push(["random", randomBot({ game: racingGameFor(REV), seed, rev: REV, human: new Human("racing", seed, "average") }).events ?? []]);
  for (const [who, events] of logs) {
    const raw = racingSubmission(seed, events, REV);
    const r = replayRacingRun(seed, raw, REV);
    runs.push({ seed, who, raw, score: r.score, checksum: racingChecksum(r.state), tick: r.state.tick });
  }
}
const file = REV === 2 ? "./fixtures/racing-v2-legacy.json.gz" : "./fixtures/racing-v1-legacy.json.gz";
const on = REV === 2 ? "main 6326101 (racingRev 2)" : "main b154694 (racingRev 1)";
writeFileSync(new URL(file, import.meta.url), gzipSync(JSON.stringify({ recordedOn: on, runs })));
console.log(`recorded ${runs.length} racingRev ${REV} runs: ${runs.map((r) => r.score).join(" ")}`);
