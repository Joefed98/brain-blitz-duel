/**
 * Records Scrumper snipRev 9 runs (the revision rooms dealt before the E8 expansion) for
 * snip-expand-check: the skill-band bot's saved logs (bun scripts/arcade-skill-bands.ts snip
 * --rev=now --save=<dir>, run on the pre-expansion code), replayed through the server path and
 * stored with their score and a digest of the final state. Run on the code before snipRev 10.
 *
 *   bun scripts/snip-expand-legacy.ts <saved dir>/snip > scripts/fixtures/snip-expand-legacy.json.gz
 */
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { SNIP_REV_STRICT } from "../src/lib/arcade/snip";
import { replaySnipRun } from "../src/lib/duel/snip";
import { roomSeed } from "./arcade-skill-bands/games";
import { snipStateDigest } from "./snip-expand-lib";

const dir = process.argv[2]!;
const runs: { level: string; n: number; seed: number; rev: number; score: number; digest: string; raw: string }[] = [];
for (const level of ["average", "good", "great", "near"])
  for (const n of [0, 1, 2, 3]) {
    const raw = readFileSync(`${dir}/live-${level}-${n}.txt`, "utf8").trim();
    const seed = roomSeed(n);
    const r = replaySnipRun(seed, raw, SNIP_REV_STRICT);
    if (r.flagged) throw new Error(`${level} ${n}: flagged (${r.reason})`);
    runs.push({ level, n, seed, rev: SNIP_REV_STRICT, score: r.score, digest: snipStateDigest(r.state), raw });
  }
process.stdout.write(gzipSync(JSON.stringify({ runs })));
console.error(`${runs.length} snipRev ${SNIP_REV_STRICT} runs: ${runs.map((r) => r.score).join(" ")}`);
