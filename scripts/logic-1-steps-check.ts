/**
 * logic-1-steps-check (the Logic overhaul, session 1; Joe 16 Nov 2026: "a check that fails if a level isn't clearly
 * below the one before"). No browser, ~15 s. Plays every level of Box Six, Polypotions, Hanoi, Safe Cracker, Mosaic,
 * Colour Flood and Minefield on 20 fixed deals with the shared tool's bots held to human limits
 * (scripts/logic-1-tune.ts: 0.25 s to react, 0.15 s to move, #444's model) and fails unless, per game:
 *
 *  1. Easy is above Normal for the "great" bot by at least EASY_STEP (Normal is today's game, already near the 200
 *     ceiling for a strong player, so Easy cannot sit far above it);
 *  2. Hard is below Normal, and Expert below Hard, for the "great" bot by at least LEVEL_STEP each;
 *  3. the near-perfect bot never scores higher on a level than on the one before (within NEAR_SLACK);
 *  4. Expert stays possible to score well on: the near-perfect bot finishes at least EXPERT_FINISH of its boards and its
 *     best tenth averages at least EXPERT_BEST_TENTH.
 *
 *   bun scripts/logic-1-steps-check.ts
 */
import type { PuzzleType } from "../src/lib/duel/types";
import { average, bestTenth, finishRate, LOGIC_1_GAMES, runsFor, TUNE_LEVELS } from "./logic-1-tune";

export const SEEDS = 20;
export const EASY_STEP = 1;
export const LEVEL_STEP = 5;
export const NEAR_SLACK = 0.5;
export const EXPERT_FINISH = 0.75;
export const EXPERT_BEST_TENTH = 185;

const origError = console.error;
console.error = (...a: unknown[]) => {
  if (typeof a[0] === "string" && a[0].includes("desync")) return;
  origError(...a);
};

let passes = 0;
const failures: string[] = [];
const ok = (cond: boolean, msg: string) => (cond ? passes++ : failures.push(msg));
const r1 = (x: number) => Math.round(x * 10) / 10;

for (const type of LOGIC_1_GAMES as readonly PuzzleType[]) {
  const great = TUNE_LEVELS.map((level) => runsFor(type, level, "great", SEEDS));
  const near = TUNE_LEVELS.map((level) => runsFor(type, level, "near", SEEDS));
  const g = great.map(average);
  const n = near.map(average);
  console.log(`${type.padEnd(12)} great ${g.map(r1).join(" / ")}   near ${n.map(r1).join(" / ")}   expert near best tenth ${r1(bestTenth(near[3]!))}`);
  ok(g[0]! - g[1]! >= EASY_STEP, `${type}: Easy (${r1(g[0]!)}) is at least ${EASY_STEP} above Normal (${r1(g[1]!)}) for the great bot`);
  ok(g[1]! - g[2]! >= LEVEL_STEP, `${type}: Hard (${r1(g[2]!)}) is at least ${LEVEL_STEP} below Normal (${r1(g[1]!)}) for the great bot`);
  ok(g[2]! - g[3]! >= LEVEL_STEP, `${type}: Expert (${r1(g[3]!)}) is at least ${LEVEL_STEP} below Hard (${r1(g[2]!)}) for the great bot`);
  for (let i = 1; i < 4; i++) ok(n[i]! <= n[i - 1]! + NEAR_SLACK, `${type}: the near-perfect bot scores no higher on ${TUNE_LEVELS[i]} (${r1(n[i]!)}) than on ${TUNE_LEVELS[i - 1]} (${r1(n[i - 1]!)})`);
  ok(finishRate(near[3]!) >= EXPERT_FINISH, `${type}: Expert is finished by the near-perfect bot on ${Math.round(finishRate(near[3]!) * 100)} % of boards (at least ${EXPERT_FINISH * 100} %)`);
  ok(bestTenth(near[3]!) >= EXPERT_BEST_TENTH, `${type}: Expert's best tenth for the near-perfect bot is ${r1(bestTenth(near[3]!))} (at least ${EXPERT_BEST_TENTH})`);
}

if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`FAIL logic-1-steps-check: ${failures.length} failed, ${passes} passed`);
  process.exit(1);
}
console.log(`PASS logic-1-steps-check: ${passes} checks (every level clearly below the one before; Expert scoreable)`);
