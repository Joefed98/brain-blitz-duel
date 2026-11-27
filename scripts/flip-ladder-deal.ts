/**
 * Roofbound's proved level deals on flipRev 14 (D5, 23 Nov 2026; docs/arcade-standard/flip.md "Levels (D5, 23 Nov
 * 2026)"): writes src/lib/duel/flipLadderDeals.server.ts, the course seeds Easy, Hard and Expert deal on flipRev 14. A
 * course is kept for a level only when its witness held to Joe's human limits scores exactly 200 through the server
 * replay (gradeAnswer on the dealt puzzle), never flagged, its taps at least 0.15 s apart, landing at least one perfect
 * landing more than the level's part needs (FLIP_LADDER_SPARE).
 *
 * The witness is the planner held to the limits: the skill-band bot's flawless level under HUMAN_LIMITS (the ladder's
 * `proof` player, scripts/d5-ladder-lib.ts `playDealt(…, "perfect")`). It plans its flips exactly on the sim, but only
 * over the stretch of cave it has seen and reacted to (a hazard, a moving spike or a sweet spot counts a reaction, 0.25 s,
 * after it comes into view, and the screen it reads is 0.15 s old), never to the exact tick of a hazard it has not seen:
 * scripts/flip-x200-plan.ts, which flipRev 13's level deals used, plans the whole minute at once to the exact tick.
 * The witnesses (each run's tap ticks) are stored in scripts/fixtures/flip-ladder-witness.json.gz and encoded as the phone
 * sends them (checkpoints, the claimed score on today's lines) when graded.
 *
 *   bun scripts/flip-ladder-deal.ts --witness [--level=easy] [--part=k/n] [--out=<file>]   play the witnesses (slow)
 *   bun scripts/flip-ladder-deal.ts --merge <file>…                                      merge played parts into the fixture
 *   bun scripts/flip-ladder-deal.ts [--check]                                            build (or check) the deal file
 *
 * The candidates are flipRev 13's level candidates (tuning seeds 0–59 and fresh seeds 10000–10199).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { FLIP_REV_LADDER, FLIP_V14_LEVEL_RULES, type FlipLevel } from "../src/lib/arcade/flip";
import { decodeFlipRun } from "../src/lib/duel/flip";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import type { PuzzleData } from "../src/lib/duel/types";
import { HUMAN_LIMITS } from "./arcade-skill-bands/human";
import { playDealt } from "./d5-ladder-lib";
import { FLIP_FRESH_SEEDS, FLIP_TUNING_SEEDS } from "./flip-x200-record";
import { flipTap } from "./flip-x200-plan";
import { encodeFlipEvents } from "./flip-ladder-legacy-record";

export const FLIP_LADDER_DEAL_FILE = "src/lib/duel/flipLadderDeals.server.ts";
export const FLIP_LADDER_WITNESS = new URL("./fixtures/flip-ladder-witness.json.gz", import.meta.url);
export const FLIP_LADDER_LEVELS: readonly FlipLevel[] = ["easy", "hard", "expert"];
export const FLIP_LADDER_CANDIDATES: readonly number[] = [...FLIP_TUNING_SEEDS, ...FLIP_FRESH_SEEDS];
/**
 * A dealt course's witness lands at least this many perfect landings more than the level's part needs, so a course's 200
 * never hangs on one exact landing: the best humans reach it with a sweet spot to spare.
 */
export const FLIP_LADDER_SPARE = 1;
/** A finger's move: taps at least this many ticks apart (0.15 s). */
export const FLIP_MOVE_TICKS = Math.ceil(HUMAN_LIMITS.moveMs / (1000 / 60));

export interface FlipLadderWitness {
  level: FlipLevel;
  seed: number;
  /** The witness's tap ticks. */
  taps: number[];
}

/** The puzzle a level deals on a course seed. */
export function flipLadderPuzzle(level: FlipLevel, seed: number): PuzzleData {
  return { type: "flip", seed, flipRev: FLIP_REV_LADDER, level } as PuzzleData;
}

/** True when a run's taps keep the limits: at least FLIP_MOVE_TICKS apart. */
export function flipTapsWithinLimits(taps: readonly number[]): boolean {
  const ticks = [...taps].sort((a, b) => a - b);
  for (let i = 1; i < ticks.length; i++) if (ticks[i]! - ticks[i - 1]! < FLIP_MOVE_TICKS) return false;
  return true;
}

/** A witness encoded as the phone sends it, on its level's flipRev 14 game. */
export function flipWitnessRaw(w: FlipLadderWitness): string {
  return encodeFlipEvents(flipLadderPuzzle(w.level, w.seed), w.taps.map(flipTap)).raw;
}

/** The witness held to the limits on a level's course: the flawless skill-band bot under HUMAN_LIMITS, as the phone sends it. */
export async function playFlipWitness(level: FlipLevel, seed: number): Promise<FlipLadderWitness> {
  const r = await playDealt("flip", flipLadderPuzzle(level, seed), "perfect");
  return { level, seed, taps: decodeFlipRun(r.raw).events.map((e) => e.t) };
}

