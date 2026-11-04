/**
 * Arcade screen fill-ins (17 Oct 2026, display only).
 *
 * Every active arcade game's play screen fills the space around its world (the strip below
 * it down to the screen's very bottom, behind the 16 px strip and the home bar; the sides
 * where a game asks for them; the gap above a centred world) with a light, soft backdrop
 * in the game's own look, darker than the play area so it reads as background, never as
 * part of the game. Each starts from the colour of the world's own edge, so the world and
 * its surroundings read as one scene with no seam (arcade-fill-check proves it).
 *
 * Painters run through ArcadeArenaSlot's scene canvas (arenaScene.renderer.ts): world units,
 * the world at (0, 0)–(worldW, worldH), the view the whole play screen. A few games
 * (ARENA_FILL_MOVING) add a slow ambient layer (ArenaAmbient): Pinball's and Rally's retro
 * lights, which only read the game's existing good moments (arenaLight, called from the
 * sound observers in gameSounds.ts), Tempo's notes, Meteor's stars, Jaywalk's walkers,
 * Roofbound's lava and Fission's reactions. With reduced motion or reduced effects those hold
 * still (lights dim, colours fixed, nothing drifting, no walkers).
 *
 * Nothing here is imported by a sim, grader or server code, and nothing here reads or writes
 * a sim: scores, timing, inputs and replays are untouched.
 */
import { SWING_REV_SLIDE } from "./swing";
import { artHash, reducedMotion } from "./art.renderer";
import { SCENE_TUCK, type ArenaAmbient, type ArenaSceneView } from "./arenaScene.renderer";
import { METEOR_BORDER_COLOURS } from "./snake.renderer";
import { MINES_ART, paintMinesHexes } from "./minesweeper.renderer";
import { paintMahjongWood } from "./mahjong.renderer";

/** Games whose fill moves (slowly); everything else is painted once per size. */
export const ARENA_FILL_MOVING = ["pinball", "rally", "beat", "snake", "cross", "flip", "burst"] as const;
/** Games whose fill also runs down their sides when the world is narrower than the screen. */
export const ARENA_FILL_SIDES = ["wavefront", "snake", "balltrack", "beat", "matchup", "clayshoot", "minesweeper", "mahjong", "freecell", "tripeaks", "pokersquares", "fivehands", "blockfall", "alleyroll", "ricochet", "pyramid", "golfsol", "muggins"] as const;
/** Games centred on the play screen (item 23), their world's size unchanged. */
export const ARENA_FILL_CENTRED = ["pinball", "snake", "snip", "matchup", "whack"] as const;

type Rect = { x: number; y: number; w: number; h: number };

/** The band from the world's bottom edge to the screen's bottom, full width, tucked SCENE_TUCK under the world (null when none). */
export function fillBelow(view: ArenaSceneView): Rect | null {
  const h = view.bottom - view.worldH;
  return h > 0.01 ? { x: view.left, y: view.worldH - SCENE_TUCK, w: view.right - view.left, h: h + SCENE_TUCK } : null;
}

/** The gap between the arena box's top and a centred world, tucked under it (null when none). */
export function fillAbove(view: ArenaSceneView): Rect | null {
  const top = view.boxTop ?? 0;
  return -top > 0.01 ? { x: view.left, y: top, w: view.right - view.left, h: -top + SCENE_TUCK } : null;
}

/** The strips beside the world, world height only, tucked under it. */
export function fillSides(view: ArenaSceneView): Rect[] {
  const out: Rect[] = [];
  if (view.left < -0.01) out.push({ x: view.left, y: 0, w: -view.left + SCENE_TUCK, h: view.worldH });
  if (view.right > view.worldW + 0.01) out.push({ x: view.worldW - SCENE_TUCK, y: 0, w: view.right - view.worldW + SCENE_TUCK, h: view.worldH });
  return out;
}

