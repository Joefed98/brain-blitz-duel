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
import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";
import {
  FAIR_CHALK, FAIR_WOOD, FAIR_WOOD_DARK, fairArenaScene, fairChangeAge, fairPennant, fairScreen, fairTransform,
} from "./fairground.renderer";
import type { ArenaSceneView } from "./arenaScene.renderer";

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
  const barrel = ctx.createLinearGradient(-2, 0, 2, 0);
  barrel.addColorStop(0, "#4A505A");
  barrel.addColorStop(0.4, "#23262C");
  barrel.addColorStop(1, "#15171B");
  ctx.fillStyle = barrel;
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
  // Shaded far edge and a soft gloss streak (inside the circle).
  const edge = ctx.createRadialGradient(x - r * 0.2, y - r * 0.25, r * 0.4, x, y, r);
  edge.addColorStop(0, "rgba(0,0,0,0)");
  edge.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = edge;
  ctx.fill();
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(x, y, r * 0.7, Math.PI * 1.15, Math.PI * 1.4);
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
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

const boardSprites = new Map<string, ArtCanvas | null>();

/**
 * The board on its hay bale with the lamp glow behind it, cached per size,
 * ring values and device scale and blitted at the drifted centre (the sprite
 * is painted at the same world size, so every ring keeps its sim radius).
 */
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
  ctx.restore();
  const half = Math.ceil(outer * 1.9);
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  const k = t ? Math.max(0.1, Math.hypot(t.a, t.b)) : 1;
  const px = Math.max(1, Math.round(half * 2 * k));
  const id = `${scalePct}|${values.join(",")}|${px}`;
  let sprite = boardSprites.get(id);
  if (sprite === undefined) {
    if (boardSprites.size >= 12) boardSprites.clear();
    const canvas = artCanvas(px, px);
    const c = canvas ? artContext(canvas) : null;
    if (canvas && c) {
      c.scale(px / (half * 2), px / (half * 2));
      paintBoard(c as CanvasRenderingContext2D, half, half, scalePct, values);
    }
    sprite = canvas && c ? canvas : null;
    boardSprites.set(id, sprite);
  }
  if (sprite) ctx.drawImage(sprite as CanvasImageSource, cx - half, cy - half, half * 2, half * 2);
  else paintBoard(ctx, cx, cy, scalePct, values);
  // Ring values are drawn live, never cached, so they always use the loaded web font.
  ctx.save();
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

function paintBoard(ctx: CanvasRenderingContext2D, cx: number, cy: number, scalePct: number, values: readonly number[]): void {
  const outer = (BULLSEYE_OUTER_R * scalePct) / 100;
  ctx.save();
  // A warm stall lamp lighting the wall behind the board (background only).
  const spot = ctx.createRadialGradient(cx, cy, outer * 0.6, cx, cy, outer * 1.9);
  spot.addColorStop(0, "rgba(255,214,140,0.22)");
  spot.addColorStop(1, "rgba(255,214,140,0)");
  ctx.fillStyle = spot;
  ctx.fillRect(cx - outer * 1.9, cy - outer * 1.9, outer * 3.8, outer * 3.8);
  // Hay bale under the board: lit top, loose straw, two twine bands and a shaded base.
  const bw = outer * 2.1;
  const bTop = cy + outer * 0.35;
  const bBot = cy + outer + 26;
  const bh = bBot - bTop;
  const hay = ctx.createLinearGradient(0, bTop, 0, bBot);
  hay.addColorStop(0, "#DDB85C");
  hay.addColorStop(0.55, "#C9A24A");
  hay.addColorStop(1, "#A9853A");
  ctx.fillStyle = hay;
  ctx.fillRect(cx - bw / 2, bTop, bw, bh);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 46; i++) {
    const sx = cx - bw / 2 + 3 + ((i * 37) % Math.max(1, bw - 14));
    const sy = bTop + 3 + ((i * 23) % Math.max(1, bh - 6));
    const len = 6 + (i % 4) * 2;
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + len, sy + 2 - (i % 4));
  }
  ctx.strokeStyle = "rgba(120, 86, 30, 0.55)";
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 30; i++) {
    const sx = cx - bw / 2 + 5 + ((i * 53) % Math.max(1, bw - 16));
    const sy = bTop + 2 + ((i * 29) % Math.max(1, bh - 5));
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 7, sy - 1 + (i % 3));
  }
  ctx.strokeStyle = "rgba(255, 236, 170, 0.45)";
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 240, 190, 0.35)";
  ctx.fillRect(cx - bw / 2, bTop, bw, 1.5);
  ctx.fillStyle = "rgba(70, 45, 10, 0.3)";
  ctx.fillRect(cx - bw / 2, bBot - 3, bw, 3);
  for (const tx of [cx - bw / 2 + bw * 0.22, cx + bw / 2 - bw * 0.22 - 3]) {
    ctx.fillStyle = "#6E4A1E";
    ctx.fillRect(tx, bTop, 3, bh);
    ctx.fillStyle = "rgba(255, 220, 160, 0.35)";
    ctx.fillRect(tx, bTop, 1, bh);
  }
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
  // Lamp light from the upper left and a worn, shaded edge (all inside the rim).
  ctx.globalAlpha = 1;
  const lamp = ctx.createRadialGradient(cx - outer * 0.4, cy - outer * 0.45, outer * 0.1, cx, cy, outer + 2);
  lamp.addColorStop(0, "rgba(255,248,225,0.2)");
  lamp.addColorStop(0.55, "rgba(255,248,225,0)");
  lamp.addColorStop(0.88, "rgba(20,10,4,0)");
  lamp.addColorStop(1, "rgba(20,10,4,0.32)");
  ctx.fillStyle = lamp;
  ctx.fillRect(cx - outer - 2, cy - outer - 2, outer * 2 + 4, outer * 2 + 4);
  ctx.restore();
  // Wire between rings: a fine lit line just inside each dark ring edge.
  ctx.strokeStyle = "rgba(255, 245, 225, 0.35)";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let ring = 1; ring <= BULLSEYE_RINGS; ring++) {
    const radius = (BULLSEYE_RING_STEP * ring * scalePct) / 100 - 1;
    ctx.moveTo(cx + radius, cy);
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  }
  ctx.stroke();
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

/** Arena scene (15 Oct 2026, display only): the stall's sky, counter and floor beyond the world. */
export function bullseyeArenaScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  fairArenaScene(ctx, view, COUNTER_Y);
}
