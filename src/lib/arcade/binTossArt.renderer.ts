import { BINTOSS_NEXT_DELAY } from "./binToss";
import { arcadeFx } from "./arcadeFx.renderer";
import { BINTOSS_FX, BINTOSS_FX_V7 } from "./arcadeFxGames.renderer";
import { successHud, successFrame, SUCCESS_ACCENTS } from "./success.renderer";
import type { ArcadeGame, ArcadeInputEvent, CanvasSize } from "./engine";
import {
  BINTOSS_BALL_R, BINTOSS_FLOOR_Y, BINTOSS_FLY, BINTOSS_MISS_COLOUR,
  BINTOSS_RIM_Y, BINTOSS_SLIDE_FROM, BINTOSS_THROWS, BINTOSS_WAIT, BINTOSS_WIND_MAX,
  BINTOSS_WORLD_H, BINTOSS_WORLD_W, BINTOSS_BIN_COLOUR,
  BINTOSS_HOOP_CAP_R, BINTOSS_HOOP_HALF, BINTOSS_SPIN_THICK,
  binTossCentreAt, binTossGame, binTossHalf, binTossPath, binTossSpinEnds, binTossSpinPivot,
  type BinTossGhost, type BinTossHoop, type BinTossLandingPresentation, type BinTossState,
  BINTOSS_EXPAND, BINTOSS_FAR_HALF, BINTOSS_FAR_POINTS, BINTOSS_V7_LIFT, BINTOSS_V7_WORLD_H, BINTOSS_V7_WORLD_W,
  binTossWindAcc, binTossWindSub, binTossWorldOf, binTossFarHalf,
} from "./binToss";
import { reducedMotion } from "./art.renderer";
import { FAIR_CREAM, FAIR_RED, FAIR_TEXT, fairArenaScene, fairChangeAge, fairClock, fairScreen, fairTransform } from "./fairground.renderer";
import type { ArenaSceneView } from "./arenaScene.renderer";

const px = (v: number) => v / 256;
export const BINTOSS_RUBBER = "#A72B32";
const SEAM = "#4A0F0B";
const TIN_LIGHT = "#ACB0B3";
const TIN_MID = "#959A9E";
const TIN_DARK = "#787E83";
const AIM_INK = "#453C53";
const AIM_WHITE = "#FFFFFF";
const FLOOR = px(BINTOSS_FLOOR_Y);

/**
 * The ball stands out (Joe's phone notes, 27 Oct 2026; look only): a soft warm halo round it, plainly light
 * rather than ball (it fades to nothing by r + 9 px and never hides what is behind it), and a thin dark ring on
 * its edge (inside the bounds rule's 2 px).
 */
