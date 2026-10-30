/**
 * Records High Rise's legacy fixture for skyline-standard-check (the arcade scoring standard, skylineRev 9):
 * skill-band runs saved on skylineRev 8 (`bun scripts/arcade-skill-bands.ts skyline --rev=now --save=<dir>` on the
 * tree before the change), each replayed through the server path (replaySkylineRun) on every older revision
 * (unstamped, 2–8), stored with the replay's score, flag and an FNV-1a of its final state. Run it against a checkout
 * of the code BEFORE skylineRev 9:
 *
 *   bun scripts/skyline-standard-legacy.ts <root of the old checkout> <save dir> | gzip -9 > scripts/fixtures/skyline-standard-legacy.json.gz
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

export const SKYLINE_LEGACY_REVS: (number | null)[] = [null, 2, 3, 4, 5, 6, 7, 8];
export const SKYLINE_LEGACY_LEVELS = ["weak", "average", "good", "great", "near", "elite", "perfect"];
export const SKYLINE_LEGACY_PER_LEVEL = 4;

export interface SkylineLegacyRun {
  level: string;
  n: number;
  seed: number;
  raw: string;
  /** Per revision ("0" = unstamped): the replay's score, flag and the FNV-1a of its final state. */
  revs: Record<string, { score: number; flagged: boolean; blocks: number; perfects: number; stateHash: number }>;
}

export function fnv(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

async function main() {
  const root = resolve(process.argv[2] ?? ".");
  const dir = resolve(process.argv[3] ?? "");
  const { replaySkylineRun } = (await import(`${root}/src/lib/duel/skyline.ts`)) as typeof import("../src/lib/duel/skyline");
  const files = new Set(readdirSync(dir));
  const out: SkylineLegacyRun[] = [];
  for (const level of SKYLINE_LEGACY_LEVELS)
    for (let n = 0; n < SKYLINE_LEGACY_PER_LEVEL; n++) {
      const name = `live-${level}-${n}.txt`;
      if (!files.has(name)) throw new Error(`missing ${name}`);
      const raw = readFileSync(`${dir}/${name}`, "utf8");
      const seed = Number.parseInt(raw.split("|")[0]!, 10);
      const revs: SkylineLegacyRun["revs"] = {};
      for (const rev of SKYLINE_LEGACY_REVS) {
        const r = replaySkylineRun(seed, raw, rev);
        revs[String(rev ?? 0)] = { score: r.score, flagged: r.flagged, blocks: r.blocks, perfects: r.perfects, stateHash: fnv(JSON.stringify(r.state)) };
      }
      out.push({ level, n, seed, raw, revs });
    }
  console.log(JSON.stringify(out));
}

if (import.meta.main) await main();
