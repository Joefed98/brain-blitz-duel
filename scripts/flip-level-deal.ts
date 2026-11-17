/**
 * Roofbound's level deals (15 Nov 2026, the difficulty levels; docs/arcade-standard/flip.md "Levels"): writes
 * src/lib/duel/flipLevelDeals.server.ts, the course seeds Easy, Hard and Expert deal on flipRev 13. A course is kept for a
 * level only when its stored witness route (scripts/fixtures/flip-levels-witness.json.gz, planned on that level's
 * course by scripts/flip-x200-plan.ts) takes every part's maximum (the minute with no crash, the level's perfect
 * landings, 8+ double flips, a flow streak of 50+) and scores exactly 200 through the server replay.
 *
 *   bun scripts/flip-level-deal.ts --witness [--level=easy] [--part=k/n] [--out=<file>]   plan the witness routes (slow)
 *   bun scripts/flip-level-deal.ts --merge <file>…                                      merge planned parts into the fixture
 *   bun scripts/flip-level-deal.ts [--check]                                            build (or check) the deal file
 *
 * The candidates are the 260 seeds of flipRev 13's own deal list (tuning seeds 0–59 and fresh seeds 10000–10199).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { flipCheckpoint, flipGameFor, flipGraceSpecOf, flipSweetsTaken, FLIP_REV_GRACE, FLIP_V11_DOUBLES, FLIP_V11_STREAK_FULL, type FlipLevel, type FlipState } from "../src/lib/arcade/flip";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { encodeFlipRun, replayFlipRun } from "../src/lib/duel/flip";

/** A witness that takes every part's maximum on its level: the minute with no crash, the level's perfect landings, 8+ double flips, a streak of 50+. */
export const flipTakesAllAtLevel = (s: FlipState) =>
  s.ended === 1 && !(s.saves ?? 0) && flipSweetsTaken(s) >= (flipGraceSpecOf(s).parts.find((p) => p.key === "sweets")!.of ?? 0) && (s.combos ?? 0) >= FLIP_V11_DOUBLES && (s.bestStreak ?? 0) >= FLIP_V11_STREAK_FULL;
import { flipTap, planFlipRoute } from "./flip-x200-plan";
import { FLIP_FRESH_SEEDS, FLIP_TUNING_SEEDS } from "./flip-x200-record";

export const FLIP_LEVEL_DEAL_FILE = "src/lib/duel/flipLevelDeals.server.ts";
export const FLIP_LEVEL_WITNESS = new URL("./fixtures/flip-levels-witness.json.gz", import.meta.url);
export const FLIP_DEAL_LEVELS: readonly FlipLevel[] = ["easy", "hard", "expert"];
export const FLIP_LEVEL_CANDIDATES = [...FLIP_TUNING_SEEDS, ...FLIP_FRESH_SEEDS];

export interface FlipLevelWitness {
  level: FlipLevel;
  seed: number;
  /** Tap ticks of the planned route (null: no route lasts the minute). */
  taps: number[] | null;
}

/** Plays a tap list on a level's course and encodes it as the phone does. */
export function encodeFlipLevelLog(level: FlipLevel, seed: number, events: ArcadeInputEvent[]): { raw: string; state: FlipState } {
  const game = flipGameFor(FLIP_REV_GRACE, level);
  let state = game.init(seed);
  const byTick = new Map(events.map((e) => [e.t, e]));
  const checkpoints: unknown[] = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    state = game.step(state, byTick.get(state.tick + 1) ?? null);
    if (state.tick % 300 === 0) checkpoints.push(flipCheckpoint(state));
  }
  const raw = encodeFlipRun({ seed, claimedScore: game.score(state), events, inputs: [], taps: [], endTick: state.tick, checkpoints } as never);
  return { raw, state };
}

export function readLevelWitnesses(): FlipLevelWitness[] {
  return JSON.parse(gunzipSync(readFileSync(FLIP_LEVEL_WITNESS)).toString()) as FlipLevelWitness[];
}

