import { successFrame } from "./success.renderer";
import { whackGame, WHACK_COLS, WHACK_HOLES, WHACK_GAP_PX, WHACK_STATUS_WRONG, WHACK_STATUS_RETIRED, WHACK_STATUS_UP, WHACK_STATUS_HIT, type WhackState } from './whack';
import type { CanvasSize } from './engine';
import { artCanvas, artContext, type ArtCanvas } from './cache.renderer';
import { BONK_BODY, BONK_HAT, BONK_SPIKES } from './bonkShapes.renderer';
import { SCENE_TUCK, sceneBelow, sceneBlades, sceneFill, sceneSides, type ArenaSceneView } from './arenaScene.renderer';
import { arcadeFx, type ArcadeFxSpec } from './arcadeFx.renderer';

/**
 * Bonk art (Polish, 13 Oct 2026): a meadow with earth burrows, hard-hatted gophers and
 * hedgehogs. Presentation only. The meadow and every burrow are painted once per board
 * size into a cached layer; targets are cached sprites clipped to the original circular
 * footprint (radius 0.3 × cell), so what is drawn is exactly what the game counts.
 */
const PALETTE = {
  gold: '#F5B82E', red: '#E0503C', fur: '#8A7365', furDark: '#6B5547', muzzle: '#F0D7AC', ink: '#241C22',
  spines: '#B7A18C', spinesDark: '#7E6A58', shine: '#FFF4CF', hole: '#131114', rim: '#58493E',
  meadowTop: '#36552A', meadowBottom: '#27401F', earth: '#6E4C30', earthLight: '#8C6640', earthDark: '#4A3221',
};
/** Sprite kinds: 0 gold hat, 1 red hat, 2 hedgehog (bomb), 3 gopher without a hat, 4 gold hat alone, 5 red hat alone. */
const SPRITE_PX = 220;
const sprites = new Map<number, ArtCanvas>();
let backdrop: { key: string; canvas: ArtCanvas } | null = null;

/** Seeded PRNG for the baked texture (never Math.random). */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

interface Grid { cellW: number; cellH: number; cell: number; origin: (h: number) => { x: number; y: number } }
function grid(width: number, height: number): Grid {
  const gap = WHACK_GAP_PX;
  const cellW = (width - gap * (WHACK_COLS - 1)) / WHACK_COLS;
  const cellH = (height - gap * (WHACK_COLS - 1)) / WHACK_COLS;
  return {
    cellW, cellH, cell: Math.min(cellW, cellH),
    origin: (h: number) => ({ x: (h % WHACK_COLS) * (cellW + gap), y: Math.floor(h / WHACK_COLS) * (cellH + gap) }),
  };
}

