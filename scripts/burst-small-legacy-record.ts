/**
 * Records Fission's burstRev 13 (every level) and burstRev 12 runs before burstRev 14 (the smaller atoms, D5, 22 Nov
 * 2026; docs/arcade-standard/burst.md "burstRev 14"), for scripts/burst-small-check.ts: each stamp's start at every level
 * (a digest per seed) and runs at several skill levels plus a random-input run, each with its server grade (gradeAnswer
 * on the stored puzzle: score, verdict and a digest of the stored extra), its replayed score and a digest of the final
 * state and checkpoints. Recorded on 6988eaa3 (polish/d5), before any burstRev 14 code; never re-record over it.
 *
 *   bun scripts/burst-small-legacy-record.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { burstCheckpoint, burstGameFor, BURST_CHECKPOINT_INTERVAL, BURST_INPUT_FIRE, BURST_INPUT_MOVE, BURST_REV_BIG, BURST_REV_WIDE, type BurstState } from "../src/lib/arcade/burst";
import { encodeBurstRun, replayBurstRun } from "../src/lib/duel/burst";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import type { PuzzleData } from "../src/lib/duel/types";
import type { Level } from "../src/lib/levels/levels";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";
import { bot as burstBot } from "./arcade-skill-bands/bots/burst";

const OUT = "scripts/fixtures/burst-small-legacy.json.gz";
const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);

/** The stamps and levels recorded: burstRev 13 at every level (Normal and the three level deals), burstRev 12 (Normal only). */
const PLANS: { rev: number; levels: Level[] }[] = [
  { rev: BURST_REV_BIG, levels: ["normal", "easy", "hard", "expert"] },
  { rev: BURST_REV_WIDE, levels: ["normal"] },
];
const RUN_SEEDS = [7, 4242, 10007];
const PLAYERS: (SkillLevel | "random")[] = ["random", "weak", "average", "elite", "perfect"];
const INIT_SEEDS = [...Array.from({ length: 16 }, (_, i) => i * 7919 + 3), 489736026, 1453580015];

/** A seeded random input stream: walks (move events across the arena) and taps. */
function randomEvents(seed: number, runTicks: number): ArcadeInputEvent[] {
  const ev: ArcadeInputEvent[] = [];
  let x = seed | 1;
  for (let t = 3; t <= runTicks; ) {
    x = Math.imul(x ^ (x >>> 13), 0x5bd1e995) >>> 0;
    if (x % 3 === 0) ev.push({ t, k: BURST_INPUT_MOVE, a: 12 + (x % 366), b: 0, c: (x >>> 9) & 1, d: 0 });
    else ev.push({ t, k: BURST_INPUT_FIRE, a: 0, b: t & 1, c: 0, d: 0 });
    t += 4 + (x % 37);
  }
  return ev;
}

function encode(rev: number, level: Level, seed: number, events: ArcadeInputEvent[]): { raw: string; claimed: number; endTick: number } {
  const game = burstGameFor(rev, level);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed) as BurstState;
  const checkpoints: unknown[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, at.get(s.tick + 1) ?? null) as BurstState;
    if (s.tick % BURST_CHECKPOINT_INTERVAL === 0) checkpoints.push(burstCheckpoint(s));
  }
  const claimed = game.score(s);
  return { raw: encodeBurstRun({ seed, claimedScore: claimed, events, endTick: s.tick, checkpoints } as never), claimed, endTick: s.tick };
}

const inits: { rev: number; level: Level; seed: number; digest: string }[] = [];
const runs: { rev: number; level: Level; seed: number; player: string; raw: string; claimed: number; score: number; flagged: boolean; state: string; checkpoints: string; grade: { score: number; isCorrect: boolean; extra: string } }[] = [];
for (const plan of PLANS) {
  for (const level of plan.levels) {
    const game = burstGameFor(plan.rev, level);
    for (const seed of INIT_SEEDS) inits.push({ rev: plan.rev, level, seed, digest: digest(game.init(seed)) });
    for (const seed of RUN_SEEDS) {
      for (const player of PLAYERS) {
        const events = player === "random" ? randomEvents(seed, game.runTicks) : (burstBot({ game: game as any, seed, rev: plan.rev, human: new Human("burst", seed, player), fixes: true }).events ?? []);
        const { raw, claimed } = encode(plan.rev, level, seed, events);
        const replay = replayBurstRun(seed, raw, plan.rev, level);
        const puzzle = { type: "burst", seed, burstRev: plan.rev, ...(level !== "normal" ? { level } : {}) } as unknown as PuzzleData;
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
          grade: { score: g.score, isCorrect: g.isCorrect, extra: digest(g.extra ?? null) },
        });
        console.log(`burstRev ${plan.rev} ${level.padEnd(6)} seed ${String(seed).padStart(5)} ${player.padEnd(7)} → ${replay.score} (graded ${g.score})`);
      }
    }
  }
}
const body = { recorded: "burstRev 13 (every level) and burstRev 12 on 6988eaa3 (polish/d5), before burstRev 14 (22 Nov 2026)", inits, runs };
writeFileSync(OUT, gzipSync(JSON.stringify(body) + "\n", { level: 9 }));
console.log(`recorded ${inits.length} starts and ${runs.length} runs to ${OUT}`);
