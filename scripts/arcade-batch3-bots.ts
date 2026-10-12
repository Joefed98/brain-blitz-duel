/**
 * Bots for arcade-batch3-check: each plays the REAL sim tick by tick through the
 * public input encoding (recordInput) and returns the run string the server
 * replays, so a bot score is a score the server would store.
 */
import { inputAt, recordInput, type ArcadeGame, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  burstCheckpoint,
  BURST_INPUT_FIRE,
  BURST_INPUT_MOVE,
  BURST_LIVES,
  BURST_WORLD_W,
  type BurstState,
} from "../src/lib/arcade/burst";
import { encodeBurstRun } from "../src/lib/duel/burst";

type Ev = ArcadeInputEvent;

/** Fission: every 6 ticks, look ahead over a few targets (fire or hold) and keep the safest, most productive. */
export function playBurst(game: ArcadeGame<BurstState, Ev | null>, seed: number) {
  let state = game.init(seed);
  const events: Ev[] = [];
  const checkpoints: ReturnType<typeof burstCheckpoint>[] = [];
  let flip = 0;
  const DECIDE = 6;
  const AHEAD = 90;
  const rollout = (start: BurstState, target: number, fire: boolean): number => {
    let s = start;
    let f = flip;
    for (let i = 0; i < AHEAD && !game.isOver(s); i++) {
      let ev: Ev | null = null;
      if (i === 0) ev = { t: s.tick + 1, k: BURST_INPUT_MOVE, a: target, b: 0, c: 0, d: 0 };
      else if (fire && i % 8 === 1) ev = { t: s.tick + 1, k: BURST_INPUT_FIRE, a: 0, b: (f ^= 1), c: 0, d: 0 };
      s = game.step(s, ev);
      if (s.lives < start.lives) return -1e6 + i;
    }
    // Prefer hits, catching icons, and standing away from the lowest atoms.
    let near = 1e9;
    for (const b of s.balls) near = Math.min(near, Math.abs(b.x - s.x) / 256 + (560 - b.y / 256) * 0.3);
    return s.hits * 100 + (s.shield ? 50 : 0) + (s.burst ? 30 : 0) + Math.min(near, 120);
  };
  while (!game.isOver(state)) {
    const t = state.tick + 1;
    if (t % DECIDE === 1) {
      const x = Math.round(state.x / 256);
      const options = new Set<number>([x, x - 30, x + 30, x - 70, x + 70, x - 130, x + 130, 30, BURST_WORLD_W - 30]);
      for (const b of state.balls) options.add(Math.round(b.x / 256));
      for (const i of state.icons) options.add(Math.round(i.x / 256));
      let best = { v: -Infinity, a: x, fire: false };
      for (const raw of options) {
        const a = Math.max(0, Math.min(BURST_WORLD_W, raw));
        for (const fire of [true, false]) {
          const v = rollout(state, a, fire) + (fire ? 1 : 0);
          if (v > best.v) best = { v, a, fire };
        }
      }
      recordInput(events, { t, k: BURST_INPUT_MOVE, a: best.a, b: 0, c: 0, d: 0 }, game.inputRanges);
      if (best.fire) {
        state = game.step(state, inputAt(events, t));
        if (state.tick % 300 === 0) checkpoints.push(burstCheckpoint(state));
        if (game.isOver(state)) break;
        recordInput(events, { t: t + 1, k: BURST_INPUT_FIRE, a: 0, b: (flip ^= 1), c: 0, d: 0 }, game.inputRanges);
        state = game.step(state, inputAt(events, t + 1));
        if (state.tick % 300 === 0) checkpoints.push(burstCheckpoint(state));
        continue;
      }
    }
    state = game.step(state, inputAt(events, t));
    if (state.tick % 300 === 0) checkpoints.push(burstCheckpoint(state));
  }
  const score = game.score(state);
  const raw = encodeBurstRun({ seed, claimedScore: score, events, endTick: state.tick, checkpoints });
  return { state, score, raw, livesLost: BURST_LIVES - state.lives };
}

