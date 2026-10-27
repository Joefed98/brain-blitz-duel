/**
 * Scrumper snipRev 11 course designer (200-point expansion; design aid, not a check). Builds candidate tall
 * courses by simulation: fruits hang near the top; each fruit's fall is traced with a reference cut
 * plan and the course is laid along it (slopes that roll it toward the basket, bouncers, pegs that
 * snag it, rings it passes through), then the basket is put where the last fruit lands and later
 * fruits are steered into it with a funnel gutter. Wasp nests go beside the paths, the two leaves on
 * them. A candidate is kept only when every one of its 9 deals (pin shift × wind preset) has a
 * human-paced plan that feeds every fruit; par is the most strokes any deal's best plan needs.
 *
 *   bun scripts/snip-x200-design.ts --band=0 --count=12 --seed=1 > /tmp/easy.json
 *   bun scripts/snip-x200-design.ts --write easy.json medium.json hard.json   (writes snipCourses.data.ts)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { SNIP_X_W, SNIP_X_GOLD_TICKS, SNIP_X_LEVEL_TICKS, type SnipCourse } from "../src/lib/arcade/snip";
import { xDeals, xPaced, xPlayLevel, xStrokes, X_FIRST_CUT, X_STROKE_GAP, type XPlan, type XPlay } from "./snip-x200-lib";

type Seg = [number, number, number, number];
type Mut = {
  -readonly [K in keyof SnipCourse]: SnipCourse[K] extends readonly (infer U)[] | undefined ? U[] : SnipCourse[K];
};

function rng(seed: number) {
  let x = seed >>> 0 || 1;
  const next = () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
  return { u: next, int: (a: number, b: number) => a + Math.floor(next() * (b - a + 1)), pick: <T>(list: readonly T[]) => list[Math.floor(next() * list.length)]! };
}

const H = 1200;
const MOUTH_Y = H - 90;
const NAMES = ["Orchard", "Bramble", "Cider", "Pippin", "Russet", "Windfall", "Blossom", "Hedgerow", "Bough", "Ladder", "Basket", "Bramley", "Codlin", "Damson", "Greengage", "Quince", "Medlar", "Crab", "Harvest", "Paddock"];
const SUFFIX = ["run", "drop", "tumble", "chute", "climb", "gully", "slide", "fall", "hop", "steps", "maze", "lane", "trail", "dash", "glide"];

/** The fruit's path from a traced play: [x, y] every 4 ticks. */
function path(course: Mut, plan: XPlan, k: number): [number, number][] {
  return xPlayLevel(course as SnipCourse, 0, 0, -1, plan, true).paths?.[k] ?? [];
}

/** First path point at or below y. */
function at(p: readonly [number, number][], y: number): [number, number] | null {
  for (const q of p) if (q[1] >= y) return q;
  return null;
}

function clampX(x: number, m = 24): number {
  return Math.max(m, Math.min(SNIP_X_W - m, x));
}

/** The reference plan: each fruit's ropes cut in its own stroke(s), fruits released in turn. */
function referencePlan(course: Mut, r: ReturnType<typeof rng>): XPlan {
  const plan: XPlan = [];
  let t = X_FIRST_CUT + r.int(0, 24);
  let rope = 0;
  course.fruits.forEach((f) => {
    f.pins.forEach((_, j) => {
      plan.push([rope++, t]);
      // A fruit's second rope: one swipe on if its pin is close (one stroke), else a separate swipe.
      const next = f.pins[j + 1];
      t += next ? (Math.abs(next[0] - f.pins[j]![0]) + Math.abs(next[1] - f.pins[j]![1]) < 60 ? 1 : X_STROKE_GAP + r.int(0, 20)) : 0;
    });
    t += r.int(40, 80);
  });
  return plan;
}

export const FAILS: Record<string, number> = {};
function fail(why: string): null {
  FAILS[why] = (FAILS[why] ?? 0) + 1;
  return null;
}

interface Built {
  course: Mut;
  plan: XPlan;
}

