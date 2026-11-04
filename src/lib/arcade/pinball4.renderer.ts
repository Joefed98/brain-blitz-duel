/**
 * Pinball pinRev 4 art (the world expansion, docs/expansions/e4.md): the taller table in the same Retro
 * look as pinball.renderer.ts (Polish A2: neon rails, chrome, the purple plastics, gold flippers), whose
 * painters it reuses. The lower table is pinRev 1's moved down P4_SHIFT, so its art (aprons, plunger,
 * slingshots, bumpers, targets, spinner and flippers, and their flashes) is drawn by pinball.renderer.ts's
 * own painters under a translate of P4_SHIFT. New here, every solid on its collision shape: the J-O-U-L-Z
 * lanes and letters, the ramp mouths' posts, the jackpot standup, the tilted gate; and, on the ramps' level
 * (no collision: a ball on the playfield passes under them), the two ramps, the plunge rail round the arch
 * and the lock hole with its locked balls. Render only: reads the state, never writes it.
 *
 * Cached: the static table (one layer per device scale) and the ramps (one overlay layer per scale). Per
 * frame: lights, flashes, the balls, the power meter and the HUD. Glows are skipped under reduced effects;
 * reduced motion holds every blink and pulse still.
 */
import { arcadeFx, type ArcadeFxSpec } from "./arcadeFx.renderer";
import { PINBALL_BULBS } from "./arcadeFxGames.renderer";
import { artCanvas, artContext, type ArtCanvas } from "./cache.renderer";
import { fillAbove, fillBelow, pinball4Fill } from "./arenaFills.renderer";
import type { ArenaSceneView } from "./arenaScene.renderer";
import { type ArcadeGame, type ArcadeInputEvent, type CanvasSize } from "./engine";
import { pinIsExpanded, PIN_BALLS, PIN_BALL_R, PIN_MULT_MAX, pinRunTicksOf, PIN_SLING, PIN_TARGET, PIN_GATE, PIN_WALL_R, type PinSegDef, type PinState } from "./pinball";
import {
  drawBall,
  drawBumperFlash,
  drawBumperPoints,
  drawFlippers,
  drawSlingFlash,
  drawSpinner,
  drawTargets,
  bevelRails,
  capsule,
  chevron,
  chromePost,
  neonRails,
  ovalPath,
  paintAprons,
  paintBumper,
  paintPlunger,
  paintSlingPlastics,
  pinballArtGameFor,
  PIN_COLOURS,
  pool,
  SHADE,
  socket,
  strokeSegs,
  triPath,
} from "./pinball.renderer";
import {
  p4JackpotLit,
  p4PlungeLane,
  p4PowerAt,
  p4RailTicks,
  pinball4Game,
  pinball5Game,
  pinball6Game,
  P4_ARCH,
  P4_BUMPERS,
  P4_COMBO_TICKS,
  P4_JACKPOT,
  P4_JACKPOT_KIND,
  P4_LANE_COUNT,
  P4_LANE_INNER,
  P4_LANE_OUTER,
  P4_LANE_POSTS,
  P4_LANE_POST_BOTTOM,
  P4_LANE_SENSOR_Y,
  P4_LANE_X,
  P4_LEFT_WALL,
  P4_LETTERS,
  P4_LOCK_RIDE_TICKS,
  P4_LOCK_X,
  P4_LOCK_Y,
  P4_MID_X,
  P4_ORBIT_INNER,
  P4_POWER_MAX,
  P4_RAIL,
  P4_RAIL_DROP_Y,
  P4_RAMPS,
  P4_RAMP_PATHS,
  P4_RAMP_POST_BOTTOM,
  P4_RAMP_TICKS,
  P4_RAMP_Y,
  P4_RIDE_LOCK,
  P4_SEGS,
  P4_SHIFT,
  P4_SPINNER_Y,
  P4_TARGET_XS,
  P4_TARGET_Y,
  P4_WORLD_H,
  P4_WORLD_W,
  PIN_REV_EXPAND,
  PIN_REV_LONG,
  PIN_REV_STD,
  type P4Ball,
  type Pin4State,
} from "./pinball4";
import { retroBloom, retroClock, retroHud, retroScreen, retroText, retroTrail, type RetroHudItem } from "./retro.renderer";
import { reducedMotion } from "./art.renderer";
import { arcadeReducedEffects } from "../fx/lowEnd";

type Ctx = CanvasRenderingContext2D;

const S = P4_SHIFT;
/**
 * The table's palette. Joe's phone notes (27 Oct 2026, a second pass): the original vivid pinks, purples and greens
 * (bumpers, targets, lanes, lights, flippers and accents) on a rich purple playfield, with the smoked ramp tubes, square
 * portals and the LOCK label. The ramps' accents: the left one cyan, the right magenta; the plunge rail chrome; the lock gold.
 */
const TABLE_TOP = "#3A1468";
const TABLE_MID = "#25094A";
const TABLE_BOTTOM = "#13052A";
const RAMP_COLOURS = ["#3DFFE0", "#FF4DFF"] as const;
/** The ramps' accents as "r,g,b" (for translucent pools and edges). */
const RAMP_RGB = ["61,255,224", "255,77,255"] as const;
const LOCK_GOLD = "#FFD84A";
const LETTER_ON = "#4BFF7A";

/* ============================ The static table ============================ */

const SEG_WALLS = P4_SEGS.filter((s) => s.kind !== PIN_TARGET && s.kind !== PIN_SLING && s.kind !== PIN_GATE && s.kind !== P4_JACKPOT_KIND);
const SEG_SLINGS = P4_SEGS.filter((s) => s.kind === PIN_SLING);
const SEG_GATE = P4_SEGS.filter((s) => s.kind === PIN_GATE);

/** The playfield outline (inside the arch and side walls, shooter lane included). */
function playfieldPath(c: Ctx): void {
  c.beginPath();
  c.ellipse(P4_ARCH.cx, P4_ARCH.cy, P4_ARCH.rx - PIN_WALL_R, P4_ARCH.ry - PIN_WALL_R, 0, Math.PI, Math.PI * 2);
  c.lineTo(P4_LANE_OUTER - PIN_WALL_R, P4_WORLD_H);
  c.lineTo(P4_LEFT_WALL + PIN_WALL_R, P4_WORLD_H);
  c.closePath();
}

