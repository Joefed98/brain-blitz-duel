import { successFrame, SUCCESS_ACCENTS } from "./success.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { BULLSEYE_FX } from "./arcadeFxGames.renderer";
/**
 * Bullseye in the Fairground world: painted wooden board on a hay bale,
 * throwing darts, chalk aim line. Render only; reads state, never writes it.
 * Rings use the sim's exact geometry and values; darts land at exact sim points.
 */
import type { CanvasSize } from "./engine";
import {
  BULLSEYE_ARROWS, BULLSEYE_BOW_X, BULLSEYE_BOW_Y, BULLSEYE_CX, BULLSEYE_CY,
  BULLSEYE_DRIFT_FROM, BULLSEYE_FLIGHT_TICKS, BULLSEYE_GOLD, BULLSEYE_OUTER_R, BULLSEYE_RINGS,
  BULLSEYE_RING_STEP, BULLSEYE_TEXT, BULLSEYE_WIND_MAX, BULLSEYE_WORLD_H, BULLSEYE_WORLD_W,
  BULLSEYE_BALLOON_R, BULLSEYE_INNER_BULL_DIV, BULLSEYE_REV, BULLSEYE_TUNE,
  bullseyeBalloonPos, bullseyeBalloonValue, bullseyeRingValues, bullseyeScalePct, bullseyeTargetDx, type BullseyeState,
} from "./bullseye";
import { flightpathColour, flightpathInk } from "./flightpathPalette.renderer";
import { reducedMotion } from "./art.renderer";
import {
  FAIR_CHALK, FAIR_WOOD, FAIR_WOOD_DARK, fairChangeAge, fairPennant, fairScreen, fairTransform,
} from "./fairground.renderer";

/** The counter line: below the resting dart's flights. */
const COUNTER_Y = 546;
const DART_TIP_Y = BULLSEYE_BOW_Y - 26;
const FLIGHT_COLOURS = ["#D9363E", "#2ED3B7", "#F5B82E", "#3B82F6", "#A78BFA"];

