import { successFrame, SUCCESS_ACCENTS, SUCCESS_PARTICLES, SUCCESS_TICKS } from "./success.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { burstFxFor } from "./arcadeFxGames.renderer";
/** Burst in the Retro Arcade world. Render only; the sim and its bounds are untouched. */
import {
  burstGame,
  burstGameFor,
  BURST_COLOURS,
  BURST_ICON_FREEZE,
  BURST_REV,
  BURST_REV_BAND,
  burstFloorY,
  BURST_REV_TALL, BURST_REV_TARGET, BURST_REV_STRICT, BURST_REV_CLEAN,
  burstCeilingOf,
  burstGoldenNow,
  BURST_V8_CLEAN_PTS,
  BURST_V8_GOLDEN_LIFE,
  BURST_V8_GOLDEN_PTS,
  BURST_ICON_DOUBLE,
  BURST_GOLD_R,
  BURST_LIVES,
  BURST_RADIUS,
  BURST_SHORT_LEN,
  BURST_WORLD_W,
  type BurstState,
} from "./burst";
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "./engine";
import {
  pixelRect,
  retroBloom,
  retroClock,
  retroEventAge,
  retroNeon,
  retroText,
  retroScreen,
  RETRO_RED,
  RETRO_WHITE,
} from "./retro.renderer";

import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";
import { reducedMotion } from "./art.renderer";
import { FX_PARTICLE_LIMIT } from "@/lib/fx/limits";
import { arcadeReducedEffects } from "@/lib/fx/lowEnd";
import { addPop, addShatter, backdrop, blob, drawPops, glow, linear, pixelStars, radial, rise } from "./polishA1.renderer";

export const BURST_FX_ENEMY_THRESHOLD = 24;
export const BURST_FX_SHOT_THRESHOLD = 8;
const FP = 256;
/** Mirrors of private sim geometry (player box and icon half-size). */
const PLAYER_HALF_W = 12;
const PLAYER_H = 36;
const ICON_HALF = 8;
const BEAM = "#4BFF7A";
const WALL = "#B49CFF";
const SHIP = "#FFD84A";
const SHIELD = "#3DFFE0";
/** burstRev 2 FREEZE: ice blue icon, frost on frozen atoms. */
const ICE = "#9FE8FF";
const SNOWFLAKE = ["X..X..X.", ".X.X.X..", "..XXX...", "XXXXXXX.", "..XXX...", ".X.X.X..", "X..X..X."];

/** Full collision-disc atoms. Bloom is cached and clipped inside the disc. */
export function paintAtom(c: CanvasRenderingContext2D, r: number, colour: string, tier: number, bloom = true): void {
  c.save(); c.beginPath(); c.arc(r, r, r, 0, Math.PI * 2); c.clip();
  c.fillStyle = `${colour}22`; c.fill();
  // Polish A1: shaded like a sphere, lit from the top left, darker towards the bottom right (inside the disc).
  c.fillStyle = radial(c, r * 0.7, r * 0.62, r * 1.45, [[0, `${colour}66`], [0.45, `${colour}26`], [1, "rgba(0,0,0,0.45)"]]);
  c.fillRect(0, 0, r * 2, r * 2);
  c.strokeStyle = colour; c.lineWidth = 1.2;
  c.beginPath(); c.arc(r, r, r - .6, 0, Math.PI * 2); c.stroke();
  c.shadowColor = colour; c.shadowBlur = bloom ? 4 : 0;
  c.beginPath(); c.ellipse(r, r, r - 1.3, r * .42, -.55, 0, Math.PI * 2);
  if (tier < 3) c.ellipse(r, r, r - 1.3, r * .42, .75, 0, Math.PI * 2);
  c.stroke();
  c.fillStyle = colour; c.beginPath(); c.arc(r, r, Math.max(2, r * .27), 0, Math.PI * 2); c.fill();
  c.shadowBlur = 0; c.fillStyle = RETRO_WHITE;
  c.beginPath(); c.arc(r - r * .06, r - r * .06, Math.max(1, r * .12), 0, Math.PI * 2); c.fill();
  c.restore();
}

