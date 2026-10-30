/**
 * Slice sliceRev 11 (the arcade scoring standard, docs/arcade-standard/slice.md): an oracle player that
 * reads the sim's own state and plays a flawless run. It holds one path at a time (renewing the combo with a new path
 * before the old one runs out), cuts one food a tick with a short segment on its centre (the most urgent food first,
 * never a bottle), keeps every segment clear of the chillies, and makes its dodges by running a cutting segment from a
 * food towards a chilli and stopping just short of its skin. The log goes through the server's own encode and replay
 * (replaySliceRun), so the score is the stored one. Used by scripts/arcade-standard/slice.ts and
 * scripts/slice-standard-check.ts.
 */
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  sliceCheckpoint,
  sliceGameFor,
  sliceMaxPath,
  sliceObjectAt,
  sliceRadius,
  sliceSuppressed,
  sliceWorldH,
  sliceWorldW,
  SLICE_BLADE_V4,
  SLICE_CHECKPOINT_INTERVAL,
  SLICE_HUD_H,
  SLICE_INPUT_BEGIN,
  SLICE_INPUT_SWIPE,
  SLICE_REV_STANDARD,
  SLICE_REACH_DEN,
  SLICE_REACH_V4_NUM,
  SLICE_RUN_TICKS,
  SLICE_SPECIAL_FRENZY,
  SLICE_V11_DODGE_CAP,
  SLICE_V11_DODGE_POINTS,
  SLICE_V11_CLOSE,
  type SliceCheckpoint,
  type SliceState,
} from "../src/lib/arcade/slice";
import { encodeSliceRun, replaySliceRun, type SliceResult } from "../src/lib/duel/slice";

interface Pt {
  x: number;
  y: number;
}

/** Ticks of combo left at which the oracle starts a new path to renew it. */
const RENEW_AT = 420;

function segHits(x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, radius: number): boolean {
  const r2 = radius * radius;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = cx - x1;
  const fy = cy - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return fx * fx + fy * fy <= r2;
  const dot = fx * dx + fy * dy;
  if (dot <= 0) return fx * fx + fy * fy <= r2;
  if (dot >= len2) {
    const gx = cx - x2;
    const gy = cy - y2;
    return gx * gx + gy * gy <= r2;
  }
  const cross = fx * dy - fy * dx;
  return cross * cross <= r2 * len2;
}

