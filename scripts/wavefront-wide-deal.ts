/**
 * Wavefront's wavRev 16 deal (the wider formation, D5, 22 Nov 2026; docs/arcade-standard/wavefront.md "wavRev 16"):
 * writes src/lib/duel/wavefrontDealV16.server.ts, the seeds rooms deal on wavRev 16, and the witnesses that prove them,
 * scripts/fixtures/wavefront-wide-deal-witness.json.gz. wavRev 15's deal (scripts/wavefront-big-deal.ts,
 * wavefrontDeal.server.ts) is left exactly as it is.
 *
 * The D5 proof standard: a seed is dealt only when, at every level (Normal, Easy, Hard, Expert; retroLevels.ts's tables on
 * wavRev 16), a witness run scores exactly 200 through the server replay, unflagged, and every witness is played by the
 * skill-band tool's flawless player HELD TO THE HUMAN LIMITS (`new Human("wavefront", seed, "perfect", HUMAN_LIMITS)`,
 * about 0.25 s to react and 0.15 s to move, with the Oct 2026 fixes), its saucer reaction delayed by one of today's
 * jitter ticks (`wavefrontBotOptions.reactJitter`, only ever slower) until one reaches 200. Candidates are the skill-band
 * room seeds n = 0, 1, 2… (tuning first, then fresh from 10000), in order, until KEEP seeds are kept.
 *
 *   bun scripts/wavefront-wide-deal.ts            (writes both files)
 *   bun scripts/wavefront-wide-deal.ts --check    (replays every stored witness and rebuilds the deal file in memory;
 *                                                  fails unless every witness scores 200 and the file is identical)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { wavCheckpoint, wavefrontGameFor, WAV_REV_WIDE, type WavState } from "../src/lib/arcade/wavefront";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { encodeWavefrontRun, replayWavefrontRun } from "../src/lib/duel/wavefront";
import type { Level } from "../src/lib/levels/levels";

export const WAV_WIDE_DEAL_FILE = "src/lib/duel/wavefrontDealV16.server.ts";
export const WAV_WIDE_WITNESS = "scripts/fixtures/wavefront-wide-deal-witness.json.gz";
/** The levels every dealt seed is proved on, the hardest to prove first (wavRev 15's order). */
export const WAV_WIDE_LEVELS: readonly Level[] = ["easy", "expert", "normal", "hard"];
export const WAV_WIDE_KEEP = 100;
/** Today's reaction-jitter variants (scripts/wavefront-big-deal.ts's list). */
export const WAV_WIDE_JITTERS: readonly number[] = [0, 2, 4, 6, 8, 10, 12, 15, 18, 22, 26, 30, 34, 38, 44, 50];
export const WAV_WIDE_CANDIDATES: readonly number[] = [...Array.from({ length: 60 }, (_, i) => i), ...Array.from({ length: 1000 }, (_, i) => 10000 + i)];

export interface WavWideWitness {
  seed: number;
  /** The candidate index (the skill-band room seed n). */
  n: number;
  /** One run a level (WAV_WIDE_LEVELS' order): the jitter that found it and the events the phone would send. */
  runs: { level: Level; jitter: number; events: ArcadeInputEvent[] }[];
}

/** The phone's encoding of a log played on a level's game, and the server's replay of it. */
export function proveWideWitness(seed: number, level: Level, events: readonly ArcadeInputEvent[], rev: number = WAV_REV_WIDE): { score: number; flagged: boolean; state: unknown; raw: string } {
  const game = wavefrontGameFor(rev, level);
  const byTick = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed) as WavState;
  const checkpoints: unknown[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null) as WavState;
    if (s.tick % 300 === 0) checkpoints.push(wavCheckpoint(s));
  }
  const raw = encodeWavefrontRun({ seed, claimedScore: game.score(s), events: [...events], inputs: [], taps: [], endTick: s.tick, checkpoints } as never);
  const r = replayWavefrontRun(seed, raw, rev, level);
  return { score: r.score, flagged: Boolean(r.flagged), state: r.state, raw };
}

export function wavWideDealSource(kept: readonly number[], tried: number): string {
  return `/**
 * Wavefront's deal (wavRev 16, the wider formation; built by \`bun scripts/wavefront-wide-deal.ts\`, do not edit):
 * ${kept.length} seeds, each one with a stored witness (scripts/fixtures/wavefront-wide-deal-witness.json.gz), the flawless
 * player held to the human limits, that scores exactly 200 through the server replay at every level (Normal, Easy, Hard,
 * Expert). ${tried - kept.length} of the ${tried} candidates are left out.
 */
export const WAV_DEAL_V16: readonly number[] = [${kept.join(",")}];

/** The seed a room seed deals on wavRev 16. */
export function wavDealSeedV16(roomSeed: number): number {
  const n = WAV_DEAL_V16.length;
  return WAV_DEAL_V16[((Math.trunc(roomSeed) % n) + n) % n]!;
}
`;
}

