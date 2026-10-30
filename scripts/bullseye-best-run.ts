/**
 * Flightpath's best possible run on a seed, played for real through the sim (scripts only; bullseye-standard-check and
 * the arcade-standard case use it): every dart a bull, in the dead-centre ring wherever the dart has one, each balloon
 * popped when a landing point inside it also scores that (else the best point inside it, else the board's centre).
 *
 * For each dart it scans the release ticks ahead (balloon darts up to a full balloon loop), lists candidate landing
 * points (the board's centre, the 10 ring, and points inside the balloon on the line towards the board's centre),
 * judges each with the sim's own geometry (bullseyeRingAt, bullseyeInInnerBull, bullseyeInDeadCentre,
 * bullseyeBalloonV4Popped), takes the best (dead centre where there is one, then a bull, then the most points, then
 * the earliest), finds the exact launch that lands there (bullseyeAimPointFor plus the wind) and steps the sim with it.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ArcadeGame, ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  bullseyeAimPointFor,
  bullseyeBalloonV4Popped,
  bullseyeBalloonV4At,
  bullseyeBoard,
  bullseyeDxOf,
  bullseyeInDeadCentre,
  bullseyeInInnerBull,
  bullseyeRingAt,
  bullseyeRingValue,
  bullseyeRingValues,
  bullseyeWindShiftFor,
  BULLSEYE_ARROWS,
  BULLSEYE_BALLOON_R,
  BULLSEYE_CX,
  BULLSEYE_FLIGHT_DEN,
  BULLSEYE_FLIGHT_TICKS,
  BULLSEYE_INNER_BULL_POINTS,
  BULLSEYE_INPUT_SHOT,
  BULLSEYE_OUTER_R,
  BULLSEYE_RINGS,
  BULLSEYE_V8_FLIGHT_NUM,
  BULLSEYE_V_MAX,
  type BullseyeBalloonV4,
  type BullseyeState,
} from "../src/lib/arcade/bullseye";

interface Plan {
  u: number;
  x: number;
  y: number;
  key: number;
}

function judge(s: BullseyeState, arrow: number, land: number, x: number, y: number): { key: number; value: number } {
  const board = bullseyeBoard(s, arrow);
  const values = bullseyeRingValues(s, arrow);
  const tdx = bullseyeDxOf(s, arrow, land);
  const ring = bullseyeRingAt(x - tdx, y, board.scalePct, board.cy);
  let value = bullseyeRingValue(ring, values);
  if (ring === 0 && bullseyeInInnerBull(x - tdx, y, board.scalePct, values, board.cy)) value = BULLSEYE_INNER_BULL_POINTS;
  const bull = ring >= 0 && value >= 10;
  const balloon = (s.balloons?.[arrow] ?? null) as BullseyeBalloonV4 | null;
  const bal = balloon && bullseyeBalloonV4Popped(balloon, s, arrow, land, x, y) ? balloon.value : 0;
  const dead = bull && bullseyeInDeadCentre(x - tdx, y, board.scalePct, values, board.cy);
  const needDead = values[0] === 10;
  // Dead centre where the dart has one, then a bull, then the most points.
  const key = (needDead ? (dead ? 1 : 0) : 1) * 10_000 + (bull ? 1 : 0) * 1_000 + value + bal;
  return { key, value: value + bal };
}

function candidates(s: BullseyeState, arrow: number, land: number): [number, number][] {
  const board = bullseyeBoard(s, arrow);
  const values = bullseyeRingValues(s, arrow);
  const cx = BULLSEYE_CX + bullseyeDxOf(s, arrow, land);
  const out: [number, number][] = [[cx, board.cy]];
  const step = (BULLSEYE_OUTER_R * board.scalePct) / (100 * BULLSEYE_RINGS);
  const ten = values.indexOf(10);
  if (ten > 0) out.push([cx, Math.round(board.cy - step * (ten + 0.5))]);
  const balloon = (s.balloons?.[arrow] ?? null) as BullseyeBalloonV4 | null;
  if (balloon) {
    const at = bullseyeBalloonV4At(balloon, s, arrow, land);
    const dx = cx - at.x;
    const dy = board.cy - at.y;
    const d = Math.hypot(dx, dy);
    for (let k = 0; k <= BULLSEYE_BALLOON_R; k++) {
      const f = d > 0 ? Math.min(k, d) / d : 0;
      out.push([Math.round(at.x + dx * f), Math.round(at.y + dy * f)]);
    }
    // Towards the 10 ring when it is not the centre ring.
    if (ten > 0 && d > 0) {
      const r = step * (ten + 0.5);
      const tx = cx - (dx / d) * r;
      const ty = board.cy - (dy / d) * r;
      const ex = tx - at.x;
      const ey = ty - at.y;
      const e = Math.hypot(ex, ey);
      for (let k = 0; k <= BULLSEYE_BALLOON_R; k++) {
        const f = e > 0 ? Math.min(k, e) / e : 0;
        out.push([Math.round(at.x + ex * f), Math.round(at.y + ey * f)]);
      }
    }
  }
  return out;
}

/** The launch that lands exactly on (x, y) when released on tick u, or null. */
function launch(s: BullseyeState, arrow: number, u: number, x: number, y: number): { vx: number; vy: number } | null {
  const wind = bullseyeWindShiftFor(s, arrow, s.winds[arrow] ?? 0);
  const at = { ...s, arrowIndex: arrow };
  const zero = bullseyeAimPointFor(at, u, 0, 0);
  const gx = Math.round(((x - wind - zero.x) * BULLSEYE_FLIGHT_DEN) / BULLSEYE_V8_FLIGHT_NUM);
  const gy = Math.round(((y - zero.y) * BULLSEYE_FLIGHT_DEN) / BULLSEYE_V8_FLIGHT_NUM);
  for (let r = 0; r <= 6; r++) {
    for (let a = -r; a <= r; a++) {
      for (let b = -r; b <= r; b++) {
        if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue;
        const vx = gx + a;
        const vy = gy + b;
        if (vx < -BULLSEYE_V_MAX || vx > BULLSEYE_V_MAX || vy < -BULLSEYE_V_MAX || vy > 0) continue;
        const p = bullseyeAimPointFor(at, u, vx, vy);
        if (p.x + wind === x && p.y === y) return { vx, vy };
      }
    }
  }
  return null;
}

