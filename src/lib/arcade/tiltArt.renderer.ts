/**
 * Tilt in the Toybox world: a wooden labyrinth disc on an oak board. Render
 * only; mirrors the sim's private geometry (FP, centre, wall test, pit square
 * half-size cs/4) and reads state without writing it.
 */
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "./engine";
import { drawArtSprite } from "./sprites.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { TILT_FX } from "./arcadeFxGames.renderer";
import { TILT_DISC_R, TILT_MAX_MAZES, TILT_WORLD_H, TILT_WORLD_W, tiltBandGame, tiltGame, tiltRev2Game, tiltStarPoint, tiltTotalStars, tiltTunecGame, tiltTargetGame, tiltStrictGame, TILT_REV, TILT_REV_BAND, TILT_REV_TUNEC, TILT_REV_TARGET, TILT_REV_STRICT, type Maze, type TiltState } from "./tilt";
import {
  TOY_BRASS, TOY_BRASS_DARK, TOY_INK, TOY_OAK_LIGHT, TOY_TABLE, TOY_TABLE_LIT, TOY_WOOD_DARK,
  toyBoard, toyChangeAge, toyGrain, toyMarble,
} from "./toybox.renderer";
import { reducedMotion } from "./art.renderer";
import { arcadeReducedEffects } from "@/lib/fx/lowEnd";
import { artCanvas, artContext, deviceLayer, type ArtCanvas } from "./cache.renderer";
import type { ArenaSceneView } from "./arenaScene.renderer";
import { tiltFill } from "./arenaFills.renderer";

const FP = 256;
const CX = 220;
const CY = 254;
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];
export const TILT_MARBLE_BLUE = "#3E7BFA";
export const TILT_MARBLE_RED = "#E8394A";
/** tiltRev 2: the second marble and its cup. */
export const TILT_MARBLE_AMBER = "#F29A1F";
const CUP_AMBER_GLASS = "#FFD99A";
const STAR_GOLD = "#FFD23F";
const STAR_EDGE = "#9A6A10";
const STRIP = "#8C5A30";
const STRIP_TOP = "#B9824C";
const CUP_GLASS = "#C4E9FA";
const CUP_BLUE = "#83C9EA";
const CUP_GLOW = "rgba(151,218,249,0.4)";

function openNeighbour(m: Maze, c: number, d: number): number {
  const i = (c % m.n) + DX[d]!;
  const j = Math.trunc(c / m.n) + DY[d]!;
  if (i < 0 || j < 0 || i >= m.n || j >= m.n) return -1;
  const nc = j * m.n + i;
  if (!m.inside[nc]) return -1;
  const wall = d === 0 ? m.wallR[c] : d === 1 ? m.wallD[c] : d === 2 ? m.wallR[nc] : m.wallD[nc];
  return wall ? -1 : nc;
}

function edge(ctx: CanvasRenderingContext2D, m: Maze, c: number, d: number, o: number, dx = 0, dy = 0) {
  const cs = m.cs / FP;
  const x = (c % m.n) * cs - o + dx;
  const y = Math.trunc(c / m.n) * cs - o + dy;
  if (d === 0) { ctx.moveTo(x + cs, y); ctx.lineTo(x + cs, y + cs); }
  else if (d === 1) { ctx.moveTo(x, y + cs); ctx.lineTo(x + cs, y + cs); }
  else if (d === 2) { ctx.moveTo(x, y); ctx.lineTo(x, y + cs); }
  else { ctx.moveTo(x, y); ctx.lineTo(x + cs, y); }
}

/**
 * The cup just beyond an exit edge, in disc-centred maze coordinates. Original
 * rounds keep the marble-sized cup; rev 2 draws a larger cup (rim + colour) so
 * marble, dark hole and cup never read as three similar dots.
 */
