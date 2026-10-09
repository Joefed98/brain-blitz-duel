/**
 * Rainbow Bridge birds revision: every level of every seed carries a stored
 * reference line that lands the coin within its ink (and no level lands with
 * no line). Also reports obstacle counts and checks old rounds are unchanged.
 *
 *   bun scripts/ink-birds-check.ts [seeds]
 */
import { inkBridgeGame, inkBridgeGameFor, inkReferenceCheck, INK_BIRD_H_FP, INK_BLOCK_H, INK_REV } from "../src/lib/arcade/inkBridge";

const SEEDS = Number(process.argv[2] ?? 15);
let failures = 0;
const fail = (m: string) => { failures++; console.error("FAIL", m); };

console.log(`obstacle thickness: blocks ${INK_BLOCK_H} px → birds ${INK_BIRD_H_FP / 256} px (${(INK_BIRD_H_FP / 256 / INK_BLOCK_H).toFixed(3)}×)`);
const sum = { old: Array(10).fill(0) as number[], neu: Array(10).fill(0) as number[] };
const t0 = performance.now();
for (let i = 0; i < SEEDS; i++) {
  const seed = (i * 2654435761 + 17) | 0;
  const a = inkReferenceCheck(seed);
  const b = inkReferenceCheck(seed, INK_REV);
  if (a.ok !== 10) fail(`blocks seed ${seed}: ${a.ok}/10 levels proven`);
  if (b.ok !== 10) fail(`birds seed ${seed}: ${b.ok}/10 levels proven`);
  a.blocks.forEach((n, k) => (sum.old[k]! += n));
  b.blocks.forEach((n, k) => (sum.neu[k]! += n));
  const birds = inkBridgeGameFor(INK_REV).init(seed);
  if (!birds.list.every((l) => l.blocks.every((o) => o.h === INK_BIRD_H_FP))) fail(`seed ${seed}: bird without thickness`);
  if (inkBridgeGame.init(seed).list.some((l) => l.blocks.some((o) => o.h !== undefined))) fail(`seed ${seed}: old blocks changed`);
  if (JSON.stringify(inkBridgeGameFor(INK_REV).init(seed)) !== JSON.stringify(birds)) fail("birds course not repeatable");
}
const avg = (v: number[]) => v.map((n) => (n / SEEDS).toFixed(2)).join(" / ");
console.log(`avg obstacles per level 1–10, blocks: ${avg(sum.old)}`);
console.log(`avg obstacles per level 1–10, birds:  ${avg(sum.neu)}`);
console.log(`${SEEDS} seeds × 10 levels × 2 versions proven in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
if (failures) process.exit(1);
console.log("ink-birds-check OK");
