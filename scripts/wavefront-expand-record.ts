/**
 * Records the Wavefront expansion's legacy fixture (scripts/fixtures/wavefront-expand-legacy.json.gz):
 * bot runs saved by `bun scripts/arcade-skill-bands.ts wavefront --rev=now --save=<dir>` on the code
 * before wavRev 10, each replayed on every older revision with its score and final-state digest.
 * Run once, on the pre-expansion code; wavefront-expand-check proves they still replay the same.
 *
 *   bun scripts/wavefront-expand-record.ts <save-dir>
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { replayWavefrontRun } from "../src/lib/duel/wavefront";

export const LEGACY_REVS = [null, 2, 3, 4, 5, 6, 7, 8] as const;
export function stateDigest(state: unknown): string {
  return createHash("sha256").update(JSON.stringify(state)).digest("hex").slice(0, 24);
}

if (import.meta.main) {
  const dir = process.argv[2]!;
  const files = readdirSync(dir).filter((f) => f.endsWith(".txt")).sort();
  const runs: { name: string; seed: number; raw: string; revs: { rev: number | null; score: number; digest: string }[] }[] = [];
  for (const f of files) {
    const n = Number(/-(\d+)\.txt$/.exec(f)![1]);
    if (n % 5 !== 0) continue; // 8 seeds a level
    // The saved file is the encoded run itself ("seed|score|…").
    const raw = readFileSync(`${dir}/${f}`, "utf8").trim();
    const seedS = raw.split("|")[0]!;
    const seed = Number(seedS);
    runs.push({
      name: f.replace(".txt", ""),
      seed,
      raw,
      revs: LEGACY_REVS.map((rev) => {
        const r = replayWavefrontRun(seed, raw, rev);
        return { rev, score: r.score, digest: stateDigest(r.state) };
      }),
    });
  }
  writeFileSync("scripts/fixtures/wavefront-expand-legacy.json.gz", gzipSync(JSON.stringify({ recordedOn: "71faf696 (pre-wavRev 10)", runs })));
  console.log(`${runs.length} runs × ${LEGACY_REVS.length} revisions`);
}