import {
  brkCheckpoint,
  brkDestroyed,
  BRK_PADDLE_W,
  BRK_PADDLE_Y_FP,
  BRK_WORLD_W,
  type BrkState,
} from "../src/lib/arcade/breaker";
import { encodeBreakerRun } from "../src/lib/duel/breaker";

/** Breaker: for each ball coming down, try landing it on each paddle zone and keep the one that breaks most. */
export function playBreaker(game: ArcadeGame<BrkState, Ev | null>, seed: number, opts: { horizon?: number } = {}) {
  const horizon = opts.horizon ?? 150;
  let state = game.init(seed);
  const events: Ev[] = [];
  const checkpoints: ReturnType<typeof brkCheckpoint>[] = [];
  const drag = (s: BrkState, a: number): Ev => ({ t: s.tick + 1, k: 7, a: Math.max(0, Math.min(BRK_WORLD_W, Math.round(a))), b: 0, c: 0, d: 0 });
  /** The falling ball that reaches the paddle soonest. */
  const lead = (s: BrkState) => {
    let best: (typeof s.balls)[number] | null = null;
    let bestT = Infinity;
    for (const b of s.balls) {
      if (b.vy <= 0) continue;
      const t = (BRK_PADDLE_Y_FP - b.y) / b.vy;
      if (t >= -2 && t < bestT) { bestT = t; best = b; }
    }
    return best;
  };
  const follow = (s: BrkState): number => {
    const b = lead(s);
    return b ? b.x / 256 : s.paddleX;
  };
  /** Default policy: keep the paddle under the next ball, fire anything held. */
  const rollout = (start: BrkState, aim: number, ticks: number): number => {
    let s = start;
    let committed = true;
    for (let i = 0; i < ticks && !game.isOver(s); i++) {
      let ev: Ev | null;
      if (s.held && i % 20 === 5) ev = { t: s.tick + 1, k: 10, a: 0, b: 0, c: 0, d: 0 };
      else ev = drag(s, committed ? aim : follow(s));
      const before = s.balls.length;
      s = game.step(s, ev);
      if (committed && s.balls.some((b) => b.vy < 0 && b.y > BRK_PADDLE_Y_FP - 20 * 256)) committed = false;
      if (s.losses > start.losses) return brkDestroyed(s) * 10 - 1000 + i;
      void before;
    }
    return brkDestroyed(s) * 10 + (s.cleared ? 10_000 - s.tick : 0) + s.hits;
  };
  let aim = state.paddleX;
  let planned: unknown = null;
  while (!game.isOver(state)) {
    const t = state.tick + 1;
    let ev: Ev | null = null;
    const b = lead(state);
    if (state.held && state.pause === 0) ev = { t, k: 10, a: 0, b: 0, c: 0, d: 0 };
    else if (b && b.y > BRK_PADDLE_Y_FP - 200 * 256 && planned !== b) {
      // Where will it land? Step a copy with the paddle parked under it until it reaches the paddle line.
      let probe = state;
      for (let i = 0; i < 120 && !game.isOver(probe); i++) {
        const lb = lead(probe);
        if (!lb || lb.y + 6 * 256 >= BRK_PADDLE_Y_FP) break;
        probe = game.step(probe, null);
      }
      const lx = (lead(probe) ?? b).x / 256;
      let best = { v: -Infinity, a: lx };
      for (let zone = 0; zone < 5; zone++) {
        const offset = ((zone + 0.5) * BRK_PADDLE_W) / 5 - BRK_PADDLE_W / 2;
        const a = lx - offset;
        const v = rollout(state, a, horizon);
        if (v > best.v) best = { v, a };
      }
      aim = best.a;
      planned = b;
      ev = drag(state, aim);
    } else if (!b) ev = drag(state, state.paddleX);
    else if (planned !== b) ev = drag(state, b.x / 256);
    else ev = drag(state, aim);
    if (ev && ev.k === 7 && ev.a === state.aimX) ev = null;
    if (ev) recordInput(events, ev, game.inputRanges);
    state = game.step(state, inputAt(events, t));
    if (lead(state) !== b) planned = planned === b ? null : planned;
    if (state.tick % 300 === 0) checkpoints.push(brkCheckpoint(state));
  }
  const score = game.score(state);
  const raw = encodeBreakerRun({ seed, claimedScore: score, events, endTick: state.tick, checkpoints });
  return { state, score, raw };
}

