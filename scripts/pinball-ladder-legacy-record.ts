/**
 * Records Pinball's pinRev 8 (every level) and pinRev 7 and 6 runs before pinRev 9 (D5's ladder, 23 Nov 2026;
 * docs/arcade-standard/pinball.md "pinRev 9"), for scripts/pinball-ladder-check.ts: each stamp's start at every level (a
 * digest per seed) and runs by several players (the skill-band bot at average, elite and flawless held to the human
 * limits, plus a seeded random-flipper run), each with its server grade (gradeAnswer on the stored puzzle: score, verdict
 * and a digest of the stored extra, the replay's wall-clock fields left out), its replayed score and a digest of the final
 * state and checkpoints. Recorded on the source tree before any pinRev 9 code; never re-record over it.
 *
 *   bun scripts/pinball-ladder-legacy-record.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { PIN_CHECKPOINT_INTERVAL, PIN_INPUT_FLIPPERS, PIN_REV_JOULZ, PIN_REV_SAVE, PIN_REV_STD, type PinState } from "../src/lib/arcade/pinball";
import { pinballGameForAny, pinCheckpointAny } from "../src/lib/arcade/pinball4";
import { encodePinballRun, replayPinballRun } from "../src/lib/duel/pinball";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import type { PuzzleData } from "../src/lib/duel/types";
import type { Level } from "../src/lib/levels/levels";
import { Human, HUMAN_LIMITS, type SkillLevel } from "./arcade-skill-bands/human";
import { bot as pinballBot } from "./arcade-skill-bands/bots/pinball";

export const PINBALL_LADDER_LEGACY = "scripts/fixtures/pinball-ladder-legacy.json.gz";
export const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);
/** The stored extra without the fields that measure the machine (the replay's wall-clock time and lag). */
export const stableExtra = (v: unknown): unknown => (v == null ? null : JSON.parse(JSON.stringify(v, (k, x) => (k === "replayMs" || k === "clientLag" ? undefined : x))));

/** The stamps and levels recorded: pinRev 8 at every level, pinRev 7 and 6 (Normal). */
export const PINBALL_LEGACY_PLANS: { rev: number; levels: Level[] }[] = [
  { rev: PIN_REV_SAVE, levels: ["normal", "easy", "hard", "expert"] },
  { rev: PIN_REV_JOULZ, levels: ["normal"] },
  { rev: PIN_REV_STD, levels: ["normal"] },
];
const RUN_SEEDS = [7, 301794028];
const PLAYERS = ["random", "average@limits", "elite@limits", "perfect@limits"] as const;
export const PINBALL_INIT_SEEDS = [...Array.from({ length: 8 }, (_, i) => i * 7919 + 3), 489736026, 1453580015];

/** A seeded random flipper stream: each change holds a mask (none, left, right, both) for a while. */
export function pinballRandomEvents(seed: number, runTicks: number): ArcadeInputEvent[] {
  const ev: ArcadeInputEvent[] = [];
  let x = seed | 1;
  let mask = 0;
  for (let t = 3; t <= runTicks; ) {
    x = Math.imul(x ^ (x >>> 13), 0x5bd1e995) >>> 0;
    const next = x % 4;
    if (next !== mask) {
      ev.push({ t, k: PIN_INPUT_FLIPPERS, a: next, b: 0, c: 0, d: 0 });
      mask = next;
    }
    t += 3 + (x % 41);
  }
  return ev;
}

/** The phone's encoding of a log played on a stamp's game at a level. */
export function encodePinball(rev: number, level: Level, seed: number, events: ArcadeInputEvent[]): { raw: string; claimed: number; endTick: number } {
  const game = pinballGameForAny(rev, level);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed) as PinState;
  const checkpoints: ReturnType<typeof pinCheckpointAny>[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, at.get(s.tick + 1) ?? null) as PinState;
    if (s.tick % PIN_CHECKPOINT_INTERVAL === 0) checkpoints.push(pinCheckpointAny(s));
  }
  const claimed = game.score(s);
  return { raw: encodePinballRun({ seed, claimedScore: claimed, events, endTick: s.tick, checkpoints }), claimed, endTick: s.tick };
}

export interface PinballLegacyRun {
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
  const runs: PinballLegacyRun[] = [];
  for (const plan of PINBALL_LEGACY_PLANS) {
    for (const level of plan.levels) {
      const game = pinballGameForAny(plan.rev, level);
      for (const seed of PINBALL_INIT_SEEDS) inits.push({ rev: plan.rev, level, seed, digest: digest(game.init(seed)) });
      for (const seed of RUN_SEEDS) {
        for (const player of PLAYERS) {
          const [skill, lim] = player.split("@") as [SkillLevel | "random", string | undefined];
          const events =
            skill === "random"
              ? pinballRandomEvents(seed, game.runTicks)
              : (pinballBot({ game: game as any, seed, rev: plan.rev, human: new Human("pinball", seed, skill, lim ? HUMAN_LIMITS : null), fixes: true }).events ?? []);
          const { raw, claimed } = encodePinball(plan.rev, level, seed, events);
          const replay = replayPinballRun(seed, raw, plan.rev, level);
          const puzzle = { type: "pinball", seed, pinRev: plan.rev, ...(level !== "normal" ? { level } : {}) } as unknown as PuzzleData;
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
          console.log(`pinRev ${plan.rev} ${level.padEnd(6)} seed ${String(seed).padStart(9)} ${player.padEnd(15)} → ${replay.score} (graded ${g.score})`);
        }
      }
    }
  }
  const body = { recorded: "pinRev 8 (every level), 7 and 6 on polish/d5 428cd79a, before pinRev 9 (23 Nov 2026)", inits, runs };
  writeFileSync(PINBALL_LADDER_LEGACY, gzipSync(JSON.stringify(body) + "\n", { level: 9 }));
  console.log(`recorded ${inits.length} starts and ${runs.length} runs to ${PINBALL_LADDER_LEGACY}`);
}
