/**
 * Pinball art (Retro world). Render only: reads the sim state, never writes it.
 * Every solid thing is drawn on its collision shape (walls and targets as their
 * capsules, bumpers as their circles, flippers as their swept capsule at the
 * sim's angle), so what the player sees is what the ball hits. A bumper that was
 * just struck glows neon for a few ticks (from the sim's bumperAt), and the
 * border lights ripple out from it through the shared success layer.
 *
 * Polish (Oct 2026): the static table (playfield gradient, grid and vignette,
 * inlaid lane guides and unlit insert sockets, bevelled rails, slingshot
 * plastics, bumper bodies, apron plates and the plunger) is painted once into a
 * cached offscreen layer keyed by device scale, with a direct-paint fallback
 * where no offscreen canvas exists (Node checks). The cached layer never holds
 * text. Bevel highlights and rim light stay inside each solid's own outline;
 * glows and contact shadows sit off the solids and are faint. Per frame only the
 * live parts are drawn (lit inserts, struck bumpers and slings, targets,
 * spinner, flippers, the ball and the HUD), with no shadowBlur except the HUD.
 */
import { arcadeFx } from "./arcadeFx.renderer";
import { PINBALL_FX } from "./arcadeFxGames.renderer";
import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";
import { fillAbove, fillBelow, pinballFill } from "./arenaFills.renderer";
import type { ArenaSceneView } from "./arenaScene.renderer";
import { type ArcadeGame, type ArcadeInputEvent, type CanvasSize } from "./engine";
import {
  pinballGame,
  pinFlipAngle,
  PIN_BALLS,
  PIN_BALL_R,
  PIN_BUMPERS,
  PIN_BUMPER_R,
  PIN_FLIP_LEN,
  PIN_FLIP_PIVOTS,
  PIN_FLIP_R,
  PIN_GATE,
  PIN_LANE_POSTS,
  PIN_LANE_POST_BOTTOM,
  PIN_LANE_X,
  PIN_LANE_Y,
  PIN_LEFT_WALL,
  PIN_MID_X,
  PIN_MULT_MAX,
  PIN_ORBIT_INNER,
  PIN_SEGS,
  PIN_SLING,
  PIN_SPINNER_Y,
  PIN_TARGET,
  PIN_TARGET_HALF,
  PIN_TARGET_R,
  PIN_TARGET_XS,
  PIN_TARGET_Y,
  PIN_WORLD_H,
  PIN_WORLD_W,
  PIN_ARCH,
  PIN_LANE_INNER,
  PIN_LANE_OUTER,
  PIN_RUN_TICKS,
  PIN_WALL_R,
  PIN_PTS_BUMPER,
  type PinSegDef,
  type PinState,
  pinballTargetGame,
  pinballStrictGame,
  PIN_REV_TARGET,
  PIN_REV_STRICT,
} from "./pinball";
import {
  retroBloom,
  retroClock,
  retroScreen,
  retroHud,
  retroText,
  retroTrail,
  RETRO_WHITE,
} from "./retro.renderer";

export const PIN_COLOURS = {
  wall: "#3DFFE0",
  panel: "#0B0620",
  bumper: "#FF4DFF",
  bumperCap: "#2A0A33",
  sling: "#FFD84A",
  target: "#FF8A3C",
  targetDown: "rgba(255,138,60,0.28)",
  laneOn: "#4BFF7A",
  laneOff: "rgba(75,255,122,0.18)",
  flipper: "#FFD84A",
  flipperCore: "#5A4510",
  spinner: "#F4FFF8",
  spinnerLit: "#FFD84A",
  ball: "#C9D6E8",
  hud: "#F4FFF8",
} as const;

/** Bevel shades for the rails, slings, flippers and targets (light from the top left). */
export const SHADE = {
  railBody: "#0E7F72",
  railLight: "#3DFFE0",
  railSpec: "rgba(236,255,251,0.9)",
  railHalo: "rgba(61,255,224,0.07)",
  slingBody: "#A8820F",
  slingLight: "#FFD84A",
  slingSpec: "rgba(255,248,214,0.9)",
  flipEdge: "#8F6A0E",
  flipBody: "#FFD84A",
  flipHeld: "#FFE88A",
  flipSpec: "rgba(255,250,224,0.95)",
  targetEdge: "#A9461A",
  targetSpec: "#FFD3B2",
  shadow: "rgba(0,0,0,0.5)",
} as const;

/** How long a struck bumper or slingshot glows, in sim ticks. */
export const GLOW_TICKS = 10;

/** Centre of the multiplier lights row, its y (text top) and spacing. */
const PIN_MID_LIGHTS_X = 181;
const MULT_Y = 470;
const MULT_STEP = 28;
const multX = (m: number) => PIN_MID_LIGHTS_X + (m - 2) * MULT_STEP - 42;

/** Lane insert triangles under the guide posts (apex up). */
const LANE_INSERT_TOP = PIN_LANE_POST_BOTTOM + 8;
const LANE_INSERT_BASE = PIN_LANE_POST_BOTTOM + 20;
/** Drop-target insert lights (one under each target) and the spinner's arrow insert. */
const TARGET_INSERT_Y = PIN_TARGET_Y + 17;
const SPIN_INSERT_Y = PIN_SPINNER_Y + 38;
const ORBIT_MID = (PIN_LEFT_WALL + PIN_ORBIT_INNER) / 2;

/** Per-canvas spinner animation memory (presentation only). */
const spinMemo = new WeakMap<
  CanvasRenderingContext2D,
  { spins: number; at: number; turns: number; tick: number }
>();

type Ctx = CanvasRenderingContext2D;

export function capsule(
  ctx: Ctx,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  r: number,
  colour: string,
  dx = 0,
  dy = 0,
): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = r * 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(ax + dx, ay + dy);
  ctx.lineTo(bx + dx, by + dy);
  ctx.stroke();
}

/** One stroke over several segments (a union, so translucent passes never double up at joins). */
export function strokeSegs(
  ctx: Ctx,
  segs: readonly PinSegDef[],
  width: number,
  colour: string,
  dx = 0,
  dy = 0,
): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (const s of segs) {
    ctx.moveTo(s.a[0] + dx, s.a[1] + dy);
    ctx.lineTo(s.b[0] + dx, s.b[1] + dy);
  }
  ctx.stroke();
}

