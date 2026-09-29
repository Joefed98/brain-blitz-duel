/** 50 generated boards of each type: unique solutions, sizes in range, solution passes the shared rules. */
import { generateShikaku } from "@/lib/duel/shikaku.server";
import { generateLightUp } from "@/lib/duel/lightUp.server";
import { countShikakuSolutions, shikakuSolved } from "@/lib/duel/shikaku";
import { countLightUpSolutions, lightUpValid } from "@/lib/duel/lightUp";

let fail = 0;
let t = performance.now();
const counts: number[] = [];
for (let i = 0; i < 50; i++) {
  const p = generateShikaku();
  counts.push(p.clues.length);
  const ones = p.solution!.filter((r) => r.r0 === r.r1 && r.c0 === r.c1).length;
  if (countShikakuSolutions(p.clues, 3) !== 1 || !shikakuSolved(p.solution!, p.clues) || p.clues.length < 9 || p.clues.length > 11 || ones > 1 || p.clues.some((c) => c.n > 9)) fail++;
}
console.log(`shikaku 50: ${50 - fail} unique · clues ${Math.min(...counts)}-${Math.max(...counts)} · ${((performance.now() - t) / 50).toFixed(0)}ms each`);
let f2 = 0;
t = performance.now();
const walls: number[] = [];
const nums: number[] = [];
for (let i = 0; i < 50; i++) {
  const p = generateLightUp();
  walls.push(p.walls.length);
  nums.push(p.wallNumbers.filter((n) => n >= 0).length);
  if (countLightUpSolutions(p, 3) !== 1 || !lightUpValid(p, p.solution!) || p.walls.length < 10 || p.walls.length > 14) f2++;
}
console.log(`lightup 50: ${50 - f2} unique · walls ${Math.min(...walls)}-${Math.max(...walls)} · numbered ${Math.min(...nums)}-${Math.max(...nums)} · ${((performance.now() - t) / 50).toFixed(0)}ms each`);
if (fail || f2) process.exit(1);