/** Plays the best run on `game` (a bullRev 8 or 9 game) from `seed`: the events and the final state. */
export function bullseyeBestRun(game: ArcadeGame<BullseyeState, ArcadeInputEvent | null>, seed: number): { events: ArcadeInputEvent[]; state: BullseyeState } {
  let s = game.init(seed);
  const events: ArcadeInputEvent[] = [];
  while (!game.isOver(s) && s.arrowIndex < BULLSEYE_ARROWS) {
    if (s.flightTick > 1) {
      s = game.step(s, null);
      continue;
    }
    const arrow = s.arrowIndex;
    const darts = BULLSEYE_ARROWS - arrow;
    // Leave time for the darts after this one (a flight each and a little more).
    const budget = game.runTicks - s.tick - (darts - 1) * (BULLSEYE_FLIGHT_TICKS + 2) - BULLSEYE_FLIGHT_TICKS - 2;
    const window = Math.max(1, Math.min(s.balloons?.[arrow] ? 1_000 : 1, budget));
    let best: (Plan & { v: { vx: number; vy: number } }) | null = null;
    for (let u = s.tick + 1; u <= s.tick + window; u++) {
      const land = u + BULLSEYE_FLIGHT_TICKS;
      for (const [x, y] of candidates(s, arrow, land)) {
        const { key } = judge(s, arrow, land, x, y);
        if (best && key <= best.key) continue;
        const v = launch(s, arrow, u, x, y);
        if (v) best = { u, x, y, key, v };
      }
    }
    if (!best) throw new Error(`bullseyeBestRun seed ${seed}: no launch for dart ${arrow + 1}`);
    while (s.tick + 1 < best.u) s = game.step(s, null);
    const ev: ArcadeInputEvent = { t: best.u, k: BULLSEYE_INPUT_SHOT, a: best.v.vx, b: best.v.vy, c: 0, d: 0 } as ArcadeInputEvent;
    events.push(ev);
    s = game.step(s, ev);
  }
  while (!game.isOver(s) && s.tick < game.runTicks) s = game.step(s, null);
  return { events, state: s };
}
