/**
 * Mixed Signals (Colour Clash) art (Polish, 13 Oct 2026). Presentation only: wraps the
 * sim's game object with a new draw that reads state and never writes it. 390 × 560 world:
 * banner 65,10 260×44; lanes y 66–472; gates y 472, 22 tall; labels y 512; status y 548.
 * clashRev 5 (taller worlds batch 2): a 390 × 650 board; everything from the gates down
 * sits 90 px lower (clashDrop), so the lanes run y 66–562.
 * Lanes and gates sit on the sim's own lane grid (a tap at x picks lane
 * floor(x × lanes ÷ 390)), so a tap on a drawn gate picks that gate's lane and a tap just
 * past its edge picks the neighbour. The sim's original draw used x 16–374, which put a
 * few px of each drawn gate in the next lane.
 * Static scenery (backdrop, lane wells, gate glows, banner panels) is painted once per
 * device scale into cached layers; text is drawn live. The falling word is drawn in its
 * exact ink colour on a neutral plate with a neutral dark outline: no glow ever tints it.
 */
import {
  CLASH_COLOURS,
  CLASH_FLASH_TICKS,
  CLASH_NAMES,
  CLASH_WORLD_W,
  clashDrop,
  clashGatesAt,
  clashLaneCount,
  clashRuleAt,
  clashWorldH,
  colourClashGameFor,
  type ClashState,
} from "./colourClash";
import { TICKS_PER_SECOND, type ArcadeGame, type ArcadeInputEvent, type CanvasSize } from "./engine";
import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
const FP = 256;
/** The sim's lane grid: lane k spans [k × 390 ÷ lanes, (k + 1) × 390 ÷ lanes). */
const LEFT = 0;
const LANES_W = CLASH_WORLD_W;
const WELL_TOP = 66;
const GATE_Y = 472;
const GATE_H = 22;
const BG = "#07070D";
const GLOW = 14;
const WASH = 34;

/** Lane well x and width: inside the sim lane, 1 px in from each boundary. */
export function clashLaneRect(lane: number, lanes: number): { x: number; w: number } {
  const laneW = LANES_W / lanes;
  return { x: LEFT + lane * laneW + 1, w: laneW - 2 };
}
/** Gate rectangle in world px: inside the sim lane, 2 px in from each boundary (`low` px lower on a taller board). */
export function clashGateRect(lane: number, lanes: number, low = 0): { x: number; y: number; w: number; h: number } {
  const laneW = LANES_W / lanes;
  return { x: LEFT + lane * laneW + 2, y: GATE_Y + low, w: laneW - 4, h: GATE_H };
}

const layers = new Map<string, ArtCanvas | null>();
/**
 * Draws a cached layer covering world rect (x, y, w, h). The layer is painted once at the
 * exact device-pixel size it covers on this canvas and blitted 1:1 at a whole-pixel
 * position, so no per-frame resampling. Returns false where no offscreen canvas exists.
 */
function blit(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, w: number, h: number, paint: (c: Ctx) => void): boolean {
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  if (!t || t.b !== 0 || t.c !== 0 || t.a <= 0 || t.d <= 0) return false;
  const dx = Math.round(t.a * x + t.e), dy = Math.round(t.d * y + t.f);
  const dw = Math.max(1, Math.round(t.a * (x + w) + t.e) - dx), dh = Math.max(1, Math.round(t.d * (y + h) + t.f) - dy);
  const full = `${key}@${dw}x${dh}`;
  let canvas = layers.get(full);
  if (canvas === undefined) {
    if (layers.size > 64) layers.clear();
    canvas = artCanvas(dw, dh);
    const c = canvas ? artContext(canvas) : null;
    if (canvas && c) { c.scale(dw / w, dh / h); paint(c); } else canvas = null;
    layers.set(full, canvas);
  }
  if (!canvas) return false;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, dx, dy);
  ctx.drawImage(canvas, 0, 0);
  ctx.restore();
  return true;
}

function roundRect(c: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
}