/** The deep purple glow behind the table (pinball.renderer's, centred on the taller table). */
export function paintTable4Glow(c: Ctx, x: number, y: number, w: number, h: number): void {
  const g = c.createRadialGradient(P4_MID_X, 420, 40, P4_MID_X, 420, 640);
  g.addColorStop(0, "rgba(120,36,200,0.55)");
  g.addColorStop(0.45, "rgba(84,24,150,0.32)");
  g.addColorStop(1, "rgba(48,12,96,0)");
  c.save();
  c.globalCompositeOperation = "lighter";
  c.fillStyle = g;
  c.fillRect(x, y, w, h);
  c.restore();
}

function paintPlayfield(c: Ctx, detail: boolean): void {
  c.fillStyle = "#000000";
  c.fillRect(0, 0, P4_WORLD_W, P4_WORLD_H);
  paintTable4Glow(c, 0, 0, P4_WORLD_W, P4_WORLD_H);
  c.save();
  playfieldPath(c);
  c.clip();
  const g = c.createLinearGradient(0, 40, 0, P4_WORLD_H);
  g.addColorStop(0, TABLE_TOP);
  g.addColorStop(0.5, TABLE_MID);
  g.addColorStop(1, TABLE_BOTTOM);
  c.fillStyle = g;
  c.fillRect(0, 0, P4_WORLD_W, P4_WORLD_H);

  // Pools of colour: the lanes, the ramps, the bumpers, the target bank and the flippers.
  pool(c, 186, 110, 110, "rgba(75,255,122,A)", 0.06);
  pool(c, 80, 260, 90, "rgba(61,255,224,A)", 0.06);
  pool(c, 306, 250, 90, "rgba(255,77,255,A)", 0.06);
  pool(c, 190, 228 + S, 120, "rgba(255,77,255,A)", 0.13);
  pool(c, 190, 352 + S, 80, "rgba(255,138,60,A)", 0.08);
  pool(c, P4_MID_X, 600 + S, 130, "rgba(255,216,74,A)", 0.05);

  let seed = 0x9e3779b9;
  const rnd = () => ((seed = (Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) | 0) >>> 0) / 4294967296;
  for (let i = 0; i < (detail ? 110 : 0); i++) {
    const x = 16 + rnd() * 330, y = 50 + rnd() * 450, a = 0.08 + rnd() * 0.22;
    c.fillStyle = `rgba(220,230,255,${a.toFixed(3)})`;
    c.fillRect(Math.round(x), Math.round(y), 1, 1);
  }

  // The retro horizon grid over the lower table (pinRev 1's, moved down with it).
  const top = 432 + S;
  const fade = c.createLinearGradient(0, top, 0, 540 + S);
  fade.addColorStop(0, "rgba(255,77,255,0)");
  fade.addColorStop(1, "rgba(255,77,255,0.085)");
  c.strokeStyle = fade;
  c.lineWidth = 1;
  c.beginPath();
  for (let i = 0; i <= 9; i++) {
    const y = top + i * i * 3.4;
    c.moveTo(0, Math.round(y) + 0.5);
    c.lineTo(P4_LANE_INNER, Math.round(y) + 0.5);
  }
  const vy = 300 + S;
  for (let j = -7; j <= 7; j++) {
    const xb = P4_MID_X + j * 44;
    const k = (top - vy) / (P4_WORLD_H - vy);
    c.moveTo(P4_MID_X + (xb - P4_MID_X) * k, top);
    c.lineTo(xb, P4_WORLD_H);
  }
  c.stroke();
  if (detail) {
    c.strokeStyle = "rgba(255,255,255,0.022)";
    c.beginPath();
    for (let d = -P4_WORLD_H; d < P4_WORLD_W; d += 5) {
      c.moveTo(d, P4_WORLD_H);
      c.lineTo(d + P4_WORLD_H, 0);
    }
    c.stroke();
  }

  // Shooter lane floor.
  const lg = c.createLinearGradient(P4_LANE_INNER, 0, P4_LANE_OUTER, 0);
  lg.addColorStop(0, "#0E0620");
  lg.addColorStop(0.5, "#1E0E3C");
  lg.addColorStop(1, "#0E0620");
  c.fillStyle = lg;
  c.fillRect(P4_LANE_INNER, 150, P4_LANE_OUTER - P4_LANE_INNER, P4_WORLD_H - 150);

  // Drain.
  const dg = c.createLinearGradient(0, 622 + S, 0, P4_WORLD_H);
  dg.addColorStop(0, "rgba(0,0,0,0)");
  dg.addColorStop(1, "rgba(0,0,0,0.75)");
  c.fillStyle = dg;
  c.fillRect(113, 622 + S, 249 - 113, P4_WORLD_H - 622 - S);

  const vg = c.createRadialGradient(P4_MID_X, 440, 160, P4_MID_X, 440, 520);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.55)");
  c.fillStyle = vg;
  c.fillRect(0, 0, P4_WORLD_W, P4_WORLD_H);
  c.restore();
}

const ORBIT_MID = (P4_LEFT_WALL + P4_ORBIT_INNER) / 2;
const LANE_INSERT_TOP = P4_LANE_POST_BOTTOM + 8;
const LANE_INSERT_BASE = P4_LANE_POST_BOTTOM + 20;
const laneCentre = (lane: number) => (P4_LANE_POSTS[lane]! + P4_LANE_POSTS[lane + 1]!) / 2;
const MULT_Y = 470 + S;
const multX = (m: number) => 181 + (m - 2) * 28 - 42;
const TARGET_INSERT_Y = P4_TARGET_Y + 17;
const SPIN_INSERT_Y = P4_SPINNER_Y + 38;
/** The ramp mouths' arrow inserts and the lock's insert under the right ramp. */
const rampMouthX = (i: number) => (P4_RAMPS[i]!.x0 + P4_RAMPS[i]!.x1) / 2;
const RAMP_INSERT_Y = P4_RAMP_POST_BOTTOM + 14;
const JACKPOT_INSERT_Y = P4_JACKPOT.a[1] - 16;

