/**
 * Records the Strategy games' intro demos (the Strategy overhaul, stage 3, 16 Nov 2026; the merge captain's demos plan,
 * as Action's #436): for Tilt, Gemstone, Coral Pop, Rainbow Bridge and Ball Tracker, a run by the game's skill-band bot
 * at the Elite level on the game's **intro example deal** (the fixed-seed Normal deal `practiceGenerateFn` gives with
 * `example: true`, the only deal `saveIntroDemoFn` accepts a run on), encoded as the phone sends it and graded by the
 * server's own `gradeAnswer`. Writes scripts/fixtures/strategy-demos.json: per game the public half of the example deal,
 * the run and the score the server's replay gives it. strategy-demos-check proves every entry; strategy-demos-save.ts
 * saves them through the app's Save demo server function (never to the live database from here).
 *
 *   bun scripts/strategy-demos-record.ts [games…]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

import { gradeAnswer } from "../src/lib/duel/generate.server";
import { splitPuzzle } from "../src/lib/duel/secrets";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human } from "./arcade-skill-bands/human";
import type { SkillBot } from "./arcade-skill-bands/bot";
import { exampleFor } from "./shots/examples";

export const STRATEGY_DEMO_TYPES = ["tilt", "matchup", "bubble", "inkbridge", "balltrack"] as const;
export const DEMOS_FIXTURE = "scripts/fixtures/strategy-demos.json";

export interface DemoEntry {
  type: string;
  /** The public half of the intro example deal, exactly as the server sends it. */
  puzzle: Record<string, unknown>;
  /** The encoded run, as the phone sends it. */
  run: string;
  /** The server's grade of the run on the example deal. */
  score: number;
}

/** The intro example deal (full) and its public half. */
export function exampleDeal(type: string): { full: PuzzleData; pub: Record<string, unknown> } {
  const full = exampleFor(type as PuzzleType);
  return { full, pub: splitPuzzle(full).pub as unknown as Record<string, unknown> };
}

/** The Elite bot's run on the example deal, encoded as the phone sends it. */
export async function eliteRun(type: string): Promise<string> {
  const spec = GAME_BY_TYPE.get(type as PuzzleType);
  if (!spec) throw new Error(`${type}: no skill-band spec`);
  const bot = ((await import(`./arcade-skill-bands/bots/${type}.ts`)) as { bot: SkillBot }).bot;
  const { full: puzzle } = exampleDeal(type);
  const loose = puzzle as unknown as Record<string, unknown>;
  const seed = Number(loose["seed"] ?? 0);
  const field = LIVE_BANDS[type as keyof typeof LIVE_BANDS]?.field;
  const rev = field && typeof loose[field] === "number" ? (loose[field] as number) : null;
  const game: any = spec.gameForPuzzle ? spec.gameForPuzzle(puzzle) : spec.gameFor(rev, seed);
  const out = bot({ game, seed, rev, human: new Human(type, seed, "elite"), fixes: true });
  const events = out.events ?? [];
  const taps = out.taps ?? [];
  const byTick = new Map(events.map((e: { t: number }) => [e.t, e]));
  const tapSet = new Set(taps);
  const checkpoints: unknown[] = [];
  let state = game.init(seed);
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    state = game.step(state, spec.taps ? tapSet.has(t) : (byTick.get(t) ?? null));
    if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
  }
  const claimed = game.score(state);
  const body = { seed, claimedScore: claimed, events, inputs: taps, taps: [], endTick: state.tick, checkpoints };
  return appendClientCounters(spec.encode(body as any, rev, seed), arcadeCounters(type as PuzzleType, state, claimed));
}

if (import.meta.main) {
  const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const prior: DemoEntry[] = existsSync(DEMOS_FIXTURE) ? JSON.parse(readFileSync(DEMOS_FIXTURE, "utf8")) : [];
  const out: DemoEntry[] = [];
  for (const type of STRATEGY_DEMO_TYPES) {
    if (only.length && !only.includes(type)) {
      const kept = prior.find((d) => d.type === type);
      if (kept) out.push(kept);
      continue;
    }
    const { full, pub } = exampleDeal(type);
    const run = await eliteRun(type);
    const graded = gradeAnswer(full, run, 0);
    out.push({ type, puzzle: pub, run, score: graded.score });
    console.log(`${type}: ${graded.score} (${run.length} chars)`);
  }
  writeFileSync(DEMOS_FIXTURE, JSON.stringify(out) + "\n");
  console.log(`wrote ${DEMOS_FIXTURE} (${out.length} demos)`);
}
