/**
 * Tenfall art (Number polish, Oct 2026): wooden number tiles dropping down the
 * carved lanes of a toybox board (toybox.renderer.ts palette). Render only:
 * never imported by the sim or the server, it reads the sim state and never
 * writes to it.
 *
 * Geometry: the board keeps the sim's view (tdView: the 360 × 520 world stretched to
 * the arena), so every tile is drawn exactly over its collision rectangle
 * (76 × 64 world px, centred in its lane); only the corner radii and the
 * lettering are drawn at uniform screen size, so digits never look squashed. The
 * refused-tile shake moves a tile at most 2 world px.
 *
 * Caches: the board (oak, grain, lanes, vignette) is one offscreen canvas per
 * size; each tile face is a sprite per label/variant/size; the completion
 * shimmer band is one sprite. Frames only blit, stroke and fill flat colours.
 */
import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";
import { sceneBelow, sceneFill, sceneSides, type ArenaSceneView } from "./arenaScene.renderer";
import type { CanvasSize } from "./engine";
import { reducedMotion } from "./art.renderer";
import { arcadeFx, type ArcadeFxPoint, type ArcadeFxSpec } from "./arcadeFx.renderer";
import {
  tdKind,
  tdLabel,
  tdView,
  tenDropHolding,
  unpackTdLog,
  TD_COL_W,
  TD_CONFIG,
  TD_DIGIT,
  TD_H,
  TD_LOG_APPLIED,
  TD_LOG_CLEAR,
  TD_LOG_RESET,
  TD_MINUS,
  TD_TARGETS,
  TD_GOLD,
  TD_W,
  type TenDropState,
} from "./tenDrop";
import {
  TOY_BRASS,
  TOY_BRASS_DARK,
  TOY_INK,
  TOY_OAK,
  TOY_OAK_GRAIN,
  TOY_WOOD_DARK,
  TOY_WOOD_DEEP,
} from "./toybox.renderer";

const FONT = "'Space Grotesk', 'Inter', ui-rounded, system-ui, sans-serif";
const TILE_W = TD_CONFIG.tileW;
const TILE_H = TD_CONFIG.tileH;
const TILE_X = (TD_COL_W - TILE_W) / 2;
/** Lettering waits for the web font so a fallback face is never cached for good. */
const FONT_PROBE = `700 24px 'Space Grotesk'`;

/** Tile looks: face top, face bottom, edge, ink. */
const LOOKS = {
  digit: ["#FBEFD5", "#E9D2A4", "#9C7444", TOY_INK],
  op: ["#F6D47A", "#D9A946", TOY_BRASS_DARK, "#2E1C06"],
  minus: ["#6E93B8", "#4C7097", "#2D4A68", "#FFFFFF"],
  refused: ["#F2B3A6", "#DB8576", "#A8402F", "#4A120A"],
  /** tenRev 4's gold digit: a bright gilded face, a deep gold rim and a star (tileSprite). */
  gold: ["#FFF3C2", TD_GOLD, "#8A5A08", "#3A2200"],
} as const;
export type Look = keyof typeof LOOKS;

export const TD_POP_MS = 200;
export const TD_RING_MS = 360;
export const TD_SOLVE_MS = 1200;
/** A gold ten's pop: "GOLD TEN" rising from the tile, ms. */
export const TD_GOLD_POP_MS = 900;
const GHOST_MS = 220;

function lookOf(tile: number, refused: boolean, gold?: boolean): Look {
  if (refused) return "refused";
  const k = tdKind(tile);
  if (k === TD_DIGIT) return gold ? "gold" : "digit";
  if (k === TD_MINUS) return "minus";
  return "op";
}

/* ------------------------------ Caches ------------------------------ */

let board: { key: string; canvas: ArtCanvas } | null = null;
const sprites = new Map<string, ArtCanvas>();
let spriteSize = "";
let band: ArtCanvas | null = null;