function paintInlays(c: Ctx): void {
  const groove = (cx: number, cy: number, w: number, h: number, colour: string) => {
    chevron(c, cx + 0.8, cy + 1, w, h, "rgba(0,0,0,0.55)", 2.4);
    chevron(c, cx, cy, w, h, colour, 1.6);
  };
  for (let y = 380 + S; y <= 490 + S; y += 36) groove(ORBIT_MID, y, 14, 7, "rgba(61,255,224,0.22)");
  for (let i = 0; i < 3; i++) groove(P4_MID_X, 392 + S + i * 15, 18, 7, `rgba(255,138,60,${(0.32 - i * 0.08).toFixed(2)})`);
  c.strokeStyle = "rgba(255,77,255,0.14)";
  c.lineWidth = 1.5;
  c.beginPath();
  c.ellipse(190, 226 + S, 86, 64, 0, 0, Math.PI * 2);
  c.stroke();
  // Grooves leading up into each ramp mouth.
  P4_RAMPS.forEach((_, i) => {
    for (let k = 0; k < 2; k++) groove(rampMouthX(i), RAMP_INSERT_Y + 22 + k * 13, 14, 6, `rgba(${RAMP_RGB[i]},0.2)`);
  });

  // Unlit sockets: five letter lanes, the multiplier row, target lights, the spinner arrow, ramp arrows, the jackpot.
  for (let lane = 0; lane < P4_LANE_COUNT; lane++) socket(c, () => triPath(c, laneCentre(lane), LANE_INSERT_TOP, LANE_INSERT_BASE, 8), "#062A13", "rgba(75,255,122,0.32)");
  for (let m = 2; m <= PIN_MULT_MAX; m++) socket(c, () => ovalPath(c, multX(m), MULT_Y + 4.5, 12.5, 8), "#271B04", "rgba(255,216,74,0.32)");
  for (const x of P4_TARGET_XS) socket(c, () => ovalPath(c, x, TARGET_INSERT_Y, 4, 4), "#2A1206", "rgba(255,138,60,0.35)");
  socket(c, () => triPath(c, ORBIT_MID, SPIN_INSERT_Y - 6, SPIN_INSERT_Y + 6, 8), "#2A2004", "rgba(255,216,74,0.32)");
  P4_RAMPS.forEach((_, i) => socket(c, () => triPath(c, rampMouthX(i), RAMP_INSERT_Y - 6, RAMP_INSERT_Y + 6, 9), "#10102A", `rgba(${RAMP_RGB[i]},0.4)`));
  socket(c, () => ovalPath(c, P4_MID_X + 9, JACKPOT_INSERT_Y, 30, 7), "#2A0A26", "rgba(255,77,255,0.35)");
  for (const x of P4_TARGET_XS) {
    c.fillStyle = "rgba(0,0,0,0.6)";
    c.fillRect(x - 8, P4_TARGET_Y - 2, 16, 4);
    c.fillStyle = "rgba(255,138,60,0.22)";
    c.fillRect(x - 8, P4_TARGET_Y + 2, 16, 1);
  }
}

/** The two slingshots' corners (from the sim's kicker faces), for their chrome posts. */
const SLING_TRIS: [number, number][][] = SEG_SLINGS.map((face) => {
  const side = SEG_WALLS.find((s) => s.a[0] === face.a[0] && s.a[1] === face.a[1] && !(s.b[0] === face.b[0] && s.b[1] === face.b[1]));
  const corner: [number, number] = side ? [side.b[0], side.b[1]] : [face.a[0], face.b[1]];
  return [[face.a[0], face.a[1]], corner, [face.b[0], face.b[1]]];
});

function paintTable(c: Ctx, detail: boolean): void {
  c.save();
  paintPlayfield(c, detail);
  paintInlays(c);
  // pinRev 1's lower table art, drawn where the lower table now sits.
  c.save();
  c.translate(0, S);
  paintAprons(c);
  paintPlunger(c);
  paintSlingPlastics(c);
  c.restore();
  P4_BUMPERS.forEach(([bx, by]) => paintBumper(c, bx, by));
  neonRails(c, SEG_WALLS, PIN_WALL_R);
  strokeSegs(c, SEG_SLINGS, PIN_WALL_R * 2 + 9, "rgba(255,216,74,0.07)");
  strokeSegs(c, SEG_SLINGS, PIN_WALL_R * 2 + 4, "rgba(255,216,74,0.14)");
  bevelRails(c, SEG_SLINGS, PIN_WALL_R, SHADE.slingBody, SHADE.slingLight, SHADE.slingSpec, null);
  for (const tri of SLING_TRIS) for (const [x, y] of tri) chromePost(c, x, y, PIN_WALL_R + 0.5);
  for (const g of SEG_GATE) capsule(c, g.a[0], g.a[1], g.b[0], g.b[1], g.r, "rgba(61,255,224,0.55)");
  for (const x of [P4_LEFT_WALL, P4_ORBIT_INNER]) {
    c.fillStyle = "#E9FFFB";
    c.beginPath();
    c.arc(x, P4_SPINNER_Y, 1.8, 0, Math.PI * 2);
    c.fill();
  }
  // Chrome caps on the lane and ramp-mouth posts (inside their capsules).
  for (const s of SEG_WALLS) if (s.a[0] === s.b[0] && s.b[1] - s.a[1] <= 32) chromePost(c, s.a[0], s.a[1], PIN_WALL_R);
  // The ramps' level over the playfield (painted into the same layer: one image a frame).
  paintRamps(c);
  c.restore();
}

/** Cached layers keyed by device scale (play, reveal, intro). */
function cachedLayer(store: Map<string, ArtCanvas>, ctx: Ctx, w: number, h: number, paint: (c: Ctx) => void): ArtCanvas | null {
  const tr = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  if (!tr) return null;
  const ratio = Math.round(Math.min(3, Math.max(1, Math.hypot(tr.a, tr.b))) * 100) / 100;
  const key = String(ratio);
  const old = store.get(key);
  if (old) return old;
  const layer = artCanvas(Math.ceil(w * ratio), Math.ceil(h * ratio));
  const c = layer && artContext(layer);
  if (!layer || !c) return null;
  c.scale(ratio, ratio);
  paint(c as Ctx);
  if (store.size >= 4) store.delete(store.keys().next().value!);
  store.set(key, layer);
  return layer;
}
const tables = new Map<string, ArtCanvas>();

/* =============================== The ramps =============================== */

/** A path along polyline points (world px). */
function linePath(c: Ctx, pts: readonly (readonly [number, number])[]): void {
  c.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)));
}

/** The plunge rail round the inside of the arch: from the shooter lane's top (u 0) to above lane J (u 1). */
const RAIL_A0 = 0.15;
const RAIL_A1 = Math.PI * 0.7;
function railPoint(u: number): [number, number] {
  // 16 px inside the arch, from just above the gate round to over lane J.
  const a = RAIL_A0 + u * (RAIL_A1 - RAIL_A0);
  return [P4_ARCH.cx + (P4_ARCH.rx - 16) * Math.cos(a), P4_ARCH.cy - (P4_ARCH.ry - 16) * Math.sin(a)];
}

