/**
 * The scoring standard's sanity report (docs/scoring-standard.md), not a check: each game's kit players (nothing, spam,
 * average, good, great, near-perfect) on room seeds, graded as phones send them. Better play must score higher;
 * random play stays near 0.
 *
 *   bun scripts/standard-bands.ts [types…] [--seeds=12] [--from=6100]
 */
import type { PuzzleType } from "../src/lib/duel/types";
import { STANDARD_STAMPS } from "../src/lib/duel/standard/stamps";
import { bandLine, kitBands } from "./standard-lib";

const args = process.argv.slice(2);
const n = Number(args.find((a) => a.startsWith("--seeds="))?.slice(8) ?? 12);
const from = Number(args.find((a) => a.startsWith("--from="))?.slice(7) ?? 6100);
const types = (args.filter((a) => !a.startsWith("--")) as PuzzleType[]);
const list = types.length ? types : (Object.keys(STANDARD_STAMPS) as PuzzleType[]);
const seeds = Array.from({ length: n }, (_, i) => from + i * 7);
for (const type of list) {
  console.log(`\n${type}`);
  for (const r of kitBands(type, seeds)) console.log("  " + bandLine(r));
}
