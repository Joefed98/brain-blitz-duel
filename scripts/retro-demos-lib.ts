/**
 * The Retro intro demos (the Retro overhaul, stage 3, 16 Nov 2026): what the fixture `scripts/retro-demos.json` holds and
 * how each entry is made. One run per Retro game, played by the game's skill-band bot at Near-perfect on the game's intro
 * example deal (the deal `practiceGenerateFn` returns with `example: true`: generatePuzzle under INTRO_EXAMPLE_SEED), on the
 * stamp rooms deal, at Normal. saveIntroDemoFn accepts only a run on a deal the server sealed, so the demos are recorded
 * on that deal; retro-demos-check proves the fixture's puzzle is it, that the stamp is the dealt one and that each run
 * scores exactly what the server's replay says. Nothing here writes to any database: scripts/retro-demos-save.ts does,
 * by hand (or the "Save intro demos" workflow), after the final merge.
 */
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { INTRO_EXAMPLE_SEED } from "../src/lib/duel/puzzleDemo";
import { withSeededRandom } from "../src/lib/duel/random";
import { splitPuzzle } from "../src/lib/duel/secrets";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human } from "./arcade-skill-bands/human";
import type { SkillBot } from "./arcade-skill-bands/bot";

/** The ten Retro games, in the Practice list's order. */
export const RETRO_DEMO_GAMES = ["hover", "breaker", "rally", "beat", "snake", "burst", "wavefront", "pinball", "cross", "blockfall"] as const;
export type RetroDemoGame = (typeof RETRO_DEMO_GAMES)[number];

export interface RetroDemo {
  type: RetroDemoGame;
  /** The stamp field and the stamp the run was recorded on (the one rooms deal). */
  field: string;
  rev: number;
  /** The example deal's public half, exactly as practiceGenerateFn returns it. */
  puzzle: PuzzleData;
  /** The encoded run, as the phone sends it. */
  run: string;
  /** The server replay's score for the run on the full example deal. */
  score: number;
}

export interface RetroDemoFixture {
  note: string;
  demos: RetroDemo[];
}

export const FIXTURE_PATH = "scripts/retro-demos.json";

/** The intro example deal, as the server makes it (practice.functions.ts practiceGenerateFn, `example: true`). */
export function exampleDeal(type: PuzzleType): { full: PuzzleData; pub: PuzzleData } {
  const full = withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(type, { unblockRow: null }));
  return { full, pub: splitPuzzle(full).pub as PuzzleData };
}

/** The stamp field a Retro game's deal carries (LIVE_BANDS). */
export function stampField(type: RetroDemoGame): string {
  return LIVE_BANDS[type as keyof typeof LIVE_BANDS]!.field;
}

/** The server's grade of a run on the full example deal. */
export function serverScore(full: PuzzleData, run: string): number {
  return gradeAnswer(full, run, 0).score;
}

async function loadBot(type: string): Promise<SkillBot> {
  return ((await import(new URL(`./arcade-skill-bands/bots/${type}.ts`, import.meta.url).href)) as { bot: SkillBot }).bot;
}

/** One demo: the Near-perfect bot's run on the example deal, encoded as the phone sends it, with the server's score. */
export async function recordDemo(type: RetroDemoGame): Promise<RetroDemo> {
  const spec = GAME_BY_TYPE.get(type);
  if (!spec) throw new Error(`${type}: no skill-band spec`);
  const { full, pub } = exampleDeal(type as PuzzleType);
  const loose = full as unknown as Record<string, unknown>;
  const field = stampField(type);
  const rev = Number(loose[field]);
  const seed = Number(loose["seed"] ?? 0);
  const game = spec.gameForPuzzle ? spec.gameForPuzzle(full) : spec.gameFor(rev, seed);
  const bot = await loadBot(type);
  const out = bot({ game, seed, rev, human: new Human(type, seed, "near"), fixes: true });
  const events = out.events ?? [];
  const taps = out.taps ?? [];
  const byTick = new Map(events.map((e) => [e.t, e]));
  const tapSet = new Set(taps);
  let state = game.init(seed);
  const checkpoints: unknown[] = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    state = game.step(state, spec.taps ? tapSet.has(t) : (byTick.get(t) ?? null));
    if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
  }
  const claimed = game.score(state);
  const body = { seed, claimedScore: claimed, events, inputs: taps, taps: [], endTick: state.tick, checkpoints };
  const run = appendClientCounters(spec.encode(body, rev, seed), arcadeCounters(type, state, claimed));
  return { type, field, rev, puzzle: pub, run, score: serverScore(full, run) };
}