/**
 * The ramps on their raised level, drawn as tunnels (27 Oct 2026, Joe's phone notes: subtler, slicker, squared-off
 * entrances): a smoked-glass tube on the ramp's path with a fine lit edge each side, faint hoops along it and a
 * soft sheen, opening at the playfield in a square portal across the mouth; then the plunge rail as a chrome
 * wire round the arch and the lock hole on the right ramp. Painted once into a layer over the playfield; the
 * tube is translucent, so a ball on the playfield under it still shows. No collision: art only.
 */
function paintRamps(c: Ctx): void {
  P4_RAMP_PATHS.forEach((path, i) => {
    const rgb = RAMP_RGB[i]!;
    c.save();
    c.lineCap = "butt";
    c.lineJoin = "round";
    // A soft drop shadow, then the edges (the full width) with the tube's body over all but their outer 1.5 px.
    c.save();
    c.translate(3, 4);
    linePath(c, path);
    c.strokeStyle = "rgba(0,0,0,0.28)";
    c.lineWidth = 22;
    c.stroke();
    c.restore();
    linePath(c, path);
    c.strokeStyle = `rgba(${rgb},0.65)`;
    c.lineWidth = 22;
    c.stroke();
    linePath(c, path);
    c.strokeStyle = "rgba(16,7,30,0.8)";
    c.lineWidth = 19;
    c.stroke();
    linePath(c, path);
    c.strokeStyle = `rgba(${rgb},0.06)`;
    c.lineWidth = 15;
    c.stroke();
    // The sheen: one thin highlight along the tube's upper-left side.
    c.save();
    c.translate(-3, -2);
    linePath(c, path);
    c.strokeStyle = "rgba(255,255,255,0.09)";
    c.lineWidth = 2;
    c.stroke();
    c.restore();
    // Hoops across the tube, faint, every 18 px.
    c.strokeStyle = `rgba(${rgb},0.13)`;
    c.lineWidth = 1;
    for (let k = 0; k < path.length - 1; k++) {
      const [ax, ay] = path[k]!;
      const [bx, by] = path[k + 1]!;
      const len = Math.hypot(bx - ax, by - ay);
      const nx = -(by - ay) / len, ny = (bx - ax) / len;
      for (let d = 16; d < len; d += 18) {
        const x = ax + ((bx - ax) * d) / len, y = ay + ((by - ay) * d) / len;
        c.beginPath();
        c.moveTo(x - nx * 9.5, y - ny * 9.5);
        c.lineTo(x + nx * 9.5, y + ny * 9.5);
        c.stroke();
      }
    }
    // The entrance: a square portal across the mouth (path[0], facing down the playfield), dark inside; the right
    // ramp's far end, where it drops into the left orbit, gets the same portal. (The left ramp runs on onto the rail.)
    tunnelPortal(c, path[0]!, path[1]!, rgb);
    if (i === 1) tunnelPortal(c, path[path.length - 1]!, path[path.length - 2]!, rgb);
    c.restore();
  });
  // The plunge rail: two thin chrome wires.
  c.save();
  c.lineCap = "round";
  for (const [w, colour] of [[4, "rgba(0,0,0,0.4)"], [1.6, "#C6CEDC"]] as const) {
    for (const off of [-5, 5]) {
      c.beginPath();
      c.moveTo(P4_LANE_X + off, 152);
      for (let k = 0; k <= 24; k++) {
        const [x, y] = railPoint(k / 24);
        c.lineTo(x + off * 0.3, y + off * 0.8);
      }
      c.strokeStyle = colour;
      c.lineWidth = w;
      c.stroke();
    }
  }
  c.restore();
  // The lock hole: a dark well in a gold ring, on the right ramp.
  c.save();
  const g = c.createRadialGradient(P4_LOCK_X, P4_LOCK_Y, 2, P4_LOCK_X, P4_LOCK_Y, 12);
  g.addColorStop(0, "#000000");
  g.addColorStop(0.7, "#120618");
  g.addColorStop(1, "#3A1F00");
  c.fillStyle = g;
  c.beginPath();
  c.arc(P4_LOCK_X, P4_LOCK_Y, 12, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = LOCK_GOLD;
  c.lineWidth = 2;
  c.stroke();
  retroText(c, "LOCK", P4_LOCK_X, P4_LOCK_Y - 25, 9, LOCK_GOLD, "center", 3);
  c.restore();
}

/** A tunnel's square portal at `at`, its depth running toward `into` (a dark well, a lit frame and lip). */
function tunnelPortal(c: Ctx, at: readonly [number, number], into: readonly [number, number], rgb: string): void {
  c.save();
  c.translate(at[0], at[1]);
  c.rotate(Math.atan2(into[1] - at[1], into[0] - at[0]) - Math.PI / 2);
  const g = c.createLinearGradient(0, -2, 0, 9);
  g.addColorStop(0, "rgba(4,2,10,0.95)");
  g.addColorStop(1, "rgba(16,7,30,0.6)");
  c.fillStyle = g;
  c.fillRect(-12, -2, 24, 11);
  c.strokeStyle = `rgba(${rgb},0.75)`;
  c.lineWidth = 1.5;
  c.strokeRect(-12.25, -2.25, 24.5, 11.5);
  c.fillStyle = `rgba(${rgb},0.85)`;
  c.fillRect(-12.5, -3, 25, 1.5);
  c.restore();
}

/* ============================== Per frame ============================== */

/** A blink that holds on under reduced motion. */
function blink(t: number, ms: number): boolean {
  return t === 0 || Math.floor(t / ms) % 2 === 0;
}

/** The skill shot's flashing lane while the plunge is charging or the ball is on its way (−1 none). */
function skillLane(s: Pin4State): number {
  if (s.skillLane < 0) return -1;
  if (!s.live && s.charge >= 0) return s.skillLane;
  return s.skillOpen ? s.skillLane : -1;
}

function drawLights(ctx: Ctx, s: Pin4State, bloom: number, t: number): void {
  const pulse = (bloom - 7) / 2;
  const glow = !arcadeReducedEffects();
  const flash = skillLane(s);
  // J-O-U-L-Z: lit letters green; the skill shot's lane blinks gold.
  for (let lane = 0; lane < P4_LANE_COUNT; lane++) {
    const cx = laneCentre(lane);
    const lit = ((s.joulz >> lane) & 1) === 1;
    const gold = lane === flash && blink(t, 180);
    if (lit || gold) {
      if (glow) pool(ctx, cx, (LANE_INSERT_TOP + LANE_INSERT_BASE) / 2 + 2, 17, gold ? "rgba(255,216,74,A)" : "rgba(75,255,122,A)", 0.32 + 0.06 * pulse);
      triPath(ctx, cx, LANE_INSERT_TOP, LANE_INSERT_BASE, 8);
      ctx.fillStyle = gold ? LOCK_GOLD : PIN_COLOURS.laneOn;
      ctx.fill();
    }
    retroText(ctx, P4_LETTERS[lane]!, cx, LANE_INSERT_BASE + 4, 10, lit ? LETTER_ON : gold ? LOCK_GOLD : "rgba(75,255,122,0.62)", "center", lit && glow ? 4 : 0);
  }
  // The multiplier inserts.
  for (let m = 2; m <= PIN_MULT_MAX; m++) {
    const on = s.mult >= m;
    const x = multX(m);
    if (on) {
      if (glow) pool(ctx, x, MULT_Y + 4.5, 22, "rgba(255,216,74,A)", 0.26 + 0.05 * pulse);
      const g = ctx.createRadialGradient(x - 3, MULT_Y + 2, 1, x, MULT_Y + 4.5, 12.5);
      g.addColorStop(0, "#FFF4C2");
      g.addColorStop(1, "#E0A81E");
      ctx.fillStyle = g;
      ovalPath(ctx, x, MULT_Y + 4.5, 12.5, 8);
      ctx.fill();
    }
    retroText(ctx, `x${m}`, x + 1, MULT_Y + 0.5, 9, on ? "#2B1A00" : "rgba(255,226,120,0.85)", "center");
  }
  P4_TARGET_XS.forEach((x, i) => {
    if (((s.targets >> i) & 1) === 0) return;
    if (glow) pool(ctx, x, TARGET_INSERT_Y, 11, "rgba(255,138,60,A)", 0.4);
    ctx.fillStyle = "#FFB27A";
    ovalPath(ctx, x, TARGET_INSERT_Y, 4, 4);
    ctx.fill();
  });
  if (s.tick < s.spinLit) {
    if (glow) pool(ctx, ORBIT_MID, SPIN_INSERT_Y, 16, "rgba(255,216,74,A)", 0.3 + 0.08 * pulse);
    triPath(ctx, ORBIT_MID, SPIN_INSERT_Y - 6, SPIN_INSERT_Y + 6, 8);
    ctx.fillStyle = PIN_COLOURS.spinnerLit;
    ctx.fill();
  }
  // Ramp arrows: gold while the lock is lit (a ramp shot locks), bright while a combo is on, else dim.
  const comboOn = s.combo > 0 && s.tick - s.rampExitAt <= P4_COMBO_TICKS && s.rampExitAt > 0;
  P4_RAMPS.forEach((_, i) => {
    const x = rampMouthX(i);
    const lockLit = s.lockLit === 1;
    const on = lockLit || comboOn;
    if (!on) return;
    const colour = lockLit ? LOCK_GOLD : RAMP_COLOURS[i]!;
    if (glow) pool(ctx, x, RAMP_INSERT_Y, 18, lockLit ? "rgba(255,216,74,A)" : `rgba(${RAMP_RGB[i]},A)`, 0.3 + 0.08 * pulse);
    if (blink(t, 260) || !comboOn) {
      triPath(ctx, x, RAMP_INSERT_Y - 6, RAMP_INSERT_Y + 6, 9);
      ctx.fillStyle = colour;
      ctx.fill();
    }
    retroText(ctx, lockLit ? "LOCK" : `x${s.combo + 1}`, x, RAMP_INSERT_Y + 8.5, 8, colour, "center");
  });
  // The jackpot standup's insert, lit through multiball.
  if (p4JackpotLit(s)) {
    if (glow) pool(ctx, P4_MID_X + 9, JACKPOT_INSERT_Y, 30, "rgba(255,77,255,A)", 0.35 + 0.1 * pulse);
    ovalPath(ctx, P4_MID_X + 9, JACKPOT_INSERT_Y, 30, 7);
    ctx.fillStyle = blink(t, 200) ? "#FF9BFF" : "#FF4DFF";
    ctx.fill();
  }
  retroText(ctx, "JACKPOT", P4_MID_X + 9, JACKPOT_INSERT_Y - 4, 8, p4JackpotLit(s) ? "#2A0A26" : "rgba(255,140,255,0.85)", "center");
}

/** The jackpot standup on its capsule: gold-rimmed magenta, bright and flashing when lit or just hit. */
function drawJackpot(ctx: Ctx, s: Pin4State, t: number): void {
  const [ax, ay] = P4_JACKPOT.a;
  const [bx, by] = P4_JACKPOT.b;
  const lit = p4JackpotLit(s);
  const hit = s.tick - s.jackpotAt < 12;
  capsule(ctx, ax, ay, bx, by, PIN_WALL_R, SHADE.shadow, 1.5, 2.5);
  capsule(ctx, ax, ay, bx, by, PIN_WALL_R, lit ? "#A3168F" : "#5A1050");
  capsule(ctx, ax, ay, bx, by, PIN_WALL_R - 1, hit ? "#FFFFFF" : lit && blink(t, 200) ? "#FF9BFF" : lit ? "#FF4DFF" : "#8A2A7E", 0, -0.4);
  capsule(ctx, ax, ay, bx, by, 0.7, "rgba(255,230,255,0.8)", -0.4, -1.4);
}

/** Where a ball is drawn: on the playfield, or along its ramp, the lock path or the plunge rail. */
function ballPoint(s: Pin4State, b: P4Ball): { x: number; y: number; raised: boolean } {
  if (!b.ride) return { x: b.x / 256, y: b.y / 256, raised: false };
  if (b.ride === P4_RAIL) {
    // Up from the gate onto the rail, round the arch to over its lane, then the drop point.
    const k = Math.min(1, b.rideT / Math.max(1, p4RailTicks(s.railX)));
    const end = railFor(s.railX);
    const pts: (readonly [number, number])[] = [[P4_LANE_X, 150]];
    for (let i = 0; i <= 16; i++) pts.push(railPoint((end * i) / 16));
    pts.push([s.railX, P4_RAIL_DROP_Y]);
    return { ...along(pts, k), raised: true };
  }
  const lockRide = b.ride > P4_RIDE_LOCK;
  const side = (lockRide ? b.ride - P4_RIDE_LOCK : b.ride) - 1;
  const pts = lockRide ? LOCK_PATHS[side]! : RIDE_PATHS[side]!;
  const k = Math.min(1, b.rideT / (lockRide ? P4_LOCK_RIDE_TICKS : P4_RAMP_TICKS));
  return { ...along(pts, k), raised: true };
}

/** The rail's points from x0 to x1 (px; the rail runs right to left as u rises). */
function railBetween(x0: number, x1: number): [number, number][] {
  const a = railFor(Math.max(x0, x1)), b = railFor(Math.min(x0, x1));
  const out: [number, number][] = [];
  for (let i = 0; i <= 12; i++) out.push(railPoint(a + ((b - a) * i) / 12));
  return x0 <= x1 ? out.reverse() : out;
}

/** A ball's ride: the left ramp up onto the rail and along it to the U lane; the right ramp all the way. */
const RIDE_PATHS: (readonly [number, number])[][] = [
  [...P4_RAMP_PATHS[0]!, ...railBetween(84, 186), [186, P4_RAIL_DROP_Y]],
  [...P4_RAMP_PATHS[1]!],
];
/** A ride into the lit lock: the left ramp along the rail to over the hole; the right ramp to the hole on its way. */
const LOCK_PATHS: (readonly [number, number])[][] = [
  [...P4_RAMP_PATHS[0]!, ...railBetween(84, 296), [P4_LOCK_X, P4_LOCK_Y]],
  [...P4_RAMP_PATHS[1]!.slice(0, 3), [P4_LOCK_X, P4_LOCK_Y]],
];

/** The rail's angle fraction (0…1) where it is over x. */
function railFor(x: number): number {
  let best = 1;
  for (let k = 0; k <= 60; k++) {
    const u = k / 60;
    if (railPoint(u)[0] <= x) {
      best = u;
      break;
    }
  }
  return best;
}

function along(pts: readonly (readonly [number, number])[], k: number): { x: number; y: number } {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  let left = k * total;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1]!;
    const [bx, by] = pts[i]!;
    const len = Math.hypot(bx - ax, by - ay);
    if (left <= len || i === pts.length - 1) {
      const f = len > 0 ? Math.min(1, left / len) : 1;
      return { x: ax + (bx - ax) * f, y: ay + (by - ay) * f };
    }
    left -= len;
  }
  const [x, y] = pts[pts.length - 1]!;
  return { x, y };
}

