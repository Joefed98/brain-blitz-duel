/**
 * Jaywalk crossRev 10 (the arcade scoring standard): the traffic density each crossing was dealt at, against
 * crossRev 9's course for the same seed (CROSS_STD_DENSITY_12 is the target; a crossing whose scaled course fails
 * a proof steps a twelfth toward 12). Not a check: docs/arcade-standard/cross.md quotes it.
 *
 *   bun scripts/cross-std-density.ts [--from=0] [--seeds=60]
 */
import { crossGameFor, crossStdDensityOf, CROSS_COURSES, CROSS_REV_EXPAND, CROSS_REV_STD, CROSS_STD_DENSITY_12 } from "../src/lib/arcade/cross";
import { roomSeed } from "./arcade-skill-bands/games";

const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const from = Number(opt("from") ?? 0);
const count = Number(opt("seeds") ?? 60);
const got: number[][] = Array.from({ length: CROSS_COURSES }, () => []);
const t0 = Date.now();
for (let n = from; n < from + count; n++) {
  const seed = roomSeed(n);
  const a = crossGameFor(CROSS_REV_STD).init(seed);
  const b = crossGameFor(CROSS_REV_EXPAND).init(seed);
  for (let k = 0; k < CROSS_COURSES; k++) {
    got[k]!.push(crossStdDensityOf(a.courses[k]!, b.courses[k]!));
    if (JSON.stringify(a.courses[k]!.coins) !== JSON.stringify(b.courses[k]!.coins)) throw new Error(`seed ${seed} crossing ${k + 1}: coins moved`);
  }
}
for (let k = 0; k < CROSS_COURSES; k++) {
  const v = got[k]!;
  const hit = v.filter((d) => d === CROSS_STD_DENSITY_12[k]).length;
  console.log(`crossing ${k + 1}: target ${CROSS_STD_DENSITY_12[k]}/12, on target ${hit}/${v.length}, mean ${(v.reduce((x, y) => x + y, 0) / v.length).toFixed(2)}/12, min ${Math.min(...v)}, max ${Math.max(...v)}`);
}
console.log(`${count} seeds, ${((Date.now() - t0) / count).toFixed(0)} ms a seed (both revisions' init)`);
