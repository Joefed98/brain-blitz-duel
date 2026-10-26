/**
 * Roofbound flipRev 8's guarantee over many seeds (a tool, not a check): builds the course for N seeds spread over
 * the room seed range (arcadeSeed draws 1 … 2^31 − 1) and counts courses without the full opportunities and the
 * re-rolls they took.
 *
 *   bun scripts/flip-x200-seeds.ts [--n=2000]
 */
import { flipCourseV8, flipGameFor, flipV8Opportunities, FLIP_REV_EXPAND } from "../src/lib/arcade/flip";

const n = Number(process.argv.find((a) => a.startsWith("--n="))?.slice(4) ?? 2000);
const game = flipGameFor(FLIP_REV_EXPAND);
let short = 0;
const t0 = performance.now();
for (let k = 0; k < n; k++) {
  const seed = ((Math.imul(k + 1, 0x9e3779b1) >>> 0) % 0x7ffffffe) + 1;
  const o = flipV8Opportunities(game.init(seed));
  if (o.goldStars !== 10 || o.trails !== 4 || o.sweetSpots !== 8 || o.speedZones !== 2) {
    short++;
    console.log(`seed ${seed}: ${JSON.stringify(o)}`);
  }
  void flipCourseV8;
}
console.log(`${n} seeds: ${short} without the full opportunities (${((performance.now() - t0) / n).toFixed(0)} ms a course)`);
