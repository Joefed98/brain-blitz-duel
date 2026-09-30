/** 50 generated boards of each type: unique solutions, sizes in range, solution passes the shared rules. */
import { generateShikaku } from "@/lib/duel/shikaku.server";
import { generateLightUp } from "@/lib/duel/lightUp.server";
import { countShikakuSolutions, shikakuSolved } from "@/lib/duel/shikaku";
import { countLightUpSolutions, lightUpValid } from "@/lib/duel/lightUp";

/** At least three rectangles of area 6+ with the number off the central cell(s). */
function offCentreBig(p: ReturnType<typeof generateShikaku>): boolean {
  let n = 0;
  for (const r of p.solution!) {
    const area = (r.r1 - r.r0 + 1) * (r.c1 - r.c0 + 1);
    if (area < 6) continue;
    const clue = p.clues.find((c) => Math.floor(c.cell / p.size) >= r.r0 && Math.floor(c.cell / p.size) <= r.r1 && c.cell % p.size >= r.c0 && c.cell % p.size <= r.c1)!;
    const d = Math.abs(Math.floor(clue.cell / p.size) - (r.r0 + r.r1) / 2) + Math.abs((clue.cell % p.size) - (r.c0 + r.c1) / 2);
    if (d > 1) n++;
  }
  return n >= 3;
}

let fail = 0;
let t = performance.now();
const counts: number[] = [];
for (let i = 0; i < 50; i++) {
  const p = generateShikaku();
  counts.push(p.clues.length);
  const ones = p.solution!.filter((r) => r.r0 === r.r1 && r.c0 === r.c1).length;
  if (countShikakuSolutions(p.clues, 3) !== 1 || !shikakuSolved(p.solution!, p.clues) || p.clues.length < 12 || p.clues.length > 14 || ones > 1 || p.clues.filter((c) => c.n === 2).length > 2 || !offCentreBig(p)) fail++;
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
  if (p.size !== 7 || countLightUpSolutions(p, 3) !== 1 || !lightUpValid(p, p.solution!) || p.walls.length < 10 || p.walls.length > 13 || p.wallNumbers.filter((n) => n >= 0).length !== Math.round(p.walls.length * 0.7)) f2++;
}
console.log(`lightup 50: ${50 - f2} unique · walls ${Math.min(...walls)}-${Math.max(...walls)} · numbered ${Math.min(...nums)}-${Math.max(...nums)} · ${((performance.now() - t) / 50).toFixed(0)}ms each`);
if (fail || f2) process.exit(1);
