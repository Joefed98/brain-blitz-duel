/**
 * The audit's half-run examples for Flash, Bang On and Pipeline (docs/audit-nov-2026/scoring.md issues 9 and 18), as
 * rooms deal them today (or with `--old`, on the stamps before 7 Nov 2026: tapRev 6, pipesRev 3). A report, not a check;
 * speed-pipes-nov7-check asserts the same shapes. The kit bands are `bun scripts/standard-bands.ts reaction stopwatch
 * pipes --seeds=30` (docs/speed-pipes-scoring-nov-2026.md has both).
 *
 *   bun scripts/speed-pipes-nov7-bands.ts [--old]
 */
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { encodeTapTimes } from "../src/lib/duel/tapLog";
import { watchLifeMs, watchStop } from "../src/lib/duel/stopWatch";
import { STOPWATCH_GAP_MS, STOPWATCH_LEAD_IN_MS, type PuzzleData, type PuzzleType, type StopWatchSpec } from "../src/lib/duel/types";
import { rotateMask, tileOpenings } from "../src/lib/duel/logic";
import { encodePipesTapAnswer, pipesAfterTaps } from "../src/lib/duel/depth4/pipesTaps";
import { pinPreNov7 } from "../src/lib/duel/speedPipesNov7";

type Of<T extends PuzzleType> = Extract<PuzzleData, { type: T }>;
const deal = <T extends PuzzleType>(type: T, seed: number): Of<T> => withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed })) as Of<T>;

/** Flash: `hit` of the flashes answered `ms` after they show, the rest missed (no tap). */
export function flashRun(p: Of<"reaction">, hit: readonly boolean[], ms: number): string {
  return encodeTapTimes(p.flashes.flatMap((at, i) => (hit[i] ? [at + ms] : [])));
}

/** The elapsed ms on a watch whose stop is closest to the zone's centre. */
export function bestStop(spec: StopWatchSpec): number {
  let best = 0;
  let bestD = Infinity;
  for (let e = 0; e < watchLifeMs(spec); e++) {
    const d = watchStop(spec, e).distance;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/** Bang On: the stopped watches at their best, the others left to run out. */
export function bangOnRun(p: Of<"stopwatch">, stopped: readonly boolean[]): string {
  const taps: number[] = [];
  let start = STOPWATCH_LEAD_IN_MS;
  p.watches.forEach((spec, i) => {
    const at = stopped[i] ? start + bestStop(spec) : start + watchLifeMs(spec);
    if (stopped[i]) taps.push(at);
    start = at + STOPWATCH_GAP_MS;
  });
  return encodeTapTimes(taps);
}

/** Pipeline: the fewest taps to the stored solution, tile by tile in index order, cut to the first `share` of them. */
export function pipesIndexOrder(p: Of<"pipes">, share: number): string {
  const taps: number[] = [];
  p.tiles.forEach((tile, i) => {
    for (let t = 0; t < 4; t++) if (rotateMask(tileOpenings(tile), t) === (p.solution![i]! & 15)) {
      for (let k = 0; k < t; k++) taps.push(i);
      break;
    }
  });
  const cut = taps.slice(0, Math.round(taps.length * share));
  return encodePipesTapAnswer(pipesAfterTaps(p.tiles, cut), cut);
}

if (import.meta.main) {
  if (process.argv.includes("--old")) pinPreNov7(true);
  const flash = deal("reaction", 7001);
  const stamp = (p: PuzzleData, key: string) => String((p as unknown as Record<string, unknown>)[key]);
  console.log(`Flash (tapRev ${stamp(flash, "tapRev")}, ${flash.flashes.length} flashes, seed 7001), every hit at 160 ms:`);
  for (let k = flash.flashes.length; k >= 0; k--) {
    const hit = flash.flashes.map((_, i) => i < k);
    console.log(`  ${k} hit: ${gradeAnswer(flash, flashRun(flash, hit, 160), 0).score}`);
  }
  const bang = deal("stopwatch", 7001);
  console.log(`Bang On (tapRev ${stamp(bang, "tapRev")}, seed 7001), the stopped watches dead on, the rest missed:`);
  for (const k of [10, 8, 5, 3, 1]) {
    const first = gradeAnswer(bang, bangOnRun(bang, bang.watches.map((_, i) => i < k)), 0).score;
    const alt = gradeAnswer(bang, bangOnRun(bang, bang.watches.map((_, i) => i % 2 === 0 ? i / 2 < k : false)), 0).score;
    console.log(`  ${k} of 10 stopped: first ${k} ${first}${k === 5 ? `, every other one ${alt}` : ""}`);
  }
  for (const seed of [11, 33, 44]) {
    const p = deal("pipes", seed);
    const line = [0, 0.25, 0.5, 0.75, 1].map((s) => `${s * 100}% ${gradeAnswer(p, pipesIndexOrder(p, s), 0).score}`).join(", ");
    console.log(`Pipeline (pipesRev ${stamp(p, "pipesRev")}, seed ${seed}), the fewest taps in index order, unfinished at the buzzer: ${line}`);
  }
}
