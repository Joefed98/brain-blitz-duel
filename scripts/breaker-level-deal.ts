/**
 * Breaker's brkRev 13 deals (D5's ladder, 23 Nov 2026; docs/arcade-standard/breaker.md "Levels (D5, 23 Nov 2026)"):
 * writes src/lib/duel/breakerLevelDeals.server.ts, the seeds rooms deal at each level (Normal, Easy, Hard, Expert), and
 * the witnesses that prove them, scripts/fixtures/breaker-level-deal-witness.json.gz.
 *
 * The D5 proof standard: a seed is dealt at a level only when the skill-band tool's flawless player HELD TO THE HUMAN
 * LIMITS (`new Human("breaker", seed, "perfect", HUMAN_LIMITS)`, about 0.25 s to react and 0.15 s to move, with the Oct
 * 2026 fixes; the same player as scripts/breaker-clear-perfect-record.ts and the D5 ladder's `proof`) scores exactly 200
 * on it through the server's grade (gradeAnswer on the dealt puzzle), unflagged. Candidates are the skill-band room seeds
 * n = 0, 1, 2… in order, until KEEP seeds are kept or the candidates run out.
 *
 *   bun scripts/breaker-level-deal.ts [levels…]   (writes both files; levels not named keep their stored witnesses)
 *   bun scripts/breaker-level-deal.ts --check     (replays every stored witness through the server's grade and rebuilds the
 *                                                  deal file in memory; fails unless every witness scores 200 and the file
 *                                                  is identical)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { brkCheckpoint, breakerGameFor, BRK_CHECKPOINT_INTERVAL, BRK_REV_LADDER, type BrkState } from "../src/lib/arcade/breaker";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { encodeBreakerRun } from "../src/lib/duel/breaker";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import type { PuzzleData } from "../src/lib/duel/types";
import type { Level } from "../src/lib/levels/levels";

export const BRK_DEAL_FILE = "src/lib/duel/breakerLevelDeals.server.ts";
export const BRK_DEAL_WITNESS = "scripts/fixtures/breaker-level-deal-witness.json.gz";
export const BRK_DEAL_LEVELS: readonly Level[] = ["normal", "easy", "hard", "expert"];
export const BRK_DEAL_KEEP = 100;
export const BRK_DEAL_MAX_CANDIDATES = 1200;

export interface BrkLevelWitnesses {
  level: Level;
  /** Candidates tried (the room seeds n = 0 … tried − 1). */
  tried: number;
  witnesses: { n: number; seed: number; events: ArcadeInputEvent[] }[];
}

/** The puzzle a level deals on a seed (the deal stamps `level` only off Normal). */
export function breakerDealPuzzle(seed: number, level: Level): PuzzleData {
  return { type: "breaker", seed, brkRev: BRK_REV_LADDER, ...(level !== "normal" ? { level } : {}) } as unknown as PuzzleData;
}

/** The phone's encoding of a log on a level's game, graded by the server. */
export function proveBreakerWitness(seed: number, level: Level, events: readonly ArcadeInputEvent[]): { score: number; flagged: boolean; raw: string } {
  const game = breakerGameFor(BRK_REV_LADDER, level);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed) as BrkState;
  const checkpoints: ReturnType<typeof brkCheckpoint>[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, at.get(s.tick + 1) ?? null) as BrkState;
    if (s.tick % BRK_CHECKPOINT_INTERVAL === 0) checkpoints.push(brkCheckpoint(s));
  }
  const raw = encodeBreakerRun({ seed, claimedScore: game.score(s), events: [...events], endTick: s.tick, checkpoints });
  const g = gradeAnswer(breakerDealPuzzle(seed, level), raw, 0);
  return { score: g.score, flagged: Boolean((g.extra as { flagged?: boolean } | undefined)?.flagged), raw };
}

/** The human-limited flawless player's log on a level's seed (imported lazily: the deal file and --check need no bots). */
export async function breakerProofLog(seed: number, level: Level): Promise<ArcadeInputEvent[]> {
  const { Human, HUMAN_LIMITS } = await import("./arcade-skill-bands/human");
  const { bot } = await import("./arcade-skill-bands/bots/breaker");
  const out = bot({ game: breakerGameFor(BRK_REV_LADDER, level), seed, rev: BRK_REV_LADDER, human: new Human("breaker", seed, "perfect", HUMAN_LIMITS), fixes: true });
  return (out.events ?? []) as ArcadeInputEvent[];
}

