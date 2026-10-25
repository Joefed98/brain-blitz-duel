import { reducedMotion } from "./art.renderer";
import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { beatFxFor } from "./arcadeFxGames.renderer";
import { successHud, successFrame, SUCCESS_ACCENTS } from "./success.renderer";
/** Beat in the Retro Arcade world. Render only; the chart, judging and score are untouched. */
import {
  beatGame,
  BEAT_COMBO_TIERS,
  BEAT_FALL_TICKS,
  BEAT_HUD_H,
  BEAT_JUDGE_MISS,
  BEAT_JUDGE_NONE,
  BEAT_JUDGE_PENDING,
  BEAT_JUDGE_PERFECT,
  BEAT_JUDGE_TEXT,
  BEAT_LANE_COLOURS,
  BEAT_LANES,
  BEAT_NOTE_H,
  BEAT_OK_TICKS,
  BEAT_WORLD_W,
  beatHitLineY,
  beatLaneX,
  beatWorldH,
  type BeatState,
} from "./beat";
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "./engine";
import { blob, glow, linear } from "./polishA1.renderer";
import { pixelRect, retroBloom, retroNeon, retroReadout, retroScreen, retroText, RETRO_RED, RETRO_WHITE } from "./retro.renderer";

const NEON = BEAT_LANE_COLOURS.map(retroNeon);
const GOLD = "#FFD84A";
const lanePulses=new WeakMap<CanvasRenderingContext2D,{tick:number;event:number;at:number}>();

function draw(ctx: CanvasRenderingContext2D, state: BeatState, size: CanvasSize): void {
  // Stretch, exactly as the original draw, so taps map to the same lanes.
  retroScreen(ctx, size, BEAT_WORLD_W, beatWorldH(state), "stretch", (c) => arcadeFx(c, beatFxFor(state), state, () => drawWorld(c, state)));
}

