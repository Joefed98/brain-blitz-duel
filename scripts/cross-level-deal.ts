/**
 * Spacewalk's crossRev 14 deal (D5, 23 Nov 2026; docs/arcade-standard/cross.md "Levels (D5, 23 Nov 2026)"): writes
 * src/lib/duel/crossLevelDeals.server.ts, the seeds rooms deal on crossRev 14 at Easy, Hard and Expert, and the witnesses
 * that prove them, scripts/fixtures/cross-level-deal-witness.json.gz. Normal stays crossRev 13, dealt as before.
 *
 * The D5 proof standard: a seed is dealt at a level only when (1) every crossing is proved passable at exactly the
 * level's density (crossDenseCrossingsProved: crossRev 10's proofs, crossFairPassable on the first two; a seed whose
 * crossing cannot be proved is DROPPED, never thinned) and (2) the proof walker, the skill-band tool's flawless walker
 * held to the human limits (`new Human("cross", seed, "perfect", HUMAN_LIMITS)`: about 0.25 s to react, 0.15 s to move;
 * its swipes at least 10 ticks apart, so every hop starts at least 0.15 s after the last), scores exactly 200 through the
 * server replay (replayCrossRun on the level's game), unflagged. Candidates are the skill-band room seeds n = 0, 1, 2…
 * (the tuning seeds first, then the fresh ones from 10000), in order, until CROSS_DEAL_KEEP are kept.
 *
 *   bun scripts/cross-level-deal.ts [--level=<easy|hard|expert>…] [--keep=n]   (proves those levels, keeps the others)
 *   bun scripts/cross-level-deal.ts --check [--replay=<n>]                       (replays every stored witness, re-proves
 *       every kept seed's crossings and rebuilds the deal file in memory; --replay=n also re-plays the proof walker on n
 *       seeds a level and fails unless it walks exactly the stored witness)
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { CROSS_CHECKPOINT_INTERVAL, CROSS_REV_DENSE, crossCheckpoint, crossDenseCrossingsProved, crossGameFor, type CrossState } from "../src/lib/arcade/cross";
import { CROSS_LEVELS_V14 } from "../src/lib/arcade/retroLevels";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { encodeCrossRun, replayCrossRun } from "../src/lib/duel/cross";
import type { Level } from "../src/lib/levels/levels";
import { roomSeed } from "./arcade-skill-bands/games";

export const CROSS_DEAL_FILE = "src/lib/duel/crossLevelDeals.server.ts";
export const CROSS_DEAL_WITNESS = "scripts/fixtures/cross-level-deal-witness.json.gz";
export type CrossDealLevel = "easy" | "hard" | "expert";
export const CROSS_DEAL_LEVELS: readonly CrossDealLevel[] = ["easy", "hard", "expert"];
export const CROSS_DEAL_KEEP = 100;
export const CROSS_DEAL_CANDIDATES: readonly number[] = [...Array.from({ length: 60 }, (_, i) => i), ...Array.from({ length: 2000 }, (_, i) => 10000 + i)];

export interface CrossWitness {
  seed: number;
  n: number;
  events: ArcadeInputEvent[];
}
export interface CrossDealWitnesses {
  levels: Partial<Record<CrossDealLevel, { tried: number; unproved: number; witnesses: CrossWitness[] }>>;
}

/** The phone's encoding of a log played on a level's crossRev 14 game, and the server's replay of it. */
export function proveCrossWitness(seed: number, level: Level, events: readonly ArcadeInputEvent[]): { score: number; flagged: boolean; raw: string; state: CrossState } {
  const game = crossGameFor(CROSS_REV_DENSE, level);
  const byTick = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed) as CrossState;
  const checkpoints = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null) as CrossState;
    if (s.tick % CROSS_CHECKPOINT_INTERVAL === 0) checkpoints.push(crossCheckpoint(s));
  }
  const raw = encodeCrossRun({ seed, claimedScore: game.score(s), events: [...events], endTick: s.tick, checkpoints } as never);
  const r = replayCrossRun(seed, raw, CROSS_REV_DENSE, level);
  return { score: r.score, flagged: Boolean(r.flagged), raw, state: r.state };
}