/** Meadow + burrows, painted in board px (the caller scales). */
function paintMeadow(c: Ctx, width: number, height: number): void {
  const g = c.createLinearGradient(0, 0, 0, height);
  g.addColorStop(0, PALETTE.meadowTop); g.addColorStop(1, PALETTE.meadowBottom);
  c.fillStyle = g; c.fillRect(0, 0, width, height);
  const { cellW, cellH, origin } = grid(width, height);
  // Mown bands, one per row of burrows.
  c.fillStyle = '#FFFFFF';
  for (let row = 0; row < WHACK_COLS; row += 2) { c.globalAlpha = 0.035; c.fillRect(0, row * (cellH + WHACK_GAP_PX) - WHACK_GAP_PX / 2, width, cellH + WHACK_GAP_PX); }
  c.globalAlpha = 1;
  // Grass blades: two shades, short strokes leaning with the wind.
  const rnd = prng(0xb0b5);
  const blades = Math.round((width * height) / 70);
  c.lineCap = 'round'; c.lineWidth = 1;
  for (let i = 0; i < blades; i++) {
    const x = rnd() * width, y = rnd() * height, len = 2.5 + rnd() * 4, lean = (rnd() - 0.3) * 2.2;
    c.strokeStyle = rnd() < 0.55 ? '#4E7638' : '#1E3318';
    c.globalAlpha = 0.35 + rnd() * 0.3;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + lean, y - len); c.stroke();
  }
  c.globalAlpha = 1;
  const inHole = (x: number, y: number, pad: number) => {
    for (let h = 0; h < WHACK_HOLES; h++) {
      const o = origin(h), dx = (x - o.x - cellW / 2) / (cellW * 0.5 + pad), dy = (y - o.y - cellH / 2) / (cellH * 0.5 + pad);
      if (dx * dx + dy * dy < 1) return true;
    }
    return false;
  };
  // A few small, muted flowers only in the grass between burrows.
  const petals = ['#E9E4D2', '#E8C95A', '#D99BB4'];
  for (let i = 0, placed = 0; i < 400 && placed < 18; i++) {
    const x = rnd() * width, y = rnd() * height;
    if (inHole(x, y, 3)) continue;
    placed += 1;
    c.globalAlpha = 0.55;
    c.fillStyle = petals[placed % petals.length]!;
    for (let p = 0; p < 5; p++) { const a = (p / 5) * Math.PI * 2; c.beginPath(); c.arc(x + Math.cos(a) * 1.6, y + Math.sin(a) * 1.6, 1.1, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = '#F2C94C'; c.beginPath(); c.arc(x, y, 0.9, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
  // Burrows: earth mound, dark depth, lit front lip. All inside the cell.
  for (let h = 0; h < WHACK_HOLES; h++) {
    const o = origin(h), cx = o.x + cellW / 2, cy = o.y + cellH / 2;
    const rx = cellW * 0.47, ry = cellH * 0.45;
    c.fillStyle = 'rgba(0,0,0,0.22)';
    c.beginPath(); c.ellipse(cx, cy + cellH * 0.025, cellW * 0.5, cellH * 0.475, 0, 0, Math.PI * 2); c.fill();
    // Polish batch S: a soft cast shadow under each mound (inside its cell).
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.beginPath(); c.ellipse(cx, cy + cellH * 0.035, cellW * 0.5, cellH * 0.47, 0, 0, Math.PI * 2); c.fill();
    const mound = c.createLinearGradient(0, cy - cellH * 0.5, 0, cy + cellH * 0.5);
    mound.addColorStop(0, '#A87D50'); mound.addColorStop(0.3, PALETTE.earthLight); mound.addColorStop(0.6, PALETTE.earth); mound.addColorStop(1, '#3A2718');
    c.fillStyle = mound;
    c.beginPath(); c.ellipse(cx, cy, cellW * 0.495, cellH * 0.48, 0, 0, Math.PI * 2); c.fill();
    // Pebbles and crumbs on the mound ring.
    const pr = prng(0x5eed + h * 97);
    for (let p = 0; p < 9; p++) {
      const a = pr() * Math.PI * 2, rr = 0.48 + pr() * 0.012;
      const px = cx + Math.cos(a) * cellW * rr, py = cy + Math.sin(a) * cellH * (rr - 0.005);
      c.fillStyle = pr() < 0.5 ? '#A07A52' : '#3E2A1C'; c.globalAlpha = 0.8;
      c.beginPath(); c.arc(px, py, 0.8 + pr() * 0.9, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
    const depth = c.createRadialGradient(cx, cy + ry * 0.25, ry * 0.1, cx, cy, Math.max(rx, ry));
    depth.addColorStop(0, '#050405'); depth.addColorStop(0.7, PALETTE.hole); depth.addColorStop(1, '#2A1E15');
    c.fillStyle = depth;
    c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); c.fill();
    // Far wall in shadow, near lip catching the light.
    c.save(); c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); c.clip();
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(cx, cy - ry * 0.9, rx * 1.05, ry * 0.45, 0, 0, Math.PI * 2); c.fill();
    c.restore();
    c.strokeStyle = PALETTE.rim; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#D9AE76'; c.globalAlpha = 0.85; c.lineWidth = 1.8;
    c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, Math.PI * 0.12, Math.PI * 0.88); c.stroke();
    c.globalAlpha = 1;
    // Polish batch S (display only): depth inside the burrow, a soft occlusion band under the far rim
    // and a faint warm bounce on the near wall, all inside the hole's ellipse.
    c.save(); c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); c.clip();
    const occlusion = c.createRadialGradient(cx, cy + ry * 0.2, Math.min(rx, ry) * 0.55, cx, cy + ry * 0.2, Math.max(rx, ry) * 1.15);
    occlusion.addColorStop(0, 'rgba(0,0,0,0)'); occlusion.addColorStop(1, 'rgba(0,0,0,0.5)');
    c.fillStyle = occlusion; c.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
    c.fillStyle = 'rgba(196,154,104,0.07)';
    c.beginPath(); c.ellipse(cx, cy + ry * 0.82, rx * 0.8, ry * 0.22, 0, 0, Math.PI * 2); c.fill();
    c.restore();
    // The mound's top edge catching the light (a bright arc on its outer rim, upper half).
    c.strokeStyle = '#EDCB94'; c.globalAlpha = 0.85; c.lineWidth = 2.2;
    c.beginPath(); c.ellipse(cx, cy, cellW * 0.485, cellH * 0.468, 0, Math.PI * 1.12, Math.PI * 1.88); c.stroke();
    c.globalAlpha = 1;
  }
  // Polish batch S: one soft light from the top and a vignette round the meadow (static, baked once per size).
  const sun = c.createRadialGradient(width * 0.5, height * 0.42, 0, width * 0.5, height * 0.42, Math.min(width, height) * 0.5);
  sun.addColorStop(0, 'rgba(255,244,207,0.13)'); sun.addColorStop(1, 'rgba(255,244,207,0)');
  c.fillStyle = sun; c.fillRect(0, 0, width, height);
  const vignette = c.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.45, width / 2, height / 2, Math.hypot(width, height) * 0.62);
  vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,0,0,0.28)');
  c.fillStyle = vignette; c.fillRect(0, 0, width, height);
}

