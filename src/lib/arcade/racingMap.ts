/**
 * Apex's run summary data (the Sports overhaul, 15 Nov 2026; display only): a top-down map of a circuit and the
 * moments of a run on it, for the answer reveal (components/duel/summaries/RacingSummary.tsx) and the gallery.
 *
 * The circuits are pseudo-3D (racing.ts: a curvature per segment, no closed geometry), so the map is a schematic: each
 * segment turns by its curvature, the turn still missing for one whole loop is shared over the corners in proportion
 * to how sharp they are, and the last gap is closed along the lap. Corners keep their order, direction and sharpness.
 *
 * The run's moments come from stepping this player's own stored log through the sim (the server's replay scored it).
 */
import type { ArcadeInputEvent } from "./engine";
import {
  racingGameFor,
  racingLevelOf,
  racingGoTick,
  racingPace10,
  racingSegAt,
  RACING_LAP,
  RACING_LAP_SEGS,
  RACING_SECTORS,
  RACING_TOTAL,
  type RacingState,
  type RacingTrack,
} from "./racing";

export interface MapPoint {
  x: number;
  y: number;
}

const mapCache = new WeakMap<RacingTrack, MapPoint[]>();

/** One point per lap segment (and the start again at the end), fitted into a unit box (x, y in 0…1, aspect kept). */
export function racingMapPoints(track: RacingTrack): MapPoint[] {
  const hit = mapCache.get(track);
  if (hit) return hit;
  const n = RACING_LAP_SEGS;
  let sum = 0;
  let abs = 0;
  for (let i = 0; i < n; i++) {
    sum += track.curve[i]!;
    abs += Math.abs(track.curve[i]!);
  }
  const k = Math.PI / 300;
  const want = (sum >= 0 ? 1 : -1) * 2 * Math.PI;
  const extra = abs > 0 ? (want - sum * k) / abs : 0;
  const raw: MapPoint[] = [{ x: 0, y: 0 }];
  let h = -Math.PI / 2;
  let x = 0;
  let y = 0;
  for (let i = 0; i < n; i++) {
    const c = track.curve[i]!;
    h += c * k + Math.abs(c) * extra;
    x += Math.cos(h);
    y += Math.sin(h);
    raw.push({ x, y });
  }
  // Close the loop: take the end's gap off along the lap.
  const gx = raw[n]!.x;
  const gy = raw[n]!.y;
  const pts = raw.map((p, i) => ({ x: p.x - (gx * i) / n, y: p.y - (gy * i) / n }));
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  const span = Math.max(x1 - x0, y1 - y0) || 1;
  const ox = (span - (x1 - x0)) / 2;
  const oy = (span - (y1 - y0)) / 2;
  const fit = pts.map((p) => ({ x: (p.x - x0 + ox) / span, y: (p.y - y0 + oy) / span }));
  mapCache.set(track, fit);
  return fit;
}

/** A map point for a race distance (any lap). */
export function racingMapAt(points: readonly MapPoint[], s: number): MapPoint {
  const lapS = ((s % RACING_LAP) + RACING_LAP) % RACING_LAP;
  const f = lapS / (RACING_LAP / RACING_LAP_SEGS);
  const i = Math.min(RACING_LAP_SEGS - 1, Math.floor(f));
  const t = f - i;
  const a = points[i]!;
  const b = points[i + 1]!;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export interface RacingRunMoments {
  /** Where each trip onto the grass or gravel began (race distance). */
  offs: number[];
  /** Where each tyre-wall impact happened (race distance). */
  walls: number[];
  /** Bit k = sector k (0 … 7) clean, as the sim counted it. */
  cleanMask: number;
  clean: number;
  /** Each completed lap's time in ticks (from lights out on the first). */
  lapTicks: number[];
  /** The race's average speed, tenths of a km/h (the score's pace). */
  pace10: number;
  finished: boolean;
  /** Share of the race covered (0 … 1). */
  covered: number;
  state: RacingState;
}

/** Steps a run's log through the sim on its revision and notes its moments. */
export function racingRunMoments(seed: number, rev: number | null | undefined, events: readonly ArcadeInputEvent[], level?: unknown): RacingRunMoments {
  const game = racingGameFor(rev, racingLevelOf(level));
  const byTick = new Map(events.map((e) => [e.t, e]));
  let st = game.init(seed);
  const offs: number[] = [];
  const walls: number[] = [];
  const lapAt: number[] = [];
  const go = racingGoTick(st.rev);
  while (!game.isOver(st) && st.tick < game.runTicks + 1) {
    const prev = st;
    st = game.step(st, byTick.get(st.tick + 1) ?? null);
    if (st.off && !prev.off) offs.push(st.s);
    if (st.wallHits > prev.wallHits) walls.push(st.s);
    if (Math.floor(st.s / RACING_LAP) > Math.floor(prev.s / RACING_LAP)) lapAt.push(st.tick);
  }
  const lapTicks = lapAt.map((t, i) => t - (i === 0 ? go : lapAt[i - 1]!));
  return {
    offs,
    walls,
    cleanMask: st.cleanMask,
    clean: st.clean,
    lapTicks,
    pace10: racingPace10(st),
    finished: st.finishTick > 0,
    covered: Math.min(st.s, RACING_TOTAL) / RACING_TOTAL,
    state: st,
  };
}

/** A lap sector's (0 … 3) cleanliness over both laps: how many of its two passes were clean. */
export function racingSectorCleanCount(cleanMask: number, sector: number): number {
  const per = RACING_SECTORS / 2;
  return ((cleanMask >> sector) & 1) + ((cleanMask >> (sector + per)) & 1);
}

/** The lap segment a race distance falls on (re-exported for the summary). */
export const racingMapSeg = racingSegAt;