function cupOf(m: Maze, o: number, exit = m.exit, exitDir = m.exitDir, big = false) {
  const cs = m.cs / FP;
  const cx = (exit % m.n) * cs + cs / 2 - o + (DX[exitDir]! * cs) / 2;
  const cy = Math.trunc(exit / m.n) * cs + cs / 2 - o + (DY[exitDir]! * cs) / 2;
  const r = big ? Math.min(cs * 0.55, (m.br / FP) * 1.75) : m.br / FP;
  return { x: cx + DX[exitDir]! * r, y: cy + DY[exitDir]! * r, r };
}

/** tiltRev 2 cup: dark brass rim, coloured glass, a deep centre and a bright lip, in the marble's colour. */
function drawBigCup(ctx: CanvasRenderingContext2D, cup: { x: number; y: number; r: number }, colour: string, glass: string, filled: boolean): void {
  ctx.fillStyle = TOY_BRASS_DARK;
  ctx.beginPath();
  ctx.arc(cup.x, cup.y, cup.r + 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = TOY_BRASS;
  ctx.beginPath();
  ctx.arc(cup.x, cup.y, cup.r + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(cup.x, cup.y, cup.r - 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = glass;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(cup.x, cup.y, cup.r * 0.62, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (!filled) {
    ctx.fillStyle = "rgba(20,10,4,0.55)";
    ctx.beginPath();
    ctx.arc(cup.x, cup.y + cup.r * 0.08, cup.r * 0.42, 0, Math.PI * 2);
    ctx.fill();
  }
  // Polish G: a glass shine on the upper-left inside the cup, and a lit brass lip.
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cup.x, cup.y, cup.r * 0.72, Math.PI * 1.05, Math.PI * 1.45);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,240,190,0.6)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(cup.x, cup.y, cup.r + 1.8, Math.PI * 0.95, Math.PI * 1.6);
  ctx.stroke();
}

/**
 * Polish G: the oak disc face (grain and growth rings) is one cached sprite,
 * drawn in the disc's rotating frame; a screen-fixed lamp gloss goes on top in
 * drawWorld, so the light stays put while the board turns.
 */
const DISC_SCALE = 2;
let discSprite: ArtCanvas | null | undefined;
export function paintDisc(c: CanvasRenderingContext2D): void {
  const r = TILT_DISC_R;
  c.fillStyle = TOY_OAK_LIGHT;
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  c.fill();
  c.save();
  c.beginPath();
  c.arc(0, 0, r, 0, Math.PI * 2);
  c.clip();
  toyGrain(c, -r, -r, r * 2, r * 2, 12);
  // Faint growth rings from an off-centre heart, and a few darker flecks.
  c.strokeStyle = "rgba(150,100,50,0.12)";
  c.lineWidth = 1;
  for (let k = 1; k < 9; k++) {
    c.beginPath();
    c.ellipse(-r * 0.9, r * 0.2, k * 26, k * 20, 0.3, 0, Math.PI * 2);
    c.stroke();
  }
  c.fillStyle = "rgba(110,70,35,0.25)";
  for (let k = 0; k < 40; k++) {
    const a = k * 2.399, d = (k * 37) % r;
    c.fillRect(Math.cos(a) * d, Math.sin(a) * d, 2, 0.8);
  }
  c.restore();
}
function drawDiscSurface(ctx: CanvasRenderingContext2D): void {
  if (discSprite === undefined) {
    const size = Math.ceil((TILT_DISC_R * 2 + 2) * DISC_SCALE);
    const canvas = artCanvas(size, size);
    const c = canvas && (artContext(canvas) as CanvasRenderingContext2D | null);
    if (canvas && c) {
      c.scale(DISC_SCALE, DISC_SCALE);
      c.translate(TILT_DISC_R + 1, TILT_DISC_R + 1);
      paintDisc(c);
    }
    discSprite = canvas && c ? canvas : null;
  }
  if (discSprite) ctx.drawImage(discSprite as CanvasImageSource, -TILT_DISC_R - 1, -TILT_DISC_R - 1, TILT_DISC_R * 2 + 2, TILT_DISC_R * 2 + 2);
  else paintDisc(ctx);
}

/** The disc's carved groove and bevelled rim, about the disc's centre (static: in the cached board layer). */
function drawDiscBed(ctx: CanvasRenderingContext2D): void {
  // Polish G: the disc sits in a carved groove in the board, casting a soft shadow down-right.
  const groove = ctx.createRadialGradient(3, 4, TILT_DISC_R - 4, 3, 4, TILT_DISC_R + 12);
  groove.addColorStop(0, "rgba(40,20,6,0.55)");
  groove.addColorStop(1, "rgba(40,20,6,0)");
  ctx.fillStyle = groove;
  ctx.beginPath();
  ctx.arc(3, 4, TILT_DISC_R + 12, 0, Math.PI * 2);
  ctx.fill();
  // Disc rim: darker wood ring just outside the sim's disc, bevelled (lit upper left).
  ctx.fillStyle = TOY_WOOD_DARK;
  ctx.beginPath();
  ctx.arc(0, 0, TILT_DISC_R + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,220,170,0.35)";
  ctx.beginPath();
  ctx.arc(0, 0, TILT_DISC_R + 1.2, Math.PI * 0.9, Math.PI * 1.7);
  ctx.stroke();
}

/** tiltRev 2 bonus star: a gold five-point star filling most of its dead-end cell. */
function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-rot);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fillStyle = STAR_GOLD;
  ctx.fill();
  ctx.strokeStyle = STAR_EDGE;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
}

