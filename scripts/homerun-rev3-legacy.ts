/**
 * Records scripts/fixtures/homerun-rev2-legacy.json: homerunRev 2 runs (the skill-band bots at every level and the
 * random swiper on rev 2's deal seeds, plus hand-made edge swings, some with kind-2 events that rev 2 must ignore) with
 * the score, final checksum and end tick the rev-2 code gave them. Recorded on main ae1efbe before homerunRev 3
 * (1 Nov 2026); homerun-check replays every run and fails on any difference. Never re-record over it.
 *
 *   bun scripts/homerun-rev3-legacy.ts --write
 */
import { writeFileSync } from "node:fs";
import { recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { homerunCheckpoint, homerunGameFor, HOMERUN_INPUT_RANGES, HOMERUN_INPUT_SWING } from "../src/lib/arcade/homerun";
import { HOMERUN_DEAL_V2 } from "../src/lib/duel/homerunDealV2.server";
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
  const game = homerunGameFor(2);
  const runs: LegacyRun[] = [];
  const play = (seed: number, label: string, events: ArcadeInputEvent[]) => {
    const at = new Map(events.map((e) => [e.t, e]));
    let s = game.init(seed);
    while (!game.isOver(s)) s = game.step(s, at.get(s.tick + 1) ?? null);
    runs.push({ seed, label, events, score: game.score(s), checksum: homerunCheckpoint(s).checksum, tick: s.tick });
  };
  for (let n = 0; n < 6; n++) {
    const seed = HOMERUN_DEAL_V2[n * 37]!;
    for (const level of ALL_LEVELS) play(seed, level, bot({ game, seed, rev: 2, human: new Human("homerun", seed, level), fixes: true }).events ?? []);
    play(seed, "random", randomBot({ game, seed, rev: 2, human: new Human("homerun", seed, "weak"), fixes: true }).events ?? []);
  }
  // Edge swings: steep angles either side (fair and foul), every height band, early and late; on three of the six,
  // kind-2 events (rev 3's swing choice) a second before each swing, which rev 2 ignores.
  for (let n = 0; n < 6; n++) {
    const seed = HOMERUN_DEAL_V2[200 + n]!;
    const events: ArcadeInputEvent[] = [];
    for (let i = 0; i < 10; i++) {
      const t = 96 + i * 348 + 40 + ((n * 7 + i * 3) % 30);
      if (n >= 3) events.push({ t: t - 60, k: 2, a: (i + n) % 2, b: 0, c: 0, d: 0 });
      recordInput(events, { t, k: HOMERUN_INPUT_SWING, a: 440 + ((i * 53 + n * 17) % 140), b: -900 + ((i * 197 + n * 311) % 1800), c: 0, d: 0 }, HOMERUN_INPUT_RANGES);
    }
    play(seed, `edges ${n}`, events);
  }
  writeFileSync("scripts/fixtures/homerun-rev2-legacy.json", JSON.stringify({ recordedOn: "main ae1efbe, homerunRev 2", runs }) + "\n");
  console.log(`wrote ${runs.length} runs; scores ${runs.map((r) => r.score).join(" ")}`);
}