/** A vertical gradient over a rectangle; stops at 0…1 of [y0, y1]. */
export function fillGradient(ctx: CanvasRenderingContext2D, rect: Rect, y0: number, y1: number, stops: ReadonlyArray<readonly [number, string]>): void {
  const g = ctx.createLinearGradient(0, y0, 0, y1 === y0 ? y0 + 1 : y1);
  for (const [at, colour] of stops) g.addColorStop(Math.min(1, Math.max(0, at)), colour);
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

/** A horizontal gradient over a rectangle; stops at 0…1 of [x0, x1]. */
function fillAcross(ctx: CanvasRenderingContext2D, rect: Rect, x0: number, x1: number, stops: ReadonlyArray<readonly [number, string]>): void {
  const g = ctx.createLinearGradient(x0, 0, x1 === x0 ? x0 + 1 : x1, 0);
  for (const [at, colour] of stops) g.addColorStop(Math.min(1, Math.max(0, at)), colour);
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

/** Seeded faint stars over a rectangle (`area` square world units each), the same on every phone. */
function stars(ctx: CanvasRenderingContext2D, rect: Rect, seed: number, colours: readonly string[], area: number, alpha: number, skipTop = 3): void {
  const n = Math.min(500, Math.round((rect.w * rect.h) / area));
  for (let i = 0; i < n; i++) {
    const h = artHash(i, seed);
    const x = rect.x + ((h % 10007) / 10007) * rect.w;
    const y = rect.y + skipTop + (((h >>> 14) % 10009) / 10009) * Math.max(0, rect.h - skipTop);
    const big = (h >>> 27) % 7 === 0;
    ctx.globalAlpha = alpha * (0.45 + ((h >>> 5) % 5) * 0.14);
    ctx.fillStyle = colours[i % colours.length]!;
    ctx.fillRect(Math.round(x), Math.round(y), big ? 2 : 1, big ? 2 : 1);
  }
  ctx.globalAlpha = 1;
}

/** A soft dark fade over the band's last stretch, so every fill settles darker towards the screen's bottom. */
function settle(ctx: CanvasRenderingContext2D, rect: Rect, colour: string, from = 0.35, alpha = 0.55): void {
  const g = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  g.addColorStop(0, `${colour}00`);
  g.addColorStop(Math.min(0.95, from), `${colour}00`);
  g.addColorStop(1, colour + Math.round(alpha * 255).toString(16).padStart(2, "0"));
  ctx.fillStyle = g;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

/** Every part of the screen a painter may fill: below, the sides (when asked) and above a centred world. */
function around(view: ArenaSceneView, sides: boolean): Rect[] {
  return [fillBelow(view), fillAbove(view), ...(sides ? fillSides(view) : [])].filter((r): r is Rect => r !== null);
}

/* ================= Retro lights (Pinball, Rally) ================= */

interface LightPulse {
  at: number;
  lamps: number[];
  chase: boolean;
}
const LIGHT_COUNT = 5;
const pulses = new Map<string, LightPulse[]>();
let turn = 0;

/**
 * A good moment for the light row (Pinball, Rally): `size` 1–3 lights that many lamps briefly,
 * 5 runs a quick chase along all five. Called from the games' sound observers (gameSounds.ts),
 * which already watch the sim's counters each frame; nothing here touches the sim.
 */
export function arenaLight(game: "pinball" | "rally", size: 1 | 2 | 3 | 5): void {
  if (typeof performance === "undefined" || reducedMotion()) return;
  const at = performance.now();
  turn = (turn + 2) % LIGHT_COUNT;
  const lamps = size === 5 ? [0, 1, 2, 3, 4] : size === 3 ? [1, 2, 3] : size === 2 ? [turn, (turn + 2) % LIGHT_COUNT] : [turn];
  const list = (pulses.get(game) ?? []).filter((p) => at - p.at < 1500);
  list.push({ at, lamps, chase: size === 5 });
  pulses.set(game, list.slice(-12));
}

/** How lit a lamp is at time t: a 60 ms rise, then a fade over 420 ms. */
function lampLevel(game: string, lamp: number, t: number): number {
  let level = 0;
  for (const p of pulses.get(game) ?? []) {
    const i = p.lamps.indexOf(lamp);
    if (i < 0) continue;
    const d = t - p.at - (p.chase ? i * 70 : 0);
    if (d < 0 || d > 480) continue;
    const v = d < 60 ? d / 60 : (1 - (d - 60) / 420) ** 2;
    level = Math.max(level, v);
  }
  return level;
}

/** The light row's lamp centres under the world (world units). */
function lampSpots(view: ArenaSceneView): Array<{ x: number; y: number }> {
  const band = view.bottom - view.worldH;
  const usable = band - 50 / view.scale;
  const y = view.worldH + Math.max(Math.min(band / 2, 9), Math.min(usable > 18 ? usable / 2 + 3 : band / 2, 40));
  return Array.from({ length: LIGHT_COUNT }, (_, i) => ({ x: (view.worldW * (i + 1)) / (LIGHT_COUNT + 1), y }));
}

/** The lamps at rest (static scene): a dark rim and a dim bulb in each lamp's colour. */
function lampsAtRest(ctx: CanvasRenderingContext2D, view: ArenaSceneView, colours: readonly string[], rim: string): void {
  if (!fillBelow(view)) return;
  for (const [i, p] of lampSpots(view).entries()) {
    ctx.fillStyle = rim;
    ctx.fillRect(Math.round(p.x) - 6, Math.round(p.y) - 6, 12, 12);
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = colours[i % colours.length]!;
    ctx.fillRect(Math.round(p.x) - 4, Math.round(p.y) - 4, 8, 8);
    ctx.globalAlpha = 0.16;
    ctx.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 3, 3, 2);
    ctx.globalAlpha = 1;
  }
}

/** The lamps lit by recent good moments (ambient layer): a pixel bulb and a soft glow round it. */
function lightRow(game: string, colours: readonly string[]): ArenaAmbient {
  return {
    region: "below",
    draw(ctx, view, t, still) {
      if (still) return;
      ctx.globalCompositeOperation = "lighter";
      for (const [i, p] of lampSpots(view).entries()) {
        const level = lampLevel(game, i, t);
        if (level <= 0.02) continue;
        const colour = colours[i % colours.length]!;
        const glow = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, 22);
        glow.addColorStop(0, colour);
        glow.addColorStop(1, `${colour}00`);
        ctx.globalAlpha = 0.55 * level;
        ctx.fillStyle = glow;
        ctx.fillRect(p.x - 22, p.y - 22, 44, 44);
        ctx.globalAlpha = level;
        ctx.fillStyle = colour;
        ctx.fillRect(Math.round(p.x) - 4, Math.round(p.y) - 4, 8, 8);
        ctx.fillStyle = "#FFFFFF";
        ctx.globalAlpha = 0.8 * level;
        ctx.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 3, 3, 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    },
  };
}

/* ================= Per game ================= */

/** 1. Hover: faint, still stars on its black night sky. */
export function hoverFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  for (const r of around(view, false)) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    stars(ctx, r, 101, ["#C9D6FF", "#FFFFFF", "#9FB4FF"], 520, 0.38);
  }
}

/** 6. Breaker: the black screen runs on into a dark retro floor: a faint pixel horizon grid. */
export function breakerFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const r = fillBelow(view);
  if (!r) return;
  ctx.fillStyle = "#000000";
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const W = view.worldW;
  ctx.fillStyle = "#3D7BFF";
  for (let k = 1; k < 12; k++) {
    const y = r.y + 6 + k * k * 1.6;
    if (y > r.y + r.h) break;
    ctx.globalAlpha = Math.min(0.16, 0.04 + k * 0.012);
    ctx.fillRect(r.x, Math.round(y), r.w, 1);
  }
  for (let k = -8; k <= 8; k++) {
    ctx.globalAlpha = 0.07;
    ctx.beginPath();
    ctx.moveTo(W / 2 + k * 14, r.y + 6);
    ctx.lineTo(W / 2 + k * 60, r.y + r.h);
    ctx.lineTo(W / 2 + k * 60 + 1, r.y + r.h);
    ctx.lineTo(W / 2 + k * 14 + 1, r.y + 6);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  fillGradient(ctx, r, r.y, r.y + 10, [[0, "#000000"], [1, "#00000000"]]);
}