/** The oracle's input log for a seed on sliceRev 11 (or another revision, for comparisons). */
export function sliceOracleEvents(seed: number, rev = SLICE_REV_STANDARD): ArcadeInputEvent[] {
  const game = sliceGameFor(rev);
  let s = game.init(seed) as SliceState;
  const H = sliceWorldH(s);
  const W = sliceWorldW(s);
  const events: ArcadeInputEvent[] = [];
  const at = (state: SliceState, i: number, tick: number): Pt | null => {
    const p = sliceObjectAt(state.objects[i]!, tick, state.slowFrom, state.mayo);
    return p ? { x: Math.trunc(p.x / 256), y: Math.trunc(p.y / 256) } : null;
  };
  const onBoard = (p: Pt | null, r: number): p is Pt => !!p && p.y - r <= H && p.y + r >= SLICE_HUD_H && p.x - r <= W && p.x + r >= 0;
  /** Ticks until a food can no longer be cut (positions without further cuts). */
  const exitIn = (state: SliceState, i: number, tick: number): number => {
    const r = sliceRadius(state.objects[i]!);
    for (let k = 1; k <= 400; k++) if (!onBoard(at(state, i, tick + k), r)) return k;
    return 400;
  };
  const inX = (v: number) => Math.max(0, Math.min(W, v));
  const inY = (v: number) => Math.max(0, Math.min(H, v));
  /** The segment the sim cuts with: reaching back past the start, the blade either side. */
  const cutLine = (a: number, b: number, c: number, d: number) => ({
    ax: c - Math.trunc(((c - a) * SLICE_REACH_V4_NUM) / SLICE_REACH_DEN),
    ay: d - Math.trunc(((d - b) * SLICE_REACH_V4_NUM) / SLICE_REACH_DEN),
    c,
    d,
  });
  let pathOn = false;
  while (!game.isOver(s) && s.tick < SLICE_RUN_TICKS) {
    const t = s.tick + 1;
    const chillies: { i: number; p: Pt; r: number }[] = [];
    const foods: { i: number; p: Pt; r: number; exit: number }[] = [];
    s.objects.forEach((o, i) => {
      // Bottles: only ketchup (its batch is more food to cut); mustard and mayo are left alone.
      if (s.slicedAt[i] || sliceSuppressed(s, o) || (o.special && o.special !== SLICE_SPECIAL_FRENZY)) return;
      const p = at(s, i, t);
      const r = sliceRadius(o);
      if (!onBoard(p, r)) return;
      if (o.bomb) chillies.push({ i, p, r });
      else foods.push({ i, p, r, exit: exitIn(s, i, t) });
    });
    const clear = (line: { ax: number; ay: number; c: number; d: number }) =>
      chillies.every((ch) => !segHits(line.ax, line.ay, line.c, line.d, ch.p.x, ch.p.y, ch.r + SLICE_BLADE_V4 + 2));
    let event: ArcadeInputEvent | null = null;
    const renew = s.comboLive && s.strokeQualified && s.comboUntil - t < RENEW_AT;
    const budget = sliceMaxPath(s) - s.strokeLen;
    if (!pathOn || renew || budget < 120) {
      // A new path (it cuts nothing on this tick).
      event = { t, k: SLICE_INPUT_BEGIN, a: W >> 1, b: H >> 1, c: 0, d: 0 };
      pathOn = true;
    } else if (foods.length > 0) {
      foods.sort((a, b) => a.exit - b.exit);
      const wantDodge = SLICE_V11_DODGE_POINTS * (s.dodges ?? 0) < SLICE_V11_DODGE_CAP;
      // Every chilli still to come or on the board, for the dodges.
      const pending: { i: number; r: number }[] = [];
      s.objects.forEach((o, i) => {
        if (o.bomb && !s.slicedAt[i] && !sliceSuppressed(s, o)) pending.push({ i, r: sliceRadius(o) });
      });
      const closeAt = (f: { r: number }, p: Pt, tick: number) =>
        pending.some((ch) => {
          const q = at(s, ch.i, tick);
          return onBoard(q, ch.r) && Math.hypot(q.x - p.x, q.y - p.y) <= ch.r + f.r + SLICE_V11_CLOSE - 2;
        });
      let order = foods;
      if (wantDodge && pending.length > 0) {
        // A food close to a chilli now goes first; one that will pass close to one later (while it can still be
        // cut, with time to spare) waits for it.
        const now = foods.filter((f) => closeAt(f, f.p, t));
        const later = new Set<number>();
        for (const f of foods) {
          if (now.includes(f) || f.exit <= 30) continue;
          for (let k = 1; k < f.exit - 15; k++) {
            const p = at(s, f.i, t + k);
            if (p && closeAt(f, p, t + k)) {
              later.add(f.i);
              break;
            }
          }
        }
        order = [...now, ...foods.filter((f) => !now.includes(f) && !later.has(f.i))];
      }
      const spots = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] as const;
      for (const f of order) {
        if (event) break;
        for (const [sx, sy] of spots) {
          if (event) break;
          const reach = sx === 0 && sy === 0 ? 0 : (f.r - 3) / Math.hypot(sx, sy);
          const px = Math.round(f.p.x + sx * reach);
          const py = Math.round(f.p.y + sy * reach);
          for (const [ox, oy] of [[1, 0], [0, 1]] as const) {
            const a = inX(px - ox);
            const b = inY(py - oy);
            const c = inX(px + ox);
            const d = inY(py + oy);
            const line = cutLine(a, b, c, d);
            if ((a === c && b === d) || !clear(line) || !segHits(line.ax, line.ay, c, d, f.p.x, f.p.y, f.r)) continue;
            event = { t, k: SLICE_INPUT_SWIPE, a, b, c, d };
            break;
          }
        }
      }
    }
    if (event) events.push(event);
    s = game.step(s, event) as SliceState;
  }
  return events;
}

/** Plays the oracle's log as the phone would send it and replays it through the server. */
export function sliceOracleRun(seed: number, rev = SLICE_REV_STANDARD): { raw: string; result: SliceResult } {
  const game = sliceGameFor(rev);
  const events = sliceOracleEvents(seed, rev);
  const by = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed);
  const checkpoints: SliceCheckpoint[] = [];
  while (!game.isOver(s) && s.tick < SLICE_RUN_TICKS) {
    s = game.step(s, by.get(s.tick + 1) ?? null);
    if (s.tick % SLICE_CHECKPOINT_INTERVAL === 0) checkpoints.push(sliceCheckpoint(s));
  }
  const raw = encodeSliceRun({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints });
  return { raw, result: replaySliceRun(seed, raw, rev) };
}
