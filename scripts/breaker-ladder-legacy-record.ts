/**
 * Records Breaker's brkRev 12 (every level) and brkRev 11 runs before brkRev 13 (D5's ladder, 23 Nov 2026;
 * docs/arcade-standard/breaker.md "brkRev 13"), for scripts/breaker-ladder-check.ts: each stamp's start at every level
 * (a digest per seed) and runs by several players (the skill-band bot at average, elite and flawless, held to the human
 * limits and not, plus a seeded random-input run), each with its server grade (gradeAnswer on the stored puzzle: score,
 * verdict and a digest of the stored extra, the replay's wall-clock fields left out), its replayed score and a digest of
 * the final state and checkpoints. Recorded on the source tree before any brkRev 13 code; never re-record over it.
 *
 *   bun scripts/breaker-ladder-legacy-record.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { ARCADE_INPUT_BUTTON, ARCADE_INPUT_DRAG, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { brkCheckpoint, breakerGameFor, BRK_CHECKPOINT_INTERVAL, BRK_REV_CLEAR, BRK_REV_STD, type BrkState } from "../src/lib/arcade/breaker";
import { encodeBreakerRun, replayBreakerRun } from "../src/lib/duel/breaker";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import type { PuzzleData } from "../src/lib/duel/types";
import type { Level } from "../src/lib/levels/levels";
import { Human, HUMAN_LIMITS, type SkillLevel } from "./arcade-skill-bands/human";
import { bot as breakerBot } from "./arcade-skill-bands/bots/breaker";

export const BREAKER_LADDER_LEGACY = "scripts/fixtures/breaker-ladder-legacy.json.gz";
export const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);
/** The stored extra without the fields that measure the machine (the replay's wall-clock time and lag). */
export const stableExtra = (v: unknown): unknown => (v == null ? null : JSON.parse(JSON.stringify(v, (k, x) => (k === "replayMs" || k === "clientLag" ? undefined : x))));

/** The stamps and levels recorded: brkRev 12 at every level (Normal and the three level deals), brkRev 11 (Normal). */
export const BREAKER_LEGACY_PLANS: { rev: number; levels: Level[] }[] = [
  { rev: BRK_REV_CLEAR, levels: ["normal", "easy", "hard", "expert"] },
  { rev: BRK_REV_STD, levels: ["normal"] },
];
const RUN_SEEDS = [7, 4242, 301794028];
/** A player: a skill-band level, held to the human limits ("…@limits") or not, or a seeded random input. */
const PLAYERS = ["random", "average@limits", "elite@limits", "perfect@limits", "elite"] as const;
export const BREAKER_INIT_SEEDS = [...Array.from({ length: 16 }, (_, i) => i * 7919 + 3), 489736026, 1453580015];

/** A seeded random input stream: drags across the court and taps. */
export function breakerRandomEvents(seed: number, runTicks: number): ArcadeInputEvent[] {
  const ev: ArcadeInputEvent[] = [];
  let x = seed | 1;
  for (let t = 3; t <= runTicks; ) {
    x = Math.imul(x ^ (x >>> 13), 0x5bd1e995) >>> 0;
    if (x % 5 === 0) ev.push({ t, k: ARCADE_INPUT_BUTTON, a: 0, b: 0, c: 0, d: 0 });
    else ev.push({ t, k: ARCADE_INPUT_DRAG, a: 20 + (x % 380), b: 0, c: 0, d: 0 });
    t += 2 + (x % 23);
  }
  return ev;
}

/** The phone's encoding of a log played on a stamp's game at a level. */
export function encodeBreaker(rev: number, level: Level, seed: number, events: ArcadeInputEvent[]): { raw: string; claimed: number; endTick: number } {
  const game = breakerGameFor(rev, level);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed) as BrkState;
  const checkpoints: ReturnType<typeof brkCheckpoint>[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, at.get(s.tick + 1) ?? null) as BrkState;
    if (s.tick % BRK_CHECKPOINT_INTERVAL === 0) checkpoints.push(brkCheckpoint(s));
  }
  const claimed = game.score(s);
  return { raw: encodeBreakerRun({ seed, claimedScore: claimed, events, endTick: s.tick, checkpoints }), claimed, endTick: s.tick };
}

export interface BreakerLegacyRun {
  rev: number;
  level: Level;
  seed: number;
  player: string;
  raw: string;
  claimed: number;
  score: number;
  flagged: boolean;
  state: string;
  checkpoints: string;
  grade: { score: number; isCorrect: boolean; extra: string };
}

if (import.meta.main) {
  const inits: { rev: number; level: Level; seed: number; digest: string }[] = [];
  const runs: BreakerLegacyRun[] = [];
  for (const plan of BREAKER_LEGACY_PLANS) {
    for (const level of plan.levels) {
      const game = breakerGameFor(plan.rev, level);
      for (const seed of BREAKER_INIT_SEEDS) inits.push({ rev: plan.rev, level, seed, digest: digest(game.init(seed)) });
      for (const seed of RUN_SEEDS) {
        for (const player of PLAYERS) {
          const [skill, lim] = player.split("@") as [SkillLevel | "random", string | undefined];
          const events =
            skill === "random"
              ? breakerRandomEvents(seed, game.runTicks)
              : (breakerBot({ game: game as any, seed, rev: plan.rev, human: new Human("breaker", seed, skill, lim ? HUMAN_LIMITS : null), fixes: true }).events ?? []);
          const { raw, claimed } = encodeBreaker(plan.rev, level, seed, events);
          const replay = replayBreakerRun(seed, raw, plan.rev, level);
          const puzzle = { type: "breaker", seed, brkRev: plan.rev, ...(level !== "normal" ? { level } : {}) } as unknown as PuzzleData;
          const g = gradeAnswer(puzzle, raw, 0);
          runs.push({
            rev: plan.rev,
            level,
            seed,
            player,
            raw,
            claimed,
            score: replay.score,
            flagged: !!replay.flagged,
            state: digest(replay.state),
            checkpoints: digest(replay.checkpoints ?? null),
            grade: { score: g.score, isCorrect: g.isCorrect, extra: digest(stableExtra(g.extra)) },
          });
          console.log(`brkRev ${plan.rev} ${level.padEnd(6)} seed ${String(seed).padStart(9)} ${player.padEnd(15)} → ${replay.score} (graded ${g.score})`);
        }
      }
    }
  }
  const body = { recorded: "brkRev 12 (every level) and brkRev 11 on polish/d5 428cd79a, before brkRev 13 (23 Nov 2026)", inits, runs };
  writeFileSync(BREAKER_LADDER_LEGACY, gzipSync(JSON.stringify(body) + "\n", { level: 9 }));
  console.log(`recorded ${inits.length} starts and ${runs.length} runs to ${BREAKER_LADDER_LEGACY}`);
}
