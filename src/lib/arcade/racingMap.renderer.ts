/**
 * Apex's run map on the answer reveal (the Sports overhaul, 15 Nov 2026; display only): the circuit from above, each
 * of its four sectors green where it was driven clean (solid on both laps, lighter on one), red marks where the car
 * went onto the grass or gravel (dots) or hit the tyre wall (rings), and the start line. Drawn large on the reveal's
 * gradient; no text inside the map (the numbers and their labels sit under it, in the page).
 */
import { racingMapAt, racingMapPoints, racingSectorCleanCount, type MapPoint, type RacingRunMoments } from "./racingMap";
import { RACING_LAP, RACING_LAP_SEGS, RACING_SECTORS, type RacingTrack } from "./racing";

type Ctx2D = CanvasRenderingContext2D;

export const RACING_MAP_COLOURS = {
  edge: "rgba(6,6,10,0.85)",
  road: "#5A5866",
  clean: "#3DDC84",
  cleanOnce: "rgba(61,220,132,0.5)",
  off: "#FF5A4E",
  ring: "#FFFFFF",
  start: "#F3F1EC",
};

function path(ctx: Ctx2D, pts: readonly MapPoint[], map: (p: MapPoint) => MapPoint, from: number, to: number): void {
  ctx.beginPath();
  for (let i = from; i <= to; i++) {
    const q = map(pts[i]!);
    if (i === from) ctx.moveTo(q.x, q.y);
    else ctx.lineTo(q.x, q.y);
  }
}

/** Draws the map into a size × size square at (x, y). */
export function drawRacingRunMap(ctx: Ctx2D, track: RacingTrack, run: RacingRunMoments | null, x: number, y: number, size: number): void {
  const pts = racingMapPoints(track);
  const pad = size * 0.08;
  const s = size - pad * 2;
  const map = (p: MapPoint): MapPoint => ({ x: x + pad + p.x * s, y: y + pad + p.y * s });
  const width = Math.max(8, size * 0.045);
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  path(ctx, pts, map, 0, RACING_LAP_SEGS);
  ctx.strokeStyle = RACING_MAP_COLOURS.edge;
  ctx.lineWidth = width + 6;
  ctx.stroke();
  ctx.strokeStyle = RACING_MAP_COLOURS.road;
  ctx.lineWidth = width;
  ctx.stroke();
  // Sectors driven clean: the lap's quarter in green (solid: clean on both laps; lighter: on one).
  if (run) {
    const per = RACING_SECTORS / 2;
    const segs = RACING_LAP_SEGS / per;
    for (let k = 0; k < per; k++) {
      const n = racingSectorCleanCount(run.cleanMask, k);
      if (!n) continue;
      path(ctx, pts, map, Math.round(k * segs), Math.round((k + 1) * segs));
      ctx.strokeStyle = n === 2 ? RACING_MAP_COLOURS.clean : RACING_MAP_COLOURS.cleanOnce;
      ctx.lineWidth = width * 0.62;
      ctx.lineCap = "butt";
      ctx.stroke();
    }
  }
  // The start line across the track, and a small arrow for the direction.
  const a = map(pts[0]!);
  const b = map(pts[3]!);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  ctx.strokeStyle = RACING_MAP_COLOURS.start;
  ctx.lineWidth = Math.max(3, width * 0.35);
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(a.x - nx * width * 0.95, a.y - ny * width * 0.95);
  ctx.lineTo(a.x + nx * width * 0.95, a.y + ny * width * 0.95);
  ctx.stroke();
  // The run's marks: grass and gravel (dots), the tyre wall (rings), on the side of the track they happened.
  if (run) {
    const r = Math.max(5, width * 0.42);
    const mark = (sDist: number, ring: boolean) => {
      const p = map(racingMapAt(pts, sDist));
      ctx.beginPath();
      ctx.arc(p.x, p.y, ring ? r * 1.25 : r, 0, Math.PI * 2);
      if (ring) {
        ctx.fillStyle = RACING_MAP_COLOURS.off;
        ctx.fill();
        ctx.lineWidth = Math.max(2, r * 0.45);
        ctx.strokeStyle = RACING_MAP_COLOURS.ring;
        ctx.stroke();
      } else {
        ctx.fillStyle = RACING_MAP_COLOURS.off;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = RACING_MAP_COLOURS.edge;
        ctx.stroke();
      }
    };
    for (const sd of run.offs) mark(sd, false);
    for (const sd of run.walls) mark(sd, true);
  }
  ctx.restore();
}

/** Where a race distance falls on the map (checks: the marks sit on the track). */
export function racingMapMarkAt(track: RacingTrack, sDist: number): MapPoint {
  return racingMapAt(racingMapPoints(track), sDist % RACING_LAP);
}
