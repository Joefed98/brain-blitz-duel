import { successHud, successFrame } from "./success.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { hoverFxFor } from "./arcadeFxGames.renderer";
import { reducedMotion } from './art.renderer';
/** Hover in the Retro Arcade world. Render only; the sim and its bounds are untouched. */
import {
  hoverGame,
  hoverGapTop,
  hoverScroll,
  hoverStarY,
  pillarX,
  HOVER_MOVE_AMP,
  HOVER_STAR_R,
  HOVER_DISC_R,
  HOVER_DISC_X,
  HOVER_IMPULSE,
  HOVER_PILLAR_W,
  HOVER_SCROLL_MAX,
  HOVER_SCROLL_START,
  HOVER_TALL_H,
  HOVER_WORLD_W,
  hoverWorldH,
  type HoverState,
} from "./hover";
import type { ArcadeGame, CanvasSize } from "./engine";
import { artCanvas, artContext, deviceLayer, type ArtCanvas } from "./cache.renderer";
import { arcadeReducedEffects } from "../fx/lowEnd";
import { fillAbove, fillBelow, fillGradient } from "./arenaFills.renderer";
import type { ArenaSceneView } from "./arenaScene.renderer";
import {
  pixelRect,
  pixelShape,
  retroBloom,
  retroClock,
  retroReadout,
  retroScreen,
  retroText,
  RETRO_RED,
  RETRO_WHITE,
} from "./retro.renderer";

const FP = 256;
const px = (v: number) => v / FP;
const BARRIER_CYCLES = ["#FF4DFF", "#3DFFE0", "#FFD84A", "#4BFF7A", "#FF9A3C", "#B49CFF"];
const SAUCER = "#FFD84A";
const SAUCER_DARK = "#B8901C";
const DOME = "#5CD0FF";
const barrierCache = new Map<string, ArtCanvas>();

/** Two finite, full-height raster columns; cropped without scaling to each collision box. */
function barrierSprite(w: number, colour: string): ArtCanvas | null {
  const cached = barrierCache.get(colour);
  if (cached) return cached;
  const RH = HOVER_TALL_H;
  const layer = artCanvas(w * 2, RH * 2);
  const c = layer && artContext(layer);
  if (!layer || !c) return null;
  c.scale(2, 2);
  c.fillStyle = colour; c.fillRect(0, 0, w, RH);
  c.fillStyle = "rgba(0,0,0,0.72)"; c.fillRect(0, 0, w, RH);
  // One baked glow pass, clipped by the raster's exact rectangular footprint.
  c.shadowColor = colour; c.shadowBlur = 3;
  for (let y = 0; y < RH; y += 12) {
    c.fillStyle = colour; c.fillRect(0, y, w, 11);
  }
  c.shadowBlur = 0;
  for (let y = 0; y < RH; y += 12) {
    c.fillStyle = Math.floor(y / 12) % 2 ? "rgba(0,0,0,0.38)" : "rgba(0,0,0,0.22)"; c.fillRect(0, y, w, 11);
    c.fillStyle = "rgba(255,255,255,0.55)"; c.fillRect(2, y + 2, w - 4, 1);
    c.fillStyle = "rgba(0,0,0,0.45)"; c.fillRect(w / 2, y + 3, 1, 7);
  }
  // Polish A2 (display only): rounded shading across the column, lit on the left, in shade on the right.
  const shade = c.createLinearGradient(0, 0, w, 0);
  shade.addColorStop(0, "rgba(255,255,255,0.22)");
  shade.addColorStop(0.18, "rgba(255,255,255,0.06)");
  shade.addColorStop(0.55, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,0.42)");
  c.fillStyle = shade; c.fillRect(0, 0, w, RH);
  c.fillStyle = "rgba(255,255,255,0.32)"; c.fillRect(2, 0, 1, RH);
  c.fillStyle = "rgba(0,0,0,0.5)"; c.fillRect(w - 2, 0, 2, RH);
  barrierCache.set(colour, layer);
  return layer;
}