function boardCanvas(wPx: number, hPx: number, ratio: number): ArtCanvas | null {
  const key = `${wPx}x${hPx}@${ratio}`;
  if (board?.key === key) return board.canvas;
  const canvas = artCanvas(Math.max(1, Math.round(wPx * ratio)), Math.max(1, Math.round(hPx * ratio)));
  const c = canvas && artContext(canvas);
  if (!canvas || !c) return null;
  c.scale(ratio, ratio);
  const sx = wPx / TD_W;
  // Oak, lamp-lit from above.
  const oak = c.createLinearGradient(0, 0, 0, hPx);
  oak.addColorStop(0, "#E4BA80");
  oak.addColorStop(0.55, TOY_OAK);
  oak.addColorStop(1, "#A97A44");
  c.fillStyle = oak;
  c.fillRect(0, 0, wPx, hPx);
  // Grain: long soft waves, seeded by row so every phone draws the same board.
  c.strokeStyle = TOY_OAK_GRAIN;
  c.lineWidth = 1;
  for (let i = 0, gy = 6; gy < hPx; gy += 11 + (i % 3) * 3, i++) {
    c.globalAlpha = 0.12 + (i % 4) * 0.04;
    c.beginPath();
    c.moveTo(0, gy);
    c.bezierCurveTo(wPx * 0.3, gy + (i % 2 ? 5 : -4), wPx * 0.7, gy + (i % 2 ? -5 : 4), wPx, gy + ((i * 7) % 5) - 2);
    c.stroke();
  }
  c.globalAlpha = 1;
  // Four carved lanes: a shallow groove with a shadowed left wall and a lit right wall.
  for (let col = 0; col < TD_CONFIG.cols; col++) {
    const x0 = col * TD_COL_W * sx + 3;
    const x1 = (col + 1) * TD_COL_W * sx - 3;
    // Deeper grooves (polish batch W): a darker floor, a wider shaded wall and a brighter lit lip.
    c.fillStyle = "rgba(92,56,22,0.19)";
    c.fillRect(x0, 0, x1 - x0, hPx);
    c.fillStyle = "rgba(62,39,22,0.42)";
    c.fillRect(x0, 0, 3, hPx);
    c.fillStyle = "rgba(62,39,22,0.16)";
    c.fillRect(x0 + 3, 0, 4, hPx);
    c.fillStyle = "rgba(255,236,200,0.42)";
    c.fillRect(x1 - 1.5, 0, 1.5, hPx);
  }
  // Lane dividers: dark wooden rails.
  for (let col = 1; col < TD_CONFIG.cols; col++) {
    const x = col * TD_COL_W * sx;
    c.fillStyle = TOY_WOOD_DARK;
    c.fillRect(x - 2, 0, 4, hPx);
    c.fillStyle = "rgba(255,226,170,0.35)";
    c.fillRect(x - 2, 0, 1, hPx);
  }
  // The drop slot along the top and the fall-away at the bottom.
  const top = c.createLinearGradient(0, 0, 0, 22);
  top.addColorStop(0, "rgba(43,26,14,0.55)");
  top.addColorStop(1, "rgba(43,26,14,0)");
  c.fillStyle = top;
  c.fillRect(0, 0, wPx, 22);
  const foot = c.createLinearGradient(0, hPx - 30, 0, hPx);
  foot.addColorStop(0, "rgba(43,26,14,0)");
  foot.addColorStop(1, "rgba(43,26,14,0.45)");
  c.fillStyle = foot;
  c.fillRect(0, hPx - 30, wPx, 30);
  // Soft vignette.
  const v = c.createRadialGradient(wPx / 2, hPx * 0.45, Math.min(wPx, hPx) * 0.35, wPx / 2, hPx / 2, Math.max(wPx, hPx) * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(40,20,5,0.28)");
  c.fillStyle = v;
  c.fillRect(0, 0, wPx, hPx);
  // Frame line (inside the arena; the HUD plank sits on top of it).
  c.strokeStyle = TOY_WOOD_DEEP;
  c.lineWidth = 2;
  c.strokeRect(1, 1, wPx - 2, hPx - 2);
  board = { key, canvas };
  return canvas;
}

/** A tile face: (w + 4) × (h + 4) px, the tile rectangle at (2, 2), a 2 px drop shadow under it. */
export function tileSprite(label: string, look: Look, w: number, h: number, ratio: number, fontReady: boolean): ArtCanvas | null {
  const sizeKey = `${w.toFixed(1)}x${h.toFixed(1)}@${ratio}${fontReady ? "f" : ""}`;
  if (sizeKey !== spriteSize) {
    sprites.clear();
    spriteSize = sizeKey;
  }
  const key = `${look}|${label}`;
  const hit = sprites.get(key);
  if (hit) return hit;
  const canvas = artCanvas(Math.ceil((w + 4) * ratio), Math.ceil((h + 4) * ratio));
  const c = canvas && artContext(canvas);
  if (!canvas || !c) return null;
  c.scale(ratio, ratio);
  const [faceTop, faceLow, edge, ink] = LOOKS[look];
  const r = Math.min(11, h * 0.2);
  // Drop shadow (2 px down, inside the 2 px allowance).
  c.fillStyle = "rgba(43,26,14,0.5)";
  c.beginPath();
  c.roundRect(2, 4, w, h, r);
  c.fill();
  const g = c.createLinearGradient(0, 2, 0, 2 + h);
  g.addColorStop(0, faceTop);
  g.addColorStop(1, faceLow);
  c.fillStyle = g;
  c.beginPath();
  c.roundRect(2, 2, w, h, r);
  c.fill();
  // Light from above (polish batch W): a gloss over the top 45 % of the face and a shade low down,
  // inside the face, so the tile reads as lit; then the bevel's lit top lip and shaded bottom lip.
  c.save();
  c.beginPath();
  c.roundRect(2, 2, w, h, r);
  c.clip();
  const gloss = c.createLinearGradient(0, 2, 0, 2 + h);
  gloss.addColorStop(0, "rgba(255,255,255,0.34)");
  gloss.addColorStop(0.45, "rgba(255,255,255,0)");
  gloss.addColorStop(0.7, "rgba(40,20,5,0)");
  gloss.addColorStop(1, "rgba(40,20,5,0.2)");
  c.fillStyle = gloss;
  c.fillRect(2, 2, w, h);
  c.restore();
  c.fillStyle = "rgba(255,255,255,0.6)";
  c.fillRect(2 + r * 0.7, 4, w - r * 1.4, 2);
  c.fillStyle = "rgba(60,30,10,0.26)";
  c.fillRect(2 + r * 0.7, h - 2, w - r * 1.4, 2);
  c.lineWidth = 2;
  c.strokeStyle = edge;
  c.beginPath();
  c.roundRect(3, 3, w - 2, h - 2, r - 1);
  c.stroke();
  if (look === "gold") {
    // Gilded: a bright inner rim, a diagonal glint and a small star in the top-left corner (all inside the face).
    c.lineWidth = 1.5;
    c.strokeStyle = "rgba(255,248,214,0.9)";
    c.beginPath();
    c.roundRect(5.5, 5.5, w - 7, h - 7, Math.max(2, r - 3.5));
    c.stroke();
    c.save();
    c.beginPath();
    c.roundRect(2, 2, w, h, r);
    c.clip();
    c.fillStyle = "rgba(255,255,255,0.28)";
    c.beginPath();
    c.moveTo(2 + w * 0.58, 2);
    c.lineTo(2 + w * 0.74, 2);
    c.lineTo(2 + w * 0.36, 2 + h);
    c.lineTo(2 + w * 0.2, 2 + h);
    c.closePath();
    c.fill();
    c.restore();
    const sr = Math.max(3, Math.min(w, h) * 0.11);
    const sx = 2 + sr + 6;
    const sy = 2 + sr + 6;
    c.fillStyle = "#FFFBEA";
    c.strokeStyle = edge;
    c.lineWidth = 1;
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? sr * 0.45 : sr;
      if (i === 0) c.moveTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
      else c.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
    }
    c.closePath();
    c.fill();
    c.stroke();
  }
  // Lettering at uniform size, centred.
  const size = Math.round(Math.min(h * (label.length > 1 ? 0.5 : 0.58), w * (label.length > 1 ? 0.4 : 0.5)));
  c.font = `700 ${size}px ${FONT}`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  if (look !== "minus") {
    c.fillStyle = "rgba(255,255,255,0.5)";
    c.fillText(label, 2 + w / 2, 2 + h / 2 + 2);
  }
  c.fillStyle = ink;
  c.fillText(label, 2 + w / 2, 2 + h / 2 + 1);
  sprites.set(key, canvas);
  return canvas;
}