/** 7. Pinball: the dark table runs on under (and over) the world, with five retro lamps in its tones. */
const PIN_LAMPS = ["#FF4FD8", "#FFD84A", "#3DFFE0", "#FFD84A", "#FF4FD8"] as const;
export function pinballFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const below = fillBelow(view);
  const above = fillAbove(view);
  if (above) fillGradient(ctx, above, above.y, above.y + above.h, [[0, "#070709"], [1, "#000000"]]);
  if (!below) return;
  fillGradient(ctx, below, below.y, below.y + below.h, [[0, "#000000"], [0.5, "#07040C"], [1, "#0A0510"]]);
  const glow = ctx.createRadialGradient(view.worldW / 2, below.y + below.h, 4, view.worldW / 2, below.y + below.h, view.worldW * 0.7);
  glow.addColorStop(0, "rgba(255,79,216,0.07)");
  glow.addColorStop(1, "rgba(255,79,216,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(below.x, below.y, below.w, below.h);
  lampsAtRest(ctx, view, PIN_LAMPS, "#120A18");
}
export const pinballAmbient = lightRow("pinball", PIN_LAMPS);

/**
 * 7b. Pinball's taller table (pinRev 4 and 5): its rich purple bottom edge runs on into a darker purple, with the
 * lamps in the table's own pink, gold and cyan (27 Oct 2026, Joe's phone notes, second pass).
 */
export function pinball4Fill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const below = fillBelow(view);
  const above = fillAbove(view);
  if (above) fillGradient(ctx, above, above.y, above.y + above.h, [[0, "#070709"], [1, "#000000"]]);
  if (!below) return;
  fillGradient(ctx, below, below.y, below.y + below.h, [[0, "#0E0422"], [0.5, "#0A0318"], [1, "#0D0420"]]);
  const glow = ctx.createRadialGradient(view.worldW / 2, below.y + below.h, 4, view.worldW / 2, below.y + below.h, view.worldW * 0.7);
  glow.addColorStop(0, "rgba(255,79,216,0.08)");
  glow.addColorStop(1, "rgba(255,79,216,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(below.x, below.y, below.w, below.h);
  lampsAtRest(ctx, view, PIN_LAMPS, "#160A26");
}
export const pinball4Ambient = lightRow("pinball", PIN_LAMPS);

/** 8. Rally: the court's dark floor runs on, with five retro lamps in Rally's tones. */
const RALLY_LAMPS = ["#3DFFE0", "#FFD84A", "#FF6FD8", "#B49CFF", "#3DFFE0"] as const;
export function rallyFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const r = fillBelow(view);
  if (!r) return;
  const tile = 26;
  for (let y = r.y; y < r.y + r.h; y += tile)
    for (let x = Math.floor(r.x / tile) * tile; x < r.x + r.w; x += tile) {
      ctx.fillStyle = (Math.round(x / tile) + Math.round((y - r.y) / tile)) % 2 === 0 ? "#020507" : "#04080B";
      ctx.fillRect(x, y, tile, tile);
    }
  settle(ctx, r, "#010203", 0.2, 0.7);
  lampsAtRest(ctx, view, RALLY_LAMPS, "#06141A");
}
export const rallyAmbient = lightRow("rally", RALLY_LAMPS);

