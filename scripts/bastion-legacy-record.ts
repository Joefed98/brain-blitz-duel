/**
 * Records original (unstamped) Bastion runs for bastion-check's legacy proof: random and steady input logs played
 * through the original sim, encoded the way the phone does, and replayed through the server path of the tree at
 * `root` (default this one). Run it on an unmodified main checkout:
 *
 *   git worktree add /tmp/main origin/main && bun scripts/bastion-legacy-record.ts /tmp/main
 *
 * It writes scripts/fixtures/bastion-legacy.json here: each run's seed, raw answer, and the score, destroyed count,
 * health and final checkpoint the server stored.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const sim = await import(`${root}/src/lib/arcade/bastion.ts`);
const duel = await import(`${root}/src/lib/duel/bastion.ts`);
const engine = await import(`${root}/src/lib/arcade/engine.ts`);

let r = 0x2468ace1;
const rand = (n: number) => {
  r = (Math.imul(r, 1103515245) + 12345) >>> 0;
  return (r >>> 8) % n;
};

const runs: unknown[] = [];
for (let i = 0; i < 40; i++) {
  const seed = 1 + rand(0x7ffffffe);
  const events: unknown[] = [];
  const style = i % 4;
  let t = 1;
  while (t < sim.BAS_RUN_TICKS) {
    // Sweeping aim, held, with lifts; style 0 idle after a first touch, 3 a fast sweep.
    const x = style === 3 ? (t * 7) % 390 : 40 + rand(310);
    const y = 60 + rand(400);
    engine.recordInput(events, { t, k: 7, a: x, b: y, c: rand(4) === 0 ? 0 : 1, d: 0 }, sim.BAS_INPUT_RANGES);
    if (style === 0 && t > 30) break;
    t += style === 3 ? 4 : 6 + rand(40);
  }
  const game = sim.bastionGame;
  let s = game.init(seed);
  const at = new Map((events as { t: number }[]).map((e) => [e.t, e]));
  const checkpoints: unknown[] = [];
  while (!game.isOver(s)) {
    s = game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % sim.BAS_CHECKPOINT_INTERVAL === 0) checkpoints.push(sim.basCheckpoint(s));
  }
  const raw = duel.encodeBastionRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
  const out = duel.replayBastionRun(seed, raw);
  runs.push({ seed, raw, score: out.score, destroyed: out.destroyed, health: out.health, survived: out.survived, flagged: out.flagged, checksum: sim.basCheckpoint(out.state).checksum, tick: out.state.tick });
}
const path = resolve(import.meta.dir, "fixtures/bastion-legacy.json");
writeFileSync(path, JSON.stringify({ recordedOn: process.argv[3] ?? "main", runs }) + "\n");
console.log(`wrote ${runs.length} runs to ${path}`);
