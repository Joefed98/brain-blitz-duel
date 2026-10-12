/**
 * Design aid for new Scrumper templates (not a proof; snip-solver and
 * arcade-batch4-check prove the result). With the basket moved out of the way,
 * it records the apple's path for many cut plans at pin wobble −10, 0 and +10,
 * then picks the basket x (at the template's basket y, honouring a slide) that
 * the most plans reach at every wobble, the cut orders that win there, and a
 * golden-leaf point on a winning path.
 *
 *   bun scripts/snip-design.ts <templateIndex> [samples] [xFrom] [xTo]
 */
import { inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { snipGame, snipMouthAt, snipTestLevel, SNIP_CONFIG, SNIP_LEVEL_TICKS, type SnipTemplate } from "../src/lib/arcade/snip";
import { cutFor } from "./snip-check-lib";
import { SNIP_CUT_GAP, SNIP_FIRST_CUT, type SnipPlan } from "./snip-solver";

const t = Number(process.argv[2]);
const samples = Number(process.argv[3] ?? 700);
const tpl = SNIP_CONFIG.templates[t]! as SnipTemplate & { mouth: [number, number] };
const xFrom = Number(process.argv[4] ?? 110) + 360;
const xTo = Number(process.argv[5] ?? 430) + 360;
const realMouth: [number, number] = [tpl.mouth[0], tpl.mouth[1]];
(tpl as { mouth: [number, number] }).mouth = [-5000, -5000];

let seed = 12345 + t;
const r = (n: number) => {
  seed ^= seed << 13;
  seed >>>= 0;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  seed >>>= 0;
  return seed % n;
};
const n = tpl.pins.length;

function path(jit: number, plan: SnipPlan): [number, number][] {
  let s = snipTestLevel(t, jit);
  const log: ArcadeInputEvent[] = [];
  const out: [number, number][] = [];
  for (let k = 0; k < SNIP_LEVEL_TICKS; k++) {
    const due = plan.find(([, at]) => at === s.levelTick + 1);
    if (due && s.ropes[due[0]]?.alive) recordInput(log, cutFor(s, due[0]), snipGame.inputRanges);
    const level = s.level;
    s = snipGame.step(s, inputAt(log, s.tick + 1));
    if (s.level !== level) break;
    out.push([s.sx / 256, s.sy / 256]);
  }
  return out;
}

const plans: SnipPlan[] = [];
for (let k = 0; k < samples; k++) {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = r(i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  let at = SNIP_FIRST_CUT + r(160);
  plans.push(order.map((rope) => {
    const step: [number, number] = [rope, at];
    at += SNIP_CUT_GAP + r(120);
    return step;
  }));
}
const paths: Record<number, [number, number][][]> = {};
for (const jit of [-10, 0, 10]) paths[jit] = plans.map((p) => path(jit, p));

const mr = SNIP_CONFIG.mouthRadius;
const fake = { ...tpl, mouth: realMouth } as SnipTemplate;
/** First level tick a path is inside a basket at x, or -1. */
function feeds(p: [number, number][], x: number): number {
  const probe = { ...fake, mouth: [x, realMouth[1]] as const } as SnipTemplate;
  for (let i = 0; i < p.length; i++) {
    const m = snipMouthAt(probe, i + 1);
    const dx = p[i]![0] - m.x / 256;
    const dy = p[i]![1] - m.y / 256;
    if (dx * dx + dy * dy < mr * mr) return i + 1;
  }
  return -1;
}
let best = { x: 0, score: -1, fast: 0 };
for (let x = xFrom; x <= xTo; x += 5) {
  let worst = Infinity;
  let fast = Infinity;
  for (const jit of [-10, 0, 10]) {
    let wins = 0;
    for (const p of paths[jit]!) {
      const at = feeds(p, x);
      if (at > 0) {
        wins += 1;
        fast = Math.min(fast, at);
      }
    }
    worst = Math.min(worst, wins);
  }
  if (worst > best.score || (worst === best.score && fast < best.fast)) best = { x, score: worst, fast };
}
const orders = new Map<string, number>();
const winning: [number, number][][] = [];
plans.forEach((plan, i) => {
  if (feeds(paths[0]![i]!, best.x) > 0) {
    const key = plan.map(([rope]) => rope).join("");
    orders.set(key, (orders.get(key) ?? 0) + 1);
    winning.push(paths[0]![i]!.slice(0, feeds(paths[0]![i]!, best.x)));
  }
});
// Leaf: a point well along a winning path, away from start and basket, near paths of the other wobbles.
let leaf: { x: number; y: number; d: number } | null = null;
for (const p of winning.slice(0, 60)) {
  for (let i = Math.floor(p.length * 0.35); i < p.length * 0.8; i += 3) {
    const [x, y] = p[i]!;
    if (Math.hypot(x - best.x, y - realMouth[1]) < 90 || Math.hypot(x - tpl.sweet[0], y - tpl.sweet[1]) < 60) continue;
    if (x < 470 || x > 790 || y < 50) continue;
    let worst = 0;
    for (const jit of [-10, 10]) {
      let m = 1e9;
      paths[jit]!.forEach((q, qi) => {
        if (feeds(q, best.x) < 0) return;
        void qi;
        for (const [qx, qy] of q) m = Math.min(m, Math.hypot(qx - x, qy - y));
      });
      worst = Math.max(worst, m);
    }
    if (!leaf || worst < leaf.d) leaf = { x: Math.round(x), y: Math.round(y), d: worst };
  }
}
console.log(
  JSON.stringify({
    t,
    name: tpl.name,
    mouthX: best.x - 360,
    worstWins: best.score,
    of: samples,
    fastest: best.fast,
    orders: Object.fromEntries(orders),
    leaf: leaf ? [leaf.x - 360, leaf.y, Math.round(leaf.d)] : null,
  }),
);