import {
  wavCheckpoint,
  wavDiverCentre,
  wavShapeBox,
  WAV_BOSS_W,
  WAV_CELL,
  WAV_LIVES,
  WAV_WORLD_W,
  type WavState,
} from "../src/lib/arcade/wavefront";
import { encodeWavefrontRun } from "../src/lib/duel/wavefront";

/** Wavefront: every few ticks, roll out each candidate ship position and keep the safest, most destructive. */
export function playWavefront(game: ArcadeGame<WavState, Ev | null>, seed: number, opts: { decide?: number; ahead?: number } = {}) {
  const DECIDE = opts.decide ?? 4;
  const AHEAD = opts.ahead ?? 70;
  let state = game.init(seed);
  const events: Ev[] = [];
  const checkpoints: ReturnType<typeof wavCheckpoint>[] = [];
  const raw = (s: WavState) =>
    s.shapesDown * 10 + s.armourHits * 10 + s.saucers * 30 + s.wavesCleared * 100 + (s.bossHits ?? 0) * 10 + (s.bossKilled ?? 0) * 1000 + (s.pierce > 0 ? 5 : 0);
  const rollout = (start: WavState, aim: number): number => {
    let s = start;
    for (let i = 0; i < AHEAD && !game.isOver(s); i++) {
      s = game.step(s, i === 0 ? { t: s.tick + 1, k: 7, a: aim, b: 0, c: 0, d: 0 } : null);
      if (s.lives < start.lives || s.ended === 2) return -1e7 + i * 1000;
    }
    return raw(s);
  };
  const targets = (s: WavState): number[] => {
    const out = new Set<number>();
    const x = s.shipX;
    for (const d of [-90, -50, -24, -12, 0, 12, 24, 50, 90]) out.add(x + d);
    s.shapes.forEach((code, i) => {
      if (code) out.add(wavShapeBox(s, i).x + WAV_CELL / 2);
    });
    for (const d of s.divers ?? []) out.add(wavDiverCentre(d).x);
    if (s.boss) for (const f of [0.2, 0.5, 0.8]) out.add(s.boss.x + WAV_BOSS_W * f);
    if (s.drop) out.add(Math.trunc(s.drop.x / 256));
    if (s.saucerDir) out.add(Math.trunc(s.saucerX / 256) + s.saucerDir * 40);
    return [...out].map((a) => Math.max(0, Math.min(WAV_WORLD_W, Math.round(a))));
  };
  while (!game.isOver(state)) {
    const t = state.tick + 1;
    if (t % DECIDE === 1) {
      let best = { v: -Infinity, a: state.shipX };
      for (const a of targets(state)) {
        const v = rollout(state, a) - Math.abs(a - state.shipX) * 0.01;
        if (v > best.v) best = { v, a };
      }
      if (best.a !== state.aimX) recordInput(events, { t, k: 7, a: best.a, b: 0, c: 0, d: 0 }, game.inputRanges);
    }
    state = game.step(state, inputAt(events, t));
    if (state.tick % 300 === 0) checkpoints.push(wavCheckpoint(state));
  }
  const score = game.score(state);
  const run = encodeWavefrontRun({ seed, claimedScore: score, events, endTick: state.tick, checkpoints });
  return { state, score, raw: run, livesLost: WAV_LIVES - state.lives };
}