function ground(width: number, height: number, scale: number): ArtCanvas | null {
  const key = `${width}x${height}@${scale}`;
  if (backdrop?.key === key) return backdrop.canvas;
  const canvas = artCanvas(Math.ceil(width * scale), Math.ceil(height * scale)), c = canvas ? artContext(canvas) : null;
  if (!canvas || !c) return null;
  c.scale(scale, scale);
  paintMeadow(c, width, height);
  backdrop = { key, canvas };
  return canvas;
}

export function paintHat(c: Ctx, colour: string): void {
  c.save();
  const hat = new Path2D(BONK_HAT);
  c.fillStyle = colour; c.fill(hat);
  c.clip(hat);
  // Shading stays inside the hat's own outline; the main colour still dominates.
  const shade = c.createLinearGradient(0, 2, 0, 53);
  shade.addColorStop(0, 'rgba(255,255,255,0.18)'); shade.addColorStop(0.6, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,0.28)');
  c.fillStyle = shade; c.fillRect(0, 0, 100, 60);
  c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(0, 44, 100, 9);
  c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(2, 44, 96, 1.6);
  c.fillStyle = 'rgba(0,0,0,0.16)'; c.fillRect(56, 3, 2, 37);
  c.restore();
  c.strokeStyle = PALETTE.shine; c.lineWidth = 3; c.lineCap = 'round';
  c.beginPath(); c.moveTo(25, 38); c.quadraticCurveTo(26, 19, 43, 15); c.stroke();
  c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(36, 13, 3.2, 1.8, -0.5, 0, Math.PI * 2); c.fill();
}

