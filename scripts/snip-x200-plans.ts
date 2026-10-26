/**
 * Scrumper snipRev 11 (the 200-point expansion; docs/expansions/x200-snip.md): the fastest stored perfect
 * plans and each course's par time. A design tool, not a check.
 *
 * For every course of SNIP_COURSES, every deal (3 pin shifts × 3 wind presets) and every golden choice
 * (none, or each fruit that may be golden), it searches for the fastest human-paced plan that is perfect:
 * every fruit fed in no more strokes than the course's par, both leaves, the golden fruit fed while golden.
 * The search starts from every plan stored for the course (fixtures/snip-x200-proofs.json, any deal), shifts
 * it in time, then moves each stroke earlier or later while it stays perfect. It also re-finds each deal's
 * `win` plan (the fastest that feeds every fruit), so a physics or course change on snipRev 11 (the wider chutes
 * of scripts/snip-x200-chutes.ts, the leaf reach) is re-proved for every deal. A golden choice with no perfect
 * plan on some deal is dropped from the course's `golds`; a deal with no win or plain perfect plan is an error.
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

/** The level tick a plan feeds every fruit on, human-paced (null when it does not). */
export function winTick(c: number, w: number, k: number, plan: XPlan): number | null {
  if (!xPaced(plan)) return null;
  const p = xPlayLevel(c, w, k, -1, plan);
  return p.valid && p.all ? p.tick : null;
}

type Found = Record<string, Record<string, { plan: XPlan; tick: number } | null>>;

/** The fastest plan `tickOf` accepts: from every stored plan of the course shifted in time, then stroke by stroke. */
function fastest(uniq: XPlan[], start: XPlan[], tickOf: (p: XPlan) => number | null): { plan: XPlan; tick: number } | null {
  let best: XPlan | null = null;
  let bt = Infinity;
  const tryP = (p: XPlan) => {
    const t = tickOf(p);
    if (t !== null && t < bt) {
      bt = t;
      best = p;
    }
  };
  for (const p of start) if (p) tryP(p);
  for (const p of uniq) for (let dd = -60; dd <= 60; dd += 3) tryP(p.map(([r, t]) => [r, t + dd]));
  for (let pass = 0; pass < 3 && best; pass++) {
    let improved = false;
    const st = strokesOf(best);
    for (let i = 0; i < st.length; i++)
      for (const dd of [-30, -20, -12, -8, -5, -3, -2, -1, 1, 2, 3, 5, 8]) {
        const before = bt;
        tryP(st.map((x, j) => (j === i ? x.map(([r, t]) => [r, t + dd] as [number, number]) : x)).flat());
        if (bt < before) improved = true;
      }
    if (!improved) break;
  }
  return best ? { plan: best, tick: bt } : null;
}

function search(proofs: XProofs, courses: number[]): Found {
  const out: Found = {};
  const t0 = performance.now();
  for (const c of courses) {
    const course = SNIP_COURSES[c]!;
    const seeds: XPlan[] = [];
    for (const d of Object.values(proofs[String(c)]!.deals)) seeds.push(d.win, ...Object.values(d.best));
    const uniq = [...new Map(seeds.map((p) => [JSON.stringify(p), p])).values()];
    out[c] = {};
    let worst = 0;
    const missing: string[] = [];
    for (const [w, k] of xDeals(course)) {
      const d = proofs[String(c)]!.deals[`${w}:${k}`]!;
      const win = fastest(uniq, [d.win], (p) => winTick(c, w, k, p));
      out[c]![`${w}:${k}:win`] = win;
      if (!win) missing.push(`${w}:${k} win`);
      for (const g of goldChoices(c)) {
        const r = fastest(uniq, g < 0 ? Object.values(d.best) : [d.best[String(g)]!], (p) => perfectTick(c, w, k, g, p));
        out[c]![`${w}:${k}:${g}`] = r;
        if (!r) missing.push(`${w}:${k} gold ${g}`);
        else worst = Math.max(worst, r.tick);
      }
    }
    console.error(`${c} ${course.name}: slowest fastest-perfect ${worst} ticks${missing.length ? `; MISSING ${missing.join(", ")}` : ""} (${((performance.now() - t0) / 1000).toFixed(0)} s)`);
  }
  return out;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const proofs: XProofs = JSON.parse(readFileSync(PROOFS_PATH, "utf8"));
  if (args[0] === "--write") {
    const found: Found = Object.assign({}, ...args.slice(1).map((f) => JSON.parse(readFileSync(f, "utf8"))));
    const parT: number[] = [];
    const golds: (number[] | null)[] = [];
    SNIP_COURSES.forEach((course, c) => {
      const f = found[String(c)];
      if (!f) throw new Error(`course ${c}: not searched`);
      // A golden choice keeps its place only when every deal has a perfect plan for it; the plain level must always have one.
      const choices = goldChoices(c).filter((g) => g < 0 || xDeals(course).every(([w, k]) => f[`${w}:${k}:${g}`]));
      if (choices.length < 2) throw new Error(`course ${c}: no golden fruit is perfect on every deal`);
      golds.push(choices.length - 1 < course.fruits.length ? choices.filter((g) => g >= 0) : null);
      let worst = 0;
      for (const [w, k] of xDeals(course)) {
        const d = proofs[String(c)]!.deals[`${w}:${k}`]!;
        const win = f[`${w}:${k}:win`];
        if (!win) throw new Error(`course ${c} deal ${w}:${k}: no plan feeds every fruit`);
        d.win = win.plan;
        const best: Record<string, XPlan> = {};
        for (const g of choices) {
          const r = f[`${w}:${k}:${g}`];
          if (!r) throw new Error(`course ${c} deal ${w}:${k}: no perfect plan for golden choice ${g}`);
          best[String(g)] = r.plan;
          worst = Math.max(worst, r.tick);
        }
        d.best = best;
      }
      parT.push(worst + SNIP_X_PAR_MARGIN);
    });
    writeFileSync(PROOFS_PATH, JSON.stringify(proofs));
    // Each course line gets its parT after its par, and its golden fruits when not every fruit may be golden.
    const path = "src/lib/arcade/snipCourses.data.ts";
    const lines = readFileSync(path, "utf8").split("\n");
    let c = 0;
    const outLines = lines.map((line) => {
      if (!line.startsWith("  {name: ")) return line;
      const g = golds[c];
      const t = parT[c++]!;
      let out = line.replace(/, golds: \[[\d,]*\]/, "").replace(/, par: (\d+)(, parT: \d+)?/, `, par: $1, parT: ${t}`);
      if (g) out = out.replace(/, par: (\d+)/, `, golds: [${g.join(",")}], par: $1`);
      return out;
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
