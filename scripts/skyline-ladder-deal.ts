/**
 * High Rise's proved deal on skylineRev 12 (D5, 23 Nov 2026; docs/arcade-standard/skyline.md "Levels (D5, 23 Nov
 * 2026)"): writes src/lib/duel/skylineDealV12.server.ts, the seeds Normal, Easy, Hard and Expert deal. A candidate is kept
 * for a level only when the oracle held to Joe's human limits (scripts/skyline-limited-oracle.ts: no drop sooner than
 * 0.25 s after its block came into play, taps at least 0.15 s apart) scores exactly 200 through the server replay
 * (gradeAnswer on the dealt puzzle), never flagged.
 *
 *   bun scripts/skyline-ladder-deal.ts [--check]     build (or check, byte for byte) the deal file (~1 min)
 *
 * The candidates are 260 room seeds (tuning seeds 0–59 and fresh seeds 10000–10199, scripts/arcade-skill-bands/games.ts
 * roomSeed), the same for every level.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { skylineGameFor, SKYLINE_REV_FLOORS, type SkylineState } from "../src/lib/arcade/skyline";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import type { PuzzleData } from "../src/lib/duel/types";
import { puzzleLevel } from "../src/lib/levels/levels";
import { roomSeed } from "./arcade-skill-bands/games";
import { skylineLimitedOracle, skylineTapsWithinLimits } from "./skyline-limited-oracle";
import { encodeTaps } from "./skyline-rev12-legacy-record";

export const SKYLINE_DEAL_FILE = "src/lib/duel/skylineDealV12.server.ts";
export const SKYLINE_DEAL_LEVELS = ["normal", "easy", "hard", "expert"] as const;
export type SkylineDealLevel = (typeof SKYLINE_DEAL_LEVELS)[number];
export const SKYLINE_DEAL_CANDIDATES: readonly number[] = [...Array.from({ length: 60 }, (_, n) => roomSeed(n)), ...Array.from({ length: 200 }, (_, n) => roomSeed(10000 + n))];

/** The puzzle a level deals on a seed (the level stamped only off Normal, as generatePuzzle stamps it). */
export function skylineDealtPuzzle(level: SkylineDealLevel, seed: number): PuzzleData {
  return { type: "skyline", seed, skylineRev: SKYLINE_REV_FLOORS, ...(level === "normal" ? {} : { level }) } as PuzzleData;
}

/** The limited oracle's run on a dealt puzzle, encoded as the phone sends it, and the server's grade of it. */
export function skylineProofRun(puzzle: PuzzleData): { raw: string; taps: number[]; score: number; flagged: boolean; limits: boolean; state: SkylineState } {
  const p = puzzle as unknown as { seed: number; skylineRev: number };
  const game = skylineGameFor(p.skylineRev, puzzleLevel(puzzle));
  const run = skylineLimitedOracle(game, p.seed);
  // Encoded as the phone sends it (checkpoints every 300 ticks, the client counters), then graded by the server.
  const { raw, state } = encodeTaps(puzzle, run.taps);
  const g = gradeAnswer(puzzle, raw, 0);
  return { raw, taps: run.taps, score: g.score, flagged: Boolean((g.extra as { flagged?: boolean } | undefined)?.flagged), limits: skylineTapsWithinLimits(run.taps), state };
}

/** Each level's kept seeds (in candidate order) and what was left out. */
export function buildSkylineDeal(): Record<SkylineDealLevel, { kept: number[]; dropped: string[] }> {
  const out = {} as Record<SkylineDealLevel, { kept: number[]; dropped: string[] }>;
  for (const level of SKYLINE_DEAL_LEVELS) {
    const kept: number[] = [];
    const dropped: string[] = [];
    for (const seed of SKYLINE_DEAL_CANDIDATES) {
      const r = skylineProofRun(skylineDealtPuzzle(level, seed));
      if (r.score === 200 && !r.flagged && r.limits) kept.push(seed);
      else dropped.push(`${seed} (${r.flagged ? "flagged" : r.limits ? r.score : "limits"})`);
    }
    out[level] = { kept, dropped };
  }
  return out;
}

export function skylineDealSource(deal: Record<SkylineDealLevel, { kept: number[] }>): string {
  const lines = SKYLINE_DEAL_LEVELS.map((l) => `  ${l}: [${deal[l].kept.join(",")}],`).join("\n");
  return `/**
 * High Rise's proved deal on skylineRev 12 (D5, 23 Nov 2026; built by \`bun scripts/skyline-ladder-deal.ts\`, do not edit):
 * for each level, the seeds on which the oracle held to Joe's human limits (scripts/skyline-limited-oracle.ts: no drop
 * sooner than 0.25 s after its block came into play, taps at least 0.15 s apart) scores exactly 200 through the server
 * replay. Kept of the ${SKYLINE_DEAL_CANDIDATES.length} candidates: ${SKYLINE_DEAL_LEVELS.map((l) => `${l} ${deal[l].kept.length}`).join(", ")}.
 */
export const SKYLINE_V12_DEAL: Readonly<Record<"normal" | "easy" | "hard" | "expert", readonly number[]>> = {
${lines}
};

/** The seed a room seed deals on skylineRev 12 at a level (Normal when none). */
export function skylineDealSeedV12(level: "normal" | "easy" | "hard" | "expert", roomSeed: number): number {
  const deal = SKYLINE_V12_DEAL[level];
  const n = deal.length;
  return deal[((Math.trunc(roomSeed) % n) + n) % n]!;
}
`;
}

if (import.meta.main) {
  const t0 = Date.now();
  const deal = buildSkylineDeal();
  for (const l of SKYLINE_DEAL_LEVELS) console.log(`${l}: ${deal[l].kept.length} of ${SKYLINE_DEAL_CANDIDATES.length} kept; left out: ${deal[l].dropped.join(", ") || "none"}`);
  const src = skylineDealSource(deal);
  console.log(`built in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (process.argv.includes("--check")) {
    const same = readFileSync(SKYLINE_DEAL_FILE, "utf8") === src;
    console.log(same ? `${SKYLINE_DEAL_FILE} is up to date` : `FAIL ${SKYLINE_DEAL_FILE} differs from a rebuild`);
    process.exit(same ? 0 : 1);
  }
  writeFileSync(SKYLINE_DEAL_FILE, src);
  console.log(`wrote ${SKYLINE_DEAL_FILE}`);
}