function walls(ctx: CanvasRenderingContext2D, m: Maze, o: number, dx: number, dy: number) {
  ctx.beginPath();
  for (let c = 0; c < m.n * m.n; c++) {
    if (!m.inside[c]) continue;
    for (let d = 0; d < 4; d++) {
      if (c === m.exit && d === m.exitDir) continue;
      // tiltRev 2: the amber marble's exit is open too (it was drawn shut, so its cup looked sealed off).
      if (c === m.exit2 && d === m.exitDir2) continue;
      if (openNeighbour(m, c, d) >= 0) continue;
      const i = (c % m.n) + DX[d]!;
      const j = Math.trunc(c / m.n) + DY[d]!;
      const nIn = i >= 0 && j >= 0 && i < m.n && j < m.n && m.inside[j * m.n + i] === 1;
      if (nIn && d >= 2) continue;
      edge(ctx, m, c, d, o, dx, dy);
    }
  }
  ctx.stroke();
}

function padlock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, open: number) {
  ctx.save();
  ctx.strokeStyle = TOY_BRASS_DARK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y - w * 0.25 - open * w * 0.25, w * 0.32, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = TOY_BRASS;
  ctx.fillRect(x - w / 2, y - w * 0.25, w, w * 0.7);
  ctx.fillStyle = TOY_INK;
  ctx.fillRect(x - 1, y, 2, w * 0.25);
  ctx.restore();
}

/** The maze's pits, in the disc's rotating frame. */
function drawPits(ctx: CanvasRenderingContext2D, m: Maze): void {
  const cs = m.cs / FP;
  const o = (m.n * cs) / 2;
  // Full square collision footprint; rounded bevel stays inside the dark cut.
  const pr = cs / 4;
  for (const p of m.pits) {
    const x = (p % m.n) * cs + cs / 2 - o;
    const y = Math.trunc(p / m.n) * cs + cs / 2 - o;
    ctx.fillStyle = "#120A05";
    ctx.fillRect(x - pr, y - pr, pr * 2, pr * 2);
    // Polish G: depth inside the square: black at the centre, warm wood showing at the sides.
    const deep = ctx.createRadialGradient(x, y, 0, x, y, pr * 1.3);
    deep.addColorStop(0, "#000000");
    deep.addColorStop(0.6, "#0E0703");
    deep.addColorStop(1, "#3A2210");
    ctx.fillStyle = deep;
    ctx.fillRect(x - pr, y - pr, pr * 2, pr * 2);
    ctx.strokeStyle = TOY_WOOD_DARK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x - pr + 0.75, y - pr + 0.75, pr * 2 - 1.5, pr * 2 - 1.5, 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,230,190,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - pr + 2, y + pr - 0.5);
    ctx.lineTo(x + pr - 2, y + pr - 0.5);
    ctx.stroke();
  }
}

