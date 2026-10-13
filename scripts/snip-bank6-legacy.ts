/**
 * Old-round records for Scrumper snipRev 6 (Oct 2026 bank growth): real
 * skill-band runs on snipRev 5 (the Tuning E tall bank rooms stamped before
 * it), replayed through the server path of the code at <root>, recorded as
 * score + FNV-1a of the replayed final state together with the encoded log.
 * snip-bank6-check replays every log on today's code and must reach the same
 * score and the same state, so stored snipRev 5 rounds provably replay and
 * score exactly as before. (Older revisions keep arcade-tuning-e-check's and
 * arcade-batch4-check's fixtures.)
 *
 *   bun scripts/arcade-skill-bands.ts snip --rev=e --seeds=3 --save=<logs>   (at <root>)
 *   bun scripts/snip-bank6-legacy.ts <root> <logs> > scripts/fixtures/snip-bank6-legacy.json
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";

const PER_LEVEL = 3;
const LEVELS = ["average", "good", "great", "near"] as const;

export interface SnipBank6Record {
  rev: number;
  level: string;
  seed: number;
  score: number;
  stateHash: number;
  /** The encoded run, gzip + base64. */
  raw: string;
}

if (import.meta.main) {
  const root = process.argv[2]!;
  const logs = process.argv[3]!;
  const { GAME_BY_TYPE } = await import(`${root}/scripts/arcade-skill-bands/games.ts`);
  const spec = GAME_BY_TYPE.get("snip");
  // `--rev=e` saves the Tuning E revision (snipRev 5) as "next".
  const rev = spec.tunee;
  const out: SnipBank6Record[] = [];
  for (const level of LEVELS)
    for (let n = 0; n < PER_LEVEL; n++) {
      const raw = readFileSync(`${logs}/snip/next-${level}-${n}.txt`, "utf8");
      const seed = spec.seedFor(n);
      const result = spec.replay(seed, raw, rev);
      if (result.flagged) throw new Error(`${level} ${n}: the saved run is flagged`);
      out.push({ rev, level, seed, score: result.score, stateHash: fnv(JSON.stringify(result.state)), raw: gzipSync(raw).toString("base64") });
    }
  console.log(JSON.stringify({ recorded: `code on main before snipRev 6 (${process.env.SNIP_LEGACY_COMMIT ?? "unknown"})`, runs: out }));
}
