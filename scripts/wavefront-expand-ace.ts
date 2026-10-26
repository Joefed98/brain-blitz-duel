/**
 * A scripted Wavefront wavRev 10 run that proves 200 reachable: a look-ahead player (not a human
 * model) that, every few ticks, tries a spread of ship positions, plays each forward in the real sim and
 * keeps the one that does best (lives first, then the score with the features' edge). Its input log goes
 * through the server's encode + replay; the best run is written for wavefront-expand-check.
 *
 *   bun scripts/wavefront-expand-ace.ts [--seeds=0,1,2 | --range=0-259] [--fast] [--out=<file.jsonl>] [--write]
 */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { ARCADE_INPUT_DRAG, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { roomSeed } from "./arcade-skill-bands/games";
import { wavCheckpoint, wavefrontGameFor, wavSkillRaw, WAV_X_SKILL_CANNON, WAV_X_SKILL_PAY, WAV_X_CORE_DAMAGE, WAV_X_CANNON_HP, WAV_REV_EXPAND, WAV_WORLD_W, type WavState } from "../src/lib/arcade/wavefront";
import { encodeWavefrontRun, replayWavefrontRun } from "../src/lib/duel/wavefront";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const RANGE = opt("range")?.split("-").map(Number);
const SEEDS = RANGE ? Array.from({ length: RANGE[1]! - RANGE[0]! + 1 }, (_, k) => RANGE[0]! + k) : (opt("seeds") ?? "0").split(",").map(Number);
/** --fast: a coarser search (every 6 ticks, 10 px apart), about 2.5× quicker, for the ceiling over many seeds. */
const FAST = args.includes("--fast");
const OUT = opt("out");
const game = wavefrontGameFor(WAV_REV_EXPAND);
/** Finger speed (px a tick), decision interval and look-ahead (ticks), candidate spacing (px). */
const SPEED = 40;
const EVERY = FAST ? 6 : 4;
const AHEAD = 72;
const SPACING = FAST ? 10 : 6;

/** The skill points that fill the 50 (WAV_X_SKILL_PAY's last knot). */
const FULL = WAV_X_SKILL_PAY.units[WAV_X_SKILL_PAY.units.length - 1]!;
function value(s: WavState): number {
  const raw = Math.min(FULL, wavSkillRaw(s));
  // Boss damage that came from neither the open core nor a cannon spends the weak points' chances.
  const partial = (s.boss?.guns ?? []).reduce((n, g) => n + (g > 0 ? WAV_X_CANNON_HP - g : 0), 0);
  const hull = Math.max(0, (s.bossDmg ?? 0) - WAV_X_CORE_DAMAGE * (s.weakHits ?? 0) - WAV_X_CANNON_HP * (s.cannonsDown ?? 0) - partial);
  // The mothership's kill ends the run: only once the skill points are full (or the clock is nearly out); the
  // gunship only once both its cannons are down.
  const end = s.bossKilled ? (raw >= FULL || s.tick > 80 * 60 ? 500_000 : -500_000) : 0;
  const early = s.midKilled && (s.cannonsDown ?? 0) < 2 ? -200_000 : 0;
  // Hits on a cannon still standing count as progress towards its points.
  const progress = (partial * WAV_X_SKILL_CANNON) / WAV_X_CANNON_HP;
  return s.lives * 100_000 + (raw + progress) * 3000 + (s.shapesDown + s.armourHits) * 30 + (s.bossDmg ?? 0) * 40 - hull * 60 + (s.streak ?? 0) + end + early;
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
    console.log(`seed #${n} (${seed}): ${r.score} · skill raw ${wavSkillRaw(st)} · streak ${st.bestStreak} (pts ${st.streakPts}) · power-ups ${st.powerups} · saucers ${st.saucers} · cannons ${st.cannonsDown} · core ${st.weakHits} · gunship ${st.midKilled ? "down" : "standing"} · boss ${st.bossKilled ? "down" : "standing"} at ${(st.tick / 60).toFixed(1)} s · lives ${st.lives}`);
    if (OUT) appendFileSync(OUT, `${JSON.stringify({ n, seed, score: r.score, raw: wavSkillRaw(st), units: st.shapesDown + st.armourHits + 15 * st.wavesCleared + (st.bossDmg ?? 0), killed: st.bossKilled ?? 0, tick: st.tick, lives: st.lives })}\n`);
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