/** Raised wooden strips with a slight shadow, in the disc's rotating frame. */
function drawStrips(ctx: CanvasRenderingContext2D, m: Maze, lite: boolean): void {
  const o = (m.n * (m.cs / FP)) / 2;
  // Reduced effects (lib/fx/lowEnd.ts, slow devices only): the strips keep their shadow, body and
  // top edge; the soft outer shadow and the faint highlight are skipped (the strips' footprint is unchanged).
  ctx.lineCap = "round";
  if (!lite) {
    ctx.strokeStyle = "rgba(30,15,5,0.22)";
    ctx.lineWidth = 4;
    walls(ctx, m, o, 2, 2.6);
  }
  ctx.strokeStyle = "rgba(30,15,5,0.35)";
  ctx.lineWidth = 3;
  walls(ctx, m, o, 1.2, 1.6);
  ctx.strokeStyle = STRIP;
  ctx.lineWidth = 3;
  walls(ctx, m, o, 0, 0);
  ctx.strokeStyle = STRIP_TOP;
  ctx.lineWidth = 1;
  walls(ctx, m, o, -0.5, -0.5);
  if (!lite) {
    ctx.strokeStyle = "rgba(255,236,200,0.35)";
    ctx.lineWidth = 0.5;
    walls(ctx, m, o, -0.9, -0.9);
  }
}

/** Reduced effects only: the disc, pits and strips of one maze at the canvas's scale (null without offscreen canvases). */
const mazeSprites = new WeakMap<Maze, { k: number; sprite: ArtCanvas | null }>();
function mazeSprite(ctx: CanvasRenderingContext2D, m: Maze): ArtCanvas | null {
  const t = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  const k = Math.round(Math.max(0.25, Math.min(2, t ? Math.hypot(t.a, t.b) : 1)) * 100) / 100;
  const old = mazeSprites.get(m);
  if (old && old.k === k) return old.sprite;
  const size = Math.ceil((TILT_DISC_R * 2 + 2) * k);
  const canvas = artCanvas(size, size);
  const c = canvas && (artContext(canvas) as CanvasRenderingContext2D | null);
  if (canvas && c) {
    c.scale(size / (TILT_DISC_R * 2 + 2), size / (TILT_DISC_R * 2 + 2));
    c.translate(TILT_DISC_R + 1, TILT_DISC_R + 1);
    c.save();
    c.beginPath();
    c.arc(0, 0, TILT_DISC_R + 1, 0, Math.PI * 2);
    c.clip();
    paintDisc(c);
    drawPits(c, m);
    drawStrips(c, m, true);
    c.restore();
  }
  const sprite = canvas && c ? canvas : null;
  mazeSprites.set(m, { k, sprite });
  return sprite;
}

/** The maze drawing through the shared success layer (presentation only). */
function draw(ctx: CanvasRenderingContext2D, state: TiltState, size: CanvasSize): void {
  arcadeFx(ctx, TILT_FX, state, () => drawWorld(ctx, state, size), size);
}

