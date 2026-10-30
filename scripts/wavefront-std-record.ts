/**
 * Wavefront wavRev 12 (the arcade scoring standard, 29 Oct 2026; docs/arcade-standard/wavefront.md): records the
 * perfect runs scripts/arcade-standard/wavefront.ts replays. Each is the skill-band tool's flawless player (with the
 * Oct 2026 fixes and wavRev 12's boss plan) on a room seed, its log through the server's encode + replay, kept only
 * when it scores 200: every ship, hit and wave before the boss, the boss destroyed within 20 s of its arrival, all
 * five saucers counted, both bosses' cannons destroyed and open cores hit, and no life lost.
 *
 *   bun scripts/wavefront-std-record.ts            (writes scripts/fixtures/wavefront-std-runs.json.gz)
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { WAV_REV_STD, wavStdScore, wavStdUnits, type WavState } from "../src/lib/arcade/wavefront";
import { playWavefrontPhone } from "./wavefront-phone-bands";

/** Room seed numbers (n) whose flawless run is recorded: two tuning seeds and two fresh ones. */
export const STD_PERFECT_SEEDS = [0, 3, 10001, 10003];

if (import.meta.main) {
  const runs: { n: number; seed: number; score: number; raw: string }[] = [];
  for (const n of STD_PERFECT_SEEDS) {
    const r = playWavefrontPhone("perfect", n, WAV_REV_STD);
    const s = r.state as WavState;
    console.log(`#${n}: ${r.score} · units ${wavStdUnits(s)} · ${JSON.stringify(wavStdScore(s))}`);
    if (r.score !== 200 || r.flagged) throw new Error(`seed #${n} does not score a clean 200`);
    runs.push({ n, seed: r.seed, score: r.score, raw: r.raw });
  }
  writeFileSync("scripts/fixtures/wavefront-std-runs.json.gz", gzipSync(JSON.stringify({ recorded: "wavefront-std-record (flawless bot, wavRev 12)", runs })));
  console.log(`recorded ${runs.length} wavRev 12 perfect runs`);
}
