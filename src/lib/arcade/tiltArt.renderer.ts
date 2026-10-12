/**
 * Tilt in the Toybox world: a wooden labyrinth disc on an oak board. Render
 * only; mirrors the sim's private geometry (FP, centre, wall test, pit square
 * half-size cs/4) and reads state without writing it.
 */
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "./engine";
import { drawArtSprite } from "./sprites.renderer";
import { arcadeFx } from "./arcadeFx.renderer";
import { TILT_FX } from "./arcadeFxGames.renderer";
import { TILT_DISC_R, TILT_MAX_MAZES, TILT_WORLD_H, TILT_WORLD_W, tiltBandGame, tiltGame, tiltRev2Game, tiltStarPoint, tiltTotalStars, tiltTunecGame, TILT_REV, TILT_REV_BAND, TILT_REV_TUNEC, type Maze, type TiltState } from "./tilt";
import {
  TOY_BRASS, TOY_BRASS_DARK, TOY_INK, TOY_OAK_LIGHT, TOY_WOOD_DARK,
  toyBoard, toyChangeAge, toyGrain, toyMarble, toyTabletop,
} from "./toybox.renderer";
import { reducedMotion } from "./art.renderer";

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

  toyTabletop(ctx);
  ctx.save();
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  toyBoard(ctx, 0, 0, TILT_WORLD_W, TILT_WORLD_H, 10);

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
  // Disc rim: darker wood ring just outside the sim's disc.
  ctx.fillStyle = TOY_WOOD_DARK;
  ctx.beginPath();
  ctx.arc(0, 0, TILT_DISC_R + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, TILT_DISC_R + 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.rotate(rot);
  ctx.fillStyle = TOY_OAK_LIGHT;
  ctx.beginPath();
  ctx.arc(0, 0, TILT_DISC_R, 0, Math.PI * 2);
  ctx.fill();
  toyGrain(ctx, -TILT_DISC_R, -TILT_DISC_R, TILT_DISC_R * 2, TILT_DISC_R * 2, 12);

  // Full square collision footprint; rounded bevel stays inside the dark cut.
  const pr = cs / 4;
  for (const p of m.pits) {
    const x = (p % m.n) * cs + cs / 2 - o;
    const y = Math.trunc(p / m.n) * cs + cs / 2 - o;
    ctx.fillStyle = "#120A05";
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

  // Raised wooden strips with a slight shadow.
  ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(30,15,5,0.35)";
  ctx.lineWidth = 3;
  walls(ctx, m, o, 1.2, 1.6);
  ctx.strokeStyle = STRIP;
  walls(ctx, m, o, 0, 0);
  ctx.strokeStyle = STRIP_TOP;
  ctx.lineWidth = 1;
  walls(ctx, m, o, -0.5, -0.5);

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
export function tiltArtGameFor(rev?: number | null): ArcadeGame<TiltState, ArcadeInputEvent | null> {
  if (rev === TILT_REV_TUNEC) return tiltTunecArtGame;
  if (rev === TILT_REV_BAND) return tiltBandArtGame;
  return rev === TILT_REV ? tiltRev2ArtGame : tiltArtGame;
}
