/**
 * Fission's burstRev 14 deal, a list a level (D5, 23 Nov 2026; docs/arcade-standard/burst.md "Levels (D5, 23 Nov 2026)"):
 * writes src/lib/duel/burstLevelDeals.server.ts, the seeds rooms deal on burstRev 14 at Normal, Easy, Hard and Expert, and
 * the witnesses that prove them, scripts/fixtures/burst-level-deal-witness.json.gz.
 *
 * The D5 proof standard: a seed is dealt at a level only when a witness run scores exactly 200 through the server replay
 * at that level, unflagged, and every witness is played by the skill-band tool's flawless player HELD TO THE HUMAN LIMITS
 * (`new Human("burst", seed, "perfect", limits)` with the Oct 2026 fixes), its limits Joe's (0.25 s to react, 0.15 s to
 * move) or one of a few slower variants (only ever slower: BURST_DEAL_LIMITS), tried in turn until one reaches 200.
 * Candidates are the skill-band room seeds n = 0, 1, 2… (tuning first, then fresh from 10000), in order, until KEEP seeds
 * are kept at that level.
 *
 *   bun scripts/burst-level-deal.ts [--level=easy,…]   (rebuilds the named levels, all four by default; writes both files)
 *   bun scripts/burst-level-deal.ts --check            (replays every stored witness and rebuilds the deal file in memory;
 *                                                       fails unless every witness scores 200 and the file is identical)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { burstCheckpoint, burstGameFor, BURST_CHECKPOINT_INTERVAL, BURST_REV_SMALL, type BurstState } from "../src/lib/arcade/burst";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { encodeBurstRun, replayBurstRun } from "../src/lib/duel/burst";
import type { Level } from "../src/lib/levels/levels";

export const BURST_DEAL_FILE = "src/lib/duel/burstLevelDeals.server.ts";
export const BURST_DEAL_WITNESS = "scripts/fixtures/burst-level-deal-witness.json.gz";
export const BURST_DEAL_LEVELS: readonly Level[] = ["normal", "easy", "hard", "expert"];
export const BURST_DEAL_KEEP = 100;
/** The proof player's limits, Joe's first, then slower variants (reaction ms, move ms): never faster than HUMAN_LIMITS. */
export const BURST_DEAL_LIMITS: readonly (readonly [number, number])[] = [
  [250, 150],
  [267, 150],
  [283, 150],
  [300, 150],
  [250, 167],
  [250, 183],
  [267, 167],
  [317, 150],
  [333, 150],
  [283, 167],
];
export const BURST_DEAL_CANDIDATES: readonly number[] = [...Array.from({ length: 60 }, (_, i) => i), ...Array.from({ length: 4000 }, (_, i) => 10000 + i)];

export interface BurstWitness {
  seed: number;
  n: number;
  /** The index into BURST_DEAL_LIMITS that found it. */
  limits: number;
  events: ArcadeInputEvent[];
}
export type BurstWitnessFile = Record<string, { tried: number; witnesses: BurstWitness[] }>;

/** The phone's encoding of a log played on a level's game, and the server's replay of it. */
export function proveBurstWitness(seed: number, level: Level, events: readonly ArcadeInputEvent[]): { score: number; flagged: boolean; state: BurstState; raw: string } {
  const game = burstGameFor(BURST_REV_SMALL, level);
  const at = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed) as BurstState;
  const checkpoints: unknown[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, at.get(s.tick + 1) ?? null) as BurstState;
    if (s.tick % BURST_CHECKPOINT_INTERVAL === 0) checkpoints.push(burstCheckpoint(s));
  }
  const raw = encodeBurstRun({ seed, claimedScore: game.score(s), events: [...events], endTick: s.tick, checkpoints } as never);
  const r = replayBurstRun(seed, raw, BURST_REV_SMALL, level);
  return { score: r.score, flagged: Boolean(r.flagged), state: r.state, raw };
}

export function burstDealSource(lists: Record<string, { seeds: readonly number[]; tried: number }>): string {
  const lv = (l: string) => lists[l]!;
  return `/**
 * Fission's deal on burstRev 14 (built by \`bun scripts/burst-level-deal.ts\`, do not edit): a list a level, each seed with
 * a stored witness (scripts/fixtures/burst-level-deal-witness.json.gz), the flawless player held to the human limits, that
 * scores exactly 200 through the server replay at that level. Normal: ${lv("normal").seeds.length} of ${lv("normal").tried} candidates; Easy
 * ${lv("easy").seeds.length} of ${lv("easy").tried}; Hard ${lv("hard").seeds.length} of ${lv("hard").tried}; Expert ${lv("expert").seeds.length} of ${lv("expert").tried}.
 */
export const BURST_DEAL_V14: Readonly<Record<"normal" | "easy" | "hard" | "expert", readonly number[]>> = {
  normal: [${lv("normal").seeds.join(",")}],
  easy: [${lv("easy").seeds.join(",")}],
  hard: [${lv("hard").seeds.join(",")}],
  expert: [${lv("expert").seeds.join(",")}],
};

/** The seed a room seed deals on burstRev 14 at a level (Normal's list when the level is Normal or absent). */
export function burstDealSeedV14(roomSeed: number, level?: string | null): number {
  const list = level === "easy" || level === "hard" || level === "expert" ? BURST_DEAL_V14[level] : BURST_DEAL_V14.normal;
  const n = list.length;
  return list[((Math.trunc(roomSeed) % n) + n) % n]!;
}
`;
}