/** 11. Tempo: the stage's dark floor runs on, the four lanes' tints and rails fading out into it, with a few small notes. */
const BEAT_NEON = ["#3DFFE0", "#FFD84A", "#B49CFF", "#5CD0FF"] as const;
const NOTE_GLYPHS = ["♪", "♫", "♩", "♬"] as const;
export function beatFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  for (const r of around(view, true)) {
    ctx.fillStyle = "#0B0A10";
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  const below = fillBelow(view);
  if (!below) return;
  const lane = view.worldW / 4;
  const fade = Math.min(below.h, 44);
  for (let i = 0; i < 4; i++) {
    const x = i * lane;
    const c = BEAT_NEON[i]!;
    fillGradient(ctx, { x, y: below.y, w: lane, h: below.h }, below.y, below.y + Math.max(fade, below.h * 0.8), [[0, `${c}10`], [1, `${c}03`]]);
    for (const [rx, rw, a] of [[x + 2, 2, "A0"], [x + lane - 4, 2, "A0"], [x + 6, 1, "30"], [x + lane - 7, 1, "30"]] as const)
      fillGradient(ctx, { x: Math.round(rx), y: below.y, w: rw, h: fade }, below.y, below.y + fade, [[0, `${c}${a}`], [1, `${c}00`]]);
  }
  // The stage's scanlines, fading out with the rails.
  for (let y = below.y; y < below.y + fade; y += 3) {
    ctx.fillStyle = `rgba(0,0,0,${(0.28 * (1 - (y - below.y) / fade)).toFixed(3)})`;
    ctx.fillRect(below.x, Math.round(y), below.w, 1);
  }
}
const NOTE_COLOURS = ["#2ED3B7", "#F5B82E", "#8B7BF7", "#5AA9FF", "#FF6FD8"] as const;
export const beatAmbient: ArenaAmbient = {
  region: "below",
  draw(ctx, view, t, still) {
    const r = fillBelow(view);
    if (!r || r.h < 12) return;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const n = Math.max(3, Math.min(7, Math.round(r.w / 70)));
    for (let i = 0; i < n; i++) {
      const h = artHash(i, 311);
      const drift = still ? 0 : t / 1000;
      const x = r.x + (((h % 1000) / 1000) * r.w + drift * (4 + (h % 5))) % r.w;
      const y = r.y + 8 + ((((h >>> 10) % 1000) / 1000) * Math.max(4, r.h - 24)) + (still ? 0 : Math.sin(drift * 0.8 + i) * 2.5);
      // Colours swap slowly round the palette (every note offset), a 12 s cycle.
      const k = still ? i : i + t / 12000 * NOTE_COLOURS.length;
      const c0 = NOTE_COLOURS[Math.floor(k) % NOTE_COLOURS.length]!;
      ctx.globalAlpha = 0.26;
      ctx.fillStyle = c0;
      ctx.font = `${9 + (h >>> 20) % 4}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(NOTE_GLYPHS[(h >>> 16) % NOTE_GLYPHS.length]!, x, y);
    }
    ctx.globalAlpha = 1;
  },
};

/** 12. Meteor: a faint starfield round the board, its stars slowly stepping through the border's colours. */
export function snakeFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  for (const r of around(view, true)) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  const above = fillAbove(view);
  if (above) fillGradient(ctx, above, above.y, above.y + Math.min(above.h, 14), [[0, "#070709"], [1, "#00000000"]]);
}
export const snakeAmbient: ArenaAmbient = {
  region: "all",
  draw(ctx, view, t) {
    for (const [j, r] of around(view, true).entries()) {
      const n = Math.min(120, Math.round((r.w * r.h) / 700));
      for (let i = 0; i < n; i++) {
        const h = artHash(i, 733 + j);
        const x = r.x + ((h % 10007) / 10007) * r.w;
        const y = r.y + 3 + (((h >>> 14) % 10009) / 10009) * Math.max(0, r.h - 6);
        const k = (h >>> 3) % METEOR_BORDER_COLOURS.length;
        // Each star steps to the next border colour every 4 s (offset per star), fading across 1 s.
        const phase = t / 4000 + ((h >>> 9) % 100) / 100;
        const step = Math.floor(phase);
        const mix = Math.min(1, (phase - step) * 4);
        const a = METEOR_BORDER_COLOURS[(k + step) % 4]!;
        const b = METEOR_BORDER_COLOURS[(k + step + 1) % 4]!;
        const alpha = 0.18 + ((h >>> 20) % 4) * 0.06;
        const size = (h >>> 26) % 6 === 0 ? 2 : 1;
        ctx.fillStyle = a;
        ctx.globalAlpha = alpha * (t === 0 ? 1 : 1 - mix);
        ctx.fillRect(Math.round(x), Math.round(y), size, size);
        if (t !== 0 && mix > 0) {
          ctx.fillStyle = b;
          ctx.globalAlpha = alpha * mix;
          ctx.fillRect(Math.round(x), Math.round(y), size, size);
        }
      }
    }
    ctx.globalAlpha = 1;
  },
};

/** 2. High Rise: a dark road under the tower's base block, softly lit by street lamps. */
export function skylineFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const r = fillBelow(view);
  if (!r) return;
  // The pavement the base stands on (the night's navy), then the road, settling darker.
  fillGradient(ctx, r, r.y, r.y + r.h, [[0, "#3E4B5E"], [Math.min(0.4, 7 / r.h), "#2A3546"], [Math.min(0.6, 12 / r.h), "#161E2B"], [Math.min(0.8, 18 / r.h), "#121924"], [1, "#0C1018"]]);
  const kerb = r.y + Math.min(12, r.h * 0.3);
  ctx.fillStyle = "rgba(160,180,205,0.10)";
  ctx.fillRect(r.x, Math.round(kerb), r.w, 1);
  // A faint dashed centre line and pools of lamplight.
  const mid = kerb + Math.max(8, (r.y + r.h - kerb) * 0.45);
  ctx.fillStyle = "rgba(230,200,120,0.10)";
  for (let x = Math.floor(r.x / 34) * 34; x < r.x + r.w; x += 34) ctx.fillRect(x + 6, Math.round(mid), 16, 2);
  for (let k = 0; k < 3; k++) {
    const x = view.worldW * (0.17 + k * 0.33);
    const pool = ctx.createRadialGradient(x, kerb + 2, 2, x, kerb + 2, 70);
    pool.addColorStop(0, "rgba(255,214,140,0.10)");
    pool.addColorStop(1, "rgba(255,214,140,0)");
    ctx.fillStyle = pool;
    ctx.fillRect(x - 70, r.y, 140, r.h);
  }
}

/** 9. Slice: the kitchen worktop the board's foot rests on runs on, a faded marble in its sage-grey. */
export function sliceFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const r = fillBelow(view);
  if (!r) return;
  // Polish A3: a polished teal marble worktop, starting from the board's counter edge colour.
  fillGradient(ctx, r, r.y, r.y + r.h, [[0, "#5E7973"], [Math.min(0.6, 24 / r.h), "#587C75"], [Math.min(0.9, 90 / r.h), "#4E716B"], [1, "#3A524D"]]);
  // Cloudy patches in the stone.
  for (let k = 0; k < 6; k++) {
    const h = artHash(k, 57);
    const cx = r.x + ((h % 1000) / 1000) * r.w;
    const cy = r.y + 20 + (((h >>> 10) % 1000) / 1000) * Math.max(10, r.h - 30);
    const rad = 30 + ((h >>> 20) % 50);
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, rad);
    g.addColorStop(0, k % 2 ? "rgba(220,245,238,0.08)" : "rgba(20,40,36,0.12)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  // Marble veins: a soft wide vein with a fine bright core, and small branches.
  ctx.lineCap = "round";
  for (let k = 0; k < 9; k++) {
    const h = artHash(k, 51);
    const x0 = r.x + ((h % 1000) / 1000) * r.w;
    const x1 = x0 + 50 + ((h >>> 12) % 40) - (k % 3 === 0 ? 120 : 0);
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(x0, r.y + 6);
      ctx.bezierCurveTo(x0 + 30, r.y + r.h * 0.3, x0 - 20, r.y + r.h * 0.6, x1, r.y + r.h);
    };
    ctx.strokeStyle = k % 2 ? "rgba(230,250,244,0.07)" : "rgba(30,48,44,0.14)";
    ctx.lineWidth = 4;
    path();
    ctx.stroke();
    ctx.strokeStyle = k % 2 ? "rgba(240,255,250,0.2)" : "rgba(28,44,40,0.24)";
    ctx.lineWidth = 0.8;
    path();
    ctx.stroke();
    const bx = x0 + 10 + ((h >>> 5) % 20);
    const by = r.y + r.h * (0.25 + ((h >>> 8) % 40) / 100);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + 18, by + 10, bx + 30 + ((h >>> 16) % 20), by + 28);
    ctx.stroke();
  }
  // Polished edge: a soft sheen a little below the board, from the kitchen lamp.
  const sheenY = r.y + 12;
  const sheen = ctx.createLinearGradient(0, sheenY, 0, sheenY + 16);
  sheen.addColorStop(0, "rgba(220,255,246,0)");
  sheen.addColorStop(0.45, "rgba(220,255,246,0.10)");
  sheen.addColorStop(1, "rgba(220,255,246,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(r.x, sheenY, r.w, 16);
  const lamp = ctx.createRadialGradient(view.worldW / 2, r.y, 10, view.worldW / 2, r.y, r.w * 0.6);
  lamp.addColorStop(0, "rgba(255,226,170,0.08)");
  lamp.addColorStop(1, "rgba(255,226,170,0)");
  ctx.fillStyle = lamp;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  settle(ctx, r, "#26302E", 0.45, 0.4);
}

/** 10. Coral Pop: the world's sandy floor (Polish A3, from its foot colour) runs on with ripples, pebbles and shells. */
export function bubbleFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const r = fillBelow(view);
  if (!r) return;
  fillGradient(ctx, r, r.y, r.y + r.h, [[0, "#6E5A3E"], [Math.min(0.6, 30 / r.h), "#62513A"], [1, "#3E3426"]]);
  // Soft ripples in the sand.
  ctx.strokeStyle = "rgba(60,44,26,0.35)";
  ctx.lineWidth = 1;
  for (let k = 0; k < 10; k++) {
    const h = artHash(k, 67);
    const y = r.y + 8 + ((h % 1000) / 1000) * Math.max(0, r.h - 12);
    const x0 = r.x + (((h >>> 10) % 1000) / 1000) * r.w;
    const len = 40 + ((h >>> 20) % 50);
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.quadraticCurveTo(x0 + len / 2, y - 2.5, x0 + len, y);
    ctx.stroke();
  }
  const grains = { x: r.x, y: r.y + 3, w: r.w, h: Math.max(0, r.h - 3) };
  stars(ctx, grains, 61, ["#C9B488", "#7E6E50", "#E0D0A6"], 40, 0.4, 0);
  // A few pebbles and shells.
  for (let k = 0; k < 6; k++) {
    const h = artHash(k, 71);
    const x = r.x + ((h % 1000) / 1000) * r.w;
    const y = r.y + 10 + (((h >>> 10) % 1000) / 1000) * Math.max(0, r.h - 20);
    const s = 2.2 + ((h >>> 20) % 3);
    ctx.fillStyle = k % 3 ? "#4A4030" : "#E9C6B0";
    ctx.beginPath();
    ctx.ellipse(x, y, s * 1.5, s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(240,230,210,0.25)";
    ctx.beginPath();
    ctx.ellipse(x - s * 0.4, y - s * 0.4, s * 0.6, s * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  settle(ctx, r, "#141410", 0.4, 0.5);
}

/** 14. Wavefront: its night sky (stars and a faint nebula) runs on below and beside the world. */
export function wavefrontFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  for (const [i, r] of around(view, true).entries()) {
    // A deep navy (wavRev 10's taller world leaves sides at 414 px): never the screen edge's #070709.
    ctx.fillStyle = "#0B0B18";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    stars(ctx, r, 401 + i, ["#FFFFFF", "#C9D6FF", "#8FA8FF"], 380, 0.42);
  }
  const r = fillBelow(view);
  if (!r) return;
  const neb = ctx.createRadialGradient(view.worldW * 0.7, r.y + r.h, 6, view.worldW * 0.7, r.y + r.h, 160);
  neb.addColorStop(0, "rgba(70,60,140,0.10)");
  neb.addColorStop(1, "rgba(70,60,140,0)");
  ctx.fillStyle = neb;
  ctx.fillRect(r.x, r.y, r.w, r.h);
}

/** 18. Orbit: black space with light stars under the world (no coloured nebula since 27 Oct 2026). */
export function orbitFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const r = fillBelow(view);
  if (!r) return;
  // A deep navy (the screen fill must read lighter than the screen edge's black), with no coloured nebula.
  fillGradient(ctx, r, r.y, r.y + r.h, [[0, "#0E0E24"], [0.5, "#0C0C1F"], [1, "#0B0B1C"]]);
  stars(ctx, r, 181, ["#FFFFFF", "#D9E2FF", "#BFD0FF"], 650, 0.42);
}

/** 19. Grappler: more lava under the cavern's lava, then dark rock. */
export function swingFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const r = fillBelow(view);
  if (!r) return;
  fillGradient(ctx, r, r.y, r.y + r.h, [[0, "#470B07"], [Math.min(0.6, 18 / r.h), "#2A0806"], [Math.min(0.9, 40 / r.h), "#170806"], [1, "#0C0605"]]);
  // Glowing cracks and embers in the cooling crust.
  ctx.lineWidth = 1;
  for (let k = 0; k < 9; k++) {
    const h = artHash(k, 191);
    const x = r.x + ((h % 1000) / 1000) * r.w;
    const y = r.y + 6 + (((h >>> 10) % 1000) / 1000) * Math.max(4, r.h - 12);
    ctx.strokeStyle = `rgba(255,${90 + ((h >>> 20) % 60)},40,${0.18 - (y - r.y) / (r.h * 8)})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 10 + (h % 14), y + ((h >>> 4) % 7) - 3);
    ctx.lineTo(x + 22 + (h % 18), y + ((h >>> 8) % 9) - 4);
    ctx.stroke();
  }
  stars(ctx, { ...r, h: Math.min(r.h, 40) }, 193, ["#FF8A3A", "#FFB054"], 220, 0.35, 2);
}

