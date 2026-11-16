/**
 * Gemstone matchupRev 13 (two-hit ice and levels, docs/arcade-standard/matchup.md "matchupRev 13"): records the runs
 * gemstone-levels-check replays (scripts/fixtures/gemstone-levels-runs.json):
 *  - `witness`: for each level, skill-band bot runs that the server's replay scores 200 (the flawless level first, then
 *    the elite level under Joe's human limits, `limitHuman`), searched over room seeds from 0: 200 is reachable at
 *    every level, and on Expert by the human-limited elite player too;
 *  - `runs`: a few runs per level and skill (weak, average, elite), so a change that moves a matchupRev 13 round is
 *    noticed.
 * Each entry is the encoded log as the phone sends it (gzip, base64), its score and an FNV-1a of the final state.
 *
 *   bun scripts/gemstone-levels-record.ts > scripts/fixtures/gemstone-levels-runs.json
 */
import { gzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { playLevel, GEMSTONE_LEVELS, type GemLevel } from "./gemstone-levels-bands";
import { replayMatchupRun } from "../src/lib/duel/matchup";
import { MATCHUP_REV_ICE2 } from "../src/lib/arcade/matchup";
import type { SkillLevel } from "./arcade-skill-bands/human";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const spec: any = GAME_BY_TYPE.get("matchup" as never)!;

interface Rec { level: GemLevel; skill: string; seed: number; score: number; stateHash: number; raw: string }

function rec(level: GemLevel, skill: SkillLevel, seed: number, limits: boolean): Rec {
  const run = playLevel(level, skill, seed, limits);
  if (run.flagged) throw new Error(`${level} ${skill} ${seed}: flagged`);
  const replay = replayMatchupRun(seed, run.raw, MATCHUP_REV_ICE2, level);
  return { level, skill: skill + (limits && skill === "elite" ? "-limits" : ""), seed, score: replay.score, stateHash: fnv(JSON.stringify(replay.state)), raw: gzipSync(run.raw).toString("base64") };
}

const witness: Rec[] = [];
for (const level of GEMSTONE_LEVELS) {
  for (const [skill, want, limit] of [["perfect", 1, 400], ["elite", level === "expert" ? 3 : 1, 400]] as const) {
    let found = 0;
    for (let n = 0; n < limit && found < want; n++) {
      const r = rec(level, skill, spec.seedFor(n), true);
      if (r.score === 200) {
        witness.push(r);
        found++;
        console.error(`witness ${level} ${skill} seed ${r.seed} (n ${n})`);
      }
    }
    if (!found) console.error(`no 200 for ${level} ${skill} in ${limit} seeds`);
  }
}
const runs: Rec[] = [];
for (const level of GEMSTONE_LEVELS)
  for (const skill of ["weak", "average", "elite"] as const)
    for (let n = 0; n < 2; n++) runs.push(rec(level, skill, spec.seedFor(500 + n), true));
console.log(JSON.stringify({ recorded: "matchupRev 13 (two-hit ice and levels)", witness, runs }));
