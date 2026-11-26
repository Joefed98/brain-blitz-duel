/**
 * Wavefront's wavRev 16 deal (the wider formation, D5, 22 Nov 2026; the levels and Normal's scoring folded in on 23 Nov
 * 2026; docs/arcade-standard/wavefront.md "wavRev 16" and "Levels (D5, 23 Nov 2026)"): writes
 * src/lib/duel/wavefrontDealV16.server.ts, the seeds rooms deal on wavRev 16 at each level, and the witnesses that prove
 * them, scripts/fixtures/wavefront-wide-deal-witness.json.gz. wavRev 15's deal (scripts/wavefront-big-deal.ts,
 * wavefrontDeal.server.ts) is left exactly as it is.
 *
 * The D5 proof standard, a list a level: a seed is dealt at a level only when a witness run scores exactly 200 through
 * the server replay at that level, unflagged, and every witness is played by the skill-band tool's flawless player HELD
 * TO THE HUMAN LIMITS (`new Human("wavefront", seed, "perfect", HUMAN_LIMITS)`, about 0.25 s to react and 0.15 s to move,
 * with the Oct 2026 fixes), its saucer reaction delayed by one of the jitter ticks (`wavefrontBotOptions.reactJitter`, only
 * ever slower) until one reaches 200. Candidates are the skill-band room seeds n = 0, 1, 2… (tuning first, then fresh from
 * 10000), in order, until KEEP seeds are kept at that level.
 *
 *   bun scripts/wavefront-wide-deal.ts [--level=easy,…]   (rebuilds the named levels, all four by default; writes both files)
 *   bun scripts/wavefront-wide-deal.ts --check            (replays every stored witness and rebuilds the deal file in memory;
 *                                                          fails unless every witness scores 200 and the file is identical)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { wavCheckpoint, wavefrontGameFor, WAV_REV_WIDE, type WavState } from "../src/lib/arcade/wavefront";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { encodeWavefrontRun, replayWavefrontRun } from "../src/lib/duel/wavefront";
import type { Level } from "../src/lib/levels/levels";

export const WAV_WIDE_DEAL_FILE = "src/lib/duel/wavefrontDealV16.server.ts";
export const WAV_WIDE_WITNESS = "scripts/fixtures/wavefront-wide-deal-witness.json.gz";
/** The levels, each with its own list (Normal's is WAV_DEAL_V16). */
export const WAV_WIDE_LEVELS: readonly Level[] = ["normal", "easy", "hard", "expert"];
export const WAV_WIDE_KEEP = 100;
/** The reaction-jitter variants (scripts/wavefront-big-deal.ts's list). */
export const WAV_WIDE_JITTERS: readonly number[] = [0, 2, 4, 6, 8, 10, 12, 15, 18, 22, 26, 30, 34, 38, 44, 50];
export const WAV_WIDE_CANDIDATES: readonly number[] = [...Array.from({ length: 60 }, (_, i) => i), ...Array.from({ length: 4000 }, (_, i) => 10000 + i)];

export interface WavWideWitness {
  seed: number;
  /** The candidate index (the skill-band room seed n). */
  n: number;
  /** The jitter that found it and the events the phone would send. */
  jitter: number;
  events: ArcadeInputEvent[];
}
export interface WavWideLevelWitnesses {
  /** Candidates tried before KEEP were kept (or the candidates ran out). */
  tried: number;
  witnesses: WavWideWitness[];
}
export type WavWideWitnessFile = Record<string, WavWideLevelWitnesses>;

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

export function wavWideDealSource(lists: Record<string, { seeds: readonly number[]; tried: number }>): string {
  const n = lists["normal"]!;
  const lv = (l: string) => lists[l]!;
  return `/**
 * Wavefront's deal (wavRev 16, the wider formation, with its levels; built by \`bun scripts/wavefront-wide-deal.ts\`, do not
 * edit): a list a level, each seed with a stored witness (scripts/fixtures/wavefront-wide-deal-witness.json.gz), the
 * flawless player held to the human limits, that scores exactly 200 through the server replay at that level. Normal:
 * ${n.seeds.length} of ${n.tried} candidates; Easy ${lv("easy").seeds.length} of ${lv("easy").tried}; Hard ${lv("hard").seeds.length} of ${lv("hard").tried}; Expert ${lv("expert").seeds.length} of ${lv("expert").tried}.
 */
export const WAV_DEAL_V16: readonly number[] = [${n.seeds.join(",")}];

export const WAV_DEAL_V16_LEVELS: Readonly<Record<"easy" | "hard" | "expert", readonly number[]>> = {
  easy: [${lv("easy").seeds.join(",")}],
  hard: [${lv("hard").seeds.join(",")}],
  expert: [${lv("expert").seeds.join(",")}],
};

/** The seed a room seed deals on wavRev 16 at a level (Normal's list when the level is Normal or absent). */
export function wavDealSeedV16(roomSeed: number, level?: string | null): number {
  const list = level === "easy" || level === "hard" || level === "expert" ? WAV_DEAL_V16_LEVELS[level] : WAV_DEAL_V16;
  const n = list.length;
  return list[((Math.trunc(roomSeed) % n) + n) % n]!;
}
`;
}