/**
 * Polish A2 (display only): the soft light round a barrier's gap end, a sprite per colour (painted
 * once): a faint halo just past the lip into the gap and down the column's sides, kept dim so it
 * reads as light, never as part of the barrier.
 */
const GLOW_REACH = 7;
const capGlowCache = new Map<string, ArtCanvas | null>();
function capGlowSprite(w: number, colour: string): ArtCanvas | null {
  if (capGlowCache.has(colour)) return capGlowCache.get(colour)!;
  const W = w + GLOW_REACH * 2;
  const H = GLOW_REACH * 3;
  const layer = artCanvas(W * 2, H * 2);
  const c = layer && artContext(layer);
  if (layer && c) {
    c.scale(2, 2);
    const g = c.createRadialGradient(W / 2, 0, 2, W / 2, 0, W / 2);
    g.addColorStop(0, `${colour}AA`);
    g.addColorStop(0.55, `${colour}33`);
    g.addColorStop(1, `${colour}00`);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  }
  capGlowCache.set(colour, layer && c ? layer : null);
  return layer && c ? layer : null;
}

/**
 * Polish A2 (display only): the night behind the course, painted once per canvas size into a
 * device layer: a deep navy sky lifting to purple low down, then a dark pixel city along the
 * bottom with a few dim windows. Seeded, so every phone and the reveal draw the same city.
 */
