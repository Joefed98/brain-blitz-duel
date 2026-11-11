/**
 * Records real server-graded Practice runs for practice-challenges-check (wave 2 C1b): for every active game, a few runs
 * on today's live deal, played by the game's own kit (puzzles, scripts/puzzle-fairness) or skill-band bot (arcade,
 * scripts/arcade-skill-bands), graded through gradeAnswer exactly as practice grades them. Stored: score, isCorrect,
 * reactionAvgMs and the extra the server keeps. The check reads them to prove every challenge reads fields that real
 * graded runs carry. Re-record after a game's stored extra changes shape.
 *
 *   bun scripts/practice-challenges-record.ts [types…]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";

import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { makeBallTrackGame } from "../src/lib/arcade/ballTrack";
import { gradeAnswer, generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { puzzleTimeLimitMs, ACTIVE_PUZZLE_TYPES } from "../src/lib/duel/registry";
import type { PuzzleType } from "../src/lib/duel/types";
import { GAMES } from "./arcade-skill-bands/games";
import { Human } from "./arcade-skill-bands/human";
import { KITS } from "./puzzle-fairness/kits";
import { SKILLS, hashText, makeRng } from "./puzzle-fairness/kit";
import { asPhoneSends, gradeSteps } from "./standard-lib";
import { exampleFor } from "./shots/examples";

export const PRACTICE_CHALLENGE_RUNS = "scripts/fixtures/practice-challenges-runs.json.gz";

export interface RecordedRun {
  type: string;
  level: string;
  seed: number;
  score: number;
  isCorrect: boolean;
  reactionAvgMs: number | null;
  extra: Record<string, unknown> | null;
}

/** Drops what the checks never read and that is large (input lists, checkpoints, diagnostics). */
function slim(extra: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!extra) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(extra)) if (!["diag", "checkpoints", "inputDiag", "timeline", "placements"].includes(k) && !(k === "steps" && typeof v !== "number")) out[k] = v;
  return out;
}

const deal = (type: PuzzleType, seed: number) => withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed } as any));

async function arcadeRun(type: string, level: string, seed: number): Promise<RecordedRun | null> {
  const spec = GAMES.find((g) => g.type === type);
  const path = new URL(`./arcade-skill-bands/bots/${type}.ts`, import.meta.url);
  if (!spec || !existsSync(path)) return null;
  const bot = (await import(path.href)).bot;
  let puzzle: any;
  try {
    puzzle = deal(type as PuzzleType, seed);
  } catch {
    puzzle = exampleFor(type as PuzzleType);
  }
  const field = (LIVE_BANDS as any)[type]?.field;
  const rev = field && typeof puzzle[field] === "number" ? puzzle[field] : null;
  const s = Number(puzzle.seed);
  const game: any = type === "balltrack" && puzzle.course ? makeBallTrackGame(puzzle.course, rev) : spec.gameFor(rev, s);
  const out = bot({ game, seed: s, rev, human: new Human(type as any, s, level as any), fixes: true });
  let state = game.init(s);
  const checkpoints: unknown[] = [];
  const byTick = new Map((out.events ?? []).map((e: any) => [e.t, e]));
  const taps = new Set(out.taps ?? []);
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    state = game.step(state, spec.taps ? taps.has(t) : (byTick.get(t) ?? null));
    if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
  }
  const score = game.score(state);
  const body = { seed: s, claimedScore: score, events: out.events ?? [], inputs: out.taps ?? [], taps: [], endTick: state.tick, checkpoints };
  const raw = appendClientCounters(spec.encode(body, rev, s), arcadeCounters(type, state, score));
  const g = gradeAnswer(puzzle, raw, 0);
  return { type, level, seed, score: g.score, isCorrect: g.isCorrect, reactionAvgMs: g.reactionAvgMs, extra: slim(g.extra) };
}

function puzzleRun(type: PuzzleType, level: "great" | "near", seed: number): RecordedRun | null {
  const kit = (KITS as any)[type];
  if (!kit) return null;
  const puzzle = deal(type, seed);
  const play = kit.play(puzzle, makeRng(hashText(`challenges:${type}:${seed}:${level}`)), SKILLS[level], puzzleTimeLimitMs(puzzle));
  const r = gradeSteps(puzzle, asPhoneSends(puzzle, play.steps), play.timed);
  return { type, level, seed, score: r.score, isCorrect: r.isCorrect, reactionAvgMs: r.graded.reactionAvgMs, extra: slim(r.graded.extra) };
}

export function readRecordedRuns(): RecordedRun[] {
  return (JSON.parse(gunzipSync(readFileSync(PRACTICE_CHALLENGE_RUNS)).toString()) as { runs: RecordedRun[] }).runs;
}

if (import.meta.main) {
  const only = process.argv.slice(2);
  const keep = only.length && existsSync(PRACTICE_CHALLENGE_RUNS) ? readRecordedRuns().filter((r) => !only.includes(r.type)) : [];
  const runs: RecordedRun[] = [...keep];
  const arcade = new Set(GAMES.map((g) => g.type as string));
  const quiet = console.error;
  console.error = () => {};
  for (const type of ACTIVE_PUZZLE_TYPES) {
    if (only.length && !only.includes(type)) continue;
    try {
      if (arcade.has(type)) {
        for (const [level, seed] of [["near", 6100], ["elite", 6107], ["good", 6114]] as const) {
          const r = await arcadeRun(type, level, seed);
          if (r) runs.push(r);
        }
      } else {
        for (const [level, seed] of [["near", 6100], ["great", 6107], ["near", 6114]] as const) {
          const r = puzzleRun(type, level, seed);
          if (r) runs.push(r);
        }
      }
      console.log(`${type}: ${runs.filter((r) => r.type === type).map((r) => r.score).join(", ") || "no runs"}`);
    } catch (err) {
      console.log(`${type}: failed ${(err as Error).message}`);
    }
  }
  console.error = quiet;
  writeFileSync(PRACTICE_CHALLENGE_RUNS, gzipSync(JSON.stringify({ recordedOn: "wave 2 C1b (11 Nov 2026)", runs })));
  console.log(`wrote ${PRACTICE_CHALLENGE_RUNS}: ${runs.length} runs over ${new Set(runs.map((r) => r.type)).size} games`);
}
