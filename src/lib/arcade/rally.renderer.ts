import { reducedMotion } from "./art.renderer";
import { arcadeFx, drawFxGlow } from "./arcadeFx.renderer";
import { rallyFxFor } from "./arcadeFxGames.renderer";
import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";
import { successHud, successFrame, SUCCESS_ACCENTS } from "./success.renderer";
import {
  rallyGame,
  rallyPaddleW,
  rallyTargetLeft,
  rallyTotalHits,
  RALLY_BALL_R,
  RALLY_BUMPER_FROM,
  RALLY_BUMPER2_FROM,
  RALLY_BUMPER_R,
  RALLY_GOLD_POINTS,
  RALLY_HUD_H,
  RALLY_PADDLE_H,
  rallyPaddleY,
  rallyWorldH,
  RALLY_REV,
  RALLY_TARGET_POINTS,
  RALLY_TARGET_W,
  RALLY_WALL,
  RALLY_WORLD_W,
  type RallyState,
} from "./rally";
import { px, type ArcadeGame, type ArcadeInputEvent, type CanvasSize } from "./engine";
import type { BandFields } from "./scoreBands";
import {
  drawRetroTrail,
  pixelRect,
  pixelShape,
  retroBall,
  retroBloom,
  retroBurst,
  retroClock,
  retroEventAge,
  retroPaddle,
  retroReadout,
  retroScreen,
  retroText,
  retroTrail,
  RETRO_WHITE,
} from "./retro.renderer";

const COURT = "#1F6F8B";
// Tuning D: a near-black court so the ball, paddle and lights carry the screen.
const COURT_DIM = "#06141A";
const FLOOR_A = "#020507";
const FLOOR_B = "#04080B";
const PADDLE = "#3DFFE0";
const GOLD = "#FFD84A";
const PAD = "#FF6FD8";
const BUMPER = "#B49CFF";

function draw(ctx: CanvasRenderingContext2D, state: RallyState, size: CanvasSize): void {
  retroScreen(ctx, size, RALLY_WORLD_W, rallyWorldH(state), "stretch", (c) => arcadeFx(c, rallyFxFor(state), state, () => drawWorld(c, state, ctx)));
}
function drawReveal(ctx: CanvasRenderingContext2D, state: RallyState, size: CanvasSize): void {
  retroScreen(ctx, size, RALLY_WORLD_W, rallyWorldH(state), "stretch", (c) => arcadeFx(c, rallyFxFor(state), state, () => drawWorld(c, state, ctx, false)));
}

/**
 * The arena floor and markings, drawn once per canvas size into a cached layer:
 * a checkered pixel floor, a neon grid, the centre line and circle, service
 * boxes and the baseline under the paddle. Flat floor paint only — nothing
 * here is something a ball can hit.
 */