export const HOVER_SKY_TOP = "#060A22";
export const HOVER_SKY_MID = "#120F38";
export const HOVER_SKY_LOW = "#22124A";
export const HOVER_CITY = "#0C0A20";
export const HOVER_CITY_FAR = "#171236";
const WINDOW_TONES = ["#FFE6A0", "#9FD8FF", "#FFD27A"] as const;
function cityRow(ctx: CanvasRenderingContext2D, H: number, seed: number, base: number, rise: number, colour: string, windows: number): void {
  let x = -4;
  let i = 0;
  while (x < HOVER_WORLD_W + 4) {
    const h = hash(seed, i++);
    const w = 18 + (h % 5) * 6;
    const tall = base + ((h >>> 4) % 9) * rise;
    const top = H - tall;
    ctx.fillStyle = colour;
    ctx.fillRect(x, top, w, tall);
    if ((h >>> 9) % 3 === 0) ctx.fillRect(x + Math.floor(w / 2) - 1, top - 6, 2, 6);
    if (windows > 0) {
      for (let wy = top + 5; wy < H - 6; wy += 6) {
        for (let wx = x + 3; wx < x + w - 4; wx += 5) {
          const lit = hash(wx * 7 + seed, wy);
          if (lit % 100 >= windows) continue;
          ctx.globalAlpha = 0.18 + (lit % 4) * 0.07;
          ctx.fillStyle = WINDOW_TONES[lit % WINDOW_TONES.length]!;
          ctx.fillRect(wx, wy, 2, 2);
        }
      }
      ctx.globalAlpha = 1;
    }
    x += w + ((h >>> 13) % 3) * 2;
  }
}
function hash(a: number, b: number): number {
  let h = Math.imul((a | 0) ^ Math.imul(b | 0, 0x9e3779b1), 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
function paintNight(c: CanvasRenderingContext2D, H: number): void {
  const sky = c.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, HOVER_SKY_TOP);
  sky.addColorStop(0.55, HOVER_SKY_MID);
  sky.addColorStop(0.86, HOVER_SKY_LOW);
  sky.addColorStop(1, HOVER_SKY_LOW);
  c.fillStyle = sky;
  c.fillRect(0, 0, HOVER_WORLD_W, H);
  cityRow(c, H, 41, 34, 7, HOVER_CITY_FAR, 6);
  cityRow(c, H, 7, 16, 6, HOVER_CITY, 10);
}
function drawNight(ctx: CanvasRenderingContext2D, H: number): void {
  deviceLayer(ctx, `hover-night-${H}`, (c) => paintNight(c, H));
}

function draw(ctx: CanvasRenderingContext2D, state: HoverState, size: CanvasSize): void {
  retroScreen(ctx, size, HOVER_WORLD_W, hoverWorldH(state), "fit", (c) => arcadeFx(c, hoverFxFor(state), state, () => drawWorld(c, state)));
}
function drawReveal(ctx: CanvasRenderingContext2D, state: HoverState, size: CanvasSize): void {
  retroScreen(ctx, size, HOVER_WORLD_W, hoverWorldH(state), "fit", (c) => arcadeFx(c, hoverFxFor(state), state, () => drawWorld(c, state, false)));
}

/**
 * A faint star field behind the course (display only, every revision): small,
 * dim points drifting left at a twentieth of the course's scroll, keyed to the
 * sim's distance so every phone and the reveal draw the same sky. Kept well
 * under the barriers' and saucer's brightness.
 */
const STAR_COUNT = 46;
const STARS = (() => {
  let v = 0x5eed_4a11 | 0;
  const next = () => {
    v = (Math.imul(v, 1103515245) + 12345) | 0;
    return ((v >>> 8) % 10000) / 10000;
  };
  return Array.from({ length: STAR_COUNT }, (_, i) => ({ x: next() * HOVER_WORLD_W, y: next(), big: i % 9 === 0, a: 0.16 + next() * 0.16 }));
})();
function drawStarField(ctx: CanvasRenderingContext2D, state: HoverState, H: number): void {
  const drift = (state.distance / FP) * 0.05;
  ctx.save();
  ctx.fillStyle = "#CFC8FF";
  for (const star of STARS) {
    const x = (((star.x - drift) % HOVER_WORLD_W) + HOVER_WORLD_W) % HOVER_WORLD_W;
    ctx.globalAlpha = star.a;
    const s = star.big ? 2 : 1;
    ctx.fillRect(Math.round(x), Math.round(star.y * (H - 2)), s, s);
  }
  ctx.restore();
}

function drawWorld(ctx: CanvasRenderingContext2D, state: HoverState, crashIndicator = true): void {
  const HOVER_WORLD_H = hoverWorldH(state);
  drawNight(ctx, HOVER_WORLD_H);
  drawStarField(ctx, state, HOVER_WORLD_H);
  const bloom = retroBloom();
  const discLeft = HOVER_DISC_X - HOVER_DISC_R;
  const width = px(HOVER_PILLAR_W);

  state.pillars.forEach((pillar, index) => {
    const left = px(pillarX(pillar, state.distance));
    if (left > HOVER_WORLD_W || left + width < 0) return;
    const colour = BARRIER_CYCLES[Math.floor(index / 7) % 6] ?? "#FF4DFF";
    // After crossing, scroll speed is constant until the next gate. Recover
    // the pass age from distance, even on a fresh reveal or a skipped frame.
    const passedBy = px(state.distance - (pillar.x0 + HOVER_PILLAR_W - discLeft));
    const duration = reducedMotion() ? 9 : 18;
    const age = passedBy / px(hoverScroll(index + 1));
    const flash = index < state.gates && age >= 0 && age < duration ? 1 - age / duration : 0;
    // Tuning D: one white pulse while the saucer passes through, from its nose
    // reaching the barrier until just after its tail clears it (crash excluded).
    const through = px(state.distance - (pillar.x0 - (HOVER_DISC_X + HOVER_DISC_R)));
    const span = width + 2 * px(HOVER_DISC_R) + 10;
    const live = index < state.gates || (index === state.gates && !state.crashed);
    const pulse = live && through >= 0 && through < span ? Math.sin((Math.PI * through) / span) : 0;
    const top = px(hoverGapTop(pillar, state.tick));
    const bottom = top + px(pillar.gapH);
    drawPipe(ctx, left, 0, width, top, colour, bloom, flash, "bottom", pulse);
    if (pillar.gap2Top !== undefined) {
      // hoverRev 2 two-gap barrier: a middle block between the upper and lower gaps.
      const top2 = px(pillar.gap2Top);
      const bottom2 = top2 + px(pillar.gap2H ?? 0);
      drawPipe(ctx, left, bottom, width, top2 - bottom, colour, bloom, flash, "both", pulse);
      drawPipe(ctx, left, bottom2, width, HOVER_WORLD_H - bottom2, colour, bloom, flash, "top", pulse);
      drawForkArrows(ctx, left + width / 2 - 3, bottom, top2);
    } else drawPipe(ctx, left, bottom, width, HOVER_WORLD_H - bottom, colour, bloom, flash, "top", pulse);
    if (pillar.movePhase !== undefined) drawSlideRail(ctx, left, width, pillar, state.tick);
    drawStar(ctx, state, pillar, index, left + width / 2);
    drawStarPlusOne(ctx, state, pillar, index, left + width / 2);
  });

  // Ordinary passes are rewarded by the barrier itself, not a saucer trace.
  // Feed only each five-gate milestone to the shared burst/edge/HUD reward.
  const reward=successFrame(ctx,{id:'hover',tick:state.tick,count:Math.floor(state.gates/5),every:1,colour:BARRIER_CYCLES[Math.floor(Math.max(0,state.gates-1)/7)%6]??SAUCER,width:HOVER_WORLD_W,height:HOVER_WORLD_H,point:{x:px(HOVER_DISC_X),y:px(state.y),shape:'spark',radius:20},hud:{x:10,y:28,text:`BARRIERS ${state.gates}/${state.totalGates}`}});
  const latest = state.pillars[state.gates - 1];
  const colourAge = latest ? px(state.distance - (latest.x0 + HOVER_PILLAR_W - discLeft)) / px(hoverScroll(state.gates)) : Infinity;
  if(!reducedMotion()&&state.gates>0&&state.gates%7===0&&colourAge<20){ctx.save();ctx.globalAlpha=.22*(1-colourAge/20);ctx.strokeStyle=BARRIER_CYCLES[Math.floor(state.gates/7)%6]??SAUCER;ctx.lineWidth=1;ctx.strokeRect(4,4,HOVER_WORLD_W-8,HOVER_WORLD_H-8);ctx.restore();}
  if (!(state.crashed && crashIndicator)) drawShipLight(ctx, state);
  drawSaucer(ctx, state, crashIndicator);
  successHud(ctx,'hover',state.tick,10,28,()=>{retroReadout(ctx, 10, 10, `BARRIERS ${state.gates}/${state.totalGates}`, RETRO_WHITE);});
  if ((state.totalStars ?? 0) > 0) retroText(ctx, `STARS ${state.stars ?? 0}/${state.totalStars}`, 10, 46, 14, STAR_GOLD, "left", 4);

  if (state.crashed && crashIndicator) {
    ctx.fillStyle = "rgba(255,59,92,0.2)";
    ctx.fillRect(0, 0, HOVER_WORLD_W, HOVER_WORLD_H);
  }
}

const STAR_GOLD = "#FFD84A";

/** A gold star (hoverRev 2) drawn in 2 px blocks inside its collection circle; gone once taken. */
function drawStar(ctx: CanvasRenderingContext2D, state: HoverState, pillar: HoverState["pillars"][number], index: number, cx: number): void {
  const starY = hoverStarY(pillar, state.tick);
  if (starY === null || state.starsTaken?.includes(index)) return;
  const r = px(HOVER_STAR_R);
  const cy = px(starY);
  // Polish A2: a soft gold glow round the star (a cached sprite; skipped with reduced effects).
  const glow = !arcadeReducedEffects() ? starGlowSprite() : null;
  if (glow) {
    const pulse = reducedMotion() ? 0.7 : 0.6 + 0.2 * Math.sin(retroClock() / 260 + index);
    ctx.globalAlpha = pulse;
    ctx.drawImage(glow, cx - r * 2.4, cy - r * 2.4, r * 4.8, r * 4.8);
    ctx.globalAlpha = 1;
  }
  const twinkle = reducedMotion() ? 0 : Math.floor(retroClock() / 180) % 4;
  pixelShape(ctx, cx, cy, r, 2, (dx, dy) => {
    // A four-point pixel star: a plus with a filled core.
    const ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax * ax + ay * ay > r * r) return null;
    if (ax <= 2 && ay <= 2) return RETRO_WHITE;
    if (ax <= 2.5 || ay <= 2.5 || ax + ay <= r * 0.8) return STAR_GOLD;
    return null;
  });
  if (twinkle === 0) pixelRect(ctx, cx + r - 1, cy - r - 1, 2, 2, RETRO_WHITE);
}