/** Backdrop: night panel, faint dot grid, lane wells with rails, chevrons and gate sockets. */
function paintBackdrop(c: Ctx, lanes: number, low: number): void {
  const CLASH_WORLD_H = 560 + low;
  const GATE_Y = 472 + low;
  c.fillStyle = BG; c.fillRect(0, 0, CLASH_WORLD_W, CLASH_WORLD_H);
  const vignette = c.createRadialGradient(195, 260, 60, 195, 280, 380);
  vignette.addColorStop(0, "rgba(40,44,72,0.35)"); vignette.addColorStop(1, "rgba(0,0,0,0)");
  c.fillStyle = vignette; c.fillRect(0, 0, CLASH_WORLD_W, CLASH_WORLD_H);
  c.fillStyle = "rgba(255,255,255,0.05)";
  for (let y = 8; y < CLASH_WORLD_H; y += 16) for (let x = 8 + ((y / 16) % 2) * 8; x < CLASH_WORLD_W; x += 16) c.fillRect(x, y, 1, 1);
  for (let lane = 0; lane < lanes; lane += 1) {
    const { x, w } = clashLaneRect(lane, lanes);
    const well = c.createLinearGradient(0, WELL_TOP, 0, GATE_Y);
    well.addColorStop(0, "rgba(255,255,255,0.015)"); well.addColorStop(1, "rgba(255,255,255,0.05)");
    c.fillStyle = well; c.fillRect(x, WELL_TOP, w, GATE_Y - WELL_TOP);
    c.fillStyle = "rgba(255,255,255,0.07)";
    c.fillRect(x, WELL_TOP, 1, GATE_Y - WELL_TOP); c.fillRect(x + w - 1, WELL_TOP, 1, GATE_Y - WELL_TOP);
    c.fillStyle = "rgba(255,255,255,0.10)"; c.fillRect(x, WELL_TOP, w, 1);
    // Faint downward chevrons in the lane centre.
    c.strokeStyle = "rgba(255,255,255,0.045)"; c.lineWidth = 2; c.lineCap = "round"; c.lineJoin = "round";
    const cx = x + w / 2;
    for (let y = 120; y < GATE_Y - 40; y += 64) { c.beginPath(); c.moveTo(cx - 8, y); c.lineTo(cx, y + 7); c.lineTo(cx + 8, y); c.stroke(); }
    // Gate socket: a dark recess the glowing gate sits in.
    const g = clashGateRect(lane, lanes, low);
    c.fillStyle = "#020205"; roundRect(c, g.x - 2, g.y - 3, g.w + 4, g.h + 6, 6); c.fill();
    c.strokeStyle = "rgba(255,255,255,0.08)"; c.lineWidth = 1; c.stroke();
  }
  // Base plate under the gates, where the names sit.
  c.fillStyle = "rgba(255,255,255,0.025)"; c.fillRect(LEFT + 1, GATE_Y + GATE_H + 4, LANES_W - 2, 26);
}

/** One gate: solid colour bar, a glow halo and a short wash up the lane, all pre-blurred once. */
export function paintGate(c: Ctx, colour: string, w: number): void {
  const x = GLOW, y = WASH;
  const wash = c.createLinearGradient(0, 0, 0, y);
  wash.addColorStop(0, "rgba(0,0,0,0)"); wash.addColorStop(1, colour);
  c.globalAlpha = 0.16; c.fillStyle = wash; c.fillRect(x + 2, 0, w - 4, y);
  c.globalAlpha = 1;
  c.save();
  c.shadowColor = colour; c.shadowBlur = GLOW;
  c.fillStyle = colour; roundRect(c, x, y, w, GATE_H, 4); c.fill();
  c.restore();
  c.fillStyle = colour; roundRect(c, x, y, w, GATE_H, 4); c.fill();
  c.save(); roundRect(c, x, y, w, GATE_H, 4); c.clip();
  c.fillStyle = "rgba(255,255,255,0.28)"; c.fillRect(x, y, w, 3);
  c.fillStyle = "rgba(0,0,0,0.18)"; c.fillRect(x, y + GATE_H - 4, w, 4);
  c.restore();
}

/** Selected lane: a lit well with corner brackets. */
function paintSelected(c: Ctx, w: number, h: number): void {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(255,255,255,0.035)"); g.addColorStop(1, "rgba(255,255,255,0.075)");
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = "rgba(255,255,255,0.22)";
  for (const [x, y, sx, sy] of [[0, 0, 1, 1], [w, 0, -1, 1], [0, h, 1, -1], [w, h, -1, -1]] as const) {
    c.fillRect(sx > 0 ? x : x - 10, sy > 0 ? y : y - 2, 10, 2);
    c.fillRect(sx > 0 ? x : x - 2, sy > 0 ? y : y - 10, 2, 10);
  }
}

function paintBanner(c: Ctx, flash: boolean): void {
  roundRect(c, 1, 1, 258, 42, 9);
  c.fillStyle = flash ? "#F5B82E" : "#1B1B24"; c.fill();
  c.strokeStyle = flash ? "#FFE08A" : "rgba(245,184,46,0.45)"; c.lineWidth = 1.5; c.stroke();
  if (!flash) { c.fillStyle = "rgba(255,255,255,0.05)"; c.fillRect(8, 3, 244, 1); }
}

