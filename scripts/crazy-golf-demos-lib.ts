/**
 * Crazy Golf's intro demo (the Crazy Golf overhaul, 15 Nov 2026; the merge captain's demo plan, Action #436's pattern as
 * #444 carries it): a bot run on the stamp rooms deal (golfRev 3), on Normal, on the game's intro example deal, kept in
 * scripts/fixtures/crazy-golf-demos.json as the row the manual "Save intro demos" workflow writes to `intro_demos` after
 * the final merge. Nothing here touches a database.
 */
import { minigolfCheckpoint, minigolfGameFor, MINIGOLF_REV_COURSE, type MinigolfState } from "../src/lib/arcade/minigolf";
import { encodeSportsRun, SPORTS_CHECKPOINT_INTERVAL } from "../src/lib/arcade/sportsKit";
import { replayMinigolfRun } from "../src/lib/duel/minigolf";
import { DEMO_LENGTH_TICKS, DEMO_START_TICK, runAtTick } from "../src/lib/arcade/introDemo";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";

export const DEMOS_FIXTURE = new URL("./fixtures/crazy-golf-demos.json", import.meta.url);
export const DEMO_GAMES = ["minigolf"] as const;
export type DemoGame = (typeof DEMO_GAMES)[number];

/** One saved demo, in `intro_demos`' columns, plus the score the server's replay stores for the whole run. */
export interface DemoRow {
  game_type: DemoGame;
  seed: number;
  /** The public half the server deals as the game's intro example (practiceGenerateFn with example: true). */
  puzzle: { type: DemoGame; seed: number; golfRev: number; holes: number[]; pars: number[]; [k: string]: unknown };
  input_log: { run: string };
  start_tick: number;
  length_ticks: number;
  /** The bot level the run was played at (skill-band levels). */
  skill: string;
  /** The server replay's stored score for the run. */
  score: number;
}

/**
 * The game's intro example as the server deals it (practiceGenerateFn's example path: the bank's example, else the live
 * deal under INTRO_EXAMPLE_SEED), public half only. The app's Save demo function accepts only a run on a deal the server
 * sealed, and the example is the one deal with a fixed seed, so the demo is recorded on it.
 */
export async function exampleDeal(game: DemoGame): Promise<DemoRow["puzzle"]> {
  const { withSeededRandom } = await import("../src/lib/duel/random");
  const { INTRO_EXAMPLE_SEED } = await import("../src/lib/duel/puzzleDemo");
  const { bankedIntroExample } = await import("../src/lib/duel/puzzleBank.server");
  const { generatePuzzle } = await import("../src/lib/duel/generate.server");
  const { splitPuzzle } = await import("../src/lib/duel/secrets");
  const made = bankedIntroExample(game) ?? withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(game, { unblockRow: null } as never));
  return splitPuzzle(made).pub as unknown as DemoRow["puzzle"];
}

/** The run string the phone sends for these inputs, on the example deal's holes (Normal). */
export function encodeDemoRun(puzzle: DemoRow["puzzle"], events: ArcadeInputEvent[]): string {
  const g = minigolfGameFor(puzzle.pars, MINIGOLF_REV_COURSE, { holes: puzzle.holes, level: "normal" });
  const at = new Map(events.map((e) => [e.t, e]));
  const checkpoints = [];
  let s = g.init(puzzle.seed);
  while (!g.isOver(s)) {
    s = g.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % SPORTS_CHECKPOINT_INTERVAL === 0) checkpoints.push(minigolfCheckpoint(s));
  }
  return encodeSportsRun({ seed: puzzle.seed, claimedScore: g.score(s), events, endTick: s.tick, checkpoints });
}

/** The server's replay of a stored run: its score and whether it was flagged. */
export function serverReplay(puzzle: DemoRow["puzzle"], run: string): { score: number; flagged: boolean; state: MinigolfState } {
  const r = replayMinigolfRun(puzzle.seed, run, puzzle.pars, puzzle.golfRev, { holes: puzzle.holes, level: null });
  return { score: r.score, flagged: Boolean(r.flagged), state: r.state };
}

/** What the demo's eight seconds show (the run stopped on the demo's last tick, replayed): strokes played and holes holed. */
export function demoMoments(puzzle: DemoRow["puzzle"], run: string): { strokes: number; holed: number } {
  const cut = runAtTick(run, DEMO_START_TICK + DEMO_LENGTH_TICKS);
  const s = serverReplay(puzzle, cut).state;
  const strokes = s.taken.reduce((a, v) => a + v, 0) + (s.holed[s.hole] ? 0 : s.strokes);
  return { strokes, holed: s.holed.filter((v) => v === 1).length };
}
