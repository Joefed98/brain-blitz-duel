/**
 * The Joulz hero (23 Oct 2026, display only): one skin drawn over the joint points every
 * stick-figure game already had (Grappler, Jaywalk, Roofbound). Render only: it reads a pose
 * the game's art pass fills in and never touches a sim, a hitbox or a stamp.
 *
 * Back to front: cape (gold gradient, trails opposite the travel and lifts with speed), gold
 * outline of every limb and the torso, the black core of the same strokes (all outlines
 * first, then all cores, so the joints merge into one silhouette), the chest bolt, gold
 * gloves and boots, then the head (black, gold ring, gold mask band and two eye slits).
 * Under 24 px tall the eye slits and the bolt are dropped.
 *
 * Every width the brief gives in px is turned into the pose's own units through `scale`
 * (world px per pose unit), so a game drawing its figure scaled keeps the same look.
 * Gradients are built in each part's own frame and kept per context and size, and the
 * pose is a flat object each game owns, so a frame allocates nothing.
 */

export const HERO_BLACK = "#0D0D0F";
export const HERO_GOLD = "#F7BF2F";
export const HERO_GOLD_LIGHT = "#FFE08A";
export const HERO_GOLD_DEEP = "#C98A0E";
export const HERO_CAPE_EDGE = "#A86F08";
export const HERO_BOLT_LOWER = "#D99A14";
/** Below this height (px) the eye slits and the chest bolt are left out. */
export const HERO_DETAIL_MIN_PX = 24;

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
  /** Real px per pose unit for the eye-slit and bolt cut-off only (a game icon drawn larger than the game); NaN uses `scale`. */
  detailScale: number;
  /** Travel direction in the pose frame (need not be unit length; 0,0 = standing). */
  moveX: number;
  moveY: number;
  /** 0 standing … 1 fast: how far the cape lifts towards the trailing direction. */
  speed: number;
  /** Eye slits' shift towards the travel side, -1 … 1; NaN hides them (facing away). */
  face: number;
  /** Core colour override (a game's death colour); null keeps the hero's black. */
  core: string | null;
  /** Reduced motion: the cape lifts only gently and snaps instead of easing. */
  gentle: boolean;
  /** Eased cape angle and when it was last drawn (the hero's own presentation memory). */
  capeAngle: number;
  capeAt: number;
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
  };
}

interface Paint {
  r: number;
  capeL: number;
  cape: CanvasGradient;
  glove: CanvasGradient;
  mask: CanvasGradient;
}
const paints = new WeakMap<CanvasRenderingContext2D, Paint>();

function goldStops(g: CanvasGradient): CanvasGradient {
  g.addColorStop(0, HERO_GOLD_LIGHT);
  g.addColorStop(0.45, HERO_GOLD);
  g.addColorStop(1, HERO_GOLD_DEEP);
  return g;
}