/** A ball and its faint trail (pinball.renderer's chrome ball); a ball on a ramp casts a wider shadow. */
function drawBallAt(ctx: Ctx, key: Ctx, tick: number, id: string, p: { x: number; y: number; raised: boolean }): void {
  ctx.save();
  ctx.globalAlpha = 0.6;
  const trail = retroTrail(key, tick, id, p.x, p.y, 6);
  const n = trail.length - 1;
  for (let i = 0; i < n; i++) {
    const q = trail[i]!;
    const k = (i + 1) / (n + 1);
    ctx.fillStyle = `rgba(201,214,232,${(0.22 * k).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(q.x, q.y, Math.max(1.5, PIN_BALL_R * k * 0.85), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (p.raised) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(p.x + 5, p.y + 7, PIN_BALL_R, PIN_BALL_R - 1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  drawBall(ctx, p.x, p.y);
}

/** Balls held in the lock: small chrome balls lined up beside the hole. */
function drawLocked(ctx: Ctx, s: Pin4State, t: number): void {
  for (let i = 0; i < s.locked; i++) drawBall(ctx, P4_LOCK_X + 22 + i * 17, P4_LOCK_Y + 4);
  if (s.lockLit && blink(t, 300)) {
    ctx.strokeStyle = LOCK_GOLD;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(P4_LOCK_X, P4_LOCK_Y, 15, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/**
 * The plunger's power meter, in the shooter lane above the waiting ball: five zones from the bottom (soft,
 * Z) to the top (full, J), each lettered, the skill shot's lane gold; the needle at the power now.
 */
const METER_TOP = 520 + S - 60;
const METER_BOTTOM = 652 + S - 22;
function drawMeter(ctx: Ctx, s: Pin4State, t: number): void {
  if (s.live || s.charge < 0) return;
  const x0 = P4_LANE_INNER + 4;
  const w = P4_LANE_OUTER - P4_LANE_INNER - 8;
  const h = METER_BOTTOM - METER_TOP;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x0 - 1, METER_TOP - 1, w + 2, h + 2);
  for (let lane = 0; lane < P4_LANE_COUNT; lane++) {
    // Lane `lane` holds the powers whose plunge drops into it: Z at the bottom, J at the top.
    const zone = P4_LANE_COUNT - 1 - lane;
    const y1 = METER_BOTTOM - (zone * h) / P4_LANE_COUNT;
    const y0 = METER_BOTTOM - ((zone + 1) * h) / P4_LANE_COUNT;
    const gold = lane === s.skillLane;
    ctx.fillStyle = gold ? (blink(t, 180) ? "rgba(255,216,74,0.75)" : "rgba(255,216,74,0.45)") : zone % 2 ? "rgba(75,255,122,0.16)" : "rgba(75,255,122,0.1)";
    ctx.fillRect(x0, y0 + 1, w, y1 - y0 - 2);
    retroText(ctx, P4_LETTERS[lane]!, x0 + w / 2, (y0 + y1) / 2 - 5, 9, gold ? "#2B1A00" : "#F0FFF4", "center");
  }
  const power = p4PowerAt(s.charge);
  const ny = METER_BOTTOM - ((power + 0.5) * h) / (P4_POWER_MAX + 1);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(x0 - 3, ny - 1.5, w + 6, 3);
  if (p4PlungeLane(power) === s.skillLane) {
    ctx.fillStyle = "rgba(255,248,214,0.35)";
    ctx.fillRect(x0 - 3, ny - 4, w + 6, 8);
  }
  if (blink(t, 300)) retroText(ctx, "TAP!", P4_LANE_X, METER_TOP - 14, 8, LOCK_GOLD, "center");
}

/** The HUD above the arch: points left; ball, locks and the multiball clock right. */
function drawHud(ctx: Ctx, s: Pin4State): void {
  // One Retro HUD (3 Nov 2026): points top left; the ball and the lock / multiball state top right.
  const ball = Math.min(PIN_BALLS, s.lost + 1);
  let status: RetroHudItem | null = null;
  if (p4JackpotLit(s)) status = { text: `MULTIBALL ${Math.ceil((s.mbUntil - s.tick) / 60)}`, colour: "#FF9BFF" };
  else if (s.locks > 0) status = { text: s.lockLit && s.locks === 2 ? "MULTIBALL LIT" : `${s.locks} LOCKED`, colour: LOCK_GOLD };
  else if (s.lockLit) status = { text: "LOCK LIT", colour: LOCK_GOLD };
  retroHud(ctx, P4_WORLD_W, { text: s.points.toLocaleString("en-GB"), colour: PIN_COLOURS.hud }, [
    { text: `BALL ${ball}/${PIN_BALLS}`, colour: PIN_COLOURS.hud },
    status,
  ]);
  if (s.lost >= PIN_BALLS && s.tick < pinRunTicksOf(s)) retroText(ctx, "GAME OVER", P4_WORLD_W / 2 - 12, 420 + S, 16, "#FF3B5C", "center", 6);
}

function drawWorld(ctx: Ctx, s: Pin4State, key: Ctx): void {
  const bloom = retroBloom();
  const t = retroClock();
  const layer = cachedLayer(tables, ctx, P4_WORLD_W, P4_WORLD_H, (c) => paintTable(c, true));
  if (layer) ctx.drawImage(layer as CanvasImageSource, 0, 0, P4_WORLD_W, P4_WORLD_H);
  else paintTable(ctx, false);

  drawLights(ctx, s, bloom, t);
  drawJackpot(ctx, s, t);
  ctx.save();
  ctx.translate(0, S);
  // pinRev 1's live parts, whose state fields pinRev 4 keeps (bumperAt, slingAt, targets, spins, flips).
  drawSlingFlash(ctx, s);
  drawTargets(ctx, s);
  drawSpinner(ctx, s, key, t);
  drawBumperFlash(ctx, s);
  drawFlippers(ctx, s);
  drawBumperPoints(ctx, s);
  ctx.restore();

  // The balls (the ramps are in the table layer, under them); then the balls held in the lock.
  const balls: { b: P4Ball; id: string }[] = [];
  if (s.live) balls.push({ b: s as unknown as P4Ball, id: "ball" });
  s.extras.forEach((b, i) => balls.push({ b, id: `extra${i}` }));
  for (const { b, id } of balls) drawBallAt(ctx, key, s.tick, id, ballPoint(s, b));
  drawLocked(ctx, s, t);
  // The waiting ball on the plunger, its meter above it.
  if (!s.live && s.lost < PIN_BALLS) {
    drawBall(ctx, s.x / 256, s.y / 256);
    drawMeter(ctx, s, t);
  }
  for (let side = 0; side < 2; side++) {
    const held = ((s.held >> side) & 1) === 1;
    retroText(ctx, side === 0 ? "< HOLD" : "HOLD >", side === 0 ? 20 : P4_LANE_INNER - 10, P4_WORLD_H - 24, 10, held ? PIN_COLOURS.flipper : "rgba(255,226,120,0.85)", side === 0 ? "left" : "right");
  }
  drawHud(ctx, s);
}

/* ============================== The success layer ============================== */

const RIPPLE = { pattern: "ripple", colours: PINBALL_BULBS } as const;
const STRONG = { ...RIPPLE, strong: true } as const;

function lastBumper(s: Pin4State): { x: number; y: number } {
  let best = 0;
  for (let i = 1; i < P4_BUMPERS.length; i++) if ((s.bumperAt[i] ?? -999) > (s.bumperAt[best] ?? -999)) best = i;
  const [x, y] = P4_BUMPERS[best]!;
  return { x, y };
}

/**
 * pinRev 4's success layer: pinRev 1's events on the taller table (bumpers, targets, the bank, letters, the
 * spinner), and the expansion's: J-O-U-L-Z, ramp shots and combos, locks, multiball, jackpots and the skill
 * shot. Ripples on the border lights as PINBALL_FX, text only at the place.
 */
export const PINBALL4_FX: ArcadeFxSpec<Pin4State> = {
  game: "pinball",
  world: "retro",
  width: P4_WORLD_W,
  height: P4_WORLD_H,
  fit: "world",
  events: [
    { kind: "pop", count: (s) => s.bumps, at: lastBumper, label: () => null, textOnly: true, bulbs: RIPPLE },
    { kind: "perfect", count: (s) => s.drops, at: () => ({ x: 190, y: P4_TARGET_Y }), label: () => "TARGET!", textOnly: true, bulbs: RIPPLE },
    { kind: "clear", count: (s) => s.banks, at: () => ({ x: 190, y: P4_TARGET_Y }), label: () => "BANK DOWN!", textOnly: true, neon: true, bulbs: STRONG },
    { kind: "pop", count: (s) => s.laneLights, at: () => ({ x: 186, y: P4_LANE_SENSOR_Y + 40 }), label: () => null, textOnly: true, bulbs: RIPPLE },
    // J-O-U-L-Z completed (1 Nov 2026): the same banner as before, in gold (PIN_JOULZ_GOLD); its border flashes gold
    // three times (drawJoulz, below) in place of the shared layer's neon border.
    { kind: "streak", count: (s) => s.laneSets, at: () => ({ x: 186, y: P4_LANE_SENSOR_Y + 70 }), label: (s) => (s.rev6 ? "J-O-U-L-Z!" : `J-O-U-L-Z! x${s.mult}`), colour: () => PIN_JOULZ_GOLD, textOnly: true, bulbs: STRONG },
    { kind: "combo", count: (s) => s.spins, minDelta: 8, at: () => ({ x: ORBIT_MID + 30, y: P4_SPINNER_Y }), label: () => "SPINNER!", textOnly: true, bulbs: RIPPLE },
    { kind: "combo", count: (s) => s.ramps, at: (s) => ({ x: s.rampSide === 2 ? 270 : 110, y: P4_RAMP_Y + 60 }), label: (s) => (s.rev6 ? (s.combo > 1 ? "COMBO!" : "RAMP!") : s.combo > 1 ? `COMBO x${s.combo}!` : `RAMP! x${s.mult}`), textOnly: true, bulbs: RIPPLE },
    { kind: "perfect", count: (s) => s.locksMade, at: () => ({ x: P4_MID_X, y: 236 }), label: (s) => (s.locks === 0 ? "MULTIBALL!" : `BALL ${s.locks} LOCKED`), textOnly: true, neon: true, bulbs: STRONG },
    { kind: "clear", count: (s) => s.jackpots, at: () => ({ x: P4_MID_X, y: P4_JACKPOT.a[1] - 30 }), label: () => "JACKPOT!", textOnly: true, neon: true, sweep: true, bulbs: STRONG },
    { kind: "perfect", count: (s) => s.skills, at: (s) => ({ x: laneCentre(Math.max(0, s.skillLane)), y: P4_LANE_SENSOR_Y + 50 }), label: () => "SKILL SHOT!", textOnly: true, neon: true, bulbs: STRONG },
  ],
  misses: [{ count: (s) => s.lost, at: () => ({ x: P4_WORLD_W / 2, y: P4_WORLD_H - 24 }) }],
};

/**
 * J-O-U-L-Z completed (1 Nov 2026, Joe: a big moment; display only, pinRev 4–6): the shared layer's "J-O-U-L-Z!" banner as
 * before, in gold (PINBALL4_FX), and the world's border flashing gold three times, 0.15 s on and 0.15 s off
 * (`pinball.joulz` plays its sting, gameSounds.ts). On the presentation clock, like the shared success layer; a rewind (a
 * new run) starts over without firing. Reduced motion: no flashing, one steady gold border for 0.45 s.
 */
export const PIN_JOULZ_GOLD = "#FFD84A";
export const PIN_JOULZ_FLASH_MS = 150;
export const PIN_JOULZ_FLASHES = 3;
const joulzMemory = new WeakMap<object, { sets: number; tick: number; at: number }>();
const joulzNow = () => (typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now());

/** Whether the border is lit `age` ms into the moment: on for 150 ms, off for 150 ms, three times. */
export function pinJoulzBorderOn(age: number): boolean {
  if (age < 0 || age >= PIN_JOULZ_FLASH_MS * 2 * PIN_JOULZ_FLASHES) return false;
  return Math.floor(age / PIN_JOULZ_FLASH_MS) % 2 === 0;
}

function drawJoulz(c: Ctx, s: Pin4State, key: object): void {
  const sets = s.laneSets ?? 0;
  let m = joulzMemory.get(key);
  if (!m || s.tick < m.tick || sets < m.sets) {
    m = { sets, tick: s.tick, at: -Infinity };
    joulzMemory.set(key, m);
  }
  if (sets > m.sets && s.tick > m.tick) m.at = joulzNow();
  m.sets = sets;
  m.tick = s.tick;
  const age = joulzNow() - m.at;
  if (!(age >= 0 && age < PIN_JOULZ_FLASH_MS * 2 * PIN_JOULZ_FLASHES)) return;
  const still = reducedMotion();
  c.save();
  // The border: three gold flashes (one steady glow under reduced motion), inside the world's edge.
  if (still ? age < PIN_JOULZ_FLASH_MS * 3 : pinJoulzBorderOn(age)) {
    c.strokeStyle = PIN_JOULZ_GOLD;
    c.globalAlpha = 0.35;
    c.lineWidth = 12;
    c.strokeRect(6, 6, P4_WORLD_W - 12, P4_WORLD_H - 12);
    c.globalAlpha = 1;
    c.lineWidth = 4;
    c.strokeRect(2, 2, P4_WORLD_W - 4, P4_WORLD_H - 4);
  }
  c.restore();
}

function draw(ctx: Ctx, state: PinState, size: CanvasSize): void {
  const s = state as Pin4State;
  retroScreen(ctx, size, P4_WORLD_W, P4_WORLD_H, "fit", (c) => {
    arcadeFx(c, PINBALL4_FX, s, () => drawWorld(c, s, ctx));
    drawJoulz(c, s, ctx);
  });
}

export const pinball4ArtGame: ArcadeGame<Pin4State, ArcadeInputEvent | null> = { ...pinball4Game, draw: (ctx, state, size) => draw(ctx, state, size) };
/** pinRev 5's 90-second run on the same table and art. */
export const pinball5ArtGame: ArcadeGame<Pin4State, ArcadeInputEvent | null> = { ...pinball5Game, draw: (ctx, state, size) => draw(ctx, state, size) };

/** pinRev 6 (the arcade scoring standard): pinRev 5's run on the same table and art. */
export const pinball6ArtGame: ArcadeGame<Pin4State, ArcadeInputEvent | null> = { ...pinball6Game, draw: (ctx, state, size) => draw(ctx, state, size) };

/** The art game for any stored pinRev: pinRev 6, 5 and 4 this table, older ones pinball.renderer's. */
export function pinballArtGameForAny(rev?: number | null): ArcadeGame<PinState, ArcadeInputEvent | null> {
  if (rev === PIN_REV_STD) return pinball6ArtGame as unknown as ArcadeGame<PinState, ArcadeInputEvent | null>;
  if (rev === PIN_REV_LONG) return pinball5ArtGame as unknown as ArcadeGame<PinState, ArcadeInputEvent | null>;
  return rev === PIN_REV_EXPAND ? (pinball4ArtGame as unknown as ArcadeGame<PinState, ArcadeInputEvent | null>) : pinballArtGameFor(rev);
}

/** Draws any revision's state with its own table (reveals and replays get the state, not the stamp). */
export function drawPinballAny(ctx: Ctx, state: PinState, size: CanvasSize): void {
  if ((state as Partial<Pin4State>).rev4) draw(ctx, state, size);
  else pinballArtGameFor(1).draw(ctx, state, size);
}

/** The world size a stored pinRev draws in. */
export function pinballWorldHFor(rev?: number | null): number {
  return pinIsExpanded(rev) ? P4_WORLD_H : 700;
}

/**
 * The play screen's fill round the taller table: arenaFills' purple fill and lamps (pinball4Fill), with the
 * glow centred on this table.
 */
export function pinball4GlowFill(ctx: CanvasRenderingContext2D, view: ArenaSceneView): void {
  pinball4Fill(ctx, view);
  const above = fillAbove(view);
  if (above) paintTable4Glow(ctx, above.x, above.y, above.w, above.h);
  const below = fillBelow(view);
  if (!below) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createLinearGradient(0, below.y, 0, below.y + below.h);
  g.addColorStop(0, "rgba(84,24,150,0)");
  g.addColorStop(1, "rgba(84,24,150,0.28)");
  ctx.fillStyle = g;
  ctx.fillRect(below.x, below.y, below.w, below.h);
  ctx.restore();
}

/** Every static segment, for checks that hold the art to the collision shapes. */
export const P4_ART_SEGS: readonly PinSegDef[] = P4_SEGS;
