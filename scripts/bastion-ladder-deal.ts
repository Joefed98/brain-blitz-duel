/**
 * Iron Wall's bastionRev 5 deal (D5's ladder, 23 Nov 2026; docs/arcade-standard/bastion.md "Levels (D5, 23 Nov 2026)"):
 * writes src/lib/duel/bastionDealV5.server.ts, the seeds rooms and practice deal on bastionRev 5, one list a level.
 *
 * The D5 proof standard: a seed is dealt at a level only when the paced oracle (scripts/bastion-ladder-oracle.ts: the
 * flawless planner held to Joe's human limits, 0.25 s to react and 0.15 s to move) scores exactly 200 on it at that level
 * through the server replay (`replayBastionTankRun`, the call `gradeAnswer` makes), unflagged. Candidates are the
 * skill-band room seeds (scripts/arcade-skill-bands/games.ts `roomSeed`, n = 0, 1, 2…), in order, until KEEP seeds a
 * level are kept. The oracle is deterministic, so the proof is its replay: no witness file.
 *
 *   bun scripts/bastion-ladder-deal.ts            (writes the deal file)
 *   bun scripts/bastion-ladder-deal.ts --check    (re-plays every candidate at every level and rebuilds the file in memory;
 *                                                  fails unless every kept seed scores 200 and the file is identical)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { bastionTankCheckpoint, bastionTankGameFor, BASTION_LADDER_LEVELS, BASTION_REV_LADDER, BT2_CHECKPOINT_INTERVAL, type BastionLadderLevel } from "../src/lib/arcade/bastionTank";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { encodeBastionTankRun, replayBastionTankRun } from "../src/lib/duel/bastion";
import { bastionPacedRun } from "./bastion-ladder-oracle";

/** The skill-band room seed n (scripts/arcade-skill-bands/games.ts `roomSeed`, the same hash). */
export function roomSeed(n: number): number {
  let x = (n + 1) * 0x9e3779b1;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  x ^= x >>> 16;
  return ((x >>> 0) % 0x7ffffffe) + 1;
}

export const BASTION_DEAL_FILE = "src/lib/duel/bastionDealV5.server.ts";
export const BASTION_DEAL_KEEP = 150;
/** At most this many candidates a level. */
export const BASTION_DEAL_TRIES = 400;

/** The phone's encoding of a log played on a bastionRev 5 level, and the server's replay of it. */
export function proveBastionRun(seed: number, level: BastionLadderLevel, events: readonly ArcadeInputEvent[]): { score: number; flagged: boolean; raw: string } {
  const game = bastionTankGameFor(BASTION_REV_LADDER, level);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  const checkpoints: ReturnType<typeof bastionTankCheckpoint>[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % BT2_CHECKPOINT_INTERVAL === 0) checkpoints.push(bastionTankCheckpoint(s));
  }
  const raw = encodeBastionTankRun({ seed, claimedScore: game.score(s), events: [...events], endTick: s.tick, checkpoints });
  const r = replayBastionTankRun(seed, raw, BASTION_REV_LADDER, level);
  return { score: r.score, flagged: Boolean(r.flagged), raw };
}

/** Does the paced oracle take this seed to exactly 200 at this level through the server replay? */
export function bastionSeedProved(seed: number, level: BastionLadderLevel): boolean {
  const p = proveBastionRun(seed, level, bastionPacedRun(seed, level));
  return p.score === 200 && !p.flagged;
}

export interface BastionDealList {
  kept: number[];
  tried: number;
}

/** One level's list: candidates in order until KEEP are proved. */
export function buildBastionDealLevel(level: BastionLadderLevel, keep = BASTION_DEAL_KEEP): BastionDealList {
  const kept: number[] = [];
  let tried = 0;
  for (let n = 0; n < BASTION_DEAL_TRIES && kept.length < keep; n++) {
    tried += 1;
    const seed = roomSeed(n);
    if (bastionSeedProved(seed, level)) kept.push(seed);
  }
  return { kept, tried };
}

export function bastionDealSource(lists: Record<BastionLadderLevel, BastionDealList>): string {
  const body = BASTION_LADDER_LEVELS.map((l) => `  ${l}: [${lists[l].kept.join(",")}],`).join("\n");
  const note = BASTION_LADDER_LEVELS.map((l) => `${l} ${lists[l].kept.length} of ${lists[l].tried}`).join(", ");
  return `/**
 * Iron Wall's deal (bastionRev 5, D5's ladder; built by \`bun scripts/bastion-ladder-deal.ts\`, do not edit): each
 * level's seeds, every one taken to exactly 200 at that level through the server replay by the paced oracle
 * (scripts/bastion-ladder-oracle.ts: the flawless planner held to the human limits, 0.25 s to react and 0.15 s to
 * move). Kept of the candidates tried: ${note}.
 */
import type { BastionLadderLevel } from "@/lib/arcade/bastionTank";

export const BASTION_DEAL_V5: Readonly<Record<BastionLadderLevel, readonly number[]>> = {
${body}
};

/** The seed a room seed deals on bastionRev 5 at a level. */
export function bastionDealSeedV5(roomSeed: number, level: BastionLadderLevel): number {
  const list = BASTION_DEAL_V5[level];
  const n = list.length;
  return list[((Math.trunc(roomSeed) % n) + n) % n]!;
}
`;
}

export function buildBastionDeal(): Record<BastionLadderLevel, BastionDealList> {
  return Object.fromEntries(BASTION_LADDER_LEVELS.map((l) => [l, buildBastionDealLevel(l)])) as Record<BastionLadderLevel, BastionDealList>;
}

if (import.meta.main) {
  const t0 = Date.now();
  const lists = buildBastionDeal();
  const src = bastionDealSource(lists);
  const note = BASTION_LADDER_LEVELS.map((l) => `${l} ${lists[l].kept.length}/${lists[l].tried}`).join(", ");
  if (process.argv.includes("--check")) {
    const same = readFileSync(BASTION_DEAL_FILE, "utf8") === src;
    const full = BASTION_LADDER_LEVELS.every((l) => lists[l].kept.length === BASTION_DEAL_KEEP);
    console.log(`${note}; ${BASTION_DEAL_FILE} ${same ? "identical" : "DIFFERS"} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    process.exit(same && full ? 0 : 1);
  }
  writeFileSync(BASTION_DEAL_FILE, src);
  console.log(`wrote ${BASTION_DEAL_FILE}: ${note} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