export function paintGopher(c: Ctx): void {
  const body = new Path2D(BONK_BODY);
  c.fillStyle = PALETTE.fur; c.fill(body);
  c.save(); c.clip(body);
  const light = c.createRadialGradient(38, 40, 6, 50, 60, 62);
  light.addColorStop(0, 'rgba(255,240,220,0.22)'); light.addColorStop(0.6, 'rgba(0,0,0,0)'); light.addColorStop(1, 'rgba(30,18,12,0.38)');
  c.fillStyle = light; c.fillRect(0, 0, 100, 100);
  c.fillStyle = 'rgba(200,120,110,0.45)';
  for (const [x, y] of [[22, 33], [78, 33]] as const) { c.beginPath(); c.ellipse(x, y, 5, 4, 0, 0, Math.PI * 2); c.fill(); }
  c.restore();
  c.fillStyle = PALETTE.muzzle; c.beginPath(); c.ellipse(51, 75, 22, 17, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(220,120,110,0.35)';
  for (const x of [28, 74]) { c.beginPath(); c.ellipse(x, 68, 5, 3, 0, 0, Math.PI * 2); c.fill(); }
  c.strokeStyle = PALETTE.ink; c.lineWidth = 4; c.lineCap = 'round';
  c.beginPath(); c.moveTo(35, 58); c.lineTo(43, 58); c.moveTo(61, 58); c.lineTo(69, 58); c.stroke();
  c.fillStyle = PALETTE.ink; c.beginPath(); c.arc(51, 68, 5, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.arc(49.5, 66.5, 1.4, 0, Math.PI * 2); c.fill();
  c.lineWidth = 3; c.beginPath(); c.moveTo(43, 79); c.quadraticCurveTo(51, 88, 59, 79); c.stroke();
  c.fillStyle = '#FFFBF0'; c.fillRect(47.6, 82.6, 3, 4); c.fillRect(51.4, 82.6, 3, 4);
}

function paintHedgehog(c: Ctx): void {
  const spikes = new Path2D(BONK_SPIKES);
  c.fillStyle = PALETTE.spines; c.fill(spikes);
  c.save(); c.clip(spikes);
  c.strokeStyle = PALETTE.spinesDark; c.lineWidth = 1.6; c.globalAlpha = 0.7;
  for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; c.beginPath(); c.moveTo(50 + Math.cos(a) * 30, 52 + Math.sin(a) * 30); c.lineTo(50 + Math.cos(a) * 46, 52 + Math.sin(a) * 46); c.stroke(); }
  c.restore();
  c.fillStyle = PALETTE.fur; c.beginPath(); c.arc(50, 54, 32, 0, Math.PI * 2); c.fill();
  c.save(); c.beginPath(); c.arc(50, 54, 32, 0, Math.PI * 2); c.clip();
  const light = c.createRadialGradient(40, 42, 4, 50, 56, 36);
  light.addColorStop(0, 'rgba(255,240,220,0.2)'); light.addColorStop(1, 'rgba(30,18,12,0.35)');
  c.fillStyle = light; c.fillRect(0, 0, 100, 100);
  c.restore();
  c.fillStyle = PALETTE.muzzle; c.beginPath(); c.ellipse(49, 64, 19, 13, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = PALETTE.ink;
  for (const x of [43, 57]) { c.beginPath(); c.arc(x, 57, 3, 0, Math.PI * 2); c.fill(); }
  c.beginPath(); c.arc(50, 66, 4, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.7)';
  for (const x of [42, 56]) { c.beginPath(); c.arc(x, 56, 1, 0, Math.PI * 2); c.fill(); }
}

function target(kind: number): ArtCanvas | null {
  const cached = sprites.get(kind); if (cached) return cached;
  const canvas = artCanvas(SPRITE_PX, SPRITE_PX), c = canvas ? artContext(canvas) : null; if (!canvas || !c) return null;
  c.scale(SPRITE_PX / 100, SPRITE_PX / 100);
  if (kind >= 4) paintHat(c, kind === 4 ? PALETTE.gold : PALETTE.red);
  else {
    // Every silhouette is clipped inside the original circular target footprint.
    c.beginPath(); c.arc(50, 50, 49, 0, Math.PI * 2); c.clip();
    if (kind === 2) paintHedgehog(c);
    else { paintGopher(c); if (kind !== 3) paintHat(c, kind === 0 ? PALETTE.gold : PALETTE.red); }
  }
  sprites.set(kind, canvas); return canvas;
}
function drawTarget(c: CanvasRenderingContext2D, x: number, y: number, r: number, kind: number): void { const sprite = target(kind); if (sprite) c.drawImage(sprite, x - r, y - r, r * 2, r * 2); }

function pixelScale(ctx: CanvasRenderingContext2D): number {
  const t = typeof ctx.getTransform === 'function' ? ctx.getTransform() : null;
  const s = t ? Math.hypot(t.a, t.b) : 1;
  return Math.min(3, Math.max(1, Math.round(s * 4) / 4));
}

/** Draws the 4×4 board filling the canvas; the overlay grid shares the geometry. */
export function drawBonk(ctx: CanvasRenderingContext2D, state: WhackState, size: CanvasSize): void {
  const { cellW, cellH, cell, origin } = grid(size.width, size.height);
  ctx.save();
  ctx.clearRect(0, 0, size.width, size.height);
  const bg = ground(size.width, size.height, pixelScale(ctx));
  if (bg) ctx.drawImage(bg, 0, 0, size.width, size.height);
  else { ctx.fillStyle = PALETTE.meadowBottom; ctx.fillRect(0, 0, size.width, size.height); }

  for (let i = 0; i < state.status.length; i++) {
    const done = state.doneTick[i];
    const hole = state.schedule.hole[i];
    if (done !== undefined && hole !== undefined && state.status[i] === WHACK_STATUS_WRONG && state.tick - done < 12) {
      const { x, y } = origin(hole);
      ctx.fillStyle = "rgba(224,80,60,0.45)";
      ctx.beginPath();
      ctx.ellipse(x + cellW / 2, y + cellH / 2, cellW * .47, cellH * .45, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const { kind, hole, at: spawn } = state.schedule;
  const tick = state.tick;
  const r = cell * 0.3;
  for (let i = 0; i < state.next; i++) {
    const spawnTick = spawn[i], doneTick = state.doneTick[i], targetHole = hole[i], targetKind = kind[i];
    if (spawnTick === undefined || doneTick === undefined || targetHole === undefined || targetKind === undefined) continue;
    if (spawnTick > tick) continue;
    if (state.status[i] === WHACK_STATUS_RETIRED && tick - doneTick >= 10) continue;
    const { x, y } = origin(targetHole);
    const cx = x + cellW / 2;
    const cy = y + cellH / 2;
    ctx.save();
    if (state.status[i] === WHACK_STATUS_UP || state.status[i] === WHACK_STATUS_RETIRED) {
      // Targets rise out of (and sink into) the burrow: clipped to the hole, which
      // fully contains the full-size circular footprint.
      ctx.beginPath();
      ctx.ellipse(cx, cy, cellW * .47, cellH * .45, 0, 0, Math.PI * 2);
      ctx.clip();
    } else {
      ctx.beginPath();
      ctx.roundRect(x, y, cellW, cellH, Math.min(14, cell * 0.18));
      ctx.clip();
    }
    if (state.status[i] === WHACK_STATUS_UP) {
      const grow = Math.min(1, (tick - spawnTick + 1) / 7);
      // Polish batch S: a warm light rises in the burrow behind every popped target (the same for every
      // kind, so it never tells which to tap; inside the hole's clip).
      const glow = ctx.createRadialGradient(cx, cy + cellH * 0.08, 0, cx, cy + cellH * 0.08, cellW * 0.47);
      glow.addColorStop(0, `rgba(255,226,160,${0.62 * grow})`); glow.addColorStop(1, 'rgba(255,226,160,0)');
      ctx.fillStyle = glow; ctx.fillRect(x, y, cellW, cellH);
      drawTarget(ctx, cx, cy + (1 - grow) * cellH * 0.35, r * (0.4 + 0.6 * grow), targetKind);
    } else if (state.status[i] === WHACK_STATUS_RETIRED) {
      const fall = (tick - doneTick) / 10;
      ctx.globalAlpha = 1 - fall;
      drawTarget(ctx, cx, cy + fall * cellH * 0.5, r * (1 - 0.3 * fall), targetKind);
    } else if (state.status[i] === WHACK_STATUS_HIT) {
      const age = tick - doneTick;
      if (age < 10) {
        // Polish batch S: a gold glow inside the cell under the hit ring.
        const hitGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, cell * 0.5);
        hitGlow.addColorStop(0, 'rgba(245,184,46,0.55)'); hitGlow.addColorStop(1, 'rgba(245,184,46,0)');
        ctx.globalAlpha = 1 - age / 10;
        ctx.fillStyle = hitGlow; ctx.fillRect(x, y, cellW, cellH);
        ctx.strokeStyle = PALETTE.gold;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, r * (1 + age * 0.08), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = (1 - age / 10) * 0.6;
        ctx.strokeStyle = PALETTE.shine;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r * (0.86 + age * 0.06), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  let lastHit = -1;
  for (let i = 0; i < state.status.length; i++) if (state.status[i] === WHACK_STATUS_HIT && (lastHit < 0 || (state.doneTick[i] ?? 0) > (state.doneTick[lastHit] ?? 0))) lastHit = i;
  const hitHole = state.schedule.hole[lastHit] ?? 0, hitOrigin = origin(hitHole);
  successFrame(ctx, { id: 'whack', tick: state.tick, count: state.hits, misses: state.wrong + state.bombs + state.empty, colour: PALETTE.gold, width: size.width, height: size.height, eventTick: state.doneTick[lastHit], point: { x: hitOrigin.x + cellW / 2, y: hitOrigin.y + cellH / 2 - 8, shape: 'spark' }, enabled: lastHit >= 0 && state.schedule.kind[lastHit] === 0 });
  ctx.restore();
}

/**
 * End-of-run finale, drawn on the overlay canvas over the board (board px; `lift` px of
 * extra room above the board for the flying hats). Every burrow's gopher pops out
 * together and the hard hats fly up and spin away. Reduced motion: one still frame
 * (hats raised) that simply fades.
 */
export function drawBonkFinale(ctx: CanvasRenderingContext2D, ms: number, width: number, height: number, lift: number, reduced: boolean): void {
  const { cellW, cellH, cell, origin } = grid(width, height);
  const r = cell * 0.3;
  const fade = ms < 800 ? 1 : Math.max(0, 1 - (ms - 800) / 300);
  ctx.save();
  ctx.translate(0, lift);
  for (let h = 0; h < WHACK_HOLES; h++) {
    const o = origin(h), cx = o.x + cellW / 2, cy = o.y + cellH / 2;
    const delay = ((h * 7) % 5) * 14;
    const local = Math.max(0, ms - delay);
    const pop = reduced ? 1 : Math.min(1, local / 200);
    const overshoot = reduced ? 0 : Math.sin(Math.min(1, local / 320) * Math.PI) * 0.12;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.beginPath(); ctx.ellipse(cx, cy, cellW * .47, cellH * .45, 0, 0, Math.PI * 2); ctx.clip();
    drawTarget(ctx, cx, cy + (1 - pop) * cellH * 0.35 - overshoot * r, r * (0.4 + 0.6 * pop), 3);
    ctx.restore();
    // Hats: launched at the top of the pop, flying up and spinning away.
    const fly = reduced ? 0.25 : Math.max(0, (local - 150) / 650);
    const rise = reduced ? 0.35 * cell : (1 - (1 - Math.min(1, fly)) ** 2) * (cell * 1.4 + lift * 0.6);
    const spin = reduced ? 0 : (h % 2 === 0 ? 1 : -1) * Math.min(1, fly) * (0.3 + (h % 3) * 0.12);
    const drift = reduced ? 0 : (h % 2 === 0 ? 1 : -1) * fly * cell * 0.18;
    const hatAlpha = fade * (reduced ? 1 : fly < 0.75 ? 1 : Math.max(0, 1 - (fly - 0.75) / 0.25));
    if (hatAlpha <= 0) continue;
    const hy = cy + (1 - pop) * cellH * 0.35 - overshoot * r - rise;
    ctx.save();
    ctx.globalAlpha = hatAlpha;
    ctx.translate(cx + drift, hy - r * 0.5);
    ctx.rotate(spin);
    const sprite = target(h % 5 === 2 ? 5 : 4);
    if (sprite) ctx.drawImage(sprite, -r, -r * 0.5, r * 2, r * 2);
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Bonk's miss moment (Polish batch S, 25 Oct 2026, display only): the shared arcade layer's faint red
 * edge pulse on every counted mistake (a wrong-colour gopher, a hedgehog, an empty hole: the moments
 * that already play playWrong, whack.bomb and whack.emptyTap), with a puff over the hole where the
 * tap struck a target. Read only from counters the sim keeps; the board px are the effect's world.
 */
function bonkMissAt(state: WhackState, width: number, height: number): { x: number; y: number } | null {
  let last = -1;
  for (let i = 0; i < state.status.length; i++) if (state.status[i] === WHACK_STATUS_WRONG && (last < 0 || (state.doneTick[i] ?? 0) > (state.doneTick[last] ?? 0))) last = i;
  const hole = state.schedule.hole[last];
  if (last < 0 || hole === undefined || state.tick - (state.doneTick[last] ?? 0) > 6) return null;
  const { cellW, cellH, origin } = grid(width, height);
  const o = origin(hole);
  return { x: o.x + cellW / 2, y: o.y + cellH / 2 };
}
function bonkFxSpec(width: number, height: number): ArcadeFxSpec<WhackState> {
  return {
    game: 'whack', world: 'realworld', width, height, events: [], shake: false, fit: 'world',
    misses: [{ count: (s) => s.wrong + s.bombs + s.empty, at: (s) => bonkMissAt(s, width, height) }],
  };
}
let bonkSpec: ArcadeFxSpec<WhackState> | null = null;
/** drawBonk through the shared arcade layer (misses only; Bonk's successes keep their own art). */
export function drawBonkWithFx(ctx: CanvasRenderingContext2D, state: WhackState, size: CanvasSize): void {
  if (!bonkSpec || bonkSpec.width !== size.width || bonkSpec.height !== size.height) bonkSpec = bonkFxSpec(size.width, size.height);
  arcadeFx(ctx, bonkSpec, state, () => drawBonk(ctx, state, size), size);
}

export const whackArtGame = { ...whackGame, draw: drawBonkWithFx };

/**
 * Arena scene (15 Oct 2026, display only; arenaScene.renderer.ts): the meadow's grass
 * continues past the 4×4 field to the arena box's edges. Grass and a few flowers only:
 * no burrows, gophers or anything that moves. The world is the square board (0–1), so
 * this paints in CSS px from the board's top-left corner.
 */
export function bonkArenaScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  const k = view.scale;
  ctx.scale(1 / k, 1 / k);
  const px = { left: view.left * k, right: view.right * k, top: view.top * k, bottom: view.bottom * k, side: k };
  for (const side of sceneSides(view)) {
    const r = { x: side.x * k, y: side.y * k, w: side.w * k, h: side.h * k };
    sceneFill(ctx, r, 0, px.side, [[0, PALETTE.meadowTop], [1, PALETTE.meadowBottom]]);
    sceneBlades(ctx, r, 0xb0b6, ["rgba(78,118,56,0.5)", "rgba(30,51,24,0.5)"], 70, 5);
  }
  // 17 Oct 2026 (item 28): the field is centred on the play screen; the meadow runs on above it, settling
  // darker towards the rule box (view.boxTop is the arena box's top, in world units).
  const boxTop = view.boxTop ?? 0;
  if (boxTop < -0.01) {
    const a = { x: px.left, y: boxTop * k, w: px.right - px.left, h: (-boxTop + SCENE_TUCK) * k };
    sceneFill(ctx, a, a.y, a.y + a.h, [[0, "#1C3016"], [1, PALETTE.meadowTop]]);
    sceneBlades(ctx, a, 0xb0b8, ["rgba(78,118,56,0.4)", "rgba(30,51,24,0.45)"], 70, 5);
  }
  const below = sceneBelow(view);
  if (!below) return;
  const r = { x: below.x * k, y: below.y * k, w: below.w * k, h: below.h * k };
  // 17 Oct 2026 (item 27, display only, static): the meadow under the field starts in the field's own
  // green (no step at the join), then settles darker into a soft band of soil with a few small stones;
  // grass tufts and a few faded flowers on top. Darker and fainter than the field, never a target.
  const soilAt = r.y + Math.max(r.h * 0.55, Math.min(r.h, 90));
  sceneFill(ctx, r, r.y, r.y + Math.max(r.h, 1), [
    [0, "#2C4723"],
    [Math.min(0.5, 40 / Math.max(r.h, 1)), "#243D1C"],
    [Math.min(0.95, (soilAt - r.y) / Math.max(r.h, 1)), "#1C3016"],
    [1, "#1A2414"],
  ]);
  if (soilAt < r.y + r.h) {
    const soil = { x: r.x, y: soilAt, w: r.w, h: r.y + r.h - soilAt };
    sceneFill(ctx, soil, soil.y, soil.y + Math.max(soil.h, 1), [[0, "rgba(58,42,26,0)"], [Math.min(1, 24 / Math.max(soil.h, 1)), "rgba(58,42,26,0.28)"], [1, "rgba(40,30,20,0.42)"]]);
    const stones = Math.max(3, Math.round(soil.w / 55));
    for (let i = 0; i < stones; i++) {
      const h = prng(0x570e + i);
      const x = soil.x + 8 + h() * (soil.w - 16), y = soil.y + 10 + h() * Math.max(0, soil.h - 16);
      const rx = 2.5 + h() * 3, ry = rx * (0.55 + h() * 0.2);
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = i % 2 ? "#6F6A60" : "#5E5A52";
      ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath(); ctx.ellipse(x - rx * 0.3, y - ry * 0.35, rx * 0.4, ry * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  sceneBlades(ctx, r, 0xb0b7, ["rgba(78,118,56,0.45)", "rgba(30,51,24,0.5)", "rgba(78,118,56,0.3)"], 70, 5);
  // Soft tufts: a few taller clumps of blades.
  ctx.lineCap = "round";
  ctx.lineWidth = 1;
  const tufts = Math.max(4, Math.round(r.w / 45));
  for (let i = 0; i < tufts; i++) {
    const h = prng(0x7f75 + i);
    const x = r.x + 6 + h() * (r.w - 12), y = r.y + 14 + h() * Math.max(0, Math.min(r.h, soilAt - r.y) - 16);
    ctx.strokeStyle = "rgba(110,156,76,0.42)";
    for (let b = -2; b <= 2; b++) { ctx.beginPath(); ctx.moveTo(x + b, y); ctx.lineTo(x + b * 2.2, y - 6 - (2 - Math.abs(b)) * 1.5); ctx.stroke(); }
  }
  const petals = ["#E9E4D2", "#E8C95A", "#D99BB4"];
  const flowers = Math.round((r.w * r.h) / 7000);
  for (let i = 0; i < flowers; i++) {
    const h = prng(0xf10e + i);
    const x = r.x + 6 + h() * (r.w - 12), y = r.y + 10 + h() * Math.max(0, r.h - 16);
    ctx.globalAlpha = 0.38;
    ctx.fillStyle = petals[i % petals.length]!;
    for (let p = 0; p < 5; p++) { const a = (p / 5) * Math.PI * 2; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 1.6, y + Math.sin(a) * 1.6, 1.1, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = "#F2C94C"; ctx.beginPath(); ctx.arc(x, y, 0.9, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
