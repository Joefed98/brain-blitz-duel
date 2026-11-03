/**
 * Records bastionRev 2 runs (the tank shooter as first dealt, 1 Nov 2026) for bastion-check's proof that rev 2 replays
 * and scores exactly as before once bastionRev 3 (Iron Wall, 3 Nov 2026) is dealt: the skill-band bots at every level,
 * the oracle and random input, played through the rev-2 sim of the tree at `root`, encoded the way the phone does and
 * replayed through that tree's server path. Run it on an unmodified main checkout:
 *
 *   git worktree add /tmp/main origin/main && bun scripts/bastion-rev2-legacy-record.ts /tmp/main <commit>
 *
 * It writes scripts/fixtures/bastion-rev2-legacy.json here: each run's seed, raw answer, and the score, parts, final
 * checksum and end tick the server stored.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const sim = await import(`${root}/src/lib/arcade/bastionTank.ts`);
const duel = await import(`${root}/src/lib/duel/bastion.ts`);
const bots = await import(`${root}/scripts/arcade-skill-bands/bots/bastion.ts`);
const human = await import(`${root}/scripts/arcade-skill-bands/human.ts`);

const game = sim.bastionTankGame;
const runs: unknown[] = [];
const levels: string[] = human.ALL_LEVELS;
for (let i = 0; i < 48; i++) {
  const seed = 9000 + i * 7727;
  const level = levels[i % levels.length]!;
  const h = new human.Human("bastion", seed, level);
  const events = (i % 8 === 7 ? bots.randomBot : bots.bot)({ game, seed, rev: 2, human: h }).events;
  let s = game.init(seed);
  const at = new Map((events as { t: number }[]).map((e) => [e.t, e]));
  const checkpoints: unknown[] = [];
  while (!game.isOver(s)) {
    s = game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % sim.BT2_CHECKPOINT_INTERVAL === 0) checkpoints.push(sim.bastionTankCheckpoint(s));
  }
  const raw = duel.encodeBastionTankRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
  const out = duel.replayBastionTankRun(seed, raw);
  runs.push({
    seed,
    level: i % 8 === 7 ? "random" : level,
    raw,
    score: out.score,
    parts: out.parts.map((p: { key: string; points: number }) => [p.key, p.points]),
    flagged: out.flagged,
    checksum: sim.bastionTankCheckpoint(out.state).checksum,
    tick: out.state.tick,
  });
}
const path = resolve(import.meta.dir, "fixtures/bastion-rev2-legacy.json");
writeFileSync(path, JSON.stringify({ recordedOn: process.argv[3] ?? "main", runs }) + "\n");
console.log(`wrote ${runs.length} runs to ${path}`);
