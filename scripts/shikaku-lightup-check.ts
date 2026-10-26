/**
 * 50 generated boards of each type: unique solutions, sizes in range, solution passes the shared rules. Rooms deal
 * the depth revision's taller boards (depthRev 1, 25 Oct 2026: Shikaku 10 × 11 with 17–21 rectangles, Lamplighter
 * 9 × 10 with 20–25 walls); the boards rooms dealt before (10 × 10 with 18–22, 9 × 9 with 18–23) are proved too, 25 each.
 */
import { generateLegacyShikaku, generateShikaku, shikakuEqualAdjacentPairs } from "@/lib/duel/shikaku.server";
import { generateLightUp, LIGHTUP_DEPTH_MAX_WALLS, LIGHTUP_DEPTH_MIN_WALLS, LIGHTUP_MAX_WALLS, LIGHTUP_MIN_WALLS } from "@/lib/duel/lightUp.server";
import { countShikakuSolutions, shikakuHeightOf, shikakuSolved } from "@/lib/duel/shikaku";
import { countLightUpSolutions, lightUpHeightOf, lightUpValid, LIGHTUP_SIZE } from "@/lib/duel/lightUp";

/** At least four rectangles of area 6+ with the number off the central cell(s). */
function offCentreBig(p: ReturnType<typeof generateShikaku>): boolean {
  let n = 0;
  for (const r of (p.solution ?? [])) {
    const area = (r.r1 - r.r0 + 1) * (r.c1 - r.c0 + 1);
    if (area < 6) continue;
    const clue = p.clues.find((c) => Math.floor(c.cell / p.size) >= r.r0 && Math.floor(c.cell / p.size) <= r.r1 && c.cell % p.size >= r.c0 && c.cell % p.size <= r.c1);
    if (!clue) return false;
    const d = Math.abs(Math.floor(clue.cell / p.size) - (r.r0 + r.r1) / 2) + Math.abs((clue.cell % p.size) - (r.c0 + r.c1) / 2);
    if (d > 1) n++;
  }
  return n >= 4;
}

import { encodeShikaku, decodeShikaku, scoreShikaku } from "@/lib/duel/shikaku";
import { encodeBulbs, decodeBulbs, lightUpStatus, scoreLightUp } from "@/lib/duel/lightUp";
import { gradeSubmission } from "@/lib/duel/grade";
import { SHIKAKU_TIME_MS, LIGHTUP_TIME_MS } from "@/lib/duel/types";
let fail = 0;
let t = performance.now();
const counts: number[] = [];
for (let i = 0; i < 75; i++) {
  const legacy = i >= 50;
  const p = legacy ? generateLegacyShikaku() : generateShikaku();
  const h = shikakuHeightOf(p);
  const cells = p.size * h;
  const [minRects, maxRects] = legacy ? [18, 22] : [17, 21];
  counts.push(p.clues.length);
  const answer = encodeShikaku(p.solution ?? []);
  if (!shikakuSolved(decodeShikaku(answer, p.size, h), p.clues, p.size, h)) fail++;
  for (const ms of [0, SHIKAKU_TIME_MS / 2, SHIKAKU_TIME_MS]) {
    const grade = gradeSubmission(p, answer, ms);
    if (!grade.isCorrect || grade.correctCount !== cells || grade.score !== scoreShikaku(true, ms, SHIKAKU_TIME_MS, cells)) fail++;
  }
  if (gradeSubmission(p, "", 0).isCorrect || gradeSubmission(p, "", 0).score !== 0) fail++;
  const ones = (p.solution ?? []).filter((r) => r.r0 === r.r1 && r.c0 === r.c1).length;
  if (p.size !== 10 || h !== (legacy ? 10 : 11) || countShikakuSolutions(p.clues, 3, p.size, h) !== 1 || !shikakuSolved((p.solution ?? []), p.clues, p.size, h) || p.clues.length < minRects || p.clues.length > maxRects || ones > 1 || p.clues.filter((c) => c.n === 2).length > 2 || !offCentreBig(p) || shikakuEqualAdjacentPairs((p.solution ?? [])) < 3) fail++;
}
console.log(`shikaku 50 at 10 × 11 + 25 at 10 × 10: ${75 - fail} unique · clues ${Math.min(...counts)}-${Math.max(...counts)} · ${((performance.now() - t) / 50).toFixed(0)}ms each`);
let f2 = 0;
t = performance.now();
const walls: number[] = [];
const nums: number[] = [];
const bulbCounts: number[] = [];
for (let i = 0; i < 75; i++) {
  const legacy = i >= 50;
  const p = legacy ? generateLightUp(undefined, LIGHTUP_SIZE) : generateLightUp();
  const [minWalls, maxWalls] = legacy ? [LIGHTUP_MIN_WALLS, LIGHTUP_MAX_WALLS] : [LIGHTUP_DEPTH_MIN_WALLS, LIGHTUP_DEPTH_MAX_WALLS];
  walls.push(p.walls.length);
  const solution = p.solution ?? [];
  bulbCounts.push(solution.length);
  const answer = encodeBulbs(solution);
  if (!lightUpValid(p, decodeBulbs(answer, p))) f2++;
  const status = lightUpStatus(p, solution);
  for (const ms of [0, LIGHTUP_TIME_MS / 2, LIGHTUP_TIME_MS]) {
    const grade = gradeSubmission(p, answer, ms);
    if (!grade.isCorrect || grade.score !== scoreLightUp(true, ms, LIGHTUP_TIME_MS, status.lit.size, status.whites, 0)) f2++;
  }
  if (gradeSubmission(p, "", 0).isCorrect || gradeSubmission(p, "", 0).score !== 0) f2++;
  nums.push(p.wallNumbers.filter((n) => n >= 0).length);
  if (p.size !== 9 || lightUpHeightOf(p) !== (legacy ? 9 : 10) || countLightUpSolutions(p, 3) !== 1 || !lightUpValid(p, (p.solution ?? [])) || p.walls.length < minWalls || p.walls.length > maxWalls || p.wallNumbers.filter((n) => n >= 0).length !== Math.round(p.walls.length * 0.5) || p.wallNumbers.filter((n) => n === 0).length < 2 || !p.wallNumbers.includes(3)) f2++;
}
console.log(`lightup 50 at 9 × 10 + 25 at 9 × 9: ${75 - f2} unique · walls ${Math.min(...walls)}-${Math.max(...walls)} · numbered ${Math.min(...nums)}-${Math.max(...nums)} · ${((performance.now() - t) / 50).toFixed(0)}ms each`);
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
console.log(`Planned actions: median ${median(counts)} rectangles / ${median(bulbCounts)} bulbs; limits ${SHIKAKU_TIME_MS / 1000}s / ${LIGHTUP_TIME_MS / 1000}s. Human timing is estimated, not measured.`);
if (fail || f2) process.exit(1);
