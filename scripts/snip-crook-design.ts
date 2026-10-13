/**
 * Scrumper level design aid (not a check): draws seeded candidate crook levels
 * for the tall world (snipRev 5, and snipRev 6's bank growth with gutters,
 * sliding baskets and easy crook levels) and keeps those the solver
 * (scripts/snip-solver.ts, human pace) wins at pin wobble −10, 0 and +10 with
 * every planned cut used, that cannot be won without cutting a crook's vine,
 * and whose fastest plan is quick enough for ten levels to fit the minute.
 * Each kept level gets its golden leaf on the fastest plan's path. Prints the
 * kept levels as template literals for SNIP_CROOK_SOURCES.
 *
 *   bun scripts/snip-crook-design.ts <seed> <count> <easy|medium|hard> [samples]
 *
 * SNIP_DESIGN_MIX=1 (snipRev 6) also draws gutters and a sliding basket.
 */
import { inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { placeSnipTemplate, snipTallGame, snipTestLevel, SNIP_CONFIG, SNIP_LEVEL_TICKS, SNIP_TALL_H, type SnipTemplate } from "../src/lib/arcade/snip";
import { cutFor } from "./snip-check-lib";
import { solveSnip, SNIP_CUT_GAP, SNIP_FIRST_CUT, playSnipLevel, type SnipPlan } from "./snip-solver";

const seed = Number(process.argv[2] ?? 1);
const want = Number(process.argv[3] ?? 4);
const kind = (process.argv[4] ?? "hard") as "easy" | "medium" | "hard";
const samples = Number(process.argv[5] ?? 500);
const MAX_TICKS = kind === "hard" ? 400 : kind === "medium" ? 330 : 270;
const MIX = process.env.SNIP_DESIGN_MIX === "1";

let x = seed * 2654435761 >>> 0 || 1;
const r = (n: number) => {
  x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
  return x % n;
};
const between = (a: number, b: number) => a + r(b - a + 1);
const far = (ax: number, ay: number, bx: number, by: number, d: number) => (ax - bx) ** 2 + (ay - by) ** 2 > d * d;

const templates = SNIP_CONFIG.templates as SnipTemplate[];
function place(t: SnipTemplate): number {
  templates.push(placeSnipTemplate(t));
  return templates.length - 1;
}

function candidate(n: number): SnipTemplate {
  const pins = kind === "hard" ? between(1, 3) : kind === "medium" ? between(1, 2) : 1;
  const hooks = kind === "hard" ? between(1, 2) : 1;
  const sweet: [number, number] = [between(150, 390), between(140, 220)];
  const pinList: [number, number, number][] = [];
  for (let i = 0; i < pins; i++) pinList.push([between(120, 420), between(40, 110), 0]);
  const hookList: [number, number, number][] = [];
  for (let i = 0; i < hooks; i++) hookList.push([between(130, 410), i === 0 ? between(280, 380) : between(400, 470), between(60, 110)]);
  const mouth: [number, number] = [between(130, 410), between(560, 595)];
  const t: SnipTemplate = { name: `Crook ${seed}-${n}`, sweet, pins: pinList, platforms: [], hooks: hookList, mouth, stars: [], h: SNIP_TALL_H };
  // Obstacles: wasp nests (always at least one on a hard level), springs, planks.
  const obstacles = kind === "hard" ? between(2, 3) : kind === "medium" ? between(1, 2) : 1;
  const nests: [number, number, number][] = [];
  const springs: [number, number, number, number][] = [];
  const planks: [number, number, number, number][] = [];
  const gutters: [number, number, number, number][] = [];
  for (let i = 0; i < obstacles; i++) {
    // The mix (snipRev 6) adds gutters; an easy level's one obstacle can be any kind.
    const pick = i === 0 && kind !== "easy" ? 0 : r(MIX ? 4 : 3);
    if (pick === 0) {
      for (let tries = 0; tries < 20; tries++) {
        const nx = between(130, 410), ny = between(380, 560), nr = between(20, 24);
        if (far(nx, ny, mouth[0], mouth[1], 32 + nr + 26) && hookList.every(([hx, hy]) => far(nx, ny, hx, hy, nr + 40)) && far(nx, ny, sweet[0], sweet[1], 120)) {
          nests.push([nx, ny, nr]);
          break;
        }
      }
    } else {
      const sx = between(110, 360), sy = between(380, 560), len = between(70, 110), tilt = between(-35, 35);
      if (!far(sx + len / 2, sy, mouth[0], mouth[1], 80)) continue;
      if (pick === 3) {
        // A gutter runs downhill (either way) and carries the apple without a bounce.
        const drop = between(30, 60);
        gutters.push(r(2) ? [sx, sy, Math.min(430, sx + len), sy + drop] : [Math.min(430, sx + len), sy, sx, sy + drop]);
      } else (pick === 1 ? springs : planks).push([sx, sy, Math.min(430, sx + len), sy + tilt]);
    }
  }
  // The mix: now and then a sliding basket (amplitude, period in ticks).
  if (MIX && kind !== "easy" && r(4) === 0) {
    const amp = Math.min(between(40, 90), mouth[0] - 110, 430 - mouth[0]);
    if (amp >= 30) t.slide = [amp, between(200, 320)];
  }
  if (gutters.length) t.gutters = gutters;
  if (nests.length) t.nests = nests;
  if (springs.length) t.springs = springs;
  if (planks.length) t.planks = planks;
  return t;
}

/** Whether some plan cutting only the pins' ropes (never a vine) wins. */
function winsWithoutVine(idx: number): boolean {
  const n = templates[idx]!.pins.length;
  for (let k = 0; k < 250; k++) {
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) { const j = r(i + 1); [order[i], order[j]] = [order[j]!, order[i]!]; }
    let at = SNIP_FIRST_CUT + r(260);
    const plan: SnipPlan = order.map((rope) => { const s: [number, number] = [rope, at]; at += SNIP_CUT_GAP + r(160); return s; });
    if (playSnipLevel(idx, 0, plan).eaten) return true;
  }
  return false;
}

