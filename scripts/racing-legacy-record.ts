/**
 * Records racingRev 1 runs on the unmodified sim (main b154694, before racingRev 2) for racing-check's legacy
 * identity proof: 6 deal seeds × the oracle, weak, average, good and near-perfect bots and a random player, each as the
 * phone's submission with the server's stored score and the final state's checksum.
 *
 *   bun scripts/racing-legacy-record.ts   (writes scripts/fixtures/racing-v1-legacy.json.gz; run only on main's sim)
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { racingChecksum, racingGameFor } from "../src/lib/arcade/racing";
import { replayRacingRun } from "../src/lib/duel/racing";
import { RACING_DEAL } from "../src/lib/duel/racingDeal.server";
import { Human } from "./arcade-skill-bands/human";
import { bot, randomBot } from "./arcade-skill-bands/bots/racing";
import { oracleRun } from "./racing-oracle";
import { racingSubmission } from "./racing-deal";

const runs: { seed: number; who: string; raw: string; score: number; checksum: number; tick: number }[] = [];
for (const k of [0, 37, 81, 150, 222, 299]) {
  const seed = RACING_DEAL[k]!;
  const logs: [string, ReturnType<typeof oracleRun>][] = [["oracle", oracleRun(seed)]];
  for (const level of ["weak", "average", "good", "near"] as const) {
    logs.push([level, bot({ game: racingGameFor(1), seed, rev: 1, human: new Human("racing", seed, level) }).events ?? []]);
  }
  logs.push(["random", randomBot({ game: racingGameFor(1), seed, rev: 1, human: new Human("racing", seed, "average") }).events ?? []]);
  for (const [who, events] of logs) {
    const raw = racingSubmission(seed, events);
    const r = replayRacingRun(seed, raw, 1);
    runs.push({ seed, who, raw, score: r.score, checksum: racingChecksum(r.state), tick: r.state.tick });
  }
}
writeFileSync(new URL("./fixtures/racing-v1-legacy.json.gz", import.meta.url), gzipSync(JSON.stringify({ recordedOn: "main b154694 (racingRev 1)", runs })));
console.log(`recorded ${runs.length} racingRev 1 runs: ${runs.map((r) => r.score).join(" ")}`);
