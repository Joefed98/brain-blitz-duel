/**
 * Expansion E9 (26 Oct 2026, docs/expansions/e9.md): perfect-play oracles for the ceiling proofs
 * (scripts/expansion-e9-ceiling.ts). Each is an input log a phone could send, built with full knowledge of the
 * sim (the seed's own future), played through the server's encode + replay path like any run. Script only.
 *
 *  - Flightpath: every dart thrown, at a moment searched tick by tick, with the launch worked out exactly so
 *    the dart lands on the board's centre (its 10 ring's middle when the 10 is not the centre), and kept only
 *    when the forked sim confirms it.
 *  - Rally: the paddle teleports under the next ball to land; at each contact a few paddle offsets are tried
 *    on a fork of the sim, followed for a while by the same catching policy, and the one that strikes a gold
 *    target (else a pink pad) without losing a ball is taken.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ARCADE_INPUT_DRAG, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  bullseyeAimPointFor,
  bullseyeBoard,
  bullseyeDxOf,
  bullseyeRingValues,
  bullseyeWindShiftFor,
  BULLSEYE_ARROWS,
  BULLSEYE_CX,
  BULLSEYE_FLIGHT_TICKS,
  BULLSEYE_INPUT_SHOT,
  BULLSEYE_OUTER_R,
  BULLSEYE_RINGS,
  BULLSEYE_V_MAX,
  type BullseyeState,
} from "../src/lib/arcade/bullseye";
import { rallyBonusCount, rallyPaddleW, rallyPaddleY, rallyTotalHits, rallyWorldW, RALLY_BALL_R, type RallyBall, type RallyState } from "../src/lib/arcade/rally";
import type { SkillBot } from "./arcade-skill-bands/bot";

/* ------------------------------------------------------------------ Flightpath */

export const bullseyeOracle: SkillBot = ({ game, seed }) => {
  let s: BullseyeState = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    if (s.arrowIndex < BULLSEYE_ARROWS && s.flightTick <= 1) {
      const shot = planDart(game, s);
      if (shot) {
        // Idle to the release tick, then throw.
        while (s.tick + 1 < shot.t) s = game.step(s, null);
        const ev = { t: shot.t, k: BULLSEYE_INPUT_SHOT, a: shot.vx, b: shot.vy, c: 0, d: 0 };
        events.push(ev);
        s = game.step(s, ev);
        continue;
      }
    }
    s = game.step(s, null);
  }
  return { events };
};

function planDart(game: any, s0: BullseyeState): { t: number; vx: number; vy: number } | null {
  const arrow = s0.arrowIndex;
  let s = s0;
  let fallback: { t: number; vx: number; vy: number } | null = null;
  for (let wait = 0; wait < 150 && !game.isOver(s); wait++) {
    const u = s.tick + 1;
    if (s.flightTick <= 1) {
      const board = bullseyeBoard(s, arrow);
      const values = bullseyeRingValues(s, arrow);
      const ten = Math.max(0, values.indexOf(10));
      const ring = (BULLSEYE_OUTER_R * board.scalePct) / (100 * BULLSEYE_RINGS);
      const tx = BULLSEYE_CX + bullseyeDxOf(s, arrow, u + BULLSEYE_FLIGHT_TICKS);
      const ty = board.cy - (ten === 0 ? 0 : ring * (ten + 0.5));
      const wind = bullseyeWindShiftFor(s, arrow, s.winds[arrow] ?? 0);
      // The aim point (landing + sway) the release needs, then a small search on the launch to hit it exactly.
      const zero = bullseyeAimPointFor(s, u, 0, -1920);
      for (const [dvx, dvy] of searchOrder()) {
        const guessX = Math.round(((tx - wind - zero.x) * 1920) / 423) + dvx;
        const guessY = -1920 + Math.round(((ty - zero.y) * 1920) / 423) + dvy;
        const vx = Math.max(-BULLSEYE_V_MAX, Math.min(BULLSEYE_V_MAX, guessX));
        const vy = Math.max(-BULLSEYE_V_MAX, Math.min(0, guessY));
        const p = bullseyeAimPointFor(s, u, vx, vy);
        if (Math.abs(p.x + wind - tx) > 1 || Math.abs(p.y - ty) > 1) continue;
        const after: BullseyeState = game.step(s, { t: u, k: BULLSEYE_INPUT_SHOT, a: vx, b: vy, c: 0, d: 0 });
        const hit = after.hits[after.hits.length - 1];
        if (!hit) continue;
        const bull = hit.ring >= 0 && hit.value - (hit.bal ?? 0) >= 10;
        if (bull && (hit.dc || ten !== 0)) return { t: u, vx, vy };
        if (bull && !fallback) fallback = { t: u, vx, vy };
      }
    }
    s = game.step(s, null);
  }
  return fallback;
}

