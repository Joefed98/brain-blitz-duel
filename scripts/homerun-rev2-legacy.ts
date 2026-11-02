/**
 * Records scripts/fixtures/homerun-rev1-legacy.json: homerunRev 1 runs (the skill-band bots at every level and the
 * random swiper on deal seeds, plus hand-made edge swings) with the score and final checksum the rev-1 code gave them.
 * Recorded on main b154694 before homerunRev 2 (31 Oct 2026); homerun-check replays every run and fails on any
 * difference. Never re-record over it.
 *
 *   bun scripts/homerun-rev2-legacy.ts --write
 */
import { writeFileSync } from "node:fs";
import { recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { homerunCheckpoint, homerunGameFor, HOMERUN_INPUT_RANGES, HOMERUN_INPUT_SWING } from "../src/lib/arcade/homerun";
import { HOMERUN_DEAL } from "../src/lib/duel/homerunDeal.server";
import { ALL_LEVELS, Human } from "./arcade-skill-bands/human";
import { bot, randomBot } from "./arcade-skill-bands/bots/homerun";

export interface LegacyRun {
  seed: number;
  label: string;
  events: ArcadeInputEvent[];
  score: number;
  checksum: number;
  tick: number;
}

if (import.meta.main && process.argv.includes("--write")) {
  const game = homerunGameFor(1);
  const runs: LegacyRun[] = [];
  const play = (seed: number, label: string, events: ArcadeInputEvent[]) => {
    const at = new Map(events.map((e) => [e.t, e]));
    let s = game.init(seed);
    while (!game.isOver(s)) s = game.step(s, at.get(s.tick + 1) ?? null);
    runs.push({ seed, label, events, score: game.score(s), checksum: homerunCheckpoint(s).checksum, tick: s.tick });
  };
  for (let n = 0; n < 6; n++) {
    const seed = HOMERUN_DEAL[n * 37]!;
    for (const level of ALL_LEVELS) play(seed, level, bot({ game, seed, rev: 1, human: new Human("homerun", seed, level), fixes: true }).events ?? []);
    play(seed, "random", randomBot({ game, seed, rev: 1, human: new Human("homerun", seed, "weak"), fixes: true }).events ?? []);
  }
  // Edge swings: steep angles either side (fair and foul on rev 1), every height band, early and late.
  for (let n = 0; n < 6; n++) {
    const seed = HOMERUN_DEAL[200 + n]!;
    const events: ArcadeInputEvent[] = [];
    const plan = game.init(seed);
    void plan;
    for (let i = 0; i < 10; i++) {
      const t = 96 + i * 348 + 40 + ((n * 7 + i * 3) % 30);
      recordInput(events, { t, k: HOMERUN_INPUT_SWING, a: 440 + ((i * 53 + n * 17) % 140), b: -900 + ((i * 197 + n * 311) % 1800), c: 0, d: 0 }, HOMERUN_INPUT_RANGES);
    }
    play(seed, `edges ${n}`, events);
  }
  writeFileSync("scripts/fixtures/homerun-rev1-legacy.json", JSON.stringify({ recordedOn: "main b154694, homerunRev 1", runs }) + "\n");
  console.log(`wrote ${runs.length} runs; scores ${runs.map((r) => r.score).join(" ")}`);
}
