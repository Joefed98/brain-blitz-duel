/**
 * The Logic overhaul's intro demos (session 1, 15 Nov 2026; the merge captain's demo plan, Action #436's pattern, as
 * #444 built it): bot runs on the stamp rooms deal, on Normal, kept in scripts/fixtures/logic-demos.json as the rows the
 * manual "Save intro demos" workflow writes to `intro_demos` after the final merge. Nothing here touches a database.
 *
 * Only Minefield is an engine game (its demo is a run the server replays). The other six are coordinate demos Joe
 * records on a phone (savePuzzleDemoFn); their old ones are stopped by the new presentation (wordInput.ts).
 */
import { minesCheckpoint, minesweeperGameFor, MINES_CHECKPOINT_INTERVAL, MINES_REV_NORMAL } from "../src/lib/arcade/minesweeper";
import { encodeMinesweeperRun, replayMinesweeperRun } from "../src/lib/duel/minesweeper";
import { DEMO_LENGTH_TICKS, runAtTick } from "../src/lib/arcade/introDemo";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";

export const DEMOS_FIXTURE = new URL("./fixtures/logic-demos.json", import.meta.url);
export const DEMO_GAMES = ["minesweeper"] as const;
export type DemoGame = (typeof DEMO_GAMES)[number];

export interface DemoRow {
  game_type: DemoGame;
  seed: number;
  /** The public half the server deals as the game's intro example (practiceGenerateFn with example: true). */
  puzzle: { type: DemoGame; seed: number; minesRev?: number; [k: string]: unknown };
  input_log: { run: string };
  start_tick: number;
  length_ticks: number;
  skill: string;
  /** The server replay's stored score for the run. */
  score: number;
}

/** The game's intro example as the server deals it (practiceGenerateFn's example path), public half only. */
export async function exampleDeal(game: DemoGame): Promise<DemoRow["puzzle"]> {
  const { withSeededRandom } = await import("../src/lib/duel/random");
  const { INTRO_EXAMPLE_SEED } = await import("../src/lib/duel/puzzleDemo");
  const { bankedIntroExample } = await import("../src/lib/duel/puzzleBank.server");
  const { generatePuzzle } = await import("../src/lib/duel/generate.server");
  const { splitPuzzle } = await import("../src/lib/duel/secrets");
  const made = bankedIntroExample(game) ?? withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(game, { unblockRow: null } as never));
  return splitPuzzle(made).pub as unknown as DemoRow["puzzle"];
}

/** The run string the phone sends for these inputs, on Normal's minesRev 3. */
export function encodeDemoRun(seed: number, events: ArcadeInputEvent[]): string {
  const at = new Map(events.map((e) => [e.t, e]));
  const g = minesweeperGameFor(MINES_REV_NORMAL);
  const checkpoints = [];
  let s = g.init(seed);
  while (!g.isOver(s)) {
    s = g.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % MINES_CHECKPOINT_INTERVAL === 0) checkpoints.push(minesCheckpoint(s));
  }
  return encodeMinesweeperRun({ seed, claimedScore: g.score(s), events, endTick: s.tick, checkpoints });
}

export function serverReplay(seed: number, run: string): { score: number; flagged: boolean } {
  const r = replayMinesweeperRun(seed, run, MINES_REV_NORMAL);
  return { score: r.score, flagged: r.flagged };
}

/** What the demo's eight seconds show: squares opened beyond the opening, flags placed, mines hit. */
export function demoMoments(seed: number, run: string): { opened: number; flags: number; hits: number } {
  const r = replayMinesweeperRun(seed, runAtTick(run, DEMO_LENGTH_TICKS), MINES_REV_NORMAL);
  return { opened: r.revealed - r.opening, flags: r.flags, hits: r.hits };
}