/** Pixel ship, 12 × 18 blocks of 2 px = exactly the 24 × 36 player box. */
export const SHIP_ROWS = [
  ".....XX.....",
  ".....XX.....",
  "....XXXX....",
  "....XXXX....",
  "....X..X....",
  "...XX..XX...",
  "...XXXXXX...",
  "...XXXXXX...",
  "..XXXXXXXX..",
  "..XXXXXXXX..",
  ".XXX.XX.XXX.",
  ".XXXXXXXXXX.",
  "XXXXXXXXXXXX",
  "XXXXXXXXXXXX",
  "XX.XXXXXX.XX",
  "XX..XXXX..XX",
  "X...X..X...X",
  "....X..X....",
];

const lifeMemo = new WeakMap<CanvasRenderingContext2D, { tick: number; lives: number }>();

function draw(ctx: CanvasRenderingContext2D, state: BurstState, size: CanvasSize): void {
  const m = lifeMemo.get(ctx);
  const lost = !!m && state.tick >= m.tick && state.lives < m.lives;
  lifeMemo.set(ctx, { tick: state.tick, lives: state.lives });
  const age = retroEventAge(ctx, "life", lost);
  const flash = age < 400 ? 1 - age / 400 : 0;
  retroScreen(ctx, size, BURST_WORLD_W, burstFloorY(state), "fit", (c) => arcadeFx(c, burstFxFor(state), state, () => drawWorld(c, state, flash, ctx)), flash);
}