/**
 * A bevelled rail on its capsules: a faint halo and a contact shadow off the
 * solid, then the body at exactly 2r, a highlight band and a specular line
 * offset to the top left by less than r minus their half-width (so they stay
 * inside the capsule's own outline).
 */
export function bevelRails(
  ctx: Ctx,
  segs: readonly PinSegDef[],
  r: number,
  body: string,
  light: string,
  spec: string,
  halo: string | null,
): void {
  if (halo) {
    strokeSegs(ctx, segs, r * 2 + 9, halo);
    strokeSegs(ctx, segs, r * 2 + 4, halo);
  }
  strokeSegs(ctx, segs, r * 2, SHADE.shadow, 1.5, 2.5);
  strokeSegs(ctx, segs, r * 2, body);
  strokeSegs(ctx, segs, r * 0.95, light, -0.55, -0.7);
  strokeSegs(ctx, segs, Math.max(0.8, r * 0.3), spec, -1, -1.25);
}

/**
 * Polish A2 (display only): a thin neon rail, about 2 px of light on the capsule's centre line, in a
 * soft glow that fills the capsule faintly (so the solid still reads) and fades just past it.
 */
export function neonRails(ctx: Ctx, segs: readonly PinSegDef[], r: number): void {
  strokeSegs(ctx, segs, r * 2 + 8, "rgba(61,255,224,0.035)");
  strokeSegs(ctx, segs, r * 2 + 3, "rgba(61,255,224,0.07)");
  strokeSegs(ctx, segs, r * 2, "rgba(14,127,114,0.42)");
  strokeSegs(ctx, segs, 2.2, "#3DFFE0");
  strokeSegs(ctx, segs, 0.8, "rgba(236,255,251,0.85)", -0.3, -0.4);
}

/** The playfield outline (inside the arch and side walls, shooter lane included). */
function playfieldPath(ctx: Ctx): void {
  ctx.beginPath();
  ctx.ellipse(
    PIN_ARCH.cx,
    PIN_ARCH.cy,
    PIN_ARCH.rx - PIN_WALL_R,
    PIN_ARCH.ry - PIN_WALL_R,
    0,
    Math.PI,
    Math.PI * 2,
  );
  ctx.lineTo(PIN_LANE_OUTER - PIN_WALL_R, PIN_WORLD_H);
  ctx.lineTo(PIN_LEFT_WALL + PIN_WALL_R, PIN_WORLD_H);
  ctx.closePath();
}

const mirrorX = (x: number) => 2 * PIN_MID_X - x;

export function chevron(
  ctx: Ctx,
  cx: number,
  cy: number,
  w: number,
  h: number,
  colour: string,
  width = 2,
): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy + h / 2);
  ctx.lineTo(cx, cy - h / 2);
  ctx.lineTo(cx + w / 2, cy + h / 2);
  ctx.stroke();
}

export function triPath(ctx: Ctx, cx: number, top: number, base: number, half: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.lineTo(cx + half, base);
  ctx.lineTo(cx - half, base);
  ctx.closePath();
}

export function ovalPath(ctx: Ctx, cx: number, cy: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
}