/** Each level's kept seeds (in candidate order) and what was left out. */
export function buildFlipLevelDeals(witnesses = readLevelWitnesses()): Record<FlipLevel, { kept: number[]; dropped: string[] }> {
  const out = {} as Record<FlipLevel, { kept: number[]; dropped: string[] }>;
  for (const level of FLIP_DEAL_LEVELS) {
    const kept: number[] = [];
    const dropped: string[] = [];
    const mine = new Map(witnesses.filter((w) => w.level === level).map((w) => [w.seed, w]));
    for (const seed of FLIP_LEVEL_CANDIDATES) {
      const w = mine.get(seed);
      if (!w?.taps) {
        dropped.push(`${seed} (no route)`);
        continue;
      }
      const { raw, state } = encodeFlipLevelLog(level, seed, w.taps.map(flipTap));
      const r = replayFlipRun(seed, raw, FLIP_REV_GRACE, level);
      if (flipTakesAllAtLevel(state) && !r.flagged && r.score === 200) kept.push(seed);
      else dropped.push(`${seed} (${r.flagged ? "flagged" : r.score})`);
    }
    out[level] = { kept, dropped };
  }
  return out;
}

export function flipLevelDealSource(deals: Record<FlipLevel, { kept: number[] }>): string {
  const total = FLIP_LEVEL_CANDIDATES.length;
  const lines = FLIP_DEAL_LEVELS.map((l) => `  ${l}: [${deals[l].kept.join(",")}],`).join("\n");
  return `/**
 * Roofbound's level deals on flipRev 13 (the difficulty levels, 15 Nov 2026; built by \`bun scripts/flip-level-deal.ts\`,
 * do not edit): for each level, the course seeds whose stored witness route (scripts/fixtures/flip-levels-witness.json.gz)
 * takes every part's maximum on that level's course and scores exactly 200 through the server replay. Kept of the ${total}
 * candidates: ${FLIP_DEAL_LEVELS.map((l) => `${l} ${deals[l].kept.length}`).join(", ")}.
 */
export const FLIP_LEVEL_DEALS: Readonly<Record<"easy" | "hard" | "expert", readonly number[]>> = {
${lines}
};

/** The course a room seed deals on flipRev 13 at a level. */
export function flipLevelDealSeed(level: "easy" | "hard" | "expert", roomSeed: number): number {
  const deal = FLIP_LEVEL_DEALS[level];
  const n = deal.length;
  return deal[((Math.trunc(roomSeed) % n) + n) % n]!;
}
`;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
  if (args.includes("--witness")) {
    const levels = opt("level") ? [opt("level") as FlipLevel] : FLIP_DEAL_LEVELS;
    const [k, n] = (opt("part") ?? "1/1").split("/").map(Number) as [number, number];
    const out: FlipLevelWitness[] = [];
    for (const level of levels) {
      const game = flipGameFor(FLIP_REV_GRACE, level);
      FLIP_LEVEL_CANDIDATES.forEach((seed, i) => {
        if (i % n !== k - 1) return;
        const route = planFlipRoute(game, game.init(seed));
        out.push({ level, seed, taps: route ? route.taps : null });
      });
      console.log(`${level}: ${out.filter((w) => w.level === level).length} planned`);
    }
    writeFileSync(opt("out") ?? FLIP_LEVEL_WITNESS, gzipSync(JSON.stringify(out)));
  } else if (args.includes("--merge")) {
    const files = args.filter((a) => !a.startsWith("--"));
    const all = files.flatMap((f) => JSON.parse(gunzipSync(readFileSync(f)).toString()) as FlipLevelWitness[]);
    const order = new Map(FLIP_LEVEL_CANDIDATES.map((s, i) => [s, i]));
    all.sort((a, b) => FLIP_DEAL_LEVELS.indexOf(a.level) - FLIP_DEAL_LEVELS.indexOf(b.level) || order.get(a.seed)! - order.get(b.seed)!);
    writeFileSync(FLIP_LEVEL_WITNESS, gzipSync(JSON.stringify(all)));
    console.log(`${all.length} witnesses merged`);
  } else {
    const deals = buildFlipLevelDeals();
    for (const l of FLIP_DEAL_LEVELS) console.log(`${l}: ${deals[l].kept.length} of ${FLIP_LEVEL_CANDIDATES.length} kept; left out: ${deals[l].dropped.join(", ") || "none"}`);
    const src = flipLevelDealSource(deals);
    if (args.includes("--check")) {
      const same = readFileSync(FLIP_LEVEL_DEAL_FILE, "utf8") === src;
      console.log(same ? `${FLIP_LEVEL_DEAL_FILE} is up to date` : `FAIL ${FLIP_LEVEL_DEAL_FILE} differs from a rebuild`);
      process.exit(same ? 0 : 1);
    }
    writeFileSync(FLIP_LEVEL_DEAL_FILE, src);
    console.log(`wrote ${FLIP_LEVEL_DEAL_FILE}`);
  }
}
