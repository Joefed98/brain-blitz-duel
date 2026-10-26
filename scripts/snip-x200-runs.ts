/**
 * Records Scrumper snipRev 11 runs for snip-x200-check: the skill-band bot's saved logs
 * (bun scripts/arcade-skill-bands.ts snip --rev=now --seeds=3 --save=<dir>), replayed through the
 * server path and stored with their score.
 *
 *   bun scripts/snip-x200-runs.ts <saved dir>/snip > scripts/fixtures/snip-x200-runs.json.gz
 */
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { SNIP_REV_EXPAND } from "../src/lib/arcade/snip";
import { replaySnipRun } from "../src/lib/duel/snip";
import { roomSeed } from "./arcade-skill-bands/games";

const dir = process.argv[2]!;
const runs: { level: string; n: number; seed: number; score: number; raw: string }[] = [];
for (const level of ["average", "good", "great", "near"])
  for (const n of [0, 1, 2]) {
    const raw = readFileSync(`${dir}/live-${level}-${n}.txt`, "utf8").trim();
    const seed = roomSeed(n);
    const r = replaySnipRun(seed, raw, SNIP_REV_EXPAND);
    if (r.flagged) throw new Error(`${level} ${n}: flagged (${r.reason})`);
    runs.push({ level, n, seed, score: r.score, raw });
  }
process.stdout.write(gzipSync(JSON.stringify({ runs })));
console.error(`${runs.length} snipRev ${SNIP_REV_EXPAND} runs: ${runs.map((r) => r.score).join(" ")}`);
