/**
 * Scrumper snipRev 10 course designer (E8 expansion; design aid, not a check). Builds candidate tall
 * courses by simulation: fruits hang near the top; each fruit's fall is traced with a reference cut
 * plan and the course is laid along it (slopes that roll it toward the basket, bouncers, pegs that
 * snag it, rings it passes through), then the basket is put where the last fruit lands and later
 * fruits are steered into it with a funnel gutter. Wasp nests go beside the paths, the two leaves on
 * them. A candidate is kept only when every one of its 9 deals (pin shift × wind preset) has a
 * human-paced plan that feeds every fruit; par is the most strokes any deal's best plan needs.
 *
 *   bun scripts/snip-expand-design.ts --band=0 --count=12 --seed=1 > /tmp/easy.json
 *   bun scripts/snip-expand-design.ts --write easy.json medium.json hard.json   (writes snipCourses.data.ts)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { SNIP_X_W, SNIP_X_LEVEL_TICKS, type SnipCourse } from "../src/lib/arcade/snip";
import { xDeals, xPaced, xPlayLevel, xStrokes, X_FIRST_CUT, X_STROKE_GAP, type XPlan, type XPlay } from "./snip-expand-lib";

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
      t += j + 1 < f.pins.length ? 1 : 0;
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
  const nFruit = band === 0 ? (r.u() < 0.6 ? 1 : 2) : band === 1 ? 2 : r.u() < 0.5 ? 2 : 3;
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
    winds: band === 0 ? [[0, 0, 0], [3, r.int(200, 300), r.int(0, 100)], [5, r.int(200, 300), r.int(0, 100)]] : band === 1 ? [[3, r.int(180, 280), r.int(0, 100)], [6, r.int(180, 280), r.int(0, 100)], [8, r.int(180, 280), r.int(0, 100)]] : [[5, r.int(160, 260), r.int(0, 100)], [8, r.int(160, 260), r.int(0, 100)], [11, r.int(160, 260), r.int(0, 100)]],
    par: 1,
  };
  const cols = nFruit === 1 ? [r.int(90, 270)] : nFruit === 2 ? [r.int(70, 150), r.int(210, 290)] : [r.int(50, 100), r.int(155, 205), r.int(260, 310)];
  for (const x of cols) {
    const y = r.int(140, 230);
    const two = band > 0 && r.u() < (band === 1 ? 0.3 : 0.5);
    const pins: [number, number, number][] = two
      ? [[clampX(x - r.int(50, 90), 14), r.int(36, 70), 0], [clampX(x + r.int(50, 90), 14), r.int(36, 70), 0]]
      : [[clampX(x + r.int(-60, 60), 14), r.int(36, 70), 0]];
    course.fruits.push({ sweet: [x, y], pins });
  }
  let plan = referencePlan(course, r);
  const side = r.u() < 0.5 ? -1 : 1;
  const mouthX = side < 0 ? r.int(60, 150) : r.int(210, 300);
  course.mouth = [mouthX, MOUTH_Y];
  // Whole px only (the sim is integer): every placement is rounded before it is played.
  const round = () => Object.assign(course, JSON.parse(JSON.stringify(course, (_k, v) => (typeof v === "number" ? Math.round(v) : v))));
  const play0 = () => {
    round();
    return xPlayLevel(course as SnipCourse, 0, 0, -1, plan, true);
  };
  // A hopper over the basket on most courses: two planks sloping into a gap above it.
  const hopperY = MOUTH_Y - 170;
  const hopper = nFruit > 1 || r.u() < 0.5;
  // A wooden chute: two boards sloping in, then two upright boards down to just above the basket.
  if (hopper) course.planks!.push([clampX(mouthX - 120, 4), hopperY, mouthX - 26, hopperY + 60], [clampX(mouthX + 120, 4), hopperY, mouthX + 26, hopperY + 60], [mouthX - 26, hopperY + 60, mouthX - 26, MOUTH_Y - 44], [mouthX + 26, hopperY + 60, mouthX + 26, MOUTH_Y - 44]);
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
    // Steer it into the hopper (or the basket): up to two deflector planks toward the mouth.
    for (let d = 0; d < 3; d++) {
      const res = play0();
      if (res.fed >= k + 1) break;
      if (d === 2) return fail("steer");
      const p = res.paths?.[k] ?? [];
      const q = at(p, (hopper ? hopperY : MOUTH_Y - 60) - 200 - d * 120);
      if (!q) return fail("steer-path");
      const dx = mouthX - q[0];
      const toward = Math.sign(dx) || side;
      const len = Math.min(190, Math.max(70, Math.abs(dx) + 20));
      course.planks!.push([clampX(q[0] - toward * 25), q[1] + 16, clampX(q[0] + toward * len), q[1] + 16 + r.int(35, 60)]);
    }
    const res = play0();
    if (res.fed < k + 1 || !res.valid) return fail("fed");
  }

  // Hazards beside the paths, then the two leaves on them.
  const play = play0();
  if (!play.all) return fail("183");
  const pts = (play.paths ?? []).flat();
  const nests = band === 0 ? 0 : band === 1 ? r.int(1, 2) : r.int(2, 3);
  for (let n = 0, tries = 0; n < nests && tries < 60; tries++) {
    const x = r.int(40, 320);
    const y = r.int(320, MOUTH_Y - 120);
    const rad = r.int(18, 24);
    if (pts.some(([px, py]) => Math.hypot(px - x, py - y) < rad + 12 + 34)) continue;
    if (Math.hypot(x - mouthX, y - MOUTH_Y) < 90) continue;
    course.nests!.push([x, y, rad]);
    n++;
  }
  const lanes = play.paths ?? [];
  const first = lanes[0] ?? [];
  const last = lanes[lanes.length - 1] ?? first;
  const s1 = at(first, 330 + r.int(0, 120));
  const s2 = at(last, 650 + r.int(0, 200));
  if (!s1 || !s2) return fail("200");
  course.stars = [[Math.round(s1[0]), Math.round(s1[1])], [Math.round(s2[0]), Math.round(s2[1])]];
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
  /** The fastest plan that feeds every fruit, and the best one (fewest strokes, then both leaves). */
  win: XPlan;
  best: XPlan;
  bestStrokes: number;
  bestStars: number;
  winTick: number;
}

