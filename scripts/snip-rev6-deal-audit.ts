/**
 * Scrumper snipRev 6 deal audit (design aid, not a check): snipRev 6 deals each
 * pin its own 1 px wobble in −10…+10, so a level with k pins has 21^k deals.
 * For every template in SNIP_BANDS_V6 it plays every deal of one- and two-pin
 * levels (21 and 441) and `--sample` seeded deals of three- and four-pin
 * levels (9,261 and 194,481 in all) with the stored snipRev 5/6/7 plans, then
 * searches (snip-solver, human pace) the deals none of them wins, and reports
 * the deals still lost.
 *
 *   bun scripts/snip-rev6-deal-audit.ts [--sample=400] [--samples=600] [templates…]
 *   bun scripts/snip-rev6-deal-audit.ts --one <template> <sample> <samples>   (JSON line)
 */
import { existsSync, readFileSync } from "node:fs";
import { SNIP_BANDS_V6, SNIP_CONFIG } from "../src/lib/arcade/snip";
import { playSnipLevel, solveSnip, type SnipPlan } from "./snip-solver";
import { SNIP_PROOFS } from "./snip-run-bot";

const REV7 = new URL("./fixtures/snip-rev7-proofs.json", import.meta.url);
const rev7: Record<string, { plans: SnipPlan[] }> = existsSync(REV7) ? JSON.parse(readFileSync(REV7, "utf8")) : {};

export function auditTemplate(t: number, sample: number, samples: number) {
  const tpl = SNIP_CONFIG.templates[t]!;
  const k = tpl.pins.length;
  const plans: SnipPlan[] = [...(rev7[String(t)]?.plans ?? [])];
  for (const p of Object.values(SNIP_PROOFS[String(t)] ?? {})) for (const q of [p.fast, p.leaf]) if (q) plans.push(q.plan);
  let deals: number[][] = [];
  if (21 ** k <= 441) {
    deals = [[]];
    for (let p = 0; p < k; p++) deals = deals.flatMap((c) => Array.from({ length: 21 }, (_, w) => [...c, w - 10]));
  } else {
    let x = (t * 2654435761) >>> 0 || 1;
    const r = (n: number) => {
      x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
      return x % n;
    };
    for (let i = 0; i < sample; i++) deals.push(Array.from({ length: k }, () => r(21) - 10));
  }
  const wins = (jit: number[], plan: SnipPlan) => {
    const res = playSnipLevel(t, jit, plan);
    return res.eaten && res.applied === plan.length;
  };
  let byStored = 0;
  let bySearch = 0;
  const lost: number[][] = [];
  for (const jit of deals) {
    if (plans.some((plan) => wins(jit, plan))) {
      byStored++;
      continue;
    }
    let found: SnipPlan | null = null;
    for (const seed of [1, 2, 3]) {
      const res = solveSnip(t, jit, samples, seed);
      if (res.fast) {
        found = res.fast.plan;
        break;
      }
    }
    if (found) {
      plans.push(found);
      bySearch++;
    } else lost.push(jit);
  }
  return { t, name: tpl.name, pins: k, deals: deals.length, exhaustive: 21 ** k <= 441, byStored, bySearch, lost };
}

if (import.meta.main) {
  if (process.argv[2] === "--one") {
    console.log(JSON.stringify(auditTemplate(Number(process.argv[3]), Number(process.argv[4]), Number(process.argv[5]))));
  } else {
    const opt = (name: string, d: number) => Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? d);
    const sample = opt("sample", 400);
    const samples = opt("samples", 600);
    const named = process.argv.slice(2).filter((a) => !a.startsWith("--")).map(Number);
    const ids = named.length ? named : [...SNIP_BANDS_V6.easy, ...SNIP_BANDS_V6.medium, ...SNIP_BANDS_V6.hard].sort((a, b) => SNIP_CONFIG.templates[b]!.pins.length - SNIP_CONFIG.templates[a]!.pins.length);
    let next = 0;
    const out: ReturnType<typeof auditTemplate>[] = [];
    const worker = async () => {
      while (next < ids.length) {
        const t = ids[next++]!;
        const p = Bun.spawn(["bun", import.meta.path, "--one", String(t), String(sample), String(samples)], { stdout: "pipe", stderr: "inherit" });
        const res = JSON.parse((await new Response(p.stdout).text()).trim()) as ReturnType<typeof auditTemplate>;
        out.push(res);
        console.error(`${res.t} ${res.name} (${res.pins} pins): ${res.deals} deals${res.exhaustive ? " (all)" : " (sampled)"}, stored plans ${res.byStored}, search ${res.bySearch}, LOST ${res.lost.length}${res.lost.length ? ` e.g. ${JSON.stringify(res.lost.slice(0, 6))}` : ""}`);
      }
    };
    await Promise.all(Array.from({ length: Number(process.env.SNIP_PROOF_JOBS ?? 4) }, worker));
    console.log(JSON.stringify(out.sort((a, b) => a.t - b.t)));
  }
}
