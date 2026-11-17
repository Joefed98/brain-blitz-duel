/**
 * The Cards & Board levels step up clearly (16 Nov 2026, Joe: "a check that fails if any level isn't clearly below the
 * one before"): for Free Cell, Mahjong Solitaire, Summit, Five Hands and Thirteen, Easy → Normal → Hard → Expert, each
 * level's average score on the same ORDER_DEALS deals for three players (scripts/cards-levels-tune.ts `reportLevel`,
 * the server's grade):
 *
 *   average  the shared skill-band tool's average player (Easy is the average player's level);
 *   elite    the shared tool's elite player;
 *   human    a player held to human limits (scripts/cards-human-limits.ts: 0.25 s to react, 0.15 s to move, deciding
 *            only from what is on the table).
 *
 * A level is clearly below the one before when at least one player scores ORDER_STEP points less there, and no player
 * scores more than ORDER_SLACK points more (an all-seeing bot can't feel a lever such as a missing glow, and two near-
 * perfect levels can't both step at the ceiling of 200, so each step must show on some player and reverse on none).
 * Everything is seeded, so a run is exactly reproducible.
 *
 *   bun scripts/cards-levels-order-check.ts [--part=k/5] [--deals=n]   (one game a part, in GAMES order)
 */
import type { PuzzleType } from "../src/lib/duel/types";
import type { Level } from "../src/lib/levels/levels";
import { reportLevel } from "./cards-levels-tune";

export const ORDER_DEALS = 24;
export const ORDER_STEP = 5;
export const ORDER_SLACK = 3;
const GAMES: PuzzleType[] = ["freecell", "mahjong", "tripeaks", "fivehands", "pyramid"];
const LEVELS: Level[] = ["easy", "normal", "hard", "expert"];
const PLAYERS = ["average", "elite", "human"] as const;

const part = process.argv.find((a) => a.startsWith("--part="))?.slice(7);
const deals = Number(process.argv.find((a) => a.startsWith("--deals="))?.slice(8) ?? ORDER_DEALS);
const [k, n] = part ? (part.split("/").map(Number) as [number, number]) : [1, 1];
const games = GAMES.filter((_, i) => i % n === k - 1);

let passed = 0;
const failures: string[] = [];
for (const g of games) {
  const avg: Record<string, Record<string, number>> = {};
  for (const level of LEVELS) {
    avg[level] = {};
    for (const p of PLAYERS) avg[level]![p] = (await reportLevel(g, level, p, deals, 0)).average;
    console.log(`${g.padEnd(9)} ${level.padEnd(7)} ${PLAYERS.map((p) => `${p} ${avg[level]![p]!.toFixed(1)}`).join("  ")}`);
  }
  for (let i = 1; i < LEVELS.length; i++) {
    const hi = LEVELS[i - 1]!;
    const lo = LEVELS[i]!;
    const drops = PLAYERS.map((p) => avg[hi]![p]! - avg[lo]![p]!);
    const clear = drops.some((d) => d >= ORDER_STEP);
    const reversed = drops.some((d) => d < -ORDER_SLACK);
    const what = `${g}: ${lo} is clearly below ${hi} (${PLAYERS.map((p, j) => `${p} ${drops[j]! >= 0 ? "−" : "+"}${Math.abs(drops[j]!).toFixed(1)}`).join(", ")})`;
    if (clear && !reversed) passed++;
    else {
      failures.push(what);
      console.log(`  FAIL ${what}`);
    }
  }
}
console.log(failures.length ? `FAIL cards-levels-order-check: ${failures.length} failed, ${passed} passed` : `PASS cards-levels-order-check: ${passed} steps clearly down`);
process.exit(failures.length ? 1 : 0);
