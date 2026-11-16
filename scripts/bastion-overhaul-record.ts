/**
 * Records bastion-overhaul-check's rev-3 runs (scripts/fixtures/bastion-overhaul-rev3.json): the skill-band bot at every
 * level on four seeds each, played on bastionRev 3, encoded as the phone sends a run, with the server replay's score,
 * parts, final checksum and tick. Run it against main's tree (the sim the overhaul must not change):
 *
 *   bun scripts/bastion-overhaul-record.ts <main checkout>     # writes the fixture in this tree
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const { bastionTankGameFor, bastionTankCheckpoint, BT2_CHECKPOINT_INTERVAL } = await import(`${root}/src/lib/arcade/bastionTank.ts`);
const { encodeBastionTankRun, replayBastionTankRun } = await import(`${root}/src/lib/duel/bastion.ts`);
const { bot } = await import(`${root}/scripts/arcade-skill-bands/bots/bastion.ts`);
const { ALL_LEVELS, Human } = await import(`${root}/scripts/arcade-skill-bands/human.ts`);

type Ev = { t: number; k: number; a: number; b: number; c: number };
const runs: { seed: number; level: string; raw: string; score: number; parts: [string, number][]; checksum: number; tick: number }[] = [];
const g = bastionTankGameFor(3);
for (const level of ALL_LEVELS as string[]) {
  for (let n = 0; n < 4; n++) {
    const seed = 7300 + n * 9173 + level.length;
    const { events } = bot({ game: g, seed, rev: 3, human: new Human("bastion", seed, level) }) as { events: Ev[] };
    const at = new Map(events.map((e) => [e.t, e]));
    const checkpoints = [];
    let s = g.init(seed);
    while (!g.isOver(s)) {
      s = g.step(s, at.get(s.tick + 1) ?? null);
      if (s.tick % BT2_CHECKPOINT_INTERVAL === 0) checkpoints.push(bastionTankCheckpoint(s));
    }
    const raw = encodeBastionTankRun({ seed, claimedScore: g.score(s), events, endTick: s.tick, checkpoints });
    const out = replayBastionTankRun(seed, raw, 3);
    runs.push({ seed, level, raw, score: out.score, parts: out.parts.map((p: { key: string; points: number }) => [p.key, p.points]), checksum: bastionTankCheckpoint(out.state).checksum, tick: out.state.tick });
  }
}
const out = new URL("./fixtures/bastion-overhaul-rev3.json", import.meta.url);
writeFileSync(out, JSON.stringify({ recordedOn: process.argv[3] ?? "main", runs }) + "\n");
console.log(`wrote ${runs.length} runs (scores ${runs.map((r) => r.score).join(", ")})`);