export function breakerDealSource(sets: readonly BrkLevelWitnesses[]): string {
  const by = (l: Level) => sets.find((s) => s.level === l)!;
  const line = (l: Level) => `  ${l}: [${by(l).witnesses.map((w) => w.seed).join(",")}],`;
  const counts = BRK_DEAL_LEVELS.map((l) => `${l} ${by(l).witnesses.length} of ${by(l).tried}`).join(", ");
  return `/**
 * Breaker's brkRev 13 deals (D5's ladder, 23 Nov 2026; built by \`bun scripts/breaker-level-deal.ts\`, do not edit): for
 * each level, the seeds whose stored witness (scripts/fixtures/breaker-level-deal-witness.json.gz), the flawless player held
 * to the human limits, scores exactly 200 through the server's grade on that level's wall. Kept of the candidates tried:
 * ${counts}.
 */
import type { Level } from "@/lib/levels/levels";

export const BREAKER_LEVEL_DEALS: Readonly<Record<Level, readonly number[]>> = {
${BRK_DEAL_LEVELS.map(line).join("\n")}
};

/** The seed a room seed deals on brkRev 13 at a level (Normal when none is asked). */
export function breakerLevelDealSeed(level: Level | null | undefined, roomSeed: number): number {
  const deal = BREAKER_LEVEL_DEALS[level ?? "normal"] ?? BREAKER_LEVEL_DEALS.normal;
  const n = deal.length;
  return deal[((Math.trunc(roomSeed) % n) + n) % n]!;
}
`;
}

export function readBreakerWitnesses(): BrkLevelWitnesses[] {
  return JSON.parse(gunzipSync(readFileSync(BRK_DEAL_WITNESS)).toString()) as BrkLevelWitnesses[];
}

/** Replays every stored witness (a `sample` of them a level when given); the levels' seeds, and every one short of 200. */
export function checkBreakerWitnesses(sample?: number): { sets: BrkLevelWitnesses[]; bad: string[]; replayed: number } {
  const sets = readBreakerWitnesses();
  const bad: string[] = [];
  let replayed = 0;
  for (const set of sets) {
    const list = sample ? set.witnesses.filter((_, i) => i % Math.max(1, Math.floor(set.witnesses.length / sample)) === 0).slice(0, sample) : set.witnesses;
    for (const w of list) {
      const p = proveBreakerWitness(w.seed, set.level, w.events);
      replayed++;
      if (p.score !== 200 || p.flagged) bad.push(`${set.level} ${w.seed}: ${p.flagged ? "flagged" : p.score}`);
    }
  }
  return { sets, bad, replayed };
}

if (import.meta.main) {
  if (process.argv.includes("--check")) {
    const { sets, bad, replayed } = checkBreakerWitnesses();
    const same = readFileSync(BRK_DEAL_FILE, "utf8") === breakerDealSource(sets);
    console.log(`${replayed} witnesses replayed, ${bad.length} failing; ${BRK_DEAL_FILE} ${same ? "identical" : "DIFFERS"}`);
    for (const b of bad.slice(0, 20)) console.log(`  ${b}`);
    process.exit(bad.length || !same ? 1 : 0);
  }
  const only = process.argv.slice(2).filter((a) => !a.startsWith("--")) as Level[];
  const old = existsSync(BRK_DEAL_WITNESS) ? readBreakerWitnesses() : [];
  const { GAME_BY_TYPE } = await import("./arcade-skill-bands/games");
  const spec = GAME_BY_TYPE.get("breaker")!;
  const sets: BrkLevelWitnesses[] = [];
  for (const level of BRK_DEAL_LEVELS) {
    const keep = old.find((s) => s.level === level);
    if (only.length && !only.includes(level) && keep) {
      sets.push(keep);
      continue;
    }
    const set: BrkLevelWitnesses = { level, tried: 0, witnesses: [] };
    for (let n = 0; n < BRK_DEAL_MAX_CANDIDATES && set.witnesses.length < BRK_DEAL_KEEP; n++) {
      set.tried = n + 1;
      const seed = spec.seedFor(n);
      const events = await breakerProofLog(seed, level);
      const p = proveBreakerWitness(seed, level, events);
      if (p.score === 200 && !p.flagged) set.witnesses.push({ n, seed, events });
    }
    console.log(`${level}: kept ${set.witnesses.length} of ${set.tried}`);
    sets.push(set);
  }
  writeFileSync(BRK_DEAL_WITNESS, gzipSync(JSON.stringify(sets), { level: 9 }));
  writeFileSync(BRK_DEAL_FILE, breakerDealSource(sets));
  console.log(`wrote ${BRK_DEAL_FILE} and ${BRK_DEAL_WITNESS}`);
}
