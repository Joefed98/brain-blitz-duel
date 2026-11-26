/**
 * Pinball's pinRev 9 deals (D5's ladder, 23 Nov 2026; docs/arcade-standard/pinball.md "Levels (D5, 23 Nov 2026)"):
 * writes src/lib/duel/pinballLevelDeals.server.ts, the seeds rooms deal at each level (Normal, Easy, Hard, Expert), and
 * the witnesses that prove them, scripts/fixtures/pinball-level-witness.json.gz.
 *
 * The table is fixed; the seed sets only the skill shot's flashing lane each launch (p4SkillLane), so each level keeps
 * its own list of seeds. The D5 proof standard: a seed is dealt at a level only when the skill-band tool's flawless player
 * HELD TO THE HUMAN LIMITS (`new Human("pinball", seed, "perfect", HUMAN_LIMITS)`, about 0.25 s to react and 0.15 s to
 * move, with the Oct 2026 fixes; the D5 ladder's `proof`) scores exactly 200 on it through the server's grade (gradeAnswer
 * on the dealt puzzle), unflagged, with that level's flippers, gravity and balls. Candidates are the skill-band room seeds
 * n = 0, 1, 2… in order, until KEEP seeds are kept or the candidates run out.
 *
 *   bun scripts/pinball-level-witness.ts [levels…]   (writes both files; levels not named keep their stored witnesses)
 *   bun scripts/pinball-level-witness.ts --check     (replays every stored witness through the server's grade and rebuilds
 *                                                     the deal file in memory; fails unless every witness scores 200 and
 *                                                     the file is identical)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { PIN_CHECKPOINT_INTERVAL, PIN_REV_LADDER, type PinState } from "../src/lib/arcade/pinball";
import { pinballGameForAny, pinCheckpointAny } from "../src/lib/arcade/pinball4";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { encodePinballRun } from "../src/lib/duel/pinball";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import type { PuzzleData } from "../src/lib/duel/types";
import type { Level } from "../src/lib/levels/levels";

export const PIN_DEAL_FILE = "src/lib/duel/pinballLevelDeals.server.ts";
export const PIN_DEAL_WITNESS = "scripts/fixtures/pinball-level-witness.json.gz";
export const PIN_DEAL_LEVELS: readonly Level[] = ["normal", "easy", "hard", "expert"];
export const PIN_DEAL_KEEP = 60;
export const PIN_DEAL_MAX_CANDIDATES = 600;

export interface PinLevelWitnesses {
  level: Level;
  /** Candidates tried (the room seeds n = 0 … tried − 1). */
  tried: number;
  witnesses: { n: number; seed: number; events: ArcadeInputEvent[] }[];
}

/** The puzzle a level deals on a seed (the deal stamps `level` only off Normal). */
export function pinballDealPuzzle(seed: number, level: Level): PuzzleData {
  return { type: "pinball", seed, pinRev: PIN_REV_LADDER, ...(level !== "normal" ? { level } : {}) } as unknown as PuzzleData;
}

/** The phone's encoding of a log on a level's game, graded by the server. */
export function provePinballWitness(seed: number, level: Level, events: readonly ArcadeInputEvent[]): { score: number; flagged: boolean; raw: string } {
  const game = pinballGameForAny(PIN_REV_LADDER, level);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed) as PinState;
  const checkpoints: ReturnType<typeof pinCheckpointAny>[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, at.get(s.tick + 1) ?? null) as PinState;
    if (s.tick % PIN_CHECKPOINT_INTERVAL === 0) checkpoints.push(pinCheckpointAny(s));
  }
  const raw = encodePinballRun({ seed, claimedScore: game.score(s), events: [...events], endTick: s.tick, checkpoints });
  const g = gradeAnswer(pinballDealPuzzle(seed, level), raw, 0);
  return { score: g.score, flagged: Boolean((g.extra as { flagged?: boolean } | undefined)?.flagged), raw };
}

/** The human-limited flawless player's log on a level's seed (imported lazily: the deal file and --check need no bots). */
export async function pinballProofLog(seed: number, level: Level): Promise<ArcadeInputEvent[]> {
  const { Human, HUMAN_LIMITS } = await import("./arcade-skill-bands/human");
  const { bot } = await import("./arcade-skill-bands/bots/pinball");
  const out = bot({ game: pinballGameForAny(PIN_REV_LADDER, level), seed, rev: PIN_REV_LADDER, human: new Human("pinball", seed, "perfect", HUMAN_LIMITS), fixes: true });
  return (out.events ?? []) as ArcadeInputEvent[];
}

