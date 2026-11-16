/**
 * Wavefront's deal (wavRev 15, the Retro overhaul's stage 3, 16 Nov 2026; docs/arcade-standard/wavefront.md "wavRev 15"):
 * writes src/lib/duel/wavefrontDeal.server.ts, the seeds rooms deal on wavRev 15, and the witnesses that prove them,
 * scripts/fixtures/wavefront-big-deal-witness.json.gz. With the larger hit cells the flawless player no longer reaches 200
 * on every seed (a bolt meets a ship before a saucer), so a seed is dealt only when, at every level (Normal, Easy, Hard,
 * Expert), a witness run scores exactly 200 through the server replay, unflagged. Each witness is the skill-band tool's
 * flawless player (with the Oct 2026 fixes) on that level's game, its saucer reaction shifted by one of a fixed list of
 * ticks (`wavefrontBotOptions.reactJitter`) until one reaches 200. Candidates are the skill-band room seeds n = 0, 1, 2…
 * (tuning first, then fresh from 10000), in order, until KEEP seeds are kept.
 *
 *   bun scripts/wavefront-big-deal.ts            (writes both files; ~20 min)
 *   bun scripts/wavefront-big-deal.ts --check    (replays every stored witness and rebuilds the deal file in memory;
 *                                                  fails unless every witness scores 200 and the file is identical)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { wavCheckpoint, wavefrontGameFor, WAV_REV_BIG, type WavState } from "../src/lib/arcade/wavefront";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { encodeWavefrontRun, replayWavefrontRun } from "../src/lib/duel/wavefront";
import type { Level } from "../src/lib/levels/levels";

export const WAV_DEAL_FILE = "src/lib/duel/wavefrontDeal.server.ts";
export const WAV_DEAL_WITNESS = "scripts/fixtures/wavefront-big-deal-witness.json.gz";
/** The levels every dealt seed is proved on, the hardest to prove first. */
export const WAV_DEAL_LEVELS: readonly Level[] = ["easy", "expert", "normal", "hard"];
const KEEP = 100;
const JITTERS = [0, 2, 4, 6, 8, 10, 12, 15, 18, 22, 26, 30, 34, 38, 44, 50];
const CANDIDATES = [...Array.from({ length: 60 }, (_, i) => i), ...Array.from({ length: 1000 }, (_, i) => 10000 + i)];

export interface WavWitness {
  seed: number;
  /** One run a level (WAV_DEAL_LEVELS' order): the events the phone would send. */
  runs: { level: Level; events: ArcadeInputEvent[] }[];
}

/** The phone's encoding of a log played on a level's game, and the server's replay of it. */
export function proveWitness(seed: number, level: Level, events: readonly ArcadeInputEvent[]): { score: number; flagged: boolean } {
  const game = wavefrontGameFor(WAV_REV_BIG, level);
  const byTick = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed) as WavState;
  const checkpoints: unknown[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null) as WavState;
    if (s.tick % 300 === 0) checkpoints.push(wavCheckpoint(s));
  }
  const raw = encodeWavefrontRun({ seed, claimedScore: game.score(s), events: [...events], inputs: [], taps: [], endTick: s.tick, checkpoints } as never);
  const r = replayWavefrontRun(seed, raw, WAV_REV_BIG, level);
  return { score: r.score, flagged: Boolean(r.flagged) };
}

export function wavDealSource(kept: readonly number[], tried: number): string {
  return `/**
 * Wavefront's deal (wavRev 15; built by \`bun scripts/wavefront-big-deal.ts\`, do not edit): ${kept.length} seeds, each one
 * with a stored witness (scripts/fixtures/wavefront-big-deal-witness.json.gz) that scores exactly 200 through the server
 * replay at every level (Normal, Easy, Hard, Expert). ${tried - kept.length} of the ${tried} candidates are left out.
 */
export const WAV_DEAL: readonly number[] = [${kept.join(",")}];

/** The seed a room seed deals on wavRev 15. */
export function wavDealSeed(roomSeed: number): number {
  const n = WAV_DEAL.length;
  return WAV_DEAL[((Math.trunc(roomSeed) % n) + n) % n]!;
}
`;
}

/** Replays every stored witness; the kept seeds in order, and every witness that does not score a clean 200. */
export function checkWitnesses(): { seeds: number[]; tried: number; bad: string[] } {
  const data = JSON.parse(gunzipSync(readFileSync(WAV_DEAL_WITNESS)).toString()) as { tried: number; witnesses: WavWitness[] };
  const bad: string[] = [];
  for (const w of data.witnesses) {
    if (w.runs.map((r) => r.level).join() !== WAV_DEAL_LEVELS.join()) bad.push(`${w.seed}: levels ${w.runs.map((r) => r.level).join()}`);
    for (const r of w.runs) {
      const p = proveWitness(w.seed, r.level, r.events);
      if (p.score !== 200 || p.flagged) bad.push(`${w.seed} ${r.level}: ${p.flagged ? "flagged" : p.score}`);
    }
  }
  return { seeds: data.witnesses.map((w) => w.seed), tried: data.tried, bad };
}

if (import.meta.main) {
  if (process.argv.includes("--check")) {
    const { seeds, tried, bad } = checkWitnesses();
    const same = readFileSync(WAV_DEAL_FILE, "utf8") === wavDealSource(seeds, tried);
    console.log(`${seeds.length} witnessed seeds, ${bad.length} failing; ${WAV_DEAL_FILE} ${same ? "identical" : "DIFFERS"}`);
    for (const b of bad.slice(0, 20)) console.log(`  ${b}`);
    process.exit(bad.length || !same ? 1 : 0);
  }
  const { GAME_BY_TYPE } = await import("./arcade-skill-bands/games");
  const { Human } = await import("./arcade-skill-bands/human");
  const mod = await import("./arcade-skill-bands/bots/wavefront");
  const spec = GAME_BY_TYPE.get("wavefront")!;
  const witnesses: WavWitness[] = [];
  let tried = 0;
  for (const n of CANDIDATES) {
    if (witnesses.length >= KEEP) break;
    tried += 1;
    const seed = spec.seedFor(n);
    const runs: WavWitness["runs"] = [];
    for (const level of WAV_DEAL_LEVELS) {
      let found: ArcadeInputEvent[] | null = null;
      for (const j of JITTERS) {
        mod.wavefrontBotOptions.reactJitter = j;
        const out = mod.bot({ game: wavefrontGameFor(WAV_REV_BIG, level), seed, rev: WAV_REV_BIG, human: new Human("wavefront", seed, "perfect"), fixes: true } as never);
        const events = (out.events ?? []) as ArcadeInputEvent[];
        const p = proveWitness(seed, level, events);
        if (p.score === 200 && !p.flagged) {
          found = events;
          break;
        }
      }
      if (!found) break;
      runs.push({ level, events: found });
    }
    mod.wavefrontBotOptions.reactJitter = 0;
    if (runs.length === WAV_DEAL_LEVELS.length) witnesses.push({ seed, runs });
    console.log(`#${n} seed ${seed}: ${runs.length === WAV_DEAL_LEVELS.length ? "kept" : `left out (${WAV_DEAL_LEVELS[runs.length]})`} — ${witnesses.length} kept of ${tried}`);
  }
  writeFileSync(WAV_DEAL_WITNESS, gzipSync(JSON.stringify({ tried, witnesses })));
  writeFileSync(WAV_DEAL_FILE, wavDealSource(witnesses.map((w) => w.seed), tried));
  console.log(`wrote ${WAV_DEAL_FILE} (${witnesses.length} of ${tried}) and ${WAV_DEAL_WITNESS}`);
}