let starGlow: ArtCanvas | null | undefined;
function starGlowSprite(): ArtCanvas | null {
  if (starGlow !== undefined) return starGlow;
  const layer = artCanvas(48, 48);
  const c = layer && artContext(layer);
  if (layer && c) {
    const g = c.createRadialGradient(24, 24, 2, 24, 24, 24);
    g.addColorStop(0, "rgba(255,216,74,0.75)");
    g.addColorStop(0.45, "rgba(255,190,60,0.28)");
    g.addColorStop(1, "rgba(255,190,60,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, 48, 48);
  }
  starGlow = layer && c ? layer : null;
  return starGlow;
}

/** Polish A2: a "+1" in pixel type rising from a star just taken (age recovered from the course's distance). */
function drawStarPlusOne(ctx: CanvasRenderingContext2D, state: HoverState, pillar: HoverState["pillars"][number], index: number, cx: number): void {
  if (!state.starsTaken?.includes(index)) return;
  const starY = hoverStarY(pillar, state.tick);
  if (starY === null) return;
  const passed = px(state.distance - (pillar.x0 + HOVER_PILLAR_W / 2 - HOVER_DISC_X));
  const age = passed / px(hoverScroll(index + 1));
  const span = 40;
  if (!(age >= 0 && age < span)) return;
  const k = age / span;
  ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
  const lift = reducedMotion() ? 10 : 6 + k * 18;
  retroText(ctx, "+1", cx, px(starY) - lift, 14, STAR_GOLD, "center", 4);
  ctx.globalAlpha = 1;
}

/**
 * Moving barrier (hoverRev 2): white rail marks inside the barrier at the two
 * ends of its gap's slide, and arrows on the lips pointing the way it moves.
 * Everything sits on the solid barrier, inside its collision rectangle.
 */
function drawSlideRail(ctx: CanvasRenderingContext2D, left: number, width: number, pillar: HoverState["pillars"][number], tick: number): void {
  const base = px(pillar.gapTop);
  const gap = px(pillar.gapH);
  const amp = px(HOVER_MOVE_AMP);
  const top = px(hoverGapTop(pillar, tick));
  ctx.globalAlpha = 0.8;
  for (const y of [base - amp - 2, base + gap + amp]) {
    for (let x = 2; x < width - 2; x += 4) pixelRect(ctx, left + x, Math.round(y), 2, 2, RETRO_WHITE);
  }
  const rising = hoverGapTop(pillar, tick + 1) < hoverGapTop(pillar, tick);
  const cx = left + width / 2;
  for (const lip of [top - 6, top + gap + 2]) {
    const y = Math.round(lip);
    pixelRect(ctx, cx - 1, rising ? y : y + 2, 2, 2, RETRO_WHITE);
    pixelRect(ctx, cx - 3, rising ? y + 2 : y, 6, 2, RETRO_WHITE);
  }
  ctx.globalAlpha = 1;
}

/** Two-gap barrier (hoverRev 2): white chevrons on the middle block pointing to both gaps. */
function drawForkArrows(ctx: CanvasRenderingContext2D, x: number, wallTop: number, wallBottom: number): void {
  if (wallBottom - wallTop < 24) return;
  const colour = RETRO_WHITE;
  ctx.globalAlpha = 0.7;
  const mid = (wallTop + wallBottom) / 2;
  for (const dir of [-1, 1]) {
    const y = mid + dir * 6;
    pixelRect(ctx, x + 2, Math.round(y), 2, 2, colour);
    pixelRect(ctx, x, Math.round(y + dir * 2), 2, 2, colour);
    pixelRect(ctx, x + 4, Math.round(y + dir * 2), 2, 2, colour);
  }
  ctx.globalAlpha = 1;
}

/** Stacked energy blocks fill the exact pillar rectangle, without a cap or lip. */
function drawPipe(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  colour: string,
  bloom: number,
  flash: number,
  capAt: "top" | "bottom" | "both",
  /** 0…1: the white pass-through pulse (Tuning D), inside the barrier's own rectangle. */
  pulse = 0,
): void {
  if (h <= 0) return;
  const ends = capAt === "both" ? (["top", "bottom"] as const) : [capAt];
  // Polish A2: the soft light the gap's lip throws into the gap (a cached sprite; reduced effects skip it).
  const glow = !arcadeReducedEffects() ? capGlowSprite(w, colour) : null;
  if (glow) {
    ctx.globalAlpha = 0.55;
    for (const end of ends) {
      if (end === "bottom") ctx.drawImage(glow, x - GLOW_REACH, y + h - 1, w + GLOW_REACH * 2, GLOW_REACH * 3);
      else {
        ctx.save();
        ctx.translate(0, y + 1);
        ctx.scale(1, -1);
        ctx.drawImage(glow, x - GLOW_REACH, 0, w + GLOW_REACH * 2, GLOW_REACH * 3);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }
  const stamp = barrierSprite(w, colour);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (stamp) ctx.drawImage(stamp, 0, 0, w * 2, h * 2, x, y, w, h);
  else {
    pixelRect(ctx, x, y, w, h, "#39114F");
    for (let row = 0; row < h; row += 12)
      pixelRect(ctx, x, y + row, w, Math.min(11, h - row), colour);
  }
  // Polish A2: a lit cap at the gap end, the colour at full strength brightening to the lip.
  for (const end of ends) {
    const cap = Math.min(8, h);
    const capTop = end === "bottom" ? y + h - cap : y;
    ctx.fillStyle = colour;
    ctx.fillRect(x, capTop, w, cap);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillRect(x, end === "bottom" ? y + h - 3 : y, w, 3);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(x, end === "bottom" ? capTop : capTop + cap - 1, w, 1);
  }
  // A thin jagged energy trace remains inside the flat facing block edge.
  for (const end of ends) {
    const edge = end === "bottom" ? y + h - 1 : y;
    pixelRect(ctx, x, edge, w, 1, colour);
    for (let column = 2; column < w; column += 6)
      pixelRect(ctx, x + column, end === "bottom" ? edge - 1 : edge + 1, Math.min(3, w - column), 1, RETRO_WHITE);
  }
  if (flash > 0) {
    ctx.globalAlpha = flash * 0.34;
    pixelRect(ctx, x, y, w, h, colour);
    ctx.globalAlpha = 1;
  }
  if (pulse > 0.01) {
    // White wash over the whole barrier, brightest on the lips the saucer slips between.
    ctx.globalAlpha = pulse * 0.42;
    pixelRect(ctx, x, y, w, h, RETRO_WHITE);
    ctx.globalAlpha = pulse * 0.9;
    for (const end of ends) pixelRect(ctx, x, end === "bottom" ? y + h - 4 : y, w, 4, RETRO_WHITE);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/**
 * Polish A2 (display only): a soft gold glow round the saucer and a faint beam under it, both cached
 * sprites, drawn under the saucer's own blocks (the saucer stays exactly its gold). Reduced effects
 * skip them.
 */
let shipLight: ArtCanvas | null | undefined;
function shipLightSprite(): ArtCanvas | null {
  if (shipLight !== undefined) return shipLight;
  const W = 72;
  const H = 96;
  const layer = artCanvas(W * 2, H * 2);
  const c = layer && artContext(layer);
  if (layer && c) {
    c.scale(2, 2);
    const glow = c.createRadialGradient(W / 2, 24, 4, W / 2, 24, 30);
    glow.addColorStop(0, "rgba(255,216,74,0.34)");
    glow.addColorStop(0.5, "rgba(255,200,70,0.14)");
    glow.addColorStop(1, "rgba(255,200,70,0)");
    c.fillStyle = glow;
    c.fillRect(0, 0, W, 56);
    const beam = c.createLinearGradient(0, 30, 0, H);
    beam.addColorStop(0, "rgba(255,226,120,0.11)");
    beam.addColorStop(1, "rgba(255,226,120,0)");
    c.fillStyle = beam;
    c.beginPath();
    c.moveTo(W / 2 - 7, 30);
    c.lineTo(W / 2 + 7, 30);
    c.lineTo(W / 2 + 20, H);
    c.lineTo(W / 2 - 20, H);
    c.closePath();
    c.fill();
  }
  shipLight = layer && c ? layer : null;
  return shipLight;
}
function drawShipLight(ctx: CanvasRenderingContext2D, state: HoverState): void {
  if (arcadeReducedEffects()) return;
  const sprite = shipLightSprite();
  if (!sprite) return;
  ctx.drawImage(sprite, px(HOVER_DISC_X) - 36, px(state.y) - 24, 72, 96);
}

/** Saucer drawn in 2 px blocks, every block inside the sim's disc. */
export function drawSaucer(ctx: CanvasRenderingContext2D, state: HoverState, crashIndicator: boolean): void {
  const cx = px(HOVER_DISC_X);
  const cy = px(state.y);
  const r = px(HOVER_DISC_R);
  // Thruster puff for a few ticks after a tap; background decoration under the saucer.
  const sinceTap = Math.round((state.vy - HOVER_IMPULSE) / 90);
  if (!state.crashed && sinceTap >= 0 && sinceTap < 8) {
    ctx.globalAlpha = 0.6 * (1 - sinceTap / 8);
    pixelRect(ctx, cx - 4, cy + r * 0.5 + sinceTap, 8, 4, "#FF9A3C", 6);
    pixelRect(ctx, cx - 2, cy + r * 0.5 + sinceTap + 4, 4, 3, "#FFE08A");
    ctx.globalAlpha = 1;
  }
  const t = retroClock();
  const blink = Math.floor(t / 160) % 3;
  const body = state.crashed && crashIndicator ? RETRO_RED : SAUCER;
  pixelShape(ctx, cx, cy, r, 2, (dx, dy) => {
    if (dx * dx + dy * dy > r * r) return null;
    // Dome above the hull.
    const domeY = dy + r * 0.1;
    if (domeY < 0 && dx * dx + domeY * domeY <= (r * 0.5) ** 2) return state.crashed && crashIndicator ? RETRO_RED : DOME;
    // Flat hull ellipse.
    const ey = (dy - r * 0.2) / (r * 0.38);
    const ex = dx / r;
    if (ex * ex + ey * ey > 1) return null;
    if (ey > 0.35) {
      const slot = Math.floor((dx + r) / 4);
      return slot % 3 === blink ? RETRO_WHITE : SAUCER_DARK;
    }
    return body;
  });
}

export const hoverArtGame: ArcadeGame<HoverState> = { ...hoverGame, draw };
/** Preserve the actual final state and live death art, but omit the reveal's red indicator. */
export const hoverRevealGame = { draw: drawReveal };

/**
 * Polish A2 (display only): the play screen's fill below the course. The city's dark street level
 * runs on from the world's bottom edge (its colour, so no seam), a few dim windows low in it, settling
 * darker towards the screen's bottom. Painted once per size (ArcadeArenaSlot's scene canvas).
 */
export function hoverNightFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  for (const r of [fillBelow(view), fillAbove(view)]) {
    if (!r) continue;
    fillGradient(ctx, r, r.y, r.y + r.h, [
      [0, HOVER_CITY],
      [0.6, "#0A081C"],
      [1, "#08071A"],
    ]);
    for (let wx = Math.floor(r.x) + 3; wx < r.x + r.w - 3; wx += 5) {
      for (let wy = Math.floor(r.y) + 6; wy < r.y + Math.min(r.h, 40); wy += 6) {
        const lit = hash(wx * 7 + 3, wy);
        if (lit % 100 >= 7) continue;
        ctx.globalAlpha = 0.14 + (lit % 4) * 0.05;
        ctx.fillStyle = WINDOW_TONES[lit % WINDOW_TONES.length]!;
        ctx.fillRect(wx, wy, 2, 2);
      }
    }
    ctx.globalAlpha = 1;
  }
}
