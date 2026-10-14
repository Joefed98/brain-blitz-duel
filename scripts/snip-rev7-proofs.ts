/**
 * Records Scrumper snipRev 7 (proven deals) proof plans (design aid;
 * snip-rev7-check replays them). snipRev 7 deals each pin its own seeded
 * wobble from SNIP_PROVEN_WOBBLES (−10, −5, 0, +5, +10 px), so a level with k
 * pins has exactly 5^k possible deals. For every template in SNIP_BANDS_V7
 * (and any candidate passed with --one), every one of those per-pin
 * combinations gets a stored human-paced winning plan (snip-solver: first cut
 * ≥ 24 ticks, cuts ≥ 12 apart, every planned cut used, a crook's vine cut only
 * once it has caught the apple). Per template the fixture keeps a short list
 * of plans and a `deal` string: character i names the fastest stored plan that
 * wins combination i (SNIP_PLAN_SYMBOLS; "-" = no plan found, which the check
 * fails). Plans start from the template's stored snipRev 5/6 plans and grow
 * with solver searches at the combinations none of them wins.
 *
 *   bun scripts/snip-rev7-proofs.ts [samples] > scripts/fixtures/snip-rev7-proofs.json
 *   bun scripts/snip-rev7-proofs.ts --one <template> [samples]    (one template, JSON line)
 */
import { SNIP_BANDS_V7, SNIP_CONFIG, SNIP_PROVEN_WOBBLES } from "../src/lib/arcade/snip";
import { playSnipLevel, solveSnip, type SnipPlan } from "./snip-solver";
import { SNIP_PLAN_SYMBOLS, SNIP_PROOFS } from "./snip-run-bot";

/** One template's proof: its plans and, per deal, the index of the plan that wins it. */
export interface SnipDealProof {
  name: string;
  pins: number;
  plans: SnipPlan[];
  /** Character i (SNIP_PLAN_SYMBOLS) = the plan for combination i (snipDeals order); "-" = none. */
  deal: string;
  /** Slowest feed over every deal (level ticks). */
  worst: number;
}
export type SnipDealProofs = Record<string, SnipDealProof>;

/** Every per-pin wobble combination a snipRev 7 deal can give `pins` pins (pin 0 the slowest-changing digit). */
export function snipDeals(pins: number): number[][] {
  let out: number[][] = [[]];
  for (let p = 0; p < pins; p++) out = out.flatMap((c) => SNIP_PROVEN_WOBBLES.map((w) => [...c, w]));
  return out;
}

function wins(t: number, jit: readonly number[], plan: SnipPlan): number | null {
  const res = playSnipLevel(t, jit, plan);
  return res.eaten && res.applied === plan.length ? res.tick : null;
}

export function oneDeal(t: number, samples: number, log = false): SnipDealProof {
  const tpl = SNIP_CONFIG.templates[t]!;
  const deals = snipDeals(tpl.pins.length);
  const seen = new Set<string>();
  const plans: SnipPlan[] = [];
  const add = (plan: SnipPlan) => {
    const key = JSON.stringify(plan);
    if (seen.has(key)) return;
    seen.add(key);
    plans.push(plan);
  };
  for (const p of Object.values(SNIP_PROOFS[String(t)] ?? {})) {
    if (p.fast) add(p.fast.plan);
    if (p.leaf) add(p.leaf.plan);
  }
  // Pass 1: grow the plan list until every deal has a winner (or the solver gives up on it).
  const lost: number[] = [];
  deals.forEach((jit, i) => {
    if (plans.some((plan) => wins(t, jit, plan) !== null)) return;
    let found: SnipPlan | null = null;
    for (const seed of [1, 2, 3]) {
      const res = solveSnip(t, jit, samples, seed);
      if (res.fast) {
        found = res.fast.plan;
        if (res.leaf) add(res.leaf.plan);
        break;
      }
    }
    if (found) add(found);
    else lost.push(i);
    if (log) console.error(`  ${t} deal ${JSON.stringify(jit)}: ${found ? `new plan ${JSON.stringify(found)}` : "NO PLAN"}`);
  });
  // Pass 2: each deal takes the fastest stored plan that wins it.
  let deal = "";
  let worst = 0;
  const used = new Set<number>();
  const pick: number[] = [];
  deals.forEach((jit) => {
    let best = -1;
    let bestTick = Infinity;
    plans.forEach((plan, k) => {
      const tick = wins(t, jit, plan);
      if (tick !== null && tick < bestTick) {
        best = k;
        bestTick = tick;
      }
    });
    pick.push(best);
    if (best >= 0) {
      used.add(best);
      worst = Math.max(worst, bestTick);
    }
  });
  // Keep only the plans some deal uses (renumbered in order).
  const keep = [...used].sort((a, b) => a - b);
  if (keep.length > SNIP_PLAN_SYMBOLS.length) throw new Error(`template ${t}: ${keep.length} plans exceed the deal alphabet`);
  for (const k of pick) deal += k < 0 ? "-" : SNIP_PLAN_SYMBOLS[keep.indexOf(k)]!;
  return { name: tpl.name, pins: tpl.pins.length, plans: keep.map((k) => plans[k]!), deal, worst };
}

if (import.meta.main) {
  if (process.argv[2] === "--one") {
    console.log(JSON.stringify({ t: Number(process.argv[3]), proof: oneDeal(Number(process.argv[3]), Number(process.argv[4] ?? 600), process.env.SNIP_PROOF_LOG === "1") }));
  } else {
    const samples = process.argv[2] ?? "600";
    const ids = [...SNIP_BANDS_V7.easy, ...SNIP_BANDS_V7.medium, ...SNIP_BANDS_V7.hard].sort((a, b) => a - b);
    // Slowest first (four-pin levels have 625 deals).
    const order = [...ids].sort((a, b) => SNIP_CONFIG.templates[b]!.pins.length - SNIP_CONFIG.templates[a]!.pins.length);
    const results: SnipDealProofs = {};
    let next = 0;
    const worker = async () => {
      while (next < order.length) {
        const t = order[next++]!;
        const p = Bun.spawn(["bun", import.meta.path, "--one", String(t), samples], { stdout: "pipe", stderr: "inherit" });
        const line = JSON.parse((await new Response(p.stdout).text()).trim());
        results[String(t)] = line.proof;
        const lost = [...(line.proof.deal as string)].filter((ch) => ch === "-").length;
        console.error(`template ${t} (${line.proof.name}): ${line.proof.plans.length} plans, worst ${line.proof.worst} ticks${lost ? `, ${lost} of ${line.proof.deal.length} deals LOST` : ""}`);
      }
    };
    await Promise.all(Array.from({ length: Number(process.env.SNIP_PROOF_JOBS ?? 4) }, worker));
    const sorted: SnipDealProofs = {};
    for (const t of ids) sorted[String(t)] = results[String(t)]!;
    console.log(JSON.stringify(sorted));
  }
}
