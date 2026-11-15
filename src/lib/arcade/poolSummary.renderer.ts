/**
 * Cue Ball's run summary on the reveal (the Sports overhaul; display only): the table from above, turned on its side
 * to the reveal column's full width, with the balls left where the run ended, every ball potted drawn on the pocket it
 * went into with its order (1 = the first pot), every foul marked in red where the cue ball lay, and every scratch as a
 * red ring on its pocket. Pots, numbers and marks are drawn at twice the table's own scale (at least 1.6×), so they
 * read at arm's length. Text is always drawn upright (the table turns, its labels don't).
 */
import { drawPool, drawPoolBallAt } from "./pool.renderer";
import { POOL_BALL_R, POOL_CB, POOL_CL, POOL_CR, POOL_CT, POOL_POCKETS, POOL_RAIL, POOL_SET_SPOTS, poolShownId } from "./pool";
import type { PoolRunEvents } from "./poolRunEvents";

const FONT = "'Archivo', system-ui, sans-serif";
/** The table's box in world px (rails included). */
const X0 = POOL_CL - POOL_RAIL;
const X1 = POOL_CR + POOL_RAIL;
const Y0 = POOL_CT - POOL_RAIL;
const Y1 = POOL_CB + POOL_RAIL;
/** Room above and below the turned table (CSS px), where the pockets lie: the potted balls and their numbers. */
export const POOL_SUMMARY_MARGIN = 22;
/** How much larger than the table's own scale the pots, their numbers and the foul marks are drawn. */
export const POOL_SUMMARY_MARK_SCALE = 2;

/** The table's scale (CSS px per world px) at a canvas width: the turned table spans the whole width. */
export function poolSummaryScale(w: number): number {
  return w / (Y1 - Y0);
}

/** The canvas's height for a width: the turned table plus its top and bottom margins. */
export function poolSummaryHeight(w: number): number {
  return Math.round((X1 - X0) * poolSummaryScale(w) + 2 * POOL_SUMMARY_MARGIN);
}

/** World (x, y) → canvas (CSS px) on the turned table: the world's y runs right → left, its x top → bottom. */
export function poolSummaryMap(w: number): { k: number; at: (x: number, y: number) => { x: number; y: number } } {
  const k = poolSummaryScale(w);
  return { k, at: (x, y) => ({ x: (Y1 - y) * k, y: POOL_SUMMARY_MARGIN + (x - X0) * k }) };
}

/** The sizes the summary draws its marks at for a width (exported for the check). */
export function poolSummarySizes(w: number): { tableBallR: number; potR: number; numberR: number; foulR: number } {
  const k = poolSummaryScale(w);
  const tableBallR = (POOL_BALL_R + 1.5) * k;
  return { tableBallR, potR: tableBallR * POOL_SUMMARY_MARK_SCALE, numberR: Math.max(7, tableBallR * 1.7), foulR: Math.max(8, tableBallR * 1.9) };
}

/**
 * The pots' landing (stage 2's reveal payoff): `pots` pots drawn in place, and the next one `land` of the way in (0…1:
 * dropping from above its spot, growing from 1.6× and fading in). Omitted: every pot in place (the final state).
 */
export interface PoolSummaryLanding {
  pots: number;
  land: number;
}

export function drawPoolSummary(ctx: CanvasRenderingContext2D, w: number, h: number, ev: PoolRunEvents, landing?: PoolSummaryLanding): void {
  ctx.clearRect(0, 0, w, h);
  const { k, at } = poolSummaryMap(w);
  const m = POOL_SUMMARY_MARGIN;
  // The table as it was left, turned (the renderer's own art; ball numbers turned back upright).
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, m, w, (X1 - X0) * k);
  ctx.clip();
  ctx.translate(Y1 * k, m - X0 * k);
  ctx.rotate(Math.PI / 2);
  ctx.scale(k, k);
  // The world turned a quarter turn: canvas x = (Y1 - y)k, canvas y = m + (x - X0)k.
  const shown = { ...ev.state, balls: ev.state.balls.filter((b) => !b.down), potTick: 0, shots: Math.max(1, ev.state.shots) };
  drawPool(ctx, shown, null, true);
  ctx.restore();
  const set = ev.state.set ?? POOL_SET_SPOTS;
  const { potR: r, numberR, foulR } = poolSummarySizes(w);
  // Potted balls on their pockets (every pocket lies on the top or bottom edge once turned), outward from the table,
  // then stepping along the rail towards the middle, in the order they went down.
  const midX = w / 2;
  const perPocket = new Map<number, number>();
  ev.pots.forEach((pot, order) => {
    const p = POOL_POCKETS[pot.pocket]!;
    const pw = at(p.x / 256, p.y / 256);
    const up = pw.y < m + ((X1 - X0) * k) / 2 ? -1 : 1;
    const along = pw.x > midX + 1 ? -1 : pw.x < midX - 1 ? 1 : 1;
    const i = perPocket.get(pot.pocket) ?? 0;
    perPocket.set(pot.pocket, i + 1);
    // The landing: pots after the one arriving aren't drawn yet; the arriving one drops in, larger and fading in.
    if (landing && order > landing.pots) return;
    const arriving = landing && order === landing.pots ? Math.max(0, Math.min(1, landing.land)) : 1;
    if (arriving <= 0) return;
    const bx = Math.min(w - r - 1, Math.max(r + 1, pw.x + along * i * r * 2.15));
    const by = pw.y + up * r * 0.25 - (1 - arriving) * r * 2.5;
    ctx.save();
    ctx.globalAlpha = (pot.mine ? 1 : 0.85) * arriving;
    drawPoolBallAt(ctx, poolShownId(pot.id, set), bx, by, r * (1 + 0.6 * (1 - arriving)));
    ctx.restore();
    if (arriving < 1) return;
    // The pot's order in a gold disc beside the ball, out towards the table's edge (a foul's ball in red).
    const tx = bx + along * r * 0.75;
    const ty = by + up * r * 0.95;
    ctx.fillStyle = pot.mine ? "#F2C75C" : "#E5484D";
    ctx.strokeStyle = "rgba(12,9,6,0.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(tx, ty, numberR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#16110A";
    ctx.font = `800 ${Math.round(numberR * 1.4)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(order + 1), tx, ty + 0.5);
  });
  // Scratches: a red ring round the pocket the cue ball went into.
  for (const s of ev.scratches) {
    const p = POOL_POCKETS[s.pocket]!;
    const pw = at(p.x / 256, p.y / 256);
    ctx.strokeStyle = "#E5484D";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(pw.x, pw.y, r * 1.3, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Fouls: a red disc with an exclamation mark where the cue ball lay.
  for (const f of ev.fouls) {
    const q = at(f.x, f.y);
    ctx.fillStyle = "rgba(229,72,77,0.95)";
    ctx.beginPath();
    ctx.arc(q.x, q.y, foulR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1.8;
    ctx.stroke();
    // The mark drawn as shapes (no glyph to fall back): a bar and a dot.
    const u = foulR / 8;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(q.x - 1.2 * u, q.y - 4.8 * u, 2.4 * u, 5.8 * u);
    ctx.beginPath();
    ctx.arc(q.x, q.y + 3.4 * u, 1.3 * u, 0, Math.PI * 2);
    ctx.fill();
  }
}