/** A dark glass insert socket with a thin rim (unlit state; the lit state is drawn per frame). */
export function socket(ctx: Ctx, path: () => void, glass: string, rim: string): void {
  path();
  ctx.fillStyle = glass;
  ctx.fill();
  ctx.strokeStyle = rim;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** A soft round pool of light (gradient, no shadowBlur). */
export function pool(ctx: Ctx, x: number, y: number, r: number, colour: string, alpha: number): void {
  if (alpha <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, colour.replace("A)", `${alpha.toFixed(3)})`));
  g.addColorStop(1, colour.replace("A)", "0)"));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/* ============================ The static table ============================ */

const SEG_WALLS = PIN_SEGS.filter(
  (s) => s.kind !== PIN_TARGET && s.kind !== PIN_SLING && s.kind !== PIN_GATE,
);
const SEG_SLINGS = PIN_SEGS.filter((s) => s.kind === PIN_SLING);
const SEG_GATE = PIN_SEGS.filter((s) => s.kind === PIN_GATE);

/** The two slingshot triangles' corners (from the sim's sling faces and their plain sides). */
const SLING_TRIS: [number, number][][] = SEG_SLINGS.map((face) => {
  // The plain side that starts where the kicker face starts ends at the third corner.
  const side = SEG_WALLS.find(
    (s) =>
      s.a[0] === face.a[0] &&
      s.a[1] === face.a[1] &&
      !(s.b[0] === face.b[0] && s.b[1] === face.b[1]),
  );
  const corner: [number, number] = side ? [side.b[0], side.b[1]] : [face.a[0], face.b[1]];
  return [[face.a[0], face.a[1]], corner, [face.b[0], face.b[1]]];
});

/**
 * Polish A2 (display only): the deep purple glow behind the table, added ("lighter") over black, in world
 * units. The world's corners and the play screen's fill round it (pinballGlowFill) paint the same glow,
 * so the light runs on past the world's edges with no seam.
 */
export function paintTableGlow(c: Ctx, x: number, y: number, w: number, h: number): void {
  const g = c.createRadialGradient(PIN_MID_X, 360, 40, PIN_MID_X, 360, 560);
  g.addColorStop(0, "rgba(96,30,170,0.55)");
  g.addColorStop(0.45, "rgba(70,20,130,0.32)");
  g.addColorStop(1, "rgba(40,10,80,0)");
  c.save();
  c.globalCompositeOperation = "lighter";
  c.fillStyle = g;
  c.fillRect(x, y, w, h);
  c.restore();
}

function paintPlayfield(c: Ctx, detail: boolean): void {
  // Black screen round the table (HUD corners) lit by the purple glow behind it, then the playfield inside the walls.
  c.fillStyle = "#000000";
  c.fillRect(0, 0, PIN_WORLD_W, PIN_WORLD_H);
  paintTableGlow(c, 0, 0, PIN_WORLD_W, PIN_WORLD_H);
  c.save();
  playfieldPath(c);
  c.clip();
  const g = c.createLinearGradient(0, 40, 0, PIN_WORLD_H);
  g.addColorStop(0, "#1D0F45");
  g.addColorStop(0.45, "#130A33");
  g.addColorStop(1, "#08041A");
  c.fillStyle = g;
  c.fillRect(0, 0, PIN_WORLD_W, PIN_WORLD_H);

  // Pools of colour under the bumpers, the target bank and the flippers.
  pool(c, 190, 228, 120, "rgba(255,77,255,A)", 0.13);
  pool(c, 190, 352, 80, "rgba(255,138,60,A)", 0.08);
  pool(c, PIN_MID_X, 600, 130, "rgba(255,216,74,A)", 0.05);
  pool(c, 181, 110, 90, "rgba(75,255,122,A)", 0.05);

  // A fixed scatter of faint stars over the upper table (a seeded sequence, not Math.random).
  let s = 0x9e3779b9;
  const rnd = () =>
    ((s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) | 0) >>> 0) / 4294967296;
  for (let i = 0; i < (detail ? 70 : 0); i++) {
    const x = 16 + rnd() * 330,
      y = 50 + rnd() * 330,
      a = 0.08 + rnd() * 0.22;
    c.fillStyle = `rgba(220,230,255,${a.toFixed(3)})`;
    c.fillRect(Math.round(x), Math.round(y), 1, 1);
  }

  // Retro horizon grid over the lower table, converging on the table's centre line.
  const fade = c.createLinearGradient(0, 432, 0, 540);
  fade.addColorStop(0, "rgba(255,77,255,0)");
  fade.addColorStop(1, "rgba(255,77,255,0.085)");
  c.strokeStyle = fade;
  c.lineWidth = 1;
  c.beginPath();
  for (let i = 0; i <= 9; i++) {
    const y = 432 + i * i * 3.4;
    c.moveTo(0, Math.round(y) + 0.5);
    c.lineTo(PIN_LANE_INNER, Math.round(y) + 0.5);
  }
  const vy = 300;
  for (let j = -7; j <= 7; j++) {
    const xb = PIN_MID_X + j * 44;
    const k = (432 - vy) / (PIN_WORLD_H - vy);
    c.moveTo(PIN_MID_X + (xb - PIN_MID_X) * k, 432);
    c.lineTo(xb, PIN_WORLD_H);
  }
  c.stroke();

  // Fine diagonal grain (playfield texture), only in the cached layer.
  if (detail) {
    c.strokeStyle = "rgba(255,255,255,0.022)";
    c.beginPath();
    for (let d = -PIN_WORLD_H; d < PIN_WORLD_W; d += 5) {
      c.moveTo(d, PIN_WORLD_H);
      c.lineTo(d + PIN_WORLD_H, 0);
    }
    c.stroke();
  }

  // Shooter lane floor: brushed steel channel.
  const lg = c.createLinearGradient(PIN_LANE_INNER, 0, PIN_LANE_OUTER, 0);
  lg.addColorStop(0, "#081217");
  lg.addColorStop(0.5, "#13262E");
  lg.addColorStop(1, "#081217");
  c.fillStyle = lg;
  c.fillRect(PIN_LANE_INNER, 150, PIN_LANE_OUTER - PIN_LANE_INNER, PIN_WORLD_H - 150);
  c.fillStyle = "rgba(61,255,224,0.06)";
  for (let y = 170; y < 640; y += 26) c.fillRect(PIN_LANE_X - 1, y, 2, 12);

  // Drain: the outhole between the aprons fades to black.
  const dg = c.createLinearGradient(0, 622, 0, PIN_WORLD_H);
  dg.addColorStop(0, "rgba(0,0,0,0)");
  dg.addColorStop(1, "rgba(0,0,0,0.75)");
  c.fillStyle = dg;
  c.fillRect(
    PIN_FLIP_PIVOTS[0]![0],
    622,
    PIN_FLIP_PIVOTS[1]![0] - PIN_FLIP_PIVOTS[0]![0],
    PIN_WORLD_H - 622,
  );

  // Vignette towards the walls.
  const vg = c.createRadialGradient(PIN_MID_X, 380, 140, PIN_MID_X, 380, 440);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  c.fillStyle = vg;
  c.fillRect(0, 0, PIN_WORLD_W, PIN_WORLD_H);
  c.restore();
}

function paintInlays(c: Ctx): void {
  // Inlaid guides: grooves (dark) with a lit lip, chevrons up the left orbit and the middle.
  const groove = (cx: number, cy: number, w: number, h: number, colour: string) => {
    chevron(c, cx + 0.8, cy + 1, w, h, "rgba(0,0,0,0.55)", 2.4);
    chevron(c, cx, cy, w, h, colour, 1.6);
  };
  for (let y = 380; y <= 490; y += 36) groove(ORBIT_MID, y, 14, 7, "rgba(61,255,224,0.22)");
  for (let i = 0; i < 3; i++)
    groove(PIN_MID_X, 392 + i * 15, 18, 7, `rgba(255,138,60,${(0.32 - i * 0.08).toFixed(2)})`);
  // A thin inlaid ring round the bumper cluster.
  c.strokeStyle = "rgba(255,77,255,0.14)";
  c.lineWidth = 1.5;
  c.beginPath();
  c.ellipse(190, 226, 86, 64, 0, 0, Math.PI * 2);
  c.stroke();

  // Unlit insert sockets: top lanes, multiplier row, target lights, the spinner arrow.
  for (let lane = 0; lane < 3; lane++) {
    const cx = (PIN_LANE_POSTS[lane]! + PIN_LANE_POSTS[lane + 1]!) / 2;
    socket(
      c,
      () => triPath(c, cx, LANE_INSERT_TOP, LANE_INSERT_BASE, 8),
      "#062A13",
      "rgba(75,255,122,0.32)",
    );
  }
  for (let m = 2; m <= PIN_MULT_MAX; m++)
    socket(
      c,
      () => ovalPath(c, multX(m), MULT_Y + 4.5, 12.5, 8),
      "#271B04",
      "rgba(255,216,74,0.32)",
    );
  for (const x of PIN_TARGET_XS)
    socket(c, () => ovalPath(c, x, TARGET_INSERT_Y, 4, 4), "#2A1206", "rgba(255,138,60,0.35)");
  socket(
    c,
    () => triPath(c, ORBIT_MID, SPIN_INSERT_Y - 6, SPIN_INSERT_Y + 6, 8),
    "#2A2004",
    "rgba(255,216,74,0.32)",
  );

  // Drop-target slots: the dark slits each target drops into.
  for (const x of PIN_TARGET_XS) {
    c.fillStyle = "rgba(0,0,0,0.6)";
    c.fillRect(x - PIN_TARGET_HALF - 1, PIN_TARGET_Y - 2, PIN_TARGET_HALF * 2 + 2, 4);
    c.fillStyle = "rgba(255,138,60,0.22)";
    c.fillRect(x - PIN_TARGET_HALF - 1, PIN_TARGET_Y + 2, PIN_TARGET_HALF * 2 + 2, 1);
  }
}

/** Apron plates below each flipper guide (off the playfield: the ball can never reach them). */
export function paintAprons(c: Ctx): void {
  const [lx, ly] = PIN_FLIP_PIVOTS[0]!;
  const left: [number, number][] = [
    [PIN_LEFT_WALL + PIN_WALL_R, 553],
    [104, 619],
    [lx - PIN_WALL_R, ly + PIN_FLIP_R + PIN_WALL_R + 2],
    [lx - PIN_WALL_R, PIN_WORLD_H],
    [PIN_LEFT_WALL + PIN_WALL_R, PIN_WORLD_H],
  ];
  for (let side = 0; side < 2; side++) {
    const pts = side === 0 ? left : left.map(([x, y]) => [mirrorX(x), y] as [number, number]);
    c.save();
    c.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)));
    c.closePath();
    const g = c.createLinearGradient(0, 553, 0, PIN_WORLD_H);
    g.addColorStop(0, "#1E1A36");
    g.addColorStop(1, "#0B0918");
    c.fillStyle = g;
    c.fill();
    c.clip();
    // Bevel: a lit lip along the top edge, a dark one along the inner edge.
    c.strokeStyle = "rgba(61,255,224,0.28)";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(pts[0]![0], pts[0]![1] + 2);
    c.lineTo(pts[1]![0], pts[1]![1] + 2);
    c.stroke();
    // Two inlaid stripes parallel to the guide.
    c.strokeStyle = "rgba(255,77,255,0.22)";
    c.lineWidth = 1.5;
    for (const off of [16, 22]) {
      c.beginPath();
      c.moveTo(pts[0]![0], pts[0]![1] + off);
      c.lineTo(pts[1]![0] + (side === 0 ? -6 : 6), pts[1]![1] + off - 4);
      c.stroke();
    }
    // Rivets.
    const rx = side === 0 ? [22, 92] : [mirrorX(22), mirrorX(92)];
    for (const x of rx) {
      for (const y of [664, 694]) {
        c.fillStyle = "#3A3654";
        c.beginPath();
        c.arc(x, y, 2, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "rgba(255,255,255,0.35)";
        c.fillRect(x - 1, y - 1, 1, 1);
      }
    }
    c.restore();
  }
}

