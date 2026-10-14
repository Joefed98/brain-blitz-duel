/**
 * Stored Scrumper snipRev 7 runs for snip-rev7-check: real skill-band runs on
 * snipRev 7 (two seeds at each level), replayed through the server path,
 * recorded as score + FNV-1a of the replayed final state together with the
 * encoded log. snip-rev7-check replays every log on today's code and must reach
 * the same score and the same state, so snipRev 7 rounds provably replay and
 * score the same after later changes.
 *
 *   bun scripts/arcade-skill-bands.ts snip --rev=f --seeds=2 --save=<logs>
 *   bun scripts/snip-rev7-runs.ts <logs> > scripts/fixtures/snip-rev7-runs.json
 */
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { SNIP_REV_PROVEN } from "../src/lib/arcade/snip";
import { replaySnipRun } from "../src/lib/duel/snip";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { fnv } from "./arcade-tuning-a-legacy";
import type { TuningF2Record } from "./arcade-tuning-f2-legacy";

const LEVELS = ["average", "good", "great", "near"] as const;
const PER_LEVEL = 2;

if (import.meta.main) {
  const logs = process.argv[2]!;
  const spec = GAME_BY_TYPE.get("snip")!;
  const out: TuningF2Record[] = [];
  for (const level of LEVELS)
    for (let n = 0; n < PER_LEVEL; n++) {
      const raw = readFileSync(`${logs}/snip/next-${level}-${n}.txt`, "utf8");
      const seed = spec.seedFor(n);
      const result = replaySnipRun(seed, raw, SNIP_REV_PROVEN);
      if (result.flagged) throw new Error(`snip ${level} ${n}: the saved run is flagged`);
      out.push({ type: "snip", rev: SNIP_REV_PROVEN, level, seed, score: result.score, stateHash: fnv(JSON.stringify(result.state)), raw: gzipSync(raw).toString("base64") });
    }
  console.log(JSON.stringify({ recorded: "snipRev 7 skill-band runs", runs: out }));
}