export function pinballDealSource(sets: readonly PinLevelWitnesses[]): string {
  const by = (l: Level) => sets.find((s) => s.level === l)!;
  const line = (l: Level) => `  ${l}: [${by(l).witnesses.map((w) => w.seed).join(",")}],`;
  const counts = PIN_DEAL_LEVELS.map((l) => `${l} ${by(l).witnesses.length} of ${by(l).tried}`).join(", ");
  return `/**
 * Pinball's pinRev 9 deals (D5's ladder, 23 Nov 2026; built by \`bun scripts/pinball-level-witness.ts\`, do not edit): for
 * each level, the seeds (the skill shot's lanes) whose stored witness (scripts/fixtures/pinball-level-witness.json.gz), the
 * flawless player held to the human limits, scores exactly 200 through the server's grade with that level's flippers,
 * gravity and balls. Kept of the candidates tried: ${counts}.
 */
import type { Level } from "@/lib/levels/levels";

export const PINBALL_LEVEL_DEALS: Readonly<Record<Level, readonly number[]>> = {
${PIN_DEAL_LEVELS.map(line).join("\n")}
};

/** The seed a room seed deals on pinRev 9 at a level (Normal when none is asked). */
export function pinballLevelDealSeed(level: Level | null | undefined, roomSeed: number): number {
  const deal = PINBALL_LEVEL_DEALS[level ?? "normal"] ?? PINBALL_LEVEL_DEALS.normal;
  const n = deal.length;
  return deal[((Math.trunc(roomSeed) % n) + n) % n]!;
}
`;
}

export function readPinballWitnesses(): PinLevelWitnesses[] {
  return JSON.parse(gunzipSync(readFileSync(PIN_DEAL_WITNESS)).toString()) as PinLevelWitnesses[];
}

/** Replays every stored witness (a `sample` of them a level when given); the levels' seeds, and every one short of 200. */
export function checkPinballWitnesses(sample?: number): { sets: PinLevelWitnesses[]; bad: string[]; replayed: number } {
  const sets = readPinballWitnesses();
  const bad: string[] = [];
  let replayed = 0;
  for (const set of sets) {
    const list = sample ? set.witnesses.filter((_, i) => i % Math.max(1, Math.floor(set.witnesses.length / sample)) === 0).slice(0, sample) : set.witnesses;
    for (const w of list) {
      const p = provePinballWitness(w.seed, set.level, w.events);
      replayed++;
      if (p.score !== 200 || p.flagged) bad.push(`${set.level} ${w.seed}: ${p.flagged ? "flagged" : p.score}`);
    }
  }
  return { sets, bad, replayed };
}

if (import.meta.main) {
  if (process.argv.includes("--check")) {
    const { sets, bad, replayed } = checkPinballWitnesses();
    const same = readFileSync(PIN_DEAL_FILE, "utf8") === pinballDealSource(sets);
    console.log(`${replayed} witnesses replayed, ${bad.length} failing; ${PIN_DEAL_FILE} ${same ? "identical" : "DIFFERS"}`);
    for (const b of bad.slice(0, 20)) console.log(`  ${b}`);
    process.exit(bad.length || !same ? 1 : 0);
  }
  const only = process.argv.slice(2).filter((a) => !a.startsWith("--")) as Level[];
  const old = existsSync(PIN_DEAL_WITNESS) ? readPinballWitnesses() : [];
  const { GAME_BY_TYPE } = await import("./arcade-skill-bands/games");
  const spec = GAME_BY_TYPE.get("pinball")!;
  const sets: PinLevelWitnesses[] = [];
  for (const level of PIN_DEAL_LEVELS) {
    const keep = old.find((s) => s.level === level);
    if (only.length && !only.includes(level) && keep) {
      sets.push(keep);
      continue;
    }
    const set: PinLevelWitnesses = { level, tried: 0, witnesses: [] };
    for (let n = 0; n < PIN_DEAL_MAX_CANDIDATES && set.witnesses.length < PIN_DEAL_KEEP; n++) {
      set.tried = n + 1;
      const seed = spec.seedFor(n);
      const events = await pinballProofLog(seed, level);
      const p = provePinballWitness(seed, level, events);
      if (p.score === 200 && !p.flagged) set.witnesses.push({ n, seed, events });
    }
    console.log(`${level}: kept ${set.witnesses.length} of ${set.tried}`);
    sets.push(set);
  }
  writeFileSync(PIN_DEAL_WITNESS, gzipSync(JSON.stringify(sets), { level: 9 }));
  writeFileSync(PIN_DEAL_FILE, pinballDealSource(sets));
  console.log(`wrote ${PIN_DEAL_FILE} and ${PIN_DEAL_WITNESS}`);
}