/** The completion shimmer: a soft diagonal light band, 64 × 128 px, made once. */
function shimmerBand(): ArtCanvas | null {
  if (band) return band;
  const canvas = artCanvas(64, 128);
  const c = canvas && artContext(canvas);
  if (!canvas || !c) return null;
  const g = c.createLinearGradient(0, 0, 64, 0);
  g.addColorStop(0, "rgba(255,248,214,0)");
  g.addColorStop(0.5, "rgba(255,248,214,0.85)");
  g.addColorStop(1, "rgba(255,248,214,0)");
  c.fillStyle = g;
  c.setTransform(1, 0, -0.35, 1, 22, 0);
  c.fillRect(0, 0, 64, 128);
  band = canvas;
  return canvas;
}

/* ----------------------- Per-canvas presentation memory ----------------------- */

interface Ghost { x: number; y: number; label: string; look: Look; at: number; ms: number; grow: boolean }
interface Ring { x: number; y: number; at: number; colour: string }
interface GoldPop { x: number; y: number; at: number }
interface Memo {
  tiles: Map<number, { col: number; y: number; tile: number; gold?: true | undefined }>;
  tick: number;
  logTick: number;
  stage: number;
  ghosts: Ghost[];
  rings: Ring[];
  golds: GoldPop[];
  solveAt: number;
  solveFrom: { x: number; y: number };
}
const memos = new WeakMap<CanvasRenderingContext2D, Memo>();