/** The plunger under the waiting ball (decoration in the shooter lane below the ball's rest). */
export function paintPlunger(c: Ctx): void {
  const top = PIN_LANE_Y + PIN_BALL_R + 1;
  // Spring coils.
  c.strokeStyle = "#5C6B78";
  c.lineWidth = 1.5;
  c.beginPath();
  for (let y = top + 10; y < PIN_WORLD_H; y += 4) {
    c.moveTo(PIN_LANE_X - 6, y);
    c.lineTo(PIN_LANE_X + 6, y + 2);
  }
  c.stroke();
  // Rod.
  const rg = c.createLinearGradient(PIN_LANE_X - 2, 0, PIN_LANE_X + 2, 0);
  rg.addColorStop(0, "#5D6878");
  rg.addColorStop(0.5, "#E3EAF4");
  rg.addColorStop(1, "#5D6878");
  c.fillStyle = rg;
  c.fillRect(PIN_LANE_X - 2, top + 5, 4, PIN_WORLD_H - top - 5);
  // Tip.
  const tg = c.createLinearGradient(0, top, 0, top + 6);
  tg.addColorStop(0, "#F4F8FF");
  tg.addColorStop(1, "#6C7788");
  c.fillStyle = tg;
  c.beginPath();
  if (typeof c.roundRect === "function") c.roundRect(PIN_LANE_X - 8, top, 16, 6, 2);
  else c.rect(PIN_LANE_X - 8, top, 16, 6);
  c.fill();
}

export function paintSlingPlastics(c: Ctx): void {
  for (const tri of SLING_TRIS) {
    c.save();
    c.beginPath();
    tri.forEach(([x, y], i) => (i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)));
    c.closePath();
    const [a, m, b] = tri as [[number, number], [number, number], [number, number]];
    // Polish A2: a purple plastic, fine pink hatching and a lit inner triangle.
    const g = c.createLinearGradient(a[0], a[1], b[0], b[1]);
    g.addColorStop(0, "#4A1878");
    g.addColorStop(1, "#2A0C4C");
    c.fillStyle = g;
    c.fill();
    c.clip();
    c.strokeStyle = "rgba(255,110,220,0.26)";
    c.lineWidth = 0.75;
    c.beginPath();
    for (let d = -140; d < 140; d += 4) {
      c.moveTo(a[0] + d, a[1] - 20);
      c.lineTo(a[0] + d + 70, a[1] + 140);
    }
    c.stroke();
    const cx = (a[0] + m[0] + b[0]) / 3;
    const cy = (a[1] + m[1] + b[1]) / 3;
    const inner = tri.map(([x, y]) => [cx + (x - cx) * 0.5, cy + (y - cy) * 0.5] as const);
    c.beginPath();
    inner.forEach(([x, y], i) => (i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)));
    c.closePath();
    const ig = c.createRadialGradient(cx, cy, 1, cx, cy, 26);
    ig.addColorStop(0, "rgba(255,190,250,0.55)");
    ig.addColorStop(1, "rgba(255,77,255,0.18)");
    c.fillStyle = ig;
    c.fill();
    c.strokeStyle = "rgba(255,160,240,0.7)";
    c.lineWidth = 1;
    c.stroke();
    c.restore();
  }
}