/**
 * 19b. Grappler on swingRev 17 (the jungle canopy, 3 Nov 2026): the river's deep water carried on under the world (from
 * its bottom colour), a few faint current streaks, settling to near-black.
 */
export function swingJungleFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const r = fillBelow(view);
  if (!r) return;
  fillGradient(ctx, r, r.y, r.y + r.h, [[0, "#0B3A4A"], [Math.min(0.6, 24 / r.h), "#082C38"], [Math.min(0.9, 60 / r.h), "#06202A"], [1, "#04141A"]]);
  ctx.lineWidth = 1;
  for (let k = 0; k < 7; k++) {
    const h = artHash(k, 211);
    const x = r.x + ((h % 1000) / 1000) * r.w;
    const y = r.y + 6 + (((h >>> 10) % 1000) / 1000) * Math.max(4, Math.min(r.h, 60) - 12);
    ctx.strokeStyle = "rgba(200,245,240,0.12)";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 12 + (h % 16), y);
    ctx.stroke();
  }
}

/** Grappler's fill for a stored revision: the jungle's river on swingRev 17, the cave's lava before. */
export function swingFillFor(rev?: number | null): (ctx: CanvasRenderingContext2D, view: ArenaSceneView) => void {
  return rev === SWING_REV_SLIDE ? swingJungleFill : swingFill;
}

