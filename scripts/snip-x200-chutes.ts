/**
 * Scrumper snipRev 11 (the 200-point expansion; phase 1 of the review, 26 Oct 2026): wider chutes over the basket.
 * A design tool, run once on the never-dealt course bank, not a check.
 *
 * Every course ends in a wooden chute: two boards sloping in from y 960 to the basket's uprights at y 1000. A fruit
 * that just misses the chute fell out of the course, which made the cut timing knife-edge. This widens each board's
 * outer end by up to CHUTE_WIDEN px (and lifts it by half that, so the slope stays gentle), as far as it stays at
 * least CLEAR px (a fruit's width) from every other piece, nest, leaf, peg and ring of the course. The art draws the
 * course data, so what is drawn is what collides. Boards already widened (their top above y 960) are left alone.
 * Afterwards the stored plans and par times must be re-proved (scripts/snip-x200-plans.ts).
 *
 *   bun scripts/snip-x200-chutes.ts            (rewrites src/lib/arcade/snipCourses.data.ts)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { SNIP_COURSES, type SnipCourse } from "../src/lib/arcade/snip";

export const CHUTE_WIDEN = 50;
export const CLEAR = 24;
type S = [number, number, number, number];

const segDist = (p: [number, number], s: S) => {
  const [x0, y0, x1, y1] = s;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const t = Math.max(0, Math.min(1, ((p[0] - x0) * dx + (p[1] - y0) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p[0] - (x0 + t * dx), p[1] - (y0 + t * dy));
};
const segSeg = (a: S, b: S) => {
  let m = Infinity;
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    m = Math.min(m, segDist([a[0] + t * (a[2] - a[0]), a[1] + t * (a[3] - a[1])], b), segDist([b[0] + t * (b[2] - b[0]), b[1] + t * (b[3] - b[1])], a));
  }
  return m;
};

/** How far a board is from everything else on the course (px). */
export function boardClearance(c: SnipCourse, board: S): number {
  const pl = c.planks ?? [];
  let m = Infinity;
  for (const o of [...pl.slice(4), ...(c.gutters ?? []), ...(c.springs ?? []), ...(c.platforms ?? [])] as S[]) m = Math.min(m, segSeg(board, o));
  for (const [x, y, r] of c.nests ?? []) m = Math.min(m, segDist([x, y], board) - r);
  for (const [x, y] of c.stars) m = Math.min(m, segDist([x, y], board) - 24);
  for (const [x, y] of [...(c.hooks ?? []), ...(c.rings ?? [])]) m = Math.min(m, segDist([x, y], board) - 20);
  return m;
}

/** A chute board widened by w px at its outer end (dir −1 left board, +1 right board). */
export function widened(board: S, dir: number, w: number): S {
  return [Math.max(2, Math.min(358, board[0] + dir * w)), board[1] - Math.round(w / 2), board[2], board[3]];
}

if (import.meta.main) {
  const path = "src/lib/arcade/snipCourses.data.ts";
  const lines = readFileSync(path, "utf8").split("\n");
  let c = 0;
  const report: string[] = [];
  const out = lines.map((line) => {
    if (!line.startsWith("  {name: ")) return line;
    const course = SNIP_COURSES[c++]!;
    const pl = course.planks ?? [];
    const a = pl[0] as S | undefined;
    const b = pl[1] as S | undefined;
    if (!a || !b || a[1] !== 960 || b[1] !== 960 || a[3] !== 1000 || b[3] !== 1000 || !(a[0] < a[2]) || !(b[0] > b[2])) {
      report.push(`${course.name}: no unwidened chute`);
      return line;
    }
    let wa = 0;
    let wb = 0;
    for (let w = CHUTE_WIDEN; w > 0; w -= 5) if (boardClearance(course, widened(a, -1, w)) >= CLEAR) { wa = w; break; }
    for (let w = CHUTE_WIDEN; w > 0; w -= 5) if (boardClearance(course, widened(b, 1, w)) >= CLEAR) { wb = w; break; }
    const na = widened(a, -1, wa);
    const nb = widened(b, 1, wb);
    report.push(`${course.name}: +${wa} / +${wb}`);
    const from = `planks: [[${a.join(",")}],[${b.join(",")}]`;
    if (!line.includes(from)) throw new Error(`${course.name}: chute text not found`);
    return line.replace(from, `planks: [[${na.join(",")}],[${nb.join(",")}]`);
  });
  if (c !== SNIP_COURSES.length) throw new Error(`saw ${c} courses`);
  writeFileSync(path, out.join("\n"));
  console.error(report.join("\n"));
}
