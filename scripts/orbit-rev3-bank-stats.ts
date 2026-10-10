/** Bank-only orbitRev 3 stats: fallback hops (rebuilt course), >120-unit sideways hops and stored proof ticks.
 * Usage: bun scripts/orbit-rev3-bank-stats.ts <start> <end> */
import { buildCourse3, ORBIT_REV3_WORLD_W } from "../src/lib/arcade/orbitRev3";
import { ORBIT_REV3_BANK } from "../src/lib/duel/orbitRev3Bank.server";

const [a, b] = [Number(process.argv[2]), Number(process.argv[3])];
const out: unknown[] = [];
for (const e of ORBIT_REV3_BANK.slice(a, b)) {
  let lat = 0;
  for (let i = 1; i < e.planets.length; i++) if (Math.abs(e.planets[i]![0]! - e.planets[i - 1]![0]!) / 256 > 120) lat++;
  const { planets } = buildCourse3(e.seed, ORBIT_REV3_WORLD_W);
  out.push({ seed: e.seed, hops: e.planets.length - 1, fb: (planets as any).__fallbacks ?? 0, lat, r3: e.ticks, r3ok: true, old: { ok: false } });
}
console.log(JSON.stringify(out));
