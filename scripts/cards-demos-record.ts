/**
 * Records the Cards & Board intro demos (the overhaul's stage 3, 15 Nov 2026) into scripts/fixtures/cards-demos.json:
 * for Free Cell, Mahjong Solitaire, Summit, Five Hands and Thirteen, the elite skill-band bot's run on the game's intro
 * example deal (the fixed-seed deal practiceGenerateFn gives with `example: true`, the only deal saveIntroDemoFn takes),
 * on the stamps rooms deal today, encoded as the phone sends it, with the score the server's grade gives it.
 * cards-demos-check proves the fixture; scripts/cards-demos-save.ts saves it through the app.
 *
 *   bun scripts/cards-demos-record.ts
 */
import { writeFileSync } from "node:fs";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { INTRO_EXAMPLE_SEED } from "../src/lib/duel/puzzleDemo";
import { splitPuzzle } from "../src/lib/duel/secrets";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human } from "./arcade-skill-bands/human";
import type { SkillBot } from "./arcade-skill-bands/bot";

export const CARDS_DEMO_GAMES: PuzzleType[] = ["freecell", "mahjong", "tripeaks", "fivehands", "pyramid"];
export const CARDS_DEMOS_FILE = "scripts/fixtures/cards-demos.json";

export interface CardsDemo {
  type: PuzzleType;
  /** The example deal's public half (what saveIntroDemoFn stores). */
  puzzle: PuzzleData;
  /** The run as the phone sends it. */
  run: string;
  /** The server grade's score for it. */
  score: number;
}

/** The intro example deal, exactly as practiceGenerateFn makes it (example: true). */
export function exampleDeal(type: PuzzleType): PuzzleData {
  return withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(type, { unblockRow: null }));
}

async function record(type: PuzzleType): Promise<CardsDemo> {
  const made = exampleDeal(type);
  const pub = splitPuzzle(made).pub as PuzzleData;
  const spec = GAME_BY_TYPE.get(type)!;
  const bot = ((await import(new URL(`./arcade-skill-bands/bots/${type}.ts`, import.meta.url).href)) as { bot: SkillBot }).bot;
  const p = made as unknown as Record<string, unknown>;
  const field = Object.keys(p).find((k) => /Rev$/.test(k) && k !== "puzzleScoreRev");
  const rev = field ? (p[field] as number) : null;
  const seed = Number(p["seed"]);
  const game = spec.gameForPuzzle ? spec.gameForPuzzle(made) : spec.gameFor(rev, seed);
  const out = bot({ game, seed, rev, human: new Human(type, seed, "elite"), fixes: true });
  const events = out.events ?? [];
  const byTick = new Map(events.map((e) => [e.t, e]));
  let state = game.init(seed);
  const checkpoints: unknown[] = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    state = game.step(state, byTick.get(state.tick + 1) ?? null);
    if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
  }
  const claimed = game.score(state);
  const run = appendClientCounters(spec.encode({ seed, claimedScore: claimed, events, inputs: [], taps: [], endTick: state.tick, checkpoints }, rev, seed), arcadeCounters(type, state, claimed));
  const graded = gradeAnswer(made, run, 0);
  return { type, puzzle: pub, run, score: graded.score };
}

if (import.meta.main) {
  const demos: CardsDemo[] = [];
  for (const t of CARDS_DEMO_GAMES) {
    const d = await record(t);
    demos.push(d);
    console.log(`${t}: ${d.run.length} characters, scores ${d.score}`);
  }
  writeFileSync(CARDS_DEMOS_FILE, `${JSON.stringify(demos, null, 1)}\n`);
  console.log(`wrote ${CARDS_DEMOS_FILE}`);
}
