/**
 * Records scripts/fixtures/bubble-standard-legacy.json.gz for bubble-standard-check: Coral Pop bubbleRev 10 runs (the
 * revision rooms dealt before the arcade scoring standard) replayed on an untouched checkout, with the score and the
 * final state's checksum and feature counters each one reached there.
 *
 *   bun scripts/arcade-skill-bands.ts bubble --rev=now --levels=all --seeds=60 --save=<runs>   (on the old checkout)
 *   cd <old checkout> && bun <this tree>/scripts/bubble-standard-legacy.ts <old checkout> <runs> <this tree>/scripts/fixtures/bubble-standard-legacy.json.gz
 * (run from the old checkout, so its "@/" imports resolve there).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

const [root, runs, outPath = "scripts/fixtures/bubble-standard-legacy.json.gz"] = process.argv.slice(2);
if (!root || !runs) throw new Error("usage: bun scripts/bubble-standard-legacy.ts <old checkout> <saved runs dir>");
const { replayBubbleRun } = await import(resolve(root, "src/lib/duel/bubble.ts"));
const { bubCheckpoint } = await import(resolve(root, "src/lib/arcade/bubble.ts"));
const { roomSeed } = await import(resolve(root, "scripts/arcade-skill-bands/games.ts"));
const REV = 10;
const LEVELS = ["weak", "average", "good", "great", "near", "elite", "perfect"];
const out: unknown[] = [];
for (const level of LEVELS) {
  for (const n of [0, 1, 2, 3]) {
    const raw = readFileSync(`${runs}/bubble/live-${level}-${n}.txt`, "utf8");
    const seed = roomSeed(n);
    const r = replayBubbleRun(seed, raw, REV);
    const s = r.state;
    out.push({ level, n, seed, rev: REV, raw, score: r.score, checksum: bubCheckpoint(s).checksum, tick: s.tick, popped: s.popped, dropped: s.dropped, chests: s.chests ?? 0, banks: s.banks ?? 0, combos: s.combos ?? 0, bombs: s.bombs ?? 0 });
  }
}
writeFileSync(outPath, gzipSync(JSON.stringify(out)));
console.log(`wrote ${out.length} bubbleRev ${REV} runs`);
