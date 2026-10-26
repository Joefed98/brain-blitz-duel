/**
 * Scrumper snipRev 11 (the 200-point expansion; docs/expansions/x200-snip.md): the fastest stored perfect
 * plans and each course's par time. A design tool, not a check.
 *
 * For every course of SNIP_COURSES, every deal (3 pin shifts × 3 wind presets) and every golden choice
 * (none, or each fruit that may be golden), it searches for the fastest human-paced plan that is perfect:
 * every fruit fed in no more strokes than the course's par, both leaves, the golden fruit fed while golden.
 * The search starts from every plan stored for the course (fixtures/snip-x200-proofs.json, any deal), shifts
 * it in time, then moves each stroke earlier or later while it stays perfect.
 *
 *   bun scripts/snip-x200-plans.ts 0,2,4 --out=<file>     search those courses, write the result
 *   bun scripts/snip-x200-plans.ts --write <file> <file>  merge into the fixture's `best` plans and write
 *                                                         each course's parT into snipCourses.data.ts
 *
 * `best` then holds per deal: "-1" the fastest perfect plan for a level with no golden fruit, "<g>" the
 * fastest with fruit g golden. A course's par time is its slowest deal's (and golden choice's) fastest
 * perfect plan, in level ticks, plus SNIP_X_PAR_MARGIN; full par-time credit is that plan's time.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { SNIP_COURSES, SNIP_X_GOLD_TICKS, SNIP_X_PAR_MARGIN } from "../src/lib/arcade/snip";
import { xDeals, xPaced, xPlayLevel, xStrokes, type XPlan, type XProofs } from "./snip-x200-lib";

const PROOFS_PATH = "scripts/fixtures/snip-x200-proofs.json";

/** The level tick the plan ends a perfect level on (null when it is not perfect). */
export function perfectTick(c: number, w: number, k: number, g: number, plan: XPlan): number | null {
  if (!xPaced(plan) || xStrokes(plan) > SNIP_COURSES[c]!.par) return null;
  const p = xPlayLevel(c, w, k, g, plan);
  if (!p.valid || !p.perfect) return null;
  if (g >= 0 && !(p.fedAt[g]! >= 0 && p.fedAt[g]! <= SNIP_X_GOLD_TICKS)) return null;
  return p.tick;
}

function strokesOf(plan: XPlan): XPlan[] {
  const out: XPlan[] = [];
  for (const c of [...plan].sort((a, b) => a[1] - b[1])) {
    const l = out.at(-1);
    if (l && c[1] === l.at(-1)![1] + 1) l.push(c);
    else out.push([c]);
  }
  return out;
}

/** The golden choices a course's deals are proved for: −1 (none) and each golden-eligible fruit. */
export function goldChoices(c: number): number[] {
  const course = SNIP_COURSES[c]!;
  return [-1, ...(course.golds ?? course.fruits.map((_, k) => k))];
}

function search(proofs: XProofs, courses: number[]): Record<string, Record<string, { plan: XPlan; tick: number }>> {
  const out: Record<string, Record<string, { plan: XPlan; tick: number }>> = {};
  const t0 = performance.now();
  for (const c of courses) {
    const course = SNIP_COURSES[c]!;
    const seeds: XPlan[] = [];
    for (const d of Object.values(proofs[String(c)]!.deals)) seeds.push(d.win, ...Object.values(d.best));
    const uniq = [...new Map(seeds.map((p) => [JSON.stringify(p), p])).values()];
    out[c] = {};
    let worst = 0;
    for (const [w, k] of xDeals(course)) {
      const d = proofs[String(c)]!.deals[`${w}:${k}`]!;
      for (const g of goldChoices(c)) {
        let best: XPlan | null = null;
        let bt = Infinity;
        const tryP = (p: XPlan) => {
          const t = perfectTick(c, w, k, g, p);
          if (t !== null && t < bt) {
            bt = t;
            best = p;
          }
        };
        for (const p of g < 0 ? Object.values(d.best) : [d.best[String(g)]!]) if (p) tryP(p);
        for (const p of uniq) for (let dd = -60; dd <= 60; dd += 3) tryP(p.map(([r, t]) => [r, t + dd]));
        for (let pass = 0; pass < 3 && best; pass++) {
          let improved = false;
          const st = strokesOf(best);
          for (let i = 0; i < st.length; i++)
            for (const dd of [-30, -20, -12, -8, -5, -3, -2, -1, 1, 2, 3, 5, 8]) {
              const before = bt;
              tryP(st.map((s, j) => (j === i ? s.map(([r, t]) => [r, t + dd] as [number, number]) : s)).flat());
              if (bt < before) improved = true;
            }
          if (!improved) break;
        }
        if (!best) throw new Error(`course ${c} deal ${w}:${k} gold ${g}: no perfect plan`);
        out[c]![`${w}:${k}:${g}`] = { plan: best, tick: bt };
        worst = Math.max(worst, bt);
      }
    }
    console.error(`${c} ${course.name}: slowest fastest-perfect ${worst} ticks (${((performance.now() - t0) / 1000).toFixed(0)} s)`);
  }
  return out;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const proofs: XProofs = JSON.parse(readFileSync(PROOFS_PATH, "utf8"));
  if (args[0] === "--write") {
    const found: Record<string, Record<string, { plan: XPlan; tick: number }>> = Object.assign({}, ...args.slice(1).map((f) => JSON.parse(readFileSync(f, "utf8"))));
    const parT: number[] = [];
    SNIP_COURSES.forEach((course, c) => {
      const f = found[String(c)];
      if (!f) throw new Error(`course ${c}: not searched`);
      let worst = 0;
      for (const [w, k] of xDeals(course)) {
        const d = proofs[String(c)]!.deals[`${w}:${k}`]!;
        const best: Record<string, XPlan> = {};
        for (const g of goldChoices(c)) {
          const r = f[`${w}:${k}:${g}`]!;
          best[String(g)] = r.plan;
          worst = Math.max(worst, r.tick);
        }
        d.best = best;
      }
      parT.push(worst + SNIP_X_PAR_MARGIN);
    });
    writeFileSync(PROOFS_PATH, JSON.stringify(proofs));
    // Each course line gets its parT after its par.
    const path = "src/lib/arcade/snipCourses.data.ts";
    const lines = readFileSync(path, "utf8").split("\n");
    let c = 0;
    const outLines = lines.map((line) => {
      if (!line.startsWith("  {name: ")) return line;
      const t = parT[c++]!;
      return line.replace(/, par: (\d+)(, parT: \d+)?/, `, par: $1, parT: ${t}`);
    });
    if (c !== SNIP_COURSES.length) throw new Error(`wrote ${c} of ${SNIP_COURSES.length} courses`);
    writeFileSync(path, outLines.join("\n"));
    console.error(`par times: ${parT.join(" ")}`);
  } else {
    const courses = (args.find((a) => !a.startsWith("--")) ?? SNIP_COURSES.map((_, i) => i).join(",")).split(",").map(Number);
    const out = args.find((a) => a.startsWith("--out="))?.slice(6);
    const res = search(proofs, courses);
    if (out) writeFileSync(out, JSON.stringify(res));
    else console.log(JSON.stringify(res));
  }
}