/** 17. Fission: under the arena's floor, a dark teal ground (the floor's soft edge) that settles into the dark under the arrows. */
export function burstFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const r = fillBelow(view);
  if (!r) return;
  fillGradient(ctx, r, r.y, r.y + r.h, [[0, "#0B2722"], [Math.min(0.5, 14 / r.h), "#06150F"], [Math.min(0.8, 40 / r.h), "#031012"], [1, "#020306"]]);
}
/** Small faint reactions under the arrows: two specks drift together and burst softly (never the game's atoms). */
export const burstAmbient: ArenaAmbient = {
  region: "below",
  draw(ctx, view, t, still) {
    const r = fillBelow(view);
    if (!r || r.h < 16) return;
    const cycle = 5200;
    for (let i = 0; i < 4; i++) {
      const h = artHash(i, 171);
      const cx = r.x + r.w * ((i + 0.5) / 4) + (((h % 40) - 20));
      const cy = r.y + 10 + (((h >>> 8) % 100) / 100) * Math.max(2, r.h - 24);
      const p = still ? 0.3 : ((t + (h % cycle)) % cycle) / cycle;
      const colour = i % 2 ? "#3DFFE0" : "#B49CFF";
      if (p < 0.7) {
        // Drifting together.
        const gap = 14 * (1 - p / 0.7);
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = colour;
        ctx.fillRect(Math.round(cx - gap) - 1, Math.round(cy) - 1, 2, 2);
        ctx.fillRect(Math.round(cx + gap) - 1, Math.round(cy + gap * 0.3) - 1, 2, 2);
      } else {
        // A soft ring that fades out.
        const q = (p - 0.7) / 0.3;
        ctx.globalAlpha = 0.2 * (1 - q);
        ctx.strokeStyle = colour;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, 2 + q * 9, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  },
};

/** 20. Scrumper: the orchard grass runs on below, a deeper green, with leafy dark above a centred world. */
export function snipFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  // snipRev 11's taller view is a hair narrower than the screen: the trunks' dark bark (#72502D) runs on beside it.
  for (const r of fillSides(view)) {
    ctx.fillStyle = "#72502D";
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  const below = fillBelow(view);
  const above = fillAbove(view);
  if (above) fillGradient(ctx, above, above.y, above.y + above.h, [[0, "#0B1A0C"], [1, "#2E5A26"]]);
  if (!below) return;
  fillGradient(ctx, below, below.y, below.y + below.h, [[0, "#4E9C42"], [Math.min(0.5, 10 / below.h), "#438A39"], [Math.min(0.8, 30 / below.h), "#346F2D"], [1, "#24521F"]]);
  ctx.lineCap = "round";
  ctx.lineWidth = 1;
  const n = Math.round((below.w * below.h) / 90);
  for (let i = 0; i < n; i++) {
    const h = artHash(i, 211);
    const x = below.x + ((h % 10007) / 10007) * below.w;
    const y = below.y + 5 + (((h >>> 14) % 10009) / 10009) * Math.max(0, below.h - 5);
    ctx.strokeStyle = i % 3 ? "rgba(120,200,90,0.18)" : "rgba(20,60,20,0.25)";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (((h >>> 6) % 5) - 2) * 0.6, y - 3 - ((h >>> 26) % 3));
    ctx.stroke();
  }
}

/** 21. Tilt: the board's oak runs on to the screen's edges (no rim), settling a little darker. */
export function tiltFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView, worldW: number, worldH: number): void {
  const regions = around(view, true);
  for (const r of regions) {
    ctx.fillStyle = "#9A7347";
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  ctx.save();
  ctx.beginPath();
  for (const r of regions) ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  // Long grain, as the board's own.
  for (let i = 0; i < 90; i++) {
    const h = artHash(i, 211);
    const y = view.top + (((h >>> 6) % 10007) / 10007) * (view.bottom - view.top);
    ctx.strokeStyle = h % 3 ? "rgba(90,58,30,0.16)" : "rgba(255,226,180,0.10)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(view.left, y);
    ctx.bezierCurveTo(view.left + (view.right - view.left) * 0.3, y + ((h % 7) - 3), view.left + (view.right - view.left) * 0.7, y - ((h % 5) - 2), view.right, y + 1);
    ctx.stroke();
  }
  // Settling darker away from the board, the lamp's light falling off.
  const cx = worldW / 2, cy = worldH / 2;
  const fall = ctx.createRadialGradient(cx, cy, Math.max(worldW, worldH) * 0.55, cx, cy, Math.max(view.right - view.left, view.bottom - view.top) * 0.9);
  fall.addColorStop(0, "rgba(40,24,12,0)");
  fall.addColorStop(1, "rgba(40,24,12,0.45)");
  ctx.fillStyle = fall;
  ctx.fillRect(view.left, view.top, view.right - view.left, view.bottom - view.top);
  ctx.restore();
}

/** 22. Ball Tracker: the wooden board runs on across the sides and to the bottom. */
export function ballTrackFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const regions = around(view, true);
  if (!regions.length) return;
  ctx.save();
  ctx.beginPath();
  for (const r of regions) ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.fillStyle = "#A88050";
  ctx.fillRect(view.left, view.top, view.right - view.left, view.bottom - view.top);
  for (let i = 0; i < 160; i++) {
    const h = artHash(i, 223);
    const y = view.top + (((h >>> 6) % 10007) / 10007) * (view.bottom - view.top);
    ctx.fillStyle = h % 3 ? "rgba(110,72,40,0.14)" : "rgba(255,230,190,0.09)";
    ctx.fillRect(view.left, Math.round(y), view.right - view.left, 2);
  }
  const below = fillBelow(view);
  if (below) settle(ctx, below, "#3E2A18", 0.3, 0.45);
  ctx.restore();
}

