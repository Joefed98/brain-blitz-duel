/**
 * Records skyline-overhaul-check's legacy fixture (scripts/fixtures/skyline-overhaul-legacy.json): High Rise runs on every
 * stamp before skylineRev 11 (unstamped and skylineRev 2–10), each replayed by the code of the tree given, so the check
 * can prove the Action overhaul (skylineRev 11, 15 Nov 2026) left them exactly as they were.
 *
 *   bun scripts/skyline-overhaul-record.ts <checkout of main>     # recorded on main a3f40ff7
 *
 * The players are simple deterministic drop rules (tap when the block lines up within a tolerance, with a few
 * seeded mis-timed taps), so the runs include perfect drops, trims and misses.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const sim = (await import(`${root}/src/lib/arcade/skyline.ts`)) as typeof import("../src/lib/arcade/skyline");
const plumb = (await import(`${root}/src/lib/duel/skyline.ts`)) as typeof import("../src/lib/duel/skyline");

export interface LegacyRun {
  rev: number | null;
  seed: number;
  raw: string;
  score: number;
  blocks: number;
  perfects: number;
  survived: boolean;
  endedSeconds: number;
  checksum: number;
  flagged: boolean;
  tick: number;
}

/** A player: taps when |x − top.x| ≤ tol on every `every`-th tick, plus a mis-timed tap every `slip` drops. */
export function playLog(
  game: { init: (s: number) => any; step: (s: any, t: boolean) => any; isOver: (s: any) => boolean },
  seed: number,
  tol: number,
  slip: number,
  checkpoint: (s: any) => any,
): { taps: number[]; state: any; checkpoints: any[] } {
  let s = game.init(seed);
  const taps: number[] = [];
  const checkpoints: any[] = [];
  let drops = 0;
  let wait = 0;
  for (let tick = 1; tick <= 3600 && !game.isOver(s); tick++) {
    const top = s.blocks[s.blocks.length - 1];
    let tap = false;
    if (wait > 0) wait--;
    else if (slip > 0 && drops > 0 && drops % slip === 0 && tick % 7 === 0) tap = true;
    else if (Math.abs(s.x - top.x) <= tol + (768 + 26 * s.placed) / 2) tap = true;
    if (tap) {
      taps.push(tick);
      drops++;
      wait = 6;
    }
    s = game.step(s, tap);
    if (s.tick % 300 === 0) checkpoints.push(checkpoint(s));
  }
  return { taps, state: s, checkpoints };
}

const REVS: (number | null)[] = [null, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const out: LegacyRun[] = [];
for (const rev of REVS) {
  const game = sim.skylineGameFor(rev);
  for (let k = 0; k < 6; k++) {
    const seed = 1000 + k * 7919 + (rev ?? 0) * 131;
    const tol = [0, 300, 900, 1800, 3000, 5000][k]!;
    const slip = [0, 14, 9, 0, 6, 4][k]!;
    const { taps, state, checkpoints } = playLog(game, seed, tol, slip, sim.skylineCheckpoint);
    const raw = plumb.encodeSkylineRun({ seed, claimedScore: game.score(state), inputs: taps, endTick: 0, checkpoints });
    const r = plumb.replaySkylineRun(seed, raw, rev);
    out.push({
      rev,
      seed,
      raw,
      score: r.score,
      blocks: r.blocks,
      perfects: r.perfects,
      survived: r.survived,
      endedSeconds: r.endedSeconds,
      checksum: sim.skylineCheckpoint(r.state).checksum,
      flagged: r.flagged,
      tick: r.state.tick,
    });
  }
}
writeFileSync("scripts/fixtures/skyline-overhaul-legacy.json", `${JSON.stringify({ recordedOn: process.argv[3] ?? "main a3f40ff7", runs: out }, null, 1)}\n`);
console.log(`wrote ${out.length} runs (${out.filter((r) => !r.survived).length} ended on a miss, ${out.filter((r) => r.flagged).length} flagged, blocks ${out.map((r) => r.blocks).join(" ")})`);
