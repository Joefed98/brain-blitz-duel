/**
 * Records the Home Run and Top Bins intro demos (scripts/fixtures/home-run-top-bins-demos.json): for each game the
 * skill-band bot plays the game's intro example deal (the one deal with a fixed seed, which the Save demo function can
 * take) at the great, near and good levels, and the run whose first eight seconds show the most (a hit or goal first,
 * then the higher score) is kept. Re-run after a stamp change; home-run-top-bins-demos-check proves the file.
 *
 *   bun scripts/home-run-top-bins-demos-record.ts
 */
import { writeFileSync } from "node:fs";
import { homerunGameFor, HOMERUN_REV_DEALT } from "../src/lib/arcade/homerun";
import { freekickGameFor, FREEKICK_REV_DEALT } from "../src/lib/arcade/freekick";
import { DEMO_LENGTH_TICKS, DEMO_START_TICK } from "../src/lib/arcade/introDemo";
import { Human } from "./arcade-skill-bands/human";
import { botV5 as hrBot } from "./arcade-skill-bands/bots/homerun";
import { botV5 as fkBot } from "./arcade-skill-bands/bots/freekick";
import { DEMOS_FIXTURE, demoMoments, exampleDeal, encodeDemoRun, serverReplay, type DemoGame, type DemoRow } from "./home-run-top-bins-demos-lib";

const SKILLS = ["great", "near", "good"] as const;

async function record(game: DemoGame): Promise<DemoRow> {
  let best: { row: DemoRow; worth: number } | null = null;
  const puzzle = await exampleDeal(game);
  const seed = puzzle.seed;
  for (const SKILL of SKILLS) {
    const events =
      game === "homerun"
        ? hrBot({ game: homerunGameFor(HOMERUN_REV_DEALT, "normal"), seed, rev: HOMERUN_REV_DEALT, human: new Human("homerun", seed, SKILL) }).events
        : fkBot({ game: freekickGameFor(FREEKICK_REV_DEALT, "normal"), seed, rev: FREEKICK_REV_DEALT, human: new Human("freekick", seed, SKILL) }).events;
    const run = encodeDemoRun(game, seed, events);
    const { score, flagged } = serverReplay(game, seed, run);
    if (flagged) continue;
    const m = demoMoments(game, seed, run);
    // A hit or a goal in the first eight seconds first, then the higher stored score.
    const worth = (game === "homerun" ? m.hits * 100 + m.swings * 10 : Math.min(m.goals, 1) * 100 + m.kicks * 10) + score / 1000;
    const row: DemoRow = { game_type: game, seed, puzzle, input_log: { run }, start_tick: DEMO_START_TICK, length_ticks: DEMO_LENGTH_TICKS, skill: SKILL, score };
    console.log(`${game} seed ${seed} ${SKILL}: ${score} points, first ${DEMO_LENGTH_TICKS / 60} s ${JSON.stringify(m)}`);
    if (!best || worth > best.worth) best = { row, worth };
  }
  if (!best) throw new Error(`${game}: no unflagged run`);
  return best.row;
}

const rows = [await record("homerun"), await record("freekick")];
writeFileSync(DEMOS_FIXTURE, JSON.stringify({ recordedOn: "homerunRev 5 / freekickRev 5, Normal, the intro example deal", rows }, null, 1) + "\n");
console.log(`wrote ${rows.length} demos`);