/** A chrome post (a small domed cap with a glint). */
export function chromePost(c: Ctx, x: number, y: number, r: number): void {
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, 0.3, x, y, r);
  g.addColorStop(0, "#FFFFFF");
  g.addColorStop(0.45, "#C6CEDC");
  g.addColorStop(1, "#4E5666");
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}

/** A bumper's resting body: skirt ring (outer edge exactly at the collision radius), cap, rim light, star. */
export function paintBumper(c: Ctx, bx: number, by: number): void {
  const R = PIN_BUMPER_R;
  // Contact shadow (off the solid, low and dark).
  c.fillStyle = "rgba(0,0,0,0.42)";
  c.beginPath();
  c.arc(bx + 2, by + 3, R - 1, 0, Math.PI * 2);
  c.fill();
  // Skirt ring with a top-left to bottom-right bevel.
  const rg = c.createLinearGradient(bx - R, by - R, bx + R, by + R);
  rg.addColorStop(0, "#FFB3FF");
  rg.addColorStop(0.45, PIN_COLOURS.bumper);
  rg.addColorStop(1, "#7A1680");
  c.fillStyle = rg;
  c.beginPath();
  c.arc(bx, by, R, 0, Math.PI * 2);
  c.fill();
  // Cap.
  const cg = c.createRadialGradient(bx - 5, by - 6, 1, bx, by, R - 4);
  cg.addColorStop(0, "#6E3784");
  cg.addColorStop(0.6, "#2E0C3A");
  cg.addColorStop(1, "#1A0522");
  c.fillStyle = cg;
  c.beginPath();
  c.arc(bx, by, R - 4, 0, Math.PI * 2);
  c.fill();
  // Rim light on the cap's top-left edge (inside the cap).
  c.strokeStyle = "rgba(255,200,255,0.55)";
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(bx, by, R - 6, Math.PI * 1.05, Math.PI * 1.55);
  c.stroke();
  starPath(c, bx, by, 7.5, 3.2);
  c.fillStyle = "rgba(255,77,255,0.9)";
  c.fill();
  c.fillStyle = "rgba(255,230,255,0.85)";
  c.beginPath();
  c.arc(bx - 0.5, by - 0.5, 1.6, 0, Math.PI * 2);
  c.fill();
}

export function starPath(c: Ctx, x: number, y: number, ro: number, ri: number): void {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? ro : ri;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    if (i === 0) c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  c.closePath();
}

/**
 * Everything that never changes: painted once per device scale into the cached
 * layer (`detail` adds the stars and grain), or directly each frame without it.
 */