/** 5. Gemstone: the sparkly purple velvet covers the whole screen, behind the header too. */
const GEM_SPARKS = ["#FF6FA8", "#FFD84A", "#4BE38A", "#7FB2FF", "#C59CFF"] as const;
export function matchupFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const H = view.worldH;
  const top = { x: view.left, y: view.top, w: view.right - view.left, h: -view.top };
  if (top.h > 0.01) fillGradient(ctx, top, view.top, 0, [[0, "#140E26"], [1, "#1B1131"]]);
  for (const side of fillSides(view)) fillGradient(ctx, side, 0, H, [[0, "#1B1131"], [0.55, "#130E21"], [1, "#0F0C1A"]]);
  const below = fillBelow(view);
  if (below) fillGradient(ctx, below, H, view.bottom, [[0, "#0F0C1A"], [Math.min(0.5, 60 / below.h), "#130E22"], [1, "#160F28"]]);
  // Polish A3: a faint violet haze in the empty space above and below, then sparkles: the old
  // small four-point glints plus a few larger twinkles with a soft halo and a cross flare (static).
  for (const r of [top, below]) {
    if (!r || r.h < 24) continue;
    const cy = r === top ? r.y + r.h * 0.6 : r.y + r.h * 0.4;
    const haze = ctx.createRadialGradient(view.left + (view.right - view.left) / 2, cy, 4, view.left + (view.right - view.left) / 2, cy, Math.max(r.w, r.h) * 0.6);
    haze.addColorStop(0, "rgba(140,90,230,0.10)");
    haze.addColorStop(1, "rgba(140,90,230,0)");
    ctx.fillStyle = haze;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  for (const [j, r] of [top, below, ...fillSides(view)].entries()) {
    if (!r || r.h < 1) continue;
    const n = Math.round((r.w * r.h) / 2000);
    for (let k = 0; k < n; k++) {
      const h = artHash(k, 977 + j);
      const x = r.x + ((h % 10007) / 10007) * r.w;
      const y = r.y + 6 + (((h >>> 14) % 10009) / 10009) * Math.max(0, r.h - 12);
      // Larger twinkles only clear of the header (the top 90 px of the screen).
      const big = j < 2 && (h >>> 24) % 9 === 0 && y > view.top + 90;
      const s = big ? 2.4 + ((h >>> 20) % 3) * 0.5 : 0.8 + ((h >>> 20) % 3) * 0.6;
      const colour = GEM_SPARKS[k % GEM_SPARKS.length]!;
      if (big) {
        const halo = ctx.createRadialGradient(x, y, 0, x, y, s * 5);
        halo.addColorStop(0, colour);
        halo.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = halo;
        ctx.fillRect(x - s * 5, y - s * 5, s * 10, s * 10);
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = "#FFF6E8";
        ctx.fillRect(x - s * 4, y - 0.5, s * 8, 1);
        ctx.fillRect(x - 0.5, y - s * 4, 1, s * 8);
      }
      ctx.globalAlpha = big ? 0.75 : 0.22 + ((h >>> 4) % 4) * 0.07;
      ctx.fillStyle = big ? "#FFF3DA" : colour;
      ctx.beginPath();
      ctx.moveTo(x, y - s * 2.2);
      ctx.lineTo(x + s * 0.5, y - s * 0.5);
      ctx.lineTo(x + s * 2.2, y);
      ctx.lineTo(x + s * 0.5, y + s * 0.5);
      ctx.lineTo(x, y + s * 2.2);
      ctx.lineTo(x - s * 0.5, y + s * 0.5);
      ctx.lineTo(x - s * 2.2, y);
      ctx.lineTo(x - s * 0.5, y - s * 0.5);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/** 15. Roofbound: faint lava streaks in the deep rock, drifting slowly sideways and bubbling a little. */
export const flipAmbient: ArenaAmbient = {
  region: "below",
  draw(ctx, view, t, still) {
    const r = fillBelow(view);
    if (!r || r.h < 16) return;
    ctx.lineCap = "round";
    for (let i = 0; i < 5; i++) {
      const h = artHash(i, 151);
      const y = r.y + 14 + (((h >>> 8) % 1000) / 1000) * Math.max(2, r.h - 40);
      const len = 50 + (h % 60);
      const speed = still ? 0 : (h % 2 ? 1 : -1) * (3 + (h % 4));
      const span = r.w + len + 40;
      const x = r.x - len - 20 + ((((h % 997) / 997) * span + (speed * t) / 1000) % span + span) % span;
      ctx.strokeStyle = "rgba(255,110,50,0.14)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let s = 0; s <= 6; s++) {
        const px = x + (len * s) / 6;
        const py = y + Math.sin(px / 23 + i) * 2.5;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      // A bubble now and then on the streak.
      const bub = still ? 0 : ((t / 900 + i * 0.37) % 1);
      if (!still && bub < 0.5) {
        ctx.fillStyle = `rgba(255,150,70,${(0.2 * (1 - bub * 2)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x + len * ((h >>> 3) % 10) / 10, y - bub * 4, 1 + bub * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },
};

/** 13. Jaywalk: two or three people stroll slowly along the pavement below the world (never the lanes). */
const WALKER_COLOURS = ["#5A7FB0", "#B0605A", "#6E9A5A", "#9A7AB0"] as const;
export const crossAmbient: ArenaAmbient = {
  region: "below",
  draw(ctx, view, t, still) {
    if (still) return;
    const r = fillBelow(view);
    if (!r || r.h < 30) return;
    const walk = { top: r.y + 8, bottom: r.y + Math.max(20, r.h - 30) };
    const span = r.w + 40;
    for (let i = 0; i < 3; i++) {
      const h = artHash(i, 131);
      const dir = i % 2 ? -1 : 1;
      const speed = 9 + (h % 6);
      const along = ((((h % 997) / 997) * span + (speed * t) / 1000) % span + span) % span;
      const x = dir > 0 ? r.x - 20 + along : r.x + r.w + 20 - along;
      const y = walk.top + (((h >>> 9) % 100) / 100) * Math.max(0, walk.bottom - walk.top);
      const step = Math.sin((t / 1000) * speed * 0.6 + i) * 2;
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = "rgba(20,24,30,0.35)";
      ctx.fillRect(x - 3, y + 9, 7, 2);
      ctx.fillStyle = "#3A3A44";
      ctx.fillRect(x - 1 + step * 0.5, y + 5, 1.5, 5);
      ctx.fillRect(x + 1 - step * 0.5, y + 5, 1.5, 5);
      ctx.fillStyle = WALKER_COLOURS[(h >>> 4) % WALKER_COLOURS.length]!;
      ctx.fillRect(x - 2, y, 5, 6);
      ctx.fillStyle = "#E3B98F";
      ctx.fillRect(x - 1, y - 3, 3, 3);
    }
    ctx.globalAlpha = 1;
  },
};

/** 16. Rainbow Bridge: faded clovers and gold coins in the grass under the buttons (clearly background). */
export function inkBridgeExtras(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const r = fillBelow(view);
  if (!r || r.h < 12) return;
  const n = Math.max(4, Math.round(r.w / 45));
  for (let i = 0; i < n; i++) {
    const h = artHash(i, 161);
    const x = r.x + ((i + 0.5) / n) * r.w + ((h % 20) - 10);
    const y = r.y + 10 + (((h >>> 8) % 100) / 100) * Math.max(0, r.h - 20);
    if (h % 3 === 0) {
      // A gold coin lying flat: a faint ellipse.
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = "#E8C14A";
      ctx.beginPath();
      ctx.ellipse(x, y, 4, 2.2, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // A four-leaf clover: four faint hearts round a stem.
      ctx.globalAlpha = 0.24;
      ctx.fillStyle = "#2E7A35";
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + ((h >>> 12) % 10) / 10;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * 2.6, y + Math.sin(a) * 2.6, 2.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillRect(x, y + 2, 1, 4);
    }
  }
  ctx.globalAlpha = 1;
}

/**
 * Mixed Signals (stroop, Polish batch S, 25 Oct 2026): the night board runs on under the world, behind the arrow
 * pad: the same faint dot grid as its backdrop, starting from the board's own #07070D at the edge and lifting to a
 * soft indigo glow (its backdrop's tone), then settling darker towards the screen's bottom. Painted once per size.
 */
export function stroopFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  for (const r of around(view, true)) {
    fillGradient(ctx, r, r.y, r.y + Math.max(1, r.h), [[0, "#07070D"], [0.18, "#0C0C17"], [0.6, "#121226"], [1, "#0D0D1A"]]);
    const glow = ctx.createRadialGradient(view.worldW / 2, r.y + r.h * 0.45, 10, view.worldW / 2, r.y + r.h * 0.45, Math.max(60, r.w * 0.7));
    glow.addColorStop(0, "rgba(40,44,72,0.35)");
    glow.addColorStop(1, "rgba(40,44,72,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    const x0 = Math.floor(r.x / 16) * 16;
    for (let y = Math.ceil((r.y + 4) / 16) * 16 + 8; y < r.y + r.h; y += 16) for (let x = x0 + 8 + ((y / 16) % 2) * 8; x < r.x + r.w; x += 16) ctx.fillRect(x, y, 1, 1);
    settle(ctx, r, "#07070D", 0.6, 0.35);
  }
}

/**
 * Cards & Board (30 Oct 2026). Minesweeper: the dark hexagon background runs on beside and below the board's world (the
 * same lattice, anchored to the world), easing a touch darker towards the screen's bottom.
 */
export function minesweeperFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const below = fillBelow(view);
  for (const r of [...fillSides(view), ...(below ? [below] : [])]) {
    ctx.fillStyle = MINES_ART.bg;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    paintMinesHexesIn(ctx, r);
    ctx.restore();
  }
  if (below) fillGradient(ctx, below, below.y + 20, below.y + below.h, [[0, "rgba(6,7,9,0)"], [1, "rgba(6,7,9,0.55)"]]);
}

/** The hexagon lattice over a rectangle outside the world (the lattice keeps the world's origin). */
function paintMinesHexesIn(ctx: CanvasRenderingContext2D, r: Rect): void {
  ctx.save();
  // The lattice's rows repeat every 42 units and its columns every 14 × √3: shift to a whole repeat at or before the rect.
  const rowRep = 42;
  const colRep = 14 * Math.sqrt(3);
  const ox = Math.floor(r.x / colRep) * colRep;
  const oy = Math.floor(r.y / rowRep) * rowRep;
  ctx.translate(ox, oy);
  paintMinesHexes(ctx, r.w + (r.x - ox) + colRep, r.h + (r.y - oy) + rowRep);
  ctx.restore();
}

/** Mahjong Solitaire: the dark wooden table runs on beside and below the world, its grain unbroken. */
export function mahjongFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  for (const r of fillSides(view)) paintMahjongWood(ctx, r.x, r.y, r.w, r.h, view.worldH);
  const below = fillBelow(view);
  if (!below) return;
  paintMahjongWood(ctx, below.x, below.y, below.w, below.h, view.worldH);
  fillGradient(ctx, below, below.y, below.y + below.h, [[0, "rgba(22,13,7,0)"], [1, "rgba(10,6,3,0.6)"]]);
}