type Stamp = { layer: ArtCanvas; width: number; height: number; pad: number };
// Finite art variants only: 4 atoms, ship colours, icons, walls, beam types and shield.
const stamps = new Map<string, Stamp>();
function cachedArt(key: string, width: number, height: number, colour: string, glow: number,
  paint: (ctx: CanvasRenderingContext2D) => void): Stamp | null {
  const old = stamps.get(key);
  if (old) return old;
  const pad = glow ? 16 : 0;
  const layer = artCanvas(Math.ceil((width + pad * 2) * 2), Math.ceil((height + pad * 2) * 2));
  const c = layer && artContext(layer);
  if (!layer || !c) return null;
  c.scale(2, 2); c.translate(pad, pad);
  // Blur is paid once at cache creation, never on the live draw context.
  c.shadowColor = colour; c.shadowBlur = glow;
  paint(c as CanvasRenderingContext2D);
  const stamp = { layer, width, height, pad };
  stamps.set(key, stamp);
  return stamp;
}
function blit(ctx: CanvasRenderingContext2D, stamp: Stamp, left: number, top: number, width = stamp.width, height = stamp.height): void {
  ctx.drawImage(stamp.layer, left - stamp.pad, top - stamp.pad, width + stamp.pad * 2, height + stamp.pad * 2);
}
export function plainSprite(ctx: CanvasRenderingContext2D, rows: readonly string[], left: number, top: number, block: number, colour: string): void {
  ctx.fillStyle = colour;
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === "X") ctx.fillRect(left + x * block, top + y * block, block, block);
  });
}
function sprite(ctx: CanvasRenderingContext2D, rows: readonly string[], left: number, top: number, block: number, colour: string, glow = 0): void {
  const width = (rows[0]?.length ?? 0) * block, height = rows.length * block;
  const stamp = cachedArt(`${rows.join("/")}:${block}:${colour}:${glow}`, width, height, colour, glow,
    c => plainSprite(c, rows, 0, 0, block, colour));
  if (stamp) blit(ctx, stamp, left, top);
  else plainSprite(ctx, rows, left, top, block, colour);
}
function glowRect(ctx: CanvasRenderingContext2D, left: number, top: number, width: number, height: number, colour: string, key: string, vertical = false): void {
  // Long beam glow uses a fixed-size shaft; its hard core remains one exact rect.
  const w = vertical ? 2 : BURST_WORLD_W, h = vertical ? BURST_SHORT_LEN : 2;
  const stamp = cachedArt(key, w, h, colour, 8, c => { c.fillStyle = colour; c.fillRect(0, 0, w, h); });
  if (stamp) {
    const pad = stamp.pad;
    ctx.globalAlpha = Math.min(1, retroBloom() / 9);
    if (vertical && height === BURST_SHORT_LEN) {
      blit(ctx, stamp, left, top);
    } else if (vertical) {
      // Slice the shaft and end caps separately: stretching never lengthens the caps.
      ctx.drawImage(stamp.layer, 0, pad * 2, stamp.layer.width, h * 2, left - pad, top, w + pad * 2, height);
      ctx.drawImage(stamp.layer, 0, 0, stamp.layer.width, pad * 2, left - pad, top - pad, w + pad * 2, pad);
      ctx.drawImage(stamp.layer, 0, (pad + h) * 2, stamp.layer.width, pad * 2, left - pad, top + height, w + pad * 2, pad);
    } else blit(ctx, stamp, left, top, width, height);
    ctx.globalAlpha = 1;
  }
  pixelRect(ctx, left, top, width, height, colour);
}
type Pop = { tick: number; x: number; y: number; colour: string; spread: number };
const popMemo = new WeakMap<CanvasRenderingContext2D, { tick: number; seen: number; pops: Pop[] }>();
/** Pre-effects pops keep the full shared cap; only a live full-split sparkle reserves its share. */
function popBudget(state: BurstState): number {
  const sparkle = state.popSize === 3 && state.tick - state.popTick >= 0 && state.tick - state.popTick < SUCCESS_TICKS;
  return sparkle ? FX_PARTICLE_LIMIT - SUCCESS_PARTICLES : FX_PARTICLE_LIMIT;
}
function particles(ctx: CanvasRenderingContext2D, state: BurstState): void {
  let memo = popMemo.get(ctx);
  if (!memo || state.tick < memo.tick) memo = { tick: state.tick, seen: -100, pops: [] };
  memo.tick = state.tick;
  const duration=reducedMotion()?10:18;
  memo.pops = memo.pops.filter(p => state.tick - p.tick < duration);
  if (state.popTick !== memo.seen) {
    memo.seen = state.popTick;
    if (state.tick - state.popTick >= 0 && state.tick - state.popTick < duration &&
      state.balls.length <= BURST_FX_ENEMY_THRESHOLD && state.shots.length <= BURST_FX_SHOT_THRESHOLD &&
      memo.pops.length * 8 + 8 <= popBudget(state)) {
      memo.pops.push({ tick: state.popTick, x: state.popX / FP, y: state.popY / FP,
        colour: retroNeon(BURST_COLOURS[state.popSize] ?? RETRO_WHITE), spread: BURST_RADIUS[state.popSize] ?? 16 });
    }
  }
  popMemo.set(ctx, memo);
  for (const pop of memo.pops) {
    const age = reducedMotion() ? 0 : (state.tick - pop.tick) / 18;
    ctx.globalAlpha = 1 - age;
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4 + 0.35, distance = pop.spread * age + 2;
      pixelRect(ctx, pop.x + Math.cos(angle) * distance - 2, pop.y + Math.sin(angle) * distance - 2, 4, 4, pop.colour);
    }
  }
  ctx.globalAlpha = 1;
}

