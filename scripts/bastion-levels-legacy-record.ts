/**
 * Records Iron Wall's bastionRev 2 and 3 runs for bastion-levels-check's proof that they replay, score and grade exactly
 * as before once bastionRev 4 (the levels, 15 Nov 2026; docs/arcade-standard/bastion.md "bastionRev 4: levels") is
 * dealt: the skill-band bots at every level, the oracle and random input, played through the sim of the tree at `root`,
 * encoded the way the phone does, replayed through that tree's server replay and graded by its `gradeAnswer`. Run it on
 * a checkout from before bastionRev 4:
 *
 *   bun scripts/bastion-levels-legacy-record.ts <root> <commit>
 *
 * It writes scripts/fixtures/bastion-levels-legacy.json here: each run's revision, seed, raw answer, and the score,
 * parts, final checksum and end tick the server stored, and the graded score and correctness.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const sim = await import(`${root}/src/lib/arcade/bastionTank.ts`);
const duel = await import(`${root}/src/lib/duel/bastion.ts`);
const grade = await import(`${root}/src/lib/duel/generate.server.ts`);
const bots = await import(`${root}/scripts/arcade-skill-bands/bots/bastion.ts`);
const human = await import(`${root}/scripts/arcade-skill-bands/human.ts`);

const runs: unknown[] = [];
const levels: string[] = human.ALL_LEVELS;
for (const rev of [2, 3]) {
  const game = sim.bastionTankGameFor(rev);
  for (let i = 0; i < 40; i++) {
    const seed = 41000 + rev * 1000 + i * 6151;
    const level = levels[i % levels.length]!;
    const h = new human.Human("bastion", seed, level);
    const random = i % 8 === 7;
    const events = (random ? bots.randomBot : bots.bot)({ game, seed, rev, human: h }).events;
    let s = game.init(seed);
    const at = new Map((events as { t: number }[]).map((e) => [e.t, e]));
    const checkpoints: unknown[] = [];
    while (!game.isOver(s)) {
      s = game.step(s, at.get(s.tick + 1) ?? null);
      if (s.tick % sim.BT2_CHECKPOINT_INTERVAL === 0) checkpoints.push(sim.bastionTankCheckpoint(s));
    }
    const raw = duel.encodeBastionTankRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
    const out = duel.replayBastionTankRun(seed, raw, rev);
    const graded = grade.gradeAnswer({ type: "bastion", seed, bastionRev: rev, puzzleScoreRev: 3, speedPar: 1 }, raw, 0);
    runs.push({
      rev,
      seed,
      level: random ? "random" : level,
      raw,
      score: out.score,
      parts: out.parts.map((p: { key: string; points: number }) => [p.key, p.points]),
      flagged: out.flagged,
      checksum: sim.bastionTankCheckpoint(out.state).checksum,
      tick: out.state.tick,
      graded: [graded.score, graded.isCorrect],
    });
  }
}
const path = resolve(import.meta.dir, "fixtures/bastion-levels-legacy.json");
writeFileSync(path, JSON.stringify({ recordedOn: process.argv[3] ?? "branch", runs }) + "\n");
console.log(`wrote ${runs.length} runs to ${path}`);
