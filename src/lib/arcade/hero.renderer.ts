/**
 * Captain Joulz (design foundation F5, 6 Nov 2026; display only): the approved hero (docs/art/README.md
 * "Captain Joulz", docs/art/source/hero2.py variant '4', joints in captain-poses.json) drawn with canvas
 * primitives. It replaced the 23 Oct 2026 gold-caped stick-figure skin. Render only: it reads a pose the
 * game's art pass fills in and never touches a sim, a hitbox, a timing, a seed or a stamp.
 *
 * `drawCaptain` is a line-for-line port of hero2.py's `captain('4', …)` in the art's own units (a 160 × 200
 * box, ground at y 190): cape, back arm and gauntlet, back leg and boot, torso, chest bolt, front leg and
 * boot, front arm and gauntlet, helmet. Gold fills and strokes use the art's gradient A on each shape's own
 * bounding box, as SVG's objectBoundingBox does, so a figure drawn at the art's scale matches
 * docs/art/svg/captain-joulz-*.svg (scripts/captain-art-check.ts compares the pixels).
 *
 * Two ways in:
 * - The celebrations (heroVictoryPose, heroRunPose, heroDancePose) build the figure from the approved poses
 *   (ready, run, win), interpolating joints between them, and draw it at the art's proportions.
 * - The games (Grappler, Roofbound, Moon Climb, the icons and tiles) fill the same HeroPose joints as before
 *   (head, neck, hip, shoulder, two hands, two feet, inside their sim's body box) and `drawHero` retargets
 *   the captain onto them: shoulders and hip joints from the torso, elbows and knees solved from the art's
 *   limb lengths, the helmet sized by the head, limbs never thinner than the old figure's, so the silhouette
 *   stays inside the same box (the arcade bounds rule). Under SMALL_PX tall the figure drops the fingers,
 *   seams, sheen and glints and draws flat gold (no gradients), so a 20 px hero stays cheap and legible.
 */

/* ------------------------------------------------------------------ the art's colours */

export const CAPTAIN_SUIT = "#141A2E";
export const CAPTAIN_EDGE = "#06080F";
export const CAPTAIN_CYAN = "#22E4FF";
export const CAPTAIN_GOLD_DEEP = "#9A7A3A";
/** Ring gold (tokens.css --jz-metal-gold-1…4), gradient A's stops. */
export const CAPTAIN_GOLD_STOPS: readonly (readonly [number, string])[] = [
  [0, "#FBEDC4"],
  [0.34, "#E6C67E"],
  [0.7, "#D2AC5E"],
  [1, "#EED79C"],
];
/** The flat gold of the small figure (gradient A's middle). */
export const CAPTAIN_GOLD_FLAT = "#E2BE74";
const INK_GOLD = "#1A1206";
const WHITE = "#FFFFFF";

/** The old names, kept for anything that reads them. */
export const HERO_BLACK = CAPTAIN_SUIT;
export const HERO_GOLD = CAPTAIN_GOLD_FLAT;
/** Below this height (px) the bolt on the chest is left out. */
export const HERO_DETAIL_MIN_PX = 24;
/** Below this height (px) the small figure is drawn (flat gold, no fingers, seams, sheen or glints). */
export const CAPTAIN_SMALL_PX = 40;

/* ------------------------------------------------------------------ the approved poses (captain-poses.json) */

type Pt = readonly [number, number];
export interface CaptainArtPose {
  neck: Pt;
  hip: Pt;
  sh: readonly [Pt, Pt];
  el: readonly [Pt, Pt];
  ha: readonly [Pt, Pt];
  hp: readonly [Pt, Pt];
  kn: readonly [Pt, Pt];
  ft: readonly [Pt, Pt];
  lean: number;
}

/** docs/art/source/captain-poses.json, unchanged (captain-art-check compares them). */
export const CAPTAIN_POSES: Record<"ready" | "run" | "win", CaptainArtPose> = {
  ready: {
    neck: [80, 64], hip: [80, 114],
    sh: [[62, 72], [98, 72]], el: [[50, 98], [110, 98]], ha: [[46, 124], [114, 124]],
    hp: [[72, 116], [88, 116]], kn: [[68, 150], [92, 150]], ft: [[64, 184], [96, 184]],
    lean: 0,
  },
  run: {
    neck: [88, 64], hip: [78, 114],
    sh: [[76, 72], [100, 70]], el: [[64, 96], [110, 90]], ha: [[50, 86], [122, 72]],
    hp: [[74, 116], [84, 116]], kn: [[60, 146], [104, 138]], ft: [[40, 170], [110, 170]],
    lean: 12,
  },
  win: {
    neck: [80, 64], hip: [80, 114],
    sh: [[62, 72], [98, 72]], el: [[54, 48], [106, 48]], ha: [[46, 24], [114, 24]],
    hp: [[72, 116], [88, 116]], kn: [[64, 150], [96, 150]], ft: [[54, 184], [106, 184]],
    lean: 0,
  },
};

/** hero2.py's CAPES['long'] (ready = stand, win = cheer), before the 82 % cut. */
const CAPE_LONG: Record<"ready" | "run" | "win", readonly Pt[]> = {
  ready: [[62, 70], [96, 70], [124, 168], [112, 160], [104, 172], [92, 160], [80, 174], [68, 160], [56, 172], [48, 160], [36, 168]],
  run: [[76, 70], [98, 66], [48, 118], [52, 132], [30, 130], [30, 146], [10, 138], [6, 152], [-8, 140]],
  win: [[62, 70], [98, 70], [142, 162], [124, 154], [112, 170], [96, 156], [80, 172], [64, 156], [48, 170], [36, 154], [18, 162]],
};

/** The cape at 82 % of its length ('long82'): every hem point pulled towards the shoulders' midpoint. */
function cape82(pts: readonly Pt[]): number[] {
  const tx = (pts[0]![0] + pts[1]![0]) / 2;
  const ty = (pts[0]![1] + pts[1]![1]) / 2;
  const out: number[] = [];
  pts.forEach(([x, y], i) => {
    if (i < 2) out.push(x, y);
    else out.push(tx + (x - tx) * 0.82, ty + (y - ty) * 0.82);
  });
  return out;
}
export const CAPTAIN_CAPES = {
  ready: cape82(CAPE_LONG.ready),
  run: cape82(CAPE_LONG.run),
  win: cape82(CAPE_LONG.win),
} as const;

/* ------------------------------------------------------------------ the rig */

/** Joint slots in `CaptainRig.j` (x at 2i, y at 2i + 1). */
const NECK = 0, SH0 = 1, SH1 = 2, EL0 = 3, EL1 = 4, HA0 = 5, HA1 = 6, HP0 = 7, HP1 = 8, KN0 = 9, KN1 = 10, FT0 = 11, FT1 = 12;
const JOINTS = 13;

