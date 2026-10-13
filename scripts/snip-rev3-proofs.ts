/**
 * Records Scrumper snipRev 3 proof plans (design aid; arcade-batch4-check
 * replays them): for every template at pin wobble −10, 0 and +10, the fastest
 * cut plan found that feeds the apple, and the fastest that also takes the
 * golden leaf. Human pace is built in (snip-solver: first cut ≥ 24 ticks, cuts
 * ≥ 12 ticks apart).
 *
 *   bun scripts/snip-rev3-proofs.ts [samples] > scripts/fixtures/snip-rev3-proofs.json
 *   bun scripts/snip-rev3-proofs.ts --one <template> [samples]    (one template, JSON line)
 */
import { SNIP_CONFIG } from "../src/lib/arcade/snip";
import { solveSnip, type SnipSolution } from "./snip-solver";

export interface SnipProof {
  fast: SnipSolution | null;
  leaf: SnipSolution | null;
}
export type SnipProofs = Record<string, Record<string, SnipProof>>;

export function one(t: number, samples: number): Record<string, SnipProof> {
  const out: Record<string, SnipProof> = {};
  for (const jit of [-SNIP_CONFIG.pinJitter, 0, SNIP_CONFIG.pinJitter]) {
    let best: SnipProof = { fast: null, leaf: null };
    for (const seed of [1, 2]) {
      const r = solveSnip(t, jit, samples, seed);
      if (r.fast && (!best.fast || r.fast.tick < best.fast.tick)) best = { ...best, fast: r.fast };
      if (r.leaf && (!best.leaf || r.leaf.tick < best.leaf.tick)) best = { ...best, leaf: r.leaf };
    }
    out[String(jit)] = best;
  }
  return out;
}

if (import.meta.main) {
  if (process.argv[2] === "--one") {
    console.log(JSON.stringify({ t: Number(process.argv[3]), proof: one(Number(process.argv[3]), Number(process.argv[4] ?? 1200)) }));
  } else {
    const samples = process.argv[2] ?? "1200";
    const ids = Array.from({ length: SNIP_CONFIG.templates.length }, (_, i) => i);
    const results: SnipProofs = {};
    let next = 0;
    const worker = async () => {
      while (next < ids.length) {
        const t = ids[next++]!;
        const p = Bun.spawn(["bun", import.meta.path, "--one", String(t), samples], { stdout: "pipe" });
        const line = JSON.parse((await new Response(p.stdout).text()).trim());
        results[String(t)] = line.proof;
        console.error(`template ${t} done`);
      }
    };
    await Promise.all(Array.from({ length: 8 }, worker));
    const sorted: SnipProofs = {};
    for (const t of ids) sorted[String(t)] = results[String(t)]!;
    console.log(JSON.stringify(sorted, null, 1));
  }
}
