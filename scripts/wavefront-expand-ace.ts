/**
 * A scripted Wavefront wavRev 9 run that proves 200 reachable: a look-ahead player (not a human
 * model) that, every few ticks, tries a spread of ship positions, plays each forward in the real sim and
 * keeps the one that does best (lives first, then the score with the features' edge). Its input log goes
 * through the server's encode + replay; the best run is written for wavefront-expand-check.
 *
 *   bun scripts/wavefront-expand-ace.ts [--seeds=0,1,2] [--write]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { ARCADE_INPUT_DRAG, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { roomSeed } from "./arcade-skill-bands/games";
import { wavCheckpoint, wavefrontGameFor, wavEdgeUnits, WAV_REV_EXPAND, WAV_WORLD_W, type WavState } from "../src/lib/arcade/wavefront";
import { encodeWavefrontRun, replayWavefrontRun } from "../src/lib/duel/wavefront";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = (opt("seeds") ?? "0").split(",").map(Number);
const game = wavefrontGameFor(WAV_REV_EXPAND);
/** Finger speed (px a tick), decision interval and look-ahead (ticks), candidate spacing (px). */
const SPEED = 40;
const EVERY = 4;
const AHEAD = 72;
const SPACING = 6;

function value(s: WavState): number {
  return s.lives * 100_000 + game.score(s) * 200 + (s.bossDmg ?? 0) * 40 + s.shapesDown * 30 + s.armourHits * 30 + wavEdgeUnits(s) * 4 + (s.streak ?? 0) + (s.bossKilled ? 20_000 : 0);
}

function roll(state: WavState, from: number, to: number, ticks: number): WavState {
  let s = state;
  let x = from;
  for (let k = 0; k < ticks && !game.isOver(s); k++) {
    const nx = x + Math.max(-SPEED, Math.min(SPEED, to - x));
    s = game.step(s, nx !== x ? { k: ARCADE_INPUT_DRAG, a: nx, b: 0, c: 0, d: 0 } : null);
    x = nx;
  }
  return s;
}

export function aceRun(seed: number): { raw: string; score: number } {
  let s = game.init(seed) as WavState;
  let x = s.aimX;
  const events: ArcadeInputEvent[] = [];
  const checkpoints: unknown[] = [];
  const push = (nx: number) => {
    const ev = { t: s.tick + 1, k: ARCADE_INPUT_DRAG, a: nx, b: 0, c: 0, d: 0 };
    events.push(ev as ArcadeInputEvent);
    s = game.step(s, ev);
  };
  while (!game.isOver(s) && s.tick < game.runTicks) {
    let bestTo = x;
    let best = -Infinity;
    for (let to = 24; to <= WAV_WORLD_W - 24; to += SPACING) {
      if (Math.abs(to - x) > SPEED * AHEAD) continue;
      const v = value(roll(s, x, to, AHEAD));
      if (v > best || (v === best && Math.abs(to - x) < Math.abs(bestTo - x))) {
        best = v;
        bestTo = to;
      }
    }
    for (let k = 0; k < EVERY && !game.isOver(s); k++) {
      const nx = x + Math.max(-SPEED, Math.min(SPEED, bestTo - x));
      if (nx !== x) push(nx);
      else s = game.step(s, null);
      x = nx;
      if (s.tick % 300 === 0) checkpoints.push(wavCheckpoint(s));
    }
  }
  const raw = encodeWavefrontRun({ seed, claimedScore: game.score(s), events, inputs: [], taps: [], endTick: s.tick, checkpoints } as never);
  return { raw, score: replayWavefrontRun(seed, raw, WAV_REV_EXPAND).score };
}

if (import.meta.main) {
  let best: { seed: number; raw: string; score: number } | null = null;
  for (const n of SEEDS) {
    const seed = roomSeed(n);
    const r = aceRun(seed);
    const st = replayWavefrontRun(seed, r.raw, WAV_REV_EXPAND).state as WavState;
    console.log(`seed #${n} (${seed}): ${r.score} · edge units ${wavEdgeUnits(st)} · streak ${st.bestStreak} · boss ${st.bossKilled ? "down" : "standing"} at ${(st.tick / 60).toFixed(1)} s · lives ${st.lives}`);
    if (!best || r.score > best.score) best = { seed, ...r };
  }
  if (args.includes("--write") && best) {
    const path = "scripts/fixtures/wavefront-expand-runs.json.gz";
    let data: { runs: unknown[]; ace?: unknown } = { runs: [] };
    try {
      data = JSON.parse(gunzipSync(readFileSync(path)).toString());
    } catch {
      /* first write */
    }
    data.ace = best;
    writeFileSync(path, gzipSync(JSON.stringify(data)));
    console.log(`wrote the ${best.score} run to ${path}`);
  }
}
