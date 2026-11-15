/**
 * The Home Run and Top Bins intro demos (15 Nov 2026, the merge captain's demo plan; Action #436's pattern): bot runs on
 * the stamps rooms deal, on Normal, kept in scripts/fixtures/home-run-top-bins-demos.json as the rows the manual "Save
 * intro demos" workflow writes to `intro_demos` after the final merge. Nothing here touches a database.
 */
import { homerunCheckpoint, homerunGameFor, HOMERUN_REV_DEALT } from "../src/lib/arcade/homerun";
import { freekickCheckpoint, freekickGameFor, FREEKICK_REV_DEALT } from "../src/lib/arcade/freekick";
import { encodeHomerunRun, replayHomerunRun } from "../src/lib/duel/homerun";
import { encodeFreekickRun, replayFreekickRun } from "../src/lib/duel/freekick";
import { DEMO_LENGTH_TICKS, DEMO_START_TICK, runAtTick } from "../src/lib/arcade/introDemo";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";

export const DEMOS_FIXTURE = new URL("./fixtures/home-run-top-bins-demos.json", import.meta.url);
export const DEMO_GAMES = ["homerun", "freekick"] as const;
export type DemoGame = (typeof DEMO_GAMES)[number];

/** One saved demo, in `intro_demos`' columns, plus the score the server's replay stores for the whole run. */
export interface DemoRow {
  game_type: DemoGame;
  seed: number;
  puzzle: { type: DemoGame; seed: number; homerunRev?: number; freekickRev?: number };
  input_log: { run: string };
  start_tick: number;
  length_ticks: number;
  /** The bot level the run was played at (skill-band levels). */
  skill: string;
  /** The server replay's stored score for the run. */
  score: number;
}

export function demoPuzzle(game: DemoGame, seed: number): DemoRow["puzzle"] {
  return game === "homerun" ? { type: "homerun", seed, homerunRev: HOMERUN_REV_DEALT } : { type: "freekick", seed, freekickRev: FREEKICK_REV_DEALT };
}

/** The run string the phone sends for these inputs (the same path the deal scripts prove), on Normal. */
export function encodeDemoRun(game: DemoGame, seed: number, events: ArcadeInputEvent[]): string {
  const at = new Map(events.map((e) => [e.t, e]));
  if (game === "homerun") {
    const g = homerunGameFor(HOMERUN_REV_DEALT, "normal");
    const checkpoints = [];
    let s = g.init(seed);
    while (!g.isOver(s)) {
      s = g.step(s, at.get(s.tick + 1) ?? null);
      if (s.tick % 60 === 0) checkpoints.push(homerunCheckpoint(s));
    }
    return encodeHomerunRun({ seed, claimedScore: g.score(s), events, endTick: s.tick, checkpoints });
  }
  const g = freekickGameFor(FREEKICK_REV_DEALT, "normal");
  const checkpoints = [];
  let s = g.init(seed);
  while (!g.isOver(s)) {
    s = g.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % 60 === 0) checkpoints.push(freekickCheckpoint(s));
  }
  return encodeFreekickRun({ seed, claimedScore: g.score(s), events, endTick: s.tick, checkpoints });
}

/** The server's replay of a stored run: its score and whether it was flagged. */
export function serverReplay(game: DemoGame, seed: number, run: string): { score: number; flagged: boolean } {
  const r = game === "homerun" ? replayHomerunRun(seed, run, HOMERUN_REV_DEALT) : replayFreekickRun(seed, run, FREEKICK_REV_DEALT);
  return { score: r.score, flagged: Boolean(r.flagged) };
}

/**
 * What the demo's eight seconds show, worked out as the intro draws them: the stored run stopped on the demo's last
 * tick (runAtTick) and replayed: Home Run's swings and hits, Top Bins' kicks taken and goals.
 */
export function demoMoments(game: DemoGame, seed: number, run: string): { swings: number; hits: number; kicks: number; goals: number } {
  const cut = runAtTick(run, DEMO_START_TICK + DEMO_LENGTH_TICKS);
  if (game === "homerun") {
    const hits = replayHomerunRun(seed, cut, HOMERUN_REV_DEALT).state.inn?.hits ?? [];
    return { swings: hits.filter((h) => h.st >= 0).length, hits: hits.filter((h) => h.out >= 6 && h.out <= 9).length, kicks: 0, goals: 0 };
  }
  const s = replayFreekickRun(seed, cut, FREEKICK_REV_DEALT).state;
  return { swings: 0, hits: 0, kicks: s.k, goals: s.goals };
}