/** Lays one candidate course. Null when the build fails. */
function build(band: 0 | 1 | 2, r: ReturnType<typeof rng>): Built | null {
  const nFruit = band === 0 ? (r.u() < 0.6 ? 1 : 2) : band === 1 ? 2 : r.u() < 0.7 ? 2 : 3;
  const course: Mut = {
    name: `${r.pick(NAMES)} ${r.pick(SUFFIX)}`,
    band,
    h: H,
    fruits: [],
    mouth: [180, MOUTH_Y],
    planks: [],
    gutters: [],
    springs: [],
    nests: [],
    hooks: [],
    rings: [],
    stars: [],
    winds: band === 0 ? [[0, 0, 0], [4, r.int(200, 300), r.int(0, 100)], [7, r.int(200, 300), r.int(0, 100)]] : band === 1 ? [[5, r.int(170, 260), r.int(0, 100)], [8, r.int(170, 260), r.int(0, 100)], [11, r.int(170, 260), r.int(0, 100)]] : [[8, r.int(150, 240), r.int(0, 100)], [11, r.int(150, 240), r.int(0, 100)], [14, r.int(150, 240), r.int(0, 100)]],
    par: 1,
  };
  const cols = nFruit === 1 ? [r.int(90, 270)] : nFruit === 2 ? [r.int(70, 150), r.int(210, 290)] : [r.int(50, 100), r.int(155, 205), r.int(260, 310)];
  for (const x of cols) {
    const y = r.int(140, 230);
    const two = band > 0 && r.u() < (band === 1 ? 0.3 : 0.5);
    const pins: [number, number, number][] = two
      ? [[clampX(x - r.int(50, 90), 14), r.int(36, 70), 0], [clampX(x + r.int(50, 90), 14), r.int(36, 70), 0]]
      : [[clampX(x + r.pick([-1, 1]) * r.int(band === 0 ? 10 : 30, band === 0 ? 60 : 90), 14), r.int(36, 70), 0]];
    course.fruits.push({ sweet: [x, y], pins });
  }
  let plan = referencePlan(course, r);
  const side = r.u() < 0.5 ? -1 : 1;
  let mouthX = side < 0 ? r.int(60, 150) : r.int(210, 300);
  course.mouth = [mouthX, MOUTH_Y];
  // Whole px only (the sim is integer): every placement is rounded before it is played.
  const round = () => Object.assign(course, JSON.parse(JSON.stringify(course, (_k, v) => (typeof v === "number" ? Math.round(v) : v))));
  const play0 = () => {
    round();
    return xPlayLevel(course as SnipCourse, 0, 0, -1, plan, true);
  };
  // A hopper over the basket on most courses: two planks sloping into a gap above it.
  const hopperY = MOUTH_Y - 170;
  // A narrow wooden chute on most easy courses and some medium ones (two boards sloping in, two upright).
  const hopper = nFruit > 1 || r.u() < (band === 0 ? 0.6 : band === 1 ? 0.2 : 0);
  const span = band === 0 ? 80 : band === 1 ? 66 : 56;
  if (hopper) course.planks!.push([clampX(mouthX - span, 4), hopperY + 20, mouthX - 26, hopperY + 60], [clampX(mouthX + span, 4), hopperY + 20, mouthX + 26, hopperY + 60], [mouthX - 26, hopperY + 60, mouthX - 26, MOUTH_Y - 44], [mouthX + 26, hopperY + 60, mouthX + 26, MOUTH_Y - 44]);
  // Some medium and hard baskets slide (set once the fruit are steered in, see below).
  const slide = !hopper && r.u() < (band === 1 ? 0.3 : band === 2 ? 0.5 : 0) ? ([r.int(30, 55), r.int(200, 300)] as [number, number]) : null;
  const kinds = band === 0 ? ["plank", "plank", "gutter", "spring"] : band === 1 ? ["plank", "gutter", "spring", "hook", "ring"] : ["plank", "gutter", "spring", "hook", "ring", "ring"];

  // Each fruit in turn: lay elements along its fall, from the top down, then steer it into the basket.
  for (let k = 0; k < nFruit; k++) {
    const want = band === 0 ? r.int(1, 2) : band === 1 ? r.int(2, 3) : r.int(2, 4);
    let y = r.int(320, 420) + k * 30;
    for (let e = 0, tries = 0; e < want && y < hopperY - 200 && tries < 8; tries++) {
      const q = at(play0().paths?.[k] ?? [], y);
      if (!q) return fail("path");
      const toward = Math.sign(mouthX - q[0]) || side;
      const kind = r.pick(kinds);
      const snapshot = JSON.stringify(course);
      const planBefore = plan;
      if (kind === "plank" || kind === "gutter") {
        const len = r.int(90, 150);
        const drop = r.int(25, 55);
        const x0 = clampX(q[0] - toward * r.int(20, 40));
        const x1 = clampX(x0 + toward * len);
        (kind === "plank" ? course.planks! : course.gutters!).push([x0, q[1] + 16, x1, q[1] + 16 + drop]);
      } else if (kind === "spring") {
        const len = r.int(70, 100);
        const tilt = toward * r.int(10, 30);
        course.springs!.push([clampX(q[0] - len / 2), q[1] + 18 + tilt, clampX(q[0] + len / 2), q[1] + 18 - tilt]);
      } else {
        const len = r.int(55, 95);
        (kind === "hook" ? course.hooks! : course.rings!).push([Math.round(q[0]), q[1], len]);
        const known = new Set(play0().vines.map((v) => v[0]));
        void known;
        const res = play0();
        const vine = res.vines.find((v) => v[2] === k && !plan.some(([ri]) => ri === v[0]));
        if (!vine) {
          Object.assign(course, JSON.parse(snapshot));
          continue;
        }
        plan = [...plan, [vine[0], vine[1] + r.int(24, 60)] as [number, number]].sort((a, b) => a[1] - b[1]);
        if (!xPaced(plan)) {
          // Keep strokes apart: push the vine cut later.
          plan = plan.map(([ri, t]) => [ri, ri === vine[0] ? t + X_STROKE_GAP : t] as [number, number]).sort((a, b) => a[1] - b[1]);
        }
      }
      const res = play0();
      // Keep the element only when every fruit so far still gets past it (none lost or stuck).
      const lostEarly = (res.paths ?? []).slice(0, k + 1).some((p) => p.length > 0 && p.at(-1)![1] < y - 10 && res.fed < k + 1);
      if (!res.valid || lostEarly) {
        Object.assign(course, JSON.parse(snapshot));
        plan = planBefore;
        continue;
      }
      e++;
      y += r.int(150, 230);
    }
    // With no chute, the basket goes where the first fruit lands.
    if (!hopper && k === 0) {
      const land = at(play0().paths?.[0] ?? [], MOUTH_Y - 4);
      if (land) {
        mouthX = Math.round(Math.max(44, Math.min(316, land[0])));
        course.mouth = [mouthX, MOUTH_Y];
      }
    }
    // Steer it into the hopper (or the basket): up to two deflector planks toward the mouth.
    for (let d = 0; d < 3; d++) {
      const res = play0();
      if (res.fed >= k + 1) break;
      if (process.env.SNIP_DESIGN_DEBUG) {
        const p = res.paths?.[k] ?? [];
        console.error(`    steer k${k} d${d} fed ${res.fed} mouth ${mouthX} hopper ${hopper} last ${JSON.stringify(p.at(-1)?.map(Math.round))} at-hopper ${JSON.stringify(at(p, hopperY)?.map(Math.round))} n ${p.length}`);
      }
      if (d === 2) {
        // Tune the last deflector's low end until the fruit drops into the basket.
        const seg = course.planks!.at(-1);
        let ok = false;
        for (let it = 0; seg && it < 12 && !ok; it++) {
          const rr = play0();
          if (rr.fed >= k + 1) ok = true;
          else {
            const land = at(rr.paths?.[k] ?? [], MOUTH_Y - 30);
            if (!land) break;
            seg[2] = clampX(seg[2] - (land[0] - mouthX) * 0.7);
          }
        }
        if (!ok) return fail("steer");
        break;
      }
      const p = res.paths?.[k] ?? [];
      const q = at(p, (hopper ? hopperY : MOUTH_Y - 60) - 200 - d * 120);
      if (!q) return fail("steer-path");
      const dx = mouthX - q[0];
      const toward = Math.sign(dx) || side;
      if (hopper && d === 0) {
        // A tin gutter (no bounce) from under the fruit down to the chute's near edge.
        const endX = mouthX - toward * (span - 14);
        if (Math.abs(endX - q[0]) > 20) course.gutters!.push([clampX(q[0] - toward * 25), q[1] + 16, clampX(endX), Math.max(q[1] + 46, hopperY - 10)]);
        continue;
      }
      const len = Math.min(190, Math.max(70, Math.abs(dx) + 20));
      course.planks!.push([clampX(q[0] - toward * 25), q[1] + 16, clampX(q[0] + toward * len), q[1] + 16 + r.int(35, 60)]);
    }
    let res = play0();
    // A steer can change a peg's or ring's catch: drop a vine cut whose vine no longer comes.
    for (let i = plan.length - 1; i >= 0 && res.fed >= k + 1 && !res.valid; i--) {
      const without = plan.filter((_, j) => j !== i);
      const r2 = xPlayLevel(course as SnipCourse, 0, 0, -1, without, true);
      if (r2.valid && r2.fed >= k + 1 && xPaced(without)) {
        plan = without;
        res = r2;
      }
    }
    if (res.fed < k + 1 || !res.valid) return fail("fed");
  }

  // Hazards beside the paths, then the two leaves on them.
  const play = play0();
  if (!play.all) return fail("183");
  const pts = (play.paths ?? []).flat();
  const nests = band === 0 ? r.int(0, 1) : band === 1 ? r.int(2, 3) : r.int(3, 4);
  for (let n = 0, tries = 0; n < nests && tries < 80; tries++) {
    const x = r.int(40, 320);
    const y = r.int(320, MOUTH_Y - 120);
    const rad = r.int(18, 24);
    // Close beside a path (a swing or a bounce off the line meets it), never on it.
    const near = Math.min(...pts.map(([px, py]) => Math.hypot(px - x, py - y)));
    if (near < rad + 12 + (band === 0 ? 34 : 16) || near > rad + 12 + 70) continue;
    if (Math.hypot(x - mouthX, y - MOUTH_Y) < 90) continue;
    course.nests!.push([x, y, rad]);
    n++;
  }
  const lanes = play.paths ?? [];
  const first = lanes[0] ?? [];
  const last = lanes[lanes.length - 1] ?? first;
  const s1 = at(first, 330 + r.int(0, 120));
  // The second leaf lies on another timing's path, well off the plain one: it takes a deliberate cut.
  let s2: [number, number] | null = null;
  for (const d of [24, -24, 36, -36, 16, -16, 48]) {
    const v = plan.map(([ri, t]) => [ri, t + d] as [number, number]);
    if (!xPaced(v)) continue;
    const res = xPlayLevel(course as SnipCourse, 0, 0, -1, v, true);
    if (!res.all) continue;
    const cand = (res.paths ?? []).flat().filter(([x, y]) => y > 560 && y < MOUTH_Y - 160 && Math.min(...pts.map(([px, py]) => Math.hypot(px - x, py - y))) > 36);
    if (cand.length) {
      s2 = cand[r.int(0, cand.length - 1)]!;
      break;
    }
  }
  if (!s1 || !s2) return fail("leaf2");
  course.stars = [[Math.round(s1[0]), Math.round(s1[1])], [Math.round(s2[0]), Math.round(s2[1])]];
  if (slide) course.slide = slide;
  for (const key of ["planks", "gutters", "springs", "nests", "hooks", "rings"] as const) if (!course[key]!.length) delete course[key];
  return { course, plan };
}

