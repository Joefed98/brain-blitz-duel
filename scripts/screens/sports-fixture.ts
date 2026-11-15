/**
 * The Sports overhaul's screen fixture (phase 2 step 4): a real stored run for the puzzle a theme screen's room deals, so
 * the answer reveal draws the game's run summary (src/components/duel/runSummary.tsx) on genuine play. The run is the
 * game's own skill-band bot at the given level, played through the sim and encoded exactly as the phone sends it
 * (events, the end tick and the 5 s checkpoints), so the phone's replay of it is the server's.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { LIVE_BANDS } from "../../src/lib/arcade/liveBands";
import { encodeSportsRun, SPORTS_CHECKPOINT_INTERVAL, type SportsCheckpoint } from "../../src/lib/arcade/sportsKit";
import { poolCheckpoint } from "../../src/lib/arcade/pool";
import { curlingCheckpoint } from "../../src/lib/arcade/curling";
import { racingCheckpoint } from "../../src/lib/arcade/racing";
import { GAMES } from "../arcade-skill-bands/games";
import { Human, type SkillLevel } from "../arcade-skill-bands/human";
import type { SkillBot } from "../arcade-skill-bands/bot";
import { bot as poolBot } from "../arcade-skill-bands/bots/pool";
import { bot as curlingBot } from "../arcade-skill-bands/bots/curling";
import { bot as racingBot } from "../arcade-skill-bands/bots/racing";

export const SPORTS_OVERHAUL_GAMES = ["pool", "curling", "racing"] as const;
export type SportsOverhaulGame = (typeof SPORTS_OVERHAUL_GAMES)[number];

const BOTS: Record<SportsOverhaulGame, SkillBot> = { pool: poolBot, curling: curlingBot, racing: racingBot };
const CHECKPOINT: Record<SportsOverhaulGame, (s: any) => SportsCheckpoint> = { pool: poolCheckpoint, curling: curlingCheckpoint, racing: racingCheckpoint };

/** The stored answer a player of `level` would send for this dealt puzzle, and the sim's score for it. */
export function sportsRunFor(type: SportsOverhaulGame, puzzle: Record<string, unknown>, level: SkillLevel): { answer: string; score: number } {
  const spec = GAMES.find((g) => g.type === type);
  if (!spec) throw new Error(`no skill-band spec for ${type}`);
  const seed = Number(puzzle["seed"]);
  const field = (LIVE_BANDS as Record<string, { field: string } | undefined>)[type]?.field;
  const rev = field && typeof puzzle[field] === "number" ? (puzzle[field] as number) : null;
  const game = spec.gameFor(rev, seed) as any;
  const out = BOTS[type]({ game, seed, rev, human: new Human(type, seed, level), fixes: true });
  const byTick = new Map((out.events ?? []).map((e) => [e.t, e]));
  let state = game.init(seed);
  const checkpoints: SportsCheckpoint[] = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    state = game.step(state, byTick.get(state.tick + 1) ?? null);
    if (state.tick % SPORTS_CHECKPOINT_INTERVAL === 0) checkpoints.push(CHECKPOINT[type](state));
  }
  const score = game.score(state) as number;
  const endTick = state.tick >= game.runTicks ? 0 : state.tick;
  return { answer: encodeSportsRun({ seed, claimedScore: score, events: out.events ?? [], endTick, checkpoints }), score };
}
