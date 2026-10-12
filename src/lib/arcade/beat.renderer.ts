import { reducedMotion } from "./art.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { BEAT_FX } from "./arcadeFxGames.renderer";
import { successHud, successFrame, SUCCESS_ACCENTS } from "./success.renderer";
/** Beat in the Retro Arcade world. Render only; the chart, judging and score are untouched. */
import {
  beatGame,
  BEAT_COMBO_TIERS,
  BEAT_FALL_TICKS,
  BEAT_HIT_LINE_Y,
  BEAT_HUD_H,
  BEAT_JUDGE_MISS,
  BEAT_JUDGE_NONE,
  BEAT_JUDGE_PENDING,
  BEAT_JUDGE_TEXT,
  BEAT_LANE_COLOURS,
  BEAT_LANES,
  BEAT_NOTE_H,
  BEAT_OK_TICKS,
  BEAT_WORLD_H,
  BEAT_WORLD_W,
  beatLaneX,
  type BeatState,
} from "./beat";
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "./engine";
import { pixelRect, retroBloom, retroNeon, retroReadout, retroScreen, retroText, RETRO_RED, RETRO_WHITE } from "./retro.renderer";

const NEON = BEAT_LANE_COLOURS.map(retroNeon);
const GOLD = "#FFD84A";
const lanePulses=new WeakMap<CanvasRenderingContext2D,{tick:number;event:number;at:number}>();

function draw(ctx: CanvasRenderingContext2D, state: BeatState, size: CanvasSize): void {
  // Stretch, exactly as the original draw, so taps map to the same lanes.
  retroScreen(ctx, size, BEAT_WORLD_W, BEAT_WORLD_H, "stretch", (c) => arcadeFx(c, BEAT_FX, state, () => drawWorld(c, state)));
}

function drawWorld(ctx: CanvasRenderingContext2D, state: BeatState): void {
  const laneW = BEAT_WORLD_W / BEAT_LANES;
  const bloom = retroBloom();
  const tier = BEAT_COMBO_TIERS.filter((t) => state.combo >= t).length;
  const eventTick=state.tick-state.judgeAge;
  let pulse=lanePulses.get(ctx);
  if(!pulse||state.tick<pulse.tick)pulse={tick:state.tick,event:-Infinity,at:-Infinity};
  if(state.lastJudge===1&&eventTick!==pulse.event){if(eventTick-pulse.at>=20)pulse.at=eventTick;pulse.event=eventTick;}
  pulse.tick=state.tick;lanePulses.set(ctx,pulse);
  const hit = !reducedMotion() && state.lastJudge === 1 && eventTick===pulse.at && state.judgeAge < 12;

  for (let lane = 0; lane < BEAT_LANES; lane++) {
    const x = lane * laneW;
    const colour = NEON[lane]!;
    const h = BEAT_WORLD_H - BEAT_HUD_H;
    pixelRect(ctx, x, BEAT_HUD_H, laneW, h, `${colour}10`);
    pixelRect(ctx, x + 2, BEAT_HUD_H, 2, h, `${colour}A0`);
    pixelRect(ctx, x + laneW - 4, BEAT_HUD_H, 2, h, `${colour}A0`);
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
    if (state.holding[lane]! >= 0) pixelRect(ctx, x, BEAT_HIT_LINE_Y - 12, laneW, 24, `${colour}55`);
  }

  pixelRect(ctx, 0, BEAT_HIT_LINE_Y - 2, BEAT_WORLD_W, 4, RETRO_WHITE, bloom);

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

/** A glowing pixel bar on the note's exact rect, with a darker inner line. */
function drawBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, colour: string, bloom: number): void {
  pixelRect(ctx, x, y, w, BEAT_NOTE_H, colour, bloom);
  pixelRect(ctx, x + 4, y + 6, w - 8, 4, "rgba(0,0,0,0.35)");
}

export const beatArtGame: ArcadeGame<BeatState, ArcadeInputEvent | null> = { ...beatGame, draw };