/** A witness's grade on its puzzle (the server replay). */
export function gradeFlipWitness(w: FlipLadderWitness): { score: number; flagged: boolean; limits: boolean; sweets: number; spare: boolean } {
  const g = gradeAnswer(flipLadderPuzzle(w.level, w.seed), flipWitnessRaw(w), 0);
  const sweets = Number((g.extra as { sweets?: number } | undefined)?.sweets ?? 0);
  return {
    score: g.score,
    flagged: Boolean((g.extra as { flagged?: boolean } | undefined)?.flagged),
    limits: flipTapsWithinLimits(w.taps),
    sweets,
    spare: sweets >= FLIP_V14_LEVEL_RULES[w.level].sweetsFull + FLIP_LADDER_SPARE,
  };
}

export function readLadderWitnesses(): FlipLadderWitness[] {
  return JSON.parse(gunzipSync(readFileSync(FLIP_LADDER_WITNESS)).toString()) as FlipLadderWitness[];
}

/** Each level's kept seeds (in candidate order) and what was left out. */
export function buildFlipLadderDeals(witnesses = readLadderWitnesses()): Record<FlipLevel, { kept: number[]; dropped: string[] }> {
  const out = {} as Record<FlipLevel, { kept: number[]; dropped: string[] }>;
  for (const level of FLIP_LADDER_LEVELS) {
    const mine = new Map(witnesses.filter((w) => w.level === level).map((w) => [w.seed, w]));
    const kept: number[] = [];
    const dropped: string[] = [];
    for (const seed of FLIP_LADDER_CANDIDATES) {
      const w = mine.get(seed);
      if (!w) {
        dropped.push(`${seed} (no witness)`);
        continue;
      }
      const r = gradeFlipWitness(w);
      if (r.score === 200 && !r.flagged && r.limits && r.spare) kept.push(seed);
      else dropped.push(`${seed} (${r.flagged ? "flagged" : !r.limits ? "limits" : r.score !== 200 ? r.score : `${r.sweets} perfect landings`})`);
    }
    out[level] = { kept, dropped };
  }
  return out;
}

export function flipLadderDealSource(deals: Record<FlipLevel, { kept: number[] }>): string {
  const lines = FLIP_LADDER_LEVELS.map((l) => `  ${l}: [${deals[l].kept.join(",")}],`).join("\n");
  return `/**
 * Roofbound's level deals on flipRev 14 (D5, 23 Nov 2026; built by \`bun scripts/flip-ladder-deal.ts\`, do not edit): for
 * each level, the course seeds whose witness held to Joe's human limits (scripts/fixtures/flip-ladder-witness.json.gz: the
 * flawless skill-band bot under HUMAN_LIMITS) scores exactly 200 through the server replay with a perfect landing to
 * spare. Kept of the
 * ${FLIP_LADDER_CANDIDATES.length} candidates: ${FLIP_LADDER_LEVELS.map((l) => `${l} ${deals[l].kept.length}`).join(", ")}.
 */
export const FLIP_LADDER_DEALS: Readonly<Record<"easy" | "hard" | "expert", readonly number[]>> = {
${lines}
};

/** The course a room seed deals on flipRev 14 at a level. */
export function flipLadderDealSeed(level: "easy" | "hard" | "expert", roomSeed: number): number {
  const deal = FLIP_LADDER_DEALS[level];
  const n = deal.length;
  return deal[((Math.trunc(roomSeed) % n) + n) % n]!;
}
`;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
  if (args.includes("--witness")) {
    const levels = opt("level") ? [opt("level") as FlipLevel] : FLIP_LADDER_LEVELS;
    const [k, n] = (opt("part") ?? "1/1").split("/").map(Number) as [number, number];
    const out: FlipLadderWitness[] = [];
    for (const level of levels) {
      let i = 0;
      for (const seed of FLIP_LADDER_CANDIDATES) {
        if (i++ % n !== k - 1) continue;
        out.push(await playFlipWitness(level, seed));
      }
      console.log(`${level}: ${out.filter((w) => w.level === level).length} played`);
    }
    writeFileSync(opt("out") ?? FLIP_LADDER_WITNESS, gzipSync(JSON.stringify(out)));
  } else if (args.includes("--merge")) {
    const files = args.filter((a) => !a.startsWith("--"));
    const all = files.flatMap((f) => JSON.parse(gunzipSync(readFileSync(f)).toString()) as FlipLadderWitness[]);
    const order = new Map(FLIP_LADDER_CANDIDATES.map((s, i) => [s, i]));
    all.sort((a, b) => FLIP_LADDER_LEVELS.indexOf(a.level) - FLIP_LADDER_LEVELS.indexOf(b.level) || order.get(a.seed)! - order.get(b.seed)!);
    writeFileSync(FLIP_LADDER_WITNESS, gzipSync(JSON.stringify(all)));
    console.log(`${all.length} witnesses merged`);
  } else {
    const deals = buildFlipLadderDeals();
    for (const l of FLIP_LADDER_LEVELS) console.log(`${l}: ${deals[l].kept.length} of ${FLIP_LADDER_CANDIDATES.length} kept; left out: ${deals[l].dropped.join(", ") || "none"}`);
    const src = flipLadderDealSource(deals);
    if (args.includes("--check")) {
      const same = readFileSync(FLIP_LADDER_DEAL_FILE, "utf8") === src;
      console.log(same ? `${FLIP_LADDER_DEAL_FILE} is up to date` : `FAIL ${FLIP_LADDER_DEAL_FILE} differs from a rebuild`);
      process.exit(same ? 0 : 1);
    }
    writeFileSync(FLIP_LADDER_DEAL_FILE, src);
    console.log(`wrote ${FLIP_LADDER_DEAL_FILE}`);
  }
}