/** Plans tried at a deal: the reference shifted in time, its strokes spread or squeezed, strokes merged. */
function variants(plan: XPlan): XPlan[] {
  const out: XPlan[] = [plan];
  for (let d = -12; d <= 120; d += 4) out.push(plan.map(([r, t]) => [r, t + d]));
  for (const f of [0.7, 1.3, 1.6])
    for (let d = -8; d <= 60; d += 6) out.push(plan.map(([r, t]) => [r, Math.round(plan[0]![1] + (t - plan[0]![1]) * f) + d]));
  return out.filter(xPaced);
}

/** Merged-stroke versions: a later stroke moved to straight after the one before. */
function merges(plan: XPlan): XPlan[] {
  const p = [...plan].sort((a, b) => a[1] - b[1]);
  const strokes: XPlan[] = [];
  for (const c of p) {
    const last = strokes.at(-1);
    if (last && c[1] === last.at(-1)![1] + 1) last.push(c);
    else strokes.push([c]);
  }
  const out: XPlan[] = [];
  for (let i = 1; i < strokes.length; i++) {
    const merged = strokes.map((s) => s.map(([r, t]) => [r, t] as [number, number]));
    let t = merged[i - 1]!.at(-1)![1];
    merged[i] = merged[i]!.map(([r]) => [r, ++t]);
    const flat = merged.flat();
    for (let d = 0; d <= 60; d += 4) {
      const shifted = flat.map(([r, tt]) => [r, tt + d] as [number, number]);
      if (xPaced(shifted)) out.push(shifted);
    }
  }
  return out;
}