function observe(ctx: CanvasRenderingContext2D, s: TenDropState, now: number): Memo {
  let m = memos.get(ctx);
  const lastLog = s.log.length ? unpackTdLog(s.log[s.log.length - 1]!).tick : -1;
  if (!m || s.tick < m.tick || m.stage > s.stage) {
    // First frame this canvas sees (or a restarted run): remember, never animate.
    m = { tiles: new Map(), tick: s.tick, logTick: lastLog, stage: s.stage, ghosts: [], rings: [], golds: [], solveAt: s.cleared >= TD_TARGETS ? -Infinity : 0, solveFrom: { x: TD_W / 2, y: TD_H / 2 } };
    for (const t of s.tiles) m.tiles.set(t.id, { col: t.col, y: t.y, tile: t.tile, gold: t.gold });
    memos.set(ctx, m);
    return m;
  }
  // Taps that took a tile: the lowest vanished tile in the logged column.
  for (const entry of s.log) {
    const e = unpackTdLog(entry);
    if (e.tick <= m.logTick) continue;
    if (e.code !== TD_LOG_APPLIED && e.code !== TD_LOG_CLEAR && e.code !== TD_LOG_RESET) continue;
    let gone: { col: number; y: number; tile: number; gold?: true | undefined } | null = null;
    for (const [id, t] of m.tiles) {
      if (t.col !== e.extra || s.tiles.some((x) => x.id === id)) continue;
      if (!gone || t.y > gone.y) gone = t;
    }
    if (!gone) continue;
    const x = gone.col * TD_COL_W + TILE_X;
    const y = gone.y / 256;
    m.ghosts.push({ x, y, label: tdLabel(gone.tile), look: lookOf(gone.tile, false, gone.gold), at: now, ms: TD_POP_MS, grow: true });
    if (e.code === TD_LOG_CLEAR) {
      m.rings.push({ x: x + TILE_W / 2, y: y + TILE_H / 2, at: now, colour: gone.gold ? TD_GOLD : "#FFD978" });
      // tenRev 4: a ten made by the gold tile (the sim counts it in goldTens).
      if (gone.gold) m.golds.push({ x: x + TILE_W / 2, y: y + TILE_H / 2, at: now });
      m.solveFrom = { x: x + TILE_W / 2, y: y + TILE_H / 2 };
    } else if (e.code === TD_LOG_RESET) m.rings.push({ x: x + TILE_W / 2, y: y + TILE_H / 2, at: now, colour: "#E0503C" });
  }
  m.logTick = Math.max(m.logTick, lastLog);
  m.tick = s.tick;
  // A new target sweeps the old lane contents away: they fade where they were.
  if (s.stage > m.stage) {
    for (const t of m.tiles.values()) {
      m.ghosts.push({ x: t.col * TD_COL_W + TILE_X, y: t.y / 256, label: tdLabel(t.tile), look: lookOf(t.tile, false, t.gold), at: now, ms: GHOST_MS, grow: false });
    }
    m.stage = s.stage;
  }
  if (s.cleared >= TD_TARGETS && m.solveAt === 0) m.solveAt = now;
  m.tiles.clear();
  for (const t of s.tiles) m.tiles.set(t.id, { col: t.col, y: t.y, tile: t.tile, gold: t.gold });
  m.ghosts = m.ghosts.filter((g) => now - g.at < g.ms).slice(-8);
  m.golds = m.golds.filter((g) => now - g.at < TD_GOLD_POP_MS).slice(-2);
  m.rings = m.rings.filter((r) => now - r.at < TD_RING_MS).slice(-4);
  return m;
}