/** The proof walker's log on a seed at a level (imported lazily: the deal file and --check's replay need no bot). */
export async function proofEventsAt(seed: number, level: Level): Promise<ArcadeInputEvent[]> {
  const { Human, HUMAN_LIMITS } = await import("./arcade-skill-bands/human");
  const { bot } = await import("./arcade-skill-bands/bots/cross");
  const out = bot({ game: crossGameFor(CROSS_REV_DENSE, level), seed, rev: CROSS_REV_DENSE, human: new Human("cross", seed, "perfect", HUMAN_LIMITS), fixes: true } as never);
  return (out.events ?? []) as ArcadeInputEvent[];
}

export function crossDealSource(w: CrossDealWitnesses): string {
  const counts = CROSS_DEAL_LEVELS.map((l) => `${l} ${w.levels[l]?.witnesses.length ?? 0} of ${w.levels[l]?.tried ?? 0} (${w.levels[l]?.unproved ?? 0} with a crossing not proved)`).join(", ");
  return `/**
 * Spacewalk's level deal on crossRev 14 (D5, 23 Nov 2026; built by \`bun scripts/cross-level-deal.ts\`, do not edit): per
 * level, the seeds rooms deal, each with every crossing proved passable at the level's density and a stored witness
 * (scripts/fixtures/cross-level-deal-witness.json.gz), the flawless walker held to the human limits, that scores exactly
 * 200 through the server replay at that level. Kept of the candidates tried: ${counts}. Normal is crossRev 13, dealt as before.
 */
export const CROSS_LEVEL_DEALS: Readonly<Record<"easy" | "hard" | "expert", readonly number[]>> = {
${CROSS_DEAL_LEVELS.map((l) => `  ${l}: [${(w.levels[l]?.witnesses ?? []).map((x) => x.seed).join(",")}],`).join("\n")}
};

/** The seed a room seed deals on crossRev 14 at a level. */
export function crossLevelDealSeed(level: "easy" | "hard" | "expert", roomSeed: number): number {
  const list = CROSS_LEVEL_DEALS[level];
  const n = list.length;
  if (!n) return Math.trunc(roomSeed);
  return list[((Math.trunc(roomSeed) % n) + n) % n]!;
}
`;
}

export function readCrossWitnesses(): CrossDealWitnesses {
  if (!existsSync(CROSS_DEAL_WITNESS)) return { levels: {} };
  return JSON.parse(gunzipSync(readFileSync(CROSS_DEAL_WITNESS)).toString()) as CrossDealWitnesses;
}

/** Replays the stored witnesses (and re-proves their crossings); the failures. */
export function checkCrossWitnesses(w: CrossDealWitnesses, only?: (level: CrossDealLevel, i: number) => boolean): string[] {
  const bad: string[] = [];
  for (const level of CROSS_DEAL_LEVELS) {
    (w.levels[level]?.witnesses ?? []).forEach((x, i) => {
      if (only && !only(level, i)) return;
      if (!crossDenseCrossingsProved(x.seed, CROSS_LEVELS_V14[level])) bad.push(`${level} ${x.seed}: a crossing is not proved at the level's density`);
      const p = proveCrossWitness(x.seed, level, x.events);
      if (p.score !== 200 || p.flagged) bad.push(`${level} ${x.seed}: ${p.flagged ? "flagged" : p.score}`);
    });
  }
  return bad;
}

