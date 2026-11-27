/**
 * Records D6's legacy fixture (scripts/fixtures/d6-levels-legacy.json.gz) on the tree before any D6 change (main
 * 7e25a4d0 with nothing of D6's but this script and the ladder library): for each of D6's sixteen games, real deals at
 * Easy, Normal, Hard and Expert (`dealAt`, the room path), each played by the skill-band bots (weak, average and elite
 * under HUMAN_LIMITS), with the stored puzzle, the encoded run as the phone sends it and the server's grade (score,
 * isCorrect, a digest of the stored extra). d6-legacy-check regrades every case on today's tree and fails on any
 * difference, so every round dealt before D6's stamps (Five Hands' fiveHandsRev 4, Cue Ball's poolRev 5, Tilt's
 * tiltRev 13 and the new level deals) keeps its world, its score and its breakdown.
 *
 *   bun scripts/d6-legacy-record.ts [games…]   (writes the fixture; games already in it are kept unless named)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

import { gradeAnswer } from "../src/lib/duel/generate.server";
import type { PuzzleType } from "../src/lib/duel/types";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, HUMAN_LIMITS, type SkillLevel } from "./arcade-skill-bands/human";
import type { SkillBot } from "./arcade-skill-bands/bot";
import { dealAt } from "./level-tune";
import { D6_GAMES, LADDER_LEVELS } from "./d6-ladder-lib";

export interface LegacyCase {
  type: string;
  level: string;
  n: number;
  bot: string;
  puzzle: unknown;
  raw: string;
  score: number;
  isCorrect: boolean;
  extra: string;
}

export const LEGACY_PATH = new URL("./fixtures/d6-levels-legacy.json.gz", import.meta.url);

/** Keys whose values are wall-clock timings (how long the replay or a build took), never part of a round's result. */
const TIMING_KEYS = new Set(["replayMs", "generationMs"]);

/** A stable digest of a grade's stored extra (key order as the grader writes it; timing keys left out). */
export function extraDigest(extra: unknown): string {
  const text = JSON.stringify(extra ?? null, (key, value) => (TIMING_KEYS.has(key) ? undefined : value));
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

export function readLegacy(): { recorded: string; cases: LegacyCase[] } {
  return JSON.parse(gunzipSync(readFileSync(LEGACY_PATH)).toString("utf8"));
}

/** Samples a game is recorded on (the slow sims fewer). */
const SAMPLES: Record<string, number[]> = { minigolf: [0, 7], curling: [0, 5, 11] };
const DEFAULT_SAMPLES = [0, 3, 8, 13, 21];
const BOTS: SkillLevel[] = ["weak", "average", "elite"];

async function record(type: string): Promise<LegacyCase[]> {
  const spec = GAME_BY_TYPE.get(type)!;
  const play = ((await import(new URL(`./arcade-skill-bands/bots/${type}.ts`, import.meta.url).href)) as { bot: SkillBot }).bot;
  const field = LIVE_BANDS[type as keyof typeof LIVE_BANDS]?.field;
  const out: LegacyCase[] = [];
  for (const level of LADDER_LEVELS) {
    for (const n of SAMPLES[type] ?? DEFAULT_SAMPLES) {
      const puzzle = dealAt(type as PuzzleType, level, n) as any;
      const seed = Number(puzzle.seed ?? 0);
      const rev = field && typeof puzzle[field] === "number" ? puzzle[field] : null;
      for (const bot of BOTS) {
        const game = spec.gameForPuzzle ? spec.gameForPuzzle(puzzle) : spec.gameFor(rev, seed);
        const res = play({ game, seed, rev, human: new Human(type, seed, bot, HUMAN_LIMITS), fixes: true });
        const events = res.events ?? [];
        const taps = res.taps ?? [];
        const byTick = new Map(events.map((e) => [e.t, e]));
        const tapSet = new Set(taps);
        let state = game.init(seed);
        const checkpoints: unknown[] = [];
        while (!game.isOver(state) && state.tick < game.runTicks) {
          const t = state.tick + 1;
          state = game.step(state, spec.taps ? tapSet.has(t) : (byTick.get(t) ?? null));
          if (state.tick % (spec.checkpointEvery ?? 300) === 0) checkpoints.push(spec.checkpoint(state));
        }
        const claimed = game.score(state);
        const body = { seed, claimedScore: claimed, events, inputs: taps, taps: [], endTick: state.tick, checkpoints };
        const raw = appendClientCounters(spec.encode(body, rev, seed), arcadeCounters(type, state, claimed));
        const graded = gradeAnswer(puzzle, raw, 0);
        out.push({ type, level, n, bot, puzzle, raw, score: graded.score, isCorrect: graded.isCorrect, extra: extraDigest(graded.extra) });
      }
    }
  }
  return out;
}

if (import.meta.main && process.argv.includes("--redigest")) {
  // Recomputes each stored case's grade digest from its stored puzzle and run (run on the tree the fixture was
  // recorded on, so the digests are that tree's), keeping the puzzles, runs, scores and verdicts as recorded.
  console.error = () => {};
  const { recorded, cases } = readLegacy();
  for (const c of cases) {
    const g = gradeAnswer(c.puzzle as never, c.raw, 0);
    if (g.score !== c.score || g.isCorrect !== c.isCorrect) throw new Error(`${c.type} ${c.level} ${c.n} ${c.bot}: the grade moved (${g.score} vs ${c.score})`);
    c.extra = extraDigest(g.extra);
  }
  writeFileSync(LEGACY_PATH, gzipSync(JSON.stringify({ recorded, cases })));
  console.log(`redigested ${cases.length} cases`);
} else if (import.meta.main) {
  console.error = () => {};
  const named = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const games = named.length ? named : [...D6_GAMES];
  const kept = existsSync(LEGACY_PATH) ? readLegacy().cases.filter((c) => !games.includes(c.type)) : [];
  const cases = [...kept];
  for (const g of games) {
    const t0 = Date.now();
    const got = await record(g);
    cases.push(...got);
    process.stdout.write(`${g}: ${got.length} cases (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`);
  }
  cases.sort((a, b) => D6_GAMES.indexOf(a.type as any) - D6_GAMES.indexOf(b.type as any));
  const head = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  writeFileSync(LEGACY_PATH, gzipSync(JSON.stringify({ recorded: `main ${head}, before D6's stamps and level deals`, cases })));
  console.log(`recorded ${cases.length} cases`);
}
