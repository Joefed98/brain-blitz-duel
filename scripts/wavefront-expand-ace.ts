/**
 * A scripted Wavefront wavRev 10 run that proves 200 reachable: a look-ahead player (not a human
 * model) that, every few ticks, tries a spread of ship positions, plays each forward in the real sim and
 * keeps the one that does best (lives first, then the score with the features' edge). Its input log goes
 * through the server's encode + replay; the best run is written for wavefront-expand-check.
 *
 *   bun scripts/wavefront-expand-ace.ts [--seeds=0,1,2 | --range=0-259] [--fast] [--out=<file.jsonl>] [--write]
 *   bun scripts/wavefront-expand-ace.ts --pack=<a.jsonl,b.jsonl,…>   (the full run's logs → scripts/fixtures/wavefront-expand-oracle.json.gz;
 *                                                                    a seed in several files keeps its best run)
 */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { ARCADE_INPUT_DRAG, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { roomSeed } from "./arcade-skill-bands/games";
import { wavBossW, wavCannonX, wavShipY, WAV_BOSS_H, WAV_BOSS_Y, WAV_X_BOLT_SPEED } from "../src/lib/arcade/wavefront";
import { wavCheckpoint, wavefrontGameFor, wavSkillRaw, WAV_X_SKILL_CANNON, WAV_X_SKILL_CORE, WAV_X_SKILL_SAUCER, WAV_SAUCER_EVERY, WAV_X_SKILL_PAY, WAV_X_CORE_DAMAGE, WAV_X_CANNON_HP, WAV_REV_EXPAND, WAV_WORLD_W, type WavState } from "../src/lib/arcade/wavefront";
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
/** The plain objective (the run's score, lives first), used when the feature-seeking one stalls on a boss. */
function plainValue(s: WavState): number {
  return s.lives * 100_000 + game.score(s) * 200 + (s.bossDmg ?? 0) * 40 + s.shapesDown * 30 + s.armourHits * 30 + wavSkillRaw(s) * 4 + (s.streak ?? 0) + (s.bossKilled ? 20_000 : 0);
}
let stalled = false;
function value(s: WavState): number {
  if (stalled) return plainValue(s);
  const raw = Math.min(FULL, wavSkillRaw(s));
  // Boss damage that came from neither the open core nor a cannon spends the weak points' chances.
  const partial = (s.boss?.guns ?? []).reduce((n, g) => n + (g > 0 ? WAV_X_CANNON_HP - g : 0), 0);
  const hull = Math.max(0, (s.bossDmg ?? 0) - WAV_X_CORE_DAMAGE * (s.weakHits ?? 0) - WAV_X_CANNON_HP * (s.cannonsDown ?? 0) - partial);
  // The mothership's kill ends the run: only once the skill points are full, or when what is left of the boss
  // (its standing cannons, the core hits its hit points allow) and the saucers still to come can't fill them
  // (rootCanFill, judged on the state the decision starts from), or the clock is nearly out.
  const end = s.bossKilled ? (raw >= FULL || !rootCanFill || s.tick > 80 * 60 ? 500_000 : -500_000) : 0;
  // Hits on a cannon still standing count as progress towards its points.
  const progress = (partial * WAV_X_SKILL_CANNON) / WAV_X_CANNON_HP;
  return s.lives * 100_000 + (raw + progress) * 3000 + (s.shapesDown + s.armourHits) * 30 + (s.bossDmg ?? 0) * 40 - hull * 60 + (s.streak ?? 0) + end;
}

/**
 * Where to stand so the next bolt lands on a boss's weak point centre (each standing cannon, and the core): the
 * boss's own motion (1 px a tick, turning at the sides) played forward to when that bolt reaches it, ±1 px.
 */
function weakPointAims(s: WavState): number[] {
  const boss = s.boss;
  if (!boss || (s.enter ?? 0) > 0) return [];
  const w = wavBossW(boss);
  const flight = Math.ceil((wavShipY(s) - 14 - 12 - (WAV_BOSS_Y + WAV_BOSS_H)) / WAV_X_BOLT_SPEED);
  const ahead = Math.max(1, s.fireIn) + flight;
  let bx = boss.x;
  let dir = boss.dir;
  for (let k = 0; k < ahead; k++) {
    bx += dir;
    if (bx <= 12 || bx >= WAV_WORLD_W - 12 - w) dir = -dir;
  }
  const offsets = [w / 2, ...[0, 1].filter((k) => (boss.guns ?? [0, 0])[k]! > 0).map((k) => wavCannonX(boss, k))];
  const out: number[] = [];
  for (const o of offsets) for (const d of [-1, 0, 1]) out.push(Math.max(24, Math.min(WAV_WORLD_W - 24, bx + o + d)));
  return out;
}

/** Whether the skill points can still be filled from this state (the mothership on screen). */
let rootCanFill = true;
function canFill(s: WavState): boolean {
  if (!s.boss || s.boss.mid) return true;
  const guns = s.boss.guns ?? [0, 0];
  const standing = guns.filter((g) => g > 0).length;
  const coreHits = Math.ceil(Math.max(0, s.boss.hp - guns.reduce((n, g) => n + Math.max(0, g), 0)) / WAV_X_CORE_DAMAGE);
  const saucers = [1, 2, 3, 4, 5].filter((k) => k * WAV_SAUCER_EVERY > s.tick && k * WAV_SAUCER_EVERY < game.runTicks).length;
  return wavSkillRaw(s) + standing * WAV_X_SKILL_CANNON + coreHits * WAV_X_SKILL_CORE + saucers * WAV_X_SKILL_SAUCER >= FULL;
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
  let lastDmg = -1;
  let lastProgress = 0;
  while (!game.isOver(s) && s.tick < game.runTicks) {
    let bestTo = x;
    let best = -Infinity;
    rootCanFill = canFill(s);
    if ((s.bossDmg ?? 0) !== lastDmg || !s.boss) {
      lastDmg = s.bossDmg ?? 0;
      lastProgress = s.tick;
    }
    // No boss damage for 4 s: the feature-seeking search is hiding from the boss's fire; play it plainly a while.
    stalled = s.tick - lastProgress > 240;
    const tos: number[] = [];
    for (let to = 24; to <= WAV_WORLD_W - 24; to += SPACING) tos.push(to);
    tos.push(...weakPointAims(s));
    for (const to of tos) {
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

const PACK = opt("pack");
if (import.meta.main && PACK) {
  // --pack=a.jsonl,b.jsonl: the --out files of a full run (seeds 0–259) into the fixture wavefront-expand-check replays.
  const runs = PACK.split(",")
    .flatMap((f) => readFileSync(f, "utf8").trim().split("\n"))
    .map((l) => JSON.parse(l) as { n: number; seed: number; score: number; log: string })
    // A seed searched again (without --fast) keeps its best run.
    .filter((r, _i, all) => all.every((o) => o.n !== r.n || o.score < r.score || o === all.find((x) => x.n === r.n && x.score === r.score)))
    .map(({ n, seed, log }) => {
      // The score the run claims is re-stated from today's scoring (the play, events and checkpoints are the same).
      // (decodeWavefrontRun is the 60 s game's and would keep only its checkpoints, so the field is replaced in place.)
      const score = replayWavefrontRun(seed, log, WAV_REV_EXPAND).score;
      const parts = log.split("|");
      parts[1] = String(score);
      return { n, seed, log: parts.join("|") };
    })
    .sort((a, b) => a.n - b.n);
  writeFileSync("scripts/fixtures/wavefront-expand-oracle.json.gz", gzipSync(JSON.stringify({ recorded: "wavefront-expand-ace --fast", runs })));
  console.log(`packed ${runs.length} oracle runs`);
} else if (import.meta.main) {
  let best: { seed: number; raw: string; score: number } | null = null;
  for (const n of SEEDS) {
    const seed = roomSeed(n);
    const r = aceRun(seed);
    const st = replayWavefrontRun(seed, r.raw, WAV_REV_EXPAND).state as WavState;
    console.log(`seed #${n} (${seed}): ${r.score} · skill raw ${wavSkillRaw(st)} · streak ${st.bestStreak} (pts ${st.streakPts}) · power-ups ${st.powerups} · saucers ${st.saucers} · cannons ${st.cannonsDown} · core ${st.weakHits} · precise ${st.precise} · gunship ${st.midKilled ? "down" : "standing"} · boss ${st.bossKilled ? "down" : "standing"} at ${(st.tick / 60).toFixed(1)} s · lives ${st.lives}`);
    if (OUT) appendFileSync(OUT, `${JSON.stringify({ n, seed, score: r.score, log: r.raw, raw: wavSkillRaw(st), units: st.shapesDown + st.armourHits + 15 * st.wavesCleared + (st.bossDmg ?? 0), killed: st.bossKilled ?? 0, tick: st.tick, lives: st.lives })}\n`);
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
