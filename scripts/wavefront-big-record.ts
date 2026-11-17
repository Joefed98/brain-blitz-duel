/**
 * Wavefront wavRev 15 (the Retro overhaul, stage 3, 16 Nov 2026: larger hit cells): records the perfect runs
 * scripts/arcade-standard/wavefront.ts replays on the dealt stamp, as wavefront-std-record.ts did for wavRev 12 (whose runs
 * stay as they were; the larger cells change which ship a bolt meets, so they no longer play the same on wavRev 15). Each
 * is the skill-band tool's flawless player on a room seed, its log through the server's encode + replay, kept only when it
 * scores a clean 200.
 *
 *   bun scripts/wavefront-big-record.ts            (writes scripts/fixtures/wavefront-big-runs.json.gz)
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { WAV_REV_BIG, wavStdScore, wavStdUnits, type WavState } from "../src/lib/arcade/wavefront";
import { playWavefrontPhone } from "./wavefront-phone-bands";

/** Two tuning seeds and two fresh ones: the first of each list whose flawless run scores a clean 200. */
const CANDIDATES = [Array.from({ length: 60 }, (_, i) => i), Array.from({ length: 200 }, (_, i) => 10000 + i)];

if (import.meta.main) {
  const runs: { n: number; seed: number; score: number; raw: string }[] = [];
  for (const list of CANDIDATES) {
    let kept = 0;
    for (const n of list) {
      if (kept === 2) break;
      const r = playWavefrontPhone("perfect", n, WAV_REV_BIG);
      const s = r.state as WavState;
      console.log(`#${n}: ${r.score} · units ${wavStdUnits(s)} · ${JSON.stringify(wavStdScore(s))}`);
      if (r.score !== 200 || r.flagged) continue;
      runs.push({ n, seed: r.seed, score: r.score, raw: r.raw });
      kept += 1;
    }
    if (kept < 2) throw new Error("too few clean 200s");
  }
  writeFileSync("scripts/fixtures/wavefront-big-runs.json.gz", gzipSync(JSON.stringify({ recorded: "wavefront-big-record (flawless bot, wavRev 15)", runs })));
  console.log(`recorded ${runs.length} wavRev 15 perfect runs`);
}