/** One figure in the art's units: its joints, cape, helmet and what is in front. */
export interface CaptainRig {
  j: Float64Array;
  cape: Float64Array;
  capeN: number;
  lean: number;
  /** Helmet centre (the art's hx, hy) and its scale against the body's unit. */
  headX: number;
  headY: number;
  headScale: number;
  /** The helmet, belt and chest bolt turned with the torso (radians; 0 in the approved art). */
  tilt: number;
  /** Which arm and leg are drawn in front of the torso (1 in the approved art). */
  frontArm: 0 | 1;
  frontLeg: 0 | 1;
  /** Each leg's toe direction (the approved art: -1 back leg, +1 front leg). */
  toe0: number;
  toe1: number;
  /** Visor shown (false: facing away, the back of the helmet). */
  visor: boolean;
  /** Suit colour (a game's death colour), null for the art's. */
  suit: string | null;
  /** The small figure (flat gold, no fine detail) and whether the chest bolt is drawn. */
  small: boolean;
  bolt: boolean;
  /** A game's figure: fists instead of the open gauntlet hands, and feet drawn `foot` times the art's length,
   *  so nothing reaches past the joints the game placed (the bounds rule). */
  fists: boolean;
  foot: number;
}

export function captainRig(): CaptainRig {
  return {
    j: new Float64Array(JOINTS * 2),
    cape: new Float64Array(22),
    capeN: 0,
    lean: 0,
    headX: 0,
    headY: 0,
    headScale: 1,
    tilt: 0,
    frontArm: 1,
    frontLeg: 1,
    toe0: -1,
    toe1: 1,
    visor: true,
    suit: null,
    small: false,
    bolt: true,
    fists: false,
    foot: 1,
  };
}

function setJ(r: CaptainRig, slot: number, x: number, y: number): void {
  r.j[slot * 2] = x;
  r.j[slot * 2 + 1] = y;
}
const jx = (r: CaptainRig, slot: number) => r.j[slot * 2]!;
const jy = (r: CaptainRig, slot: number) => r.j[slot * 2 + 1]!;

function setCape(r: CaptainRig, pts: readonly number[]): void {
  r.capeN = pts.length / 2;
  for (let i = 0; i < pts.length; i++) r.cape[i] = pts[i]!;
}

/** Loads an approved pose exactly (ready, run or win), with its own cape. */
export function captainArtRig(r: CaptainRig, name: "ready" | "run" | "win"): CaptainRig {
  const P = CAPTAIN_POSES[name];
  setJ(r, NECK, P.neck[0], P.neck[1]);
  for (let k = 0; k < 2; k++) {
    setJ(r, SH0 + k, P.sh[k]![0], P.sh[k]![1]);
    setJ(r, EL0 + k, P.el[k]![0], P.el[k]![1]);
    setJ(r, HA0 + k, P.ha[k]![0], P.ha[k]![1]);
    setJ(r, HP0 + k, P.hp[k]![0], P.hp[k]![1]);
    setJ(r, KN0 + k, P.kn[k]![0], P.kn[k]![1]);
    setJ(r, FT0 + k, P.ft[k]![0], P.ft[k]![1]);
  }
  setCape(r, CAPTAIN_CAPES[name]);
  r.lean = P.lean;
  r.headX = P.neck[0] + P.lean * 0.4;
  r.headY = P.neck[1] - 17;
  r.headScale = 1;
  r.tilt = 0;
  r.frontArm = 1;
  r.frontLeg = 1;
  r.toe0 = -1;
  r.toe1 = 1;
  r.visor = true;
  r.suit = null;
  r.small = false;
  r.bolt = true;
  r.fists = false;
  r.foot = 1;
  return r;
}

/* ------------------------------------------------------------------ paint helpers */

/** Gradient A on a shape's bounding box, exactly as SVG's objectBoundingBox gradient (0,0) → (0.35,1) paints it. */
function bboxGradient(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, gx: number, gy: number): CanvasGradient {
  const w = Math.max(1e-3, x1 - x0);
  const h = Math.max(1e-3, y1 - y0);
  const n = gx * gx + gy * gy;
  const a = gx / (w * n);
  const b = gy / (h * n);
  const m = a * a + b * b;
  return ctx.createLinearGradient(x0, y0, x0 + a / m, y0 + b / m);
}

let flat = false;
function gold(ctx: CanvasRenderingContext2D, b: BBox): CanvasGradient | string {
  if (flat) return CAPTAIN_GOLD_FLAT;
  const g = bboxGradient(ctx, b.x0, b.y0, b.x1, b.y1, 0.35, 1);
  for (const [o, c] of CAPTAIN_GOLD_STOPS) g.addColorStop(o, c);
  return g;
}
function sheen(ctx: CanvasRenderingContext2D, b: BBox): CanvasGradient {
  const g = bboxGradient(ctx, b.x0, b.y0, b.x1, b.y1, 1, 1);
  g.addColorStop(0.3, "rgba(255,255,255,0)");
  g.addColorStop(0.45, "rgba(255,255,255,0.55)");
  g.addColorStop(0.55, "rgba(255,255,255,0)");
  return g;
}

/** A path's geometric bounding box (SVG's objectBoundingBox: no stroke), built point by point. */
class BBox {
  x0 = Infinity;
  y0 = Infinity;
  x1 = -Infinity;
  y1 = -Infinity;
  reset(): this {
    this.x0 = this.y0 = Infinity;
    this.x1 = this.y1 = -Infinity;
    return this;
  }
  add(x: number, y: number): this {
    if (x < this.x0) this.x0 = x;
    if (x > this.x1) this.x1 = x;
    if (y < this.y0) this.y0 = y;
    if (y > this.y1) this.y1 = y;
    return this;
  }
  /** A quadratic from (ax, ay) via (cx, cy) to (bx, by): its end and any turning point. */
  quad(ax: number, ay: number, cx: number, cy: number, bx: number, by: number): this {
    this.add(bx, by);
    const ext = (p0: number, p1: number, p2: number) => {
      const d = p0 - 2 * p1 + p2;
      if (Math.abs(d) < 1e-9) return -1;
      return (p0 - p1) / d;
    };
    for (const t of [ext(ax, cx, bx), ext(ay, cy, by)]) {
      if (t > 0 && t < 1) {
        const u = 1 - t;
        this.add(u * u * ax + 2 * u * t * cx + t * t * bx, u * u * ay + 2 * u * t * cy + t * t * by);
      }
    }
    return this;
  }
}
const box = new BBox();

const lerpX = (ax: number, bx: number, t: number) => ax + (bx - ax) * t;

/** hero2.py's L(): one round-capped, round-joined polyline stroke. */
function polyline(ctx: CanvasRenderingContext2D, pts: readonly number[], w: number, colour: string | CanvasGradient): void {
  ctx.beginPath();
  ctx.moveTo(pts[0]!, pts[1]!);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i]!, pts[i + 1]!);
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = colour;
  ctx.stroke();
}
function bboxOf(pts: readonly number[]): BBox {
  box.reset();
  for (let i = 0; i < pts.length; i += 2) box.add(pts[i]!, pts[i + 1]!);
  return box;
}