interface Pulse { lane: number; lanes: number; at: number; good: boolean }
interface Memory { tick: number; sorted: number; correct: number; lane: number; pulses: Pulse[] }
const memories = new WeakMap<CanvasRenderingContext2D, Memory>();
const PULSE_TICKS = 18;

function draw(ctx: CanvasRenderingContext2D, state: ClashState, size: CanvasSize): void {
  // clashRev 5: the taller board, its gates `low` px lower (the original 560 / 472 otherwise).
  const low = clashDrop(state);
  const CLASH_WORLD_H = clashWorldH(state);
  const GATE_Y = 472 + low;
  const scale = Math.min(size.width / CLASH_WORLD_W, size.height / CLASH_WORLD_H);
  const ox = (size.width - CLASH_WORLD_W * scale) / 2;
  const oy = (size.height - CLASH_WORLD_H * scale) / 2;
  ctx.save();
  ctx.fillStyle = BG; ctx.fillRect(0, 0, size.width, size.height);
  ctx.translate(ox, oy); ctx.scale(scale, scale);
  const lanes = clashLaneCount(state.tick);
  if (!blit(ctx, `back-${lanes}-${low}`, 0, 0, CLASH_WORLD_W, CLASH_WORLD_H, (c) => paintBackdrop(c, lanes, low))) paintBackdrop(ctx, lanes, low);

  // Landing pulses (presentation memory: the lane the word was in when it was sorted).
  let mem = memories.get(ctx);
  const sorted = state.correct + state.wrong;
  if (!mem || state.tick < mem.tick || sorted < mem.sorted) { mem = { tick: state.tick, sorted, correct: state.correct, lane: state.lane, pulses: [] }; memories.set(ctx, mem); }
  if (sorted > mem.sorted) {
    mem.pulses.push({ lane: mem.lane, lanes: clashLaneCount(Math.max(0, state.tick - 1)), at: state.tick, good: state.correct > mem.correct });
    if (mem.pulses.length > 3) mem.pulses.shift();
  }
  mem.tick = state.tick; mem.sorted = sorted; mem.correct = state.correct; mem.lane = state.lane;
  mem.pulses = mem.pulses.filter((p) => state.tick - p.at < PULSE_TICKS);

  const transition = state.tick % (15 * TICKS_PER_SECOND);
  const flash = transition < CLASH_FLASH_TICKS && state.tick > 0 && Math.trunc(state.tick / 5) % 2 === 0;
  const rule = clashRuleAt(state, state.tick);
  if (!blit(ctx, `banner-${flash ? 1 : 0}`, 65, 10, 260, 44, (c) => paintBanner(c, flash))) { ctx.fillStyle = flash ? "#F5B82E" : "#23232C"; ctx.fillRect(65, 10, 260, 44); }
  ctx.fillStyle = flash ? BG : "#F5B82E"; ctx.font = "bold 21px ui-monospace, monospace"; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillText(rule === 0 ? "SORT BY INK" : "SORT BY WORD", 195, 39);

  const gates = clashGatesAt(state, state.tick);
  const laneW = LANES_W / lanes;
  const sel = clashLaneRect(Math.min(lanes - 1, Math.max(0, state.lane)), lanes);
  if (!blit(ctx, `sel-${lanes}-${low}`, sel.x, WELL_TOP, sel.w, GATE_Y - WELL_TOP, (c) => paintSelected(c, sel.w, GATE_Y - WELL_TOP))) { ctx.fillStyle = "rgba(255,255,255,0.08)"; ctx.fillRect(sel.x, WELL_TOP, sel.w, GATE_Y - WELL_TOP); }
  for (let lane = 0; lane < lanes; lane += 1) {
    const colour = gates[lane]!;
    const g = clashGateRect(lane, lanes, low);
    if (!blit(ctx, `gate-${colour}-${lanes}`, g.x - GLOW, g.y - WASH, g.w + GLOW * 2, GATE_H + WASH + GLOW, (c) => paintGate(c, CLASH_COLOURS[colour]!, g.w))) { ctx.fillStyle = CLASH_COLOURS[colour]!; ctx.fillRect(g.x, g.y, g.w, g.h); }
    ctx.fillStyle = "#FFFFFF"; ctx.font = "bold 12px ui-monospace, monospace"; ctx.fillText(CLASH_NAMES[colour]!, LEFT + (lane + 0.5) * laneW, 512 + low);
  }
  for (const p of mem.pulses) {
    if (p.lanes !== lanes) continue;
    const age = (state.tick - p.at) / PULSE_TICKS;
    const g = clashGateRect(p.lane, lanes, low), grow = 2 + age * 8;
    ctx.globalAlpha = (1 - age) * (p.good ? 0.85 : 0.5);
    ctx.strokeStyle = p.good ? "#FFFFFF" : "#8A8A96"; ctx.lineWidth = p.good ? 2 : 1.5;
    roundRect(ctx, g.x - grow, g.y - grow, g.w + grow * 2, g.h + grow * 2, 6 + grow * 0.5); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const current = state.items.at(-1);
  if (current) {
    const x = LEFT + (state.lane + 0.5) * laneW, y = state.itemY / FP;
    const word = CLASH_NAMES[current.word]!;
    ctx.font = "bold 30px ui-sans-serif, sans-serif";
    const w = ctx.measureText(word).width + 18;
    ctx.fillStyle = "rgba(14,14,22,0.88)"; roundRect(ctx, x - w / 2, y - 28, w, 36, 9); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.14)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.lineJoin = "round"; ctx.lineWidth = 4; ctx.strokeStyle = BG; ctx.strokeText(word, x, y);
    ctx.fillStyle = CLASH_COLOURS[current.ink]!; ctx.fillText(word, x, y);
  }
  ctx.fillStyle = "#FFFFFF"; ctx.font = "bold 15px ui-monospace, monospace"; ctx.fillText(state.queue > 0 ? `${state.correct} right · ${state.wrong} wrong · ${state.queue - state.correct - state.wrong} left` : `${state.correct} right · ${state.wrong} wrong`, 195, 548 + low);
  ctx.restore();
}