export interface XDealProof {
  /** The fastest plan that feeds every fruit, and per golden-eligible fruit the best (fewest cuts) perfect one. */
  win: XPlan;
  best: Record<string, XPlan>;
  bestStrokes: number;
  winTick: number;
}

/** How forgiving a course is: the share of start-time shifts (±24 ticks) at which its win plan still feeds every fruit. */
export function tolerance(course: SnipCourse, plan: XPlan, wob = 0, wind = 1): number {
  let ok = 0;
  let n = 0;
  for (let d = -24; d <= 24; d += 3) {
    const v = plan.map(([r, t]) => [r, t + d] as [number, number]);
    if (!xPaced(v)) continue;
    n++;
    const res = xPlayLevel(course, wob, wind, -1, v);
    if (res.valid && res.all) ok++;
  }
  return n ? ok / n : 0;
}

/**
 * Every deal's proof, and the fruits that may be golden (those with a perfect plan, golden in time, at
 * every deal); null when some deal has no plan that feeds every fruit or no fruit can be golden.
 */
export function proveCourse(course: SnipCourse, plan: XPlan): { proofs: Record<string, XDealProof>; golds: number[] } | null {
  const out: Record<string, XDealProof> = {};
  const pool = [...variants(plan), ...merges(plan).flatMap((m) => [m, ...variants(m).slice(1, 8)])];
  const n = course.fruits.length;
  let golds = Array.from({ length: n }, (_, k) => k);
  for (const [wob, wind] of xDeals(course)) {
    let win: { plan: XPlan; tick: number } | null = null;
    const best: (null | { plan: XPlan; play: XPlay })[] = Array.from({ length: n }, () => null);
    for (const cand of pool) {
      const play = xPlayLevel(course, wob, wind, -1, cand);
      if (!play.valid || !play.all) continue;
      if (!win || play.tick < win.tick) win = { plan: cand, tick: play.tick };
      if (play.stars < 2) continue;
      for (let g = 0; g < n; g++) {
        if (play.fedAt[g]! < 0 || play.fedAt[g]! > SNIP_X_GOLD_TICKS) continue;
        const b = best[g];
        if (!b || play.strokes < b.play.strokes || (play.strokes === b.play.strokes && play.tick < b.play.tick)) best[g] = { plan: cand, play };
      }
    }
    if (!win) return null;
    golds = golds.filter((g) => best[g]);
    if (!golds.length) return null;
    out[`${wob}:${wind}`] = {
      win: win.plan,
      best: Object.fromEntries(best.map((b, g) => [String(g), b?.plan]).filter(([, p]) => p)),
      bestStrokes: 0,
      winTick: win.tick,
    };
  }
  // Par: the most cuts any deal's perfect plan needs, over the golden-eligible fruits.
  let par = 0;
  for (const p of Object.values(out)) {
    for (const g of Object.keys(p.best)) if (!golds.includes(Number(g))) delete p.best[g];
    for (const plan of Object.values(p.best)) par = Math.max(par, xStrokes(plan));
    p.bestStrokes = Math.max(...Object.values(p.best).map(xStrokes));
  }
  return { proofs: out, golds };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
  if (args[0] === "--write") {
    type Kept = { course: SnipCourse; proofs: Record<string, XDealProof>; tol: number };
    const all: Kept[] = args.slice(1).flatMap((f) => JSON.parse(readFileSync(f, "utf8")));
    // Easy courses first, then medium, then hard; unique names across the bank.
    all.sort((a, b) => a.course.band - b.course.band);
    const seen = new Map<string, number>();
    for (const { course } of all) {
      const n = (seen.get(course.name) ?? 0) + 1;
      seen.set(course.name, n);
      if (n > 1) (course as Mut).name = `${course.name} ${["II", "III", "IV", "V", "VI"][n - 2] ?? n}`;
    }
    const lines = all.map(({ course }) => `  ${JSON.stringify(course).replace(/"(\w+)":/g, "$1: ").replace(/,(?=\w+: )/g, ", ")},`);
    const head = readFileSync("src/lib/arcade/snipCourses.data.ts", "utf8").split("export const SNIP_COURSES")[0]!;
    writeFileSync("src/lib/arcade/snipCourses.data.ts", `${head}export const SNIP_COURSES: readonly SnipCourse[] = [\n${lines.join("\n")}\n];\n`);
    const proofs = Object.fromEntries(all.map(({ course, proofs: p }, i) => [String(i), { name: course.name, deals: Object.fromEntries(Object.entries(p).map(([k, v]) => [k, { win: v.win, best: v.best }])) }]));
    writeFileSync("scripts/fixtures/snip-x200-proofs.json", JSON.stringify(proofs));
    console.error(`${all.length} courses and their proofs written (tolerance ${all.map((k) => k.tol.toFixed(2)).join(" ")})`);
  } else {
    const band = Number(opt("band") ?? 0) as 0 | 1 | 2;
    const count = Number(opt("count") ?? 10);
    /** A candidate's band is its forgiveness: the share of ±24-tick shifts its win plan survives. */
    const tolMax = [1.01, 0.62, 0.4][band]!;
    const tolMin = [0.45, 0.2, 0][band]!;
    const r = rng(Number(opt("seed") ?? 1) * 7919 + band);
    const kept: { course: SnipCourse; plan: XPlan; proofs: Record<string, XDealProof>; tol: number }[] = [];
    for (let tries = 0; kept.length < count && tries < count * 80; tries++) {
      if (tries % 20 === 19) console.error(`  ${tries + 1} tries: ${JSON.stringify(FAILS)}`);
      const b = build(band, r);
      if (!b) continue;
      const tol = tolerance(b.course as SnipCourse, b.plan);
      if (tol < tolMin || tol > tolMax) {
        FAILS[`tolerance`] = (FAILS[`tolerance`] ?? 0) + 1;
        continue;
      }
      const proved = proveCourse(b.course as SnipCourse, b.plan);
      if (!proved) {
        console.error(`  try ${tries}: ${b.course.name} lost a deal`);
        continue;
      }
      const values = Object.values(proved.proofs);
      const worst = Math.max(...values.map((p) => p.winTick));
      if (worst > SNIP_X_LEVEL_TICKS - 120) continue;
      b.course.par = Math.max(...values.map((p) => p.bestStrokes));
      if (proved.golds.length < b.course.fruits.length) b.course.golds = proved.golds;
      kept.push({ course: b.course as SnipCourse, plan: b.plan, proofs: proved.proofs, tol });
      // --out=<file>: keep what is kept so far on disk (a long search can be stopped at any time).
      if (opt("out")) writeFileSync(opt("out")!, JSON.stringify(kept));
      console.error(`kept ${kept.length}/${count} (try ${tries}): ${b.course.name} · ${b.course.fruits.length} fruit · golds ${proved.golds.join(",")} · par ${b.course.par} · strokes ${xStrokes(b.plan)} · tolerance ${tol.toFixed(2)} · worst ${worst} ticks`);
    }
    console.error(`fails ${JSON.stringify(FAILS)}`);
    console.log(JSON.stringify(kept));
  }
}
