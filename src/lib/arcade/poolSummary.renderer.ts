/**
 * Cue Ball's run summary on the reveal (the Sports overhaul; display only): the table from above, turned on its side
 * to fill the phone's width, with the balls left where the run ended, every ball potted drawn beside the pocket it
 * went into with its order (1 = the first pot), every foul marked in red where the cue ball lay, and every scratch as
 * a red ring on its pocket. Text is always drawn upright (the table turns, its labels don't).
 */
import { drawPool, drawPoolBallAt } from "./pool.renderer";
import { POOL_CB, POOL_CL, POOL_CR, POOL_CT, POOL_POCKETS, POOL_RAIL, POOL_SET_SPOTS, poolShownId } from "./pool";
import type { PoolRunEvents } from "./poolRunEvents";

const FONT = "'Archivo', system-ui, sans-serif";
/** The table's box in world px (rails included). */
const X0 = POOL_CL - POOL_RAIL;
const X1 = POOL_CR + POOL_RAIL;
const Y0 = POOL_CT - POOL_RAIL;
const Y1 = POOL_CB + POOL_RAIL;
/** Room round the table (CSS px) for the potted balls beside their pockets. */
export const POOL_SUMMARY_MARGIN = 24;

/** The canvas's height for a width: the turned table plus its margin. */
export function poolSummaryHeight(w: number): number {
  const k = (w - 2 * POOL_SUMMARY_MARGIN) / (Y1 - Y0);
  return Math.round((X1 - X0) * k + 2 * POOL_SUMMARY_MARGIN);
}

/** World (x, y) → canvas (CSS px) on the turned table: the world's y runs left → right, its x top → bottom. */
export function poolSummaryMap(w: number): { k: number; at: (x: number, y: number) => { x: number; y: number } } {
  const m = POOL_SUMMARY_MARGIN;
  const k = (w - 2 * m) / (Y1 - Y0);
  return { k, at: (x, y) => ({ x: m + (Y1 - y) * k, y: m + (x - X0) * k }) };
}

export function drawPoolSummary(ctx: CanvasRenderingContext2D, w: number, h: number, ev: PoolRunEvents): void {
  ctx.clearRect(0, 0, w, h);
  const { k, at } = poolSummaryMap(w);
  const m = POOL_SUMMARY_MARGIN;
  // The table as it was left, turned (the renderer's own art; ball numbers turned back upright).
  ctx.save();
  ctx.beginPath();
  ctx.rect(m, m, (Y1 - Y0) * k, (X1 - X0) * k);
  ctx.clip();
  ctx.translate(m + Y1 * k, m - X0 * k);
  ctx.rotate(Math.PI / 2);
  ctx.scale(k, k);
  // The world turned a quarter turn: x' = -y, y' = x, so the canvas x = m + (Y1 - y)k and y = m + (x - X0)k.
  const shown = { ...ev.state, balls: ev.state.balls.filter((b) => !b.down), potTick: 0, shots: Math.max(1, ev.state.shots) };
  drawPool(ctx, shown, null, true);
  ctx.restore();
  const set = ev.state.set ?? POOL_SET_SPOTS;
  const r = 9.5;
  // Potted balls beside their pockets, outward from the table's centre, in the order they went down.
  const cx = (X0 + X1) / 2;
  const cy = (Y0 + Y1) / 2;
  const perPocket = new Map<number, number>();
  ev.pots.forEach((pot, order) => {
    const p = POOL_POCKETS[pot.pocket]!;
    const pw = at(p.x / 256, p.y / 256);
    const c = at(cx, cy);
    let dx = pw.x - c.x;
    let dy = pw.y - c.y;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    const i = perPocket.get(pot.pocket) ?? 0;
    perPocket.set(pot.pocket, i + 1);
    // The first sits on the pocket, the next ones step along the rail (sideways) so a busy pocket stays readable.
    const side = Math.abs(dx) > Math.abs(dy) ? { x: 0, y: dy > 0 ? -1 : 1 } : { x: dx > 0 ? -1 : 1, y: 0 };
    const bx = pw.x + dx * r * 0.7 + side.x * i * r * 2.2;
    const by = pw.y + dy * r * 0.7 + side.y * i * r * 2.2;
    ctx.save();
    if (!pot.mine) ctx.globalAlpha = 0.85;
    drawPoolBallAt(ctx, poolShownId(pot.id, set), bx, by, r);
    ctx.restore();
    // The pot's order in a small gold disc on the ball's outer edge (a foul's ball rimmed red).
    // Beside the ball on its outer side (the table's centre is the other way), never over its face.
    const tx = bx + dx * (r + 7);
    const ty = by + dy * (r + 7);
    ctx.fillStyle = pot.mine ? "#F2C75C" : "#E5484D";
    ctx.beginPath();
    ctx.arc(tx, ty, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#16110A";
    ctx.font = `800 10px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(order + 1), tx, ty + 0.5);
  });
  // Scratches: a red ring on the pocket the cue ball went into.
  for (const s of ev.scratches) {
    const p = POOL_POCKETS[s.pocket]!;
    const pw = at(p.x / 256, p.y / 256);
    ctx.strokeStyle = "#E5484D";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(pw.x, pw.y, r * 1.35, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Fouls: a red disc with an exclamation mark where the cue ball lay.
  for (const f of ev.fouls) {
    const q = at(f.x, f.y);
    ctx.fillStyle = "rgba(229,72,77,0.95)";
    ctx.beginPath();
    ctx.arc(q.x, q.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // The mark drawn as shapes (no glyph to fall back): a bar and a dot.
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(q.x - 1.1, q.y - 4.6, 2.2, 5.6);
    ctx.beginPath();
    ctx.arc(q.x, q.y + 3.3, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
}
