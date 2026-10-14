/**
 * A Scrumper run bot for checks: at the start of each level it tries the
 * stored proof plans for that template (fixtures/snip-rev3-proofs.json) and a
 * seeded random search, each simulated from the level's real state (its actual
 * pin wobble), and plays the fastest plan that feeds the apple — taking the
 * golden leaf when `leaves` is set and some plan does. Cuts are the same swipe
 * a phone records (cutFor), at human pace (first cut ≥ 24 ticks into the level,
 * cuts ≥ 12 apart).
 */
import { existsSync, readFileSync } from "node:fs";

import { inputAt, recordInput, type ArcadeGame, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { snipCheckpoint, SNIP_CHECKPOINT_INTERVAL, SNIP_CONFIG, SNIP_LEVEL_TICKS, SNIP_PROVEN_WOBBLES, SNIP_REV_PROVEN, type SnipState } from "../src/lib/arcade/snip";
import { cutFor } from "./snip-check-lib";
import { SNIP_CUT_GAP, SNIP_FIRST_CUT, type SnipPlan } from "./snip-solver";
import type { SnipProofs } from "./snip-rev3-proofs";

export const SNIP_PROOFS: SnipProofs = {
  ...JSON.parse(readFileSync(new URL("./fixtures/snip-rev3-proofs.json", import.meta.url), "utf8")),
  // Tuning E's tall templates (snipRev 5), keyed by their own indices (60 on).
  ...JSON.parse(readFileSync(new URL("./fixtures/snip-rev5-proofs.json", import.meta.url), "utf8")),
  // snipRev 6's new tall templates (SNIP_BANK6_FIRST on).
  ...JSON.parse(readFileSync(new URL("./fixtures/snip-rev6-proofs.json", import.meta.url), "utf8")),
};

/** snipRev 7's per-deal plans (fixtures/snip-rev7-proofs.json): each template's plans and, per pin-wobble deal, the one that wins it. */
const DEAL_PROOFS_URL = new URL("./fixtures/snip-rev7-proofs.json", import.meta.url);
export const SNIP_DEAL_PROOFS: Record<string, { name: string; pins: number; plans: SnipPlan[]; deal: string; worst: number }> = existsSync(DEAL_PROOFS_URL) ? JSON.parse(readFileSync(DEAL_PROOFS_URL, "utf8")) : {};
export const SNIP_PLAN_SYMBOLS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Each pin's wobble (px) on a level's first state, read off its rope's pin node. */
export function snipPinWobbles(s: SnipState): number[] {
  return SNIP_CONFIG.templates[s.template]!.pins.map(([px], i) => s.ropes[i]!.x[0]! / 256 - px);
}

/** The index of a per-pin deal in snipRev 7's order (pin 0 the slowest-changing digit); -1 if a wobble is not one of SNIP_PROVEN_WOBBLES. */
export function snipDealIndex(wobbles: readonly number[]): number {
  let idx = 0;
  for (const w of wobbles) {
    const k = SNIP_PROVEN_WOBBLES.indexOf(w);
    if (k < 0) return -1;
    idx = idx * SNIP_PROVEN_WOBBLES.length + k;
  }
  return idx;
}

/** The stored snipRev 7 plan for a level's actual deal (null when there is none). */
export function snipDealPlan(s: SnipState): SnipPlan | null {
  const proof = SNIP_DEAL_PROOFS[String(s.template)];
  const idx = snipDealIndex(snipPinWobbles(s));
  if (!proof || idx < 0) return null;
  return proof.plans[SNIP_PLAN_SYMBOLS.indexOf(proof.deal[idx] ?? "-")] ?? null;
}

type Game = ArcadeGame<SnipState, ArcadeInputEvent | null>;

/** Plays `plan` from a level's first state; returns the result without recording anything. */
function tryPlan(game: Game, start: SnipState, plan: SnipPlan): { eaten: boolean; leaf: boolean; ticks: number } {
  let s = start;
  const log: ArcadeInputEvent[] = [];
  for (let k = 0; k < SNIP_LEVEL_TICKS + 2; k++) {
    const due = plan.find(([, at]) => at === s.levelTick + 1);
    if (due && s.ropes[due[0]]?.alive) recordInput(log, cutFor(s, due[0]), game.inputRanges);
    const level = s.level;
    const eaten = s.eaten;
    const stars = s.stars;
    const at = s.levelTick + 1;
    s = game.step(s, inputAt(log, s.tick + 1));
    if (s.level !== level || game.isOver(s)) return { eaten: s.eaten > eaten, leaf: s.stars > stars, ticks: at };
  }
  return { eaten: false, leaf: false, ticks: SNIP_LEVEL_TICKS };
}

export function playSnipRun(game: Game, seed: number, opts: { leaves?: boolean; samples?: number } = {}) {
  const leaves = opts.leaves ?? true;
  const samples = opts.samples ?? 250;
  let s = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  const checkpoints: ReturnType<typeof snipCheckpoint>[] = [];
  let x = (seed * 2654435761) >>> 0 || 1;
  const r = (n: number) => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x % n;
  };
  while (!game.isOver(s)) {
    const proofs = SNIP_PROOFS[String(s.template)] ?? {};
    const plans: SnipPlan[] = [];
    // snipRev 7 only: the plan proven for this exact deal, then the template's other proven plans (older revisions search as before).
    if (s.rev === SNIP_REV_PROVEN) {
      const own = snipDealPlan(s);
      if (own) plans.push(own);
      for (const p of SNIP_DEAL_PROOFS[String(s.template)]?.plans ?? []) if (p !== own) plans.push(p);
    }
    for (const p of Object.values(proofs)) {
      if (p.leaf) plans.push(p.leaf.plan);
      if (p.fast) plans.push(p.fast.plan);
    }
    // A crook's vine is one more rope, cut once it has caught the apple.
    const n = s.ropes.length + (SNIP_CONFIG.templates[s.template]?.hooks?.length ?? 0);
    for (let k = 0; k < samples; k++) {
      const base = plans.length && r(2) === 0 ? plans[r(plans.length)]! : null;
      let plan: SnipPlan;
      if (base) {
        plan = base.map(([rope, at]) => [rope, at + r(31) - 15] as [number, number]).sort((a, b) => a[1] - b[1]);
      } else {
        const order = Array.from({ length: n }, (_, i) => i);
        for (let i = n - 1; i > 0; i--) {
          const j = r(i + 1);
          [order[i], order[j]] = [order[j]!, order[i]!];
        }
        let at = SNIP_FIRST_CUT + r(160);
        plan = order.map((rope) => {
          const step: [number, number] = [rope, at];
          at += SNIP_CUT_GAP + r(120);
          return step;
        });
      }
      let ok = plan[0]![1] >= SNIP_FIRST_CUT;
      for (let j = 1; j < plan.length; j++) if (plan[j]![1] - plan[j - 1]![1] < SNIP_CUT_GAP) ok = false;
      if (ok) plans.push(plan);
    }
    let best: { plan: SnipPlan; key: number } | null = null;
    for (const plan of plans) {
      const res = tryPlan(game, s, plan);
      if (!res.eaten) continue;
      const key = (leaves && !res.leaf ? 10_000 : 0) + res.ticks;
      if (!best || key < best.key) best = { plan, key };
    }
    const plan = best?.plan ?? [];
    const level = s.level;
    while (!game.isOver(s) && s.level === level) {
      const due = plan.find(([, at]) => at === s.levelTick + 1);
      if (due && s.ropes[due[0]]?.alive) recordInput(events, cutFor(s, due[0]), game.inputRanges);
      s = game.step(s, inputAt(events, s.tick + 1));
      if (s.tick % SNIP_CHECKPOINT_INTERVAL === 0) checkpoints.push(snipCheckpoint(s));
    }
  }
  return { state: s, events, checkpoints, score: game.score(s) };
}