/* -------------------------------- Drawing -------------------------------- */

const SPARKS = 22;
const SPARK_COLOURS = ["#FFD978", TOY_BRASS, "#FFF4DE", "#F6A93B"];

/**
 * Draws one frame in CSS px (the caller's canvas is `size` × `ratio` device px).
 * `now` is the presentation clock (ms) the effects animate on, never the sim.
 */
export function drawTenDrop(ctx: CanvasRenderingContext2D, s: TenDropState, size: CanvasSize, ratio: number, now: number): void {
  const reduced = reducedMotion();
  const { scaleX: sx, scaleY: sy } = tdView(size);
  const m = observe(ctx, s, now);
  const fontReady = typeof document !== "undefined" && !!document.fonts?.check?.(FONT_PROBE);
  ctx.save();
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, size.width, size.height);
  const bg = boardCanvas(size.width, size.height, ratio);
  if (bg) ctx.drawImage(bg as CanvasImageSource, 0, 0, size.width, size.height);
  else {
    ctx.fillStyle = TOY_OAK;
    ctx.fillRect(0, 0, size.width, size.height);
  }

  // Target hit: the board warms gold through the hold (static under reduced motion).
  if (tenDropHolding(s)) {
    const f = Math.min(1, (s.tick - s.clearTick) / TD_CONFIG.clearHoldTicks);
    ctx.fillStyle = `rgba(255,214,110,${reduced ? 0.16 : 0.26 * (1 - f)})`;
    ctx.fillRect(0, 0, size.width, size.height);
  }
  // Overshoot reset: the frame flashes red for the sim's 24-tick reset window.
  const sinceReset = s.tick - s.resetTick;
  if (sinceReset >= 0 && sinceReset < 24) {
    ctx.strokeStyle = `rgba(224,80,60,${0.85 * (1 - sinceReset / 24)})`;
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, size.width - 6, size.height - 6);
  }

  const w = TILE_W * sx;
  const h = TILE_H * sy;
  // Ghosts of tapped tiles: a quick swell and fade where the tile was taken.
  for (const g of m.ghosts) {
    const f = Math.min(1, (now - g.at) / g.ms);
    const sprite = tileSprite(g.label, g.look, w, h, ratio, fontReady);
    if (!sprite) continue;
    const k = reduced || !g.grow ? 1 : 1 + 0.12 * f;
    const cx = (g.x + TILE_W / 2) * sx;
    const cy = (g.y + TILE_H / 2) * sy;
    ctx.globalAlpha = 1 - f;
    ctx.drawImage(sprite as CanvasImageSource, cx - (w / 2 + 2) * k, cy - (h / 2 + 2) * k, (w + 4) * k, (h + 4) * k);
  }
  ctx.globalAlpha = 1;

  // Live tiles, each over its collision rectangle.
  const solving = m.solveAt > 0 && now - m.solveAt < TD_SOLVE_MS;
  const solveT = solving ? now - m.solveAt : 0;
  const shine = shimmerBand();
  for (const t of s.tiles) {
    const refused = s.tick < t.shakeUntil;
    const dx = refused ? (s.tick % 4 < 2 ? -2 : 2) : 0;
    const x = (t.col * TD_COL_W + TILE_X + dx) * sx;
    const y = (t.y / 256) * sy;
    const sprite = tileSprite(tdLabel(t.tile), lookOf(t.tile, refused, t.gold), w, h, ratio, fontReady);
    if (sprite) ctx.drawImage(sprite as CanvasImageSource, x - 2, y - 2, w + 4, h + 4);
    if (!solving) continue;
    // Completion: the remaining tiles shimmer, lane by lane (a static gold rim when reduced).
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.min(11, h * 0.2));
    if (reduced) {
      ctx.strokeStyle = "#FFD978";
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      ctx.clip();
      const p = (solveT - t.col * 70) / 520;
      if (p > 0 && p < 1 && shine) {
        ctx.globalAlpha = 0.9;
        ctx.drawImage(shine as CanvasImageSource, x - w * 0.6 + p * w * 1.8, y - 2, w * 0.6, h + 4);
      }
      ctx.globalAlpha = Math.max(0, 0.5 * (1 - solveT / 900));
      ctx.strokeStyle = "#FFD978";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.restore();
  }

  // Clear / reset rings from the tapped tile.
  if (!reduced) {
    for (const r of m.rings) {
      const f = Math.min(1, (now - r.at) / TD_RING_MS);
      ctx.globalAlpha = 1 - f;
      ctx.strokeStyle = r.colour;
      ctx.lineWidth = 4 * (1 - f) + 1;
      ctx.beginPath();
      ctx.ellipse(r.x * sx, r.y * sy, (24 + 70 * f) * sx, (24 + 70 * f) * sy, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // A gold ten: "GOLD TEN" rises from the tile and fades (still, fading only, under reduced motion).
  for (const g of m.golds) {
    const f = Math.min(1, (now - g.at) / TD_GOLD_POP_MS);
    const rise = reduced ? 0 : 34 * f;
    const px = Math.min(TD_W - 52, Math.max(52, g.x)) * sx;
    const py = Math.max(16, g.y - 10 - rise) * sy;
    ctx.globalAlpha = f < 0.7 ? 1 : (1 - f) / 0.3;
    ctx.font = `800 ${Math.round(Math.max(13, Math.min(20, 17 * Math.min(sx, sy))))}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(58,34,0,0.85)";
    ctx.strokeText("GOLD TEN", px, py);
    ctx.fillStyle = TD_GOLD;
    ctx.fillText("GOLD TEN", px, py);
  }
  ctx.globalAlpha = 1;

  // Completion: brass confetti bursts from the last target's tile and falls inside the board.
  if (solving && !reduced) {
    const ox = m.solveFrom.x * sx;
    const oy = m.solveFrom.y * sy;
    const t = solveT / 1000;
    const fade = Math.max(0, 1 - solveT / 1000);
    for (let i = 0; i < SPARKS; i++) {
      const a = (i / SPARKS) * Math.PI * 2 + (i % 3) * 0.21;
      const v = 150 + ((i * 37) % 5) * 40;
      const px = ox + Math.cos(a) * v * t;
      const py = oy + Math.sin(a) * v * t + 260 * t * t;
      const sz = 3 + (i % 3);
      ctx.globalAlpha = fade;
      ctx.fillStyle = SPARK_COLOURS[i % SPARK_COLOURS.length]!;
      ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz * (i % 2 ? 1.6 : 1));
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** The centre of a tile in world px. */
const tileCentre = (t: { col: number; y: number }): ArcadeFxPoint => ({ x: t.col * TD_COL_W + TD_COL_W / 2, y: t.y / 256 + TILE_H / 2 });

/**
 * Tenfall's miss moment (polish batch W, 25 Oct 2026, display only): the shared arcade miss layer
 * (arcadeFx.renderer.ts `misses`: the faint red edge pulse and a small puff) on the two counters
 * the live round's sounds already read, a refused tile (`refused`, `tendrop.refused`) and an
 * overshoot reset (`resets`, `tendrop.reset`). No success events: Tenfall keeps its own rings,
 * shimmer and confetti. Live round only; reveals and replays draw drawTenDrop unchanged.
 */
export const TENDROP_MISS_FX: ArcadeFxSpec<TenDropState> = {
  game: "tendrop",
  world: "toybox",
  width: TD_W,
  height: TD_H,
  fit: "stretch",
  shake: false,
  events: [],
  misses: [
    {
      count: (s) => s.refused,
      // The refused tile is the one shaking most recently.
      at: (s) => {
        let best: TenDropState["tiles"][number] | null = null;
        for (const t of s.tiles) if (t.shakeUntil > s.tick && (!best || t.shakeUntil > best.shakeUntil)) best = t;
        return best ? tileCentre(best) : null;
      },
    },
    {
      count: (s) => s.resets,
      // The overshooting tile left the board on that tick: its last place on the previous frame.
      at: (s, before) => {
        if (!before) return null;
        const left = before.tiles.find((t) => !s.tiles.some((u) => u.id === t.id));
        return left ? tileCentre(left) : null;
      },
    },
  ],
};

/** The live round's frame: drawTenDrop unchanged, the shared miss layer on top (device px, stretched as tdView). */
export function drawTenDropLive(ctx: CanvasRenderingContext2D, s: TenDropState, size: CanvasSize, ratio: number, now: number): void {
  arcadeFx(ctx, TENDROP_MISS_FX, s, () => drawTenDrop(ctx, s, size, ratio, now), { width: size.width * ratio, height: size.height * ratio });
}

/**
 * Arena scene (15 Oct 2026, display only; arenaScene.renderer.ts): the cabinet goes on
 * below the play columns. A thick dark sill closes the columns at the world's bottom
 * edge; under it the frame's rails and a shaded oak backing run on to the arena box's
 * bottom, darker than the board and with no grooves, tiles or drop slots, so it reads
 * as the cabinet's lower panel, never as more of the columns.
 */
export function tenDropArenaScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const W = TD_W, H = TD_H;
  for (const side of sceneSides(view)) {
    ctx.fillStyle = TOY_WOOD_DEEP;
    ctx.fillRect(side.x, side.y, side.w, side.h);
  }
  const below = sceneBelow(view);
  if (!below) return;
  const SILL = 14;
  // Backing: oak in shadow, lit a little where the sill throws light down.
  sceneFill(ctx, below, H, view.bottom, [[0, "#7A5531"], [Math.min(1, 120 / below.h), "#5E4026"], [1, "#4A321D"]]);
  ctx.save();
  ctx.strokeStyle = TOY_OAK_GRAIN;
  ctx.lineWidth = 1;
  for (let i = 0, gy = H + SILL + 8; gy < view.bottom; gy += 12 + (i % 3) * 3, i++) {
    ctx.globalAlpha = 0.1 + (i % 4) * 0.03;
    ctx.beginPath();
    ctx.moveTo(below.x, gy);
    ctx.bezierCurveTo(below.x + below.w * 0.3, gy + (i % 2 ? 4 : -3), below.x + below.w * 0.7, gy + (i % 2 ? -4 : 3), below.x + below.w, gy + 1);
    ctx.stroke();
  }
  ctx.restore();
  // The frame's rails continue down the panel (the same x as the lane dividers and the outer frame).
  for (let col = 0; col <= TD_CONFIG.cols; col++) {
    const x = col * TD_COL_W;
    const w = col === 0 || col === TD_CONFIG.cols ? 8 : 6;
    const x0 = col === 0 ? x : col === TD_CONFIG.cols ? x - w : x - w / 2;
    ctx.fillStyle = TOY_WOOD_DARK;
    ctx.fillRect(x0, H, w, below.h);
    ctx.fillStyle = "rgba(255,226,170,0.22)";
    ctx.fillRect(x0, H, 1, below.h);
    ctx.fillStyle = "rgba(20,10,4,0.35)";
    ctx.fillRect(x0 + w - 1, H, 1, below.h);
  }
  // A soft shadow under the sill, then the sill itself with brass screws.
  const shade = ctx.createLinearGradient(0, H + SILL, 0, H + SILL + 18);
  shade.addColorStop(0, "rgba(20,10,4,0.5)");
  shade.addColorStop(1, "rgba(20,10,4,0)");
  ctx.fillStyle = shade;
  ctx.fillRect(below.x, H + SILL, below.w, 18);
  ctx.fillStyle = TOY_WOOD_DEEP;
  ctx.fillRect(below.x, H, below.w, SILL);
  ctx.fillStyle = TOY_WOOD_DARK;
  ctx.fillRect(below.x, H + 3, below.w, SILL - 6);
  ctx.fillStyle = "rgba(255,226,170,0.3)";
  ctx.fillRect(below.x, H + 3, below.w, 1);
  for (let col = 0; col <= TD_CONFIG.cols; col++) {
    const x = Math.min(W - 8, Math.max(8, col * TD_COL_W));
    ctx.fillStyle = TOY_BRASS;
    ctx.beginPath();
    ctx.arc(x, H + SILL / 2, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // The cabinet's foot rail along the arena box's bottom.
  if (below.h > SILL * 3) {
    ctx.fillStyle = TOY_WOOD_DEEP;
    ctx.fillRect(below.x, view.bottom - 8, below.w, 8);
    ctx.fillStyle = "rgba(255,226,170,0.16)";
    ctx.fillRect(below.x, view.bottom - 8, below.w, 1);
  }
}