function drawWorld(ctx: CanvasRenderingContext2D, state: TiltState, size: CanvasSize): void {
  const scale = Math.min(size.width / TILT_WORLD_W, size.height / TILT_WORLD_H);
  const ox = (size.width - TILT_WORLD_W * scale) / 2;
  const oy = (size.height - TILT_WORLD_H * scale) / 2;
  const m = state.list[Math.min(state.level, state.list.length - 1)]!;
  const cs = m.cs / FP;
  const o = (m.n * cs) / 2;
  const cup = cupOf(m, o);
  // Rev 2 remembers both cups and which marbles were still out, so whichever finished last sinks into its own cup.
  const finish = toyChangeAge(
    ctx,
    "tilt-mazes",
    state.mazes,
    state.rev
      ? {
          blue: cupOf(m, o, m.exit, m.exitDir, true),
          amber: state.b && (m.exit2 ?? -1) >= 0 ? cupOf(m, o, m.exit2!, m.exitDir2!, true) : null,
          aHome: !!state.aHome,
          bHome: !!state.bHome,
          r: m.br / FP,
        }
      : cup,
  );
  const gate = toyChangeAge(ctx, "tilt-gate", state.level * 2 + state.gate);
  const rot = (state.angle / 65536) * Math.PI * 2;

  // Low-end performance (16 Oct 2026): the tabletop, board and the disc's groove and rim never move,
  // so they are one cached layer (cache.renderer deviceLayer; the same pixels). The maze text above
  // the groove is drawn after it, as before (they never overlap: the text ends 8 px above the groove).
  deviceLayer(ctx, `tilt-board:${ox},${oy},${scale}`, (c) => {
    // 17 Oct 2026 (screen fill-ins, display only): no table or rim round the board inside the canvas; any
    // sub-pixel margin is the board's edge oak, so the world meets the scene's oak with no dark line.
    c.fillStyle = "#9A7347";
    c.fillRect(0, 0, c.canvas.width, c.canvas.height);
    c.save();
    c.translate(ox, oy);
    c.scale(scale, scale);
    toyBoard(c, 0, 0, TILT_WORLD_W, TILT_WORLD_H, 10, false);
    c.translate(CX, CY);
    drawDiscBed(c);
    c.restore();
  });
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);

  ctx.fillStyle = TOY_INK;
  ctx.font = "600 16px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.fillText(`Maze ${Math.min(TILT_MAX_MAZES, state.mazes + 1)} / ${TILT_MAX_MAZES}`, 14, 26);
  if (state.rev) {
    ctx.textAlign = "right";
    ctx.fillText(`Stars ${state.stars ?? 0} / ${tiltTotalStars(state)}`, TILT_WORLD_W - 14, 26);
    ctx.textAlign = "left";
  }

  ctx.translate(CX, CY);
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, TILT_DISC_R + 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.rotate(rot);
  // Reduced effects (lib/fx/lowEnd.ts, slow devices only): the disc, its pits and its strips are one
  // sprite per maze, drawn rotated in one copy (no gloss; cups and stars then sit over the strips).
  // The sprite is the same geometry at the canvas's scale: nothing that collides moves.
  const baked = arcadeReducedEffects() ? mazeSprite(ctx, m) : null;
  if (baked) ctx.drawImage(baked as CanvasImageSource, -TILT_DISC_R - 1, -TILT_DISC_R - 1, TILT_DISC_R * 2 + 2, TILT_DISC_R * 2 + 2);
  else {
    drawDiscSurface(ctx);
    ctx.save();
    ctx.rotate(-rot);
    const gloss = ctx.createRadialGradient(-TILT_DISC_R * 0.45, -TILT_DISC_R * 0.5, 10, 0, 0, TILT_DISC_R);
    gloss.addColorStop(0, "rgba(255,246,220,0.28)");
    gloss.addColorStop(0.6, "rgba(255,246,220,0)");
    gloss.addColorStop(1, "rgba(60,30,10,0.22)");
    ctx.fillStyle = gloss;
    ctx.beginPath();
    ctx.arc(0, 0, TILT_DISC_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawPits(ctx, m);
  }

  if (state.rev) {
    // Rev 2: bigger rimmed cups in each marble's colour; a stars in dead-end detours.
    drawBigCup(ctx, cupOf(m, o, m.exit, m.exitDir, true), TILT_MARBLE_BLUE, CUP_GLASS, !!state.aHome);
    if ((m.exit2 ?? -1) >= 0) drawBigCup(ctx, cupOf(m, o, m.exit2!, m.exitDir2!, true), TILT_MARBLE_AMBER, CUP_AMBER_GLASS, !!state.bHome);
    (m.stars ?? []).forEach((_c, k) => {
      if ((state.starGot ?? [])[k]) return;
      // tiltRev 4 stars sit at their own point (a hole's mouth); earlier ones at their cell's centre.
      const p = tiltStarPoint(m, k);
      drawStar(ctx, p.x / FP - o, p.y / FP - o, cs * 0.3, rot);
    });
  } else {
  // Blue glass cup: the soft glow is contained in the existing outer ring.
  const cupGlow = ctx.createRadialGradient(cup.x, cup.y, cup.r * 0.5, cup.x, cup.y, cup.r + 2);
  cupGlow.addColorStop(0, CUP_GLASS);
  cupGlow.addColorStop(1, CUP_GLOW);
  ctx.fillStyle = cupGlow;
  ctx.beginPath();
  ctx.arc(cup.x, cup.y, cup.r + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = CUP_GLASS;
  ctx.beginPath();
  ctx.arc(cup.x, cup.y, cup.r + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = TOY_BRASS;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = CUP_BLUE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cup.x, cup.y, Math.max(1, cup.r - 1), 0, Math.PI * 2);
  ctx.stroke();
  }

  if (!baked) drawStrips(ctx, m, false);

  if (m.crevice >= 0) {
    const lx = (m.lock % m.n) * cs + cs / 2 - o;
    const ly = Math.trunc(m.lock / m.n) * cs + cs / 2 - o;
    const w = Math.max(6, cs * 0.34);
    const anim = state.gate === 1 && !reducedMotion() && gate.age < 450 ? gate.age / 450 : state.gate === 1 ? 1 : 0;
    if (state.gate === 0) {
      ctx.strokeStyle = TOY_BRASS;
      ctx.lineWidth = 4;
      ctx.beginPath();
      edge(ctx, m, m.crevice, m.gateDir, o);
      ctx.stroke();
      padlock(ctx, lx, ly, w, 0);
    } else if (anim < 1) {
      // Latch swings open about its first end and fades.
      const x = (m.crevice % m.n) * cs - o;
      const y = Math.trunc(m.crevice / m.n) * cs - o;
      const d = m.gateDir;
      const ax = d === 0 ? x + cs : x;
      const ay = d === 1 ? y + cs : y;
      const horizontal = d === 1 || d === 3;
      ctx.save();
      ctx.globalAlpha = 1 - anim;
      ctx.translate(ax, ay);
      ctx.rotate((horizontal ? -1 : 1) * anim * (Math.PI / 2));
      ctx.strokeStyle = TOY_BRASS;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      if (horizontal) ctx.lineTo(cs, 0);
      else ctx.lineTo(0, cs);
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1 - anim;
      padlock(ctx, lx, ly, w, anim);
      ctx.globalAlpha = 1;
    }
    if (state.chaser) toyMarble(ctx, state.chaser.x / FP - o, state.chaser.y / FP - o, m.br / FP, TILT_MARBLE_RED, -rot, 2);
  }

  // Finishing a maze: the marble sinks into the previous maze's cup.
  type Cup = { x: number; y: number; r: number };
  type Rev2Finish = { blue: Cup; amber: Cup | null; aHome: boolean; bHome: boolean; r: number };
  const prev2 = state.rev ? (finish.before as Rev2Finish | undefined) : undefined;
  if (prev2 && finish.age < 400 && !reducedMotion()) {
    // Rev 2: each marble that was still rolling when the maze ended (the last one home) sinks into its own cup.
    const u = finish.age / 400;
    ctx.globalAlpha = 1 - u;
    if (!prev2.aHome) toyMarble(ctx, prev2.blue.x, prev2.blue.y, prev2.r * (1 - 0.6 * u), TILT_MARBLE_BLUE, -rot);
    if (prev2.amber && !prev2.bHome) toyMarble(ctx, prev2.amber.x, prev2.amber.y, prev2.r * (1 - 0.6 * u), TILT_MARBLE_AMBER, -rot, 3);
    ctx.globalAlpha = 1;
  }
  const prevCup = state.rev ? undefined : (finish.before as Cup | undefined);
  if (prevCup && finish.age < 400 && !reducedMotion()) {
    const u = finish.age / 400;
    ctx.globalAlpha = 1 - u;
    toyMarble(ctx, prevCup.x, prevCup.y, prevCup.r * (1 - 0.6 * u), TILT_MARBLE_BLUE, -rot);
    ctx.globalAlpha = 1;
  }
  if (state.rev) {
    // Rev 2: a marble in its cup rests at the cup's centre; the amber marble is code art.
    const mr = m.br / FP;
    if (state.b) {
      const cup = cupOf(m, o, m.exit2!, m.exitDir2!, true);
      const at = state.bHome ? cup : { x: state.b.x / FP - o, y: state.b.y / FP - o };
      if (!(state.ended === 1 && state.mazes >= TILT_MAX_MAZES)) toyMarble(ctx, at.x, at.y, mr, TILT_MARBLE_AMBER, -rot, 3);
    }
    if (state.aHome) {
      const cup = cupOf(m, o, m.exit, m.exitDir, true);
      toyMarble(ctx, cup.x, cup.y, mr, TILT_MARBLE_BLUE, -rot);
    }
  }
  if (!(state.ended === 1 && state.mazes >= TILT_MAX_MAZES) && !state.aHome) {
    // Art pilot (Toybox): marble sprite fills the marble's collision circle; code art when absent.
    const mx = state.x / FP - o, my = state.y / FP - o, mr = m.br / FP;
    if (!drawArtSprite(ctx, "toybox", "marble", mx - mr, my - mr, mr * 2, mr * 2, { angle: -rot })) toyMarble(ctx, mx, my, mr, TILT_MARBLE_BLUE, -rot);
    // The marbles roll through each other, and pressed into the same corner they sit exactly on top of
    // each other (and then move as one). The blue one is drawn last, so it used to hide the amber one
    // completely: while their centres are within a marble radius, the amber marble's right half is drawn
    // over the blue one, so the pair reads as one half-blue, half-amber marble and neither disappears.
    if (state.b && !state.bHome) {
      const bx = state.b.x / FP - o, by = state.b.y / FP - o;
      if (Math.hypot(bx - mx, by - my) < mr) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(bx, by, mr, -Math.PI / 2, Math.PI / 2);
        ctx.closePath();
        ctx.clip();
        toyMarble(ctx, bx, by, mr, TILT_MARBLE_AMBER, -rot, 3);
        ctx.restore();
      }
    }
  }
  ctx.restore();
  ctx.restore();
}