const artGames = new Map<number, ArcadeGame<ClashState, ArcadeInputEvent | null>>();
/** The sim game for a clashVariantOf key with this art (one stable object per variant). */
export function colourClashArtGameFor(variant: number): ArcadeGame<ClashState, ArcadeInputEvent | null> {
  let game = artGames.get(variant);
  if (!game) { game = { ...colourClashGameFor(variant), draw }; artGames.set(variant, game); }
  return game;
}

/**
 * Finish effect on the overlay canvas over the arena (arena px): every gate flashes in
 * its own colour, three beats over ~900 ms, with a light column rising up its lane;
 * faded by 1100 ms. Reduced motion: a single plain fade, no movement.
 */
export function drawClashFinish(ctx: CanvasRenderingContext2D, ms: number, width: number, height: number, state: ClashState, reduced: boolean): void {
  const low = clashDrop(state);
  const GATE_Y = 472 + low;
  const sx = width / CLASH_WORLD_W, sy = height / clashWorldH(state);
  const lanes = clashLaneCount(state.tick);
  const gates = clashGatesAt(state, state.tick);
  const beat = reduced ? Math.max(0, 1 - ms / 1100) : ms < 900 ? Math.max(0, Math.sin((ms / 300) * Math.PI)) * (1 - ms / 1400) : Math.max(0, 0.36 * (1 - (ms - 900) / 200));
  ctx.save();
  ctx.scale(sx, sy);
  for (let lane = 0; lane < lanes; lane += 1) {
    const colour = CLASH_COLOURS[gates[lane] ?? 0]!;
    const g = clashGateRect(lane, lanes, low);
    const l = clashLaneRect(lane, lanes);
    ctx.fillStyle = colour;
    if (!reduced) {
      const rise = Math.min(1, ms / 700);
      const top = GATE_Y - rise * (GATE_Y - WELL_TOP);
      ctx.globalAlpha = 0.22 * Math.max(0, 1 - ms / 1100);
      ctx.fillRect(l.x + 2, top, l.w - 4, GATE_Y - top);
    }
    for (let i = 3; i >= 1; i -= 1) {
      ctx.globalAlpha = beat * (0.16 / i);
      const p = i * 5;
      ctx.beginPath(); ctx.roundRect(g.x - p, g.y - p, g.w + p * 2, g.h + p * 2, 6 + p); ctx.fill();
    }
    ctx.globalAlpha = beat;
    ctx.beginPath(); ctx.roundRect(g.x, g.y, g.w, g.h, 4); ctx.fill();
    ctx.globalAlpha = beat * 0.7; ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(g.x + 2, g.y + 2, g.w - 4, 3);
  }
  ctx.restore();
}