/** The apple's path under a plan (px), for placing the leaf. */
function path(idx: number, plan: SnipPlan): [number, number][] {
  let s = snipTestLevel(idx, 0);
  const log: ArcadeInputEvent[] = [];
  const out: [number, number][] = [];
  for (let k = 0; k < SNIP_LEVEL_TICKS; k++) {
    const due = plan.find(([, at]) => at === s.levelTick + 1);
    if (due && s.ropes[due[0]]?.alive) recordInput(log, cutFor(s, due[0]), snipTallGame.inputRanges);
    const level = s.level;
    s = snipTallGame.step(s, inputAt(log, s.tick + 1));
    if (s.level !== level) break;
    out.push([Math.round(s.sx / 256) - 360, Math.round(s.sy / 256)]);
  }
  return out;
}

/** A leaf on the path, well away from the apple's start, the crooks, the nests and the basket (late in the path first). */
export function leafSpot(t: SnipTemplate, p: [number, number][]): [number, number] {
  const good = ([px, py]: [number, number]) =>
    far(px, py, t.sweet[0], t.sweet[1], 90) && (t.hooks ?? []).every(([hx, hy]) => far(px, py, hx, hy, 40)) && (t.nests ?? []).every(([nx, ny, nr]) => far(px, py, nx, ny, nr + 40)) && far(px, py, t.mouth[0], t.mouth[1], 70);
  const late = p.slice(Math.floor(p.length * 0.4), Math.floor(p.length * 0.85)).filter(good);
  return late[Math.floor(late.length / 2)] ?? p.filter(good)[0] ?? p[Math.floor(p.length / 2)]!;
}

/** --leaf <template>: a leaf spot for an existing template on its fastest wobble-0 plan. */
if (process.argv[2] === "--leaf") {
  for (const idx of process.argv.slice(3).map(Number)) {
    const res = solveSnip(idx, 0, Number(process.env.LEAF_SAMPLES ?? 400), 1);
    if (!res.fast) { console.log(idx, "no plan"); continue; }
    const tpl = templates[idx]!;
    const design = { ...tpl, sweet: [tpl.sweet[0] - 360, tpl.sweet[1]] as const, mouth: [tpl.mouth[0] - 360, tpl.mouth[1]] as const, hooks: tpl.hooks?.map(([x, y, l]) => [x - 360, y, l] as const), nests: tpl.nests?.map(([x, y, r]) => [x - 360, y, r] as const) } as SnipTemplate;
    console.log(idx, tpl.name, JSON.stringify(leafSpot(design, path(idx, res.fast.plan))));
  }
  process.exit(0);
}

const kept: string[] = [];
for (let n = 0; kept.length < want && n < 4000; n++) {
  const t = candidate(n);
  const idx = place(t);
  const minCuts = kind === "hard" ? 3 : 2;
  const quick = solveSnip(idx, 0, samples, 1);
  if (!quick.fast || quick.fast.plan.length < minCuts || quick.fast.tick > MAX_TICKS) continue;
  if (winsWithoutVine(idx)) continue;
  let ok = true;
  let worst = quick.fast.tick;
  for (const j of [-10, 10]) {
    const res = solveSnip(idx, j, samples, 1);
    if (!res.fast || res.fast.tick > MAX_TICKS) { ok = false; break; }
    worst = Math.max(worst, res.fast.tick);
  }
  if (!ok) continue;
  // Leaf: on the fastest path, past the middle, clear of the crooks, nests and basket.
  const p = path(idx, quick.fast.plan);
  const spot = leafSpot(t, p);
  const lit = { ...t, stars: [spot] };
  delete (lit as { h?: number }).h;
  const fields = Object.entries(lit).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(", ");
  kept.push(`  { ${fields} }, // ${kind}, worst fast ${worst} ticks, cuts ${quick.fast.plan.length}`);
  console.error(`kept ${kept.length}/${want} at candidate ${n}`);
}
console.log(kept.join("\n"));