interface CampaignRow {
  n: number;
  seed: number;
  proved: boolean;
  events: ArcadeInputEvent[];
  /** The ladder players' raw counts on the seed (scripts/cross-level-tune.ts), for tuning. */
  raws: unknown[];
}
export const crossCampaignFile = (level: CrossDealLevel) => `.shots/cross-campaign-${level}.jsonl`;

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const w = readCrossWitnesses();
  if (args.includes("--check")) {
    const bad = checkCrossWitnesses(w);
    const same = readFileSync(CROSS_DEAL_FILE, "utf8") === crossDealSource(w);
    const replay = Number(opt("replay") ?? 0);
    for (const level of CROSS_DEAL_LEVELS) {
      const list = w.levels[level]?.witnesses ?? [];
      for (let k = 0; k < Math.min(replay, list.length); k++) {
        const x = list[Math.floor(((k + 0.5) * list.length) / replay)]!;
        if (JSON.stringify(await proofEventsAt(x.seed, level)) !== JSON.stringify(x.events)) bad.push(`${level} ${x.seed}: the proof walker no longer walks the witness`);
      }
    }
    console.log(`${CROSS_DEAL_LEVELS.map((l) => `${l} ${w.levels[l]?.witnesses.length ?? 0}`).join(", ")} witnessed seeds, ${bad.length} failing; ${CROSS_DEAL_FILE} ${same ? "identical" : "DIFFERS"}`);
    for (const b of bad.slice(0, 20)) console.log(`  ${b}`);
    process.exit(bad.length || !same ? 1 : 0);
  } else if (args[0] === "campaign") {
    // The proof walker (and the ladder's average and elite players, for tuning) on candidates [from, to), each run's log
    // and raw counts appended to .shots/cross-campaign-<level>.jsonl (not committed).
    const level = (opt("level") ?? "easy") as CrossDealLevel;
    const from = Number(opt("from") ?? 0);
    const to = Number(opt("to") ?? 200);
    const { playCross, rawOf } = await import("./cross-level-tune");
    const lv = CROSS_LEVELS_V14[level];
    const game = crossGameFor(CROSS_REV_DENSE, level);
    for (const n of CROSS_DEAL_CANDIDATES.slice(from, to)) {
      const seed = roomSeed(n);
      const proved = crossDenseCrossingsProved(seed, lv);
      if (!proved) {
        // Never dealt: no runs played on it.
        appendFileSync(crossCampaignFile(level), JSON.stringify({ n, seed, proved, events: [], raws: [] } satisfies CampaignRow) + "\n");
        console.log(`${level} #${n}: NOT proved`);
        continue;
      }
      const events = await proofEventsAt(seed, level);
      const p = proveCrossWitness(seed, level, events);
      const raws: unknown[] = [rawOf(level, "proof", n, seed, proved, p.state)];
      for (const bot of ["average", "elite"]) {
        const { state } = await playCross(game, seed, bot, CROSS_REV_DENSE);
        raws.push(rawOf(level, bot, n, seed, proved, state));
      }
      appendFileSync(crossCampaignFile(level), JSON.stringify({ n, seed, proved, events, raws } satisfies CampaignRow) + "\n");
      console.log(`${level} #${n}: ${proved ? "proved" : "NOT proved"}, proof ${p.score}${p.flagged ? " flagged" : ""}`);
    }
  } else if (args[0] === "build") {
    // Replays each candidate's proof log on today's level game in candidate order and keeps the first `keep` whose
    // crossings are all proved and whose log scores exactly 200.
    const keep = Number(opt("keep") ?? CROSS_DEAL_KEEP);
    for (const level of CROSS_DEAL_LEVELS) {
      if (!existsSync(crossCampaignFile(level))) continue;
      const rows = readFileSync(crossCampaignFile(level), "utf8").trim().split("\n").map((l) => JSON.parse(l) as CampaignRow);
      const byN = new Map(rows.map((r) => [r.n, r]));
      const witnesses: CrossWitness[] = [];
      let tried = 0;
      let unproved = 0;
      for (const n of CROSS_DEAL_CANDIDATES) {
        if (witnesses.length >= keep) break;
        const row = byN.get(n);
        if (!row) break;
        tried += 1;
        if (!row.proved) {
          unproved += 1;
          continue;
        }
        const p = proveCrossWitness(row.seed, level, row.events);
        if (p.score === 200 && !p.flagged) witnesses.push({ seed: row.seed, n, events: row.events });
      }
      w.levels[level] = { tried, unproved, witnesses };
      console.log(`${level}: ${witnesses.length} of ${tried} kept (${unproved} with a crossing not proved)`);
    }
    writeFileSync(CROSS_DEAL_WITNESS, gzipSync(JSON.stringify(w)));
    writeFileSync(CROSS_DEAL_FILE, crossDealSource(w));
    console.log(`→ ${CROSS_DEAL_FILE}, ${CROSS_DEAL_WITNESS}`);
  }
}