/** A throwing dart, tip at (x, y) pointing up; `wobble` swings the flights. */
export function drawDart(
  ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, colour: string, wobble = 0,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  // Steel point.
  ctx.fillStyle = "#3C424C";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(1.1, 8);
  ctx.lineTo(-1.1, 8);
  ctx.closePath();
  ctx.fill();
  // Barrel with knurl lines.
  ctx.fillStyle = "#23262C";
  ctx.fillRect(-2, 8, 4, 9);
  ctx.fillStyle = "#8C939E";
  for (let k = 10; k < 17; k += 2) ctx.fillRect(-2, k, 4, 0.7);
  // Shaft.
  ctx.fillStyle = "#1A1C20";
  ctx.fillRect(-0.7, 17, 1.4, 6);
  // Feather flights.
  ctx.translate(0, 21);
  ctx.transform(1, 0, wobble, 1, 0, 0);
  ctx.fillStyle = colour;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
  ctx.lineWidth = 0.6;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(5.5 * side, 4);
    ctx.lineTo(5 * side, 10);
    ctx.lineTo(0, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** Rev 2: the inner bull, the sim's exact disc, gold with a white spark. */
function drawInnerBull(ctx: CanvasRenderingContext2D, scalePct: number, dx: number): void {
  const r = (BULLSEYE_OUTER_R * scalePct) / (100 * BULLSEYE_INNER_BULL_DIV);
  ctx.save();
  ctx.fillStyle = "#FFF4C2";
  ctx.beginPath();
  ctx.arc(BULLSEYE_CX + dx, BULLSEYE_CY, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#B8860B";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

const BALLOON_COLOURS = ["#E8384F", "#3B82F6", "#22C55E", "#A855F7"];
/** bullRev 4: balloon colour by value, +1 green, +2 blue, +3 purple. */
const VALUE_BALLOON_COLOURS: Readonly<Record<number, string>> = { 1: "#22C55E", 2: "#3B82F6", 3: "#A855F7" };

function balloonColour(state: BullseyeState, arrow: number): string {
  if (state.tune === BULLSEYE_TUNE) return VALUE_BALLOON_COLOURS[bullseyeBalloonValue(state, arrow)] ?? "#22C55E";
  return BALLOON_COLOURS[arrow % BALLOON_COLOURS.length]!;
}

/** Rev 2 / bullRev 4: a fairground balloon whose body is exactly the sim's pop circle. */
function drawBalloon(ctx: CanvasRenderingContext2D, x: number, y: number, colour: string, label = "12"): void {
  const r = BULLSEYE_BALLOON_R;
  ctx.save();
  // A short tied string below the knot (2 px: within the bounds rule).
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(x - 2, y + r + 2);
  ctx.lineTo(x + 2, y + r + 2);
  ctx.lineTo(x, y + r - 1);
  ctx.closePath();
  ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 1, x, y, r);
  g.addColorStop(0, "#FFFFFF");
  g.addColorStop(0.18, colour);
  g.addColorStop(1, colour);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // A white rim (inside the 2 px bounds rule) keeps it readable over any ring colour.
  ctx.strokeStyle = label === "12" ? "rgba(0, 0, 0, 0.35)" : "#FFFFFF";
  ctx.lineWidth = label === "12" ? 1 : 1.5;
  ctx.stroke();
  ctx.font = label === "12" ? "700 9px 'JetBrains Mono', ui-monospace, monospace" : "800 11px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (label !== "12") {
    ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.strokeText(label, x, y + 1);
  }
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(label, x, y + 1);
  ctx.restore();
}

/** Rev 2: rubber shreds flying out from a popped balloon. Presentation clock only. */
function drawBalloonPop(ctx: CanvasRenderingContext2D, x: number, y: number, colour: string, age: number): void {
  if (age > 420) return;
  const u = age / 420;
  ctx.save();
  ctx.globalAlpha = 1 - u;
  ctx.fillStyle = colour;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    const d = BULLSEYE_BALLOON_R * (0.6 + u * 1.8);
    ctx.fillRect(x + Math.cos(a) * d - 2, y + Math.sin(a) * d - 1.5, 4, 3);
  }
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, BULLSEYE_BALLOON_R * (1 + u), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBoard(ctx: CanvasRenderingContext2D, scalePct: number, dx: number, values: readonly number[], drifting: boolean): void {
  const outer = (BULLSEYE_OUTER_R * scalePct) / 100;
  const cx = BULLSEYE_CX + dx;
  const cy = BULLSEYE_CY;
  ctx.save();
  // Rail behind the counter for the drifting target.
  if (drifting) {
    const railY = cy + outer + 30;
    ctx.fillStyle = "#2A2E36";
    ctx.fillRect(BULLSEYE_CX - 170, railY, 340, 4);
    ctx.fillStyle = "#555C68";
    ctx.fillRect(BULLSEYE_CX - 170, railY, 340, 1);
    for (const wx of [cx - 24, cx + 24]) {
      ctx.fillStyle = "#15171B";
      ctx.beginPath();
      ctx.arc(wx, railY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Hay bale under the board.
  const bw = outer * 2.1;
  const bTop = cy + outer * 0.35;
  const bBot = cy + outer + 26;
  ctx.fillStyle = "#C9A24A";
  ctx.fillRect(cx - bw / 2, bTop, bw, bBot - bTop);
  ctx.strokeStyle = "rgba(120, 86, 30, 0.6)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    const sx = cx - bw / 2 + 6 + ((i * 37) % Math.max(1, bw - 12));
    const sy = bTop + 5 + ((i * 23) % Math.max(1, bBot - bTop - 10));
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 8, sy + 2 - (i % 3));
    ctx.stroke();
  }
  ctx.fillStyle = "#6E4A1E";
  ctx.fillRect(cx - bw / 2 + bw * 0.22, bTop, 3, bBot - bTop);
  ctx.fillRect(cx + bw / 2 - bw * 0.22 - 3, bTop, 3, bBot - bTop);
  // Wooden board: a 2 px wood rim beyond the outer ring.
  ctx.fillStyle = FAIR_WOOD;
  ctx.beginPath();
  ctx.arc(cx, cy, outer + 2, 0, Math.PI * 2);
  ctx.fill();
  // Painted rings, exact sim radii, in their value colours.
  for (let ring = BULLSEYE_RINGS; ring >= 1; ring--) {
    const radius = (BULLSEYE_RING_STEP * ring * scalePct) / 100;
    const value = values[ring - 1] ?? 0;
    ctx.fillStyle = flightpathColour(value);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(30, 18, 10, 0.75)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // Wood grain through the paint.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, outer + 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = FAIR_WOOD_DARK;
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = 1;
  for (let gy = cy - outer; gy < cy + outer; gy += 9) {
    ctx.beginPath();
    ctx.moveTo(cx - outer - 2, gy);
    ctx.bezierCurveTo(cx - outer / 3, gy + 3, cx + outer / 3, gy - 3, cx + outer + 2, gy + 1);
    ctx.stroke();
  }
  ctx.restore();
  ctx.font = "700 9px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let index = 0; index < BULLSEYE_RINGS; index++) {
    const o = (BULLSEYE_RING_STEP * (index + 1) * scalePct) / 100;
    const inner = index === 0 ? 0 : (BULLSEYE_RING_STEP * index * scalePct) / 100;
    const value = values[index] ?? 0;
    ctx.fillStyle = flightpathInk(value);
    ctx.fillText(String(value), cx, cy - Math.max(8, (o + inner) / 2));
  }
  ctx.restore();
}

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
  fairPennant(ctx, BULLSEYE_WORLD_W - 30, 10, wind, BULLSEYE_WIND_MAX);
}

const flightColour = (arrow: number) => FLIGHT_COLOURS[arrow % FLIGHT_COLOURS.length]!;

export function drawBullseye(ctx: CanvasRenderingContext2D, state: BullseyeState, size: CanvasSize): void {
  const shown = state.flightTick > 0 ? Math.max(0, state.arrowIndex - 1)
    : Math.min(state.arrowIndex, BULLSEYE_ARROWS - 1);
  const landAge = fairChangeAge(ctx, "bullseye-landed", state.flightTick === 0 ? state.hits.length : -1);
  fairScreen(ctx, size, BULLSEYE_WORLD_W, BULLSEYE_WORLD_H, COUNTER_Y, () => arcadeFx(ctx, BULLSEYE_FX, state, () => {
    const dx = bullseyeTargetDx(shown, state.tick, state.driftPhase, state.driftDir);
    drawBoard(ctx, bullseyeScalePct(shown), dx, bullseyeRingValues(state, shown), shown >= BULLSEYE_DRIFT_FROM);
    if (state.rev === BULLSEYE_REV && bullseyeRingValues(state, shown)[0] === 10) drawInnerBull(ctx, bullseyeScalePct(shown), dx);

    const last = state.hits[state.hits.length - 1];
    // Rev 2 / bullRev 4: this dart's balloon floats until the dart lands; a popped one bursts.
    const tuned = state.tune === BULLSEYE_TUNE;
    const balloonAt = bullseyeBalloonPos(state, shown, state.tick);
    const popped = last?.pop === 1 && last.arrow === shown;
    if (balloonAt && !(popped && state.flightTick === 0)) {
      drawBalloon(ctx, balloonAt.x, balloonAt.y, balloonColour(state, shown), tuned ? `+${bullseyeBalloonValue(state, shown)}` : "12");
    }
    if (last?.pop === 1 && state.flightTick === 0 && !reducedMotion()) {
      drawBalloonPop(ctx, last.x, last.y, balloonColour(state, last.arrow), landAge);
    }
    if (last && state.flightTick === 0) {
      // Stuck in at its exact sim point; flights wobble once on landing.
      const wobble = !reducedMotion() && landAge < 450
        ? Math.sin(landAge / 30) * 0.35 * (1 - landAge / 450) : 0;
      // Rev 2: a dart that popped a balloon is gone with it. bullRev 4: it carries on into the board.
      if (last.pop !== 1 || tuned) drawDart(ctx, last.x, last.y, 0.45, flightColour(last.arrow), wobble);
      if (landAge < 500) {
        const u = landAge / 500;
        const pop = reducedMotion() ? 1 : 1 + 0.2 * Math.sin(Math.min(1, u * 4) * Math.PI);
        ctx.save();
        ctx.translate(last.x, last.y - 14 - (reducedMotion() ? 0 : u * 8));
        ctx.scale(pop, pop);
        ctx.globalAlpha = u < 0.3 ? 1 : (1 - u) / 0.7;
        ctx.fillStyle = BULLSEYE_GOLD;
        ctx.font = "700 20px 'JetBrains Mono', ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        // bullRev 4: the ring's points at the dart, and the balloon's own +n beside them in its colour.
        const bal = last.bal ?? 0;
        ctx.fillText(String(last.value - bal), 0, 0);
        if (bal > 0) {
          ctx.font = "800 16px 'JetBrains Mono', ui-monospace, monospace";
          ctx.fillStyle = balloonColour(state, last.arrow);
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 3;
          ctx.lineJoin = "round";
          ctx.strokeText(`+${bal}`, 0, -20);
          ctx.fillText(`+${bal}`, 0, -20);
        }
        ctx.restore();
      }
    }
    const isBull=(h:{ring:number;value:number;bal?:number})=>h.ring===0&&h.value-(h.bal??0)>=10;
    successFrame(ctx,{id:'bullseye',tick:state.tick,count:state.flightTick===0?state.hits.filter(isBull).length:Math.max(0,state.hits.filter(isBull).length-(last&&isBull(last)?1:0)),enabled:state.flightTick===0&&!!last&&isBull(last),colour:BULLSEYE_GOLD,width:BULLSEYE_WORLD_W,height:BULLSEYE_WORLD_H,point:{x:last?.x??BULLSEYE_CX,y:last?.y??BULLSEYE_CY,shape:'spark'}});
    if (last && state.flightTick > 0) {
      const progress = (BULLSEYE_FLIGHT_TICKS - state.flightTick) / BULLSEYE_FLIGHT_TICKS;
      const x = BULLSEYE_BOW_X + (last.x - BULLSEYE_BOW_X) * progress;
      const y = DART_TIP_Y + (last.y - DART_TIP_Y) * progress;
      if (!reducedMotion()) {
        const back = Math.max(0, progress - 0.25);
        ctx.save();
        ctx.strokeStyle = FAIR_CHALK;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(BULLSEYE_BOW_X + (last.x - BULLSEYE_BOW_X) * back, DART_TIP_Y + (last.y - DART_TIP_Y) * back + 10);
        ctx.lineTo(x, y + 10 * (1 - 0.55 * progress));
        ctx.stroke();
        ctx.restore();
      }
      drawDart(ctx, x, y, 1.2 - 0.75 * progress, flightColour(last.arrow));
    }
    if (state.arrowIndex < BULLSEYE_ARROWS) drawWind(ctx, state.winds[state.arrowIndex] ?? 0);
    if (state.arrowIndex < BULLSEYE_ARROWS && state.flightTick === 0) {
      drawDart(ctx, BULLSEYE_BOW_X, DART_TIP_Y, 1.2, flightColour(state.arrowIndex));
    }
    ctx.font = "600 19.5px 'JetBrains Mono', ui-monospace, monospace";
    ctx.fillStyle = BULLSEYE_TEXT;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    const shownArrow = Math.min(BULLSEYE_ARROWS, state.arrowIndex + 1);
    ctx.fillText(`Dart ${shownArrow} / ${BULLSEYE_ARROWS} · ${state.total} pts`, 12, 12);
  }), [0.08, 0.3]);
}

/** Chalk aim line from the dart to the predicted landing point. Render only. */
export function bullseyeArtAim(ctx: CanvasRenderingContext2D, size: CanvasSize, landing: { x: number; y: number }): void {
  const { scale, offsetX, offsetY } = fairTransform(size, BULLSEYE_WORLD_W, BULLSEYE_WORLD_H);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.strokeStyle = FAIR_CHALK;
  ctx.globalAlpha = 0.42;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(BULLSEYE_BOW_X, DART_TIP_Y);
  ctx.lineTo(landing.x, landing.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(landing.x, landing.y, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