/** Gradients for one size, in each part's own frame (cape from its shoulders, glove and mask from their centres). */
function paintFor(ctx: CanvasRenderingContext2D, r: number, capeL: number): Paint {
  const old = paints.get(ctx);
  if (old && old.r === r && old.capeL === capeL) return old;
  const glove = r * 0.4;
  const band = r * 0.3;
  const paint: Paint = {
    r,
    capeL,
    cape: goldStops(ctx.createLinearGradient(0, 0, 0, capeL)),
    glove: goldStops(ctx.createLinearGradient(-glove, -glove, glove, glove)),
    mask: goldStops(ctx.createLinearGradient(0, -band, 0, band)),
  };
  paints.set(ctx, paint);
  return paint;
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

function limbs(ctx: CanvasRenderingContext2D, p: HeroPose): void {
  ctx.beginPath();
  ctx.moveTo(p.neckX, p.neckY);
  ctx.lineTo(p.hipX, p.hipY);
  ctx.lineTo(p.footAX, p.footAY);
  ctx.moveTo(p.hipX, p.hipY);
  ctx.lineTo(p.footBX, p.footBY);
  ctx.moveTo(p.handAX, p.handAY);
  ctx.lineTo(p.shoulderX, p.shoulderY);
  ctx.lineTo(p.handBX, p.handBY);
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(-x, -y);
}

/** Draws the hero in the current frame. The caller's transform, alpha and clip are kept. */
export function drawHero(ctx: CanvasRenderingContext2D, p: HeroPose): void {
  const unit = 1 / (p.scale || 1);
  const r = p.headR;
  const torso = Math.hypot(p.hipX - p.neckX, p.hipY - p.neckY);
  const leg =
    (Math.hypot(p.footAX - p.hipX, p.footAY - p.hipY) +
      Math.hypot(p.footBX - p.hipX, p.footBY - p.hipY)) /
    2;
  const capeL = Math.round((torso + leg * 0.5) * 4) / 4;
  const tall =
    (Math.max(p.footAY, p.footBY) - (p.headY - r)) *
    (p.detailScale === p.detailScale ? p.detailScale : p.scale);
  const detail = tall >= HERO_DETAIL_MIN_PX;
  const paint = paintFor(ctx, r, capeL);
  const core = Math.max(p.stick * 1.3, 2.5 * unit);

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // 1. Cape, behind everything, hung from the shoulders and turned to its eased angle.
  const angle = capeAngle(p);
  ctx.save();
  ctx.translate(p.shoulderX, p.shoulderY);
  ctx.rotate(angle - HANG);
  const top = r * 0.7;
  const hem = r * 0.85;
  ctx.beginPath();
  ctx.moveTo(-top, 0);
  ctx.lineTo(top, 0);
  ctx.lineTo(hem, capeL);
  ctx.quadraticCurveTo(0, capeL + r * 0.25, -hem, capeL);
  ctx.closePath();
  ctx.fillStyle = paint.cape;
  ctx.fill();
  ctx.strokeStyle = HERO_CAPE_EDGE;
  ctx.lineWidth = 0.8 * unit;
  ctx.stroke();
  ctx.restore();

  // 2–3. Gold outline of every limb, then the black core over it.
  limbs(ctx, p);
  ctx.strokeStyle = HERO_GOLD;
  ctx.lineWidth = core + 2.4 * unit;
  ctx.stroke();
  ctx.strokeStyle = p.core ?? HERO_BLACK;
  ctx.lineWidth = core;
  ctx.stroke();

  // 4. Chest bolt on the upper torso, turned with it.
  if (detail && torso > 0) {
    const h = r * 0.9;
    ctx.save();
    ctx.translate(p.neckX + (p.hipX - p.neckX) * 0.38, p.neckY + (p.hipY - p.neckY) * 0.38);
    ctx.rotate(Math.atan2(p.hipY - p.neckY, p.hipX - p.neckX) - HANG);
    ctx.scale(h, h);
    ctx.fillStyle = HERO_GOLD;
    ctx.beginPath();
    ctx.moveTo(0.18, -0.5);
    ctx.lineTo(-0.26, 0.06);
    ctx.lineTo(0.02, 0.06);
    ctx.lineTo(0, -0.08);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = HERO_BOLT_LOWER;
    ctx.beginPath();
    ctx.moveTo(0, -0.08);
    ctx.lineTo(0.28, -0.08);
    ctx.lineTo(-0.14, 0.5);
    ctx.lineTo(0.02, 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 5. Gloves and boots.
  const glove = r * 0.4;
  ctx.fillStyle = paint.glove;
  dot(ctx, p.handAX, p.handAY, glove);
  dot(ctx, p.handBX, p.handBY, glove);
  dot(ctx, p.footAX, p.footAY, glove);
  dot(ctx, p.footBX, p.footBY, glove);

  // 6. Head: black, the gold mask band clipped to it, eye slits, then the gold ring.
  ctx.translate(p.headX, p.headY);
  ctx.fillStyle = HERO_BLACK;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.translate(0, -r * 0.15);
  ctx.fillStyle = paint.mask;
  ctx.fillRect(-r, -r * 0.3, r * 2, r * 0.6);
  if (detail && p.face === p.face) {
    const face = Math.max(-1, Math.min(1, p.face));
    const w = r * 0.34;
    const h = Math.max(r * 0.22, 0.9 * unit);
    const gap = r * 0.3 * (1 - Math.abs(face) * 0.35);
    const mid = face * r * 0.38;
    ctx.fillStyle = HERO_BLACK;
    ctx.fillRect(mid - gap - w / 2, -h / 2, w, h);
    ctx.fillRect(mid + gap - w / 2, -h / 2, w, h);
  }
  ctx.restore();
  ctx.strokeStyle = HERO_GOLD;
  ctx.lineWidth = 1.2 * unit;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/* ------------------------------------------------------------ celebration poses */

/**
 * The celebrations' two poses (Prompt P, 23 Oct 2026; src/lib/fx/celebrationCanvas.ts): filled
 * into a pose the caller owns, so a frame allocates nothing, then drawn with drawHero as every
 * game draws it. `h` is the figure's height in px (feet to raised hands), `footY` the ground.
 */

/** The victory pose's loop (ms): the bob and the cape's billow repeat over it. */
export const HERO_VICTORY_LOOP_MS = 1200;

/** Victory: arms up in a V, the cape billowing to one side, a gentle bob of the body (`t` in ms; `gentle` holds still). */
export function heroVictoryPose(p: HeroPose, cx: number, footY: number, h: number, t: number, gentle = false): HeroPose {
  const u = h / 100;
  const bob = gentle ? 0 : Math.sin((t / HERO_VICTORY_LOOP_MS) * Math.PI * 2) * 2.2 * u;
  const y = footY - bob;
  p.scale = 1;
  p.detailScale = NaN;
  p.stick = 3 * u;
  p.headR = 10 * u;
  p.footAX = cx - 11 * u;
  p.footAY = footY;
  p.footBX = cx + 11 * u;
  p.footBY = footY;
  p.hipX = cx;
  p.hipY = y - 38 * u;
  p.neckX = cx;
  p.neckY = y - 68 * u;
  p.shoulderX = cx;
  p.shoulderY = y - 64 * u;
  p.handAX = cx - 21 * u;
  p.handAY = y - 96 * u;
  p.handBX = cx + 21 * u;
  p.handBY = y - 96 * u;
  p.headX = cx;
  p.headY = y - 80 * u;
  // A steady breeze from the right: the cape lifts to the left and ripples.
  p.moveX = 1;
  p.moveY = 0.25;
  // The billow shares the bob's 1.2 s period (twice over), so the pose loops seamlessly.
  p.speed = gentle ? 0.15 : 0.45 + 0.2 * Math.sin((t / HERO_VICTORY_LOOP_MS) * Math.PI * 4);
  p.face = 0;
  p.core = null;
  p.gentle = gentle;
  return p;
}

/** Running to the right: legs and arms swinging, leaning in, the cape trailing (`phase` counts strides, 1 = one stride). */
export function heroRunPose(p: HeroPose, x: number, footY: number, h: number, phase: number): HeroPose {
  const u = h / 100;
  const swing = Math.sin(phase * Math.PI * 2);
  const a = swing * 0.62;
  const leg = 38 * u;
  const arm = 25 * u;
  p.scale = 1;
  p.detailScale = NaN;
  p.stick = 3 * u;
  p.headR = 10 * u;
  p.hipX = x;
  // The planted foot stays on the ground, so the body rises as the legs pass under it.
  p.hipY = footY - Math.cos(a) * leg;
  p.neckX = x + 7 * u;
  p.neckY = p.hipY - 30 * u;
  p.shoulderX = x + 6 * u;
  p.shoulderY = p.neckY + 4 * u;
  p.headX = x + 10 * u;
  p.headY = p.neckY - 12 * u;
  // The leg swinging back lifts its foot off the ground.
  p.footAX = x + Math.sin(a) * leg;
  p.footAY = p.hipY + Math.cos(a) * leg - (swing < 0 ? -swing * 9 * u : 0);
  p.footBX = x - Math.sin(a) * leg;
  p.footBY = p.hipY + Math.cos(a) * leg - (swing > 0 ? swing * 9 * u : 0);
  p.handAX = p.shoulderX - Math.sin(a) * arm;
  p.handAY = p.shoulderY + Math.cos(a) * arm * 0.9;
  p.handBX = p.shoulderX + Math.sin(a) * arm;
  p.handBY = p.shoulderY + Math.cos(a) * arm * 0.9;
  p.moveX = 1;
  p.moveY = 0;
  p.speed = 1;
  p.face = 0.8;
  p.core = null;
  p.gentle = false;
  return p;
}

/** The dance's beat (ms): one step, one arm pump. */
export const HERO_DANCE_BEAT_MS = 300;

/**
 * Dancing on the spot (a 190–199 reveal): the body sways and bounces on the beat, the feet lift in
 * turn and the arms pump, one up as the other swings out (`t` in ms since the dance began).
 */
export function heroDancePose(p: HeroPose, cx: number, footY: number, h: number, t: number): HeroPose {
  const u = h / 100;
  const s = Math.sin((t / HERO_DANCE_BEAT_MS) * Math.PI);
  const bounce = Math.abs(s) * 4 * u;
  const sway = s * 5 * u;
  p.scale = 1;
  p.detailScale = NaN;
  p.stick = 3 * u;
  p.headR = 10 * u;
  p.footAX = cx - 11 * u;
  p.footAY = footY - Math.max(0, s) * 6 * u;
  p.footBX = cx + 11 * u;
  p.footBY = footY - Math.max(0, -s) * 6 * u;
  p.hipX = cx + sway;
  p.hipY = footY - 38 * u + bounce;
  p.neckX = cx + sway * 1.3;
  p.neckY = p.hipY - 30 * u;
  p.shoulderX = p.neckX;
  p.shoulderY = p.neckY + 4 * u;
  p.headX = p.neckX + sway * 0.3;
  p.headY = p.neckY - 12 * u;
  // Arm A up as B swings out, then the other way.
  const a = (1 + s) / 2;
  const b = 1 - a;
  p.handAX = p.shoulderX - (14 + 8 * (1 - a)) * u;
  p.handAY = p.shoulderY + (6 - 36 * a) * u;
  p.handBX = p.shoulderX + (14 + 8 * (1 - b)) * u;
  p.handBY = p.shoulderY + (6 - 36 * b) * u;
  p.moveX = s >= 0 ? 1 : -1;
  p.moveY = 0.2;
  p.speed = 0.35 + 0.25 * Math.abs(s);
  p.face = 0;
  p.core = null;
  p.gentle = false;
  return p;
}
