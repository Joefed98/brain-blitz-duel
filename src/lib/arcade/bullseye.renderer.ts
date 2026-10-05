import type { CanvasSize } from "./engine";
import {
  BULLSEYE_ARROWS, BULLSEYE_BG, BULLSEYE_BOW_X, BULLSEYE_BOW_Y,
  BULLSEYE_FLIGHT_TICKS, BULLSEYE_GOLD, BULLSEYE_TEXT, BULLSEYE_WORLD_W,
  bullseyeDrawTarget, bullseyeRingValues, bullseyeScalePct,
  bullseyeTargetDx, bullseyeTransform, type BullseyeState,
} from "./bullseye";

/** One outlined silhouette for shaft, arrowhead and fletching. */
export function drawBullseyeArrow(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1): void {
  const tokens = getComputedStyle(ctx.canvas);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = tokens.getPropertyValue("--bullseye-arrow").trim();
  ctx.strokeStyle = tokens.getPropertyValue("--bullseye-arrow-outline").trim();
  ctx.lineWidth = 1;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.lineTo(5, -18);
  ctx.lineTo(1.5, -20);
  ctx.lineTo(1.5, 4);
  ctx.lineTo(5, 9);
  ctx.lineTo(5, 13);
  ctx.lineTo(1.5, 10);
  ctx.lineTo(1.5, 12);
  ctx.lineTo(-1.5, 12);
  ctx.lineTo(-1.5, 10);
  ctx.lineTo(-5, 13);
  ctx.lineTo(-5, 9);
  ctx.lineTo(-1.5, 4);
  ctx.lineTo(-1.5, -20);
  ctx.lineTo(-5, -18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// Wind, target, bow and HUD retain the existing renderer's geometry and colours.
function drawWind(ctx: CanvasRenderingContext2D, wind: number): void {
  const centreX = BULLSEYE_WORLD_W / 2;
  const y = 84;
  ctx.save();
  ctx.strokeStyle = wind === 0 ? "#F7F7F855" : BULLSEYE_GOLD;
  ctx.lineWidth = 2.8;
  if (wind !== 0) {
    const dir = wind < 0 ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(centreX - 33.6 * dir, y);
    ctx.lineTo(centreX + 33.6 * dir, y);
    ctx.lineTo(centreX + 22.4 * dir, y - 8.4);
    ctx.moveTo(centreX + 33.6 * dir, y);
    ctx.lineTo(centreX + 22.4 * dir, y + 8.4);
    ctx.stroke();
  }
  ctx.font = "600 18.2px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = BULLSEYE_TEXT;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(wind === 0 ? "no wind" : `${wind < 0 ? "←" : "→"} ${Math.abs(wind)}`, centreX, y - 18);
  ctx.restore();
}

export function drawBullseye(ctx: CanvasRenderingContext2D, state: BullseyeState, size: CanvasSize): void {
  const { scale, offsetX, offsetY } = bullseyeTransform(size);
  const shown = state.flightTick > 0 ? Math.max(0, state.arrowIndex - 1)
    : Math.min(state.arrowIndex, BULLSEYE_ARROWS - 1);
  ctx.save();
  ctx.fillStyle = BULLSEYE_BG;
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  const shownDx = bullseyeTargetDx(shown, state.tick, state.driftPhase, state.driftDir);
  bullseyeDrawTarget(ctx, bullseyeScalePct(shown), shownDx, bullseyeRingValues(state, shown));
  const last = state.hits[state.hits.length - 1];
  if (last && state.flightTick === 0) {
    ctx.fillStyle = BULLSEYE_GOLD;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (last && state.flightTick > 0) {
    const progress = (BULLSEYE_FLIGHT_TICKS - state.flightTick) / BULLSEYE_FLIGHT_TICKS;
    const x = BULLSEYE_BOW_X + (last.x - BULLSEYE_BOW_X) * progress;
    const y = BULLSEYE_BOW_Y + (last.y - BULLSEYE_BOW_Y) * progress;
    drawBullseyeArrow(ctx, x, y, 0.3 + 0.7 * (1 - progress));
  }
  if (state.arrowIndex < BULLSEYE_ARROWS) drawWind(ctx, state.winds[state.arrowIndex] ?? 0);
  if (state.arrowIndex < BULLSEYE_ARROWS && state.flightTick === 0) {
    ctx.save();
    ctx.translate(BULLSEYE_BOW_X, BULLSEYE_BOW_Y);
    ctx.strokeStyle = "rgba(247, 247, 248, 0.65)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 10, 22, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    drawBullseyeArrow(ctx, BULLSEYE_BOW_X, BULLSEYE_BOW_Y);
  }
  ctx.font = "600 19.5px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = BULLSEYE_TEXT;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  const shownArrow = Math.min(BULLSEYE_ARROWS, state.arrowIndex + 1);
  ctx.fillText(`Arrow ${shownArrow} / ${BULLSEYE_ARROWS} · ${state.total} pts`, 12, 12);
  ctx.textAlign = "right";
  ctx.restore();
}