function paintTable(c: Ctx, detail: boolean): void {
  c.save();
  paintPlayfield(c, detail);
  paintInlays(c);
  paintAprons(c);
  paintPlunger(c);
  paintSlingPlastics(c);
  PIN_BUMPERS.forEach(([bx, by]) => paintBumper(c, bx, by));
  // Rails, the sling kickers (resting) and the gate, all on their own capsules.
  neonRails(c, SEG_WALLS, PIN_WALL_R);
  // The slingshots' kicker faces: glowing gold rubber.
  strokeSegs(c, SEG_SLINGS, PIN_WALL_R * 2 + 9, "rgba(255,216,74,0.07)");
  strokeSegs(c, SEG_SLINGS, PIN_WALL_R * 2 + 4, "rgba(255,216,74,0.14)");
  bevelRails(
    c,
    SEG_SLINGS,
    PIN_WALL_R,
    SHADE.slingBody,
    SHADE.slingLight,
    SHADE.slingSpec,
    null,
  );
  // Chrome posts at the slingshots' corners (inside the rails' own capsules).
  for (const tri of SLING_TRIS) for (const [x, y] of tri) chromePost(c, x, y, PIN_WALL_R + 0.5);
  for (const g of SEG_GATE)
    capsule(c, g.a[0], g.a[1], g.b[0], g.b[1], g.r, "rgba(61,255,224,0.55)");
  // Spinner brackets: rivets on the lane walls (inside their capsules).
  for (const x of [PIN_LEFT_WALL, PIN_ORBIT_INNER]) {
    c.fillStyle = "#E9FFFB";
    c.beginPath();
    c.arc(x, PIN_SPINNER_Y, 1.8, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

/** Cached table layers keyed by device scale (a few at most: play, reveal, intro). */
const tables = new Map<string, ArtCanvas>();
function tableLayer(ctx: Ctx): ArtCanvas | null {
  const tr = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  if (!tr) return null;
  const ratio = Math.round(Math.min(3, Math.max(1, Math.hypot(tr.a, tr.b))) * 100) / 100;
  const key = String(ratio);
  const old = tables.get(key);
  if (old) return old;
  const layer = artCanvas(Math.ceil(PIN_WORLD_W * ratio), Math.ceil(PIN_WORLD_H * ratio));
  const c = layer && artContext(layer);
  if (!layer || !c) return null;
  c.scale(ratio, ratio);
  paintTable(c as Ctx, true);
  if (tables.size >= 4) tables.delete(tables.keys().next().value!);
  tables.set(key, layer);
  return layer;
}

/* ============================== Per frame ============================== */

function drawLights(ctx: Ctx, state: PinState, bloom: number): void {
  const pulse = (bloom - 7) / 2; // −1…1
  // Lit top lanes.
  for (let lane = 0; lane < 3; lane++) {
    if (((state.lanes >> lane) & 1) === 0) continue;
    const cx = (PIN_LANE_POSTS[lane]! + PIN_LANE_POSTS[lane + 1]!) / 2;
    pool(
      ctx,
      cx,
      (LANE_INSERT_TOP + LANE_INSERT_BASE) / 2 + 2,
      17,
      "rgba(75,255,122,A)",
      0.32 + 0.06 * pulse,
    );
    triPath(ctx, cx, LANE_INSERT_TOP, LANE_INSERT_BASE, 8);
    ctx.fillStyle = PIN_COLOURS.laneOn;
    ctx.fill();
    triPath(ctx, cx, LANE_INSERT_TOP + 4, LANE_INSERT_BASE - 2, 4);
    ctx.fillStyle = "rgba(230,255,236,0.85)";
    ctx.fill();
  }
  // Multiplier inserts and their labels.
  for (let m = 2; m <= PIN_MULT_MAX; m++) {
    const on = state.mult >= m;
    const x = multX(m);
    if (on) {
      pool(ctx, x, MULT_Y + 4.5, 22, "rgba(255,216,74,A)", 0.26 + 0.05 * pulse);
      const g = ctx.createRadialGradient(x - 3, MULT_Y + 2, 1, x, MULT_Y + 4.5, 12.5);
      g.addColorStop(0, "#FFF4C2");
      g.addColorStop(1, "#E0A81E");
      ctx.fillStyle = g;
      ovalPath(ctx, x, MULT_Y + 4.5, 12.5, 8);
      ctx.fill();
    }
    retroText(
      ctx,
      `x${m}`,
      x + 1,
      MULT_Y + 0.5,
      9,
      on ? "#2B1A00" : "rgba(255,216,74,0.42)",
      "center",
    );
  }
  // Target lights: lit while that target is down.
  PIN_TARGET_XS.forEach((x, i) => {
    if (((state.targets >> i) & 1) === 0) return;
    pool(ctx, x, TARGET_INSERT_Y, 11, "rgba(255,138,60,A)", 0.4);
    ctx.fillStyle = "#FFB27A";
    ovalPath(ctx, x, TARGET_INSERT_Y, 4, 4);
    ctx.fill();
  });
  // Spinner arrow: lit while the spinner is lit.
  if (state.tick < state.spinLit) {
    pool(ctx, ORBIT_MID, SPIN_INSERT_Y, 16, "rgba(255,216,74,A)", 0.3 + 0.08 * pulse);
    triPath(ctx, ORBIT_MID, SPIN_INSERT_Y - 6, SPIN_INSERT_Y + 6, 8);
    ctx.fillStyle = PIN_COLOURS.spinnerLit;
    ctx.fill();
  }
}

export function drawSlingFlash(ctx: Ctx, state: PinState): void {
  for (const seg of SEG_SLINGS) {
    const age = state.tick - (state.slingAt[seg.id ?? 0] ?? -999);
    if (age < 0 || age >= GLOW_TICKS) continue;
    const k = 1 - age / GLOW_TICKS;
    strokeSegs(ctx, [seg], seg.r * 2 + 10, `rgba(255,248,214,${(0.18 * k).toFixed(3)})`);
    capsule(ctx, seg.a[0], seg.a[1], seg.b[0], seg.b[1], seg.r, RETRO_WHITE);
  }
}

export function drawBumperFlash(ctx: Ctx, state: PinState): void {
  PIN_BUMPERS.forEach(([bx, by], i) => {
    const age = state.tick - (state.bumperAt[i] ?? -999);
    if (age < 0 || age >= GLOW_TICKS) return;
    const k = 1 - age / GLOW_TICKS;
    // Halo off the solid, then the light inside the bumper's own circle.
    const h = ctx.createRadialGradient(bx, by, PIN_BUMPER_R, bx, by, PIN_BUMPER_R + 16);
    h.addColorStop(0, `rgba(255,77,255,${(0.45 * k).toFixed(3)})`);
    h.addColorStop(1, "rgba(255,77,255,0)");
    ctx.fillStyle = h;
    ctx.beginPath();
    ctx.arc(bx, by, PIN_BUMPER_R + 16, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(bx, by, 2, bx, by, PIN_BUMPER_R);
    g.addColorStop(0, `rgba(255,255,255,${(0.95 * k).toFixed(3)})`);
    g.addColorStop(0.7, `rgba(255,120,255,${(0.75 * k).toFixed(3)})`);
    g.addColorStop(1, `rgba(255,77,255,${(0.9 * k).toFixed(3)})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, PIN_BUMPER_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = RETRO_WHITE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bx, by, PIN_BUMPER_R - 1.5, 0, Math.PI * 2);
    ctx.stroke();
    // Polish A2: the flare, eight short rays of light off the bumper's skirt, fading with the glow.
    ctx.strokeStyle = `rgba(255,190,255,${(0.6 * k).toFixed(3)})`;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let ray = 0; ray < 8; ray++) {
      const a = (ray * Math.PI) / 4 + Math.PI / 8;
      const r0 = PIN_BUMPER_R + 3;
      const r1 = PIN_BUMPER_R + 3 + 9 * k;
      ctx.moveTo(bx + Math.cos(a) * r0, by + Math.sin(a) * r0);
      ctx.lineTo(bx + Math.cos(a) * r1, by + Math.sin(a) * r1);
    }
    ctx.stroke();
  });
}

/** How long a bumper's "+100" rises, in sim ticks. */
const POINTS_TICKS = 36;
/** Polish A2: "+100" (times the multiplier) rising off a struck bumper, from the sim's bumperAt. */
export function drawBumperPoints(ctx: Ctx, state: PinState): void {
  PIN_BUMPERS.forEach(([bx, by], i) => {
    const age = state.tick - (state.bumperAt[i] ?? -999);
    if (age < 0 || age >= POINTS_TICKS) return;
    const k = age / POINTS_TICKS;
    ctx.globalAlpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
    retroText(ctx, `+${PIN_PTS_BUMPER * state.mult}`, bx, by - PIN_BUMPER_R - 12 - 16 * k, 9, "#FFE6FF", "center", 4);
    ctx.globalAlpha = 1;
  });
}

export function drawTargets(ctx: Ctx, state: PinState): void {
  PIN_TARGET_XS.forEach((x, i) => {
    if (((state.targets >> i) & 1) === 1) return;
    const ax = x - PIN_TARGET_HALF,
      bx = x + PIN_TARGET_HALF,
      y = PIN_TARGET_Y;
    capsule(ctx, ax, y, bx, y, PIN_TARGET_R, SHADE.shadow, 1.5, 2.5);
    capsule(ctx, ax, y, bx, y, PIN_TARGET_R, SHADE.targetEdge);
    capsule(ctx, ax, y, bx, y, PIN_TARGET_R - 1.2, PIN_COLOURS.target, 0, -0.5);
    capsule(ctx, ax, y, bx, y, 0.75, SHADE.targetSpec, -0.5, -2);
  });
}

export function drawSpinner(ctx: Ctx, state: PinState, key: Ctx, t: number): void {
  // A bar across the left orbit lane that keeps turning after the ball goes through.
  let memo = spinMemo.get(key);
  if (!memo || state.tick < memo.tick)
    memo = { spins: state.spins, at: t, turns: 0, tick: state.tick };
  if (state.spins > memo.spins) {
    memo.turns = Math.min(16, state.spins - memo.spins + memo.turns);
    memo.at = t;
  }
  memo.spins = state.spins;
  memo.tick = state.tick;
  spinMemo.set(key, memo);
  const spinAge = t - memo.at;
  const spinPhase = t === 0 ? 0 : Math.max(0, memo.turns * 90 - spinAge) / 90;
  const cos = Math.cos(spinPhase * Math.PI);
  const squash = Math.abs(cos);
  const lit = state.tick < state.spinLit;
  const sx0 = PIN_LEFT_WALL + 4,
    sx1 = PIN_ORBIT_INNER - 4;
  const h = 2 + 8 * squash,
    y0 = PIN_SPINNER_Y - h / 2;
  // Polish A2: brushed chrome (gold while lit), shaded across the bar, the lit face flipping side as it turns.
  const body = ctx.createLinearGradient(0, y0, 0, y0 + h);
  body.addColorStop(0, lit ? "#FFF0B0" : "#F2F6FC");
  body.addColorStop(0.5, lit ? "#C99A1E" : "#8C98A8");
  body.addColorStop(1, lit ? "#6E5108" : "#3E4656");
  ctx.fillStyle = body;
  ctx.fillRect(sx0, y0, sx1 - sx0, h);
  const face = Math.max(1, h * 0.55);
  ctx.fillStyle = lit ? "rgba(255,216,74,0.55)" : "rgba(255,255,255,0.35)";
  ctx.fillRect(sx0, cos >= 0 ? y0 : y0 + h - face, sx1 - sx0, face);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.fillRect(sx0 + 2, cos >= 0 ? y0 : y0 + h - 1, sx1 - sx0 - 4, 1);
  // Chrome bearings where the bar meets the lane walls.
  for (const x of [sx0, sx1]) {
    ctx.fillStyle = "#DDE4EE";
    ctx.fillRect(x - 1, PIN_SPINNER_Y - 2, 2, 4);
  }
}

/** A tapered bat: a circle of r0 at (ax, ay) and r1 at (bx, by), joined by their outer tangents. */
export function flipperPath(ctx: Ctx, ax: number, ay: number, bx: number, by: number, r0: number, r1: number): void {
  const dx = bx - ax;
  const dy = by - ay;
  const d = Math.hypot(dx, dy) || 1;
  const base = Math.atan2(dy, dx);
  const off = Math.acos(Math.max(-1, Math.min(1, (r0 - r1) / d)));
  ctx.beginPath();
  ctx.arc(ax, ay, r0, base + off, base - off + Math.PI * 2);
  ctx.arc(bx, by, r1, base - off, base + off);
  ctx.closePath();
}

export function drawFlippers(ctx: Ctx, state: PinState): void {
  for (let side = 0; side < 2; side++) {
    const [pxp, pyp] = PIN_FLIP_PIVOTS[side]!;
    const a = (pinFlipAngle(side, state.flips[side] ?? 0) / 65536) * Math.PI * 2;
    const ux = Math.cos(a),
      uy = Math.sin(a);
    const tx = pxp + ux * PIN_FLIP_LEN,
      ty = pyp + uy * PIN_FLIP_LEN;
    const held = ((state.held >> side) & 1) === 1;
    // The side of the bar facing up the table (screen −y).
    let nx = -uy,
      ny = ux;
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    // Polish A2: a shaped bat, full width at the pivot, tapering to a round tip (inside the swept capsule).
    const tipR = PIN_FLIP_R - 2;
    flipperPath(ctx, pxp + 2, pyp + 3, tx + 2, ty + 3, PIN_FLIP_R, tipR);
    ctx.fillStyle = SHADE.shadow;
    ctx.fill();
    flipperPath(ctx, pxp, pyp, tx, ty, PIN_FLIP_R, tipR);
    ctx.fillStyle = SHADE.flipEdge;
    ctx.fill();
    flipperPath(ctx, pxp + nx * 0.4, pyp + ny * 0.4, tx + nx * 0.4, ty + ny * 0.4, PIN_FLIP_R - 1.4, tipR - 1.2);
    const shade = ctx.createLinearGradient(pxp + nx * PIN_FLIP_R, pyp + ny * PIN_FLIP_R, pxp - nx * PIN_FLIP_R, pyp - ny * PIN_FLIP_R);
    shade.addColorStop(0, held ? "#FFF4B8" : "#FFE68A");
    shade.addColorStop(0.45, held ? SHADE.flipHeld : SHADE.flipBody);
    shade.addColorStop(1, "#C8960F");
    ctx.fillStyle = shade;
    ctx.fill();
    capsule(ctx, pxp + nx * 2.6, pyp + ny * 2.6, tx + nx * 1.4, ty + ny * 1.4, 0.8, SHADE.flipSpec);
    // Chrome pivot cap with a dark ring.
    ctx.fillStyle = "#5A4510";
    ctx.beginPath();
    ctx.arc(pxp, pyp, 4.4, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createRadialGradient(pxp - 1, pyp - 1.5, 0.5, pxp, pyp, 3.6);
    g.addColorStop(0, "#FFFFFF");
    g.addColorStop(0.5, "#C6CEDC");
    g.addColorStop(1, "#5E6676");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(pxp, pyp, 3.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A chrome ball: a soft contact shadow below right, a shaded body exactly at the ball's radius, a specular glint. */
export function drawBall(ctx: Ctx, bx: number, by: number): void {
  const r = PIN_BALL_R;
  ctx.fillStyle = "rgba(0,0,0,0.38)";
  ctx.beginPath();
  ctx.ellipse(bx + 2.5, by + 3.5, r - 0.5, r - 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(bx - 2.6, by - 3, 0.6, bx, by, r);
  g.addColorStop(0, "#FFFFFF");
  g.addColorStop(0.28, "#DCE5F1");
  g.addColorStop(0.62, "#8B98AE");
  g.addColorStop(0.86, "#3D465A");
  g.addColorStop(1, "#A9B6CB");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(bx, by, r, 0, Math.PI * 2);
  ctx.fill();
  // Table light reflected low on the ball (inside its outline).
  ctx.strokeStyle = "rgba(61,255,224,0.55)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(bx, by, r - 1.6, Math.PI * 0.2, Math.PI * 0.75);
  ctx.stroke();
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(bx - 3, by - 3.4, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawWorld(ctx: Ctx, state: PinState, key: Ctx): void {
  const bloom = retroBloom();
  const t = retroClock();
  const layer = tableLayer(ctx);
  if (layer) ctx.drawImage(layer as CanvasImageSource, 0, 0, PIN_WORLD_W, PIN_WORLD_H);
  else paintTable(ctx, false);

  drawLights(ctx, state, bloom);
  drawSlingFlash(ctx, state);
  drawTargets(ctx, state);
  drawSpinner(ctx, state, key, t);
  drawBumperFlash(ctx, state);
  drawFlippers(ctx, state);
  drawBumperPoints(ctx, state);

  // The ball (with a short trail while in play), or waiting in the shooter lane.
  const bx = state.x / 256,
    by = state.y / 256;
  if (state.live) {
    // Polish A2: a fainter trail, so the chrome ball reads first.
    ctx.save();
    ctx.globalAlpha = 0.6;
    const trail = retroTrail(key, state.tick, "ball", bx, by, 6);
    const n = trail.length - 1;
    for (let i = 0; i < n; i++) {
      const p = trail[i]!;
      const k = (i + 1) / (n + 1);
      ctx.fillStyle = `rgba(201,214,232,${(0.22 * k).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.5, PIN_BALL_R * k * 0.85), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  if (state.live || state.lost < PIN_BALLS) drawBall(ctx, bx, by);
  if (!state.live && state.lost < PIN_BALLS && state.wait > 0) {
    const blink = t === 0 || Math.floor(t / 300) % 2 === 0;
    if (blink) retroText(ctx, "^", PIN_LANE_X, 600, 12, PIN_COLOURS.sling, "center");
  }

  // Thumb-zone hints on the apron plates: each lights while its flipper is held.
  for (let side = 0; side < 2; side++) {
    const held = ((state.held >> side) & 1) === 1;
    retroText(
      ctx,
      side === 0 ? "< HOLD" : "HOLD >",
      side === 0 ? 20 : PIN_LANE_INNER - 10,
      PIN_WORLD_H - 22,
      8,
      held ? PIN_COLOURS.flipper : "rgba(255,216,74,0.42)",
      side === 0 ? "left" : "right",
    );
  }

  // One Retro HUD (3 Nov 2026): score top left, the ball top right.
  retroHud(ctx, PIN_WORLD_W, { text: state.points.toLocaleString("en-GB"), colour: PIN_COLOURS.hud }, [
    { text: `BALL ${Math.min(PIN_BALLS, state.launched || 1)}/${PIN_BALLS}`, colour: PIN_COLOURS.hud },
  ]);
  if (state.lost >= PIN_BALLS && state.tick < PIN_RUN_TICKS)
    retroText(ctx, "GAME OVER", PIN_WORLD_W / 2 - 12, 420, 16, "#FF3B5C", "center", 6);
}

function draw(ctx: CanvasRenderingContext2D, state: PinState, size: CanvasSize): void {
  retroScreen(ctx, size, PIN_WORLD_W, PIN_WORLD_H, "fit", (c) =>
    arcadeFx(c, PINBALL_FX, state, () => drawWorld(c, state, ctx)),
  );
}

export const pinballArtGame: ArcadeGame<PinState, ArcadeInputEvent | null> = {
  ...pinballGame,
  draw,
};

/** The art game for a stored pinRev (one revision so far). */
const pinballTargetArtGame: ArcadeGame<PinState, ArcadeInputEvent | null> = { ...pinballArtGame, init: pinballTargetGame.init };
const pinballStrictArtGame: ArcadeGame<PinState, ArcadeInputEvent | null> = { ...pinballArtGame, init: pinballStrictGame.init };
export function pinballArtGameFor(
  rev?: number | null,
): ArcadeGame<PinState, ArcadeInputEvent | null> {
  return rev === PIN_REV_STRICT ? pinballStrictArtGame : rev === PIN_REV_TARGET ? pinballTargetArtGame : pinballArtGame;
}

/**
 * Polish A2 (display only): the play screen's fill round the centred table. The existing dark fill and
 * its five resting lamps (arenaFills' pinballFill), then the table's purple glow over the gap above (the
 * same glow the world's corners carry, so no seam) and a purple light rising from the screen's bottom
 * under it, faint at the world's edge.
 */
export function pinballGlowFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  pinballFill(ctx, view);
  const above = fillAbove(view);
  if (above) paintTableGlow(ctx, above.x, above.y, above.w, above.h);
  const below = fillBelow(view);
  if (!below) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createLinearGradient(0, below.y, 0, below.y + below.h);
  g.addColorStop(0, "rgba(70,20,130,0)");
  g.addColorStop(1, "rgba(70,20,130,0.28)");
  ctx.fillStyle = g;
  ctx.fillRect(below.x, below.y, below.w, below.h);
  ctx.restore();
}
