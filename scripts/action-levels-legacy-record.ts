/**
 * Records scripts/fixtures/action-levels-legacy.json (kept gzipped, .json.gz): Grappler's (swingRev 18) and Moon Climb's (ricoRev 4) Normal deals
 * and runs as they were before the difficulty levels (15 Nov 2026), for swing-levels-check and ricochet-levels-check.
 * Run it on a tree from before the levels with that tree's sims copied beside the live ones:
 *
 *   git show <commit>:src/lib/arcade/swing.ts > src/lib/arcade/swing.orig.ts
 *   git show <commit>:src/lib/arcade/ricochetNinja.ts > src/lib/arcade/ricochetNinja.orig.ts
 *   bun scripts/action-levels-legacy-record.ts <commit>
 *   rm src/lib/arcade/swing.orig.ts src/lib/arcade/ricochetNinja.orig.ts
 *
 * (Recorded on de3bec96, the merge the levels were built on.) For each sampled seed: the tower's or course's digest
 * (its whole dealt state), and a skill-band bot's input log at three levels with the final score and checkpoint
 * checksums the earlier sim gave. The checks replay each log through today's server path and compare.
 */
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
// @ts-expect-error: the earlier sim, copied in only while recording (see above).
import * as oldSwing from "../src/lib/arcade/swing.orig";
// @ts-expect-error: the earlier sim, copied in only while recording (see above).
import * as oldMoon from "../src/lib/arcade/ricochetNinja.orig";
import { swingBigDealSeed } from "../src/lib/duel/swingBigDeal.server";
import { roomSeed } from "./arcade-skill-bands/games";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";
import { bot as swingBot } from "./arcade-skill-bands/bots/swing";
import { bot as ricoBot } from "./arcade-skill-bands/bots/ricochet";

const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 24);
type Ev = { t: number; k: number; a: number; b: number; c: number; d: number };

function play(game: any, seed: number, events: Ev[], checkpoint: (s: any) => { checksum: number }, every: number) {
  const byT = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  const sums: number[] = [];
  while (!game.isOver(s)) {
    s = game.step(s, byT.get(s.tick + 1) ?? null);
    if (s.tick % every === 0) sums.push(checkpoint(s).checksum);
  }
  return { score: game.score(s) as number, sums };
}

const LEVELS: SkillLevel[] = ["average", "great", "elite"];
const swing: unknown[] = [];
for (let n = 0; n < 6; n++) {
  const seed = swingBigDealSeed(roomSeed(n));
  const game = oldSwing.swingGameFor(oldSwing.SWING_REV_BIG);
  const state = game.init(seed);
  const runs = LEVELS.map((lv) => {
    const events = (swingBot({ game, seed, rev: oldSwing.SWING_REV_BIG, human: new Human("swing", seed, lv), fixes: true } as never).events ?? []) as Ev[];
    return { level: lv, events, ...play(game, seed, events, oldSwing.swingCheckpoint, oldSwing.SWING_CHECKPOINT_INTERVAL) };
  });
  swing.push({ seed, course: digest(state), runs });
  console.log("swing", n, seed, runs.map((r) => r.score).join(" "));
}
const moon: unknown[] = [];
for (let n = 0; n < 24; n++) {
  const seed = roomSeed(n);
  const deal = oldMoon.moonDeal(seed, oldMoon.MOON_BIG_REV);
  const game = oldMoon.moonGameFor(oldMoon.MOON_BIG_REV);
  const runs = n < 8
    ? LEVELS.map((lv) => {
        const events = (ricoBot({ game, seed, rev: oldMoon.MOON_BIG_REV, human: new Human("ricochet", seed, lv), fixes: true } as never).events ?? []) as Ev[];
        return { level: lv, events, ...play(game, seed, events, oldMoon.moonCheckpoint, oldMoon.NINJA_CHECKPOINT_INTERVAL) };
      })
    : [];
  moon.push({ seed, tower: digest(deal.tower), witness: digest(deal.witness), init: digest(game.init(seed)), runs });
  console.log("moon", n, seed, runs.map((r) => r.score).join(" "));
}
writeFileSync(
  new URL("./fixtures/action-levels-legacy.json", import.meta.url), // (then gzip -9 -n it: action-levels-legacy.json.gz)
  `${JSON.stringify({ note: `Grappler swingRev 18 and Moon Climb ricoRev 4 Normal deals and runs recorded on ${process.argv[2] ?? "?"} before the difficulty levels (scripts/action-levels-legacy-record.ts)`, swing, moon })}\n`,
);