export function readWideWitnesses(): WavWideWitnessFile {
  return JSON.parse(gunzipSync(readFileSync(WAV_WIDE_WITNESS)).toString()) as WavWideWitnessFile;
}

/** Replays every stored witness; each level's kept seeds in order, and every witness that does not score a clean 200. */
export function checkWideWitnesses(): { lists: Record<string, { seeds: number[]; tried: number }>; bad: string[] } {
  const data = readWideWitnesses();
  const bad: string[] = [];
  const lists: Record<string, { seeds: number[]; tried: number }> = {};
  for (const level of WAV_WIDE_LEVELS) {
    const at = data[level];
    if (!at) {
      bad.push(`${level}: no witnesses`);
      lists[level] = { seeds: [], tried: 0 };
      continue;
    }
    for (const w of at.witnesses) {
      const p = proveWideWitness(w.seed, level, w.events);
      if (p.score !== 200 || p.flagged) bad.push(`${w.seed} ${level}: ${p.flagged ? "flagged" : p.score}`);
    }
    lists[level] = { seeds: at.witnesses.map((w) => w.seed), tried: at.tried };
  }
  return { lists, bad };
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
    const { lists, bad } = checkWideWitnesses();
    const same = readFileSync(WAV_WIDE_DEAL_FILE, "utf8") === wavWideDealSource(lists);
    console.log(`${WAV_WIDE_LEVELS.map((l) => `${l} ${lists[l]!.seeds.length}`).join(", ")} witnessed seeds, ${bad.length} failing; ${WAV_WIDE_DEAL_FILE} ${same ? "identical" : "DIFFERS"}`);
    for (const b of bad.slice(0, 20)) console.log(`  ${b}`);
    process.exit(bad.length || !same ? 1 : 0);
  }
  const only = process.argv.find((a) => a.startsWith("--level="))?.slice(8).split(",") as Level[] | undefined;
  const { GAME_BY_TYPE } = await import("./arcade-skill-bands/games");
  const spec = GAME_BY_TYPE.get("wavefront")!;
  const data: WavWideWitnessFile = existsSync(WAV_WIDE_WITNESS) ? (JSON.parse(gunzipSync(readFileSync(WAV_WIDE_WITNESS)).toString()) as WavWideWitnessFile) : {};
  // A file from before the levels (one witness a seed at every level) is replaced level by level.
  if (Array.isArray((data as unknown as { witnesses?: unknown }).witnesses)) for (const k of Object.keys(data)) delete (data as Record<string, unknown>)[k];
  for (const level of only ?? WAV_WIDE_LEVELS) {
    const witnesses: WavWideWitness[] = [];
    let tried = 0;
    for (const n of WAV_WIDE_CANDIDATES) {
      if (witnesses.length >= WAV_WIDE_KEEP) break;
      tried += 1;
      const seed = spec.seedFor(n);
      let found: WavWideWitness | null = null;
      for (const j of WAV_WIDE_JITTERS) {
        const events = await humanWitnessLog(seed, level, j);
        const p = proveWideWitness(seed, level, events);
        if (p.score === 200 && !p.flagged) {
          found = { seed, n, jitter: j, events };
          break;
        }
      }
      if (found) witnesses.push(found);
      if (tried % 20 === 0 || found) console.log(`${level} #${n} seed ${seed}: ${found ? `kept (jitter ${found.jitter})` : "left out"} — ${witnesses.length} kept of ${tried}`);
    }
    data[level] = { tried, witnesses };
    writeFileSync(WAV_WIDE_WITNESS, gzipSync(JSON.stringify(data)));
    console.log(`${level}: ${witnesses.length} of ${tried}`);
  }
  const lists: Record<string, { seeds: number[]; tried: number }> = {};
  for (const level of WAV_WIDE_LEVELS) lists[level] = { seeds: (data[level]?.witnesses ?? []).map((w) => w.seed), tried: data[level]?.tried ?? 0 };
  writeFileSync(WAV_WIDE_DEAL_FILE, wavWideDealSource(lists));
  console.log(`wrote ${WAV_WIDE_DEAL_FILE} and ${WAV_WIDE_WITNESS}: ${WAV_WIDE_LEVELS.map((l) => `${l} ${lists[l]!.seeds.length} of ${lists[l]!.tried}`).join(", ")}`);
}