export const tiltArtGame: ArcadeGame<TiltState, ArcadeInputEvent | null> = { ...tiltGame, draw };
/** tiltRev 2 with the same art (the drawing reads the revision from the state). */
export const tiltRev2ArtGame: ArcadeGame<TiltState, ArcadeInputEvent | null> = { ...tiltRev2Game, draw };
const tiltBandArtGame: ArcadeGame<TiltState, ArcadeInputEvent | null> = { ...tiltBandGame, draw };
const tiltTunecArtGame: ArcadeGame<TiltState, ArcadeInputEvent | null> = { ...tiltTunecGame, draw };
const tiltTargetArtGame: ArcadeGame<TiltState, ArcadeInputEvent | null> = { ...tiltTargetGame, draw };
const tiltStrictArtGame: ArcadeGame<TiltState, ArcadeInputEvent | null> = { ...tiltStrictGame, draw };
export function tiltArtGameFor(rev?: number | null): ArcadeGame<TiltState, ArcadeInputEvent | null> {
  if (rev === TILT_REV_STRICT) return tiltStrictArtGame;
  if (rev === TILT_REV_TARGET) return tiltTargetArtGame;
  if (rev === TILT_REV_TUNEC) return tiltTunecArtGame;
  if (rev === TILT_REV_BAND) return tiltBandArtGame;
  return rev === TILT_REV ? tiltRev2ArtGame : tiltArtGame;
}

/**
 * Arena scene (15 Oct 2026, display only; arenaScene.renderer.ts): more of the lamp-lit
 * table round the board (above and below it: the stage centres Tilt's world in its box). The board's own dark rim (just outside the world, as toyBoard
 * draws it) sits on wooden table planks; the board, disc and maze are unchanged.
 */
export function tiltArenaScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  // 17 Oct 2026 (screen fill-ins, display only): the board's oak runs on to the screen's edges with no
  // rim, so the maze and its surroundings are one wooden scene (arenaFills.renderer.ts, tiltFill).
  tiltFill(ctx, view, TILT_WORLD_W, TILT_WORLD_H);
}