function searchOrder(): [number, number][] {
  const out: [number, number][] = [];
  for (let r = 0; r <= 6; r++) for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) if (Math.max(Math.abs(a), Math.abs(b)) === r) out.push([a * 2, b * 2]);
  return out;
}

/* ------------------------------------------------------------------ Rally */

function landing(b: RallyBall, paddleY: number): number {
  return b.vy > 0 ? ((paddleY - RALLY_BALL_R) * 256 - b.y) / b.vy : Infinity;
}

/** The catching policy: the paddle under the ball that lands next (its x now, which it reaches in under a tick's travel). */
function follow(s: RallyState, offset = 0): number {
  const paddleY = rallyPaddleY(s);
  const balls: RallyBall[] = [s, ...s.golds];
  let best: RallyBall | null = null;
  let bestT = Infinity;
  for (const b of balls) {
    const t = landing(b, paddleY);
    if (t < bestT) {
      bestT = t;
      best = b;
    }
  }
  if (!best) return s.aimX;
  // Where it will be at contact (straight on; walls are rare in the last ticks).
  const x = (best.x + best.vx * Math.max(0, bestT)) / 256;
  return Math.round(Math.max(0, Math.min(rallyWorldW(s), x - offset)));
}

export const rallyOracle: SkillBot = ({ game, seed }) => {
  let s: RallyState = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  const W = rallyWorldW(s);
  const push = (t: number, a: number) => {
    const last = events[events.length - 1];
    if (!last || last.a !== a) events.push({ t, k: ARCADE_INPUT_DRAG, a, b: 0, c: 0, d: 0 });
  };
  const stepTo = (from: RallyState, a: number) => game.step(from, { t: from.tick + 1, k: ARCADE_INPUT_DRAG, a, b: 0, c: 0, d: 0 });
  const run = (from: RallyState, inputs: number[], ticks: number): RallyState => {
    let f = from;
    for (const a of inputs) if (!game.isOver(f)) f = stepTo(f, a);
    for (let i = 0; i < ticks && !game.isOver(f); i++) f = stepTo(f, follow(f));
    return f;
  };
  let queued: number[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    let a: number;
    if (queued.length) a = queued.shift()!;
    else {
      const paddleY = rallyPaddleY(s);
      const soon = [s, ...s.golds].some((b) => landing(b, paddleY) <= 2.5);
      a = follow(s);
      if (soon) {
        // A contact within two ticks: try paddle offsets, each with a sweep into the contact (spin) or none, on
        // forks of the sim, and keep the best (a gold target, else a pad, never a lost ball).
        const half = rallyPaddleW(rallyTotalHits(s)) / 2;
        const target = s.bonus?.some((b) => s.tick >= b.tick - 200 && s.tick < b.tick + 240) ?? false;
        let best = { inputs: [a, a], v: -Infinity };
        const sweeps = target ? [0, -12, 12, -40, 40] : [0];
        for (let k = -6; k <= 6; k++)
          for (const sw of sweeps) {
            const mid = s;
            const x1 = Math.max(0, Math.min(W, follow(mid, (k * half) / 7) - sw));
            const after1 = stepTo(mid, x1);
            const x2 = Math.max(0, Math.min(W, follow(after1, (k * half) / 7)));
            const inputs = [x1, x2];
            const f = run(s, inputs, 200);
            const v = (f.dead ? -1000 : 0) + 100 * (rallyBonusCount(f) - rallyBonusCount(s)) + 8 * ((f.targetHits ?? 0) - (s.targetHits ?? 0)) + 5 * (f.goldHits - s.goldHits) - Math.abs(k) * 0.01 - Math.abs(sw) * 0.001;
            if (v > best.v) best = { inputs, v };
          }
        a = best.inputs[0]!;
        queued = [best.inputs[1]!];
      }
    }
    push(s.tick + 1, a);
    s = stepTo(s, a);
  }
  return { events };
};