function drawWorld(ctx: CanvasRenderingContext2D, state: BurstState, lifeFlash: number, key: object = ctx): void {
  const tick = state.tick;
  // burstRev 4: the taller arena's floor and its scaled ceiling (560 otherwise).
  const BURST_FLOOR_Y = burstFloorY(state);
  // burstRev 7: the higher arena's ceiling (burstCeilingOf gives the original's on older rounds).
  const ceil = burstCeilingOf(state);
  backdrop(ctx, "fission-space", BURST_WORLD_W, BURST_FLOOR_Y, (c) => paintSpace(c, BURST_FLOOR_Y));

  // Ceiling and side walls as neon; the ceiling flashes while a ball touches it.
  const touching = state.balls.some((b) => b.y / FP - (BURST_RADIUS[b.size] ?? 8) <= ceil + 2);
  pixelRect(ctx, 0, 0, BURST_WORLD_W, ceil, "rgba(180,156,255,0.05)");
  // The ceiling, walls and floor are real (atoms bounce off them): soft edges at rest, not a neon frame
  // (17 Oct 2026, display only); the ceiling still flashes while a ball touches it.
  if (touching) glowRect(ctx, 0, ceil - 2, BURST_WORLD_W, 2, RETRO_WHITE, "ceiling-flash");
  else pixelRect(ctx, 0, ceil - 2, BURST_WORLD_W, 2, `${WALL}55`);
  pixelRect(ctx, 0, ceil, 2, BURST_FLOOR_Y - ceil, `${WALL}30`);
  pixelRect(ctx, BURST_WORLD_W - 2, ceil, 2, BURST_FLOOR_Y - ceil, `${WALL}30`);
  pixelRect(ctx, 0, BURST_FLOOR_Y - 2, BURST_WORLD_W, 2, `${SHIELD}30`);

  // Shots: thin green beams on the original shot lines.
  for (const shot of state.shots) {
    const x = shot.x / FP;
    const top = shot.top / FP;
    const bottom = shot.short ? top + BURST_SHORT_LEN : BURST_FLOOR_Y;
    if (bottom > top) {
      beamHalo(ctx, x, top, bottom - top);
      glowRect(ctx, x - 1, top, 2, bottom - top, BEAM, shot.short ? "beam-short" : "beam-long", true);
    }
  }

  // Power-up icons inside their 16 × 16 boxes.
  for (const icon of state.icons) {
    const x = icon.x / FP;
    const y = icon.y / FP;
    if (icon.kind === BURST_ICON_FREEZE) {
      sprite(ctx, SNOWFLAKE, x - 7, y - 7, 2, ICE, 8);
      continue;
    }
    if (icon.kind === BURST_ICON_DOUBLE) {
      // burstRev 7 DOUBLE beam: two green beams in a gold frame.
      sprite(ctx, DOUBLE_ICON, x - ICON_HALF, y - ICON_HALF, 2, BEAM, 8);
      continue;
    }
    if (icon.kind === 1) {
      sprite(ctx, ["..XXXX..", ".X....X.", "X..XX..X", "X.X..X.X", "X..XX..X", ".X....X.", "..XXXX.."], x - ICON_HALF, y - 7, 2, SHIELD);
    } else {
      sprite(ctx, ["...XX...", "..XXXX..", ".XXXXXX.", "XXXXXXXX", ".XXXXXX.", "..XXXX..", "...XX..."], x - ICON_HALF, y - 7, 2, SHIP);
    }
  }

  // Atoms fill the authoritative circle; electron rings never exceed it.
  for (const ball of state.balls) {
    const r = BURST_RADIUS[ball.size] ?? 8;
    const colour = retroNeon(BURST_COLOURS[ball.size] ?? RETRO_WHITE);
    const stamp = cachedArt(`atom:${ball.size}`, r * 2, r * 2, colour, 0,
      c => paintAtom(c, r, colour, ball.size));
    const x = ball.x / FP, y = ball.y / FP;
    // Polish A1: a soft glow in the atom's colour, at most 3 px past its disc.
    glow(ctx, colour, x, y, r + 3, r + 3, 0.42);
    if (stamp) blit(ctx, stamp, x - r, y - r);
    else { ctx.save(); ctx.translate(x - r, y - r); paintAtom(ctx, r, colour, ball.size, false); ctx.restore(); }
    // A bounded, short flash at the existing split event; daughters are sim objects.
    const age = tick - state.popTick;
    if (age >= 0 && age < 8 && Math.hypot(x - state.popX / FP, y - state.popY / FP) < (BURST_RADIUS[state.popSize] ?? 8) * 2) {
      ctx.globalAlpha = .65 * (1 - age / 8);
      ctx.fillStyle = RETRO_WHITE; ctx.beginPath(); ctx.arc(x, y, r - .6, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
  }
  // burstRev 2: every atom frozen in place — an ice glaze inside each disc, thawing out over the last second.
  const freeze = state.freeze ?? 0;
  if (freeze > 0) {
    const glaze = Math.min(1, freeze / 60);
    for (const ball of state.balls) {
      const r = BURST_RADIUS[ball.size] ?? 8;
      const x = ball.x / FP, y = ball.y / FP;
      ctx.globalAlpha = 0.45 * glaze;
      ctx.fillStyle = ICE;
      ctx.beginPath(); ctx.arc(x, y, r - 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.9 * glaze;
      ctx.strokeStyle = RETRO_WHITE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.5, y - r * 0.2); ctx.lineTo(x - r * 0.1, y - r * 0.55);
      ctx.moveTo(x + r * 0.15, y + r * 0.5); ctx.lineTo(x + r * 0.5, y + r * 0.1);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.18 * glaze;
    pixelRect(ctx, 0, ceil, BURST_WORLD_W, 4, ICE);
    pixelRect(ctx, 0, BURST_FLOOR_Y - 6, BURST_WORLD_W, 4, ICE);
    ctx.globalAlpha = 1;
  }
  if (state.exp) drawV8(ctx, state, key);
  successFrame(ctx,{id:'burst',tick:state.tick,count:0,eventTick:state.popSize===3?state.popTick:0,colour:SHIP,width:BURST_WORLD_W,height:BURST_FLOOR_Y,point:{x:state.popX/FP,y:state.popY/FP,shape:'spark'},enabled:state.balls.length<=BURST_FX_ENEMY_THRESHOLD&&state.shots.length<=BURST_FX_SHOT_THRESHOLD});
  particles(ctx, state);
  splitPop(ctx, state, key);

  // Ship in the exact player box; flashes while invulnerable or just hit.
  const hide = state.invuln > 0 && Math.trunc(tick / 5) % 2 === 1;
  if (!hide) {
    const left = state.x / FP - PLAYER_HALF_W;
    const top = BURST_FLOOR_Y - PLAYER_H;
    const colour = lifeFlash > 0 ? RETRO_RED : SHIP;
    const double = (state.double ?? 0) > 0;
    sprite(ctx, SHIP_ROWS, left, top, 2, lifeFlash > 0 ? RETRO_RED : state.burst ? "#FFF2A8" : double ? "#C8FFB0" : colour, state.burst || double ? 12 : 0);
    pixelRect(ctx, left + 10, top + 8, 4, 2, "#000000");
  }
  if (state.shield) {
    // Flickering neon ring at the original shield ring.
    const t = retroClock();
    ctx.globalAlpha = t === 0 ? 0.85 : 0.6 + 0.35 * (Math.floor(t / 70) % 2);
    const cx = state.x / FP;
    const cy = BURST_FLOOR_Y - 18;
    const paint = (c: CanvasRenderingContext2D) => {
      c.fillStyle = SHIELD;
      for (let i = 0; i < 32; i++) {
        const a = i / 32 * Math.PI * 2;
        c.fillRect(Math.round(28 + Math.cos(a) * 26 - 1), Math.round(28 + Math.sin(a) * 26 - 1), 3, 3);
      }
    };
    const shield = cachedArt("shield", 56, 56, SHIELD, 0, paint);
    if (shield) blit(ctx, shield, cx - 28, cy - 28);
    else { ctx.save(); ctx.translate(cx - 28, cy - 28); paint(ctx); ctx.restore(); }
    ctx.globalAlpha = 1;
  }

  const score = burstGameFor(state.exp ? BURST_REV_CLEAN : null).score(state);
  const on = Math.floor(retroClock() / 500) % 2 === 0;
  if (state.exp) {
    // burstRev 8: one slim line above the higher ceiling (24 px): wave and score, a live power-up, the
    // clean counter (shots that hit / shots fired this wave; red once one has missed) and the lives.
    const double = state.double ?? 0;
    retroText(ctx, `WAVE ${Math.max(1, state.wave)} ${score}`, 10, 7, 8, RETRO_WHITE);
    if (freeze > 0 || double > 0) {
      const status = freeze > 0 ? [`FREEZE ${Math.ceil(freeze / 60)}`, ICE] : [`DOUBLE ${Math.ceil(double / 60)}`, BEAM];
      retroText(ctx, status[0]!, BURST_WORLD_W / 2 - 10, 7, 8, status[1]!, "center");
    }
    const missed = (state.missed ?? 0) > 0;
    retroText(ctx, `CLEAN ${state.landed ?? 0}/${state.fired ?? 0}`, BURST_WORLD_W - 56, 7, 8, missed ? "rgba(255,90,110,0.85)" : CLEAN, "right");
    for (let i = 0; i < BURST_LIVES; i++) sprite(ctx, SHIP_ROWS, BURST_WORLD_W - 48 + i * 14, 4, 0.75, i < state.lives ? SHIP : "rgba(255,216,74,0.2)");
  } else {
  retroText(ctx, "1UP", 14, 8, 8, on ? RETRO_RED : "rgba(255,59,92,0.35)");
  retroText(ctx, `WAVE ${Math.max(1, state.wave)} ${score}${state.burst ? " BURST" : ""}`, 14, 20, 10, RETRO_WHITE);
  if (freeze > 0) retroText(ctx, `FREEZE ${Math.ceil(freeze / 60)}`, 14, 34, 10, ICE);
  for (let i = 0; i < BURST_LIVES; i++) {
    sprite(ctx, SHIP_ROWS, BURST_WORLD_W - 100 + i * 16, 14, 0.75, i < state.lives ? SHIP : "rgba(255,216,74,0.2)");
  }
  }
}

/**
 * Polish A1: a split's pixel shatter in the atom's colour and white, with "SPLIT!" (the smallest atom,
 * which vanishes, gets the shatter alone). Blitted from cached squares, so the game's own particle
 * rects (and their shared cap) are unchanged; skipped while the arena is crowded, as the particles are.
 */
function splitPop(ctx: CanvasRenderingContext2D, state: BurstState, key: object): void {
  const fresh = rise(key, "burst-pop", state.tick, state.popTick) > 0 && state.tick - state.popTick < 4;
  if (fresh && state.balls.length <= BURST_FX_ENEMY_THRESHOLD && state.shots.length <= BURST_FX_SHOT_THRESHOLD) {
    const x = state.popX / FP, y = state.popY / FP;
    const colour = retroNeon(BURST_COLOURS[state.popSize] ?? RETRO_WHITE);
    const r = BURST_RADIUS[state.popSize] ?? 8;
    addShatter(key, x, y, [colour, RETRO_WHITE, colour], state.popSize < 3 ? 12 : 8, r + 10);
    if (state.popSize < 3) addPop(key, x, y - r - 8, "SPLIT!", colour, 9, 3);
  }
  drawPops(ctx, key, BURST_WORLD_W);
}

/** Polish A1: a soft green light round a beam (one stretched glow blit; skipped under reduced effects). */
const beamHalos = new Map<string, ArtCanvas | null>();
function beamHalo(ctx: CanvasRenderingContext2D, x: number, top: number, height: number): void {
  if (arcadeReducedEffects()) return;
  let layer = beamHalos.get("beam");
  if (layer === undefined) {
    const canvas = artCanvas(32, 2);
    const c = canvas && (artContext(canvas) as CanvasRenderingContext2D | null);
    if (canvas && c) {
      c.fillStyle = linear(c, 0, 0, 32, 0, [[0, `${BEAM}00`], [0.5, `${BEAM}88`], [1, `${BEAM}00`]]);
      c.fillRect(0, 0, 32, 2);
    }
    layer = canvas && c ? canvas : null;
    beamHalos.set("beam", layer);
  }
  if (!layer) return;
  ctx.globalAlpha = 0.45;
  ctx.drawImage(layer as CanvasImageSource, x - 8, top, 16, height);
  ctx.globalAlpha = 1;
}

/**
 * Polish A1: Fission's sky, painted once per arena height (backdrop): near-black with a deep green
 * glow rising from the ground and a fainter one overhead, and a pixel starfield; it settles to the
 * ground's dark teal at the floor (where the screen fill takes over) and to black at the sides.
 */
function paintSpace(c: CanvasRenderingContext2D, floorY: number): void {
  const W = BURST_WORLD_W;
  c.fillStyle = linear(c, 0, 0, 0, floorY, [[0, "#020604"], [0.6, "#03100A"], [1, "#072019"]]);
  c.fillRect(0, 0, W, floorY);
  blob(c, W * 0.5, floorY * 1.02, W * 0.85, "#0F7A45", 0.5, 0.75);
  blob(c, W * 0.2, floorY * 0.3, W * 0.5, "#0B5A3A", 0.26, 1.3);
  blob(c, W * 0.82, floorY * 0.45, W * 0.42, "#126B5A", 0.2, 1.3);
  pixelStars(c, 0, 0, W, floorY * 0.85, 120, 1717, ["#FFFFFF", "#B8FFD0", "#9FF5EA", "#E8FFE0"], 0.8);
  // The last few px settle to black under the floor's soft edge, as before, so the floor stays a soft
  // edge (not a line) against the ground below.
  c.fillStyle = linear(c, 0, floorY - 12, 0, floorY - 2, [[0, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,1)"]]);
  c.fillRect(0, floorY - 12, W, 12);
  for (const [x, x0, x1] of [[0, 0, 8], [W - 8, W, W - 8]] as const) {
    c.fillStyle = linear(c, x0, 0, x1, 0, [[0, "rgba(0,0,0,0.75)"], [1, "rgba(0,0,0,0)"]]);
    c.fillRect(x, 0, 8, floorY);
  }
}

export const burstArtGame: ArcadeGame<BurstState, ArcadeInputEvent | null> = { ...burstGame, draw };
const burstArtGameV2: ArcadeGame<BurstState, ArcadeInputEvent | null> = { ...burstGameFor(BURST_REV), draw };
const burstArtGameBand: ArcadeGame<BurstState, ArcadeInputEvent | null> = { ...burstGameFor(BURST_REV_BAND), draw };
const burstArtGameTall: ArcadeGame<BurstState, ArcadeInputEvent | null> = { ...burstGameFor(BURST_REV_TALL), draw };
const burstArtGameTarget: ArcadeGame<BurstState, ArcadeInputEvent | null> = { ...burstGameFor(BURST_REV_TARGET), draw };
const burstArtGameStrict: ArcadeGame<BurstState, ArcadeInputEvent | null> = { ...burstGameFor(BURST_REV_STRICT), draw };
/** The art game for a stored burstRev; cached so the stage sees one object per revision. */
const burstArtGameV8: ArcadeGame<BurstState, ArcadeInputEvent | null> = { ...burstGameFor(BURST_REV_CLEAN), draw };
export function burstArtGameFor(rev?: number | null): ArcadeGame<BurstState, ArcadeInputEvent | null> {
  if (rev === BURST_REV_CLEAN) return burstArtGameV8;
  if (rev === BURST_REV_STRICT) return burstArtGameStrict;
  if (rev === BURST_REV_TARGET) return burstArtGameTarget;
  if (rev === BURST_REV_TALL) return burstArtGameTall;
  if (rev === BURST_REV_BAND) return burstArtGameBand;
  return rev === BURST_REV ? burstArtGameV2 : burstArtGame;
}

/* ================= burstRev 8 features (display only) ================= */

const GOLD_ATOM = "#FFD84A";
const GOLDEN_BODY = "#FFF6D5";
const CLEAN = "#7CFFB0";
const DOUBLE_ICON = ["XXXXXXXX", "X.X..X.X", "X.X..X.X", "X.X..X.X", "X.X..X.X", "X.X..X.X", "X.X..X.X", "XXXXXXXX"];
type V8Memo = { tick: number; golds: number; cleared: number; doubles: number; freezes: number; missed: number };
const v8Memos = new WeakMap<object, V8Memo>();

/**
 * burstRev 8's golden atom (a gold atom sprite in its 18 px hit disc with a soft glow and a countdown
 * ring emptying over its four seconds, reddening in the last) and pops for a golden atom ("GOLD +6"), a
 * fast wave ("FAST +n"), a clean wave ("CLEAN +5"), a missed shot ("MISS") and the power-ups. Under
 * reduced motion nothing turns; under reduced effects the glows are skipped (glow() does that itself).
 */
function drawV8(ctx: CanvasRenderingContext2D, state: BurstState, key: object): void {
  const still = reducedMotion();
  const n = burstGoldenNow(state, state.tick + 1);
  if (n >= 0) {
    const g = state.goldens![n]!;
    const x = g.x, y = g.y;
    const left = 1 - Math.max(0, state.tick - g.tick) / BURST_V8_GOLDEN_LIFE;
    glow(ctx, GOLD_ATOM, x, y, BURST_GOLD_R + 10, BURST_GOLD_R + 10, 0.75);
    const stamp = cachedArt("atom:golden", BURST_GOLD_R * 2, BURST_GOLD_R * 2, GOLDEN_BODY, 0, (c) => paintAtom(c, BURST_GOLD_R, GOLDEN_BODY, 3));
    if (stamp) blit(ctx, stamp, x - BURST_GOLD_R, y - BURST_GOLD_R);
    const turn = still ? 0 : state.tick * 0.12;
    ctx.fillStyle = RETRO_WHITE;
    for (let i = 0; i < 4; i++) {
      const a = turn + (i * Math.PI) / 2;
      ctx.fillRect(Math.round(x + Math.cos(a) * BURST_GOLD_R) - 1, Math.round(y + Math.sin(a) * BURST_GOLD_R) - 1, 3, 3);
    }
    // The countdown: 2 px pixels round it, the lit share emptying clockwise.
    const dots = 28;
    const lit = Math.ceil(dots * left);
    ctx.fillStyle = left < 0.25 ? "#FF6B4A" : GOLD_ATOM;
    for (let i = 0; i < lit; i++) {
      const a = -Math.PI / 2 + (i / dots) * Math.PI * 2;
      ctx.fillRect(Math.round(x + Math.cos(a) * (BURST_GOLD_R + 5)) - 1, Math.round(y + Math.sin(a) * (BURST_GOLD_R + 5)) - 1, 2, 2);
    }
    retroText(ctx, `+${BURST_V8_GOLDEN_PTS}`, x, y - BURST_GOLD_R - 16, 8, GOLD_ATOM, "center");
  }
  let golds = 0;
  for (let bits = state.goldHit ?? 0; bits; bits &= bits - 1) golds++;
  const now = { tick: state.tick, golds, cleared: state.cleared, doubles: state.doubles ?? 0, freezes: state.freezes ?? 0, missed: state.missed ?? 0 };
  let memo = v8Memos.get(key);
  if (!memo || state.tick < memo.tick) memo = now;
  const px = state.popX / FP, py = state.popY / FP;
  const floor = burstFloorY(state);
  if (now.golds > memo.golds) addPop(key, px, py - 12, `GOLD +${BURST_V8_GOLDEN_PTS}`, GOLD_ATOM, 10, 4);
  if (now.cleared > memo.cleared) {
    if ((state.lastClean ?? 0) > 0) addPop(key, BURST_WORLD_W / 2, floor / 2 - 16, `CLEAN +${BURST_V8_CLEAN_PTS}`, CLEAN, 10, 4);
    if ((state.lastClear ?? 0) > 0) addPop(key, BURST_WORLD_W / 2, floor / 2, `FAST +${state.lastClear}`, SHIP, 10, 4);
  }
  if (now.missed > memo.missed) addPop(key, state.x / FP, floor - 60, "MISS", "#FF5A6E", 8, 3);
  if (now.doubles > memo.doubles) addPop(key, state.x / FP, floor - 50, "DOUBLE!", BEAM, 10, 4);
  if (now.freezes > memo.freezes) addPop(key, state.x / FP, floor - 50, "FREEZE!", ICE, 10, 4);
  v8Memos.set(key, now);
}
