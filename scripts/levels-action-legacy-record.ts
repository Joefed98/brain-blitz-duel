/**
 * Records scripts/fixtures/levels-action-legacy.json.gz (the difficulty levels for Roofbound and High Rise, 15 Nov 2026):
 * runs recorded on the tree BEFORE the levels landed, so flip-levels-check and skyline-levels-check prove that Normal
 * (flipRev 13, skylineRev 11) and the older stamps replay, score and checksum exactly as before, and that Normal's deal
 * is byte for byte the same.
 *
 *   bun scripts/levels-action-legacy-record.ts     (recorded once, on de3bec96's tree; never re-record)
 *
 * Each run is the skill-band bot's input log on a room seed, encoded as the phone does and replayed by the server.
 */
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { flipCheckpoint, flipGameFor } from "../src/lib/arcade/flip";
import { skylineCheckpoint, skylineGameFor } from "../src/lib/arcade/skyline";
import { encodeFlipRun, replayFlipRun } from "../src/lib/duel/flip";
import { encodeSkylineRun, replaySkylineRun } from "../src/lib/duel/skyline";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { bot as flipBot } from "./arcade-skill-bands/bots/flip";
import { bot as skylineBot } from "./arcade-skill-bands/bots/skyline";
import { roomSeed } from "./arcade-skill-bands/games";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";

export const LEVELS_ACTION_LEGACY = new URL("./fixtures/levels-action-legacy.json.gz", import.meta.url);

export interface LegacyRun {
  game: "flip" | "skyline";
  rev: number | null;
  level: SkillLevel;
  seed: number;
  raw: string;
  score: number;
  checkpoint: unknown;
}

export interface LegacyFixture {
  runs: LegacyRun[];
  /** Normal deals (JSON) on room seeds 0..23, for each game. */
  deals: Record<string, string[]>;
}

/** The phone's encoding of a bot log (checkpoints every 300 ticks). */
export function encodeLog(type: "flip" | "skyline", rev: number | null, seed: number, out: { events?: unknown[]; taps?: number[] }): string {
  if (type === "flip") {
    const game = flipGameFor(rev);
    let state = game.init(seed);
    const events = (out.events ?? []) as { t: number }[];
    const byTick = new Map(events.map((e) => [e.t, e]));
    const checkpoints: unknown[] = [];
    while (!game.isOver(state) && state.tick < game.runTicks) {
      state = game.step(state, (byTick.get(state.tick + 1) as never) ?? null);
      if (state.tick % 300 === 0) checkpoints.push(flipCheckpoint(state));
    }
    return encodeFlipRun({ seed, claimedScore: game.score(state), events, inputs: [], taps: [], endTick: state.tick, checkpoints } as never);
  }
  const game = skylineGameFor(rev);
  let state = game.init(seed);
  const taps = new Set(out.taps ?? []);
  const checkpoints: unknown[] = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    state = game.step(state, taps.has(state.tick + 1));
    if (state.tick % 300 === 0) checkpoints.push(skylineCheckpoint(state));
  }
  return encodeSkylineRun({ seed, claimedScore: game.score(state), inputs: [...taps].sort((a, b) => a - b), endTick: state.tick, checkpoints } as never);
}

if (import.meta.main) {
  const runs: LegacyRun[] = [];
  const levels: SkillLevel[] = ["weak", "average", "great", "elite"];
  for (const [type, revs] of [["flip", [13, 12, 11, 10]], ["skyline", [11, 10, 9]]] as const) {
    for (const rev of revs) {
      for (const level of levels) {
        for (let n = 0; n < (rev === revs[0] ? 4 : 2); n++) {
          const seed = roomSeed(4400 + n * 7 + (rev ?? 0));
          const human = new Human(type, seed, level);
          const game = type === "flip" ? flipGameFor(rev) : skylineGameFor(rev);
          const out = (type === "flip" ? flipBot : skylineBot)({ game, seed, rev, human, fixes: true } as never);
          const raw = encodeLog(type, rev, seed, out as never);
          const r = type === "flip" ? replayFlipRun(seed, raw, rev) : replaySkylineRun(seed, raw, rev);
          const checkpoint = type === "flip" ? flipCheckpoint(r.state as never) : skylineCheckpoint(r.state as never);
          runs.push({ game: type, rev, level, seed, raw, score: r.score, checkpoint });
        }
      }
    }
  }
  const deals: Record<string, string[]> = {};
  for (const type of ["flip", "skyline"] as const) {
    deals[type] = Array.from({ length: 24 }, (_, n) => {
      const seed = roomSeed(n);
      return JSON.stringify(withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed })));
    });
  }
  writeFileSync(LEVELS_ACTION_LEGACY, gzipSync(JSON.stringify({ runs, deals } satisfies LegacyFixture)));
  console.log(`${runs.length} runs: ${runs.map((r) => `${r.game}${r.rev}/${r.level}=${r.score}`).join(" ")}`);
}