export function readBurstWitnesses(): BurstWitnessFile {
  return JSON.parse(gunzipSync(readFileSync(BURST_DEAL_WITNESS)).toString()) as BurstWitnessFile;
}

/** Replays every stored witness; each level's kept seeds in order, and every witness that does not score a clean 200. */
export function checkBurstWitnesses(): { lists: Record<string, { seeds: number[]; tried: number }>; bad: string[] } {
  const data = readBurstWitnesses();
  const bad: string[] = [];
  const lists: Record<string, { seeds: number[]; tried: number }> = {};
  for (const level of BURST_DEAL_LEVELS) {
    const at = data[level];
    if (!at) {
      bad.push(`${level}: no witnesses`);
      lists[level] = { seeds: [], tried: 0 };
      continue;
    }
    for (const w of at.witnesses) {
      const p = proveBurstWitness(w.seed, level, w.events);
      if (p.score !== 200 || p.flagged) bad.push(`${w.seed} ${level}: ${p.flagged ? "flagged" : p.score}`);
    }
    lists[level] = { seeds: at.witnesses.map((w) => w.seed), tried: at.tried };
  }
  return { lists, bad };
}

/** The human-limited flawless player's log on a seed at a level with one of BURST_DEAL_LIMITS (the search's one try). */
export async function burstWitnessLog(seed: number, level: Level, limits: number): Promise<ArcadeInputEvent[]> {
  const { Human } = await import("./arcade-skill-bands/human");
  const { bot } = await import("./arcade-skill-bands/bots/burst");
  const [reactMs, moveMs] = BURST_DEAL_LIMITS[limits]!;
  const out = bot({ game: burstGameFor(BURST_REV_SMALL, level) as never, seed, rev: BURST_REV_SMALL, human: new Human("burst", seed, "perfect", { reactMs, moveMs }), fixes: true });
  return (out.events ?? []) as ArcadeInputEvent[];
}

if (import.meta.main) {
  if (process.argv.includes("--check")) {
    const { lists, bad } = checkBurstWitnesses();
    const same = readFileSync(BURST_DEAL_FILE, "utf8") === burstDealSource(lists);
    console.log(`${BURST_DEAL_LEVELS.map((l) => `${l} ${lists[l]!.seeds.length}`).join(", ")} witnessed seeds, ${bad.length} failing; ${BURST_DEAL_FILE} ${same ? "identical" : "DIFFERS"}`);
    for (const b of bad.slice(0, 20)) console.log(`  ${b}`);
    process.exit(bad.length || !same ? 1 : 0);
  }
  const only = process.argv.find((a) => a.startsWith("--level="))?.slice(8).split(",") as Level[] | undefined;
  const { GAME_BY_TYPE } = await import("./arcade-skill-bands/games");
  const spec = GAME_BY_TYPE.get("burst")!;
  const data: BurstWitnessFile = existsSync(BURST_DEAL_WITNESS) ? readBurstWitnesses() : {};
  for (const level of only ?? BURST_DEAL_LEVELS) {
    const witnesses: BurstWitness[] = [];
    let tried = 0;
    for (const n of BURST_DEAL_CANDIDATES) {
      if (witnesses.length >= BURST_DEAL_KEEP) break;
      tried += 1;
      const seed = spec.seedFor(n);
      let found: BurstWitness | null = null;
      for (let k = 0; k < BURST_DEAL_LIMITS.length; k++) {
        const events = await burstWitnessLog(seed, level, k);
        const p = proveBurstWitness(seed, level, events);
        if (p.score === 200 && !p.flagged) {
          found = { seed, n, limits: k, events };
          break;
        }
      }
      if (found) witnesses.push(found);
      if (tried % 20 === 0 || found) console.log(`${level} #${n} seed ${seed}: ${found ? `kept (limits ${found.limits})` : "left out"} — ${witnesses.length} kept of ${tried}`);
    }
    data[level] = { tried, witnesses };
    writeFileSync(BURST_DEAL_WITNESS, gzipSync(JSON.stringify(data)));
    console.log(`${level}: ${witnesses.length} of ${tried}`);
  }
  const lists: Record<string, { seeds: number[]; tried: number }> = {};
  for (const level of BURST_DEAL_LEVELS) lists[level] = { seeds: (data[level]?.witnesses ?? []).map((w) => w.seed), tried: data[level]?.tried ?? 0 };
  writeFileSync(BURST_DEAL_FILE, burstDealSource(lists));
  console.log(`wrote ${BURST_DEAL_FILE} and ${BURST_DEAL_WITNESS}: ${BURST_DEAL_LEVELS.map((l) => `${l} ${lists[l]!.seeds.length} of ${lists[l]!.tried}`).join(", ")}`);
}