function drawWorld(ctx: CanvasRenderingContext2D, state: BeatState): void {
  // beatRev 6: the taller lanes and their hit line (the original 620 / 520 otherwise).
  const BEAT_WORLD_H = beatWorldH(state);
  const BEAT_HIT_LINE_Y = beatHitLineY(state);
  const laneW = BEAT_WORLD_W / BEAT_LANES;
  const bloom = retroBloom();
  const tier = BEAT_COMBO_TIERS.filter((t) => state.combo >= t).length;
  const eventTick=state.tick-state.judgeAge;
  let pulse=lanePulses.get(ctx);
  if(!pulse||state.tick<pulse.tick)pulse={tick:state.tick,event:-Infinity,at:-Infinity};
  if(state.lastJudge===1&&eventTick!==pulse.event){if(eventTick-pulse.at>=20)pulse.at=eventTick;pulse.event=eventTick;}
  pulse.tick=state.tick;lanePulses.set(ctx,pulse);
  const hit = !reducedMotion() && state.lastJudge === 1 && eventTick===pulse.at && state.judgeAge < 12;

  drawStage(ctx, BEAT_WORLD_H);
  for (let lane = 0; lane < BEAT_LANES; lane++) {
    const x = lane * laneW;
    const colour = NEON[lane]!;
    const h = BEAT_WORLD_H - BEAT_HUD_H;
    if (tier > 0) {
      // Combo glow in stepped pixel bands above the hit line (display only).
      const bands = 2 + tier * 2;
      for (let b = 0; b < bands; b++) {
        const alpha = Math.round((0.18 + tier * 0.06) * (1 - b / bands) * 255).toString(16).padStart(2, "0");
        pixelRect(ctx, x, BEAT_HIT_LINE_Y - (b + 1) * 24, laneW, 24, `${(tier>=3?GOLD:tier===2?SUCCESS_ACCENTS.pink:SUCCESS_ACCENTS.cyan)}${alpha}`);
      }
    }
    if (hit && state.lastLane === lane) {
      ctx.globalAlpha = 1 - state.judgeAge / 12;
      pixelRect(ctx, x, BEAT_HUD_H, laneW, h, `${colour}55`);
      ctx.globalAlpha = 1;
    }
    // Tuning C: no highlight box at the hit line while a hold note is held (the brighter beam shows it).
  }

  pixelRect(ctx, 0, BEAT_HIT_LINE_Y - 2, BEAT_WORLD_W, 4, RETRO_WHITE, bloom);
  // Polish A1: each lane's marker on the hit line, in its colour, with a soft glow.
  for (let lane = 0; lane < BEAT_LANES; lane++) {
    const cx = beatLaneX(lane), colour = NEON[lane]!;
    glow(ctx, colour, cx, BEAT_HIT_LINE_Y, 30, 9, 0.55);
    pixelRect(ctx, cx - 14, BEAT_HIT_LINE_Y - 3, 28, 6, colour);
    pixelRect(ctx, cx - 10, BEAT_HIT_LINE_Y - 1, 20, 2, RETRO_WHITE);
  }

  const travel = BEAT_HIT_LINE_Y - BEAT_HUD_H;
  const yAt = (remaining: number) => BEAT_HUD_H + (travel * (BEAT_FALL_TICKS - remaining)) / BEAT_FALL_TICKS;
  for (let index = 0; index < state.chart.ticks.length; index++) {
    const lane = state.chart.lanes[index]!;
    const hold = state.chart.holds[index]!;
    const held = state.holding[lane] === index;
    if (state.judged[index] !== BEAT_JUDGE_NONE && !held) continue;
    const remaining = state.chart.ticks[index]! - state.tick;
    if (remaining > BEAT_FALL_TICKS || remaining + hold < -BEAT_OK_TICKS) continue;
    const colour = NEON[lane % NEON.length]!;
    if (hold > 0) {
      const headY = held ? BEAT_HIT_LINE_Y : yAt(remaining);
      const tailY = yAt(remaining + hold);
      // Beam, then pixel end caps, at the original tail/cap rects.
      pixelRect(ctx, lane * laneW + laneW / 2 - 9, tailY, 18, Math.max(0, headY - tailY), `${colour}${held ? "CC" : "A0"}`);
      pixelRect(ctx, lane * laneW + laneW / 2 - 3, tailY, 6, Math.max(0, headY - tailY), colour);
      pixelRect(ctx, lane * laneW + 14, tailY - 4, laneW - 28, 8, colour, bloom);
      drawBar(ctx, lane * laneW + 10, headY - BEAT_NOTE_H / 2, laneW - 20, colour, bloom);
      continue;
    }
    const swipe = state.chart.swipes?.[index] ?? 0;
    if (swipe) {
      drawSwipe(ctx, lane * laneW + 10, yAt(remaining) - BEAT_NOTE_H / 2, laneW - 20, colour, swipe, bloom);
      continue;
    }
    drawBar(ctx, lane * laneW + 10, yAt(remaining) - BEAT_NOTE_H / 2, laneW - 20, colour, bloom);
  }

  // Combo in pixel font, growing with the combo.
  if (state.combo > 0) {
    const sizePx = Math.min(22, 14 + tier * 3 + Math.floor(Math.min(state.combo, 40) / 10));
    const colour = tier >= 3 ? GOLD : tier === 2 ? NEON[2]! : tier === 1 ? NEON[0]! : RETRO_WHITE;
    retroText(ctx, `${state.combo}x`, BEAT_WORLD_W - 8, BEAT_HIT_LINE_Y + 10, sizePx, colour, "right", bloom);
  }

  // Polish A1: a PERFECT bursts in its lane's colour at the hit line (pixel rays and a flash, kept
  // inside the lane, timed by the sim tick like the word itself).
  if (state.lastJudge === BEAT_JUDGE_PERFECT && state.judgeAge < 14 && state.lastLane >= 0 && !reducedMotion()) {
    const lane = state.lastLane, colour = NEON[lane % NEON.length]!;
    const cx = beatLaneX(lane), p = state.judgeAge / 14;
    ctx.save();
    ctx.beginPath();
    ctx.rect(lane * laneW, BEAT_HUD_H, laneW, BEAT_WORLD_H - BEAT_HUD_H);
    ctx.clip();
    glow(ctx, colour, cx, BEAT_HIT_LINE_Y, laneW * 0.55, 26 + 20 * p, 0.8 * (1 - p));
    ctx.globalAlpha = 1 - p;
    for (let i = 0; i < 10; i++) {
      const a = Math.PI + (i / 9) * Math.PI;
      const d = 8 + 46 * p * (0.7 + ((i * 7) % 5) / 10);
      pixelRect(ctx, cx + Math.cos(a) * d - 2, BEAT_HIT_LINE_Y + Math.sin(a) * d * 0.8 - 2, 4, 4, i % 3 === 0 ? RETRO_WHITE : colour);
    }
    ctx.restore();
  }

  // Judgement word pops at the hit line.
  if (state.lastJudge !== BEAT_JUDGE_NONE && state.lastJudge !== BEAT_JUDGE_PENDING && state.judgeAge < 24) {
    const pop = state.judgeAge < 4 ? 18 - state.judgeAge : 14;
    ctx.globalAlpha = Math.max(0, 1 - state.judgeAge / 24);
    retroText(
      ctx,
      BEAT_JUDGE_TEXT[state.lastJudge] ?? "",
      beatLaneX(Math.max(0, state.lastLane)),
      BEAT_HIT_LINE_Y - 30 - Math.floor(state.judgeAge / 2),
      pop,
      state.lastJudge === BEAT_JUDGE_MISS ? RETRO_RED : GOLD,
      "center",
      bloom,
    );
    ctx.globalAlpha = 1;
  }

  pixelRect(ctx, 0, 0, BEAT_WORLD_W, BEAT_HUD_H, "#000000");
  for (let lane = 0; lane < BEAT_LANES; lane++) pixelRect(ctx, lane * laneW, BEAT_HUD_H - 2, laneW, 2, `${NEON[lane]!}90`);
  const reward=successFrame(ctx,{id:'beat',tick:state.tick,count:state.combo,eventTick:state.lastJudge===1?state.tick-state.judgeAge:0,misses:state.misses,every:10,colour:tier>=3?GOLD:tier===2?SUCCESS_ACCENTS.pink:SUCCESS_ACCENTS.cyan,width:BEAT_WORLD_W,height:BEAT_WORLD_H,point:{x:beatLaneX(Math.max(0,state.lastLane)),y:BEAT_HIT_LINE_Y,shape:'ring',radius:6},hud:{x:12,y:20,text:`COMBO ${state.combo}`}});
  if(state.lastJudge===1&&state.judgeAge<10){ctx.save();ctx.globalAlpha=.45*(1-state.judgeAge/10);ctx.strokeStyle=RETRO_WHITE;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(beatLaneX(Math.max(0,state.lastLane)),BEAT_HIT_LINE_Y,8+state.judgeAge*3,3,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
  successHud(ctx,'beat',state.tick,12,20,()=>{retroReadout(ctx, 12, 2, `COMBO ${state.combo}`, RETRO_WHITE);});
}

/**
 * Rev 2 swipe note: the same rect as a tap note, outlined, with a pixel arrow
 * pointing the way to swipe (white, so it reads on every lane colour).
 */
function drawSwipe(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, colour: string, dir: number, bloom: number): void {
  pixelRect(ctx, x, y, w, BEAT_NOTE_H, "#000000");
  pixelRect(ctx, x, y, w, 2, colour, bloom);
  pixelRect(ctx, x, y + BEAT_NOTE_H - 2, w, 2, colour, bloom);
  pixelRect(ctx, x, y, 2, BEAT_NOTE_H, colour, bloom);
  pixelRect(ctx, x + w - 2, y, 2, BEAT_NOTE_H, colour, bloom);
  const cx = x + w / 2;
  const cy = y + BEAT_NOTE_H / 2;
  // Shaft, then a stepped head.
  pixelRect(ctx, cx - 12, cy - 1, 24, 2, RETRO_WHITE);
  for (let k = 0; k < 5; k++) {
    const hx = dir > 0 ? cx + 12 - k * 2 : cx - 12 + k * 2;
    pixelRect(ctx, hx - 1, cy - 1 - k, 2, 2 + 2 * k, RETRO_WHITE);
  }
}

/**
 * A glowing pixel bar on the note's exact rect, with a darker inner line.
 * Polish G: drawn from a cached sprite per colour (lit top row, shaded bottom
 * row, a 2 px glow at most) instead of a shadowBlur per note.
 */
export function drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, colour: string, bloom: number): void {
  const sprite = noteSprite(colour, w);
  if (sprite) {
    ctx.drawImage(sprite as CanvasImageSource, Math.round(x) - 2, Math.round(y) - 2, Math.round(w) + 4, BEAT_NOTE_H + 4);
    return;
  }
  pixelRect(ctx, x, y, w, BEAT_NOTE_H, colour, bloom);
  pixelRect(ctx, x + 4, y + 6, w - 8, 4, "rgba(0,0,0,0.35)");
}

const NOTE_SCALE = 3;
/** A note bar's art with its 2 px halo, the bar at (0, 0) (the sprite below; the game icon paints it at its real size). */
export function paintNote(c: CanvasRenderingContext2D, colour: string, w: number): void {
  // Soft 2 px halo, then the bar itself.
  c.fillStyle = `${colour}30`;
  c.fillRect(-2, -2, w + 4, BEAT_NOTE_H + 4);
  c.fillStyle = `${colour}60`;
  c.fillRect(-1, -1, w + 2, BEAT_NOTE_H + 2);
  c.fillStyle = colour;
  c.fillRect(0, 0, w, BEAT_NOTE_H);
  // Polish A1: a bright top edge, then the lit row under it.
  c.fillStyle = "rgba(255,255,255,0.8)";
  c.fillRect(1, 0, w - 2, 2);
  c.fillStyle = "rgba(255,255,255,0.4)";
  c.fillRect(2, 2, w - 4, 2);
  c.fillStyle = "rgba(0,0,0,0.3)";
  c.fillRect(0, BEAT_NOTE_H - 2, w, 2);
  c.fillStyle = "rgba(0,0,0,0.35)";
  c.fillRect(4, 6, w - 8, 4);
  c.fillStyle = "rgba(255,255,255,0.9)";
  c.fillRect(0, 0, 2, 2);
  c.fillRect(w - 2, 0, 2, 2);
}
const noteSprites = new Map<string, ArtCanvas | null>();
function noteSprite(colour: string, width: number): ArtCanvas | null {
  const w = Math.round(width);
  const key = `${colour}:${w}`;
  if (noteSprites.has(key)) return noteSprites.get(key) ?? null;
  const canvas = artCanvas((w + 4) * NOTE_SCALE, (BEAT_NOTE_H + 4) * NOTE_SCALE);
  const c = canvas && (artContext(canvas) as CanvasRenderingContext2D | null);
  if (canvas && c) {
    c.scale(NOTE_SCALE, NOTE_SCALE);
    c.translate(2, 2);
    paintNote(c, colour, w);
  }
  noteSprites.set(key, canvas && c ? canvas : null);
  return canvas && c ? canvas : null;
}

/**
 * Polish G: the static stage, painted once per device scale: each lane's tint
 * deepening towards the hit line, double neon rails, a retro floor grid, the
 * darker strip below the hit line and a target pad outline per lane where the
 * notes land. Flat paint only.
 * Polish A1 (display only): a purple synthwave sky with a magenta glow on the hit line's horizon, each
 * lane's tint brighter towards the bottom, glowing inner dividers and a soft tap zone per lane under
 * the line; the world's very edges stay as dark as before, where the screen fill takes over.
 */
function paintStage(c: CanvasRenderingContext2D, BEAT_WORLD_H: number): void {
  const BEAT_HIT_LINE_Y = beatHitLineY({ worldH: BEAT_WORLD_H });
  const laneW = BEAT_WORLD_W / BEAT_LANES;
  const h = BEAT_WORLD_H - BEAT_HUD_H;
  c.fillStyle = "#0B0A10";
  c.fillRect(0, 0, BEAT_WORLD_W, BEAT_WORLD_H);
  // The synthwave sky: deep purple at the top, warming to violet at the hit line, dark again below.
  c.fillStyle = linear(c, 0, BEAT_HUD_H, 0, BEAT_WORLD_H, [
    [0, "#0D0619"],
    [Math.max(0.05, (BEAT_HIT_LINE_Y - BEAT_HUD_H) / h - 0.25), "#1A0A33"],
    [(BEAT_HIT_LINE_Y - BEAT_HUD_H) / h, "#2A0E4A"],
    [Math.min(0.97, (BEAT_HIT_LINE_Y - BEAT_HUD_H) / h + 0.06), "#160A26"],
    [1, "#0D0A14"],
  ]);
  c.fillRect(0, BEAT_HUD_H, BEAT_WORLD_W, h);
  blob(c, BEAT_WORLD_W / 2, BEAT_HIT_LINE_Y, BEAT_WORLD_W * 0.62, "#C23CFF", 0.22, 0.42);
  blob(c, BEAT_WORLD_W / 2, BEAT_HIT_LINE_Y, BEAT_WORLD_W * 0.3, "#FF5FD0", 0.14, 0.35);
  // Darker towards the world's sides, so its edges meet the screen fill as before.
  for (const [x, x0, x1] of [[0, 0, 40], [BEAT_WORLD_W - 40, BEAT_WORLD_W, BEAT_WORLD_W - 40]] as const) {
    c.fillStyle = linear(c, x0, 0, x1, 0, [[0, "rgba(11,10,16,0.75)"], [1, "rgba(11,10,16,0)"]]);
    c.fillRect(x, BEAT_HUD_H, 40, h);
  }
  for (let lane = 0; lane < BEAT_LANES; lane++) {
    const x = lane * laneW;
    const colour = NEON[lane]!;
    const tint = c.createLinearGradient(0, BEAT_HUD_H, 0, BEAT_HIT_LINE_Y);
    tint.addColorStop(0, `${colour}05`);
    tint.addColorStop(0.6, `${colour}14`);
    tint.addColorStop(1, `${colour}3A`);
    c.fillStyle = tint;
    c.fillRect(x, BEAT_HUD_H, laneW, BEAT_HIT_LINE_Y - BEAT_HUD_H);
    // The lane's own glow, rising from the hit line.
    c.fillStyle = linear(c, 0, BEAT_HIT_LINE_Y, 0, BEAT_HIT_LINE_Y - 90, [[0, `${colour}30`], [1, `${colour}00`]]);
    c.fillRect(x + 4, BEAT_HIT_LINE_Y - 90, laneW - 8, 90);
    c.fillStyle = `${colour}10`;
    c.fillRect(x, BEAT_HIT_LINE_Y, laneW, BEAT_WORLD_H - BEAT_HIT_LINE_Y);
    // Inner dividers glow softly (the world's outer edges stay plain).
    if (lane > 0) {
      c.fillStyle = linear(c, x - 8, 0, x + 8, 0, [[0, `${NEON[lane - 1]!}00`], [0.5, `${NEON[lane - 1]!}2A`], [0.5, `${colour}2A`], [1, `${colour}00`]]);
      c.fillRect(x - 8, BEAT_HUD_H, 16, h);
    }
    c.fillStyle = `${colour}A0`;
    c.fillRect(Math.round(x + 2), BEAT_HUD_H, 2, h);
    c.fillRect(Math.round(x + laneW - 4), BEAT_HUD_H, 2, h);
    c.fillStyle = `${colour}30`;
    c.fillRect(Math.round(x + 6), BEAT_HUD_H, 1, h);
    c.fillRect(Math.round(x + laneW - 7), BEAT_HUD_H, 1, h);
    // Target pad where this lane's notes meet the hit line: outline and corner pixels.
    const px = Math.round(x + 10), pw = Math.round(laneW - 20), py = BEAT_HIT_LINE_Y - BEAT_NOTE_H / 2;
    c.fillStyle = `${colour}22`;
    c.fillRect(px, py, pw, BEAT_NOTE_H);
    c.fillStyle = `${colour}80`;
    c.fillRect(px, py, pw, 1);
    c.fillRect(px, py + BEAT_NOTE_H - 1, pw, 1);
    c.fillRect(px, py, 1, BEAT_NOTE_H);
    c.fillRect(px + pw - 1, py, 1, BEAT_NOTE_H);
    c.fillStyle = colour;
    for (const [cx, cy] of [[px, py], [px + pw - 3, py], [px, py + BEAT_NOTE_H - 3], [px + pw - 3, py + BEAT_NOTE_H - 3]] as const) c.fillRect(cx, cy, 3, 3);
  }
  // Retro floor grid: rows closing up towards the top of the lanes.
  c.fillStyle = "rgba(200,140,255,0.08)";
  for (let k = 1; k < 18; k++) {
    const y = Math.round(BEAT_HIT_LINE_Y - (BEAT_HIT_LINE_Y - BEAT_HUD_H) * (1 - Math.pow(1 - k / 18, 1.7)));
    c.fillRect(0, y, BEAT_WORLD_W, 1);
  }
  c.fillStyle = "rgba(0,0,0,0.35)";
  c.fillRect(0, BEAT_HIT_LINE_Y + 2, BEAT_WORLD_W, BEAT_WORLD_H - BEAT_HIT_LINE_Y - 2);
  // Soft tap zones under the line: a lane-coloured pad fading down, its top edge lit.
  const zoneTop = BEAT_HIT_LINE_Y + 12;
  const zoneH = Math.max(0, BEAT_WORLD_H - zoneTop - 14);
  for (let lane = 0; lane < BEAT_LANES && zoneH > 8; lane++) {
    const colour = NEON[lane]!;
    const x = Math.round(lane * laneW + 12), w = Math.round(laneW - 24);
    c.fillStyle = linear(c, 0, zoneTop, 0, zoneTop + zoneH, [[0, `${colour}2E`], [0.55, `${colour}10`], [1, `${colour}00`]]);
    c.fillRect(x, zoneTop, w, zoneH);
    c.fillStyle = `${colour}55`;
    c.fillRect(x + 2, zoneTop, w - 4, 1);
    c.fillStyle = `${colour}22`;
    c.fillRect(x, zoneTop + 1, 1, Math.round(zoneH * 0.5));
    c.fillRect(x + w - 1, zoneTop + 1, 1, Math.round(zoneH * 0.5));
  }
}

const stages = new WeakMap<CanvasRenderingContext2D, { key: string; layer: ArtCanvas | null }>();
function drawStage(ctx: CanvasRenderingContext2D, BEAT_WORLD_H: number): void {
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  const sx = Math.min(3, Math.max(1, t ? Math.abs(t.a) : 1));
  const sy = Math.min(3, Math.max(1, t ? Math.abs(t.d) : 1));
  const key = `${sx.toFixed(3)}x${sy.toFixed(3)}:${BEAT_WORLD_H}`;
  let cached = stages.get(ctx);
  if (!cached || cached.key !== key) {
    const layer = artCanvas(Math.ceil(BEAT_WORLD_W * sx), Math.ceil(BEAT_WORLD_H * sy));
    const c = layer && (artContext(layer) as CanvasRenderingContext2D | null);
    if (layer && c) {
      c.scale(sx, sy);
      paintStage(c, BEAT_WORLD_H);
    }
    stages.set(ctx, (cached = { key, layer: layer && c ? layer : null }));
  }
  if (cached.layer) ctx.drawImage(cached.layer as CanvasImageSource, 0, 0, BEAT_WORLD_W, BEAT_WORLD_H);
  else paintStage(ctx, BEAT_WORLD_H);
}

export const beatArtGame: ArcadeGame<BeatState, ArcadeInputEvent | null> = { ...beatGame, draw };