const courts = new WeakMap<CanvasRenderingContext2D, { key: string; layer: ArtCanvas }>();
function courtLayer(ctx: CanvasRenderingContext2D, RALLY_WORLD_H: number): ArtCanvas | null {
  const t = ctx.getTransform();
  const sx = Math.max(1, Math.abs(t.a));
  const sy = Math.max(1, Math.abs(t.d));
  // rallyRev 6: the court's height is part of the key (the taller court has its own layer).
  const key = `${sx.toFixed(3)}x${sy.toFixed(3)}:${RALLY_WORLD_H}`;
  const RALLY_PADDLE_Y = rallyPaddleY({ worldH: RALLY_WORLD_H });
  const old = courts.get(ctx);
  if (old && old.key === key) return old.layer;
  const layer = artCanvas(Math.ceil(RALLY_WORLD_W * sx), Math.ceil(RALLY_WORLD_H * sy));
  const c = layer && (artContext(layer) as CanvasRenderingContext2D | null);
  if (!layer || !c) return null;
  c.scale(sx, sy);
  const top = RALLY_HUD_H + RALLY_WALL;
  const left = RALLY_WALL;
  const right = RALLY_WORLD_W - RALLY_WALL;
  const tile = 26;
  // Checkered floor.
  for (let y = top; y < RALLY_WORLD_H; y += tile) {
    for (let x = left; x < right; x += tile) {
      c.fillStyle = ((x - left) / tile + (y - top) / tile) % 2 === 0 ? FLOOR_A : FLOOR_B;
      c.fillRect(Math.round(x), Math.round(y), Math.min(tile, right - x), tile);
    }
  }
  // Neon grid, brighter towards the paddle.
  for (let y = top + tile; y < RALLY_WORLD_H; y += tile) {
    c.fillStyle = `rgba(31,111,139,${(0.06 + 0.16 * ((y - top) / (RALLY_WORLD_H - top))).toFixed(3)})`;
    c.fillRect(left, Math.round(y), right - left, 1);
  }
  for (let x = left + tile; x < right; x += tile) {
    c.fillStyle = "rgba(31,111,139,0.09)";
    c.fillRect(Math.round(x), top, 1, RALLY_WORLD_H - top);
  }
  // Centre line, centre circle and the two service boxes.
  const mid = Math.round((top + RALLY_PADDLE_Y) / 2);
  c.fillStyle = `${COURT}88`;
  for (let x = left + 6; x < right - 6; x += 16) c.fillRect(x, mid - 1, 8, 2);
  const ring = 34;
  for (let a = 0; a < 48; a++) {
    const ang = (a / 48) * Math.PI * 2;
    c.fillRect(Math.round(RALLY_WORLD_W / 2 + Math.cos(ang) * ring) - 1, Math.round(mid + Math.sin(ang) * ring) - 1, 2, 2);
  }
  c.fillStyle = `${COURT}40`;
  const box = 96;
  c.fillRect(Math.round(RALLY_WORLD_W / 2) - 1, mid + 1, 2, box);
  c.fillRect(left + 30, mid + box, right - left - 60, 2);
  c.fillRect(Math.round(RALLY_WORLD_W / 2) - 1, mid - box - 1, 2, box);
  c.fillRect(left + 30, mid - box - 2, right - left - 60, 2);
  // Baseline under the paddle (the red danger strip at the bottom edge went with the fill-ins, 17 Oct 2026).
  c.fillStyle = `${COURT}CC`;
  c.fillRect(left, RALLY_PADDLE_Y + RALLY_PADDLE_H + 10, right - left, 2);
  // Corner brackets.
  c.fillStyle = COURT;
  for (const [x, y, dx, dy] of [[left + 4, top + 4, 1, 1], [right - 4, top + 4, -1, 1], [left + 4, RALLY_WORLD_H - 14, 1, -1], [right - 4, RALLY_WORLD_H - 14, -1, -1]] as const) {
    c.fillRect(Math.min(x, x + dx * 14), y, 14, 2);
    c.fillRect(x - (dx < 0 ? 2 : 0), Math.min(y, y + dy * 14), 2, 14);
  }
  courts.set(ctx, { key, layer });
  return layer;
}

/** Side walls as neon tubes with running lights (presentation clock; still under reduced motion). */
function drawWalls(ctx: CanvasRenderingContext2D, colour: string, _bloom: number, RALLY_WORLD_H: number): void {
  const top = RALLY_HUD_H + RALLY_WALL;
  // The walls are real (the ball bounces off them): soft edges, not neon tubes round the court
  // (17 Oct 2026, display only); they still turn gold on a milestone.
  const soft = `${colour}70`;
  pixelRect(ctx, RALLY_WALL - 2, top - 2, RALLY_WORLD_W - 2 * RALLY_WALL + 4, 2, soft);
  pixelRect(ctx, RALLY_WALL - 2, top - 2, 2, RALLY_WORLD_H, soft);
  pixelRect(ctx, RALLY_WORLD_W - RALLY_WALL, top - 2, 2, RALLY_WORLD_H, soft);
  // The wall casing outside the play area: dark panels with rivets and lights.
  pixelRect(ctx, 0, top - 2, RALLY_WALL - 2, RALLY_WORLD_H, COURT_DIM);
  pixelRect(ctx, RALLY_WORLD_W - RALLY_WALL + 2, top - 2, RALLY_WALL - 2, RALLY_WORLD_H, COURT_DIM);
  pixelRect(ctx, 0, RALLY_HUD_H, RALLY_WORLD_W, RALLY_WALL - 2, COURT_DIM);
  const t = retroClock();
  const run = t === 0 ? -1 : Math.floor(t / 90) % 24;
  for (let i = 0; i < 24; i++) {
    const y = top + 10 + i * 24;
    const lit = i === run || i === (run + 12) % 24;
    pixelRect(ctx, 2, y, 2, 4, lit ? GOLD : `${COURT}AA`);
    pixelRect(ctx, RALLY_WORLD_W - 4, y, 2, 4, lit ? GOLD : `${COURT}AA`);
  }
}

