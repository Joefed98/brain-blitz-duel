/**
 * Records the skins replay check's runs (scripts/fixtures/skins-replay-runs.json): for each of the seven skinnable
 * games, on its oldest and its dealt stamp, two runs played as the phone plays them (random inputs, many out of range,
 * on dealt seeds), each with the score the server's own replay stores for it. Recorded on main's sims (no sim changes
 * in the skins work).   bun scripts/skins/record-runs.ts
 */
import { writeFileSync } from "node:fs";
import { playRun, prng, runSpecs } from "./runs";

const specs = await runSpecs();
const out: { game: string; rev: number; seed: number; raw: string; score: number }[] = [];
specs.forEach((spec, i) => {
  const rand = prng(0x5c1e + i * 977);
  for (let n = 0; n < 2; n++) {
    const seed = spec.seedFor(n * 5 + 1);
    const { raw, score } = playRun(spec, seed, rand);
    const server = spec.replay(seed, raw).score;
    if (server !== score) throw new Error(`${spec.game} rev ${spec.rev} seed ${seed}: sim ${score}, replay ${server}`);
    out.push({ game: spec.game, rev: spec.rev, seed, raw, score });
    console.log(spec.game, spec.rev, seed, score);
  }
});
writeFileSync("scripts/fixtures/skins-replay-runs.json", JSON.stringify({ recorded: "11 Nov 2026 on the skins branch; no sim, deal or scoring file differs from main af70c5f", runs: out }) + "\n");
