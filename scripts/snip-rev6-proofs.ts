/**
 * Records Scrumper snipRev 6 (bank growth) proof plans (design aid;
 * snip-bank6-check replays them): for every new template in the snipRev 6
 * bands (SNIP_BANK6_FIRST on; the older tall ones keep fixtures/snip-rev5-proofs.json),
 * at pin wobble −10, 0 and +10, the fastest cut plan found that feeds the
 * apple and the fastest that also takes the golden leaf, at human pace
 * (snip-solver: first cut ≥ 24 ticks, cuts ≥ 12 apart, every planned cut used,
 * a crook's vine cut only once it has caught the apple).
 *
 *   bun scripts/snip-rev6-proofs.ts [samples] > scripts/fixtures/snip-rev6-proofs.json
 */
import { SNIP_BANDS_V6, SNIP_BANK6_FIRST } from "../src/lib/arcade/snip";
import { one, type SnipProofs } from "./snip-rev3-proofs";

if (import.meta.main) {
  if (process.argv[2] === "--one") {
    console.log(JSON.stringify({ t: Number(process.argv[3]), proof: one(Number(process.argv[3]), Number(process.argv[4] ?? 1200)) }));
  } else {
    const samples = process.argv[2] ?? "1200";
    const ids = [...SNIP_BANDS_V6.easy, ...SNIP_BANDS_V6.medium, ...SNIP_BANDS_V6.hard].filter((t) => t >= SNIP_BANK6_FIRST).sort((a, b) => a - b);
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
    await Promise.all(Array.from({ length: 4 }, worker));
    const sorted: SnipProofs = {};
    for (const t of ids) sorted[String(t)] = results[String(t)]!;
    console.log(JSON.stringify(sorted, null, 1));
  }
}
