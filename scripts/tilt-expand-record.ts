/**
 * Records the Tilt expansion fixtures (scripts/fixtures/tilt-expand-*.json.gz) from skill-band bot logs
 * (`bun scripts/arcade-skill-bands.ts tilt --rev=x --save=<dir>`: "live" logs for --legacy, "next" for --new):
 *
 *   bun scripts/tilt-expand-record.ts --legacy <dir>   # tiltRev 6 runs, recorded before tiltRev 8 existed
 *   bun scripts/tilt-expand-record.ts --new <dir>      # tiltRev 8 runs
 *
 * Each entry keeps the seed, revision, encoded log, the server's score and a digest of the final state
 * (every field but the mazes), so tilt-expand-check proves they replay exactly.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { decodeTiltRun, encodeTiltRun, replayTiltRun } from "../src/lib/duel/tilt";

export function tiltStateDigest(state: object): string {
  const { list: _list, ...rest } = state as Record<string, unknown>;
  const text = JSON.stringify(rest);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return `${text.length}:${h.toString(16)}`;
}

if (import.meta.main) {
  const mode = process.argv[2];
  const dir = process.argv[3]!;
  const rev = Number(process.argv[4] ?? (mode === "--legacy" ? 6 : 8));
  const out = mode === "--legacy" ? "scripts/fixtures/tilt-expand-legacy.json.gz" : "scripts/fixtures/tilt-expand-runs.json.gz";
  const runs: { level: string; n: number; seed: number; rev: number; raw: string; score: number; digest: string; older?: Record<string, [number, string]> }[] = [];
  for (const level of ["average", "good", "great", "near"]) {
    for (let n = 0; n < 40 && runs.filter((r) => r.level === level).length < 8; n++) {
      let text: string;
      try {
        text = readFileSync(`${dir}/tilt/${mode === "--legacy" ? "live" : "next"}-${level}-${n}.txt`, "utf8");
      } catch {
        continue;
      }
      let raw = text.trim();
      const seed = Number(raw.split("|")[0]);
      let r = replayTiltRun(seed, raw, rev);
      if (mode !== "--legacy" && r.desyncTick === null && r.reason === "score did not match the replay") {
        // A log played before the curve's last refit: the same inputs, claiming today's score.
        raw = encodeTiltRun({ ...decodeTiltRun(raw)!, claimedScore: r.score });
        r = replayTiltRun(seed, raw, rev);
      }
      if (r.flagged || r.desyncTick !== null) throw new Error(`${level} #${n}: replay flagged (${r.reason ?? ""})`);
      // Legacy: the same log on every older revision too (whatever it does there), so each one's play is pinned.
      const older: Record<string, [number, string]> = {};
      if (mode === "--legacy")
        for (const o of [0, 2, 3, 4, 5]) {
          const x = replayTiltRun(seed, raw, o || null);
          older[o] = [x.score, tiltStateDigest(x.state)];
        }
      runs.push({ level, n, seed, rev, raw, score: r.score, digest: tiltStateDigest(r.state), ...(mode === "--legacy" ? { older } : {}) });
    }
  }
  writeFileSync(out, gzipSync(JSON.stringify({ runs })));
  console.log(`${out}: ${runs.length} runs (${readdirSync(`${dir}/tilt`).length} logs)`);
}