function ballHalo(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  const g = ctx.createRadialGradient(x, y, r, x, y, r + 9);
  g.addColorStop(0, "rgba(255,240,210,0.7)");
  g.addColorStop(0.4, "rgba(255,226,180,0.32)");
  g.addColorStop(1, "rgba(255,220,170,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r + 9, 0, Math.PI * 2);
  ctx.fill();
  // A thin dark ring hugging the ball (within 1.7 px of its edge), so it reads against the bright sunset too.
  ctx.strokeStyle = "rgba(32,6,10,0.9)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(x, y, r + 0.8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** `outline`: a bright cream ring just inside the ball's edge (inside r, so the drawn ball is still exactly its collision circle). */
export function drawRubberBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number, outline = false): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.fillStyle = BINTOSS_RUBBER;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = SEAM;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-r, -r * 0.2);
  ctx.quadraticCurveTo(0, r * 0.7, r, -r * 0.2);
  ctx.stroke();
  ctx.restore();
  // Lamp-fixed shading over the spinning ball: lit upper left, shaded edge, one glint (inside r).
  ctx.save();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, "rgba(255,210,200,0.45)");
  g.addColorStop(0.45, "rgba(255,255,255,0)");
  g.addColorStop(1, "rgba(40,0,6,0.45)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // Polish A3: a warm sunset rim along the lower right and a soft second sheen (all inside r).
  const rim = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.55, x, y, r);
  rim.addColorStop(0, "rgba(255,170,100,0)");
  rim.addColorStop(0.82, "rgba(255,170,100,0)");
  rim.addColorStop(1, "rgba(255,170,100,0.45)");
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI * 0.15, Math.PI * 0.85);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.28, y - r * 0.36, r * 0.42, r * 0.24, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(x - r * 0.38, y - r * 0.42, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  if (outline) {
    ctx.strokeStyle = "#FFF1DC";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y, r - 0.8, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Polish A3: a soft contact shadow on the counter, smaller and fainter the higher its caster is. */
function counterShadow(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, height: number): void {
  const lift = Math.max(0, Math.min(1, height / 320));
  const w = rx * (1.25 - 0.55 * lift);
  ctx.save();
  ctx.globalAlpha = 0.42 * (1 - 0.8 * lift);
  const g = ctx.createRadialGradient(x, y, 0, x, y, w);
  g.addColorStop(0, "rgba(28,14,6,1)");
  g.addColorStop(1, "rgba(28,14,6,0)");
  ctx.fillStyle = g;
  ctx.translate(x, y);
  ctx.scale(1, 0.24);
  ctx.translate(-x, -y);
  ctx.beginPath();
  ctx.arc(x, y, w, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawBucket(ctx: CanvasRenderingContext2D, centre: number, half: number, lean: number, trolley: boolean): void {
  const top = px(BINTOSS_RIM_Y);
  const h = FLOOR - top;
  ctx.save();
  if (trolley) {
    ctx.fillStyle = "#3A2A1E";
    ctx.fillRect(centre - half - 3, FLOOR, half * 2 + 6, 4);
    ctx.fillStyle = "#1C1612";
    for (const wx of [centre - half + 6, centre + half - 6]) {
      ctx.beginPath();
      ctx.arc(wx, FLOOR + 8, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,240,220,0.25)";
    ctx.fillRect(centre - half - 3, FLOOR, half * 2 + 6, 1);
    ctx.strokeStyle = "#4A4038";
    ctx.lineWidth = 0.8;
    for (const wx of [centre - half + 6, centre + half - 6]) {
      ctx.beginPath();
      ctx.moveTo(wx - 3, FLOOR + 8);
      ctx.lineTo(wx + 3, FLOOR + 8);
      ctx.moveTo(wx, FLOOR + 5);
      ctx.lineTo(wx, FLOOR + 11);
      ctx.stroke();
    }
    ctx.fillStyle = TIN_MID;
    for (const wx of [centre - half + 6, centre + half - 6]) {
      ctx.beginPath();
      ctx.arc(wx, FLOOR + 8, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.translate(centre + lean, FLOOR);
  const body = new Path2D();
  body.moveTo(-half, -h);
  body.lineTo(-half + 4, 0);
  body.lineTo(half - 4, 0);
  body.lineTo(half, -h);
  body.closePath();
  const g = ctx.createLinearGradient(-half, 0, half, 0);
  g.addColorStop(0, TIN_DARK);
  g.addColorStop(0.35, TIN_LIGHT);
  g.addColorStop(0.6, TIN_MID);
  g.addColorStop(1, TIN_DARK);
  ctx.fillStyle = g;
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  ctx.strokeStyle = "rgba(40, 44, 52, 0.3)";
  ctx.lineWidth = 1.5;
  for (const f of [0.22, 0.5, 0.78]) {
    ctx.beginPath();
    ctx.moveTo(-half, -h * (1 - f));
    ctx.lineTo(half, -h * (1 - f));
    ctx.stroke();
  }
  ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
  ctx.lineWidth = 1;
  for (const f of [0.22, 0.5, 0.78]) {
    ctx.beginPath();
    ctx.moveTo(-half, -h * (1 - f) + 1.5);
    ctx.lineTo(half, -h * (1 - f) + 1.5);
    ctx.stroke();
  }
  // Polished streak down the lit side, a darker foot and a rivet column on the side seam.
  ctx.fillStyle = "rgba(255,255,255,0.32)";
  ctx.fillRect(-half * 0.42, -h, Math.max(2, half * 0.12), h);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(-half * 0.24, -h, Math.max(1, half * 0.05), h);
  const foot = ctx.createLinearGradient(0, -h * 0.3, 0, 0);
  foot.addColorStop(0, "rgba(20,22,28,0)");
  foot.addColorStop(1, "rgba(20,22,28,0.3)");
  ctx.fillStyle = foot;
  ctx.fillRect(-half, -h * 0.3, half * 2, h * 0.3);
  // Polish A3: the sunset caught along the far edge, and a dark band under the rim.
  ctx.fillStyle = "rgba(255,160,96,0.22)";
  ctx.fillRect(half * 0.72, -h, Math.max(1.5, half * 0.1), h);
  const lip = ctx.createLinearGradient(0, -h, 0, -h + 7);
  lip.addColorStop(0, "rgba(20,22,28,0.35)");
  lip.addColorStop(1, "rgba(20,22,28,0)");
  ctx.fillStyle = lip;
  ctx.fillRect(-half, -h, half * 2, 7);
  ctx.fillStyle = "#5E6469";
  for (const f of [0.12, 0.36, 0.64, 0.9]) {
    const ry = -h * (1 - f);
    const rx = half * 0.62 - (half * 0.62 - (half - 4) * 0.62) * f;
    ctx.beginPath();
    ctx.arc(rx, ry, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = TIN_DARK;
  ctx.lineWidth = 1;
  ctx.stroke(body);
  // Open mouth: dark inside, lit at the back wall, then the rolled rim with its highlight.
  const mouth = ctx.createLinearGradient(0, -h - 3.2, 0, -h + 3.2);
  mouth.addColorStop(0, "#3A3F46");
  mouth.addColorStop(1, "#111318");
  ctx.fillStyle = mouth;
  ctx.beginPath();
  ctx.ellipse(0, -h, half - 1, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = TIN_DARK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, -h, half - 1, 3.2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = TIN_LIGHT;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(0, -h - 0.3, half - 1, 3.2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(0, -h - 0.3, half - 1, 3.2, 0, Math.PI * 0.55, Math.PI * 0.95);
  ctx.stroke();
  // Polish A3: the rim glows warm in the stall lights (a soft halo within 2 px of the rim, a lit front lip).
  ctx.strokeStyle = "rgba(255,206,130,0.22)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(0, -h, half - 1, 3.2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,222,160,0.85)";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.ellipse(0, -h + 0.2, half - 1, 3.2, 0, Math.PI * 0.08, Math.PI * 0.92);
  ctx.stroke();
  ctx.restore();
}

const HOOP_RED = "#E8384F";
const HOOP_WHITE = "#FFF4E0";
const HOOP_GOLD = "#F5B82E";

/**
 * Rev 3 bonus hoop, side on: a striped ring whose two end caps are exactly the
 * sim's bounce circles. `front` draws the near half (over the ball), otherwise
 * the far half (under it).
 */
function drawHoop(ctx: CanvasRenderingContext2D, hoop: BinTossHoop, front: boolean, glow: number): void {
  const x = px(hoop.x);
  const y = px(hoop.y);
  const half = px(BINTOSS_HOOP_HALF);
  const cap = px(BINTOSS_HOOP_CAP_R);
  ctx.save();
  ctx.lineCap = "round";
  if (glow > 0) {
    ctx.strokeStyle = HOOP_GOLD;
    ctx.globalAlpha = 0.55 * glow;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.ellipse(x, y, half, 4, 0, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Red and white stripes round the ring.
  const segments = 8;
  for (let i = 0; i < segments; i++) {
    const a0 = (front ? 0 : Math.PI) + (i * Math.PI) / segments;
    ctx.strokeStyle = i % 2 ? HOOP_WHITE : HOOP_RED;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.ellipse(x, y, half, 4, 0, a0, a0 + Math.PI / segments);
    ctx.stroke();
  }
  if (front) {
    for (const cx of [x - half, x + half]) {
      ctx.fillStyle = HOOP_GOLD;
      ctx.beginPath();
      ctx.arc(cx, y, cap, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#7A4A10";
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    // A small "+3" flag so the hoop reads as a bonus.
    ctx.font = "700 10px 'JetBrains Mono', ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillStyle = HOOP_GOLD;
    ctx.fillText("BONUS", x, y - 6);
  }
  ctx.restore();
}

/**
 * Rev 3 spinner: a striped fairground paddle on a brass hub. The paddle is
 * drawn as the sim's capsule (bar plus its half-thickness), so what you see is
 * what the ball bounces off.
 */
function drawSpinner(ctx: CanvasRenderingContext2D, state: BinTossState, index: number, flash: number): void {
  const spinner = state.spinners?.[index];
  if (!spinner) return;
  const bar = binTossSpinEnds(state, index, spinner, state.tick);
  const pivot = binTossSpinPivot(state, index, state.tick);
  const thick = px(BINTOSS_SPIN_THICK) * 2;
  ctx.save();
  ctx.lineCap = "round";
  // The capsule: a dark edge, the painted paddle inside it and a lit top line, all within the sim's capsule.
  ctx.strokeStyle = flash > 0 ? "#9A6A10" : "#2E1247";
  ctx.lineWidth = thick;
  ctx.beginPath();
  ctx.moveTo(px(bar.x0), px(bar.y0));
  ctx.lineTo(px(bar.x1), px(bar.y1));
  ctx.stroke();
  ctx.strokeStyle = flash > 0 ? HOOP_GOLD : "#5B2A86";
  ctx.lineWidth = Math.max(1, thick - 2);
  ctx.stroke();
  ctx.save();
  ctx.translate(0, -thick * 0.18);
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = thick * 0.22;
  ctx.beginPath();
  ctx.moveTo(px(bar.x0), px(bar.y0));
  ctx.lineTo(px(bar.x1), px(bar.y1));
  ctx.stroke();
  ctx.restore();
  // Painted stripes along the paddle.
  ctx.strokeStyle = HOOP_WHITE;
  ctx.lineWidth = thick * 0.35;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(px(bar.x0), px(bar.y0));
  ctx.lineTo(px(bar.x1), px(bar.y1));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#7A4A10";
  ctx.beginPath();
  ctx.arc(px(pivot.x), px(pivot.y), thick * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = HOOP_GOLD;
  ctx.beginPath();
  ctx.arc(px(pivot.x), px(pivot.y), thick * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFF4C2";
  ctx.beginPath();
  ctx.arc(px(pivot.x) - thick * 0.1, px(pivot.y) - thick * 0.1, thick * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * The wind (Joe's phone notes, 27 Oct 2026; look only, every revision): a small flag on a pole at the top
 * of the stall, flying the way the wind blows, longer the stronger it is, waving on the render clock (still
 * under reduced motion), with the wind's strength printed on the cloth. No wind: the flag hangs limp, "0".
 * It replaces the old arrow, bars and corner pennant (the same reading in one place).
 */
function drawWind(ctx: CanvasRenderingContext2D, wind: number, worldW = BINTOSS_WORLD_W, top = 0): void {
  const strength = Math.abs(wind);
  const dir = wind < 0 ? -1 : 1;
  const poleX = worldW / 2 - dir * 20;
  const poleTop = 52 + top;
  const poleFoot = poleTop + 58;
  const t = fairClock();
  ctx.save();
  // The pole, its gold knob and a small foot.
  ctx.strokeStyle = "#3A2A1C";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(poleX, poleTop);
  ctx.lineTo(poleX, poleFoot);
  ctx.stroke();
  ctx.strokeStyle = FAIR_CREAM;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = "#F5B82E";
  ctx.beginPath();
  ctx.arc(poleX, poleTop - 2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(20,12,30,0.55)";
  ctx.fillRect(poleX - 6, poleFoot - 1, 12, 3);

  const h = 24;
  const segments = 14;
  // Top and bottom edges of the cloth at u (0 at the pole, 1 at the tip), in pole-relative x and y (limp: the
  // strip's pole-side edge at u down its length).
  const edge = (u: number, bottom: boolean): { x: number; y: number } => {
    if (strength === 0) {
      // Limp: the cloth hangs down the pole, a slight sway.
      const sway = t === 0 ? 0 : Math.sin(t / 700 + u * 2) * 1.2 * u;
      return { x: sway + u * 2, y: u * 30 };
    }
    const len = 34 + 6 * strength;
    // Flies out level when strong, drooping a little when light; ripples travel from the pole to the tip.
    const droop = (1 - Math.min(1, strength / BINTOSS_WIND_MAX)) * 10 * u * u;
    const amp = (1.5 + 0.6 * strength) * u;
    const wave = t === 0 ? Math.sin(u * 5) * amp * 0.5 : Math.sin(t / (150 - 12 * strength) - u * 6) * amp;
    return { x: u * len, y: (bottom ? h : 0) + droop + wave };
  };
  const at = (pt: { x: number; y: number }) => ({ x: poleX + dir * pt.x, y: poleTop + 2 + pt.y });
  const tops: { x: number; y: number }[] = [];
  const bottoms: { x: number; y: number }[] = [];
  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    if (strength === 0) {
      // Limp cloth: a strip hanging beside the pole (its width across, its length down).
      const a = edge(u, false);
      tops.push({ x: poleX + dir * (1.5 + a.x), y: poleTop + 2 + a.y });
      bottoms.push({ x: poleX + dir * (1.5 + a.x + 14), y: poleTop + 2 + a.y });
    } else {
      tops.push(at(edge(u, false)));
      bottoms.push(at(edge(u, true)));
    }
  }
  ctx.fillStyle = FAIR_RED;
  ctx.strokeStyle = "rgba(60,8,12,0.85)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tops[0]!.x, tops[0]!.y);
  for (const pt of tops) ctx.lineTo(pt.x, pt.y);
  for (let i = bottoms.length - 1; i >= 0; i--) ctx.lineTo(bottoms[i]!.x, bottoms[i]!.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // A cream stripe along the cloth's top edge, so it reads as a flag at a glance.
  ctx.strokeStyle = "rgba(244,237,224,0.75)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= segments; i++) {
    const a = tops[i]!;
    const b = bottoms[i]!;
    const x = a.x + (b.x - a.x) * 0.18;
    const y = a.y + (b.y - a.y) * 0.18;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // The strength on the cloth, upright, at its middle.
  const mid = Math.round(segments * (strength === 0 ? 0.5 : 0.45));
  const cx = (tops[mid]!.x + bottoms[mid]!.x) / 2;
  const cy = (tops[mid]!.y + bottoms[mid]!.y) / 2 + 1;
  ctx.font = "800 16px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(60,8,12,0.9)";
  ctx.strokeText(String(strength), cx, cy);
  ctx.fillStyle = FAIR_TEXT;
  ctx.fillText(String(strength), cx, cy);
  // "WIND" over the pole, small.
  ctx.font = "700 10px 'JetBrains Mono', ui-monospace, monospace";
  ctx.fillStyle = "rgba(247,247,248,0.7)";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("WIND", poleX, poleTop - 9);
  ctx.restore();
}

/**
 * binRev 7: the far bucket's tag, a small gold pennant on a pole standing in the bucket's mouth (scenery
 * above the rim, never in the ball's way: the rim is the bucket's top), "+9" on it.
 */
function drawFarTag(ctx: CanvasRenderingContext2D, centre: number, top: number, made: boolean): void {
  ctx.save();
  const x = centre + 8;
  ctx.strokeStyle = "#4E3019";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, top - 3);
  ctx.lineTo(x, top - 34);
  ctx.stroke();
  ctx.fillStyle = made ? "#FFE9A3" : "#F5B82E";
  ctx.beginPath();
  ctx.moveTo(x, top - 34);
  ctx.lineTo(x + 26, top - 28);
  ctx.lineTo(x, top - 21);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(110,74,16,0.9)";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.fillStyle = "#3A2208";
  ctx.font = "800 9px 'JetBrains Mono', ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`+${BINTOSS_FAR_POINTS}`, x + 3, top - 27.5);
  ctx.restore();
}

const trails = new WeakMap<CanvasRenderingContext2D, { tick: number; points: { x: number; y: number }[] }>();
function drawTrail(ctx: CanvasRenderingContext2D, state: BinTossState): void {
  if (state.phase !== BINTOSS_FLY || reducedMotion()) return;
  let memo = trails.get(ctx);
  if (!memo || state.tick < memo.tick) memo = { tick: state.tick, points: [] };
  memo.tick = state.tick;
  const last = memo.points[memo.points.length - 1];
  if (!last || last.x !== state.x || last.y !== state.y) memo.points.push({ x: state.x, y: state.y });
  while (memo.points.length > 6) memo.points.shift();
  trails.set(ctx, memo);

  ctx.save();
  ctx.fillStyle = BINTOSS_RUBBER;
  const n = memo.points.length;
  for (let i = 0; i < n - 1; i++) {
    const p = memo.points[i]!;
    const k = (i + 1) / n;
    ctx.globalAlpha = 0.4 * k;
    ctx.beginPath();
    ctx.arc(px(p.x), px(p.y), px(BINTOSS_BALL_R) * (0.5 + 0.5 * k), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, state: BinTossState, size: CanvasSize): void {
  const basketAge = fairChangeAge(ctx, "bintoss-baskets", state.baskets);
  const resolvedAge = fairChangeAge(ctx, "bintoss-resolved", state.resolved);
  // binRev 7: the wider, taller fairground, drawn `lift` px down so every sim coordinate keeps its place.
  const world = binTossWorldOf(state);
  const expand = world.lift > 0;
  const farAge = expand ? fairChangeAge(ctx, "bintoss-far", state.farIn ?? 0) : Infinity;
  fairScreen(ctx, size, world.w, world.h, FLOOR + world.lift, () => { if (expand) ctx.translate(0, world.lift); arcadeFx(ctx, expand ? BINTOSS_FX_V7 : BINTOSS_FX, state, () => {
    const index = Math.min(state.throwIndex, BINTOSS_THROWS - 1);
    const centre = px(binTossCentreAt(state, index, state.tick));
    const half = px(binTossHalf(index, state.rev));
    const since = state.tick - state.wobbleTick;
    let lean = state.wobbleTick > 0 && since >= 0 && since < 24 ? (since % 8 < 4 ? 2 : -2) : 0;
    if (!reducedMotion() && basketAge < 500) lean = Math.sin(basketAge / 45) * 2 * (1 - basketAge / 500);
    const slides = index >= BINTOSS_SLIDE_FROM;
    counterShadow(ctx, centre, slides ? FLOOR + 12 : FLOOR + 1, half + 6, 0);
    if (state.resolved < BINTOSS_THROWS) counterShadow(ctx, px(state.x), FLOOR + 1, px(BINTOSS_BALL_R) * 1.4, FLOOR - px(state.y));
    drawBucket(ctx, centre, half, lean, slides);
    // binRev 7: the far bucket further back, still; it rocks after a far basket or a rim hit.
    const farCentre = expand && state.throwIndex < BINTOSS_THROWS ? (state.fars?.[index] ?? 0) : 0;
    if (farCentre) {
      const fsince = state.tick - (state.farWobbleTick ?? 0);
      let farLean = (state.farWobbleTick ?? 0) > 0 && fsince >= 0 && fsince < 24 ? (fsince % 8 < 4 ? 2 : -2) : 0;
      if (!reducedMotion() && farAge < 500) farLean = Math.sin(farAge / 45) * 2 * (1 - farAge / 500);
      // binRev 8: the smaller far bucket, drawn exactly on its mouth and walls.
      const farHalf = px(binTossFarHalf(state));
      counterShadow(ctx, px(farCentre), FLOOR + 1, farHalf + 6, 0);
      drawBucket(ctx, px(farCentre), farHalf, farLean, false);
      drawFarTag(ctx, px(farCentre), px(BINTOSS_RIM_Y), farAge < 600);
    }
    // Rev 3: the hoop (glowing briefly after a swish) and the spinner.
    const hoop = state.throwIndex < BINTOSS_THROWS ? (state.hoops?.[index] ?? null) : null;
    const swishAge = fairChangeAge(ctx, "bintoss-swishes", state.swishes ?? 0);
    const hoopGlow = state.hooped ? 1 : !reducedMotion() && swishAge < 600 ? 1 - swishAge / 600 : 0;
    if (hoop) drawHoop(ctx, hoop, false, hoopGlow);
    const knock = state.knockTick && state.tick - state.knockTick < 10 && !reducedMotion() ? 1 : 0;
    if (state.throwIndex < BINTOSS_THROWS) drawSpinner(ctx, state, index, knock);

    const caughtIndex=Math.max(0,state.throwIndex-1);
    // binRev 7: a far basket sparks at the far bucket.
    const caughtFar = expand && state.farResults?.at(-1) === 1 ? (state.fars?.[caughtIndex] ?? 0) : 0;
    if (expand) {
      ctx.save();
      ctx.translate(0, -world.lift);
    }
    successFrame(ctx,{id:'bintoss',tick:state.tick,count:state.baskets,eventTick:state.results.at(-1)===1?state.readyTick-BINTOSS_NEXT_DELAY:0,misses:state.resolved-state.baskets,colour:SUCCESS_ACCENTS.gold,width:world.w,height:world.h,point:{x:caughtFar?px(caughtFar):px(binTossCentreAt(state,caughtIndex,state.tick)),y:px(BINTOSS_RIM_Y)+world.lift,shape:'spark'},hud:{x:12,y:12,text:`Throw ${Math.min(BINTOSS_THROWS,state.throwIndex+1)} / ${BINTOSS_THROWS} · ${state.baskets} in`}});
    if (expand) ctx.restore();
    if (state.throwIndex < BINTOSS_THROWS) drawWind(ctx, state.winds[state.throwIndex] ?? 0, world.w, -world.lift);
    if (state.resolved < BINTOSS_THROWS) {
      drawTrail(ctx, state);
      const r = px(BINTOSS_BALL_R);
      let y = px(state.y);
      const missed = state.phase === BINTOSS_WAIT && state.results[state.results.length - 1] === 0;
      if (missed && !reducedMotion() && resolvedAge < 420 && y >= FLOOR - r - 2) {
        const u = resolvedAge / 420;
        y -= Math.abs(Math.sin(u * Math.PI * 2)) * 10 * (1 - u);
      }
      ballHalo(ctx, px(state.x), y, r);
      drawRubberBall(ctx, px(state.x), y, r, ((state.tick * 11) % 360) * (Math.PI / 180), true);
    }
    if (hoop) drawHoop(ctx, hoop, true, hoopGlow);

    ctx.font = "600 19.5px 'JetBrains Mono', ui-monospace, monospace";
    ctx.fillStyle = FAIR_TEXT;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    const shown = Math.min(BINTOSS_THROWS, state.throwIndex + 1);
  successHud(ctx,'bintoss',state.tick,12,12-world.lift,()=>{ctx.fillText(`Throw ${shown} / ${BINTOSS_THROWS} · ${state.baskets} in`, 12, 12-world.lift);});
    // binRev 7: the far points so far, under the throw line.
    if (expand) {
      ctx.save();
      ctx.font = "700 14px 'JetBrains Mono', ui-monospace, monospace";
      ctx.textBaseline = "top";
      ctx.fillStyle = (state.farIn ?? 0) > 0 ? "#F5B82E" : "rgba(247,247,248,0.6)";
      ctx.fillText(`FAR ${state.farIn ?? 0} · +${Math.min(50, BINTOSS_FAR_POINTS * (state.farIn ?? 0))}`, 12, 40 - world.lift);
      ctx.restore();
    }
    for (let i = 0; i < BINTOSS_THROWS; i++) {
      const result = state.results[i];
      ctx.fillStyle = result === 1 ? "#F5B82E" : result === 0 ? BINTOSS_MISS_COLOUR : "#F7F7F844";
      ctx.beginPath();
      ctx.arc(20 + i * 16, BINTOSS_WORLD_H - 16, 4, 0, Math.PI * 2);
      ctx.fill();
      // binRev 7: a far basket's pip has a white ring.
      if (expand && state.farResults?.[i] === 1) {
        ctx.strokeStyle = "#FFF4E0";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }); }, [0.3, 0.52]);
}

/** The world an aim, ghost or landing is drawn in (binRev 7: the wider, taller fairground). */
function worldFor(expand: boolean | undefined): { w: number; h: number; lift: number } {
  return expand ? { w: BINTOSS_V7_WORLD_W, h: BINTOSS_V7_WORLD_H, lift: BINTOSS_V7_LIFT } : { w: BINTOSS_WORLD_W, h: BINTOSS_WORLD_H, lift: 0 };
}

export function binTossArtAim(ctx: CanvasRenderingContext2D, size: CanvasSize, aim: BinTossGhost, cancelled = false, expand = false): void {
  const points = binTossPath(aim.vx, aim.vy, 0, false);
  const first = points[0];
  if (!first) return;
  const world = worldFor(expand);
  const { scale, offsetX, offsetY } = fairTransform(size, world.w, world.h);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.translate(0, world.lift);
  ctx.strokeStyle = AIM_INK;
  ctx.globalAlpha = cancelled ? 0.28 : 1;
  ctx.lineCap = "round";
  ctx.lineWidth = 3.5;
  ctx.setLineDash([0.1, 8]);
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    if (point) ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
  ctx.strokeStyle = AIM_WHITE;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

export function binTossArtLanding(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  landing: BinTossLandingPresentation,
): void {
  const world = worldFor(landing.expand === BINTOSS_EXPAND);
  const { scale, offsetX, offsetY } = fairTransform(size, world.w, world.h);
  const p = Math.max(0, Math.min(1, landing.progress));
  const centre = px(landing.binCentre);
  const half = px(landing.far ? (landing.farHalf ?? BINTOSS_FAR_HALF) : binTossHalf(landing.binIndex, landing.rev));
  const rim = px(BINTOSS_RIM_Y);
  const radius = px(BINTOSS_BALL_R);
  let x = centre;
  let y = rim + radius;
  if (p < 0.48) {
    const local = p / 0.48;
    x = centre + half * 0.42 * local;
    y = rim + radius + (FLOOR - rim - radius * 2) * local;
  } else if (p < 0.76) {
    const local = (p - 0.48) / 0.28;
    x = centre + half * 0.42 * (1 - local * 1.55);
    y = FLOOR - radius - Math.sin(local * Math.PI) * 12;
  } else {
    const local = (p - 0.76) / 0.24;
    x = centre - half * 0.23 + half * 0.1 * local;
    y = FLOOR - radius;
  }
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.translate(0, world.lift);
  ctx.beginPath();
  ctx.moveTo(centre - half, rim);
  ctx.lineTo(centre - half + 4, FLOOR);
  ctx.lineTo(centre + half - 4, FLOOR);
  ctx.lineTo(centre + half, rim);
  ctx.closePath();
  ctx.rect(centre - half, rim - 40, half * 2, 40);
  ctx.clip();
  ctx.globalAlpha = y - radius > rim ? 0.55 : 1;
  drawRubberBall(ctx, x, y, radius, p * Math.PI * 3);
  ctx.restore();
}

export const binTossArtGame: ArcadeGame<BinTossState, ArcadeInputEvent | null> = { ...binTossGame, draw };

/** Arena scene (15 Oct 2026, display only): the stall's sky, counter and floor beyond the world. */
export function binTossArenaScene(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  fairArenaScene(ctx, view, FLOOR);
}

/** binRev 7's arena scene: the floor line sits lift px lower in the taller world. */
export function binTossArenaSceneV7(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  fairArenaScene(ctx, view, FLOOR + BINTOSS_V7_LIFT);
}

/** binRev 7: the last throw's arc, faint until the next release, in the wider world (binTossDrawGhost's look). */
export function binTossArtGhost(ctx: CanvasRenderingContext2D, size: CanvasSize, ghost: BinTossGhost, alpha = 0.22): void {
  const world = worldFor(true);
  const points = binTossPath(ghost.vx, ghost.vy, ghost.wind, true, binTossWindAcc(ghost.index ?? 0, ghost.rev), binTossWindSub(ghost.rev));
  const first = points[0];
  if (!first) return;
  const { scale, offsetX, offsetY } = fairTransform(size, world.w, world.h);
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  ctx.translate(0, world.lift);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#F5B82E";
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 6]);
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (const point of points.slice(1)) ctx.lineTo(point.x, point.y);
  ctx.stroke();
  ctx.restore();
}