export function readWideWitnesses(): { tried: number; witnesses: WavWideWitness[] } {
  return JSON.parse(gunzipSync(readFileSync(WAV_WIDE_WITNESS)).toString()) as { tried: number; witnesses: WavWideWitness[] };
}

/** Replays every stored witness; the kept seeds in order, and every witness that does not score a clean 200. */
export function checkWideWitnesses(): { seeds: number[]; tried: number; bad: string[] } {
  const data = readWideWitnesses();
  const bad: string[] = [];
  for (const w of data.witnesses) {
    if (w.runs.map((r) => r.level).join() !== WAV_WIDE_LEVELS.join()) bad.push(`${w.seed}: levels ${w.runs.map((r) => r.level).join()}`);
    for (const r of w.runs) {
      const p = proveWideWitness(w.seed, r.level, r.events);
      if (p.score !== 200 || p.flagged) bad.push(`${w.seed} ${r.level}: ${p.flagged ? "flagged" : p.score}`);
    }
  }
  return { seeds: data.witnesses.map((w) => w.seed), tried: data.tried, bad };
}

/**
 * The human-limited flawless player's log on a seed at a level with a reaction jitter (the witness search's one try).
 * Imported lazily so the deal file and --check need no bot code.
 */
export async function humanWitnessLog(seed: number, level: Level, jitter: number): Promise<ArcadeInputEvent[]> {
  const { Human, HUMAN_LIMITS } = await import("./arcade-skill-bands/human");
  const mod = await import("./arcade-skill-bands/bots/wavefront");
  mod.wavefrontBotOptions.reactJitter = jitter;
  try {
    const out = mod.bot({ game: wavefrontGameFor(WAV_REV_WIDE, level), seed, rev: WAV_REV_WIDE, human: new Human("wavefront", seed, "perfect", HUMAN_LIMITS), fixes: true } as never);
    return (out.events ?? []) as ArcadeInputEvent[];
  } finally {
    mod.wavefrontBotOptions.reactJitter = 0;
  }
}

if (import.meta.main) {
  if (process.argv.includes("--check")) {
    const { seeds, tried, bad } = checkWideWitnesses();
    const same = readFileSync(WAV_WIDE_DEAL_FILE, "utf8") === wavWideDealSource(seeds, tried);
    console.log(`${seeds.length} witnessed seeds, ${bad.length} failing; ${WAV_WIDE_DEAL_FILE} ${same ? "identical" : "DIFFERS"}`);
    for (const b of bad.slice(0, 20)) console.log(`  ${b}`);
    process.exit(bad.length || !same ? 1 : 0);
  }
  const { GAME_BY_TYPE } = await import("./arcade-skill-bands/games");
  const spec = GAME_BY_TYPE.get("wavefront")!;
  const witnesses: WavWideWitness[] = [];
  const leftOut = new Map<string, number>();
  let tried = 0;
  for (const n of WAV_WIDE_CANDIDATES) {
    if (witnesses.length >= WAV_WIDE_KEEP) break;
    tried += 1;
    const seed = spec.seedFor(n);
    const runs: WavWideWitness["runs"] = [];
    for (const level of WAV_WIDE_LEVELS) {
      let found: { jitter: number; events: ArcadeInputEvent[] } | null = null;
      for (const j of WAV_WIDE_JITTERS) {
        const events = await humanWitnessLog(seed, level, j);
        const p = proveWideWitness(seed, level, events);
        if (p.score === 200 && !p.flagged) {
          found = { jitter: j, events };
          break;
        }
      }
      if (!found) break;
      runs.push({ level, ...found });
    }
    if (runs.length === WAV_WIDE_LEVELS.length) witnesses.push({ seed, n, runs });
    else leftOut.set(WAV_WIDE_LEVELS[runs.length]!, (leftOut.get(WAV_WIDE_LEVELS[runs.length]!) ?? 0) + 1);
    console.log(`#${n} seed ${seed}: ${runs.length === WAV_WIDE_LEVELS.length ? "kept" : `left out (${WAV_WIDE_LEVELS[runs.length]})`} — ${witnesses.length} kept of ${tried}`);
  }
  writeFileSync(WAV_WIDE_WITNESS, gzipSync(JSON.stringify({ tried, witnesses })));
  writeFileSync(WAV_WIDE_DEAL_FILE, wavWideDealSource(witnesses.map((w) => w.seed), tried));
  console.log(`wrote ${WAV_WIDE_DEAL_FILE} (${witnesses.length} of ${tried}) and ${WAV_WIDE_WITNESS}; left out at ${[...leftOut].map(([l, c]) => `${l} ${c}`).join(", ")}`);
}