function score(play: XPlay): number {
  return (play.all ? 1000 : 0) + (play.stars >= 2 ? 100 : 0) - play.strokes * 10;
}

/** Every deal's proof, or null when some deal has no plan that feeds every fruit. */
export function proveCourse(course: SnipCourse, plan: XPlan): Record<string, XDealProof> | null {
  const out: Record<string, XDealProof> = {};
  const pool = [...variants(plan), ...merges(plan).flatMap((m) => [m, ...variants(m).slice(1, 8)])];
  for (const [wob, wind] of xDeals(course)) {
    let win: { plan: XPlan; tick: number } | null = null;
    let best: { plan: XPlan; play: XPlay } | null = null;
    for (const cand of pool) {
      const play = xPlayLevel(course, wob, wind, 0, cand);
      if (!play.valid || !play.all) continue;
      if (!win || play.tick < win.tick) win = { plan: cand, tick: play.tick };
      if (!best || score(play) > score(best.play) || (score(play) === score(best.play) && play.tick < best.play.tick)) best = { plan: cand, play };
    }
    if (!win || !best) return null;
    out[`${wob}:${wind}`] = { win: win.plan, best: best.plan, bestStrokes: best.play.strokes, bestStars: best.play.stars, winTick: win.tick };
  }
  return out;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
  if (args[0] === "--write") {
    const all: { course: SnipCourse; proofs: Record<string, XDealProof> }[] = args.slice(1).flatMap((f) => JSON.parse(readFileSync(f, "utf8")));
    // Unique names across the bank.
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
    writeFileSync("scripts/fixtures/snip-expand-proofs.json", JSON.stringify(proofs));
    console.error(`${all.length} courses and their proofs written`);
  } else {
    const band = Number(opt("band") ?? 0) as 0 | 1 | 2;
    const count = Number(opt("count") ?? 10);
    const r = rng(Number(opt("seed") ?? 1) * 7919 + band);
    const kept: { course: SnipCourse; plan: XPlan; proofs: Record<string, XDealProof> }[] = [];
    for (let tries = 0; kept.length < count && tries < count * 60; tries++) {
      const b = build(band, r);
      if (!b) continue;
      const proofs = proveCourse(b.course as SnipCourse, b.plan);
      if (!proofs) {
        console.error(`  try ${tries}: ${b.course.name} lost a deal`);
        continue;
      }
      const values = Object.values(proofs);
      b.course.par = Math.max(...values.map((p) => p.bestStrokes));
      const worst = Math.max(...values.map((p) => p.winTick));
      if (worst > SNIP_X_LEVEL_TICKS - 120) continue;
      // Both leaves at every deal (with par strokes), so a perfect level is open on every seed; slow perfect plans are out.
      if (values.some((p) => p.bestStars < 2)) continue;
      if (kept.some((k) => k.course.name === b.course.name)) b.course.name = `${b.course.name} ${["II", "III", "IV", "V"][kept.filter((k) => k.course.name.startsWith(b.course.name)).length - 1] ?? kept.length}`;
      b.course.name = `${b.course.name}`;
      kept.push({ course: b.course as SnipCourse, plan: b.plan, proofs });
      console.error(`kept ${kept.length}/${count} (try ${tries}): ${b.course.name} · ${b.course.fruits.length} fruit · par ${b.course.par} · strokes ${xStrokes(b.plan)} · worst ${worst} ticks · two leaves at ${values.filter((p) => p.bestStars >= 2).length}/9 deals`);
    }
    console.error(`fails ${JSON.stringify(FAILS)}`);
    console.log(JSON.stringify(kept));
  }
}