/** Rev 2: a target pad set into the far wall; the ball scores it by touching the wall within its span. */
function drawPad(ctx: CanvasRenderingContext2D, left: number, bloom: number, blink: boolean): void {
  const top = RALLY_HUD_H + RALLY_WALL;
  pixelRect(ctx, left, top - 6, RALLY_TARGET_W, 6, blink ? RETRO_WHITE : PAD, bloom);
  pixelRect(ctx, left + 4, top - 4, RALLY_TARGET_W - 8, 2, "#5A1050");
  retroText(ctx, `+${RALLY_TARGET_POINTS}`, left + RALLY_TARGET_W / 2, top + 4, 8, PAD, "center");
}

/** Rev 2: the round bumper post, drawn exactly as its bounce circle. */
function drawBumper(ctx: CanvasRenderingContext2D, x: number, y: number, flash: boolean, bloom: number): void {
  const r = RALLY_BUMPER_R;
  pixelShape(ctx, x, y, r, 2, (dx, dy) => {
    const d = dx * dx + dy * dy;
    if (d > r * r) return null;
    if (d > (r - 3) * (r - 3)) return flash ? RETRO_WHITE : BUMPER;
    return d < (r * 0.4) ** 2 ? (flash ? BUMPER : RETRO_WHITE) : "#3A2A6E";
  });
  if (bloom > 0 && !reducedMotion()) {
    ctx.save();
    ctx.globalAlpha = flash ? 0.5 : 0.18;
    ctx.strokeStyle = BUMPER;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r + 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawWorld(ctx: CanvasRenderingContext2D, state: RallyState, key: CanvasRenderingContext2D, crashIndicator = true): void {
  // rallyRev 6: the taller court's height and paddle line (the original 620 / 560 otherwise).
  const RALLY_WORLD_H = rallyWorldH(state);
  const RALLY_PADDLE_Y = rallyPaddleY(state);
  const reward=successFrame(ctx,{id:'rally',tick:state.tick,count:rallyTotalHits(state),every:10,colour:GOLD,width:RALLY_WORLD_W,height:RALLY_WORLD_H,point:{x:px(state.x),y:RALLY_PADDLE_Y-4,shape:'spark'},hud:{x:14,y:26,text:`RALLY ${state.hits}`}});
  const heat=reward.chain>=20?SUCCESS_ACCENTS.orange:reward.chain>=10?GOLD:RETRO_WHITE;
  const bloom = retroBloom();
  const layer = courtLayer(ctx, RALLY_WORLD_H);
  if (layer) ctx.drawImage(layer as CanvasImageSource, 0, 0, RALLY_WORLD_W, RALLY_WORLD_H);
  drawWalls(ctx, !reducedMotion() && reward.milestoneAge < 30 ? GOLD : COURT, bloom, RALLY_WORLD_H);

  if (state.rev === RALLY_REV) {
    for (const spot of state.live ?? []) drawPad(ctx, rallyTargetLeft(state.spots ?? [], spot), bloom, false);
    // The pad that was just struck flashes where it was, under a fading pink light.
    if ((state.struckTick ?? 0) > 0 && state.tick - (state.struckTick ?? 0) < 18 && !reducedMotion()) {
      const left = state.struckLeft ?? 0;
      const p = (state.tick - (state.struckTick ?? 0)) / 18;
      lightUp(ctx, left + RALLY_TARGET_W / 2, RALLY_HUD_H + RALLY_WALL, PAD, 46 + 24 * p, 0.75 * (1 - p));
      retroBurst(ctx, left + RALLY_TARGET_W / 2, RALLY_HUD_H + RALLY_WALL, p, PAD, 22);
    }
    // The first bumper from 30 s; rallyRev 5's second from 45 s. Only the one the latest bounce came off flashes.
    const bounced = retroEventAge(key, "rally-bumper", false);
    const posts: [{ x: number; y: number } | undefined, number][] = [[state.bumper, RALLY_BUMPER_FROM], [state.bumper2, RALLY_BUMPER2_FROM]];
    posts.forEach(([bumper, from], i) => {
      if (!bumper) return;
      const until = from - state.tick;
      if (until <= 0) {
        const flash = !reducedMotion() && bounced < 160 && (state.bumped ?? 0) === i;
        drawBumper(ctx, bumper.x, bumper.y, flash, bloom);
      } else if (until <= 120) {
        // Two seconds' warning: a blinking outline where the bumper will appear (it does not bounce yet).
        const on = reducedMotion() || Math.floor(until / 10) % 2 === 0;
        if (on) retroText(ctx, "BUMPER", bumper.x, bumper.y - 5, 8, BUMPER, "center");
      }
    });
  }

  const width = rallyPaddleW(rallyTotalHits(state));
  // Tuning D: the paddle lights up on every hit (presentation clock, never sim state).
  const hitAge = retroEventAge(key, "rally-hit", false);
  if (!reducedMotion() && hitAge < 260) {
    const p = hitAge / 260;
    lightUp(ctx, state.paddleX, RALLY_PADDLE_Y + RALLY_PADDLE_H / 2, heat === RETRO_WHITE ? PADDLE : heat, width * 0.75 + 12 * p, 0.6 * (1 - p));
  }
  retroPaddle(ctx, state.paddleX - width / 2, RALLY_PADDLE_Y, width, RALLY_PADDLE_H, PADDLE, "#0E4A44", bloom);

  state.golds.forEach((ball, i) => {
    const x = px(ball.x);
    const y = px(ball.y);
    drawRetroTrail(ctx, retroTrail(key, state.tick, `g${i}`, x, y, 6), RALLY_BALL_R, GOLD);
    retroBall(ctx, x, y, RALLY_BALL_R, GOLD, GOLD);
  });

  const bx = px(state.x);
  const by = px(state.y);
  if (!state.dead) drawRetroTrail(ctx, retroTrail(key, state.tick, "main", bx, by, 6), RALLY_BALL_R, heat);
  retroBall(ctx, bx, by, RALLY_BALL_R, state.dead && crashIndicator ? "#FF3B5C" : heat);

  successHud(ctx,'rally',state.tick,14,26,()=>{retroReadout(ctx, 14, 8, `RALLY ${state.hits}`, RETRO_WHITE);});
  // rallyRev 3+ (band-stamped, `band`) score on the band curve, so the HUD shows the counts only (17 Oct
  // 2026, display only); unstamped and rallyRev 2 rounds keep their points readout in replays.
  if ((state as RallyState & BandFields).band) {
    retroText(ctx, `GOLD ${state.goldHits} · PADS ${state.targetHits ?? 0}`, RALLY_WORLD_W - 14, 21, 13, GOLD, "right");
  } else {
    const points = state.rev === RALLY_REV
      ? Math.floor(RALLY_GOLD_POINTS * state.goldHits) + RALLY_TARGET_POINTS * (state.targetHits ?? 0)
      : Math.floor(RALLY_GOLD_POINTS * state.goldHits);
    retroText(ctx, `GOLD ${state.goldHits} ${points}PTS`, RALLY_WORLD_W - 14, 20, 15, GOLD, "right");
  }

  if (state.dead && crashIndicator) {
    ctx.fillStyle = "rgba(255,59,92,0.2)";
    ctx.fillRect(0, 0, RALLY_WORLD_W, RALLY_WORLD_H);
  }
}

/** A soft additive light from the shared glow sprite; drawing only. */
function lightUp(ctx: CanvasRenderingContext2D, x: number, y: number, colour: string, radius: number, alpha: number): void {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  drawFxGlow(ctx, colour, x, y, radius, alpha);
  drawFxGlow(ctx, "#FFFFFF", x, y, radius * 0.35, alpha * 0.6);
  ctx.restore();
}

/** Marks bumper bounces and paddle hits on the presentation clock so they flash (render memory only). */
const lastBounces = new WeakMap<CanvasRenderingContext2D, number>();
const lastHits = new WeakMap<CanvasRenderingContext2D, { tick: number; hits: number }>();
function drawTracked(ctx: CanvasRenderingContext2D, state: RallyState, size: CanvasSize): void {
  const before = lastBounces.get(ctx) ?? state.bounces ?? 0;
  lastBounces.set(ctx, state.bounces ?? 0);
  retroEventAge(ctx, "rally-bumper", (state.bounces ?? 0) > before);
  const hits = rallyTotalHits(state);
  const seen = lastHits.get(ctx);
  // A rewind (new run or replay) or the first frame never fires.
  lastHits.set(ctx, { tick: state.tick, hits });
  retroEventAge(ctx, "rally-hit", !!seen && state.tick > seen.tick && hits > seen.hits);
  draw(ctx, state, size);
}

export const rallyArtGame: ArcadeGame<RallyState, ArcadeInputEvent | null> = { ...rallyGame, draw: drawTracked };
export const rallyRevealGame = { draw: drawReveal };
