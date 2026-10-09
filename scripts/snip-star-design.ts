/**
 * Design aid (not a proof): for a starless Snip template, finds a golden-leaf
 * position that some winning cut plan passes through at every pin wobble
 * (−10, 0, +10). snip-check then proves the result.
 *
 *   bun scripts/snip-star-design.ts <templateIndex>
 */
import { inputAt, recordInput, type ArcadeInputEvent } from "@/lib/arcade/engine";
import { snipGame, snipTestLevel, SNIP_CONFIG, SNIP_LEVEL_TICKS } from "@/lib/arcade/snip";
import { cutFor } from "./snip-check-lib";

const t = Number(process.argv[2]);
const tpl = SNIP_CONFIG.templates[t]!;
const n = tpl.pins.length;
const step = n === 1 ? 2 : n === 2 ? 5 : 12;
const SPAN = 240;
const PERMS: Record<number, number[][]> = { 1: [[0]], 2: [[0, 1], [1, 0]], 3: [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]] };

/** Trajectory (px) after the first cut of a winning plan, else null. */
function play(jit: number, plan: [number, number][]): [number, number][] | null {
  let s = snipTestLevel(t, jit);
  const log: ArcadeInputEvent[] = [];
  const path: [number, number][] = [];
  for (let k = 0; k < SNIP_LEVEL_TICKS; k++) {
    const due = plan.find(([, at]) => at === s.levelTick + 1);
    if (due) recordInput(log, cutFor(s, due[0]), snipGame.inputRanges);
    const eaten = s.eaten, level = s.level;
    s = snipGame.step(s, inputAt(log, s.tick + 1));
    if (s.level !== level) return s.eaten > eaten ? path : null;
    if (s.levelTick > plan[0]![1] + 4) path.push([s.sx / 256, s.sy / 256]);
  }
  return null;
}

const wins: Record<number, [number, number][][]> = {};
for (const jit of [-10, 0, 10]) {
  wins[jit] = [];
  for (const perm of PERMS[n]!) {
    const go = (k: number, from: number, plan: [number, number][]) => {
      if (k === n) { const p = play(jit, plan); if (p && p.length > 6) wins[jit]!.push(p); return; }
      for (let at = from; at <= SPAN; at += step) go(k + 1, at + 1, [...plan, [perm[k]!, at]]);
    };
    go(0, 1, []);
  }
}
const [mx, my] = tpl.mouth;
let best: { x: number; y: number; d: number } | null = null;
for (const path of wins[0]!) {
  for (let i = Math.floor(path.length * 0.3); i < path.length * 0.75; i += 3) {
    const [x, y] = path[i]!;
    if (x < 470 || x > 790) continue;
    if (Math.hypot(x - mx, y - my) < 110 || Math.hypot(x - tpl.sweet[0], y - tpl.sweet[1]) < 60) continue;
    if (tpl.platforms.some(([a, b, c, d]) => x > a - 20 && x < c + 20 && y > b - 30 && y < d + 20)) continue;
    let worst = 0;
    for (const jit of [-10, 10]) {
      let m = 1e9;
      for (const q of wins[jit]!) for (const [qx, qy] of q) m = Math.min(m, Math.hypot(qx - x, qy - y));
      worst = Math.max(worst, m);
    }
    if (!best || worst < best.d) best = { x: Math.round(x), y: Math.round(y), d: worst };
  }
}
console.log(JSON.stringify({ t, name: tpl.name, wins: [wins[-10]!.length, wins[0]!.length, wins[10]!.length], star: best ? [best.x - 360, best.y] : null, spread: best?.d }));
