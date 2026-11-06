/**
 * The audit's arcade input (text pass, 4 Nov 2026): a skill-band bot's input log for the round the audit plays, built
 * in Node from the intro example (the puzzle practice deals the audit), so the page plays it tick by tick through the
 * dev-only hook in src/lib/arcade/auditInput.ts. The mid-round frame then shows strong play in progress instead of
 * random input. Returns null for a game with no bot or spec (it falls back to scripted input).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync } from "node:fs";

import { makeBallTrackGame, type BtCourse } from "../../src/lib/arcade/ballTrack";
import { LIVE_BANDS } from "../../src/lib/arcade/liveBands";
import type { ArcadeInputEvent } from "../../src/lib/arcade/engine";
import { GAMES } from "../arcade-skill-bands/games";
import { Human, type SkillLevel } from "../arcade-skill-bands/human";
import type { SkillBot } from "../arcade-skill-bands/bot";
import { exampleFor } from "../shots/examples";

export interface AuditLog {
  events?: ArcadeInputEvent[];
  taps?: number[];
  /** The bot's own sim score for the log (the audit report compares it with the reveal's). */
  simScore: number;
  level: SkillLevel;
}

export async function auditBotLog(type: string, level: SkillLevel = "near"): Promise<AuditLog | null> {
  const spec = GAMES.find((g) => g.type === type);
  const path = new URL(`../arcade-skill-bands/bots/${type}.ts`, import.meta.url);
  if (!spec || !existsSync(path)) return null;
  const bot = ((await import(path.href)) as { bot: SkillBot }).bot;
  const puzzle = exampleFor(type as any) as Record<string, unknown>;
  const seed = Number(puzzle.seed);
  const field = (LIVE_BANDS as Record<string, { field: string } | undefined>)[type]?.field;
  const rev = field && typeof puzzle[field] === "number" ? (puzzle[field] as number) : null;
  // Ball Tracker's dealt puzzle carries its course (seed = bank index + 1); the bands tool's seed → course map would pick the
  // next course, so the audit plays the course the stage deals (5 Nov 2026).
  const game: ReturnType<typeof spec.gameFor> =
    type === "balltrack" && puzzle.course ? (makeBallTrackGame(puzzle.course as BtCourse, rev) as unknown as ReturnType<typeof spec.gameFor>) : spec.gameFor(rev, seed);
  const out = bot({ game, seed, rev, human: new Human(type, seed, level), fixes: true });
  let state = game.init(seed);
  const byTick = new Map((out.events ?? []).map((e) => [e.t, e]));
  const taps = new Set(out.taps ?? []);
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    state = game.step(state, spec.taps ? taps.has(t) : (byTick.get(t) ?? null));
  }
  return { events: out.events, taps: out.taps, simScore: game.score(state), level };
}
