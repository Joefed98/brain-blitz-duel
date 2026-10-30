/**
 * Wavefront on the arcade scoring standard (wavRev 12, 29 Oct 2026; docs/arcade-standard/wavefront.md).
 * Perfect: the flawless skill-band player's recorded 200 runs (scripts/wavefront-std-record.ts) through the server
 * replay, and a built state with every part full. Played: one drag, random drags and a run that loses every life
 * at once, each at least 1. Idle: no input at all, 0. wavefront-phone-check proves the core's full figure (294, the
 * units at the mothership's arrival), the five saucers a run flies and that wavRev 11 logs replay tick for tick.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { ARCADE_INPUT_DRAG, type ArcadeInputEvent } from "../../src/lib/arcade/engine";
import {
  wavCheckpoint,
  wavefrontGameFor,
  WAVEFRONT_STD,
  WAV_REV_PHONE,
  WAV_REV_STD,
  WAV_STD_CORE_FULL,
  WAV_STD_KILL_FULL,
  WAV_X_BOSS_HP,
  WAV_X_MID_HP,
  WAV_X_SAUCERS,
  WAV_WORLD_W,
  type WavState,
} from "../../src/lib/arcade/wavefront";
import { encodeWavefrontRun, replayWavefrontRun } from "../../src/lib/duel/wavefront";
import { roomSeed } from "../arcade-skill-bands/games";
import { randomLog } from "../room-identity/wavefront";
import type { StdEntry, StdRun } from "./entry";

const game = wavefrontGameFor(WAV_REV_STD);

/** A log played on wavRev 12, checkpointed as the phone does, through the server's encode + replay. */
function serverRun(seed: number, events: ArcadeInputEvent[]): number {
  const byTick = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed) as WavState;
  const checkpoints: unknown[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null) as WavState;
    if (s.tick % 300 === 0) checkpoints.push(wavCheckpoint(s));
  }
  const raw = encodeWavefrontRun({ seed, claimedScore: game.score(s), events, inputs: [], taps: [], endTick: s.tick, checkpoints } as never);
  const r = replayWavefrontRun(seed, raw, WAV_REV_STD);
  if (r.flagged) throw new Error(`seed ${seed}: the server replay flagged the run (${r.reason})`);
  return r.score;
}

export const entry: StdEntry = {
  type: "wavefront",
  field: "wavRev",
  rev: WAV_REV_STD,
  before: WAV_REV_PHONE,
  parts: WAVEFRONT_STD.parts,
  spec: WAVEFRONT_STD,
  perfect: (): StdRun[] => {
    const data = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/wavefront-std-runs.json.gz")).toString()) as { runs: { n: number; seed: number; raw: string }[] };
    const runs: StdRun[] = data.runs.map((r) => {
      const res = replayWavefrontRun(r.seed, r.raw, WAV_REV_STD);
      const s = res.state as WavState;
      // A clean replay of a run that took everything: no life lost, all five saucers, all four cannons and both cores.
      const clean = !res.flagged && s.lives === 3 && (s.bossKilled ?? 0) === 1 && s.tick - (s.bossAt ?? 0) <= WAV_STD_KILL_FULL && (s.cannonsDown ?? 0) === 4 && s.coresHit === 3;
      return { label: `flawless bot, room seed #${r.n} (server replay${clean ? "" : ", NOT clean"})`, score: clean ? res.score : -1 };
    });
    // A built state with every part full (the arithmetic, apart from any player): every pre-boss unit, the boss down
    // 10 s after it arrived, five saucers shot, four cannons and both cores, three lives.
    const init = game.init(roomSeed(0)) as WavState;
    const built: WavState = { ...init, acted: 1, shapesDown: 180 - 28, armourHits: 36, wavesCleared: 6, bossDmg: WAV_X_MID_HP + WAV_X_BOSS_HP, bossKilled: 1, midKilled: 1, bossAt: 4000, tick: 4600, saucers: WAV_X_SAUCERS, cannonsDown: 4, coresHit: 3, lives: 3, ended: 1 };
    // (180 − 28 ships: waves 2–5's 28 armour cells are not ships; their 36 hits count instead: 152 + 36 + 6 × 15 + 16 = 294.)
    runs.push({ label: `built state at ${WAV_STD_CORE_FULL} units with every feature`, score: game.score(built) });
    return runs;
  },
  played: (): StdRun[] => {
    const seed = roomSeed(1);
    const one: ArcadeInputEvent[] = [{ t: 1, k: ARCADE_INPUT_DRAG, a: WAV_WORLD_W, b: 0, c: 0, d: 0 }];
    const init = game.init(seed) as WavState;
    return [
      { label: "one drag to the edge, then nothing (server replay)", score: serverRun(seed, one) },
      { label: "random drags (server replay)", score: serverRun(seed, randomLog(seed)) },
      { label: "built: one input, nothing earned, every life lost", score: game.score({ ...init, acted: 1, lives: 0, ended: 2 }) },
    ];
  },
  idle: (): StdRun[] => [
    { label: "no input for the whole run (server replay)", score: serverRun(roomSeed(2), []) },
    { label: "built: a full board but no input", score: game.score({ ...(game.init(roomSeed(2)) as WavState), acted: 0, shapesDown: 100, saucers: 3 }) },
  ],
  help: { terms: ["Ships, hits and waves", "150 at 294", "within 20 s", "4 a saucer", "each life lost costs 5", "Power-ups score nothing"] },
};
