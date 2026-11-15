/**
 * Records orbit-overhaul-check section 9's legacy fixture (scripts/fixtures/orbit-big-legacy.json) on a checkout of main from
 * before stage 3 of the Action overhaul (329286de): runs on orbitRev 12, 13, 14 and 15 (each the course that revision deals for the room
 * seed), the skill-band bot at weak, good and elite plus a random tapper and a checkpoint-then-crash log, each with the
 * server replay's score and the final checkpoint (checksum included). Run once; never re-record over it.
 *
 *   bun scripts/orbit-big-record.ts <main checkout>
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const mod = async (p: string) => import(resolve(root, p));

const orbit = await mod("src/lib/arcade/orbit.ts");
const rev3 = await mod("src/lib/arcade/orbitRev3.ts");
const duel = await mod("src/lib/duel/orbit.ts");
const games = await mod("scripts/arcade-skill-bands/games.ts");
const human = await mod("scripts/arcade-skill-bands/human.ts");
const botMod = await mod("scripts/arcade-skill-bands/bots/orbit.ts");

const spec = games.GAME_BY_TYPE.get("orbit");
type Ev = { t: number; k: number; a: number; b: number; c: number; d: number };
const runs: { rev: number; n: number; seed: number; kind: string; events: Ev[]; score: number; checkpoint: unknown; endTick: number }[] = [];

function play(rev: number, seed: number, events: Ev[]) {
  const game = spec.gameFor(rev, seed);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  const checkpoints: unknown[] = [];
  while (!s.ended && s.tick < rev3.orbitRev3Game.runTicks) {
    s = rev3.orbitRev3Game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % 300 === 0) checkpoints.push(orbit.orbitCheckpoint(s));
  }
  const raw = duel.encodeOrbitRun({ seed, claimedScore: rev3.orbitRev3Game.score(s), events, inputs: [], taps: [], endTick: s.tick, checkpoints });
  const r = spec.replay(seed, raw, rev);
  return { score: r.score, checkpoint: orbit.orbitCheckpoint(r.state), endTick: r.state.tick };
}

for (const rev of [orbit.ORBIT_REV_XP, orbit.ORBIT_REV_STD, orbit.ORBIT_REV_FUEL, orbit.ORBIT_REV_GRACE]) {
  for (let n = 0; n < 6; n++) {
    const seed = spec.seedForRev(n, rev) ?? spec.seedForX(n);
    for (const level of ["weak", "good", "elite"]) {
      const out = botMod.bot({ game: spec.gameFor(rev, seed), seed, rev, human: new human.Human("orbit", seed, level), fixes: true });
      const events = (out.events ?? []) as Ev[];
      runs.push({ rev, n, seed, kind: level, events, ...play(rev, seed, events) });
    }
    // A random tapper (a seeded tap every 40–120 ticks) and a checkpoint set early, then taps.
    let h = (seed * 2654435761) >>> 0;
    const rnd: Ev[] = [];
    for (let t = 30; t < 5400; ) {
      h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
      t += 40 + (h % 81);
      rnd.push({ t, k: orbit.ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 });
    }
    runs.push({ rev, n, seed, kind: "random", events: rnd, ...play(rev, seed, rnd) });
    const cp: Ev[] = [{ t: 3, k: orbit.ORBIT_INPUT_CHECKPOINT, a: 0, b: 0, c: 0, d: 0 }, ...rnd.slice(0, 12)];
    runs.push({ rev, n, seed, kind: "checkpoint", events: cp, ...play(rev, seed, cp) });
  }
}
writeFileSync("scripts/fixtures/orbit-big-legacy.json", JSON.stringify({ recordedOn: "329286de", runs }) + "\n");
console.log(`recorded ${runs.length} runs`);