/** A plain straight line (SVG's default butt caps). */
function line(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, w: number, colour: string | CanvasGradient, cap: CanvasLineCap = "butt"): void {
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineWidth = w;
  ctx.lineCap = cap;
  ctx.strokeStyle = colour;
  ctx.stroke();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/** The art's bolt (gen.py BOLT) at (cx, cy) and scale `sc`, outlined 2 units when `stroke`. */
const BOLT_PTS = [66, 34, 44, 74, 58, 74, 52, 104, 78, 60, 63, 60] as const;
function bolt(ctx: CanvasRenderingContext2D, cx: number, cy: number, sc: number, stroke: boolean): void {
  const ox = cx - 61 * sc;
  const oy = cy - 69 * sc;
  ctx.beginPath();
  for (let i = 0; i < BOLT_PTS.length; i += 2) {
    const x = ox + BOLT_PTS[i]! * sc;
    const y = oy + BOLT_PTS[i + 1]! * sc;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  box.reset().add(ox + 44 * sc, oy + 34 * sc).add(ox + 78 * sc, oy + 104 * sc);
  ctx.fillStyle = gold(ctx, box);
  ctx.fill();
  if (stroke) {
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = CAPTAIN_EDGE;
    ctx.stroke();
  }
}

/* ------------------------------------------------------------------ the parts (hero2.py) */

function drawCape(ctx: CanvasRenderingContext2D, r: CaptainRig): void {
  const n = r.capeN;
  if (n < 3) return;
  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(r.cape[0]!, r.cape[1]!);
    for (let i = 1; i < n; i++) ctx.lineTo(r.cape[i * 2]!, r.cape[i * 2 + 1]!);
    ctx.closePath();
  };
  box.reset();
  for (let i = 0; i < n; i++) box.add(r.cape[i * 2]!, r.cape[i * 2 + 1]!);
  trace();
  ctx.fillStyle = gold(ctx, box);
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = CAPTAIN_EDGE;
  ctx.stroke();
  if (r.small) return;
  ctx.save();
  ctx.globalAlpha *= 0.45;
  ctx.fillStyle = sheen(ctx, box);
  ctx.fill();
  ctx.restore();
  // The inner dark line: the same outline at 95 %, moved 4 units in.
  ctx.save();
  ctx.translate(4, 4);
  ctx.scale(0.95, 0.95);
  trace();
  ctx.globalAlpha *= 0.35;
  ctx.lineWidth = 1;
  ctx.strokeStyle = INK_GOLD;
  ctx.stroke();
  ctx.restore();
}

const limbPts = [0, 0, 0, 0, 0, 0];
/** limb2: outline at w + 7, gold at w + 4, suit at w, along root → middle → end. */
function limb(ctx: CanvasRenderingContext2D, r: CaptainRig, a: number, b: number, c: number, w: number): void {
  limbPts[0] = jx(r, a); limbPts[1] = jy(r, a);
  limbPts[2] = jx(r, b); limbPts[3] = jy(r, b);
  limbPts[4] = jx(r, c); limbPts[5] = jy(r, c);
  polyline(ctx, limbPts, w + 7, CAPTAIN_EDGE);
  polyline(ctx, limbPts, w + 4, gold(ctx, bboxOf(limbPts)));
  polyline(ctx, limbPts, w, r.suit ?? CAPTAIN_SUIT);
}

/** One gauntlet finger: three stacked round strokes (outline, gold, suit). */
function finger(ctx: CanvasRenderingContext2D, fx: number, fy: number, x0: number, y0: number, x1: number, y1: number, w: number, suit: string): void {
  const ax = fx + x0, ay = fy + y0, bx = fx + x1, by = fy + y1;
  line(ctx, ax, ay, bx, by, w + 3.4, CAPTAIN_EDGE, "round");
  box.reset().add(ax, ay).add(bx, by);
  line(ctx, ax, ay, bx, by, w + 1.6, gold(ctx, box), "round");
  line(ctx, ax, ay, bx, by, w - 0.4, suit, "round");
}
const FINGERS = [
  [-4.5, -6.5, 11],
  [-1.5, -2, 13],
  [1.5, 2, 13],
  [4.5, 6.5, 11],
] as const;

/** The gauntlet on the forearm from elbow `e` to hand `h`: the cuff, then the hand (palm, thumb, four fingers, knuckles, bolt). */
function gauntlet(ctx: CanvasRenderingContext2D, r: CaptainRig, e: number, h: number): void {
  const ex = jx(r, e), ey = jy(r, e), hx = jx(r, h), hy = jy(r, h);
  const suit = r.suit ?? CAPTAIN_SUIT;
  const dx = hx - ex, dy = hy - ey;
  const n = Math.hypot(dx, dy) || 1;
  const ux = dx / n, uy = dy / n;
  const px = -uy, py = ux;
  if (r.small || r.fists) {
    // A game figure's fist: a gold-rimmed suit disc on the hand.
    ctx.beginPath();
    ctx.arc(hx + ux * 2, hy + uy * 2, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = flat ? CAPTAIN_GOLD_FLAT : gold(ctx, box.reset().add(hx + ux * 2 - 6.5, hy + uy * 2 - 6.5).add(hx + ux * 2 + 6.5, hy + uy * 2 + 6.5));
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = CAPTAIN_EDGE;
    ctx.stroke();
    return;
  }
  const ax = lerpX(ex, hx, 0.6), ay = lerpX(ey, hy, 0.6);
  const bx = lerpX(ex, hx, 0.86), by = lerpX(ey, hy, 0.86);
  ctx.beginPath();
  ctx.moveTo(ax + px * 6.5, ay + py * 6.5);
  ctx.lineTo(bx + px * 10, by + py * 10);
  ctx.lineTo(bx - px * 10, by - py * 10);
  ctx.lineTo(ax - px * 6.5, ay - py * 6.5);
  ctx.closePath();
  box.reset().add(ax + px * 6.5, ay + py * 6.5).add(bx + px * 10, by + py * 10).add(bx - px * 10, by - py * 10).add(ax - px * 6.5, ay - py * 6.5);
  ctx.fillStyle = gold(ctx, box);
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = 2;
  ctx.strokeStyle = CAPTAIN_EDGE;
  ctx.stroke();
  const mx = lerpX(ax, bx, 0.55), my = lerpX(ay, by, 0.55);
  line(ctx, mx + px * 8.3, my + py * 8.3, mx - px * 8.3, my - py * 8.3, 1.6, CAPTAIN_GOLD_DEEP);
  // The hand, turned so its fingers run on along the forearm (whole degrees, as the art's transform).
  const fx = hx + ux * 2, fy = hy + uy * 2;
  const ang = Math.round((Math.atan2(uy, ux) * 180) / Math.PI - 90);
  ctx.save();
  ctx.translate(fx, fy);
  ctx.rotate((ang * Math.PI) / 180);
  ctx.translate(-fx, -fy);
  finger(ctx, fx, fy, -6, -1, -11, 6, 3.2, suit);
  for (const [x0, x1, y1] of FINGERS) finger(ctx, fx, fy, x0, 3, x1, y1, 2.8, suit);
  roundRect(ctx, fx - 7.5, fy - 6, 15, 11, 4);
  ctx.fillStyle = suit;
  ctx.fill();
  ctx.lineWidth = 4.2;
  ctx.strokeStyle = CAPTAIN_EDGE;
  ctx.stroke();
  ctx.fill();
  box.reset().add(fx - 7.5, fy - 6).add(fx + 7.5, fy + 5);
  ctx.lineWidth = 2;
  ctx.strokeStyle = gold(ctx, box);
  ctx.stroke();
  box.reset().add(fx - 6, fy + 3).add(fx + 6, fy + 3.001);
  line(ctx, fx - 6, fy + 3, fx + 6, fy + 3, 2.2, gold(ctx, box), "round");
  bolt(ctx, fx, fy - 1.5, 0.085, false);
  ctx.restore();
}

const bootPts = [0, 0, 0, 0];
/** The tall gold boot from 42 % of the shin to the foot, its cuff line, the rounded foot and the black sole. */
function boot(ctx: CanvasRenderingContext2D, r: CaptainRig, k: number, f: number, toe: number): void {
  const flip = toe * r.foot;
  const kx = jx(r, k), ky = jy(r, k), fx = jx(r, f), fy = jy(r, f);
  const tx = lerpX(kx, fx, 0.42), ty = lerpX(ky, fy, 0.42);
  bootPts[0] = tx; bootPts[1] = ty; bootPts[2] = fx; bootPts[3] = fy;
  polyline(ctx, bootPts, 17, CAPTAIN_EDGE);
  polyline(ctx, bootPts, 14, gold(ctx, bboxOf(bootPts)));
  if (!r.small) {
    const dx = fx - tx, dy = fy - ty;
    const n = Math.hypot(dx, dy) || 1;
    const px = -dy / n, py = dx / n;
    const cx = lerpX(tx, fx, 0.1), cy = lerpX(ty, fy, 0.1);
    line(ctx, cx + px * 8, cy + py * 8, cx - px * 8, cy - py * 8, 3, CAPTAIN_GOLD_DEEP);
  }
  ctx.beginPath();
  ctx.moveTo(fx - 9 * flip, fy - 2);
  ctx.quadraticCurveTo(fx + 2 * flip, fy - 8, fx + 13 * flip, fy + 1);
  ctx.lineTo(fx + 13 * flip, fy + 5);
  ctx.lineTo(fx - 9 * flip, fy + 5);
  ctx.closePath();
  box.reset().add(fx - 9 * flip, fy - 2).quad(fx - 9 * flip, fy - 2, fx + 2 * flip, fy - 8, fx + 13 * flip, fy + 1).add(fx + 13 * flip, fy + 5).add(fx - 9 * flip, fy + 5);
  ctx.fillStyle = gold(ctx, box);
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = 2;
  ctx.strokeStyle = CAPTAIN_EDGE;
  ctx.stroke();
  line(ctx, fx - 9 * flip, fy + 5, fx + 13 * flip, fy + 5, 3, CAPTAIN_EDGE);
}

/** torso2 (the 'big' logo): the suit trapezoid, the gold seams, the belt and its buckle; then the chest bolt. */
function torso(ctx: CanvasRenderingContext2D, r: CaptainRig): void {
  const slx = jx(r, SH0), sly = jy(r, SH0), srx = jx(r, SH1), sry = jy(r, SH1);
  const plx = jx(r, HP0), ply = jy(r, HP0), prx = jx(r, HP1), pry = jy(r, HP1);
  const suit = r.suit ?? CAPTAIN_SUIT;
  ctx.beginPath();
  ctx.moveTo(slx - 3, sly - 1);
  ctx.lineTo(srx + 3, sry - 1);
  ctx.lineTo(prx + 3, pry);
  ctx.lineTo(plx - 3, ply);
  ctx.closePath();
  ctx.fillStyle = suit;
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = CAPTAIN_EDGE;
  ctx.stroke();
  const mx = (slx + srx) / 2;
  if (!r.small) {
    // The collar seam and the two side seams.
    ctx.beginPath();
    ctx.moveTo(slx + 4, sly + 4);
    ctx.quadraticCurveTo(mx, sly + 18, srx - 4, sry + 4);
    box.reset().add(slx + 4, sly + 4).quad(slx + 4, sly + 4, mx, sly + 18, srx - 4, sry + 4);
    ctx.lineWidth = 1.6;
    ctx.lineCap = "butt";
    ctx.strokeStyle = gold(ctx, box);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(slx + 2, sly + 10);
    ctx.lineTo(plx + 3, ply - 12);
    ctx.moveTo(srx - 2, sry + 10);
    ctx.lineTo(prx - 3, pry - 12);
    box.reset().add(slx + 2, sly + 10).add(plx + 3, ply - 12).add(srx - 2, sry + 10).add(prx - 3, pry - 12);
    ctx.save();
    ctx.globalAlpha *= 0.8;
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = gold(ctx, box);
    ctx.stroke();
    ctx.restore();
  }
  // The belt and buckle, square to the torso.
  ctx.save();
  if (r.tilt) {
    const cx = (plx + prx) / 2, cy = (ply + pry) / 2;
    ctx.translate(cx, cy);
    ctx.rotate(r.tilt);
    ctx.translate(-cx, -cy);
  }
  roundRect(ctx, plx - 4, ply - 9, prx - plx + 8, 8, 2);
  box.reset().add(plx - 4, ply - 9).add(prx + 4, ply - 1);
  ctx.fillStyle = gold(ctx, box);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = CAPTAIN_EDGE;
  ctx.stroke();
  const bx = (plx + prx) / 2 - 5;
  roundRect(ctx, bx, ply - 11, 10, 12, 2);
  ctx.fillStyle = suit;
  ctx.fill();
  box.reset().add(bx, ply - 11).add(bx + 10, ply + 1);
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = gold(ctx, box);
  ctx.stroke();
  ctx.restore();
  // chest('big'): the bolt at scale 0.5 on the chest.
  if (r.bolt) {
    const my = (sly + ply) / 2;
    ctx.save();
    if (r.tilt) {
      ctx.translate(mx, my - 1);
      ctx.rotate(r.tilt);
      ctx.translate(-mx, -(my - 1));
    }
    bolt(ctx, mx, my - 1, 0.5, true);
    ctx.restore();
  }
}

/** head('none'): the helmet, three faint cyan lines, the gold cheek guards, the V visor and its glint. */
function helmet(ctx: CanvasRenderingContext2D, r: CaptainRig): void {
  const hx = r.headX, hy = r.headY;
  ctx.save();
  if (r.headScale !== 1 || r.tilt) {
    ctx.translate(hx, hy);
    ctx.rotate(r.tilt);
    ctx.scale(r.headScale, r.headScale);
    ctx.translate(-hx, -hy);
  }
  ctx.beginPath();
  ctx.moveTo(hx - 20, hy + 4);
  ctx.quadraticCurveTo(hx - 21, hy - 21, hx, hy - 22);
  ctx.quadraticCurveTo(hx + 21, hy - 21, hx + 20, hy + 4);
  ctx.quadraticCurveTo(hx + 17, hy + 18, hx, hy + 20);
  ctx.quadraticCurveTo(hx - 17, hy + 18, hx - 20, hy + 4);
  ctx.closePath();
  ctx.fillStyle = r.suit ?? CAPTAIN_SUIT;
  ctx.fill();
  ctx.lineJoin = "miter";
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = CAPTAIN_EDGE;
  ctx.stroke();
  if (!r.small) {
    ctx.save();
    ctx.globalAlpha *= 0.32;
    for (const [x0, y0, x1] of [
      [hx - 9, hy - 17, hx - 7],
      [hx, hy - 21, hx],
      [hx + 9, hy - 17, hx + 7],
    ] as const)
      line(ctx, x0, y0, x1, hy - 8, 1.3, CAPTAIN_CYAN, "round");
    ctx.restore();
  }
  if (r.visor || !r.small) {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(hx + s * 17, hy + 6);
      ctx.quadraticCurveTo(hx + s * 12, hy + 18, hx + s * 3, hy + 19);
      box.reset().add(hx + s * 17, hy + 6).quad(hx + s * 17, hy + 6, hx + s * 12, hy + 18, hx + s * 3, hy + 19);
      ctx.lineWidth = 3;
      ctx.lineCap = "butt";
      ctx.strokeStyle = gold(ctx, box);
      ctx.stroke();
    }
  }
  if (r.visor) {
    const vx = hx + r.lean * 0.25;
    ctx.beginPath();
    ctx.moveTo(vx - 15, hy - 6);
    ctx.lineTo(vx + 15, hy - 6);
    ctx.lineTo(vx + 12, hy + 5);
    ctx.lineTo(vx + 3, hy + 2);
    ctx.lineTo(vx, hy + 6);
    ctx.lineTo(vx - 3, hy + 2);
    ctx.lineTo(vx - 12, hy + 5);
    ctx.closePath();
    ctx.fillStyle = CAPTAIN_CYAN;
    ctx.fill();
    ctx.lineJoin = "round";
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = CAPTAIN_EDGE;
    ctx.stroke();
    if (!r.small) {
      ctx.beginPath();
      ctx.moveTo(vx - 13, hy - 4);
      ctx.lineTo(vx + 13, hy - 4);
      ctx.lineTo(vx + 12, hy - 1);
      ctx.lineTo(vx - 12, hy - 1);
      ctx.closePath();
      ctx.save();
      ctx.globalAlpha *= 0.55;
      ctx.fillStyle = WHITE;
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}

/**
 * Draws Captain Joulz from a rig, in the art's units (the caller's transform places and scales it; the
 * approved poses at scale 1 sit in the art's 160 × 200 box). The caller's transform, alpha and clip are kept.
 */
export function drawCaptain(ctx: CanvasRenderingContext2D, r: CaptainRig): void {
  ctx.save();
  ctx.miterLimit = 4;
  flat = r.small;
  drawCape(ctx, r);
  const back = r.frontArm === 1 ? 0 : 1;
  const backLeg = r.frontLeg === 1 ? 0 : 1;
  const arm = (k: number) => {
    limb(ctx, r, SH0 + k, EL0 + k, HA0 + k, 11);
    gauntlet(ctx, r, EL0 + k, HA0 + k);
  };
  const leg = (k: number) => {
    limb(ctx, r, HP0 + k, KN0 + k, FT0 + k, 12);
    boot(ctx, r, KN0 + k, FT0 + k, k === 0 ? r.toe0 : r.toe1);
  };
  arm(back);
  leg(backLeg);
  torso(ctx, r);
  leg(1 - backLeg);
  arm(1 - back);
  helmet(ctx, r);
  flat = false;
  ctx.restore();
}

/* ------------------------------------------------------------------ the games' pose */

/** One figure's joints in its own frame (the frame the game drew its stick figure in). */
export interface HeroPose {
  headX: number;
  headY: number;
  headR: number;
  /** Torso top and bottom. */
  neckX: number;
  neckY: number;
  hipX: number;
  hipY: number;
  /** Where both arms start, and the hands. */
  shoulderX: number;
  shoulderY: number;
  handAX: number;
  handAY: number;
  handBX: number;
  handBY: number;
  /** Both legs start at the hip. */
  footAX: number;
  footAY: number;
  footBX: number;
  footBY: number;
  /** The stick figure's own line width, in pose units. */
  stick: number;
  /** World px per pose unit (1 unless the game scales its figure). */
  scale: number;
  /** Real px per pose unit for the detail cut-offs only (a game icon drawn larger than the game); NaN uses `scale`. */
  detailScale: number;
  /** Travel direction in the pose frame (need not be unit length; 0,0 = standing). */
  moveX: number;
  moveY: number;
  /** 0 standing … 1 fast: how far the cape lifts towards the trailing direction. */
  speed: number;
  /** Which way the visor looks, -1 … 1; NaN hides it (facing away). */
  face: number;
  /** Suit colour override (a game's death colour); null keeps the captain's suit. */
  core: string | null;
  /** Reduced motion: the cape lifts only gently and snaps instead of easing. */
  gentle: boolean;
  /** Eased cape angle and when it was last drawn (the hero's own presentation memory). */
  capeAngle: number;
  capeAt: number;
  /**
   * The celebrations' figure: when `rigOn`, `rig` is drawn as is, in the art's units placed at (rigX, rigY)
   * and scaled by rigU px a unit, and the joints above only describe where it is (heroVictoryPose and co.).
   */
  rigOn: boolean;
  rig: CaptainRig;
  rigX: number;
  rigY: number;
  rigU: number;
}

export function heroPose(): HeroPose {
  return {
    headX: 0,
    headY: 0,
    headR: 4,
    neckX: 0,
    neckY: 0,
    hipX: 0,
    hipY: 0,
    shoulderX: 0,
    shoulderY: 0,
    handAX: 0,
    handAY: 0,
    handBX: 0,
    handBY: 0,
    footAX: 0,
    footAY: 0,
    footBX: 0,
    footBY: 0,
    stick: 2,
    scale: 1,
    detailScale: NaN,
    moveX: 0,
    moveY: 0,
    speed: 0,
    face: 0,
    core: null,
    gentle: false,
    capeAngle: Math.PI / 2,
    capeAt: -1,
    rigOn: false,
    rig: captainRig(),
    rigX: 0,
    rigY: 0,
    rigU: 1,
  };
}

const HANG = Math.PI / 2;
const now = () => (typeof performance !== "undefined" ? performance.now() : 0);

/** The cape's angle (canvas radians, π/2 = straight down): towards the trailing side by speed, never above level. */
function capeAngle(p: HeroPose): number {
  const len = Math.hypot(p.moveX, p.moveY);
  let target = HANG;
  if (len > 1e-6 && p.speed > 0) {
    const trail = Math.atan2(-p.moveY, -p.moveX);
    let diff = trail - HANG;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    // Straight ahead downwards: the trail points up, so the cape keeps hanging.
    if (Math.abs(diff) > Math.PI * 0.98) diff = 0;
    const lift = Math.min(1, p.speed) * (p.gentle ? 0.3 : 0.85);
    target = Math.min(Math.PI, Math.max(0, HANG + diff * lift));
  }
  const t = now();
  const dt = t - p.capeAt;
  if (p.gentle || p.capeAt < 0 || dt < 0 || dt > 250) p.capeAngle = target;
  else p.capeAngle += (target - p.capeAngle) * (1 - Math.exp(-dt / 90));
  p.capeAt = t;
  return p.capeAngle;
}

/** The art's limb lengths (ready pose): upper arm, forearm, thigh, shin. */
const ARM_UPPER = Math.hypot(12, 26);
const ARM_FORE = Math.hypot(4, 26);
const LEG_UPPER = Math.hypot(4, 34);
const LEG_LOWER = Math.hypot(4, 34);

/**
 * Two-bone reach from root (rx, ry) to end (ex, ey): the middle joint into slot `mid`, bent towards
 * (bx, by) (the side the art bends that limb). Upper and lower keep the art's ratio, the whole limb at
 * least `min` long and `stretch` times the reach (a slight bend at full stretch).
 */
function reach(r: CaptainRig, mid: number, rx: number, ry: number, ex: number, ey: number, upper: number, lower: number, min: number, bx: number, by: number, stretch = 1.06): void {
  const dx = ex - rx, dy = ey - ry;
  const d = Math.hypot(dx, dy);
  const total = Math.max(min, d * stretch);
  const l1 = (total * upper) / (upper + lower);
  const l2 = total - l1;
  if (d < 1e-6) {
    setJ(r, mid, rx + bx * l1, ry + by * l1);
    return;
  }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ux = dx / d, uy = dy / d;
  let px = -uy, py = ux;
  if (px * bx + py * by < 0) {
    px = -px;
    py = -py;
  }
  setJ(r, mid, rx + ux * a + px * h, ry + uy * a + py * h);
}

/** The ready cape, top edge centred on the origin (its shoulders' midpoint), hanging down the +y axis. */
const CAPE_READY_LOCAL = (() => {
  const c = CAPTAIN_CAPES.ready;
  const cx = (c[0]! + c[2]!) / 2;
  const cy = (c[1]! + c[3]!) / 2;
  return c.map((v, i) => (i % 2 === 0 ? v - cx : v - cy));
})();
const CAPE_READY_LEN = Math.max(...CAPE_READY_LOCAL.filter((_, i) => i % 2 === 1));
const CAPE_READY_HALF = Math.max(...CAPE_READY_LOCAL.filter((_, i) => i % 2 === 0).map(Math.abs));

/**
 * The captain on a game's joints: everything worked out in the art's units (`kw` pose units each, the body's
 * width unit), then drawn by drawCaptain under one scale. See the file comment.
 */
function retarget(p: HeroPose, r: CaptainRig, tall: number): number {
  const unit = 1 / (p.scale || 1);
  // The torso: its length gives the art's proportions (neck to hip is 50 units in the art).
  let dx = p.hipX - p.neckX;
  let dy = p.hipY - p.neckY;
  let T = Math.hypot(dx, dy);
  if (T < 1e-6) {
    T = p.headR * 2;
    dx = 0;
    dy = T;
  }
  const dX = dx / T, dY = dy / T;
  // The side vector: the art's +x when the torso hangs straight down.
  const sX = dY, sY = -dX;
  const k = T / 50;
  // Limbs never thinner than the old figure's (its core plus the gold edge), so a small figure reads as before.
  const oldWidth = Math.max(p.stick * 1.3, 2.5 * unit) + 2.4 * unit;
  const kw = Math.max(k, oldWidth / 18);
  const toArt = 1 / kw;
  const ox = p.neckX, oy = p.neckY;
  const put = (slot: number, x: number, y: number) => setJ(r, slot, (x - ox) * toArt, (y - oy) * toArt);
  r.small = tall < CAPTAIN_SMALL_PX;
  // Shoulders 8 below the neck and 18 either side; hip joints 2 below the hip and 8 either side (art units × k).
  const shX = p.neckX + dX * 8 * k, shY = p.neckY + dY * 8 * k;
  const hpX = p.hipX + dX * 2 * k, hpY = p.hipY + dY * 2 * k;
  put(NECK, p.neckX, p.neckY);
  put(SH0, shX - sX * 18 * k, shY - sY * 18 * k);
  put(SH1, shX + sX * 18 * k, shY + sY * 18 * k);
  put(HP0, hpX - sX * 8 * k, hpY - sY * 8 * k);
  put(HP1, hpX + sX * 8 * k, hpY + sY * 8 * k);
  // Hands and feet to the sides they are on (slot 0 the art's left).
  const side = (x: number, y: number) => (x - p.neckX) * sX + (y - p.neckY) * sY;
  const aLeft = side(p.handAX, p.handAY) <= side(p.handBX, p.handBY);
  put(HA0, aLeft ? p.handAX : p.handBX, aLeft ? p.handAY : p.handBY);
  put(HA1, aLeft ? p.handBX : p.handAX, aLeft ? p.handBY : p.handAY);
  const fLeft = side(p.footAX, p.footAY) <= side(p.footBX, p.footBY);
  // The game's foot point is the figure's lowest: the boot's sole sits on it, so the joint is lifted 5 units.
  const lift = 5 * kw;
  const f0x = fLeft ? p.footAX : p.footBX, f0y = fLeft ? p.footAY : p.footBY;
  const f1x = fLeft ? p.footBX : p.footAX, f1y = fLeft ? p.footBY : p.footAY;
  put(FT0, f0x - dX * lift, f0y - dY * lift);
  put(FT1, f1x - dX * lift, f1y - dY * lift);
  // Elbows bend outwards; knees towards the way the hero looks (outwards facing the viewer).
  const face = p.face === p.face ? Math.max(-1, Math.min(1, p.face)) : 0;
  // A game's limbs run nearly straight from joint to joint, as its stick figure did: the game's joints are
  // where it put its figure, so the art's own limb lengths would fold them.
  const armMin = 0;
  const legMin = 0;
  const stretch = 1.03;
  // The torso may lean: bend directions are turned with it.
  const tilt = Math.atan2(dY, dX) - HANG;
  const c = Math.cos(tilt), s = Math.sin(tilt);
  const rot = (x: number, y: number): [number, number] => [x * c - y * s, x * s + y * c];
  const facing = Math.abs(face) > 0.3 ? Math.sign(face) : 0;
  const [k0x, k0y] = rot(facing || -1, 0);
  const [k1x, k1y] = rot(facing || 1, 0);
  reach(r, KN0, jx(r, HP0), jy(r, HP0), jx(r, FT0), jy(r, FT0), LEG_UPPER, LEG_LOWER, legMin, k0x, k0y, stretch);
  reach(r, KN1, jx(r, HP1), jy(r, HP1), jx(r, FT1), jy(r, FT1), LEG_UPPER, LEG_LOWER, legMin, k1x, k1y, stretch);
  const [e0x, e0y] = rot(-1, 0.15);
  const [e1x, e1y] = rot(1, 0.15);
  reach(r, EL0, jx(r, SH0), jy(r, SH0), jx(r, HA0), jy(r, HA0), ARM_UPPER, ARM_FORE, armMin, e0x, e0y, stretch);
  reach(r, EL1, jx(r, SH1), jy(r, SH1), jx(r, HA1), jy(r, HA1), ARM_UPPER, ARM_FORE, armMin, e1x, e1y, stretch);
  // The helmet on the game's head, its half-width (20 units and the outline) the head's radius.
  r.headX = (p.headX - ox) * toArt;
  r.headY = (p.headY - oy) * toArt;
  r.headScale = p.headR / 21.25 / kw;
  r.tilt = tilt;
  r.lean = face * 12;
  r.visor = p.face === p.face;
  r.suit = p.core;
  r.frontArm = face < -0.3 ? 0 : 1;
  r.frontLeg = face < -0.3 ? 0 : 1;
  r.toe0 = facing > 0 ? 1 : -1;
  r.toe1 = facing < 0 ? -1 : 1;
  r.small = tall < CAPTAIN_SMALL_PX;
  r.bolt = tall >= HERO_DETAIL_MIN_PX;
  r.fists = true;
  r.foot = 0.6;
  // The cape: the ready cape hung from the shoulders' midpoint, as long as the old cape, never wider than the
  // old cape (0.9 of the head's radius either side), turned to its eased angle (the travel's trailing side).
  const leg =
    (Math.hypot(p.footAX - p.hipX, p.footAY - p.hipY) + Math.hypot(p.footBX - p.hipX, p.footBY - p.hipY)) / 2;
  const capeL = (T + leg * 0.5) * toArt;
  const half = Math.min(CAPE_READY_HALF * k, p.headR * 0.9) * toArt;
  const sy = capeL / CAPE_READY_LEN;
  const sx = half / CAPE_READY_HALF;
  const angle = capeAngle(p) + tilt;
  const cc = Math.cos(angle - HANG), cs = Math.sin(angle - HANG);
  const mx = (jx(r, SH0) + jx(r, SH1)) / 2;
  const my = (jy(r, SH0) + jy(r, SH1)) / 2;
  r.capeN = CAPE_READY_LOCAL.length / 2;
  for (let i = 0; i < r.capeN; i++) {
    const lx = CAPE_READY_LOCAL[i * 2]! * sx;
    const ly = CAPE_READY_LOCAL[i * 2 + 1]! * sy;
    r.cape[i * 2] = mx + lx * cc - ly * cs;
    r.cape[i * 2 + 1] = my + lx * cs + ly * cc;
  }
  return kw;
}

/** Draws the hero in the current frame. The caller's transform, alpha and clip are kept. */
export function drawHero(ctx: CanvasRenderingContext2D, p: HeroPose): void {
  if (p.rigOn) {
    ctx.save();
    ctx.translate(p.rigX, p.rigY);
    ctx.scale(p.rigU, p.rigU);
    drawCaptain(ctx, p.rig);
    ctx.restore();
    return;
  }
  const px = p.detailScale === p.detailScale ? p.detailScale : p.scale;
  const tall = (Math.max(p.footAY, p.footBY) - (p.headY - p.headR)) * px;
  const kw = retarget(p, p.rig, tall);
  ctx.save();
  ctx.translate(p.neckX, p.neckY);
  ctx.scale(kw, kw);
  drawCaptain(ctx, p.rig);
  ctx.restore();
}

/* ------------------------------------------------------------ celebration poses */

/**
 * The celebrations' poses (src/lib/fx/celebrationCanvas.ts), built from the approved ready, run and win poses
 * at the art's proportions and filled into a pose the caller owns, so a frame allocates nothing. `h` is the
 * figure's height in px (sole to raised hands, 170 art units), `footY` the ground. The joints the scene reads
 * (head, hands, feet, neck, hip) are set to where the drawn figure has them.
 */

/** Art units in the celebrations' `h` (sole at 190 to above the win pose's raised hands). */
const CELEBRATION_UNITS = 170;
const GROUND = 190;

/** The victory pose's loop (ms): the bob and the cape's billow repeat over it. */
export const HERO_VICTORY_LOOP_MS = 1200;
/** The dance's beat (ms): one step, one arm pump. */
export const HERO_DANCE_BEAT_MS = 300;

function lerpInto(r: CaptainRig, slot: number, a: Pt, b: Pt, t: number, dx = 0, dy = 0): void {
  setJ(r, slot, a[0] + (b[0] - a[0]) * t + dx, a[1] + (b[1] - a[1]) * t + dy);
}

function lerpCape(r: CaptainRig, a: readonly number[], b: readonly number[], t: number): void {
  r.capeN = a.length / 2;
  for (let i = 0; i < a.length; i++) r.cape[i] = a[i]! + (b[i]! - a[i]!) * t;
}

/** The scene's joints from the drawn rig (art → px about (ax0, GROUND) → (cx, footY)). */
function describe(p: HeroPose, cx: number, footY: number, ax0: number, U: number, plantA: boolean, plantB: boolean): void {
  const r = p.rig;
  const X = (x: number) => cx + (x - ax0) * U;
  const Y = (y: number) => footY + (y - GROUND) * U;
  p.rigOn = true;
  p.rigU = U;
  p.rigX = cx - ax0 * U;
  p.rigY = footY - GROUND * U;
  p.scale = 1;
  p.detailScale = NaN;
  p.stick = 11 * U;
  p.headR = 21.25 * U;
  p.headX = X(r.headX);
  p.headY = Y(r.headY);
  p.neckX = X(jx(r, NECK));
  p.neckY = Y(jy(r, NECK));
  p.shoulderX = X((jx(r, SH0) + jx(r, SH1)) / 2);
  p.shoulderY = Y((jy(r, SH0) + jy(r, SH1)) / 2);
  p.hipX = X((jx(r, HP0) + jx(r, HP1)) / 2);
  p.hipY = Y((jy(r, HP0) + jy(r, HP1)) / 2);
  p.handAX = X(jx(r, HA0));
  p.handAY = Y(jy(r, HA0));
  p.handBX = X(jx(r, HA1));
  p.handBY = Y(jy(r, HA1));
  // The feet as the scene sees them: the soles (6 units under the joint), exactly the ground when planted.
  p.footAX = X(jx(r, FT0));
  p.footAY = plantA ? footY : Y(jy(r, FT0) + 6);
  p.footBX = X(jx(r, FT1));
  p.footBY = plantB ? footY : Y(jy(r, FT1) + 6);
  p.core = null;
}

/** Victory: the win pose (arms up in a V, the cape flared), the body bobbing over planted feet (`t` in ms; `gentle` holds still). */
export function heroVictoryPose(p: HeroPose, cx: number, footY: number, h: number, t: number, gentle = false): HeroPose {
  const U = h / CELEBRATION_UNITS;
  const r = captainArtRig(p.rig, "win");
  const W = CAPTAIN_POSES.win;
  // The old bob (2.2 % of the height) in art units; the knees take half of it, the feet none.
  const bob = gentle ? 0 : Math.sin((t / HERO_VICTORY_LOOP_MS) * Math.PI * 2) * 0.022 * CELEBRATION_UNITS;
  for (let slot = 0; slot < JOINTS; slot++) {
    if (slot === FT0 || slot === FT1) continue;
    r.j[slot * 2 + 1]! -= slot === KN0 || slot === KN1 ? bob / 2 : bob;
  }
  r.headY -= bob;
  // The billow shares the bob's period (twice over), so the loop is seamless: the flare eases towards the ready cape.
  const billow = gentle ? 0 : 0.14 * (0.5 + 0.5 * Math.sin((t / HERO_VICTORY_LOOP_MS) * Math.PI * 4));
  lerpCape(r, CAPTAIN_CAPES.win, CAPTAIN_CAPES.ready, billow);
  for (let i = 0; i < r.capeN; i++) r.cape[i * 2 + 1]! -= bob;
  describe(p, cx, footY, W.neck[0], U, true, true);
  p.moveX = 1;
  p.moveY = 0.25;
  p.speed = gentle ? 0.15 : 0.5;
  p.face = 0;
  p.gentle = gentle;
  return p;
}

/**
 * Running to the right: the run pose, its legs and arms trading places over each stride (each knee, foot,
 * elbow and hand interpolated between its own position and the other limb's), the body dropping to the ground as the legs pass and airborne at full
 * stride (`phase` counts strides, 1 = one stride).
 */
export function heroRunPose(p: HeroPose, x: number, footY: number, h: number, phase: number): HeroPose {
  const U = h / CELEBRATION_UNITS;
  const R = CAPTAIN_POSES.run;
  const r = captainArtRig(p.rig, "run");
  const s = Math.sin(phase * Math.PI * 2);
  const u = (1 + s) / 2;
  // Airborne at full stride (the art's feet 20 above their ready height); on the ground as they pass.
  const drop = (1 - Math.abs(s)) * 14;
  // The torso keeps the art's shape (neck, shoulders, hip joints): only the limbs swing, each knee, foot,
  // elbow and hand moving between its own position and the other limb's.
  setJ(r, NECK, R.neck[0], R.neck[1] + drop);
  for (let k = 0; k < 2; k++) {
    setJ(r, SH0 + k, R.sh[k]![0], R.sh[k]![1] + drop);
    setJ(r, HP0 + k, R.hp[k]![0], R.hp[k]![1] + drop);
  }
  lerpInto(r, KN0, R.kn[0], R.kn[1], u, 0, drop);
  lerpInto(r, KN1, R.kn[1], R.kn[0], u, 0, drop);
  lerpInto(r, FT0, R.ft[0], R.ft[1], u, 0, drop);
  lerpInto(r, FT1, R.ft[1], R.ft[0], u, 0, drop);
  lerpInto(r, EL0, R.el[0], R.el[1], u, 0, drop);
  lerpInto(r, EL1, R.el[1], R.el[0], u, 0, drop);
  lerpInto(r, HA0, R.ha[0], R.ha[1], u, 0, drop);
  lerpInto(r, HA1, R.ha[1], R.ha[0], u, 0, drop);
  r.headY += drop;
  // In front: the leg whose foot is ahead, its toe forward (the art: slot 1); the other's toe back.
  const lead = jx(r, FT1) >= jx(r, FT0) ? 1 : 0;
  r.frontLeg = lead;
  r.toe0 = lead === 0 ? 1 : -1;
  r.toe1 = lead === 1 ? 1 : -1;
  r.frontArm = 1;
  // The cape streams back, its hem fluttering a little with the stride.
  for (let i = 0; i < r.capeN; i++) {
    r.cape[i * 2 + 1]! += drop;
    if (i >= 2) r.cape[i * 2 + 1]! += Math.sin(phase * Math.PI * 4 + i) * 1.5;
  }
  const plant = Math.abs(s) < 1e-9;
  describe(p, x, footY, R.hip[0], U, plant, plant);
  p.moveX = 1;
  p.moveY = 0;
  p.speed = 1;
  p.face = 0.8;
  p.gentle = false;
  return p;
}

/**
 * Dancing on the spot (a 190–199 reveal): the ready pose swaying and bouncing on the beat, the feet lifting
 * in turn, each arm pumping between its ready and win positions, one up as the other comes down (`t` in ms
 * since the dance began).
 */
export function heroDancePose(p: HeroPose, cx: number, footY: number, h: number, t: number): HeroPose {
  const U = h / CELEBRATION_UNITS;
  const A = CAPTAIN_POSES.ready;
  const B = CAPTAIN_POSES.win;
  const r = captainArtRig(p.rig, "ready");
  const s = Math.sin((t / HERO_DANCE_BEAT_MS) * Math.PI);
  const a = (1 + s) / 2;
  const b = 1 - a;
  // The old dance's sway (5 %) and bounce (4 %) of the height, in art units.
  const sway = s * 0.05 * CELEBRATION_UNITS;
  const bounce = Math.abs(s) * 0.04 * CELEBRATION_UNITS;
  const lift0 = Math.max(0, s) * 0.06 * CELEBRATION_UNITS;
  const lift1 = Math.max(0, -s) * 0.06 * CELEBRATION_UNITS;
  setJ(r, NECK, A.neck[0] + sway * 1.3, A.neck[1] + bounce);
  lerpInto(r, SH0, A.sh[0], B.sh[0], a, sway * 1.3, bounce);
  lerpInto(r, SH1, A.sh[1], B.sh[1], b, sway * 1.3, bounce);
  lerpInto(r, EL0, A.el[0], B.el[0], a, sway * 1.3, bounce);
  lerpInto(r, EL1, A.el[1], B.el[1], b, sway * 1.3, bounce);
  lerpInto(r, HA0, A.ha[0], B.ha[0], a, sway * 1.3, bounce);
  lerpInto(r, HA1, A.ha[1], B.ha[1], b, sway * 1.3, bounce);
  lerpInto(r, HP0, A.hp[0], A.hp[0], 0, sway, bounce);
  lerpInto(r, HP1, A.hp[1], A.hp[1], 0, sway, bounce);
  lerpInto(r, KN0, A.kn[0], A.kn[0], 0, sway / 2, bounce / 2 - lift0 / 2);
  lerpInto(r, KN1, A.kn[1], A.kn[1], 0, sway / 2, bounce / 2 - lift1 / 2);
  lerpInto(r, FT0, A.ft[0], A.ft[0], 0, 0, -lift0);
  lerpInto(r, FT1, A.ft[1], A.ft[1], 0, 0, -lift1);
  r.headX = A.neck[0] + sway * 1.6;
  r.headY = A.neck[1] - 17 + bounce;
  r.lean = s * 4;
  lerpCape(r, CAPTAIN_CAPES.ready, CAPTAIN_CAPES.win, 0.3 + 0.25 * Math.abs(s));
  for (let i = 0; i < r.capeN; i++) {
    r.cape[i * 2]! += sway * 1.3;
    r.cape[i * 2 + 1]! += bounce;
  }
  describe(p, cx, footY, A.neck[0], U, lift0 === 0, lift1 === 0);
  p.moveX = s >= 0 ? 1 : -1;
  p.moveY = 0.2;
  p.speed = 0.35 + 0.25 * Math.abs(s);
  p.face = 0;
  p.gentle = false;
  return p;
}
