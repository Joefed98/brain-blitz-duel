/**
 * Scrumper level solver for checks and level design: searches cut orders and
 * cut ticks (human pace: first cut no sooner than SNIP_FIRST_CUT ticks, cuts at
 * least SNIP_CUT_GAP apart) for plans that feed the apple, and refines the
 * fastest. Cuts are the short swipe across a rope next to its pin (cutFor), so
 * every plan is a real input a phone could record.
 *
 *   bun scripts/snip-solver.ts <templateIndex> [samples]
 */
import { inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { snipGame, snipTallGame, snipTestLevel, SNIP_CONFIG, SNIP_EATEN, SNIP_LEVEL_TICKS, type SnipState } from "../src/lib/arcade/snip";
import { cutFor } from "./snip-check-lib";

export const SNIP_FIRST_CUT = 24;
export const SNIP_CUT_GAP = 12;

/** [rope, level tick] pairs. */
export type SnipPlan = [number, number][];

export interface SnipPlay {
  /** Planned cuts that found their rope alive (a crook's vine exists only after its catch). */
  applied: number;
  eaten: boolean;
  /** Level tick the apple was fed (or the level ended). */
  tick: number;
  star: boolean;
  outcome: number;
}

/** Plays one level of `template` with every pin moved by `jitter` px (or pin i by `jitter[i]` px). */
export function playSnipLevel(template: number, jitter: number | readonly number[], plan: SnipPlan): SnipPlay {
  let s: SnipState = snipTestLevel(template, jitter);
  const log: ArcadeInputEvent[] = [];
  const game = s.worldH ? snipTallGame : snipGame;
  let applied = 0;
  for (let k = 0; k < SNIP_LEVEL_TICKS; k++) {
    const due = plan.find(([, at]) => at === s.levelTick + 1);
    if (due && s.ropes[due[0]]?.alive) {
      recordInput(log, cutFor(s, due[0]), game.inputRanges);
      applied += 1;
    }
    const level = s.level;
    const eaten = s.eaten;
    const stars = s.stars;
    const at = s.levelTick + 1;
    s = game.step(s, inputAt(log, s.tick + 1));
    if (s.level !== level) return { applied, eaten: s.eaten > eaten, tick: at, star: s.stars > stars, outcome: s.lastOutcome };
  }
  return { applied, eaten: false, tick: SNIP_LEVEL_TICKS, star: false, outcome: -1 };
}

function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return (n: number) => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x % n;
  };
}

function permutations(n: number): number[][] {
  if (n === 1) return [[0]];
  const out: number[][] = [];
  for (const p of permutations(n - 1)) for (let i = 0; i <= p.length; i++) out.push([...p.slice(0, i), n - 1, ...p.slice(i)]);
  return out;
}

export interface SnipSolution {
  plan: SnipPlan;
  tick: number;
  star: boolean;
}

/**
 * Best plans for a template at one wobble: the fastest feed, and the fastest
 * feed that also takes the golden leaf (null when none was found).
 */
export function solveSnip(template: number, jitter: number | readonly number[], samples = 1500, seed = 1): { fast: SnipSolution | null; leaf: SnipSolution | null; wins: number; tries: number } {
  const tpl = SNIP_CONFIG.templates[template]!;
  // A crook's vine is one more rope to cut, once it has caught the apple.
  const n = tpl.pins.length + (tpl.hooks?.length ?? 0);
  // Tall (Tuning E) plans must use every planned cut: no cut at a rope that is not there.
  const strict = Boolean(tpl.h);
  const perms = permutations(n);
  // Per-pin wobbles fold into the search seed (a single wobble keeps its old seed).
  const jit = typeof jitter === "number" ? jitter : jitter.reduce((a, j) => a * 31 + j + 10, 0);
  const r = rng(seed * 7919 + template * 31 + jit + 100);
  let fast: SnipSolution | null = null;
  let leaf: SnipSolution | null = null;
  let wins = 0;
  const consider = (plan: SnipPlan) => {
    const res = playSnipLevel(template, jitter, plan);
    if (!res.eaten || (strict && res.applied < plan.length)) return false;
    wins += 1;
    if (!fast || res.tick < fast.tick) fast = { plan, tick: res.tick, star: res.star };
    if (res.star && (!leaf || res.tick < leaf.tick)) leaf = { plan, tick: res.tick, star: true };
    return true;
  };
  const random = (): SnipPlan => {
    const perm = perms[r(perms.length)]!;
    let t = SNIP_FIRST_CUT + r(200);
    const plan: SnipPlan = [];
    for (const rope of perm) {
      plan.push([rope, t]);
      t += SNIP_CUT_GAP + r(150);
    }
    return plan;
  };
  for (let k = 0; k < samples; k++) consider(random());
  // Refine: nudge the cut ticks of the best plans toward earlier feeds.
  for (const which of ["fast", "leaf"] as const) {
    for (let round = 0; round < 200; round++) {
      const base = (which === "fast" ? fast : leaf) as SnipSolution | null;
      if (!base) break;
      const plan = base.plan.map(([rope, t]) => [rope, t] as [number, number]);
      const i = r(plan.length);
      plan[i]![1] += r(41) - 24;
      plan.sort((a, b) => a[1] - b[1]);
      let ok = plan[0]![1] >= SNIP_FIRST_CUT;
      for (let j = 1; j < plan.length; j++) if (plan[j]![1] - plan[j - 1]![1] < SNIP_CUT_GAP) ok = false;
      if (ok) consider(plan);
    }
  }
  return { fast, leaf, wins, tries: samples };
}

if (import.meta.main) {
  const t = Number(process.argv[2] ?? 30);
  const samples = Number(process.argv[3] ?? 1500);
  const tpl = SNIP_CONFIG.templates[t]!;
  for (const jit of [-SNIP_CONFIG.pinJitter, 0, SNIP_CONFIG.pinJitter]) {
    const res = solveSnip(t, jit, samples);
    console.log(
      `${t} ${tpl.name} wobble ${jit}: ${res.wins}/${res.tries} wins; fastest ${res.fast ? (res.fast as SnipSolution).tick : "-"} ${JSON.stringify(res.fast ? (res.fast as SnipSolution).plan : null)}; with leaf ${res.leaf ? (res.leaf as SnipSolution).tick : "-"} ${JSON.stringify(res.leaf ? (res.leaf as SnipSolution).plan : null)}`,
    );
  }
  void SNIP_EATEN;
}
